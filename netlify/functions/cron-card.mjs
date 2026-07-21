// CRON — manda o card da Rotina pro WhatsApp do Michel às 07:45 BRT (seg-sáb).
// Testável na mão: GET /.netlify/functions/cron-card?test=1
import { agoraBRT } from './_rotina.mjs';
import { enviaWhats, json } from './_infra.mjs';

export const config = { schedule: '45 10 * * 1-6' }; // 07:45 BRT (UTC-3) · seg a sáb

export async function handler(event) {
  const now = agoraBRT();
  if (now.dow === 0) return json(200, { skip: 'domingo (folga)' });
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
  return json(200, { enviado: w.enviado, status: w.status || w.motivo, data: now.data, hora: now.hm });
}
