// TESTE/GATILHO MANUAL do card — manda a agenda AGORA pro WhatsApp do Michel.
// Protegido por ?key=<WHATSAPP_CEO>. GET /api/card-teste?key=<numero do CEO>
import { agoraBRT } from './_rotina.mjs';
import { disparaCard } from './_disparo.mjs';
import { json } from './_infra.mjs';

const soDig = (s) => String(s || '').replace(/\D+/g, '');

export async function handler(event) {
  const key = soDig((event.queryStringParameters || {}).key);
  const ceo = soDig(process.env.WHATSAPP_CEO);
  if (!ceo || key !== ceo) return json(403, { ok: false, erro: 'passe ?key=<numero do CEO>' });
  const r = await disparaCard(agoraBRT());
  return json(200, { ok: true, ...r });
}
