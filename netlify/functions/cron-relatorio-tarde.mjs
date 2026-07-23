// CRON — 14:30 BRT (Katzer + catch-all). Seg–sáb.
// UTC = BRT+3 → 17:30 UTC.
import { agoraBRT } from './_rotina.mjs';
import { disparaRelatorio } from './_disparo.mjs';
import { json } from './_infra.mjs';

export const config = { schedule: '30 17 * * 1-6' };

export async function handler() {
  return json(200, await disparaRelatorio(agoraBRT(), { teste: false }));
}
