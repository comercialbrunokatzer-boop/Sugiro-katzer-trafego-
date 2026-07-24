// =====================================================
// SANITIZE — COMPLIANCE DE MARCA (extraído de helena.js)
// =====================================================
// Funções puras responsáveis por:
//  1) sanitizeHelenaResponse: bloquear menções soltas a "Carol"/"Bruno"
//     (sem papel autorizado) e remover placeholders crus tipo [nome].
//  2) sanitizeSenderName: validar/limpar o nome vindo do webhook Z-API.
//
// Extraído para módulo próprio para permitir cobertura de testes
// (helena.js não é importável em teste: lê env vars no load).
// COMPORTAMENTO IDÊNTICO ao que estava inline no helena.js.
// =====================================================

function sanitizeHelenaResponse(text) {
  if (!text || typeof text !== "string") return text;
  let out = text;

  // 1. Remove placeholders crus que escaparam do prompt
  out = out.replace(/\[nome\]/gi, "");
  out = out.replace(/\[primeiro_nome\]/gi, "");
  out = out.replace(/\[Nome\]/g, "");

  // 2. Carol/Bruno: aceita se nos 30 chars antes vier papel autorizado
  // Papeis: diretora, diretor, gestora, gestor, especialista, consultora, consultor
  // (com optional "comercial", "de vendas", "imobiliaria")
  const PAPEL = "(diretora|diretor|gestora|gestor|especialista|consultora|consultor)(\\s+(comercial|de\\s+vendas|imobili[áa]ria))?";
  const ROLE_REGEX = new RegExp(`(?:${PAPEL})[\\s,.:;-]{0,30}$`, "i");

  // Substitui menções soltas a "Carol" / "Caroline" / "Bruno" / "Bruno Katzer"
  const NOMES = [
    /\b(Caroline|Carol)\b/g,
    /\b(Bruno\s+Katzer|Bruno)\b/g
  ];

  for (const re of NOMES) {
    out = out.replace(re, (match, _g1, offset, full) => {
      const before = full.slice(Math.max(0, offset - 30), offset);
      if (ROLE_REGEX.test(before)) {
        // Tem papel autorizado antes -> remove o nome (deixa só o papel)
        return "";
      }
      // Sem papel -> substitui por neutro
      return "a equipe comercial";
    });
  }

  // 3. Polish: limpar artefatos da substituição
  out = out.replace(/\ba\s+a\s+equipe\b/gi, "a equipe");
  out = out.replace(/\bda\s+a\s+equipe\b/gi, "da equipe");
  out = out.replace(/\bcom\s+a\s+a\s+equipe\b/gi, "com a equipe");
  out = out.replace(/\bpra\s+a\s+equipe\b/gi, "pra equipe");
  out = out.replace(/\bpara\s+a\s+equipe\b/gi, "para a equipe");

  // Remove espacos duplicados que sobraram
  out = out.replace(/[ \t]{2,}/g, " ");
  // Remove vírgulas órfãs ", ," ou ", ."
  out = out.replace(/,\s*,/g, ",");
  out = out.replace(/,\s*\./g, ".");
  // Remove espacos antes de pontuacao (ex: "diretor ." -> "diretor.")
  out = out.replace(/\s+([.,;:!?])/g, "$1");
  // Trim em cada linha
  out = out.split("\n").map(l => l.trimEnd()).join("\n");

  return out;
}

// =====================================================
// CAPTURA E VALIDA NOME DO REMETENTE (v5.4.7 patch 3)
// =====================================================
// Filtro 4 camadas pra senderName/pushName do webhook Z-API
// Bloqueia: simbolos, vulgares, gamer, emoji-only, corporativo, muito curto
const SENDER_NAME_BLACKLIST = [
  // Termos corporativos
  "katzer", "assessoria", "imobili", "construtora", "ltda", "s.a.", "sa ",
  "grupo", "empresa", "corporativ", "atendimento", "comercial",
  // Termos vulgares/zoeira
  "bumbum", "guloso", "gostos", "delicia", "safad",
  // Tipico nick gamer
  "snipe", "killer", "hunter", "xxgam"
];

// Blacklist de "nomes" curtos típicos de zoeira/risadas (match exato, case-insensitive)
const SENDER_NAME_GIBBERISH_EXACT = new Set([
  "lol", "lul", "kkk", "rsrs", "huehue", "asdf", "qwer", "test", "teste",
  "abc", "abcd", "xyz", "xpto", "fulano", "ciclano", "beltrano", "anônimo", "anonimo"
]);

function sanitizeSenderName(rawName) {
  if (!rawName || typeof rawName !== "string") return null;
  const name = rawName.trim();

  // Camada 1: tamanho
  if (name.length < 2 || name.length > 60) return null;

  // Camada 2: % de letras alfabéticas (mínimo 70%)
  const letters = (name.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  const ratio = letters / name.length;
  if (ratio < 0.70) return null;

  // Camada 3: blacklist (case-insensitive)
  const lower = name.toLowerCase();
  for (const bad of SENDER_NAME_BLACKLIST) {
    if (lower.includes(bad)) return null;
  }

  // Camada 4: heurística - bloqueia nick com sufixo numérico longo (gamer/zoeira)
  if (/\d{2,}/.test(name)) return null;

  // Sanidade primeiro nome: pega só primeiro token
  const firstName = name.split(/\s+/)[0];
  if (firstName.length < 2) return null;

  // Camada 5: bloqueia nick "gibberish" exato (lol, kkk, teste, etc)
  if (SENDER_NAME_GIBBERISH_EXACT.has(firstName.toLowerCase())) return null;

  // Capitaliza primeiro nome
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

module.exports = {
  sanitizeHelenaResponse,
  sanitizeSenderName,
  SENDER_NAME_BLACKLIST,
  SENDER_NAME_GIBBERISH_EXACT
};
