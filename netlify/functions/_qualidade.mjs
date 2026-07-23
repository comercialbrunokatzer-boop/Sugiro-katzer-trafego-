// Qualidade de lead (Caçador) — arquivo "_" = NÃO vira função.
//
// CPL Bruto = gasto / leads totais (formulário Meta)
// CPL BOM   = gasto / (Bom + Comprador)   ← o que Michel caça na Discadora/Garimpo
//
// Ex. Bruno:
//   TESTE FORTMYERS: 39 leads, R$624 → Bruto R$16 (parece boa)
//     8 bom + 3 comprador = 11 → CPL BOM R$56,72 → CARA
//   AMANAY: 24 leads, R$264 → Bruto R$11
//     20 bons → CPL BOM R$13,20 → MELHOR DA CONTA

import { CPL_BOA, CPL_ATENCAO, LEADS_MIN_ESCALAR, cidadeReal } from './_campanhas-regras.mjs';

export const QUALIDADE_TIPOS = ['bom', 'curioso', 'errado', 'comprador'];

export function qualidadeVazia(nome = '', id = null) {
  return {
    id: id || null,
    nome: nome || '',
    bom: 0,
    curioso: 0,
    errado: 0,
    comprador: 0,
    atualizadoEm: null,
    atualizadoPor: null,
  };
}

export function normalizaQualidade(q = {}, { nome = '', id = null } = {}) {
  const base = qualidadeVazia(nome || q.nome, id || q.id);
  for (const t of QUALIDADE_TIPOS) {
    const n = Math.max(0, Math.round(Number(q[t]) || 0));
    base[t] = n;
  }
  base.nome = nome || q.nome || base.nome;
  base.id = id || q.id || base.id;
  base.atualizadoEm = q.atualizadoEm || null;
  base.atualizadoPor = q.atualizadoPor || null;
  return base;
}

/** Leads que alimentam CPL BOM = Bom + Comprador. */
export function leadsBons(q = {}) {
  return Math.max(0, (Number(q.bom) || 0) + (Number(q.comprador) || 0));
}

export function leadsMarcados(q = {}) {
  return QUALIDADE_TIPOS.reduce((s, t) => s + (Number(q[t]) || 0), 0);
}

/**
 * @param {{ gasto:number, leads:number }} camp — leads = formulário Meta (totais)
 * @param {{ bom?:number, curioso?:number, errado?:number, comprador?:number }} qualidade
 */
export function calculaCplQualidade({ gasto = 0, leads = 0 } = {}, qualidade = null) {
  const g = Number(gasto) || 0;
  const leadsTotais = Math.max(0, Number(leads) || 0);
  const q = qualidade ? normalizaQualidade(qualidade) : null;
  const bons = q ? leadsBons(q) : 0;
  const marcados = q ? leadsMarcados(q) : 0;

  const cplBruto = (leadsTotais > 0 && g > 0) ? round2(g / leadsTotais) : null;
  const cplBom = (bons > 0 && g > 0) ? round2(g / bons) : null;
  const pctBons = leadsTotais > 0 && marcados > 0
    ? Math.round((100 * bons) / leadsTotais)
    : (leadsTotais > 0 && bons > 0 ? Math.round((100 * bons) / leadsTotais) : null);

  const temQualidade = !!(q && marcados > 0);

  return {
    gasto: round2(g),
    leadsTotais,
    leadsBons: bons,
    leadsMarcados: marcados,
    qualidade: q,
    temQualidade,
    cplBruto,
    cplBom,
    pctBons,
    // Semáforo: se tem qualidade marcada, julga pelo CPL BOM; senão pelo bruto
    semaforoBruto: semaforoPorCpl(leadsTotais, cplBruto),
    semaforoBom: temQualidade ? semaforoPorCpl(bons, cplBom) : null,
    semaforoDecisao: temQualidade ? semaforoPorCpl(bons, cplBom) : semaforoPorCpl(leadsTotais, cplBruto),
  };
}

function semaforoPorCpl(baseLeads, cpl) {
  if (baseLeads < LEADS_MIN_ESCALAR) {
    return {
      codigo: 'SEM_BASE',
      emoji: '⚪',
      label: 'SEM BASE',
      detalhe: `⚪ SEM BASE - ${baseLeads} leads, precisa ${LEADS_MIN_ESCALAR}`,
    };
  }
  if (cpl == null) {
    return { codigo: 'ATENCAO', emoji: '🟡', label: 'ATENÇÃO', detalhe: 'CPL indisponível' };
  }
  if (cpl < CPL_BOA) {
    return { codigo: 'BOA', emoji: '🟢', label: 'BOA', detalhe: `CPL R$ ${Number(cpl).toFixed(0)} < R$ ${CPL_BOA}` };
  }
  if (cpl <= CPL_ATENCAO) {
    return { codigo: 'ATENCAO', emoji: '🟡', label: 'ATENÇÃO', detalhe: `CPL R$ ${Number(cpl).toFixed(0)} (R$ ${CPL_BOA}–${CPL_ATENCAO})` };
  }
  return { codigo: 'CARO', emoji: '🔴', label: 'CARA', detalhe: `CPL R$ ${Number(cpl).toFixed(0)} > R$ ${CPL_ATENCAO}` };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Enriquece uma campanha do placar com CPL Bruto / CPL BOM. */
export function enriqueceComQualidade(campanha = {}, qualidadeMap = {}) {
  const id = campanha.id || campanha.campaign_id || null;
  const nome = campanha.nome || '';
  const q = (id && qualidadeMap[id])
    || Object.values(qualidadeMap).find((x) => x && x.nome && nome && x.nome === nome)
    || null;
  const calc = calculaCplQualidade(
    { gasto: campanha.gasto, leads: campanha.leads },
    q,
  );
  return {
    ...campanha,
    cidade: campanha.cidade || cidadeReal(nome),
    cplBruto: calc.cplBruto,
    cplBom: calc.cplBom,
    pctBons: calc.pctBons,
    leadsBons: calc.leadsBons,
    leadsMarcados: calc.leadsMarcados,
    temQualidade: calc.temQualidade,
    qualidade: calc.qualidade,
    semaforoBruto: calc.semaforoBruto,
    semaforoBom: calc.semaforoBom,
    // CPL “de decisão”: BOM se houver caçada; senão bruto (formulário)
    cplDecisao: calc.temQualidade ? calc.cplBom : calc.cplBruto,
    semaforoDecisao: calc.semaforoDecisao,
  };
}

/**
 * Texto comparativo Bruno:
 *   Bruto R$16 🟢 → BOM R$57 🔴 (8+3=11 bons / 39)
 */
export function textoCplBrutoVsBom(calc) {
  if (!calc) return '';
  const br = calc.cplBruto != null ? `R$ ${Number(calc.cplBruto).toFixed(0)}` : '—';
  const eb = calc.semaforoBruto?.emoji || '';
  if (!calc.temQualidade) {
    return `CPL Bruto ${br} ${eb} · qualidade ainda não marcada (Discadora/Garimpo)`;
  }
  const bm = calc.cplBom != null ? `R$ ${Number(calc.cplBom).toFixed(2).replace('.', ',')}` : '—';
  const em = calc.semaforoBom?.emoji || '';
  return `CPL Bruto ${br} ${eb} → CPL BOM ${bm} ${em} (${calc.leadsBons} bons de ${calc.leadsTotais} · ${calc.pctBons ?? 0}%)`;
}

/**
 * Linha do card Rotina com CPL BOM real (Bom + Comprador).
 *   CPL BOM méd R$ 13 | 83% bons | Itapoá: R$ 13,20 BOM 🟢
 * Sem caça marcada → avisa (não inventa “bom” por CPL bruto baixo).
 */
export function resumoCplBomQualidade(campanhas = []) {
  const lista = (Array.isArray(campanhas) ? campanhas : [])
    .map((c) => (c.temQualidade != null ? c : enriqueceComQualidade(c, {})));
  const comGasto = lista.filter((c) => Number(c.gasto) > 0);
  const comQ = comGasto.filter((c) => c.temQualidade && c.cplBom != null);

  if (!comQ.length) {
    return {
      fonte: 'pendente',
      cplBomMedio: null,
      pctBons: null,
      nBons: 0,
      nComQualidade: 0,
      destaque: null,
      destaqueTexto: null,
      texto: 'CPL BOM: qualidade ainda não marcada (Discadora/Garimpo)',
    };
  }

  let gasto = 0;
  let leads = 0;
  let bons = 0;
  for (const c of comQ) {
    gasto += Number(c.gasto) || 0;
    leads += Number(c.leads) || 0;
    bons += Number(c.leadsBons) || 0;
  }
  const cplBomMedio = bons > 0 ? Math.round(gasto / bons) : null;
  const pctBons = leads > 0 ? Math.round((100 * bons) / leads) : null;

  const top = [...comQ].sort((a, b) => Number(a.cplBom) - Number(b.cplBom))[0];
  const cidade = top.cidade || cidadeReal(top.nome);
  const cplTop = Number(top.cplBom);
  const em = top.semaforoBom?.emoji || top.semaforoDecisao?.emoji || '🟢';
  const destaque = { cidade, cpl: cplTop, nome: top.nome, emoji: em };
  const destaqueTexto = `${cidade}: R$ ${cplTop.toFixed(2).replace('.', ',')} BOM ${em}`;

  const partes = [];
  if (cplBomMedio != null) partes.push(`CPL BOM méd R$ ${cplBomMedio}`);
  if (pctBons != null) partes.push(`${pctBons}% bons`);
  if (destaqueTexto) partes.push(destaqueTexto);

  return {
    fonte: 'cacador',
    cplBomMedio,
    pctBons,
    nBons: bons,
    nComQualidade: comQ.length,
    destaque,
    destaqueTexto,
    texto: partes.join(' | '),
  };
}
