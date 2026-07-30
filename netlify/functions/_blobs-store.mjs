/**
 * Abre Netlify Blobs sem derrubar a função.
 * Site CLI sem contexto automático precisa de BLOBS_SITE_ID + BLOBS_TOKEN.
 * Se faltar/invalidar → retorna null (chamador degrada).
 */
import { getStore } from '@netlify/blobs';

export function abreStoreSafe(name) {
  try {
    const siteID = process.env.BLOBS_SITE_ID;
    const token = process.env.BLOBS_TOKEN;
    if (siteID && token) return getStore({ name, siteID, token });
    return getStore(name);
  } catch {
    return null;
  }
}

export async function blobsGetJson(storeOrNull, key) {
  if (!storeOrNull) return null;
  try {
    return await storeOrNull.get(key, { type: 'json' });
  } catch {
    return null;
  }
}

export async function blobsSetJson(storeOrNull, key, value) {
  if (!storeOrNull) {
    const err = new Error('Blobs indisponível (sem store)');
    err.code = 'BLOBS_INDISPONIVEL';
    throw err;
  }
  try {
    await storeOrNull.setJSON(key, value);
  } catch (e) {
    const err = new Error('Blobs indisponível ao gravar');
    err.code = 'BLOBS_INDISPONIVEL';
    err.cause = e;
    throw err;
  }
}
