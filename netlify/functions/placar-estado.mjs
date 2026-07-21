// PLACAR-ESTADO — alimenta os dois painéis do Placar (Michel e Gestor).
// GET /api/placar-estado          -> placar (campanhas + decisão do dia) + sugestões + decisões do Michel.
// GET /api/placar-estado?ceo=1    -> mesma coisa, mas EXIGE a senha do Gestor (trava "só pra mim").
import { createHash } from 'node:crypto';
import { agoraBRT, montaSugestoes, listaDecisoes } from './_placar-estado.mjs';
import { lePlacar, leDecisoes } from './_placar-io.mjs';
import { json } from './_infra.mjs';

// Mesma senha do Painel Gestor da rotina (Davi2026@) — guardamos só o HASH.
const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';
function senhaGestorOk(event, params) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

export async function handler(event) {
  const params = event.queryStringParameters || {};

  if (params.ceo && !senhaGestorOk(event, params)) {
    return json(401, { ok: false, precisaSenha: true, erro: 'senha do gestor necessária' });
  }

  const now = agoraBRT();
  const [{ placar, ts }, decisoes] = await Promise.all([
    lePlacar({ preset: 'last_7d' }),
    leDecisoes(now.data),
  ]);

  return json(200, {
    ok: true,
    data: now.data,
    agora: now.hm,
    ultimaLeitura: ts ? agoraBRT(new Date(ts)).hm : now.hm,
    placar,                        // { campanhas, totalGasto, totalLeads, cplMedio, decisao }
    sugestoes: montaSugestoes(placar),
    decisoes: listaDecisoes(decisoes),
  });
}
