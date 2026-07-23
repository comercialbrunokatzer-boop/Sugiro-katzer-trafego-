// ESTADO — devolve o estado do dia pra os painéis (Michel e CEO).
// GET /api/estado            -> visão do Michel (tarefas + obs + modo; SEM %).
// GET /api/estado?ceo=1      -> visão do CEO (inclui pontualidade: % + saldo + atrasos)
//                              + snapshot de Campanhas (Meta + decisões do quadradinho).
//
// O Placar do Michel (/placar-michel) e o Placar do Gestor (/placar-gestor)
// leem a MESMA base. O quadradinho (/campanhas-decisao) é ferramenta de Campanhas.
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
    const [{ placar, meta, ts }, bruto] = await Promise.all([
      lePlacar({ preset: 'last_7d' }),
      leDecisoes(data),
    ]);
    const decisoes = listaDecisoes(bruto);
    const confiavel = meta?.confiavel !== false;
    const sugestao = (confiavel && meta?.status === 'ok') ? montaSugestaoPrincipal(placar) : null;
    const alertas = [];
    if (confiavel) {
      (placar.decisao?.revisar || []).forEach((c) => {
        alertas.push(`revisar ${c.nome} (R$ ${Number(c.gasto || 0).toFixed(0)} · ${c.leads || 0} lead)`);
      });
      (placar.decisao?.escalar || []).slice(0, 3).forEach((c) => {
        alertas.push(`escalar ${c.nome} (CPL ${c.cpl != null ? `R$ ${Number(c.cpl).toFixed(0)}` : '—'})`);
      });
    } else if (meta?.mensagemPainel) {
      alertas.push(meta.mensagemPainel);
    }
    const n = (placar.campanhas || []).length;
    return {
      ok: confiavel,
      confiavel,
      metaStatus: meta?.status || 'ok',
      metaMensagem: meta?.mensagemPainel || null,
      n: confiavel ? n : null,
      totalGasto: confiavel ? (placar.totalGasto ?? 0) : null,
      totalLeads: confiavel ? (placar.totalLeads ?? 0) : null,
      cplMedio: confiavel ? placar.cplMedio : null,
      top: confiavel ? (placar.campanhas || []).slice(0, 3).map((c) => ({
        nome: c.nome, gasto: c.gasto, leads: c.leads, cpl: c.cpl,
      })) : [],
      sugestao,
      decisoes: decisoes.map((d) => ({
        id: d.id, campanha: d.campanha, decisao: d.decisao, ajuste: d.ajuste, hora: d.hora,
        rotulo: rotuloDecisao(d),
      })),
      alertas,
      pendenteAplicar: decisoes.length === 0,
      aplicadoNaMeta: false,
      ultimaLeitura: ts || null,
      resumo: !confiavel
        ? (meta?.mensagemPainel || 'Dados da Meta indisponíveis')
        : `${n} camp. · R$ ${Number(placar.totalGasto || 0).toFixed(0)} · ${placar.totalLeads || 0} form.`,
    };
  } catch {
    return {
      ok: false, confiavel: false, metaStatus: 'erro_temporario',
      metaMensagem: 'Dados da Meta indisponíveis.',
      n: null, totalGasto: null, totalLeads: null, cplMedio: null,
      decisoes: [], alertas: ['Dados da Meta indisponíveis.'],
      pendenteAplicar: true, aplicadoNaMeta: false,
      resumo: 'Dados da Meta indisponíveis.',
    };
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
        ? `${camp.n} camp. · R$ ${Number(camp.totalGasto || 0).toFixed(0)} · ${camp.totalLeads || 0} form.`
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
