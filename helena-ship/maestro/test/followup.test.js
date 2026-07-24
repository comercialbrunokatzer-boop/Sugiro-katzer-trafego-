/**
 * Follow-up automático (§B) — 30min Helena / 2h Michel / 4h Bruno, com as travas do relógio.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximoFollowup } from '../src/followup.js';

const H = 3600000;
const MIN = 60000;

test('30min sem atendimento -> Helena reengaja', () => {
  const r = proximoFollowup({ ultimo_contato_ms: 0, niveis_disparados: [] }, { agoraMs: 31 * MIN });
  assert.equal(r.acao, 'ESCALAR');
  assert.equal(r.nivel, 1);
  assert.equal(r.para, 'HELENA');
});

test('10min -> ainda nada (dentro do prazo)', () => {
  const r = proximoFollowup({ ultimo_contato_ms: 0 }, { agoraMs: 10 * MIN });
  assert.equal(r.acao, 'NENHUMA');
});

test('2h com nível 1 já disparado -> escala pro Michel', () => {
  const r = proximoFollowup({ ultimo_contato_ms: 0, niveis_disparados: [1] }, { agoraMs: 2 * H + MIN });
  assert.equal(r.nivel, 2);
  assert.equal(r.para, 'MICHEL');
});

test('4h com níveis 1 e 2 já disparados -> escala pro Bruno', () => {
  const r = proximoFollowup({ ultimo_contato_ms: 0, niveis_disparados: [1, 2] }, { agoraMs: 4 * H + MIN });
  assert.equal(r.nivel, 3);
  assert.equal(r.para, 'BRUNO');
});

test('PARA: humano assumiu -> nenhuma escalada', () => {
  const r = proximoFollowup({ ultimo_contato_ms: 0, respondido_humano: true }, { agoraMs: 5 * H });
  assert.equal(r.acao, 'NENHUMA');
  assert.match(r.motivo, /humano/);
});

test('PARA: cliente respondeu / opt-out / agendamento confirmado', () => {
  assert.equal(proximoFollowup({ ultimo_contato_ms: 0, cliente_respondeu: true }, { agoraMs: 5 * H }).acao, 'NENHUMA');
  assert.equal(proximoFollowup({ ultimo_contato_ms: 0, opt_out: true }, { agoraMs: 5 * H }).acao, 'NENHUMA');
  assert.equal(proximoFollowup({ ultimo_contato_ms: 0, agendamento_confirmado: true }, { agoraMs: 5 * H }).acao, 'NENHUMA');
});

test('TRAVA: limite diário de mensagens por contato', () => {
  const r = proximoFollowup({ ultimo_contato_ms: 0, enviadas_hoje: 3 }, { agoraMs: 5 * H, limiteDiario: 3 });
  assert.equal(r.acao, 'NENHUMA');
  assert.match(r.motivo, /limite diário/);
});

test('TRAVA: não repete etapa já disparada', () => {
  // 40min, nível 1 já saiu -> não repete o nível 1 (e o 2 ainda não venceu)
  const r = proximoFollowup({ ultimo_contato_ms: 0, niveis_disparados: [1] }, { agoraMs: 40 * MIN });
  assert.equal(r.acao, 'NENHUMA');
});
