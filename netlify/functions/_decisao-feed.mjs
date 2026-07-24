// I/O do App Decisão — feed acumulado desde 12/07/2025 + decisões do dia.
import { getStore } from '@netlify/blobs';

const STORE = 'placar-michel';
const KEY_FEED = 'decisao-feed-v1';
const DESDE = '2025-07-12';

function abreStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: STORE, siteID, token });
  return getStore(STORE);
}

export function dataDesde() {
  return DESDE;
}

export async function leFeedDecisao() {
  const doc = await abreStore().get(KEY_FEED, { type: 'json' });
  return doc || {
    desde: DESDE,
    acumulado: 127, // seed histórico Bruno até blobs ligar
    itens: [],
    atualizadoEm: null,
  };
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
  await abreStore().setJSON(KEY_FEED, doc);
  return doc;
}

export function itensHoje(doc, dataBRT) {
  return (doc.itens || []).filter((i) => String(i.data || '').startsWith(dataBRT) || i.data === dataBRT);
}
