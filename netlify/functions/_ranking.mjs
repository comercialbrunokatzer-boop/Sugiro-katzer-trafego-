// Ranking de campanhas por CPL de FORMULÁRIO (arquivo "_" = NÃO vira função).
// Nunca usa clique / link_click / landing_page_view como resultado.
import { extraiLeadsFormulario } from './_placar.mjs';
import { rotuloProdutoCidade } from './_mapeamento-v41.mjs';

const round2 = (v) => Math.round(Number(v) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Rótulo V4.1: Produto · Cidade (nunca misturar construtora/corretor como cidade). */
export function extraiCidadeProduto(nome = '') {
  return rotuloProdutoCidade(nome);
}

/** Veredito curto pro ranking (só formulário). */
export function vereditoLinha(r, { pos, noVolume } = {}) {
  if (!r || r.cplForm == null) return '—';
  if (pos === 1) return 'Melhor CPL da conta';
  if (noVolume && pos === 1) return 'Melhor custo × volume';
  if (r.cplForm <= 12) return 'Melhor CPL';
  if (r.leadsForm >= 40 && r.cplForm <= 40) return 'Alto volume';
  if (r.leadsForm >= 30 && r.cplForm <= 20) return 'Escala comprovada';
  if (r.leadsForm >= 20 && r.cplForm <= 40) return 'Volume + barato';
  if (r.cplForm <= 22) return 'Excelente';
  if (r.cplForm <= 30) return 'Bom';
  if (r.cplForm <= 40) return 'Bom volume';
  if (r.cplForm <= 80) return 'Ok';
  return 'Cara';
}

/**
 * Classifica status operacional (nunca transforma erro em zero).
 * @returns {'Boa'|'Ok'|'Cara'|'Amostra pequena'|'0 form.'|'Form. não confirmado'|'Sem veiculação'|'Erro leitura'}
 */
export function statusCampanha({ gasto, leads, cpl, confirmado, erroLeitura }, { cplBom = 40, cplCaro = 80, minLeadsRanking = 3 } = {}) {
  if (erroLeitura) return 'Erro leitura';
  if (confirmado === false) return 'Form. não confirmado';
  if (!(gasto > 0)) return 'Sem veiculação';
  if (leads === 0) return '0 form.';
  if (leads < minLeadsRanking) return 'Amostra pequena';
  if (cpl != null && cpl <= cplBom) return 'Boa';
  if (cpl != null && cpl <= cplCaro) return 'Ok';
  return 'Cara';
}

/**
 * Normaliza 1 linha do Insights Meta → linha de ranking.
 * @param {object} c raw campaign insight
 * @param {{ diasNoAr?: number|null, erroLeitura?: boolean }} extra
 */
export function linhaRanking(c = {}, extra = {}) {
  const gasto = round2(num(c.spend));
  const form = extraiLeadsFormulario(c);
  const leads = form.leads;
  const confirmado = form.confirmado;
  const cpl = (confirmado && leads > 0) ? round2(gasto / leads) : null;
  const erroLeitura = !!extra.erroLeitura;
  const diasNoAr = extra.diasNoAr != null ? Number(extra.diasNoAr) : null;
  const st = statusCampanha({
    gasto, leads, cpl, confirmado, erroLeitura,
  });
  return {
    campanha: c.campaign_name || '(sem nome)',
    id: c.campaign_id || null,
    cidadeProduto: extraiCidadeProduto(c.campaign_name),
    leadsForm: leads,
    gasto,
    cplForm: cpl,
    diasNoAr,
    status: st,
    fonteLead: form.fonte,
    leadConfirmado: confirmado,
    avisoLead: form.aviso,
    amostraPequena: confirmado && leads > 0 && leads < 3,
    semVeiculacao: !(gasto > 0),
    erroLeitura,
  };
}

/**
 * Conta dias com gasto > 0 a partir de insights diários (time_increment=1).
 * @param {Array} dailyRows
 * @returns {Map<string, number>} campaign_id → dias
 */
export function contaDiasNoAr(dailyRows = []) {
  const map = new Map();
  for (const r of (Array.isArray(dailyRows) ? dailyRows : [])) {
    const id = r.campaign_id || r.campaign_name;
    if (!id) continue;
    if (num(r.spend) > 0) map.set(id, (map.get(id) || 0) + 1);
  }
  return map;
}

/**
 * Monta ranking completo a partir do array Insights (nível campanha).
 */
export function montaRanking(data = [], {
  minLeadsRanking = 3,
  cplVolumeMax = 40,
  diasPorCampanha = null, // Map id→dias
  periodo = 'last_7d',
  leituraOk = true,
  horarioLeitura = null,
  conta = null,
} = {}) {
  if (!leituraOk) {
    return {
      ok: false,
      periodo,
      metrica: 'lead_formulario',
      horarioLeitura,
      conta,
      erro: 'Dados da Meta indisponíveis.',
      totais: null,
      rankingCpl: [],
      top10Cpl: [],
      rankingVolumeCpl: [],
      amostraPequena: [],
      fora: [],
      logSeguro: [],
    };
  }

  const todas = (Array.isArray(data) ? data : []).map((c) => {
    const id = c.campaign_id || c.campaign_name;
    const dias = diasPorCampanha
      ? (diasPorCampanha.get(c.campaign_id) || diasPorCampanha.get(c.campaign_name) || null)
      : null;
    return linhaRanking(c, { diasNoAr: dias });
  });

  const comGasto = todas.filter((r) => !r.semVeiculacao && !r.erroLeitura);
  const rankingBase = comGasto
    .filter((r) => r.leadConfirmado && r.leadsForm >= minLeadsRanking && r.cplForm != null)
    .sort((a, b) => a.cplForm - b.cplForm)
    .map((r, i) => ({
      pos: i + 1,
      ...r,
      veredito: vereditoLinha(r, { pos: i + 1 }),
    }));

  const amostraPequena = comGasto
    .filter((r) => r.leadConfirmado && r.leadsForm > 0 && r.leadsForm < minLeadsRanking)
    .sort((a, b) => (a.cplForm ?? Infinity) - (b.cplForm ?? Infinity))
    .map((r, i) => ({ pos: i + 1, ...r, veredito: 'Amostra pequena' }));

  const rankingVolumeCpl = comGasto
    .filter((r) => r.leadConfirmado && r.leadsForm >= minLeadsRanking && r.cplForm != null && r.cplForm <= cplVolumeMax)
    .sort((a, b) => b.leadsForm - a.leadsForm || a.cplForm - b.cplForm)
    .map((r, i) => ({
      pos: i + 1,
      ...r,
      veredito: vereditoLinha(r, { pos: i + 1, noVolume: true }),
    }));

  const top10Cpl = rankingBase.slice(0, 10);
  const topVolume = rankingVolumeCpl.slice(0, 10);

  const fora = comGasto.filter((r) => !r.leadConfirmado || r.leadsForm === 0);

  const totalGasto = round2(comGasto.reduce((s, r) => s + r.gasto, 0));
  const totalLeads = comGasto.reduce((s, r) => s + (r.leadConfirmado ? r.leadsForm : 0), 0);
  const cplMedio = totalLeads > 0 ? round2(totalGasto / totalLeads) : null;

  const logSeguro = comGasto.map((r) => ({
    campanha: r.campanha,
    leads: r.leadsForm,
    gasto: r.gasto,
    cpl: r.cplForm,
    periodo,
  }));

  return {
    ok: true,
    periodo,
    metrica: 'lead_formulario',
    actionTypesAceitos: [
      'onsite_conversion.lead_grouped', 'lead',
      'onsite_conversion.messaging_conversation_started_7d',
      'onsite_conversion.messaging_first_reply',
    ],
    horarioLeitura,
    conta,
    totais: {
      campanhasComGasto: comGasto.length,
      totalGasto,
      totalLeadsForm: totalLeads,
      cplMedioForm: cplMedio,
    },
    rankingCpl: rankingBase,
    top10Cpl,
    rankingVolumeCpl: topVolume,
    amostraPequena,
    fora: fora.map((r) => ({
      campanha: r.campanha,
      gasto: r.gasto,
      leadsForm: r.leadsForm,
      status: r.status,
      aviso: r.avisoLead,
    })),
    logSeguro,
  };
}

/** Junta 7d + 30d + maximum (conta) num payload do painel. */
export function payloadPainelRanking({ operacional, historico, contaMaxima, conferencia = null } = {}) {
  return {
    ok: !!(operacional?.ok || historico?.ok || contaMaxima?.ok),
    geradoEm: new Date().toISOString(),
    metricaPrincipal: 'lead_formulario',
    regra: 'Conta form OU WhatsApp (cliente chamou) · nunca clique · CPL = spend / resultados',
    /** Ranking real da conta (presets longos) — o que os prints do Gerenciador mostram. */
    contaMaxima: contaMaxima || null,
    operacional7d: operacional || null,
    historico30d: historico || null,
    conferencia: conferencia || null,
  };
}
