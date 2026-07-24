// Helena Auditora — classifica Potencial/Interessado/Curioso/Fake/Ruim (NÃO é a Secretária).
import { isVermelho, resumoAuditoria } from './_auditoria-abcd.mjs';
import {
  PROMPT_QUALIDADE_TRAFEGO,
  normalizaQualTrafego,
  fonteEhTrafegoPago,
  QUAL_TRAFEGO_ROTULO,
} from './_qualidade-trafego.mjs';
import { enviaWhats } from './_infra.mjs';
import { mensagemTravaSaiuSemQualidadeReal, isDemoLead } from './_whatsapp-mensagens.mjs';
import { leTravaEnviados, filtrarTravaPendentes, marcaTravaEnviados } from './_trava-whats-io.mjs';
import { agoraBRT } from './_rotina.mjs';

export function classificaHeuristicaTrafego(lead = {}) {
  const q = lead.qualidade;
  let qualidade = 'curioso';
  let confianca = 40;
  let motivo = 'Poucos dados — default Curioso';
  if (q === 'comprador') {
    qualidade = 'interessado'; confianca = 75; motivo = 'Caçador marcou comprador';
  } else if (q === 'bom') {
    qualidade = 'potencial'; confianca = 70; motivo = 'Caçador marcou bom';
  } else if (q === 'curioso') {
    qualidade = 'curioso'; confianca = 65; motivo = 'Caçador marcou curioso';
  } else if (q === 'errado') {
    qualidade = 'fake'; confianca = 80; motivo = 'Caçador marcou nº errado';
  }
  return {
    qualidade,
    confianca,
    motivo,
    resumo: `${lead.nome || 'Lead'} · ${lead.campanha || 'sem campanha'} · ${QUAL_TRAFEGO_ROTULO[qualidade] || qualidade}`,
    via: 'heuristica',
  };
}

export async function classificaComIa(lead, timelineTexto = '') {
  const key = process.env.OPENAI_API_KEY || process.env.HELENA_AUDITORA_OPENAI_KEY || '';
  if (!key) return classificaHeuristicaTrafego(lead);

  const user = [
    `Lead: ${lead.nome}`,
    `Telefone: ${lead.telefone || '—'}`,
    `Campanha: ${lead.campanha || '—'}`,
    `Cidade: ${lead.cidade || '—'}`,
    `Fonte: ${lead.fonte || '—'}`,
    `Status: ${lead.status || '—'}`,
    `Etiqueta corretor: ${lead.corretor || '—'}`,
    `Marca Caçador (CPL): ${lead.qualidade || '—'}`,
    '',
    'Timeline (Bitrix abas + ligação + WhatsApp Helena):',
    timelineTexto || lead.timeline || '(sem timeline — classifique com o que houver)',
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
          { role: 'system', content: PROMPT_QUALIDADE_TRAFEGO },
          { role: 'user', content: user },
        ],
      }),
    });
    const body = await r.json();
    if (!r.ok) {
      const h = classificaHeuristicaTrafego(lead);
      h.motivo = `OpenAI falhou (${r.status}) · ${h.motivo}`;
      return h;
    }
    const raw = body.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const qualidade = normalizaQualTrafego(parsed.qualidade) || 'curioso';
    return {
      qualidade,
      confianca: Number(parsed.confianca) || 50,
      motivo: String(parsed.motivo || '').slice(0, 200) || 'classificado pela IA',
      resumo: String(parsed.resumo || '').slice(0, 400),
      via: 'openai',
    };
  } catch (e) {
    const h = classificaHeuristicaTrafego(lead);
    h.motivo = `IA erro: ${String(e.message || e).slice(0, 80)} · ${h.motivo}`;
    return h;
  }
}

export async function atualizaBitrixIa(lead, classif) {
  const base = (process.env.BITRIX_WEBHOOK_URL || process.env.BITRIX24_WEBHOOK || '').replace(/\/+$/, '');
  if (!base) return { ok: false, skipped: true, motivo: 'BITRIX_WEBHOOK_URL ausente' };
  const dealId = String(lead.bitrixId || lead.id || '').replace(/^bitrix-/, '');
  if (!dealId || !/^\d+$/.test(dealId)) {
    return { ok: false, skipped: true, motivo: 'dealId Bitrix numérico ausente' };
  }
  const rotulo = QUAL_TRAFEGO_ROTULO[classif.qualidade] || classif.qualidade;
  const fields = {
    UF_CRM_QUALIDADE_IA: rotulo,
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

export async function rodaCicloAuditora(leads, {
  forcar = false,
  avisarVermelhos = true,
} = {}) {
  const out = [];
  const lista = [...(leads || [])];
  for (let i = 0; i < lista.length; i++) {
    const lead = lista[i];
    if (!forcar && normalizaQualTrafego(lead.qualidadeIa)) continue;
    if (lead.fonte && !fonteEhTrafegoPago(lead.fonte) && lead.fonte !== 'demo') continue;

    const classif = await classificaComIa(lead, lead.timeline || '');
    const bitrix = await atualizaBitrixIa(lead, classif);
    const sj = classif.qualidade === 'sem_justificativa';
    lista[i] = {
      ...lead,
      qualidadeIa: sj ? null : classif.qualidade,
      semJustificativa: sj || !!lead.semJustificativa,
      confiancaIa: classif.confianca,
      motivoIa: classif.motivo,
      resumoIa: classif.resumo,
      iaVia: classif.via,
      iaEm: new Date().toISOString(),
      bitrixIa: bitrix,
      travaVermelha: isVermelho(lead),
    };
    out.push({ id: lead.id, nome: lead.nome, ...classif, bitrix });
  }

  const resumo = resumoAuditoria(lista);
  let whats = { enviado: false };
  if (avisarVermelhos && resumo.vermelhos > 0) {
    const ceo = process.env.WHATSAPP_CEO || '';
    // Nunca avisar demo / seed (Carlos Vermelho etc.)
    const reais = (resumo.leadsVermelhos || []).filter((l) => !isDemoLead(l));
    if (ceo && reais.length) {
      const now = agoraBRT();
      const enviadosDoc = await leTravaEnviados().catch(() => ({ chaves: {} }));
      const { pendentes, chaves } = filtrarTravaPendentes(reais, enviadosDoc.chaves || {}, now.data);
      if (pendentes.length) {
        const texto = mensagemTravaSaiuSemQualidadeReal({
          leads: pendentes,
          hm: now.hm,
          data: now.data,
        });
        whats = await enviaWhats(ceo, texto);
        if (whats.enviado) await marcaTravaEnviados(chaves);
      } else {
        whats = { enviado: false, motivo: 'já avisado hoje (dedupe)' };
      }
    } else if (!reais.length) {
      whats = { enviado: false, motivo: 'só demo/seed — sem WhatsApp' };
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
