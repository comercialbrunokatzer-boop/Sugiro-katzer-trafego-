import { test } from 'node:test';
import assert from 'node:assert';
import {
  PREFIXO_SECRETARIA, formatPergunta, registraPendencia, pendenciasDe,
  interpretaResposta,
} from '../src/secretariaAviso.js';

const pJoao = { id: 'a', cliente: 'João da Silva', telefone: '47 99999-0000', produto: 'Fort Myers', de: 'Agendado Físico', para: 'Negociação', motivo: 'fecho se abaixar pra 950 (pós-reunião)' };
const pAna = { id: 'b', cliente: 'Ana Prado', telefone: '47 98888-1111', produto: 'Grant', de: 'Agendado Físico', para: 'Negociação', motivo: 'quer condição' };

test('formatPergunta traz a etiqueta 🗂️, o cliente e a etapa alvo', () => {
  const msg = formatPergunta(pJoao);
  assert.ok(msg.includes(PREFIXO_SECRETARIA));
  assert.ok(msg.includes('João da Silva'));
  assert.ok(/Negociação/.test(msg));
  assert.ok(/pode/i.test(msg) && /n[aã]o/i.test(msg)); // oferece pode/não
});

test('formatPergunta numera quando há várias pendências', () => {
  const msg = formatPergunta(pJoao, { ordem: 2, total: 3 });
  assert.ok(msg.includes('(2/3)'));
  assert.ok(/número/i.test(msg));
});

test('1 pendência + "pode" => APLICAR e sai do store', () => {
  const store = new Map();
  registraPendencia(store, '5547999990000', pJoao);
  const r = interpretaResposta(store, '5547999990000', 'pode');
  assert.equal(r.acao, 'APLICAR');
  assert.equal(r.pendencia.cliente, 'João da Silva');
  assert.equal(pendenciasDe(store, '5547999990000').length, 0); // resolvida
});

test('1 pendência + "não" => RECUSAR', () => {
  const store = new Map();
  registraPendencia(store, '5547999990000', pJoao);
  const r = interpretaResposta(store, '5547999990000', 'não, ainda não');
  assert.equal(r.acao, 'RECUSAR');
});

test('"melhor deixa em Mapeamento" => AJUSTAR (redireciona a etapa)', () => {
  const store = new Map();
  registraPendencia(store, '5547999990000', pJoao);
  const r = interpretaResposta(store, '5547999990000', 'melhor deixa em Mapeamento por enquanto');
  assert.equal(r.acao, 'AJUSTAR');
  assert.ok(/Mapeamento/.test(r.ajuste));
});

test('telefone tolerante a formatação (mesma pessoa)', () => {
  const store = new Map();
  registraPendencia(store, '+55 (47) 99999-0000', pJoao);
  const r = interpretaResposta(store, '5547999990000', 'pode');
  assert.equal(r.acao, 'APLICAR');
});

test('2 pendências + "2 pode" aplica na SEGUNDA', () => {
  const store = new Map();
  registraPendencia(store, '5547999990000', pJoao);
  registraPendencia(store, '5547999990000', pAna);
  const r = interpretaResposta(store, '5547999990000', '2 pode');
  assert.equal(r.acao, 'APLICAR');
  assert.equal(r.pendencia.cliente, 'Ana Prado');
  assert.equal(pendenciasDe(store, '5547999990000').length, 1); // sobra a do João
});

test('2 pendências + "pode" sem dizer qual => AMBIGUO (não aplica nada)', () => {
  const store = new Map();
  registraPendencia(store, '5547999990000', pJoao);
  registraPendencia(store, '5547999990000', pAna);
  const r = interpretaResposta(store, '5547999990000', 'pode');
  assert.equal(r.acao, 'AMBIGUO');
  assert.equal(pendenciasDe(store, '5547999990000').length, 2); // nada foi resolvido
});

test('2 pendências + nome do cliente casa a pendência certa', () => {
  const store = new Map();
  registraPendencia(store, '5547999990000', pJoao);
  registraPendencia(store, '5547999990000', pAna);
  const r = interpretaResposta(store, '5547999990000', 'pode pro João');
  assert.equal(r.acao, 'APLICAR');
  assert.equal(r.pendencia.cliente, 'João da Silva');
});

test('resposta sem pendência aberta => SEM_PENDENCIA', () => {
  const store = new Map();
  const r = interpretaResposta(store, '5547999990000', 'pode');
  assert.equal(r.acao, 'SEM_PENDENCIA');
});
