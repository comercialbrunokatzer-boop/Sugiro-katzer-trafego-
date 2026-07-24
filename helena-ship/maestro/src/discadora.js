/**
 * Discadora — coloca o negocio na fila de ligacao.
 * MODE=bitrix: a discadora puxa direto do Bitrix -> nada a fazer aqui (o negocio ja nasceu la).
 * MODE=api:    empurra pra API propria da discadora. Fallback: se falhar, marca pendente (regra #8).
 */
import { CFG } from './config.js';

export function criaDiscadora({ fetchImpl = fetch } = {}) {
  async function enfileira({ dealId, telefone, corretorId }) {
    if (CFG.DISCADORA.MODE !== 'api') {
      return { enfileirado: true, modo: 'bitrix', obs: 'discadora puxa do Bitrix' };
    }
    if (!CFG.DISCADORA.URL) return { enfileirado: false, modo: 'api', motivo: 'sem_url' };
    const r = await fetchImpl(CFG.DISCADORA.URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(CFG.DISCADORA.TOKEN ? { Authorization: `Bearer ${CFG.DISCADORA.TOKEN}` } : {}) },
      body: JSON.stringify({ dealId, telefone: telefone.replace(/\D+/g, ''), corretorId }),
    });
    return { enfileirado: r.ok, modo: 'api', status: r.status };
  }
  return { enfileira };
}
