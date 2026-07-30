// ESTADO — Rotina + card Campanhas (só resumo + link pro app separado) + fatia Helena (katzer-os).
// GET /api/estado        → tarefas + obs + modo + campanhas{resumo} + helena
// GET /api/estado?ceo=1  → + pontualidade (% + saldo) + decisoesCampanha[]
//
// P0 (#50): Blobs off NÃO vira 502 — responde ok:true com rotina vazia + helena da fonte única.
// Decisão / quadradinho NÃO vive aqui. App: CAMPANHAS_APP_URL
import { createHash } from 'node:crypto';
import { agoraBRT, pontualidade, TAREFAS, previstoMin, min2hm } from './_rotina.mjs';
import { leEstado, json } from './_infra.mjs';
import { lePlacar, leDecisoes } from './_placar-io.mjs';
import { listaDecisoes, montaSugestoes } from './_placar-estado.mjs';
import { leQualidade, mapaQualidade } from './_qualidade-io.mjs';
import { enriqueceComQualidade, resumoCplBomQualidade } from './_qualidade.mjs';
import { leCicloCampanhas, enrichComCiclo } from './_meta-ciclo.mjs';
import { leDecisoesCampanha } from './_campanhas-dia.mjs';
import { buscaFatiaHelena } from './_katzer-os-cliente.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';
const CAMPANHAS_APP_URL = (process.env.CAMPANHAS_APP_URL || 'https://dashing-elf-41a723.netlify.app').replace(/\/+$/, '');

function senhaGestorOk(event, params) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

/**
 * Card Campanhas na Rotina (layout Bruno) — SÓ OLHAR:
 *   7 campanhas | R$ 2351 | 46 leads | CPL méd R$ 51
 *   CPL BOM méd R$ 13 | 83% bons | Itapoá: R$ 13,20 BOM 🟢
 *   👁 Só olhar aqui · execute no Painel de Campanhas
 *   ▶ Abrir Painel de Campanhas
 * Sem lista de escalar. Sem Aplicar/Ajustar. Decisão = app Campanhas.
 */

/** Intervalo BRT do preset Meta (aprox. — bate com o que a API usa). */
function periodoPresetBRT(preset = 'last_7d', agora = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const hoje = fmt.format(agora); // YYYY-MM-DD
  const [y, m, d] = hoje.split('-').map(Number);
  const fim = new Date(Date.UTC(y, m - 1, d));
  let dias = 7;
  if (preset === 'last_3d') dias = 3;
  else if (preset === 'last_14d') dias = 14;
  else if (preset === 'last_30d') dias = 30;
  else if (preset === 'yesterday') dias = 1;
  else if (preset === 'today') dias = 1;
  const ini = new Date(fim);
  if (preset === 'today') { /* mesmo dia */ }
  else if (preset === 'yesterday') ini.setUTCDate(ini.getUTCDate() - 1);
  else ini.setUTCDate(ini.getUTCDate() - (dias - 1));
  const br = (dt) => {
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${dd}/${mm}/${yy}`;
  };
  const inicioISO = `${ini.getUTCFullYear()}-${String(ini.getUTCMonth()+1).padStart(2,'0')}-${String(ini.getUTCDate()).padStart(2,'0')}`;
  const fimISO = hoje;
  return {
    preset,
    inicioISO,
    fimISO,
    inicioBR: br(ini),
    fimBR: br(fim),
    label: preset === 'today'
      ? `Hoje (${br(fim)} BRT)`
      : `Preset Meta *${preset}* · ${br(ini)} → ${br(fim)} (BRT)`,
    aviso: 'Não confundir com "últimos 4 dias" do Gerenciador — use o período escrito aqui.',
  };
}

async function resumoCampanhas(data) {
  const link = CAMPANHAS_APP_URL + '/app.html';
  const cta = '▶ Abrir App Decisão';
  try {
    const [{ placar, meta }, bruto, qualDoc, ciclo] = await Promise.all([
      lePlacar({ preset: 'last_7d' }),
      leDecisoes(data),
      leQualidade(),
      leCicloCampanhas().catch(() => ({ ok: false, mapa: {} })),
    ]);
    const cicloMapa = ciclo.mapa || {};
    const decisoes = listaDecisoes(bruto);
    const idsDecididos = new Set(decisoes.map((d) => d.id));
    const sugestoes = montaSugestoes(placar);
    const nPendentes = sugestoes.filter((s) => !idsDecididos.has(s.id)).length;
    const pendente = nPendentes > 0;
    const statusDecisao = pendente
      ? (nPendentes === 1
        ? '👁 Só olhar · 1 decisão pendente no Painel de Campanhas'
        : `👁 Só olhar · ${nPendentes} decisões pendentes no Painel de Campanhas`)
      : '👁 Só olhar · nada pendente no Painel de Campanhas';

    const confiavel = meta?.confiavel !== false && meta?.status === 'ok';
    if (!confiavel) {
      return {
        confiavel: false,
        modo: 'olhar',
        resumo: meta?.mensagemPainel || meta?.mensagem || 'Dados da Meta indisponíveis.',
        metrica: null,
        cplBom: null,
        statusDecisao,
        pendente,
        nPendentes,
        n: null, totalGasto: null, totalLeads: null, cplMedio: null,
        link, cta,
      };
    }
    const mapa = mapaQualidade(qualDoc);
    const campanhasQ = (placar.campanhas || []).map((c) => {
      const q = enriqueceComQualidade(c, mapa);
      return enrichComCiclo(q, cicloMapa);
    });
    const n = campanhasQ.length;
    const totalGasto = placar.totalGasto ?? 0;
    const totalLeads = placar.totalLeads ?? 0;
    const cplMedio = placar.cplMedio;
    const bom = resumoCplBomQualidade(campanhasQ);
    const periodo = periodoPresetBRT('last_7d');
    const metrica = [
      `${n} campanhas`,
      `R$ ${Number(totalGasto).toFixed(0)}`,
      `${totalLeads} leads`,
      `CPL méd ${cplMedio != null ? `R$ ${Number(cplMedio).toFixed(0)}` : '—'}`,
    ].join(' | ');
    const metricaComPeriodo = `${metrica}\n📅 ${periodo.label}`;
    // Top por gasto: data que subiu (ativa) ou data de pausa — Bruno pediu explícito
    const cicloLinhas = [...campanhasQ]
      .sort((a, b) => (Number(b.gasto) || 0) - (Number(a.gasto) || 0))
      .slice(0, 5)
      .map((c) => {
        const nome = (c.nome || c.campanha || '—').slice(0, 42);
        if (c.dataPausada) return `${nome} · Pausada ${c.dataPausada}`;
        if (c.dataSubiu) return `${nome} · Ativa · subiu ${c.dataSubiu}`;
        return c.cicloRotulo ? `${nome} · ${c.cicloRotulo}` : null;
      })
      .filter(Boolean);
    return {
      confiavel: true,
      modo: 'olhar',
      n, totalGasto, totalLeads, cplMedio,
      metrica: metricaComPeriodo,
      periodo,
      cicloLinhas,
      cplBom: bom.texto,
      cplBomMedio: bom.cplBomMedio,
      pctBons: bom.pctBons,
      destaqueBom: bom.destaqueTexto,
      qualidadeFonte: bom.fonte,
      statusDecisao,
      pendente,
      nPendentes,
      resumo: metricaComPeriodo,
      link, cta,
    };
  } catch {
    return {
      confiavel: false,
      modo: 'olhar',
      resumo: 'Dados da Meta indisponíveis.',
      metrica: null,
      cplBom: null,
      statusDecisao: '👁 Só olhar · abra o Painel de Campanhas',
      pendente: true,
      nPendentes: null,
      n: null, totalGasto: null, totalLeads: null, cplMedio: null,
      link, cta,
    };
  }
}

export async function handler(event) {
  try {
    const params = event.queryStringParameters || {};
    const now = agoraBRT();
    const [estado, helena] = await Promise.all([
      leEstado(now.data),
      buscaFatiaHelena(),
    ]);
    const blobsOk = estado._blobsOk !== false;
    const domingo = now.dow === 0;
    const fimDiaMin = estado.modo === 'katzer' ? (14 * 60 + 30) : (13 * 60);

    const tarefas = TAREFAS.map((t) => {
      const prev = previstoMin(t, estado.modo, estado.inicioMin, estado.overrides);
      const reg = estado.tarefas[t.id];
      const vencida = !domingo && now.min > prev && !(reg && reg.min != null);
      let estadoTarefa = 'aguardando';
      if (domingo) estadoTarefa = 'bloqueado';
      else if (reg && reg.min != null) estadoTarefa = 'concluido';
      else if (vencida && now.min >= fimDiaMin) estadoTarefa = 'nao_realizado';
      else if (vencida) estadoTarefa = 'atrasado';
      else if (reg && reg.iniciado) estadoTarefa = 'em_andamento';
      return {
        id: t.id, nome: t.nome, previsto: min2hm(prev),
        feito: !!(reg && reg.min != null), hora: reg ? reg.hora : null, nota: reg ? reg.nota : '',
        atrasoAberto: vencida ? now.min - prev : 0,
        estado: estadoTarefa,
        override: !!(estado.overrides && estado.overrides[t.id] != null),
        garimpo: reg && reg.garimpo ? reg.garimpo : null,
      };
    });

    const campanhas = await resumoCampanhas(now.data);

    const base = {
      ok: true,
      data: now.data,
      agora: now.hm,
      modo: estado.modo,
      domingo,
      tarefas,
      obs: estado.obs || [],
      campanhas,
      overrides: estado.overrides || {},
      auto: true, // V6: persiste sozinho; gestor só olha (poll)
      helena,
      blobsOk,
      blobsDegraded: !blobsOk,
      leituraSomente: !blobsOk,
      avisoBlobs: blobsOk
        ? null
        : 'Persistência (Blobs) off — rotina do dia só leitura. Regenerar BLOBS_TOKEN no Netlify.',
    };

    if (params.ceo) {
      if (!senhaGestorOk(event, params)) {
        return json(401, { ok: false, precisaSenha: true, erro: 'senha do gestor necessária' });
      }
      base.pontualidade = pontualidade(estado, now.min, { domingo, fimDiaMin });
      // Lembrete de campanha: só no Gestor (Michel não vê via ?ceo=1).
      // NÃO sobrescreve base.campanhas (resumo Meta + link do card).
      try {
        base.decisoesCampanha = await leDecisoesCampanha(now.data);
      } catch {
        base.decisoesCampanha = [];
      }
    }
    return json(200, base);
  } catch (e) {
    // Última rede de segurança: nunca 502 por Blobs/infra
    return json(200, {
      ok: true,
      data: null,
      tarefas: [],
      obs: [],
      campanhas: { confiavel: false, resumo: 'Sem dados disponíveis.' },
      helena: { ok: false },
      blobsOk: false,
      blobsDegraded: true,
      leituraSomente: true,
      avisoBlobs: String((e && e.message) || e),
    });
  }
}
