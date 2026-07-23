// Núcleo do PLACAR-QUADRADINHO (arquivo "_" = NÃO vira função).
// Aplicar / Ajustar / Agora não + regras: base mínima 10, semáforo, cidade, público BR.

import {
  LEADS_MIN_ESCALAR, cidadeReal, publicoForaDoBrasil, semaforoCampanha, rotuloSemBase,
} from './_campanhas-regras.mjs';

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

function enrichSug(c, tipo) {
  const cidade = c.cidade || cidadeReal(c.nome);
  const pub = c.publico != null
    ? { publico: c.publico, alerta: !!c.alertaPublico, motivo: c.alertaPublico }
    : publicoForaDoBrasil(c.nome);
  const semaforo = c.semaforo || semaforoCampanha({
    leads: c.leads, cpl: c.cpl, leadConfirmado: c.leadConfirmado !== false,
  });
  return {
    id: (tipo === 'escalar' ? 'esc-' : tipo === 'observar' ? 'obs-' : 'rev-') + slug(c.nome),
    campanha: c.nome,
    tipo,
    cpl: c.cpl ?? null,
    gasto: c.gasto ?? 0,
    leads: c.leads ?? 0,
    cidade,
    publico: pub.publico || c.publico || null,
    alertaPublico: pub.alerta ? (pub.motivo || c.alertaPublico) : null,
    semaforo,
    diasNoAr: c.diasNoAr ?? null,
  };
}

/** Transforma a "decisão do dia" do placar numa lista de sugestões tocáveis. */
export function montaSugestoes(placar = {}) {
  const d = (placar && placar.decisao) || {};
  return [
    ...(Array.isArray(d.escalar) ? d.escalar.map((c) => enrichSug(c, 'escalar')) : []),
    ...(Array.isArray(d.observar) ? d.observar.map((c) => enrichSug(c, 'observar')) : []),
    ...(Array.isArray(d.revisar) ? d.revisar.map((c) => enrichSug(c, 'revisar')) : []),
  ];
}

/**
 * Sugestão principal do quadradinho.
 * NUNCA escala com leads < 10 — mostra OBSERVAR / SEM BASE.
 * V4: nunca promove EUA_Americanos/MIAMI/PORTUGAL como “oportunidade de CPL baixo”.
 * Inclui cidade real, semáforo e alerta de público fora do BR.
 */
export function montaSugestaoPrincipal(placar = {}, { valorDia = 50 } = {}) {
  const d = (placar && placar.decisao) || {};
  const origem = (d.revisar && d.revisar[0]) || null;
  // Preferir destino sem alerta de público (já filtrado em podeEscalar, reforço aqui)
  const destino = (d.escalar || []).find((c) => !c.alertaPublico) || null;
  // Observar: prioriza SEM BASE sem público proibido (BR_SC antes de Americanos)
  const observar = (d.observar || []).find((c) => !c.alertaPublico)
    || (d.observar && d.observar[0])
    || null;

  // Se o "melhor CPL" tem < 10 leads, NÃO escalar — observar.
  if (observar && !destino) {
    const cidade = observar.cidade || cidadeReal(observar.nome);
    const pub = publicoForaDoBrasil(observar.nome);
    const sem = observar.semaforo || semaforoCampanha(observar);
    const rotulo = rotuloSemBase(observar.leads);
    const linhasMotivo = [
      rotulo,
      `BLOQUEADO — não escalar (CPL R$ ${observar.cpl != null ? Number(observar.cpl).toFixed(0) : '—'} irrelevante sem base)`,
      `Cidade: ${cidade === 'Piçarras' ? 'Fort Myers - Piçarras' : cidade}`,
    ];
    if (pub.publico) {
      linhasMotivo.push(
        pub.alerta
          ? `Público: ${pub.publico} - ALERTA: público fora do Brasil`
          : `Público: ${pub.publico}`,
      );
    }
    if (observar.diasNoAr != null) {
      linhasMotivo.push(`Dias no ar: ${observar.diasNoAr} dias${observar.diasNoAr <= 3 ? ' - em aprendizado' : ''}`);
    }
    if (pub.alerta) linhasMotivo.push(pub.motivo);
    return {
      id: 'obs-' + slug(observar.nome),
      tipo: 'observar',
      origem: null,
      destino: observar.nome,
      valorDia: null,
      titulo: rotulo,
      motivo: linhasMotivo.join('\n'),
      recomendacao: `BLOQUEADO — ${rotulo}`,
      campanha: observar.nome,
      gasto: observar.gasto ?? 0,
      leads: observar.leads ?? 0,
      cpl: observar.cpl ?? null,
      cidade,
      publico: pub.publico,
      alertaPublico: pub.alerta ? pub.motivo : null,
      semaforo: sem,
      diasNoAr: observar.diasNoAr ?? null,
      bloqueadoEscalar: true,
      trava: 'SEM_BASE_MINIMA',
    };
  }

  if (origem && destino) {
    const cidO = origem.cidade || cidadeReal(origem.nome);
    const cidD = destino.cidade || cidadeReal(destino.nome);
    return {
      id: `mov-${slug(origem.nome)}-para-${slug(destino.nome)}`,
      tipo: 'mover',
      origem: origem.nome,
      destino: destino.nome,
      valorDia,
      titulo: `Mover R$ ${valorDia}/dia do ${origem.nome} → ${destino.nome}`,
      motivo: [
        `${origem.nome} (${cidO}): R$ ${Number(origem.gasto || 0).toFixed(0)} · ${origem.leads || 0} form.`,
        `${destino.nome} (${cidD}): ${destino.leads} form. · CPL R$ ${destino.cpl != null ? Number(destino.cpl).toFixed(0) : '—'} · base ok (≥${LEADS_MIN_ESCALAR})`,
      ].join('\n'),
      recomendacao: 'Mover verba com base mínima',
      campanha: `${origem.nome} → ${destino.nome}`,
      gasto: origem.gasto ?? 0,
      leads: destino.leads ?? 0,
      cpl: destino.cpl ?? null,
      cidade: cidD,
      semaforo: destino.semaforo || semaforoCampanha(destino),
    };
  }

  if (origem) {
    const cidade = origem.cidade || cidadeReal(origem.nome);
    return {
      id: 'rev-' + slug(origem.nome),
      tipo: 'revisar',
      origem: origem.nome,
      destino: null,
      valorDia: null,
      titulo: `Revisar / cortar ${origem.nome}`,
      motivo: `Cidade: ${cidade}\nR$ ${Number(origem.gasto || 0).toFixed(0)} gastos · ${origem.leads || 0} cadastro(s) de formulário — queimando verba.`,
      recomendacao: 'Revisar verba',
      campanha: origem.nome,
      gasto: origem.gasto ?? 0,
      leads: origem.leads ?? 0,
      cpl: origem.cpl ?? null,
      cidade,
      semaforo: origem.semaforo || semaforoCampanha(origem),
    };
  }

  if (destino) {
    const cidade = destino.cidade || cidadeReal(destino.nome);
    const sem = destino.semaforo || semaforoCampanha(destino);
    return {
      id: 'esc-' + slug(destino.nome),
      tipo: 'escalar',
      origem: null,
      destino: destino.nome,
      valorDia,
      titulo: `Escalar ${destino.nome} (+R$ ${valorDia}/dia)`,
      motivo: [
        `Base: ${destino.leads} leads (≥${LEADS_MIN_ESCALAR})`,
        `Cidade: ${cidade === 'Piçarras' ? 'Fort Myers - Piçarras' : cidade}`,
        `CPL form. R$ ${destino.cpl != null ? Number(destino.cpl).toFixed(0) : '—'} — ${sem.label}`,
      ].join('\n'),
      recomendacao: 'Escalar com base mínima',
      campanha: destino.nome,
      gasto: destino.gasto ?? 0,
      leads: destino.leads ?? 0,
      cpl: destino.cpl ?? null,
      cidade,
      semaforo: sem,
    };
  }

  // Há observação com alerta mesmo se também houver outras coisas
  if (observar) {
    return montaSugestaoPrincipal({
      ...placar,
      decisao: { ...d, escalar: [] },
    }, { valorDia });
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
      : item.tipo === 'observar' ? 'observar'
        : item.tipo === 'revisar' ? 'revisar'
          : item.tipo === 'campanha' ? 'campanha'
            : (item.tipo || '');
  const aj = item.ajuste ? ` — ${item.ajuste}` : '';
  const camp = item.campanha ? ` *${item.campanha}*` : '';
  return `${acao}${alvo ? ` · ${alvo}` : ''}${camp}${aj}`;
}
