// Cron vigilante — Bruno é avisado: campanha nova, parou, ruim sem Michel mexer.
// Schedule: a cada 20 min (Netlify). Também GET/POST /api/alerta-ceo-campanhas?cron=1
import { json, enviaWhats } from './_infra.mjs';
import { agoraBRT } from './_rotina.mjs';
import { leCicloCampanhas } from './_meta-ciclo.mjs';
import { lePlacar } from './_placar-io.mjs';
import { leFeedDecisao } from './_decisao-feed.mjs';
import { agregaQualidadePorCampanha, matchDetalheCampanha, badgeCampanha } from './_qualidade-trafego.mjs';
import { leLeadsHoje } from './_cacador-io.mjs';
import {
  montaSnapshotAtivas,
  diffAtivas,
  ruinsSemMovimento,
  mensagensVigilante,
  campanhaOperacional,
  chaveAlerta,
} from './_alerta-ceo-campanhas.mjs';
import {
  leSnapshotAtivas,
  salvaSnapshotAtivas,
  leAlertasEnviados,
  marcaAlertasEnviados,
} from './_alerta-ceo-io.mjs';

export const config = { schedule: '*/20 * * * *' };

function listaAtivasDoCiclo(mapa = {}) {
  const byId = new Map();
  for (const v of Object.values(mapa || {})) {
    if (!v || !v.ativa) continue;
    const id = String(v.id || '').replace(/\D/g, '');
    if (!id || !campanhaOperacional(v.nome)) continue;
    byId.set(id, { id, nome: v.nome, status: v.status || 'ACTIVE', ativa: true });
  }
  return [...byId.values()];
}

function campanhasComQual({ placar, cicloMapa, leads }) {
  const mapaQ = agregaQualidadePorCampanha(leads || []);
  const rows = [];
  for (const c of placar?.campanhas || []) {
    const id = String(c.id || '').replace(/\D/g, '');
    const ciclo = (id && cicloMapa[id]) || cicloMapa[c.nome] || null;
    const ativa = ciclo?.ativa === true;
    if (!ativa) continue;
    if (!campanhaOperacional(c.nome)) continue;
    const detail = matchDetalheCampanha(mapaQ, c.nome);
    const forms = c.leadConfirmado ? c.leads : (c.leads || 0);
    const cpl = c.cpl;
    const qual = badgeCampanha(cpl, detail, { forms, gasto: c.gasto });
    rows.push({
      id: id || c.nome,
      name: c.nome,
      nome: c.nome,
      ativa: true,
      cpl,
      custo: cpl != null ? `R$${Number(cpl).toFixed(0)}` : null,
      forms,
      gasto: c.gasto,
      gastoNum: c.gasto,
      detail,
      qual,
    });
  }
  return rows;
}

export async function rodaVigilanteCeo({ dryRun = false } = {}) {
  const now = agoraBRT();
  const [ciclo, placarPack, feed, leadsDoc, snapAnt, enviadosDoc] = await Promise.all([
    leCicloCampanhas().catch(() => ({ ok: false, mapa: {} })),
    lePlacar({ preset: 'last_30d' }).catch(() => ({ placar: { campanhas: [] } })),
    leFeedDecisao().catch(() => ({ itens: [] })),
    leLeadsHoje().catch(() => ({ leads: [] })),
    leSnapshotAtivas(),
    leAlertasEnviados(),
  ]);

  const listaAtivas = listaAtivasDoCiclo(ciclo.mapa || {});
  const snapAtual = montaSnapshotAtivas(listaAtivas);
  const primeiroCiclo = !snapAnt?.atualizadoEm || !Object.keys(snapAnt.ativas || {}).length;

  const { novas: novasBrutas, paradas: paradasBrutas } = primeiroCiclo
    ? { novas: [], paradas: [] } // 1º run só grava baseline (não bombardeia Bruno)
    : diffAtivas(snapAnt.ativas || {}, snapAtual);

  const campanhas = campanhasComQual({
    placar: placarPack.placar,
    cicloMapa: ciclo.mapa || {},
    leads: leadsDoc.leads || [],
  });
  const ruinsBrutas = ruinsSemMovimento(campanhas, feed.itens || [], { dataBRT: now.data });

  // Dedupe antes de montar texto (só o que ainda não avisamos hoje)
  const enviados = enviadosDoc.chaves || {};
  const aindaNao = (tipo, id) => !enviados[`${now.data}|${tipo}|${id || 'x'}`];
  const novas = novasBrutas.filter((c) => aindaNao('nova', c.id));
  const paradas = paradasBrutas.filter((c) => aindaNao('parada', c.id));
  const ruins = ruinsBrutas.filter((c) => aindaNao('ruim_sem_movimento', c.id));

  const mensagens = mensagensVigilante({
    novas,
    paradas,
    ruins,
    hm: now.hm,
    data: now.data,
  });

  const whats = [];
  const ceo = process.env.WHATSAPP_CEO || '';
  if (!dryRun) {
    await salvaSnapshotAtivas(snapAtual);
    const chavesOk = [];
    if (ceo && mensagens.length) {
      for (const m of mensagens) {
        const r = await enviaWhats(ceo, m.texto);
        whats.push({ tipo: m.tipo, enviado: !!r.enviado, motivo: r.motivo || null });
        if (r.enviado) {
          for (const id of m.ids || []) chavesOk.push(chaveAlerta(m.tipo, id, now.data));
        }
      }
      if (chavesOk.length) await marcaAlertasEnviados(chavesOk);
    }
  }

  return {
    ok: true,
    data: now.data,
    hm: now.hm,
    primeiroCiclo,
    nAtivas: Object.keys(snapAtual).length,
    novas: novas.length,
    paradas: paradas.length,
    ruinsSemMovimento: ruins.length,
    alertas: mensagens.map((m) => ({ tipo: m.tipo, ids: m.ids, preview: m.texto.slice(0, 120) })),
    whats,
    dryRun: !!dryRun,
    ceoConfigurado: !!ceo,
  };
}

export async function handler(event) {
  const isSchedule = event.httpMethod === undefined
    || event.headers?.['x-netlify-event'] === 'schedule'
    || (event.queryStringParameters || {}).cron === '1';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body: '',
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const dryRun = params.dry === '1' || params.dryRun === '1';
    const result = await rodaVigilanteCeo({ dryRun });
    return json(200, { ...result, cron: !!isSchedule });
  } catch (e) {
    return json(500, { ok: false, erro: String((e && e.message) || e) });
  }
}
