// Recomendações do Painel de Campanhas (arquivo "_" = NÃO vira função).
// DECISÃO DO DIA INTELIGENTE V4 (Bruno):
//   NÃO sugerir EUA_Americanos / MIAMI / PORTUGAL a CPL baixo.
//   Sugerir:
//     1) FORT MYERS · BR_SC — manter, trocar criativo (vs Alicerce)
//     2) AMANAY · ITAPOÁ — duplicar R$ 30/dia (melhor CPL / CPL BOM)
// Texto canônico + evidência ao vivo (formulário). Decisões: aplicar|ajustar|agora-nao.

import { slug } from './_placar-estado.mjs';
import { LEADS_MIN_ESCALAR, publicoForaDoBrasil } from './_campanhas-regras.mjs';

export const DECISAO_VERSAO = 'V4';

const brl = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);

/** Público/campanha que NUNCA entra como “escalar” na decisão do dia. */
export function ehPublicoProibidoEscalar(nome = '') {
  const pub = publicoForaDoBrasil(nome);
  if (pub.alerta) return true;
  return /EUA[_\s-]?Americanos|AMERICANOS|MIAMI|ORLANDO|PORTUGAL|ESPANHA/i.test(String(nome));
}

/** Placar 7d → formato que montaRecomendacoes entende. */
export function placarParaOperacional(placar = {}) {
  const rows = (placar.campanhas || []).map((c) => ({
    campanha: c.nome,
    leads: c.leads,
    leadsForm: c.leads,
    gasto: c.gasto,
    cpl: c.cpl,
    cplForm: c.cpl,
  }));
  return { logSeguro: rows, rankingCpl: rows };
}

/**
 * Dois cards oficiais do dia (Painel de Campanhas) — V4.
 * Números de negócio: Gerenciador (Bruno). API entra só como evidência de leitura.
 */
export function montaRecomendacoes({ operacional7d = null, contaMaxima = null } = {}) {
  const log7 = operacional7d?.logSeguro || [];
  const topMax = contaMaxima?.top10Cpl || contaMaxima?.rankingCpl || [];
  const volMax = contaMaxima?.rankingVolumeCpl || [];

  const brSc = log7.find((c) => /BR_SC/i.test(c.campanha))
    || (operacional7d?.rankingCpl || []).find((c) => /BR_SC/i.test(c.campanha));
  const alicerce = topMax.find((c) => /ALICERCE/i.test(c.campanha) && !/C[oó]pia/i.test(c.campanha))
    || topMax.find((c) => /ALICERCE/i.test(c.campanha));
  const amanay = topMax.find((c) => /AMANAY/i.test(c.campanha) && /C[oó]pia/i.test(c.campanha))
    || topMax.find((c) => /AMANAY/i.test(c.campanha))
    || volMax.find((c) => /AMANAY/i.test(c.campanha))
    || log7.find((c) => /AMANAY/i.test(c.campanha));

  const leadsAmanay = Number(amanay?.leadsForm ?? amanay?.leads ?? 24);
  const cplAmanay = Number(amanay?.cplForm ?? amanay?.cpl ?? 11);
  const semBaseAmanay = leadsAmanay < LEADS_MIN_ESCALAR;

  const recs = [
    {
      id: 'rec-fortmyers-brsc-criativo',
      versao: DECISAO_VERSAO,
      tipo: 'trocar_criativo',
      produto: 'FORT MYERS - PENHA',
      publico: 'BR-SC',
      prioridade: 1,
      titulo: 'Manter BR-SC, mas trocar criativo',
      problema: 'Fort Myers Penha no mix 20% — CPL alto vs Alicerce',
      oportunidade: null,
      evidencia: [
        'Mix 80%: FORTMYERS_PENHA_VETTER_BR-SC = 20%',
        `API 7d: ${brSc ? `${brSc.leads ?? brSc.leadsForm} form. · CPL ${brl(brSc.cpl ?? brSc.cplForm)}` : '—'}`,
        `Alicerce ref.: CPL ~R$ 18${alicerce ? ` (${brl(alicerce.cplForm ?? alicerce.cpl)})` : ''}`,
      ],
      recomendacao: 'MANTER BR-SC no mix 20%, trocar criativo',
      acao: 'Gravar com Carol a mesma fórmula do Alicerce (R$ 18) para Fort Myers Penha',
      metricaBase: 'lead_formulario',
      numeros: {
        leadsForm: Number(brSc?.leads ?? brSc?.leadsForm ?? 9),
        leadsGerenciador: 9,
        cplGerenciador: 77,
        leadsApi7d: brSc?.leads ?? brSc?.leadsForm ?? null,
        cplApi7d: brSc?.cpl ?? brSc?.cplForm ?? null,
        cplAlicerceRef: 18,
      },
      valorDiaSugerido: null,
      botoes: ['aplicar', 'ajustar', 'agora-nao'],
      bloqueadoEscalar: false,
    },
    {
      id: 'rec-amanay-duplicar-30',
      versao: DECISAO_VERSAO,
      tipo: 'duplicar_escalar',
      produto: 'AMANAY - ITAPOÁ',
      publico: 'SC+PR',
      prioridade: 2,
      titulo: 'Duplicar Amanay com R$ 30/dia',
      problema: null,
      oportunidade: '24 leads a R$ 11 - menor CPL da conta',
      evidencia: [
        'Gerenciador/ranking: 24 leads form. · CPL R$ 11',
        amanay
          ? `API: ${leadsAmanay} form. · CPL ${brl(cplAmanay)} · ${amanay.campanha}`
          : 'API: Amanay no top de CPL formulário',
      ],
      recomendacao: semBaseAmanay
        ? `BLOQUEADO — ⚪ SEM BASE - ${leadsAmanay} leads, precisa ${LEADS_MIN_ESCALAR}`
        : 'Escalar Amanay — não misturar com Fort Myers',
      acao: 'Duplicar Amanay com R$ 30/dia - público SC+PR',
      metricaBase: 'lead_formulario',
      numeros: {
        leadsForm: leadsAmanay,
        cplForm: cplAmanay,
        valorDia: 30,
        leadsApi: amanay?.leadsForm ?? amanay?.leads ?? null,
        cplApi: amanay?.cplForm ?? amanay?.cpl ?? null,
      },
      valorDiaSugerido: 30,
      botoes: ['aplicar', 'ajustar', 'agora-nao'],
      bloqueadoEscalar: semBaseAmanay,
    },
  ];

  return {
    ok: true,
    versao: DECISAO_VERSAO,
    geradoEm: new Date().toISOString(),
    metricaPrincipal: 'lead_formulario',
    regra: 'Nunca sugerir EUA_Americanos/MIAMI/PORTUGAL. Decisão V4 = BR_SC criativo + Amanay.',
    aviso: 'IA sugere · Michel executa na Meta · Bruno acompanha. Modo seguro.',
    recomendacoes: recs,
  };
}

/**
 * Sugestão principal V4 — NUNCA EUA_Americanos a R$7.
 * Prefere Amanay (escalar) como principal; cards completos em cardsV4.
 */
export function sugestaoPrincipalV4(recomendacoes = []) {
  const recs = Array.isArray(recomendacoes) ? recomendacoes : [];
  const amanay = recs.find((r) => r.tipo === 'duplicar_escalar' && /AMANAY/i.test(r.produto || ''));
  const brsc = recs.find((r) => r.tipo === 'trocar_criativo');

  if (amanay && !amanay.bloqueadoEscalar) {
    return {
      id: amanay.id,
      tipo: amanay.tipo,
      versao: DECISAO_VERSAO,
      origem: null,
      destino: amanay.produto,
      valorDia: amanay.valorDiaSugerido ?? 30,
      titulo: amanay.titulo,
      motivo: [
        amanay.oportunidade,
        `Cidade: Itapoá`,
        `Público: ${amanay.publico}`,
        amanay.acao,
        ...(amanay.evidencia || []),
      ].filter(Boolean).join('\n'),
      recomendacao: amanay.recomendacao,
      campanha: amanay.produto,
      gasto: null,
      leads: amanay.numeros?.leadsForm ?? 24,
      cpl: amanay.numeros?.cplForm ?? 11,
      cidade: 'Itapoá',
      publico: amanay.publico,
      alertaPublico: null,
      bloqueadoEscalar: false,
      botoes: amanay.botoes,
      cardsV4: recs,
    };
  }

  if (brsc) {
    return {
      id: brsc.id,
      tipo: brsc.tipo,
      versao: DECISAO_VERSAO,
      origem: brsc.produto,
      destino: null,
      valorDia: null,
      titulo: brsc.titulo,
      motivo: [
        brsc.problema,
        `Público: ${brsc.publico}`,
        brsc.acao,
        ...(brsc.evidencia || []),
      ].filter(Boolean).join('\n'),
      recomendacao: brsc.recomendacao,
      campanha: brsc.produto,
      leads: brsc.numeros?.leadsForm ?? 9,
      cpl: brsc.numeros?.cplGerenciador ?? 77,
      cidade: 'Penha',
      publico: 'BR-SC',
      alertaPublico: null,
      bloqueadoEscalar: false,
      botoes: brsc.botoes,
      cardsV4: recs,
    };
  }

  return null;
}

/** Remove campanhas proibidas da lista de “escalar” (defesa em profundidade). */
export function filtraEscalarSeguro(lista = []) {
  return (lista || []).filter((c) => !ehPublicoProibidoEscalar(c.nome || c.campanha || ''));
}

export function textoDecisaoRec(item = {}) {
  const map = {
    aplicar: '✅ APLICOU',
    ajustar: '✎ AJUSTOU',
    'agora-nao': '⏸ AGORA NÃO',
  };
  const acao = map[item.decisao] || item.decisao;
  const aj = item.ajuste ? `\nAjuste: ${item.ajuste}` : '';
  return `${acao} · ${item.campanha || item.id}${aj}`;
}

export { slug };
