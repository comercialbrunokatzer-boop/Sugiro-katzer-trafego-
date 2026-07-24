import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraiCampos } from '../src/secretariaExtrai.js';
import { montaFieldsUF } from '../src/secretariaAplica.js';
import { CAMPO } from '../src/camposSecretaria.js';

test('extraiCampos: pega finalidade e prazo do formulário (caso Artur)', () => {
  const texto = 'Qual é o seu objetivo com a compra de um apartamento?: Moradia\n'
    + 'Em quanto tempo você pretende comprar?: 3 meses';
  const c = extraiCampos(texto);
  assert.equal(c.finalidade, 'moradia');
  assert.equal(c.prazoMeses, 3);
});

test('extraiCampos: prazo > 6 meses NÃO preenche (fora da faixa oficial)', () => {
  const c = extraiCampos('Em quanto tempo pretende comprar?: Mais de 12 meses');
  assert.equal(c.prazoMeses, undefined);
});

test('extraiCampos: finalidade por palavra-chave clara (locação/revenda)', () => {
  assert.equal(extraiCampos('é pra alugar mesmo, quero renda').finalidade, 'locação');
  assert.equal(extraiCampos('comprei pra revender depois').finalidade, 'revenda');
});

test('extraiCampos: "investimento" sozinho é ambíguo -> NÃO define (Lei 01)', () => {
  const c = extraiCampos('quero um bom investimento');
  assert.equal(c.finalidade, undefined);
});

test('extraiCampos: prazo por extenso (três meses)', () => {
  assert.equal(extraiCampos('penso em comprar em tres meses').prazoMeses, 3);
});

test('extraiCampos + montaFieldsUF: o caso Artur vira os UF certos', () => {
  const texto = 'objetivo com a compra?: Moradia\nEm quanto tempo?: 2 meses';
  const f = montaFieldsUF(extraiCampos(texto));
  assert.equal(f[CAMPO.FINALIDADE], '79');  // Moradia
  assert.equal(f[CAMPO.PRAZO_COMPRA], '627'); // 2 meses
});

test('extraiCampos: texto vazio -> objeto vazio', () => {
  assert.deepEqual(extraiCampos(''), {});
  assert.deepEqual(extraiCampos('oi tudo bem?'), {});
});
