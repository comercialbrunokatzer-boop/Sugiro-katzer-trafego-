/**
 * PAINÉIS (KOS-002 P1.B6 + parecer executivo).
 * painelMichel: visão operacional (leitura em 30s). parecerBruno: SÓ decisão (nada operacional).
 * Puro e testável.
 *
 * Vocabulário = funil oficial Katzer (#47). NÃO é o UI de quadradinhos do tráfego.
 * Aliases legados preservados.
 */

// probabilidade de fechar por estágio — usada pra estimar receita prevista
const PROB = {
  'Leads Novos': 0.05,
  'Tentando Contato': 0.08,
  'Mapeamento': 0.15,
  'Agendamento': 0.25,
  'Agendamento Meetins': 0.25,
  'Agendado Físico': 0.3,
  'Follow Up': 0.18,
  'Negociação': 0.5,
  'Proposta': 0.65,
  'Contrato': 0.8,
  'Ganhou': 1,
  // aliases legados
  'Lead Novo': 0.05,
  'Qualificado': 0.2,
  'Documentação': 0.75,
  'Fechado': 1,
  'Pós-venda': 1,
};

const ESTAGIOS_QUENTES = new Set([
  'Negociação', 'Proposta', 'Contrato', 'Documentação',
]);

/** Indicadores operacionais do Michel (números — sem redesenhar UI). */
export function painelMichel(d = {}) {
  const recebidos = d.leads_recebidos || 0;
  const distribuidos = d.leads_distribuidos || 0;
  const fechamentos = d.fechamentos || 0;
  const tempos = d.tempo_primeira_resposta_h || [];
  const media = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;
  return {
    leads_recebidos: recebidos,
    leads_distribuidos: distribuidos,
    nao_distribuidos: Math.max(0, recebidos - distribuidos),
    ligacoes_realizadas: d.ligacoes_realizadas || 0,
    ligacoes_pendentes: d.ligacoes_pendentes || 0,
    agendamentos: d.agendamentos || 0,
    atendimentos: d.atendimentos || 0,
    conversao_pct: recebidos ? Math.round((fechamentos / recebidos) * 100) : 0,
    tempo_medio_primeira_resposta_h: media == null ? null : Math.round(media * 10) / 10,
    carteira_parada: d.carteira_parada || 0,
    em_conferir: d.em_conferir || 0,
  };
}

/** Parecer executivo do Bruno — só oportunidade, risco, receita e decisão. Nada operacional. */
export function parecerBruno(d = {}) {
  const leads = d.leads || [];
  const tetoAlto = d.teto_alto_valor || 1000000;
  const oportunidades = leads.filter((l) => ESTAGIOS_QUENTES.has(l.estagio) || (l.valor || 0) >= tetoAlto);
  const travadas = leads.filter((l) => l.estagio === 'Negociação' && (l.ultimo_contato_dias ?? 0) >= 3);
  const receita = leads.reduce((s, l) => s + (l.valor || 0) * (PROB[l.estagio] || 0), 0);
  return {
    oportunidades_quentes: oportunidades
      .sort((a, b) => (b.valor || 0) - (a.valor || 0))
      .slice(0, 10)
      .map((l) => ({ cliente: l.cliente, estagio: l.estagio, valor: l.valor || null })),
    negociacoes_travadas: travadas.map((l) => ({ cliente: l.cliente, dias_parado: l.ultimo_contato_dias })),
    receita_prevista: Math.round(receita),
    riscos: d.riscos || [],
    decisoes_solicitadas: d.decisoes || [],
  };
}
