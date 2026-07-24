/**
 * Cliente de ESCRITA no Bitrix (isolado do Auditor). HTTP injetavel -> 100% testavel.
 * Faz: achar negocio por telefone (dedup), criar contato, criar/atualizar negocio.
 * Regra Lei 01: valor absurdo NAO entra (teto de sanidade 20M, igual ao Auditor).
 */
import { CFG } from './config.js';
import { comTentativas } from './retry.js';

const TETO_TICKET = 20000000;

async function httpBitrix(method, params) {
  return comTentativas(async () => {
    const url = `${CFG.BITRIX_WEBHOOK_WRITE}/${method}.json`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CFG.HTTP_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: ctrl.signal,
      });
      if (r.status === 429 || r.status >= 500) throw new Error(`Bitrix ${method}: ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(`Bitrix ${method}: ${j.error} ${j.error_description || ''}`);
      return j.result;
    } finally { clearTimeout(t); }
  });
}

export function criaBitrix({ call = httpBitrix } = {}) {
  function camposUF(lead) {
    const f = {};
    if (lead.interesse) f[CFG.F.CIDADE] = lead.interesse;
    if (lead.finalidade) f[CFG.F.INTENCAO] = lead.finalidade;
    if (lead.estagio) f[CFG.F.PRAZO_COMPRA] = lead.estagio;
    if (lead.orcamento_max && lead.orcamento_max <= TETO_TICKET) {
      f[CFG.F.TICKET_PERCEBIDO] = lead.orcamento_max;
    }
    // campos so enviam se o CEO configurou o ID (vazio > errado)
    if (CFG.F_ENV.ORIGEM) f[CFG.F_ENV.ORIGEM] = lead.origem;
    if (CFG.F_ENV.PERFIL_DECISOR && lead.perfil_decisor) f[CFG.F_ENV.PERFIL_DECISOR] = lead.perfil_decisor;
    if (CFG.F_ENV.NIVEL && lead.nivel) f[CFG.F_ENV.NIVEL] = lead.nivel;
    return f;
  }

  async function achaNegocioPorTelefone(telefone) {
    const dup = await call('crm.duplicate.findbycomm', { entity_type: 'CONTACT', type: 'PHONE', values: [telefone] });
    const contatoIds = (dup && dup.CONTACT) || [];
    if (!contatoIds.length) return null;
    const negocios = await call('crm.deal.list', {
      filter: { CONTACT_ID: contatoIds, CATEGORY_ID: CFG.CATEGORY_ID },
      select: ['ID', 'ASSIGNED_BY_ID', 'STAGE_ID', 'CONTACT_ID'],
      order: { ID: 'DESC' },
    });
    if (negocios && negocios.length) {
      return { dealId: String(negocios[0].ID), contactId: String(contatoIds[0]), assignedById: negocios[0].ASSIGNED_BY_ID };
    }
    return { dealId: null, contactId: String(contatoIds[0]), assignedById: null };
  }

  async function garanteContato(lead) {
    const achado = await achaNegocioPorTelefone(lead.telefone);
    if (achado && achado.contactId) return achado;
    const contactId = await call('crm.contact.add', {
      fields: {
        NAME: lead.nome || 'Lead',
        PHONE: [{ VALUE: lead.telefone, VALUE_TYPE: 'MOBILE' }],
        ...(lead.email ? { EMAIL: [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }] } : {}),
        SOURCE_ID: 'WEBFORM',
      },
    });
    return { dealId: null, contactId: String(contactId), assignedById: null };
  }

  /** upsert: cria (ou atualiza) o negocio. Nunca REBAIXA de etapa; so promove. */
  async function upsertNegocio(lead, { stageId, corretorId }) {
    const base = await garanteContato(lead);
    const fields = {
      TITLE: `${lead.nome || 'Lead'} — ${lead.interesse || lead.origem}`,
      CATEGORY_ID: CFG.CATEGORY_ID,
      CONTACT_ID: base.contactId,
      ASSIGNED_BY_ID: base.assignedById || corretorId,
      SOURCE_ID: 'WEBFORM',
      COMMENTS: [lead.observacoes, `origem: ${lead.origem}`, lead.nivel ? `nivel: ${lead.nivel}` : '']
        .filter(Boolean).join('\n'),
      ...camposUF(lead),
    };
    if (base.dealId) {
      // negocio ja existe: atualiza dados, promove etapa (nunca rebaixa), mantem dono se ja tem
      await call('crm.deal.update', { id: base.dealId, fields: { ...fields, STAGE_ID: stageId } });
      return { dealId: base.dealId, contactId: base.contactId, created: false, corretorId: fields.ASSIGNED_BY_ID };
    }
    const dealId = await call('crm.deal.add', { fields: { ...fields, STAGE_ID: stageId } });
    return { dealId: String(dealId), contactId: base.contactId, created: true, corretorId: fields.ASSIGNED_BY_ID };
  }

  /** Atualiza campos de um negócio existente (usado pela Secretária: move etapa + campos + comentário). */
  async function atualizaNegocio(dealId, fields) {
    if (!dealId || !fields || !Object.keys(fields).length) return { ok: false, motivo: 'sem dealId/fields' };
    await call('crm.deal.update', { id: dealId, fields });
    return { ok: true, dealId: String(dealId), campos: Object.keys(fields) };
  }

  return { achaNegocioPorTelefone, upsertNegocio, atualizaNegocio };
}
