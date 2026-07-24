// CRON — 13:00 BRT (Jlle/Casa). Seg–sáb.
// UTC = BRT+3 → 16:00 UTC.
import { agoraBRT } from './_rotina.mjs';
import { disparaRelatorio } from './_disparo.mjs';
import { json } from './_infra.mjs';

export const config = { schedule: '0 16 * * 1-6' };

export async function handler() {
  return json(200, await disparaRelatorio(agoraBRT(), { teste: false }));
}
