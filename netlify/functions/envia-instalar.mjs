// ENVIA-INSTALAR — manda pro WhatsApp do CEO o link do passo a passo de instalação,
// já escrito pra ele repassar pro Michel. Não toca no Michel direto.
// Protegido por ?key=<WHATSAPP_CEO>. GET /api/envia-instalar?key=<numero do CEO>
import { enviaWhats, json } from './_infra.mjs';

const soDig = (s) => String(s || '').replace(/\D+/g, '');

export async function handler(event) {
  const key = soDig((event.queryStringParameters || {}).key);
  const ceo = soDig(process.env.WHATSAPP_CEO);
  if (!ceo || key !== ceo) return json(403, { ok: false, erro: 'passe ?key=<numero do CEO>' });

  const url = (process.env.SITE_URL || 'https://rotina-produtiva-michel.netlify.app').replace(/\/+$/, '');
  const msg = [
    '📲 *Michel — deixa a Rotina como app (1 vez, 10 seg):*',
    '',
    `Passo a passo aqui 👉 ${url}/como-instalar`,
    '',
    'Depois é só tocar o ícone *Rotina Katzer* todo dia e marcar *Feito*. Sem link.',
  ].join('\n');

  const w = await enviaWhats(process.env.WHATSAPP_CEO, msg);
  return json(200, { ok: true, enviado: w.enviado, status: w.status, link: `${url}/como-instalar` });
}
