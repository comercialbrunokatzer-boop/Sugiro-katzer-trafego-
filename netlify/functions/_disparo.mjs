// Lógica de disparo (cron + teste): Rotina + Placar no mesmo ritmo.
import { pontualidade, agoraBRT, min2hm, previstoMin, TAREFAS } from './_rotina.mjs';
import { leEstado, salvaEstado, enviaWhats, enviaEmail } from './_infra.mjs';
import { resumoWhats, emailHTML } from './_relatorio.mjs';
import { leDecisoes, lePlacar } from './_placar-io.mjs';
import { listaDecisoes, montaSugestaoPrincipal, rotuloDecisao } from './_placar-estado.mjs';

function agendaLinhas(estado) {
  return TAREFAS
    .map((t) => `🕘 *${min2hm(previstoMin(t, estado.modo, estado.inicioMin))}* · ${t.nome}`)
    .join('\n');
}

/** 07:45 — Rotina + Placar no mesmo horário (Michel e cópia pro Bruno). */
export async function disparaCard(now = agoraBRT()) {
  if (now.dow === 0) return { skip: 'domingo (folga)' };
  const url = (process.env.SITE_URL || 'https://rotina-produtiva-michel.netlify.app').replace(/\/+$/, '');

  const estado = await leEstado(now.data);
  const modoTxt = estado.modo === 'katzer' ? '🏢 Katzer' : '🏠 Jlle/Casa';
  const inicioTxt = estado.inicioMin != null ? min2hm(estado.inicioMin) : (estado.modo === 'katzer' ? '08:45' : '08:00');
  const agenda = agendaLinhas(estado);

  const michelMsg = [
    `☀️ *Bom dia, Michel!* — ${modoTxt} · início ${inicioTxt}`,
    '',
    agenda,
    '',
    `Rotina do dia 👉 ${url}/painel-michel`,
    `(Campanhas: abra o item na rotina → decisão do quadradinho)`,
  ].join('\n');
  const wM = await enviaWhats(process.env.WHATSAPP_MICHEL, michelMsg);

  const ceoMsg = [
    `🗓️ *Dia do Michel* (${modoTxt} · início ${inicioTxt})`,
    '',
    agenda,
    '',
    `Painel ao vivo (Rotina + Campanhas): ${url}/painel-gestor`,
  ].join('\n');
  const wC = await enviaWhats(process.env.WHATSAPP_CEO, ceoMsg);

  return { michel: wM.enviado, ceo: wC.enviado, data: now.data, hora: now.hm };
}

/**
 * Relatório da tarde pro Bruno (WhatsApp + e-mail):
 * - Jlle/Casa: a partir de 13:00
 * - Katzer: a partir de 14:30
 * Inclui % da Rotina + decisões/métricas/alertas do Placar.
 */
export async function disparaRelatorio(now, { teste = false } = {}) {
  if (now.dow === 0) return { skip: 'domingo (folga)' };
  const estado = await leEstado(now.data);
  if (estado.relatorioEnviado && !teste) return { skip: `já enviado ${estado.relatorioEnviado}` };

  // 13:00 BRT = 780 min · 14:30 = 870 min
  const janelaKatzer = now.min >= 14 * 60 + 30;
  const janelaJlle = now.min >= 13 * 60;
  const ehKatzer = estado.modo === 'katzer';
  const deve = teste || janelaKatzer || (!ehKatzer && janelaJlle);
  if (!deve) {
    return { skip: ehKatzer ? 'modo Katzer espera 14:30' : 'modo Jlle espera 13:00' };
  }

  const P = pontualidade(estado, now.min);
  const modoTxt = ehKatzer ? '🏢 Katzer' : '🏠 Jlle/Casa';

  // Placar do dia (decisões + métricas + alertas)
  let campanhasExtra = { decisoes: [], placar: null, sugestao: null, alertas: [] };
  try {
    const [{ placar }, bruto] = await Promise.all([
      lePlacar({ preset: 'last_7d' }),
      leDecisoes(now.data),
    ]);
    const decisoes = listaDecisoes(bruto);
    const sugestao = montaSugestaoPrincipal(placar);
    const alertas = [];
    (placar.decisao?.revisar || []).forEach((c) => alertas.push(`🔴 revisar ${c.nome} (${Number(c.gasto || 0).toFixed(0)} · ${c.leads || 0} lead)`));
    (placar.decisao?.escalar || []).forEach((c) => alertas.push(`🟢 escalar ${c.nome} (CPL ${c.cpl != null ? Number(c.cpl).toFixed(0) : '—'})`));
    campanhasExtra = { decisoes, placar, sugestao, alertas };
  } catch { /* placar opcional se blobs/Meta falhar */ }

  const w = await enviaWhats(
    process.env.WHATSAPP_CEO,
    resumoWhats(estado, now, campanhasExtra),
  );
  const e = await enviaEmail(
    process.env.EMAIL_CEO,
    `Relatório · Michel — ${P.pct}% · ${modoTxt}`,
    emailHTML(estado, now, campanhasExtra),
  );

  if (!teste) { estado.relatorioEnviado = now.hm; await salvaEstado(estado); }
  return {
    pct: P.pct,
    decisoes: campanhasExtra.decisoes.length,
    whats: w,
    email: e,
    teste,
  };
}

// re-export helper for tests
export { rotuloDecisao };
