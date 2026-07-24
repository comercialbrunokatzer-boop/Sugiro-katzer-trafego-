// Alerta quente filtrado (Bruno): NÃO avisar a cada conversa morna.
// Avisa só quando o lead parece QUENTE DE VERDADE.
//
// Sinais (qualquer um basta, além de quente/VIP/reunião):
//  - várias perguntas do cliente (≥3 user msgs com "?") OU ≥4 msgs user engajadas
//  - pediu pra ligar / me liga / call
//  - ligou pra Helena (sinal via texto/histórico ou flag)
//  - temperatura LLM = "quente"
//  - quer_reuniao / reuniao_adiada / VIP / urgent
//
// "morno" SOZINHO NÃO dispara alerta (Helena cuida; Bruno não é spamado).

const RE_PEDIU_LIGAR = /\b(me\s*liga|me\s*ligar|liga\s*pra\s*mim|pode\s*(me\s*)?ligar|quero\s*(que\s*)?(voc[eê]s?\s*)?lig(ue|ar)|call\s*me|give\s*me\s*a\s*call|telefone\s*pra\s*mim|me\s*telefona)\b/i;
const RE_LIGOU = /\b(liguei|te\s*ligar|acabei\s*de\s*(te\s*)?ligar|te\s*liguei|estou\s*ligando|to\s*ligando|chamei\s*(no\s*)?telefone|i\s*called|just\s*called)\b/i;
const RE_PERGUNTA = /\?|quanto\s*(custa|e|é)|qual\s+(o|a|valor|preco|preço|entrada)|tem\s+(planta|foto|video|vídeo)|como\s+funciona|aceita|parcela/i;

/**
 * Conta perguntas / engajamento do cliente no histórico.
 * @param {Array<{role:string, content?:string}>} messages
 */
function sinaisConversa(messages = []) {
  const userMsgs = (messages || []).filter((m) => m && m.role === "user");
  const textos = userMsgs.map((m) => String(m.content || ""));
  const comPergunta = textos.filter((t) => RE_PERGUNTA.test(t) || /\?/.test(t)).length;
  const pediuLigar = textos.some((t) => RE_PEDIU_LIGAR.test(t));
  const ligou = textos.some((t) => RE_LIGOU.test(t));
  return {
    qtdUser: userMsgs.length,
    qtdPerguntas: comPergunta,
    pediuLigar,
    ligou,
    bastantePergunta: comPergunta >= 3 || userMsgs.length >= 4,
  };
}

/**
 * Deve alertar Bruno/Carol/Michel?
 * @returns {{ alertar: boolean, motivo: string, sinais: object }}
 */
function deveAlertarLeadQuente({
  temperatura = "frio",
  querReuniao = false,
  reuniaoAdiada = false,
  isVip = false,
  isUrgent = false,
  messages = [],
  ehPrimeiraMsg = false,
  ligouFlag = false, // se o canal marcar chamada recebida
} = {}) {
  if (ehPrimeiraMsg) {
    return { alertar: false, motivo: "primeira_msg", sinais: sinaisConversa(messages) };
  }

  const sinais = sinaisConversa(messages);
  if (ligouFlag) sinais.ligou = true;

  if (isVip || isUrgent) {
    return { alertar: true, motivo: isVip ? "vip" : "urgente", sinais };
  }
  if (querReuniao) {
    return { alertar: true, motivo: "quer_reuniao", sinais };
  }
  if (reuniaoAdiada) {
    return { alertar: true, motivo: "reuniao_adiada", sinais };
  }
  if (temperatura === "quente") {
    return { alertar: true, motivo: "temperatura_quente", sinais };
  }

  // Sinais duros mesmo em morno/frio classificado errado:
  if (sinais.pediuLigar) {
    return { alertar: true, motivo: "pediu_ligar", sinais };
  }
  if (sinais.ligou) {
    return { alertar: true, motivo: "ligou_helena", sinais };
  }
  if (sinais.bastantePergunta && (temperatura === "morno" || temperatura === "quente")) {
    return { alertar: true, motivo: "bastante_pergunta", sinais };
  }

  // morno sozinho = NÃO alerta
  if (temperatura === "morno") {
    return { alertar: false, motivo: "morno_sem_sinal_quente", sinais };
  }

  return { alertar: false, motivo: "frio_ou_sem_sinal", sinais };
}

/** Motivo legível pro WhatsApp do Bruno. */
function rotuloMotivoAlerta(motivo) {
  const map = {
    vip: "💎 VIP / ticket alto",
    urgente: "⏱️ Urgência explícita",
    quer_reuniao: "🟢 Pediu / aceitou marcar bate-papo",
    reuniao_adiada: "🟡 Tentou marcar, cliente adiou",
    temperatura_quente: "🔥 Interesse intenso (quente)",
    pediu_ligar: "📞 Pediu pra ligar",
    ligou_helena: "📞 Ligou pra Helena",
    bastante_pergunta: "❓ Fez bastante pergunta (engajado)",
  };
  return map[motivo] || motivo;
}

module.exports = {
  deveAlertarLeadQuente,
  sinaisConversa,
  rotuloMotivoAlerta,
  RE_PEDIU_LIGAR,
  RE_LIGOU,
};
