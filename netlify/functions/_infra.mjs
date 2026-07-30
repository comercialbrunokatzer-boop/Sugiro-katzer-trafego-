// Infra compartilhada (arquivo "_" = não vira função): armazenamento + WhatsApp.
// Persistência = Netlify Blobs (auto). Gestor /api/estado atualiza sozinho (poll).
// WhatsApp: Evolution API (preferida) → fallback Z-API.
//
// REGRA P0 (#50): falha de Blobs NÃO derruba leitura — devolve estado vazio + flag.
import { getStore } from '@netlify/blobs';
import { estadoVazio } from './_rotina.mjs';

const STORE = 'rotina-michel';

export class BlobsUnavailableError extends Error {
  constructor(cause) {
    super('Armazenamento (Blobs) indisponível — regenerar BLOBS_TOKEN no Netlify');
    this.name = 'BlobsUnavailableError';
    this.code = 'BLOBS_INDISPONIVEL';
    this.cause = cause;
  }
}

// Site deployado por CLI (não por Git) não recebe o contexto automático do Blobs,
// então usamos o MODO MANUAL: siteID + token nas env vars (BLOBS_SITE_ID / BLOBS_TOKEN).
function abreStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: STORE, siteID, token });
  return getStore(STORE); // fallback: modo automático (se algum dia rodar por Git)
}

function msgBlobs(e) {
  return String((e && e.message) || e || 'blobs erro');
}

/** Lê o estado do dia (cria vazio se não existir). Nunca lança por falha de Blobs. */
export async function leEstado(data, modoPadrao = 'casa') {
  try {
    const atual = await abreStore().get(data, { type: 'json' });
    const estado = atual || estadoVazio(data, modoPadrao);
    estado._blobsOk = true;
    return estado;
  } catch (e) {
    const vazio = estadoVazio(data, modoPadrao);
    vazio._blobsOk = false;
    vazio._blobsErro = msgBlobs(e);
    return vazio;
  }
}

/** Grava o estado do dia. Lança BlobsUnavailableError se Blobs estiver off. */
export async function salvaEstado(estado) {
  try {
    const { _blobsOk, _blobsErro, ...limpo } = estado || {};
    await abreStore().setJSON(limpo.data, limpo);
    return limpo;
  } catch (e) {
    throw new BlobsUnavailableError(e);
  }
}

function soDig(s) {
  return String(s || '').replace(/\D+/g, '');
}

/** Evolution API (webhook Bruno) — preferida quando EVOLUTION_* estiver setado. */
async function enviaWhatsEvolution(telefone, mensagem) {
  const base = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
  const key = process.env.EVOLUTION_API_KEY || process.env.EVOLUTION_APIKEY || '';
  const instance = process.env.EVOLUTION_INSTANCE || process.env.EVOLUTION_INSTANCE_NAME || '';
  if (!base || !key || !instance || !telefone) {
    return { enviado: false, motivo: 'evolution ausente', provider: 'evolution' };
  }
  try {
    const url = `${base}/message/sendText/${encodeURIComponent(instance)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
      },
      body: JSON.stringify({
        number: soDig(telefone),
        text: mensagem,
      }),
    });
    return { enviado: r.ok, status: r.status, provider: 'evolution' };
  } catch (e) {
    return { enviado: false, erro: String((e && e.message) || e), provider: 'evolution' };
  }
}

/** Z-API — fallback (já em produção na Katzer). */
async function enviaWhatsZapi(telefone, mensagem) {
  const inst = process.env.ZAPI_INSTANCE;
  const tok = process.env.ZAPI_TOKEN;
  const ct = process.env.ZAPI_CLIENT_TOKEN;
  if (!inst || !tok || !telefone) return { enviado: false, motivo: 'zapi/telefone ausente', provider: 'zapi' };
  try {
    const url = `https://api.z-api.io/instances/${inst}/token/${tok}/send-text`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(ct ? { 'Client-Token': ct } : {}) },
      body: JSON.stringify({ phone: soDig(telefone), message: mensagem }),
    });
    return { enviado: r.ok, status: r.status, provider: 'zapi' };
  } catch (e) {
    return { enviado: false, erro: String((e && e.message) || e), provider: 'zapi' };
  }
}

/**
 * Envia texto no WhatsApp. Evolution primeiro; se falhar/ausente → Z-API.
 * Não quebra o fluxo se falhar (retorna status).
 */
export async function enviaWhats(telefone, mensagem) {
  if (!telefone) return { enviado: false, motivo: 'telefone ausente' };
  const evo = await enviaWhatsEvolution(telefone, mensagem);
  if (evo.enviado) return evo;
  // Se Evolution nem está configurada, tenta Z-API; se Evolution falhou, também tenta Z-API.
  const z = await enviaWhatsZapi(telefone, mensagem);
  if (z.enviado) return { ...z, evolution: evo };
  return {
    enviado: false,
    motivo: evo.motivo || z.motivo || 'falha whatsapp',
    evolution: evo,
    zapi: z,
  };
}

/** Envia e-mail via Resend (se RESEND_API_KEY existir). Não quebra se faltar. */
export async function enviaEmail(para, assunto, html) {
  const key = process.env.RESEND_API_KEY;
  const de = process.env.EMAIL_FROM || 'Rotina Katzer <onboarding@resend.dev>';
  if (!key || !para) return { enviado: false, motivo: 'resend/email ausente' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: de, to: [para], subject: assunto, html }),
    });
    return { enviado: r.ok, status: r.status };
  } catch (e) {
    return { enviado: false, erro: String((e && e.message) || e) };
  }
}

export function json(statusCode, body, { noStore = true } = {}) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  };
  if (noStore) {
    headers['cache-control'] = 'no-store, no-cache, must-revalidate';
  }
  return {
    statusCode,
    headers,
    body: JSON.stringify(body, null, 2),
  };
}
