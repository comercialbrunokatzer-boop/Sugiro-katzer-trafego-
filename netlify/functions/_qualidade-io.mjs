// I/O da qualidade de leads (Bom/Curioso/Errado/Comprador).
import { normalizaQualidade } from './_qualidade.mjs';
import { abreStoreSafe } from './_blobs-store.mjs';

const STORE = 'placar-michel';
const KEY = 'qualidade-v1';

function abreStore() {
  return abreStoreSafe(STORE);
}

export async function leQualidade() {
  try {
    const store = abreStore();
    if (!store) return { campanhas: {}, atualizadoEm: null, blobsDegraded: true };
    const atual = await store.get(KEY, { type: 'json' });
    return atual && typeof atual === 'object'
      ? { campanhas: atual.campanhas || {}, atualizadoEm: atual.atualizadoEm || null }
      : { campanhas: {}, atualizadoEm: null };
  } catch {
    return { campanhas: {}, atualizadoEm: null, blobsDegraded: true };
  }
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
