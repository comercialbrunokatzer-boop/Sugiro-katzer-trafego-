import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isVermelho,
  marcaAuditoria,
  acertoProvisoriaVsReal,
  classificaHeuristica,
  resumoAuditoria,
} from '../netlify/functions/_auditoria-abcd.mjs';
import { leadsDemoHoje, normalizaLead } from '../netlify/functions/_cacador.mjs';

test('TRAVA vermelha: Saiu sem Real', () => {
  assert.equal(isVermelho({ statusPosMapeamento: 'Saiu' }), true);
  assert.equal(isVermelho({ statusPosMapeamento: 'Saiu', qualidadeReal: 'A' }), false);
  assert.equal(isVermelho({ statusPosMapeamento: 'Em mapeamento' }), false);
});

test('marcaAuditoria: Real remove vermelho', () => {
  const leads = leadsDemoHoje().map(normalizaLead);
  const verm = leads.find((l) => l.id === 'demo-vermelho-saiu');
  assert.equal(verm.travaVermelha, true);
  const r = marcaAuditoria(leads, { leadId: 'demo-vermelho-saiu', qualidadeReal: 'B' });
  assert.equal(r.vermelho, false);
  assert.equal(r.lead.qualidadeReal, 'B');
});

test('taxa acerto Provisória vs Real', () => {
  const leads = [
    { qualidadeProvisoria: 'A', qualidadeReal: 'A' },
    { qualidadeProvisoria: 'B', qualidadeReal: 'C' },
  ];
  const a = acertoProvisoriaVsReal(leads);
  assert.equal(a.n, 2);
  assert.equal(a.acertos, 1);
  assert.equal(a.pct, 50);
});

test('heurística Auditora a partir do Caçador', () => {
  assert.equal(classificaHeuristica({ qualidade: 'bom', nome: 'X' }).qualidade, 'A');
  assert.equal(classificaHeuristica({ qualidade: 'errado' }).qualidade, 'D');
});

test('resumoAuditoria demo tem vermelho', () => {
  const r = resumoAuditoria(leadsDemoHoje().map(normalizaLead));
  assert.ok(r.vermelhos >= 1);
});
