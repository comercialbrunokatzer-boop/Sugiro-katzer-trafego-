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

import {
  CPL_BOA, CPL_ATENCAO, CPL_BOM_VERDE, CPL_BOM_AMARELO,
  LEADS_MIN_ESCALAR, cidadeReal, identidadeCampanha, travaEscalar, semaforoCampanha,
} from './_campanhas-regras.mjs';

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
    // BOM: régua <25 / 25–45 / >45 · base = leads FORM (trava 10)
    semaforoBruto: semaforoCampanha({ leads: leadsTotais, cpl: cplBruto }, { modo: 'bruto' }),
    semaforoBom: temQualidade
      ? semaforoCampanha({ leads: leadsTotais, cpl: cplBom }, { modo: 'bom' })
      : null,
    semaforoDecisao: temQualidade
      ? semaforoCampanha({ leads: leadsTotais, cpl: cplBom }, { modo: 'bom' })
      : semaforoCampanha({ leads: leadsTotais, cpl: cplBruto }, { modo: 'bruto' }),
  };
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
  const idMap = identidadeCampanha(nome);
  const cidade = campanha.cidade || idMap.cidade || cidadeReal(nome);
  const trava = travaEscalar({ ...campanha, nome, cidade });
  return {
    ...campanha,
    cidade,
    produto: campanha.produto || idMap.produto,
    construtora: campanha.construtora || idMap.construtora,
    publicoNome: campanha.publicoNome || idMap.publico,
    dataCampanha: campanha.dataCampanha || idMap.data,
    tipoCampanha: campanha.tipoCampanha || idMap.tipo,
    rotuloProdutoCidade: campanha.rotuloProdutoCidade || idMap.rotulo,
    identidade: campanha.identidade || idMap,
    cplBruto: calc.cplBruto,
    cplBom: calc.cplBom,
    pctBons: calc.pctBons,
    leadsBons: calc.leadsBons,
    leadsMarcados: calc.leadsMarcados,
    temQualidade: calc.temQualidade,
    qualidade: calc.qualidade,
    semaforoBruto: calc.semaforoBruto,
    semaforoBom: calc.semaforoBom,
    cplDecisao: calc.temQualidade ? calc.cplBom : calc.cplBruto,
    semaforoDecisao: calc.semaforoDecisao,
    travaEscalar: trava,
    bloqueadoEscalar: !trava.ok,
  };
}

/**
 * Ordena lista: modo bom → menor CPL BOM (sem qualidade no fim).
 * modo bruto → menor CPL bruto.
 */
export function ordenaPorCpl(campanhas = [], { modo = 'bom' } = {}) {
  const lista = [...(Array.isArray(campanhas) ? campanhas : [])];
  const key = modo === 'bom' ? 'cplBom' : 'cplBruto';
  return lista.sort((a, b) => {
    const va = a[key] ?? (modo === 'bruto' ? a.cpl : null);
    const vb = b[key] ?? (modo === 'bruto' ? b.cpl : null);
    if (va == null && vb == null) return (b.gasto || 0) - (a.gasto || 0);
    if (va == null) return 1;
    if (vb == null) return -1;
    return va - vb;
  });
}

/**
 * Decisão §6: menor CPL BOM com leads>=10 e público BR.
 * Sem caça → fallback CPL bruto com mesmas travas.
 */
export function escolheMelhorParaEscalar(campanhas = []) {
  const elegiveis = (campanhas || []).filter((c) => {
    const trava = c.travaEscalar || travaEscalar(c);
    return trava.ok && c.leadConfirmado !== false;
  });

  const comBom = elegiveis.filter((c) => c.temQualidade && c.cplBom != null);
  if (comBom.length) {
    const top = [...comBom].sort((a, b) => a.cplBom - b.cplBom)[0];
    return {
      campanha: top,
      metrica: 'cpl_bom',
      cpl: top.cplBom,
      motivo: `Menor CPL BOM R$ ${Number(top.cplBom).toFixed(2)} · ${top.leads} leads · público BR · ${top.cidade || cidadeReal(top.nome)}`,
    };
  }

  const comBruto = elegiveis.filter((c) => (c.cplBruto ?? c.cpl) != null);
  if (comBruto.length) {
    const top = [...comBruto].sort((a, b) => (a.cplBruto ?? a.cpl) - (b.cplBruto ?? b.cpl))[0];
    return {
      campanha: top,
      metrica: 'cpl_bruto',
      cpl: top.cplBruto ?? top.cpl,
      motivo: `Menor CPL Bruto R$ ${Number(top.cplBruto ?? top.cpl).toFixed(0)} · ${top.leads} leads · público BR (caça pendente)`,
    };
  }
  return null;
}

export { CPL_BOM_VERDE, CPL_BOM_AMARELO, CPL_BOA, CPL_ATENCAO, LEADS_MIN_ESCALAR };


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
