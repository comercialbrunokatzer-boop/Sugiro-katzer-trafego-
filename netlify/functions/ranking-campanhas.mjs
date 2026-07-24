// GET /api/ranking-campanhas
// Ranking por CPL de formulário (7d operacional + 30d histórico).
// Público de leitura (sem token na resposta). Nunca expõe META_SYSTEM_TOKEN.
import { montaPayloadRanking } from './_ranking-io.mjs';
import { json } from './_infra.mjs';

export async function handler(event) {
  const q = event.queryStringParameters || {};
  try {
    const payload = await montaPayloadRanking({
      conferenciaBrSc: q.sem_conf !== '1',
    });
    return json(200, payload);
  } catch (e) {
    return json(502, {
      ok: false,
      metricaPrincipal: 'lead_formulario',
      erro: 'Dados da Meta indisponíveis.',
      detalhe: String((e && e.message) || e).slice(0, 200),
    });
  }
}
