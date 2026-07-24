/**
 * Testes do Maestro — rodam com `node --test`, sem rede (tudo com fakes).
 * "Vermelho antes do verde": provam o pipeline, o dedup, o round-robin, o teto e o guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingestLead } from '../src/ingest.js';
import { criaBitrix } from '../src/bitrixWrite.js';
import { criaEstado } from '../src/state.js';
import { chaveTelefone, normalizaLead } from '../src/lead.js';
import { proximoCorretor } from '../src/roundRobin.js';
import { CFG } from '../src/config.js';

// ── fakes ──
function fakeBitrix() {
  const store = new Map(); let seq = 1000;
  return {
    _store: store,
    async achaNegocioPorTelefone(tel) {
      const k = tel.replace(/\D+/g, '').slice(-11);
      return store.get(k) || null;
    },
    async upsertNegocio(lead, { stageId, corretorId }) {
      const ex = store.get(lead.chave);
      if (ex) return { dealId: ex.dealId, contactId: ex.contactId, created: false, corretorId: ex.assignedById || corretorId };
      const dealId = String(++seq);
      store.set(lead.chave, { dealId, contactId: String(++seq), assignedById: corretorId, stageId });
      return { dealId, contactId: 'c', created: true, corretorId };
    },
  };
}
function fakeDeps(bitrix) {
  const alerts = [];
  return {
    _alerts: alerts,
    bitrix,
    estado: criaEstado({ memoria: { rr: {}, links: {}, eventos: [] } }),
    discadora: { enfileira: async () => ({ enfileirado: true, modo: 'bitrix' }) },
    whatsapp: { enviaTexto: async () => ({ enviado: true }) },
    alerta: async (t, d) => alerts.push({ t, d }),
    logger: { info() {}, ok() {}, erro() {} },
  };
}

test('chaveTelefone normaliza formato e DDI (dedup bate o mesmo numero)', () => {
  assert.equal(chaveTelefone('+55 47 99988-7766'), chaveTelefone('47999887766'));
  assert.equal(chaveTelefone('(11) 97777-1122'), '11977771122');
});

test('round-robin gira entre os corretores do pool', () => {
  const pool = ['985', '1637', '1613'];
  let i = -1;
  const seq = [];
  for (let k = 0; k < 4; k++) { const r = proximoCorretor(pool, i); i = r.indice; seq.push(r.corretor); }
  assert.deepEqual(seq, ['985', '1637', '1613', '985']);
});

test('WH-04: lead Patrocinado Corretor (Facebook) → Bruno (não roleta), nasce no Bitrix + discadora + aviso', async () => {
  const bitrix = fakeBitrix();
  const deps = fakeDeps(bitrix);
  // formulario_facebook = fonte Patrocinado Corretor → responsável Bruno (regra CEO / #115)
  const bruto = { nome: 'Paulo', telefone: '+55 47 99988-7766', origem: 'formulario_facebook', interesse: 'BC', orcamento_max: 3500000, nivel: 'quente' };
  const r = await ingestLead(bruto, { etapa: CFG.ETAPAS.PRE_QUALIFICADO, qualificado: true }, deps);
  assert.equal(r.ok, true);
  assert.equal(r.criado, true, 'nasceu negocio novo');
  assert.ok(r.dealId, 'tem dealId');
  assert.equal(String(r.corretorId), String(CFG.BRUNO_BITRIX_ID || '1'), 'Patrocinado Corretor fica com Bruno, não no pool');
  assert.equal(r.discadora.enfileirado, true, 'foi pra discadora');
  assert.equal(r.aviso.enviado, true, 'avisou o lead');
});

test('WH-04b: lead NÃO patrocinado → round-robin do pool de corretores', async () => {
  const bitrix = fakeBitrix();
  const deps = fakeDeps(bitrix);
  const bruto = { nome: 'Ana', telefone: '+55 47 98888-1122', origem: 'indicacao', interesse: 'BC', nivel: 'quente' };
  const r = await ingestLead(bruto, { etapa: CFG.ETAPAS.PRE_QUALIFICADO, qualificado: true }, deps);
  assert.equal(r.ok, true);
  assert.ok(CFG.BROKER_POOL.includes(String(r.corretorId)), 'corretor do pool');
});

test('DEDUP: segundo evento do mesmo telefone ATUALIZA (nao cria segundo negocio)', async () => {
  const bitrix = fakeBitrix();
  const deps = fakeDeps(bitrix);
  const tel = '5547999887766';
  const r1 = await ingestLead({ nome: 'Paulo', telefone: tel }, { etapa: CFG.ETAPAS.LEAD_NOVO, qualificado: false }, deps);
  const r2 = await ingestLead({ nome: 'Paulo C.', telefone: '+55 (47) 99988-7766' }, { etapa: CFG.ETAPAS.PRE_QUALIFICADO, qualificado: false }, deps);
  assert.equal(r1.criado, true);
  assert.equal(r2.criado, false, 'nao duplicou');
  assert.equal(r1.dealId, r2.dealId, 'mesmo negocio');
  assert.equal(r2.corretorId, r1.corretorId, 'manteve o dono');
  assert.equal(bitrix._store.size, 1, 'um unico negocio pra esse telefone');
});

test('GUARD: lead sem telefone nao quebra — retorna erro e dispara alerta', async () => {
  const bitrix = fakeBitrix();
  const deps = fakeDeps(bitrix);
  const r = await ingestLead({ nome: 'Sem Fone' }, { etapa: CFG.ETAPAS.LEAD_NOVO }, deps);
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'LEAD_SEM_TELEFONE');
  assert.equal(deps._alerts.length, 1, 'gerou alerta (regra #7)');
});

test('TETO (Lei 01): orcamento absurdo NAO vira campo; valor real entra', async () => {
  const calls = [];
  const call = async (method, params) => {
    calls.push({ method, params });
    if (method === 'crm.duplicate.findbycomm') return { CONTACT: [] };
    if (method === 'crm.contact.add') return 555;
    if (method === 'crm.deal.add') return 7777;
    if (method === 'crm.deal.list') return [];
    return null;
  };
  const b = criaBitrix({ call });

  const absurdo = normalizaLead({ nome: 'X', telefone: '5511999990000', orcamento_max: 2900000000 });
  await b.upsertNegocio(absurdo, { stageId: CFG.ETAPAS.LEAD_NOVO, corretorId: '985' });
  let add = calls.find((c) => c.method === 'crm.deal.add');
  assert.equal(add.params.fields[CFG.F.TICKET_PERCEBIDO], undefined, 'ticket de 2.9bi barrado');
  assert.equal(add.params.fields.STAGE_ID, CFG.ETAPAS.LEAD_NOVO);
  assert.equal(String(add.params.fields.ASSIGNED_BY_ID), '985');

  calls.length = 0;
  const real = normalizaLead({ nome: 'Y', telefone: '5511999990001', orcamento_max: 1800000 });
  await b.upsertNegocio(real, { stageId: CFG.ETAPAS.LEAD_NOVO, corretorId: '1637' });
  add = calls.find((c) => c.method === 'crm.deal.add');
  assert.equal(add.params.fields[CFG.F.TICKET_PERCEBIDO], 1800000, 'ticket real entra');
});
