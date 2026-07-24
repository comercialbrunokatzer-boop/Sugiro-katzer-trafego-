// Núcleo do PLACAR DE CAMPANHAS (arquivo "_" = NÃO vira função).
// Métrica que CONTA (Bruno):
//   1) Cadastro de formulário Meta  OU
//   2) Conversa WhatsApp (cliente chamou / iniciou conversa)
// NÃO conta: clique, link_click, view, engajamento.
// NÃO soma action_types sobrepostos — escolhe 1 por prioridade (form antes de WhatsApp).
import fs from 'node:fs';
import { enriqueceCampanha, podeEscalar, LEADS_MIN_ESCALAR } from './_campanhas-regras.mjs';

/**
 * Prioridade: formulário primeiro → depois conversa WhatsApp (cliente chamou).
 * Nunca clique.
 */
export const PRIORIDADE_LEAD_FORMULARIO = [
  'onsite_conversion.lead_grouped',
  'leadgen_grouped',
  'onsite_conversion.lead',
  'leadgen.other',
  'lead',
];

/** Conversa WhatsApp real — conta. Clique pra abrir chat NÃO. */
export const PRIORIDADE_WHATSAPP = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.total_messaging_connection',
];

export const PRIORIDADE_RESULTADO = [
  ...PRIORIDADE_LEAD_FORMULARIO,
  ...PRIORIDADE_WHATSAPP,
];

export const TIPOS_LEAD_FORMULARIO = new Set(PRIORIDADE_LEAD_FORMULARIO);
export const TIPOS_WHATSAPP = new Set(PRIORIDADE_WHATSAPP);
export const TIPOS_RESULTADO_VALIDO = new Set(PRIORIDADE_RESULTADO);

/** Clique / view / engajamento — NUNCA contam. */
export const TIPOS_NAO_FORMULARIO = new Set([
  'link_click',
  'inline_link_click',
  'landing_page_view',
  'page_engagement',
  'post_engagement',
  'video_view',
  'omni_landing_page_view',
  'onsite_conversion.messaging_block',
  'click_to_call_call_confirm',
  'outbound_click',
]);
export const TIPOS_NAO_RESULTADO = TIPOS_NAO_FORMULARIO;

function indicadorEhValido(indicator = '') {
  const s = String(indicator).toLowerCase();
  if (!s) return false;
  if (s.includes('click') || s.includes('view') || s.includes('engage')) return false;
  if (s.includes('lead') || s.includes('form')) return true;
  if (s.includes('messaging_conversation') || s.includes('messaging_first_reply')
      || s.includes('messaging_connection') || s.includes('whatsapp')) return true;
  return false;
}

function mapaAcoes(c = {}) {
  const map = new Map();
  for (const a of (Array.isArray(c.actions) ? c.actions : [])) {
    const t = a.action_type;
    if (!t) continue;
    map.set(t, (map.get(t) || 0) + (Number(a.value) || 0));
  }
  return map;
}

function temSinalSoClique(c = {}, mapa) {
  for (const t of TIPOS_NAO_RESULTADO) {
    if ((mapa.get(t) || 0) > 0) return true;
  }
  const clicks = Number(c.clicks) || 0;
  if (clicks > 0) return true;
  if (Array.isArray(c.results) && c.results[0]) {
    const ind = String(c.results[0].indicator || '').toLowerCase();
    if (ind && (ind.includes('click') || ind.includes('view') || ind.includes('engage'))) return true;
  }
  return false;
}

/**
 * Conta formulário OU conversa WhatsApp (1 tipo por campanha, por prioridade).
 * Clique nunca entra.
 * @returns {{ leads:number, fonte:string|null, aviso:string|null, confirmado:boolean, tipo:'formulario'|'whatsapp'|null }}
 */
export function extraiLeadsFormulario(c = {}) {
  const mapa = mapaAcoes(c);

  for (const tipo of PRIORIDADE_RESULTADO) {
    const v = mapa.get(tipo);
    if (v != null && v > 0) {
      const ehWa = TIPOS_WHATSAPP.has(tipo);
      return {
        leads: v,
        fonte: tipo,
        aviso: null,
        confirmado: true,
        tipo: ehWa ? 'whatsapp' : 'formulario',
      };
    }
  }

  if (Array.isArray(c.results) && c.results[0]) {
    const r0 = c.results[0];
    if (indicadorEhValido(r0.indicator) && Array.isArray(r0.values)) {
      const n = Number(r0.values[0] && r0.values[0].value) || 0;
      if (n > 0) {
        const ind = String(r0.indicator || '').toLowerCase();
        const ehWa = ind.includes('messaging') || ind.includes('whatsapp');
        return {
          leads: n,
          fonte: `results:${r0.indicator || 'lead'}`,
          aviso: null,
          confirmado: true,
          tipo: ehWa ? 'whatsapp' : 'formulario',
        };
      }
    }
  }

  const temTipoValidoZero = PRIORIDADE_RESULTADO.some((t) => mapa.has(t));
  if (temTipoValidoZero || !temSinalSoClique(c, mapa)) {
    return {
      leads: 0,
      fonte: null,
      aviso: '0 formulários / conversas WhatsApp.',
      confirmado: true,
      tipo: null,
    };
  }

  return {
    leads: 0,
    fonte: null,
    aviso: 'Só clique — não conta. Precisa formulário ou conversa WhatsApp (cliente chamou).',
    confirmado: false,
    tipo: null,
  };
}

/** @deprecated use extraiLeadsFormulario — mantido como número puro pra API interna. */
export function extraiLeads(c = {}) {
  return extraiLeadsFormulario(c).leads;
}

/**
 * Inventário seguro dos action_types (pra confirmar o que a API manda).
 * Não inclui token nem payload completo.
 */
export function inventariarAcoes(data = []) {
  const totais = new Map();
  const porCampanha = [];
  for (const c of (Array.isArray(data) ? data : [])) {
    const spend = Number(c.spend) || 0;
    if (spend <= 0) continue;
    const acts = [];
    for (const a of (c.actions || [])) {
      const t = a.action_type;
      const v = Number(a.value) || 0;
      acts.push({ action_type: t, value: v });
      totais.set(t, (totais.get(t) || 0) + v);
    }
    const form = extraiLeadsFormulario(c);
    porCampanha.push({
      nome: c.campaign_name || '(sem nome)',
      gasto: spend,
      leadsFormulario: form.leads,
      fonteLead: form.fonte,
      tipoResultado: form.tipo,
      confirmado: form.confirmado,
      avisoLead: form.aviso,
      actions: acts.filter((a) => /lead|messaging|click|form/i.test(a.action_type)),
      resultsIndicator: c.results && c.results[0] ? c.results[0].indicator || null : null,
    });
  }
  return {
    totais: [...totais.entries()].sort((a, b) => b[1] - a[1]).map(([action_type, value]) => ({ action_type, value })),
    formulariosNosTotais: [...totais.entries()]
      .filter(([t]) => TIPOS_LEAD_FORMULARIO.has(t))
      .map(([action_type, value]) => ({ action_type, value })),
    whatsappNosTotais: [...totais.entries()]
      .filter(([t]) => TIPOS_WHATSAPP.has(t))
      .map(([action_type, value]) => ({ action_type, value })),
    fontesUsadas: [...new Set(porCampanha.map((c) => c.fonteLead).filter(Boolean))],
    porCampanha,
  };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Monta o placar a partir do array `data` do Meta Insights.
 * leads / CPL = formulário OU conversa WhatsApp. Clique nunca. CPL só se confirmado e leads > 0.
 */
export function montaPlacar(data = []) {
  const campanhas = (Array.isArray(data) ? data : []).map((c) => {
    const gasto = round2(num(c.spend));
    const { leads, fonte, aviso, confirmado, tipo } = extraiLeadsFormulario(c);
    const cpl = (confirmado && leads > 0) ? round2(gasto / leads) : null;
    return enriqueceCampanha({
      nome: c.campaign_name || '(sem nome)',
      id: c.campaign_id || null,
      gasto,
      leads,
      cpl,
      impressoes: num(c.impressions),
      alcance: num(c.reach),
      fonteLead: fonte,
      avisoLead: aviso,
      leadConfirmado: confirmado,
      tipoResultado: tipo,
    });
  })
    .filter((c) => c.gasto > 0)
    .sort((a, b) => b.gasto - a.gasto);

  const totalGasto = round2(campanhas.reduce((s, c) => s + c.gasto, 0));
  const totalLeads = campanhas.reduce((s, c) => s + (c.leadConfirmado ? c.leads : 0), 0);
  const cplMedio = totalLeads > 0 ? round2(totalGasto / totalLeads) : null;
  const inventario = inventariarAcoes(data);

  if (process.env.CI && process.env.GITHUB_STEP_SUMMARY) {
    try {
      let diag = '\n### Inventário action_type (form + WhatsApp)\n\n';
      diag += `Fontes usadas: ${(inventario.fontesUsadas || []).join(', ') || '(nenhuma)'}\n\n`;
      diag += '| action_type | soma |\n|---|--:|\n';
      for (const x of [...(inventario.formulariosNosTotais || []), ...(inventario.whatsappNosTotais || [])]) {
        diag += `| \`${x.action_type}\` | ${x.value} |\n`;
      }
      diag += '\n| Campanha | resultados | fonte |\n|---|--:|---|\n';
      for (const c of inventario.porCampanha) {
        diag += `| ${c.nome} | ${c.leadsFormulario} | \`${c.fonteLead || '—'}\` |\n`;
      }
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, diag);
      console.log(diag);
    } catch { /* ignore */ }
  }

  return {
    campanhas,
    totalGasto,
    totalLeads,
    cplMedio,
    metrica: 'formulario_ou_whatsapp',
    regra: 'Conta: formulário OU conversa WhatsApp (cliente chamou). Clique não.',
    fontesLead: inventario.fontesUsadas,
    decisao: decideDoDia(campanhas, cplMedio),
  };
}

/**
 * Decisão do dia — form ou WhatsApp.
 *  - ESCALAR: leads >= 10, CPL ok, sem público fora do BR em Piçarras.
 *  - OBSERVAR: tem lead mas < 10 (SEM BASE) — NÃO entra em escalar.
 *  - REVISAR: gastou (>= R$50) e ZERO resultado confirmado.
 */
export function decideDoDia(campanhas = [], cplMedio = null, { gastoMinRevisar = 50 } = {}) {
  const escalar = campanhas
    .filter((c) => podeEscalar(c) && (cplMedio == null || c.cpl <= cplMedio))
    .sort((a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity))
    .slice(0, 3);

  // SEM BASE — mas público fora do BR NÃO vira “sugestão” no topo (V4)
  const observar = campanhas
    .filter((c) => c.leadConfirmado !== false && c.leads > 0 && c.leads < LEADS_MIN_ESCALAR)
    .sort((a, b) => {
      const aProib = a.alertaPublico ? 1 : 0;
      const bProib = b.alertaPublico ? 1 : 0;
      if (aProib !== bProib) return aProib - bProib; // BR_SC antes de Americanos
      return (a.cpl ?? Infinity) - (b.cpl ?? Infinity);
    })
    .slice(0, 5);

  const alertasPublico = campanhas
    .filter((c) => c.alertaPublico)
    .slice(0, 5);

  const revisar = campanhas
    .filter((c) => c.leadConfirmado !== false && c.leads === 0 && c.gasto >= gastoMinRevisar)
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, 3);

  return { escalar, observar, alertasPublico, revisar };
}

const brl = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/** Texto do Placar pro WhatsApp — form ou conversa, nunca clique. */
export function resumoPlacarWhats(placar, { periodo = 'últimos 7 dias' } = {}) {
  const p = placar || {};
  const linhas = (p.campanhas || []).slice(0, 6).map((c) => {
    let cpl;
    if (c.cpl != null) cpl = `CPL ${brl(c.cpl)}`;
    else if (c.leadConfirmado === false) cpl = '⚠️ só clique (não conta)';
    else if (c.gasto >= 50) cpl = '⚠️ 0 form/WhatsApp';
    else cpl = 'sem resultado ainda';
    const tipo = c.tipoResultado === 'whatsapp' ? 'WhatsApp' : 'form.';
    return `• *${c.nome}*\n   ${brl(c.gasto)} · ${c.leads} ${tipo} · ${cpl}`;
  });
  const esc = (p.decisao?.escalar || []).map((c) => `🟢 escalar *${c.nome}* (CPL ${brl(c.cpl)} · ${c.leads})`);
  const obs = (p.decisao?.observar || []).slice(0, 2).map((c) => `⚪ SEM BASE - ${c.leads} leads, precisa ${LEADS_MIN_ESCALAR} · *${c.nome}*`);
  const rev = (p.decisao?.revisar || []).map((c) => `🔴 revisar *${c.nome}* (${brl(c.gasto)} · 0 form/WhatsApp)`);
  return [
    '📊 *Placar de Campanhas — Michel*',
    `_${periodo} · conta form OU WhatsApp (cliente chamou) · min ${LEADS_MIN_ESCALAR} pra escalar · clique não_`,
    '',
    linhas.join('\n'),
    '',
    `*Total:* ${brl(p.totalGasto)} · ${p.totalLeads || 0} resultados · CPL médio ${brl(p.cplMedio)}`,
    '',
    '*Decisão do dia:*',
    ...(esc.length ? esc : ['— sem campanha com base pra escalar']),
    ...(obs.length ? obs : []),
    ...(rev.length ? rev : []),
  ].filter((x) => x !== undefined).join('\n');
}
