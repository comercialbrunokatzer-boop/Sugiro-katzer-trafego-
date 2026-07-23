#!/usr/bin/env node
/**
 * Roda no `npm install` do workflow de deploy (antes do passo que falha por crédito).
 * Grava FUNIL_PROXY_KEY igual nos sites Tráfego + Helena e remove BRUNO_PHONE lixo.
 * Também tenta espelhar WHATSAPP_CEO do Tráfego → Helena (se a API não mascarar).
 */
const TOKEN = process.env.NETLIFY_AUTH_TOKEN || process.env.BLOBS_TOKEN || '';
const FUNIL_KEY = process.env.FUNIL_PROXY_KEY || 'katzer-funil-proxy-v1-2026';
const TRAFEGO = 'rotina-produtiva-michel';
const HELENA = 'regal-chaja-662035';
const SCOPES = ['builds', 'functions', 'runtime', 'post-processing'];

if (!TOKEN) {
  console.log('postinstall-funil: sem NETLIFY_AUTH_TOKEN — pulado');
  process.exit(0);
}

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(`https://api.netlify.com/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) {
    throw new Error(`Netlify ${method} ${path}: HTTP ${r.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

function pickEnv(vars, key) {
  const hit = (vars || []).find((v) => v.key === key);
  if (!hit) return null;
  const values = hit.values || [];
  const prod = values.find((v) => v.context === 'production' || v.context === 'all')
    || values[0];
  return prod?.value || hit.value || null;
}

async function setEnv(accountSlug, siteId, key, value) {
  const payload = {
    key,
    scopes: SCOPES,
    values: [{ value, context: 'all' }],
  };
  try {
    await api(`/accounts/${accountSlug}/env/${encodeURIComponent(key)}?site_id=${siteId}`, {
      method: 'PATCH',
      body: payload,
    });
    return 'patched';
  } catch { /* create */ }
  try {
    await api(`/accounts/${accountSlug}/env/${encodeURIComponent(key)}?site_id=${siteId}`, {
      method: 'PUT',
      body: payload,
    });
    return 'put';
  } catch { /* create */ }
  await api(`/accounts/${accountSlug}/env?site_id=${siteId}`, {
    method: 'POST',
    body: [payload],
  });
  return 'created';
}

async function unsetEnv(accountSlug, siteId, key) {
  try {
    await api(`/accounts/${accountSlug}/env/${encodeURIComponent(key)}?site_id=${siteId}`, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

function usablePhone(raw) {
  const s = String(raw || '');
  if (!s || s.includes('*')) return false;
  return s.replace(/\D+/g, '').length >= 10;
}

const sites = await api('/sites?per_page=100');
const lista = Array.isArray(sites) ? sites : (sites?.sites || []);
const trafego = lista.find((s) => s.name === TRAFEGO);
const helena = lista.find((s) => s.name === HELENA);
if (!trafego || !helena) {
  console.log('postinstall-funil: sites não achados', { trafego: !!trafego, helena: !!helena });
  process.exit(0);
}
const accountSlug = trafego.account_slug || helena.account_slug;

const howT = await setEnv(accountSlug, trafego.id, 'FUNIL_PROXY_KEY', FUNIL_KEY);
const howH = await setEnv(accountSlug, helena.id, 'FUNIL_PROXY_KEY', FUNIL_KEY);
console.log(`FUNIL_PROXY_KEY → ${TRAFEGO}:${howT} · ${HELENA}:${howH}`);

const unset = await unsetEnv(accountSlug, trafego.id, 'BRUNO_PHONE');
console.log(`BRUNO_PHONE unset ${TRAFEGO}: ${unset ? 'ok' : 'skip'}`);

try {
  const envT = await api(`/accounts/${accountSlug}/env?site_id=${trafego.id}`);
  const ceo = pickEnv(envT, 'WHATSAPP_CEO') || pickEnv(envT, 'WHATSAPP_MICHEL');
  const dig = String(ceo || '').replace(/\D+/g, '');
  console.log(`ceo_readable=${usablePhone(ceo)} len=${String(ceo || '').length} digits=${dig.length}`);
  if (usablePhone(ceo)) {
    await setEnv(accountSlug, helena.id, 'WHATSAPP_CEO', ceo);
    await setEnv(accountSlug, helena.id, 'BRUNO_PHONE', ceo);
    console.log('WHATSAPP_CEO/BRUNO_PHONE espelhados na Helena ✔');
  }
} catch (e) {
  console.log('espelho CEO falhou:', String(e.message || e));
}

console.log('postinstall-funil: fim');
