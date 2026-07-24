import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selecionaParaContato } from '../src/varreduraCarteira.js';

const AGORA = 1_000_000_000_000;
const h = (n) => n * 3600000;

const deals = [
  { dealId: '1', stageId: 'C1:NEW',         phone: '5547999990001', ultimaAtividadeMs: AGORA - h(50), title: 'parado 50h' },
  { dealId: '2', stageId: 'C1:PREPARATION', phone: '5547999990002', ultimaAtividadeMs: AGORA - h(30), title: 'parado 30h' },
  { dealId: '3', stageId: 'C1:NEW',         phone: '5547999990003', ultimaAtividadeMs: AGORA - h(2),  title: 'ativo 2h' },
  { dealId: '4', stageId: 'C1:FINAL_INVOICE', phone: '5547999990004', ultimaAtividadeMs: AGORA - h(99), title: 'fase avançada' },
  { dealId: '5', stageId: 'C1:NEW',         phone: '',              ultimaAtividadeMs: AGORA - h(99), title: 'sem telefone' },
  { dealId: '6', stageId: 'C1:NEW',         phone: '5547999990006', title: 'sem atividade registrada' },
];

test('só Leads Novos / Tentando Contato entram (fase avançada fica de fora)', () => {
  const r = selecionaParaContato(deals, { agoraMs: AGORA, paradoHorasMin: 24, maxLote: 10 });
  const ids = r.lote.map((d) => d.dealId);
  assert.ok(ids.includes('1') && ids.includes('2'));
  assert.ok(!ids.includes('4'));
});

test('só quem está parado há >= paradoHorasMin (o de 2h fica fora)', () => {
  const r = selecionaParaContato(deals, { agoraMs: AGORA, paradoHorasMin: 24, maxLote: 10 });
  assert.ok(!r.lote.map((d) => d.dealId).includes('3'));
});

test('sem telefone é ignorado; sem atividade registrada conta como parado', () => {
  const r = selecionaParaContato(deals, { agoraMs: AGORA, paradoHorasMin: 24, maxLote: 10 });
  const ids = r.lote.map((d) => d.dealId);
  assert.ok(!ids.includes('5'));
  assert.ok(ids.includes('6'));
});

test('mais PARADO primeiro: sem registro > mais antigo', () => {
  const r = selecionaParaContato(deals, { agoraMs: AGORA, paradoHorasMin: 24, maxLote: 10 });
  assert.equal(r.lote[0].dealId, '6');
  const ids = r.lote.map((d) => d.dealId);
  assert.ok(ids.indexOf('1') < ids.indexOf('2'));
});

test('lote é limitado (gradual) e reporta quantos restam', () => {
  const r = selecionaParaContato(deals, { agoraMs: AGORA, paradoHorasMin: 24, maxLote: 1 });
  assert.equal(r.lote.length, 1);
  assert.equal(r.restam, r.elegiveis - 1);
});

test('pula quem já foi contatado hoje (anti-spam)', () => {
  const r = selecionaParaContato(deals, { agoraMs: AGORA, paradoHorasMin: 24, maxLote: 10, jaContatados: ['5547999990001'] });
  assert.ok(!r.lote.map((d) => d.dealId).includes('1'));
});
