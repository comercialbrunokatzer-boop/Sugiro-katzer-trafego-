// Lógica de disparo (cron + teste): só ROTINA.
// Campanhas = produto separado (/campanhas).
import { pontualidade, agoraBRT, min2hm, previstoMin, TAREFAS } from './_rotina.mjs';
import { leEstado, salvaEstado, enviaWhats, enviaEmail } from './_infra.mjs';
import { resumoWhats, emailHTML } from './_relatorio.mjs';

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
    `Rotina 👉 ${url}/placar-michel`,
  ].join('\n');
  const wM = await enviaWhats(process.env.WHATSAPP_MICHEL, michelMsg);

  const ceoMsg = [
    `🗓️ *Dia do Michel* (${modoTxt} · início ${inicioTxt})`,
    '',
    agenda,
    '',
    `Rotina (ao vivo): ${url}/placar-gestor`,
  ].join('\n');
  const wC = await enviaWhats(process.env.WHATSAPP_CEO, ceoMsg);

  return { michel: wM.enviado, ceo: wC.enviado, data: now.data, hora: now.hm };
}

/**
 * Relatório da tarde pro Bruno (WhatsApp + e-mail) — só ROTINA.
 * Campanhas = outro produto (/campanhas).
 */
export async function disparaRelatorio(now, { teste = false } = {}) {
  if (now.dow === 0) return { skip: 'domingo (folga)' };
  const estado = await leEstado(now.data);
  if (estado.relatorioEnviado && !teste) return { skip: `já enviado ${estado.relatorioEnviado}` };

  const janelaKatzer = now.min >= 14 * 60 + 30;
  const janelaJlle = now.min >= 13 * 60;
  const ehKatzer = estado.modo === 'katzer';
  const deve = teste || janelaKatzer || (!ehKatzer && janelaJlle);
  if (!deve) {
    return { skip: ehKatzer ? 'modo Katzer espera 14:30' : 'modo Jlle espera 13:00' };
  }

  const P = pontualidade(estado, now.min);
  const modoTxt = ehKatzer ? '🏢 Katzer' : '🏠 Jlle/Casa';
  const campanhasExtra = { decisoes: [], placar: null, sugestao: null, alertas: [] };

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
    decisoes: 0,
    whats: w,
    email: e,
    teste,
  };
}

// re-export helper for tests
export { rotuloDecisao };
