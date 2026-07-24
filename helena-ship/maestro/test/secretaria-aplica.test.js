import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montaFieldsUF, planoDeEscrita, aplica } from '../src/secretariaAplica.js';
import { CAMPO } from '../src/camposSecretaria.js';

test('montaFieldsUF: resolve o que dá e PULA o que não resolve (Lei 01)', () => {
  const f = montaFieldsUF({
    produto: 'Fort Myers', temperatura: 'quente', finalidade: 'moradia',
    faixaValor: 1_200_000, prazoMeses: 3, cidade: 'inexistente-xyz',
  });
  assert.equal(f[CAMPO.PRODUTO], '767');
  assert.equal(f[CAMPO.TEMPERATURA], '89');
  assert.equal(f[CAMPO.FINALIDADE], '79');
  assert.equal(f[CAMPO.FAIXA_PRECO], '483'); // De 1mi até 1.5mi
  assert.equal(f[CAMPO.PRAZO_COMPRA], '629'); // 3 meses
  assert.equal(f[CAMPO.CIDADE], undefined);   // não resolveu -> não entra
});

test('montaFieldsUF: campos vazios -> objeto vazio (nunca chuta)', () => {
  assert.deepEqual(montaFieldsUF({}), {});
  assert.deepEqual(montaFieldsUF({ finalidade: 'sei lá', faixaValor: 0 }), {});
});

const decisaoVerde = {
  acao: 'ATUALIZAR',
  update: { id: '6653', fields: { STAGE_ID: 'C1:PREPAYMENT_INVOICE', COMMENTS: '🤖 Secretária' }, _estagio: 'Mapeamento' },
};

test('planoDeEscrita: zona verde -> junta STAGE_ID/COMMENTS + campos UF', () => {
  const plano = planoDeEscrita(decisaoVerde, { dealId: '6653', campos: { finalidade: 'moradia' } });
  assert.equal(plano.id, '6653');
  assert.equal(plano.fields.STAGE_ID, 'C1:PREPAYMENT_INVOICE');
  assert.equal(plano.fields.COMMENTS, '🤖 Secretária');
  assert.equal(plano.fields[CAMPO.FINALIDADE], '79');
  assert.equal(plano._zona, 'verde');
});

test('planoDeEscrita: PROPOR/REVISÃO -> NULL (zona vermelha nunca escreve sozinha)', () => {
  assert.equal(planoDeEscrita({ acao: 'PROPOR', update: decisaoVerde.update }, { dealId: '1' }), null);
  assert.equal(planoDeEscrita({ acao: 'REVISAO_HUMANA' }, { dealId: '1' }), null);
});

test('aplica: homolog -> NÃO escreve (dry-run), devolve o plano', async () => {
  const plano = planoDeEscrita(decisaoVerde, { dealId: '6653', campos: {} });
  let chamou = false;
  const r = await aplica(plano, { modo: 'homolog', atualizaNegocio: async () => { chamou = true; } });
  assert.equal(r.aplicado, false);
  assert.match(r.motivo, /homolog/);
  assert.equal(chamou, false);
  assert.ok(r.plano);
});

test('aplica: producao -> chama o writer com id + fields', async () => {
  const plano = planoDeEscrita(decisaoVerde, { dealId: '6653', campos: { temperatura: 'quente' } });
  let capturado = null;
  const r = await aplica(plano, {
    modo: 'producao',
    atualizaNegocio: async (id, fields) => { capturado = { id, fields }; return { ok: true }; },
  });
  assert.equal(r.aplicado, true);
  assert.equal(capturado.id, '6653');
  assert.equal(capturado.fields.STAGE_ID, 'C1:PREPAYMENT_INVOICE');
  assert.equal(capturado.fields[CAMPO.TEMPERATURA], '89');
});

test('aplica: sem plano (zona vermelha) -> não escreve nem em producao', async () => {
  let chamou = false;
  const r = await aplica(null, { modo: 'producao', atualizaNegocio: async () => { chamou = true; } });
  assert.equal(r.aplicado, false);
  assert.equal(chamou, false);
});
