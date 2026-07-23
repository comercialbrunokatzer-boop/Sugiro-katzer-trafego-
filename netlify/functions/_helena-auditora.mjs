// Helena Auditora — classifica A/B/C/D (NÃO é a Secretária).
import {
  PROMPT_HELENA_AUDITORA,
  classificaHeuristica,
  normalizaAbcd,
  isVermelho,
  resumoAuditoria,
} from './_auditoria-abcd.mjs';
import { enviaWhats } from './_infra.mjs';

export async function classificaComIa(lead, timelineTexto = '') {
  const key = process.env.OPENAI_API_KEY || process.env.HELENA_AUDITORA_OPENAI_KEY || '';
  if (!key) return classificaHeuristica(lead);

  const user = [
    `Lead: ${lead.nome}`,
    `Telefone: ${lead.telefone || '—'}`,
    `Campanha: ${lead.campanha || '—'}`,
    `Cidade: ${lead.cidade || '—'}`,
    `Fonte: ${lead.fonte || '—'}`,
    `Status: ${lead.status || '—'}`,
    `Status pós-mapeamento: ${lead.statusPosMapeamento || '—'}`,
    `Marca Caçador (CPL): ${lead.qualidade || '—'}`,
    `Provisória: ${lead.qualidadeProvisoria || '—'}`,
    '',
    'Timeline:',
    timelineTexto || '(sem timeline — classifique com o que houver)',
  ].join('\n');

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.HELENA_AUDITORA_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT_HELENA_AUDITORA },
          { role: 'user', content: user },
        ],
      }),
    });
    const body = await r.json();
    if (!r.ok) {
      const h = classificaHeuristica(lead);
      h.via = 'heuristica';
      h.motivo = `OpenAI falhou (${r.status}) · ${h.motivo}`;
      return h;
    }
    const raw = body.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const qualidade = normalizaAbcd(String(parsed.qualidade || '').replace(/[^ABCD]/gi, '')) || 'C';
    return {
      qualidade,
      confianca: Number(parsed.confianca) || 50,
      motivo: String(parsed.motivo || '').slice(0, 200) || 'classificado pela IA',
      resumo: String(parsed.resumo || '').slice(0, 400),
      sinais_compra: Array.isArray(parsed.sinais_compra) ? parsed.sinais_compra.slice(0, 5) : [],
      risco: String(parsed.risco || 'médio'),
      via: 'openai',
    };
  } catch (e) {
    const h = classificaHeuristica(lead);
    h.motivo = `IA erro: ${String(e.message || e).slice(0, 80)} · ${h.motivo}`;
    return h;
  }
}

/** Atualiza UF_CRM_QUALIDADE_IA + UF_CRM_RESUMO_IA no Bitrix (webhook REST). */
export async function atualizaBitrixIa(lead, classif) {
  const base = (process.env.BITRIX_WEBHOOK_URL || process.env.BITRIX24_WEBHOOK || '').replace(/\/+$/, '');
  if (!base) return { ok: false, skipped: true, motivo: 'BITRIX_WEBHOOK_URL ausente' };
  const dealId = String(lead.bitrixId || lead.id || '').replace(/^bitrix-/, '');
  if (!dealId || !/^\d+$/.test(dealId)) {
    return { ok: false, skipped: true, motivo: 'dealId Bitrix numérico ausente' };
  }
  const fields = {
    UF_CRM_QUALIDADE_IA: classif.qualidade,
    UF_CRM_RESUMO_IA: `${classif.resumo || ''} | ${classif.motivo || ''}`.slice(0, 500),
  };
  try {
    const r = await fetch(`${base}/crm.deal.update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dealId, fields }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || body.error) {
      return { ok: false, skipped: false, motivo: body.error_description || body.error || `HTTP ${r.status}` };
    }
    return { ok: true, dealId };
  } catch (e) {
    return { ok: false, skipped: false, motivo: String(e.message || e) };
  }
}

/**
 * Roda um ciclo da Auditora nos leads de hoje.
 * @returns {{ ok, processados, vermelhos, resumo }}
 */
export async function rodaCicloAuditora(leads, {
  forcar = false,
  avisarVermelhos = true,
} = {}) {
  const out = [];
  const lista = [...(leads || [])];
  for (let i = 0; i < lista.length; i++) {
    const lead = lista[i];
    if (!forcar && normalizaAbcd(lead.qualidadeIa)) continue;
    // Filtro doc: fontes pagas — demo também roda pra validar fluxo
    const fonte = String(lead.fonte || '').toLowerCase();
    const paga = /bitrix|meta|facebook|patroc|ads|demo/.test(fonte) || !fonte;
    if (!paga) continue;

    const classif = await classificaComIa(lead, lead.timeline || '');
    const bitrix = await atualizaBitrixIa(lead, classif);
    lista[i] = {
      ...lead,
      qualidadeIa: classif.qualidade,
      confiancaIa: classif.confianca,
      motivoIa: classif.motivo,
      resumoIa: classif.resumo,
      riscoIa: classif.risco,
      sinaisIa: classif.sinais_compra,
      iaVia: classif.via,
      iaEm: new Date().toISOString(),
      bitrixIa: bitrix,
      travaVermelha: isVermelho({ ...lead, qualidadeReal: lead.qualidadeReal, statusPosMapeamento: lead.statusPosMapeamento }),
    };
    out.push({ id: lead.id, nome: lead.nome, ...classif, bitrix });
  }

  const resumo = resumoAuditoria(lista);
  let whats = { enviado: false };
  if (avisarVermelhos && resumo.vermelhos > 0) {
    const ceo = process.env.WHATSAPP_CEO || '';
    if (ceo) {
      const linhas = resumo.leadsVermelhos.slice(0, 8).map((l) => `· ${l.nome} (${l.corretor || '—'})`);
      whats = await enviaWhats(
        ceo,
        [
          `🔴 *TRAVA Auditoria* — ${resumo.vermelhos} lead(s) Saiu sem Qualidade Real`,
          ...linhas,
          '',
          'Preencher A/B/C/D Real no Painel 3.',
        ].join('\n'),
      );
    }
  }

  return {
    ok: true,
    processados: out.length,
    classificacoes: out,
    vermelhos: resumo.vermelhos,
    resumo,
    leads: lista,
    whats,
  };
}
