// Núcleo do PLACAR DE CAMPANHAS (arquivo "_" = NÃO vira função).
// Recebe o `data` do Meta Ads Insights (nível campanha) e devolve: por campanha
// gasto · leads · CPL, os totais, e a DECISÃO DO DIA (escalar / revisar).
// Puro/testável — a função placar.mjs só busca a Meta e chama isto.

// Tipos de "resultado" que contam como LEAD (form de lead + clique-pro-WhatsApp).
// Conserta o "s/ dado": muitas campanhas otimizam por conversa iniciada, não por 'lead'.
const TIPOS_LEAD = new Set([
  'lead',
  'leadgen.other',
  'onsite_conversion.lead_grouped',
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.total_messaging_connection',
]);

/** Extrai a contagem de leads de uma campanha do Insights (robusto a formatos). */
export function extraiLeads(c = {}) {
  let n = 0;
  for (const a of (Array.isArray(c.actions) ? c.actions : [])) {
    if (TIPOS_LEAD.has(a.action_type)) n += Number(a.value) || 0;
  }
  // fallback: o campo 'results' (resultado da otimização da própria campanha)
  if (n === 0 && Array.isArray(c.results) && c.results[0] && Array.isArray(c.results[0].values)) {
    n = Number(c.results[0].values[0] && c.results[0].values[0].value) || 0;
  }
  return n;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;
const slug = (s) => String(s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'x';
const CRM_FASE_A = [
  'Cruzamento Helena/CRM ainda não ligado nesta fase.',
  'Hoje a leitura é só Meta (gasto · leads · CPL).',
  'Não pause só por CPL — espere o funil comercial.',
].join('\n');
export const ROTEIRO_META_IA = [
  'Analise esta campanha, mas não tome decisões apenas pelo CPL.',
  '',
  'Considere:',
  '- investimento;',
  '- dias no ar;',
  '- quantidade de leads;',
  '- CPL;',
  '- CTR;',
  '- CPM;',
  '- frequência;',
  '- taxa de conversão;',
  '- qualidade dos leads;',
  '- respostas;',
  '- agendamentos;',
  '- comparecimentos;',
  '- negociações;',
  '- vendas.',
  '',
  'Responda em linguagem simples:',
  '1. O que os dados mostram?',
  '2. Qual é o principal problema?',
  '3. Qual hipótese ainda precisa ser comprovada?',
  '4. O que devo verificar antes de alterar?',
  '5. Qual ação é segura hoje?',
  '6. Qual ação eu não devo tomar ainda?',
  '7. Quanto tempo devo aguardar?',
  '8. O que preciso aprender com esse caso?',
].join('\n');

/**
 * Monta o placar a partir do array `data` do Meta Insights.
 * @returns {{campanhas, totalGasto, totalLeads, cplMedio, decisao}}
 */
export function montaPlacar(data = []) {
  const campanhas = (Array.isArray(data) ? data : []).map((c) => {
    const gasto = round2(num(c.spend));
    const leads = extraiLeads(c);
    const cpl = leads > 0 ? round2(gasto / leads) : null;
    return { nome: c.campaign_name || '(sem nome)', gasto, leads, cpl };
  })
    .filter((c) => c.gasto > 0)          // só campanha que GASTOU no período (tira inativa/ruído)
    .sort((a, b) => b.gasto - a.gasto);

  const totalGasto = round2(campanhas.reduce((s, c) => s + c.gasto, 0));
  const totalLeads = campanhas.reduce((s, c) => s + c.leads, 0);
  const cplMedio = totalLeads > 0 ? round2(totalGasto / totalLeads) : null;

  return { campanhas, totalGasto, totalLeads, cplMedio, decisao: decideDoDia(campanhas, cplMedio) };
}

/**
 * Decisão do dia (liga anúncio à VENDA, não ao clique — regra da casa):
 *  - ESCALAR: tem lead e CPL <= média (custo bom).
 *  - REVISAR: gastou (>= R$50) e trouxe ZERO lead (queimando dinheiro).
 */
export function decideDoDia(campanhas = [], cplMedio = null, { gastoMinRevisar = 50 } = {}) {
  const escalar = campanhas
    .filter((c) => c.leads > 0 && (cplMedio == null || c.cpl <= cplMedio))
    .sort((a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity))
    .slice(0, 3);
  const revisar = campanhas
    .filter((c) => c.leads === 0 && c.gasto >= gastoMinRevisar)
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, 3);
  return { escalar, revisar };
}

const brl = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

function campanhaEmLista(c, tipo) {
  return {
    id: `${tipo === 'escalar' ? 'esc' : 'rev'}-${slug(c.nome)}`,
    campanha: c.nome,
    tipo,
    gasto: c.gasto ?? 0,
    leads: c.leads ?? 0,
    cpl: c.cpl ?? null,
  };
}

function aprendizadoPadrao(item, placar = {}) {
  if (item.tipo === 'escalar') {
    return 'Campanha com CPL abaixo da média deve escalar devagar, com registro e observação de 48–72 horas.';
  }
  if (item.tipo === 'revisar') {
    return 'Gasto alto sem lead pede revisar criativo, público e frequência antes de pausar.';
  }
  return 'Quando o placar não aponta campeã nem vazamento, a melhor decisão é proteger o que já está saudável e só observar.';
}

function fichaMudancaEscalar(item) {
  return {
    oQueMudar: `Abrir a campanha “${item.campanha}” no Ads Manager e subir a verba em passo pequeno, registrando o valor novo antes de publicar.`,
    porQueMudar: `${item.campanha} trouxe ${item.leads} lead(s) com CPL ${brl(item.cpl)}, abaixo da média do período.`,
    resultadoEsperado: 'Ganhar volume sem perder eficiência de CPL nas próximas 48–72 horas.',
    risco: 'Escalar cedo demais e piorar o CPL ou misturar mudança de verba com mudança de criativo.',
    prazoObservacao: '48 a 72 horas sem trocar público e criativo no mesmo movimento.',
    comoDesfazer: 'Voltar o orçamento para o valor anterior registrado hoje no Ads Manager.',
  };
}

function cartaoEscalar(item, placar, aprendizados) {
  const aprendizado = aprendizados[item.id] || aprendizadoPadrao(item, placar);
  return {
    ...item,
    nivel: 'Nível 2',
    situacao: `${item.leads} lead(s) com CPL ${brl(item.cpl)} nos últimos 7 dias, abaixo do CPL médio ${brl(placar.cplMedio)}.`,
    significado: 'A campanha está mais eficiente que a média do placar e pode receber teste de escala controlada, sem mexer em tudo ao mesmo tempo.',
    dadoComercial: CRM_FASE_A,
    recomendacao: 'Escalar com cautela hoje.',
    acaoMichel: [
      `Abrir a campanha “${item.campanha}” no Ads Manager.`,
      'Entrar no conjunto/anúncio que trouxe os leads deste período.',
      'Aumentar a verba em passo pequeno e registrar o valor novo.',
      'Preencher a ficha de mudança abaixo antes de publicar.',
      'Não trocar público e criativo no mesmo teste.',
    ],
    porque: 'Mídia boa reduz o custo do cadastro, mas venda depende do funil comercial; sem CRM ligado, hoje a leitura para na Meta e pede escala controlada.',
    aprendizado,
    precisaAprovacaoBruno: 'Não. Nível 2 — a recomendação já está registrada neste cartão, então o Michel pode executar só a mudança pequena com ficha completa e plano de desfazer.',
    fichaMudanca: fichaMudancaEscalar(item),
  };
}

function cartaoRevisar(item, aprendizados) {
  const aprendizado = aprendizados[item.id] || aprendizadoPadrao(item);
  return {
    ...item,
    nivel: 'Nível 1',
    situacao: `${item.campanha} gastou ${brl(item.gasto)} e trouxe ${item.leads} lead(s) nos últimos 7 dias.`,
    significado: 'Há gasto sem resposta da Meta neste período, então o foco de hoje é diagnosticar o que travou antes de cortar ou escalar.',
    dadoComercial: CRM_FASE_A,
    recomendacao: 'Revisar hoje; não pausar só por este sinal.',
    acaoMichel: [
      `Abrir a campanha “${item.campanha}” no Ads Manager.`,
      'Conferir frequência, criativo, público e posição do anúncio.',
      'Colar o roteiro da Meta IA abaixo e comparar a resposta com o que você enxergou no painel.',
      'Se a análise pedir troca de criativo, público ou verba, subir para Nível 2 com ficha de mudança.',
      'Não pausar a campanha hoje só por CPL ou por 0 lead sem CRM.',
    ],
    porque: '0 lead com gasto alto aponta problema de mídia ou oferta, mas sem dado comercial ainda não dá para confundir clique, qualidade e venda.',
    aprendizado,
    precisaAprovacaoBruno: 'Não. Nível 1 — hoje a ação é análise, checklist e aprendizado; sem pausa automática e sem verba relevante.',
    fichaMudanca: null,
  };
}

function cartaoManter(placar, aprendizados = {}) {
  const item = { id: 'manter-carteira', campanha: 'Carteira do período', tipo: 'manter', gasto: placar.totalGasto ?? 0, leads: placar.totalLeads ?? 0, cpl: placar.cplMedio ?? null };
  return {
    ...item,
    nivel: 'Nível 1',
    situacao: `Nenhuma campanha entrou em escalar ou revisar nos últimos 7 dias (${placar.totalLeads || 0} lead(s) no total).`,
    significado: 'O placar não mostra campeã clara nem vazamento forte, então o melhor movimento é acompanhar sem inventar mudança.',
    dadoComercial: CRM_FASE_A,
    recomendacao: 'Manter como está hoje.',
    acaoMichel: [
      'Abrir o Ads Manager e conferir alertas ou reprovações.',
      'Ver se alguma campanha saudável mudou muito desde a última leitura.',
      'Registrar aprendizado e esperar novo sinal antes de mexer em verba, público ou criativo.',
    ],
    porque: 'Quando não há sinal forte, mexer por impulso pode estragar o que já está estável.',
    aprendizado: aprendizados[item.id] || aprendizadoPadrao(item, placar),
    precisaAprovacaoBruno: 'Não. Nível 1 — sem sinal forte, a tarefa é acompanhar e proteger o que já está funcionando.',
    fichaMudanca: null,
  };
}

export function montaCartoesCopiloto(placar, { aprendizados = {} } = {}) {
  const p = placar || {};
  const revisar = (p.decisao?.revisar || []).map((c) => campanhaEmLista(c, 'revisar'));
  const escalar = (p.decisao?.escalar || []).map((c) => campanhaEmLista(c, 'escalar'));
  const base = [...revisar, ...escalar];
  const cartoes = base.length
    ? base.map((item) => (item.tipo === 'revisar' ? cartaoRevisar(item, aprendizados) : cartaoEscalar(item, p, aprendizados)))
    : [cartaoManter(p, aprendizados)];
  const vistos = new Set(cartoes.map((c) => c.campanha));
  const naoAltere = (p.campanhas || [])
    .map((c) => c.nome)
    .filter((nome) => !vistos.has(nome));
  const aprendizadosGerados = Object.fromEntries(cartoes.map((c) => [c.id, c.aprendizado]));
  return { cartoes, naoAltere, roteiroMetaIA: ROTEIRO_META_IA, aprendizadosGerados };
}

/** Texto do Placar pro WhatsApp (preto no zap; enxuto e acionável). */
export function resumoPlacarWhats(placar, { periodo = 'últimos 7 dias' } = {}) {
  const p = placar || {};
  const { cartoes, naoAltere, roteiroMetaIA } = montaCartoesCopiloto(p);
  const blocos = cartoes.flatMap((c) => {
    const linhasAcao = (c.acaoMichel || []).map((item, i) => `${i + 1}. ${item}`);
    const ficha = c.fichaMudanca ? [
      '',
      'FICHA DE MUDANÇA:',
      `O que mudar: ${c.fichaMudanca.oQueMudar}`,
      `Por que mudar: ${c.fichaMudanca.porQueMudar}`,
      `Resultado esperado: ${c.fichaMudanca.resultadoEsperado}`,
      `Risco: ${c.fichaMudanca.risco}`,
      `Prazo de observação: ${c.fichaMudanca.prazoObservacao}`,
      `Como desfazer: ${c.fichaMudanca.comoDesfazer}`,
    ] : [];
    return [
      `CAMPANHA: ${c.campanha}`,
      '',
      'SITUAÇÃO:',
      c.situacao,
      '',
      'O QUE ISSO SIGNIFICA:',
      c.significado,
      '',
      'DADO COMERCIAL:',
      c.dadoComercial,
      '',
      'RECOMENDAÇÃO:',
      c.recomendacao,
      '',
      'AÇÃO PARA O MICHEL:',
      ...linhasAcao,
      ...ficha,
      '',
      'POR QUE:',
      c.porque,
      '',
      'APRENDIZADO DO DIA:',
      c.aprendizado,
      '',
      'PRECISA DE APROVAÇÃO DO BRUNO?',
      c.precisaAprovacaoBruno,
      '',
    ];
  });
  return [
    '📊 *Copiloto de Tráfego — Michel*',
    `_${periodo} · dados reais da Meta_`,
    '',
    `*Total do período:* ${brl(p.totalGasto)} · ${p.totalLeads || 0} lead(s) · CPL médio ${brl(p.cplMedio)}`,
    '',
    ...blocos,
    'NÃO ALTERE HOJE:',
    ...(naoAltere.length ? naoAltere.map((nome) => `- ${nome}`) : ['- Só as campanhas acima pedem atenção hoje.']),
    '',
    'ROTEIRO META IA (cole se precisar de segunda opinião):',
    roteiroMetaIA,
  ].filter((x) => x !== undefined).join('\n');
}
