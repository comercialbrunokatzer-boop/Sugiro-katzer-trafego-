// =====================================================================
// AUDIÊNCIA — "com quem a Helena pode falar" (allowlist + anti-grupo)
// =====================================================================
// Lógica PURA (testável). NÃO muda comportamento sozinha — só decide.
// A fiação no fluxo do helena.js é separada e só entra com autorização.
//
//   ehMensagemDeGrupo(rawPhone, payload) -> true se for grupo (usa o valor
//     CRU, antes de normalizar — corrige o furo do @g.us que não casava)
//   parseComandoLiberacao(text) -> { acao: "liberar"|"bloquear"|null, alvoArg }
//   podeAtender(phone, allowlist, denylist) -> true só se liberado
// =====================================================================

const { normalizePhone } = require("./detectors.js");

// Detecta mensagem de grupo a partir do valor CRU (antes de normalizar).
// Telefone real BR normalizado tem no máx. ~13 dígitos (55 + DDD + 9).
// IDs de grupo do WhatsApp têm 15+ dígitos e/ou terminam em @g.us.
function ehMensagemDeGrupo(rawPhone, payload = {}) {
  const raw = rawPhone == null ? "" : String(rawPhone);
  if (/@g\.us/i.test(raw)) return true;
  if (payload.isGroup === true || payload.fromGroup === true) return true;
  if (payload.isGroup === "true" || payload.fromGroup === "true") return true;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 15) return true;
  return false;
}

// Interpreta /liberar e /bloquear (com sinônimos).
function parseComandoLiberacao(text) {
  const t = (text || "").trim();
  const m = t.match(/^\/(liberar|autorizar|bloquear|desbloquear|remover)\b\s*(.*)$/i);
  if (!m) return { acao: null, alvoArg: "" };
  const cmd = m[1].toLowerCase();
  const acao = (cmd === "liberar" || cmd === "autorizar") ? "liberar" : "bloquear";
  return { acao, alvoArg: (m[2] || "").trim() };
}

// Decide se a Helena pode atender esse número no privado.
// Modelo allowlist: só atende quem está na allowlist E não está na denylist.
function podeAtender(phone, allowlist = [], denylist = []) {
  const alvo = normalizePhone(phone);
  if (!alvo) return false;
  if ((denylist || []).some(d => normalizePhone(d) === alvo)) return false;
  return (allowlist || []).some(a => normalizePhone(a) === alvo);
}

module.exports = { ehMensagemDeGrupo, parseComandoLiberacao, podeAtender };
