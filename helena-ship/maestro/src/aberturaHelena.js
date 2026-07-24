/**
 * ABERTURA HELENA — lead de formulário Meta (patrocinado) do Bruno
 * → Helena manda a 1ª mensagem no WhatsApp com as infos do form.
 *
 * CONJUNTO no Bitrix (tudo junto — AND). Exemplo real (card FLAVIUS ALVES):
 *  · FONTE              = "Patrocinado Corretor"
 *  · ORIGEM DO ANÚNCIO  = "Patrocinado Corretor"
 *  · RESPONSÁVEL        = Bruno Katzer (não rodízio)
 *  · LEAD ENTRARÁ NA ROLETA = Não
 *  · PRODUTO            = Fort Myers (produto essencial do Michel)
 *  · Título             = "Preencher formulário de…"
 *  · Fase               = Leads Novos
 *  · Sem histórico WhatsApp (rota lead-form)
 *
 * Critérios:
 *  1) Patrocinado (form / LEAD PATROC / "Patrocinado Corretor")
 *  2) Fonte/origem do anúncio = Patrocinado Corretor (Bitrix) — alias Facebook Ads / form Meta
 *  3) Responsável = Bruno (ASSIGNED_BY_ID) — NÃO roleta/rodízio
 *  4) Roleta = Não (quando o campo vier no payload)
 *  5) Campanha/produto = lista viva do Michel (HELENA_CAMPANHAS_BRUNO)
 *  6) Sem histórico — enforced em /api/helena/lead-form
 *
 * DESENHO SEGURO:
 *  - Sem URL de abertura → não dispara.
 *  - Sem telefone → não dispara.
 *  - Homolog → só simula.
 *  - Best-effort: falha não quebra o ingest.
 */

/** Bruno Katzer no Bitrix (Auditor confirma ID 1 = CEO). */
export const BRUNO_BITRIX_ID_DEFAULT = '1';

/**
 * Sinais de "patrocinado" no título/campanha/fonte Bitrix (Instant Form Katzer).
 */
export function ehPatrocinado(lead = {}) {
  const blob = [
    lead.campanha,
    lead.title,
    lead.titleForm,
    lead.fonte,
    lead.origemAnuncio,
    lead.sourceDescription,
    lead.origem,
    lead.utmSource,
    lead.utmCampaign,
  ].filter(Boolean).join(' ').toLowerCase();
  if (!blob) return false;
  return /patroc|patrocinado|lead\s*patroc|instant\s*form|formul[aá]rio/.test(blob)
    || lead.origem === 'formulario_facebook';
}

/**
 * Fonte / origem do anúncio no Bitrix.
 * No card real: FONTE = "Patrocinado Corretor" e ORIGEM DO ANÚNCIO = "Patrocinado Corretor".
 * Também aceita Facebook Ads / formulario_facebook (webhook Meta / Maestro).
 */
export function ehFontePatrocinadoCorretor(lead = {}) {
  const origem = String(lead.origem || '').trim().toLowerCase();
  if (origem === 'formulario_facebook') return true;
  const blob = [
    lead.fonte,
    lead.origemAnuncio,
    lead.sourceDescription,
    lead.sourceId,
    lead.utmSource,
    lead.origem,
    lead.campanha,
    lead.title,
  ].filter(Boolean).join(' ').toLowerCase();
  return /patrocinado\s*corretor|facebook\s*ads|facebook|meta\s*ads|fbads|formulario_facebook/.test(blob);
}

/** Alias legado — mesma regra (Bitrix chama "Patrocinado Corretor"). */
export function ehFonteFacebookAds(lead = {}) {
  return ehFontePatrocinadoCorretor(lead);
}

/**
 * Responsável do card = Bruno (CEO), não rodízio Edsel/Elyas/Leandro.
 * @param {object} lead
 * @param {string|number} [assignedById]  ASSIGNED_BY_ID do deal (ctx) — tem prioridade
 * @param {object} [cfg]
 */
export function ehResponsavelBruno(lead = {}, assignedById = null, cfg = {}) {
  const brunoId = String(cfg.BRUNO_BITRIX_ID || cfg.brunoBitrixId || BRUNO_BITRIX_ID_DEFAULT);
  const assigned = String(
    assignedById != null && assignedById !== ''
      ? assignedById
      : (lead.assignedById ?? lead.responsavelId ?? lead.ASSIGNED_BY_ID ?? ''),
  ).trim();
  if (!assigned) return false;
  return assigned === brunoId;
}

/**
 * "LEAD ENTRARÁ NA ROLETA" = Não (exemplo Bitrix).
 * Se o campo não vier no payload → não bloqueia (webhook Meta ainda pode omitir).
 * Se vier Sim/true/1 → bloqueia (é rodízio, não piloto Bruno).
 */
export function ehForaDaRoleta(lead = {}) {
  const raw = lead.entraNaRoleta ?? lead.roleta ?? lead.LEAD_ENTRARA_NA_ROLETA ?? lead.leadEntraraNaRoleta;
  if (raw == null || raw === '') return true;
  const v = String(raw).trim().toLowerCase();
  if (/^(n[aã]o|no|false|0|n)$/.test(v)) return true;
  if (/^(sim|yes|true|1|s)$/.test(v)) return false;
  // valor desconhecido → fail-closed só se parecer "entra"
  if (/roleta|rod[ií]zio|entra/.test(v) && !/n[aã]o|n\b/.test(v)) return false;
  return true;
}

/**
 * Campanha/produto está entre os essenciais do Michel (piloto)?
 * Lista viva: o que ele está rodando agora OU campanha nova que ele criar
 * (tokens: grant, portugal, br_sc, brasileiros, fort myers, …).
 * Casa também o campo PRODUTO do Bitrix (ex.: "Fort Myers").
 * Lista vazia = não filtra por campanha (ainda exige 1–4).
 */
export function ehCampanhaMichelRecente(lead = {}, campanhas = []) {
  const lista = Array.isArray(campanhas)
    ? campanhas.map((s) => String(s || '').trim().toLowerCase()).filter(Boolean)
    : [];
  if (!lista.length) return true;
  const blob = [
    lead.campanha,
    lead.produto,
    lead.interesse,
    lead.title,
    lead.titleForm,
    lead.utmCampaign,
    lead.utmContent,
  ].filter(Boolean).join(' ').toLowerCase();
  if (!blob) return false;
  return lista.some((alvo) => alvo && blob.includes(alvo));
}

function listaCampanhasDoCfg(campanhasOrCfg) {
  if (Array.isArray(campanhasOrCfg)) return campanhasOrCfg;
  if (campanhasOrCfg && typeof campanhasOrCfg === 'object') {
    return campanhasOrCfg.CAMPANHAS_HELENA || campanhasOrCfg.campanhasHelena || [];
  }
  return [];
}

/**
 * Lead que a Helena deve abrir automaticamente (conjunto Bitrix do exemplo).
 * Patrocinado Corretor · responsável Bruno · fora da roleta · produto/campanha Michel.
 * (Sem histórico é enforced na rota /api/helena/lead-form.)
 *
 * @param {object} lead
 * @param {object|string[]} [campanhasOrCfg]  array de tokens OU cfg com BRUNO_BITRIX_ID + CAMPANHAS_HELENA
 * @param {object} [ctx]  { corretorId / assignedById }
 */
export function ehLeadDoBruno(lead = {}, campanhasOrCfg = [], ctx = {}) {
  const cfg = (!Array.isArray(campanhasOrCfg) && campanhasOrCfg && typeof campanhasOrCfg === 'object')
    ? campanhasOrCfg
    : {};
  const campanhas = listaCampanhasDoCfg(campanhasOrCfg);
  const assigned = ctx.corretorId ?? ctx.assignedById ?? null;

  if (!ehPatrocinado(lead)) return false;
  if (!ehFontePatrocinadoCorretor(lead)) return false;
  if (!ehResponsavelBruno(lead, assigned, cfg)) return false;
  if (!ehForaDaRoleta(lead)) return false;
  if (!ehCampanhaMichelRecente(lead, campanhas)) return false;
  return true;
}

/**
 * Chama a rota da Helena que gera a abertura personalizada e manda no WhatsApp do lead.
 * @param {object} lead   lead normalizado (nome, telefone, interesse, campanha, ...)
 * @param {object} opts   { url, key, dealId, corretorId, modo, fetchFn, logger }
 * @returns {Promise<{disparado:boolean, motivo?:string, status?:number}>}
 */
export async function acionaAberturaHelena(lead = {}, opts = {}) {
  const {
    url, key = '', dealId = null, corretorId = null,
    modo = 'producao', fetchFn = globalThis.fetch, logger = null,
    timeoutMs = 20000,
  } = opts;

  if (!url) return { disparado: false, motivo: 'HELENA_ABERTURA_URL vazio (recurso off)' };
  if (!lead.telefone) return { disparado: false, motivo: 'lead sem telefone' };

  // HOMOLOG: não dispara de verdade — só diz o que faria (igual à filosofia do Maestro).
  if (modo !== 'producao') {
    logger?.info?.('abertura Helena SIMULADA (homolog)', {
      telefone: lead.telefone,
      campanha: lead.campanha,
      origem: lead.origem,
      corretorId,
    });
    return { disparado: false, motivo: 'homolog (simulado)' };
  }
  if (typeof fetchFn !== 'function') return { disparado: false, motivo: 'fetch indisponível' };

  const payload = {
    phone: lead.telefone,
    lead: {
      nome: lead.nome || null,
      interesse: lead.interesse || lead.produto || null,
      finalidade: lead.finalidade || null,
      orcamento_max: lead.orcamento_max || null,
      campanha: lead.campanha || null,
      origem: lead.origem || lead.fonte || null,
    },
    dealId, corretorId,
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const full = key ? `${url}?key=${encodeURIComponent(key)}` : url;
    const r = await fetchFn(full, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      logger?.erro?.('abertura Helena falhou (HTTP)', { status: r.status });
      return { disparado: false, motivo: `HTTP ${r.status}`, status: r.status };
    }
    logger?.info?.('abertura Helena disparada', { telefone: lead.telefone, campanha: lead.campanha, corretorId });
    return { disparado: true, status: r.status };
  } catch (e) {
    logger?.erro?.('abertura Helena erro', { erro: String((e && e.message) || e) });
    return { disparado: false, motivo: String((e && e.message) || e) };
  } finally {
    clearTimeout(t);
  }
}
