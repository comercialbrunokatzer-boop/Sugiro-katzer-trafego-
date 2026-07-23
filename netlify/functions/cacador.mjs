// GET  /api/cacador  → leads de hoje + botões 2 toques + auditoria A/B/C/D
// POST /api/cacador  → { leadId, qualidade } OU { leadId, qualidadeProvisoria|qualidadeReal|statusPosMapeamento }
import { json, enviaWhats } from './_infra.mjs';
import { leLeadsHoje, marcaLeadESincroniza, marcaAuditoriaESincroniza } from './_cacador-io.mjs';
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
      const leadId = body.leadId || body.id;
      if (!leadId) return json(400, { ok: false, erro: 'informe leadId' });

      const temAuditoria = body.qualidadeProvisoria != null
        || body.qualidadeReal != null
        || body.statusPosMapeamento != null
        || body.acao === 'auditoria';
      if (temAuditoria) {
        const result = await marcaAuditoriaESincroniza({
          leadId,
          qualidadeProvisoria: body.qualidadeProvisoria,
          qualidadeReal: body.qualidadeReal,
          statusPosMapeamento: body.statusPosMapeamento,
          quem: body.quem || body.corretor || 'Michel',
        });
        const payload = payloadCacador(result.leads);
        let whats = { enviado: false };
        if (result.vermelho) {
          const ceo = process.env.WHATSAPP_CEO || '';
          if (ceo) {
            whats = await enviaWhats(
              ceo,
              `🔴 TRAVA · *${result.lead.nome}* Saiu sem Qualidade Real\nCorretor: ${result.lead.corretor || body.quem || '—'}\nPreencher A/B/C/D Real no Painel.`,
            );
          }
        }
        return json(200, {
          ok: true,
          toast: result.toast,
          lead: result.lead,
          vermelho: result.vermelho,
          bloqueiaAvancoBitrix: result.bloqueiaAvancoBitrix,
          whats,
          ...payload,
        });
      }

      const qualidade = body.qualidade || body.tipo || body.marca;
      if (!QUALIDADE_TIPOS.includes(qualidade)) {
        return json(400, { ok: false, erro: `qualidade: ${QUALIDADE_TIPOS.join(' / ')} ou auditoria A/B/C/D` });
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
        const isDemo = lead.fonte === 'demo' || String(lead.id || '').startsWith('demo-');
        whats = ceo
          ? await enviaWhats(
            ceo,
            [
              isDemo
                ? '⚠️ *TESTE/DEMO* — lead seed · *não está no Bitrix*'
                : (lead.fonte === 'bitrix' ? '✅ Lead *Bitrix* (real)' : null),
              `${ico} Caçador -- *${label}* - ${nome}${camp ? ` - ${camp}` : ''}`,
              lead.telefone && lead.telefone !== '—' ? `Tel: ${lead.telefone}` : null,
            ].filter(Boolean).join('\n'),
          )
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
