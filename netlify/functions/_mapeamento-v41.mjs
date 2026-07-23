// MAPEAMENTO OFICIAL KATZER OS V4.1
// Organiza campanha por: PRODUTO + CIDADE + CONSTRUTORA + CORRETOR
// (Nunca misturar nome de produto / construtora / corretor como se fosse cidade.)

/**
 * Linhas canônicas (tráfego / painel Michel).
 * Aliases batem no nome da campanha Meta (case-insensitive).
 *
 * Fonte: Bruno — PRODUTO: FORT MYERS - PIÇARRAS · AMANAY - ITAPOÁ ·
 * BARRA VIEW → Barra Velha · ALICERCE/AYA → Piçarras · ROGGA+AMANAY → Itapoá.
 * Tabela completa V4.1: completar quando Bruno reenviar (mensagem cortou).
 */
export const MAPA_V41 = [
  {
    chave: 'fort_myers',
    produto: 'Fort Myers',
    cidade: 'Piçarras',
    construtora: 'Vetter',
    corretor: null,
    aliases: [/FORT\s*MYERS|FORTMYERS/i],
  },
  {
    chave: 'amanay',
    produto: 'Amanay',
    cidade: 'Itapoá',
    construtora: 'Rogga',
    corretor: null,
    aliases: [/AMANAY|ITAPO[ÁA]/i],
  },
  {
    chave: 'barra_view',
    produto: 'Barra View',
    cidade: 'Barra Velha',
    construtora: null,
    corretor: 'Sandra',
    aliases: [/BARRA\s*VIEW|BARRA\s*VELHA/i],
  },
  {
    chave: 'aya',
    produto: 'Aya',
    cidade: 'Piçarras',
    construtora: 'Alicerce',
    corretor: null,
    aliases: [/\bAYA\b|ALICERCE|CELEBRATION|PI[CÇ]ARRAS|PICARRAS/i],
  },
  {
    chave: 'punta_cana',
    produto: 'Punta Cana',
    cidade: 'Punta Cana',
    construtora: 'Torresani',
    corretor: null,
    aliases: [/PUNTA\s*CANA|PUNTACANA|TORRESANI/i],
  },
  {
    chave: 'yara',
    produto: 'Yara',
    cidade: null,
    construtora: null,
    corretor: null,
    aliases: [/\bYARA\b/i],
  },
];

/** Corretores conhecidos no nome da campanha. */
const CORRETORES = [
  { nome: 'Sandra', rx: /\bSANDRA\b/i },
  { nome: 'Alisson', rx: /\bALISSON\b/i },
  { nome: 'Edsel', rx: /\bEDSEL\b/i },
];

/** Construtoras conhecidas (quando o alias de produto não preenche). */
const CONSTRUTORAS = [
  { nome: 'Rogga', rx: /\bROGGA\b/i },
  { nome: 'Alicerce', rx: /\bALICERCE\b/i },
  { nome: 'Torresani', rx: /\bTORRESANI\b/i },
  { nome: 'Vetter', rx: /\bVETTER\b/i },
  { nome: 'Bertoldi', rx: /\bBERTOLDI\b/i },
  { nome: 'BRcon', rx: /\bBRCON\b/i },
  { nome: 'VSK', rx: /\bVSK\b/i },
];

function encontraLinha(nome = '') {
  const n = String(nome || '');
  for (const row of MAPA_V41) {
    if (row.aliases.some((rx) => rx.test(n))) return row;
  }
  return null;
}

function encontraCorretor(nome = '', fallback = null) {
  const n = String(nome || '');
  for (const c of CORRETORES) {
    if (c.rx.test(n)) return c.nome;
  }
  return fallback || null;
}

function encontraConstrutora(nome = '', fallback = null) {
  const n = String(nome || '');
  for (const c of CONSTRUTORAS) {
    if (c.rx.test(n)) return c.nome;
  }
  return fallback || null;
}

/**
 * Identidade canônica da campanha — V4.1.
 * @returns {{
 *   chave: string|null,
 *   produto: string|null,
 *   cidade: string|null,
 *   construtora: string|null,
 *   corretor: string|null,
 *   rotulo: string,           // "Fort Myers · Piçarras"
 *   rotuloCheio: string,      // "Fort Myers · Piçarras · Vetter · —"
 * }}
 */
export function identidadeCampanha(nome = '') {
  const row = encontraLinha(nome);
  const produto = row?.produto || null;
  const cidade = row?.cidade || null;
  const construtora = encontraConstrutora(nome, row?.construtora || null);
  const corretor = encontraCorretor(nome, row?.corretor || null);

  const partesCurto = [produto, cidade].filter(Boolean);
  const partesCheio = [produto, cidade, construtora, corretor].filter(Boolean);

  return {
    chave: row?.chave || null,
    produto,
    cidade: cidade || '—',
    construtora,
    corretor,
    rotulo: partesCurto.length ? partesCurto.join(' · ') : '—',
    rotuloCheio: partesCheio.length ? partesCheio.join(' · ') : '—',
  };
}

/** Só a cidade (compat). Nunca devolve nome de produto. */
export function cidadeDoMapa(nome = '') {
  const id = identidadeCampanha(nome);
  return id.cidade && id.cidade !== '—' ? id.cidade : '—';
}

/** Rótulo curto pro painel / ranking: Produto · Cidade. */
export function rotuloProdutoCidade(nome = '') {
  return identidadeCampanha(nome).rotulo;
}
