import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leadsDemoHoje,
  resolveLeadsDoDia,
  linhaLead,
  marcaLead,
  payloadCacador,
  textoHaMinutos,
  totaisPorCampanha,
} from '../netlify/functions/_cacador.mjs';

test('blob antigo fonte=demo sem allowDemo: limpa (não mostra João falso)', () => {
  const r = resolveLeadsDoDia({
    hoje: '2026-07-24',
    doc: { data: '2026-07-24', leads: leadsDemoHoje(), fonte: 'demo' },
    allowDemo: false,
  });
  assert.equal(r.fonte, 'vazio');
  assert.equal(r.leads.length, 0);
  assert.equal(r.persistir, true);
});

test('sem allowDemo: dia vazio NÃO planta João Silva falso', () => {
  const r = resolveLeadsDoDia({ hoje: '2026-07-24', doc: null, allowDemo: false });
  assert.equal(r.fonte, 'vazio');
  assert.equal(r.leads.length, 0);
  assert.equal(r.persistir, true);
});

test('allowDemo: pode usar seed só em treino/homolog', () => {
  const r = resolveLeadsDoDia({ hoje: '2026-07-24', doc: null, allowDemo: true });
  assert.equal(r.fonte, 'demo');
  assert.ok(r.leads.some((l) => l.id === 'demo-joao-silva'));
});

test('doc do dia com leads reais: preserva fonte blobs', () => {
  const r = resolveLeadsDoDia({
    hoje: '2026-07-24',
    doc: { data: '2026-07-24', leads: [{ id: 'real-1', nome: 'Lead Real' }], fonte: 'bitrix' },
    allowDemo: false,
  });
  assert.equal(r.fonte, 'bitrix');
  assert.equal(r.leads[0].id, 'real-1');
  assert.equal(r.persistir, false);
});

test('demo Bruno: João + Maria com linha canônica', () => {
  const agora = Date.now();
  const leads = leadsDemoHoje();
  leads[0].recebidoEm = new Date(agora - 12 * 60 * 1000).toISOString();
  leads[1].recebidoEm = new Date(agora - 34 * 60 * 1000).toISOString();
  assert.equal(leads[0].nome, 'João Silva');
  assert.match(linhaLead(leads[0], { agora }), /João Silva/);
  assert.match(linhaLead(leads[0], { agora }), /FORTMYERS_PENHA_VETTER_BR-SC/);
  assert.match(linhaLead(leads[1], { agora }), /Maria/);
  assert.equal(textoHaMinutos(12), 'há 12min');
  assert.ok(leads.some((l) => l.id === 'demo-vermelho-saiu'));
});

test('1 toque Bom → toast CPL BOM + totais campanha', () => {
  const leads = leadsDemoHoje();
  const r = marcaLead(leads, { leadId: 'demo-joao-silva', qualidade: 'bom' });
  assert.equal(r.toast, 'Registrado - CPL BOM recalculado');
  assert.equal(r.lead.qualidade, 'bom');
  assert.match(r.totaisCampanha.campanha, /FORTMYERS/i);
  assert.equal(r.totaisCampanha.bom, 1);
  assert.equal(r.totaisCampanha.leadsBons, 1);

  const r2 = marcaLead(r.leads, { leadId: 'demo-maria', qualidade: 'comprador' });
  const tots = totaisPorCampanha(r2.leads);
  assert.equal(tots.find((t) => /AMANAY/i.test(t.campanha)).comprador, 1);
  assert.ok(tots.find((t) => /AMANAY/i.test(t.campanha)).leadsBons >= 1);
});

test('sem estrutura EN: Bom em EUA_Americanos → Curioso', () => {
  const leads = [{
    id: 'eua-1',
    nome: 'John',
    telefone: '1 xxx',
    campanha: 'FORTMYERS_PENHA_VETTER_EUA_Americanos',
    recebidoEm: new Date().toISOString(),
  }];
  const r = marcaLead(leads, { leadId: 'eua-1', qualidade: 'bom' });
  assert.equal(r.lead.qualidade, 'curioso');
  assert.equal(r.forcouCurioso, true);
  assert.match(r.toast, /Curioso/);
});

test('payloadCacador: 4 botões por lead + auditoria vermelha', () => {
  const p = payloadCacador(leadsDemoHoje());
  assert.equal(p.ok, true);
  assert.match(p.titulo, /CAÇAR LEADS DE HOJE/);
  assert.equal(p.toastOk, 'Registrado - CPL BOM recalculado');
  assert.ok(p.leads.length >= 4);
  assert.equal(p.leads[0].botoes.length, 4);
  assert.equal(p.leads[0].botoes[0].label, '🟢 Bom');
  assert.equal(p.leads[0].botoes[3].label, '💰 Comprador');
  assert.ok(p.vermelhos >= 1);
  assert.ok(p.auditoria.leadsVermelhos.some((l) => l.id === 'demo-vermelho-saiu'));
});
