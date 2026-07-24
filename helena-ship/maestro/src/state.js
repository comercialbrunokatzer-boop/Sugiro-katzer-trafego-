/**
 * Estado do Maestro no Firebase RTDB (via REST). Guarda: idempotência (eventos já processados),
 * indice do round-robin, vinculo lead<->negocio, e o log de eventos (rastreabilidade).
 * Sem Firebase configurado, cai num estado EM MEMÓRIA (dev/teste) — nunca quebra.
 */
import { CFG } from './config.js';

function fireURL(caminho) {
  const auth = CFG.FIREBASE_SECRET ? `?auth=${encodeURIComponent(CFG.FIREBASE_SECRET)}` : '';
  return `${CFG.FIREBASE_URL}/${caminho}.json${auth}`;
}

export function criaEstado({ fetchImpl = fetch, memoria = null } = {}) {
  const usaFirebase = !!CFG.FIREBASE_URL && !memoria;
  const mem = memoria || {};
  mem.kv = mem.kv || {};
  mem.eventos = mem.eventos || [];

  async function get(caminho, fallback) {
    if (!usaFirebase) return (caminho in mem.kv) ? mem.kv[caminho] : fallback;
    const r = await fetchImpl(fireURL(caminho));
    const j = await r.json();
    return j == null ? fallback : j;
  }
  async function put(caminho, valor) {
    if (!usaFirebase) { mem.kv[caminho] = valor; return valor; }
    await fetchImpl(fireURL(caminho), { method: 'PUT', body: JSON.stringify(valor) });
    return valor;
  }
  async function push(caminho, valor) {
    if (!usaFirebase) { mem.eventos.push({ caminho, valor }); return; }
    await fetchImpl(fireURL(caminho), { method: 'POST', body: JSON.stringify(valor) });
  }

  return {
    _mem: mem,
    // idempotência (KOS-001 regra 11): um event_id nunca é processado duas vezes
    viuEvento: (id) => get(`maestro/eventos_proc/${id}`, null).then(Boolean),
    marcaEvento: (id, res) => put(`maestro/eventos_proc/${id}`, { em: new Date().toISOString(), dealId: res?.dealId || null }),
    // round-robin
    lerIndiceRR: () => get('maestro/rr/indice', -1),
    salvarIndiceRR: (i) => put('maestro/rr/indice', i),
    // vinculos e log
    vincular: (leadId, dealId) => put(`maestro/links/${leadId}`, { dealId, em: new Date().toISOString() }),
    logEvento: (ev) => push('maestro/eventos', { ...ev, t: new Date().toISOString() }),
    // fila de reprocessamento (KOS-001 §5)
    enfileiraErro: (ev) => push('maestro/fila_erro', { ...ev, t: new Date().toISOString() }),
  };
}
