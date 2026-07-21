// CRON — manda o card da Rotina pro WhatsApp do Michel às 07:45 BRT (seg-sáb).
import { agoraBRT } from './_rotina.mjs';
import { disparaCard } from './_disparo.mjs';
import { json } from './_infra.mjs';

export const config = { schedule: '45 10 * * 1-6' }; // 07:45 BRT (UTC-3) · seg a sáb

export async function handler() {
  return json(200, await disparaCard(agoraBRT()));
}
