// I/O da qualidade de leads (Bom/Curioso/Errado/Comprador).
import { getStore } from '@netlify/blobs';
import { normalizaQualidade } from './_qualidade.mjs';

const STORE = 'placar-michel';
const KEY = 'qualidade-v1';

function abreStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: STORE, siteID, token });
  return getStore(STORE);
}

export async function leQualidade() {
  const atual = await abreStore().get(KEY, { type: 'json' });
  return atual && typeof atual === 'object'
    ? { campanhas: atual.campanhas || {}, atualizadoEm: atual.atualizadoEm || null }
    : { campanhas: {}, atualizadoEm: null };
}

export async function salvaQualidadeCampanha({
  id, nome, bom, curioso, errado, comprador, quem = 'Michel',
} = {}) {
  const chave = String(id || nome || '').trim();
  if (!chave) throw new Error('informe id ou nome da campanha');
  const store = abreStore();
  const atual = await leQualidade();
  const item = normalizaQualidade(
    { bom, curioso, errado, comprador },
    { id: id || null, nome: nome || chave },
  );
  item.atualizadoEm = new Date().toISOString();
  item.atualizadoPor = quem;
  atual.campanhas[chave] = item;
  // também indexa pelo nome se id diferente
  if (id && nome && nome !== id) atual.campanhas[nome] = item;
  atual.atualizadoEm = item.atualizadoEm;
  await store.setJSON(KEY, atual);
  return item;
}

export function mapaQualidade(doc) {
  return (doc && doc.campanhas) || {};
}
