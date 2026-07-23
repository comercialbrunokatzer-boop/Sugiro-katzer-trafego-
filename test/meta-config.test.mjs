import { test } from 'node:test';
import assert from 'node:assert/strict';
import { META_AD_ACCOUNT, META_GRAPH } from '../netlify/functions/_meta-config.mjs';

test('META_AD_ACCOUNT tem valor padrão correto quando env não definida', () => {
  // A env META_AD_ACCOUNT não está definida no ambiente de testes → usa o default.
  assert.equal(META_AD_ACCOUNT, process.env.META_AD_ACCOUNT || 'act_1150648749960943');
});

test('META_GRAPH tem valor padrão correto quando env não definida', () => {
  assert.equal(META_GRAPH, process.env.META_GRAPH || 'https://graph.facebook.com/v20.0');
});

test('META_AD_ACCOUNT começa com "act_"', () => {
  assert.match(META_AD_ACCOUNT, /^act_/);
});

test('META_GRAPH é URL válida da Graph API', () => {
  assert.match(META_GRAPH, /^https:\/\/graph\.facebook\.com\//);
});
