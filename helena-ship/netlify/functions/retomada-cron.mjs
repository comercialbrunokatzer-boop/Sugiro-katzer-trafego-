/**
 * CRON — retomada automática dos leads PATROCINADOS do Bruno
 * (Leads Novos + Tentando Contato), com mídia, ritmo humano, anti-spam.
 *
 * Duplo interruptor (seguro por padrão):
 *   RETOMADA_AUTO=1          → liga a rotina
 *   RETOMADA_MODO=producao   → manda WhatsApp de verdade
 *   (sem isso = homolog: só lista o que FARIA)
 *
 * Env úteis:
 *   RETOMADA_MAX_LOTE=5
 *   RETOMADA_LIMITE_DIA=20
 *   RETOMADA_INTERVALO_H=36
 *   RETOMADA_MAX_IDADE_DIAS=45
 *   BRUNO_BITRIX_ID=1
 *   HELENA_ABERTURA_TOKEN (+ URL do site) pra POST /api/helena/retomada
 */
import './_maestro-defaults.mjs';
import { bitrixGet } from '../../maestro/src/bitrixRead.js';
import { estagioPorStageId } from '../../maestro/src/secretaria.js';
import { montaFilaRetomada, soDigitos } from '../../maestro/src/retomadaPatrocinado.js';
import { CFG } from '../../maestro/src/config.js';

export const config = { schedule: '0 12,15,18 * * 1-6' }; // 9h/12h/15h BRT ≈ 12/15/18 UTC (seg–sáb)

const STAGE_NEW = process.env.STAGE_LEAD_NOVO || 'C1:NEW';
const STAGE_TENT = process.env.STAGE_QUALIFICADO || 'C1:PREPARATION';

function envOn(k) {
  return /^(1|on|true|sim)$/i.test(String(process.env[k] || '').trim());
}

function modoProducao() {
  return String(process.env.RETOMADA_MODO || '').trim().toLowerCase() === 'producao';
}

async function adminDb() {
  const { default: admin } = await import('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  return admin.database();
}

async function listaDealsBrunoPatrocinado({ brunoId, max = 80 }) {
  const categoryId = Number(process.env.BITRIX_CATEGORY_ID || CFG.CATEGORY_ID || 1);
  const select = [
    'ID', 'TITLE', 'STAGE_ID', 'CONTACT_ID', 'ASSIGNED_BY_ID',
    'DATE_CREATE', 'DATE_MODIFY', 'COMMENTS', 'SOURCE_DESCRIPTION', 'SOURCE_ID',
  ];
  const out = [];
  for (const stageId of [STAGE_NEW, STAGE_TENT]) {
    let start = 0;
    for (let page = 0; page < 3; page += 1) {
      const batch = await bitrixGet('crm.deal.list', {
        filter: {
          CATEGORY_ID: categoryId,
          ASSIGNED_BY_ID: brunoId,
          STAGE_ID: stageId,
        },
        select,
        order: { DATE_MODIFY: 'DESC' },
        start,
      }) || [];
      if (!Array.isArray(batch) || !batch.length) break;
      out.push(...batch);
      if (batch.length < 50) break;
      start += batch.length;
      if (out.length >= max) break;
    }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

async function telefoneDoContato(contactId) {
  if (!contactId) return { telefone: '', nome: '' };
  try {
    const c = await bitrixGet('crm.contact.get', { id: contactId });
    const phones = Array.isArray(c?.PHONE) ? c.PHONE : [];
    const tel = soDigitos(phones[0]?.VALUE || '');
    const nome = [c?.NAME, c?.LAST_NAME].filter(Boolean).join(' ').trim();
    return { telefone: tel, nome };
  } catch {
    return { telefone: '', nome: '' };
  }
}

function estadoDeConversa(conv) {
  if (!conv) return {};
  const msgs = Array.isArray(conv.messages) ? conv.messages : [];
  let lastClientMsgMs = null;
  let lastHelenaMs = null;
  for (const m of msgs) {
    const ts = Number(m.ts || m.enviadoEmMs || 0) || null;
    if (!ts) continue;
    if (m.role === 'user' || m.role === 'cliente') lastClientMsgMs = ts;
    if (m.role === 'assistant' || m.role === 'helena') lastHelenaMs = ts;
  }
  return {
    handledByHuman: !!conv.handledByHuman,
    lastClientMsgMs,
    lastHelenaMs,
  };
}

async function disparaRetomadaHelena(item, { modo }) {
  const base = (process.env.URL || process.env.HELENA_ABERTURA_URL || '').replace(/\/api\/helena\/lead-form$/, '').replace(/\/+$/, '');
  const token = process.env.HELENA_ABERTURA_TOKEN || process.env.HELENA_RETOMADA_TOKEN || '';
  if (!base || !token) {
    return { ok: false, motivo: 'sem_url_ou_token' };
  }
  if (modo !== 'producao') {
    return { ok: true, simulado: true, preview: item.mensagem.slice(0, 80) };
  }
  const url = `${base}/api/helena/retomada?key=${encodeURIComponent(token)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      phone: item.telefone,
      dealId: item.dealId,
      lead: {
        nome: item.nome,
        campanha: item.title,
        produto: item.produto,
      },
      mensagem: item.mensagem,
      midiaChave: item.midiaChave,
      midiaTipo: item.midiaTipo,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) {
    return { ok: false, motivo: j.erro || `HTTP ${r.status}` };
  }
  return { ok: true, ...j };
}

export async function handler() {
  if (!envOn('RETOMADA_AUTO')) {
    return resp({ ok: true, pulado: 'RETOMADA_AUTO desligado' });
  }
  if (!process.env.BITRIX_WEBHOOK_READ) {
    return resp({ ok: false, erro: 'BITRIX_WEBHOOK_READ ausente' });
  }

  const brunoId = String(process.env.BRUNO_BITRIX_ID || CFG.BRUNO_BITRIX_ID || '1');
  const maxLote = Number(process.env.RETOMADA_MAX_LOTE || 5) || 5;
  const limiteDiario = Number(process.env.RETOMADA_LIMITE_DIA || 20) || 20;
  const intervaloH = Number(process.env.RETOMADA_INTERVALO_H || 36) || 36;
  const maxIdadeDias = Number(process.env.RETOMADA_MAX_IDADE_DIAS || 45) || 45;
  const modo = modoProducao() ? 'producao' : 'homolog';
  const agoraMs = Date.now();

  let db = null;
  let meta = { enviadasHoje: 0, porTel: {} };
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_DATABASE_URL) {
    try {
      db = await adminDb();
      const snap = await db.ref('helena_retomada').once('value');
      meta = snap.val() || meta;
    } catch (e) {
      console.error('[retomada-cron] firebase', e && e.message);
    }
  }

  // reset contador diário (BRT)
  const diaBrt = new Date(agoraMs - 3 * 3600000).toISOString().slice(0, 10);
  if (meta.dia !== diaBrt) {
    meta = { dia: diaBrt, enviadasHoje: 0, porTel: meta.porTel || {} };
  }

  const raw = await listaDealsBrunoPatrocinado({ brunoId, max: 80 });
  const deals = [];
  for (const d of raw) {
    const fase = estagioPorStageId(d.STAGE_ID) || d.STAGE_ID;
    const cont = await telefoneDoContato(d.CONTACT_ID);
    deals.push({
      id: d.ID,
      title: d.TITLE || '',
      stageId: d.STAGE_ID,
      fase,
      assignedById: d.ASSIGNED_BY_ID,
      comments: d.COMMENTS || '',
      sourceDescription: d.SOURCE_DESCRIPTION || '',
      sourceId: d.SOURCE_ID || '',
      dateCreate: d.DATE_CREATE,
      dateModify: d.DATE_MODIFY,
      telefone: cont.telefone,
      nome: cont.nome,
    });
  }

  // estados: retomada + conversa Helena
  const estadosPorTel = { ...(meta.porTel || {}) };
  if (db) {
    try {
      const convSnap = await db.ref('helena_conversas').once('value');
      const convs = convSnap.val() || {};
      for (const deal of deals) {
        const tel = soDigitos(deal.telefone);
        if (!tel) continue;
        const fk = Object.keys(convs).find((k) => soDigitos(k) === tel || soDigitos(k).endsWith(tel.slice(-11)));
        if (!fk) continue;
        const stConv = estadoDeConversa(convs[fk]);
        estadosPorTel[tel] = { ...(estadosPorTel[tel] || {}), ...stConv };
      }
    } catch { /* best-effort */ }
  }

  const { lote, pulados } = montaFilaRetomada(deals, {
    brunoId,
    agoraMs,
    maxIdadeDias,
    maxLote,
    estadosPorTel,
    intervaloMinHoras: intervaloH,
    enviadasHojeGlobal: meta.enviadasHoje || 0,
    limiteDiario,
  });

  const resultados = [];
  for (const item of lote) {
    try {
      const r = await disparaRetomadaHelena(item, { modo });
      resultados.push({
        dealId: item.dealId,
        telefone: item.telefone.slice(-4),
        produto: item.produtoKey,
        ...r,
      });
      if (r.ok && modo === 'producao') {
        meta.enviadasHoje = (meta.enviadasHoje || 0) + 1;
        meta.porTel = meta.porTel || {};
        meta.porTel[item.telefone] = {
          ...(meta.porTel[item.telefone] || {}),
          lastRetomadaMs: agoraMs,
        };
      }
      // ritmo humano entre disparos
      if (modo === 'producao' && lote.indexOf(item) < lote.length - 1) {
        await new Promise((res) => setTimeout(res, 25000));
      }
    } catch (e) {
      resultados.push({ dealId: item.dealId, ok: false, motivo: String(e && e.message || e) });
    }
  }

  meta.dia = diaBrt;
  meta.ultimaCorridaMs = agoraMs;
  if (db) {
    try { await db.ref('helena_retomada').set(meta); } catch { /* ignore */ }
  }

  return resp({
    ok: true,
    modo,
    candidatos: deals.length,
    lote: lote.length,
    enviadasHoje: meta.enviadasHoje || 0,
    resultados,
    pulados: pulados.slice(0, 30),
  });
}

function resp(body) {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body, null, 2),
  };
}
