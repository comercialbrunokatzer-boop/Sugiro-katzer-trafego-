/**
 * FRENTE B — MICHEL como braço operacional (KOS-002 §6-8).
 * Transforma o RETRATO (achados do Auditor) numa FILA DE AÇÃO (o que fazer, quem, prazo, risco)
 * e mede o PRÓPRIO Michel (régua de gestão).
 *
 * ⚠️ MODO SEGURO: NÃO cobra ninguém enquanto as 15 regras do Auditor tiverem "confiança
 * indeterminada" (Constituição: não acusar sem prova). Aqui só ORGANIZA — a cobrança real
 * só liga depois da validação dos casos.
 */
export const MICHEL_MODO_SEGURO = true;

// Cada achado do Auditor → ação clara. "quem age" segue o Dicionário Operacional.
const ACAO = {
  SEM_LIGACAO_REGISTRADA:       { acao: 'Confirmar com o corretor se ligou; registrar', quem: 'Michel→corretor', prazo_h: 24, risco: 'lead esfria' },
  SEM_TOQUE_REGISTRADO_DIA_ZERO:{ acao: 'Verificar 1º contato no dia; registrar', quem: 'Michel→corretor', prazo_h: 4, risco: 'lead novo esfria em 24h' },
  SEM_ATIVIDADE_REGISTRADA:     { acao: 'Perguntar se houve contato; retomar ou mover etapa', quem: 'Michel→corretor', prazo_h: 24, risco: 'cliente quente abandonado' },
  SEM_DATA_RETORNO:             { acao: 'Preencher data de retorno (Rampage)', quem: 'Michel→corretor', prazo_h: 48, risco: 'perde o "me liga depois"' },
  SEM_CONTATO:                  { acao: 'Vincular o contato correto ou arquivar', quem: 'Michel (saneamento)', prazo_h: 72, risco: 'negócio vazio' },
  SEM_MOTIVO_PERDA:             { acao: 'Preencher o motivo da perda', quem: 'Michel→corretor', prazo_h: 48, risco: 'não se aprende por que perde' },
  NOSHOW_SEM_REGISTRO:          { acao: 'Investigar a automação do "compareceu?"', quem: 'BRUNO (estrutural)', prazo_h: 72, risco: 'no-show invisível' },
  DESCARTE_RELAMPAGO:           { acao: 'Olhar só se for padrão do mesmo corretor', quem: 'Michel (se repetir)', prazo_h: 120, risco: 'baixo — isolado é normal' },
};

/** Retrato → fila de ação. Cada item traz: ação, responsável, prazo, risco, resultado, evidência. */
export function filaDeAcao(achados = []) {
  return (achados || []).map((a) => {
    const m = ACAO[a.rule_id] || { acao: 'Revisar o card e definir próximo passo', quem: 'Michel', prazo_h: 48, risco: 'a definir' };
    return {
      deal_id: a.deal_id,
      corretor: a.corretor || '—',
      acao: m.acao,
      responsavel: m.quem,
      prazo_horas: m.prazo_h,
      risco: m.risco,
      resultado_esperado: 'registro atualizado / lead retomado',
      evidencia: a.evidencia || a.correcao_recomendada || null,
      _seguro: MICHEL_MODO_SEGURO, // não cobra; só organiza
    };
  });
}

/**
 * Régua que mede o PRÓPRIO Michel — a partir do log de ações dele (labels + horários).
 * Responde: ele cobrou? em quanto tempo? quantas pendências subiram ao CEO à toa?
 */
export function reguaDoMichel(eventos = []) {
  const t = { recebidas: 0, cobradas: 0, pendentes: 0, justificadas: 0, falso_alarme: 0, escaladas: 0, subiu_ao_ceo_a_toa: 0, temposH: [] };
  for (const e of eventos || []) {
    t.recebidas++;
    const label = String(e.label || '').toLowerCase();
    if (label === 'em-correcao' || label === 'concluido') t.cobradas++;
    else if (label === 'justificado') t.justificadas++;
    else if (label === 'falso-alarme') t.falso_alarme++;
    else if (label === 'escalado') { t.escaladas++; if (e.operacional) t.subiu_ao_ceo_a_toa++; }
    else t.pendentes++;
    if (Number.isFinite(e.recebido_ms) && Number.isFinite(e.agido_ms)) t.temposH.push((e.agido_ms - e.recebido_ms) / 3600000);
  }
  const media = t.temposH.length ? t.temposH.reduce((a, b) => a + b, 0) / t.temposH.length : null;
  return {
    recebidas: t.recebidas,
    cobradas: t.cobradas,
    pendentes: t.pendentes,
    justificadas: t.justificadas,
    falso_alarme: t.falso_alarme,
    escaladas: t.escaladas,
    subiu_ao_ceo_a_toa: t.subiu_ao_ceo_a_toa,
    tempo_medio_resposta_h: media == null ? null : Math.round(media * 10) / 10,
    taxa_falso_alarme_pct: t.recebidas ? Math.round((t.falso_alarme / t.recebidas) * 100) : 0,
  };
}
