// Funil Novo Katzer (CATEGORY_ID=1) — IDs confirmados Helena/Maestro 19/07.
export const ESTAGIO_BITRIX = {
  'Leads Novos': 'C1:NEW',
  'Tentando Contato': 'C1:PREPARATION',
  'Carteira corretor': 'C1:UC_PFXJQQ',
  'Mapeamento': 'C1:PREPAYMENT_INVOICE',
  'Aprovação Viagem': 'C1:UC_Q9KBWL',
  'Cliente em viagem': 'C1:EXECUTING',
  'Agendamento Meetins': 'C1:FINAL_INVOICE',
  'Agendado Físico': 'C1:UC_0V8YA1',
  'Reagendamento de Visita': 'C1:UC_GUEW1G',
  'Follow Up': 'C1:UC_7P0WD3',
  'Negociação': 'C1:UC_3NOP4U',
  'Proposta': 'C1:UC_GB4BGY',
  'Contrato': 'C1:UC_86VZ0Y',
  'Aprovação Exceção': 'C1:UC_NKBUD8',
  'Exceção': 'C1:UC_UT1HFW',
  'Ganhou': 'C1:WON',
  'Rampage': 'C1:LOSE',
  'Perdido': 'C1:APOLOGY',
};

export const ORDEM_FUNIL = [
  'Leads Novos', 'Tentando Contato', 'Carteira corretor', 'Mapeamento', 'Aprovação Viagem',
  'Cliente em viagem', 'Agendamento Meetins', 'Agendado Físico', 'Reagendamento de Visita',
  'Follow Up', 'Negociação', 'Proposta', 'Contrato', 'Aprovação Exceção', 'Exceção', 'Ganhou',
];

const STAGE_TO_NOME = Object.fromEntries(
  Object.entries(ESTAGIO_BITRIX).map(([nome, id]) => [id, nome]),
);

export function nomeFasePorStageId(stageId) {
  return STAGE_TO_NOME[String(stageId || '')] || null;
}

/** Normaliza rótulos locais / legados para o Funil Novo Katzer. */
export function normalizaNomeFase(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'Leads Novos';
  if (ORDEM_FUNIL.includes(s) || s === 'Rampage' || s === 'Perdido') return s;
  if (/^novo$/i.test(s) || /leads?\s*novos?/i.test(s) || /fluxo\s*-?\s*leads/i.test(s)) return 'Leads Novos';
  if (/tentando/i.test(s)) return 'Tentando Contato';
  if (/carteira/i.test(s)) return 'Carteira corretor';
  if (/mapeament/i.test(s)) return 'Mapeamento';
  if (/aprova.*viagem/i.test(s)) return 'Aprovação Viagem';
  if (/em viagem|cliente em viagem/i.test(s)) return 'Cliente em viagem';
  if (/agendamento meet|meetins/i.test(s)) return 'Agendamento Meetins';
  if (/agendado f[ií]sico/i.test(s)) return 'Agendado Físico';
  if (/reagend/i.test(s)) return 'Reagendamento de Visita';
  if (/follow/i.test(s)) return 'Follow Up';
  if (/negocia/i.test(s)) return 'Negociação';
  if (/proposta/i.test(s)) return 'Proposta';
  if (/contrato/i.test(s)) return 'Contrato';
  if (/exce[cç][aã]o/i.test(s) && /aprova/i.test(s)) return 'Aprovação Exceção';
  if (/^exce[cç][aã]o$/i.test(s)) return 'Exceção';
  if (/ganhou|won/i.test(s)) return 'Ganhou';
  if (/rampage/i.test(s)) return 'Rampage';
  if (/perdido|lost|saiu/i.test(s)) return 'Perdido';
  return s;
}

function bitrixBase() {
  return (
    process.env.BITRIX_WEBHOOK_READ
    || process.env.BITRIX_WEBHOOK_URL
    || process.env.BITRIX24_WEBHOOK
    || process.env.BITRIX_WEBHOOK_WRITE
    || ''
  ).replace(/\/+$/, '');
}

function portalBase() {
  return (process.env.BITRIX_PORTAL_URL || 'https://katzer.bitrix24.com.br').replace(/\/+$/, '');
}

function linkWhatsApp(telefone) {
  const dig = String(telefone || '').replace(/\D+/g, '');
  if (!dig || dig.length < 8) return null;
  const full = dig.startsWith('55') ? dig : `55${dig}`;
  return `https://wa.me/${full}`;
}

async function bitrixCall(metodo, params = {}) {
  const base = bitrixBase();
  if (!base) return { ok: false, result: [], motivo: 'BITRIX_WEBHOOK ausente' };
  const url = `${base}/${metodo}.json`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const j = await r.json().catch(() => ({}));
    if (j.error) return { ok: false, result: [], motivo: j.error_description || j.error };
    return { ok: true, result: j.result || [], total: j.total };
  } catch (e) {
    return { ok: false, result: [], motivo: String(e.message || e) };
  }
}

async function telefonesPorContato(contactIds = []) {
  const ids = [...new Set(contactIds.map(String).filter(Boolean))];
  const map = {};
  // Bitrix: até 50 por batch via crm.contact.list
  for (let i = 0; i < ids.length; i += 40) {
    const slice = ids.slice(i, i + 40);
    const page = await bitrixCall('crm.contact.list', {
      filter: { '@ID': slice },
      select: ['ID', 'NAME', 'LAST_NAME', 'PHONE', 'HAS_PHONE'],
    });
    if (!page.ok) break;
    for (const c of page.result || []) {
      const phones = Array.isArray(c.PHONE) ? c.PHONE : [];
      const raw = phones.find((p) => p?.VALUE)?.VALUE || phones[0]?.VALUE || '';
      map[String(c.ID)] = {
        nome: [c.NAME, c.LAST_NAME].filter(Boolean).join(' ').trim(),
        telefone: raw,
        whatsappUrl: linkWhatsApp(raw),
      };
    }
  }
  return map;
}

/**
 * Lista negócios do funil Katzer (até ~200) com etapa + WhatsApp do contato.
 * Match de campanha é feito depois por TITLE / campos.
 */
export async function listaDealsFunil({ limit = 200 } = {}) {
  const categoryId = Number(process.env.BITRIX_CATEGORY_ID || 1);
  const all = [];
  let start = 0;
  while (all.length < limit) {
    const page = await bitrixCall('crm.deal.list', {
      filter: { CATEGORY_ID: categoryId },
      select: ['ID', 'TITLE', 'STAGE_ID', 'CONTACT_ID', 'DATE_CREATE', 'COMMENTS'],
      order: { DATE_MODIFY: 'DESC' },
      start,
    });
    if (!page.ok) return { ok: false, deals: all, motivo: page.motivo };
    const batch = Array.isArray(page.result) ? page.result : [];
    if (!batch.length) break;
    for (const d of batch) {
      all.push({
        id: d.ID,
        title: d.TITLE || '',
        stageId: d.STAGE_ID,
        fase: nomeFasePorStageId(d.STAGE_ID) || d.STAGE_ID || '—',
        contactId: d.CONTACT_ID,
        bitrixUrl: `${portalBase()}/crm/deal/details/${d.ID}/`,
        comments: d.COMMENTS || '',
      });
    }
    if (batch.length < 50) break;
    start += 50;
    if (start > 400) break;
  }
  const contatos = await telefonesPorContato(all.map((d) => d.contactId));
  for (const d of all) {
    const c = contatos[String(d.contactId)] || null;
    d.telefone = c?.telefone || null;
    d.whatsappUrl = c?.whatsappUrl || null;
    if (c?.nome && (!d.title || /^\d+$/.test(d.title))) d.title = c.nome;
  }
  return { ok: true, deals: all };
}

function tokensCampanha(nome) {
  return String(nome || '')
    .toUpperCase()
    .split(/[^A-Z0-9ÁÉÍÓÚÃÕÂÊÔÇ]+/i)
    .filter((t) => t.length >= 4)
    .filter((t) => !['TESTE', 'FORT', 'MYERS', 'FORTMYERS', 'CONFIG', 'VIDEO', 'NOVO'].includes(t));
}

export function dealBateCampanha(deal, nomeCampanha) {
  const hay = `${deal.title || ''} ${deal.comments || ''}`.toUpperCase();
  const nome = String(nomeCampanha || '').toUpperCase();
  if (!hay || !nome) return false;
  if (hay.includes(nome.slice(0, 24))) return true;
  const toks = tokensCampanha(nomeCampanha);
  if (!toks.length) return false;
  const hits = toks.filter((t) => hay.includes(t));
  return hits.length >= Math.min(2, toks.length) || (toks.length === 1 && hits.length === 1);
}

/**
 * Para uma campanha: contagem por fase do funil + leads com links.
 */
export function fasesPorCampanha(deals, nomeCampanha, leadsLocais = []) {
  const matched = (deals || []).filter((d) => dealBateCampanha(d, nomeCampanha));
  const map = new Map();
  for (const d of matched) {
    const fase = d.fase || '—';
    if (!map.has(fase)) map.set(fase, { nome: fase, n: 0, leads: [] });
    const bucket = map.get(fase);
    bucket.n += 1;
    bucket.leads.push({
      id: d.id,
      nome: d.title,
      fase,
      bitrixUrl: d.bitrixUrl,
      whatsappUrl: d.whatsappUrl || null,
      telefone: d.telefone || null,
    });
  }

  // Enriquece com leads locais (Caçador) — WhatsApp + fase
  for (const l of leadsLocais || []) {
    const fase = normalizaNomeFase(l.faseBitrix || l.statusPosMapeamento || l.status || 'Leads Novos');
    if (!map.has(fase)) map.set(fase, { nome: fase, n: 0, leads: [] });
    const bucket = map.get(fase);
    const wa = linkWhatsApp(l.telefone);
    const exists = bucket.leads.some((x) => x.id === l.id || x.nome === l.nome);
    if (!exists) {
      bucket.n += 1;
      bucket.leads.push({
        id: l.id,
        nome: l.nome,
        fase,
        bitrixUrl: l.bitrixUrl || null,
        whatsappUrl: wa,
      });
    } else {
      const hit = bucket.leads.find((x) => x.id === l.id || x.nome === l.nome);
      if (hit && wa) hit.whatsappUrl = wa;
      if (hit && l.bitrixUrl) hit.bitrixUrl = l.bitrixUrl;
    }
  }

  const fases = ORDEM_FUNIL
    .filter((nome) => map.has(nome))
    .map((nome) => map.get(nome))
    .concat([...map.values()].filter((f) => !ORDEM_FUNIL.includes(f.nome)));

  const total = fases.reduce((s, f) => s + f.n, 0);
  return { total, fases, fonte: matched.length ? 'bitrix+local' : (leadsLocais.length ? 'local' : 'vazio') };
}
