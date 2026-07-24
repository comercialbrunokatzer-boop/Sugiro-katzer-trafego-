/**
 * Campos do Bitrix que a Secretária preenche — IDs REAIS confirmados pelo raio-x do
 * webhook de leitura (funil "FUNIL NOVO KATZER"), 19/07.
 * Lei 01: campo/opção sem valor confirmado NÃO é enviado (vazio > errado).
 *
 * ✅ FAIXA DE PREÇO e FINALIDADE: definidos pelo Michel/Auditor (20/07) — dos 4 campos
 * duplicados de cada, o OFICIAL é o mais preenchido na base:
 *   FAIXA_PRECO = UF_CRM_1760387036 (339 cards — os outros 3 são lixo/legado).
 *   FINALIDADE  = UF_CRM_1753709401 (a que o Maestro já usa; a UF_CRM_1762178029
 *   roda em paralelo e será consolidada nela depois — fora do escopo da Secretária).
 */

// Campos CONFIRMADOS (únicos, sem ambiguidade no raio-x).
export const CAMPO = {
  PRODUTO:         'UF_CRM_1752266661',    // Empreendimento de interesse (lista)
  TEMPERATURA:     'UF_CRM_1753709436',    // Frio / Morno / Quente (casa com a Helena)
  CIDADE:          'UF_CRM_1755626500',    // Cidade de interesse (lista)
  PERFIL_IMOVEL:   'UF_CRM_1762177946',    // Pé na areia / Quadra mar / Plantas menores
  MOMENTO_OBRA:    'UF_CRM_1762177991',    // Pré-lançamento / Em construção / Pronto
  PRAZO_COMPRA:    'UF_CRM_1762351888826', // Em até 1..6 meses
  NUM_COMPRADORES: 'UF_CRM_1755648115621', // 1..4 compradores
  RESUMO_CARTEIRA: 'UF_CRM_1762177343263', // texto do resumo (comentário status carteira)
  FAIXA_PRECO:     'UF_CRM_1760387036',    // ✅ oficial (Michel 20/07): Até 500k .. Acima de 1.5mi
  FINALIDADE:      'UF_CRM_1753709401',    // ✅ oficial (Michel 20/07): Moradia / Locação / Revenda
};

// Opções REAIS (texto normalizado -> ID) por campo de LISTA. Fonte: raio-x do Bitrix.
export const OPCOES = {
  PRODUTO: {
    'grant vista': '45', 'celebration': '47', 'punta cana': '49', 'massimo': '51',
    'rua camarão': '53', 'al mare': '383', 'alicerce': '385', 'amanay': '473',
    'legacy': '475', 'grant home club': '497', 'personalite': '689',
    'golden beach': '691', 'jardim do grant': '731', 'fort myers': '767', 'tropicale': '733',
  },
  TEMPERATURA: { 'frio': '85', 'morno': '87', 'quente': '89' },
  CIDADE: {
    'joinville': '265', 'blumenau': '267', 'jaraguá': '269', 'curitiba': '271',
    'são paulo': '273', 'londrina': '275', 'rio do sul': '277',
    'balneário piçarras': '279', 'piçarras': '279', 'barra velha': '281',
    'penha': '283', 'outras': '285',
  },
  PERFIL_IMOVEL: { 'pé na areia': '529', 'quadra mar': '531', 'plantas menores': '533' },
  MOMENTO_OBRA: {
    'pré-lançamento': '535', 'pre-lancamento': '535', 'em construção': '537',
    'meio da obra': '537', 'pronto': '539', 'próximo da entrega': '539',
  },
  NUM_COMPRADORES: { '1': '321', '2': '323', '3': '325', '4': '327' },
  // Prazo de compra: 1..6 meses (+ "não acredito que compre em 6 meses" = 637)
  PRAZO_COMPRA: { '1': '625', '2': '627', '3': '629', '4': '631', '5': '633', '6': '635' },
  // Finalidade (oficial UF_CRM_1753709401): Moradia / Locação / Revenda.
  FINALIDADE: {
    'moradia': '79', 'morar': '79', 'moradia própria': '79', 'uso próprio': '79',
    'locação': '81', 'locacao': '81', 'alugar': '81', 'aluguel': '81', 'renda': '81',
    // "investimento" sozinho é ambíguo (locação x revenda) -> NÃO mapeia (Lei 01).
    'revenda': '83', 'revender': '83', 'valorização': '83', 'valorizacao': '83',
  },
  // Faixa de preço (oficial UF_CRM_1760387036) — texto -> ID (usado pelo opcaoDe;
  // o casamento por VALOR do orçamento é feito por faixaPrecoOpcao()).
  FAIXA_PRECO: {
    'até 500k': '477', 'de 500k até 750k': '479', 'de 750k até 1mi': '481',
    'de 1mi até 1.5mi': '483', 'acima de 1.5mi': '485',
  },
};

// Faixas de preço por VALOR do orçamento (teto de cada faixa; a última é aberta).
// Fonte: opções reais do campo oficial UF_CRM_1760387036 (raio-x 19/07).
const FAIXA_PRECO_BANDAS = [
  { ate: 500000, id: '477' },   // Até 500k
  { ate: 750000, id: '479' },   // De 500k até 750k
  { ate: 1000000, id: '481' },  // De 750k até 1mi
  { ate: 1500000, id: '483' },  // De 1mi até 1.5mi
  { ate: Infinity, id: '485' }, // Acima de 1.5mi
];

/** normaliza texto pra casar opção. */
function norm(s) { return String(s || '').trim().toLowerCase(); }

/**
 * Resolve o ID da opção de um campo de lista a partir de um texto do cliente.
 * Casa exato e por "contém". Retorna null se não bater (Lei 01: não chuta).
 */
export function opcaoDe(campo, texto) {
  const mapa = OPCOES[campo];
  if (!mapa) return null;
  const t = norm(texto);
  if (!t) return null;
  if (mapa[t]) return mapa[t];
  for (const [k, id] of Object.entries(mapa)) {
    if (k.length >= 3 && t.includes(k)) return id;
  }
  return null;
}

/** Prazo de compra em meses (1..6) -> opção. null fora da faixa. */
export function prazoOpcao(meses) {
  const m = Number(meses);
  if (Number.isInteger(m) && m >= 1 && m <= 6) return OPCOES.PRAZO_COMPRA[String(m)];
  return null;
}

/**
 * Faixa de preço (campo oficial UF_CRM_1760387036). Resolve por VALOR do orçamento
 * (número em reais) OU por texto de faixa. Retorna o ID da opção, ou null se não der
 * pra decidir (Lei 01: vazio > errado).
 * @param {number|string} valor  orçamento em R$ (ex.: 680000) OU texto ("de 500k até 750k")
 */
export function faixaPrecoOpcao(valor) {
  const num = typeof valor === 'number' ? valor : Number(String(valor ?? '').replace(/[^\d]/g, ''));
  if (Number.isFinite(num) && num > 0) {
    const banda = FAIXA_PRECO_BANDAS.find((b) => num <= b.ate);
    return banda ? banda.id : null;
  }
  // não é número -> tenta casar como texto de faixa
  return opcaoDe('FAIXA_PRECO', valor);
}

/** Finalidade (campo oficial UF_CRM_1753709401): Moradia / Locação / Revenda. */
export function finalidadeOpcao(texto) {
  return opcaoDe('FINALIDADE', texto);
}
