// PLACAR-ESTADO — alimenta Campanhas / Quadradinho / snapshot do Gestor.
// GET /api/placar-estado
// GET /api/placar-estado?ceo=1  (senha gestor)
// GET /api/placar-estado?refresh=1  (força Meta, ignora cache curto)
// GET /api/placar-estado?diag=1     (inventário de action_types — sem token)
//
// DECISÃO DO DIA V4: NÃO sugerir EUA_Americanos a R$7.
// Sugerir: BR_SC trocar criativo + Amanay duplicar R$30/dia.
import { createHash } from 'node:crypto';
import { agoraBRT, montaSugestoes, montaSugestaoPrincipal, listaDecisoes } from './_placar-estado.mjs';
import { lePlacar, leDecisoes, mensagemMeta } from './_placar-io.mjs';
import { leQualidade, mapaQualidade } from './_qualidade-io.mjs';
import {
  enriqueceComQualidade, textoCplBrutoVsBom, calculaCplQualidade,
  ordenaPorCpl, escolheMelhorParaEscalar,
} from './_qualidade.mjs';
import {
  DECISAO_VERSAO,
  montaRecomendacoes,
  placarParaOperacional,
  sugestaoPrincipalV4,
  ehPublicoProibidoEscalar,
} from './_recomendacoes.mjs';
import { json } from './_infra.mjs';
import { LEADS_MIN_ESCALAR } from './_campanhas-regras.mjs';
import { cidadeReal } from './_campanhas-regras.mjs';

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
  const [{ placar, ts, cacheHit, meta, inventario }, decisoes, qualDoc] = await Promise.all([
    lePlacar({ preset: 'last_7d', force: params.refresh === '1' }),
    leDecisoes(now.data),
    leQualidade(),
  ]);

  const mapa = mapaQualidade(qualDoc);
  const campanhasQ = (placar.campanhas || []).map((c) => {
    const e = enriqueceComQualidade(c, mapa);
    return {
      ...e,
      comparativo: textoCplBrutoVsBom(calculaCplQualidade(
        { gasto: e.gasto, leads: e.leads },
        e.qualidade,
      )),
    };
  });
  // Defesa V4: público fora do BR nunca entra em escalar do placar
  const decisao = placar.decisao
    ? {
      ...placar.decisao,
      escalar: (placar.decisao.escalar || []).filter((c) => !ehPublicoProibidoEscalar(c.nome)),
    }
    : placar.decisao;
  const placarQ = {
    ...placar,
    campanhas: campanhasQ,
    decisao,
  };

  const metaOut = {
    status: meta?.status || 'ok',
    codigo: meta?.codigo || 'OK',
    etapa: meta?.etapa || 'insights',
    conta: meta?.conta || (process.env.META_AD_ACCOUNT || 'act_1150648749960943'),
    confiavel: meta?.confiavel !== false,
    cacheHit: !!cacheHit,
    usandoCache: !!meta?.usandoCache,
    mensagem: meta?.mensagemPainel || mensagemMeta(meta),
  };

  // Decisão do dia: §6 menor CPL BOM ≥10 + público BR; V4 cards oficiais ao lado
  const recBundle = metaOut.confiavel
    ? montaRecomendacoes({ operacional7d: placarParaOperacional(placarQ) })
    : { ok: false, versao: DECISAO_VERSAO, recomendacoes: [] };
  const melhorBom = escolheMelhorParaEscalar(campanhasQ);
  const sugestaoV4 = sugestaoPrincipalV4(recBundle.recomendacoes || []);
  let sugestaoPrincipal = null;
  if (melhorBom?.metrica === 'cpl_bom' && melhorBom.campanha) {
    const c = melhorBom.campanha;
    sugestaoPrincipal = {
      id: 'esc-bom-' + (c.id || c.nome || 'x'),
      tipo: 'escalar',
      versao: DECISAO_VERSAO,
      destino: c.nome,
      valorDia: 30,
      titulo: `Escalar ${c.nome} — menor CPL BOM`,
      motivo: melhorBom.motivo,
      recomendacao: `CPL BOM R$ ${Number(melhorBom.cpl).toFixed(2)} · base ${c.leads} ≥ ${LEADS_MIN_ESCALAR} · público BR`,
      campanha: c.nome,
      leads: c.leads,
      cpl: melhorBom.cpl,
      cplBom: c.cplBom,
      cplBruto: c.cplBruto,
      cidade: c.cidade || cidadeReal(c.nome),
      semaforo: c.semaforoBom || c.semaforoDecisao,
      bloqueadoEscalar: false,
      metrica: 'cpl_bom',
      cardsV4: recBundle.recomendacoes || [],
    };
  } else if (sugestaoV4) {
    sugestaoPrincipal = sugestaoV4;
  } else {
    const sugestaoLegado = metaOut.confiavel && metaOut.status === 'ok'
      ? montaSugestaoPrincipal(placarQ)
      : null;
    if (sugestaoLegado
        && !ehPublicoProibidoEscalar(sugestaoLegado.campanha || sugestaoLegado.destino || '')) {
      sugestaoPrincipal = sugestaoLegado;
    }
  }

  const rankingCplBom = ordenaPorCpl(campanhasQ, { modo: 'bom' });
  const rankingCplBruto = ordenaPorCpl(campanhasQ, { modo: 'bruto' });

  const body = {
    ok: true,
    metricaPrincipal: 'lead_formulario',
    metricaQualidade: 'cpl_bom = gasto ÷ (bom + comprador)',
    decisaoVersao: DECISAO_VERSAO,
    modoCplDefault: 'bom',
    data: now.data,
    agora: now.hm,
    ultimaLeitura: ts ? agoraBRT(new Date(ts)).hm : null,
    periodo: 'last_7d',
    placar: placarQ,
    rankingCplBom,
    rankingCplBruto,
    melhorParaEscalar: melhorBom,
    sugestoes: metaOut.confiavel ? montaSugestoes(placarQ) : [],
    sugestaoPrincipal,
    recomendacoes: recBundle,
    decisoes: listaDecisoes(decisoes),
    qualidadeAtualizadoEm: qualDoc.atualizadoEm || null,
    meta: metaOut,
    dadosConfiaveis: metaOut.confiavel && (metaOut.status === 'ok' || metaOut.status === 'sem_gasto' || metaOut.status === 'sem_campanha'),
    integracaoOk: metaOut.confiavel || !!meta?.usandoCache,
  };

  if (params.diag === '1') {
    body.diagnostico = {
      metrica: 'lead_formulario',
      fontesLead: placar?.fontesLead || [],
      prioridade: [
        'onsite_conversion.lead_grouped',
        'leadgen_grouped',
        'onsite_conversion.lead',
        'leadgen.other',
        'lead',
      ],
      inventario: inventario || null,
      aviso: 'Inventário sem token. Clique/messaging nunca entram como lead.',
      decisaoV4: 'BR_SC trocar criativo + Amanay R$30/dia. Nunca EUA_Americanos.',
    };
  }

  return json(200, body);
}
