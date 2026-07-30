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
  try {
    const doc = await abreStore().get(KEY_FEED, { type: 'json' });
    return doc || {
      desde: DESDE,
      acumulado: 127, // seed histórico Bruno até blobs ligar
      itens: [],
      atualizadoEm: null,
    };
  } catch {
    return {
      desde: DESDE,
      acumulado: 127,
      itens: [],
      atualizadoEm: null,
      blobsDegraded: true,
    };
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
  try {
    await abreStore().setJSON(KEY_FEED, doc);
  } catch (e) {
    const err = new Error('Blobs indisponível ao registrar feed');
    err.code = 'BLOBS_INDISPONIVEL';
    err.cause = e;
    throw err;
  }
  return doc;
}

export function itensHoje(doc, dataBRT) {
  return (doc.itens || []).filter((i) => String(i.data || '').startsWith(dataBRT) || i.data === dataBRT);
}
