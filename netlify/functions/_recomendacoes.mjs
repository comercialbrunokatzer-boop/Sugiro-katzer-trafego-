// Recomendações do Painel de Campanhas (arquivo "_" = NÃO vira função).
// Texto canônico do Bruno + evidência ao vivo (formulário). Decisões: aplicar|ajustar|agora-nao.

import { slug } from './_placar-estado.mjs';

const brl = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);

/**
 * Dois cards oficiais do dia (Painel de Campanhas).
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
    || volMax.find((c) => /AMANAY/i.test(c.campanha));

  const recs = [
    {
      id: 'rec-fortmyers-brsc-criativo',
      tipo: 'trocar_criativo',
      produto: 'FORT MYERS - PIÇARRAS',
      publico: 'BR_SC - 9 leads a R$ 77',
      prioridade: 1,
      titulo: 'Manter BR_SC, mas trocar criativo',
      problema: 'Mesma cidade que Alicerce, mas CPL 3x maior',
      oportunidade: null,
      evidencia: [
        'Gerenciador: BR_SC · 9 leads form. · CPL ~R$ 77',
        `API 7d: ${brSc ? `${brSc.leads ?? brSc.leadsForm} form. · CPL ${brl(brSc.cpl ?? brSc.cplForm)}` : '—'}`,
        `Alicerce ref.: CPL ~R$ 18${alicerce ? ` (${brl(alicerce.cplForm)})` : ''}`,
      ],
      recomendacao: 'MANTER BR_SC, mas trocar criativo',
      acao: 'Gravar com Carol a mesma fórmula do Alicerce (R$ 18) para Fort Myers',
      metricaBase: 'lead_formulario',
      numeros: {
        leadsGerenciador: 9,
        cplGerenciador: 77,
        leadsApi7d: brSc?.leads ?? brSc?.leadsForm ?? null,
        cplApi7d: brSc?.cpl ?? brSc?.cplForm ?? null,
        cplAlicerceRef: 18,
      },
      valorDiaSugerido: null,
      botoes: ['aplicar', 'ajustar', 'agora-nao'],
    },
    {
      id: 'rec-amanay-duplicar-30',
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
          ? `API conta: ${amanay.leadsForm} form. · CPL ${brl(amanay.cplForm)} · ${amanay.campanha}`
          : 'API: Amanay no top de CPL formulário',
      ],
      recomendacao: 'Escalar Amanay — não misturar com Fort Myers',
      acao: 'Duplicar Amanay com R$ 30/dia - público SC+PR',
      metricaBase: 'lead_formulario',
      numeros: {
        leadsForm: 24,
        cplForm: 11,
        valorDia: 30,
        leadsApi: amanay?.leadsForm ?? null,
        cplApi: amanay?.cplForm ?? null,
      },
      valorDiaSugerido: 30,
      botoes: ['aplicar', 'ajustar', 'agora-nao'],
    },
  ];

  return {
    ok: true,
    geradoEm: new Date().toISOString(),
    metricaPrincipal: 'lead_formulario',
    aviso: 'IA sugere · Michel executa na Meta · Bruno acompanha. Modo seguro.',
    recomendacoes: recs,
  };
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
