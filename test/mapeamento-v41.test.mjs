import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  identidadeCampanha, cidadeDoMapa, rotuloProdutoCidade, MAPA_V41,
  parseNomeCanonico, montaNomeCanonico, normalizaCidade, slugMix,
} from '../netlify/functions/_mapeamento-v41.mjs';
import { montaMixVerba, MIX_VERBA_80, MIX_VERBA_TOTAL_PCT } from '../netlify/functions/_mix-verba.mjs';
import { cidadeReal, enriqueceCampanha } from '../netlify/functions/_campanhas-regras.mjs';

test('slug mix Bruno: AMANAY_ITAPOA_ROGGA_BR-SC', () => {
  const p = parseNomeCanonico('AMANAY_ITAPOA_ROGGA_BR-SC');
  assert.equal(p.produto, 'Amanay');
  assert.equal(p.cidade, 'Itapoá');
  assert.equal(p.construtora, 'Rogga');
  assert.equal(p.publico, 'BR-SC');
});

test('Fort Myers = Penha (não Piçarras)', () => {
  const id = identidadeCampanha('FORTMYERS_PENHA_VETTER_BR-SC');
  assert.equal(id.produto, 'Fort Myers');
  assert.equal(id.cidade, 'Penha');
  assert.equal(id.construtora, 'Vetter');
  assert.equal(cidadeReal('FortMyers_BR_SC'), 'Penha');
});

test('Barra View = Santer · Barra Velha', () => {
  const id = identidadeCampanha('BARRAVIEW_BARRAVELHA_SANTER_BR-SC');
  assert.equal(id.produto, 'Barra View');
  assert.equal(id.cidade, 'Barra Velha');
  assert.equal(id.construtora, 'Santer');
});

test('Grant Home no mapa', () => {
  const id = identidadeCampanha('GRANTHOME_BARRAVELHA_ROGGA_BR-SC');
  assert.equal(id.produto, 'Grant Home');
  assert.equal(id.cidade, 'Barra Velha');
  assert.equal(id.construtora, 'Rogga');
});

test('mix 80% = 30+20+15+15', () => {
  assert.equal(MIX_VERBA_TOTAL_PCT, 80);
  assert.equal(MIX_VERBA_80[0].pct, 30);
  assert.equal(MIX_VERBA_80[1].pct, 20);
  const m = montaMixVerba(1000);
  assert.equal(m.linhas[0].valorDia, 300);
  assert.equal(m.linhas[1].valorDia, 200);
  assert.equal(m.linhas[2].valorDia, 150);
  assert.equal(m.linhas[3].valorDia, 150);
  assert.match(m.regra, /inglês|Curioso/i);
});

test('sem estrutura EN nos produtos do mix', () => {
  for (const row of MAPA_V41.filter((r) => ['amanay', 'fort_myers', 'barra_view', 'grant_home'].includes(r.chave))) {
    assert.equal(row.atendeIngles, false);
  }
  const eua = identidadeCampanha('FORTMYERS_PENHA_VETTER_EUA_Americanos');
  assert.equal(eua.inglesSemEstrutura, true);
});

test('schema 6 slots ainda funciona', () => {
  const nome = '[FORT MYERS]_[PENHA]_[VETTER]_[BR-SC]_[23/07/26]_[LEAD]';
  const p = parseNomeCanonico(nome);
  assert.equal(p.cidade, 'Penha');
  assert.equal(p.publico, 'BR-SC');
});

test('montaNomeCanonico + slugMix', () => {
  assert.equal(
    slugMix('Amanay', 'Itapoá', 'Rogga', 'BR-SC'),
    'AMANAY_ITAPOA_ROGGA_BR-SC',
  );
  assert.match(montaNomeCanonico({
    produto: 'Fort Myers', cidade: 'Penha', construtora: 'Vetter', publico: 'BR-SC',
  }), /Penha/);
});

test('legado ROGGA+AMANAY', () => {
  const am = identidadeCampanha('[ROGGA][AMANAY][27/09/25]');
  assert.equal(am.produto, 'Amanay');
  assert.equal(am.cidade, 'Itapoá');
});

test('enriqueceCampanha expõe Penha + mix fields', () => {
  const e = enriqueceCampanha({
    nome: 'FORTMYERS_PENHA_VETTER_BR-SC',
    leads: 12, cpl: 20, leadConfirmado: true,
  });
  assert.equal(e.cidade, 'Penha');
  assert.equal(e.atendeIngles, false);
  assert.equal(rotuloProdutoCidade(e.nome), 'Fort Myers · Penha');
  assert.equal(cidadeDoMapa('AYA_PICARRAS_ALICERCE_BR-SC'), 'Piçarras');
  assert.equal(normalizaCidade('PENHA'), 'Penha');
});
