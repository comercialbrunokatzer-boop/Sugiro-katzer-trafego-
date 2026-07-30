// Dedupe de TRAVA WhatsApp — 1 aviso por lead por dia (cron 15 min não spam).
import { getStore } from '@netlify/blobs';
import { chaveTrava } from './_whatsapp-mensagens.mjs';

const STORE = 'placar-michel';
const KEY = 'trava-whats-enviados-v1';

function abreStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: STORE, siteID, token });
  return getStore(STORE);
}

export async function leTravaEnviados() {
  try {
    const doc = await abreStore().get(KEY, { type: 'json' });
    return doc || { chaves: {}, atualizadoEm: null };
  } catch {
    return { chaves: {}, atualizadoEm: null, blobsDegraded: true };
  }
}

export { chaveTrava, filtrarTravaPendentes } from './_whatsapp-mensagens.mjs';

export async function marcaTravaEnviados(novasChaves = []) {
  const doc = await leTravaEnviados();
  const agora = new Date().toISOString();
  const chaves = { ...(doc.chaves || {}) };
  for (const k of novasChaves || []) chaves[k] = agora;
  const corte = Date.now() - 3 * 24 * 60 * 60 * 1000;
  for (const [k, iso] of Object.entries(chaves)) {
    const t = Date.parse(iso);
    if (Number.isFinite(t) && t < corte) delete chaves[k];
  }
  const next = { chaves, atualizadoEm: agora };
  await abreStore().setJSON(KEY, next);
  return next;
}
