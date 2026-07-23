import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montaRecomendacoes } from '../netlify/functions/_recomendacoes.mjs';

test('recomendacoes: texto canônico Bruno + botões', () => {
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
  const br = r.recomendacoes[0];
  assert.equal(br.produto, 'FORT MYERS - PIÇARRAS');
  assert.match(br.publico, /9 leads a R\$ 77/);
  assert.equal(br.problema, 'Mesma cidade que Alicerce, mas CPL 3x maior');
  assert.equal(br.recomendacao, 'MANTER BR_SC, mas trocar criativo');
  assert.equal(br.acao, 'Gravar com Carol a mesma fórmula do Alicerce (R$ 18) para Fort Myers');
  assert.deepEqual(br.botoes, ['aplicar', 'ajustar', 'agora-nao']);
  const am = r.recomendacoes[1];
  assert.equal(am.produto, 'AMANAY - ITAPOÁ');
  assert.equal(am.oportunidade, '24 leads a R$ 11 - menor CPL da conta');
  assert.equal(am.acao, 'Duplicar Amanay com R$ 30/dia - público SC+PR');
  assert.equal(am.valorDiaSugerido, 30);
});
