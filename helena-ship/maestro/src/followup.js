/**
 * FOLLOW-UP AUTOMÁTICO (KOS-002 §B / P1.A5).
 * Sem atendimento: 30min → Helena reengaja · 2h → Michel · 4h → Bruno.
 * Puro e testável: recebe o estado do lead + agora, devolve a PRÓXIMA escalada (ou nenhuma).
 *
 * O relógio PARA quando: humano assumiu, cliente respondeu, encerrado, agendamento confirmado,
 * opt-out, fora da janela, ou já existe ação equivalente pendente. (nunca cutuca à toa)
 */
export const ESCALADA = [
  { nivel: 1, apos_min: 30, para: 'HELENA', acao: 'Reengajar o lead' },
  { nivel: 2, apos_min: 120, para: 'MICHEL', acao: 'Alertar o Michel' },
  { nivel: 3, apos_min: 240, para: 'BRUNO', acao: 'Alertar o Bruno' },
];

/** Motivo pra o relógio estar parado (ou null se está correndo). */
export function relogioParado(lead = {}) {
  if (lead.encerrado) return 'lead encerrado';
  if (lead.opt_out) return 'cliente pediu para não receber contato';
  if (lead.agendamento_confirmado) return 'agendamento confirmado';
  if (lead.respondido_humano) return 'um humano já assumiu';
  if (lead.cliente_respondeu) return 'cliente respondeu (conversa ativa)';
  if (lead.fora_da_janela) return 'fora da janela de atendimento';
  if (lead.followup_pendente) return 'já existe follow-up pendente';
  return null;
}

/**
 * @param lead { ultimo_contato_ms, niveis_disparados:[], enviadas_hoje, + flags de parada }
 * @param opts { agoraMs, limiteDiario }
 */
export function proximoFollowup(lead = {}, { agoraMs, limiteDiario = 3 } = {}) {
  const parado = relogioParado(lead);
  if (parado) return { acao: 'NENHUMA', motivo: parado };
  if ((lead.enviadas_hoje || 0) >= limiteDiario) return { acao: 'NENHUMA', motivo: 'limite diário de mensagens atingido' };

  const min = (agoraMs - (lead.ultimo_contato_ms ?? agoraMs)) / 60000;
  const disparadas = new Set(lead.niveis_disparados || []);
  // fura em ORDEM: dispara o menor nível vencido que ainda não saiu (nunca pula etapa)
  for (const e of ESCALADA) {
    if (!disparadas.has(e.nivel) && min >= e.apos_min) {
      return { acao: 'ESCALAR', nivel: e.nivel, para: e.para, o_que: e.acao, minutos: Math.floor(min) };
    }
  }
  return { acao: 'NENHUMA', motivo: 'ainda dentro do prazo ou já escalado' };
}
