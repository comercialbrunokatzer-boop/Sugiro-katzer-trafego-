import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montaPlacar, montaCartoesCopiloto } from '../netlify/functions/_placar.mjs';
import {
  montaSugestoes, registraDecisao, listaDecisoes, decisoesVazias, rotuloDecisao, agoraBRT, garanteAprendizados,
} from '../netlify/functions/_placar-estado.mjs';

const data = [
  { campaign_name: 'FortMyers_BR_SC', spend: '731.91',
    actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '10' }] },
  { campaign_name: 'FortMyers PORTUGAL', spend: '162.20',
    actions: [{ action_type: 'lead', value: '10' }] },     // CPL 16,22 -> melhor
  { campaign_name: 'FortMyers ESPANHA', spend: '55.99', actions: [] }, // gastou, 0 lead -> revisar
];

test('montaSugestoes: separa escalar e revisar, com id estável', () => {
  const sug = montaSugestoes(montaPlacar(data));
  const ids = sug.map((s) => s.id);
  assert.ok(ids.every((id) => id.startsWith('esc-') || id.startsWith('rev-')));
  const esc = sug.filter((s) => s.tipo === 'escalar').map((s) => s.campanha);
  const rev = sug.filter((s) => s.tipo === 'revisar').map((s) => s.campanha);
  assert.ok(esc.includes('FortMyers PORTUGAL'));  // melhor CPL escala
  assert.ok(rev.includes('FortMyers ESPANHA'));   // gastou e 0 lead revisa
  // id é derivado do nome (mesmo nome -> mesmo id, pra o toque casar entre polls)
  assert.equal(montaSugestoes(montaPlacar(data))[0].id, sug[0].id);
});

test('registraDecisao: grava e o último toque vale', () => {
  const dec = decisoesVazias('2026-07-21');
  registraDecisao(dec, { id: 'esc-x', campanha: 'X', tipo: 'escalar', decisao: 'aplicar', hora: '09:10', min: 550 });
  assert.equal(dec.itens['esc-x'].decisao, 'aplicar');
  registraDecisao(dec, { id: 'esc-x', campanha: 'X', tipo: 'escalar', decisao: 'agora-nao', hora: '09:12', min: 552 });
  assert.equal(dec.itens['esc-x'].decisao, 'agora-nao'); // trocou de ideia
  assert.equal(Object.keys(dec.itens).length, 1);        // não duplica
});

test('registraDecisao: ajuste só guarda texto quando é "ajustar"; decisão inválida barra', () => {
  const dec = decisoesVazias('2026-07-21');
  registraDecisao(dec, { id: 'a', decisao: 'aplicar', ajuste: 'texto ignorado', hora: '09:00', min: 540 });
  assert.equal(dec.itens.a.ajuste, ''); // aplicar não guarda ajuste
  registraDecisao(dec, { id: 'b', decisao: 'ajustar', ajuste: 'mover R$50 p/ BR_SC', hora: '09:01', min: 541 });
  assert.equal(dec.itens.b.ajuste, 'mover R$50 p/ BR_SC');
  assert.throws(() => registraDecisao(dec, { id: 'c', decisao: 'pausar', hora: '09:02', min: 542 }));
  assert.throws(() => registraDecisao(dec, { decisao: 'aplicar' })); // sem id
});

test('listaDecisoes: mais recente primeiro', () => {
  const dec = decisoesVazias('2026-07-21');
  registraDecisao(dec, { id: 'a', campanha: 'A', tipo: 'escalar', decisao: 'aplicar', hora: '09:00', min: 540 });
  registraDecisao(dec, { id: 'b', campanha: 'B', tipo: 'revisar', decisao: 'agora-nao', hora: '10:00', min: 600 });
  const lista = listaDecisoes(dec);
  assert.equal(lista[0].id, 'b'); // 10:00 antes de 09:00
  assert.equal(lista.length, 2);
});

test('rotuloDecisao: texto honesto pro WhatsApp/log', () => {
  assert.match(rotuloDecisao({ decisao: 'aplicar', tipo: 'escalar', campanha: 'PORTUGAL' }), /Aplicou.*escalar.*PORTUGAL/);
  assert.match(rotuloDecisao({ decisao: 'ajustar', tipo: 'revisar', campanha: 'ESPANHA', ajuste: 'cortar' }), /Ajustou.*ESPANHA.*cortar/);
  assert.match(rotuloDecisao({ decisao: 'agora-nao', tipo: 'escalar', campanha: 'BR_SC' }), /Agora n[ãa]o/);
});

test('agoraBRT: devolve data e hora coerentes de Brasília', () => {
  // 21/07/2026 15:57 UTC -> 12:57 em Brasília (UTC-3)
  const a = agoraBRT(new Date('2026-07-21T15:57:00Z'));
  assert.equal(a.data, '2026-07-21');
  assert.equal(a.hm, '12:57');
  assert.equal(a.min, 12 * 60 + 57);
});

test('garanteAprendizados: persiste a primeira frase e não sobrescreve a existente', () => {
  const dec = decisoesVazias('2026-07-21');
  const resumo = montaCartoesCopiloto(montaPlacar(data));
  const primeiro = resumo.cartoes[0];
  const r1 = garanteAprendizados(dec, resumo.cartoes);
  assert.equal(r1.mudou, true);
  assert.equal(dec.aprendizados[primeiro.id], primeiro.aprendizado);

  const alterado = [{ ...primeiro, aprendizado: 'frase nova que não deve substituir' }];
  const r2 = garanteAprendizados(dec, alterado);
  assert.equal(r2.mudou, false);
  assert.equal(dec.aprendizados[primeiro.id], primeiro.aprendizado);
});
