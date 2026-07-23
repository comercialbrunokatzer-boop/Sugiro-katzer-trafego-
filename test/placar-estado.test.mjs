import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montaPlacar } from '../netlify/functions/_placar.mjs';
import {
  montaSugestoes, montaSugestaoPrincipal, registraDecisao, listaDecisoes, decisoesVazias, rotuloDecisao, agoraBRT,
} from '../netlify/functions/_placar-estado.mjs';

const data = [
  // messaging só — form não confirmado
  { campaign_name: 'FortMyers_MSG', spend: '100',
    actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '10' }] },
  // BR_SC com base (>=10) e CPL bom → pode escalar
  { campaign_name: 'FortMyers_BR_SC', spend: '200',
    actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '12' }] },
  // Portugal 10 leads mas público fora do BR em Piçarras → NÃO escala
  { campaign_name: 'FortMyers PORTUGAL', spend: '162.20',
    actions: [{ action_type: 'lead', value: '10' }] },
  // gastou, 0 form → revisar
  { campaign_name: 'FortMyers ESPANHA', spend: '55.99', actions: [] },
  // 3 leads CPL barato → observar SEM BASE
  { campaign_name: '[FortMyers_EUA_Americanos]', spend: '21',
    actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '3' }] },
];

test('montaSugestoes: escala só com base; Portugal/Americanos não escalam', () => {
  const p = montaPlacar(data);
  const sug = montaSugestoes(p);
  const esc = sug.filter((s) => s.tipo === 'escalar').map((s) => s.campanha);
  const obs = sug.filter((s) => s.tipo === 'observar').map((s) => s.campanha);
  const rev = sug.filter((s) => s.tipo === 'revisar').map((s) => s.campanha);
  assert.ok(esc.includes('FortMyers_BR_SC'));
  assert.ok(!esc.includes('FortMyers PORTUGAL'));
  assert.ok(!esc.includes('[FortMyers_EUA_Americanos]'));
  assert.ok(obs.some((n) => /Americanos/i.test(n)));
  assert.ok(rev.includes('FortMyers ESPANHA'));
});

test('montaSugestaoPrincipal: Americanos sem BR_SC elegível → OBSERVAR', () => {
  const p = montaPlacar([
    { campaign_name: '[FortMyers_EUA_Americanos]', spend: '21',
      actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '3' }] },
  ]);
  const s = montaSugestaoPrincipal(p);
  assert.equal(s.tipo, 'observar');
  assert.match(s.recomendacao, /Não escalar até 10/);
});

test('registraDecisao: grava e o último toque vale', () => {
  const dec = decisoesVazias('2026-07-21');
  registraDecisao(dec, { id: 'esc-x', campanha: 'X', tipo: 'escalar', decisao: 'aplicar', hora: '09:10', min: 550 });
  assert.equal(dec.itens['esc-x'].decisao, 'aplicar');
  registraDecisao(dec, { id: 'esc-x', campanha: 'X', tipo: 'escalar', decisao: 'agora-nao', hora: '09:12', min: 552 });
  assert.equal(dec.itens['esc-x'].decisao, 'agora-nao');
  assert.equal(Object.keys(dec.itens).length, 1);
});

test('registraDecisao: ajuste só em ajustar/aumentar; desistir/manter limpos; inválida barra', () => {
  const dec = decisoesVazias('2026-07-21');
  registraDecisao(dec, { id: 'a', decisao: 'aplicar', ajuste: 'texto ignorado', hora: '09:00', min: 540 });
  assert.equal(dec.itens.a.ajuste, '');
  registraDecisao(dec, { id: 'b', decisao: 'ajustar', ajuste: 'mover R$50 p/ BR_SC', hora: '09:01', min: 541 });
  assert.equal(dec.itens.b.ajuste, 'mover R$50 p/ BR_SC');
  registraDecisao(dec, { id: 'd', campanha: 'X', tipo: 'campanha', decisao: 'desistir', ajuste: 'ignorar', hora: '09:02', min: 542 });
  assert.equal(dec.itens.d.ajuste, '');
  registraDecisao(dec, { id: 'e', campanha: 'Y', tipo: 'campanha', decisao: 'manter', hora: '09:03', min: 543 });
  assert.equal(dec.itens.e.decisao, 'manter');
  registraDecisao(dec, { id: 'f', campanha: 'Z', tipo: 'campanha', decisao: 'aumentar', ajuste: 'R$ 80/dia', hora: '09:04', min: 544 });
  assert.equal(dec.itens.f.ajuste, 'R$ 80/dia');
  assert.throws(() => registraDecisao(dec, { id: 'c', decisao: 'pausar', hora: '09:02', min: 542 }));
  assert.throws(() => registraDecisao(dec, { decisao: 'aplicar' }));
});

test('listaDecisoes: mais recente primeiro', () => {
  const dec = decisoesVazias('2026-07-21');
  registraDecisao(dec, { id: 'a', campanha: 'A', tipo: 'escalar', decisao: 'aplicar', hora: '09:00', min: 540 });
  registraDecisao(dec, { id: 'b', campanha: 'B', tipo: 'revisar', decisao: 'agora-nao', hora: '10:00', min: 600 });
  const lista = listaDecisoes(dec);
  assert.equal(lista[0].id, 'b');
  assert.equal(lista.length, 2);
});

test('rotuloDecisao: texto honesto pro WhatsApp/log', () => {
  assert.match(rotuloDecisao({ decisao: 'aplicar', tipo: 'escalar', campanha: 'PORTUGAL' }), /Aplicou.*escalar.*PORTUGAL/);
  assert.match(rotuloDecisao({ decisao: 'ajustar', tipo: 'revisar', campanha: 'ESPANHA', ajuste: 'cortar' }), /Ajustou.*ESPANHA.*cortar/);
  assert.match(rotuloDecisao({ decisao: 'agora-nao', tipo: 'observar', campanha: 'Americanos' }), /Agora n[ãa]o.*observar/);
  assert.match(rotuloDecisao({ decisao: 'desistir', tipo: 'campanha', campanha: 'ESPANHA' }), /Desistiu.*ESPANHA/);
  assert.match(rotuloDecisao({ decisao: 'manter', tipo: 'campanha', campanha: 'BR_SC' }), /Manteve.*BR_SC/);
  assert.match(rotuloDecisao({ decisao: 'aumentar', tipo: 'campanha', campanha: 'PORTUGAL', ajuste: 'R$ 100/dia' }), /Aumentou.*PORTUGAL.*R\$ 100/);
});

test('agoraBRT: devolve data e hora coerentes de Brasília', () => {
  const a = agoraBRT(new Date('2026-07-21T15:57:00Z'));
  assert.equal(a.data, '2026-07-21');
  assert.equal(a.hm, '12:57');
  assert.equal(a.min, 12 * 60 + 57);
});
