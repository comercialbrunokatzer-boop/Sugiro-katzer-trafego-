// POST /api/sync-bitrix-env — copia BITRIX_* da Helena (regal-chaja) → este site.
// Protegido pela senha do gestor. Usa BLOBS_TOKEN (= NETLIFY_AUTH_TOKEN).
import { createHash } from 'node:crypto';
import { json } from './_infra.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';

function senhaOk(event, body) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || body?.gestorKey || body?.senha || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

async function netlify(path, { method = 'GET', body } = {}) {
  const token = process.env.BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN || '';
  if (!token) throw new Error('BLOBS_TOKEN/NETLIFY_AUTH_TOKEN ausente neste site');
  const r = await fetch(`https://api.netlify.com/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`Netlify ${method} ${path}: HTTP ${r.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

function pickEnv(vars, key) {
  const hit = (vars || []).find((v) => (v.key || v.Key || v.name) === key);
  if (!hit) return null;
  // scopes: valores por contexto
  const values = hit.values || [];
  const prod = values.find((v) => (v.context || '').includes('production') || v.context === 'all')
    || values[0];
  return prod?.value || hit.value || null;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, x-gestor-key',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') return json(405, { ok: false, erro: 'use POST' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* */ }
  if (!senhaOk(event, body)) return json(401, { ok: false, erro: 'senha gestor' });

  try {
    const sites = await netlify('/sites?per_page=100');
    const lista = Array.isArray(sites) ? sites : (sites?.sites || []);
    const srcName = body.source || 'regal-chaja-662035';
    const dstName = body.target || process.env.SITE_NAME || 'rotina-produtiva-michel';
    const src = lista.find((s) => s.name === srcName);
    const dst = lista.find((s) => s.name === dstName || (s.ssl_url || '').includes(dstName));
    if (!src) return json(404, { ok: false, erro: `origem ${srcName} não achada` });
    if (!dst) return json(404, { ok: false, erro: `destino ${dstName} não achado` });

    const accountSlug = src.account_slug || dst.account_slug;
    const envSrc = await netlify(`/accounts/${accountSlug}/env?site_id=${src.id}`);
    const keys = [
      'BITRIX_WEBHOOK_READ',
      'BITRIX_WEBHOOK_URL',
      'BITRIX24_WEBHOOK',
      'BITRIX_WEBHOOK_WRITE',
      'BITRIX_PORTAL_URL',
      'BITRIX_CATEGORY_ID',
      'BRUNO_PHONE',
    ];
    const copiados = [];
    for (const K of keys) {
      const V = pickEnv(envSrc, K);
      if (!V) continue;
      // cria/atualiza no destino
      await netlify(`/accounts/${accountSlug}/env/${encodeURIComponent(K)}?site_id=${dst.id}`, {
        method: 'PUT',
        body: {
          key: K,
          scopes: ['builds', 'functions', 'runtime', 'post_processing'],
          values: [{ value: V, context: 'all' }],
        },
      }).catch(async () => {
        // se PUT falhar, tenta POST create
        await netlify(`/accounts/${accountSlug}/env?site_id=${dst.id}`, {
          method: 'POST',
          body: {
            key: K,
            scopes: ['builds', 'functions', 'runtime', 'post_processing'],
            values: [{ value: V, context: 'all' }],
          },
        });
      });
      copiados.push(K);
      if (K === 'BITRIX_WEBHOOK_READ') {
        // alias usado pelo App Decisão
        await netlify(`/accounts/${accountSlug}/env/BITRIX_WEBHOOK_URL?site_id=${dst.id}`, {
          method: 'PUT',
          body: {
            key: 'BITRIX_WEBHOOK_URL',
            scopes: ['builds', 'functions', 'runtime', 'post_processing'],
            values: [{ value: V, context: 'all' }],
          },
        }).catch(() => {});
        if (!copiados.includes('BITRIX_WEBHOOK_URL')) copiados.push('BITRIX_WEBHOOK_URL');
      }
    }

    return json(200, {
      ok: true,
      toast: `Bitrix env copiado: ${copiados.join(', ') || '(nenhuma chave)'}`,
      origem: srcName,
      destino: dst.name,
      copiados,
      dica: 'Redeploy pra functions pegarem as novas env vars',
    });
  } catch (e) {
    return json(500, { ok: false, erro: String((e && e.message) || e) });
  }
}
