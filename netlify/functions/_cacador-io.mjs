// I/O do Caçador — leads de hoje + marcas (Blobs).
import { resolveLeadsDoDia, normalizaLead, marcaLead, totaisPorCampanha, marcaAuditoria } from './_cacador.mjs';
import { leQualidade, salvaQualidadeCampanha } from './_qualidade-io.mjs';
import { abreStoreSafe } from './_blobs-store.mjs';

const STORE = 'placar-michel';
const KEY = 'cacador-leads-v1';

function abreStore() {
  return abreStoreSafe(STORE);
}

function dataBRT(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

function allowDemoCacador() {
  return /^(1|on|true|sim)$/i.test(String(process.env.CACADOR_ALLOW_DEMO || '').trim());
}

export async function leLeadsHoje() {
  const hoje = dataBRT();
  const store = abreStore();
  if (!store) return { data: hoje, leads: [], fonte: 'blobs-off' };
  let doc = null;
  try {
    doc = await store.get(KEY, { type: 'json' });
  } catch {
    return { data: hoje, leads: [], fonte: 'blobs-off' };
  }
  const resolved = resolveLeadsDoDia({ hoje, doc, allowDemo: allowDemoCacador() });
  const leads = (resolved.leads || []).map(normalizaLead);
  if (resolved.persistir) {
    const novo = {
      data: hoje,
      leads,
      fonte: resolved.fonte,
      atualizadoEm: new Date().toISOString(),
    };
    try { await store.setJSON(KEY, novo); } catch { /* ignore */ }
  }
  return { data: hoje, leads, fonte: resolved.fonte };
}

export async function salvaLeadsHoje(leads, { fonte = 'blobs' } = {}) {
  const hoje = dataBRT();
  const doc = {
    data: hoje,
    leads: (leads || []).map(normalizaLead),
    fonte,
    atualizadoEm: new Date().toISOString(),
  };
  const store = abreStore();
  if (!store) {
    const err = new Error('Blobs indisponível ao salvar leads');
    err.code = 'BLOBS_INDISPONIVEL';
    throw err;
  }
  try {
    await store.setJSON(KEY, doc);
  } catch (e) {
    const err = new Error('Blobs indisponível ao salvar leads');
    err.code = 'BLOBS_INDISPONIVEL';
    err.cause = e;
    throw err;
  }
  return doc;
}

/**
 * 1 toque: marca lead + sincroniza totais da campanha em qualidade-v1.
 */
export async function marcaLeadESincroniza({ leadId, qualidade, quem = 'Michel', corretor = null } = {}) {
  const { leads } = await leLeadsHoje();
  const result = marcaLead(leads, { leadId, qualidade, quem, corretor });
  await salvaLeadsHoje(result.leads, { fonte: 'cacador' });

  // Sincroniza contagem da campanha → CPL BOM
  const totais = totaisPorCampanha(result.leads);
  for (const t of totais) {
    await salvaQualidadeCampanha({
      id: t.campanhaId || undefined,
      nome: t.campanha,
      bom: t.bom,
      curioso: t.curioso,
      errado: t.errado,
      comprador: t.comprador,
      quem,
    });
  }

  // Se a campanha ficou sem marcas, zera? — só atualizamos campanhas com ≥1 marca.
  const qual = await leQualidade();
  return {
    ...result,
    qualidadeAtualizadoEm: qual.atualizadoEm,
  };
}

/** Marca Provisória / Real / Status pós-mapeamento (Parte 2). */
export async function marcaAuditoriaESincroniza(opts = {}) {
  const { leads } = await leLeadsHoje();
  const result = marcaAuditoria(leads, opts);
  await salvaLeadsHoje(result.leads, { fonte: 'auditoria' });
  return result;
}
