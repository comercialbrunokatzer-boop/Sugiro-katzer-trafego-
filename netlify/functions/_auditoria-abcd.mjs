// Auditoria Caçador — Qualidade A/B/C/D (Provisória + Real) + métricas + trava vermelha.
// Não substitui bom/curioso/errado/comprador (CPL BOM). Camada paralela (Parte 2).

export const ABCD = ['A', 'B', 'C', 'D'];

export const ABCD_ROTULO = {
  A: 'Pronto até 3m',
  B: 'Quase pronto 4-12m',
  C: 'Futuro / Curioso',
  D: 'Sem perfil',
};

export const STATUS_POS = ['', 'Em mapeamento', 'Saiu', 'Nutrição', 'Descartado'];

export function normalizaAbcd(v) {
  const s = String(v || '').trim().toUpperCase();
  return ABCD.includes(s) ? s : null;
}

export function normalizaStatusPos(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^saiu$/i.test(s)) return 'Saiu';
  if (/mapeamento/i.test(s)) return 'Em mapeamento';
  if (/nutri/i.test(s)) return 'Nutrição';
  if (/descart/i.test(s)) return 'Descartado';
  return s;
}

/** TRAVA: Saiu + Qualidade Real vazia → vermelho. */
export function isVermelho(lead = {}) {
  const st = normalizaStatusPos(lead.statusPosMapeamento);
  const real = normalizaAbcd(lead.qualidadeReal);
  return st === 'Saiu' && !real;
}

export function acertoProvisoriaVsReal(leads = []) {
  const pares = (leads || []).filter((l) => normalizaAbcd(l.qualidadeProvisoria) && normalizaAbcd(l.qualidadeReal));
  if (!pares.length) {
    return { n: 0, acertos: 0, pct: null, texto: 'Sem pares Provisória×Real ainda' };
  }
  let acertos = 0;
  for (const l of pares) {
    if (normalizaAbcd(l.qualidadeProvisoria) === normalizaAbcd(l.qualidadeReal)) acertos += 1;
  }
  const pct = Math.round((acertos / pares.length) * 100);
  return {
    n: pares.length,
    acertos,
    pct,
    texto: `Taxa de acerto do Caçador: ${pct}% (${acertos}/${pares.length})`,
  };
}

export function qualidadeRealPorFonte(leads = []) {
  const map = {};
  for (const l of leads || []) {
    const real = normalizaAbcd(l.qualidadeReal);
    if (!real) continue;
    const fonte = String(l.fonte || '—');
    if (!map[fonte]) map[fonte] = { fonte, A: 0, B: 0, C: 0, D: 0, n: 0 };
    map[fonte][real] += 1;
    map[fonte].n += 1;
  }
  return Object.values(map);
}

export function resumoAuditoria(leads = []) {
  const lista = leads || [];
  const vermelhos = lista.filter(isVermelho);
  const comIa = lista.filter((l) => normalizaAbcd(l.qualidadeIa));
  const comReal = lista.filter((l) => normalizaAbcd(l.qualidadeReal));
  const comProv = lista.filter((l) => normalizaAbcd(l.qualidadeProvisoria));
  return {
    n: lista.length,
    vermelhos: vermelhos.length,
    comIa: comIa.length,
    comReal: comReal.length,
    comProvisoria: comProv.length,
    acerto: acertoProvisoriaVsReal(lista),
    porFonte: qualidadeRealPorFonte(lista),
    leadsVermelhos: vermelhos.map((l) => ({
      id: l.id,
      nome: l.nome,
      campanha: l.campanha,
      corretor: l.corretor,
      fonte: l.fonte,
    })),
  };
}

/**
 * Aplica marca de auditoria (provisória / real / status).
 * Mantém qualidade CPL (bom/curioso…) intacta.
 */
export function marcaAuditoria(leads = [], {
  leadId,
  qualidadeProvisoria = undefined,
  qualidadeReal = undefined,
  statusPosMapeamento = undefined,
  quem = 'Michel',
} = {}) {
  const lista = [...(Array.isArray(leads) ? leads : [])];
  const idx = lista.findIndex((l) => l.id === leadId);
  if (idx < 0) throw new Error('lead não encontrado');

  const patch = { ...lista[idx] };
  if (qualidadeProvisoria !== undefined) {
    const v = qualidadeProvisoria === null || qualidadeProvisoria === ''
      ? null
      : normalizaAbcd(qualidadeProvisoria);
    if (qualidadeProvisoria && !v) throw new Error('qualidadeProvisoria: use A/B/C/D');
    patch.qualidadeProvisoria = v;
    patch.provisoriaEm = new Date().toISOString();
    patch.provisoriaPor = quem;
  }
  if (qualidadeReal !== undefined) {
    const v = qualidadeReal === null || qualidadeReal === ''
      ? null
      : normalizaAbcd(qualidadeReal);
    if (qualidadeReal && !v) throw new Error('qualidadeReal: use A/B/C/D');
    patch.qualidadeReal = v;
    patch.realEm = new Date().toISOString();
    patch.realPor = quem;
  }
  if (statusPosMapeamento !== undefined) {
    patch.statusPosMapeamento = normalizaStatusPos(statusPosMapeamento);
  }

  const vermelho = isVermelho(patch);
  patch.travaVermelha = vermelho;
  lista[idx] = patch;

  return {
    lead: patch,
    leads: lista,
    vermelho,
    toast: vermelho
      ? '⚠️ VERMELHO — Saiu sem Qualidade Real. Preencha A/B/C/D.'
      : 'Auditoria registrada',
    bloqueiaAvancoBitrix: vermelho,
  };
}

/** Heurística local quando OpenAI não está disponível. */
export function classificaHeuristica(lead = {}) {
  const q = lead.qualidade;
  let qualidade = 'C';
  let confianca = 40;
  let motivo = 'Poucos dados — default C';
  if (q === 'comprador' || q === 'bom') {
    qualidade = 'A';
    confianca = 70;
    motivo = `Caçador marcou ${q}`;
  } else if (q === 'curioso') {
    qualidade = 'C';
    confianca = 65;
    motivo = 'Caçador marcou curioso';
  } else if (q === 'errado') {
    qualidade = 'D';
    confianca = 80;
    motivo = 'Caçador marcou nº errado';
  }
  return {
    qualidade,
    confianca,
    motivo,
    resumo: `${lead.nome || 'Lead'} · ${lead.campanha || 'sem campanha'} · fonte ${lead.fonte || '—'}`,
    sinais_compra: q === 'bom' || q === 'comprador' ? ['marcado positivo no Caçador'] : [],
    risco: qualidade === 'A' ? 'baixo' : (qualidade === 'D' ? 'alto' : 'médio'),
    via: 'heuristica',
  };
}

export const PROMPT_HELENA_AUDITORA = `Você audita leads de tráfego pago da Imobiliária Katzer.
Você NÃO é a Helena Secretária. Você não responde cliente. Você só classifica.

ENTRADA:
- Timeline Bitrix: mensagens WhatsApp (cliente + corretor), anotações, ligações transcritas, fase atual, fonte
- Histórico: até 30 dias

SAÍDA OBRIGATÓRIA EM JSON:
{
  "qualidade": "A | B | C | D",
  "confianca": 0-100,
  "motivo": "explicação curta 1 frase",
  "resumo": "resumo do lead em até 2 linhas",
  "sinais_compra": ["sinal1", "sinal2"],
  "risco": "alto/médio/baixo de perder"
}

REGRAS A/B/C/D:
A = Pronto até 3m - tem dinheiro/sinal, urgência, já viu imóvel, quer visitar
B = Quase pronto 4-12m - tem interesse real, mas depende de venda, financiamento, etc
C = Futuro/Curioso - sem urgência, só pesquisando
D = Sem perfil - sem renda, fora da região, não responde com interesse, spam

NUNCA INVENTE. Se não há dados suficientes, use C com confiança baixa.`;
