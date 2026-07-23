// Caçador de Qualidade — leads de hoje, 2 toques (Bom/Curioso/Errado/Comprador).
// Arquivo "_" = NÃO vira função.
// Fluxo Bruno: Discadora/Garimpo → 1 toque aqui → alimenta CPL BOM · (Bitrix depois).

import { QUALIDADE_TIPOS, normalizaQualidade, leadsBons } from './_qualidade.mjs';
import { cidadeReal } from './_campanhas-regras.mjs';
import { identidadeCampanha } from './_mapeamento-v41.mjs';
import {
  ABCD,
  ABCD_ROTULO,
  normalizaAbcd,
  normalizaStatusPos,
  isVermelho,
  marcaAuditoria,
  resumoAuditoria,
} from './_auditoria-abcd.mjs';

export { QUALIDADE_TIPOS, ABCD, ABCD_ROTULO, marcaAuditoria, resumoAuditoria, isVermelho };

/**
 * Sem estrutura EN: Bom/Comprador em público inglês → Curioso.
 * @returns {{ qualidade: string, forcouCurioso: boolean, motivo: string|null }}
 */
export function qualidadeComRegraIngles(qualidade, campanhaNome = '') {
  const id = identidadeCampanha(campanhaNome);
  if (id.inglesSemEstrutura && (qualidade === 'bom' || qualidade === 'comprador')) {
    return {
      qualidade: 'curioso',
      forcouCurioso: true,
      motivo: 'Sem estrutura EN — lead continua Curioso',
    };
  }
  return { qualidade, forcouCurioso: false, motivo: null };
}

/** Leads demo canônicos (Bruno) — usados até Bitrix/Meta leadgen ligar. */
export function leadsDemoHoje() {
  const agora = Date.now();
  return [
    {
      id: 'demo-joao-silva',
      nome: 'João Silva',
      telefone: '11 9xxxx',
      campanha: 'FORTMYERS_PENHA_VETTER_BR-SC',
      campanhaId: null,
      cidade: 'Penha',
      status: 'Novo',
      recebidoEm: new Date(agora - 12 * 60 * 1000).toISOString(),
      qualidade: null,
      fonte: 'demo',
      statusPosMapeamento: 'Em mapeamento',
    },
    {
      id: 'demo-maria',
      nome: 'Maria',
      telefone: '47 9xxxx',
      campanha: 'AMANAY_ITAPOA_ROGGA_BR-SC',
      campanhaId: null,
      cidade: 'Itapoá',
      status: null,
      recebidoEm: new Date(agora - 34 * 60 * 1000).toISOString(),
      qualidade: null,
      fonte: 'demo',
      statusPosMapeamento: 'Em mapeamento',
    },
    {
      id: 'demo-vermelho-saiu',
      nome: 'Carlos Vermelho',
      telefone: '48 9xxxx',
      campanha: 'AMANAY_ITAPOA_ROGGA_BR-SC',
      campanhaId: null,
      cidade: 'Itapoá',
      status: 'Saiu mapeamento',
      recebidoEm: new Date(agora - 90 * 60 * 1000).toISOString(),
      qualidade: 'bom',
      fonte: 'demo',
      statusPosMapeamento: 'Saiu',
      // sem qualidadeReal → VERMELHO (trava)
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
  const provisoria = normalizaAbcd(l.qualidadeProvisoria);
  const real = normalizaAbcd(l.qualidadeReal);
  const statusPos = normalizaStatusPos(l.statusPosMapeamento);
  const qualidadeIa = normalizaAbcd(l.qualidadeIa);
  const base = {
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
    bitrixId: l.bitrixId || null,
    corretor: l.corretor || l.corretorResponsavel || null,
    // Parte 2 — auditoria A/B/C/D
    qualidadeProvisoria: provisoria,
    provisoriaEm: l.provisoriaEm || null,
    provisoriaPor: l.provisoriaPor || null,
    qualidadeReal: real,
    realEm: l.realEm || null,
    realPor: l.realPor || null,
    statusPosMapeamento: statusPos,
    qualidadeIa,
    confiancaIa: l.confiancaIa ?? null,
    motivoIa: l.motivoIa || null,
    resumoIa: l.resumoIa || null,
    riscoIa: l.riscoIa || null,
    sinaisIa: l.sinaisIa || null,
    iaVia: l.iaVia || null,
    iaEm: l.iaEm || null,
    timeline: l.timeline || null,
  };
  return {
    ...base,
    travaVermelha: isVermelho(base),
  };
}

/**
 * Aplica 1 toque de qualidade num lead e recalcula totais por campanha.
 * @returns {{ lead, totaisCampanha, toast }}
 */
export function marcaLead(leads = [], { leadId, qualidade, quem = 'Michel', corretor = null } = {}) {
  if (!QUALIDADE_TIPOS.includes(qualidade)) {
    throw new Error(`qualidade inválida (use ${QUALIDADE_TIPOS.join(' / ')})`);
  }
  const lista = (Array.isArray(leads) ? leads : []).map(normalizaLead);
  const idx = lista.findIndex((l) => l.id === leadId);
  if (idx < 0) throw new Error('lead não encontrado');

  const regra = qualidadeComRegraIngles(qualidade, lista[idx].campanha);
  const ant = lista[idx].qualidade;
  const corretorFinal = String(corretor || quem || 'Michel').trim() || 'Michel';
  lista[idx] = {
    ...lista[idx],
    qualidade: regra.qualidade,
    marcadoEm: new Date().toISOString(),
    marcadoPor: quem,
    corretor: corretorFinal,
    inglesForcouCurioso: regra.forcouCurioso || null,
  };

  const campanha = lista[idx].campanha;
  const totais = totaisPorCampanha(lista).find((t) => t.campanha === campanha)
    || { campanha, bom: 0, curioso: 0, errado: 0, comprador: 0, leadsBons: 0 };

  return {
    lead: lista[idx],
    leads: lista,
    anterior: ant,
    totaisCampanha: totais,
    forcouCurioso: regra.forcouCurioso,
    toast: regra.forcouCurioso
      ? 'Sem estrutura EN — marcado Curioso · CPL BOM recalculado'
      : 'Registrado - CPL BOM recalculado',
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
  const auditoria = resumoAuditoria(lista);
  return {
    ok: true,
    titulo: 'CAÇAR LEADS DE HOJE - 2 TOQUES (vai pro Bitrix)',
    aviso: '1 toque marca qualidade · corretor responsável · alimenta CPL BOM · Bitrix · pling até marcar',
    toastOk: 'Registrado - CPL BOM recalculado',
    corretores: ['Michel', 'Helena', 'Carol', 'Bruno'],
    regraIngles: 'Sem estrutura pra atender em inglês → lead EN continua Curioso',
    abcd: ABCD.map((k) => ({ tipo: k, label: `${k} · ${ABCD_ROTULO[k]}` })),
    auditoria,
    leads: lista.map((l) => ({
      ...l,
      linha: linhaLead(l, { agora }),
      haMinutos: minutosAtras(l.recebidoEm, agora),
      botoes: QUALIDADE_TIPOS.map((t) => ({
        tipo: t,
        label: rotuloBotao(t),
        ativo: l.qualidade === t,
      })),
      botoesAbcd: ABCD.map((t) => ({
        tipo: t,
        label: t,
        ativoProv: l.qualidadeProvisoria === t,
        ativoReal: l.qualidadeReal === t,
      })),
    })),
    pendentes: pendentes.length,
    marcados: marcados.length,
    vermelhos: auditoria.vermelhos,
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
