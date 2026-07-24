/**
 * SECRETÁRIA IA — cérebro (prioridade máxima do CEO).
 * O Katzer conversa com o cliente; a secretária LÊ a conversa, INTERPRETA a fase,
 * e o Maestro ATUALIZA o Bitrix. O CEO nunca mais preenche CRM na mão.
 *
 * FUNIL REAL da Katzer (IDs confirmados pelo raio-x do webhook de leitura, 19/07).
 * REGRA DO CEO (19/07): "quero ver o imóvel / preço / fotos / visitar" = MAPEAMENTO.
 * NEGOCIAÇÃO só quando o cliente está DE FATO negociando (geralmente pós-reunião).
 * Tudo antes disso é Mapeamento.
 *
 * ZONAS (regra do CEO 19/07 — corrigida):
 *  - VERDE (a Secretária faz SOZINHA): tudo ATÉ A REUNIÃO — inclui Mapeamento,
 *    Agendamento do bate-papo e o REAGENDAMENTO quando o cliente furar. Isso tudo
 *    aparece no WhatsApp, então ela move sozinha.
 *  - VERMELHA (depende do Bruno; só PROPÕE e espera o OK no WhatsApp): DEPOIS da
 *    reunião — Negociação em diante.
 */

// Fases da Secretária -> etapa REAL do Bitrix. IDs CONFIRMADOS pelo raio-x do webhook
// de leitura (19/07) — funil "FUNIL NOVO KATZER (USEM ESSE)" (CATEGORY_ID = 1). 18 fases.
export const ESTAGIO_BITRIX = {
  'Leads Novos':             'C1:NEW',
  'Tentando Contato':        'C1:PREPARATION',
  'Carteira corretor':       'C1:UC_PFXJQQ',
  'Mapeamento':              'C1:PREPAYMENT_INVOICE', // cliente engajou: quer ver, pergunta preço/fotos/condição (pré-reunião)
  'Aprovação Viagem':        'C1:UC_Q9KBWL',
  'Cliente em viagem':       'C1:EXECUTING',
  'Agendamento Meetins':     'C1:FINAL_INVOICE',      // bate-papo/reunião a marcar
  'Agendado Físico':         'C1:UC_0V8YA1',          // reunião marcada/feita
  'Reagendamento de Visita': 'C1:UC_GUEW1G',          // cliente furou -> remarca
  'Follow Up':               'C1:UC_7P0WD3',          // pós-reunião
  'Negociação':              'C1:UC_3NOP4U',          // negociação DE FATO (pós-reunião)
  'Proposta':                'C1:UC_GB4BGY',
  'Contrato':                'C1:UC_86VZ0Y',
  'Aprovação Exceção':       'C1:UC_NKBUD8',
  'Exceção':                 'C1:UC_UT1HFW',
  'Ganhou':                  'C1:WON',
  'Rampage':                 'C1:LOSE',
  'Perdido':                 'C1:APOLOGY',
};

// Reverso: STAGE_ID do Bitrix (C1:...) -> nome amigável da fase. Serve pra saber
// a etapa ATUAL do card (contexto) a partir do que o Bitrix devolve.
const BITRIX_ESTAGIO = Object.fromEntries(
  Object.entries(ESTAGIO_BITRIX).map(([nome, id]) => [id, nome]),
);
export function estagioPorStageId(stageId) {
  return BITRIX_ESTAGIO[String(stageId || '')] || null;
}

// Ordem do funil (menos -> mais avançado), na sequência real do Bitrix.
const ORDEM = [
  'Leads Novos', 'Tentando Contato', 'Carteira corretor', 'Mapeamento', 'Aprovação Viagem',
  'Cliente em viagem', 'Agendamento Meetins', 'Agendado Físico', 'Reagendamento de Visita',
  'Follow Up', 'Negociação', 'Proposta', 'Contrato', 'Aprovação Exceção', 'Exceção', 'Ganhou',
];

// ZONA VERDE: a Secretária MOVE sozinha. Regra do CEO: tudo ATÉ A REUNIÃO — inclui
// mapeamento, agendamento do bate-papo, agendado físico e o REAGENDAMENTO quando o cliente
// furar (tudo isso aparece no WhatsApp). DEPOIS da reunião (Follow Up / Negociação+) vira
// ZONA VERMELHA — ela PROPÕE no WhatsApp e só o Bruno confirma.
// [CONFERIR c/ CEO] 'Follow Up', 'Carteira corretor', 'Aprovação Viagem', 'Cliente em viagem'
// são casos de fronteira — deixei os de agenda/pré-reunião no verde e Follow Up no vermelho.
export const ZONA_VERDE = [
  'Leads Novos', 'Tentando Contato', 'Carteira corretor', 'Mapeamento', 'Aprovação Viagem',
  'Cliente em viagem', 'Agendamento Meetins', 'Agendado Físico', 'Reagendamento de Visita',
];
export function ehZonaVerde(estagio) { return ZONA_VERDE.includes(estagio); }
// Compat (código antigo usava ESTAGIOS_CRITICOS = precisa de humano): agora = zona vermelha.
export const ESTAGIOS_CRITICOS = ORDEM.filter((e) => !ZONA_VERDE.includes(e));

// Farejador determinístico (fallback; a leitura FINA é do Claude).
// CEO: preço/condição/desconto ANTES da reunião ainda é Mapeamento, não Negociação.
const SINAIS = {
  'Mapeamento': /quero\s+ver|ver\s+o\s+im[oó]vel|marcar\s+(uma\s+)?visita|conhecer\s+o\s+im[oó]vel|tenho\s+interesse|gostei|me\s+manda|quanto\s+(custa|[eé]\s+o\s+valor)|qual\s+o\s+(valor|pre[cç]o)|fotos?|planta|condi[cç][ãõ]|parcel|entrada|financ|desconto/i,
  'Agendamento Meetins': /agendar|marcar\s+(a\s+)?(reuni[ãa]o|visita|bate-?papo)|podemos\s+marcar|que\s+dia\s+(voc[eê]|fica|podemos)|marca(r)?\s+(um\s+)?hor[aá]rio|reuni[ãa]o\s+(amanh|dia|semana)/i,
  'Reagendamento de Visita': /remarcar|reagendar|nao\s+vou\s+poder|n[aã]o\s+consigo\s+(ir|nesse|amanh)|desmarcar|adiar\s+a\s+(visita|reuni)/i,
  'Negociação': /fechar\s+em|fecho\s+se|topo\s+se|se\s+(voc[eê]s?\s+)?fizer|contra-?proposta|meu\s+limite\s+[eé]|abaixa\s+pra|melhor\s+condi[cç]/i,
  'Contrato':   /document|quais\s+documentos|contrato|assinar|assinatura|rg\b|cpf\b|comprovante/i,
  'Ganhou':     /fechado|fechamos|assinei|assinado|neg[oó]cio\s+fechado|pode\s+emitir|comprei|vou\s+fechar/i,
};

/** Farejador: devolve as fases cujos sinais aparecem no texto. */
export function detectaSinais(texto = '') {
  const t = String(texto || '');
  const achados = [];
  for (const [estagio, rx] of Object.entries(SINAIS)) {
    if (rx.test(t)) achados.push(estagio);
  }
  return achados;
}

/** Escolhe a fase MAIS AVANÇADA detectada. Regra do CEO: cliente que FALOU já engajou
 *  -> Mapeamento (a confiança baixa do farejador segura auto-move de um "oi" fraco). Sem
 *  texto nenhum -> Leads Novos. */
export function estagioPorSinais(texto = '') {
  const achados = detectaSinais(texto);
  if (!achados.length) return String(texto || '').trim() ? 'Mapeamento' : 'Leads Novos';
  return achados.sort((a, b) => ORDEM.indexOf(b) - ORDEM.indexOf(a))[0];
}

/** Monta o update pronto pro Bitrix a partir da leitura da secretária. */
export function montaAtualizacao(analise = {}, dealId) {
  const estagio = ESTAGIO_BITRIX[analise.estagio] ? analise.estagio : 'Mapeamento';
  const transicao = analise.mudanca && analise.mudanca.estagio_anterior
    ? `🔀 ${analise.mudanca.estagio_anterior} → ${analise.mudanca.estagio_novo}` : null;
  const comentario = [
    transicao,
    analise.resumo ? `📝 ${analise.resumo}` : null,
    analise.proxima_acao ? `➡️ Próxima ação: ${analise.proxima_acao}` : null,
    `🤖 Atualizado pela Secretária IA — fase: ${estagio}`,
  ].filter(Boolean).join('\n');
  return {
    id: dealId,
    fields: {
      STAGE_ID: ESTAGIO_BITRIX[estagio],
      COMMENTS: comentario,
    },
    _estagio: estagio,
  };
}

/** Trilha de auditoria da mudança de fase (comportamento contínuo). */
export function registraMudanca({ de = null, para, motivo, evidencias = [], validadoPor = 'Secretária IA (auto)' }) {
  return {
    estagio_anterior: de,
    estagio_novo: para,
    motivo: motivo || `Avanço comercial para ${para}`,
    evidencias: Array.isArray(evidencias) ? evidencias.filter(Boolean) : [evidencias].filter(Boolean),
    em: new Date().toISOString(),
    validado_por: validadoPor,
  };
}

/** O prompt que o Claude recebe pra ler a conversa e devolver JSON validável. */
export function promptSecretaria(conversa = '') {
  return [
    'Você é a Secretária do Katzer OS. Leia a conversa e devolva APENAS um JSON:',
    '{"recommended_stage": <Leads Novos|Tentando Contato|Carteira corretor|Mapeamento|Aprovação Viagem|Cliente em viagem|Agendamento Meetins|Agendado Físico|Reagendamento de Visita|Follow Up|Negociação|Proposta|Contrato|Aprovação Exceção|Exceção|Ganhou|Rampage|Perdido>,',
    ' "confidence": <0 a 1>, "evidence": ["<frases do CLIENTE que sustentam a fase>"],',
    ' "resumo": "<1-3 linhas comercial, estilo carteira: interesse, produto, sinais de pagamento, próximo passo>",',
    ' "next_action": "<curta e concreta>", "requires_human_review": <true|false>}.',
    'REGRAS: (Lei 01) só use falas do CLIENTE como evidência; nunca a fala da equipe/Helena/CEO.',
    'MAPEAMENTO = cliente engajou: quer ver, pergunta preço/fotos/condição — TUDO isso é Mapeamento (pré-reunião).',
    'NEGOCIAÇÃO só se ele está DE FATO negociando (contra-proposta, "fecho se...", limite) — geralmente pós-reunião.',
    'Na dúvida entre Mapeamento e algo mais avançado, escolha Mapeamento.',
    '',
    'CONVERSA:',
    conversa,
  ].join('\n');
}

// ── TRAVAS (§6A) — a IA recomenda; o Maestro valida e executa. ──
export const LIMIAR_CONFIANCA = 0.7;
const CONFIRMA_FECHADO = /assin(ei|ou|ado|amos|ar)|fechado|fechamos|contrato\s+assinado|pode\s+(fazer|mandar)\s+o\s+contrato|neg[oó]cio\s+fechado|comprei|pode\s+emitir/i;

/** Junta só as mensagens do CLIENTE (fala da equipe NUNCA vira intenção). */
export function soDoCliente(mensagens = []) {
  return (mensagens || [])
    .filter((m) => ['cliente', 'lead', 'client'].includes(String(m.autor || m.from || '').toLowerCase()))
    .map((m) => (m.texto || m.body || '').toString())
    .join('\n');
}

/** Valida o parecer da IA contra as travas. */
export function validaParecer(parecer = {}, { estagioAtual = null } = {}) {
  const estagio = parecer.recommended_stage;
  if (!estagio || !ESTAGIO_BITRIX[estagio]) {
    return { aprovado: false, requer_revisao: true, estagio_final: estagioAtual || null, motivos: ['fase inválida ou ausente'] };
  }
  // 🔒 NUNCA REGRIDE SOZINHA (#78, decisão do CEO/Conselho: "ela organiza, não decide").
  // Se a fase recomendada é ANTERIOR à atual, CLAMPA na fase atual: mantém o card onde está
  // (só refresca comentário/campos), NUNCA troca o STAGE_ID pra trás. Vale pro farejador E
  // pro Claude (Fase 2), porque a trava vive aqui no validaParecer. Avançar/refrescar a mesma
  // fase = ok pro verde; retroceder = nunca no automático.
  const iRec = ORDEM.indexOf(estagio);
  const iAtual = estagioAtual ? ORDEM.indexOf(estagioAtual) : -1;
  const regressao = iAtual >= 0 && iRec >= 0 && iRec < iAtual;
  const estagioAlvo = regressao ? estagioAtual : estagio;

  const conf = Number(parecer.confidence);
  const ev = Array.isArray(parecer.evidence) ? parecer.evidence.filter(Boolean) : [];
  const motivos = [];
  if (parecer.requires_human_review) motivos.push('IA pediu revisão humana');
  if (!Number.isFinite(conf) || conf < LIMIAR_CONFIANCA) motivos.push(`confiança baixa (${Number.isFinite(conf) ? conf : 'ausente'})`);
  if (!ehZonaVerde(estagioAlvo) && ev.length === 0) motivos.push('fase da zona vermelha sem evidência textual');
  if (estagioAlvo === 'Ganhou' && !ev.some((e) => CONFIRMA_FECHADO.test(String(e)))) motivos.push('"Ganhou" sem confirmação objetiva');
  const requer = motivos.length > 0;
  return {
    aprovado: !requer,
    requer_revisao: requer,
    estagio_final: requer ? (estagioAtual || null) : estagioAlvo,
    ...(regressao ? { clamp_regressao: true } : {}),
    motivos,
  };
}

// Roteamento: quem confirma/acompanha. Zona vermelha sobe pro Bruno; verde fica com o Michel.
export function quemRevisa(parecer = {}) {
  return ehZonaVerde(parecer.recommended_stage) ? 'MICHEL' : 'BRUNO';
}

const PROXIMA_ACAO = {
  'Leads Novos': 'Fazer o primeiro contato',
  'Tentando Contato': 'Insistir no contato / nutrir',
  'Carteira corretor': 'Rotear pro corretor certo',
  'Mapeamento': 'Qualificar e conduzir pro bate-papo',
  'Aprovação Viagem': 'Alinhar a viagem do cliente',
  'Cliente em viagem': 'Acompanhar o cliente em viagem',
  'Agendamento Meetins': 'Marcar o bate-papo (2 horários)',
  'Agendado Físico': 'Confirmar presença / preparar a reunião',
  'Reagendamento de Visita': 'Remarcar o bate-papo o quanto antes',
  'Follow Up': 'Retomar após a reunião',
  'Negociação': 'Enviar proposta / condições',
  'Proposta': 'Acompanhar a proposta',
  'Contrato': 'Reunir documentos e contrato',
  'Aprovação Exceção': 'Aguardar aprovação da exceção',
  'Exceção': 'Tratar a exceção',
  'Ganhou': 'Iniciar pós-venda / entrega',
};
export function proximaAcaoSugerida(estagio) {
  return PROXIMA_ACAO[estagio] || 'Revisar o card e definir o próximo passo';
}

/**
 * Orquestra: valida o parecer e devolve a decisão.
 *  - Zona VERDE (até Mapeamento) + travas ok  -> ATUALIZAR (a Secretária move sozinha).
 *  - Zona VERMELHA (Agendamento+)             -> PROPOR (sobe pro Bruno; só aplica com o OK).
 *  - Não passou nas travas                     -> REVISAO_HUMANA.
 */
export function decideAtualizacao(parecer = {}, { estagioAtual = null, dealId } = {}) {
  const v = validaParecer(parecer, { estagioAtual });
  if (!v.aprovado) {
    return { acao: 'REVISAO_HUMANA', revisor: quemRevisa(parecer), motivos: v.motivos, parecer };
  }
  const proxima = parecer.next_action || proximaAcaoSugerida(v.estagio_final);
  const houveMudanca = estagioAtual && estagioAtual !== v.estagio_final;
  const mudanca = houveMudanca
    ? registraMudanca({ de: estagioAtual, para: v.estagio_final, evidencias: parecer.evidence, motivo: parecer.resumo })
    : null;
  const up = montaAtualizacao(
    { estagio: v.estagio_final, resumo: parecer.resumo || (parecer.evidence || []).join('; '), proxima_acao: proxima, mudanca },
    dealId,
  );
  // ZONA VERMELHA: nunca move sozinha — propõe pro Bruno confirmar no WhatsApp.
  if (!ehZonaVerde(v.estagio_final)) {
    return { acao: 'PROPOR', revisor: 'BRUNO', update: up, proxima_acao: proxima, mudanca, confidence: parecer.confidence };
  }
  // ZONA VERDE: aplica sozinha (Michel acompanha).
  return { acao: 'ATUALIZAR', update: up, proxima_acao: proxima, acompanhamento: 'MICHEL', mudanca, confidence: parecer.confidence };
}
