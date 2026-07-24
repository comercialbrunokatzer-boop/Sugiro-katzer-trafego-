/**
 * O CORACAO DO MAESTRO — o pipeline unico por onde TODO lead passa (regra #1).
 * normaliza -> deduplica -> cria/atualiza negocio no Bitrix -> atribui corretor ->
 * (se qualificado) enfileira discadora + avisa o lead -> loga tudo -> alerta em erro.
 *
 * Puro em relacao a I/O: recebe as dependencias (bitrix, estado, discadora, whatsapp,
 * alerta, logger). Isso o torna 100% testavel com fakes.
 */
import { CFG } from './config.js';
import { normalizaLead } from './lead.js';
import { proximoCorretor } from './roundRobin.js';
import { composeCartao } from './cartaoLead.js';
import { ehPatrocinado, ehFontePatrocinadoCorretor, BRUNO_BITRIX_ID_DEFAULT } from './aberturaHelena.js';

/**
 * @param bruto  payload cru do webhook
 * @param opts   { origemPadrao, etapa, qualificado:boolean }
 * @param deps   { bitrix, estado, discadora, whatsapp, alerta, logger }
 */
export async function ingestLead(bruto, opts, deps) {
  const { bitrix, estado, discadora, whatsapp, alerta, logger } = deps;
  const { origemPadrao = null, etapa, qualificado = false, avisarCEO = false, evento = null } = opts;

  // IDEMPOTÊNCIA (KOS-001 regra 11): mesmo event_id nunca processa duas vezes.
  if (evento && evento.event_id && estado.viuEvento) {
    if (await estado.viuEvento(evento.event_id)) {
      logger.info('evento repetido ignorado (idempotência)', { event_id: evento.event_id });
      return { ok: true, idempotente: true, event_id: evento.event_id };
    }
  }

  let lead;
  try {
    lead = normalizaLead(bruto, origemPadrao);
  } catch (e) {
    logger.erro('lead invalido', { code: e.code, msg: String(e.message) });
    await alerta('lead invalido', String(e.message));
    return { ok: false, erro: e.code || 'LEAD_INVALIDO' };
  }

  await estado.logEvento({ tipo: 'recebido', origem: lead.origem, chave: lead.chave, etapa });
  logger.info('lead recebido', { origem: lead.origem, chave: lead.chave });

  try {
    // dedup: ja existe negocio pra esse telefone?
    const existente = await bitrix.achaNegocioPorTelefone(lead.telefone);

    // corretor: mantem o dono se ja existe; senao:
    //   Patrocinado Corretor / Facebook Ads → Bruno (CEO) — NÃO roleta; Helena abre
    //   resto → round-robin do pool de corretores
    let corretorId = existente && existente.assignedById ? String(existente.assignedById) : null;
    if (!corretorId) {
      const brunoId = String(CFG.BRUNO_BITRIX_ID || BRUNO_BITRIX_ID_DEFAULT);
      if (ehPatrocinado(lead) && ehFontePatrocinadoCorretor(lead)) {
        corretorId = brunoId;
        logger.info('Patrocinado Corretor → responsável Bruno', { chave: lead.chave, corretorId });
      } else {
        const idx = await estado.lerIndiceRR();
        const rr = proximoCorretor(CFG.BROKER_POOL, idx);
        corretorId = rr.corretor;
        await estado.salvarIndiceRR(rr.indice);
      }
    }

    // cria/atualiza o negocio
    const res = await bitrix.upsertNegocio(lead, { stageId: etapa, corretorId });
    await estado.vincular(lead.leadId, res.dealId);
    await estado.logEvento({ tipo: res.created ? 'negocio_criado' : 'negocio_atualizado', dealId: res.dealId, corretorId: res.corretorId, chave: lead.chave });
    logger.ok(res.created ? 'negocio criado' : 'negocio atualizado', { dealId: res.dealId, corretorId: res.corretorId });

    // CARTÃO DO LEAD no WhatsApp do CEO (o formato oficial). Nunca derruba o fluxo se falhar.
    let cartao = null;
    if (avisarCEO && CFG.KATZER_ALERT_PHONE) {
      try {
        const texto = composeCartao(lead, { campanha: lead.campanha || lead.interesse });
        cartao = await whatsapp.enviaTexto(CFG.KATZER_ALERT_PHONE, texto);
        await estado.logEvento({ tipo: 'cartao_ceo_enviado', dealId: res.dealId, chave: lead.chave });
      } catch (e) {
        logger.erro('falha ao enviar cartão ao CEO', { erro: String(e && e.message) });
      }
    }

    let disc = null, aviso = null;
    if (qualificado) {
      disc = await discadora.enfileira({ dealId: res.dealId, telefone: lead.telefone, corretorId: res.corretorId });
      const nome = CFG.BROKER_NOMES[String(res.corretorId)] || 'nosso corretor';
      aviso = await whatsapp.enviaTexto(lead.telefone, `Perfeito! O corretor ${nome} já vai te chamar por aqui. 🏠`);
      await estado.logEvento({ tipo: 'qualificado_encaminhado', dealId: res.dealId, disc, aviso });
    }

    // ABERTURA HELENA (best-effort, NUNCA quebra o fluxo): a decisão de disparar (campanha
    // do Bruno? recurso ligado?) vive no wiring, injetada como deps.aberturaHelena. Aqui o
    // ingest só delega. Sem a dep (ou retornando null), nada acontece — desligado por padrão.
    let abertura = null;
    if (typeof deps.aberturaHelena === 'function') {
      try {
        abertura = await deps.aberturaHelena(lead, { dealId: res.dealId, corretorId: res.corretorId });
        if (abertura) await estado.logEvento({ tipo: 'abertura_helena', dealId: res.dealId, chave: lead.chave, abertura });
      } catch (e) {
        logger.erro('abertura Helena (nao quebra o fluxo)', { erro: String(e && e.message) });
      }
    }

    if (evento && evento.event_id && estado.marcaEvento) await estado.marcaEvento(evento.event_id, res);
    return { ok: true, dealId: res.dealId, criado: res.created, corretorId: res.corretorId, cartaoCEO: cartao, discadora: disc, aviso, abertura };
  } catch (e) {
    logger.erro('falha no ingest', { chave: lead.chave, erro: String(e && e.message) });
    await estado.logEvento({ tipo: 'erro', chave: lead.chave, erro: String(e && e.message) });
    // fila de reprocessamento (KOS-001 §5): erro NUNCA some — pode ser re-executado.
    if (estado.enfileiraErro) await estado.enfileiraErro({ evento, chave: lead.chave, erro: String(e && e.message) });
    await alerta('falha ao processar lead', `${lead.chave}: ${e && e.message}`);
    return { ok: false, erro: 'INGEST_FALHOU', detalhe: String(e && e.message) };
  }
}
