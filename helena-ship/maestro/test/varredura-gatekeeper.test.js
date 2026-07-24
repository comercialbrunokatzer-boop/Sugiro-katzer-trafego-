import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montaLoteVarreduraSeguro } from '../src/varreduraComGatekeeper.js';
import { normalizaConfigPiloto } from '../src/gatekeeper.js';

const AGORA = Date.parse('2026-07-23T12:00:00-03:00');
const h = (n) => n * 3600000;

const PILOTO = normalizaConfigPiloto({
  dealIds: ['1', '6'],
  idadeMaxDias: 30,
  categoryId: '1',
});

const deals = [
  {
    dealId: '1', stageId: 'C1:NEW', phone: '5547999990001',
    categoryId: '1', criadoEmMs: AGORA - 2 * 86400000,
    ultimaAtividadeMs: AGORA - h(50), campanha: 'fort myers',
  },
  {
    dealId: '99', stageId: 'C1:NEW', phone: '5547999990099',
    categoryId: '1', criadoEmMs: AGORA - 2 * 86400000,
    ultimaAtividadeMs: AGORA - h(50), campanha: 'outra',
  },
  {
    dealId: '6', stageId: 'C1:NEW', phone: '5547999990006',
    categoryId: '1', criadoEmMs: AGORA - 2 * 86400000,
    // sem atividade
  },
];

test('gatekeeper: só o lote no piloto passa; fora do piloto bloqueia', () => {
  const r = montaLoteVarreduraSeguro(deals, {
    agoraMs: AGORA,
    paradoHorasMin: 24,
    maxLote: 10,
    gatekeeper: PILOTO,
  });
  const ids = r.lote.map((d) => d.dealId);
  assert.ok(ids.includes('1'));
  assert.ok(ids.includes('6'));
  assert.ok(!ids.includes('99'));
  assert.ok(r.bloqueados.some((b) => String(b.dealId) === '99'));
});

test('gatekeeper vazio (fail-closed): lote final vazio', () => {
  const r = montaLoteVarreduraSeguro(deals, {
    agoraMs: AGORA,
    paradoHorasMin: 24,
    maxLote: 10,
    gatekeeper: normalizaConfigPiloto({}), // sem allowlist
  });
  assert.equal(r.lote.length, 0);
  assert.ok(r.bloqueados.length > 0);
});
