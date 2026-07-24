/**
 * PRIMEIRO CONTATO — decisão determinística de saída de "Leads Novos".
 *
 * A decisão é pura: não escreve no Bitrix. Ela só devolve o mesmo contrato usado
 * pela Secretária (acao:'ATUALIZAR' + update). A escrita continua passando por
 * planoDeEscrita()/aplica(), portanto homolog permanece dry-run.
 */
import { montaAtualizacao, estagioPorStageId } from './secretaria.js';

const FASE_LEAD_NOVO = 'Leads Novos';
const FASE_CONTATO = 'Tentando Contato';

function dealIdValido(dealId) {
  return dealId !== null && dealId !== undefined && String(dealId).trim() !== '';
}

/**
 * Decide o movimento de primeiro contato.
 * Só age quando há evidência de uma mensagem da Helena persistida após envio bem-sucedido.
 */
export function decidePrimeiroContato({
  estagioAtual,
  stageId,
  dealId,
  resumo = '',
  contatoConfirmado = false,
  messageId = null,
  enviadoEmMs = null,
} = {}) {
  const estagio = estagioAtual || estagioPorStageId(stageId);
  if (estagio !== FASE_LEAD_NOVO) return null;
  if (contatoConfirmado !== true) return null;
  if (!dealIdValido(dealId)) return null;
  if (!messageId) return null;

  const ts = Number(enviadoEmMs);
  if (!Number.isFinite(ts) || ts <= 0) return null;

  const resumoSeguro = String(resumo || '').trim().slice(0, 1000)
    || 'Helena iniciou o contato com o lead.';

  const analise = {
    estagio: FASE_CONTATO,
    resumo: resumoSeguro,
    proxima_acao: 'Executar o próximo passo da cadência de primeiro contato',
    mudanca: {
      estagio_anterior: FASE_LEAD_NOVO,
      estagio_novo: FASE_CONTATO,
    },
  };

  const update = montaAtualizacao(analise, dealId);
  return {
    acao: 'ATUALIZAR',
    update,
    _origem: 'primeiro-contato',
    _messageId: String(messageId),
    _enviadoEmMs: ts,
    _idempotencyKey: `primeiro-contato:${dealId}:${messageId}`,
    _cadencia: estadoCadenciaInicial(ts),
  };
}

/** Estado inicial da cadência, contado a partir do envio confirmado. */
export function estadoCadenciaInicial(agoraMs) {
  const ts = Number(agoraMs);
  if (!Number.isFinite(ts) || ts <= 0) {
    throw new TypeError('agoraMs inválido para iniciar a cadência');
  }
  return {
    ultimo_contato_ms: ts,
    niveis_disparados: [],
    enviadas_hoje: 1,
  };
}

export default { decidePrimeiroContato, estadoCadenciaInicial };
