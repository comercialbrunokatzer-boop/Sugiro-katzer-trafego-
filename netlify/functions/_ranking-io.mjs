// I/O do Ranking de Campanhas (arquivo "_" = NÃO vira função).
// Busca Insights Meta (7d + 30d) sem expor token. Log só seguro.
import { montaRanking, contaDiasNoAr, payloadPainelRanking } from './_ranking.mjs';
import { classificaMetaResultado } from './_meta-status.mjs';

const GRAPH = () => process.env.META_GRAPH || 'https://graph.facebook.com/v20.0';
const CONTA = () => process.env.META_AD_ACCOUNT || 'act_1150648749960943';

async function fetchInsights({ preset, timeIncrement = null }) {
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
    // Paginação simples (até 3 páginas)
    let data = body.data || [];
    let next = body.paging?.next;
    let pages = 1;
    while (next && pages < 3) {
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

/** Monta um bloco de ranking (preset) com dias no ar. */
export async function rankingPreset(preset) {
  const [camp, daily] = await Promise.all([
    fetchInsights({ preset }),
    fetchInsights({ preset, timeIncrement: 1 }),
  ]);
  const dias = camp.ok && daily.ok ? contaDiasNoAr(daily.data) : null;
  const ranking = montaRanking(camp.data, {
    periodo: preset,
    leituraOk: camp.ok && camp.meta?.confiavel !== false,
    horarioLeitura: horarioBRT(),
    conta: CONTA(),
    diasPorCampanha: dias,
  });
  // log seguro (sem token / sem payload bruto)
  for (const row of ranking.logSeguro || []) {
    console.log(`[ranking] ${row.periodo} | ${row.campanha} | leads=${row.leads} | gasto=${row.gasto} | cpl=${row.cpl}`);
  }
  return { ranking, meta: camp.meta };
}

/**
 * Payload completo do painel: 7d operacional + 30d histórico.
 * Conferência opcional: nome parcial da campanha (ex. FortMyers_BR_SC) e leads esperados.
 */
export async function montaPayloadRanking({ conferenciaBrSc = true } = {}) {
  const [op, hi] = await Promise.all([
    rankingPreset('last_7d'),
    rankingPreset('last_30d'),
  ]);

  let conferencia = null;
  if (conferenciaBrSc && op.ranking?.ok) {
    const noLog = (op.ranking.logSeguro || []).find((c) => /BR_SC/i.test(c.campanha));
    const leads = noLog?.leads ?? null;
    const gasto = noLog?.gasto ?? null;
    conferencia = {
      campanhaRef: 'FortMyers_BR_SC',
      periodo: 'last_7d',
      leadsFormApi: leads,
      gastoApi: gasto,
      cplApi: noLog?.cpl ?? null,
      esperadoGerenciadorLeads: 9,
      bateLeads: leads === 9,
      nota: leads == null
        ? 'Campanha BR_SC não encontrada na leitura.'
        : (leads === 9
          ? 'API bate com referência do Gerenciador (9 leads / 7d).'
          : `API retornou ${leads} leads form. (ref. Gerenciador: 9). Conferir período/timezone/atribuição.`),
      totalGasto7d: op.ranking.totais?.totalGasto ?? null,
      totalLeads7d: op.ranking.totais?.totalLeadsForm ?? null,
      totalGasto30d: hi.ranking?.totais?.totalGasto ?? null,
      totalLeads30d: hi.ranking?.totais?.totalLeadsForm ?? null,
      refRodapeGerenciador: 64893.84,
      notaRodape: 'R$ 64.893,84 é referência de outro período/filtro do Gerenciador — comparar só com o mesmo período da API.',
    };
  }

  return payloadPainelRanking({
    operacional: op.ranking,
    historico: hi.ranking,
    conferencia,
  });
}
