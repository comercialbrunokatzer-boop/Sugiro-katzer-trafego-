// I/O do Placar-quadradinho (arquivo "_" = NÃO vira função): Blobs + Meta.
// Fica separado do núcleo puro (_placar-estado.mjs) pra os testes não
// precisarem do @netlify/blobs. Armazém PRÓPRIO ('placar-michel'), separado
// do da rotina ('rotina-michel').
import { getStore } from '@netlify/blobs';
import { montaPlacar } from './_placar.mjs';
import { decisoesVazias } from './_placar-estado.mjs';

const STORE = 'placar-michel';
const PLACAR_TTL_MS = 10 * 60 * 1000; // cache do Meta: 10 min (não martela a API a cada poll)

function abreStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: STORE, siteID, token });
  return getStore(STORE); // fallback automático (se algum dia rodar por Git)
}

/** Decisões do dia (cria vazio se não existir). */
export async function leDecisoes(data) {
  const atual = await abreStore().get(`dec-${data}`, { type: 'json' });
  return atual || decisoesVazias(data);
}
export async function salvaDecisoes(decisoes) {
  await abreStore().setJSON(`dec-${decisoes.data}`, decisoes);
  return decisoes;
}

/** Placar do Meta com cache curto — devolve { placar, ts, cacheHit }. */
export async function lePlacar({ preset = 'last_7d', force = false } = {}) {
  const store = abreStore();
  let cache = null;
  try { cache = await store.get('placar-cache-v2', { type: 'json' }); } catch { /* ignore */ }
  const agora = Date.now();
  if (!force && cache && cache.preset === preset && agora - (cache.ts || 0) < PLACAR_TTL_MS) {
    return { placar: cache.placar, ts: cache.ts, cacheHit: true };
  }
  const placar = await buscaMetaPlacar(preset);
  // Só cacheia leitura real (com token). Sem token, vazio NÃO pode contaminar o cache.
  if (process.env.META_SYSTEM_TOKEN) {
    try { await store.setJSON('placar-cache-v2', { ts: agora, preset, placar }); } catch { /* ignore */ }
  }
  return { placar, ts: agora, cacheHit: false };
}

async function buscaMetaPlacar(preset) {
  const token = process.env.META_SYSTEM_TOKEN;
  const acct = process.env.META_AD_ACCOUNT || 'act_1150648749960943';
  const graph = process.env.META_GRAPH || 'https://graph.facebook.com/v20.0';
  if (!token) return montaPlacar([]);
  const url = new URL(`${graph}/${acct}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('date_preset', preset);
  url.searchParams.set('fields', 'campaign_name,spend,actions,results');
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', token);
  try {
    const r = await fetch(url.toString());
    const body = await r.json();
    if (body && body.error) return montaPlacar([]);
    return montaPlacar((body && body.data) || []);
  } catch { return montaPlacar([]); }
}
