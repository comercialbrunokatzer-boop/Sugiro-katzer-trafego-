/**
 * CADENCIA PATROCINADO BRUNO — fila pura (sem rede).
 *
 * Depois da retomada, cuida das fases Tentando Contato / Mapeamento e deixa um
 * gancho simples para Follow Up usando o cerebro existente de follow-up.
 */
import { proximoFollowup } from './followup.js';
import {
  TEMPLATES_RETOMADA,
  detectarProdutoRetomada,
  dentroJanelaComercial,
  ehPatrocinadoDeal,
  ehResponsavelBruno,
  msDeIso,
  passaAntiSpam,
  personalizaTemplate,
  soDigitos,
} from './retomadaPatrocinado.js';

export const FASES_CADENCIA = new Set(['Tentando Contato', 'Mapeamento']);
export const STAGE_IDS_CADENCIA = new Set(['C1:PREPARATION', 'C1:PREPAYMENT_INVOICE']);
export const FASE_FOLLOWUP_POS_INTERESSE = 'Follow Up';
export const STAGE_ID_FOLLOWUP_POS_INTERESSE = 'C1:UC_7P0WD3';

export const TEMPLATES_CADENCIA = {
  tentando_contato: 'Oi {nome}, tudo bem? Aqui e a Helena, da Katzer. Passei rapidinho pra retomar seu interesse em {produto}. Prefere que eu te mande uma opcao objetiva por aqui ou que o Bruno te chame?',
  mapeamento: 'Oi {nome}, tudo bem? Pra eu organizar melhor seu interesse em {produto}: voce quer receber valores/condicoes ou prefere marcar um bate-papo rapido pra filtrar as melhores opcoes?',
  followup_pos_interesse: 'Oi {nome}, tudo bem? So pra nao deixar seu interesse esfriar: quer que eu retome as opcoes que combinam contigo ou prefere falar direto com o Bruno?',
};

export function faseCadencia(deal = {}) {
  const fase = String(deal.fase || deal.estagio || '').trim();
  if (FASES_CADENCIA.has(fase)) return fase;
  const stage = String(deal.stageId || deal.STAGE_ID || '').trim();
  if (stage === 'C1:PREPARATION') return 'Tentando Contato';
  if (stage === 'C1:PREPAYMENT_INVOICE') return 'Mapeamento';
  return null;
}

export function ehFaseCadencia(deal = {}) {
  return !!faseCadencia(deal) || ehFaseFollowupPosInteresse(deal);
}

export function ehFaseFollowupPosInteresse(deal = {}) {
  const fase = String(deal.fase || deal.estagio || '').trim();
  if (fase === FASE_FOLLOWUP_POS_INTERESSE) return true;
  const stage = String(deal.stageId || deal.STAGE_ID || '').trim();
  return stage === STAGE_ID_FOLLOWUP_POS_INTERESSE;
}

export function tipoCadencia(deal = {}) {
  const fase = faseCadencia(deal);
  if (fase === 'Tentando Contato') return 'tentando_contato';
  if (fase === 'Mapeamento') return 'mapeamento';
  if (ehFaseFollowupPosInteresse(deal)) return 'followup_pos_interesse';
  return null;
}

export function ehElegivelCadencia(deal = {}, opts = {}) {
  const {
    brunoId = '1',
    agoraMs = Date.now(),
    maxIdadeDias = 90,
    incluirFollowupPosInteresse = true,
  } = opts;

  if (!ehResponsavelBruno(deal, brunoId)) {
    return { ok: false, motivo: 'nao_bruno' };
  }
  if (!ehPatrocinadoDeal(deal)) {
    return { ok: false, motivo: 'nao_patrocinado' };
  }
  const tipo = tipoCadencia(deal);
  if (!tipo || (tipo === 'followup_pos_interesse' && !incluirFollowupPosInteresse)) {
    return { ok: false, motivo: 'fase_fora' };
  }
  const tel = soDigitos(deal.telefone || deal.phone || '');
  if (tel.length < 8) {
    return { ok: false, motivo: 'sem_telefone' };
  }
  const criado = msDeIso(deal.dateCreate || deal.DATE_CREATE) || msDeIso(deal.dateModify || deal.DATE_MODIFY);
  if (criado != null) {
    const idadeDias = (agoraMs - criado) / 86400000;
    if (idadeDias > maxIdadeDias) {
      return { ok: false, motivo: 'muito_antigo' };
    }
  }
  return { ok: true, motivo: 'ok', tipo };
}

export function passaAntiSpamCadencia(estado = {}, opts = {}) {
  const base = {
    ...estado,
    lastRetomadaMs: estado.lastCadenciaMs || estado.lastRetomadaMs || estado.lastFollowupMs,
  };
  return passaAntiSpam(base, opts);
}

export function mensagemCadencia(deal = {}, tipo = tipoCadencia(deal)) {
  const produtoKey = detectarProdutoRetomada(deal);
  const produto = TEMPLATES_RETOMADA[produtoKey]?.produto || 'imovel no litoral de SC';
  const tpl = TEMPLATES_CADENCIA[tipo] || TEMPLATES_CADENCIA.tentando_contato;
  return personalizaTemplate(tpl.replace(/\{produto\}/g, produto), deal.nome || deal.name);
}

export function montaLeadFollowup(deal = {}, estado = {}, opts = {}) {
  const agoraMs = opts.agoraMs || Date.now();
  const ultimoContatoMs = Number(
    estado.lastHelenaMs
    || estado.lastCadenciaMs
    || estado.lastRetomadaMs
    || msDeIso(deal.dateModify || deal.DATE_MODIFY)
    || msDeIso(deal.dateCreate || deal.DATE_CREATE)
    || agoraMs,
  );
  const lastClientMsgMs = Number(estado.lastClientMsgMs || 0) || null;
  return {
    ultimo_contato_ms: ultimoContatoMs,
    niveis_disparados: estado.niveisDisparadosFollowup || estado.followupNiveis || [],
    enviadas_hoje: estado.enviadasHojeLead || estado.followupEnviadasHoje || 0,
    respondido_humano: !!estado.handledByHuman,
    cliente_respondeu: !!(lastClientMsgMs && lastClientMsgMs >= ultimoContatoMs),
    fora_da_janela: !dentroJanelaComercial(agoraMs),
    followup_pendente: !!estado.followupPendente,
    opt_out: !!estado.optOut,
    agendamento_confirmado: !!estado.agendamentoConfirmado,
    encerrado: !!estado.encerrado,
  };
}

function itemCadencia(deal, tipo) {
  const produtoKey = detectarProdutoRetomada(deal);
  const tplRetomada = TEMPLATES_RETOMADA[produtoKey] || TEMPLATES_RETOMADA.generica;
  return {
    dealId: String(deal.id || deal.dealId || ''),
    telefone: soDigitos(deal.telefone || deal.phone),
    nome: deal.nome || deal.name || '',
    title: deal.title || '',
    fase: faseCadencia(deal) || FASE_FOLLOWUP_POS_INTERESSE,
    tipo,
    produtoKey,
    produto: tplRetomada.produto,
    mensagem: mensagemCadencia(deal, tipo),
    midiaChave: tplRetomada.midiaChave,
    midiaTipo: tplRetomada.midiaTipo,
  };
}

/**
 * Monta lote ordenado (mais novos primeiro), com template + midia.
 * @returns {{ lote: object[], pulados: object[], alertas: object[] }}
 */
export function montaFilaCadencia(deals = [], opts = {}) {
  const {
    brunoId = '1',
    agoraMs = Date.now(),
    maxIdadeDias = 90,
    maxLote = 4,
    estadosPorTel = {},
    intervaloMinHoras = 36,
    enviadasHojeGlobal = 0,
    limiteDiario = 12,
    limiteDiarioFollowupLead = 3,
    incluirFollowupPosInteresse = true,
  } = opts;

  const pulados = [];
  const alertas = [];
  const ok = [];

  if (!dentroJanelaComercial(agoraMs)) {
    return { lote: [], pulados: [{ motivo: 'fora_janela_comercial' }], alertas };
  }
  if (enviadasHojeGlobal >= limiteDiario) {
    return { lote: [], pulados: [{ motivo: 'teto_diario_global' }], alertas };
  }

  const restantes = Math.max(0, limiteDiario - enviadasHojeGlobal);

  for (const deal of deals) {
    const elig = ehElegivelCadencia(deal, { brunoId, agoraMs, maxIdadeDias, incluirFollowupPosInteresse });
    if (!elig.ok) {
      pulados.push({ dealId: deal.id || deal.dealId, motivo: elig.motivo });
      continue;
    }
    const tel = soDigitos(deal.telefone || deal.phone);
    const st = estadosPorTel[tel] || estadosPorTel[tel.slice(-11)] || {};
    if (elig.tipo === 'followup_pos_interesse') {
      if (st.handledByHuman) {
        pulados.push({ dealId: deal.id || deal.dealId, telefone: tel, motivo: 'humano_assumiu' });
        continue;
      }
      if (st.lastClientMsgMs && (agoraMs - st.lastClientMsgMs) < 7 * 86400000) {
        pulados.push({ dealId: deal.id || deal.dealId, telefone: tel, motivo: 'cliente_respondeu_recente' });
        continue;
      }
      if (st.lastFollowupMs && (agoraMs - st.lastFollowupMs) < intervaloMinHoras * 3600000) {
        pulados.push({ dealId: deal.id || deal.dealId, telefone: tel, motivo: 'intervalo_minimo' });
        continue;
      }
      const leadFollowup = montaLeadFollowup(deal, st, { agoraMs });
      const prox = proximoFollowup(leadFollowup, { agoraMs, limiteDiario: limiteDiarioFollowupLead });
      if (prox.acao !== 'ESCALAR') {
        pulados.push({ dealId: deal.id || deal.dealId, telefone: tel, motivo: `followup_${prox.motivo}` });
        continue;
      }
      if (prox.para !== 'HELENA') {
        alertas.push({ dealId: String(deal.id || deal.dealId || ''), telefone: tel, ...prox });
        pulados.push({ dealId: deal.id || deal.dealId, telefone: tel, motivo: `followup_alerta_${prox.para}` });
        continue;
      }
    } else {
      const spam = passaAntiSpamCadencia(st, { agoraMs, intervaloMinHoras, limiteDiario: 99 });
      if (!spam.ok) {
        pulados.push({ dealId: deal.id || deal.dealId, telefone: tel, motivo: spam.motivo });
        continue;
      }
    }

    ok.push(itemCadencia(deal, elig.tipo));
  }

  ok.sort((a, b) => String(b.dealId).localeCompare(String(a.dealId), undefined, { numeric: true }));

  const lote = ok.slice(0, Math.min(maxLote, restantes));
  for (const extra of ok.slice(lote.length)) {
    pulados.push({ dealId: extra.dealId, motivo: 'fora_do_lote' });
  }
  return { lote, pulados, alertas };
}

export default {
  FASES_CADENCIA,
  STAGE_IDS_CADENCIA,
  TEMPLATES_CADENCIA,
  ehElegivelCadencia,
  ehFaseCadencia,
  mensagemCadencia,
  montaFilaCadencia,
  montaLeadFollowup,
  passaAntiSpamCadencia,
  tipoCadencia,
};
