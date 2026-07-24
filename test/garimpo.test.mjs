import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validaGarimpo,
  mensagemAlertaGarimpo,
  qtdMinLeads,
} from '../netlify/functions/_garimpo.mjs';

test('Garimpo qtd 0: passa sem nome', () => {
  const r = validaGarimpo({ qtd: '0' });
  assert.equal(r.ok, true);
  assert.equal(r.meta.qtd, '0');
  assert.equal(r.meta.leads.length, 0);
  assert.equal(r.meta.alertaGestor, true);
});

test('Garimpo qtd 1: exige nome', () => {
  assert.equal(validaGarimpo({ qtd: '1' }).ok, false);
  const r = validaGarimpo({ qtd: '1', nome: 'Maria Silva' });
  assert.equal(r.ok, true);
  assert.equal(r.meta.leads[0].nome, 'Maria Silva');
  assert.equal(r.meta.alertaGestor, false);
});

test('Garimpo qtd 2: exige 2 leads com nome', () => {
  const fail = validaGarimpo({
    qtd: '2',
    leads: [{ nome: 'Ana' }, { nome: 'Bo' }],
  });
  assert.equal(fail.ok, false);
  const ok = validaGarimpo({
    qtd: '2',
    leads: [{ nome: 'Ana Costa', telefone: '4799' }, { nome: 'Bruno Lima' }],
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.meta.leads.length, 2);
});

test('Garimpo 5+: alerta + mínimo 5 nomes', () => {
  assert.equal(qtdMinLeads('5+'), 5);
  const leads = Array.from({ length: 5 }, (_, i) => ({ nome: `Cliente ${i + 1} Ok` }));
  const r = validaGarimpo({ qtd: '5+', leads });
  assert.equal(r.ok, true);
  assert.equal(r.meta.alertaGestor, true);
});

test('mensagem alerta canônica', () => {
  const z = mensagemAlertaGarimpo({ qtd: '0', dataHm: '23/07 10:20' });
  assert.match(z, /GARIMPO KATZER: Michel encontrou \*0\* hoje/);
  assert.match(z, /dia zerado/);
  const f = mensagemAlertaGarimpo({
    qtd: '5+',
    dataHm: '23/07 10:20',
    leads: [{ nome: 'X', telefone: '1' }],
  });
  assert.match(f, /Dia excelente/);
});
