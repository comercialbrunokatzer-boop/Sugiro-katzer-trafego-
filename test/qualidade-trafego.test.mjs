import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizaQualTrafego,
  fonteEhTrafegoPago,
  deveAlertarManter,
  badgeCampanha,
  agregaQualidadePorCampanha,
} from '../netlify/functions/_qualidade-trafego.mjs';

test('escala Potencial/Interessado/Curioso/Fake/Ruim', () => {
  assert.equal(normalizaQualTrafego('Potencial'), 'potencial');
  assert.equal(normalizaQualTrafego('INTERESSADO'), 'interessado');
  assert.equal(normalizaQualTrafego('A'), 'interessado');
  assert.equal(normalizaQualTrafego('sem justificativa'), 'sem_justificativa');
});

test('fontes tráfego pago vs fora', () => {
  assert.equal(fonteEhTrafegoPago('FACEBOOK ADS'), true);
  assert.equal(fonteEhTrafegoPago('PATROCINADO CORRETOR'), true);
  assert.equal(fonteEhTrafegoPago('CANAL ABERTO'), true);
  assert.equal(fonteEhTrafegoPago('CHAMADA'), false);
  assert.equal(fonteEhTrafegoPago('FEIRA'), false);
});

test('alerta Manter em BR_SC cara + Fake/Ruim', () => {
  assert.equal(deveAlertarManter({
    cpl: 78.96,
    qual: 'bad',
    detail: { fake: 2, ruim: 1 },
  }), true);
  assert.equal(deveAlertarManter({
    cpl: 9.21,
    qual: 'good',
    detail: { fake: 0, ruim: 0 },
  }), false);
});

test('agrega qualidade por campanha', () => {
  const mapa = agregaQualidadePorCampanha([
    { campanha: 'FortMyers_BR_SC', fonte: 'FACEBOOK ADS', qualidadeIa: 'fake' },
    { campanha: 'FortMyers_BR_SC', fonte: 'FACEBOOK ADS', qualidadeIa: 'ruim' },
    { campanha: 'VIDEO', fonte: 'demo', qualidadeIa: 'interessado' },
  ]);
  assert.equal(mapa.get('FortMyers_BR_SC').fake, 1);
  assert.equal(mapa.get('FortMyers_BR_SC').ruim, 1);
  assert.equal(badgeCampanha(78.96, mapa.get('FortMyers_BR_SC'), { forms: 8, gasto: 600 }), 'bad');
});

test('linkWhatsApp monta wa.me', async () => {
  const { linkWhatsApp } = await import('../netlify/functions/_qualidade-trafego.mjs');
  assert.equal(linkWhatsApp('47 99999-8888'), 'https://wa.me/5547999998888');
  assert.equal(linkWhatsApp('47 9xxxx'), null);
});
