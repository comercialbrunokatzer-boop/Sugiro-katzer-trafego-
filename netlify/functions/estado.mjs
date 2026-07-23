// ESTADO — devolve o estado do dia pra os painéis (Michel e CEO).
// GET /api/estado            -> visão do Michel (tarefas + obs + modo; SEM %).
// GET /api/estado?ceo=1      -> visão do CEO (inclui pontualidade: % + saldo + atrasos)
//                              + snapshot de Campanhas (Meta + decisões do quadradinho).
//
// O "Placar ao vivo" do Bruno É este painel (/painel-gestor). Campanhas é item da rotina;
// o quadradinho (/placar-michel) é ferramenta aberta A PARTIR de Campanhas — não outro app.
import { createHash } from 'node:crypto';
import { agoraBRT, pontualidade, TAREFAS, previstoMin, min2hm } from './_rotina.mjs';
import { leEstado, json } from './_infra.mjs';
import { lePlacar, leDecisoes } from './_placar-io.mjs';
import { listaDecisoes, montaSugestaoPrincipal, rotuloDecisao } from './_placar-estado.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';
function senhaGestorOk(event, params) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

/** Snapshot enxuto de campanhas pra embutir no Painel do Gestor / item Campanhas. */
async function snapshotCampanhas(data) {
  try {
    const [{ placar }, bruto] = await Promise.all([
      lePlacar({ preset: 'last_7d' }),
      leDecisoes(data),
    ]);
    const decisoes = listaDecisoes(bruto);
    const sugestao = montaSugestaoPrincipal(placar);
    const alertas = [];
    (placar.decisao?.revisar || []).forEach((c) => {
      alertas.push(`revisar ${c.nome} (R$ ${Number(c.gasto || 0).toFixed(0)} · ${c.leads || 0} lead)`);
    });
    (placar.decisao?.escalar || []).slice(0, 3).forEach((c) => {
      alertas.push(`escalar ${c.nome} (CPL ${c.cpl != null ? `R$ ${Number(c.cpl).toFixed(0)}` : '—'})`);
    });
    return {
      ok: true,
      n: (placar.campanhas || []).length,
      totalGasto: placar.totalGasto ?? 0,
      totalLeads: placar.totalLeads ?? 0,
      cplMedio: placar.cplMedio,
      top: (placar.campanhas || []).slice(0, 3).map((c) => ({
        nome: c.nome, gasto: c.gasto, leads: c.leads, cpl: c.cpl,
      })),
      sugestao,
      decisoes: decisoes.map((d) => ({
        id: d.id, campanha: d.campanha, decisao: d.decisao, ajuste: d.ajuste, hora: d.hora,
        rotulo: rotuloDecisao(d),
      })),
      alertas,
      pendenteAplicar: decisoes.length === 0,
      aplicadoNaMeta: false, // modo seguro — Michel aplica na mão; ainda sem verificação API
    };
  } catch {
    return { ok: false, n: 0, decisoes: [], alertas: [], pendenteAplicar: true, aplicadoNaMeta: false };
  }
}

export async function handler(event) {
  const now = agoraBRT();
  const estado = await leEstado(now.data);
  const params = event.queryStringParameters || {};
  const domingo = now.dow === 0;
  const fimDiaMin = estado.modo === 'katzer' ? 14 * 60 + 30 : 13 * 60;

  const tarefas = TAREFAS.map((t) => {
    const reg = estado.tarefas[t.id];
    const prev = previstoMin(t, estado.modo, estado.inicioMin);
    const vencida = !reg && now.min > prev;
    let estadoTarefa = 'aguardando';
    if (domingo) estadoTarefa = 'bloqueado';
    else if (reg && reg.min != null) estadoTarefa = (reg.min - prev) > 0 ? 'atrasado' : 'concluido';
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

  // Campanhas: se já há decisões no quadradinho e ainda não marcou Feito → em andamento
  const camp = await snapshotCampanhas(now.data);
  const campanhasIdx = tarefas.findIndex((t) => t.id === 'campanhas');
  if (campanhasIdx >= 0 && !tarefas[campanhasIdx].feito && (camp.decisoes || []).length > 0 && !domingo) {
    tarefas[campanhasIdx].estado = 'em_andamento';
  }

  const base = {
    ok: true, data: now.data, agora: now.hm, modo: estado.modo,
    domingo, tarefas, obs: estado.obs,
    campanhas: {
      n: camp.n,
      totalGasto: camp.totalGasto,
      totalLeads: camp.totalLeads,
      cplMedio: camp.cplMedio,
      decisoes: camp.decisoes,
      pendenteAplicar: camp.pendenteAplicar,
      // Michel só precisa do resumo + link; métricas detalhadas no gestor
      resumo: camp.ok
        ? `${camp.n} camp. · R$ ${Number(camp.totalGasto || 0).toFixed(0)} · ${camp.totalLeads || 0} leads`
        : 'Meta indisponível',
    },
  };

  if (params.ceo) {
    if (!senhaGestorOk(event, params)) {
      return json(401, { ok: false, precisaSenha: true, erro: 'senha do gestor necessária' });
    }
    const P = pontualidade(estado, now.min, { domingo, fimDiaMin });
    // Alinha estado da linha Campanhas com decisões
    const linhaCamp = P.linhas.find((l) => l.id === 'campanhas');
    if (linhaCamp && !linhaCamp.feito && (camp.decisoes || []).length > 0 && !domingo) {
      linhaCamp.estado = 'em_andamento';
    }
    base.pontualidade = P;
    base.campanhas = camp; // gestor recebe snapshot completo
  }
  return json(200, base);
}
