import { test } from 'node:test';
import assert from 'node:assert';
import {
  conversaHelenaParaMsgs, textoDoCliente, parecerDeterministico, rodaSecretaria,
} from '../src/secretariaRun.js';

// Conversa no formato REAL da Helena (helena_conversas)
const convMapeamento = {
  messages: [
    { role: 'assistant', content: 'Oi! Aqui é a Helena. Sobre o Fort Myers...' },
    { role: 'user', content: 'Gostei! Quero ver o imóvel, dá pra marcar uma visita?' },
    { role: 'user', content: 'Quanto custa a unidade de 3 suítes? tem desconto na entrada?' },
  ],
};

test('ponte: mapeia role->autor e isola fala do cliente (Lei 01)', () => {
  const msgs = conversaHelenaParaMsgs(convMapeamento);
  assert.equal(msgs[0].autor, 'equipe');   // assistant = Helena/equipe
  assert.equal(msgs[1].autor, 'cliente');
  const txt = textoDoCliente(msgs);
  assert.ok(txt.includes('marcar uma visita'));
  assert.ok(!txt.includes('Aqui é a Helena')); // fala da equipe NUNCA entra
});

test('quero ver + preço/desconto = MAPEAMENTO (verde) -> ATUALIZAR, Michel acompanha', async () => {
  // Regra do CEO: interesse/preço/condição pré-reunião é Mapeamento, não Negociação.
  const r = await rodaSecretaria(convMapeamento, { estagioAtual: 'Leads Novos', dealId: 'HOMOLOG' });
  assert.equal(r.acao, 'ATUALIZAR');
  assert.equal(r.update._estagio, 'Mapeamento');
  assert.equal(r.acompanhamento, 'MICHEL');
  assert.ok(r.mudanca); // transição Leads Novos -> Mapeamento
});

test('negociação REAL (fecho se abaixar) = zona vermelha -> PROPÕE pro Bruno', async () => {
  const conv = { messages: [
    { role: 'user', content: 'Já vi tudo. Fecho se você abaixar pra 950, é o meu limite.' },
  ]};
  const r = await rodaSecretaria(conv, { estagioAtual: 'Mapeamento', dealId: 'HOMOLOG' });
  assert.equal(r.acao, 'PROPOR');
  assert.equal(r.update._estagio, 'Negociação');
  assert.equal(r.revisor, 'BRUNO'); // nunca move sozinha
});

test('"Ganhou" sem confirmação objetiva -> REVISÃO HUMANA (trava §6A)', async () => {
  const parecerFake = () => JSON.stringify({
    recommended_stage: 'Ganhou', confidence: 0.9,
    evidence: ['acho que vou pensar'], resumo: 'x', requires_human_review: false,
  });
  const r = await rodaSecretaria(
    { messages: [{ role: 'user', content: 'acho que vou pensar' }] },
    { estagioAtual: 'Negociação', dealId: 'HOMOLOG', claudeFn: parecerFake },
  );
  assert.equal(r.acao, 'REVISAO_HUMANA');
  assert.equal(r.revisor, 'BRUNO');
  assert.ok(r.motivos.some((m) => /Ganhou.*sem confirma/i.test(m)));
});

test('parecer determinístico é conservador quando não há sinal forte', () => {
  const p = parecerDeterministico([{ autor: 'cliente', texto: 'oi, tudo bem?' }]);
  assert.ok(p.confidence < 0.7); // não aplica sozinho sem sinal
});

test('primeiro contato: mensagem persistida da Helena move Leads Novos para Tentando Contato', async () => {
  const conv = { messages: [
    { role: 'user', content: 'oi', ts: 1000 },
    { role: 'assistant', content: 'Oi! Sou a Helena da Katzer 😊', ts: 2000 },
  ] };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 6639 });
  assert.equal(r.acao, 'ATUALIZAR');
  assert.equal(r.update.fields.STAGE_ID, 'C1:PREPARATION');
  assert.equal(r._regra, 'primeiro-contato');
  assert.equal(r._cadencia.ultimo_contato_ms, 2000);
});

test('primeiro contato: mensagem da Helena marcada como falha não move o card', async () => {
  const conv = { messages: [
    { role: 'user', content: 'oi', ts: 1000 },
    { role: 'assistant', content: 'Oi!', ts: 2000, envioConfirmado: false, statusEnvio: 'failed' },
  ] };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 1 });
  assert.notEqual(r._regra, 'primeiro-contato');
});

test('primeiro contato: fase ausente não presume Leads Novos', async () => {
  const conv = { messages: [{ role: 'assistant', content: 'Oi!', ts: 2000 }] };
  const r = await rodaSecretaria(conv, { dealId: 1 });
  assert.notEqual(r._regra, 'primeiro-contato');
});
