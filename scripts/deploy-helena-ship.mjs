#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TOKEN = process.env.NETLIFY_AUTH_TOKEN || process.env.BLOBS_TOKEN || '';
const HELENA_SITE = process.env.HELENA_SITE_NAME || 'regal-chaja-662035';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ship = join(root, 'helena-ship');

if (!TOKEN) {
  console.log('deploy-helena-ship: sem NETLIFY_AUTH_TOKEN — pulado');
  process.exit(0);
}
if (!existsSync(join(ship, 'netlify/functions/helena.js'))) {
  console.log('deploy-helena-ship: helena-ship ausente — pulado');
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
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`Netlify ${method} ${path}: HTTP ${r.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: process.env, ...opts });
  return r.status === 0;
}

try {
  const sites = await api('/sites?per_page=100');
  const lista = Array.isArray(sites) ? sites : (sites?.sites || []);
  const helena = lista.find((s) => s.name === HELENA_SITE);
  if (!helena) {
    console.log('deploy-helena-ship: site não achado', HELENA_SITE);
    process.exit(0);
  }
  console.log(`deploy-helena-ship: site ${HELENA_SITE} (${helena.id})`);
  if (!existsSync(join(ship, 'maestro/src/bitrixRead.js'))) {
    throw new Error('maestro/ ausente no helena-ship — aborta');
  }
  if (!sh('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: ship })) {
    throw new Error('npm install helena-ship falhou');
  }
  mkdirSync(join(ship, '_pub'), { recursive: true });
  writeFileSync(join(ship, '_pub/index.html'), '<!doctype html><title>Helena</title>');
  const ok = sh('npx', [
    '--yes', 'netlify-cli@17',
    'deploy', '--prod',
    '--dir', '_pub',
    '--functions', 'netlify/functions',
    '--site', helena.id,
  ], { cwd: ship });
  if (!ok) throw new Error('netlify deploy helena falhou');
  console.log('deploy-helena-ship: OK');
} catch (e) {
  console.error('deploy-helena-ship: FALHOU', e && e.message ? e.message : e);
  process.exit(1);
}
