// Ações Meta — pausar / reativar campanha (Graph API).
const GRAPH = () => process.env.META_GRAPH || 'https://graph.facebook.com/v20.0';

export async function metaSetCampaignStatus(campaignId, status = 'PAUSED') {
  const token = process.env.META_SYSTEM_TOKEN;
  const id = String(campaignId || '').trim();
  if (!token) return { ok: false, motivo: 'META_SYSTEM_TOKEN ausente' };
  if (!id || !/^\d+$/.test(id)) return { ok: false, motivo: 'campaignId inválido' };
  const st = String(status).toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
  try {
    const url = `${GRAPH()}/${id}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        status: st,
        access_token: token,
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || body.error) {
      return {
        ok: false,
        motivo: body.error?.message || `HTTP ${r.status}`,
        body,
      };
    }
    return { ok: true, status: st, id, result: body };
  } catch (e) {
    return { ok: false, motivo: String(e.message || e) };
  }
}

export async function metaPauseCampaign(campaignId) {
  return metaSetCampaignStatus(campaignId, 'PAUSED');
}

export async function metaActivateCampaign(campaignId) {
  return metaSetCampaignStatus(campaignId, 'ACTIVE');
}

/** Insights de campanha num intervalo (ex.: desde 12/07/2025). */
export async function metaInsightsPeriodo({ since = '2025-07-12', until = null } = {}) {
  const token = process.env.META_SYSTEM_TOKEN;
  const acct = process.env.META_AD_ACCOUNT || 'act_1150648749960943';
  if (!token) return { ok: false, data: [], motivo: 'META_SYSTEM_TOKEN ausente' };
  const fim = until || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const url = new URL(`${GRAPH()}/${acct}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('time_range', JSON.stringify({ since, until: fim }));
  url.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,reach,clicks,actions,results');
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', token);
  try {
    const r = await fetch(url.toString());
    const body = await r.json();
    if (body.error) return { ok: false, data: [], motivo: body.error.message };
    return { ok: true, data: body.data || [], since, until: fim };
  } catch (e) {
    return { ok: false, data: [], motivo: String(e.message || e) };
  }
}
