// CRON — relatório consolidado pro CEO: 13:30 (dias Casa) e 14:30 (dias Katzer), seg-sáb.
import { agoraBRT } from './_rotina.mjs';
import { disparaRelatorio } from './_disparo.mjs';
import { json } from './_infra.mjs';

export const config = { schedule: '30 16,17 * * 1-6' }; // 13:30 e 14:30 BRT · seg a sáb

export async function handler() {
  const r = await disparaRelatorio(agoraBRT(), { teste: false });
  return json(200, r);
}
