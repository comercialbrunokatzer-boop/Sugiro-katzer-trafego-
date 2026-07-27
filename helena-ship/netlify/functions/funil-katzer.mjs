// GET /api/funil-katzer — Funil Novo Katzer (CATEGORY_ID=1) p/ App Decisão do Tráfego.
// SÓ LEITURA. Auth: ?key= telefone admin (BRUNO_PHONE / WHATSAPP_CEO) ou header x-funil-key.
//
// Além dos deals mais recentes, busca por produto no TITLE (ALICERCE, PUNTA, …)
// pra não “perder” histórico antigo (ex.: Gerard da Alicerce fora da janela DATE_MODIFY).
import { bitrixGet } from '../../maestro/src/bitrixRead.js';
import { ESTAGIO_BITRIX, estagioPorStageId } from '../../maestro/src/secretaria.js';
import { mesmoTelefone } from '../../maestro/src/secretariaConversa.js';

// Portal real da Katzer (Auditor/Maestro). "katzer.bitrix24.com.br" está morto/404.
const PORTAL = (process.env.BITRIX_PORTAL_URL || 'https://katzerassessoria.bitrix24.com.br').replace(/\/+$/, '');

/** Produtos/praças que o App Decisão precisa achar mesmo com deal antigo. */
const PRODUTOS_BUSCA = [
  'ALICERCE',
  'PUNTA',
  'TORRESANI',
  'GRANT',
  'FORT MYERS',
  'PORTUGAL',
  'BRASILEIROS',
  'NOVACONFIG',
  'AMANAY',
  'ALMARE',
  'PERSONALITE',
  'BARRA VIEW',
  'GOLDEN BEACH',
];

/** Rastreio Meta → Make → Bitrix (App Decisão casa funil por estes UF). */
const UF_CAMPANHA_ORIGEM = 'UF_CRM_CAMPANHA_ORIGEM';
const UF_ADSET_ORIGEM = 'UF_CRM_ADSET_ORIGEM';
const UF_CONJUNTO_ORIGEM = 'UF_CRM_CONJUNTO_ORIGEM';

const SELECT_DEAL = [
  'ID', 'TITLE', 'STAGE_ID', 'CONTACT_ID', 'DATE_CREATE', 'DATE_MODIFY',
  'COMMENTS', 'SOURCE_DESCRIPTION', 'SOURCE_ID', 'UTM_CAMPAIGN', 'UTM_CONTENT', 'UTM_SOURCE',
  UF_CAMPANHA_ORIGEM, UF_ADSET_ORIGEM, UF_CONJUNTO_ORIGEM,
];

function soDigitos(s) {
  return String(s || '').replace(/\D+/g, '');
}

function linkWhatsApp(telefone) {
  const dig = soDigitos(telefone);
  if (!dig || dig.length < 8) return null;
  const full = dig.startsWith('55') ? dig : `55${dig}`;
  return `https://wa.me/${full}`;
}

function chaveOk(key) {
  if (!key) return false;
  const admins = [
    process.env.BRUNO_PHONE,
    process.env.WHATSAPP_CEO,
    process.env.WHATSAPP_MICHEL,
    process.env.FUNIL_PROXY_KEY,
  ].filter(Boolean);
  return admins.some((a) => mesmoTelefone(key, a) || soDigitos(key) === soDigitos(a) || key === a);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, x-funil-key',
    },
    body: JSON.stringify(body),
  };
}

function mapaDeal(d) {
  const campanhaOrigem = String(d[UF_CAMPANHA_ORIGEM] || '').trim();
  const adsetOrigem = String(d[UF_ADSET_ORIGEM] || d[UF_CONJUNTO_ORIGEM] || '').trim();
  return {
    id: d.ID,
    title: d.TITLE || '',
    titleForm: d.TITLE || '',
    stageId: d.STAGE_ID,
    fase: estagioPorStageId(d.STAGE_ID) || d.STAGE_ID || '—',
    contactId: d.CONTACT_ID,
    comments: d.COMMENTS || '',
    sourceDescription: d.SOURCE_DESCRIPTION || '',
    sourceId: d.SOURCE_ID || '',
    utmCampaign: d.UTM_CAMPAIGN || '',
    utmContent: d.UTM_CONTENT || '',
    dateCreate: d.DATE_CREATE || null,
    dateModify: d.DATE_MODIFY || null,
    bitrixUrl: `${PORTAL}/crm/deal/details/${d.ID}/`,
    campanhaOrigem,
    adsetOrigem,
    // aliases lidos pelo App Decisão (_bitrix-funil listaDealsViaHelena)
    ufCampanhaOrigem: campanhaOrigem,
    ufAdsetOrigem: adsetOrigem,
    [UF_CAMPANHA_ORIGEM]: campanhaOrigem,
    [UF_ADSET_ORIGEM]: adsetOrigem,
  };
}

function tituloEhFormulario(title) {
  return /preencher formul[aá]rio|lead patroc/i.test(String(title || ''));
}

/** Nome de pessoa a partir do título/comentário quando o contato Bitrix vem vazio (Instant Form). */
function nomePessoaDeTexto(...parts) {
  const blob = parts.filter(Boolean).join('\n');
  if (!blob) return '';
  // Campos comuns Meta/CRM: Nome: X · full_name · name
  const rotulo = blob.match(
    /(?:^|[\n;|])\s*(?:full[_ ]?name|nome(?:\s*completo)?|name)\s*[:：=]\s*([A-Za-zÁ-ú][A-Za-zÁ-ú'\s]{1,60})/i,
  );
  if (rotulo) {
    const n = limpaNomePessoa(rotulo[1]);
    if (n) return n;
  }
  // " PEDRO LEAD PATROC..." dentro das aspas do form
  const emb = blob.match(
    /"\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç']+)(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç']+){0,3}\s+LEAD\s+PATROC/i,
  );
  if (emb) {
    const n = limpaNomePessoa(emb[1]);
    if (n) return n;
  }
  return '';
}

function limpaNomePessoa(raw) {
  let n = String(raw || '').replace(/\s+/g, ' ').trim();
  n = n.replace(/[.,;:]+$/g, '').trim();
  if (!n || n.length < 2 || n.length > 60) return '';
  if (tituloEhFormulario(n)) return '';
  if (/^\d+$/.test(n)) return '';
  if (/^(lead|teste|test|crm|formulario|whatsapp|katzer)$/i.test(n)) return '';
  // Exige pelo menos uma letra
  if (!/[A-Za-zÁ-ú]/.test(n)) return '';
  return n;
}

function nomeContatoDeCampos(c) {
  if (!c) return '';
  return limpaNomePessoa(
    [c.NAME, c.SECOND_NAME, c.LAST_NAME].filter(Boolean).join(' ').trim(),
  );
}

async function listaDeals({ filter, max = 200 } = {}) {
  const out = [];
  let start = 0;
  while (out.length < max) {
    const batch = await bitrixGet('crm.deal.list', {
      filter,
      select: SELECT_DEAL,
      order: { DATE_MODIFY: 'DESC' },
      start,
    });
    const rows = Array.isArray(batch) ? batch : [];
    if (!rows.length) break;
    for (const d of rows) out.push(mapaDeal(d));
    if (rows.length < 50) break;
    start += 50;
    if (start > 800) break;
  }
  return out;
}

function extraiTelefoneTexto(...parts) {
  const blob = parts.filter(Boolean).join(' ');
  const m = String(blob).match(/(?:\+?55[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?(?:9\d{4}|\d{4,5})[\s-]?\d{4}/);
  return m ? m[0] : '';
}

function telefoneDeMultifield(phoneArr) {
  const phones = Array.isArray(phoneArr) ? phoneArr : [];
  return phones.find((p) => p?.VALUE)?.VALUE || phones[0]?.VALUE || '';
}

function contatoFromBitrix(c) {
  if (!c) return null;
  const raw = telefoneDeMultifield(c.PHONE);
  const nome = nomeContatoDeCampos(c)
    || nomePessoaDeTexto(c.SOURCE_DESCRIPTION, c.COMMENTS);
  return {
    nome: nome || '',
    telefone: raw,
    whatsappUrl: linkWhatsApp(raw),
  };
}

async function telefonesContatos(ids, {
  prioridadeIds = [],
  maxGet = 100,
  pauseMs = 200,
  rankPorId = null,
} = {}) {
  const uniq = [...new Set(ids.map(String).filter(Boolean))];
  const map = {};
  for (let i = 0; i < uniq.length; i += 20) {
    const slice = uniq.slice(i, i + 20);
    let lista = [];
    try {
      // Bitrix aceita ID=1|2|3 — @ID em lote às vezes devolve card sem NAME/PHONE
      lista = await bitrixGet('crm.contact.list', {
        filter: { ID: slice.join('|') },
        select: ['ID', 'NAME', 'SECOND_NAME', 'LAST_NAME', 'PHONE', 'HAS_PHONE', 'SOURCE_DESCRIPTION'],
      });
    } catch {
      lista = [];
    }
    for (const c of lista || []) {
      const row = contatoFromBitrix(c);
      if (row) map[String(c.ID)] = row;
    }
  }

  // Completa com crm.contact.get — list omite NAME/PHONE com frequência (Instant Form)
  const prio = new Set(prioridadeIds.map(String));
  const faltando = uniq
    .filter((id) => {
      const m = map[id];
      return !m || !m.nome || !m.telefone;
    })
    .sort((a, b) => {
      const pa = prio.has(a) ? 0 : 1;
      const pb = prio.has(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ra = rankPorId?.get(String(a)) ?? 999;
      const rb = rankPorId?.get(String(b)) ?? 999;
      return ra - rb;
    })
    .slice(0, maxGet);

  // Lotes pequenos + pausa — evita QUERY_LIMIT_EXCEEDED no Bitrix
  for (let i = 0; i < faltando.length; i += 5) {
    const batch = faltando.slice(i, i + 5);
    await Promise.all(batch.map(async (id) => {
      try {
        const c = await bitrixGet('crm.contact.get', { id });
        const row = contatoFromBitrix(c);
        if (!row) return;
        const prev = map[id] || {};
        map[id] = {
          nome: row.nome || prev.nome || '',
          telefone: row.telefone || prev.telefone || '',
          whatsappUrl: linkWhatsApp(row.telefone || prev.telefone),
        };
      } catch { /* ignore */ }
    }));
    if (i + 5 < faltando.length && pauseMs > 0) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
  return map;
}

/** Telefone + nome escondidos no card do deal (UF/comentário) quando o contato vem vazio. */
async function enriquecerDoDeal(dealId) {
  if (!dealId) return { telefone: '', nome: '' };
  try {
    const d = await bitrixGet('crm.deal.get', { id: dealId });
    if (!d || typeof d !== 'object') return { telefone: '', nome: '' };
    const valores = Object.entries(d)
      .filter(([k, v]) => v && (k === 'COMMENTS' || k === 'SOURCE_DESCRIPTION' || k === 'ADDITIONAL_INFO' || k.startsWith('UF_')))
      .map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : String(v)));
    return {
      telefone: extraiTelefoneTexto(...valores),
      nome: nomePessoaDeTexto(...valores),
    };
  } catch {
    return { telefone: '', nome: '' };
  }
}

async function telefoneNoDeal(dealId) {
  const e = await enriquecerDoDeal(dealId);
  return e.telefone || '';
}

/** Busca contato por nome (Gerard) e devolve deals do funil desses contatos. */
async function dealsPorNomeContato(q, categoryId, max = 80) {
  const termo = String(q || '').trim();
  if (termo.length < 3) return [];
  let contatos = [];
  try {
    contatos = await bitrixGet('crm.contact.list', {
      filter: { '%NAME': termo },
      select: ['ID', 'NAME', 'LAST_NAME', 'PHONE'],
      start: 0,
    }) || [];
  } catch { contatos = []; }
  if (!Array.isArray(contatos) || !contatos.length) {
    try {
      contatos = await bitrixGet('crm.contact.list', {
        filter: { '%LAST_NAME': termo },
        select: ['ID', 'NAME', 'LAST_NAME', 'PHONE'],
        start: 0,
      }) || [];
    } catch { contatos = []; }
  }
  const ids = (contatos || []).map((c) => c.ID).filter(Boolean).slice(0, 40);
  if (!ids.length) return [];
  const deals = await listaDeals({
    filter: { CATEGORY_ID: categoryId, '@CONTACT_ID': ids },
    max,
  });
  return deals;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-funil-key' }, body: '' };
  }
  const params = event.queryStringParameters || {};
  const headers = event.headers || {};
  const key = params.key || headers['x-funil-key'] || headers['X-Funil-Key'] || '';
  if (!chaveOk(key)) {
    return json(403, { ok: false, erro: 'acesso negado — key admin' });
  }
  if (!process.env.BITRIX_WEBHOOK_READ) {
    return json(500, { ok: false, erro: 'BITRIX_WEBHOOK_READ ausente na Helena' });
  }

  const categoryId = Number(process.env.BITRIX_CATEGORY_ID || 1);
  const limit = Math.min(Number(params.limit || 300), 400);
  const q = String(params.q || params.busca || '').trim();
  const dealProbe = String(params.deal || params.probe || '').trim();
  // leve=1 (App Decisão): menos contact.get — cabe no timeout 26s do Netlify
  const leve = String(params.leve || '') === '1' || String(params.rapido || '') === '1';

  // Probe admin: 1 deal + contato — acha onde mora o nome/telefone na fase atual
  if (dealProbe) {
    try {
      const raw = await bitrixGet('crm.deal.get', { id: dealProbe });
      if (!raw) return json(404, { ok: false, erro: 'deal não encontrado' });
      let contato = null;
      if (raw.CONTACT_ID) {
        try { contato = await bitrixGet('crm.contact.get', { id: raw.CONTACT_ID }); } catch { contato = null; }
      }
      const ufStrings = Object.fromEntries(
        Object.entries(raw)
          .filter(([k, v]) => k.startsWith('UF_') && v != null && v !== '' && typeof v !== 'object')
          .slice(0, 40),
      );
      return json(200, {
        ok: true,
        probe: true,
        deal: {
          id: raw.ID,
          title: raw.TITLE,
          stageId: raw.STAGE_ID,
          fase: estagioPorStageId(raw.STAGE_ID) || raw.STAGE_ID,
          contactId: raw.CONTACT_ID,
          comments: raw.COMMENTS || '',
          sourceDescription: raw.SOURCE_DESCRIPTION || '',
          additionalInfo: raw.ADDITIONAL_INFO || '',
          dateCreate: raw.DATE_CREATE,
          ufStrings,
        },
        contato: contato ? {
          id: contato.ID,
          nome: nomeContatoDeCampos(contato),
          name: contato.NAME,
          second: contato.SECOND_NAME,
          last: contato.LAST_NAME,
          phone: telefoneDeMultifield(contato.PHONE),
          sourceDescription: contato.SOURCE_DESCRIPTION || '',
        } : null,
        nomeInferido: nomePessoaDeTexto(
          raw.TITLE, raw.COMMENTS, raw.SOURCE_DESCRIPTION, raw.ADDITIONAL_INFO,
          ...Object.values(ufStrings),
        ),
        telefoneInferido: extraiTelefoneTexto(
          raw.COMMENTS, raw.SOURCE_DESCRIPTION, raw.ADDITIONAL_INFO,
          ...Object.values(ufStrings),
        ),
      });
    } catch (e) {
      return json(502, { ok: false, erro: String((e && e.message) || e) });
    }
  }

  const byId = new Map();

  try {
    // 1) Janela recente
    for (const d of await listaDeals({ filter: { CATEGORY_ID: categoryId }, max: limit })) {
      byId.set(String(d.id), d);
    }
    // 2) Busca por produto no TITLE — só os pedidos (?produtos=ALICERCE,PUNTA)
    //    Evita timeout. Se vazio, usa lista curta padrão.
    const extras = String(params.produtos || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const produtos = [...new Set(extras.length ? extras : PRODUTOS_BUSCA.slice(0, 6))];
    for (const p of produtos.slice(0, leve ? 6 : 8)) {
      const maxProd = leve
        ? (p === 'ALICERCE' || p === 'PUNTA' ? 120 : 80)
        : (p === 'ALICERCE' || p === 'PUNTA' ? 200 : 120);
      const found = await listaDeals({
        filter: { CATEGORY_ID: categoryId, '%TITLE': p },
        max: maxProd,
      });
      for (const d of found) byId.set(String(d.id), d);
    }
    // 3) Busca por nome de pessoa
    if (q) {
      // também no TITLE do deal
      for (const d of await listaDeals({
        filter: { CATEGORY_ID: categoryId, '%TITLE': q },
        max: 80,
      })) byId.set(String(d.id), d);
      for (const d of await dealsPorNomeContato(q, categoryId)) byId.set(String(d.id), d);
    }
  } catch (e) {
    return json(502, { ok: false, erro: String((e && e.message) || e) });
  }

  const deals = [...byId.values()];
  // Prioriza fases do topo do funil (onde o Michel age agora) + deals mais novos
  const ordemFase = {
    'Leads Novos': 0,
    'Tentando Contato': 1,
    'Carteira corretor': 2,
    'Mapeamento': 3,
    'Reagendamento de Visita': 4,
    'Follow Up': 5,
    'Agendamento Meetins': 6,
    'Agendado Físico': 7,
  };
  const fasesPrioritarias = new Set(Object.keys(ordemFase));
  const prioridadeIds = deals
    .filter((d) => fasesPrioritarias.has(d.fase))
    .map((d) => d.contactId);
  const rankPorId = new Map();
  for (const d of deals) {
    const cid = String(d.contactId || '');
    if (!cid) continue;
    const fr = ordemFase[d.fase] ?? 50;
    const age = d.dateCreate ? (Date.now() - Date.parse(d.dateCreate)) : 1e15;
    const score = fr * 1e15 + (Number.isFinite(age) ? age : 1e15);
    const prev = rankPorId.get(cid);
    if (prev == null || score < prev) rankPorId.set(cid, score);
  }
  const contatos = await telefonesContatos(deals.map((d) => d.contactId), {
    prioridadeIds,
    rankPorId,
    maxGet: leve ? 40 : 60,
    pauseMs: leve ? 60 : 200,
  });
  // Card do deal: só no modo rico (leve pula — timeout)
  const semDados = leve ? [] : deals.filter((d) => {
    const c = contatos[String(d.contactId)];
    const nomeTitulo = !tituloEhFormulario(d.title) ? limpaNomePessoa(d.title) : '';
    const nome = c?.nome || nomeTitulo || nomePessoaDeTexto(d.titleForm, d.title, d.comments, d.sourceDescription);
    return !c?.telefone || !nome;
  }).filter((d) => fasesPrioritarias.has(d.fase)).slice(0, 15);
  await Promise.all(semDados.map(async (d) => {
    const extra = await enriquecerDoDeal(d.id);
    if (extra.telefone) {
      d.telefone = extra.telefone;
      d.whatsappUrl = linkWhatsApp(extra.telefone);
    }
    if (extra.nome) d._nomeDeal = extra.nome;
  }));
  for (const d of deals) {
    const c = contatos[String(d.contactId)] || null;
    if (!d.telefone) d.telefone = c?.telefone || null;
    if (!d.whatsappUrl) d.whatsappUrl = c?.whatsappUrl || linkWhatsApp(d.telefone);
    const nomeTitulo = !tituloEhFormulario(d.title) ? limpaNomePessoa(d.title) : '';
    const nome = c?.nome
      || d._nomeDeal
      || nomeTitulo
      || nomePessoaDeTexto(d.titleForm, d.title, d.comments, d.sourceDescription)
      || null;
    d.nomeContato = nome;
    // Mostra o cliente, não só o nome do formulário
    if (nome && (tituloEhFormulario(d.title) || !d.title || /^\d+$/.test(d.title))) {
      d.title = nome;
    }
    delete d._nomeDeal;
  }

  const porFase = {};
  for (const d of deals) {
    porFase[d.fase] = (porFase[d.fase] || 0) + 1;
  }

  return json(200, {
    ok: true,
    fonte: 'helena-bitrix-read',
    categoryId,
    total: deals.length,
    busca: q || null,
    produtos: PRODUTOS_BUSCA,
    fasesCanonicas: Object.keys(ESTAGIO_BITRIX),
    porFase,
    deals,
  });
}
