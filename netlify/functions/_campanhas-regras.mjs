// Regras do Painel de Campanhas / quadradinho (arquivo "_" = NÃO vira função).
// Lead de formulário · base mínima · semáforo · identidade V4.1 · público BR.
import { identidadeCampanha, cidadeDoMapa } from './_mapeamento-v41.mjs';

/** Base mínima para recomendar ESCALAR. */
export const LEADS_MIN_ESCALAR = 10;

/** Semáforo CPL Bruto (legado / sem caça). */
export const CPL_BOA = 30;
export const CPL_ATENCAO = 50;

/** Semáforo CPL BOM (prompt final Bruno): <25 🟢 · 25–45 🟡 · >45 🔴 · <10 leads ⚪ */
export const CPL_BOM_VERDE = 25;
export const CPL_BOM_AMARELO = 45;

/** Texto canônico Bruno: ⚪ SEM BASE - 3 leads, precisa 10 */
export function rotuloSemBase(leads = 0) {
  const n = Number(leads) || 0;
  return `⚪ SEM BASE - ${n} leads, precisa ${LEADS_MIN_ESCALAR}`;
}

/** Texto canônico: PUBLICO EXTERNO (Americanos/MIAMI/PORTUGAL em Piçarras). */
export function rotuloPublicoExterno(motivo = null) {
  return motivo
    ? `🚫 PUBLICO EXTERNO — ${motivo}`
    : '🚫 PUBLICO EXTERNO — Americanos/MIAMI/PORTUGAL em Piçarras';
}

/**
 * Cidade real (V4.1) — NUNCA devolve produto/construtora/corretor no lugar da cidade.
 * Ex.: Fort Myers → cidade Piçarras (produto = Fort Myers).
 */
export function cidadeReal(nome = '') {
  return cidadeDoMapa(nome);
}

/** Identidade completa: produto + cidade + construtora + corretor. */
export { identidadeCampanha };

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
 * 🟢 BOA = leads >=10 e CPL < limiar verde
 * 🟡 ATENÇÃO = leads >=10 e CPL no meio
 * 🔴 CARO = leads >=10 e CPL > limiar amarelo
 * ⚪ SEM BASE = leads < 10 (cinza)
 * @param {{ modo?: 'bruto'|'bom' }} opts — bom usa régua 25/45
 */
export function semaforoCampanha({ leads = 0, cpl = null, leadConfirmado = true } = {}, { modo = 'bruto' } = {}) {
  const n = Number(leads) || 0;
  const verde = modo === 'bom' ? CPL_BOM_VERDE : CPL_BOA;
  const amarelo = modo === 'bom' ? CPL_BOM_AMARELO : CPL_ATENCAO;
  if (!leadConfirmado) {
    return { codigo: 'SEM_BASE', emoji: '⚪', label: 'SEM BASE', detalhe: 'Formulário não confirmado', cor: 'cinza' };
  }
  if (n < LEADS_MIN_ESCALAR) {
    return {
      codigo: 'SEM_BASE',
      emoji: '⚪',
      label: 'SEM BASE',
      detalhe: rotuloSemBase(n),
      bloqueadoEscalar: true,
      cor: 'cinza',
    };
  }
  if (cpl == null) {
    return { codigo: 'ATENCAO', emoji: '🟡', label: 'ATENÇÃO', detalhe: 'CPL indisponível', cor: 'amarelo' };
  }
  if (cpl < verde) {
    return { codigo: 'BOA', emoji: '🟢', label: 'BOA', detalhe: `CPL R$ ${Number(cpl).toFixed(0)} < R$ ${verde}`, cor: 'verde' };
  }
  if (cpl <= amarelo) {
    return { codigo: 'ATENCAO', emoji: '🟡', label: 'ATENÇÃO', detalhe: `CPL R$ ${Number(cpl).toFixed(0)} (R$ ${verde}–${amarelo})`, cor: 'amarelo' };
  }
  return { codigo: 'CARO', emoji: '🔴', label: 'CARO', detalhe: `CPL R$ ${Number(cpl).toFixed(0)} > R$ ${amarelo}`, cor: 'vermelho' };
}

/** Pode escalar? Base mín. + sem PUBLICO EXTERNO em Piçarras. */
export function podeEscalar(c = {}) {
  const leads = Number(c.leads) || 0;
  if (c.leadConfirmado === false) return false;
  if (leads < LEADS_MIN_ESCALAR) return false;
  if (c.cpl == null && c.cplBom == null && c.cplDecisao == null) return false;
  const cidade = cidadeReal(c.nome);
  const pub = publicoForaDoBrasil(c.nome);
  if (cidade === 'Piçarras' && pub.alerta) return false;
  return true;
}

/** Travas de escalar (prompt final). */
export function travaEscalar(c = {}) {
  const leads = Number(c.leads) || 0;
  const cidade = c.cidade || cidadeReal(c.nome);
  const pub = c.alertaPublico != null
    ? { alerta: !!c.alertaPublico, motivo: c.alertaPublico, publico: c.publico }
    : publicoForaDoBrasil(c.nome);

  if (c.leadConfirmado === false) {
    return { ok: false, codigo: 'SEM_BASE', rotulo: '⚪ SEM BASE — formulário não confirmado' };
  }
  if (leads < LEADS_MIN_ESCALAR) {
    return { ok: false, codigo: 'SEM_BASE', rotulo: rotuloSemBase(leads) };
  }
  if (cidade === 'Piçarras' && pub.alerta) {
    return { ok: false, codigo: 'PUBLICO_EXTERNO', rotulo: rotuloPublicoExterno(pub.motivo || pub.publico) };
  }
  return { ok: true, codigo: null, rotulo: null };
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

/** Enriquece campanha com identidade V4.1, semáforo, público, trava. */
export function enriqueceCampanha(c = {}, { diasNoAr = null } = {}) {
  const id = identidadeCampanha(c.nome);
  const cidade = id.cidade;
  const pub = publicoForaDoBrasil(c.nome);
  const semaforo = semaforoCampanha({
    leads: c.leads, cpl: c.cpl, leadConfirmado: c.leadConfirmado !== false,
  });
  const trava = travaEscalar({ ...c, cidade, alertaPublico: pub.alerta ? pub.motivo : null, publico: pub.publico });
  return {
    ...c,
    cidade,
    produto: id.produto,
    construtora: id.construtora,
    corretor: id.corretor,
    rotuloProdutoCidade: id.rotulo,
    identidade: id,
    publico: pub.publico,
    alertaPublico: pub.alerta ? pub.motivo : null,
    semaforo,
    diasNoAr: diasNoAr != null ? diasNoAr : (c.diasNoAr ?? null),
    podeEscalar: podeEscalar(c),
    travaEscalar: trava,
    bloqueadoEscalar: !trava.ok,
  };
}
