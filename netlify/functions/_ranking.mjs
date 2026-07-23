// Ranking de campanhas por CPL de FORMULÁRIO (arquivo "_" = NÃO vira função).
// Nunca usa clique / link_click / landing_page_view como resultado.
import { extraiLeadsFormulario } from './_placar.mjs';

const round2 = (v) => Math.round(Number(v) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Extrai cidade/produto aproximado do nome da campanha (heurística Katzer). */
export function extraiCidadeProduto(nome = '') {
  const n = String(nome);
  if (/PI[CÇ]ARRAS|PICARRAS/i.test(n)) return 'Piçarras';
  if (/PUNTA\s*C/i.test(n)) return 'Punta Cana / VIDEO';
  if (/BR[_\s-]?SC|SANTA\s*CATARINA/i.test(n)) return 'BR · SC';
  if (/PORTUGAL/i.test(n)) return 'Portugal';
  if (/ESPANHA|SPAIN/i.test(n)) return 'Espanha';
  if (/MIAMI|ORLANDO/i.test(n)) return 'Miami / Orlando';
  if (/EUA[_\s-]?Brasileiros|BRASILEIROS/i.test(n)) return 'EUA · Brasileiros';
  if (/EUA[_\s-]?Americanos|AMERICANOS/i.test(n)) return 'EUA · Americanos';
  if (/ROGGA|EXTERIOR/i.test(n)) return 'Exterior / ROGGA';
  if (/FORT\s*MYERS|FORTMYERS/i.test(n)) return 'Fort Myers';
  if (/Lead\s*\|\s*Cadastro|CADASTRO/i.test(n)) return 'Cadastro Katzer';
  if (/WhatsApp|Mensagem|Tr[áa]fego/i.test(n)) return 'Tráfego / Msg';
  return '—';
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
    .map((r, i) => ({ pos: i + 1, ...r }));

  const amostraPequena = comGasto
    .filter((r) => r.leadConfirmado && r.leadsForm > 0 && r.leadsForm < minLeadsRanking)
    .sort((a, b) => (a.cplForm ?? Infinity) - (b.cplForm ?? Infinity))
    .map((r, i) => ({ pos: i + 1, ...r }));

  const rankingVolumeCpl = comGasto
    .filter((r) => r.leadConfirmado && r.leadsForm >= minLeadsRanking && r.cplForm != null && r.cplForm <= cplVolumeMax)
    .sort((a, b) => b.leadsForm - a.leadsForm || a.cplForm - b.cplForm)
    .map((r, i) => ({ pos: i + 1, ...r }));

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
    actionTypesAceitos: ['onsite_conversion.lead_grouped', 'lead'],
    horarioLeitura,
    conta,
    totais: {
      campanhasComGasto: comGasto.length,
      totalGasto,
      totalLeadsForm: totalLeads,
      cplMedioForm: cplMedio,
    },
    rankingCpl: rankingBase,
    rankingVolumeCpl,
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

/** Junta 7d + 30d num payload do painel. */
export function payloadPainelRanking({ operacional, historico, conferencia = null } = {}) {
  return {
    ok: !!(operacional?.ok || historico?.ok),
    geradoEm: new Date().toISOString(),
    metricaPrincipal: 'lead_formulario',
    regra: 'CPL_FORM = spend / leads_de_formulario · nunca clique',
    operacional7d: operacional || null,
    historico30d: historico || null,
    conferencia: conferencia || null,
  };
}
