/**
 * PONTE da Secretária IA: liga a conversa REAL da Helena (Firebase helena_conversas:
 * { messages: [{ role:'user'|'assistant', content, ts }] }) ao cérebro da Secretária
 * (src/secretaria.js) e devolve a DECISÃO — atualizar o Bitrix OU mandar pra revisão.
 *
 * DESENHO SEGURO (homolog):
 *  - Sem Claude configurado, usa o farejador determinístico (estagioPorSinais) como
 *    parecer — zero custo, zero risco. A interpretação FINA (Claude) entra via claudeFn.
 *  - NADA é escrito no Bitrix aqui: quem escreve é o wiring do Maestro, e só em produção.
 */
import {
  estagioPorSinais, detectaSinais, promptSecretaria, decideAtualizacao, estagioPorStageId,
} from './secretaria.js';
import { decidePrimeiroContato } from './primeiroContato.js';

/** Converte as mensagens da Helena e preserva a prova de envio.
 *
 * Compatibilidade: o helena.js histórico só persistia {role,content,ts}, mas fazia
 * isso DEPOIS de o await da Z-API concluir. Por isso uma mensagem assistant legada
 * com ts é evidência válida de envio. As novas mensagens também carregam
 * envioConfirmado/statusEnvio/messageId explicitamente.
 */
export function conversaHelenaParaMsgs(conv = {}) {
  const messages = Array.isArray(conv.messages) ? conv.messages : [];
  return messages.map((m, index) => {
    const autor = m.role === 'user' ? 'cliente' : 'equipe';
    const ts = Number(m.enviadoEmMs ?? m.sentAt ?? m.ts ?? m.timestamp);
    const status = String(m.statusEnvio || m.status || '').toLowerCase();
    const statusOk = ['sent', 'sent_by_api', 'delivered', 'enviado', 'confirmado', 'success'].includes(status);
    const legadoConfirmado = autor === 'equipe'
      && m.envioConfirmado !== false
      && Number.isFinite(ts)
      && ts > 0;
    return {
      autor,
      texto: (m.content || m.texto || '').toString(),
      messageId: m.messageId || m.message_id || m.id || m.zaapId || m.zapiMessageId
        || (legadoConfirmado ? `legacy-${ts}-${index}` : null),
      enviadaEmMs: Number.isFinite(ts) && ts > 0 ? ts : null,
      envioConfirmado: m.envioConfirmado === true || statusOk || legadoConfirmado,
      statusEnvio: status || (legadoConfirmado ? 'legacy-confirmed' : null),
    };
  });
}

/** Primeira mensagem da Helena que representa envio confirmado. */
export function encontraPrimeiroContatoConfirmado(msgs = []) {
  return (msgs || [])
    .filter((m) => String(m.autor || '').toLowerCase() === 'equipe'
      && m.envioConfirmado === true
      && !!m.messageId
      && Number.isFinite(Number(m.enviadaEmMs)))
    .sort((a, b) => Number(a.enviadaEmMs) - Number(b.enviadaEmMs))[0] || null;
}

/** Só as falas do CLIENTE (Lei 01: fala da equipe/Helena nunca é evidência). */
export function textoDoCliente(msgs = []) {
  return msgs
    .filter((m) => String(m.autor || '').toLowerCase() === 'cliente')
    .map((m) => m.texto)
    .filter(Boolean)
    .join('\n');
}

/**
 * Parecer DETERMINÍSTICO (fallback sem Claude): estágio pelo farejador + evidências
 * reais (linhas do cliente que casaram com algum sinal). Conservador de propósito.
 */
export function parecerDeterministico(msgs = []) {
  const linhasCliente = msgs
    .filter((m) => String(m.autor || '').toLowerCase() === 'cliente')
    .map((m) => m.texto)
    .filter(Boolean);
  const texto = linhasCliente.join('\n');
  const estagio = estagioPorSinais(texto);
  const evidence = linhasCliente.filter((l) => detectaSinais(l).length > 0).slice(0, 4);
  const temSinal = evidence.length > 0;
  return {
    recommended_stage: estagio,
    confidence: temSinal ? 0.75 : 0.5, // sem sinal claro -> confiança baixa (trava segura)
    evidence,
    resumo: temSinal
      ? `Farejador: sinais de ${estagio} na fala do cliente.`
      : 'Farejador: cliente engajou mas sem sinal forte; segue em Mapeamento com confiança baixa.',
    next_action: null,
    requires_human_review: false,
  };
}

/**
 * Valida o evento de primeiro contato confirmado (contrato CEO-aprovado, PR #90).
 *
 * Contrato exigido:
 *   { enviado: true, messageId: "<id-não-vazio>", sentAt: <ms>, autor: "helena" }
 *
 * Rejeita: enviado falso/ausente, autor diferente de "helena" (Bruno/Carol/Michel/corretor),
 * messageId ausente/vazio, e qualquer evento que não seja objeto.
 *
 * @param {*} evt
 * @returns {boolean}
 */
export function validaEventoConfirmado(evt) {
  if (!evt || typeof evt !== 'object') return false;
  if (evt.enviado !== true) return false;
  if (String(evt.autor || '').toLowerCase() !== 'helena') return false;
  const mid = String(evt.messageId || '').trim();
  return mid.length > 0;
}

/**
 * Roda a Secretária sobre uma conversa da Helena e devolve a decisão.
 *
 * @param {object} conv     conversa no formato helena_conversas
 * @param {object} opts
 *   - estagioAtual        nome canônico da fase (ex.: 'Leads Novos') ou stageId (ex.: 'C1:NEW').
 *       null = fase desconhecida (não aciona primeiro contato; callers devem sempre passar explícito).
 *   - dealId              ID do negócio no Bitrix. null = deal desconhecido (callers passam explícito).
 *   - claudeFn(prompt)    interpretação fina da IA (opcional)
 *   - primeiroContatoConfirmado  evento EXPLÍCITO de envio confirmado da Helena (contrato PR #90):
 *       { enviado:true, messageId:"<id>", sentAt:<ms>, autor:"helena" }
 *       Quando presente e válido, tem prioridade sobre o histórico de mensagens.
 *   - processadosIds      Set<string> de messageIds já processados (idempotência).
 *       O mesmo messageId não move nem comenta o card duas vezes.
 *       Responsabilidade do caller: adicionar o messageId ao Set após `aplica()` retornar
 *       `aplicado:true`; o caller é responsável por persistir o Set entre invocações.
 *       Esta função NÃO muta o Set — apenas consulta.
 */
export async function rodaSecretaria(conv = {}, {
  estagioAtual = null,
  dealId = null,
  claudeFn = null,
  primeiroContatoConfirmado = null,
  processadosIds = null,
} = {}) {
  // Normaliza estagioAtual: aceita tanto nome canônico quanto stageId (C1:...).
  const estagioNome = estagioPorStageId(estagioAtual) || estagioAtual;

  const msgs = conversaHelenaParaMsgs(conv);
  let parecer;
  let fonte;
  if (typeof claudeFn === 'function') {
    try {
      const raw = await claudeFn(promptSecretaria(textoDoCliente(msgs)));
      parecer = typeof raw === 'string' ? JSON.parse(raw) : raw;
      fonte = 'claude';
    } catch {
      parecer = parecerDeterministico(msgs);
      fonte = 'deterministico_fallback';
    }
  } else {
    parecer = parecerDeterministico(msgs);
    fonte = 'deterministico';
  }
  const decisao = decideAtualizacao(parecer, { estagioAtual: estagioNome, dealId });

  // Regra determinística do CEO: Leads Novos → Tentando Contato quando a Helena
  // efetivamente enviou uma mensagem confirmada. Não sobrepõe decisão mais avançada
  // da Secretária e nunca regride.
  //
  // Fontes de evidência aceitas (a explícita tem prioridade):
  //  (a) Evento EXPLÍCITO validado (primeiroContatoConfirmado) — contrato CEO/PR #90.
  //      Garante: enviado=true, autor="helena", messageId não-vazio.
  //  (b) Mensagem com envioConfirmado=true extraída do histórico persistido
  //      (conversaHelenaParaMsgs + encontraPrimeiroContatoConfirmado).
  //
  // Idempotência: processadosIds (Set) bloqueia reprocessamento do mesmo messageId.
  if (estagioNome === 'Leads Novos' && decisao.acao !== 'ATUALIZAR') {
    let contatoEntry = null;

    if (validaEventoConfirmado(primeiroContatoConfirmado)) {
      // (a) Evento explícito validado — prioridade máxima.
      contatoEntry = {
        messageId: String(primeiroContatoConfirmado.messageId).trim(),
        enviadaEmMs: Number(primeiroContatoConfirmado.sentAt) || null,
      };
    } else {
      // (b) Extrai do histórico persistido (legado e novos com campos de envio).
      const c = encontraPrimeiroContatoConfirmado(msgs);
      if (c) contatoEntry = { messageId: c.messageId, enviadaEmMs: c.enviadaEmMs };
    }

    if (contatoEntry) {
      // Idempotência: não processa o mesmo messageId duas vezes.
      // O caller deve adicionar ao Set após aplica() retornar aplicado:true.
      if (processadosIds instanceof Set && processadosIds.has(contatoEntry.messageId)) {
        return { fonte, parecer, acao: 'IGNORADO', motivo: 'duplicate', messageId: contatoEntry.messageId };
      }
      const pc = decidePrimeiroContato({
        estagioAtual: estagioNome, dealId,
        resumo: parecer && parecer.resumo,
        contatoConfirmado: true,
        messageId: contatoEntry.messageId,
        enviadoEmMs: contatoEntry.enviadaEmMs,
      });
      if (pc) return { fonte, parecer, ...pc, _regra: 'primeiro-contato', messageId: contatoEntry.messageId };
    }
  }

  return { fonte, parecer, ...decisao };
}
