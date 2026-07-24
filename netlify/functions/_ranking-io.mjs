// I/O do Ranking de Campanhas (arquivo "_" = NÃO vira função).
// 7d operacional · 30d · maximum (ranking real da conta / prints).
// Sem token na resposta. Log só: campanha, leads, gasto, CPL, período.
import { montaRanking, contaDiasNoAr, payloadPainelRanking } from './_ranking.mjs';
import { montaRecomendacoes } from './_recomendacoes.mjs';
import { classificaMetaResultado } from './_meta-status.mjs';
import { leQualidade, mapaQualidade } from './_qualidade-io.mjs';
import { enriqueceComQualidade } from './_qualidade.mjs';
import { leCicloCampanhas, enrichComCiclo } from './_meta-ciclo.mjs';

const GRAPH = () => process.env.META_GRAPH || 'https://graph.facebook.com/v20.0';
const CONTA = () => process.env.META_AD_ACCOUNT || 'act_1150648749960943';

async function fetchInsights({ preset, timeIncrement = null, maxPages = 8 }) {
  const token = process.env.META_SYSTEM_TOKEN;
  const acct = CONTA();
  if (!token) {
    return {
      ok: false,
      data: [],
      meta: classificaMetaResultado({ temToken: false, conta: acct, etapa: 'env' }),
    };
  }

  const url = new URL(`${GRAPH()}/${acct}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('date_preset', preset);
  url.searchParams.set(
    'fields',
    'campaign_id,campaign_name,spend,impressions,reach,frequency,actions,results,clicks',
  );
  url.searchParams.set('limit', '500');
  if (timeIncrement) url.searchParams.set('time_increment', String(timeIncrement));
  url.searchParams.set('access_token', token);

  try {
    const r = await fetch(url.toString());
    const body = await r.json();
    if (body?.error) {
      return {
        ok: false,
        data: [],
        meta: classificaMetaResultado({
          temToken: true, httpOk: false, bodyError: body.error, conta: acct, etapa: 'insights',
        }),
      };
    }
    let data = body.data || [];
    let next = body.paging?.next;
    let pages = 1;
    while (next && pages < maxPages) {
      const nr = await fetch(next);
      const nb = await nr.json();
      if (nb?.error || !Array.isArray(nb.data)) break;
      data = data.concat(nb.data);
      next = nb.paging?.next;
      pages += 1;
    }
    return {
      ok: true,
      data,
      meta: classificaMetaResultado({
        temToken: true, httpOk: true, nBruto: data.length,
        nComGasto: data.filter((c) => Number(c.spend) > 0).length, conta: acct,
      }),
    };
  } catch {
    return {
      ok: false,
      data: [],
      meta: classificaMetaResultado({
        temToken: true, httpOk: false,
        bodyError: { code: 'FETCH', message: 'network' },
        conta: acct, etapa: 'fetch',
      }),
    };
  }
}

function horarioBRT() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * @param {string} preset
 * @param {{ comDias?: boolean }} opts — dias no ar só em janelas curtas (7d/30d)
 */
export async function rankingPreset(preset, { comDias = false } = {}) {
  const camp = await fetchInsights({ preset });
  let dias = null;
  if (comDias && camp.ok) {
    const daily = await fetchInsights({ preset, timeIncrement: 1, maxPages: 5 });
    if (daily.ok) dias = contaDiasNoAr(daily.data);
  }
  const ranking = montaRanking(camp.data, {
    periodo: preset,
    leituraOk: camp.ok && camp.meta?.confiavel !== false,
    horarioLeitura: horarioBRT(),
    conta: CONTA(),
    diasPorCampanha: dias,
  });
  for (const row of (ranking.logSeguro || []).slice(0, 40)) {
    console.log(`[ranking] ${row.periodo} | ${row.campanha} | leads=${row.leads} | gasto=${row.gasto} | cpl=${row.cpl}`);
  }
  return { ranking, meta: camp.meta };
}

function periodoLabelPreset(preset) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const br = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const hoje = fmt.format(new Date());
  if (preset === 'maximum') {
    return {
      preset,
      label: 'Preset Meta *maximum* (histórico da conta — NÃO é “últimos 4 dias”)',
      aviso: 'No Gerenciador, se estiver em “últimos 4 dias”, o gasto NÃO bate com maximum nem com last_7d.',
    };
  }
  let dias = 7;
  if (preset === 'last_30d') dias = 30;
  if (preset === 'last_14d') dias = 14;
  if (preset === 'last_3d') dias = 3;
  const [y, m, d] = hoje.split('-').map(Number);
  const fim = new Date(Date.UTC(y, m - 1, d));
  const ini = new Date(fim);
  ini.setUTCDate(ini.getUTCDate() - (dias - 1));
  const iniIso = `${ini.getUTCFullYear()}-${String(ini.getUTCMonth() + 1).padStart(2, '0')}-${String(ini.getUTCDate()).padStart(2, '0')}`;
  return {
    preset,
    inicioISO: iniIso,
    fimISO: hoje,
    label: `Preset Meta *${preset}* · ${br(iniIso)} → ${br(hoje)} (BRT)`,
    aviso: 'Compare só com o mesmo preset no Gerenciador. “Últimos 4 dias” ≠ last_7d.',
  };
}

function aplicaCplBomNoRanking(ranking, mapa, cicloMapa = {}) {
  if (!ranking || !ranking.ok) return ranking;
  const enriquecer = (rows) => (rows || []).map((r) => {
    const e = enriqueceComQualidade({
      nome: r.campanha,
      id: r.campaignId || r.id,
      gasto: r.gasto,
      leads: r.leadsForm,
      cpl: r.cplForm,
    }, mapa);
    const comCiclo = enrichComCiclo({
      ...r,
      cplBom: e.cplBom ?? null,
      leadsBons: e.leadsBons ?? null,
      cplBruto: e.cplBruto ?? r.cplForm,
      semaforoBom: e.semaforoBom || null,
    }, cicloMapa);
    return comCiclo;
  });
  const rankingCpl = enriquecer(ranking.rankingCpl);
  const rankingCplBom = [...rankingCpl]
    .sort((a, b) => {
      const ca = a.cplBom != null ? a.cplBom : (a.cplForm ?? Infinity);
      const cb = b.cplBom != null ? b.cplBom : (b.cplForm ?? Infinity);
      return ca - cb;
    })
    .map((r, i) => ({ ...r, pos: i + 1, metricaRank: r.cplBom != null ? 'cpl_bom' : 'cpl_form' }));
  const periodo = periodoLabelPreset(ranking.periodo || 'last_7d');
  return {
    ...ranking,
    periodoLabel: periodo.label,
    periodoInfo: periodo,
    rankingCpl,
    rankingCplBom,
    top10Cpl: rankingCpl.slice(0, 10),
    top10CplBom: rankingCplBom.slice(0, 10),
    rankingVolumeCpl: enriquecer(ranking.rankingVolumeCpl),
    amostraPequena: enriquecer(ranking.amostraPequena),
  };
}

/**
 * Payload do painel:
 * - contaMaxima = ranking real (prints / histórico longo)
 * - operacional7d / historico30d = operação
 * - ranking ordenado por CPL BOM (V6)
 */
export async function montaPayloadRanking({ conferencia = true } = {}) {
  const [max, op, hi, qualDoc, ciclo] = await Promise.all([
    rankingPreset('maximum', { comDias: false }),
    rankingPreset('last_7d', { comDias: true }),
    rankingPreset('last_30d', { comDias: false }),
    leQualidade().catch(() => ({ campanhas: [] })),
    leCicloCampanhas().catch(() => ({ ok: false, mapa: {} })),
  ]);
  const mapa = mapaQualidade(qualDoc);
  const cicloMapa = ciclo.mapa || {};

  let conferenciaOut = null;
  if (conferencia) {
    const top = max.ranking?.top10Cpl || max.ranking?.rankingCpl || [];
    const temBarra = top.some((c) => /BARRA\s*VIEW|SANDRA/i.test(c.campanha));
    const temAlicerce = top.some((c) => /ALICERCE|AYA/i.test(c.campanha));
    const br = (op.ranking?.logSeguro || []).find((c) => /BR_SC/i.test(c.campanha));
    const gastoMax = max.ranking?.totais?.totalGasto ?? null;
    conferenciaOut = {
      periodoConta: 'maximum',
      totalGastoConta: gastoMax,
      totalLeadsConta: max.ranking?.totais?.totalLeadsForm ?? null,
      refRodapeGerenciador: 64893.84,
      bateRodapeAprox: gastoMax != null && Math.abs(gastoMax - 64893.84) < 500,
      notaRodape: gastoMax == null
        ? 'Sem total maximum.'
        : (Math.abs(gastoMax - 64893.84) < 500
          ? 'Gasto maximum ≈ rodapé do Gerenciador (R$ 64.893,84).'
          : `Gasto maximum API R$ ${gastoMax} vs rodapé ref. R$ 64.893,84 — conferir filtro/conta/período do print.`),
      topTemBarraView: temBarra,
      topTemAlicerce: temAlicerce,
      brSc7d: br ? { leads: br.leads, gasto: br.gasto, cpl: br.cpl } : null,
      esperadoBrSc7d: 9,
      notaBrSc: br
        ? (br.leads === 9 ? 'BR_SC 7d = 9 (bate).' : `BR_SC 7d API=${br.leads} (ref. 9).`)
        : 'BR_SC ausente no 7d.',
      top10Nomes: top.slice(0, 10).map((c) => c.campanha),
    };
  }

  const payload = payloadPainelRanking({
    contaMaxima: aplicaCplBomNoRanking(max.ranking, mapa, cicloMapa),
    operacional: aplicaCplBomNoRanking(op.ranking, mapa, cicloMapa),
    historico: aplicaCplBomNoRanking(hi.ranking, mapa, cicloMapa),
    conferencia: conferenciaOut,
  });
  payload.recomendacoes = montaRecomendacoes({
    operacional7d: op.ranking,
    contaMaxima: max.ranking,
  });
  return payload;
}
