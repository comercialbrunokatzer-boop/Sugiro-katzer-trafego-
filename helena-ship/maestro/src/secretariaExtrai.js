/**
 * EXTRAÇÃO dos campos da conversa (Fase 2 — aprovada pelo Conselheiro 20/07).
 * Lê o texto do CLIENTE (Lei 01: só fala do cliente) e devolve os campos que a
 * Secretária pode preencher no Bitrix. CONSERVADOR: só devolve o que dá pra afirmar
 * com segurança; na dúvida, NÃO devolve (montaFieldsUF depois pula o vazio).
 *
 * Puro/testável. A resolução final pro ID da opção é do montaFieldsUF (camposSecretaria).
 */

// Meses por extenso -> número (só o que cai em 1..6, faixa do campo oficial).
const MESES_TXT = {
  um: 1, dois: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6,
};

/** Acha a resposta de uma pergunta de formulário no formato "pergunta...: resposta". */
function respostaForm(texto, regexPergunta) {
  const m = texto.match(new RegExp(`${regexPergunta}[^:\\n]*:\\s*([^\\n]+)`, 'i'));
  return m ? m[1].trim() : null;
}

/**
 * @param {string} textoCliente  só as falas do cliente (juntadas)
 * @returns {object} { finalidade?, prazoMeses?, produto?, temperatura? } — só o que resolveu
 */
export function extraiCampos(textoCliente = '') {
  const t = String(textoCliente || '');
  const campos = {};

  // FINALIDADE — do formulário ("objetivo com a compra...: Moradia") ou de palavra-chave clara.
  const finForm = respostaForm(t, 'objetivo');
  const finFonte = finForm || t;
  if (/\bmorar|moradia|uso pr[oó]prio\b/i.test(finFonte)) campos.finalidade = 'moradia';
  else if (/\balugar|aluguel|loca[cç][aã]o|renda\b/i.test(finFonte)) campos.finalidade = 'locação';
  else if (/\brevender|revenda|valoriza[cç][aã]o\b/i.test(finFonte)) campos.finalidade = 'revenda';
  // "investimento" sozinho é ambíguo (locação x revenda) -> NÃO define (Lei 01).

  // PRAZO — do formulário ("em quanto tempo...: 3 meses") ou de "em N meses".
  const prazoForm = respostaForm(t, 'em quanto tempo') || t;
  const mNum = prazoForm.match(/\b(\d{1,2})\s*mes(?:es)?\b/i);
  if (mNum) {
    const n = Number(mNum[1]);
    if (n >= 1 && n <= 6) campos.prazoMeses = n;   // >6 (ex.: "mais de 12 meses") -> não preenche
  } else {
    const mTxt = prazoForm.match(/\b(um|dois|tr[eê]s|quatro|cinco|seis)\s*mes(?:es)?\b/i);
    if (mTxt) campos.prazoMeses = MESES_TXT[mTxt[1].toLowerCase()];
  }

  return campos;
}
