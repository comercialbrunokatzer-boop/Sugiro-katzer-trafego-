/**
 * WhatsApp via Z-API — resposta ao lead ("o corretor X ja vai te chamar") e alerta interno.
 * HTTP injetavel. Se o Z-API nao estiver configurado, NAO quebra: registra e segue (fallback, regra #8).
 */
import { CFG } from './config.js';

export function criaWhatsapp({ fetchImpl = fetch } = {}) {
  const pronto = !!(CFG.ZAPI.INSTANCE && CFG.ZAPI.TOKEN);
  async function enviaTexto(telefone, mensagem) {
    if (!pronto) return { enviado: false, motivo: 'zapi_nao_configurado' };
    const url = `https://api.z-api.io/instances/${CFG.ZAPI.INSTANCE}/token/${CFG.ZAPI.TOKEN}/send-text`;
    const r = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(CFG.ZAPI.CLIENT_TOKEN ? { 'Client-Token': CFG.ZAPI.CLIENT_TOKEN } : {}) },
      body: JSON.stringify({ phone: telefone.replace(/\D+/g, ''), message: mensagem }),
    });
    return { enviado: r.ok, status: r.status };
  }
  return { enviaTexto };
}
