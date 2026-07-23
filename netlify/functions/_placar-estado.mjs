// Núcleo do PLACAR-QUADRADINHO (arquivo "_" = NÃO vira função).
// Guarda a lógica PURA das decisões do Michel (Aplicar / Ajustar / Agora não)
// e monta a lista de sugestões a partir do placar. Sem I/O e SEM depender da
// rotina — o Placar é um quintal independente (facilita o corte #6 depois).

const DECISOES = new Set(['aplicar', 'ajustar', 'agora-nao']);
const slug = (s) => String(s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'x';

/** Data/hora de Brasília — próprio (o Placar não importa nada da rotina). */
export function agoraBRT(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const o = Object.fromEntries(p.map((x) => [x.type, x.value]));
  return { data: `${o.year}-${o.month}-${o.day}`, hm: `${o.hour}:${o.minute}`, min: (+o.hour % 24) * 60 + (+o.minute) };
}

/** Transforma a "decisão do dia" do placar numa lista de sugestões tocáveis. */
export function montaSugestoes(placar = {}) {
  const d = (placar && placar.decisao) || {};
  const map = (arr, tipo) => (Array.isArray(arr) ? arr : []).map((c) => ({
    id: (tipo === 'escalar' ? 'esc-' : 'rev-') + slug(c.nome),
    campanha: c.nome, tipo, cpl: c.cpl ?? null, gasto: c.gasto ?? 0, leads: c.leads ?? 0,
  }));
  return [...map(d.escalar, 'escalar'), ...map(d.revisar, 'revisar')];
}

export function decisoesVazias(data) { return { data, itens: {}, aprendizados: {} }; }

/** Registra (ou troca) a decisão do Michel pra uma sugestão. Puro — o último toque vale. */
export function registraDecisao(decisoes, { id, campanha, tipo, decisao, ajuste, hora, min }) {
  if (!id) throw new Error('id da sugestão é obrigatório');
  if (!DECISOES.has(decisao)) throw new Error(`decisão inválida (use ${[...DECISOES].join(' / ')})`);
  decisoes.itens = decisoes.itens || {};
  decisoes.itens[id] = {
    id, campanha: campanha || '', tipo: tipo || '', decisao,
    ajuste: decisao === 'ajustar' ? String(ajuste || '').slice(0, 300) : '',
    hora: hora || '', min: Number.isFinite(min) ? min : null,
  };
  return decisoes;
}

/** Lista as decisões do dia (mais recente primeiro) pro painel e pro Gestor. */
export function listaDecisoes(decisoes = {}) {
  return Object.values((decisoes && decisoes.itens) || {}).sort((a, b) => (b.min ?? 0) - (a.min ?? 0));
}

/** Persiste o aprendizado do dia por cartão para manter a frase estável no estado. */
export function garanteAprendizados(decisoes = {}, cartoes = []) {
  const atual = { ...((decisoes && decisoes.aprendizados) || {}) };
  let mudou = !decisoes.aprendizados;
  for (const cartao of (Array.isArray(cartoes) ? cartoes : [])) {
    if (!cartao || !cartao.id || !cartao.aprendizado || atual[cartao.id]) continue;
    atual[cartao.id] = cartao.aprendizado;
    mudou = true;
  }
  if (mudou) decisoes.aprendizados = atual;
  return { mudou, aprendizados: atual };
}

/** Rótulo curto e honesto de uma decisão (pro WhatsApp/log). */
export function rotuloDecisao(item = {}) {
  const acao = item.decisao === 'aplicar' ? '✅ Aplicou' : item.decisao === 'ajustar' ? '✎ Ajustou' : '⏸ Agora não';
  const alvo = item.tipo === 'escalar' ? 'escalar' : 'revisar';
  const aj = item.decisao === 'ajustar' && item.ajuste ? ` — ${item.ajuste}` : '';
  return `${acao} · ${alvo} *${item.campanha}*${aj}`;
}
