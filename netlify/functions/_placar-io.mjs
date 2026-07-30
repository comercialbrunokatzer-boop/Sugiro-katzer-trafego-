// I/O do Placar-quadradinho (arquivo "_" = NÃO vira função): Blobs + Meta.
// REGRA: erro de integração NUNCA vira gasto R$ 0 “de verdade”.
import { getStore } from '@netlify/blobs';
import { montaPlacar, inventariarAcoes } from './_placar.mjs';
import { decisoesVazias } from './_placar-estado.mjs';
import { classificaMetaResultado, mensagemMeta } from './_meta-status.mjs';
import { META_AD_ACCOUNT, META_GRAPH } from './_meta-config.mjs';

export { classificaMetaResultado, mensagemMeta } from './_meta-status.mjs';
export { inventariarAcoes } from './_placar.mjs';

const STORE = 'placar-michel';
const PLACAR_TTL_MS = 10 * 60 * 1000;
const CACHE_KEY = 'placar-cache-v3';

function abreStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: STORE, siteID, token });
  return getStore(STORE);
}

export async function leDecisoes(data) {
  try {
    const atual = await abreStore().get(`dec-${data}`, { type: 'json' });
    return atual || decisoesVazias(data);
  } catch {
    return decisoesVazias(data);
  }
}
export async function salvaDecisoes(decisoes) {
  try {
    await abreStore().setJSON(`dec-${decisoes.data}`, decisoes);
    return decisoes;
  } catch (e) {
    const err = new Error('Blobs indisponível ao salvar decisões');
    err.code = 'BLOBS_INDISPONIVEL';
    err.cause = e;
    throw err;
  }
}

async function buscaMetaPlacar(preset) {
  const token = process.env.META_SYSTEM_TOKEN;
  const acct = META_AD_ACCOUNT;
  const graph = META_GRAPH;

  if (!token) {
    return {
      placar: montaPlacar([]),
      meta: classificaMetaResultado({ temToken: false, conta: acct, etapa: 'env' }),
      inventario: null,
    };
  }

  const url = new URL(`${graph}/${acct}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('date_preset', preset);
  url.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,reach,clicks,actions,results');
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', token);

  try {
    const r = await fetch(url.toString());
    const body = await r.json();
    if (body && body.error) {
      return {
        placar: montaPlacar([]),
        meta: classificaMetaResultado({
          temToken: true, httpOk: false, bodyError: body.error, conta: acct, etapa: 'insights',
        }),
        inventario: null,
      };
    }
    const data = (body && body.data) || [];
    const placar = montaPlacar(data);
    const inventario = inventariarAcoes(data);
    const meta = classificaMetaResultado({
      temToken: true, httpOk: true, nBruto: data.length, nComGasto: placar.campanhas.length, conta: acct,
    });
    return { placar, meta, inventario };
  } catch {
    return {
      placar: montaPlacar([]),
      meta: classificaMetaResultado({
        temToken: true, httpOk: false, bodyError: { code: 'FETCH', message: 'network' },
        conta: acct, etapa: 'fetch',
      }),
      inventario: null,
    };
  }
}

/** Placar do Meta com cache curto. Erro nunca grava zero como dado real. */
export async function lePlacar({ preset = 'last_7d', force = false } = {}) {
  const store = abreStore();
  let cache = null;
  try { cache = await store.get(CACHE_KEY, { type: 'json' }); } catch { /* ignore */ }
  const agora = Date.now();

  if (!force && cache && cache.preset === preset && cache.confiavel
      && agora - (cache.ts || 0) < PLACAR_TTL_MS) {
    return {
      placar: cache.placar,
      ts: cache.ts,
      cacheHit: true,
      meta: { ...(cache.meta || { status: 'ok', confiavel: true }), cacheHit: true },
      inventario: cache.inventario || null,
    };
  }

  const { placar, meta, inventario } = await buscaMetaPlacar(preset);

  if (meta.confiavel) {
    try {
      await store.setJSON(CACHE_KEY, {
        ts: agora, preset, placar, meta, inventario: inventario || null, confiavel: true,
      });
    } catch { /* ignore */ }
    return { placar, ts: agora, cacheHit: false, meta, inventario: inventario || null };
  }

  if (cache && cache.confiavel && cache.placar) {
    const ultima = cache.ts
      ? new Date(cache.ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : null;
    return {
      placar: cache.placar,
      ts: cache.ts,
      cacheHit: true,
      inventario: cache.inventario || null,
      meta: {
        ...meta,
        status: 'erro_temporario',
        confiavel: false,
        ultimaLeituraValida: ultima,
        mensagemPainel: mensagemMeta({ status: 'erro_temporario', ultimaLeituraValida: ultima }),
        usandoCache: true,
      },
    };
  }

  return {
    placar: montaPlacar([]),
    ts: null,
    cacheHit: false,
    meta,
    inventario: null,
  };
}
