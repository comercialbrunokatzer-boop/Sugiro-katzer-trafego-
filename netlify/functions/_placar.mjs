// Núcleo do PLACAR DE CAMPANHAS (arquivo "_" = NÃO vira função).
// Métrica que CONTA (Bruno):
//   1) Cadastro de formulário Meta  OU
//   2) Conversa WhatsApp (cliente chamou / iniciou conversa)
// NÃO conta: clique, link_click, view, engajamento.
// NÃO soma action_types sobrepostos — escolhe 1 por prioridade (form antes de WhatsApp).
import fs from 'node:fs';
import { enriqueceCampanha, podeEscalar, LEADS_MIN_ESCALAR } from './_campanhas-regras.mjs';

/**
 * Prioridade: formulário primeiro → depois conversa WhatsApp (cliente chamou).
 * Nunca clique.
 */
export const PRIORIDADE_LEAD_FORMULARIO = [
  'onsite_conversion.lead_grouped',
  'leadgen_grouped',
  'onsite_conversion.lead',
  'leadgen.other',
  'lead',
];

/** Conversa WhatsApp real — conta. Clique pra abrir chat NÃO. */
export const PRIORIDADE_WHATSAPP = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.total_messaging_connection',
];

export const PRIORIDADE_RESULTADO = [
  ...PRIORIDADE_LEAD_FORMULARIO,
  ...PRIORIDADE_WHATSAPP,
];

export const TIPOS_LEAD_FORMULARIO = new Set(PRIORIDADE_LEAD_FORMULARIO);
export const TIPOS_WHATSAPP = new Set(PRIORIDADE_WHATSAPP);
export const TIPOS_RESULTADO_VALIDO = new Set(PRIORIDADE_RESULTADO);

/** Clique / view / engajamento — NUNCA contam. */
export const TIPOS_NAO_FORMULARIO = new Set([
  'link_click',
  'inline_link_click',
  'landing_page_view',
  'page_engagement',
  'post_engagement',
  'video_view',
  'omni_landing_page_view',
  'onsite_conversion.messaging_block',
  'click_to_call_call_confirm',
  'outbound_click',
]);
export const TIPOS_NAO_RESULTADO = TIPOS_NAO_FORMULARIO;

function indicadorEhValido(indicator = '') {
  const s = String(indicator).toLowerCase();
  if (!s) return false;
  if (s.includes('click') || s.includes('view') || s.includes('engage')) return false;
  if (s.includes('lead') || s.includes('form')) return true;
  if (s.includes('messaging_conversation') || s.includes('messaging_first_reply')
      || s.includes('messaging_connection') || s.includes('whatsapp')) return true;
  return false;
}

function mapaAcoes(c = {}) {
  const map = new Map();
  for (const a of (Array.isArray(c.actions) ? c.actions : [])) {
    const t = a.action_type;
    if (!t) continue;
    map.set(t, (map.get(t) || 0) + (Number(a.value) || 0));
  }
  return map;
}

function temSinalSoClique(c = {}, mapa) {
  for (const t of TIPOS_NAO_RESULTADO) {
    if ((mapa.get(t) || 0) > 0) return true;
  }
  const clicks = Number(c.clicks) || 0;
  if (clicks > 0) return true;
  if (Array.isArray(c.results) && c.results[0]) {
    const ind = String(c.results[0].indicator || '').toLowerCase();
    if (ind && (ind.includes('click') || ind.includes('view') || ind.includes('engage'))) return true;
  }
  return false;
}

/**
 * Conta formulário OU conversa WhatsApp (1 tipo por campanha, por prioridade).
 * Clique nunca entra.
 * @returns {{ leads:number, fonte:string|null, aviso:string|null, confirmado:boolean, tipo:'formulario'|'whatsapp'|null }}
 */
export function extraiLeadsFormulario(c = {}) {
  const mapa = mapaAcoes(c);

  for (const tipo of PRIORIDADE_RESULTADO) {
    const v = mapa.get(tipo);
    if (v != null && v > 0) {
      const ehWa = TIPOS_WHATSAPP.has(tipo);
      return {
        leads: v,
        fonte: tipo,
        aviso: null,
        confirmado: true,
        tipo: ehWa ? 'whatsapp' : 'formulario',
      };
    }
  }

  if (Array.isArray(c.results) && c.results[0]) {
    const r0 = c.results[0];
    if (indicadorEhValido(r0.indicator) && Array.isArray(r0.values)) {
      const n = Number(r0.values[0] && r0.values[0].value) || 0;
      if (n > 0) {
        const ind = String(r0.indicator || '').toLowerCase();
        const ehWa = ind.includes('messaging') || ind.includes('whatsapp');
        return {
          leads: n,
          fonte: `results:${r0.indicator || 'lead'}`,
          aviso: null,
          confirmado: true,
          tipo: ehWa ? 'whatsapp' : 'formulario',
        };
      }
    }
  }

  const temTipoValidoZero = PRIORIDADE_RESULTADO.some((t) => mapa.has(t));
  if (temTipoValidoZero || !temSinalSoClique(c, mapa)) {
    return {
      leads: 0,
      fonte: null,
      aviso: '0 formulários / conversas WhatsApp.',
      confirmado: true,
      tipo: null,
    };
  }

  return {
    leads: 0,
    fonte: null,
    aviso: 'Só clique — não conta. Precisa formulário ou conversa WhatsApp (cliente chamou).',
    confirmado: false,
    tipo: null,
  };
}

/** @deprecated use extraiLeadsFormulario — mantido como número puro pra API interna. */
export function extraiLeads(c = {}) {
  return extraiLeadsFormulario(c).leads;
}

/**
 * Inventário seguro dos action_types (pra confirmar o que a API manda).
 * Não inclui token nem payload completo.
 */
export function inventariarAcoes(data = []) {
  const totais = new Map();
  const porCampanha = [];
  for (const c of (Array.isArray(data) ? data : [])) {
    const spend = Number(c.spend) || 0;
    if (spend <= 0) continue;
    const acts = [];
    for (const a of (c.actions || [])) {
      const t = a.action_type;
      const v = Number(a.value) || 0;
      acts.push({ action_type: t, value: v });
      totais.set(t, (totais.get(t) || 0) + v);
    }
    const form = extraiLeadsFormulario(c);
    porCampanha.push({
      nome: c.campaign_name || '(sem nome)',
      gasto: spend,
      leadsFormulario: form.leads,
      fonteLead: form.fonte,
      tipoResultado: form.tipo,
      confirmado: form.confirmado,
      avisoLead: form.aviso,
      actions: acts.filter((a) => /lead|messaging|click|form/i.test(a.action_type)),
      resultsIndicator: c.results && c.results[0] ? c.results[0].indicator || null : null,
    });
  }
  return {
    totais: [...totais.entries()].sort((a, b) => b[1] - a[1]).map(([action_type, value]) => ({ action_type, value })),
    formulariosNosTotais: [...totais.entries()]
      .filter(([t]) => TIPOS_LEAD_FORMULARIO.has(t))
      .map(([action_type, value]) => ({ action_type, value })),
    whatsappNosTotais: [...totais.entries()]
      .filter(([t]) => TIPOS_WHATSAPP.has(t))
      .map(([action_type, value]) => ({ action_type, value })),
    fontesUsadas: [...new Set(porCampanha.map((c) => c.fonteLead).filter(Boolean))],
    porCampanha,
  };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Monta o placar a partir do array `data` do Meta Insights.
 * leads / CPL = formulário OU conversa WhatsApp. Clique nunca. CPL só se confirmado e leads > 0.
 */
export function montaPlacar(data = []) {
  const campanhas = (Array.isArray(data) ? data : []).map((c) => {
    const gasto = round2(num(c.spend));
    const { leads, fonte, aviso, confirmado, tipo } = extraiLeadsFormulario(c);
    const cpl = (confirmado && leads > 0) ? round2(gasto / leads) : null;
    return enriqueceCampanha({
      nome: c.campaign_name || '(sem nome)',
      id: c.campaign_id || null,
      gasto,
      leads,
      cpl,
      impressoes: num(c.impressions),
      alcance: num(c.reach),
      fonteLead: fonte,
      avisoLead: aviso,
      leadConfirmado: confirmado,
      tipoResultado: tipo,
    });
  })
    .filter((c) => c.gasto > 0)
    .sort((a, b) => b.gasto - a.gasto);

  const totalGasto = round2(campanhas.reduce((s, c) => s + c.gasto, 0));
  const totalLeads = campanhas.reduce((s, c) => s + (c.leadConfirmado ? c.leads : 0), 0);
  const cplMedio = totalLeads > 0 ? round2(totalGasto / totalLeads) : null;
  const inventario = inventariarAcoes(data);

  if (process.env.CI && process.env.GITHUB_STEP_SUMMARY) {
    try {
      let diag = '\n### Inventário action_type (form + WhatsApp)\n\n';
      diag += `Fontes usadas: ${(inventario.fontesUsadas || []).join(', ') || '(nenhuma)'}\n\n`;
      diag += '| action_type | soma |\n|---|--:|\n';
      for (const x of [...(inventario.formulariosNosTotais || []), ...(inventario.whatsappNosTotais || [])]) {
        diag += `| \`${x.action_type}\` | ${x.value} |\n`;
      }
      diag += '\n| Campanha | resultados | fonte |\n|---|--:|---|\n';
      for (const c of inventario.porCampanha) {
        diag += `| ${c.nome} | ${c.leadsFormulario} | \`${c.fonteLead || '—'}\` |\n`;
      }
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, diag);
      console.log(diag);
    } catch { /* ignore */ }
  }

  return {
    campanhas,
    totalGasto,
    totalLeads,
    cplMedio,
    metrica: 'formulario_ou_whatsapp',
    regra: 'Conta: formulário OU conversa WhatsApp (cliente chamou). Clique não.',
    fontesLead: inventario.fontesUsadas,
    decisao: decideDoDia(campanhas, cplMedio),
  };
}

/**
 * Decisão do dia — form ou WhatsApp.
 *  - ESCALAR: leads >= 10, CPL ok, sem público fora do BR em Piçarras.
 *  - OBSERVAR: tem lead mas < 10 (SEM BASE) — NÃO entra em escalar.
 *  - REVISAR: gastou (>= R$50) e ZERO resultado confirmado.
 */
export function decideDoDia(campanhas = [], cplMedio = null, { gastoMinRevisar = 50 } = {}) {
  const escalar = campanhas
    .filter((c) => podeEscalar(c) && (cplMedio == null || c.cpl <= cplMedio))
    .sort((a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity))
    .slice(0, 3);

  // SEM BASE — mas público fora do BR NÃO vira “sugestão” no topo (V4)
  const observar = campanhas
    .filter((c) => c.leadConfirmado !== false && c.leads > 0 && c.leads < LEADS_MIN_ESCALAR)
    .sort((a, b) => {
      const aProib = a.alertaPublico ? 1 : 0;
      const bProib = b.alertaPublico ? 1 : 0;
      if (aProib !== bProib) return aProib - bProib; // BR_SC antes de Americanos
      return (a.cpl ?? Infinity) - (b.cpl ?? Infinity);
    })
    .slice(0, 5);

  const alertasPublico = campanhas
    .filter((c) => c.alertaPublico)
    .slice(0, 5);

  const revisar = campanhas
    .filter((c) => c.leadConfirmado !== false && c.leads === 0 && c.gasto >= gastoMinRevisar)
    .sort((a, b) => b.gasto - a.gasto)
    .slice(0, 3);

  return { escalar, observar, alertasPublico, revisar };
}

const brl = (v) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const slugCartao = (s) => String(s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'x';

const CRM_FASE_A = [
  'Cruzamento Helena/CRM ainda não ligado nesta fase.',
  'Hoje a leitura é só Meta (gasto · leads form/WhatsApp · CPL).',
  'Não pause só por CPL — espere o funil comercial.',
].join('\n');

/** Roteiro opcional pra Michel colar na Meta IA (segunda opinião — não decide sozinha). */
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

function campanhaEmLista(c, tipo) {
  return {
    id: `${tipo === 'escalar' ? 'esc' : 'rev'}-${slugCartao(c.nome)}`,
    campanha: c.nome,
    tipo,
    gasto: c.gasto ?? 0,
    leads: c.leads ?? 0,
    cpl: c.cpl ?? null,
  };
}

function aprendizadoPadrao(item) {
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
  const aprendizado = aprendizados[item.id] || aprendizadoPadrao(item);
  return {
    ...item,
    nivel: 'Nível 2',
    situacao: `${item.leads} lead(s) form/WhatsApp com CPL ${brl(item.cpl)} nos últimos 7 dias, abaixo do CPL médio ${brl(placar.cplMedio)}.`,
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
    situacao: `${item.campanha} gastou ${brl(item.gasto)} e trouxe ${item.leads} lead(s) form/WhatsApp nos últimos 7 dias.`,
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
  const item = {
    id: 'manter-carteira',
    campanha: 'Carteira do período',
    tipo: 'manter',
    gasto: placar.totalGasto ?? 0,
    leads: placar.totalLeads ?? 0,
    cpl: placar.cplMedio ?? null,
  };
  return {
    ...item,
    nivel: 'Nível 1',
    situacao: `Nenhuma campanha entrou em escalar ou revisar nos últimos 7 dias (${placar.totalLeads || 0} lead(s) form/WhatsApp no total).`,
    significado: 'O placar não mostra campeã clara nem vazamento forte, então o melhor movimento é acompanhar sem inventar mudança.',
    dadoComercial: CRM_FASE_A,
    recomendacao: 'Manter como está hoje.',
    acaoMichel: [
      'Abrir o Ads Manager e conferir alertas ou reprovações.',
      'Ver se alguma campanha saudável mudou muito desde a última leitura.',
      'Registrar aprendizado e esperar novo sinal antes de mexer em verba, público ou criativo.',
    ],
    porque: 'Quando não há sinal forte, mexer por impulso pode estragar o que já está estável.',
    aprendizado: aprendizados[item.id] || aprendizadoPadrao(item),
    precisaAprovacaoBruno: 'Não. Nível 1 — sem sinal forte, a tarefa é acompanhar e proteger o que já está funcionando.',
    fichaMudanca: null,
  };
}

/**
 * Cartões diários do Copiloto (Fase A) — template oficial de 8 blocos.
 * Motor determinístico; sem CRM (dado comercial = aviso Fase A).
 */
export function montaCartoesCopiloto(placar, { aprendizados = {} } = {}) {
  const p = placar || {};
  const revisar = (p.decisao?.revisar || []).map((c) => campanhaEmLista(c, 'revisar'));
  const escalar = (p.decisao?.escalar || []).map((c) => campanhaEmLista(c, 'escalar'));
  const base = [...revisar, ...escalar];
  const cartoes = base.length
    ? base.map((item) => (item.tipo === 'revisar'
      ? cartaoRevisar(item, aprendizados)
      : cartaoEscalar(item, p, aprendizados)))
    : [cartaoManter(p, aprendizados)];
  const vistos = new Set(cartoes.map((c) => c.campanha));
  const naoAltere = (p.campanhas || [])
    .map((c) => c.nome)
    .filter((nome) => !vistos.has(nome));
  const aprendizadosGerados = Object.fromEntries(cartoes.map((c) => [c.id, c.aprendizado]));
  return { cartoes, naoAltere, roteiroMetaIA: ROTEIRO_META_IA, aprendizadosGerados };
}

/** Texto do Placar pro WhatsApp — cartão Copiloto Fase A (8 blocos). Clique nunca conta. */
export function resumoPlacarWhats(placar, { periodo = 'últimos 7 dias', aprendizados = {} } = {}) {
  const p = placar || {};
  const { cartoes, naoAltere, roteiroMetaIA } = montaCartoesCopiloto(p, { aprendizados });
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
    `_${periodo} · conta form OU WhatsApp (cliente chamou) · min ${LEADS_MIN_ESCALAR} pra escalar · clique não_`,
    '',
    `*Total do período:* ${brl(p.totalGasto)} · ${p.totalLeads || 0} resultado(s) · CPL médio ${brl(p.cplMedio)}`,
    '',
    ...blocos,
    'NÃO ALTERE HOJE:',
    ...(naoAltere.length ? naoAltere.map((nome) => `- ${nome}`) : ['- Só as campanhas acima pedem atenção hoje.']),
    '',
    'ROTEIRO META IA (cole se precisar de segunda opinião):',
    roteiroMetaIA,
  ].filter((x) => x !== undefined).join('\n');
}
