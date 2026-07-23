import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montaRecomendacoes } from '../netlify/functions/_recomendacoes.mjs';

test('recomendacoes: BR_SC criativo + Amanay R$30', () => {
  const r = montaRecomendacoes({
    operacional7d: {
      logSeguro: [
        { campanha: 'FortMyers_BR_SC[10/07/26]', leads: 8, gasto: 613.48, cpl: 76.69 },
      ],
    },
    contaMaxima: {
      top10Cpl: [
        { campanha: '[ROGGA][AMANAY][VIDEO07][27/09/25] — Cópia', leadsForm: 24, gasto: 264.15, cplForm: 11.01 },
        { campanha: '[ALICERCE][AYA][VIDEO03][06/02/26] ALISSON', leadsForm: 56, gasto: 1013.3, cplForm: 18.09 },
      ],
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.metricaPrincipal, 'lead_formulario');
  assert.equal(r.recomendacoes.length, 2);
  const br = r.recomendacoes[0];
  assert.match(br.produto, /FORT MYERS/i);
  assert.match(br.acao, /Carol/i);
  assert.equal(br.numeros.cplBrSc7d, 76.69);
  assert.deepEqual(br.botoes, ['aplicar', 'ajustar', 'agora-nao']);
  const am = r.recomendacoes[1];
  assert.match(am.produto, /AMANAY/i);
  assert.equal(am.valorDiaSugerido, 30);
  assert.equal(am.numeros.leadsForm, 24);
  assert.equal(am.numeros.cplForm, 11.01);
});
