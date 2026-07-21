// Infra compartilhada (arquivo "_" = não vira função): armazenamento + WhatsApp.
import { getStore } from '@netlify/blobs';
import { estadoVazio } from './_rotina.mjs';

const STORE = 'rotina-michel';

/** Lê o estado do dia (cria vazio se não existir). */
export async function leEstado(data, modoPadrao = 'casa') {
  const store = getStore(STORE);
  const atual = await store.get(data, { type: 'json' });
  return atual || estadoVazio(data, modoPadrao);
}

/** Grava o estado do dia. */
export async function salvaEstado(estado) {
  const store = getStore(STORE);
  await store.setJSON(estado.data, estado);
  return estado;
}

/** Envia texto no WhatsApp via Z-API. Não quebra o fluxo se falhar (retorna status). */
export async function enviaWhats(telefone, mensagem) {
  const inst = process.env.ZAPI_INSTANCE;
  const tok = process.env.ZAPI_TOKEN;
  const ct = process.env.ZAPI_CLIENT_TOKEN;
  if (!inst || !tok || !telefone) return { enviado: false, motivo: 'zapi/telefone ausente' };
  try {
    const url = `https://api.z-api.io/instances/${inst}/token/${tok}/send-text`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(ct ? { 'Client-Token': ct } : {}) },
      body: JSON.stringify({ phone: String(telefone).replace(/\D+/g, ''), message: mensagem }),
    });
    return { enviado: r.ok, status: r.status };
  } catch (e) {
    return { enviado: false, erro: String((e && e.message) || e) };
  }
}

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
    body: JSON.stringify(body, null, 2),
  };
}
