// =====================================================================
// HANDOVER — "assumir/devolver" um cliente pelo WhatsApp
// =====================================================================
// Lógica pura (testável) dos comandos do admin para pausar/retomar a
// Helena num cliente específico:
//   /assumir <telefone|ULTIMO>   -> Helena para de responder (modo humano)
//   /devolver <telefone|ULTIMO>  -> Helena volta a responder
//   /voltar   <telefone|ULTIMO>  -> alias de /devolver
//
// O efeito (setar conv.handledByHuman) e o envio via Z-API ficam no
// helena.js. Aqui só a interpretação — 100% coberta por testes.
// =====================================================================

const { normalizePhone } = require("./detectors.js");

// Interpreta a mensagem: retorna { acao, alvoArg }.
//   acao: "assumir" | "devolver" | null
//   alvoArg: o argumento cru (telefone ou "ULTIMO"), sem normalizar
function parseComandoHandover(text) {
  const t = (text || "").trim();
  const m = t.match(/^\/(assumir|devolver|voltar)\b\s*(.*)$/i);
  if (!m) return { acao: null, alvoArg: "" };
  const cmd = m[1].toLowerCase();
  const acao = cmd === "assumir" ? "assumir" : "devolver";
  return { acao, alvoArg: (m[2] || "").trim() };
}

// Resolve o telefone-alvo a partir do argumento.
//   - "ULTIMO" -> usa ultimoAlvo (último cliente que o admin tocou); se vazio,
//                 usa o pedido de ajuda mais recente (pendingHelpEntries).
//   - senão    -> normaliza o telefone digitado.
// pendingHelpEntries: array de [phone, { ts }] (Array.from(PENDING_HELP.entries()))
function resolverAlvo(alvoArg, ultimoAlvo, pendingHelpEntries) {
  const arg = (alvoArg || "").trim();
  if (arg.toUpperCase() === "ULTIMO") {
    if (ultimoAlvo) return normalizePhone(ultimoAlvo);
    const sorted = (pendingHelpEntries || [])
      .slice()
      .sort((a, b) => ((b[1] && b[1].ts) || 0) - ((a[1] && a[1].ts) || 0));
    return sorted.length ? normalizePhone(sorted[0][0]) : "";
  }
  return normalizePhone(arg);
}

// [v7.3] Handover em LINGUAGEM NATURAL (sem barra). O Bruno fala "deixa comigo"
// e a Helena entende como /assumir ULTIMO. Retorna "assumir" | "devolver" | null.
// Só reconhece frases claras de tomada/devolução de linha (evita falso-positivo).
function detectarHandoverNatural(text) {
  // normaliza: minusculo + SEM acento ("não" -> "nao", "silêncio" -> "silencio"),
  // pra reconhecer as duas grafias que o Bruno digita na correria.
  const t = (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (!t) return null;
  // devolver: Helena volta a responder o cliente
  const devolver = [
    "pode voltar", "volta a atender", "volta a falar", "te devolvo", "devolvo pra voce",
    "pode assumir de novo", "assume de novo", "volta pro cliente", "pode continuar",
    "segue voce", "pode responder ele", "pode responder ela", "pode seguir com ele", "ja pode falar"
  ];
  if (devolver.some(g => t.includes(g))) return "devolver";
  // assumir / PARAR: Helena para de responder aquele cliente (modo humano).
  // Inclui as ordens de PARADA que o Bruno usa de verdade ("nao mande mais mensagem",
  // "deixa eu tocar com o cliente") — antes elas caiam no vazio e a Helena continuava.
  const assumir = [
    // tomada de linha ("deixa comigo" e variantes)
    "deixa comigo", "deixa que eu assumo", "deixa que assumo", "eu assumo", "assumo daqui",
    "assumo com ele", "assumo com ela", "pode deixar comigo", "pode deixar que eu", "deixa que eu falo",
    "deixa que eu cuido", "eu cuido daqui", "eu cuido dele", "eu cuido dela", "eu falo com ele",
    "eu falo com ela", "daqui eu assumo", "daqui eu falo", "deixa que daqui",
    "vou assumir", "assumir a conversa", "assumir o cliente", "assumo a conversa", "eu assumo a conversa",
    // "tocar/falar com o cliente" (o Bruno usa "tocar")
    "deixa eu tocar", "vou tocar", "eu vou tocar", "quero tocar", "eu toco com", "deixa eu falar com",
    "vou falar com ele", "vou falar com ela", "eu vou falar com", "deixa eu responder",
    // ORDEM DE PARADA explicita
    "nao mande mais", "nao manda mais", "nao mande nada", "nao manda nada", "nao mande mensagem",
    "nao manda mensagem", "para de mandar", "pare de mandar", "para de falar", "pare de falar",
    "para de responder", "pode parar", "nao fala com ele", "nao fala com ela", "nao responde ele",
    "nao responda ele", "nao responde ela", "nao responda ela", "nao escreve", "nao escreva",
    "fica quieta", "fica quietinha", "silencio", "pausa esse", "para com esse", "nao interage"
  ];
  if (assumir.some(g => t.includes(g))) return "assumir";
  return null;
}

module.exports = { parseComandoHandover, resolverAlvo, detectarHandoverNatural };
