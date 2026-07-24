/**
 * WH-04 (Helena -> Bitrix) — teste no nível do HANDLER, com o payload real de exemplo.
 * Prova o entregável nº 5: um lead qualificado atravessa do WhatsApp/Firebase até o Bitrix,
 * atribui corretor, vai pra discadora e o lead é avisado — sem rede (deps injetadas).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handler } from '../functions/wh-helena.js';
import { criaEstado } from '../src/state.js';
import { CFG } from '../src/config.js';

const exemplo = JSON.parse(readFileSync(new URL('./payloads/wh-helena.json', import.meta.url)));

function fakeBitrix() {
  const store = new Map(); let seq = 2000;
  return {
    _store: store,
    async achaNegocioPorTelefone(tel) { return store.get(tel.replace(/\D+/g, '').slice(-11)) || null; },
    async upsertNegocio(lead, { stageId, corretorId }) {
      const ex = store.get(lead.chave);
      if (ex) return { dealId: ex.dealId, contactId: 'c', created: false, corretorId: ex.assignedById };
      const dealId = String(++seq);
      store.set(lead.chave, { dealId, assignedById: corretorId, stageId });
      return { dealId, contactId: 'c', created: true, corretorId };
    },
  };
}
function fakeDeps() {
  const enviados = [], fila = [];
  return {
    enviados, fila,
    bitrix: fakeBitrix(),
    estado: criaEstado({ memoria: { rr: {}, links: {}, eventos: [] } }),
    discadora: { enfileira: async (x) => { fila.push(x); return { enfileirado: true, modo: 'bitrix' }; } },
    whatsapp: { enviaTexto: async (tel, msg) => { enviados.push({ tel, msg }); return { enviado: true }; } },
    alerta: async () => {},
    logger: { info() {}, ok() {}, erro() {} },
  };
}

test('WH-04: payload real (envelope Firebase) → negócio criado no Bitrix + discadora + aviso ao lead', async () => {
  const deps = fakeDeps();
  const event = { body: JSON.stringify(exemplo) }; // Netlify entrega body como string
  const resp = await handler(event, deps);
  assert.equal(resp.statusCode, 200);
  const r = JSON.parse(resp.body);
  assert.equal(r.ok, true);
  assert.equal(r.criado, true, 'o lead do Paulo Cezar NASCEU no Bitrix');
  assert.equal(r.discadora.enfileirado, true, 'entrou na fila da discadora');
  assert.equal(deps.fila.length, 1);
  assert.equal(deps.enviados.length, 1, 'avisou o lead');
  assert.match(deps.enviados[0].msg, /corretor .* vai te chamar/i);
  assert.equal(deps.estado._mem.eventos.some((e) => e.valor.tipo === 'qualificado_encaminhado'), true, 'rastro registrado');
});

test('WH-04: status diferente de "qualificado" é ignorado (não cria negócio à toa)', async () => {
  const deps = fakeDeps();
  const event = { body: JSON.stringify({ status: 'em_conversa', lead: exemplo.lead }) };
  const resp = await handler(event, deps);
  assert.equal(resp.statusCode, 200);
  const r = JSON.parse(resp.body);
  assert.equal(r.ignorado, 'status=em_conversa');
  assert.equal(deps.bitrix._store.size, 0, 'nada criado');
});

test('WH-04: aceita lead cru (sem envelope) também', async () => {
  const deps = fakeDeps();
  const event = { body: JSON.stringify(exemplo.lead) };
  const resp = await handler(event, deps);
  const r = JSON.parse(resp.body);
  assert.equal(r.ok, true);
  assert.equal(r.criado, true);
});
