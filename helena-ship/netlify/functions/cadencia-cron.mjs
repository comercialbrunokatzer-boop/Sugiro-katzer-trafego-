/**
 * CRON — cadencia automatica dos leads PATROCINADOS do Bruno
 * (Tentando Contato + Mapeamento + gancho simples de Follow Up), com anti-spam.
 *
 * Seguro por padrao:
 *   CADENCIA_AUTO=1          -> liga a rotina
 *   CADENCIA_MODO=producao   -> manda WhatsApp de verdade
 *   (sem isso = homolog: so lista o que FARIA)
 *
 * Env uteis:
 *   CADENCIA_MAX_LOTE=4
 *   CADENCIA_LIMITE_DIA=12
 *   CADENCIA_INTERVALO_H=36
 *   CADENCIA_MAX_IDADE_DIAS=90
 *   BRUNO_BITRIX_ID=1
 *   HELENA_ABERTURA_TOKEN (+ URL do site) pra POST /api/helena/retomada
 */
import './_maestro-defaults.mjs';
import { bitrixGet } from '../../maestro/src/bitrixRead.js';
import { CFG } from '../../maestro/src/config.js';
import { estagioPorStageId } from '../../maestro/src/secretaria.js';
import { montaFilaCadencia } from '../../maestro/src/cadenciaPatrocinado.js';
import { soDigitos } from '../../maestro/src/retomadaPatrocinado.js';

export const config = { schedule: '30 13,16,19 * * 1-6' }; // 10h30/13h30/16h30 BRT (seg-sab)

const STAGE_TENTANDO = process.env.STAGE_TENTANDO_CONTATO || process.env.STAGE_QUALIFICADO || 'C1:PREPARATION';
const STAGE_MAPEAMENTO = process.env.STAGE_MAPEAMENTO || 'C1:PREPAYMENT_INVOICE';
const STAGE_FOLLOWUP = process.env.STAGE_FOLLOW_UP || 'C1:UC_7P0WD3';

function envOn(k) {
  return /^(1|on|true|sim)$/i.test(String(process.env[k] || '').trim());
}

function modoProducao() {
  return String(process.env.CADENCIA_MODO || '').trim().toLowerCase() === 'producao';
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

async function listaDealsBrunoCadencia({ brunoId, max = 90 }) {
  const categoryId = Number(process.env.BITRIX_CATEGORY_ID || CFG.CATEGORY_ID || 1);
  const select = [
    'ID', 'TITLE', 'STAGE_ID', 'CONTACT_ID', 'ASSIGNED_BY_ID',
    'DATE_CREATE', 'DATE_MODIFY', 'COMMENTS', 'SOURCE_DESCRIPTION', 'SOURCE_ID',
  ];
  const out = [];
  for (const stageId of [STAGE_TENTANDO, STAGE_MAPEAMENTO, STAGE_FOLLOWUP]) {
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

function juntaEstadosPorTelefone(...fontes) {
  const out = {};
  for (const fonte of fontes) {
    for (const [telRaw, estado] of Object.entries(fonte || {})) {
      const tel = soDigitos(telRaw);
      if (!tel) continue;
      out[tel] = { ...(out[tel] || {}), ...(estado || {}) };
    }
  }
  return out;
}

async function disparaCadenciaHelena(item, { modo }) {
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
        interesse: item.tipo,
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
  if (!envOn('CADENCIA_AUTO')) {
    return resp({ ok: true, pulado: 'CADENCIA_AUTO desligado' });
  }
  if (!process.env.BITRIX_WEBHOOK_READ) {
    return resp({ ok: false, erro: 'BITRIX_WEBHOOK_READ ausente' });
  }

  const brunoId = String(process.env.BRUNO_BITRIX_ID || CFG.BRUNO_BITRIX_ID || '1');
  const maxLote = Number(process.env.CADENCIA_MAX_LOTE || 4) || 4;
  const limiteDiario = Number(process.env.CADENCIA_LIMITE_DIA || 12) || 12;
  const intervaloH = Number(process.env.CADENCIA_INTERVALO_H || 36) || 36;
  const maxIdadeDias = Number(process.env.CADENCIA_MAX_IDADE_DIAS || 90) || 90;
  const modo = modoProducao() ? 'producao' : 'homolog';
  const agoraMs = Date.now();

  let db = null;
  let meta = { enviadasHoje: 0, porTel: {} };
  let metaRetomada = { porTel: {} };
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_DATABASE_URL) {
    try {
      db = await adminDb();
      const [cadSnap, retSnap] = await Promise.all([
        db.ref('helena_cadencia').once('value'),
        db.ref('helena_retomada').once('value'),
      ]);
      meta = cadSnap.val() || meta;
      metaRetomada = retSnap.val() || metaRetomada;
    } catch (e) {
      console.error('[cadencia-cron] firebase', e && e.message);
    }
  }

  const diaBrt = new Date(agoraMs - 3 * 3600000).toISOString().slice(0, 10);
  if (meta.dia !== diaBrt) {
    meta = { dia: diaBrt, enviadasHoje: 0, porTel: meta.porTel || {} };
  }

  const raw = await listaDealsBrunoCadencia({ brunoId, max: 90 });
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

  const conversaPorTel = {};
  if (db) {
    try {
      const convSnap = await db.ref('helena_conversas').once('value');
      const convs = convSnap.val() || {};
      for (const deal of deals) {
        const tel = soDigitos(deal.telefone);
        if (!tel) continue;
        const fk = Object.keys(convs).find((k) => soDigitos(k) === tel || soDigitos(k).endsWith(tel.slice(-11)));
        if (!fk) continue;
        conversaPorTel[tel] = estadoDeConversa(convs[fk]);
      }
    } catch { /* best-effort */ }
  }

  const estadosPorTel = juntaEstadosPorTelefone(metaRetomada.porTel || {}, meta.porTel || {}, conversaPorTel);
  const { lote, pulados, alertas } = montaFilaCadencia(deals, {
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
  const enviados = [];
  for (const item of lote) {
    try {
      const r = await disparaCadenciaHelena(item, { modo });
      resultados.push({
        dealId: item.dealId,
        telefone: item.telefone.slice(-4),
        tipo: item.tipo,
        produto: item.produtoKey,
        ...r,
      });
      if (r.ok && modo === 'producao') {
        meta.enviadasHoje = (meta.enviadasHoje || 0) + 1;
        meta.porTel = meta.porTel || {};
        meta.porTel[item.telefone] = {
          ...(meta.porTel[item.telefone] || {}),
          lastCadenciaMs: agoraMs,
          ...(item.tipo === 'followup_pos_interesse' ? { lastFollowupMs: agoraMs } : {}),
        };
        enviados.push(item);
      }
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
    try {
      const updates = { helena_cadencia: meta };
      for (const item of enviados) {
        updates[`helena_retomada/porTel/${item.telefone}/lastRetomadaMs`] = agoraMs;
      }
      await db.ref().update(updates);
    } catch { /* ignore */ }
  }

  return resp({
    ok: true,
    modo,
    candidatos: deals.length,
    lote: lote.length,
    enviadasHoje: meta.enviadasHoje || 0,
    resultados,
    alertas_followup: alertas.slice(0, 10),
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
