/**
 * Briefing do corretor + painéis (Michel operacional / Bruno executivo).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { briefingCorretor, scriptSugerido } from '../src/briefings.js';
import { painelMichel, parecerBruno } from '../src/paineis.js';

test('BRIEFING: Top 3 vem ordenado por prioridade, com script e próxima ação', () => {
  const b = briefingCorretor('Edsel Vidolin', [
    { cliente: 'Ana', estagio: 'Negociação', prioridade: 9, valor: 800000, ultimo_contato_dias: 2 },
    { cliente: 'Beto', estagio: 'Qualificado', prioridade: 5, ultimo_contato_dias: 1 },
    { cliente: 'Caio', estagio: 'Lead Novo', prioridade: 3 },
    { cliente: 'Duda', estagio: 'Lead Novo', prioridade: 1, encerrado: true },
  ]);
  assert.equal(b.top3.length, 3);
  assert.equal(b.top3[0].cliente, 'Ana', 'maior prioridade primeiro');
  assert.ok(b.top3[0].script.includes('Ana'), 'script personalizado');
  assert.ok(b.top3[0].proxima_acao, 'tem próxima ação');
});

test('BRIEFING: pendências vencidas e agenda do dia', () => {
  const b = briefingCorretor('Elyas', [
    { cliente: 'Ana', estagio: 'Qualificado', pendencia_vencida: true, pendencia: 'ligar de volta' },
    { cliente: 'Beto', estagio: 'Negociação', agendado_hoje: true, hora: '15h' },
  ]);
  assert.equal(b.pendencias.length, 1);
  assert.equal(b.agenda.length, 1);
  assert.equal(b.agenda[0].hora, '15h');
});

test('SCRIPT: cada estágio tem uma abertura personalizada', () => {
  assert.match(scriptSugerido('Negociação', 'Ana'), /Ana/);
  assert.ok(scriptSugerido('Lead Novo').length > 5);
});

test('PAINEL MICHEL: calcula conversão, não-distribuídos e tempo médio', () => {
  const p = painelMichel({
    leads_recebidos: 20, leads_distribuidos: 15, fechamentos: 3,
    tempo_primeira_resposta_h: [1, 3], ligacoes_pendentes: 7, em_conferir: 4,
  });
  assert.equal(p.nao_distribuidos, 5);
  assert.equal(p.conversao_pct, 15);
  assert.equal(p.tempo_medio_primeira_resposta_h, 2);
  assert.equal(p.em_conferir, 4);
});

test('PARECER BRUNO: só oportunidade/travada/receita — nada operacional', () => {
  const p = parecerBruno({
    leads: [
      { cliente: 'Ana', estagio: 'Negociação', valor: 900000, ultimo_contato_dias: 5 },
      { cliente: 'Beto', estagio: 'Documentação', valor: 1200000, ultimo_contato_dias: 1 },
      { cliente: 'Caio', estagio: 'Lead Novo', valor: 300000, ultimo_contato_dias: 0 },
    ],
    decisoes: ['aprovar desconto da Ana'],
  });
  assert.ok(p.oportunidades_quentes.length >= 2, 'Negociação/Documentação entram');
  assert.ok(!p.oportunidades_quentes.find((o) => o.cliente === 'Caio'), 'Lead Novo comum não sobe pro CEO');
  assert.equal(p.negociacoes_travadas[0].cliente, 'Ana', 'Negociação parada 5d = travada');
  assert.ok(p.receita_prevista > 0);
  assert.equal(p.decisoes_solicitadas.length, 1);
});
