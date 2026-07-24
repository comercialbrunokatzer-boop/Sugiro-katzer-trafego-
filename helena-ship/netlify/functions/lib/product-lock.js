// =====================================================================
// PRODUCT LOCK — trava o empreendimento da conversa (Problema 1 / P0)
// =====================================================================
// Garante que a Helena NUNCA troca de empreendimento sozinha.
// O produto da campanha é a referência oficial da conversa.
//
// Regra: só muda quando
//   1) o cliente pedir EXPLICITAMENTE outro empreendimento;
//   2) Bruno ou Carol alterarem via /produto PHONE chave.
//
// Lógica pura (testável). Firebase e envios ficam em helena.js.
// =====================================================================

// ---- Catálogo de chaves válidas ----------------------------------------

// Chaves canônicas do catálogo oficial. Usadas para validar comandos de admin.
const CHAVES_VALIDAS = new Set([
  "fort_myers", "celebration", "destin", "ora",
  "infinity_exclusive_home", "tropicale", "jardim_da_costa",
  "personalite", "amanay", "grant_home", "golden_beach",
  "maritimo", "zaya", "al_mare",
]);

// Retorna true se a chave existe no catálogo.
function isChaveValida(chave) {
  return !!chave && CHAVES_VALIDAS.has(String(chave).toLowerCase());
}

// Retorna string com todas as chaves válidas ordenadas (para feedback ao admin).
function listarChavesValidas() {
  return [...CHAVES_VALIDAS].sort().join(", ");
}

// ---- Lock/unlock --------------------------------------------------------

// Aplicar ou reforçar o lock no objeto de conversa.
// origem: "campanha" | "admin" | "cliente"
//
// Hierarquia: admin (3) > campanha (2) > cliente (1).
// Admin SEMPRE sobrescreve qualquer lock (inclusive outro lock de admin).
// Campanha e cliente: apenas peso MAIOR substitui (equal weight = first-lock-wins).
function lockProduto(conv, produto, chave, origem) {
  if (!conv || !produto || !chave) return;
  const pesoOrigem = { admin: 3, campanha: 2, cliente: 1 };
  const pesoAtual  = pesoOrigem[(conv.produtoLock || {}).origem] || 0;
  const pesoNovo   = pesoOrigem[origem] || 1;
  // Admin sempre vence — pode sobrescrever qualquer lock, inclusive outro admin.
  // Para origens não-admin: peso igual ou menor não substitui (primeiro lock vence).
  if (conv.produtoLock && origem !== "admin" && pesoAtual >= pesoNovo) return;
  conv.produtoLock = { produto, chave, origem: origem || "campanha", ts: Date.now() };
}

// Substitui o lock diretamente, sem checar hierarquia.
// Usado para trocas atômicas (cliente pediu outro produto; admin forçou troca).
// Garante que a conversa nunca fica em estado intermediário sem lock.
function replaceProductLock(conv, produto, chave, origem) {
  if (!conv || !produto || !chave) return;
  conv.produtoLock = { produto, chave, origem: origem || "cliente", ts: Date.now() };
}

// Retorna o lock atual ou null.
function getProdutoLock(conv) {
  return (conv && conv.produtoLock) ? conv.produtoLock : null;
}

// Remove o lock. Usar apenas quando o produto solicitado não pôde ser identificado.
function clearProductLock(conv) {
  if (conv) conv.produtoLock = null;
}

// ---- Mapa interno nome → chave (para extração de produto da mensagem) ----

// Pares ordenados: mais longo primeiro para evitar match parcial.
const _NOMES_PARA_CHAVE = [
  { rx: /\bfort\s*myers\b/i,                              produto: "Fort Myers",             chave: "fort_myers" },
  { rx: /\bdestin\b/i,                                    produto: "Destin",                 chave: "destin" },
  { rx: /\bgrant(?:\s+home(?:\s+club)?)?\b/i,             produto: "Grant Home",             chave: "grant_home" },
  { rx: /\bcelebration\b/i,                               produto: "Celebration",            chave: "celebration" },
  { rx: /\bal\s*mare\b/i,                                 produto: "Al Mare",                chave: "al_mare" },
  { rx: /\bora\b/i,                                       produto: "Ora",                    chave: "ora" },
  { rx: /\btropicale\b/i,                                 produto: "Tropicale",              chave: "tropicale" },
  { rx: /\bamanay\b/i,                                    produto: "Amanay",                 chave: "amanay" },
  { rx: /\bjardim\s*da\s*costa\b/i,                       produto: "Jardim da Costa",        chave: "jardim_da_costa" },
  { rx: /\bpersonalite\b/i,                               produto: "Personalite",            chave: "personalite" },
  { rx: /\binfinity(?:\s+exclusive(?:\s+home)?)?\b/i,     produto: "Infinity Exclusive Home", chave: "infinity_exclusive_home" },
  { rx: /\bgolden\s*beach\b/i,                            produto: "Golden Beach",           chave: "golden_beach" },
  { rx: /\bmar[ií]timo\b/i,                               produto: "Marítimo",               chave: "maritimo" },
  { rx: /\bzaya\b/i,                                      produto: "Zaya",                   chave: "zaya" },
];

// Extrai o produto nomeado no texto. Retorna { produto, chave } ou null.
function _extrairProdutoDaMsg(text) {
  if (!text) return null;
  for (const entry of _NOMES_PARA_CHAVE) {
    if (entry.rx.test(text)) return { produto: entry.produto, chave: entry.chave };
  }
  return null;
}

// ---- Detecção de pedido explícito de troca pelo CLIENTE ----------------

// Expressões que indicam que o cliente quer VER OUTRO empreendimento.
// Critério: a mensagem aponta pro cliente escolhendo um novo produto,
// não apenas negando o atual. Falsos positivos custam caro (trocamos errado),
// então a lista é conservadora.
const NOMES_PRODUTOS = "fort\\s*myers|destin|grant|celebration|al\\s*mare|ora|tropicale|amanay|jardim\\s*da\\s*costa|personalite|infinity|golden\\s*beach|maritimo|zaya";

const RX_TROCA_CLIENTE = [
  // PT: "quero ver o Fort Myers", "me mostra o Destin", "tenho interesse no Ora"
  new RegExp(
    `\\b(?:quero|gostaria|prefiro|tenho interesse (?:em|no|na)|me (?:mostra|fala|manda)|pode me (?:mostrar|falar|mandar))\\b.{0,60}\\b(?:${NOMES_PRODUTOS})\\b`,
    "i"
  ),
  // PT: "na verdade quero o Destin" / "prefiro o Grant" / "mudei de ideia, quero o Ora"
  new RegExp(
    `\\b(?:na\\s+verdade|prefiro|mudei\\s+de\\s+ideia)\\b.{0,40}\\b(?:${NOMES_PRODUTOS})\\b`,
    "i"
  ),
  // PT: "me fala do Destin"
  new RegExp(
    `\\bme\\s+(?:fala|conta|mostra|manda)\\s+(?:do|sobre\\s+o|sobre)\\s+(?:${NOMES_PRODUTOS})\\b`,
    "i"
  ),
  // PT: "o que é o Grant?" / "como é o Ora?"
  new RegExp(
    `\\b(?:o\\s+que\\s+[ée]|como\\s+[ée]).{0,20}(?:${NOMES_PRODUTOS})\\b`,
    "i"
  ),
  // EN: "I want to see the Fort Myers", "show me the Destin", "I'm interested in the Ora"
  new RegExp(
    `\\b(?:i\\s+(?:want|would\\s+like|need)(?:\\s+to\\s+(?:see|know\\s+about))?|show\\s+me(?:\\s+the)?|tell\\s+me\\s+about(?:\\s+the)?|interested\\s+in(?:\\s+the)?|send\\s+me(?:\\s+the)?)\\b.{0,60}\\b(?:${NOMES_PRODUTOS})\\b`,
    "i"
  ),
  // EN: "I'd prefer the Grant" / "actually I want the Celebration" / "I changed my mind"
  new RegExp(
    `\\b(?:i(?:'d)?\\s+prefer|actually\\s+i\\s+want|i\\s+changed\\s+my\\s+mind)\\b.{0,40}\\b(?:${NOMES_PRODUTOS})\\b`,
    "i"
  ),
  // ES: "quiero ver el Fort Myers", "muéstrame el Destin", "me interesa el Ora"
  new RegExp(
    `\\b(?:quiero\\s+(?:ver|saber(?:\\s+(?:del|sobre))?)|mu[eé]strame(?:\\s+el)?|cu[eé]ntame(?:\\s+(?:del|sobre))?|me\\s+interesa(?:\\s+el)?|estoy\\s+interesado\\s+en(?:\\s+el)?)\\b.{0,60}\\b(?:${NOMES_PRODUTOS})\\b`,
    "i"
  ),
  // ES: "prefiero el Grant" / "en realidad quiero el Celebration"
  new RegExp(
    `\\b(?:prefiero|en\\s+realidad(?:\\s+quiero)?|cambi[eé]\\s+de\\s+(?:idea|opini[oó]n))\\b.{0,40}\\b(?:${NOMES_PRODUTOS})\\b`,
    "i"
  ),
];

// Retorna { pediu: boolean, produto?: string, chave?: string, indeterminado?: boolean }.
// Se pediu=true e produto/chave estiverem presentes, a troca pode ser atômica.
// Se pediu=true mas sem produto (detectou intenção mas não identificou o produto),
// indeterminado=true sinaliza ao caller que deve deixar o modelo interpretar.
function clientePedeProdutoDiferente(text) {
  if (!text || typeof text !== "string") return { pediu: false };
  if (!RX_TROCA_CLIENTE.some(rx => rx.test(text))) return { pediu: false };
  const extraido = _extrairProdutoDaMsg(text);
  if (!extraido) return { pediu: true, indeterminado: true };
  return { pediu: true, produto: extraido.produto, chave: extraido.chave };
}

// ---- Comando de troca do admin via WhatsApp ----------------------------

// Detecta "/produto PHONE chave" ou "/produto ULTIMO chave".
// Retorna { trocar: true, phone, chave } ou { trocar: false }.
function parseComandoProduto(text) {
  if (!text || typeof text !== "string") return { trocar: false };
  const m = text.trim().match(/^\/produto\s+(\S+)\s+([a-z0-9_]+)\s*$/i);
  if (!m) return { trocar: false };
  return { trocar: true, phone: m[1].trim(), chave: m[2].toLowerCase() };
}

// ---- Prompt directive --------------------------------------------------

// Monta o bloco de texto que vai no system prompt da Helena.
// Se não há lock → retorna string vazia (sem impacto).
// Se há lock → injeta diretiva FORTE antes dos blocos de produto.
function buildProductLockPrompt(lock) {
  if (!lock || !lock.produto) return "";
  const nomeDisplay = lock.produto;
  const origem = lock.origem === "campanha"
    ? "campanha — o lead veio deste empreendimento pelo anúncio"
    : lock.origem === "admin"
    ? "admin — o Bruno/Carol definiu manualmente"
    : "cliente — o próprio cliente pediu";
  return (
    `\n🔒 PRODUCT LOCK — EMPREENDIMENTO TRAVADO\n` +
    `=========================================\n` +
    `EMPREENDIMENTO DA CONVERSA: ${nomeDisplay}\n` +
    `Origem do lock: ${origem}.\n\n` +
    `REGRAS DO LOCK:\n` +
    `1. Por padrão você conduz a conversa sobre ${nomeDisplay}.\n` +
    `2. NÃO despeje catálogo de outros empreendimentos sem motivo.\n` +
    `3. EXCEÇÃO — COMPARAÇÃO (cliente pediu outro / orçamento não cabe / "e o X?"):\n` +
    `   ele está COMPARANDO, não desistiu. Pode resumir no máx. 2 opções\n` +
    `   curtas que encaixam e perguntar a preferência (REGRA 6M). Depois\n` +
    `   aprofunda só o escolhido. Não reinicie qualificação.\n` +
    `4. Troca oficial do lock: escolha explícita do cliente OU comando Bruno/Carol.\n` +
    `5. Se faltar info de ${nomeDisplay}, diga que já traz os detalhes e acione\n` +
    `   a equipe — NUNCA invente.\n` +
    `=========================================\n\n`
  );
}

module.exports = {
  CHAVES_VALIDAS,
  isChaveValida,
  listarChavesValidas,
  lockProduto,
  replaceProductLock,
  getProdutoLock,
  clearProductLock,
  clientePedeProdutoDiferente,
  parseComandoProduto,
  buildProductLockPrompt,
};
