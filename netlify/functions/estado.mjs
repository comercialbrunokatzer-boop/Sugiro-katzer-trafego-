// ESTADO — Rotina + card Campanhas (só resumo + link pro app separado).
// GET /api/estado        → tarefas + obs + modo + campanhas{resumo}
// GET /api/estado?ceo=1  → + pontualidade (% + saldo)
//
// Decisão / quadradinho NÃO vive aqui. App: CAMPANHAS_APP_URL
import { createHash } from 'node:crypto';
import { agoraBRT, pontualidade, TAREFAS, previstoMin, min2hm } from './_rotina.mjs';
import { leEstado, json } from './_infra.mjs';
import { lePlacar, leDecisoes } from './_placar-io.mjs';
import { listaDecisoes, montaSugestoes } from './_placar-estado.mjs';
import { leQualidade, mapaQualidade } from './_qualidade-io.mjs';
import { enriqueceComQualidade, resumoCplBomQualidade } from './_qualidade.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';
const CAMPANHAS_APP_URL = (process.env.CAMPANHAS_APP_URL || 'https://dashing-elf-41a723.netlify.app').replace(/\/+$/, '');

function senhaGestorOk(event, params) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

/**
 * Card Campanhas na Rotina (layout Bruno) — SÓ OLHAR:
 *   7 campanhas | R$ 2351 | 46 leads | CPL méd R$ 51
 *   CPL BOM méd R$ 13 | 83% bons | Itapoá: R$ 13,20 BOM 🟢
 *   👁 Só olhar aqui · execute no Painel de Campanhas
 *   ▶ Abrir Painel de Campanhas
 * Sem lista de escalar. Sem Aplicar/Ajustar. Decisão = app Campanhas.
 */
async function resumoCampanhas(data) {
  const link = CAMPANHAS_APP_URL + '/';
  const cta = '▶ Abrir Painel de Campanhas';
  try {
    const [{ placar, meta }, bruto, qualDoc] = await Promise.all([
      lePlacar({ preset: 'last_7d' }),
      leDecisoes(data),
      leQualidade(),
    ]);
    const decisoes = listaDecisoes(bruto);
    const idsDecididos = new Set(decisoes.map((d) => d.id));
    const sugestoes = montaSugestoes(placar);
    const nPendentes = sugestoes.filter((s) => !idsDecididos.has(s.id)).length;
    const pendente = nPendentes > 0;
    const statusDecisao = pendente
      ? (nPendentes === 1
        ? '👁 Só olhar · 1 decisão pendente no Painel de Campanhas'
        : `👁 Só olhar · ${nPendentes} decisões pendentes no Painel de Campanhas`)
      : '👁 Só olhar · nada pendente no Painel de Campanhas';

    const confiavel = meta?.confiavel !== false && meta?.status === 'ok';
    if (!confiavel) {
      return {
        confiavel: false,
        modo: 'olhar',
        resumo: meta?.mensagemPainel || meta?.mensagem || 'Dados da Meta indisponíveis.',
        metrica: null,
        cplBom: null,
        statusDecisao,
        pendente,
        nPendentes,
        n: null, totalGasto: null, totalLeads: null, cplMedio: null,
        link, cta,
      };
    }
    const mapa = mapaQualidade(qualDoc);
    const campanhasQ = (placar.campanhas || []).map((c) => enriqueceComQualidade(c, mapa));
    const n = campanhasQ.length;
    const totalGasto = placar.totalGasto ?? 0;
    const totalLeads = placar.totalLeads ?? 0;
    const cplMedio = placar.cplMedio;
    const bom = resumoCplBomQualidade(campanhasQ);
    const metrica = [
      `${n} campanhas`,
      `R$ ${Number(totalGasto).toFixed(0)}`,
      `${totalLeads} leads`,
      `CPL méd ${cplMedio != null ? `R$ ${Number(cplMedio).toFixed(0)}` : '—'}`,
    ].join(' | ');
    return {
      confiavel: true,
      modo: 'olhar',
      n, totalGasto, totalLeads, cplMedio,
      metrica,
      cplBom: bom.texto,
      cplBomMedio: bom.cplBomMedio,
      pctBons: bom.pctBons,
      destaqueBom: bom.destaqueTexto,
      qualidadeFonte: bom.fonte,
      statusDecisao,
      pendente,
      nPendentes,
      resumo: metrica,
      link, cta,
    };
  } catch {
    return {
      confiavel: false,
      modo: 'olhar',
      resumo: 'Dados da Meta indisponíveis.',
      metrica: null,
      cplBom: null,
      statusDecisao: '👁 Só olhar · abra o Painel de Campanhas',
      pendente: true,
      nPendentes: null,
      n: null, totalGasto: null, totalLeads: null, cplMedio: null,
      link, cta,
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
    const prev = previstoMin(t, estado.modo, estado.inicioMin, estado.overrides);
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
      override: !!(estado.overrides && estado.overrides[t.id] != null),
    };
  });

  const campanhas = await resumoCampanhas(now.data);

  const base = {
    ok: true, data: now.data, agora: now.hm, modo: estado.modo,
    domingo, tarefas, obs: estado.obs,
    campanhas,
    overrides: estado.overrides || {},
    auto: true, // V6: persiste sozinho; gestor só olha (poll)
  };

  if (params.ceo) {
    if (!senhaGestorOk(event, params)) {
      return json(401, { ok: false, precisaSenha: true, erro: 'senha do gestor necessária' });
    }
    base.pontualidade = pontualidade(estado, now.min, { domingo, fimDiaMin });
  }
  return json(200, base);
}
