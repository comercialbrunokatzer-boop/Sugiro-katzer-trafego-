// ESTADO — Rotina + card Campanhas (resumo + link; NÃO embute o painel).
// GET /api/estado        → tarefas + obs + modo + campanhas{resumo}
// GET /api/estado?ceo=1  → + pontualidade (% + saldo)
//
// Painel completo: /campanhas · /ranking-campanhas
import { createHash } from 'node:crypto';
import { agoraBRT, pontualidade, TAREFAS, previstoMin, min2hm } from './_rotina.mjs';
import { leEstado, json } from './_infra.mjs';
import { lePlacar, leDecisoes } from './_placar-io.mjs';
import { listaDecisoes } from './_placar-estado.mjs';
import { resumoCplBom } from './_campanhas-regras.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';
function senhaGestorOk(event, params) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

/**
 * Resumo do card Campanhas na Rotina:
 *   N campanhas | R$ X | Y leads | CPL méd R$ Z
 *   [CPL BOM médio: R$ A — B% bons]
 *   ▶ Abrir Painel de Campanhas
 * Leads = formulário (nunca clique).
 */
async function resumoCampanhas(data) {
  try {
    const [{ placar, meta }, bruto] = await Promise.all([
      lePlacar({ preset: 'last_7d' }),
      leDecisoes(data),
    ]);
    const decisoes = listaDecisoes(bruto);
    const confiavel = meta?.confiavel !== false && meta?.status === 'ok';
    if (!confiavel) {
      return {
        confiavel: false,
        resumo: meta?.mensagemPainel || meta?.mensagem || 'Dados da Meta indisponíveis.',
        metrica: null,
        cplBom: null,
        n: null, totalGasto: null, totalLeads: null, cplMedio: null,
        decisoes: [],
        link: '/campanhas',
        cta: '▶ Abrir Painel de Campanhas',
      };
    }
    const n = (placar.campanhas || []).length;
    const totalGasto = placar.totalGasto ?? 0;
    const totalLeads = placar.totalLeads ?? 0;
    const cplMedio = placar.cplMedio;
    const bom = resumoCplBom(placar.campanhas || []);
    const metrica = [
      `${n} campanhas`,
      `R$ ${Number(totalGasto).toFixed(0)}`,
      `${totalLeads} leads`,
      `CPL méd ${cplMedio != null ? `R$ ${Number(cplMedio).toFixed(0)}` : '—'}`,
    ].join(' | ');
    return {
      confiavel: true,
      n,
      totalGasto,
      totalLeads,
      cplMedio,
      metrica,
      cplBom: bom.texto,
      cplBomMedio: bom.cplBomMedio,
      pctBons: bom.pctBons,
      resumo: metrica,
      decisoes: decisoes.map((d) => ({ id: d.id, decisao: d.decisao, hora: d.hora })),
      link: '/campanhas',
      cta: '▶ Abrir Painel de Campanhas',
    };
  } catch {
    return {
      confiavel: false,
      resumo: 'Dados da Meta indisponíveis.',
      metrica: null,
      cplBom: null,
      n: null, totalGasto: null, totalLeads: null, cplMedio: null,
      decisoes: [],
      link: '/campanhas',
      cta: '▶ Abrir Painel de Campanhas',
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

  const campanhas = await resumoCampanhas(now.data);
  const campanhasIdx = tarefas.findIndex((t) => t.id === 'campanhas');
  if (campanhasIdx >= 0 && !tarefas[campanhasIdx].feito && (campanhas.decisoes || []).length > 0 && !domingo) {
    tarefas[campanhasIdx].estado = 'em_andamento';
  }

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
