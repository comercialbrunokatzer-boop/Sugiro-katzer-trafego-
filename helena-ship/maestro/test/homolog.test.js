/**
 * Homologação da Secretária (P1.A2) — o banco de casos golden precisa passar 100%
 * pra Secretária poder ser ligada com segurança.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homologaSecretaria } from '../src/homolog.js';

test('HOMOLOGAÇÃO: todos os casos golden da Secretária passam', () => {
  const r = homologaSecretaria();
  const falhas = r.resultados.filter((x) => !x.ok).map((x) => x.nome);
  assert.equal(r.aprovado, true, `casos que falharam: ${falhas.join(' | ')}`);
  assert.equal(r.passou, r.total);
  assert.ok(r.total >= 6, 'cobre os cenários principais');
});
