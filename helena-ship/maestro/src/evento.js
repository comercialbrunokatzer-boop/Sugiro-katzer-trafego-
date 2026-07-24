/**
 * CONTRATO DE EVENTO PADRÃO do Maestro (KOS-001 §5).
 * Toda entrada vira este envelope ANTES de qualquer processamento — com identificador
 * único (event_id) pra idempotência e correlação. Nada entra sem virar evento.
 */
import { randomUUID } from 'node:crypto';

/** Monta o envelope. Usa o id do próprio provedor quando existir (idempotência de verdade). */
export function montaEvento(raw = {}, { source, event_type = 'lead.created' } = {}) {
  const idExterno = raw.event_id || raw.leadId || raw.messageId || raw.id || null;
  return {
    event_id: idExterno ? String(idExterno) : randomUUID(),
    event_type,
    source: source || 'desconhecido',
    received_at: new Date().toISOString(),
    correlation_id: raw.correlation_id || randomUUID(),
    contact: {
      name: (raw.nome || raw.name || '').toString(),
      phone: (raw.telefone || raw.phone || raw.number || '').toString(),
      email: (raw.email || '').toString(),
    },
    context: {
      campaign: (raw.campanha || raw.interesse || '').toString(),
      product: (raw.produto || '').toString(),
      channel: source || '',
    },
    payload_original: raw,
    processing_status: 'received',
  };
}

/** Mascara dado sensível pra LOG (nunca loga telefone/e-mail inteiros — KOS-001 regra 14). */
export function mascara(valor) {
  const m = (s) => {
    s = String(s || '');
    if (s.length <= 4) return s ? '***' : '';
    return s.slice(0, 2) + '***' + s.slice(-2);
  };
  if (valor && typeof valor === 'object') {
    const out = Array.isArray(valor) ? [] : {};
    for (const [k, v] of Object.entries(valor)) {
      out[k] = /phone|telefone|email|e_mail|token|secret|webhook|key/i.test(k) ? m(v) : (typeof v === 'object' ? mascara(v) : v);
    }
    return out;
  }
  return m(valor);
}
