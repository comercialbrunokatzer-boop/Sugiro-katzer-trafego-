/**
 * Travas da Secretária (§6A) — "a IA recomenda; o Maestro valida e executa".
 * Funil real: ZONA VERDE (até Mapeamento) move sozinha; ZONA VERMELHA só PROPÕE pro Bruno.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validaParecer, decideAtualizacao, soDoCliente, ESTAGIO_BITRIX, quemRevisa, proximaAcaoSugerida } from '../src/secretaria.js';

test('TRAVA: parecer bom na zona verde (Mapeamento) é APROVADO', () => {
  const v = validaParecer({ recommended_stage: 'Mapeamento', confidence: 0.92, evidence: ['quero marcar visita'] });
  assert.equal(v.aprovado, true);
  assert.equal(v.estagio_final, 'Mapeamento');
});

test('TRAVA: confiança baixa vai pra REVISÃO (não aplica sozinho)', () => {
  const v = validaParecer({ recommended_stage: 'Negociação', confidence: 0.4, evidence: ['fecho se abaixar'] });
  assert.equal(v.aprovado, false);
  assert.match(v.motivos.join(), /confiança baixa/);
});

test('TRAVA: fase da zona vermelha SEM evidência vai pra revisão', () => {
  const v = validaParecer({ recommended_stage: 'Contrato', confidence: 0.95, evidence: [] });
  assert.equal(v.aprovado, false);
  assert.match(v.motivos.join(), /sem evidência/);
});

test('TRAVA: "Ganhou" exige confirmação objetiva', () => {
  const fraco = validaParecer({ recommended_stage: 'Ganhou', confidence: 0.99, evidence: ['ele gostou muito'] });
  assert.equal(fraco.aprovado, false, 'gostar não é fechar');
  const forte = validaParecer({ recommended_stage: 'Ganhou', confidence: 0.99, evidence: ['cliente disse que já assinou o contrato'] });
  assert.equal(forte.aprovado, true);
});

test('TRAVA #78: NUNCA regride sozinha — CLAMPA na fase atual (caso Raciel)', () => {
  // Raciel: card em "Reagendamento de Visita" (verde), mas disse "manda a planta/fotos"
  // (keywords de Mapeamento). O farejador recomenda Mapeamento (5 fases atrás).
  const v = validaParecer(
    { recommended_stage: 'Mapeamento', confidence: 0.75, evidence: ['me manda a planta', 'quero o 20º andar'] },
    { estagioAtual: 'Reagendamento de Visita' },
  );
  assert.equal(v.clamp_regressao, true, 'marcou como regressão clampada');
  assert.equal(v.estagio_final, 'Reagendamento de Visita', 'NÃO regride: mantém a fase atual');
  assert.equal(v.aprovado, true, 'segue verde (só refresca comentário/campos, sem mover)');
});

test('TRAVA #78: regressão pra ZONA VERMELHA sem evidência -> não regride e vai pra revisão', () => {
  const v = validaParecer({ recommended_stage: 'Leads Novos', confidence: 0.9, evidence: [] }, { estagioAtual: 'Negociação' });
  assert.equal(v.aprovado, false);
  assert.equal(v.estagio_final, 'Negociação', 'não volta pra Leads Novos');
});

test('DECIDE #78: card avançado + fala de fase anterior -> ATUALIZAR sem mover STAGE_ID', () => {
  const d = decideAtualizacao(
    { recommended_stage: 'Mapeamento', confidence: 0.75, evidence: ['me manda a planta'] },
    { estagioAtual: 'Reagendamento de Visita', dealId: '1829' },
  );
  assert.equal(d.acao, 'ATUALIZAR');
  assert.equal(d.update.fields.STAGE_ID, ESTAGIO_BITRIX['Reagendamento de Visita'], 'STAGE_ID fica na fase atual, não regride');
  assert.equal(d.mudanca, null, 'sem mudança de fase');
});

test('DECIDE #78: evidência + next_action NÃO justificam regressão automática', () => {
  const d = decideAtualizacao(
    {
      recommended_stage: 'Mapeamento',
      confidence: 0.82,
      evidence: ['me manda também as fotos da área de lazer', 'quero alguma coisa no 20º andar'],
      next_action: 'Enviar fotos e planta solicitadas',
    },
    { estagioAtual: 'Reagendamento de Visita', dealId: '1829' },
  );
  assert.equal(d.acao, 'ATUALIZAR');
  assert.equal(d.update.fields.STAGE_ID, ESTAGIO_BITRIX['Reagendamento de Visita'], 'evidência/next_action só refrescam o card atual');
  assert.equal(d.mudanca, null, 'não registra Reagendamento de Visita -> Mapeamento');
  assert.doesNotMatch(d.update.fields.COMMENTS, /Reagendamento de Visita → Mapeamento/);
});

test('TRAVA: fala da EQUIPE nunca vira intenção do cliente (Lei 01)', () => {
  const conversa = [
    { autor: 'equipe', texto: 'Vou fechar esse cliente hoje' },
    { autor: 'cliente', texto: 'ainda estou pesquisando' },
  ];
  const soCliente = soDoCliente(conversa);
  assert.match(soCliente, /pesquisando/);
  assert.doesNotMatch(soCliente, /Vou fechar/, 'a fala da equipe não entra');
});

test('DECIDE: verde -> ATUALIZAR; vermelha -> PROPÕE; fraco -> revisão', () => {
  // Mapeamento (verde) move sozinha
  const verde = decideAtualizacao({ recommended_stage: 'Mapeamento', confidence: 0.9, evidence: ['quero ver'], next_action: 'Conduzir pra reunião' }, { dealId: '4089' });
  assert.equal(verde.acao, 'ATUALIZAR');
  assert.equal(verde.acompanhamento, 'MICHEL');
  assert.equal(verde.update.fields.STAGE_ID, ESTAGIO_BITRIX['Mapeamento']);

  // Negociação (vermelha) só PROPÕE pro Bruno
  const vermelha = decideAtualizacao({ recommended_stage: 'Negociação', confidence: 0.9, evidence: ['fecho se abaixar'], next_action: 'Enviar proposta' }, { dealId: '4089' });
  assert.equal(vermelha.acao, 'PROPOR');
  assert.equal(vermelha.revisor, 'BRUNO');
  assert.ok(vermelha.update, 'traz o update pronto pra aplicar no OK');

  const fraco = decideAtualizacao({ recommended_stage: 'Ganhou', confidence: 0.5, evidence: [] }, { dealId: '4089' });
  assert.equal(fraco.acao, 'REVISAO_HUMANA');
  assert.ok(fraco.motivos.length >= 1);
});

test('ROTEAMENTO: verde vai pro Michel; vermelha sobe pro Bruno', () => {
  assert.equal(quemRevisa({ recommended_stage: 'Mapeamento' }), 'MICHEL');
  assert.equal(quemRevisa({ recommended_stage: 'Leads Novos' }), 'MICHEL');
  assert.equal(quemRevisa({ recommended_stage: 'Negociação' }), 'BRUNO');
  assert.equal(quemRevisa({ recommended_stage: 'Ganhou' }), 'BRUNO');
});

test('DECIDE: caso aprovado traz próxima ação + roteamento certo', () => {
  const operacional = decideAtualizacao({ recommended_stage: 'Mapeamento', confidence: 0.9, evidence: ['quero visitar'] }, { dealId: '1' });
  assert.equal(operacional.acompanhamento, 'MICHEL');
  assert.ok(operacional.proxima_acao, 'gerou próxima ação automática');

  const sensivel = decideAtualizacao({ recommended_stage: 'Negociação', confidence: 0.9, evidence: ['fecho se abaixar'] }, { dealId: '2' });
  assert.equal(sensivel.acao, 'PROPOR');
  assert.equal(sensivel.revisor, 'BRUNO');

  const revisaoSensivel = decideAtualizacao({ recommended_stage: 'Contrato', confidence: 0.3, evidence: [] }, { dealId: '3' });
  assert.equal(revisaoSensivel.acao, 'REVISAO_HUMANA');
  assert.equal(revisaoSensivel.revisor, 'BRUNO', 'contrato duvidoso vai pro Bruno revisar');
});

test('PRÓXIMA AÇÃO: cada fase tem uma ação padrão', () => {
  for (const est of ['Leads Novos', 'Mapeamento', 'Agendamento', 'Negociação', 'Contrato', 'Ganhou']) {
    assert.ok(proximaAcaoSugerida(est).length > 3, `${est} tem ação`);
  }
});
