// Regras do Painel de Campanhas / quadradinho (arquivo "_" = NÃO vira função).
// Lead de formulário · base mínima · semáforo · cidade real · público BR.

/** Base mínima para recomendar ESCALAR. */
export const LEADS_MIN_ESCALAR = 10;

/** Semáforo CPL (só com base mínima). */
export const CPL_BOA = 30;
export const CPL_ATENCAO = 50;

/**
 * Cidade/produto real (Bruno).
 * FORT MYERS / ALICERCE → Piçarras
 * BARRA VIEW → Barra Velha
 * AMANAY → Itapoá
 */
export function cidadeReal(nome = '') {
  const n = String(nome);
  if (/BARRA\s*VIEW|BARRA\s*VELHA|SANDRA/i.test(n)) return 'Barra Velha';
  if (/AMANAY|ITAPO[ÁA]/i.test(n)) return 'Itapoá';
  if (/ALICERCE|AYA|EDSEL|PI[CÇ]ARRAS|PICARRAS/i.test(n)) return 'Piçarras';
  if (/FORT\s*MYERS|FORTMYERS/i.test(n)) return 'Piçarras';
  if (/TORRESANI|PUNTA\s*CANA|PUNTACANA/i.test(n)) return 'Punta Cana';
  if (/ROGGA/i.test(n) && !/AMANAY/i.test(n)) return 'Rogga';
  if (/YARA/i.test(n)) return 'Yara';
  return '—';
}

/** Público suspeito fora do Brasil para produto Piçarras / Fort Myers. */
export function publicoForaDoBrasil(nome = '') {
  const n = String(nome);
  if (/EUA[_\s-]?Americanos|AMERICANOS/i.test(n)) {
    return { alerta: true, publico: 'Americanos em EUA', motivo: 'Público fora do Brasil - verificar qualidade no Bitrix' };
  }
  if (/MIAMI|ORLANDO|ORLA/i.test(n)) {
    return { alerta: true, publico: 'Miami/Orlando', motivo: 'Público fora do Brasil - verificar qualidade no Bitrix' };
  }
  if (/PORTUGAL/i.test(n)) {
    return { alerta: true, publico: 'Portugal', motivo: 'Público fora do Brasil - verificar qualidade no Bitrix' };
  }
  if (/ESPANHA|SPAIN/i.test(n)) {
    return { alerta: true, publico: 'Espanha', motivo: 'Público fora do Brasil - verificar qualidade no Bitrix' };
  }
  if (/EUA[_\s-]?Brasileiros|BRASILEIROS/i.test(n)) {
    return { alerta: false, publico: 'Brasileiros em EUA', motivo: null };
  }
  if (/BR[_\s-]?SC/i.test(n)) return { alerta: false, publico: 'BR_SC', motivo: null };
  if (/AMANAY/i.test(n)) return { alerta: false, publico: 'SC+PR', motivo: null };
  return { alerta: false, publico: null, motivo: null };
}

/**
 * Semáforo oficial:
 * 🟢 BOA = leads >=10 e CPL < 30
 * 🟡 ATENÇÃO = leads >=10 e CPL 30–50
 * 🔴 CARO = leads >=10 e CPL > 50
 * ⚪ SEM BASE = leads < 10
 */
export function semaforoCampanha({ leads = 0, cpl = null, leadConfirmado = true } = {}) {
  const n = Number(leads) || 0;
  if (!leadConfirmado) {
    return { codigo: 'SEM_BASE', emoji: '⚪', label: 'SEM BASE', detalhe: 'Formulário não confirmado' };
  }
  if (n < LEADS_MIN_ESCALAR) {
    return {
      codigo: 'SEM_BASE',
      emoji: '⚪',
      label: 'SEM BASE',
      detalhe: `Base: ${n} leads - SEM BASE MÍNIMA (precisa ${LEADS_MIN_ESCALAR})`,
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
  return { codigo: 'CARO', emoji: '🔴', label: 'CARO', detalhe: `CPL R$ ${Number(cpl).toFixed(0)} > R$ ${CPL_ATENCAO}` };
}

/** Pode escalar? Só com base mínima + sem alerta de público fora do BR (para Piçarras). */
export function podeEscalar(c = {}) {
  const leads = Number(c.leads) || 0;
  if (c.leadConfirmado === false) return false;
  if (leads < LEADS_MIN_ESCALAR) return false;
  if (c.cpl == null) return false;
  const cidade = cidadeReal(c.nome);
  const pub = publicoForaDoBrasil(c.nome);
  if (cidade === 'Piçarras' && pub.alerta) return false;
  return true;
}

/**
 * Linha do card Rotina:
 *   CPL BOM méd R$ 32 | 68% bons | Itapoá: R$ 13 BOM 🟢
 * BOM = lead de formulário confirmado, amostra ≥3, CPL ≤ 40 (régua ranking).
 */
export const CPL_BOM_CARD = 40;
export const LEADS_MIN_BOM_CARD = 3;

export function resumoCplBom(campanhas = [], {
  cplBom = CPL_BOM_CARD,
  minLeads = LEADS_MIN_BOM_CARD,
} = {}) {
  const lista = Array.isArray(campanhas) ? campanhas : [];
  const comGasto = lista.filter((c) => Number(c.gasto) > 0);
  const avaliadas = comGasto.filter((c) => (
    c.leadConfirmado !== false
    && Number(c.leads) >= minLeads
    && c.cpl != null
  ));
  const bons = avaliadas.filter((c) => Number(c.cpl) <= cplBom);
  const base = avaliadas.length || comGasto.length || lista.length;
  const pctBons = base > 0 ? Math.round((100 * bons.length) / base) : 0;
  const cplBomMedio = bons.length
    ? Math.round(bons.reduce((s, c) => s + Number(c.cpl), 0) / bons.length)
    : null;

  // Destaque: melhor CPL BOM (menor) com cidade real
  let destaque = null;
  let destaqueTexto = null;
  if (bons.length) {
    const top = [...bons].sort((a, b) => Number(a.cpl) - Number(b.cpl))[0];
    const cidade = top.cidade || cidadeReal(top.nome);
    const cpl = Math.round(Number(top.cpl));
    destaque = { cidade, cpl, nome: top.nome };
    destaqueTexto = `${cidade}: R$ ${cpl} BOM 🟢`;
  }

  const partes = [];
  if (cplBomMedio != null) {
    partes.push(`CPL BOM méd R$ ${cplBomMedio}`);
    partes.push(`${pctBons}% bons`);
    if (destaqueTexto) partes.push(destaqueTexto);
  }

  return {
    cplBomMedio,
    pctBons,
    nBons: bons.length,
    nAvaliadas: avaliadas.length,
    destaque,
    destaqueTexto,
    texto: partes.length
      ? partes.join(' | ')
      : (comGasto.length ? `CPL BOM: sem campanha boa ainda (régua R$ ${cplBom})` : 'CPL BOM: sem dados'),
  };
}

/** Enriquece campanha com cidade, semáforo, público. */
export function enriqueceCampanha(c = {}, { diasNoAr = null } = {}) {
  const cidade = cidadeReal(c.nome);
  const pub = publicoForaDoBrasil(c.nome);
  const semaforo = semaforoCampanha({
    leads: c.leads, cpl: c.cpl, leadConfirmado: c.leadConfirmado !== false,
  });
  return {
    ...c,
    cidade,
    publico: pub.publico,
    alertaPublico: pub.alerta ? pub.motivo : null,
    semaforo,
    diasNoAr: diasNoAr != null ? diasNoAr : (c.diasNoAr ?? null),
    podeEscalar: podeEscalar(c),
  };
}
