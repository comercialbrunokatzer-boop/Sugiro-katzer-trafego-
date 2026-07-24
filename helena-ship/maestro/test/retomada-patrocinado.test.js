import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ehPatrocinadoDeal,
  ehElegivelRetomada,
  montaFilaRetomada,
  detectarProdutoRetomada,
  personalizaTemplate,
  dentroJanelaComercial,
  passaAntiSpam,
} from '../src/retomadaPatrocinado.js';

const AGORA = Date.parse('2026-07-24T15:00:00-03:00'); // sex 15h BRT — janela ok

const flavius = {
  id: '9001',
  title: 'Preencher formulário de CRM "LEAD PATROC. FORT MYERS"',
  fonte: 'Patrocinado Corretor',
  origemAnuncio: 'Patrocinado Corretor',
  assignedById: '1',
  stageId: 'C1:NEW',
  fase: 'Leads Novos',
  telefone: '15086422340',
  nome: 'FLAVIUS ALVES',
  dateCreate: '2026-07-20T12:00:00-03:00',
};

test('ehPatrocinadoDeal: Patrocinado Corretor / LEAD PATROC', () => {
  assert.equal(ehPatrocinadoDeal(flavius), true);
  assert.equal(ehPatrocinadoDeal({ title: 'WhatsApp direto Edsel' }), false);
});

test('ehElegivelRetomada: exemplo Flavius (Bruno + patrocinado + Novos)', () => {
  const r = ehElegivelRetomada(flavius, { agoraMs: AGORA });
  assert.equal(r.ok, true, r.motivo);
});

test('ehElegivelRetomada: Edsel / roleta fora', () => {
  assert.equal(ehElegivelRetomada({ ...flavius, assignedById: '985' }, { agoraMs: AGORA }).ok, false);
  assert.equal(ehElegivelRetomada({ ...flavius, stageId: 'C1:LOSE', fase: 'Rampage' }, { agoraMs: AGORA }).ok, false);
});

test('detectarProdutoRetomada', () => {
  assert.equal(detectarProdutoRetomada(flavius), 'fort_myers');
  assert.equal(detectarProdutoRetomada({ title: 'LEAD PATROC. GRANT' }), 'grant_home');
  assert.equal(detectarProdutoRetomada({ title: 'ALICERCE' }), 'celebration');
});

test('personalizaTemplate', () => {
  assert.match(personalizaTemplate('Oi {nome}, tudo bem?', 'FLAVIUS ALVES'), /Oi Flavius/);
});

test('dentroJanelaComercial: 15h BRT ok · 22h BRT fora', () => {
  assert.equal(dentroJanelaComercial(AGORA), true);
  assert.equal(dentroJanelaComercial(Date.parse('2026-07-24T22:30:00-03:00')), false);
});

test('passaAntiSpam: intervalo e humano', () => {
  assert.equal(passaAntiSpam({}, { agoraMs: AGORA }).ok, true);
  assert.equal(passaAntiSpam({ handledByHuman: true }, { agoraMs: AGORA }).ok, false);
  assert.equal(
    passaAntiSpam({ lastRetomadaMs: AGORA - 2 * 3600000 }, { agoraMs: AGORA, intervaloMinHoras: 36 }).ok,
    false,
  );
});

test('montaFilaRetomada: lote pequeno com mídia Fort Myers', () => {
  const deals = [
    flavius,
    { ...flavius, id: '9002', telefone: '5547999000001', nome: 'Maria', title: 'LEAD PATROC. GRANT', assignedById: '1' },
    { ...flavius, id: '9003', telefone: '5547999000002', assignedById: '985' }, // Edsel
  ];
  const { lote, pulados } = montaFilaRetomada(deals, {
    agoraMs: AGORA,
    maxLote: 5,
    estadosPorTel: {},
  });
  assert.equal(lote.length, 2);
  assert.ok(lote.some((x) => x.produtoKey === 'fort_myers' && x.midiaChave === 'fort_myers'));
  assert.ok(lote.every((x) => x.mensagem && x.mensagem.length < 400));
  assert.ok(pulados.some((p) => p.motivo === 'nao_bruno'));
});

test('montaFilaRetomada: respeita teto diário', () => {
  const { lote } = montaFilaRetomada([flavius], {
    agoraMs: AGORA,
    enviadasHojeGlobal: 20,
    limiteDiario: 20,
  });
  assert.equal(lote.length, 0);
});
