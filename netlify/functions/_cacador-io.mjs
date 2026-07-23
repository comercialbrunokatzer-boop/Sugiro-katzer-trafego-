// I/O do Caçador — leads de hoje + marcas (Blobs).
import { getStore } from '@netlify/blobs';
import { leadsDemoHoje, normalizaLead, marcaLead, totaisPorCampanha } from './_cacador.mjs';
import { leQualidade, salvaQualidadeCampanha } from './_qualidade-io.mjs';

const STORE = 'placar-michel';
const KEY = 'cacador-leads-v1';

function abreStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: STORE, siteID, token });
  return getStore(STORE);
}

function dataBRT(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export async function leLeadsHoje() {
  const store = abreStore();
  const doc = await store.get(KEY, { type: 'json' });
  const hoje = dataBRT();
  if (doc && doc.data === hoje && Array.isArray(doc.leads) && doc.leads.length) {
    return { data: hoje, leads: doc.leads.map(normalizaLead), fonte: doc.fonte || 'blobs' };
  }
  // Novo dia (ou vazio): seed demo Bruno até Bitrix ligar
  const leads = leadsDemoHoje().map(normalizaLead);
  const novo = { data: hoje, leads, fonte: 'demo', atualizadoEm: new Date().toISOString() };
  try { await store.setJSON(KEY, novo); } catch { /* ignore */ }
  return { data: hoje, leads, fonte: 'demo' };
}

export async function salvaLeadsHoje(leads, { fonte = 'blobs' } = {}) {
  const hoje = dataBRT();
  const doc = {
    data: hoje,
    leads: (leads || []).map(normalizaLead),
    fonte,
    atualizadoEm: new Date().toISOString(),
  };
  await abreStore().setJSON(KEY, doc);
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
