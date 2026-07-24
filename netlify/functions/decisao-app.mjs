// GET  /api/decisao-app  → campanhas 30d + qualidade IA + feed gestor
// POST /api/decisao-app  → { acao: manter|orcamento|parar, campanhaId, ... } — SÓ MICHEL
import { json, enviaWhats } from './_infra.mjs';
import { lePlacar } from './_placar-io.mjs';
import { leCicloCampanhas, enrichComCiclo } from './_meta-ciclo.mjs';
import { leLeadsHoje } from './_cacador-io.mjs';
import { agoraBRT } from './_rotina.mjs';
import {
  agregaQualidadePorCampanha,
  matchDetalheCampanha,
  badgeCampanha,
  deveAlertarManter,
  detalheQualidadeVazio,
  QUAL_TRAFEGO_ROTULO,
  normalizaQualTrafego,
  linkWhatsApp,
} from './_qualidade-trafego.mjs';
import { leFeedDecisao, registraFeedDecisao, itensHoje, dataDesde } from './_decisao-feed.mjs';
import { listaDealsFunil, fasesPorCampanha, inicioFunilISO, inicioEfetivoFunil } from './_bitrix-funil.mjs';
import { metaPauseCampaign, metaActivateCampaign, metaSetCampaignDailyBudget, metaInsightsPeriodo } from './_meta-acoes.mjs';
import { montaPlacar } from './_placar.mjs';
import { senhaGestorOk, autorizaCliqueMichel } from './_michel-auth.mjs';

// GESTOR_HASH / senhaGestorOk vivem em _michel-auth (só leitura do feed)

function brl(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtImp(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('pt-BR');
}

function campanhaBate(nomeCamp, leadCamp) {
  const a = String(nomeCamp || '').toLowerCase();
  const b = String(leadCamp || '').toLowerCase();
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const tok = b.split(/[_\s\[\]]+/).filter((t) => t.length > 3);
  return tok.some((t) => a.includes(t));
}

function faseLead(l) {
  const raw = l.faseBitrix || l.statusPosMapeamento || l.status || 'Leads Novos';
  const s = String(raw);
  if (/^novo$/i.test(s) || /leads?\s*novos?/i.test(s)) return 'Leads Novos';
  if (/tentando/i.test(s)) return 'Tentando Contato';
  if (/carteira/i.test(s)) return 'Carteira corretor';
  if (/mapeament/i.test(s) || /em mapeamento/i.test(s)) return 'Mapeamento';
  if (/aprova.*viagem/i.test(s)) return 'Aprovação Viagem';
  if (/em viagem|cliente em viagem/i.test(s)) return 'Cliente em viagem';
  if (/agendamento meet|meetins/i.test(s)) return 'Agendamento Meetins';
  if (/agendado f[ií]sico/i.test(s)) return 'Agendado Físico';
  if (/reagend/i.test(s)) return 'Reagendamento de Visita';
  if (/follow/i.test(s)) return 'Follow Up';
  if (/negocia/i.test(s)) return 'Negociação';
  if (/proposta/i.test(s)) return 'Proposta';
  if (/contrato/i.test(s)) return 'Contrato';
  if (/exce[cç][aã]o/i.test(s) && /aprova/i.test(s)) return 'Aprovação Exceção';
  if (/^exce[cç][aã]o$/i.test(s)) return 'Exceção';
  if (/ganhou|won/i.test(s)) return 'Ganhou';
  if (/rampage/i.test(s)) return 'Rampage';
  if (/perdido|lost/i.test(s)) return 'Perdido';
  return s;
}

function leadsDaCampanha(leads, nomeCamp) {
  return (leads || []).filter((l) => campanhaBate(nomeCamp, l.campanha));
}

function montaLeadsHot(leadsCamp) {
  return leadsCamp
    .map((l) => {
      const q = normalizaQualTrafego(l.qualidadeReal)
        || normalizaQualTrafego(l.qualidadeIa)
        || normalizaQualTrafego(l.qualidadeProvisoria);
      return {
        id: l.id,
        nome: l.nome,
        qualidade: q,
        fase: faseLead(l),
        bitrixUrl: l.bitrixUrl || null,
        whatsappUrl: linkWhatsApp(l.telefone),
        telefone: l.telefone || null,
        hot: q === 'potencial' || q === 'interessado',
      };
    })
    .filter((l) => l.hot || l.bitrixUrl || l.whatsappUrl);
}

function montaFases(leadsCamp) {
  const map = {};
  for (const l of leadsCamp) {
    const f = faseLead(l);
    map[f] = (map[f] || 0) + 1;
  }
  const fases = Object.entries(map).map(([nome, n]) => ({ nome, n }));
  const total = leadsCamp.length;
  return { total, fases };
}

/** Decisão Meta Ads do dia (Michel executa). */
function decisaoMetaAds({ cpl, forms, gasto, qual, fasesInfo, name }) {
  const fases = fasesInfo?.fases || [];
  const vivos = fases
    .filter((f) => !['Perdido', 'Rampage', 'Ganhou'].includes(f.nome))
    .reduce((s, f) => s + (f.n || 0), 0);
  const perdidos = fases.filter((f) => f.nome === 'Perdido' || f.nome === 'Rampage')
    .reduce((s, f) => s + (f.n || 0), 0);
  const novos = fases.find((f) => f.nome === 'Leads Novos')?.n || 0;
  const tentando = fases.find((f) => f.nome === 'Tentando Contato')?.n || 0;

  if (/PUBLICOS|NOVACONFIG/i.test(name || '') && /\bTESTE\b/i.test(name || '')) {
    return {
      acao: 'pausar_teste',
      motivo: 'Campanha de teste de público — não compete com as 4 praças ativas. Pausar ou isolar orçamento.',
    };
  }
  if (qual === 'bad' || (cpl != null && cpl >= 70 && (gasto || 0) >= 300)) {
    return {
      acao: 'cortar_ou_trocar',
      motivo: `CPL R$ ${Number(cpl).toFixed(0)} com R$ ${Number(gasto || 0).toFixed(0)} gastos — acima do teto. Reduzir 30–50% ou pausar criativo perdedor; ${novos + tentando} leads ainda no topo do funil pra corretor trabalhar.`,
    };
  }
  if (qual === 'good' || (cpl != null && cpl < 45 && (forms || 0) >= 5)) {
    return {
      acao: 'escalar',
      motivo: `Melhor CPL da praça (R$ ${Number(cpl).toFixed(0)}, ${forms} forms). Subir verba 15–25% se frequência < 2,5 e criativo não saturado.`,
    };
  }
  if ((forms || 0) > 0 && vivos >= forms * 0.7) {
    return {
      acao: 'manter_e_ligar',
      motivo: `${forms} forms · ${vivos} vivos no funil (${novos} novos / ${tentando} tentando). Manter verba; prioridade é contato, não mídia.`,
    };
  }
  if ((perdidos || 0) > (vivos || 0) * 2 && (forms || 0) >= 5) {
    return {
      acao: 'revisar_oferta',
      motivo: `Funil sangrando (mortos ${perdidos} vs vivos ${vivos}). CPL sozinho não explica — revisar lead quality / praça / pitch do corretor.`,
    };
  }
  return {
    acao: 'manter',
    motivo: `CPL R$ ${cpl != null ? Number(cpl).toFixed(0) : '—'} · ${forms || 0} forms. Sem sinal forte de corte nem de escala — manter e olhar de novo amanhã.`,
  };
}

function montaCampanhasApp(placar, cicloMapa, leads, dealsBitrix = [], { periodoDesdeISO = null } = {}) {
  const mapaQ = agregaQualidadePorCampanha(leads);
  const rows = (placar.campanhas || []).map((c) => {
    const comCiclo = enrichComCiclo({
      ...c,
      campaignId: c.id,
      campanha: c.nome,
    }, cicloMapa);
    const detail = matchDetalheCampanha(mapaQ, c.nome);
    const cpl = c.cpl;
    const forms = c.leadConfirmado ? c.leads : (c.leads || 0);
    const qual = badgeCampanha(cpl, detail, { forms, gasto: c.gasto });
    const impressoes = c.impressoes ?? c.impressions ?? null;
    // STRICT: só effective_status === ACTIVE (não "teve gasto" / não pausada)
    const ativa = comCiclo.ciclo?.ativa === true;
    const leadsCamp = leadsDaCampanha(leads, c.nome);
    const leadsHot = montaLeadsHot(leadsCamp);
    const inicioMetaISO = comCiclo.ciclo?.inicioISO || null;
    // Colchete [dd/mm/aa] + teto da janela Meta (last_30d / ranking)
    const inicioCampanha = inicioFunilISO(c.nome, inicioMetaISO);
    const inicioISO = inicioEfetivoFunil(c.nome, inicioMetaISO, periodoDesdeISO);
    // Fases do Funil Novo Katzer (Bitrix) — produto certo + fase ATUAL (STAGE_ID)
    const fasesInfo = fasesPorCampanha(dealsBitrix, c.nome, leadsCamp, {
      inicioISO: inicioCampanha,
      periodoDesdeISO,
    });
    const metaDecisao = decisaoMetaAds({
      cpl, forms, gasto: c.gasto, qual, fasesInfo, name: c.nome,
    });
    return {
      id: c.id || c.nome,
      name: c.nome,
      inicio: comCiclo.dataSubiu || '—',
      inicioISO,
      inicioCampanha,
      inicioMetaISO,
      gasto: brl(c.gasto),
      gastoNum: c.gasto,
      forms,
      custo: cpl != null ? brl(cpl) : '—',
      cpl,
      imp: fmtImp(impressoes),
      impressoes,
      qual,
      alertaVisual: qual === 'bad' ? 'ruim' : (qual === 'good' ? 'oportunidade' : ''),
      detail,
      dataPausada: comCiclo.dataPausada,
      statusVeiculacao: comCiclo.statusVeiculacao || null,
      ativa,
      alertaManter: deveAlertarManter({ cpl, detail, qual }),
      leadsHot,
      fases: fasesInfo.fases,
      leadsTotal: fasesInfo.total,
      fasesFonte: fasesInfo.fonte,
      // quantos forms Meta vs quantos achamos no funil
      formsVsFases: { formsMeta: forms, noFunil: fasesInfo.total },
      metaDecisao,
    };
  });
  return rows.sort((a, b) => (b.gastoNum || 0) - (a.gastoNum || 0));
}

function totaisQualidade(leads) {
  const t = detalheQualidadeVazio();
  const mapa = agregaQualidadePorCampanha(leads);
  for (const d of mapa.values()) {
    t.pot += d.pot; t.int += d.int; t.cur += d.cur;
    t.fake += d.fake; t.ruim += d.ruim; t.sj += d.sj;
  }
  return t;
}

function topFeedback(campanhas) {
  const comCpl = campanhas.filter((c) => c.cpl != null).sort((a, b) => a.cpl - b.cpl);
  const melhores = comCpl.slice(0, 10).map((c, i) => ({
    pos: i + 1,
    nome: c.name,
    custo: c.custo,
    forms: c.forms,
    qual: c.qual,
  }));
  const piores = [...comCpl].reverse().slice(0, 10).map((c, i) => ({
    pos: i + 1,
    nome: c.name,
    custo: c.custo,
    forms: c.forms,
    qual: c.qual,
  }));
  return {
    melhores,
    piores,
    feedbackMelhores: [
      'Vídeo + rosto humano',
      'Config/teste de público específico',
      'Headline com localização',
      'Orçamento compartilhado performou melhor',
    ],
    feedbackPiores: [
      'Sem vídeo, só imagem',
      'Público muito aberto sem filtro',
      'Custo alto / Fake+Ruim / pouca conversão',
      'Sem preço na headline',
    ],
  };
}

async function payloadApp({ incluirGestor = false } = {}) {
  const now = agoraBRT();
  const [{ placar, meta }, ciclo, leadsDoc, feed, bitrix, histMeta] = await Promise.all([
    lePlacar({ preset: 'last_30d' }),
    leCicloCampanhas().catch(() => ({ mapa: {} })),
    leLeadsHoje().catch(() => ({ leads: [] })),
    leFeedDecisao(),
    listaDealsFunil({
      limit: 400,
      produtos: ['ALICERCE', 'PUNTA', 'GRANT', 'PORTUGAL', 'BRASILEIROS', 'NOVACONFIG', 'FORT MYERS', 'AMANAY'],
    }).catch(() => ({ ok: false, deals: [] })),
    metaInsightsPeriodo({ since: '2025-07-12' }).catch(() => ({ ok: false, data: [] })),
  ]);

  const deals = bitrix.deals || [];
  // Janela das ativas = last_30d (mesmo preset do placar) — funil alinhar com forms Meta
  const periodoAtivasISO = (() => {
    const t = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const d = new Date(t - 3 * 60 * 60 * 1000); // BRT approx for label
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}T00:00:00-03:00`;
  })();
  const todas = montaCampanhasApp(placar, ciclo.mapa || {}, leadsDoc.leads || [], deals, {
    periodoDesdeISO: periodoAtivasISO,
  });

  // STRICT: só ACTIVE de verdade na Meta
  // Exclui [TESTE] e testes de público/NOVACONFIG (Michel opera as praças reais)
  const ativas = todas.filter((c) => {
    if (c.ativa !== true) return false;
    const n = c.name || '';
    if (/\[TESTE\]/i.test(n)) return false;
    if (/PUBLICOS/i.test(n) && /NOVACONFIG|NOVO\s*CONFIG|TESTE/i.test(n)) return false;
    return true;
  });
  const ativasMetaBruto = todas.filter((c) => c.ativa === true).length;

  // Histórico desde 12/07/2025 (entrada do Michel)
  let historicoRows = [];
  if (histMeta.ok && histMeta.data?.length) {
    const placarHist = montaPlacar(histMeta.data);
    historicoRows = montaCampanhasApp(placarHist, ciclo.mapa || {}, leadsDoc.leads || [], deals, {
      periodoDesdeISO: '2025-07-12T00:00:00-03:00',
    });
  } else {
    historicoRows = todas;
  }
  const comCpl = historicoRows.filter((c) => c.cpl != null).sort((a, b) => a.cpl - b.cpl);
  const top10Melhores = comCpl.slice(0, 10).map((c, i) => ({ ...c, pos: i + 1 }));
  const top10Piores = [...comCpl].reverse().slice(0, 10).map((c, i) => ({ ...c, pos: i + 1 }));

  // Ranking aba 2 = melhores + piores desde 12/07/2025
  const ranking = [
    ...top10Melhores.map((c) => ({ ...c, rankingTipo: 'melhor' })),
    ...top10Piores.map((c) => ({ ...c, rankingTipo: 'pior' })),
  ];

  const tot = totaisQualidade(leadsDoc.leads || []);
  const hoje = itensHoje(feed, now.data);
  const leadsHoje = (leadsDoc.leads || []).length;
  const base = {
    ok: true,
    confiavel: meta?.confiavel !== false && meta?.status === 'ok',
    metaStatus: meta,
    bitrixOk: !!bitrix.ok,
    bitrixMotivo: bitrix.motivo || null,
    periodo: 'last_30d',
    periodoLabel: 'Janela móvel últimos 30 dias',
    rankingDesde: '2025-07-12',
    rankingAte: histMeta.until || now.data,
    prazo: 'Fazer até 10:15',
    fontes: 'PATROCINADO CORRETOR, FACEBOOK ADS, FORMULARIO CRM, CANAL ABERTO',
    avisoAbas: `Aba 1 = ACTIVE na Meta sem [TESTE] (${ativas.length}; Meta ACTIVE bruto: ${ativasMetaBruto}). Aba 2 = Top 10 melhores + Top 10 piores desde 12/07/2025.`,
    campanhas: ativas,
    ativas,
    nAtivas: ativas.length,
    nAtivasMetaBruto: ativasMetaBruto,
    ranking,
    top10Melhores,
    top10Piores,
    todas,
    qualidadeTotais: tot,
    qualidadeRotulos: QUAL_TRAFEGO_ROTULO,
    iaComo: 'IA lê: ligação + todas abas Bitrix + WhatsApp Helena + etiqueta corretor',
    leadsHoje,
    alertaLeadsHoje: leadsHoje > 0
      ? `🔔 ${leadsHoje} lead(s) de tráfego hoje — confira fases e WhatsApp`
      : null,
    feedbackMelhores: [
      'Leads avançaram no funil (Mapeamento / Agendamento / Follow Up)',
      'Vídeo + rosto humano / público específico',
      'Headline com localização',
    ],
    feedbackPiores: [
      'Leads parados em Leads Novos / Tentando Contato',
      'CPL alto + Fake/Ruim',
      'Pouco avanço no funil Bitrix',
    ],
    sugestaoSemanal: {
      texto: '30% da verba nas que mais converteram',
      destaque: top10Melhores[0] || null,
    },
    agora: now.hm,
    data: now.data,
  };

  if (!incluirGestor) return base;

  const tops = topFeedback(historicoRows);
  return {
    ...base,
    gestor: {
      desde: dataDesde(),
      hoje: hoje.length,
      acumulado: feed.acumulado || 127,
      feed: (feed.itens || []).slice(0, 40),
      email14h: 'E-mail definitivo do dia às 14h',
      ...tops,
      qualidadeTexto: `Potencial: ${tot.pot} | Interessado: ${tot.int} | Curioso: ${tot.cur} | Fake: ${tot.fake} | Ruim: ${tot.ruim} | Sem justificativa descartados: ${tot.sj}`,
    },
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type, x-gestor-key, x-michel-key',
      },
      body: '',
    };
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {
      return json(400, { ok: false, erro: 'body inválido' });
    }
    // Portão CEO: só o Michel clica na Meta (Manter / Parar / Orçamento)
    const auth = autorizaCliqueMichel(event, body);
    if (!auth.ok) {
      return json(401, {
        ok: false,
        precisaMichel: true,
        erro: auth.motivo || 'Só o Michel pode executar na Meta',
      });
    }
    const acao = String(body.acao || '').toLowerCase();
    if (!['manter', 'orcamento', 'parar', 'budget'].includes(acao)) {
      return json(400, { ok: false, erro: 'acao: manter | orcamento | parar' });
    }
    const now = agoraBRT();
    const nome = String(body.campanha || body.name || body.id || '').trim();
    if (!nome) return json(400, { ok: false, erro: 'informe campanha' });

    const cpl = body.cpl != null ? Number(body.cpl) : null;
    const detail = body.detail || detalheQualidadeVazio();
    const qual = body.qual || badgeCampanha(cpl, detail, { forms: body.forms || 0, gasto: body.gastoNum || 0 });
    const alerta = acao === 'manter' && deveAlertarManter({ cpl, detail, qual });

    const campanhaId = String(body.campanhaId || body.id || '').replace(/\D/g, '') || null;
    let metaAcao = { ok: false, skipped: true };

    let textoFeed = '';
    if (acao === 'manter') {
      textoFeed = `Manteve ${nome} às ${now.hm}`;
      if (!campanhaId) {
        return json(400, { ok: false, erro: 'Sem campaignId numérico — não dá pra reativar na Meta' });
      }
      metaAcao = await metaActivateCampaign(campanhaId);
      if (metaAcao.ok) textoFeed += ' · Meta ACTIVE';
      else {
        return json(502, {
          ok: false,
          erro: `Não reativou na Meta: ${metaAcao.motivo || 'erro'}`,
          meta: metaAcao,
        });
      }
    } else if (acao === 'parar') {
      textoFeed = `Parou ${nome} às ${now.hm}`;
      if (campanhaId) {
        metaAcao = await metaPauseCampaign(campanhaId);
        if (metaAcao.ok) textoFeed += ' · Meta PAUSED';
        else {
          return json(502, {
            ok: false,
            erro: `Não pausou na Meta: ${metaAcao.motivo || 'erro'}`,
            meta: metaAcao,
          });
        }
      } else {
        return json(400, { ok: false, erro: 'Sem campaignId numérico — não dá pra pausar na Meta' });
      }
    } else {
      // orcamento / budget — clique do Michel tem que acertar a Meta (não “em breve”)
      const val = body.orcamento ?? body.valor ?? body.ajuste;
      if (!campanhaId) {
        return json(400, { ok: false, erro: 'Sem campaignId numérico — não dá pra mudar orçamento na Meta' });
      }
      metaAcao = await metaSetCampaignDailyBudget(campanhaId, val);
      if (!metaAcao.ok) {
        return json(502, {
          ok: false,
          erro: `Não alterou orçamento na Meta: ${metaAcao.motivo || 'erro'}`,
          meta: metaAcao,
        });
      }
      const reais = metaAcao.daily_budget_reais != null
        ? metaAcao.daily_budget_reais
        : val;
      textoFeed = `Alterou ${nome} para R$${reais}/dia às ${now.hm} · Meta daily_budget OK`;
    }

    const feed = await registraFeedDecisao({
      data: now.data,
      hora: now.hm,
      acao: acao === 'budget' ? 'orcamento' : acao,
      campanha: nome,
      campanhaId,
      orcamento: body.orcamento ?? body.valor ?? null,
      cpl,
      detail,
      alerta,
      texto: textoFeed,
      meta: metaAcao,
    });

    // Aviso obrigatório ao Bruno (CEO) — toda ação do Michel no clique
    const ceo = process.env.WHATSAPP_CEO || '';
    let whats = { enviado: false };
    if (ceo) {
      const acaoLabel = acao === 'parar' ? '🛑 PAROU'
        : (acao === 'manter' ? '▶️ MANTEVE / REATIVOU'
          : '💰 ORÇAMENTO');
      const linhas = [
        `${acaoLabel} · *Michel · App Decisão* · ${now.hm}`,
        textoFeed,
        campanhaId ? `Meta ID: ${campanhaId}` : '',
        metaAcao?.ok ? '✅ Meta confirmou' : '',
      ].filter(Boolean);
      if (alerta) {
        linhas.unshift('⚠️ *ALERTA GESTOR*');
        linhas.push(`Custo ${body.custo || brl(cpl)} · Fake/Ruim: ${(detail.fake || 0) + (detail.ruim || 0)}`);
        linhas.push('Michel manteve campanha com performance ruim');
      }
      whats = await enviaWhats(ceo, linhas.join('\n'));
    }

    const toastOk = acao === 'parar' && metaAcao.ok
      ? `🛑 Pausada na Meta · ${nome}`
      : (acao === 'manter' && metaAcao.ok
        ? `▶️ Ativa na Meta · ${nome}`
        : ((acao === 'orcamento' || acao === 'budget') && metaAcao.ok
          ? `💰 Orçamento na Meta · R$${metaAcao.daily_budget_reais}/dia`
          : (alerta
            ? `⚠️ Alerta: manteve campanha ruim — Helena avisou o gestor`
            : `Registrado! ${textoFeed}`)));

    return json(200, {
      ok: true,
      toast: toastOk,
      alerta,
      meta: metaAcao,
      alertaMichel: alerta
        ? `⚠️ Alerta: ${nome} está com performance ruim e foi mantida`
        : null,
      alertaGestor: alerta
        ? `⚠️ Alerta Gestor: Michel manteve ${nome} com custo alto + Fake/Ruim — via Helena`
        : null,
      feed: {
        hoje: itensHoje(feed, now.data).length,
        acumulado: feed.acumulado,
        itens: (feed.itens || []).slice(0, 20),
      },
      whats,
    });
  }

  if (event.httpMethod !== 'GET') return json(405, { ok: false, erro: 'use GET ou POST' });

  try {
    const params = event.queryStringParameters || {};
    const gestor = params.gestor === '1' || params.ceo === '1';
    if (gestor && !senhaGestorOk(event, params)) {
      return json(401, { ok: false, precisaSenha: true, erro: 'senha do gestor necessária' });
    }
    const payload = await payloadApp({ incluirGestor: gestor });
    return json(200, payload);
  } catch (e) {
    return json(500, { ok: false, erro: String((e && e.message) || e) });
  }
}
