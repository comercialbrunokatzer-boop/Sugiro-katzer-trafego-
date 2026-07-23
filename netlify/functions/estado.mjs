// ESTADO — só ROTINA (Michel e CEO).
// GET /api/estado        → tarefas + obs + modo (SEM %; SEM campanhas)
// GET /api/estado?ceo=1  → + pontualidade (% + saldo)
//
// Painel de Campanhas é OUTRO produto: /campanhas · /ranking-campanhas · /api/ranking-campanhas
import { createHash } from 'node:crypto';
import { agoraBRT, pontualidade, TAREFAS, previstoMin, min2hm } from './_rotina.mjs';
import { leEstado, json } from './_infra.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';
function senhaGestorOk(event, params) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

export async function handler(event) {
  const params = event.queryStringParameters || {};
  const now = agoraBRT();
  const estado = await leEstado(now.data);
  const domingo = now.dow === 0;
  const fimDiaMin = estado.modo === 'katzer' ? (14 * 60 + 30) : (13 * 60);

  const tarefas = TAREFAS.map((t) => {
    const prev = previstoMin(t, estado.modo, estado.inicioMin);
    const reg = estado.tarefas[t.id];
    const vencida = !domingo && now.min > prev && !(reg && reg.min != null);
    let estadoTarefa = 'aguardando';
    if (domingo) estadoTarefa = 'bloqueado';
    else if (reg && reg.min != null) estadoTarefa = 'concluido';
    else if (vencida && now.min >= fimDiaMin) estadoTarefa = 'nao_realizado';
    else if (vencida) estadoTarefa = 'atrasado';
    else if (reg && reg.iniciado) estadoTarefa = 'em_andamento';
    return {
      id: t.id, nome: t.nome, previsto: min2hm(prev),
      feito: !!(reg && reg.min != null), hora: reg ? reg.hora : null, nota: reg ? reg.nota : '',
      atrasoAberto: vencida ? now.min - prev : 0,
      estado: estadoTarefa,
    };
  });

  const base = {
    ok: true, data: now.data, agora: now.hm, modo: estado.modo,
    domingo, tarefas, obs: estado.obs,
  };

  if (params.ceo) {
    if (!senhaGestorOk(event, params)) {
      return json(401, { ok: false, precisaSenha: true, erro: 'senha do gestor necessária' });
    }
    base.pontualidade = pontualidade(estado, now.min, { domingo, fimDiaMin });
  }
  return json(200, base);
}
