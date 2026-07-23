// ESTADO — Rotina (Michel e CEO) + RESUMO enxuto de Campanhas (só porta de entrada).
// GET /api/estado        → tarefas + obs + modo + campanhas{resumo} (SEM %)
// GET /api/estado?ceo=1  → + pontualidade (% + saldo)
//
// Painel completo de Campanhas = OUTRO app: /campanhas · /ranking-campanhas
// Na Rotina entra SÓ resumo + link — nunca o painel inteiro.
import { createHash } from 'node:crypto';
import { agoraBRT, pontualidade, TAREFAS, previstoMin, min2hm } from './_rotina.mjs';
import { leEstado, json } from './_infra.mjs';
import { lePlacar } from './_placar-io.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';
function senhaGestorOk(event, params) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

/** Resumo mínimo pra card na Rotina (porta de entrada → /campanhas). */
async function resumoCampanhas() {
  try {
    const { placar, meta } = await lePlacar({ preset: 'last_7d' });
    const confiavel = meta?.confiavel !== false && meta?.status === 'ok';
    if (!confiavel) {
      return {
        confiavel: false,
        resumo: meta?.mensagemPainel || meta?.mensagem || 'Dados da Meta indisponíveis.',
        metaMensagem: meta?.mensagemPainel || meta?.mensagem || null,
        n: null, totalGasto: null, totalLeads: null, cplMedio: null,
        link: '/campanhas',
      };
    }
    const n = (placar.campanhas || []).length;
    const totalGasto = placar.totalGasto ?? 0;
    const totalLeads = placar.totalLeads ?? 0;
    const cplMedio = placar.cplMedio;
    return {
      confiavel: true,
      n,
      totalGasto,
      totalLeads,
      cplMedio,
      resumo: `${n} camp. · R$ ${Number(totalGasto).toFixed(0)} · ${totalLeads} form.`,
      metaMensagem: null,
      link: '/campanhas',
    };
  } catch {
    return {
      confiavel: false,
      resumo: 'Dados da Meta indisponíveis.',
      metaMensagem: 'Dados da Meta indisponíveis.',
      n: null, totalGasto: null, totalLeads: null, cplMedio: null,
      link: '/campanhas',
    };
  }
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

  const campanhas = await resumoCampanhas();

  const base = {
    ok: true, data: now.data, agora: now.hm, modo: estado.modo,
    domingo, tarefas, obs: estado.obs,
    campanhas,
  };

  if (params.ceo) {
    if (!senhaGestorOk(event, params)) {
      return json(401, { ok: false, precisaSenha: true, erro: 'senha do gestor necessária' });
    }
    base.pontualidade = pontualidade(estado, now.min, { domingo, fimDiaMin });
  }
  return json(200, base);
}
