// Lembrete de decisões de campanha do dia — pro Gestor (e-mail / WhatsApp / painel).
// Funções puras aqui; I/O do Placar só em leDecisoesCampanha (dynamic import)
// pra não carregar @netlify/blobs no import dos testes.

import { listaDecisoes, rotuloDecisao } from './_placar-estado.mjs';

/** Lista pura das decisões (mais recente primeiro). */
export function listaDecisoesCampanha(decisoes = {}) {
  return listaDecisoes(decisoes);
}

/** Rótulo curto pra WhatsApp / UI. */
export function rotuloDecisaoCampanha(item = {}) {
  const base = rotuloDecisao(item);
  return item.hora ? `${base} · ${item.hora}` : base;
}

/** Bloco WhatsApp: lembrete de mudanças/decisões de campanha. */
export function blocoCampanhasWhats(itens = []) {
  if (!itens.length) {
    return '📣 *Campanhas:* nenhuma decisão registrada hoje no Placar.';
  }
  const linhas = itens.map((i) => `• ${rotuloDecisaoCampanha(i)}`);
  return ['📣 *Campanhas / decisões do Michel hoje:*', ...linhas].join('\n');
}

/** Bloco HTML pro e-mail do Gestor. */
export function blocoCampanhasEmail(itens = []) {
  const corpo = !itens.length
    ? `<div style="color:#9a9283;font-size:13px;margin-top:6px">Nenhuma decisão de campanha registrada hoje no Placar.</div>`
    : itens.map((i) => {
      const cor = i.decisao === 'aplicar' ? '#74b892'
        : i.decisao === 'ajustar' || i.decisao === 'aumentar' ? '#c9a24a' : '#9a9283';
      return `<div style="color:#ece5d6;font-size:13px;margin-top:6px"><b style="color:${cor}">${rotuloDecisaoCampanha(i)}</b></div>`;
    }).join('');
  return `
    <div style="margin:16px 22px 0;border:1px solid #8a6c2e;border-radius:10px;background:rgba(201,162,74,.05);padding:12px 14px">
      <div style="color:#c9a24a;font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700">📣 Campanhas — lembrete do dia</div>
      <div style="color:#9a9283;font-size:12px;margin-top:4px">O que o Michel tocou no Placar (modo seguro: ele aplica na Meta na mão).</div>
      ${corpo}
    </div>`;
}

/** Lê decisões do dia no Blobs do Placar (vazio se ainda não houver). */
export async function leDecisoesCampanha(data) {
  try {
    const { leDecisoes } = await import('./_placar-io.mjs');
    const atual = await leDecisoes(data);
    return listaDecisoesCampanha(atual);
  } catch {
    return [];
  }
}
