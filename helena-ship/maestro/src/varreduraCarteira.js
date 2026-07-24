/**
 * VARREDURA DA CARTEIRA — seleciona, de forma GRADUAL, os leads PARADOS que a Helena
 * ainda precisa contatar, pra ZERAR as demandas sem spam.
 *
 * Regra do CEO: falar com todos os clientes SEM registro em "Leads Novos" e
 * "Tentando Contato", aos poucos (lotes), evitando spam. O importante é zerar a fila.
 *
 * PURO/testável: recebe deals do Bitrix e devolve o LOTE. NÃO envia nada.
 * Envio real só com cron + VARREDURA_MODO=producao + GO CEO + gatekeeper.
 */
import { estagioPorStageId } from './secretaria.js';

const FASES_PARADAS = new Set(['Leads Novos', 'Tentando Contato']);
const HORA_MS = 3600000;

/**
 * @param {Array<{dealId,stageId,phone,ultimaAtividadeMs?,title?}>} deals
 * @param {object} opts
 */
export function selecionaParaContato(deals = [], opts = {}) {
  const { agoraMs, paradoHorasMin = 24, maxLote = 10 } = opts;
  const ja = opts.jaContatados instanceof Set
    ? opts.jaContatados
    : new Set(opts.jaContatados || []);

  const elegiveis = (Array.isArray(deals) ? deals : [])
    .filter((d) => d && d.phone && !ja.has(String(d.phone)))
    .filter((d) => FASES_PARADAS.has(estagioPorStageId(d.stageId)))
    .filter((d) => {
      const ult = Number(d.ultimaAtividadeMs);
      if (!Number.isFinite(ult)) return true;
      return agoraMs != null && (agoraMs - ult) >= paradoHorasMin * HORA_MS;
    })
    .sort((a, b) => (Number(a.ultimaAtividadeMs) || 0) - (Number(b.ultimaAtividadeMs) || 0));

  const lote = elegiveis.slice(0, Math.max(0, maxLote));
  return { elegiveis: elegiveis.length, lote, restam: Math.max(0, elegiveis.length - lote.length) };
}

export default { selecionaParaContato };
