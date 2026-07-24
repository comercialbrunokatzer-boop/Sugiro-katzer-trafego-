/**
 * Frente B — Michel: retrato vira fila de AÇÃO + régua que mede o próprio Michel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filaDeAcao, reguaDoMichel, MICHEL_MODO_SEGURO } from '../src/michel.js';

test('FILA DE AÇÃO: achado do Auditor vira ação com responsável, prazo e risco', () => {
  const fila = filaDeAcao([
    { deal_id: '101', rule_id: 'SEM_ATIVIDADE_REGISTRADA', corretor: 'Edsel Vidolin' },
    { deal_id: '102', rule_id: 'SEM_DATA_RETORNO', corretor: 'Elyas Kimiecek' },
  ]);
  assert.equal(fila.length, 2);
  assert.match(fila[0].acao, /contato/i);
  assert.equal(fila[0].responsavel, 'Michel→corretor');
  assert.ok(fila[0].prazo_horas > 0);
  assert.ok(fila[0].risco);
  assert.equal(fila[0]._seguro, true, 'modo seguro: não cobra ainda');
});

test('FILA DE AÇÃO: no-show vai pro BRUNO (é estrutural, não cobrança de corretor)', () => {
  const fila = filaDeAcao([{ deal_id: '200', rule_id: 'NOSHOW_SEM_REGISTRO' }]);
  assert.match(fila[0].responsavel, /BRUNO/);
});

test('MODO SEGURO está ligado (não cobra até validar as regras)', () => {
  assert.equal(MICHEL_MODO_SEGURO, true);
});

test('RÉGUA: mede cobranças, pendências e o que subiu ao CEO à toa', () => {
  const H = 3600000;
  const r = reguaDoMichel([
    { label: 'concluido', recebido_ms: 0, agido_ms: 2 * H },
    { label: 'em-correcao', recebido_ms: 0, agido_ms: 4 * H },
    { label: '', /* pendente */ },
    { label: 'falso-alarme' },
    { label: 'escalado', operacional: true }, // subiu pro CEO algo operacional -> à toa
  ]);
  assert.equal(r.recebidas, 5);
  assert.equal(r.cobradas, 2);
  assert.equal(r.pendentes, 1);
  assert.equal(r.falso_alarme, 1);
  assert.equal(r.subiu_ao_ceo_a_toa, 1);
  assert.equal(r.tempo_medio_resposta_h, 3); // (2h + 4h) / 2
  assert.equal(r.taxa_falso_alarme_pct, 20);
});
