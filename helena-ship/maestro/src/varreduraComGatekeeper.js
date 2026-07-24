/**
 * Liga varredura (seleção gradual) + gatekeeper (piloto fail-closed).
 * Puro: não envia WhatsApp. Cron dry-run e testes usam isto.
 */
import { selecionaParaContato } from './varreduraCarteira.js';
import { filtraElegiveis } from './gatekeeper.js';

/**
 * @param {Array} deals deals normalizados (dealId, stageId, phone, ultimaAtividadeMs, …)
 * @param {object} opts opções de selecionaParaContato + gatekeeper config
 * @returns {{ selecionados:number, lote:Array, bloqueados:Array, restam:number }}
 */
export function montaLoteVarreduraSeguro(deals = [], opts = {}) {
  const sel = selecionaParaContato(deals, opts);
  const gkCfg = opts.gatekeeper || opts.piloto || {};
  const { elegiveis, bloqueados } = filtraElegiveis(sel.lote, gkCfg, { agoraMs: opts.agoraMs });
  return {
    selecionados: sel.elegiveis,
    lote: elegiveis,
    bloqueados,
    restam: sel.restam,
  };
}

export default { montaLoteVarreduraSeguro };
