// =====================================================================
// TRAVA DE ORÇAMENTO — extração estruturada, comparação determinística
// =====================================================================
// Módulo puro (sem IO, sem side-effects) para:
//  1. extrairOrcamento(text)          → objeto estruturado
//  2. detectarFlexibilidade(text)     → boolean
//  3. compararOrcamentoProduto(...)   → COMPATIVEL | ACIMA_DA_FAIXA | ...
//  4. formatarContextoOrcamento(...)  → bloco de contexto para o prompt
// =====================================================================

"use strict";

// --- Constantes exportadas ------------------------------------------

/** Tipos de orçamento que o cliente pode declarar */
const TIPOS = {
  VALOR_TOTAL: "valor_total",
  ENTRADA:     "entrada",
  PARCELA:     "parcela",
  RENDA:       "renda",
  INDEFINIDO:  "indefinido"
};

/** Resultados da comparação entre orçamento e preço mínimo do produto */
const RESULTADO = {
  COMPATIVEL:       "COMPATIVEL",
  ACIMA_DA_FAIXA:   "ACIMA_DA_FAIXA",
  INDEFINIDO:       "INDEFINIDO",
  PRECISA_CONDICAO: "PRECISA_CONDICAO"
};

/**
 * Preços mínimos por chave de produto (BRL).
 *
 * FONTE OFICIAL: esta constante é a única fonte estruturada usada para
 * comparação determinística de orçamento. Os valores exibidos no prompt
 * (ex.: "a partir de R$1.074.543") são texto de apoio, não são usados
 * na lógica de comparação — não há duplicação funcional.
 *
 * null = preço não confirmado no catálogo → resultado sempre INDEFINIDO
 *        (nunca retorna COMPATIVEL com preço desconhecido).
 *
 * ⚠️  ATUALIZAR AQUI sempre que a tabela comercial mudar (reajuste CUB,
 *     novo lançamento, encerramento de produto). Sincronizar com equipe
 *     comercial antes de fazer deploy.
 */
const PRECOS_MINIMOS = {
  fort_myers:              1074543,
  tropicale:               498247,
  celebration:             770000,
  jardim_da_costa:         541189,
  ora:                     2094480,
  personalite:             1100449,
  infinity_exclusive_home: 3049266,
  amanay:                  638852,
  destin:                  1120654,
  al_mare:                 null,
  grant_home:              1262278,
  golden_beach:            1440249,
  maritimo:                1986525,
  zaya:                    null
};

// --- Helpers internos -----------------------------------------------

/**
 * Converte uma string de número com escala para número.
 * Exemplos: "800 mil"→800000, "1.5 mi"→1500000, "800.000"→800000, "800k"→800000
 *
 * ATENÇÃO: "mil" (PT/ES para thousand) deve multiplicar por 1.000, NÃO por 1.000.000.
 * Para isso, "mil\b" é testado ANTES de "mi(?:lhão...)" em todas as alternâncias de escala.
 */
function _parseValor(raw) {
  if (!raw || typeof raw !== "string") return null;

  // Remove símbolos de moeda
  let s = raw.replace(/R\$\s*/gi, "")
             .replace(/USD\s*/gi, "")
             .replace(/\$\s*/g, "")
             .trim();

  // Extrai número + escala opcional.
  // Ordem da alternância: mil\b ANTES de mi(...) para evitar que "mil" = milhão.
  // Evita consumir unidades físicas (m², anos, dias, etc.) como escala.
  const SCALE = "(?:bil(?:h[ãa](?:o|[õo]es?)|l?ions?)?|mil\\b|k|thousand|mi(?:l(?:h[ãa](?:o|[õo]es?)|l?ions?))?)";
  const RE = new RegExp(
    `^([\\d][\\d.,\\s]*[\\d]|\\d)\\s*(${SCALE})?(?!\\s*(?:m[²2]|m\\s*quadrado|km|metros?|anos?|dias?|meses|horas?|pessoas?|quartos?|andares?|vagas?|unidades?|litros?|kg))`,
    "i"
  );
  const m = s.match(RE);
  if (!m) return null;

  let numStr = m[1].replace(/\s/g, "");
  const scale = (m[2] || "").toLowerCase();

  // Interpreta o número (detecta se separador é milhar ou decimal)
  let num;
  const dotCount  = (numStr.match(/\./g) || []).length;
  const commaCount = (numStr.match(/,/g) || []).length;

  if (dotCount > 0 && commaCount > 0) {
    // Separadores mistos: PT "1.000,50" ou EN "1,000.50"
    if (numStr.lastIndexOf(",") > numStr.lastIndexOf(".")) {
      num = parseFloat(numStr.replace(/\./g, "").replace(",", "."));
    } else {
      num = parseFloat(numStr.replace(/,/g, ""));
    }
  } else if (commaCount > 0) {
    if (commaCount > 1) {
      // Múltiplas vírgulas: "1,000,000" → milhar EN
      num = parseFloat(numStr.replace(/,/g, ""));
    } else {
      const parts = numStr.split(",");
      // "800,000" (3 casas) = milhar | "1,5" (1-2 casas) = decimal
      num = (parts[1].length === 3)
        ? parseFloat(numStr.replace(",", ""))
        : parseFloat(numStr.replace(",", "."));
    }
  } else if (dotCount > 0) {
    if (dotCount > 1) {
      // Múltiplos pontos: "1.000.000" → milhar PT
      num = parseFloat(numStr.replace(/\./g, ""));
    } else {
      const parts = numStr.split(".");
      // "800.000" (3 casas) = milhar | "1.5" (1-2 casas) = decimal
      num = (parts[1].length === 3)
        ? parseFloat(numStr.replace(".", ""))
        : parseFloat(numStr);
    }
  } else {
    num = parseFloat(numStr);
  }

  if (isNaN(num) || num <= 0) return null;

  // Aplica multiplicador de escala.
  // ATENÇÃO: verificar "mil" (= 1.000) ANTES de "mi..." (= 1.000.000)
  if (/^bi/i.test(scale))                        num *= 1_000_000_000;
  else if (/^mil$|^k$|^thousand$/i.test(scale))  num *= 1_000;
  else if (/^mi/i.test(scale))                   num *= 1_000_000;

  return num;
}

/** Detecta moeda no texto. Padrão: BRL. */
function _moeda(text) {
  if (!text) return "BRL";
  if (/\b(usd|u\.s\.\s*dollar|dollar[s]?|dólar[es]?|dolar[es]?)\b/i.test(text)) return "USD";
  if (/\b(eur|euro[s]?)\b/i.test(text)) return "EUR";
  // "$" sem "R" imediatamente antes → USD (distingue $ de R$)
  if (/(?<![Rr])\$/.test(text)) return "USD";
  return "BRL";
}

/**
 * Tenta extrair um valor monetário de um fragmento de texto.
 * Retorna { valor: number } ou null.
 *
 * Usa a mesma regra de "mil\b antes de mi(...)" para evitar mil=milhão.
 */
function _tentarValor(frag) {
  if (!frag) return null;
  // Captura: moeda? + número + escala?  (mil\b testado ANTES de mi...)
  const SCALE = "(?:bil(?:h[ãa](?:o|[õo]es?)|l?ions?)?|mil\\b|k|thousand|mi(?:l(?:h[ãa](?:o|[õo]es?)|l?ions?))?)";
  const RE = new RegExp(
    `(?:R\\$\\s*|USD\\s*|\\$\\s*)?([\\d][\\d.,\\s]*[\\d]|\\d)\\s*(${SCALE})?(?!\\s*(?:m[²2]|m\\s*quadrado|km|metros?|anos?|dias?|meses|horas?|pessoas?|quartos?|andares?|vagas?|unidades?|litros?|kg))`,
    "i"
  );
  const m = frag.match(RE);
  if (!m) return null;
  const raw = m[1] + (m[2] ? " " + m[2] : "");
  const valor = _parseValor(raw);
  return valor !== null ? { valor } : null;
}

// --- Funções exportadas ---------------------------------------------

/**
 * Detecta sinais explícitos de flexibilidade de orçamento.
 * Só retorna true em sinalização EXPLÍCITA do cliente.
 * Parcelamento sozinho NÃO é flexibilidade (o produto pode ainda estar acima).
 */
function detectarFlexibilidade(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.toLowerCase();
  return (
    /posso\s+esticar/.test(t)                            ||
    /posso\s+chegar\s+(?:a|até|ate)/.test(t)             ||
    /consigo\s+(?:chegar|ir)\s+(?:a|até|ate)/.test(t)   ||
    /depende\s+da\s+condi[çc][ãa]o/.test(t)             ||
    /se\s+parcelar\s+consigo/.test(t)                    ||
    /quero\s+ver\s+(?:esse|isso|este)\s+mesmo\s+assim/.test(t) ||
    /quero\s+ver\s+mesmo\s+assim/.test(t)                ||
    /(?:pode\s+)?ir\s+(?:um\s+pouco\s+)?mais\s+alto/.test(t) ||
    /consigo\s+(?:ampliar|esticar|aumentar)\s+(?:o\s+)?(?:or[çc]amento|budget|faixa)/.test(t) ||
    /i\s+can\s+stretch/.test(t)                          ||
    /i\s+can\s+go\s+(?:up\s+to|higher)/.test(t)         ||
    /flexible\s+(?:on\s+)?(?:the\s+)?(?:budget|price)/.test(t) ||
    /puedo\s+estirar/.test(t)                            ||
    /puedo\s+llegar\s+a/.test(t)                         ||
    /puedo\s+subir\s+(?:el\s+)?(?:presupuesto|budget)/.test(t)
  );
}

/**
 * Extrai orçamento estruturado de uma mensagem do cliente.
 * Prioridade: renda > parcela > entrada > valor_total
 * Retorna null se nenhum orçamento reconhecido.
 *
 * Design: cada tipo usa um padrão de keyword + separador flexível + valor.
 * O separador [^.?!\n\d]{0,25}? aceita "é", "de", "is", ":", " ", etc.
 * A escala usa "mil\b" antes de "mi..." para evitar mil=1.000.000.
 *
 * @param {string} text
 * @returns {{ tipo, valor, moeda, flexivel, origemTexto, atualizadoEm } | null}
 */
function extrairOrcamento(text) {
  if (!text || typeof text !== "string") return null;
  const t = text.trim();

  // Bloco de escala comum: "mil" (1k) ANTES de "mi..." (1M)
  // Usado em todos os padrões abaixo como SCALE no fragmento passado a _tentarValor.
  // _tentarValor / _parseValor já usam o mesmo padrão internamente.

  // Helper local para construir um objeto orçamento
  const orcObj = (tipo, valor, flexivel = false) => ({
    tipo, valor, moeda: _moeda(t), flexivel,
    origemTexto: t.slice(0, 200), atualizadoEm: Date.now()
  });

  // -----------------------------------------------------------------
  // 1. RENDA — salário / ganho / receita mensal
  //    NÃO vira orçamento total. Retorna tipo "renda".
  //    Separador: [^.?!\n\d]{0,25}? para aceitar "é", "is", "de", ":"
  // -----------------------------------------------------------------
  const rendaKW = /\b(?:ganho|minha\s+renda|renda\s+(?:mensal)?|sal[aá]rio|faturamento|receita\s+(?:mensal)?|income|my\s+income|ingreso(?:s)?|mis\s+ingresos)\b/i;
  const rendaM = t.match(rendaKW);
  if (rendaM) {
    const pos = rendaM.index + rendaM[0].length;
    const frag = t.slice(pos, pos + 60);
    const r = _tentarValor(frag);
    if (r) return orcObj(TIPOS.RENDA, r.valor);
  }

  // -----------------------------------------------------------------
  // 2. PARCELA — valor por mês / mensalidade
  // -----------------------------------------------------------------
  // Forma A: número + escala (capturada) + unidade de tempo
  const parcelaRE_A = /\b(?:R\$\s*|USD\s*|(?<![Rr])\$\s*)?([\d][\d.,]*\d|\d)\s*(mil\b|k\b)?\s*(?:por\s+m[eê]s|\/\s*m[eê]s|mensais\b|mensalmente\b|ao\s+m[eê]s\b|por\s+mes\b|per\s+month\b|a\s+month\b|al\s+mes\b|mensuales\b)/i;
  // Forma B: keyword parcela/mensalidade + separador + valor
  const parcelaRE_B = /\b(?:parcela|mensalidade|payment|cuota)\b[^.?!\n\d]{0,25}?(?:R\$\s*|USD\s*|(?<![Rr])\$\s*)?([\d][\d.,]*\d|\d)\s*(mil\b|k\b|mi(?:l(?:h[ãa](?:o|[õo]es?)|l?ions?))?)?/i;
  const parcelaM = t.match(parcelaRE_A);
  if (parcelaM) {
    // group 1 = number, group 2 = scale (mil or k) — both captured
    const frag = parcelaM[1] + (parcelaM[2] ? " " + parcelaM[2] : "");
    const r = _tentarValor(frag);
    if (r) return orcObj(TIPOS.PARCELA, r.valor);
  }
  const parcelaM2 = t.match(parcelaRE_B);
  if (parcelaM2) {
    const frag = parcelaM2[1] + (parcelaM2[2] ? " " + parcelaM2[2] : "");
    const r = _tentarValor(frag);
    if (r) return orcObj(TIPOS.PARCELA, r.valor);
  }

  // -----------------------------------------------------------------
  // 3. ENTRADA — down payment / sinal / enganche
  // -----------------------------------------------------------------
  // Forma A: valor + preposição opcional + keyword de entrada
  const entradaRE_A = /\b(?:R\$\s*|USD\s*|(?<![Rr])\$\s*)?([\d][\d.,]*\d|\d)\s*(mil\b|k\b|mi(?:l(?:h[ãa](?:o|[õo]es?)|l?ions?))?)?\s*(?:de\s+entrada\b|como\s+entrada\b|de\s+sinal\b|(?:de|as|for|a|como)?\s+down\s+payment\b|de\s+enganche\b|down\s+payment\b)/i;
  // Forma B: "entrada de..." / "down payment of..."
  const entradaRE_B = /\b(?:entrada|down\s+payment|enganche|sinal)\b[^.?!\n\d]{0,25}?(?:R\$\s*|USD\s*|(?<![Rr])\$\s*)?([\d][\d.,]*\d|\d)\s*(mil\b|k\b|mi(?:l(?:h[ãa](?:o|[õo]es?)|l?ions?))?)?/i;
  const entradaM = t.match(entradaRE_A);
  if (entradaM) {
    const frag = entradaM[1] + (entradaM[2] ? " " + entradaM[2] : "");
    const r = _tentarValor(frag);
    if (r) return orcObj(TIPOS.ENTRADA, r.valor);
  }
  const entradaM2 = t.match(entradaRE_B);
  if (entradaM2) {
    const frag = entradaM2[1] + (entradaM2[2] ? " " + entradaM2[2] : "");
    const r = _tentarValor(frag);
    if (r) return orcObj(TIPOS.ENTRADA, r.valor);
  }

  // -----------------------------------------------------------------
  // 4. VALOR TOTAL — orçamento máximo declarado
  //    Requer sinal de intenção explícito (evita falsos positivos).
  //    Sem \b no final para suportar keywords com acentos (ex.: "até")
  //    onde \b falha por "é" não ser char ASCII de palavra.
  // -----------------------------------------------------------------
  const totalKW = /\b(?:até|ate|orçamento|orcamento|budget|meu\s+(?:limite|teto|m[aá]ximo)|posso\s+(?:gastar|investir|pagar|chegar\s+a|ir\s+(?:at[eé]|a))|up\s+to|hasta|no\s+m[aá]ximo|faixa(?:\s+(?:[eé]|de|at[eé]))?|valor\s+(?:m[aá]ximo|de\s+at[eé])|my\s+budget|presupuesto|mi\s+presupuesto|tenho\s+(?:disponível|disponivel|para\s+(?:investir|gastar)))(?=\W|$)/i;
  const totalKWM = t.match(totalKW);
  if (totalKWM) {
    const pos = totalKWM.index + totalKWM[0].length;
    const frag = t.slice(pos, pos + 60);
    const r = _tentarValor(frag);
    if (r) return orcObj(TIPOS.VALOR_TOTAL, r.valor, detectarFlexibilidade(t));
  }

  // -----------------------------------------------------------------
  // 5. Valor com moeda explícita, sem outro contexto → assume total
  //    Ex.: "R$ 800.000" ou "USD 500k" isolados
  // -----------------------------------------------------------------
  const currencyRE = /\b(?:R\$|USD|(?<![Rr])\$)\s*([\d][\d.,]*\d|\d)\s*(mil\b|k\b|mi(?:l(?:h[ãa](?:o|[õo]es?)|l?ions?))?|bi(?:l(?:h[ãa](?:o|[õo]es?)|l?ions?))?)?/i;
  const currencyM = t.match(currencyRE);
  if (currencyM) {
    const frag = currencyM[1] + (currencyM[2] ? " " + currencyM[2] : "");
    const r = _tentarValor(frag);
    if (r) return orcObj(TIPOS.VALOR_TOTAL, r.valor);
  }

  return null;
}

/**
 * Compara orçamento estruturado com preço mínimo de um produto.
 *
 * @param {object|null} orcamento - resultado de extrairOrcamento()
 * @param {number|null} precoMin  - preço mínimo do produto em BRL (null = desconhecido)
 * @returns {"COMPATIVEL"|"ACIMA_DA_FAIXA"|"INDEFINIDO"|"PRECISA_CONDICAO"}
 */
function compararOrcamentoProduto(orcamento, precoMin) {
  if (!orcamento || orcamento.tipo === TIPOS.INDEFINIDO) return RESULTADO.INDEFINIDO;
  if (precoMin === null || precoMin === undefined) return RESULTADO.INDEFINIDO;

  if (orcamento.tipo === TIPOS.VALOR_TOTAL) {
    if (orcamento.valor >= precoMin) return RESULTADO.COMPATIVEL;
    // Abaixo da faixa: se cliente declarou flexibilidade, reabre negociação
    return orcamento.flexivel ? RESULTADO.PRECISA_CONDICAO : RESULTADO.ACIMA_DA_FAIXA;
  }

  // Parcela, entrada ou renda: não há como comparar diretamente com preço total
  return RESULTADO.PRECISA_CONDICAO;
}

/**
 * Formata bloco de contexto de orçamento para injeção no system prompt.
 * Retorna string vazia se não houver orçamento detectado.
 *
 * @param {object|null}  orcamento   - resultado de extrairOrcamento()
 * @param {string|null}  produtoKey  - chave do produto travado (ex.: "fort_myers")
 * @param {number|null}  precoMin    - preço mínimo do produto em BRL (null = desconhecido)
 * @returns {string}
 */
function formatarContextoOrcamento(orcamento, produtoKey, precoMin) {
  if (!orcamento) return "";

  const resultado = compararOrcamentoProduto(orcamento, precoMin);
  const moedaFmt = orcamento.moeda || "BRL";
  const valorFmt = orcamento.valor
    ? `${moedaFmt} ${orcamento.valor.toLocaleString("pt-BR")}`
    : "?";

  const lines = [
    "=== TRAVA DE ORÇAMENTO (ATIVO) ===",
    `Tipo declarado: ${orcamento.tipo}`,
    `Valor: ${valorFmt}`,
    `Flexibilidade explícita: ${orcamento.flexivel ? "Sim" : "Não"}`,
    `Texto original: "${(orcamento.origemTexto || "").slice(0, 120)}"`,
  ];

  if (produtoKey) {
    const precoFmt = (precoMin !== null && precoMin !== undefined)
      ? `BRL ${precoMin.toLocaleString("pt-BR")}`
      : "desconhecido (pede validação humana)";
    lines.push(`Produto travado: ${produtoKey} | Preço mínimo: ${precoFmt}`);
    lines.push(`Compatibilidade: ${resultado}`);
  }

  lines.push("");

  switch (resultado) {
    case RESULTADO.ACIMA_DA_FAIXA:
      lines.push("INSTRUÇÕES OBRIGATÓRIAS — produto ACIMA da faixa (COMPARAR ≠ DESISTIR):");
      lines.push("- Acolha curto: a faixa dele é válida; ele está comparando, não 'desistiu'");
      lines.push("- NÃO reaqueça o produto acima da faixa como se coubesse");
      lines.push("- NÃO despeje catálogo; NÃO reinicie qualificação; NÃO repita perguntas já respondidas");
      lines.push("- Ofereça NO MÁXIMO 2 opções que cabem na faixa, RESUMIDAS (1 linha cada: mar + ticket + pagamento se for o gancho)");
      lines.push("- Ex. ~R$800k: Jardim da Costa (~500-600m do mar, ticket menor, pagamento mais fácil) vs Celebration (quadra mar/~150m, a partir de ~R$770-850k)");
      lines.push("- ANTES de aprofundar: 1 pergunta de preferência (mais perto da praia vs facilidade/ticket)");
      lines.push("- Só aprofunda 1 produto (+ no máx. 1 mídia) DEPOIS que ele escolher");
      lines.push("- Troca de Product Lock só com escolha explícita do cliente ou comando Bruno/Carol");
      lines.push("- Parcelamento sozinho NÃO libera produto acima da faixa");
      lines.push("- Mensagem ENXUTA (REGRA 6L): 1-2 balões curtos, sem monólogo");
      break;
    case RESULTADO.PRECISA_CONDICAO:
      lines.push(`NOTA: orçamento declarado como "${orcamento.tipo}" (não é valor total ou flexível).`);
      lines.push("Não afirme compatibilidade sem dados confiáveis.");
      lines.push("Se relevante, solicite validação humana antes de confirmar encaixe.");
      break;
    case RESULTADO.INDEFINIDO:
      lines.push("NOTA: preço do produto desconhecido ou orçamento indefinido.");
      lines.push("Não afirme compatibilidade. Solicite validação humana se necessário.");
      break;
    default:
      // COMPATIVEL — sem instrução especial
      break;
  }

  lines.push("===================================");

  return lines.join("\n");
}

/**
 * Resolve a chave canônica do produto para a comparação de orçamento.
 *
 * Hierarquia (Product Lock é a fonte oficial):
 *   1. lockChave    — conv.produtoLock?.chave (definido pelo Product Lock)
 *   2. fallbackChave — PRODUTO_PARA_CHAVE_MIDIA[leadData.produto] (origem do anúncio)
 *
 * Se nenhum dos dois estiver disponível, retorna null e a comparação
 * retorna INDEFINIDO — nunca inventa produto nem afirma compatibilidade.
 *
 * @param {string|null} lockChave     - chave do Product Lock (fonte oficial)
 * @param {string|null} fallbackChave - chave derivada de leadData.produto (fallback)
 * @returns {string|null}
 */
function resolverChaveProduto(lockChave, fallbackChave) {
  return lockChave || fallbackChave || null;
}

module.exports = {
  TIPOS,
  RESULTADO,
  PRECOS_MINIMOS,
  extrairOrcamento,
  detectarFlexibilidade,
  compararOrcamentoProduto,
  formatarContextoOrcamento,
  resolverChaveProduto
};
