// Núcleo do PLACAR DE CAMPANHAS (arquivo "_" = NÃO vira função).
// Métrica principal: LEAD DE FORMULÁRIO da Meta (cadastro no anúncio).
// NÃO conta: clique, link_click, conversa WhatsApp, impressão, engajamento.
// NÃO soma action_types sobrepostos (lead + lead_grouped) — escolhe 1 por prioridade.
import fs from 'node:fs';
import { enriqueceCampanha, podeEscalar, LEADS_MIN_ESCALAR } from './_campanhas-regras.mjs';

/**
 * Prioridade = o que o Gerenciador mostra como “Lead (formulário)”.
 * Preferir onsite_conversion.lead_grouped; só cair pro próximo se o anterior não vier.
 */
export const PRIORIDADE_LEAD_FORMULARIO = [
  'onsite_conversion.lead_grouped',
  'leadgen_grouped',
  'onsite_conversion.lead',
  'leadgen.other',
  'lead',
];

export const TIPOS_LEAD_FORMULARIO = new Set(PRIORIDADE_LEAD_FORMULARIO);

/** Explicitamente NÃO são lead de formulário (mesmo se a API mandar). */
export const TIPOS_NAO_FORMULARIO = new Set([
  'link_click',
  'inline_link_click',
  'landing_page_view',
  'page_engagement',
  'post_engagement',
  'video_view',
  'omni_landing_page_view',
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.total_messaging_connection',
  'onsite_conversion.messaging_block',
  'click_to_call_call_confirm',
  'outbound_click',
]);

function indicadorEhFormulario(indicator = '') {
  const s = String(indicator).toLowerCase();
  if (!s) return false;
  if (s.includes('messaging') || s.includes('click') || s.includes('view') || s.includes('engage')) {
    return false;
  }
  return s.includes('lead');
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

function temSinalNaoFormulario(c = {}, mapa) {
  for (const t of TIPOS_NAO_FORMULARIO) {
    if ((mapa.get(t) || 0) > 0) return true;
  }
  const clicks = Number(c.clicks) || 0;
  if (clicks > 0) return true;
  if (Array.isArray(c.results) && c.results[0]) {
    const ind = String(c.results[0].indicator || '').toLowerCase();
    if (ind && (ind.includes('click') || ind.includes('messaging') || ind.includes('view'))) return true;
  }
  return false;
}

/**
 * Conta só cadastros de formulário Meta (1 action_type por campanha, por prioridade).
 * @returns {{ leads:number, fonte:string|null, aviso:string|null, confirmado:boolean }}
 */
export function extraiLeadsFormulario(c = {}) {
  const mapa = mapaAcoes(c);

  for (const tipo of PRIORIDADE_LEAD_FORMULARIO) {
    const v = mapa.get(tipo);
    if (v != null && v > 0) {
      return { leads: v, fonte: tipo, aviso: null, confirmado: true };
    }
  }

  // Fallback results: só se o indicador for de lead/formulário (não messaging/clique).
  if (Array.isArray(c.results) && c.results[0]) {
    const r0 = c.results[0];
    if (indicadorEhFormulario(r0.indicator) && Array.isArray(r0.values)) {
      const n = Number(r0.values[0] && r0.values[0].value) || 0;
      if (n > 0) {
        return {
          leads: n,
          fonte: `results:${r0.indicator || 'lead'}`,
          aviso: null,
          confirmado: true,
        };
      }
    }
  }

  // Tipo de formulário presente com zero, ou sem sinal de clique → 0 cadastros reais.
  const temTipoFormZero = PRIORIDADE_LEAD_FORMULARIO.some((t) => mapa.has(t));
  if (temTipoFormZero || !temSinalNaoFormulario(c, mapa)) {
    return {
      leads: 0,
      fonte: null,
      aviso: '0 cadastros de formulário.',
      confirmado: true,
    };
  }

  // API trouxe clique/mensagem, mas nenhum action_type de formulário confirmado.
  return {
    leads: 0,
    fonte: null,
    aviso: 'Não foi possível confirmar os leads de formulário desta campanha.',
    confirmado: false,
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
    fontesUsadas: [...new Set(porCampanha.map((c) => c.fonteLead).filter(Boolean))],
    porCampanha,
  };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Monta o placar a partir do array `data` do Meta Insights.
 * leads / CPL = somente formulário. CPL só se confirmado e leads > 0.
 */
export function montaPlacar(data = []) {
  const campanhas = (Array.isArray(data) ? data : []).map((c) => {
    const gasto = round2(num(c.spend));
    const { leads, fonte, aviso, confirmado } = extraiLeadsFormulario(c);
    const cpl = (confirmado && leads > 0) ? round2(gasto / leads) : null;
    return enriqueceCampanha({
      nome: c.campaign_name || '(sem nome)',
      id: c.campaign_id || null,
      gasto,
      leads,
      cpl,
      fonteLead: fonte,
      avisoLead: aviso,
      leadConfirmado: confirmado,
    });
  })
    .filter((c) => c.gasto > 0)
    .sort((a, b) => b.gasto - a.gasto);

  const totalGasto = round2(campanhas.reduce((s, c) => s + c.gasto, 0));
  const totalLeads = campanhas.reduce((s, c) => s + (c.leadConfirmado ? c.leads : 0), 0);
  const cplMedio = totalLeads > 0 ? round2(totalGasto / totalLeads) : null;
  const inventario = inventariarAcoes(data);

  // Em CI (prova do placar): anexa inventário sem precisar alterar o workflow.
  if (process.env.CI && process.env.GITHUB_STEP_SUMMARY) {
    try {
      let diag = '\n### Inventário action_type (formulário)\n\n';
      diag += `Fontes usadas: ${(inventario.fontesUsadas || []).join(', ') || '(nenhuma)'}\n\n`;
      diag += '| action_type form. | soma |\n|---|--:|\n';
      for (const x of inventario.formulariosNosTotais) {
        diag += `| \`${x.action_type}\` | ${x.value} |\n`;
      }
      diag += '\n| Campanha | form. | fonte |\n|---|--:|---|\n';
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
    metrica: 'lead_formulario',
    fontesLead: inventario.fontesUsadas,
    decisao: decideDoDia(campanhas, cplMedio),
  };
}

/**
 * Decisão do dia — formulário only.
 *  - ESCALAR: leads >= 10, CPL ok, sem público fora do BR em Piçarras.
 *  - OBSERVAR: tem lead mas < 10 (SEM BASE) — NÃO entra em escalar.
 *  - REVISAR: gastou (>= R$50) e ZERO cadastro de formulário confirmado.
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

/** Texto do Placar pro WhatsApp — cadastros de formulário, nunca clique. */
export function resumoPlacarWhats(placar, { periodo = 'últimos 7 dias' } = {}) {
  const p = placar || {};
  const linhas = (p.campanhas || []).slice(0, 6).map((c) => {
    let cpl;
    if (c.cpl != null) cpl = `CPL form. ${brl(c.cpl)}`;
    else if (c.leadConfirmado === false) cpl = '⚠️ form. não confirmado';
    else if (c.gasto >= 50) cpl = '⚠️ 0 cadastro form.';
    else cpl = 'sem cadastro form. ainda';
    return `• *${c.nome}*\n   ${brl(c.gasto)} · ${c.leads} cadastro(s) form. · ${cpl}`;
  });
  const esc = (p.decisao?.escalar || []).map((c) => `🟢 escalar *${c.nome}* (CPL form. ${brl(c.cpl)} · ${c.leads} form.)`);
  const obs = (p.decisao?.observar || []).slice(0, 2).map((c) => `⚪ SEM BASE - ${c.leads} leads, precisa ${LEADS_MIN_ESCALAR} · *${c.nome}*`);
  const rev = (p.decisao?.revisar || []).map((c) => `🔴 revisar *${c.nome}* (${brl(c.gasto)} · 0 cadastro form.)`);
  return [
    '📊 *Placar de Campanhas — Michel*',
    `_${periodo} · leads = cadastro de formulário Meta · min ${LEADS_MIN_ESCALAR} pra escalar_`,
    '',
    linhas.join('\n'),
    '',
    `*Total:* ${brl(p.totalGasto)} · ${p.totalLeads || 0} cadastros form. · CPL form. médio ${brl(p.cplMedio)}`,
    '',
    '*Decisão do dia:*',
    ...(esc.length ? esc : ['— sem campanha com base pra escalar']),
    ...(obs.length ? obs : []),
    ...(rev.length ? rev : []),
  ].filter((x) => x !== undefined).join('\n');
}
