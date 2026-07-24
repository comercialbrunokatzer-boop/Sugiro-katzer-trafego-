/**
 * RETOMADA PATROCINADO BRUNO — fila pura (sem rede).
 *
 * Quem entra:
 *  - Responsável = Bruno (ASSIGNED_BY_ID)
 *  - Patrocinado / form Meta (não tráfego orgânico / não roleta)
 *  - Fase = Leads Novos OU Tentando Contato
 *  - Recente (janela de dias)
 *
 * Anti-spam (organizado, ritmo humano):
 *  - lote pequeno por corrida
 *  - teto diário
 *  - intervalo mínimo entre toques no mesmo telefone
 *  - janela comercial BRT
 *  - pula se humano assumiu / cliente respondeu recente / já retomado
 */

export const FASES_RETOMADA = new Set(['Leads Novos', 'Tentando Contato']);
export const STAGE_IDS_RETOMADA = new Set(['C1:NEW', 'C1:PREPARATION']);

/** Templates aprovados (MENSAGENS-RETOMADA.md) — curtos, com {nome} e gancho de mídia. */
export const TEMPLATES_RETOMADA = {
  fort_myers: {
    produto: 'Fort Myers',
    midiaChave: 'fort_myers',
    midiaTipo: 'capa',
    pt: 'Oi {nome}, tudo bem? Aqui é a Helena, da Katzer 🙂 Você chegou interessado no Fort Myers (Penha, frente mar) e eu não quis te deixar sem retorno. Te mando uma foto da vista — o que você busca mais: morar, investir ou veraneio?',
  },
  grant_home: {
    produto: 'Grant Home Club',
    midiaChave: 'grant_home',
    midiaTipo: 'capa',
    pt: 'Oi {nome}, tudo bem? Aqui é a Helena, da Katzer 🙂 Você demonstrou interesse num pé na areia — separei o Grant Home Club (Barra Velha, 0m do mar). Posso te mandar uma foto e te explicar rapidinho?',
  },
  celebration: {
    produto: 'Celebration',
    midiaChave: 'celebration',
    midiaTipo: 'capa',
    pt: 'Oi {nome}, tudo bem? Aqui é a Helena, da Katzer 🙂 Queria te retomar o Celebration (Piçarras, quadra mar). Tem opção a partir de uns R$770 mil. Te mando uma foto? Você pensa em morar, veranear ou investir?',
  },
  jardim_da_costa: {
    produto: 'Jardim da Costa',
    midiaChave: 'jardim_da_costa',
    midiaTipo: 'capa',
    pt: 'Oi {nome}, tudo bem? Aqui é a Helena, da Katzer 🙂 Separei o Jardim da Costa (Barra Velha, ~500-600m do mar) pra gente retomar. Te mando uma foto do projeto?',
  },
  portugal: {
    produto: 'Portugal / BR_SC',
    midiaChave: 'fort_myers',
    midiaTipo: 'capa',
    pt: 'Oi {nome}, tudo bem? Aqui é a Helena, da Katzer 🙂 Você veio pelo anúncio e eu não quis te deixar no vácuo. Te mando uma foto do que combina com o que você viu — o foco é mais morar, investir ou veraneio?',
  },
  generica: {
    produto: null,
    midiaChave: null,
    midiaTipo: null,
    pt: 'Oi {nome}, tudo bem? Aqui é a Helena, da Katzer 🙂 A gente ficou de conversar sobre imóvel no litoral de SC e eu não quis te deixar no vácuo. Você busca mais morar, investir ou veraneio?',
  },
};

export function soDigitos(s = '') {
  return String(s || '').replace(/\D+/g, '');
}

export function primeiroNome(nome = '') {
  const p = String(nome || '').trim().split(/\s+/)[0] || '';
  if (!p) return '';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

export function personalizaTemplate(tpl, nome) {
  const n = primeiroNome(nome);
  if (!n) {
    return String(tpl || '').replace(/Oi \{nome\}, /g, 'Oi, ').replace(/\{nome\}/g, '');
  }
  return String(tpl || '').replace(/\{nome\}/g, n);
}

/** Sinais de patrocinado / form (não orgânico). */
export function ehPatrocinadoDeal(deal = {}) {
  const blob = [
    deal.title,
    deal.titleForm,
    deal.fonte,
    deal.origemAnuncio,
    deal.sourceDescription,
    deal.sourceId,
    deal.comments,
  ].filter(Boolean).join(' ').toLowerCase();
  if (!blob) return false;
  return /patroc|patrocinado\s*corretor|lead\s*patroc|preencher formul|formulario_facebook|facebook\s*ads|instant\s*form/.test(blob);
}

export function ehFaseRetomada(deal = {}) {
  const fase = String(deal.fase || deal.estagio || '').trim();
  if (FASES_RETOMADA.has(fase)) return true;
  const stage = String(deal.stageId || deal.STAGE_ID || '').trim();
  return STAGE_IDS_RETOMADA.has(stage);
}

export function ehResponsavelBruno(deal = {}, brunoId = '1') {
  const id = String(deal.assignedById ?? deal.ASSIGNED_BY_ID ?? deal.responsavelId ?? '').trim();
  return id === String(brunoId);
}

/** Detecta produto/praça pelo título pra escolher template + mídia. */
export function detectarProdutoRetomada(deal = {}) {
  const blob = [deal.title, deal.produto, deal.campanha, deal.comments].filter(Boolean).join(' ').toLowerCase();
  if (/fort\s*myers|br_sc|brasileiros|eua/.test(blob)) return 'fort_myers';
  if (/grant/.test(blob)) return 'grant_home';
  if (/celebrat|alicerce/.test(blob)) return 'celebration';
  if (/jardim\s*da\s*costa/.test(blob)) return 'jardim_da_costa';
  if (/portugal/.test(blob)) return 'portugal';
  return 'generica';
}

export function msDeIso(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Elegível pra entrar na fila (ainda sem anti-spam de estado).
 */
export function ehElegivelRetomada(deal = {}, opts = {}) {
  const {
    brunoId = '1',
    agoraMs = Date.now(),
    maxIdadeDias = 45,
  } = opts;

  if (!ehResponsavelBruno(deal, brunoId)) {
    return { ok: false, motivo: 'nao_bruno' };
  }
  if (!ehPatrocinadoDeal(deal)) {
    return { ok: false, motivo: 'nao_patrocinado' };
  }
  if (!ehFaseRetomada(deal)) {
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
  return { ok: true, motivo: 'ok' };
}

/** Janela comercial BRT (UTC-3): 9h–19h, seg–sáb. */
export function dentroJanelaComercial(agoraMs = Date.now()) {
  const brt = new Date(agoraMs - 3 * 3600000);
  const dia = brt.getUTCDay(); // 0=dom
  if (dia === 0) return false;
  const h = brt.getUTCHours();
  return h >= 9 && h < 19;
}

/**
 * Anti-spam por estado (Firebase / memória do cron).
 * @param {object} estado  { lastRetomadaMs, enviadasHoje, handledByHuman, lastClientMsgMs, lastHelenaMs }
 */
export function passaAntiSpam(estado = {}, opts = {}) {
  const {
    agoraMs = Date.now(),
    intervaloMinHoras = 36,
    limiteDiario = 20,
    silencioClienteDias = 7,
  } = opts;

  if (estado.handledByHuman) return { ok: false, motivo: 'humano_assumiu' };
  if ((estado.enviadasHoje || 0) >= limiteDiario) {
    return { ok: false, motivo: 'teto_diario_global' }; // usado no agregado; por lead ver abaixo
  }
  if (estado.lastRetomadaMs && (agoraMs - estado.lastRetomadaMs) < intervaloMinHoras * 3600000) {
    return { ok: false, motivo: 'intervalo_minimo' };
  }
  if (estado.lastHelenaMs && (agoraMs - estado.lastHelenaMs) < 20 * 3600000) {
    return { ok: false, motivo: 'helena_recente' };
  }
  if (estado.lastClientMsgMs && (agoraMs - estado.lastClientMsgMs) < silencioClienteDias * 86400000) {
    return { ok: false, motivo: 'cliente_respondeu_recente' };
  }
  return { ok: true, motivo: 'ok' };
}

/**
 * Monta lote ordenado (mais novos primeiro), com template + mídia.
 * @returns {{ lote: object[], pulados: object[] }}
 */
export function montaFilaRetomada(deals = [], opts = {}) {
  const {
    brunoId = '1',
    agoraMs = Date.now(),
    maxIdadeDias = 45,
    maxLote = 5,
    estadosPorTel = {}, // fk telefone -> estado
    intervaloMinHoras = 36,
    enviadasHojeGlobal = 0,
    limiteDiario = 20,
  } = opts;

  const pulados = [];
  const ok = [];

  if (!dentroJanelaComercial(agoraMs)) {
    return { lote: [], pulados: [{ motivo: 'fora_janela_comercial' }] };
  }
  if (enviadasHojeGlobal >= limiteDiario) {
    return { lote: [], pulados: [{ motivo: 'teto_diario_global' }] };
  }

  const restantes = Math.max(0, limiteDiario - enviadasHojeGlobal);

  for (const deal of deals) {
    const elig = ehElegivelRetomada(deal, { brunoId, agoraMs, maxIdadeDias });
    if (!elig.ok) {
      pulados.push({ dealId: deal.id || deal.dealId, motivo: elig.motivo });
      continue;
    }
    const tel = soDigitos(deal.telefone || deal.phone);
    const st = estadosPorTel[tel] || estadosPorTel[tel.slice(-11)] || {};
    const spam = passaAntiSpam(st, { agoraMs, intervaloMinHoras, limiteDiario: 99 });
    if (!spam.ok) {
      pulados.push({ dealId: deal.id || deal.dealId, telefone: tel, motivo: spam.motivo });
      continue;
    }
    const chaveProd = detectarProdutoRetomada(deal);
    const tpl = TEMPLATES_RETOMADA[chaveProd] || TEMPLATES_RETOMADA.generica;
    ok.push({
      dealId: String(deal.id || deal.dealId || ''),
      telefone: tel,
      nome: deal.nome || deal.name || '',
      title: deal.title || '',
      fase: deal.fase || deal.stageId || '',
      produtoKey: chaveProd,
      produto: tpl.produto,
      mensagem: personalizaTemplate(tpl.pt, deal.nome || deal.name),
      midiaChave: tpl.midiaChave,
      midiaTipo: tpl.midiaTipo,
    });
  }

  // mais recentes primeiro se tiver dateCreate
  ok.sort((a, b) => String(b.dealId).localeCompare(String(a.dealId), undefined, { numeric: true }));

  const lote = ok.slice(0, Math.min(maxLote, restantes));
  for (const extra of ok.slice(lote.length)) {
    pulados.push({ dealId: extra.dealId, motivo: 'fora_do_lote' });
  }
  return { lote, pulados };
}

export default {
  ehElegivelRetomada,
  montaFilaRetomada,
  detectarProdutoRetomada,
  personalizaTemplate,
  dentroJanelaComercial,
  passaAntiSpam,
  TEMPLATES_RETOMADA,
};
