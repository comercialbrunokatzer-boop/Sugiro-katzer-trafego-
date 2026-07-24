import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichComCiclo } from '../netlify/functions/_meta-ciclo.mjs';

test('enrichComCiclo: ativa mostra dataSubiu', () => {
  const mapa = {
    '123': {
      id: '123', status: 'ACTIVE', ativa: true, pausada: false,
      inicioBR: '20/07/2024', pausaBR: null,
      rotulo: 'Ativa · subiu 20/07/2024',
    },
  };
  const r = enrichComCiclo({ id: '123', nome: 'Helena' }, mapa);
  assert.equal(r.dataSubiu, '20/07/2024');
  assert.equal(r.dataPausada, null);
  assert.match(r.cicloRotulo, /Ativa/);
});

test('enrichComCiclo: pausada mostra dataPausada', () => {
  const mapa = {
    CampX: {
      id: '9', status: 'PAUSED', ativa: false, pausada: true,
      inicioBR: '01/07/2024', pausaBR: '22/07/2024',
      rotulo: 'Pausada 22/07/2024 · subiu 01/07/2024',
    },
  };
  const r = enrichComCiclo({ nome: 'CampX' }, mapa);
  assert.equal(r.dataPausada, '22/07/2024');
  assert.equal(r.dataSubiu, '01/07/2024');
});
