// GET  /api/cacador  → leads de hoje + botões 2 toques
// POST /api/cacador  → { leadId, qualidade: bom|curioso|errado|comprador }
// Toast canônico: "Registrado - CPL BOM recalculado"
// V6: cada BOM / Comprador pinga WhatsApp do Bruno (Evolution → Z-API).
import { json, enviaWhats } from './_infra.mjs';
import { leLeadsHoje, marcaLeadESincroniza } from './_cacador-io.mjs';
import { payloadCacador, QUALIDADE_TIPOS } from './_cacador.mjs';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body: '',
    };
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {
      return json(400, { ok: false, erro: 'body inválido' });
    }
    try {
      const qualidade = body.qualidade || body.tipo || body.marca;
      const leadId = body.leadId || body.id;
      if (!leadId) return json(400, { ok: false, erro: 'informe leadId' });
      if (!QUALIDADE_TIPOS.includes(qualidade)) {
        return json(400, { ok: false, erro: `qualidade: ${QUALIDADE_TIPOS.join(' / ')}` });
      }
      const result = await marcaLeadESincroniza({
        leadId,
        qualidade,
        quem: body.quem || 'Michel',
        corretor: body.corretor || body.corretorResponsavel || body.quem || 'Michel',
      });
      const payload = payloadCacador(result.leads);
      let whats = { enviado: false, motivo: 'não BOM' };
      if (qualidade === 'bom' || qualidade === 'comprador') {
        const ceo = process.env.WHATSAPP_CEO || '';
        const lead = result.lead || {};
        const nome = lead.nome || lead.linha || leadId;
        const camp = lead.campanha || '';
        const ico = qualidade === 'comprador' ? '💰' : '🟢';
        const label = qualidade === 'comprador' ? 'COMPRADOR' : 'BOM';
        whats = ceo
          ? await enviaWhats(ceo, `${ico} Caçador — *${label}* · ${nome}${camp ? ` · ${camp}` : ''}`)
          : { enviado: false, motivo: 'WHATSAPP_CEO ausente' };
      }
      return json(200, {
        ok: true,
        toast: result.toast,
        lead: result.lead,
        totaisCampanha: result.totaisCampanha,
        whats,
        ...payload,
      });
    } catch (e) {
      return json(400, { ok: false, erro: String((e && e.message) || e) });
    }
  }

  if (event.httpMethod !== 'GET') return json(405, { ok: false, erro: 'use GET ou POST' });

  try {
    const { leads, data, fonte } = await leLeadsHoje();
    const payload = payloadCacador(leads);
    return json(200, { ...payload, data, fonteLeads: fonte });
  } catch (e) {
    return json(500, { ok: false, erro: String((e && e.message) || e) });
  }
}
