// Lógica de disparo do relatório (compartilhada entre o cron e o endpoint de teste).
import { pontualidade, agoraBRT, min2hm, previstoMin, TAREFAS } from './_rotina.mjs';
import { leEstado, salvaEstado, enviaWhats, enviaEmail } from './_infra.mjs';
import { resumoWhats, emailHTML } from './_relatorio.mjs';

/** Agenda do dia já montada (quadradinho pronto): cada tarefa com o horário previsto. */
function agendaLinhas(estado) {
  return TAREFAS
    .map((t) => `🕘 *${min2hm(previstoMin(t, estado.modo, estado.inicioMin))}* · ${t.nome}`)
    .join('\n');
}

/** Manda o card da Rotina pro Michel E uma cópia pro CEO acompanhar (07:45 e teste). */
export async function disparaCard(now = agoraBRT()) {
  if (now.dow === 0) return { skip: 'domingo (folga)' };
  const url = (process.env.SITE_URL || 'https://rotina-produtiva-michel.netlify.app').replace(/\/+$/, '');

  const estado = await leEstado(now.data);
  const modoTxt = estado.modo === 'katzer' ? '🏢 Katzer' : '🏠 Casa';
  const inicioTxt = estado.inicioMin != null ? min2hm(estado.inicioMin) : (estado.modo === 'katzer' ? '08:45' : '08:00');
  const agenda = agendaLinhas(estado);

  // 1) Card pro Michel — agenda pronta + link pra tocar "Feito".
  const michelMsg = [
    `☀️ *Bom dia, Michel!* — ${modoTxt} · início ${inicioTxt}`,
    '',
    agenda,
    '',
    `Toca *Feito* em cada uma aqui 👉 ${url}/painel-michel`,
  ].join('\n');
  const wM = await enviaWhats(process.env.WHATSAPP_MICHEL, michelMsg);

  // 2) Cópia pro CEO — o quadradinho pronto (mesma agenda) + link do ao vivo no rodapé.
  const ceoMsg = [
    `🗓️ *Rotina do Michel — hoje* (${modoTxt} · início ${inicioTxt})`,
    '',
    agenda,
    '',
    `Ao vivo (o % é seu): ${url}/painel-gestor`,
  ].join('\n');
  const wC = await enviaWhats(process.env.WHATSAPP_CEO, ceoMsg);

  return { michel: wM.enviado, ceo: wC.enviado, data: now.data, hora: now.hm };
}

/**
 * Dispara o relatório do dia pro CEO (WhatsApp sempre; e-mail se houver Resend).
 * Regras: pula domingo; idempotente (1x/dia, exceto teste); 13:30 dias Casa, 14:30 Katzer
 * (+ catch-all às 14:30 do que faltou). teste=true ignora janela/idempotência e não marca.
 */
export async function disparaRelatorio(now, { teste = false } = {}) {
  if (now.dow === 0) return { skip: 'domingo (folga)' };
  const estado = await leEstado(now.data);
  if (estado.relatorioEnviado && !teste) return { skip: `já enviado ${estado.relatorioEnviado}` };

  const janelaTarde = now.min >= 14 * 60;
  const deve = teste || janelaTarde || (!janelaTarde && estado.modo === 'casa');
  if (!deve) return { skip: `janela cedo · modo ${estado.modo} espera 14:30` };

  const P = pontualidade(estado, now.min);
  const modoTxt = estado.modo === 'katzer' ? '🏢 Katzer' : '🏠 Casa';
  const w = await enviaWhats(process.env.WHATSAPP_CEO, resumoWhats(estado, now));
  const e = await enviaEmail(process.env.EMAIL_CEO, `Relatório da manhã · Michel — ${P.pct}% · ${modoTxt}`, emailHTML(estado, now));

  if (!teste) { estado.relatorioEnviado = now.hm; await salvaEstado(estado); }
  return { pct: P.pct, whats: w, email: e, teste };
}
