import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montaLeadFollowup, decideFollowup } from '../src/followupEstado.js';

const AGORA = 1_000_000_000_000;

test('cliente respondeu depois da Helena → relógio para', () => {
  const conv = {
    messages: [
      { role: 'assistant', ts: AGORA - 60 * 60000 },
      { role: 'user', ts: AGORA - 10 * 60000 },
    ],
  };
  const lead = montaLeadFollowup(conv, {}, {}, AGORA);
  assert.equal(lead.cliente_respondeu, true);
  const d = decideFollowup(conv, {}, {}, { agoraMs: AGORA });
  assert.equal(d.decisao.acao, 'NENHUMA');
});

test('silêncio 35 min sem resposta → escala Helena (nível 1)', () => {
  const conv = {
    messages: [{ role: 'assistant', ts: AGORA - 35 * 60000 }],
  };
  const d = decideFollowup(conv, {}, { niveis_disparados: [] }, { agoraMs: AGORA });
  assert.equal(d.decisao.acao, 'ESCALAR');
  assert.equal(d.decisao.para, 'HELENA');
  assert.equal(d.decisao.nivel, 1);
});

test('humano assumiu → NENHUMA', () => {
  const conv = { handledByHuman: true, messages: [{ role: 'assistant', ts: AGORA - 200 * 60000 }] };
  const d = decideFollowup(conv, {}, {}, { agoraMs: AGORA });
  assert.equal(d.decisao.acao, 'NENHUMA');
});

test('enviadas_hoje zera em dia diferente', () => {
  const lead = montaLeadFollowup({}, {}, { enviadas_hoje: 3, enviadas_dia: '1999-01-01' }, AGORA);
  assert.equal(lead.enviadas_hoje, 0);
});
