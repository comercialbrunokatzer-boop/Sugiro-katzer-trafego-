/**
 * Nota de qualidade da campanha lendo o Funil Novo Katzer (Bitrix).
 * CPL barato e volume entram só como desempate — o ranking principal é avanço real:
 * fase atual + contato utilizável + comentários do negócio.
 */
import { ORDEM_FUNIL, FASES_TERMINAIS, normalizaNomeFase } from './_bitrix-funil.mjs';

/** Peso 0–100 por fase atual (STAGE_ID). Quanto mais fundo no funil, melhor o lead. */
export const PESO_FASE = {
  'Leads Novos': 14,
  'Tentando Contato': 24,
  'Carteira corretor': 30,
  'Mapeamento': 42,
  'Aprovação Viagem': 50,
  'Cliente em viagem': 58,
  'Agendamento Meetins': 66,
  'Agendado Físico': 74,
  'Reagendamento de Visita': 60,
  'Follow Up': 68,
  'Negociação': 80,
  'Proposta': 88,
  'Contrato': 94,
  'Aprovação Exceção': 78,
  'Exceção': 52,
  'Ganhou': 100,
  'Rampage': 8,
  'Perdido': 5,
};

const POSITIVO = [
  /\binteressad/i, /\bquente\b/i, /\bcomprou\b/i, /\bfechou\b/i, /\bassinou\b/i,
  /\bproposta\b/i, /\bvisita\b/i, /\bvisitou\b/i, /\bagendad/i, /\bmeet(ing)?\b/i,
  /\bviagem\b/i, /\bmapeament/i, /\bnegoci/i, /\bcontrato\b/i, /\baprovad/i,
  /\bretorn(ou|a)\b/i, /\brespondeu\b/i, /\bwhatsapp\b/i, /\bligou\b/i,
  /\bcapital\b/i, /\binvest/i, /\bentrad/i,
];

const NEGATIVO = [
  /\bfake\b/i, /\bfalso\b/i, /\bspam\b/i, /\bgolpe\b/i, /\bbots?\b/i,
  /\bsem interesse\b/i, /\bnão tem interesse\b/i, /\bnao tem interesse\b/i,
  /\bnão quer\b/i, /\bnao quer\b/i, /\brecusou\b/i, /\bdesistiu\b/i,
  /\bnúmero errado\b/i, /\bnumero errado\b/i, /\btelefone errado\b/i,
  /\bsem telefone\b/i, /\bnão atende\b/i, /\bnao atende\b/i,
  /\bduplicad/i, /\bteste\b/i, /\bcurioso\b/i, /\bsó curios/i, /\bso curios/i,
];

function clamp(n, a = 0, b = 100) {
  const x = Number(n);
  if (!Number.isFinite(x)) return a;
  return Math.max(a, Math.min(b, x));
}

function temTelefone(tel) {
  const dig = String(tel || '').replace(/\D+/g, '');
  return dig.length >= 8;
}

function temNomePessoa(nome) {
  const s = String(nome || '').trim();
  if (!s) return false;
  if (/^lead\s*#/i.test(s)) return false;
  if (/preencher formul[aá]rio|lead patroc/i.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  return s.length >= 2;
}

/** Ajuste −18..+12 a partir do texto de COMMENTS / source / form. */
export function ajusteComentarios(texto) {
  const t = String(texto || '');
  if (!t.trim()) return { delta: 0, sinais: [] };
  let delta = 0;
  const sinais = [];
  for (const re of POSITIVO) {
    if (re.test(t)) {
      delta += 3;
      sinais.push(`+ ${re.source.replace(/\\b/g, '').slice(0, 24)}`);
    }
  }
  for (const re of NEGATIVO) {
    if (re.test(t)) {
      delta -= 5;
      sinais.push(`− ${re.source.replace(/\\b/g, '').slice(0, 24)}`);
    }
  }
  return { delta: clamp(delta, -18, 12), sinais: sinais.slice(0, 6) };
}

/**
 * Nota 0–100 de um deal (fase + contato + comentários).
 * @param {object} deal
 */
export function notaDeal(deal = {}) {
  const fase = normalizaNomeFase(deal.fase || deal.stageId || 'Leads Novos');
  const base = PESO_FASE[fase] ?? 20;
  let nota = base;
  const motivos = [`fase ${fase} (${base})`];

  const nome = deal.nomeContato || deal.nome || deal.title || '';
  if (temNomePessoa(nome)) {
    nota += 4;
    motivos.push('contato com nome');
  }
  if (temTelefone(deal.telefone) || deal.whatsappUrl) {
    nota += 6;
    motivos.push('telefone/WA');
  } else if (['Leads Novos', 'Tentando Contato'].includes(fase)) {
    nota -= 4;
    motivos.push('sem telefone no topo');
  }

  const hay = [deal.comments, deal.sourceDescription, deal.titleForm, deal.utmCampaign]
    .filter(Boolean)
    .join(' \n ');
  const { delta, sinais } = ajusteComentarios(hay);
  if (delta) {
    nota += delta;
    if (sinais.length) motivos.push(`comentários ${delta > 0 ? '+' : ''}${delta}`);
  }

  return {
    id: deal.id || null,
    fase,
    nota: Math.round(clamp(nota)),
    motivos,
    sinaisComentario: sinais,
  };
}

/**
 * Agrega deals (ou buckets de fase) numa nota de campanha.
 * @param {{ fases?: Array, deals?: Array, forms?: number, detail?: object }} input
 */
export function notaCampanha(input = {}) {
  const deals = Array.isArray(input.deals) ? input.deals : [];
  const fases = Array.isArray(input.fases) ? input.fases : [];
  const forms = Number(input.forms) || 0;
  const detail = input.detail || {};

  let scores = [];
  if (deals.length) {
    scores = deals.map((d) => notaDeal(d));
  } else if (fases.length) {
    // Fallback: cada lead contado na fase (sem texto de comentário)
    for (const f of fases) {
      const n = Number(f.n) || 0;
      const fase = normalizaNomeFase(f.nome);
      const peso = PESO_FASE[fase] ?? 20;
      for (let i = 0; i < n; i += 1) {
        const lead = (f.leads && f.leads[i]) || {};
        scores.push(notaDeal({
          ...lead,
          fase,
          comments: lead.comments || '',
        }));
      }
      if (n === 0 && peso) {
        /* fases vazias não entram */
      }
    }
  }

  const nLeads = scores.length;
  if (!nLeads && forms <= 0) {
    return {
      nota: null,
      selo: null,
      nLeads: 0,
      forms,
      motivo: 'Sem forms nem deals no funil pra notar',
      breakdown: { porFase: {}, media: null, fakeRuim: 0 },
      scores: [],
    };
  }

  // Sem deal Bitrix mas com forms Meta → topo frio (volume sem qualidade comprovada)
  if (!nLeads && forms > 0) {
    const notaFria = clamp(18 - Math.min(8, forms * 0.3));
    return {
      nota: Math.round(notaFria),
      selo: seloDeNota(notaFria),
      nLeads: 0,
      forms,
      motivo: `${forms} forms Meta sem negócio casado no Funil Novo — qualidade ainda não lida no Bitrix`,
      breakdown: { porFase: {}, media: notaFria, fakeRuim: (detail.fake || 0) + (detail.ruim || 0) },
      scores: [],
    };
  }

  const media = scores.reduce((s, x) => s + x.nota, 0) / nLeads;
  const porFase = {};
  for (const s of scores) {
    porFase[s.fase] = (porFase[s.fase] || 0) + 1;
  }

  // Penalidade Fake/Ruim do caçador (quando existir)
  const fakeRuim = (Number(detail.fake) || 0) + (Number(detail.ruim) || 0);
  let nota = media;
  if (fakeRuim > 0 && nLeads > 0) {
    const frac = Math.min(0.6, fakeRuim / Math.max(nLeads, forms || nLeads));
    nota -= frac * 25;
  }

  // Bônus leve se há avanço além do topo (prova de qualidade de mídia)
  const avancados = scores.filter((s) => {
    const i = ORDEM_FUNIL.indexOf(s.fase);
    return i >= ORDEM_FUNIL.indexOf('Mapeamento') || s.fase === 'Ganhou';
  }).length;
  const mortos = scores.filter((s) => FASES_TERMINAIS.includes(s.fase)).length;
  if (avancados > 0) nota += Math.min(8, avancados * 1.5);
  if (mortos > nLeads * 0.55 && nLeads >= 4) nota -= 10;

  nota = clamp(nota);
  const topFase = Object.entries(porFase).sort((a, b) => b[1] - a[1])[0];
  const motivo = [
    `${nLeads} lead(s) no funil`,
    topFase ? `mais em ${topFase[0]} (${topFase[1]})` : null,
    avancados ? `${avancados} avançaram (≥ Mapeamento)` : null,
    mortos ? `${mortos} Rampage/Perdido` : null,
    fakeRuim ? `${fakeRuim} Fake/Ruim no caçador` : null,
  ].filter(Boolean).join(' · ');

  return {
    nota: Math.round(nota),
    selo: seloDeNota(nota),
    nLeads,
    forms,
    motivo,
    breakdown: {
      porFase,
      media: Math.round(media * 10) / 10,
      fakeRuim,
      avancados,
      mortos,
    },
    scores,
  };
}

export function seloDeNota(nota) {
  if (nota == null || !Number.isFinite(Number(nota))) return null;
  const n = Number(nota);
  if (n >= 75) return 'A';
  if (n >= 55) return 'B';
  if (n >= 35) return 'C';
  return 'D';
}

/**
 * Ordenação do Top 10: nota desc → CPL asc → forms desc.
 * Campanhas sem nota vão pro fim.
 */
export function comparaPorQualidadeFunil(a, b) {
  const na = a?.notaFunil?.nota;
  const nb = b?.notaFunil?.nota;
  const aOk = na != null && Number.isFinite(Number(na));
  const bOk = nb != null && Number.isFinite(Number(nb));
  if (aOk && bOk && Number(na) !== Number(nb)) return Number(nb) - Number(na);
  if (aOk && !bOk) return -1;
  if (!aOk && bOk) return 1;
  const ca = a?.cpl;
  const cb = b?.cpl;
  if (ca != null && cb != null && Number(ca) !== Number(cb)) return Number(ca) - Number(cb);
  if (ca != null && cb == null) return -1;
  if (ca == null && cb != null) return 1;
  return (Number(b?.forms) || 0) - (Number(a?.forms) || 0);
}

/** Monta top 10 melhores (alta nota) e piores (baixa nota). */
export function top10PorNotaFunil(campanhas = []) {
  const elegiveis = (campanhas || []).filter((c) => {
    if (c?.notaFunil?.nota == null && c?.cpl == null) return false;
    return (c.forms || 0) > 0 || (c.leadsTotal || 0) > 0 || c?.notaFunil?.nota != null;
  });
  const ordenados = [...elegiveis].sort(comparaPorQualidadeFunil);
  const melhores = ordenados.slice(0, 10).map((c, i) => ({ ...c, pos: i + 1, rankingTipo: 'melhor' }));
  const piores = [...ordenados].reverse().slice(0, 10).map((c, i) => ({ ...c, pos: i + 1, rankingTipo: 'pior' }));
  return { melhores, piores, ordenados };
}
