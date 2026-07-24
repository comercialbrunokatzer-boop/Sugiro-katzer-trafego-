// GET /api/auditoria → métricas Parte 2 (acerto, vermelhos, por fonte)
// POST /api/auditoria → dispara ciclo Helena Auditora (manual)
import { json } from './_infra.mjs';
import { leLeadsHoje, salvaLeadsHoje } from './_cacador-io.mjs';
import { payloadCacador } from './_cacador.mjs';
import { resumoAuditoria } from './_auditoria-abcd.mjs';
import { rodaCicloAuditora } from './_helena-auditora.mjs';

export async function handler(event) {
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

  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { /* */ }
    try {
      const { leads } = await leLeadsHoje();
      const ciclo = await rodaCicloAuditora(leads, {
        forcar: !!body.forcar,
        avisarVermelhos: body.avisarVermelhos !== false,
      });
      await salvaLeadsHoje(ciclo.leads, { fonte: 'helena-auditora' });
      return json(200, {
        ok: true,
        processados: ciclo.processados,
        vermelhos: ciclo.vermelhos,
        resumo: ciclo.resumo,
        classificacoes: ciclo.classificacoes,
        whats: ciclo.whats,
        ...payloadCacador(ciclo.leads),
      });
    } catch (e) {
      return json(500, { ok: false, erro: String((e && e.message) || e) });
    }
  }

  if (event.httpMethod !== 'GET') return json(405, { ok: false, erro: 'use GET ou POST' });

  try {
    const { leads, data, fonte } = await leLeadsHoje();
    const resumo = resumoAuditoria(leads);
    return json(200, {
      ok: true,
      data,
      fonteLeads: fonte,
      ...resumo,
      dica: 'Michel olha VERMELHOS + Garimpo 0/5+. Resto: Helena Auditora.',
    });
  } catch (e) {
    return json(500, { ok: false, erro: String((e && e.message) || e) });
  }
}
