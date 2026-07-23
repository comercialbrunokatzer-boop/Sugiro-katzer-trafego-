import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extraiLeads, extraiLeadsFormulario, montaPlacar, decideDoDia, resumoPlacarWhats, inventariarAcoes,
} from '../netlify/functions/_placar.mjs';

const data = [
  // messaging NÃO conta; lead_grouped sim (não soma os dois)
  { campaign_name: 'FortMyers_BR_SC', spend: '731.91',
    actions: [
      { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '10' },
      { action_type: 'onsite_conversion.lead_grouped', value: '9' },
      { action_type: 'lead', value: '9' }, // sobreposto — NÃO somar
    ] },
  // results genérico SEM indicator de lead → não conta
  { campaign_name: 'FortMyers cidades PORTUGAL', spend: '316.10',
    results: [{ values: [{ value: '5' }] }],
    clicks: '40',
    actions: [{ action_type: 'link_click', value: '40' }] },
  // results COM indicator de lead → conta
  { campaign_name: 'FortMyers VIDEO', spend: '200',
    results: [{ indicator: 'actions:onsite_conversion.lead_grouped', values: [{ value: '16' }] }] },
  { campaign_name: 'FortMyers ESPANHA', spend: '55.99', actions: [] },
  { campaign_name: 'FortMyers PORTUGAL', spend: '48.65' },
  { campaign_name: 'FortMyers MIAMI/ORLANDO', spend: '252.92',
    actions: [
      { action_type: 'link_click', value: '80' },
      { action_type: 'lead', value: '2' },
    ] },
];

test('extraiLeadsFormulario: prioridade lead_grouped; IGNORA messaging e clique; NÃO soma lead+grouped', () => {
  assert.equal(extraiLeadsFormulario(data[0]).leads, 9); // não 9+9+10
  assert.equal(extraiLeadsFormulario(data[0]).fonte, 'onsite_conversion.lead_grouped');
  assert.equal(extraiLeadsFormulario(data[0]).confirmado, true);
  assert.equal(extraiLeadsFormulario(data[1]).leads, 0);
  assert.equal(extraiLeadsFormulario(data[1]).confirmado, false); // só clique
  assert.match(extraiLeadsFormulario(data[1]).aviso, /Não foi possível confirmar/);
  assert.equal(extraiLeadsFormulario(data[2]).leads, 16);
  assert.equal(extraiLeadsFormulario(data[5]).leads, 2);
  assert.equal(extraiLeadsFormulario(data[5]).fonte, 'lead');
  assert.equal(extraiLeads(data[5]), 2);
});

test('montaPlacar: CPL só com formulário confirmado; clique não entra', () => {
  const p = montaPlacar(data);
  assert.equal(p.metrica, 'lead_formulario');
  const brsc = p.campanhas.find((c) => c.nome === 'FortMyers_BR_SC');
  assert.equal(brsc.leads, 9);
  assert.equal(brsc.cpl, 81.32); // 731.91/9
  const miami = p.campanhas.find((c) => c.nome === 'FortMyers MIAMI/ORLANDO');
  assert.equal(miami.leads, 2);
  assert.equal(miami.cpl, 126.46);
  const portugal = p.campanhas.find((c) => c.nome === 'FortMyers cidades PORTUGAL');
  assert.equal(portugal.leads, 0);
  assert.equal(portugal.cpl, null); // não CPL com clique
  // total confirmado: 9 + 0 + 16 + 0 + 0 + 2 = 27
  assert.equal(p.totalLeads, 27);
  assert.ok(p.fontesLead.includes('onsite_conversion.lead_grouped'));
});

test('decisão do dia: revisa quem gastou sem cadastro de formulário', () => {
  const p = montaPlacar(data);
  const nomesRevisar = p.decisao.revisar.map((c) => c.nome);
  assert.ok(nomesRevisar.includes('FortMyers ESPANHA'));
  // PORTUGAL: clique sem form confirmado → NÃO entra em revisar (não inventa zero como certeza operacional de form)
  assert.ok(!nomesRevisar.includes('FortMyers cidades PORTUGAL'));
});

test('campanha inativa filtrada; CPL null sem formulário', () => {
  const p = montaPlacar([
    { campaign_name: 'Antiga', spend: '0', actions: [{ action_type: 'lead', value: '1' }] },
    { campaign_name: 'Ativa', spend: '120', actions: [{ action_type: 'lead', value: '3' }] },
    { campaign_name: 'Só clique', spend: '100', actions: [{ action_type: 'link_click', value: '50' }] },
  ]);
  assert.equal(p.campanhas.length, 2);
  const soClique = p.campanhas.find((c) => c.nome === 'Só clique');
  assert.equal(soClique.leads, 0);
  assert.equal(soClique.cpl, null);
  assert.equal(soClique.leadConfirmado, false);
  assert.match(soClique.avisoLead, /Não foi possível confirmar/);
});

test('inventariarAcoes lista action_types sem misturar', () => {
  const inv = inventariarAcoes(data);
  assert.ok(inv.formulariosNosTotais.some((x) => x.action_type === 'onsite_conversion.lead_grouped'));
  assert.ok(inv.totais.some((x) => x.action_type === 'link_click'));
  assert.ok(inv.fontesUsadas.includes('onsite_conversion.lead_grouped'));
});

test('resumoPlacarWhats fala em cadastro form., não clique', () => {
  const txt = resumoPlacarWhats(montaPlacar(data));
  assert.match(txt, /cadastro/);
  assert.match(txt, /formulário/);
  assert.doesNotMatch(txt, /muitos cliques/i);
});
