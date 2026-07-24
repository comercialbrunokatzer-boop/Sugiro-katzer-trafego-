/**
 * CLIENTE DE LEITURA do Bitrix (usa a env var BITRIX_WEBHOOK_READ).
 * SÓ LEITURA — a escrita continua sendo do Maestro (BITRIX_WEBHOOK_WRITE).
 *
 * Serve pra Secretária ler o card inteiro (campos, comentários, etapa, ligações)
 * e pro diagnóstico que puxa o "raio-x" do funil (campos + opções + etapas).
 *
 * As partes de montagem de URL são PURAS (testáveis sem rede). A chamada aceita
 * um fetch injetável pra teste.
 */

/** Normaliza a base do webhook: garante barra final e tira método/.json colado no fim. */
export function normalizaBaseUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return '';
  // remove um método colado no fim (ex.: .../TOKEN/profile.json, .../TOKEN/crm.deal.list.json)
  u = u.replace(/\/(?:[a-z][a-z0-9_]*\.)+[a-z0-9_]+(?:\.json)?\/?$/i, '/');
  if (!u.endsWith('/')) u += '/';
  return u;
}

/** Monta a URL final de um método REST. */
export function montaUrl(base, metodo) {
  const b = normalizaBaseUrl(base);
  if (!b) throw new Error('BITRIX_WEBHOOK_READ ausente/vazio');
  return `${b}${metodo}.json`;
}

/** Serializa params rasos no formato que o Bitrix aceita (a[0]=x, chave=valor). */
export function montaQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) v.forEach((it, i) => qs.append(`${k}[${i}]`, String(it)));
    else if (v && typeof v === 'object') {
      for (const [k2, v2] of Object.entries(v)) qs.append(`${k}[${k2}]`, String(v2));
    } else if (v != null) qs.append(k, String(v));
  }
  return qs.toString();
}

/**
 * Chama um método REST do Bitrix (GET). fetchFn injetável pra teste.
 * Lança erro claro quando o Bitrix responde { error, error_description }.
 */
export async function bitrixGet(metodo, params = {}, {
  base = process.env.BITRIX_WEBHOOK_READ,
  fetchFn = globalThis.fetch,
} = {}) {
  if (typeof fetchFn !== 'function') throw new Error('fetch indisponível no runtime');
  const url = montaUrl(base, metodo);
  const q = montaQuery(params);
  const full = q ? `${url}?${q}` : url;
  const r = await fetchFn(full);
  let j = {};
  try { j = await r.json(); } catch { /* corpo não-JSON */ }
  if (j && j.error) {
    throw new Error(`Bitrix ${metodo}: ${j.error}${j.error_description ? ' — ' + j.error_description : ''}`);
  }
  if (!r.ok) throw new Error(`Bitrix ${metodo}: HTTP ${r.status}`);
  return j.result;
}

// ── Métodos de SCHEMA (o raio-x do funil) ──
export const dealFields    = (opts) => bitrixGet('crm.deal.fields', {}, opts);
export const contactFields = (opts) => bitrixGet('crm.contact.fields', {}, opts);
export const statusList    = (opts) => bitrixGet('crm.status.list', {}, opts);      // etapas/estágios de todos os funis
export const categoryList  = (opts) => bitrixGet('crm.dealcategory.list', {}, opts); // pipelines

/**
 * Acha o negócio do cliente pelo telefone — SÓ LEITURA (webhook de leitura).
 * Devolve { dealId, contactId, stageId, title } do negócio mais recente no
 * funil configurado (CATEGORY_ID), ou null se não achar. Serve de CONTEXTO
 * pra Secretária (mostrar a etapa atual), nunca pra escrever.
 * @param {string} telefone  telefone do cliente
 * @param {object} opts       { base, fetchFn, categoryId }
 */
export async function achaDealLeitura(telefone, opts = {}) {
  const { categoryId = Number(process.env.BITRIX_CATEGORY_ID || 1) } = opts;
  const tel = String(telefone || '').trim();
  if (!tel) return null;
  const dup = await bitrixGet('crm.duplicate.findbycomm', {
    entity_type: 'CONTACT', type: 'PHONE', values: [tel],
  }, opts);
  const contatoIds = (dup && dup.CONTACT) || [];
  if (!contatoIds.length) return null;
  const negocios = await bitrixGet('crm.deal.list', {
    filter: { CONTACT_ID: contatoIds, CATEGORY_ID: categoryId },
    select: ['ID', 'TITLE', 'STAGE_ID', 'CONTACT_ID'],
    order: { ID: 'DESC' },
  }, opts);
  if (Array.isArray(negocios) && negocios.length) {
    const d = negocios[0];
    return { dealId: String(d.ID), contactId: String(contatoIds[0]), stageId: d.STAGE_ID, title: d.TITLE };
  }
  return { dealId: null, contactId: String(contatoIds[0]), stageId: null, title: null };
}

/**
 * Resume os campos pro que interessa à Secretária: id, título, tipo, obrigatório,
 * múltiplo e — pros dropdowns — TODAS as opções (ID + VALUE). É isso que eu preciso
 * pra escrever no campo certo sem chutar.
 */
export function resumeCampos(fields = {}) {
  const out = [];
  for (const [id, def] of Object.entries(fields || {})) {
    const item = {
      id,
      titulo: def.title || def.formLabel || def.listLabel || '',
      tipo: def.type,
      obrigatorio: !!def.isRequired,
      multiplo: !!def.isMultiple,
    };
    if (def.type === 'enumeration' && Array.isArray(def.items)) {
      item.opcoes = def.items.map((o) => ({ ID: o.ID, VALUE: o.VALUE }));
    }
    out.push(item);
  }
  return out;
}
