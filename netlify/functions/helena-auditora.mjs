// Helena Auditora — cron a cada 15 min (Netlify Scheduled Functions).
// Também: GET/POST /api/helena-auditora (manual).
import { json } from './_infra.mjs';
import { leLeadsHoje, salvaLeadsHoje } from './_cacador-io.mjs';
import { rodaCicloAuditora } from './_helena-auditora.mjs';

export async function handler(event) {
  const isSchedule = event.httpMethod === undefined
    || event.headers?.['x-netlify-event'] === 'schedule'
    || (event.queryStringParameters || {}).cron === '1';

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body: '',
    };
  }

  try {
    const { leads } = await leLeadsHoje();
    let forcar = !!(event.queryStringParameters || {}).forcar;
    try {
      if (event.body) forcar = forcar || !!JSON.parse(event.body).forcar;
    } catch { /* ignore */ }
    const ciclo = await rodaCicloAuditora(leads, {
      forcar: !!forcar,
      avisarVermelhos: true,
    });
    await salvaLeadsHoje(ciclo.leads, { fonte: 'helena-auditora' });
    return json(200, {
      ok: true,
      cron: !!isSchedule,
      processados: ciclo.processados,
      vermelhos: ciclo.vermelhos,
      resumo: ciclo.resumo,
      classificacoes: ciclo.classificacoes,
      whats: ciclo.whats,
    });
  } catch (e) {
    return json(500, { ok: false, erro: String((e && e.message) || e) });
  }
}
