// Webhook Bitrix → entra lead no Caçador (Painel 3).
// POST /api/webhook-bitrix
// Body típico: { nome, telefone, campanha, cidade?, bitrixUrl?, id? }
// Header opcional: x-bitrix-secret = BITRIX_WEBHOOK_SECRET
import { json, enviaWhats } from './_infra.mjs';
import { leLeadsHoje, salvaLeadsHoje } from './_cacador-io.mjs';
import { normalizaLead } from './_cacador.mjs';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, x-bitrix-secret',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') return json(405, { ok: false, erro: 'use POST' });

  const secret = process.env.BITRIX_WEBHOOK_SECRET || '';
  const h = event.headers || {};
  const got = h['x-bitrix-secret'] || h['X-Bitrix-Secret'] || '';
  if (secret && got !== secret) {
    return json(401, { ok: false, erro: 'secret Bitrix inválido' });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {
    return json(400, { ok: false, erro: 'body inválido' });
  }

  const nome = String(body.nome || body.NAME || body.name || '').trim();
  if (!nome) return json(400, { ok: false, erro: 'nome obrigatório' });

  const lead = normalizaLead({
    id: body.id || body.ID || `bitrix-${Date.now()}`,
    nome,
    telefone: body.telefone || body.PHONE || body.phone || '',
    campanha: body.campanha || body.UF_CRM_CAMPANHA || body.campaign || '',
    cidade: body.cidade || body.CITY || '',
    status: body.status || 'Novo',
    bitrixUrl: body.bitrixUrl || body.URL || null,
    bitrixId: body.bitrixId || body.ID || body.id || null,
    fonte: body.fonte || 'bitrix',
    recebidoEm: new Date().toISOString(),
    statusPosMapeamento: body.statusPosMapeamento || body.STATUS_POS || null,
    qualidadeProvisoria: body.qualidadeProvisoria || body.UF_CRM_QUALIDADE_PROV || null,
    qualidadeReal: body.qualidadeReal || body.UF_CRM_QUALIDADE_REAL || null,
    timeline: body.timeline || null,
  });

  const { leads } = await leLeadsHoje();
  const semDup = leads.filter((l) => l.id !== lead.id);
  semDup.unshift(lead);
  await salvaLeadsHoje(semDup, { fonte: 'bitrix' });

  const ceo = process.env.WHATSAPP_CEO || '';
  let whats = { enviado: false };
  if (ceo) {
    whats = await enviaWhats(
      ceo,
      `📥 Bitrix → Caçador\n*${lead.nome}* · ${lead.campanha || 'sem campanha'}${lead.cidade ? ` · ${lead.cidade}` : ''}`,
    );
  }

  return json(200, { ok: true, lead, whats, pendentes: semDup.filter((l) => !l.qualidade).length });
}
