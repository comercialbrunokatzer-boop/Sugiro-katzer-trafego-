// CRON — 16:00 BRT relatório da tarde (Bruno só olha; opcional WA).
// UTC = BRT+3 → 19:00 UTC. Seg–sáb.
import { agoraBRT } from './_rotina.mjs';
import { disparaRelatorio } from './_disparo.mjs';
import { json } from './_infra.mjs';

export const config = { schedule: '0 19 * * 1-6' };

export async function handler() {
  return json(200, await disparaRelatorio(agoraBRT(), { teste: false }));
}
