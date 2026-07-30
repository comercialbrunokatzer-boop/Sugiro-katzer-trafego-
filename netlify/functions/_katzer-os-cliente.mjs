/**
 * Cliente da fonte única Katzer OS (Helena).
 * App Michel / Rotina → GET …/api/katzer-os?perfil=operacao
 * NÃO ler App Executivo Bruno.
 */

export const KATZER_OS_DEFAULT =
  (process.env.KATZER_OS_URL || 'https://regal-chaja-662035.netlify.app').replace(/\/+$/, '');

/**
 * Extrai a fatia Helena (enviados/respondidos) do payload katzer-os.
 * Função pura — testável sem rede.
 */
export function fatiaHelenaDePayload(payload) {
  if (!payload || payload.ok === false) {
    return { ok: false, origem: 'katzer-os', erro: 'payload inválido' };
  }
  const h = payload.snapshot?.helena || payload.helena || {};
  const p = h.placar || {};
  const enviados = numOuNull(p.enviados ?? h.enviados);
  const respondidos = numOuNull(p.respondidos ?? h.responderam ?? h.respondidos);
  return {
    ok: true,
    origem: 'katzer-os',
    versao: payload.versao || null,
    buildMs: payload.buildMs ?? null,
    enviados,
    respondidos,
    pendentes: numOuNull(h.pendentes),
    taxaResposta: h.taxaResposta ?? p.taxaResposta ?? null,
    saude: p.saudeHelena || null,
    operacaoAtiva: h.operacaoAtiva ?? null,
    atualizadoEm: h.ultimaSincronizacao || p.ultimaSincronizacaoBrt || null,
    fonte: h.fonte || p.fonte || 'katzer-os',
  };
}

function numOuNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Busca fatia Helena; nunca lança — retorna { ok:false } se falhar. */
export async function buscaFatiaHelena({
  baseUrl = KATZER_OS_DEFAULT,
  fetchImpl = fetch,
  timeoutMs = 8000,
} = {}) {
  const url = `${baseUrl}/api/katzer-os?perfil=operacao&acao=snapshot`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const r = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
      },
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (!r.ok) {
      return { ok: false, origem: 'katzer-os', erro: `HTTP ${r.status}`, url };
    }
    const payload = await r.json();
    return { ...fatiaHelenaDePayload(payload), url };
  } catch (e) {
    return {
      ok: false,
      origem: 'katzer-os',
      erro: String((e && e.message) || e),
      url,
    };
  } finally {
    if (t) clearTimeout(t);
  }
}
