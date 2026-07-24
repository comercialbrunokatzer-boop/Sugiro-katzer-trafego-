/**
 * Secretária IA (cérebro) — funil REAL da Katzer + regra do CEO (Mapeamento × Negociação).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estagioPorSinais, montaAtualizacao, ESTAGIO_BITRIX } from '../src/secretaria.js';

test('SECRETÁRIA: "quero marcar uma visita" é MAPEAMENTO (não negociação)', () => {
  assert.equal(estagioPorSinais('Oi, gostei do apê. Quero marcar uma visita pra ver'), 'Mapeamento');
});

test('SECRETÁRIA: preço/desconto/entrada ANTES da reunião ainda é MAPEAMENTO (regra do CEO)', () => {
  assert.equal(estagioPorSinais('Consegue um desconto? qual a entrada e como fica o financiamento?'), 'Mapeamento');
});

test('SECRETÁRIA: negociação REAL (fecho se abaixar) é NEGOCIAÇÃO', () => {
  assert.equal(estagioPorSinais('Fecho se você abaixar pra 950, é o meu limite'), 'Negociação');
});

test('SECRETÁRIA: pega a fase MAIS AVANÇADA quando há vários sinais', () => {
  // interesse (Mapeamento) + assinar contrato (Contrato) -> vence Contrato
  const txt = 'Quero ver o imóvel, e já me manda quais documentos preciso pra assinar o contrato';
  assert.equal(estagioPorSinais(txt), 'Contrato');
});

test('SECRETÁRIA: cliente engajou sem sinal forte -> Mapeamento', () => {
  assert.equal(estagioPorSinais('Oi, tudo bem? vi seu anúncio'), 'Mapeamento');
});

test('SECRETÁRIA: monta update pronto pro Bitrix com fase + resumo + próxima ação', () => {
  const up = montaAtualizacao(
    { estagio: 'Mapeamento', resumo: 'Cliente quer 3 suítes frente-mar, gostou do andar alto', proxima_acao: 'Conduzir pra reunião' },
    '4089',
  );
  assert.equal(up.id, '4089');
  assert.equal(up.fields.STAGE_ID, ESTAGIO_BITRIX['Mapeamento']);
  assert.match(up.fields.COMMENTS, /3 suítes/);
  assert.match(up.fields.COMMENTS, /Próxima ação: Conduzir pra reunião/);
  assert.match(up.fields.COMMENTS, /Secretária IA/);
});

test('SECRETÁRIA: fase inválida cai pra Mapeamento (nunca quebra)', () => {
  const up = montaAtualizacao({ estagio: 'Inventado', resumo: 'x' }, '1');
  assert.equal(up._estagio, 'Mapeamento');
  assert.equal(up.fields.STAGE_ID, 'C1:PREPAYMENT_INVOICE');
});
