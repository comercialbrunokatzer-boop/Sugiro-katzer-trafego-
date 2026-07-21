// ESTADO — devolve o estado do dia pra os painéis (Michel e CEO).
// GET /api/estado            -> visão do Michel (tarefas + obs + modo; SEM %).
// GET /api/estado?ceo=1      -> visão do CEO (inclui pontualidade: % + saldo + atrasos).
import { agoraBRT, pontualidade, TAREFAS, previstoMin, min2hm } from './_rotina.mjs';
import { leEstado, json } from './_infra.mjs';

export async function handler(event) {
  const now = agoraBRT();
  const estado = await leEstado(now.data);
  const params = event.queryStringParameters || {};

  // Lista de tarefas com horário previsto (no modo do dia) + status — comum aos dois painéis.
  const tarefas = TAREFAS.map((t) => {
    const reg = estado.tarefas[t.id];
    const prev = previstoMin(t, estado.modo);
    const vencida = !reg && now.min > prev;
    return {
      id: t.id, nome: t.nome, previsto: min2hm(prev),
      feito: !!reg, hora: reg ? reg.hora : null, nota: reg ? reg.nota : '',
      atrasoAberto: vencida ? now.min - prev : 0,
    };
  });

  const base = {
    ok: true, data: now.data, agora: now.hm, modo: estado.modo,
    domingo: now.dow === 0, tarefas, obs: estado.obs,
  };

  if (params.ceo) {
    base.pontualidade = pontualidade(estado, now.min); // { pct, saldoMin, linhas }
  }
  return json(200, base);
}
