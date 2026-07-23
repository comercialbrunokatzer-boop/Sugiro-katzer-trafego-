// Núcleo do PLACAR-QUADRADINHO (arquivo "_" = NÃO vira função).
// Guarda a lógica PURA das decisões do Michel (Aplicar / Ajustar / Agora não)
// e monta a lista de sugestões a partir do placar. Sem I/O e SEM depender da
// rotina — o Placar é um quintal independente (facilita o corte #6 depois).

const DECISOES = new Set(['aplicar', 'ajustar', 'agora-nao', 'desistir', 'manter', 'aumentar']);
const slug = (s) => String(s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'x';

export { slug };

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

/**
 * Uma sugestão principal no formato do quadradinho:
 * "Mover R$ X/dia de ORIGEM → DESTINO" (quando há campanha pra revisar e outra pra escalar).
 * Sem inventar venda — texto honesto com CPL/gasto.
 */
export function montaSugestaoPrincipal(placar = {}, { valorDia = 50 } = {}) {
  const d = (placar && placar.decisao) || {};
  const origem = (d.revisar && d.revisar[0]) || null;
  const destino = (d.escalar && d.escalar[0]) || null;
  if (origem && destino) {
    return {
      id: `mov-${slug(origem.nome)}-para-${slug(destino.nome)}`,
      tipo: 'mover',
      origem: origem.nome,
      destino: destino.nome,
      valorDia,
      titulo: `Mover R$ ${valorDia}/dia do ${origem.nome} → ${destino.nome}`,
      motivo: `${origem.nome}: R$ ${Number(origem.gasto || 0).toFixed(0)} gastos, ${origem.leads || 0} cadastro(s) de formulário. ${destino.nome} tem melhor CPL de formulário (${destino.cpl != null ? `R$ ${Number(destino.cpl).toFixed(0)}/cadastro` : 'abaixo da média'}).`,
      campanha: `${origem.nome} → ${destino.nome}`,
      gasto: origem.gasto ?? 0,
      leads: origem.leads ?? 0,
      cpl: destino.cpl ?? null,
    };
  }
  if (origem) {
    return {
      id: 'rev-' + slug(origem.nome),
      tipo: 'revisar',
      origem: origem.nome,
      destino: null,
      valorDia: null,
      titulo: `Revisar / cortar ${origem.nome}`,
      motivo: `R$ ${Number(origem.gasto || 0).toFixed(0)} gastos · ${origem.leads || 0} cadastro(s) de formulário — queimando verba.`,
      campanha: origem.nome,
      gasto: origem.gasto ?? 0,
      leads: origem.leads ?? 0,
      cpl: origem.cpl ?? null,
    };
  }
  if (destino) {
    return {
      id: 'esc-' + slug(destino.nome),
      tipo: 'escalar',
      origem: null,
      destino: destino.nome,
      valorDia,
      titulo: `Escalar ${destino.nome} (+R$ ${valorDia}/dia)`,
      motivo: `CPL formulário ${destino.cpl != null ? `R$ ${Number(destino.cpl).toFixed(0)}` : 'bom'} — abaixo da média. Vale mais verba.`,
      campanha: destino.nome,
      gasto: destino.gasto ?? 0,
      leads: destino.leads ?? 0,
      cpl: destino.cpl ?? null,
    };
  }
  return null;
}

export function decisoesVazias(data) { return { data, itens: {} }; }

/** Registra (ou troca) a decisão do Michel pra uma sugestão. Puro — o último toque vale. */
export function registraDecisao(decisoes, { id, campanha, tipo, decisao, ajuste, hora, min }) {
  if (!id) throw new Error('id da sugestão é obrigatório');
  if (!DECISOES.has(decisao)) throw new Error(`decisão inválida (use ${[...DECISOES].join(' / ')})`);
  decisoes.itens = decisoes.itens || {};
  decisoes.itens[id] = {
    id, campanha: campanha || '', tipo: tipo || '', decisao,
    ajuste: (decisao === 'ajustar' || decisao === 'aumentar')
      ? String(ajuste || '').slice(0, 300) : '',
    hora: hora || '', min: Number.isFinite(min) ? min : null,
  };
  return decisoes;
}

/** Lista as decisões do dia (mais recente primeiro) pro painel e pro Gestor. */
export function listaDecisoes(decisoes = {}) {
  return Object.values((decisoes && decisoes.itens) || {}).sort((a, b) => (b.min ?? 0) - (a.min ?? 0));
}

/** Rótulo curto e honesto de uma decisão (pro WhatsApp/log). */
export function rotuloDecisao(item = {}) {
  const map = {
    aplicar: '✅ Aplicou',
    ajustar: '✎ Ajustou',
    'agora-nao': '⏸ Agora não',
    desistir: '🛑 Desistiu',
    manter: '➡️ Manteve',
    aumentar: '⬆ Aumentou',
  };
  const acao = map[item.decisao] || `· ${item.decisao || 'Decisão'}`;
  const alvo = item.tipo === 'mover' ? 'mover'
    : item.tipo === 'escalar' ? 'escalar'
      : item.tipo === 'revisar' ? 'revisar'
        : item.tipo === 'campanha' ? 'campanha'
          : (item.tipo || '');
  const aj = item.ajuste ? ` — ${item.ajuste}` : '';
  const camp = item.campanha ? ` *${item.campanha}*` : '';
  return `${acao}${alvo ? ` · ${alvo}` : ''}${camp}${aj}`;
}
