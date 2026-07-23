import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  identidadeCampanha, cidadeDoMapa, rotuloProdutoCidade, MAPA_V41,
  parseNomeCanonico, montaNomeCanonico, normalizaCidade,
} from '../netlify/functions/_mapeamento-v41.mjs';
import { cidadeReal, enriqueceCampanha } from '../netlify/functions/_campanhas-regras.mjs';

test('schema V4.1: [PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]', () => {
  const nome = '[FORT MYERS]_[PIÇARRAS]_[VETTER]_[BR_SC]_[23/07/26]_[LEAD]';
  const p = parseNomeCanonico(nome);
  assert.equal(p.produto, 'Fort Myers');
  assert.equal(p.cidade, 'Piçarras');
  assert.equal(p.construtora, 'Vetter');
  assert.equal(p.publico, 'BR_SC');
  assert.equal(p.data, '23/07/26');
  assert.equal(p.tipo, 'LEAD');
});

test('identidadeCampanha lê os 6 slots', () => {
  const id = identidadeCampanha('[AMANAY]_[ITAPOA]_[ROGGA]_[SC+PR]_[27/09/25]_[VIDEO]');
  assert.equal(id.produto, 'Amanay');
  assert.equal(id.cidade, 'Itapoá');
  assert.equal(id.construtora, 'Rogga');
  assert.equal(id.publico, 'SC+PR');
  assert.equal(id.data, '27/09/25');
  assert.equal(id.tipo, 'VIDEO');
  assert.equal(id.parseFonte, 'canonico');
  assert.match(id.schema, /PRODUTO.*CIDADE.*CONSTRUTORA.*PÚBLICO.*DATA.*TIPO/);
});

test('montaNomeCanonico gera o padrão Bruno', () => {
  const n = montaNomeCanonico({
    produto: 'Fort Myers',
    cidade: 'Piçarras',
    construtora: 'Vetter',
    publico: 'BR_SC',
    data: '23/07/26',
    tipo: 'LEAD',
  });
  assert.equal(n, '[Fort Myers]_[Piçarras]_[Vetter]_[BR_SC]_[23/07/26]_[LEAD]');
});

test('legado: não mistura produto como cidade', () => {
  const fm = identidadeCampanha('FortMyers_BR_SC');
  assert.equal(fm.produto, 'Fort Myers');
  assert.equal(fm.cidade, 'Piçarras');
  assert.equal(fm.publico, 'BR_SC');
  assert.notEqual(fm.cidade, 'Fort Myers');
});

test('legado: [ROGGA][AMANAY][data] → produto Amanay, cidade Itapoá', () => {
  const am = identidadeCampanha('[ROGGA][AMANAY][27/09/25] PR SC SP');
  assert.equal(am.produto, 'Amanay');
  assert.equal(am.cidade, 'Itapoá');
  assert.equal(am.construtora, 'Rogga');
});

test('legado: Barra View → Barra Velha', () => {
  const bv = identidadeCampanha('[BARRA VIEW][SANDRA][26/11/25]');
  assert.equal(bv.produto, 'Barra View');
  assert.equal(bv.cidade, 'Barra Velha');
});

test('Rogga sozinho NÃO vira cidade', () => {
  assert.equal(cidadeDoMapa('[ROGGA] só institutional'), '—');
  assert.equal(cidadeReal('[ROGGA] só institutional'), '—');
});

test('normalizaCidade', () => {
  assert.equal(normalizaCidade('PICARRAS'), 'Piçarras');
  assert.equal(normalizaCidade('ITAPOA'), 'Itapoá');
});

test('enriqueceCampanha expõe schema V4.1', () => {
  const e = enriqueceCampanha({
    nome: '[AYA]_[PIÇARRAS]_[ALICERCE]_[BR_SC]_[06/02/26]_[LEAD]',
    leads: 12, cpl: 10, leadConfirmado: true,
  });
  assert.equal(e.produto, 'Aya');
  assert.equal(e.cidade, 'Piçarras');
  assert.equal(e.construtora, 'Alicerce');
  assert.equal(e.publicoNome, 'BR_SC');
  assert.equal(e.dataCampanha, '06/02/26');
  assert.equal(e.tipoCampanha, 'LEAD');
});

test('MAPA_V41 fallback ainda existe', () => {
  assert.ok(MAPA_V41.length >= 4);
  assert.equal(rotuloProdutoCidade('AMANAY ITAPOÁ'), 'Amanay · Itapoá');
});
