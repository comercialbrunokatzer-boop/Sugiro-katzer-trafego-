import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extraiLeads, montaPlacar, decideDoDia, resumoPlacarWhats, montaCartoesCopiloto,
} from '../netlify/functions/_placar.mjs';

// Amostra no formato do Meta Ads Insights (nível campanha).
const data = [
  { campaign_name: 'FortMyers_BR_SC', spend: '731.91',
    actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '10' }] },
  { campaign_name: 'FortMyers cidades PORTUGAL', spend: '316.10',
    results: [{ values: [{ value: '5' }] }] },
  { campaign_name: 'FortMyers ESPANHA', spend: '55.99', actions: [] },          // gastou, 0 lead
  { campaign_name: 'FortMyers PORTUGAL', spend: '48.65' },                       // < R$50, 0 lead
  { campaign_name: 'FortMyers MIAMI/ORLANDO', spend: '252.92',
    actions: [{ action_type: 'lead', value: '2' }] },
];

test('extraiLeads: pega messaging_conversation_started e fallback em results', () => {
  assert.equal(extraiLeads(data[0]), 10); // via actions (WhatsApp)
  assert.equal(extraiLeads(data[1]), 5);  // via results (fallback)
  assert.equal(extraiLeads(data[2]), 0);  // gastou mas 0 lead
});

test('montaPlacar: gasto/leads/CPL por campanha + totais + ordena por gasto', () => {
  const p = montaPlacar(data);
  assert.equal(p.campanhas[0].nome, 'FortMyers_BR_SC'); // maior gasto primeiro
  const brsc = p.campanhas.find((c) => c.nome === 'FortMyers_BR_SC');
  assert.equal(brsc.leads, 10);
  assert.equal(brsc.cpl, 73.19); // 731.91 / 10
  assert.equal(p.totalLeads, 17); // 10 + 5 + 0 + 0 + 2
  assert.ok(p.cplMedio > 0);
});

test('decisão do dia: escala CPL baixo, revisa quem gastou >= R$50 e 0 lead', () => {
  const p = montaPlacar(data);
  const nomesRevisar = p.decisao.revisar.map((c) => c.nome);
  assert.ok(nomesRevisar.includes('FortMyers ESPANHA'));      // 55.99 e 0 lead -> revisar
  assert.ok(!nomesRevisar.includes('FortMyers PORTUGAL'));    // 48.65 < 50 -> não entra
  const nomesEscalar = p.decisao.escalar.map((c) => c.nome);
  assert.ok(nomesEscalar.includes('FortMyers cidades PORTUGAL')); // CPL 63 (abaixo da média) -> escalar
  assert.ok(!nomesEscalar.includes('FortMyers MIAMI/ORLANDO'));   // CPL 126 (acima da média) -> NÃO escala
  assert.equal(p.decisao.escalar[0].nome, 'FortMyers cidades PORTUGAL'); // melhor CPL primeiro
});

test('campanha inativa (R$0 no período) é filtrada do placar', () => {
  const p = montaPlacar([
    { campaign_name: 'Antiga sem gasto', spend: '0', actions: [] },
    { campaign_name: 'Ativa', spend: '120', actions: [{ action_type: 'lead', value: '3' }] },
  ]);
  assert.equal(p.campanhas.length, 1);
  assert.equal(p.campanhas[0].nome, 'Ativa');
});

test('CPL null quando 0 leads (não divide por zero)', () => {
  const p = montaPlacar([{ campaign_name: 'X', spend: '100', actions: [] }]);
  assert.equal(p.campanhas[0].cpl, null);
  assert.equal(p.cplMedio, null);
});

test('resumoPlacarWhats gera texto com total e decisão', () => {
  const txt = resumoPlacarWhats(montaPlacar(data));
  assert.match(txt, /Copiloto de Tr(á|a)fego/);
  assert.match(txt, /CAMPANHA:/);
  assert.match(txt, /SITUA(Ç|C)(Ã|A)O:/);
  assert.match(txt, /DADO COMERCIAL:/);
  assert.match(txt, /N(Ã|A)O ALTERE HOJE:/);
  assert.match(txt, /ROTEIRO META IA/);
});

test('montaCartoesCopiloto usa fallback sem CRM, nível e aprendizado determinístico', () => {
  const resumo = montaCartoesCopiloto(montaPlacar(data));
  assert.equal(resumo.cartoes[0].tipo, 'revisar'); // revisar vem antes por urgência
  assert.match(resumo.cartoes[0].dadoComercial, /CRM ainda n(ã|a)o ligado/);
  assert.match(resumo.cartoes[0].precisaAprovacaoBruno, /N(í|i)vel 1/);
  const escalar = resumo.cartoes.find((c) => c.tipo === 'escalar');
  assert.ok(escalar);
  assert.match(escalar.precisaAprovacaoBruno, /N(í|i)vel 2/);
  assert.ok(escalar.fichaMudanca);
  assert.ok(resumo.naoAltere.includes('FortMyers PORTUGAL'));
});
