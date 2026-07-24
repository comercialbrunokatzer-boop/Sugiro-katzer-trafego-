// MAPEAMENTO OFICIAL KATZER OS V4.1
//
// Nome canônico:
//   [PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]
//   ou curto: PRODUTO_CIDADE_CONSTRUTORA_PUBLICO
//
// Ex. mix 80% (Bruno):
//   AMANAY_ITAPOA_ROGGA_BR-SC
//   FORTMYERS_PENHA_VETTER_BR-SC
//   BARRAVIEW_BARRAVELHA_SANTER_BR-SC
//   GRANTHOME_BARRAVELHA_ROGGA_BR-SC
//
// Atendimento EN: sem estrutura em inglês → lead EN fica Curioso (não Bom).

/** Cidades canônicas (slug → rótulo). */
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

/**
 * Catálogo produto → cidade + construtora + se atende inglês.
 * atendeIngles=false → lead de público EN não pode ser Bom (fica Curioso).
 */
export const MAPA_V41 = [
  {
    chave: 'amanay',
    produto: 'Amanay',
    cidade: 'Itapoá',
    construtora: 'Rogga',
    atendeIngles: false,
    aliases: [/AMANAY/i],
  },
  {
    chave: 'fort_myers',
    produto: 'Fort Myers',
    cidade: 'Penha',
    construtora: 'Vetter',
    atendeIngles: false,
    aliases: [/FORT\s*MYERS|FORTMYERS/i],
  },
  {
    chave: 'barra_view',
    produto: 'Barra View',
    cidade: 'Barra Velha',
    construtora: 'Santer',
    atendeIngles: false,
    aliases: [/BARRA\s*VIEW|BARRAVIEW/i],
  },
  {
    chave: 'grant_home',
    produto: 'Grant Home',
    cidade: 'Barra Velha',
    construtora: 'Rogga',
    atendeIngles: false,
    aliases: [/GRANT\s*HOME|GRANTHOME/i],
  },
  {
    chave: 'aya',
    produto: 'Aya',
    cidade: 'Piçarras',
    construtora: 'Alicerce',
    atendeIngles: false,
    aliases: [/\bAYA\b|ALICERCE|CELEBRATION/i],
  },
  {
    chave: 'punta_cana',
    produto: 'Punta Cana',
    cidade: 'Punta Cana',
    construtora: 'Torresani',
    atendeIngles: false,
    aliases: [/PUNTA\s*CANA|PUNTACANA|TORRESANI/i],
  },
  {
    chave: 'yara',
    produto: 'Yara',
    cidade: null,
    construtora: null,
    atendeIngles: false,
    aliases: [/\bYARA\b/i],
  },
];

const CONSTRUTORAS = [
  { nome: 'Rogga', rx: /\bROGGA\b/i },
  { nome: 'Santer', rx: /\bSANTER\b/i },
  { nome: 'Alicerce', rx: /\bALICERCE\b/i },
  { nome: 'Torresani', rx: /\bTORRESANI\b/i },
  { nome: 'Vetter', rx: /\bVETTER\b/i },
  { nome: 'Bertoldi', rx: /\bBERTOLDI\b/i },
  { nome: 'BRcon', rx: /\bBRCON\b/i },
  { nome: 'VSK', rx: /\bVSK\b/i },
];

const PUBLICOS = [
  { nome: 'BR-SC', rx: /BR[_\s-]?SC/i },
  { nome: 'SC+PR', rx: /SC\s*\+\s*PR/i },
  { nome: 'EUA_Americanos', rx: /EUA[_\s-]?Americanos|AMERICANOS/i },
  { nome: 'MIAMI', rx: /MIAMI|ORLANDO/i },
  { nome: 'PORTUGAL', rx: /PORTUGAL/i },
  { nome: 'ESPANHA', rx: /ESPANHA|SPAIN/i },
  { nome: 'EUA_Brasileiros', rx: /EUA[_\s-]?Brasileiros|BRASILEIROS/i },
];

/** Públicos que exigem atendimento em inglês. */
export const PUBLICOS_INGLES = [
  /EUA[_\s-]?Americanos|AMERICANOS/i,
  /MIAMI|ORLANDO/i,
  /\bEN\b|\bENG\b|ENGLISH|INGLES|INGL[EÉ]S/i,
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
  if (/^br[_\s-]?sc$/i.test(t)) return 'BR-SC';
  if (/^eua[_\s-]?americanos$/i.test(t)) return 'EUA_Americanos';
  if (/^eua[_\s-]?brasileiros$/i.test(t)) return 'EUA_Brasileiros';
  if (/^sc\s*\+\s*pr$/i.test(t)) return 'SC+PR';
  if (/^grant\s*home$/i.test(t) || /^granthome$/i.test(t)) return 'Grant Home';
  if (/^fort\s*myers$/i.test(t) || /^fortmyers$/i.test(t)) return 'Fort Myers';
  if (/^barra\s*view$/i.test(t) || /^barraview$/i.test(t)) return 'Barra View';
  return t.replace(/\w\S*/g, (w) => {
    if (/^(SC|PR|SP|BR|EUA|VSK)$/i.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

export function normalizaCidade(raw = '') {
  const t = limpaSlot(raw);
  if (!t) return null;
  const keySpaced = t.toUpperCase();
  const key = t.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (CIDADES_V41[keySpaced]) return CIDADES_V41[keySpaced];
  if (CIDADES_V41[key]) return CIDADES_V41[key];
  if (/^PI[CÇ]ARRAS?$/i.test(t)) return 'Piçarras';
  if (/^ITAPO[AÁ]$/i.test(t)) return 'Itapoá';
  if (/^BARRA\s*VELHA$/i.test(t) || /^BARRAVELHA$/i.test(t)) return 'Barra Velha';
  if (/^PENHA$/i.test(t)) return 'Penha';
  return tituloSlot(t);
}

export function publicoExigeIngles(nomeOuPublico = '') {
  const s = String(nomeOuPublico || '');
  return PUBLICOS_INGLES.some((rx) => rx.test(s));
}

/**
 * Extrai slots do nome canônico (6 ou 4 slots).
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
    // AMANAY_ITAPOA_ROGGA_BR-SC  (hífen no público fica no mesmo token)
    const parts = raw.split('_').map((p) => limpaSlot(p)).filter(Boolean);
    const hasPub = parts.some((p) => PUBLICOS.some((x) => x.rx.test(p)));
    const hasData = parts.some((p) => RX_DATA.test(p.replace(/\s/g, '')));
    if (parts.length >= 6 || (parts.length >= 4 && hasPub) || (parts.length >= 4 && hasData)) {
      slots = parts;
    }
  }
  if (!slots || slots.length < 4) return null;

  const first = slots[0] || '';
  if (/^(ROGGA|ALICERCE|TORRESANI|SANDRA|EDSEL|ALISSON|SANTER)$/i.test(first)) {
    const c2 = normalizaCidade(slots[1]);
    if (!c2 || /^(Rogga|Alicerce|Amanay|Aya|Sandra|Santer)$/i.test(c2)) return null;
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

  if (cidade && /^(BR-SC|BR_SC|EUA|MIAMI|PORTUGAL|SC\+PR)/i.test(cidade)) {
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
  if (/grant\s*home/.test(p)) return 'grant_home';
  if (/^aya$/.test(p)) return 'aya';
  if (/punta\s*cana/.test(p)) return 'punta_cana';
  if (/yara/.test(p)) return 'yara';
  return p ? p.replace(/\s+/g, '_') : null;
}

/**
 * Identidade canônica — V4.1
 * Schema: [PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]
 */
export function identidadeCampanha(nome = '') {
  const parsed = parseNomeCanonico(nome);
  const row = encontraLinha(nome);

  let produto = parsed?.produto || row?.produto || null;
  let cidade = parsed?.cidade || row?.cidade || null;
  let construtora = parsed?.construtora || encontraConstrutora(nome, row?.construtora || null);
  let publico = parsed?.publico || encontraPublico(nome, null);
  const data = parsed?.data || null;
  const tipo = parsed?.tipo || null;
  const atendeIngles = row?.atendeIngles === true;

  if (!cidade) {
    if (/ITAPO[ÁA]/i.test(nome)) cidade = 'Itapoá';
    else if (/PENHA/i.test(nome)) cidade = 'Penha';
    else if (/PI[CÇ]ARRAS|PICARRAS/i.test(nome)) cidade = 'Piçarras';
    else if (/BARRA\s*VELHA|BARRAVELHA/i.test(nome)) cidade = 'Barra Velha';
  }

  const exigeIngles = publicoExigeIngles(publico) || publicoExigeIngles(nome);
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
    atendeIngles,
    exigeIngles,
    /** Sem estrutura EN + público EN → lead só pode ser Curioso */
    inglesSemEstrutura: !!(exigeIngles && !atendeIngles),
    schema: '[PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]',
    parseFonte: parsed?.canonico ? 'canonico' : (row ? 'alias' : 'parcial'),
    rotulo: partesCurto.length ? partesCurto.join(' · ') : '—',
    rotuloCheio: partesCheio.length ? partesCheio.join(' · ') : '—',
  };
}

export function cidadeDoMapa(nome = '') {
  const id = identidadeCampanha(nome);
  return id.cidade && id.cidade !== '—' ? id.cidade : '—';
}

export function rotuloProdutoCidade(nome = '') {
  return identidadeCampanha(nome).rotulo;
}

export function montaNomeCanonico({
  produto, cidade, construtora, publico, data, tipo,
} = {}) {
  const slot = (v) => `[${String(v || '').trim()}]`;
  const base = [slot(produto), slot(cidade), slot(construtora), slot(publico)];
  if (data || tipo) {
    base.push(slot(data || ''));
    base.push(slot(tipo || ''));
  }
  return base.join('_');
}

/** Slug curto Bruno: AMANAY_ITAPOA_ROGGA_BR-SC */
export function slugMix(produto, cidade, construtora, publico = 'BR-SC') {
  const slug = (s) => String(s || '')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/\s+/g, '')
    .toUpperCase();
  return [slug(produto), slug(cidade), slug(construtora), String(publico || 'BR-SC').toUpperCase()].join('_');
}
