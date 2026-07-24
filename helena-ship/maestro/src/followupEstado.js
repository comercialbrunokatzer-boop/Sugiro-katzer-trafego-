/**
 * Monta o objeto `lead` esperado por proximoFollowup a partir de conversa + card.
 * Puro / testável — usado pelo futuro followup-cron.
 */
import { proximoFollowup, relogioParado } from './followup.js';

/**
 * @param {object} conv conversa Firebase (messages, handledByHuman, …)
 * @param {object} card metadados opcionais (encerrado, opt_out, agendamento_confirmado, fora_da_janela)
 * @param {object} estadoPersisted { niveis_disparados, enviadas_hoje, enviadas_dia }
 */
export function montaLeadFollowup(conv = {}, card = {}, estadoPersisted = {}, agoraMs = Date.now()) {
  const msgs = Array.isArray(conv.messages) ? conv.messages : [];
  let lastClientMsgMs = null;
  let lastHelenaMs = null;
  for (const m of msgs) {
    const ts = Number(m.ts || m.enviadoEmMs || 0) || null;
    if (!ts) continue;
    if (m.role === 'user' || m.role === 'cliente') lastClientMsgMs = ts;
    if (m.role === 'assistant' || m.role === 'helena') lastHelenaMs = ts;
  }
  const ultimo = Math.max(lastHelenaMs || 0, lastClientMsgMs || 0, Number(card.ultimo_contato_ms) || 0) || agoraMs;
  const clienteRespondeu = !!(lastClientMsgMs && (!lastHelenaMs || lastClientMsgMs > lastHelenaMs));
  const diaKey = new Date(agoraMs).toISOString().slice(0, 10);
  const enviadasHoje = (estadoPersisted.enviadas_dia === diaKey)
    ? (Number(estadoPersisted.enviadas_hoje) || 0)
    : 0;

  return {
    ultimo_contato_ms: ultimo,
    niveis_disparados: Array.isArray(estadoPersisted.niveis_disparados) ? estadoPersisted.niveis_disparados : [],
    enviadas_hoje: enviadasHoje,
    encerrado: !!card.encerrado,
    opt_out: !!card.opt_out || !!conv.optOut,
    agendamento_confirmado: !!card.agendamento_confirmado,
    respondido_humano: !!conv.handledByHuman || !!card.respondido_humano,
    cliente_respondeu: clienteRespondeu,
    fora_da_janela: !!card.fora_da_janela,
    followup_pendente: !!card.followup_pendente,
  };
}

/** Decide a próxima ação sem efeitos colaterais. */
export function decideFollowup(conv, card, estadoPersisted, opts = {}) {
  const agoraMs = opts.agoraMs ?? Date.now();
  const lead = montaLeadFollowup(conv, card, estadoPersisted, agoraMs);
  const parado = relogioParado(lead);
  const dec = proximoFollowup(lead, { agoraMs, limiteDiario: opts.limiteDiario ?? 3 });
  return { lead, parado, decisao: dec };
}

export default { montaLeadFollowup, decideFollowup };
