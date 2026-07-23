// POST /api/sync-bitrix-env — copia BITRIX_* da Helena (regal-chaja) → este site.
// Protegido pela senha do gestor. Usa BLOBS_TOKEN (= NETLIFY_AUTH_TOKEN).
import { createHash } from 'node:crypto';
import { json } from './_infra.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';
const SCOPES = ['builds', 'functions', 'runtime', 'post-processing'];

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
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) {
    throw new Error(`Netlify ${method} ${path}: HTTP ${r.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}


function shapeUrl(raw) {
  const v = String(raw || '').trim().replace(/^["']|["']$/g, '');
  if (!v) return { empty: true };
  let u = v;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u.replace(/\/+$/, '') + '/');
    return {
      len: v.length,
      protocol: parsed.protocol,
      host: parsed.host,
      pathParts: parsed.pathname.split('/').filter(Boolean).length,
      looksBitrix: /bitrix24/i.test(parsed.host),
      startsHttps: /^https:\/\//i.test(v),
    };
  } catch (e) {
    return { len: v.length, invalid: true, err: String(e.message || e) };
  }
}

function ensureBitrixUrl(raw) {
  let v = String(raw || '').trim().replace(/^["']|["']$/g, '');
  if (!v) return v;
  if (!/^https?:\/\//i.test(v)) {
    // token solto ou path sem host → assume portal Katzer
    if (/^rest\//i.test(v) || /^\d+\//.test(v)) v = `https://katzer.bitrix24.com.br/${v.replace(/^\/+/, '')}`;
    else if (/bitrix24\.com/i.test(v)) v = `https://${v}`;
    else v = `https://katzer.bitrix24.com.br/rest/${v.replace(/^\/+/, '')}`;
  }
  return v.replace(/\/+$/, '') + '/';
}

function pickEnv(vars, key) {
  const hit = (vars || []).find((v) => (v.key || v.Key || v.name) === key);
  if (!hit) return null;
  const values = hit.values || [];
  const prod = values.find((v) => v.context === 'production' || v.context === 'all')
    || values.find((v) => (v.context || '').includes('prod'))
    || values[0];
  return prod?.value || hit.value || null;
}

async function setEnv(accountSlug, siteId, key, value) {
  const payload = {
    key,
    scopes: SCOPES,
    values: [{ value, context: 'all' }],
  };
  // 1) tenta upsert PATCH/PUT
  try {
    await netlify(`/accounts/${accountSlug}/env/${encodeURIComponent(key)}?site_id=${siteId}`, {
      method: 'PATCH',
      body: payload,
    });
    return 'patched';
  } catch { /* segue */ }
  try {
    await netlify(`/accounts/${accountSlug}/env/${encodeURIComponent(key)}?site_id=${siteId}`, {
      method: 'PUT',
      body: payload,
    });
    return 'put';
  } catch { /* segue */ }
  // 2) create — API espera ARRAY
  await netlify(`/accounts/${accountSlug}/env?site_id=${siteId}`, {
    method: 'POST',
    body: [payload],
  });
  return 'created';
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
    const dstName = body.target || 'rotina-produtiva-michel';
    const src = lista.find((s) => s.name === srcName);
    const dst = lista.find((s) => s.name === dstName || (s.ssl_url || '').includes(dstName));
    if (!src) return json(404, { ok: false, erro: `origem ${srcName} não achada`, sites: lista.map((s) => s.name) });
    if (!dst) return json(404, { ok: false, erro: `destino ${dstName} não achado`, sites: lista.map((s) => s.name) });

    const accountSlug = src.account_slug || dst.account_slug;
    const envSrc = await netlify(`/accounts/${accountSlug}/env?site_id=${src.id}`);
    const keysDisponiveis = (Array.isArray(envSrc) ? envSrc : []).map((v) => v.key).filter(Boolean);

    const keys = [
      'BITRIX_WEBHOOK_READ',
      'BITRIX_WEBHOOK_URL',
      'BITRIX24_WEBHOOK',
      'BITRIX_WEBHOOK_WRITE',
      'BITRIX_PORTAL_URL',
      'BITRIX_CATEGORY_ID',
      'BRUNO_PHONE',
      'WHATSAPP_CEO',
    ];
    const copiados = [];
    const erros = [];
    for (const K of keys) {
      let V = pickEnv(envSrc, K);
      if (!V) continue;
      if (/BITRIX_WEBHOOK/i.test(K)) V = ensureBitrixUrl(V);
      try {
        const how = await setEnv(accountSlug, dst.id, K, V);
        copiados.push(`${K}:${how}`);
        if (K === 'BITRIX_WEBHOOK_READ') {
          try {
            await setEnv(accountSlug, dst.id, 'BITRIX_WEBHOOK_URL', V);
            copiados.push('BITRIX_WEBHOOK_URL:alias');
          } catch (e) {
            erros.push(String(e.message || e));
          }
        }
      } catch (e) {
        erros.push(`${K}: ${e.message || e}`);
      }
    }

    return json(200, {
      ok: copiados.length > 0,
      toast: copiados.length
        ? `Bitrix env copiado (${copiados.length})`
        : 'Nenhuma BITRIX_* encontrada na Helena',
      origem: srcName,
      destino: dst.name,
      accountSlug,
      keysNaOrigem: keysDisponiveis.filter((k) => /BITRIX|BRUNO_PHONE|WHATSAPP_CEO/i.test(k)),
      copiados,
      erros,
      shapes: {
        read: shapeUrl(pickEnv(envSrc, 'BITRIX_WEBHOOK_READ')),
        write: shapeUrl(pickEnv(envSrc, 'BITRIX_WEBHOOK_WRITE')),
      },
      destinoTemBitrix: !!(pickEnv(await netlify(`/accounts/${accountSlug}/env?site_id=${dst.id}`), 'BITRIX_WEBHOOK_READ')
        || pickEnv(await netlify(`/accounts/${accountSlug}/env?site_id=${dst.id}`), 'BITRIX_WEBHOOK_URL')),
      dica: 'Redeploy pra functions pegarem as novas env vars',
    });
  } catch (e) {
    return json(500, { ok: false, erro: String((e && e.message) || e) });
  }
}
