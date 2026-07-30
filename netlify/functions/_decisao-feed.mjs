// I/O do App Decisão — feed acumulado desde 12/07/2025 + decisões do dia.
import { abreStoreSafe, blobsGetJson, blobsSetJson } from './_blobs-store.mjs';

const STORE = 'placar-michel';
const KEY_FEED = 'decisao-feed-v1';
const DESDE = '2025-07-12';

function abreStore() {
  return abreStoreSafe(STORE);
}

function feedVazio(extra = {}) {
  return {
    desde: DESDE,
    acumulado: 127, // seed histórico Bruno até blobs ligar
    itens: [],
    atualizadoEm: null,
    ...extra,
  };
}

export function dataDesde() {
  return DESDE;
}

export async function leFeedDecisao() {
  try {
    const doc = await blobsGetJson(abreStore(), KEY_FEED);
    return doc || feedVazio();
  } catch {
    return feedVazio({ blobsDegraded: true });
  }
}

export async function registraFeedDecisao(item) {
  const doc = await leFeedDecisao();
  const entrada = {
    ...item,
    em: item.em || new Date().toISOString(),
  };
  doc.itens = [entrada, ...(doc.itens || [])].slice(0, 500);
  doc.acumulado = (Number(doc.acumulado) || 127) + 1;
  doc.atualizadoEm = entrada.em;
  await blobsSetJson(abreStore(), KEY_FEED, doc);
  return doc;
}

export function itensHoje(doc, dataBRT) {
  return (doc.itens || []).filter((i) => String(i.data || '').startsWith(dataBRT) || i.data === dataBRT);
}
