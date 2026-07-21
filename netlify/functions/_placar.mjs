// Núcleo do PLACAR DE CAMPANHAS (arquivo "_" = NÃO vira função).
// Recebe o `data` do Meta Ads Insights (nível campanha) e devolve: por campanha
// gasto · leads · CPL, os totais, e a DECISÃO DO DIA (escalar / revisar).
// Puro/testável — a função placar.mjs só busca a Meta e chama isto.

// Tipos de "resultado" que contam como LEAD (form de lead + clique-pro-WhatsApp).
// Conserta o "s/ dado": muitas campanhas otimizam por conversa iniciada, não por 'lead'.
const TIPOS_LEAD = new Set([
  'lead',
  'leadgen.other',
  'onsite_conversion.lead_grouped',
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.total_messaging_connection',
]);

/** Extrai a contagem de leads de uma campanha do Insights (robusto a formatos). */
export function extraiLeads(c = {}) {
  let n = 0;
  for (const a of (Array.isArray(c.actions) ? c.actions : [])) {
    if (TIPOS_LEAD.has(a.action_type)) n += Number(a.value) || 0;
  }
  // fallback: o campo 'results' (resultado da otimização da própria campanha)
  if (n === 0 && Array.isArray(c.results) && c.results[0] && Array.isArray(c.results[0].values)) {
    n = Number(c.results[0].values[0] && c.results[0].values[0].value) || 0;
  }
  return n;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Monta o placar a partir do array `data` do Meta Insights.
 * @returns {{campanhas, totalGasto, totalLeads, cplMedio, decisao}}
 */
export function montaPlacar(data = []) {
  const campanhas = (Array.isArray(data) ? data : []).map((c) => {
    const gasto = round2(num(c.spend));
    const leads = extraiLeads(c);
    const cpl = leads > 0 ? round2(gasto / leads) : null;
    return { nome: c.campaign_name || '(sem nome)', gasto, leads, cpl };
  }).sort((a, b) => b.gasto - a.gasto);

  const totalGasto = round2(campanhas.reduce((s, c) => s + c.gasto, 0));
  const totalLeads = campanhas.reduce((s, c) => s + c.leads, 0);
  const cplMedio = totalLeads > 0 ? round2(totalGasto / totalLeads) : null;

  return { campanhas, totalGasto, totalLeads, cplMedio, decisao: decideDoDia(campanhas, cplMedio) };
}

/**
 * Decisão do dia (liga anúncio à VENDA, não ao clique — regra da casa):
 *  - ESCALAR: tem lead e CPL <= média (custo bom).
 *  - REVISAR: gastou (>= R$50) e trouxe ZERO lead (queimando dinheiro).
 */
export function decideDoDia(campanhas = [], cplMedio = null, { gastoMinRevisar = 50 } = {}) {
  const escalar = campanhas
    .filter((c) => c.leads > 0 && (cplMedio == null || c.cpl <= cplMedio))
    .sort((a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity))
    .slice(0, 3);
  const revisar = campanhas
    .filter((c) => c.leads === 0 && c.gasto >= gastoMinRevisar)
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, 3);
  return { escalar, revisar };
}

const brl = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/** Texto do Placar pro WhatsApp (preto no zap; enxuto e acionável). */
export function resumoPlacarWhats(placar, { periodo = 'últimos 7 dias' } = {}) {
  const p = placar || {};
  const linhas = (p.campanhas || []).slice(0, 6).map((c) => {
    const cpl = c.cpl != null ? `CPL ${brl(c.cpl)}` : (c.gasto >= 50 ? '⚠️ 0 lead' : 'sem lead ainda');
    return `• *${c.nome}*\n   ${brl(c.gasto)} · ${c.leads} lead(s) · ${cpl}`;
  });
  const esc = (p.decisao?.escalar || []).map((c) => `🟢 escalar *${c.nome}* (CPL ${brl(c.cpl)})`);
  const rev = (p.decisao?.revisar || []).map((c) => `🔴 revisar *${c.nome}* (${brl(c.gasto)} · 0 lead)`);
  return [
    '📊 *Placar de Campanhas — Michel*',
    `_${periodo} · dados reais da Meta_`,
    '',
    linhas.join('\n'),
    '',
    `*Total:* ${brl(p.totalGasto)} · ${p.totalLeads || 0} leads · CPL médio ${brl(p.cplMedio)}`,
    '',
    '*Decisão do dia:*',
    ...(esc.length ? esc : ['— sem campanha clara pra escalar']),
    ...(rev.length ? rev : []),
  ].filter((x) => x !== undefined).join('\n');
}
