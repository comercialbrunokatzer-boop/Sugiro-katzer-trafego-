import { test } from 'node:test';
import assert from 'node:assert/strict';
import { META_AD_ACCOUNT, META_GRAPH } from '../netlify/functions/_meta-config.mjs';

// Esses testes assumem que META_AD_ACCOUNT / META_GRAPH não estão no ambiente de CI,
// então validam os defaults concretos. Se as env vars estiverem definidas, o comportamento
// esperado é respeitar o override — coberto pelos últimos dois testes (formato).

test('META_AD_ACCOUNT usa o ID de conta padrão quando env ausente', () => {
  if (!process.env.META_AD_ACCOUNT) {
    assert.equal(META_AD_ACCOUNT, 'act_1150648749960943');
  }
});

test('META_GRAPH usa a URL padrão da Graph API quando env ausente', () => {
  if (!process.env.META_GRAPH) {
    assert.equal(META_GRAPH, 'https://graph.facebook.com/v20.0');
  }
});

test('META_AD_ACCOUNT começa com "act_"', () => {
  assert.match(META_AD_ACCOUNT, /^act_/);
});

test('META_GRAPH é URL válida da Graph API', () => {
  assert.match(META_GRAPH, /^https:\/\/graph\.facebook\.com\//);
});
