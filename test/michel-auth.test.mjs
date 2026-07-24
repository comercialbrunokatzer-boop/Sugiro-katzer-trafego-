import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autorizaCliqueMichel,
  senhaGestorOk,
  sha256,
  MICHEL_HASH_PADRAO,
  GESTOR_HASH,
} from '../netlify/functions/_michel-auth.mjs';

test('hash padrão MichelMeta2026 bate', () => {
  assert.equal(sha256('MichelMeta2026'), MICHEL_HASH_PADRAO);
  assert.equal(sha256('Davi2026@'), GESTOR_HASH);
});

test('sem chave → bloqueia Meta', () => {
  const r = autorizaCliqueMichel({}, {});
  assert.equal(r.ok, false);
  assert.equal(r.precisaMichel, true);
});

test('chave Michel ok → libera', () => {
  const r = autorizaCliqueMichel(
    { headers: { 'x-michel-key': 'MichelMeta2026' } },
    {},
  );
  assert.equal(r.ok, true);
  assert.equal(r.quem, 'Michel');
});

test('senha do gestor NÃO executa Meta', () => {
  const r = autorizaCliqueMichel(
    { headers: { 'x-michel-key': 'Davi2026@' } },
    {},
  );
  assert.equal(r.ok, false);
  assert.match(r.motivo, /gestor/i);
});

test('gestor ainda lê feed com senha dele', () => {
  assert.equal(senhaGestorOk({ headers: { 'x-gestor-key': 'Davi2026@' } }), true);
  assert.equal(senhaGestorOk({ headers: { 'x-gestor-key': 'MichelMeta2026' } }), false);
});

test('chave errada → bloqueia', () => {
  const r = autorizaCliqueMichel({ headers: { 'x-michel-key': 'errada' } }, {});
  assert.equal(r.ok, false);
});
