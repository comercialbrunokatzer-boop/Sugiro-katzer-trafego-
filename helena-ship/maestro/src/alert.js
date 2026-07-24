/**
 * Alerta de falha (regra #7: todo erro gera alerta). Manda WhatsApp pro Katzer.
 * Nunca deixa o alerta derrubar o fluxo — se o alerta falhar, so loga.
 */
import { CFG } from './config.js';

export function criaAlerta({ whatsapp, logger }) {
  return async function alerta(titulo, detalhe) {
    const msg = `🔴 MAESTRO — ${titulo}\n${detalhe || ''}`.slice(0, 900);
    try {
      if (CFG.KATZER_ALERT_PHONE && whatsapp) await whatsapp.enviaTexto(CFG.KATZER_ALERT_PHONE, msg);
    } catch (e) {
      logger?.erro('falha ao enviar alerta', { erro: String(e && e.message) });
    }
  };
}
