import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  campanhaOperacional,
  montaSnapshotAtivas,
  diffAtivas,
  campanhaRuimOuCara,
  michelMexeuNaCampanha,
  ruinsSemMovimento,
  mensagemAcaoMichel,
  mensagensVigilante,
  filtraNovosAlertas,
  chaveAlerta,
} from '../netlify/functions/_alerta-ceo-campanhas.mjs';

test('ignora [TESTE] e PUBLICOS NOVACONFIG', () => {
  assert.equal(campanhaOperacional('[ALICERCE] ALISSON'), true);
  assert.equal(campanhaOperacional('[TESTE] algo'), false);
  assert.equal(campanhaOperacional('FORT MYERS TESTE PUBLICOS NOVO CONFIG'), false);
});

test('diff: nova e parada', () => {
  const a = montaSnapshotAtivas([
    { id: '1', nome: 'A', ativa: true },
    { id: '2', nome: 'B', ativa: true },
  ]);
  const b = montaSnapshotAtivas([
    { id: '2', nome: 'B', ativa: true },
    { id: '3', nome: 'C', ativa: true },
  ]);
  const d = diffAtivas(a, b);
  assert.equal(d.novas.length, 1);
  assert.equal(d.novas[0].id, '3');
  assert.equal(d.paradas.length, 1);
  assert.equal(d.paradas[0].id, '1');
});

test('ruim/cara + Michel não mexeu entra no alerta', () => {
  const ruim = campanhaRuimOuCara({
    cpl: 90, gasto: 400, forms: 5, detail: { fake: 1, ruim: 0 },
  });
  assert.equal(ruim.ruim, true);

  const camps = [{
    id: '99',
    name: 'Cara SC',
    ativa: true,
    cpl: 90,
    gastoNum: 400,
    forms: 5,
    detail: { fake: 1, ruim: 0 },
    qual: 'bad',
  }];
  const feed = [{
    acao: 'manter',
    campanhaId: '88',
    campanha: 'Outra',
    data: '2026-07-24',
  }];
  const r = ruinsSemMovimento(camps, feed, { dataBRT: '2026-07-24' });
  assert.equal(r.length, 1);
  assert.equal(r[0].id, '99');

  const feed2 = [{
    acao: 'orcamento',
    campanhaId: '99',
    campanha: 'Cara SC',
    data: '2026-07-24',
  }];
  assert.equal(ruinsSemMovimento(camps, feed2, { dataBRT: '2026-07-24' }).length, 0);
  assert.equal(michelMexeuNaCampanha(feed2, { campanhaId: '99', dataBRT: '2026-07-24' }), true);
});

test('mensagem de ação sempre rotula Parou/Manteve/Orçamento', () => {
  const t = mensagemAcaoMichel({
    acao: 'parar',
    textoFeed: 'Parou X',
    campanhaId: '123',
    metaOk: true,
    hm: '10:15',
  });
  assert.match(t, /PAROU/);
  assert.match(t, /123/);
  assert.match(t, /Meta confirmou/);
});

test('vigilante monta 3 tipos + dedupe', () => {
  const msgs = mensagensVigilante({
    novas: [{ id: '1', nome: 'Nova' }],
    paradas: [{ id: '2', nome: 'Old' }],
    ruins: [{ id: '3', nome: 'Cara', cpl: 80, motivo: 'CPL alto' }],
    hm: '11:00',
  });
  assert.equal(msgs.length, 3);
  const enviados = { [chaveAlerta('nova', '1', '2026-07-24')]: 'x' };
  const f = filtraNovosAlertas(msgs, enviados, '2026-07-24');
  assert.equal(f.mensagens.length, 2);
  assert.ok(f.novasChaves.every((k) => !k.includes('|nova|1')));
});
