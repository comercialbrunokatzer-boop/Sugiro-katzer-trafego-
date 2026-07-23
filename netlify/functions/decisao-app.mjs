// GET  /api/decisao-app  → campanhas 30d + qualidade IA + feed gestor
// POST /api/decisao-app  → { acao: manter|orcamento|parar, campanhaId, ... }
import { createHash } from 'node:crypto';
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

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';

function senhaGestorOk(event, body = {}) {
  const h = event.headers || {};
  const params = event.queryStringParameters || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || body.gestorKey || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

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
  return l.faseBitrix || l.statusPosMapeamento || l.status || 'Fluxo - Leads';
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

function montaCampanhasApp(placar, cicloMapa, leads) {
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
    const ativa = !!(comCiclo.ciclo?.ativa || String(comCiclo.statusVeiculacao || '').toUpperCase() === 'ACTIVE');
    const leadsCamp = leadsDaCampanha(leads, c.nome);
    const leadsHot = montaLeadsHot(leadsCamp);
    const fasesInfo = montaFases(leadsCamp);
    return {
      id: c.id || c.nome,
      name: c.nome,
      inicio: comCiclo.dataSubiu || '—',
      inicioISO: comCiclo.ciclo?.inicioISO || null,
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
      statusVeiculacao: comCiclo.statusVeiculacao || (ativa ? 'ACTIVE' : null),
      ativa,
      alertaManter: deveAlertarManter({ cpl, detail, qual }),
      leadsHot,
      fases: fasesInfo.fases,
      leadsTotal: fasesInfo.total,
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
  const [{ placar, meta }, ciclo, leadsDoc, feed] = await Promise.all([
    lePlacar({ preset: 'last_30d' }),
    leCicloCampanhas().catch(() => ({ mapa: {} })),
    leLeadsHoje().catch(() => ({ leads: [] })),
    leFeedDecisao(),
  ]);

  const todas = montaCampanhasApp(placar, ciclo.mapa || {}, leadsDoc.leads || []);
  // Se Meta não trouxe status, assume ativa quando não tem dataPausada
  const ativas = todas.filter((c) => c.ativa || (!c.dataPausada && c.statusVeiculacao !== 'PAUSED'));
  // Ranking: menor CPL primeiro (todas com gasto 30d)
  const ranking = [...todas]
    .filter((c) => c.cpl != null)
    .sort((a, b) => (a.cpl ?? 9999) - (b.cpl ?? 9999))
    .map((c, i) => ({ ...c, pos: i + 1 }));

  const tot = totaisQualidade(leadsDoc.leads || []);
  const hoje = itensHoje(feed, now.data);
  const base = {
    ok: true,
    confiavel: meta?.confiavel !== false && meta?.status === 'ok',
    metaStatus: meta,
    periodo: 'last_30d',
    periodoLabel: 'Janela móvel últimos 30 dias',
    prazo: 'Fazer até 10:15',
    fontes: 'PATROCINADO CORRETOR, FACEBOOK ADS, FORMULARIO CRM, CANAL ABERTO',
    avisoAbas: 'Aba Ativas = só veiculando agora. Ranking = todas com gasto nos últimos 30 dias (ativas + pausadas).',
    campanhas: ativas, // compat
    ativas,
    ranking,
    todas,
    qualidadeTotais: tot,
    qualidadeRotulos: QUAL_TRAFEGO_ROTULO,
    iaComo: 'IA lê: ligação + todas abas Bitrix + WhatsApp Helena + etiqueta corretor',
    sugestaoSemanal: {
      texto: '30% da verba nas que mais converteram',
      destaque: ranking.find((c) => c.qual === 'good') || ranking[0] || null,
    },
    agora: now.hm,
    data: now.data,
  };

  if (!incluirGestor) return base;

  const tops = topFeedback(todas);
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
        'access-control-allow-headers': 'content-type, x-gestor-key',
      },
      body: '',
    };
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {
      return json(400, { ok: false, erro: 'body inválido' });
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

    let textoFeed = '';
    if (acao === 'manter') textoFeed = `Manteve ${nome} às ${now.hm}`;
    else if (acao === 'parar') textoFeed = `Parou ${nome} às ${now.hm}`;
    else {
      const val = body.orcamento ?? body.valor ?? body.ajuste;
      textoFeed = `Alterou ${nome} para R$${val}/dia às ${now.hm}`;
    }

    const feed = await registraFeedDecisao({
      data: now.data,
      hora: now.hm,
      acao: acao === 'budget' ? 'orcamento' : acao,
      campanha: nome,
      campanhaId: body.campanhaId || body.id || null,
      orcamento: body.orcamento ?? body.valor ?? null,
      cpl,
      detail,
      alerta,
      texto: textoFeed,
    });

    const ceo = process.env.WHATSAPP_CEO || '';
    let whats = { enviado: false };
    if (ceo) {
      const linhas = [
        `📋 *Michel · App Decisão* · ${now.hm}`,
        textoFeed,
      ];
      if (alerta) {
        linhas.unshift('⚠️ *ALERTA GESTOR*');
        linhas.push(`Custo ${body.custo || brl(cpl)} · Fake/Ruim: ${(detail.fake || 0) + (detail.ruim || 0)}`);
        linhas.push('Michel manteve campanha com performance ruim');
      }
      whats = await enviaWhats(ceo, linhas.join('\n'));
    }

    return json(200, {
      ok: true,
      toast: alerta
        ? `⚠️ Alerta: manteve campanha ruim — Helena avisou o gestor`
        : `Registrado! ${textoFeed} — WhatsApp Helena enviado`,
      alerta,
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
