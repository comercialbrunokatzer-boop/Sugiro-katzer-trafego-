/**
 * GATEKEEPER DO PILOTO — portão P0 antes de qualquer contato AUTOMÁTICO da Helena.
 *
 * Problema do CEO (handover Katzer OS): cards antigos, Rampage, fora do piloto ou
 * em fase avançada NÃO podem receber toque automático. Sem este portão, abertura,
 * varredura de carteira e cadências futuras disparam indevidamente.
 *
 * Este módulo é PURO/testável: recebe o card (já lido do Bitrix) + config e decide
 * PERMITIR ou BLOQUEAR. NÃO envia mensagem, NÃO escreve no Bitrix.
 *
 * Filosofia (igual aberturaHelena / varredura): FAIL-CLOSED.
 *  - Sem piloto configurado (listas vazias) → bloqueia tudo.
 *  - Etapa terminal / avançada → bloqueia.
 *  - Card velho fora do allowlist → bloqueia.
 *
 * A fiação (chamar antes de acionaAberturaHelena / envio da varredura) vem em PR
 * seguinte, gated por GO do CEO.
 */
import { estagioPorStageId } from './secretaria.js';

/** Fases onde contato automático de 1º toque / insistência faz sentido. */
export const FASES_AUTO_OK = new Set(['Leads Novos', 'Tentando Contato']);

/** Nunca tocar automaticamente — encerrado ou "não agora". */
export const FASES_BLOQUEIO_ABSOLUTO = new Set(['Rampage', 'Perdido', 'Ganhou']);

const DIA_MS = 86400000;

/**
 * Normaliza config do piloto (env ou objeto injetado).
 * @param {object} raw
 * @returns {object}
 */
export function normalizaConfigPiloto(raw = {}) {
  const dealIds = toSet(raw.dealIds ?? raw.PILOTO_DEAL_IDS);
  const phones = toSet((raw.phones ?? raw.PILOTO_PHONES), /*normalizePhone*/ true);
  const campanhas = toSetLower(raw.campanhas ?? raw.PILOTO_CAMPANHAS);
  const responsaveis = toSet(raw.responsaveis ?? raw.PILOTO_RESPONSAVEIS);
  const origens = toSetLower(raw.origens ?? raw.PILOTO_ORIGENS);
  const idadeMaxDias = Number(raw.idadeMaxDias ?? raw.PILOTO_IDADE_MAX_DIAS ?? 30);
  const categoryId = String(raw.categoryId ?? raw.CATEGORY_ID ?? '1');

  return {
    dealIds,
    phones,
    campanhas,
    responsaveis,
    origens,
    idadeMaxDias: Number.isFinite(idadeMaxDias) && idadeMaxDias > 0 ? idadeMaxDias : 30,
    categoryId,
  };
}

/**
 * Decide se o card pode receber contato AUTOMÁTICO da Helena.
 *
 * @param {object} card
 * @param {string|number} [card.dealId]
 * @param {string} [card.stageId]     STAGE_ID Bitrix (ex.: C1:NEW)
 * @param {string} [card.estagio]     nome canônico (opcional; stageId tem prioridade de resolução)
 * @param {string} [card.phone]
 * @param {string} [card.campanha]
 * @param {string} [card.origem]
 * @param {string|number} [card.assignedById]
 * @param {string|number} [card.categoryId]
 * @param {number} [card.criadoEmMs]  DATE_CREATE em ms
 * @param {number} [card.ultimaAtividadeMs]
 * @param {object} [config]          saída de normalizaConfigPiloto ou raw
 * @param {object} [opts]
 * @param {number} [opts.agoraMs]
 * @returns {{ permitido:boolean, codigo:string, motivo:string, estagio:string|null, noPiloto:boolean }}
 */
export function avaliaGatekeeper(card = {}, config = {}, opts = {}) {
  const cfg = hasSets(config) ? config : normalizaConfigPiloto(config);
  const agoraMs = Number(opts.agoraMs ?? Date.now());

  const dealId = card.dealId != null ? String(card.dealId).trim() : '';
  const phone = digits(card.phone);
  const campanha = String(card.campanha || '').trim().toLowerCase();
  const origem = String(card.origem || '').trim().toLowerCase();
  const assigned = card.assignedById != null ? String(card.assignedById).trim() : '';
  const categoryId = card.categoryId != null ? String(card.categoryId).trim() : '';

  const estagio = card.estagio || estagioPorStageId(card.stageId) || null;

  // 1) Funil certo
  if (categoryId && cfg.categoryId && categoryId !== cfg.categoryId) {
    return negado('FORA_FUNIL', `categoryId ${categoryId} ≠ funil piloto ${cfg.categoryId}`, estagio, false);
  }

  // 2) Precisa de telefone pra qualquer WhatsApp automático
  if (!phone) {
    return negado('SEM_TELEFONE', 'card sem telefone — contato automático impossível', estagio, false);
  }

  // 3) Etapa absoluta (Rampage / Perdido / Ganhou)
  if (estagio && FASES_BLOQUEIO_ABSOLUTO.has(estagio)) {
    return negado('FASE_TERMINAL', `etapa "${estagio}" nunca recebe contato automático`, estagio, false);
  }

  // 4) Só Leads Novos / Tentando Contato no automático de 1º toque
  if (!estagio) {
    return negado('FASE_DESCONHECIDA', 'STAGE_ID não mapeado no funil Katzer — bloquear por segurança', null, false);
  }
  if (!FASES_AUTO_OK.has(estagio)) {
    return negado(
      'FASE_AVANCADA',
      `etapa "${estagio}" fora do piloto de contato automático (só Leads Novos / Tentando Contato)`,
      estagio,
      false,
    );
  }

  // 5) Piloto: precisa casar COM PELO MENOS um critério configurado.
  //    Critérios: deal / telefone / campanha / responsável / origem.
  //    Se NENHUM → FAIL-CLOSED (nada dispara).
  const pilotoVazio = cfg.dealIds.size === 0
    && cfg.phones.size === 0
    && cfg.campanhas.size === 0
    && cfg.responsaveis.size === 0
    && cfg.origens.size === 0;

  if (pilotoVazio) {
    return negado(
      'PILOTO_VAZIO',
      'nenhum deal/telefone/campanha/responsável/origem no piloto — FAIL-CLOSED (zero risco)',
      estagio,
      false,
    );
  }

  // Casa por deal/telefone/campanha SE essas listas existem.
  // Se o piloto é só responsável+origem (padrão Bruno patrocinado), não exige deal/campanha.
  const temAllowlistCard = cfg.dealIds.size > 0 || cfg.phones.size > 0 || cfg.campanhas.size > 0;
  if (temAllowlistCard) {
    const noPiloto = casaPiloto({ dealId, phone, campanha }, cfg);
    if (!noPiloto) {
      return negado('FORA_PILOTO', 'card fora da allowlist do piloto (deal/telefone/campanha)', estagio, false);
    }
  }

  // 6) Origem (se o piloto restringiu origens)
  if (cfg.origens.size > 0 && origem && !cfg.origens.has(origem)) {
    return negado('ORIGEM_BLOQUEADA', `origem "${origem}" fora das origens do piloto`, estagio, true);
  }

  // 7) Responsável (se o piloto restringiu ASSIGNED_BY_ID)
  if (cfg.responsaveis.size > 0 && assigned && !cfg.responsaveis.has(assigned)) {
    return negado(
      'RESPONSAVEL_FORA',
      `ASSIGNED_BY_ID ${assigned} fora do pool do piloto`,
      estagio,
      true,
    );
  }

  // 8) Idade do card — anti "carteira zumbi" mesmo dentro do piloto
  const criado = Number(card.criadoEmMs);
  if (Number.isFinite(criado) && criado > 0 && Number.isFinite(agoraMs)) {
    const idadeDias = (agoraMs - criado) / DIA_MS;
    if (idadeDias > cfg.idadeMaxDias) {
      // Exceção: se tem atividade recente (< 7 dias), ainda pode (lead voltou).
      const ult = Number(card.ultimaAtividadeMs);
      const ativoRecente = Number.isFinite(ult) && (agoraMs - ult) <= 7 * DIA_MS;
      if (!ativoRecente) {
        return negado(
          'CARD_ANTIGO',
          `card com ${Math.floor(idadeDias)} dias (> ${cfg.idadeMaxDias}) e sem atividade recente`,
          estagio,
          true,
        );
      }
    }
  }

  return {
    permitido: true,
    codigo: 'OK',
    motivo: 'elegível para contato automático no piloto',
    estagio,
    noPiloto: true,
  };
}

/**
 * Filtra uma lista de cards. Útil pra varredura / cron.
 * @returns {{ elegiveis: object[], bloqueados: object[] }}
 */
export function filtraElegiveis(cards = [], config = {}, opts = {}) {
  const cfg = hasSets(config) ? config : normalizaConfigPiloto(config);
  const elegiveis = [];
  const bloqueados = [];
  for (const card of (Array.isArray(cards) ? cards : [])) {
    const r = avaliaGatekeeper(card, cfg, opts);
    const item = { ...card, _gatekeeper: r };
    if (r.permitido) elegiveis.push(item);
    else bloqueados.push(item);
  }
  return { elegiveis, bloqueados };
}

// ── helpers ──────────────────────────────────────────────────────────

function casaPiloto({ dealId, phone, campanha }, cfg) {
  if (dealId && cfg.dealIds.has(dealId)) return true;
  if (phone && cfg.phones.has(phone)) return true;
  if (campanha && [...cfg.campanhas].some((c) => c && campanha.includes(c))) return true;
  return false;
}

function negado(codigo, motivo, estagio, noPiloto) {
  return { permitido: false, codigo, motivo, estagio, noPiloto };
}

function toSet(v, asPhone = false) {
  const arr = Array.isArray(v)
    ? v
    : String(v || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  return new Set(arr.map((x) => (asPhone ? digits(x) : String(x).trim())).filter(Boolean));
}

function toSetLower(v) {
  const arr = Array.isArray(v)
    ? v
    : String(v || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  return new Set(arr.map((x) => String(x).trim().toLowerCase()).filter(Boolean));
}

function digits(v) {
  return String(v || '').replace(/\D/g, '');
}

function hasSets(cfg) {
  return cfg && cfg.dealIds instanceof Set && cfg.phones instanceof Set && cfg.campanhas instanceof Set;
}

export default { avaliaGatekeeper, filtraElegiveis, normalizaConfigPiloto, FASES_AUTO_OK, FASES_BLOQUEIO_ABSOLUTO };
