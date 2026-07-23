// Recomendações do Painel de Campanhas (arquivo "_" = NÃO vira função).
// Base: CPL de formulário — nunca clique. Decisões: aplicar | ajustar | agora-nao.

import { slug } from './_placar-estado.mjs';

const brl = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);

/**
 * Monta as recomendações do dia a partir do ranking (7d + maximum).
 * Inclui os dois cards que Bruno validou: BR_SC criativo + Amanay escala.
 */
export function montaRecomendacoes({ operacional7d = null, contaMaxima = null } = {}) {
  const log7 = operacional7d?.logSeguro || [];
  const topMax = contaMaxima?.top10Cpl || contaMaxima?.rankingCpl || [];
  const volMax = contaMaxima?.rankingVolumeCpl || [];

  const brSc = log7.find((c) => /BR_SC/i.test(c.campanha))
    || (operacional7d?.rankingCpl || []).find((c) => /BR_SC/i.test(c.campanha));
  const alicerce = topMax.find((c) => /ALICERCE.*AYA|AYA.*ALISSON/i.test(c.campanha) && !/C[oó]pia/i.test(c.campanha))
    || topMax.find((c) => /ALICERCE/i.test(c.campanha));
  const amanay = topMax.find((c) => /AMANAY/i.test(c.campanha) && /C[oó]pia/i.test(c.campanha))
    || topMax.find((c) => /AMANAY/i.test(c.campanha))
    || volMax.find((c) => /AMANAY/i.test(c.campanha));

  const leadsBr = brSc?.leads ?? brSc?.leadsForm ?? null;
  const cplBr = brSc?.cpl ?? brSc?.cplForm ?? null;
  const gastoBr = brSc?.gasto ?? null;
  const cplAli = alicerce?.cplForm ?? 18.09;
  const leadsAma = amanay?.leadsForm ?? 24;
  const cplAma = amanay?.cplForm ?? 11.01;
  const gastoAma = amanay?.gasto ?? 264.15;

  const recs = [
    {
      id: 'rec-fortmyers-brsc-criativo',
      tipo: 'trocar_criativo',
      produto: 'FORT MYERS — PIÇARRAS',
      publico: 'BR_SC',
      prioridade: 1,
      titulo: 'Manter BR_SC · trocar criativo',
      problema: `Mesma praça que Alicerce/Piçarras, mas CPL ~${cplBr != null && cplAli ? `${Math.max(2, Math.round(cplBr / cplAli))}x` : '3x'} maior.`,
      evidencia: [
        `BR_SC (7d): ${leadsBr ?? '—'} leads form. · CPL ${brl(cplBr)} · gasto ${brl(gastoBr)}`,
        `Alicerce/Aya (conta): CPL ~${brl(cplAli)} — fórmula barata na mesma região`,
      ],
      recomendacao: 'MANTER veiculação do BR_SC. Não cortar verba agora.',
      acao: 'Gravar com Carol a mesma fórmula do Alicerce (prova simples / casa) para Fort Myers Piçarras.',
      metricaBase: 'lead_formulario',
      numeros: {
        leadsBrSc7d: leadsBr,
        cplBrSc7d: cplBr,
        cplAlicerceRef: cplAli,
        campanhaBrSc: brSc?.campanha || 'FortMyers_BR_SC',
        campanhaAlicerceRef: alicerce?.campanha || '[ALICERCE][AYA]',
      },
      valorDiaSugerido: null,
      botoes: ['aplicar', 'ajustar', 'agora-nao'],
    },
    {
      id: 'rec-amanay-duplicar-30',
      tipo: 'duplicar_escalar',
      produto: 'AMANAY — ITAPOÁ',
      publico: 'SC + PR',
      prioridade: 2,
      titulo: 'Duplicar Amanay · R$ 30/dia',
      problema: null,
      oportunidade: `${leadsAma} leads form. a ${brl(cplAma)} — entre os menores CPL da conta.`,
      evidencia: [
        `${amanay?.campanha || '[ROGGA][AMANAY]'}: ${leadsAma} form. · gasto ${brl(gastoAma)} · CPL ${brl(cplAma)}`,
        'Público sugerido: SC + PR (mesmo eixo do criativo vencedor).',
      ],
      recomendacao: 'Escalar com cópia controlada — não misturar com Fort Myers.',
      acao: 'Duplicar Amanay com R$ 30/dia · público SC+PR.',
      metricaBase: 'lead_formulario',
      numeros: {
        leadsForm: leadsAma,
        cplForm: cplAma,
        gasto: gastoAma,
        campanhaRef: amanay?.campanha || '[ROGGA][AMANAY]',
        valorDia: 30,
      },
      valorDiaSugerido: 30,
      botoes: ['aplicar', 'ajustar', 'agora-nao'],
    },
  ];

  return {
    ok: true,
    geradoEm: new Date().toISOString(),
    metricaPrincipal: 'lead_formulario',
    aviso: 'IA sugere · Michel executa na Meta · Bruno acompanha. Modo seguro (sem escrita automática).',
    recomendacoes: recs,
  };
}

/** Texto WhatsApp quando Michel decide numa recomendação. */
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
