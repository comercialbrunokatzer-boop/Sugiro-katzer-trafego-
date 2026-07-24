import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculaCplQualidade,
  enriqueceComQualidade,
  textoCplBrutoVsBom,
  resumoCplBomQualidade,
  leadsBons,
  ordenaPorCpl,
  escolheMelhorParaEscalar,
} from '../netlify/functions/_qualidade.mjs';

test('CPL Bruto / CPL BOM — TESTE FORTMYERS (Bruno)', () => {
  // 39 leads, R$624 · 8 bom, 22 curioso, 6 errado, 3 comprador
  // Bruto 16 parece BOA · BOM 56,72 CARA
  const calc = calculaCplQualidade(
    { gasto: 624, leads: 39 },
    { bom: 8, curioso: 22, errado: 6, comprador: 3 },
  );
  assert.equal(calc.leadsTotais, 39);
  assert.equal(calc.leadsBons, 11);
  assert.equal(calc.cplBruto, 16);
  assert.equal(calc.cplBom, 56.73); // 624/11 = 56,727… (Bruno ~R$56,72)
  assert.equal(calc.semaforoBruto.codigo, 'BOA');
  assert.equal(calc.semaforoBom.codigo, 'CARO');
  assert.equal(calc.semaforoDecisao.codigo, 'CARO');
  assert.ok(Math.abs(calc.cplBom - 56.72) < 0.02);
  assert.match(textoCplBrutoVsBom(calc), /CPL Bruto R\$ 16/);
  assert.match(textoCplBrutoVsBom(calc), /CPL BOM/);
  assert.match(textoCplBrutoVsBom(calc), /11 bons de 39/);
});

test('CPL BOM — AMANAY ITAPOÁ melhor da conta (Bruno)', () => {
  // 24 leads, R$264 · 20 bons → Bruto 11 · BOM 13,20
  const calc = calculaCplQualidade(
    { gasto: 264, leads: 24 },
    { bom: 20, curioso: 4, errado: 0, comprador: 0 },
  );
  assert.equal(calc.cplBruto, 11);
  assert.equal(calc.cplBom, 13.2);
  assert.equal(calc.pctBons, 83);
  assert.equal(calc.semaforoBom.codigo, 'BOA');
  assert.equal(calc.semaforoDecisao.codigo, 'BOA');
});

test('leadsBons = Bom + Comprador (não Curioso/Errado)', () => {
  assert.equal(leadsBons({ bom: 8, curioso: 22, errado: 6, comprador: 3 }), 11);
  assert.equal(leadsBons({ bom: 20, curioso: 4 }), 20);
});

test('sem qualidade marcada → só Bruto, sem BOM', () => {
  const calc = calculaCplQualidade({ gasto: 624, leads: 39 }, null);
  assert.equal(calc.temQualidade, false);
  assert.equal(calc.cplBruto, 16);
  assert.equal(calc.cplBom, null);
  assert.equal(calc.semaforoDecisao.codigo, 'BOA');
  assert.match(textoCplBrutoVsBom(calc), /ainda não marcada/);
});

test('enriquece + resumo: Fort Myers cara, Amanay destaque', () => {
  const mapa = {
    fm: { id: 'fm', nome: 'TESTE FORTMYERS', bom: 8, curioso: 22, errado: 6, comprador: 3 },
    am: { id: 'am', nome: 'AMANAY ITAPOÁ', bom: 20, curioso: 4, errado: 0, comprador: 0 },
  };
  const camps = [
    enriqueceComQualidade({ id: 'fm', nome: 'TESTE FORTMYERS', gasto: 624, leads: 39, cpl: 16 }, mapa),
    enriqueceComQualidade({ id: 'am', nome: 'AMANAY ITAPOÁ', gasto: 264, leads: 24, cpl: 11 }, mapa),
  ];
  assert.equal(camps[0].cplBom, 56.73); // 624/11 round2
  assert.equal(camps[1].cplBom, 13.2);
  assert.equal(camps[0].semaforoBom.codigo, 'CARO');
  assert.equal(camps[1].semaforoBom.codigo, 'BOA');

  const r = resumoCplBomQualidade(camps);
  assert.equal(r.fonte, 'cacador');
  assert.equal(r.destaque.cidade, 'Itapoá');
  assert.match(r.texto, /Itapoá/);
  assert.match(r.texto, /BOM/);
});

test('resumo sem caça → pendente (não inventa bom por CPL bruto)', () => {
  const r = resumoCplBomQualidade([
    { nome: 'TESTE FORTMYERS', gasto: 624, leads: 39, cpl: 16 },
  ]);
  assert.equal(r.fonte, 'pendente');
  assert.match(r.texto, /ainda não marcada/);
});

test('ordena por CPL BOM + escolhe menor BOM com ≥10 e público BR', () => {
  const mapa = {
    fm: { id: 'fm', nome: 'TESTE FORTMYERS', bom: 8, curioso: 22, errado: 6, comprador: 3 },
    am: { id: 'am', nome: 'AMANAY ITAPOÁ', bom: 20, curioso: 4, errado: 0, comprador: 0 },
    eua: { id: 'eua', nome: '[FortMyers_EUA_Americanos]', bom: 10, curioso: 0, errado: 0, comprador: 0 },
  };
  const camps = [
    enriqueceComQualidade({ id: 'fm', nome: 'TESTE FORTMYERS', gasto: 624, leads: 39, cpl: 16, leadConfirmado: true }, mapa),
    enriqueceComQualidade({ id: 'am', nome: 'AMANAY ITAPOÁ', gasto: 264, leads: 24, cpl: 11, leadConfirmado: true }, mapa),
    enriqueceComQualidade({ id: 'eua', nome: '[FortMyers_EUA_Americanos]', gasto: 70, leads: 12, cpl: 5.8, leadConfirmado: true }, mapa),
  ];
  const ord = ordenaPorCpl(camps, { modo: 'bom' });
  // lista ordena por CPL BOM puro (EUA R$7 aparece primeiro) — trava aparece na UI
  assert.equal(ord[0].id, 'eua');
  assert.equal(ord[1].id, 'am');
  const best = escolheMelhorParaEscalar(camps);
  assert.ok(best);
  assert.equal(best.metrica, 'cpl_bom');
  assert.equal(best.campanha.id, 'am'); // EUA bloqueado PUBLICO EXTERNO
  assert.equal(camps.find((c) => c.id === 'eua').travaEscalar.codigo, 'PUBLICO_EXTERNO');
  assert.ok(camps.find((c) => c.id === 'eua').bloqueadoEscalar);
});
