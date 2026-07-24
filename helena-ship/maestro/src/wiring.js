/**
 * Monta as dependencias REAIS do Maestro (Bitrix, Firebase, Z-API, discadora, alerta, log).
 * Um lugar so — as functions do Netlify apenas chamam isto e passam pro ingest.
 */
import { criaBitrix } from './bitrixWrite.js';
import { criaEstado } from './state.js';
import { criaDiscadora } from './discadora.js';
import { criaWhatsapp } from './whatsapp.js';
import { criaAlerta } from './alert.js';
import { ehLeadDoBruno, acionaAberturaHelena } from './aberturaHelena.js';
import { avaliaGatekeeper, normalizaConfigPiloto } from './gatekeeper.js';
import { logger } from './logger.js';
import { CFG } from './config.js';

// Modo HOMOLOG: não escreve no Bitrix de verdade — loga o que ESCREVERIA (teste sem risco).
function bitrixHomolog(log) {
  return {
    achaNegocioPorTelefone: async () => null,
    upsertNegocio: async (lead, { stageId, corretorId }) => {
      log.info('[HOMOLOG] escreveria negócio no Bitrix', { stageId, corretorId, chave: lead.chave });
      return { dealId: 'HOMOLOG', contactId: 'HOMOLOG', created: true, corretorId };
    },
  };
}

/**
 * Decisão PURA: conjunto Bitrix (Patrocinado Corretor + Bruno + fora da roleta
 * + campanha/produto Michel) + Gatekeeper.
 * Campanha do Michel é filtrada em ehLeadDoBruno (não no Gatekeeper).
 * Gatekeeper: fase / responsável / origem (PILOTO_CAMPANHAS só se setado à parte).
 */
export function decideAberturaComGatekeeper(lead = {}, ctx = {}, cfg = CFG, opts = {}) {
  if (!cfg.HELENA_ABERTURA_URL) {
    return { abrir: false, motivo: 'recurso off (sem HELENA_ABERTURA_URL)' };
  }
  if (!ehLeadDoBruno(lead, cfg, ctx)) {
    return { abrir: false, motivo: 'fora do patrocinado Bruno (fonte/responsável/roleta/campanha Michel)' };
  }

  const piloto = cfg.PILOTO || {};
  // NÃO espelhar CAMPANHAS_HELENA aqui — já filtrado em ehLeadDoBruno (title/campanha/produto).
  // PILOTO_CAMPANHAS continua disponível se alguém quiser allowlist extra no Gatekeeper.
  const campanhasPiloto = String(piloto.CAMPANHAS || '').trim() ? piloto.CAMPANHAS : [];
  // Default: responsável Bruno + origem Patrocinado Corretor / Facebook.
  const responsaveisPiloto = String(piloto.RESPONSAVEIS || '').trim()
    ? piloto.RESPONSAVEIS
    : String(cfg.BRUNO_BITRIX_ID || '1');
  const origensPiloto = String(piloto.ORIGENS || '').trim()
    ? piloto.ORIGENS
    : 'formulario_facebook,facebook ads,facebook,patrocinado corretor';

  const cfgPiloto = normalizaConfigPiloto({
    dealIds: piloto.DEAL_IDS,
    phones: piloto.PHONES,
    campanhas: campanhasPiloto,
    responsaveis: responsaveisPiloto,
    origens: origensPiloto,
    idadeMaxDias: piloto.IDADE_MAX_DIAS,
    categoryId: cfg.CATEGORY_ID,
  });

  // Gatekeeper compara origem em allowlist — se lead.origem for formulario_facebook
  // ou se vier só fonte Bitrix, passa a origem efetiva.
  const origemGate = lead.origem
    || lead.fonte
    || lead.origemAnuncio
    || '';

  const g = avaliaGatekeeper({
    dealId: ctx.dealId,
    phone: lead.telefone,
    campanha: lead.campanha || lead.produto || '',
    origem: origemGate,
    assignedById: ctx.corretorId,
    stageId: ctx.stageId || cfg.ETAPAS?.LEAD_NOVO || 'C1:NEW',
    categoryId: cfg.CATEGORY_ID,
    criadoEmMs: ctx.criadoEmMs,
    ultimaAtividadeMs: ctx.ultimaAtividadeMs,
  }, cfgPiloto, { agoraMs: opts.agoraMs });

  if (!g.permitido) {
    return { abrir: false, motivo: `gatekeeper:${g.codigo}`, gatekeeper: g };
  }
  return { abrir: true, motivo: 'ok', gatekeeper: g };
}

export function montaDeps(scope) {
  const log = logger(scope);
  const whatsapp = criaWhatsapp({});
  return {
    bitrix: CFG.MODO === 'homolog' ? bitrixHomolog(log) : criaBitrix({}),
    estado: criaEstado({}),
    discadora: criaDiscadora({}),
    whatsapp,
    alerta: criaAlerta({ whatsapp, logger: log }),
    logger: log,
    // ABERTURA HELENA: conjunto Bitrix (patrocinado + Facebook Ads + corretor Bruno
    // + campanha Michel) + Gatekeeper + sem histórico (rota lead-form).
    aberturaHelena: async (lead, ctx = {}) => {
      const d = decideAberturaComGatekeeper(lead, ctx, CFG);
      if (!d.abrir) {
        if (d.gatekeeper) {
          log.info('gatekeeper bloqueou abertura', {
            codigo: d.gatekeeper.codigo,
            motivo: d.gatekeeper.motivo,
            dealId: ctx.dealId,
          });
        }
        return d.gatekeeper
          ? { disparado: false, motivo: d.motivo }
          : null;
      }
      return acionaAberturaHelena(lead, {
        url: CFG.HELENA_ABERTURA_URL, key: CFG.HELENA_ABERTURA_TOKEN,
        dealId: ctx.dealId, corretorId: ctx.corretorId,
        modo: CFG.MODO, timeoutMs: CFG.HTTP_TIMEOUT_MS, logger: log,
      });
    },
  };
}

/** parse seguro do corpo do webhook (string JSON ou objeto). */
export function corpo(event) {
  if (!event) return {};
  if (typeof event.body === 'string') { try { return JSON.parse(event.body); } catch { return {}; } }
  return event.body || {};
}

export function resposta(codigo, obj) {
  return { statusCode: codigo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
