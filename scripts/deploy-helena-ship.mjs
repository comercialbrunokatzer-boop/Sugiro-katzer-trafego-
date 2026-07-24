#!/usr/bin/env node
/**
 * Deploy direto da Helena (snapshot helena-ship/) no site regal-chaja-662035.
 * Roda no CI do Tráfego (tem NETLIFY_AUTH_TOKEN). Bypass do build Git.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exit ${r.status}`);
}

const sites = await api('/sites?per_page=100');
const lista = Array.isArray(sites) ? sites : (sites?.sites || []);
const helena = lista.find((s) => s.name === HELENA_SITE);
if (!helena) {
  console.log('deploy-helena-ship: site não achado', HELENA_SITE);
  process.exit(0);
}

console.log(`deploy-helena-ship: site ${HELENA_SITE} (${helena.id})`);
sh('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: ship });

// publish mínimo (só pra CLI; o que importa são as functions)
sh('mkdir', ['-p', join(ship, '_pub')]);
sh('bash', ['-c', `echo '<!doctype html><title>Helena</title>' > '${join(ship, '_pub/index.html')}'`]);

sh('npx', [
  '--yes', 'netlify-cli@17',
  'deploy', '--prod',
  '--dir', '_pub',
  '--functions', 'netlify/functions',
  '--site', helena.id,
], { cwd: ship });

console.log('deploy-helena-ship: OK');
