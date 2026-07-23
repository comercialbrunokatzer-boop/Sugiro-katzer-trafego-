// MAPEAMENTO OFICIAL KATZER OS V4.1
//
// Nome canônico da campanha Meta:
//   [PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]
//
// Ex.: [FORT MYERS]_[PIÇARRAS]_[VETTER]_[BR_SC]_[23/07/26]_[LEAD]
//
// Nunca misturar produto / construtora / público como se fosse cidade.

/** Cidades canônicas (slug no nome → rótulo). */
export const CIDADES_V41 = {
  PICARRAS: 'Piçarras',
  'PIÇARRAS': 'Piçarras',
  PICARRA: 'Piçarras',
  ITAPOA: 'Itapoá',
  'ITAPOÁ': 'Itapoá',
  'BARRA VELHA': 'Barra Velha',
  BARRAVELHA: 'Barra Velha',
  PENHA: 'Penha',
  'PUNTA CANA': 'Punta Cana',
  PUNTACANA: 'Punta Cana',
};

/** Fallback por produto quando o nome ainda é legado (sem os 6 slots). */
export const MAPA_V41 = [
  {
    chave: 'fort_myers',
    produto: 'Fort Myers',
    cidade: 'Piçarras',
    construtora: 'Vetter',
    aliases: [/FORT\s*MYERS|FORTMYERS/i],
  },
  {
    chave: 'amanay',
    produto: 'Amanay',
    cidade: 'Itapoá',
    construtora: 'Rogga',
    aliases: [/AMANAY/i],
  },
  {
    chave: 'barra_view',
    produto: 'Barra View',
    cidade: 'Barra Velha',
    construtora: null,
    aliases: [/BARRA\s*VIEW/i],
  },
  {
    chave: 'aya',
    produto: 'Aya',
    cidade: 'Piçarras',
    construtora: 'Alicerce',
    aliases: [/\bAYA\b|ALICERCE|CELEBRATION/i],
  },
  {
    chave: 'punta_cana',
    produto: 'Punta Cana',
    cidade: 'Punta Cana',
    construtora: 'Torresani',
    aliases: [/PUNTA\s*CANA|PUNTACANA|TORRESANI/i],
  },
  {
    chave: 'yara',
    produto: 'Yara',
    cidade: null,
    construtora: null,
    aliases: [/\bYARA\b/i],
  },
];

const CONSTRUTORAS = [
  { nome: 'Rogga', rx: /\bROGGA\b/i },
  { nome: 'Alicerce', rx: /\bALICERCE\b/i },
  { nome: 'Torresani', rx: /\bTORRESANI\b/i },
  { nome: 'Vetter', rx: /\bVETTER\b/i },
  { nome: 'Bertoldi', rx: /\bBERTOLDI\b/i },
  { nome: 'BRcon', rx: /\bBRCON\b/i },
  { nome: 'VSK', rx: /\bVSK\b/i },
];

/** Público conhecido no 4º slot (ou legado no nome). */
const PUBLICOS = [
  { nome: 'BR_SC', rx: /BR[_\s-]?SC/i },
  { nome: 'SC+PR', rx: /SC\s*\+\s*PR/i },
  { nome: 'EUA_Americanos', rx: /EUA[_\s-]?Americanos|AMERICANOS/i },
  { nome: 'MIAMI', rx: /MIAMI|ORLANDO/i },
  { nome: 'PORTUGAL', rx: /PORTUGAL/i },
  { nome: 'ESPANHA', rx: /ESPANHA|SPAIN/i },
  { nome: 'EUA_Brasileiros', rx: /EUA[_\s-]?Brasileiros|BRASILEIROS/i },
];

const RX_DATA = /^\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?$/;
const RX_TIPO = /^(LEAD|LEADS|FORM|VIDEO|V[IÍ]DEO|IMAGEM|IMAGE|IMG|CARROSSEL|STORIES|REELS|TESTE|COPIA|C[OÓ]PIA)$/i;

function limpaSlot(s = '') {
  return String(s || '')
    .replace(/^\[|\]$/g, '')
    .replace(/[_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tituloSlot(s = '') {
  const t = limpaSlot(s);
  if (!t) return null;
  if (/^br[_\s-]?sc$/i.test(t)) return 'BR_SC';
  if (/^eua[_\s-]?americanos$/i.test(t)) return 'EUA_Americanos';
  if (/^eua[_\s-]?brasileiros$/i.test(t)) return 'EUA_Brasileiros';
  if (/^sc\s*\+\s*pr$/i.test(t)) return 'SC+PR';
  return t.replace(/\w\S*/g, (w) => {
    if (/^(SC|PR|SP|BR|EUA|VSK)$/i.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

export function normalizaCidade(raw = '') {
  const t = limpaSlot(raw);
  if (!t) return null;
  const key = t.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  const keySpaced = t.toUpperCase();
  if (CIDADES_V41[keySpaced]) return CIDADES_V41[keySpaced];
  if (CIDADES_V41[key]) return CIDADES_V41[key];
  // PICARRAS sem cedilha
  if (/^PI[CÇ]ARRAS?$/i.test(t)) return 'Piçarras';
  if (/^ITAPO[AÁ]$/i.test(t)) return 'Itapoá';
  if (/^BARRA\s*VELHA$/i.test(t)) return 'Barra Velha';
  return tituloSlot(t);
}

/**
 * Extrai slots do nome canônico.
 * Aceita:
 *   [PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]
 *   [PRODUTO][CIDADE][CONSTRUTORA][PÚBLICO][DATA][TIPO]  (6 colchetes)
 *   PRODUTO_CIDADE_CONSTRUTORA_PUBLICO_DATA_TIPO         (sem colchete, ≥4 com data/público)
 */
export function parseNomeCanonico(nome = '') {
  const raw = String(nome || '').trim();
  if (!raw) return null;

  const brackets = [...raw.matchAll(/\[([^\]]+)\]/g)].map((m) => limpaSlot(m[1]));
  const temUnderscoreEntre = /\]\s*_\s*\[/.test(raw);

  let slots = null;
  if (brackets.length >= 4 && temUnderscoreEntre) {
    slots = brackets;
  } else if (brackets.length >= 6) {
    slots = brackets;
  } else if (!brackets.length) {
    const parts = raw.split('_').map((p) => limpaSlot(p)).filter(Boolean);
    const hasPub = parts.some((p) => PUBLICOS.some((x) => x.rx.test(p)));
    const hasData = parts.some((p) => RX_DATA.test(p.replace(/\s/g, '')));
    if (parts.length >= 6 || (parts.length >= 4 && hasPub && hasData)) {
      slots = parts;
    }
  }
  if (!slots || slots.length < 4) return null;

  // Legado [CONSTRUTORA][PRODUTO][DATA] não entra aqui (só 2–3 brackets).
  const first = slots[0] || '';
  if (/^(ROGGA|ALICERCE|TORRESANI|SANDRA|EDSEL|ALISSON)$/i.test(first)) {
    // Só aceita se o 2º slot for cidade conhecida (schema novo)
    const c2 = normalizaCidade(slots[1]);
    if (!c2 || /^(Rogga|Alicerce|Amanay|Aya|Sandra)$/i.test(c2)) return null;
  }

  const produto = tituloSlot(slots[0]);
  let cidade = normalizaCidade(slots[1]);
  const construtora = tituloSlot(slots[2]);
  let publico = tituloSlot(slots[3]);
  let data = null;
  let tipo = null;

  for (let i = 4; i < slots.length; i++) {
    const s = slots[i];
    const sCompact = s.replace(/\s/g, '');
    if (!data && RX_DATA.test(sCompact)) {
      data = sCompact;
      continue;
    }
    if (!tipo && RX_TIPO.test(s)) {
      tipo = s.toUpperCase().replace(/Í/g, 'I').replace(/Ó/g, 'O');
      continue;
    }
    if (!data && /^\d/.test(s)) data = sCompact || s;
    else if (!tipo) tipo = tituloSlot(s);
  }

  if (cidade && /^(BR_SC|EUA|MIAMI|PORTUGAL|SC\+PR)/i.test(cidade)) {
    publico = publico || cidade;
    cidade = null;
  }

  return {
    produto,
    cidade,
    construtora,
    publico,
    data,
    tipo,
    slots,
    canonico: true,
  };
}

function encontraLinha(nome = '') {
  const n = String(nome || '');
  for (const row of MAPA_V41) {
    if (row.aliases.some((rx) => rx.test(n))) return row;
  }
  return null;
}

function encontraConstrutora(nome = '', fallback = null) {
  const n = String(nome || '');
  for (const c of CONSTRUTORAS) {
    if (c.rx.test(n)) return c.nome;
  }
  return fallback || null;
}

function encontraPublico(nome = '', fallback = null) {
  const n = String(nome || '');
  for (const p of PUBLICOS) {
    if (p.rx.test(n)) return p.nome;
  }
  return fallback || null;
}

function chaveDeProduto(produto = '') {
  const p = String(produto || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (/fort\s*myers/.test(p)) return 'fort_myers';
  if (/amanay/.test(p)) return 'amanay';
  if (/barra\s*view/.test(p)) return 'barra_view';
  if (/^aya$/.test(p)) return 'aya';
  if (/punta\s*cana/.test(p)) return 'punta_cana';
  if (/yara/.test(p)) return 'yara';
  return p ? p.replace(/\s+/g, '_') : null;
}

/**
 * Identidade canônica — schema V4.1:
 * [PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]
 */
export function identidadeCampanha(nome = '') {
  const parsed = parseNomeCanonico(nome);
  const row = encontraLinha(nome);

  let produto = parsed?.produto || row?.produto || null;
  let cidade = parsed?.cidade || row?.cidade || null;
  let construtora = parsed?.construtora || encontraConstrutora(nome, row?.construtora || null);
  let publico = parsed?.publico || encontraPublico(nome, null);
  let data = parsed?.data || null;
  let tipo = parsed?.tipo || null;

  // Cidade explícita no nome legado (ITAPOÁ / PIÇARRAS) se alias não preencheu
  if (!cidade) {
    if (/ITAPO[ÁA]/i.test(nome)) cidade = 'Itapoá';
    else if (/PI[CÇ]ARRAS|PICARRAS/i.test(nome)) cidade = 'Piçarras';
    else if (/BARRA\s*VELHA/i.test(nome)) cidade = 'Barra Velha';
  }

  const partesCurto = [produto, cidade].filter(Boolean);
  const partesCheio = [produto, cidade, construtora, publico, data, tipo].filter(Boolean);

  return {
    chave: chaveDeProduto(produto) || row?.chave || null,
    produto,
    cidade: cidade || '—',
    construtora,
    publico,
    data,
    tipo,
    schema: '[PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]',
    parseFonte: parsed?.canonico ? 'canonico' : (row ? 'alias' : 'parcial'),
    rotulo: partesCurto.length ? partesCurto.join(' · ') : '—',
    rotuloCheio: partesCheio.length ? partesCheio.join(' · ') : '—',
  };
}

/** Só a cidade (compat). Nunca devolve nome de produto. */
export function cidadeDoMapa(nome = '') {
  const id = identidadeCampanha(nome);
  return id.cidade && id.cidade !== '—' ? id.cidade : '—';
}

/** Rótulo curto: Produto · Cidade. */
export function rotuloProdutoCidade(nome = '') {
  return identidadeCampanha(nome).rotulo;
}

/** Monta nome canônico a partir dos campos. */
export function montaNomeCanonico({
  produto, cidade, construtora, publico, data, tipo,
} = {}) {
  const slot = (v) => `[${String(v || '').trim()}]`;
  return [
    slot(produto),
    slot(cidade),
    slot(construtora),
    slot(publico),
    slot(data),
    slot(tipo),
  ].join('_');
}
