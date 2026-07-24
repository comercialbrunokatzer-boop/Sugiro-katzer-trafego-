// PLACAR — puxa o Meta Ads Insights e devolve o Placar de Campanhas do Michel:
// por campanha gasto · leads · CPL, totais e a DECISÃO DO DIA.
// Protegido por ?key=<WHATSAPP_CEO>. GET /api/placar?key=<numero>[&preset=last_7d]
import { montaPlacar, resumoPlacarWhats } from './_placar.mjs';
import { json } from './_infra.mjs';
import { META_AD_ACCOUNT, META_GRAPH } from './_meta-config.mjs';

const soDig = (s) => String(s || '').replace(/\D+/g, '');
const PRESETS = new Set(['today', 'yesterday', 'last_7d', 'last_14d', 'last_30d', 'this_month']);
const rotulo = (p) => (p === 'today' ? 'hoje' : p === 'yesterday' ? 'ontem' : `últimos ${p.replace('last_', '').replace('d', ' dias')}`);

export async function handler(event) {
  const q = event.queryStringParameters || {};
  const key = soDig(q.key);
  const ceo = soDig(process.env.WHATSAPP_CEO);
  if (!ceo || key !== ceo) return json(403, { ok: false, erro: 'passe ?key=<numero do CEO>' });

  const token = process.env.META_SYSTEM_TOKEN;
  if (!token) return json(503, { ok: false, erro: 'META_SYSTEM_TOKEN ausente' });

  const preset = PRESETS.has(q.preset) ? q.preset : 'last_7d';
  const url = new URL(`${META_GRAPH}/${META_AD_ACCOUNT}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('date_preset', preset);
  url.searchParams.set('fields', 'campaign_name,spend,actions,results');
  url.searchParams.set('limit', '500'); // pega TODAS as campanhas (evita corte de paginação)
  url.searchParams.set('access_token', token);

  try {
    const r = await fetch(url.toString());
    const body = await r.json();
    if (body.error) return json(502, { ok: false, erro: `Meta: ${body.error.message || 'erro'}` });
    const placar = montaPlacar(body.data || []);
    return json(200, { ok: true, preset, ...placar, mensagem: resumoPlacarWhats(placar, { periodo: rotulo(preset) }) });
  } catch (e) {
    return json(502, { ok: false, erro: String((e && e.message) || e) });
  }
}
