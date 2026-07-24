// Status de ciclo de vida das campanhas Meta (início / pausa).
import { classificaMetaResultado } from './_meta-status.mjs';

const GRAPH = () => process.env.META_GRAPH || 'https://graph.facebook.com/v20.0';
const CONTA = () => process.env.META_AD_ACCOUNT || 'act_1150648749960943';

function brtDate(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

/**
 * Mapa campaign_id → { status, inicioBR, pausaBR, ativa }
 */
export async function leCicloCampanhas() {
  const token = process.env.META_SYSTEM_TOKEN;
  const acct = CONTA();
  if (!token) {
    return { ok: false, mapa: {}, meta: classificaMetaResultado({ temToken: false, conta: acct, etapa: 'env' }) };
  }
  const url = new URL(`${GRAPH()}/${acct}/campaigns`);
  url.searchParams.set('fields', 'id,name,effective_status,start_time,stop_time,updated_time');
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', token);
  try {
    const r = await fetch(url.toString());
    const body = await r.json();
    if (body?.error) {
      return {
        ok: false,
        mapa: {},
        meta: classificaMetaResultado({
          temToken: true, httpOk: false, bodyError: body.error, conta: acct, etapa: 'campaigns',
        }),
      };
    }
    const mapa = {};
    for (const c of body.data || []) {
      const status = String(c.effective_status || '').toUpperCase();
      const ativa = status === 'ACTIVE';
      const pausada = /PAUSED|CAMPAIGN_PAUSED|ADSET_PAUSED|ARCHIVED|DELETED/.test(status);
      const item = {
        id: c.id,
        nome: c.name,
        status,
        ativa,
        pausada,
        inicioISO: c.start_time || null,
        pausaISO: pausada ? (c.stop_time || c.updated_time || null) : (c.stop_time || null),
        inicioBR: brtDate(c.start_time),
        pausaBR: pausada ? brtDate(c.stop_time || c.updated_time) : brtDate(c.stop_time),
        rotulo: ativa
          ? `Ativa · subiu ${brtDate(c.start_time) || '—'}`
          : (pausada
            ? `Pausada ${brtDate(c.stop_time || c.updated_time) || '—'} · subiu ${brtDate(c.start_time) || '—'}`
            : `${status || '—'} · subiu ${brtDate(c.start_time) || '—'}`),
      };
      mapa[c.id] = item;
      if (c.name) mapa[c.name] = item;
    }
    return { ok: true, mapa, meta: classificaMetaResultado({ temToken: true, httpOk: true, nBruto: (body.data || []).length, conta: acct }) };
  } catch (e) {
    return {
      ok: false,
      mapa: {},
      meta: classificaMetaResultado({
        temToken: true, httpOk: false,
        bodyError: { code: 'FETCH', message: String((e && e.message) || e) },
        conta: acct, etapa: 'campaigns',
      }),
    };
  }
}

export function enrichComCiclo(row = {}, mapa = {}) {
  const id = row.campaignId || row.campaign_id || row.id;
  const nome = row.campanha || row.nome || row.campaign_name;
  const ciclo = (id && mapa[id]) || (nome && mapa[nome]) || null;
  if (!ciclo) return { ...row, ciclo: null };
  return {
    ...row,
    ciclo,
    statusVeiculacao: ciclo.status,
    dataSubiu: ciclo.inicioBR,
    dataPausada: ciclo.pausada ? ciclo.pausaBR : null,
    cicloRotulo: ciclo.rotulo,
  };
}
