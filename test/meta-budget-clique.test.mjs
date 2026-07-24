import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reaisParaCentavosMeta } from '../netlify/functions/_meta-acoes.mjs';

test('reaisParaCentavosMeta: 50 → 5000 centavos', () => {
  assert.equal(reaisParaCentavosMeta(50), 5000);
  assert.equal(reaisParaCentavosMeta('50'), 5000);
  assert.equal(reaisParaCentavosMeta('R$ 30'), 3000);
  assert.equal(reaisParaCentavosMeta('30,50'), 3050);
});

test('reaisParaCentavosMeta: inválido → null', () => {
  assert.equal(reaisParaCentavosMeta(0), null);
  assert.equal(reaisParaCentavosMeta(-10), null);
  assert.equal(reaisParaCentavosMeta(''), null);
  assert.equal(reaisParaCentavosMeta('abc'), null);
});
