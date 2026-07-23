import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  identidadeCampanha, cidadeDoMapa, rotuloProdutoCidade, MAPA_V41,
} from '../netlify/functions/_mapeamento-v41.mjs';
import { cidadeReal, enriqueceCampanha } from '../netlify/functions/_campanhas-regras.mjs';

test('V4.1 — não mistura produto como cidade', () => {
  const fm = identidadeCampanha('FortMyers_BR_SC');
  assert.equal(fm.produto, 'Fort Myers');
  assert.equal(fm.cidade, 'Piçarras');
  assert.equal(fm.construtora, 'Vetter');
  assert.equal(fm.rotulo, 'Fort Myers · Piçarras');
  assert.notEqual(fm.cidade, 'Fort Myers');
});

test('V4.1 — Amanay = produto, Itapoá = cidade, Rogga = construtora', () => {
  const am = identidadeCampanha('[ROGGA][AMANAY][27/09/25] PR SC SP');
  assert.equal(am.produto, 'Amanay');
  assert.equal(am.cidade, 'Itapoá');
  assert.equal(am.construtora, 'Rogga');
});

test('V4.1 — Barra View + Sandra (corretor)', () => {
  const bv = identidadeCampanha('[BARRA VIEW][SANDRA][26/11/25]');
  assert.equal(bv.produto, 'Barra View');
  assert.equal(bv.cidade, 'Barra Velha');
  assert.equal(bv.corretor, 'Sandra');
});

test('V4.1 — Alicerce/Aya em Piçarras + corretor Alisson', () => {
  const a = identidadeCampanha('[ALICERCE][AYA][06/02/26] ALISSON');
  assert.equal(a.produto, 'Aya');
  assert.equal(a.cidade, 'Piçarras');
  assert.equal(a.construtora, 'Alicerce');
  assert.equal(a.corretor, 'Alisson');
});

test('V4.1 — Rogga sozinho NÃO vira cidade', () => {
  assert.equal(cidadeDoMapa('[ROGGA] só institutional'), '—');
  assert.equal(cidadeReal('[ROGGA] só institutional'), '—');
});

test('cidadeReal compat = só cidade do mapa', () => {
  assert.equal(cidadeReal('FortMyers_BR_SC'), 'Piçarras');
  assert.equal(cidadeReal('[ROGGA][AMANAY]'), 'Itapoá');
});

test('rotuloProdutoCidade pro ranking', () => {
  assert.equal(rotuloProdutoCidade('AMANAY ITAPOÁ'), 'Amanay · Itapoá');
});

test('enriqueceCampanha expõe os 4 campos', () => {
  const e = enriqueceCampanha({ nome: '[BARRA VIEW][SANDRA]', leads: 12, cpl: 10, leadConfirmado: true });
  assert.equal(e.produto, 'Barra View');
  assert.equal(e.cidade, 'Barra Velha');
  assert.equal(e.corretor, 'Sandra');
  assert.match(e.rotuloProdutoCidade, /Barra View/);
});

test('MAPA_V41 tem linhas oficiais', () => {
  assert.ok(MAPA_V41.length >= 4);
  assert.ok(MAPA_V41.every((r) => r.produto && ('cidade' in r)));
});
