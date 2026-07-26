/**
 * Ranking inteligente do App Decisão (Michel).
 * Ordena por custoPorAvanco → CPL → taxaPerda (não só CPL).
 * Gera badges de AÇÃO MICHEL + cards de resumo.
 */
import { ORDEM_FUNIL } from './_bitrix-funil.mjs';

const IDX_MAPEAMENTO = ORDEM_FUNIL.indexOf('Mapeamento');

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function finitoOuNull(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/** Conta leads em fase ≥ Mapeamento (ou Ganhou). */
export function contaAvancaram(fases = []) {
  let c = 0;
  for (const f of fases || []) {
    const nome = f.nome || '';
    if (nome === 'Ganhou') {
      c += n(f.n);
      continue;
    }
    const i = ORDEM_FUNIL.indexOf(nome);
    if (i >= IDX_MAPEAMENTO && i >= 0) c += n(f.n);
  }
  return c;
}

export function contaFase(fases = [], nomeFase) {
  const f = (fases || []).find((x) => x.nome === nomeFase);
  return n(f?.n);
}

/**
 * Métricas por campanha.
 * forms=0 → taxaPerda=0, custoPorAvanco=Infinity
 */
export function metricasCampanha({
  forms = 0,
  gasto = 0,
  leadsNoBitrix = 0,
  fases = [],
  inicioISO = null,
  agora = Date.now(),
} = {}) {
  const f = n(forms);
  const g = n(gasto);
  const noBx = n(leadsNoBitrix);
  const avancaram = contaAvancaram(fases);
  const meetins = contaFase(fases, 'Agendamento Meetins');
  const tentando = contaFase(fases, 'Tentando Contato');
  const novos = contaFase(fases, 'Leads Novos');

  let taxaPerda = 0;
  if (f > 0) taxaPerda = ((f - noBx) / f) * 100;
  if (taxaPerda < 0) taxaPerda = 0;

  const custoPorAvanco = f === 0
    ? Infinity
    : (avancaram > 0 ? g / avancaram : Infinity);

  const custoPorMeetins = meetins > 0 ? g / meetins : Infinity;

  let diasRodando = null;
  if (inicioISO) {
    const t0 = Date.parse(inicioISO);
    if (Number.isFinite(t0)) {
      diasRodando = Math.max(0, Math.floor((agora - t0) / (24 * 60 * 60 * 1000)));
    }
  }

  return {
    taxaPerda: Math.round(taxaPerda * 10) / 10,
    custoPorAvanco,
    custoPorMeetins,
    diasRodando,
    leadsAvancaram: avancaram,
    leadsMeetins: meetins,
    leadsTentando: tentando,
    leadsNovos: novos,
    leadsNoBitrix: noBx,
  };
}

/**
 * Nota S/A/B/C/D pelas regras do CEO.
 * - S (90–100): custoPorAvanco < 150 E taxaPerda < 15%
 * - A (75–89): custoPorAvanco < 250 E taxaPerda < 30%
 * - B (60–74): custoPorAvanco < 400
 * - C/D: acima
 */
export function notaInteligente({ custoPorAvanco, taxaPerda } = {}) {
  const ca = Number(custoPorAvanco);
  const tp = n(taxaPerda);
  const caOk = Number.isFinite(ca);

  if (caOk && ca < 150 && tp < 15) {
    return { selo: 'S', nota: 95, faixa: '90-100' };
  }
  if (caOk && ca < 250 && tp < 30) {
    return { selo: 'A', nota: 82, faixa: '75-89' };
  }
  if (caOk && ca < 400) {
    return { selo: 'B', nota: 67, faixa: '60-74' };
  }
  if (!caOk || ca >= 800 || tp >= 70) {
    return { selo: 'D', nota: 25, faixa: '0-34' };
  }
  return { selo: 'C', nota: 45, faixa: '35-59' };
}

function brl(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Badge AÇÃO MICHEL (prioridade: LIGAR > CORTAR > ESCALAR > AJUSTAR > MANTER).
 */
export function acaoMichel(cam = {}) {
  const m = cam.metricas || {};
  const taxa = n(m.taxaPerda ?? cam.taxaPerda);
  const ca = Number(m.custoPorAvanco ?? cam.custoPorAvanco);
  const cpl = finitoOuNull(cam.cpl);
  const forms = n(cam.forms);
  const tentando = n(m.leadsTentando ?? cam.leadsTentando);
  const gasto = n(cam.gastoNum ?? cam.gasto);
  const horasTopo = n(cam.horasEmTentandoContato);

  // AZUL LIGAR — gargalo humano
  if (tentando > 3 && (horasTopo >= 2 || cam.gargaloHumano === true)) {
    return {
      tipo: 'LIGAR',
      cor: 'azul',
      icone: '📞',
      label: 'LIGAR',
      texto: `PRIORIDADE CORRETOR: Tem ${tentando} leads parados em Tentando Contato. Não é mídia, é contato.`,
    };
  }

  // VERMELHO CORTAR
  if (taxa > 50 || (Number.isFinite(ca) && ca > 600) || (cpl != null && cpl > 70)) {
    const perdido = taxa > 50 ? Math.round(gasto * (taxa / 100)) : Math.round(gasto);
    return {
      tipo: 'CORTAR',
      cor: 'vermelho',
      icone: '🚨',
      label: 'CORTAR',
      texto: `PAUSAR AGORA: Você está perdendo ${brl(perdido)}. Consertar integração ou criativo morto.`,
    };
  }

  // VERDE ESCALAR
  if (Number.isFinite(ca) && ca < 200 && taxa < 20 && forms >= 6) {
    return {
      tipo: 'ESCALAR',
      cor: 'verde',
      icone: '🚀',
      label: 'ESCALAR',
      texto: `ESCALAR 20%: Melhor CPL da praça (${brl(cpl)}). Aumentar verba se frequência < 2.5`,
    };
  }

  // AMARELO AJUSTAR
  if ((taxa >= 20 && taxa <= 50) || (cpl != null && cpl >= 50 && cpl <= 70)) {
    return {
      tipo: 'AJUSTAR',
      cor: 'amarelo',
      icone: '🔧',
      label: 'AJUSTAR',
      texto: 'ATENÇÃO: Reduzir verba 30% e checar público.',
    };
  }

  return {
    tipo: 'MANTER',
    cor: 'cinza',
    icone: '✅',
    label: 'MANTER',
    texto: 'Sem alerta forte — manter e olhar de novo amanhã.',
  };
}

/** Infinity por último; números menores primeiro. */
function cmpAscNum(a, b) {
  const aInf = !Number.isFinite(a);
  const bInf = !Number.isFinite(b);
  if (aInf && bInf) return 0;
  if (aInf) return 1;
  if (bInf) return -1;
  if (a !== b) return a - b;
  return 0;
}

/**
 * Ordenação: 1) custoPorAvanco ASC  2) CPL ASC  3) taxaPerda ASC
 */
export function comparaRankingInteligente(a, b) {
  const ca = Number(a?.metricas?.custoPorAvanco ?? a?.custoPorAvanco);
  const cb = Number(b?.metricas?.custoPorAvanco ?? b?.custoPorAvanco);
  const byCa = cmpAscNum(ca, cb);
  if (byCa) return byCa;

  const cplA = a?.cpl;
  const cplB = b?.cpl;
  const aOk = cplA != null && Number.isFinite(Number(cplA));
  const bOk = cplB != null && Number.isFinite(Number(cplB));
  if (aOk && bOk && Number(cplA) !== Number(cplB)) return Number(cplA) - Number(cplB);
  if (aOk && !bOk) return -1;
  if (!aOk && bOk) return 1;

  const tpA = n(a?.metricas?.taxaPerda ?? a?.taxaPerda);
  const tpB = n(b?.metricas?.taxaPerda ?? b?.taxaPerda);
  if (tpA !== tpB) return tpA - tpB;

  return (n(b?.forms) - n(a?.forms));
}

export function top10Inteligente(campanhas = []) {
  const elegiveis = (campanhas || []).filter((c) => {
    return n(c.forms) > 0 || n(c.gastoNum) > 0 || n(c.leadsTotal) > 0;
  });
  const ordenados = [...elegiveis].sort(comparaRankingInteligente);
  const melhores = ordenados.slice(0, 10).map((c, i) => ({ ...c, pos: i + 1, rankingTipo: 'melhor' }));
  const piores = [...ordenados].reverse().slice(0, 10).map((c, i) => ({ ...c, pos: i + 1, rankingTipo: 'pior' }));
  return { melhores, piores, ordenados };
}

/**
 * Cards do topo: Dinheiro no Lixo · Oportunidade de Escala · Gargalo Humano
 */
export function cardsResumoMichel(campanhas = []) {
  let dinheiroNoLixo = 0;
  const oportunidades = [];
  let gargaloHumano = 0;

  for (const c of campanhas || []) {
    const m = c.metricas || {};
    const taxa = n(m.taxaPerda);
    const gasto = n(c.gastoNum);
    if (taxa > 50) dinheiroNoLixo += gasto;

    const acao = c.acaoMichel || acaoMichel(c);
    if (acao.tipo === 'ESCALAR') {
      oportunidades.push({
        nome: c.name || c.nome,
        cpl: c.cpl,
        custoPorAvanco: m.custoPorAvanco,
      });
    }

    gargaloHumano += n(m.leadsTentando) + n(m.leadsNovos);
  }

  return {
    dinheiroNoLixo: Math.round(dinheiroNoLixo * 100) / 100,
    dinheiroNoLixoFmt: brl(dinheiroNoLixo),
    oportunidadeEscala: oportunidades,
    gargaloHumano,
  };
}

/** Anexa métricas + nota + ação a uma campanha do app. */
export function enrichCampanhaInteligente(cam, { agora = Date.now() } = {}) {
  const metricas = metricasCampanha({
    forms: cam.forms,
    gasto: cam.gastoNum,
    leadsNoBitrix: cam.leadsTotal ?? cam.formsVsFases?.noFunil ?? 0,
    fases: cam.fases,
    inicioISO: cam.inicioISO || cam.inicioCampanha || null,
    agora,
  });
  const nota = notaInteligente(metricas);
  const base = {
    ...cam,
    metricas,
    taxaPerda: metricas.taxaPerda,
    custoPorAvanco: metricas.custoPorAvanco,
    custoPorMeetins: metricas.custoPorMeetins,
    diasRodando: metricas.diasRodando,
    notaInteligente: nota,
    // sobrescreve selo/nota do funil antigo na UI de ranking
    notaFunil: {
      ...(cam.notaFunil || {}),
      nota: nota.nota,
      selo: nota.selo,
      motivo: cam.semRastreio
        ? 'SEM RASTREIO — CORRIGIR MAKE (UF_CRM_CAMPANHA_ORIGEM vazio)'
        : [
          `${metricas.leadsNoBitrix} no Bitrix`,
          `perda ${metricas.taxaPerda}%`,
          Number.isFinite(metricas.custoPorAvanco)
            ? `R$${Math.round(metricas.custoPorAvanco)}/avanço`
            : 'sem avanço',
          metricas.leadsAvancaram ? `${metricas.leadsAvancaram} ≥ Mapeamento` : null,
        ].filter(Boolean).join(' · '),
    },
  };
  base.acaoMichel = acaoMichel(base);
  return base;
}
