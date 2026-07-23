import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pontualidade, estadoVazio, hm2min } from '../netlify/functions/_rotina.mjs';

test('pontualidade: estados aguardando / concluido / atrasado', () => {
  const e = estadoVazio('2026-07-23', 'casa');
  e.tarefas.reunioes = { min: hm2min('08:00'), hora: '08:00' };
  e.tarefas.agend = { min: hm2min('08:25'), hora: '08:25' };
  const P = pontualidade(e, hm2min('08:30'));
  const reun = P.linhas.find((l) => l.id === 'reunioes');
  const ag = P.linhas.find((l) => l.id === 'agend');
  const disc = P.linhas.find((l) => l.id === 'discadora');
  assert.equal(reun.estado, 'concluido');
  assert.equal(ag.estado, 'atrasado');
  assert.equal(disc.estado, 'aguardando');
  assert.equal(P.linhas.find((l) => l.id === 'campanhas'), undefined);
});

test('pontualidade: nao_realizado após fim do dia; bloqueado no domingo', () => {
  const e = estadoVazio('2026-07-23', 'casa');
  const tarde = pontualidade(e, hm2min('14:00'), { fimDiaMin: hm2min('13:00') });
  assert.equal(tarde.linhas.find((l) => l.id === 'reunioes').estado, 'nao_realizado');
  const dom = pontualidade(e, hm2min('10:00'), { domingo: true });
  assert.ok(dom.linhas.every((l) => l.estado === 'bloqueado'));
});
