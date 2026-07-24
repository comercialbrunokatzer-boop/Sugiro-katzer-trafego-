/**
 * Comportamento contínuo (KOS-002) — a Secretária acompanha o lead.
 * Cada interação pode mudar a fase; toda mudança tem trilha de auditoria.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAtualizacao, registraMudanca } from '../src/secretaria.js';

test('CONTÍNUO: avanço na zona verde registra a trilha completa', () => {
  const d = decideAtualizacao(
    { recommended_stage: 'Mapeamento', confidence: 0.9, evidence: ['cliente quer ver o imóvel'], resumo: 'Engajou, quer visitar' },
    { estagioAtual: 'Leads Novos', dealId: '4089' },
  );
  assert.equal(d.acao, 'ATUALIZAR');
  assert.ok(d.mudanca, 'gerou registro de mudança');
  assert.equal(d.mudanca.estagio_anterior, 'Leads Novos');
  assert.equal(d.mudanca.estagio_novo, 'Mapeamento');
  assert.ok(d.mudanca.evidencias.length >= 1, 'guardou evidências');
  assert.ok(d.mudanca.em, 'tem data/hora');
  assert.match(d.mudanca.validado_por, /Secret/);
  assert.match(d.update.fields.COMMENTS, /Leads Novos → Mapeamento/, 'transição no card');
});

test('CONTÍNUO: sem avanço real (mesma fase) NÃO cria transição falsa', () => {
  const d = decideAtualizacao(
    { recommended_stage: 'Mapeamento', confidence: 0.9, evidence: ['segue querendo visitar'] },
    { estagioAtual: 'Mapeamento', dealId: '1' },
  );
  assert.equal(d.acao, 'ATUALIZAR');
  assert.equal(d.mudanca, null, 'não inventou mudança');
});

test('CONTÍNUO: confiança insuficiente NÃO muda nada -> revisão (Bitrix não é tocado)', () => {
  const d = decideAtualizacao(
    { recommended_stage: 'Ganhou', confidence: 0.4, evidence: [] },
    { estagioAtual: 'Negociação', dealId: '2' },
  );
  assert.equal(d.acao, 'REVISAO_HUMANA');
  assert.equal(d.update, undefined, 'não montou update');
});

test('TRILHA: registraMudanca traz os 6 campos exigidos', () => {
  const m = registraMudanca({ de: 'Mapeamento', para: 'Agendamento', evidencias: ['topou marcar reunião'], validadoPor: 'Bruno' });
  for (const k of ['estagio_anterior', 'estagio_novo', 'motivo', 'evidencias', 'em', 'validado_por']) {
    assert.ok(k in m, `tem ${k}`);
  }
  assert.equal(m.validado_por, 'Bruno');
});
