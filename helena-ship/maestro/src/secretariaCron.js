/**
 * RUNNER AUTOMÁTICO da Secretária (a cada 2h). NÚCLEO puro/testável.
 * O handler agendado (netlify/functions/secretaria-cron.mjs) injeta as dependências reais
 * (listar conversas do Firebase, achar deal, rodar o cérebro, aplicar, avisar o Bruno).
 *
 * SEGURANÇA (dois interruptores):
 *  - SECRETARIA_AUTO liga/desliga a rotina inteira (default OFF).
 *  - modo 'homolog' = OBSERVAÇÃO (monta o que faria e avisa o Bruno; NÃO escreve).
 *    modo 'producao' = aplica de verdade na zona verde (zona vermelha só propõe).
 */
import { planoDeEscrita } from './secretariaAplica.js';
import { extraiCampos } from './secretariaExtrai.js';
import { textoDoCliente, conversaHelenaParaMsgs } from './secretariaRun.js';

/**
 * Processa uma lista de conversas e devolve, por conversa, a decisão + o plano de escrita.
 * @param {Array<{chave, conv}>} itens
 * @param {object} deps  { achaDeal(tel)->{dealId,stageId,estagio}|null, rodar(conv,opts)->decisao,
 *                          estagioPorStageId(stageId)->nome }
 */
export async function processaConversas(itens = [], deps = {}) {
  const { achaDeal, rodar, estagioPorStageId = () => null, processadosIds } = deps;
  const out = [];
  for (const { chave, conv } of itens) {
    const tel = (conv && conv.phone) || chave;
    let dealCtx = null;
    try { dealCtx = achaDeal ? await achaDeal(tel) : null; } catch { dealCtx = null; }
    const estagioAtual = dealCtx && dealCtx.stageId ? (estagioPorStageId(dealCtx.stageId) || null) : null;
    const decisao = await rodar(conv, {
      estagioAtual: estagioAtual || 'Leads Novos',
      dealId: (dealCtx && dealCtx.dealId) || 'SEM_CARD',
      processadosIds: processadosIds instanceof Set ? processadosIds : undefined,
    });
    const campos = extraiCampos(textoDoCliente(conversaHelenaParaMsgs(conv)));
    const plano = planoDeEscrita(decisao, { dealId: dealCtx && dealCtx.dealId, campos });
    out.push({
      chave,
      tel,
      nome: (conv && conv.leadData && (conv.leadData.full_name || conv.leadData.leadName)) || null,
      etapa_atual: estagioAtual,
      decisao,
      campos,
      plano,
      temCard: !!(dealCtx && dealCtx.dealId),
    });
  }
  return out;
}

/** Só as PROPOSTAS de zona vermelha (Negociação+). A zona verde é aplicada CALADA (registro
 *  fica no próprio card). O CEO não quer digest de rotina — só o que precisa do OK dele.
 *  Retorna '' quando não há proposta (aí o runner não manda nada). */
export function montaPropostas(itens = []) {
  const propostas = itens.filter((it) => it.decisao && it.decisao.acao === 'PROPOR');
  if (!propostas.length) return '';
  const linhas = propostas.map((it) => {
    const nome = it.nome || it.tel || it.chave;
    const rec = (it.decisao.update && it.decisao.update._estagio)
      || (it.decisao.parecer && it.decisao.parecer.recommended_stage) || '—';
    return `• *${nome}* — ${it.etapa_atual || '?'} → *${rec}* (preciso do seu OK)`;
  });
  return ['🔴 *SECRETÁRIA · preciso do seu OK* (zona vermelha — só avanço com sua confirmação):', ...linhas].join('\n');
}
