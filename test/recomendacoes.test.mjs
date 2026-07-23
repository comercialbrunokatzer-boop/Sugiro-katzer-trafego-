import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montaRecomendacoes,
  sugestaoPrincipalV4,
  ehPublicoProibidoEscalar,
  DECISAO_VERSAO,
} from '../netlify/functions/_recomendacoes.mjs';

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
  assert.equal(r.versao, DECISAO_VERSAO);
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

test('V4: NÃO sugerir EUA_Americanos a R$7 — principal = Amanay', () => {
  assert.equal(ehPublicoProibidoEscalar('[FortMyers_EUA_Americanos][10/07/26]'), true);
  assert.equal(ehPublicoProibidoEscalar('FortMyers_BR_SC'), false);

  const r = montaRecomendacoes({
    operacional7d: {
      logSeguro: [
        { campanha: '[FortMyers_EUA_Americanos]', leads: 3, cpl: 7, gasto: 21 },
        { campanha: 'FortMyers_BR_SC', leads: 9, cpl: 77, gasto: 693 },
      ],
    },
    contaMaxima: {
      top10Cpl: [
        { campanha: '[ROGGA][AMANAY]', leadsForm: 24, cplForm: 11 },
      ],
    },
  });
  const s = sugestaoPrincipalV4(r.recomendacoes);
  assert.ok(s);
  assert.equal(s.versao, 'V4');
  assert.match(s.titulo, /Amanay/i);
  assert.equal(s.cidade, 'Itapoá');
  assert.ok(!/Americanos/i.test(s.titulo + s.campanha + s.motivo));
  assert.equal(s.leads, 24);
  assert.equal(s.valorDia, 30);
  assert.equal(s.cardsV4.length, 2);
  assert.equal(s.cardsV4[0].tipo, 'trocar_criativo');
});
