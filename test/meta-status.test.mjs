import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificaMetaResultado, mensagemMeta } from '../netlify/functions/_meta-status.mjs';

test('erro de token ausente NÃO é confiável (não vira zero real)', () => {
  const m = classificaMetaResultado({ temToken: false, conta: 'act_x' });
  assert.equal(m.status, 'token_ausente');
  assert.equal(m.confiavel, false);
  assert.match(mensagemMeta(m), /Não foi possível acessar|indisponíveis|correção/i);
});

test('erro de API (permissão) NÃO é confiável', () => {
  const m = classificaMetaResultado({
    temToken: true, httpOk: false,
    bodyError: { code: 200, message: 'Permissions error' },
    conta: 'act_x',
  });
  assert.equal(m.status, 'permissao');
  assert.equal(m.confiavel, false);
});

test('API ok sem gasto no período é confiável (sem_gasto)', () => {
  const m = classificaMetaResultado({
    temToken: true, httpOk: true, nBruto: 3, nComGasto: 0, conta: 'act_x',
  });
  assert.equal(m.status, 'sem_gasto');
  assert.equal(m.confiavel, true);
  assert.match(m.mensagemPainel, /Nenhum gasto/i);
});

test('API ok com campanhas e gasto é ok', () => {
  const m = classificaMetaResultado({
    temToken: true, httpOk: true, nBruto: 5, nComGasto: 4, conta: 'act_x',
  });
  assert.equal(m.status, 'ok');
  assert.equal(m.confiavel, true);
  assert.equal(m.mensagemPainel, null);
});

test('API ok sem nenhuma linha de insights = sem_campanha', () => {
  const m = classificaMetaResultado({
    temToken: true, httpOk: true, nBruto: 0, nComGasto: 0, conta: 'act_x',
  });
  assert.equal(m.status, 'sem_campanha');
  assert.equal(m.confiavel, true);
});
