// Persistência do vigilante CEO (snapshot ativas + chaves de alerta já enviadas).
import { getStore } from '@netlify/blobs';

const STORE = 'placar-michel';
const KEY_SNAP = 'alerta-ceo-ativas-v1';
const KEY_SENT = 'alerta-ceo-enviados-v1';

function abreStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: STORE, siteID, token });
  return getStore(STORE);
}

export async function leSnapshotAtivas() {
  try {
    const doc = await abreStore().get(KEY_SNAP, { type: 'json' });
    return doc || { atualizadoEm: null, ativas: {} };
  } catch {
    return { atualizadoEm: null, ativas: {}, blobsDegraded: true };
  }
}

export async function salvaSnapshotAtivas(ativas = {}) {
  const doc = {
    atualizadoEm: new Date().toISOString(),
    ativas: ativas || {},
  };
  await abreStore().setJSON(KEY_SNAP, doc);
  return doc;
}

export async function leAlertasEnviados() {
  try {
    const doc = await abreStore().get(KEY_SENT, { type: 'json' });
    return doc || { chaves: {}, atualizadoEm: null };
  } catch {
    return { chaves: {}, atualizadoEm: null, blobsDegraded: true };
  }
}

/** Marca chaves enviadas; limpa entradas com mais de 3 dias. */
export async function marcaAlertasEnviados(novasChaves = []) {
  const doc = await leAlertasEnviados();
  const agora = new Date().toISOString();
  const chaves = { ...(doc.chaves || {}) };
  for (const k of novasChaves || []) chaves[k] = agora;
  // GC: mantém ~4 dias
  const corte = Date.now() - 4 * 24 * 60 * 60 * 1000;
  for (const [k, iso] of Object.entries(chaves)) {
    const t = Date.parse(iso);
    if (Number.isFinite(t) && t < corte) delete chaves[k];
  }
  const next = { chaves, atualizadoEm: agora };
  await abreStore().setJSON(KEY_SENT, next);
  return next;
}
