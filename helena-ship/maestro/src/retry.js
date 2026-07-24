/**
 * Retry com backoff exponencial (KOS-001 §5 — tentativas automáticas).
 * Só re-tenta erro RECUPERÁVEL (rede / 5xx / 429). 4xx falha rápido.
 * `sleep` é injetável pra o teste não esperar de verdade.
 */
export function recuperavel(e) {
  const msg = String((e && e.message) || e || '');
  if (/\b(429|5\d\d)\b/.test(msg)) return true;
  if (/timeout|network|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|aborted/i.test(msg)) return true;
  return false;
}

export async function comTentativas(fn, opts = {}) {
  const { tentativas = 4, baseMs = 300, maxMs = 8000, ehRecuperavel = recuperavel,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = opts;
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try { return await fn(); }
    catch (e) {
      ultimo = e;
      if (i === tentativas - 1 || !ehRecuperavel(e)) throw e;
      await sleep(Math.min(maxMs, baseMs * 2 ** i));
    }
  }
  throw ultimo;
}
