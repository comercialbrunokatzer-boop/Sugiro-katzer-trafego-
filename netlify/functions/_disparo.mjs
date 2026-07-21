// Lógica de disparo do relatório (compartilhada entre o cron e o endpoint de teste).
import { pontualidade, agoraBRT } from './_rotina.mjs';
import { leEstado, salvaEstado, enviaWhats, enviaEmail } from './_infra.mjs';
import { resumoWhats, emailHTML } from './_relatorio.mjs';

/** Manda o card da Rotina pro WhatsApp do Michel (usado pelo cron das 07:45 e pelo teste). */
export async function disparaCard(now = agoraBRT()) {
  if (now.dow === 0) return { skip: 'domingo (folga)' };
  const michel = process.env.WHATSAPP_MICHEL;
  const url = (process.env.SITE_URL || 'https://rotina-produtiva-michel.netlify.app').replace(/\/+$/, '');
  const msg = [
    '☀️ *Bom dia, Michel!*',
    '',
    'Abre a Rotina Produtiva de hoje e vai tocando *Feito* em cada tarefa:',
    `${url}/painel-michel`,
    '',
    'No topo, escolhe o modo do dia: 🏠 *Casa* (1ª tarefa 08:00) ou 🏢 *Katzer* (08:45).',
  ].join('\n');
  const w = await enviaWhats(michel, msg);
  return { enviado: w.enviado, status: w.status || w.motivo, data: now.data, hora: now.hm };
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
