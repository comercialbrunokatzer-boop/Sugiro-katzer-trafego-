import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extraiCidadeProduto, linhaRanking, montaRanking, contaDiasNoAr, statusCampanha,
} from '../netlify/functions/_ranking.mjs';

const data = [
  {
    campaign_id: '1', campaign_name: 'FortMyers_BR_SC[10/07/26]', spend: '731.91',
    actions: [
      { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '10' },
      { action_type: 'onsite_conversion.lead_grouped', value: '9' },
      { action_type: 'lead', value: '9' },
    ],
  },
  {
    campaign_id: '2', campaign_name: 'FortMyers VIDEO Punta C.', spend: '377.42',
    actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '30' }],
  },
  {
    campaign_id: '3', campaign_name: 'Só clique PORTUGAL', spend: '300',
    actions: [{ action_type: 'link_click', value: '80' }], clicks: '80',
  },
  {
    campaign_id: '4', campaign_name: 'Amostra MIAMI', spend: '50',
    actions: [{ action_type: 'lead', value: '2' }],
  },
  {
    campaign_id: '5', campaign_name: 'Sem gasto', spend: '0',
    actions: [{ action_type: 'lead', value: '5' }],
  },
  {
    campaign_id: '6', campaign_name: 'Cara ROGGA', spend: '400',
    actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '4' }],
  },
];

test('cidade/produto = Produto · Cidade (V4.1)', () => {
  assert.equal(extraiCidadeProduto('FortMyers_BR_SC'), 'Fort Myers · Penha');
  assert.equal(extraiCidadeProduto('[BARRA VIEW][SANDRA]'), 'Barra View · Barra Velha');
  assert.equal(extraiCidadeProduto('[ROGGA][AMANAY]'), 'Amanay · Itapoá');
  assert.equal(extraiCidadeProduto('[ALICERCE][AYA]'), 'Aya · Piçarras');
  assert.equal(extraiCidadeProduto('FORTMYERS_PENHA_VETTER_BR-SC'), 'Fort Myers · Penha');
});

test('linhaRanking: CPL form; nunca clique; null sem lead', () => {
  const br = linhaRanking(data[0]);
  assert.equal(br.leadsForm, 9);
  assert.equal(br.cplForm, 81.32);
  assert.equal(br.fonteLead, 'onsite_conversion.lead_grouped');
  const click = linhaRanking(data[2]);
  assert.equal(click.leadsForm, 0);
  assert.equal(click.cplForm, null);
  assert.equal(click.leadConfirmado, false);
});

test('montaRanking: ordena por menor CPL; volume CPL<=40; amostra separada', () => {
  const r = montaRanking(data, { periodo: 'last_7d' });
  assert.equal(r.ok, true);
  assert.equal(r.metrica, 'lead_formulario');
  // ranking (>=3 leads): VIDEO 30 @ 12.58, ROGGA 4 @ 100, BR_SC 9 @ 81.32
  assert.equal(r.rankingCpl[0].campanha.includes('VIDEO'), true);
  assert.equal(r.rankingCpl[0].cplForm, 12.58);
  assert.equal(r.rankingCpl[0].pos, 1);
  assert.ok(r.top10Cpl.length <= 10);
  assert.ok(r.rankingCpl[0].veredito);
  // volume: só CPL <= 40 → VIDEO
  assert.equal(r.rankingVolumeCpl.length, 1);
  assert.equal(r.rankingVolumeCpl[0].leadsForm, 30);
  // amostra pequena
  assert.ok(r.amostraPequena.some((x) => x.leadsForm === 2));
  // clique não entra no ranking
  assert.ok(!r.rankingCpl.some((x) => /clique/i.test(x.campanha)));
  assert.equal(r.totais.totalLeadsForm, 9 + 30 + 2 + 4);
});

test('status e dias no ar', () => {
  assert.equal(statusCampanha({ gasto: 100, leads: 10, cpl: 10, confirmado: true }), 'Boa');
  assert.equal(statusCampanha({ gasto: 0, leads: 0, cpl: null, confirmado: true }), 'Sem veiculação');
  assert.equal(statusCampanha({ gasto: 10, leads: 0, cpl: null, confirmado: false }), 'Form. não confirmado');
  const dias = contaDiasNoAr([
    { campaign_id: '1', spend: '10' },
    { campaign_id: '1', spend: '5' },
    { campaign_id: '1', spend: '0' },
    { campaign_id: '2', spend: '1' },
  ]);
  assert.equal(dias.get('1'), 2);
  assert.equal(dias.get('2'), 1);
});

test('erro de leitura não vira ranking zero', () => {
  const r = montaRanking([], { leituraOk: false, periodo: 'last_7d' });
  assert.equal(r.ok, false);
  assert.match(r.erro, /indisponíveis/i);
  assert.equal(r.rankingCpl.length, 0);
});
