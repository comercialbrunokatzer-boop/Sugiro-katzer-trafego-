/**
 * Health-check (KOS-001 §5 — monitoramento de saúde).
 * Diz se o Maestro está de pé e QUAIS credenciais estão presentes — sem NUNCA expor valor.
 */
import { CFG } from '../src/config.js';
import { resposta } from '../src/wiring.js';

export async function handler() {
  return resposta(200, {
    ok: true,
    servico: 'maestro',
    modo: CFG.MODO,
    credenciais: {
      bitrix_write: !!CFG.BITRIX_WEBHOOK_WRITE,
      firebase: !!CFG.FIREBASE_URL,
      zapi: !!(CFG.ZAPI.INSTANCE && CFG.ZAPI.TOKEN),
      alerta_ceo: !!CFG.KATZER_ALERT_PHONE,
    },
    broker_pool: CFG.BROKER_POOL.length,
    em: new Date().toISOString(),
  });
}
