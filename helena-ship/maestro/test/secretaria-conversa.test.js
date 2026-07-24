import { test } from 'node:test';
import assert from 'node:assert';
import {
  chaveConversa, baseFirebase, montaUrlConversa, leConversa, candidatosChave,
  canonTelBR, mesmoTelefone,
} from '../src/secretariaConversa.js';
import { achaDealLeitura } from '../src/bitrixRead.js';
import { estagioPorStageId } from '../src/secretaria.js';

const DB = 'https://exemplo-db.invalido';
const TOKEN = 'https://exemplo.invalido/rest/1/abc123token/';

test('chaveConversa: só dígitos (igual ao normalizePhone da Helena)', () => {
  assert.equal(chaveConversa('+55 (47) 99999-0000'), '5547999990000');
  assert.equal(chaveConversa('47 99999 0000'), '47999990000');
  assert.equal(chaveConversa(''), '');
});

test('baseFirebase: tira barras finais', () => {
  assert.equal(baseFirebase(DB + '/'), DB);
  assert.equal(baseFirebase(DB + '///'), DB);
  assert.equal(baseFirebase(''), '');
});

test('montaUrlConversa: caminho helena_conversas/<fk>.json', () => {
  assert.equal(montaUrlConversa(DB, '5547999990000'), `${DB}/helena_conversas/5547999990000.json`);
});

test('montaUrlConversa: injeta ?auth quando tem token', () => {
  assert.equal(
    montaUrlConversa(DB, '5547999990000', 'segredo123'),
    `${DB}/helena_conversas/5547999990000.json?auth=segredo123`,
  );
});

test('montaUrlConversa: base vazia -> erro claro', () => {
  assert.throws(() => montaUrlConversa('', '5547999990000'), /FIREBASE_DATABASE_URL/);
});

test('montaUrlConversa: telefone inválido -> erro claro', () => {
  assert.throws(() => montaUrlConversa(DB, 'abc'), /telefone/);
});

test('leConversa: devolve o payload no caminho feliz', async () => {
  const payload = { messages: [{ role: 'user', content: 'quero ver o imóvel' }] };
  const fakeFetch = async (url) => {
    assert.ok(url.includes('/helena_conversas/5547999990000.json'));
    return { ok: true, json: async () => payload };
  };
  const r = await leConversa('5547999990000', { base: DB, fetchFn: fakeFetch });
  assert.deepEqual(r, payload);
});

test('candidatosChave: gera variações com/sem 55 e com/sem 9 (número BR)', () => {
  const c = candidatosChave('5548999814075'); // (48) 99981-4075 com país
  assert.ok(c.includes('5548999814075'), 'como veio');
  assert.ok(c.includes('554899814075'), 'sem o 9');
  assert.ok(c.includes('48999814075'), 'nacional com 9');
  assert.ok(c.includes('4899814075'), 'nacional sem 9');
});

test('candidatosChave: vazio/lixo -> lista vazia (não inventa)', () => {
  assert.deepEqual(candidatosChave(''), []);
  assert.deepEqual(candidatosChave('abc'), []);
});

test('mesmoTelefone: reconhece o número admin em qualquer formato (55/9)', () => {
  const admin = '5547997500404';
  assert.equal(mesmoTelefone('5547997500404', admin), true); // igual
  assert.equal(mesmoTelefone('47997500404', admin), true);   // sem 55
  assert.equal(mesmoTelefone('4797500404', admin), true);    // sem 55 e sem 9
  assert.equal(mesmoTelefone('+55 (47) 99750-0404', admin), true); // formatado
  assert.equal(mesmoTelefone('5547988887777', admin), false); // outro número
  assert.equal(mesmoTelefone('', admin), false);             // vazio nunca casa
});

test('canonTelBR: DDD + 8 finais (absorve 55 e 9)', () => {
  assert.equal(canonTelBR('5547997500404'), '4797500404');
  assert.equal(canonTelBR('47997500404'), '4797500404');
  assert.equal(canonTelBR('4797500404'), '4797500404');
});

test('leConversa: acha a conversa mesmo salva SEM o 9 (consulta COM o 9)', async () => {
  const armazenado = '554899814075'; // a Helena salvou sem o 9 (WhatsApp BR)
  const payload = { messages: [{ role: 'user', content: 'oi, é a Marina' }] };
  const fakeFetch = async (url) => ({
    ok: true,
    json: async () => (url.includes(`/helena_conversas/${armazenado}.json`) ? payload : null),
  });
  const r = await leConversa('5548999814075', { base: DB, fetchFn: fakeFetch }); // consulta COM o 9
  assert.deepEqual(r, payload);
});

test('leConversa: nó inexistente (RTDB devolve null) -> null', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => null });
  const r = await leConversa('5547999990000', { base: DB, fetchFn: fakeFetch });
  assert.equal(r, null);
});

test('leConversa: HTTP != ok -> erro claro', async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => leConversa('5547999990000', { base: DB, fetchFn: fakeFetch }),
    /Firebase HTTP 401/,
  );
});

test('estagioPorStageId: mapeia o STAGE_ID de volta pro nome amigável', () => {
  assert.equal(estagioPorStageId('C1:NEW'), 'Leads Novos');
  assert.equal(estagioPorStageId('C1:PREPAYMENT_INVOICE'), 'Mapeamento');
  assert.equal(estagioPorStageId('C1:UC_3NOP4U'), 'Negociação');
  assert.equal(estagioPorStageId('C1:INEXISTENTE'), null);
  assert.equal(estagioPorStageId(''), null);
});

test('achaDealLeitura: acha o negócio mais recente do cliente por telefone', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (url.includes('crm.duplicate.findbycomm')) {
      return { ok: true, json: async () => ({ result: { CONTACT: ['77'] } }) };
    }
    if (url.includes('crm.deal.list')) {
      return { ok: true, json: async () => ({ result: [{ ID: '900', TITLE: 'João — Praia', STAGE_ID: 'C1:PREPAYMENT_INVOICE', CONTACT_ID: '77' }] }) };
    }
    throw new Error('método inesperado: ' + url);
  };
  const r = await achaDealLeitura('5547999990000', { base: TOKEN, fetchFn: fakeFetch });
  assert.equal(r.dealId, '900');
  assert.equal(r.contactId, '77');
  assert.equal(r.stageId, 'C1:PREPAYMENT_INVOICE');
  assert.equal(estagioPorStageId(r.stageId), 'Mapeamento');
});

test('achaDealLeitura: sem contato -> null', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ result: { CONTACT: [] } }) });
  const r = await achaDealLeitura('5547999990000', { base: TOKEN, fetchFn: fakeFetch });
  assert.equal(r, null);
});

test('achaDealLeitura: contato existe mas sem negócio no funil -> dealId null', async () => {
  const fakeFetch = async (url) => {
    if (url.includes('crm.duplicate.findbycomm')) {
      return { ok: true, json: async () => ({ result: { CONTACT: ['77'] } }) };
    }
    return { ok: true, json: async () => ({ result: [] }) };
  };
  const r = await achaDealLeitura('5547999990000', { base: TOKEN, fetchFn: fakeFetch });
  assert.equal(r.dealId, null);
  assert.equal(r.contactId, '77');
});
