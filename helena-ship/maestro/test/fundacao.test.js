/**
 * P0.1 — Fundação do Maestro. Prova: contrato de evento, máscara de dados, retry, idempotência.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montaEvento, mascara } from '../src/evento.js';
import { comTentativas, recuperavel } from '../src/retry.js';
import { criaEstado } from '../src/state.js';
import { ingestLead } from '../src/ingest.js';
import { CFG } from '../src/config.js';

// ── evento ──
test('EVENTO: usa o id do provedor quando existe (idempotência real)', () => {
  const ev = montaEvento({ leadId: '5547999887766', nome: 'Ana', telefone: '5547999887766' }, { source: 'helena' });
  assert.equal(ev.event_id, '5547999887766');
  assert.equal(ev.source, 'helena');
  assert.equal(ev.processing_status, 'received');
  assert.ok(ev.correlation_id, 'tem correlation_id');
});

test('EVENTO: gera event_id quando o provedor não manda', () => {
  const ev = montaEvento({ telefone: '5511999990000' }, { source: 'meta_ads' });
  assert.match(ev.event_id, /[0-9a-f-]{10,}/i);
});

test('MÁSCARA: nunca loga telefone/e-mail inteiros (regra 14)', () => {
  const m = mascara({ nome: 'Ana', telefone: '5547999887766', email: 'ana@x.com', token: 'abc123secret' });
  assert.equal(m.nome, 'Ana');
  assert.notEqual(m.telefone, '5547999887766');
  assert.match(m.telefone, /\*\*\*/);
  assert.match(m.email, /\*\*\*/);
  assert.match(m.token, /\*\*\*/);
});

// ── retry ──
test('RETRY: re-tenta erro recuperável e depois tem sucesso', async () => {
  let n = 0;
  const r = await comTentativas(async () => { n++; if (n < 3) throw new Error('timeout'); return 'ok'; },
    { baseMs: 1, sleep: async () => {} });
  assert.equal(r, 'ok');
  assert.equal(n, 3);
});

test('RETRY: erro NÃO recuperável (4xx) falha na hora, sem re-tentar', async () => {
  let n = 0;
  await assert.rejects(
    comTentativas(async () => { n++; throw new Error('Bitrix crm.deal.add: 400'); }, { sleep: async () => {} }),
  );
  assert.equal(n, 1, 'não re-tentou');
});

test('RETRY: classifica 429/5xx/rede como recuperável', () => {
  assert.equal(recuperavel(new Error('429')), true);
  assert.equal(recuperavel(new Error('503')), true);
  assert.equal(recuperavel(new Error('network')), true);
  assert.equal(recuperavel(new Error('400')), false);
});

// ── idempotência ponta a ponta ──
function fakeBitrix() {
  const store = new Map(); let seq = 3000;
  return {
    async achaNegocioPorTelefone(tel) { return store.get(tel.replace(/\D+/g, '').slice(-11)) || null; },
    async upsertNegocio(lead, { corretorId }) {
      const ex = store.get(lead.chave);
      if (ex) return { dealId: ex.dealId, created: false, corretorId: ex.assignedById };
      const dealId = String(++seq); store.set(lead.chave, { dealId, assignedById: corretorId }); return { dealId, created: true, corretorId };
    },
  };
}
test('IDEMPOTÊNCIA: mesmo event_id NÃO processa duas vezes', async () => {
  const estado = criaEstado({ memoria: {} });
  const deps = {
    bitrix: fakeBitrix(), estado,
    discadora: { enfileira: async () => ({ enfileirado: true }) },
    whatsapp: { enviaTexto: async () => ({ enviado: true }) },
    alerta: async () => {}, logger: { info() {}, ok() {}, erro() {} },
  };
  const evento = { event_id: 'evt-123' };
  const r1 = await ingestLead({ nome: 'Ana', telefone: '5547999887766' }, { etapa: CFG.ETAPAS.LEAD_NOVO, evento }, deps);
  const r2 = await ingestLead({ nome: 'Ana', telefone: '5547999887766' }, { etapa: CFG.ETAPAS.LEAD_NOVO, evento }, deps);
  assert.equal(r1.criado, true, 'primeira vez cria');
  assert.equal(r2.idempotente, true, 'segunda vez é ignorada');
});
