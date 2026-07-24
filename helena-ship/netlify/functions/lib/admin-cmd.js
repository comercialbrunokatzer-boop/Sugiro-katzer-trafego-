// =====================================================================
// ADMIN-CMD — comandos de Bruno/Carol durante uma conversa ao vivo (Problema 2)
// =====================================================================
// Quando Bruno manda uma mensagem natural sobre um cliente ativo,
// a Helena deve interpretar como INSTRUÇÃO ADMINISTRATIVA — nunca
// tratar como mensagem de lead.
//
// Exemplos de instrução:
//   "orienta sobre frente-mar"
//   "manda as fotos de vista pro João"
//   "muda o produto pra Grant Home"
//   "fala de 2 suítes"
//   "responde sobre o lazer"
//
// Lógica pura (testável). O envio e o acesso ao Firebase ficam em helena.js.
// =====================================================================

// ---- Detecção de instrução do Bruno ------------------------------------

// Verbos de orientação que indicam que Bruno está dando uma diretriz.
const VERBOS_INSTRUCAO = [
  "orienta", "orientar", "oriente",
  "fala", "falar", "fale", "diz", "dizer", "diga", "digam",
  "manda", "mandar", "envia", "enviar", "envie",
  "apresenta", "apresentar",
  "mostra", "mostrar", "mostre",
  "explica", "explicar", "explique",
  "comenta", "comentar",
  "responde", "responder", "responda",
  "aborda", "abordar",
  "pergunta", "perguntar",
  "muda", "mudar", "troca", "trocar",
  "avança", "avançar",
  "enfatiza", "enfatizar",
  "destaca", "destacar",
  "usa", "usar",
  "reforca", "reforçar", "reforca", "lembra", "lembrar",
];

// Prefixos que identificam uma mensagem como instrução ao invés de conversa.
// Retorna { instrucao: true, conteudo } ou { instrucao: false }.
function parseInstrucaoBruno(text) {
  if (!text || typeof text !== "string") return { instrucao: false, conteudo: "" };
  const raw = text.trim();
  if (!raw) return { instrucao: false, conteudo: "" };

  // 1) Prefixo explícito: "instrução:", "instrui:", "orienta ela:", "cmd:", "diretriz:"
  const mExplicito = raw.match(
    /^(?:instru[çc][aã]o|instrui|orienta\s+(?:a\s+)?(?:ela|helena)|cmd|diretriz|dir)[:\s]+(.+)/is
  );
  if (mExplicito) {
    return { instrucao: true, conteudo: mExplicito[1].trim() };
  }

  // 1b) Imperativo "diga/diz/fale que…" (caso Bruno guiando alerta — Leandro)
  // Ex.: "Diga que o preço depende do andar. Qual a preferência?"
  // NÃO: "fala do João" / "fala da Maria" (resumo de lead)
  if (
    /^(?:diga|digam|diz|dizer|fale|fala|responde|responda)\b.{4,}/i.test(raw)
    && !/^(?:fala|fale)\s+(?:do|da|de)\s+[a-záàâãéêíóôõúü]/i.test(raw)
  ) {
    return { instrucao: true, conteudo: raw };
  }

  // 1c) "Helena, …" / "Helena:" no começo → sempre instrução ao bot
  const mHelena = raw.match(/^helena[,:\s]+(.+)/is);
  if (mHelena && mHelena[1].trim().length >= 4) {
    return { instrucao: true, conteudo: mHelena[1].trim() };
  }

  // 2) Verbo de instrução no início + contexto claro de tarefa.
  //    Ex.: "manda as fotos de vista pro João", "fala sobre 2 suítes", "orienta sobre o lazer"
  //    "apresenta o empreendimento pro cliente"
  //    NÃO casa "fala do João" / "fala da Maria" (resumo de lead).
  const verbosRx = VERBOS_INSTRUCAO.join("|");
  const mVerbo = raw.match(
    new RegExp(
      `^(${verbosRx})\\b.{0,80}(?:pro\\s+cliente|pra\\s+(?:ele|ela)|ao\\s+lead|ao\\s+cliente|sobre|que)\\b`,
      "i"
    )
  );
  if (mVerbo) {
    return { instrucao: true, conteudo: raw };
  }

  // 3) "manda X" / "envia X" quando X parece ser mídia/produto (sem destinatário explícito
  //    que seja um número de telefone — números caem no /responder normal).
  const mManda = raw.match(
    /^(?:manda|envia|mando|envie)\s+((?:as?\s+)?fotos?|o\s+v[ií]deo|o\s+video|a\s+planta|o\s+lazer|a\s+capa|as?\s+plantas?|as?\s+imagens?)\b/i
  );
  if (mManda) {
    return { instrucao: true, conteudo: raw };
  }

  // 4) "fala sobre X", "explica X" (sem prefixo "pra/pro" — genérico)
  const mFala = raw.match(
    /^(?:fala|explica|comenta|aborda|enfatiza|destaca)\s+(?:sobre\s+)?(.{4,80})\s*$/i
  );
  if (mFala) {
    // Evita casamento com pedidos de resumo de leads (ex.: "fala do João")
    const corpo = mFala[1].trim();
    // "fala do João" / "fala da Maria" = pedido de resumo, não instrução
    const eNome = /^(?:do|da|de)\s+[a-záàâãéêíóôõúüA-ZÁÀÂÃÉÊÍÓÔÕÚÜçÇ]+$/i.test(corpo);
    if (!eNome) {
      return { instrucao: true, conteudo: raw };
    }
  }

  // 5) Guia comercial típico (preço/planta/vista/andar) sem verbo no início
  //    Ex.: "o preço depende do andar — pergunta a preferência"
  if (
    /\b(?:pre[cç]o|planta|vista|andar|su[ií]tes?|m[ií]dia|v[ií]deo|foto)\b/i.test(raw)
    && /\b(?:depende|manda|mostra|pergunta|prefer[eê]ncia|cliente|leandro|helena)\b/i.test(raw)
    && raw.length >= 20
    && raw.length <= 400
  ) {
    return { instrucao: true, conteudo: raw };
  }

  return { instrucao: false, conteudo: "" };
}

/**
 * Bruno manda o TEXTO LITERAL pra Helena enviar ao cliente.
 * Ex.: "Diga ao leandro Helena: Oi Leandro, estou on! … Mande isso"
 * Ex.: "Manda pro João: boa tarde, confirmamos sábado 10h"
 * → { direto:true, nomeAlvo, textoCliente } ou { direto:false }
 */
function parseEnvioDiretoBruno(text) {
  if (!text || typeof text !== "string") return { direto: false };
  const raw = text.trim();
  if (!raw) return { direto: false };

  // "Diga ao leandro Helena: TEXTO" / "Diga pro João: TEXTO"
  let m = raw.match(
    /^(?:diga|diz|fale|fala|manda|envie|envia)\s+(?:ao|pro|pra|para)\s+(?:o\s+|a\s+)?([A-Za-zÀ-ÿ]{2,30})(?:\s+[A-Za-zÀ-ÿ]{2,30})?\s*(?:\s+helena)?\s*[:\-–]\s*([\s\S]+)/i
  );
  // "Helena: diga ao leandro: TEXTO"
  if (!m) {
    m = raw.match(
      /^helena[,:\s]+(?:diga|diz|fale|fala|manda|envie)\s+(?:ao|pro|pra|para)\s+(?:o\s+|a\s+)?([A-Za-zÀ-ÿ]{2,30})\s*[:\-–]\s*([\s\S]+)/i
    );
  }
  // "Mande isso pro Leandro: TEXTO" / "Manda isso ao cliente: TEXTO"
  if (!m) {
    m = raw.match(
      /^(?:mande|manda|envie|envia)\s+isso\s+(?:pro|pra|para|ao)\s+(?:o\s+|a\s+)?([A-Za-zÀ-ÿ]{2,30}|cliente)\s*[:\-–]\s*([\s\S]+)/i
    );
  }
  if (!m) return { direto: false };

  let nomeAlvo = String(m[1] || "").trim();
  let textoCliente = String(m[2] || "").trim();
  // remove "Helena:" acidental no meio do texto
  textoCliente = textoCliente.replace(/^helena\s*[:\-–]\s*/i, "").trim();
  // remove fecho "Mande isso" / "manda isso"
  textoCliente = textoCliente.replace(/\s*(?:mande|manda|envie|envia)\s+isso\.?\s*$/i, "").trim();

  if (nomeAlvo.length < 2 || textoCliente.length < 5) return { direto: false };
  if (/^cliente$/i.test(nomeAlvo)) nomeAlvo = "";

  return { direto: true, nomeAlvo, textoCliente };
}

// ---- Detecção de troca de produto pelo admin via linguagem natural -----

// Mapa de nomes/apelidos → chave do catálogo.
const MAPA_PRODUTO_CHAVE = {
  "fort myers": "fort_myers",
  "fort_myers": "fort_myers",
  "fortmyers": "fort_myers",
  "destin": "destin",
  "grant": "grant_home",
  "grant home": "grant_home",
  "grant home club": "grant_home",
  "al mare": "al_mare",
  "al_mare": "al_mare",
  "almare": "al_mare",
  "celebration": "celebration",
  "ora": "ora",
  "tropicale": "tropicale",
  "amanay": "amanay",
  "jardim da costa": "jardim_da_costa",
  "jardim_da_costa": "jardim_da_costa",
  "personalite": "personalite",
  "infinity": "infinity_exclusive_home",
  "infinity exclusive home": "infinity_exclusive_home",
  "golden beach": "golden_beach",
  "golden_beach": "golden_beach",
  "maritimo": "maritimo",
  "marítimo": "maritimo",
  "zaya": "zaya",
};

// Normaliza texto removendo acentos e colocando em minúsculo.
function _normalizar(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Detecta instrução de troca de produto via linguagem natural:
//   "troca pro Fort Myers", "muda pra Grant Home", "agora é Destin"
// Retorna { trocar: true, chave, produto } ou { trocar: false }.
function parseTrocaProdutoNatural(text) {
  if (!text || typeof text !== "string") return { trocar: false };
  const norm = _normalizar(text);

  // Tenta todos os nomes do mapa na ordem de comprimento (mais longo primeiro,
  // para "fort myers" não ser engolido por "fort" antes).
  const chaves = Object.keys(MAPA_PRODUTO_CHAVE).sort((a, b) => b.length - a.length);

  for (const nome of chaves) {
    const nomeNorm = _normalizar(nome);
    const regexNome = new RegExp(`\\b${nomeNorm.replace(/\s+/g, "\\s+")}\\b`);
    if (!regexNome.test(norm)) continue;

    // Verifica se há um verbo/expressão de troca no mesmo texto
    const temTroca = /\b(?:muda|mudar|troca|trocar|vai\s+ser|vai\s+pro|vai\s+pra|passa\s+pro|passa\s+pra|muda\s+pro|muda\s+pra|troca\s+pro|troca\s+pra|foca\s+no|foca\s+na|vai\s+pro|vai\s+pra|apresenta\s+o|apresenta\s+a)\b/i.test(text) ||
      /agora\s+[ée]/i.test(text);  // "agora é X" (é/e com acento)
    if (temTroca) {
      return {
        trocar: true,
        chave: MAPA_PRODUTO_CHAVE[nome],
        produto: nome.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      };
    }
  }

  return { trocar: false };
}

// ---- Identificação de remetente (admin / michel / desconhecido) ------

// Normaliza telefone: remove não-dígitos e mantém os últimos 11 dígitos.
function _normPhone(p) {
  return (p || "").replace(/\D/g, "").slice(-11);
}

// Determina o papel do remetente com base nos telefones configurados.
// Retorna 'admin' (Bruno ou Carol), 'michel' (observador) ou null.
// Exportado para facilitar testes de integração sem depender de helena.js.
function identificarRemetente(phone, brunoPhone, carolPhone, michelPhone) {
  if (!phone) return null;
  const n = _normPhone(phone);
  if (!n) return null;
  if ((brunoPhone && n === _normPhone(brunoPhone)) ||
      (carolPhone && n === _normPhone(carolPhone))) return "admin";
  if (michelPhone && n === _normPhone(michelPhone)) return "michel";
  return null;
}

module.exports = {
  parseInstrucaoBruno,
  parseEnvioDiretoBruno,
  parseTrocaProdutoNatural,
  MAPA_PRODUTO_CHAVE,
  _normalizar,
  identificarRemetente,
};
