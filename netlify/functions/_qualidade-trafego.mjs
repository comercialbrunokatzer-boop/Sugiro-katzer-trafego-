// Qualidade do lead — tráfego pago (Katzer OS App Decisão).
// Escala: Potencial | Interessado | Curioso | Fake | Ruim
// Sem justificativa = descarta (não metrifica).

export const QUAL_TRAFEGO = ['potencial', 'interessado', 'curioso', 'fake', 'ruim'];

export const QUAL_TRAFEGO_ROTULO = {
  potencial: 'Potencial',
  interessado: 'Interessado',
  curioso: 'Curioso',
  fake: 'Fake',
  ruim: 'Ruim',
};

/** Fontes que a IA lê — só tráfego pago. */
export const FONTES_TRAFEGO_PAGO = [
  'PATROCINADO CORRETOR',
  'FACEBOOK ADS',
  'FORMULARIO DE CRM',
  'FORMULARIO CRM',
  'CANAL ABERTO',
];

export function normalizaQualTrafego(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '');
  if (s === 'sem justificativa' || s === 'sj' || s === 'descartado') return 'sem_justificativa';
  // legado A/B/C/D
  if (s === 'a') return 'interessado';
  if (s === 'b') return 'potencial';
  if (s === 'c') return 'curioso';
  if (s === 'd') return 'ruim';
  if (QUAL_TRAFEGO.includes(s)) return s;
  const map = {
    potencial: 'potencial',
    interessado: 'interessado',
    curioso: 'curioso',
    fake: 'fake',
    ruim: 'ruim',
  };
  return map[s] || null;
}

export function fonteEhTrafegoPago(fonte = '') {
  const f = String(fonte || '').toUpperCase()
    .normalize('NFD').replace(/\p{M}/gu, '');
  if (!f) return false;
  if (/CHAMADA|ACAO|AÇÃO|FEIRA/.test(f)) return false;
  return FONTES_TRAFEGO_PAGO.some((x) => {
    const n = x.normalize('NFD').replace(/\p{M}/gu, '');
    return f.includes(n) || n.includes(f);
  }) || /FACEBOOK|META|ADS|PATROC|FORMULAR|CANAL ABERTO|BITRIX|DEMO/.test(f);
}

export function detalheQualidadeVazio() {
  return { pot: 0, int: 0, cur: 0, fake: 0, ruim: 0, sj: 0 };
}

/** Agrega contagens por campanha a partir dos leads. */
export function agregaQualidadePorCampanha(leads = []) {
  const map = new Map();
  for (const raw of leads) {
    const nome = String(raw.campanha || '').trim();
    if (!nome) continue;
    if (raw.fonte && !fonteEhTrafegoPago(raw.fonte) && raw.fonte !== 'demo') continue;

    const key = nome;
    if (!map.has(key)) map.set(key, detalheQualidadeVazio());
    const d = map.get(key);

    // prioridade: Real → IA → Provisória (legado) → qualidade CPL mapeada
    let q = normalizaQualTrafego(raw.qualidadeReal)
      || normalizaQualTrafego(raw.qualidadeIa)
      || normalizaQualTrafego(raw.qualidadeProvisoria);

    if (!q && raw.qualidade) {
      // mapeia Caçador CPL → escala nova (provisório)
      const m = { bom: 'potencial', comprador: 'interessado', curioso: 'curioso', errado: 'fake' };
      q = m[raw.qualidade] || null;
    }
    if (raw.semJustificativa || q === 'sem_justificativa') {
      d.sj += 1;
      continue;
    }
    if (!q) continue;
    if (q === 'potencial') d.pot += 1;
    else if (q === 'interessado') d.int += 1;
    else if (q === 'curioso') d.cur += 1;
    else if (q === 'fake') d.fake += 1;
    else if (q === 'ruim') d.ruim += 1;
  }
  return map;
}

export function matchDetalheCampanha(mapa, nomeCampanha) {
  if (!nomeCampanha) return detalheQualidadeVazio();
  if (mapa.has(nomeCampanha)) return mapa.get(nomeCampanha);
  const n = String(nomeCampanha).toLowerCase();
  for (const [k, v] of mapa) {
    const kk = k.toLowerCase();
    if (n.includes(kk) || kk.includes(n)) return v;
  }
  // tokens
  for (const [k, v] of mapa) {
    const tok = k.split(/[_\s\[\]]+/).filter((t) => t.length > 3);
    if (tok.some((t) => n.includes(t.toLowerCase()))) return v;
  }
  return detalheQualidadeVazio();
}

/** Badge: bad se CPL alto + Fake/Ruim; good se CPL baixo. */
export function badgeCampanha(cpl, detail = {}) {
  const fakeRuim = (detail.fake || 0) + (detail.ruim || 0);
  if (cpl != null && cpl >= 70 && fakeRuim > 0) return 'bad';
  if (cpl != null && cpl >= 45 && fakeRuim >= 2) return 'bad';
  if (cpl != null && cpl < 35) return 'good';
  if (cpl != null && cpl < 50 && fakeRuim === 0) return 'good';
  return '';
}

/** Alerta ao Manter campanha ruim. */
export function deveAlertarManter(cam = {}) {
  const cpl = Number(cam.cpl);
  const d = cam.detail || {};
  const fakeRuim = (d.fake || 0) + (d.ruim || 0);
  if (cam.qual === 'bad') return true;
  if (fakeRuim > 0 && Number.isFinite(cpl) && cpl >= 45) return true;
  return false;
}

export const PROMPT_QUALIDADE_TRAFEGO = `Você audita leads de tráfego pago da Imobiliária Katzer.
Você NÃO é a Helena Secretária. Você não responde cliente. Você só classifica qualidade.

FONTES PERMITIDAS (só essas): PATROCINADO CORRETOR, FACEBOOK ADS, FORMULARIO DE CRM, CANAL ABERTO.
Ignore chamada, ação, feira.

ENTRADA: timeline Bitrix (abas de fase), ligações/transcrições, WhatsApp Helena, etiquetas do corretor.

SAÍDA OBRIGATÓRIA EM JSON:
{
  "qualidade": "potencial|interessado|curioso|fake|ruim|sem_justificativa",
  "confianca": 0-100,
  "motivo": "1 frase",
  "resumo": "até 2 linhas"
}

REGRAS:
- potencial: qualificado, potencial financeiro, ainda entendendo o momento
- interessado: já demonstrou que realmente quer comprar
- curioso: início da pesquisa / clicou por curiosidade
- fake: corretor, cadastro inválido, quem atende não é a pessoa
- ruim: sem qualificação financeira ou interesse
- sem_justificativa: card criado por conversa com terceiro → DESCARTA, não metrifica

NUNCA INVENTE. Sem dados suficientes → curioso com confiança baixa.`;
