// Caçador de Qualidade — leads de hoje, 2 toques (Bom/Curioso/Errado/Comprador).
// Arquivo "_" = NÃO vira função.
// Fluxo Bruno: Discadora/Garimpo → 1 toque aqui → alimenta CPL BOM · (Bitrix depois).

import { QUALIDADE_TIPOS, normalizaQualidade, leadsBons } from './_qualidade.mjs';
import { cidadeReal } from './_campanhas-regras.mjs';

export { QUALIDADE_TIPOS };

/** Leads demo canônicos (Bruno) — usados até Bitrix/Meta leadgen ligar. */
export function leadsDemoHoje() {
  const agora = Date.now();
  return [
    {
      id: 'demo-joao-silva',
      nome: 'João Silva',
      telefone: '11 9xxxx',
      campanha: 'FortMyers BR_SC',
      campanhaId: null,
      cidade: 'Piçarras',
      status: 'Novo',
      recebidoEm: new Date(agora - 12 * 60 * 1000).toISOString(),
      qualidade: null,
      fonte: 'demo',
    },
    {
      id: 'demo-maria',
      nome: 'Maria',
      telefone: '47 9xxxx',
      campanha: 'Amanay Itapoá',
      campanhaId: null,
      cidade: 'Itapoá',
      status: null,
      recebidoEm: new Date(agora - 34 * 60 * 1000).toISOString(),
      qualidade: null,
      fonte: 'demo',
    },
  ];
}

export function minutosAtras(iso, agora = Date.now()) {
  if (!iso) return null;
  const ms = agora - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.max(0, Math.round(ms / 60000));
}

export function textoHaMinutos(min) {
  if (min == null) return '';
  if (min < 1) return 'agora';
  if (min === 1) return 'há 1min';
  return `há ${min}min`;
}

/** Linha do card: João Silva - 11 9xxxx - FortMyers BR_SC - há 12min - Novo */
export function linhaLead(lead = {}, { agora = Date.now() } = {}) {
  const min = minutosAtras(lead.recebidoEm, agora);
  const partes = [
    lead.nome || '—',
    lead.telefone || null,
    lead.campanha || null,
    textoHaMinutos(min) || null,
    lead.status || null,
  ].filter(Boolean);
  return partes.join(' - ');
}

export function normalizaLead(l = {}) {
  const id = String(l.id || '').trim() || `lead-${Date.now()}`;
  const campanha = String(l.campanha || l.campanhaNome || '').trim();
  const q = l.qualidade && QUALIDADE_TIPOS.includes(l.qualidade) ? l.qualidade : null;
  return {
    id,
    nome: String(l.nome || '').trim() || 'Sem nome',
    telefone: String(l.telefone || l.fone || '').trim() || '—',
    campanha,
    campanhaId: l.campanhaId || l.campaign_id || null,
    cidade: l.cidade || cidadeReal(campanha) || '—',
    status: l.status || null,
    recebidoEm: l.recebidoEm || l.createdAt || new Date().toISOString(),
    qualidade: q,
    marcadoEm: l.marcadoEm || null,
    marcadoPor: l.marcadoPor || null,
    fonte: l.fonte || 'demo',
    bitrixUrl: l.bitrixUrl || null,
  };
}

/**
 * Aplica 1 toque de qualidade num lead e recalcula totais por campanha.
 * @returns {{ lead, totaisCampanha, toast }}
 */
export function marcaLead(leads = [], { leadId, qualidade, quem = 'Michel' } = {}) {
  if (!QUALIDADE_TIPOS.includes(qualidade)) {
    throw new Error(`qualidade inválida (use ${QUALIDADE_TIPOS.join(' / ')})`);
  }
  const lista = (Array.isArray(leads) ? leads : []).map(normalizaLead);
  const idx = lista.findIndex((l) => l.id === leadId);
  if (idx < 0) throw new Error('lead não encontrado');

  const ant = lista[idx].qualidade;
  lista[idx] = {
    ...lista[idx],
    qualidade,
    marcadoEm: new Date().toISOString(),
    marcadoPor: quem,
  };

  const campanha = lista[idx].campanha;
  const totais = totaisPorCampanha(lista).find((t) => t.campanha === campanha)
    || { campanha, bom: 0, curioso: 0, errado: 0, comprador: 0, leadsBons: 0 };

  return {
    lead: lista[idx],
    leads: lista,
    anterior: ant,
    totaisCampanha: totais,
    toast: 'Registrado - CPL BOM recalculado',
  };
}

/** Agrega marcas por nome de campanha (alimenta qualidade-v1). */
export function totaisPorCampanha(leads = []) {
  const map = new Map();
  for (const raw of leads) {
    const l = normalizaLead(raw);
    if (!l.campanha || !l.qualidade) continue;
    if (!map.has(l.campanha)) {
      map.set(l.campanha, {
        campanha: l.campanha,
        campanhaId: l.campanhaId,
        bom: 0,
        curioso: 0,
        errado: 0,
        comprador: 0,
      });
    }
    const t = map.get(l.campanha);
    t[l.qualidade] += 1;
    if (l.campanhaId) t.campanhaId = l.campanhaId;
  }
  return [...map.values()].map((t) => ({
    ...t,
    leadsBons: leadsBons(t),
    qualidade: normalizaQualidade(t, { nome: t.campanha, id: t.campanhaId }),
  }));
}

export function payloadCacador(leads = [], { agora = Date.now() } = {}) {
  const lista = (Array.isArray(leads) ? leads : []).map(normalizaLead);
  const pendentes = lista.filter((l) => !l.qualidade);
  const marcados = lista.filter((l) => l.qualidade);
  return {
    ok: true,
    titulo: 'CAÇAR LEADS DE HOJE - 2 TOQUES (vai pro Bitrix)',
    aviso: '1 toque marca qualidade · alimenta CPL BOM · Bitrix na sequência',
    toastOk: 'Registrado - CPL BOM recalculado',
    leads: lista.map((l) => ({
      ...l,
      linha: linhaLead(l, { agora }),
      haMinutos: minutosAtras(l.recebidoEm, agora),
      botoes: QUALIDADE_TIPOS.map((t) => ({
        tipo: t,
        label: rotuloBotao(t),
        ativo: l.qualidade === t,
      })),
    })),
    pendentes: pendentes.length,
    marcados: marcados.length,
    totaisPorCampanha: totaisPorCampanha(lista),
  };
}

export function rotuloBotao(tipo) {
  const map = {
    bom: '🟢 Bom',
    curioso: '🟡 Curioso',
    errado: '🔴 Nº Errado',
    comprador: '💰 Comprador',
  };
  return map[tipo] || tipo;
}
