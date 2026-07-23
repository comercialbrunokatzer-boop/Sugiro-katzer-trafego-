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

export const FASES_TERMINAIS = ['Rampage', 'Perdido'];

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
  if (ORDEM_FUNIL.includes(s) || FASES_TERMINAIS.includes(s)) return s;
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
  let u = (
    process.env.BITRIX_WEBHOOK_READ
    || process.env.BITRIX_WEBHOOK_URL
    || process.env.BITRIX24_WEBHOOK
    || process.env.BITRIX_WEBHOOK_WRITE
    || ''
  ).trim();
  if (!u) return '';
  u = u.replace(/^["']|["']$/g, '');
  u = u.replace(/\/(?:[a-z][a-z0-9_]*\.)+[a-z0-9_]+(?:\.json)?\/?$/i, '/');
  if (!/^https?:\/\//i.test(u)) {
    if (/^rest\//i.test(u) || /^\d+\//.test(u)) u = `https://katzer.bitrix24.com.br/${u.replace(/^\/+/, '')}`;
    else if (/bitrix24\.com/i.test(u)) u = `https://${u}`;
    else u = `https://katzer.bitrix24.com.br/rest/${u.replace(/^\/+/, '')}`;
  }
  return u.replace(/\/+$/, '');
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
  try {
    // Bitrix REST aceita GET com query (igual Helena) — mais compatível com webhooks
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (Array.isArray(v)) v.forEach((it, i) => qs.append(`${k}[${i}]`, String(it)));
      else if (v && typeof v === 'object') {
        for (const [k2, v2] of Object.entries(v)) qs.append(`${k}[${k2}]`, String(v2));
      } else if (v != null) qs.append(k, String(v));
    }
    const url = `${base}/${metodo}.json${qs.toString() ? `?${qs}` : ''}`;
    // valida URL antes do fetch
    // eslint-disable-next-line no-new
    new URL(url);
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (j.error) return { ok: false, result: [], motivo: j.error_description || j.error };
    if (!r.ok) return { ok: false, result: [], motivo: `HTTP ${r.status}` };
    return { ok: true, result: j.result || [], total: j.total };
  } catch (e) {
    return { ok: false, result: [], motivo: String(e.message || e) };
  }
}

async function telefonesPorContato(contactIds = []) {
  const ids = [...new Set(contactIds.map(String).filter(Boolean))];
  const map = {};
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

/** Fallback: Helena já tem BITRIX_WEBHOOK_READ — App Decisão puxa o funil por lá. */
async function listaDealsViaHelena({ limit = 400, produtos = [] } = {}) {
  const base = (process.env.HELENA_FUNIL_URL || 'https://regal-chaja-662035.netlify.app').replace(/\/+$/, '');
  // WHATSAPP_CEO vem do GitHub secret (valor real). BRUNO_PHONE copiado via API
  // Netlify pode vir mascarado — só usar se tiver ≥10 dígitos.
  const bruno = String(process.env.BRUNO_PHONE || '').replace(/\D+/g, '');
  const key = process.env.FUNIL_PROXY_KEY
    || process.env.WHATSAPP_CEO
    || (bruno.length >= 10 ? process.env.BRUNO_PHONE : '')
    || process.env.WHATSAPP_MICHEL
    || '';
  if (!key) return { ok: false, deals: [], motivo: 'sem key p/ Helena funil' };
  try {
    const prod = [...new Set((produtos || []).filter(Boolean))].slice(0, 8).join(',');
    const qs = new URLSearchParams({
      limit: String(limit),
      key,
    });
    if (prod) qs.set('produtos', prod);
    const url = `${base}/api/funil-katzer?${qs}`;
    const r = await fetch(url, {
      headers: { 'x-funil-key': key },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      return { ok: false, deals: [], motivo: j.erro || `Helena HTTP ${r.status}` };
    }
    const deals = (j.deals || []).map((d) => ({
      id: d.id,
      title: d.title || '',
      titleForm: d.titleForm || d.title || '',
      nomeContato: d.nomeContato || null,
      stageId: d.stageId,
      fase: normalizaNomeFase(d.fase || d.stageId),
      contactId: d.contactId,
      bitrixUrl: d.bitrixUrl || `${portalBase()}/crm/deal/details/${d.id}/`,
      comments: d.comments || '',
      sourceDescription: d.sourceDescription || '',
      utmCampaign: d.utmCampaign || '',
      utmContent: d.utmContent || '',
      telefone: d.telefone || null,
      whatsappUrl: d.whatsappUrl || linkWhatsApp(d.telefone),
    }));
    return { ok: true, deals, fonte: 'helena' };
  } catch (e) {
    return { ok: false, deals: [], motivo: String(e.message || e) };
  }
}

/**
 * Lista negócios do funil Katzer com etapa + WhatsApp.
 * 1) webhook local  2) proxy Helena (regal-chaja)
 */
export async function listaDealsFunil({
  limit = 300,
  produtos = ['ALICERCE', 'PUNTA', 'GRANT', 'PORTUGAL', 'BRASILEIROS', 'NOVACONFIG', 'FORT MYERS', 'AMANAY'],
} = {}) {
  let localMotivo = null;
  const baseNow = bitrixBase();
  const baseOk = baseNow && /bitrix24\.com/i.test(baseNow);
  if (baseOk) {
    const categoryId = Number(process.env.BITRIX_CATEGORY_ID || 1);
    const all = [];
    let start = 0;
    while (all.length < limit) {
      const page = await bitrixCall('crm.deal.list', {
        filter: { CATEGORY_ID: categoryId },
        select: [
          'ID', 'TITLE', 'STAGE_ID', 'CONTACT_ID', 'DATE_CREATE', 'COMMENTS',
          'SOURCE_DESCRIPTION', 'UTM_CAMPAIGN', 'UTM_CONTENT',
        ],
        order: { DATE_MODIFY: 'DESC' },
        start,
      });
      if (!page.ok) { localMotivo = page.motivo || 'crm.deal.list falhou'; break; }
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
          sourceDescription: d.SOURCE_DESCRIPTION || '',
          utmCampaign: d.UTM_CAMPAIGN || '',
          utmContent: d.UTM_CONTENT || '',
        });
      }
      if (batch.length < 50) break;
      start += 50;
      if (start > 400) break;
    }
    if (all.length) {
      const contatos = await telefonesPorContato(all.map((d) => d.contactId));
      for (const d of all) {
        const c = contatos[String(d.contactId)] || null;
        d.telefone = c?.telefone || null;
        d.whatsappUrl = c?.whatsappUrl || null;
        if (c?.nome && (!d.title || /^\d+$/.test(d.title))) d.title = c.nome;
      }
      return { ok: true, deals: all, fonte: 'webhook-local' };
    }
    localMotivo = localMotivo || 'webhook local respondeu vazio';
  } else {
    localMotivo = baseNow ? 'BITRIX_WEBHOOK inválido (sem host bitrix24)' : 'BITRIX_WEBHOOK ausente no runtime';
  }

  const viaHelena = await listaDealsViaHelena({ limit, produtos });
  if (viaHelena.ok) return viaHelena;
  return {
    ok: false,
    deals: [],
    motivo: [localMotivo, viaHelena.motivo].filter(Boolean).join(' | ') || 'funil indisponível',
  };
}

/** Produtos/praças — match ESTRITO (nunca corretor/criativo). */
const PRODUTOS = [
  'ALICERCE', 'TORRESANI', 'PUNTA', 'PUNTACANA', 'GRANT', 'AMANAY', 'ALMARE',
  'PERSONALITE', 'PORTUGAL', 'BRASILEIROS', 'NOVACONFIG', 'BARRA VIEW',
  'GOLDEN BEACH', 'YARA', 'NAUT', 'ALICERCE', 'ROGGA', 'TROPICALE',
];

/** Nomes de corretor/criativo que NÃO podem casar campanha↔deal. */
const STOP_MATCH = new Set([
  'TESTE', 'FORT', 'MYERS', 'FORTMYERS', 'CONFIG', 'VIDEO', 'NOVO', 'THE', 'AND',
  'META', 'ADS', 'ALISSON', 'AYA', 'IMAGEM', 'IMAGEM1', 'IMAGEM2', 'VIDEO01',
  'VIDEO02', 'VIDEO03', 'COPIA', 'PAUSADA', 'ACTIVE', 'KATZER', 'LEAD', 'PATROC',
  'FORMULARIO', 'CRM', 'CORRETOR',
]);

function tokensCampanha(nome) {
  const up = String(nome || '').toUpperCase();
  const parts = up
    .split(/[^A-Z0-9ÁÉÍÓÚÃÕÂÊÔÇ]+/i)
    .filter(Boolean);
  const compostos = (up.match(/[A-Z]{2,}(?:_[A-Z0-9]{2,})+/g) || [])
    .map((c) => c.replace(/_/g, ' '))
    .concat(up.match(/[A-Z]{2,}(?:_[A-Z0-9]{2,})+/g) || []);
  return [...new Set([...parts, ...compostos])]
    .filter((t) => t.length >= 2)
    .filter((t) => !STOP_MATCH.has(t))
    .filter((t) => !/^VIDEO\d+$/i.test(t) && !/^IMAGEM\d+$/i.test(t))
    .filter((t) => !/^\d{1,2}$/.test(t));
}

function tokensColchetes(nome) {
  return [...String(nome || '').toUpperCase().matchAll(/\[([^\]]+)\]/g)]
    .map((m) => m[1].trim())
    .filter((t) => t.length >= 3)
    .filter((t) => !/^\d{1,2}[\/\-]\d/.test(t))
    .filter((t) => !STOP_MATCH.has(t))
    .filter((t) => !/^VIDEO\d+$/i.test(t) && !/^IMAGEM\d+$/i.test(t));
}

/** Produto canônico da campanha Meta (se houver). */
export function produtoCampanha(nomeCampanha) {
  const nome = String(nomeCampanha || '').toUpperCase();
  for (const t of tokensColchetes(nomeCampanha)) {
    for (const p of PRODUTOS) {
      if (t === p || t.includes(p) || p.includes(t)) return p;
    }
  }
  for (const p of PRODUTOS) {
    if (nome.includes(p)) return p;
  }
  if (/_BR_SC|BR_SC|CIDADES\s*SC/.test(nome)) return 'BR_SC';
  return null;
}

function hayContemProduto(hay, produto) {
  if (!produto) return false;
  if (produto === 'BR_SC') {
    return /\bCIDADES\s+SC\b/.test(hay) || /\bSC\s*\+\s*PR\b/.test(hay) || /\bFORT\s*MYERS\s+SC\b/.test(hay);
  }
  if (produto.includes('PUNTA') || produto === 'TORRESANI') {
    // Torresani vende Punta — form Bitrix quase sempre traz PUNTA CANA
    return /PUNTA|TORRESANI/.test(hay);
  }
  if (produto === 'NOVACONFIG' || produto === 'PUBLICOS') return /NOVACONFIG|PUBLICOS/.test(hay);
  return hay.includes(produto);
}

export function dealBateCampanha(deal, nomeCampanha) {
  const hay = [
    deal.titleForm, // prioriza título do form Bitrix (produto), não o nome da pessoa
    deal.title,
    deal.comments,
    deal.sourceDescription,
    deal.utmCampaign,
    deal.utmContent,
  ].filter(Boolean).join(' ').toUpperCase();
  const nome = String(nomeCampanha || '').toUpperCase();
  if (!hay || !nome) return false;

  // Se a campanha tem produto conhecido → SÓ casa deal desse produto (fase correta)
  const produto = produtoCampanha(nomeCampanha);
  if (produto) return hayContemProduto(hay, produto);

  // Fallbacks só quando não há produto no nome
  const isBrSc = /(?:^|[^A-Z0-9])BR[_-\s]?SC(?:[^A-Z0-9]|$)/.test(nome) || /_BR_SC/.test(nome);
  if (isBrSc && hayContemProduto(hay, 'BR_SC')) return true;
  if (/\bPORTUGAL\b/.test(nome) && /\bPORTUGAL\b/.test(hay)) return true;
  if (/\bGRANT\b/.test(nome) && /\bGRANT\b/.test(hay)) return true;
  if (/\bPUBLICOS\b/.test(nome) && /\bNOVACONFIG\b/.test(hay)) return true;
  if (/\bEUA\b/.test(nome) && /\bBRASILEIR/.test(nome) && /\bEUA\b/.test(hay) && /\bBRASILEIR/.test(hay)) return true;

  const toks = tokensCampanha(nomeCampanha).filter((t) => t.length >= 5);
  if (!toks.length) return false;
  const hits = toks.filter((t) => hay.includes(t));
  return hits.length >= 1 && hits.every((t) => !STOP_MATCH.has(t));
}

/**
 * Para uma campanha: TODAS as fases do funil + qtd + leads (WA/Bitrix).
 * Fases sem lead vêm com n=0 (Michel vê o funil inteiro).
 */
export function fasesPorCampanha(deals, nomeCampanha, leadsLocais = []) {
  const matched = (deals || []).filter((d) => dealBateCampanha(d, nomeCampanha));
  const map = new Map();
  for (const nome of [...ORDEM_FUNIL, ...FASES_TERMINAIS]) {
    map.set(nome, { nome, n: 0, leads: [] });
  }

  for (const d of matched) {
    const fase = normalizaNomeFase(d.fase || 'Leads Novos');
    if (!map.has(fase)) map.set(fase, { nome: fase, n: 0, leads: [] });
    const bucket = map.get(fase);
    bucket.n += 1;
    bucket.leads.push({
      id: d.id,
      nome: d.nomeContato || d.title,
      fase,
      bitrixUrl: d.bitrixUrl,
      whatsappUrl: d.whatsappUrl || null,
      telefone: d.telefone || null,
      form: d.titleForm || null,
    });
  }

  for (const l of leadsLocais || []) {
    if (String(l.id || '').startsWith('demo-')) continue; // nunca misturar demo com funil real
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

  const ordem = [...ORDEM_FUNIL, ...FASES_TERMINAIS];
  const fases = ordem
    .filter((nome) => map.has(nome))
    .map((nome) => map.get(nome))
    .concat([...map.values()].filter((f) => !ordem.includes(f.nome)));

  const total = fases.reduce((s, f) => s + f.n, 0);
  return {
    total,
    fases,
    fonte: matched.length ? 'bitrix+local' : (leadsLocais.length ? 'local' : 'vazio'),
  };
}
