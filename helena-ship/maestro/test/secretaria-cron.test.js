import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processaConversas, montaPropostas } from '../src/secretariaCron.js';
import { rodaSecretaria } from '../src/secretariaRun.js';
import { planoDeEscrita, aplica } from '../src/secretariaAplica.js';
import { estagioPorStageId } from '../src/secretaria.js';

const convVerde = {
  phone: '5511943340180',
  leadData: { full_name: 'Artur Nunes filho' },
  messages: [
    { role: 'user', content: 'Vi o anúncio, quero ver o imóvel e o preço. objetivo?: Moradia. Em quanto tempo?: 3 meses' },
    { role: 'assistant', content: 'Oi! Claro, te mando.' },
  ],
};

test('processaConversas: monta decisão + plano por conversa (com card)', async () => {
  const itens = await processaConversas(
    [{ chave: '5511943340180', conv: convVerde }],
    {
      achaDeal: async () => ({ dealId: '6653', stageId: 'C1:PREPAYMENT_INVOICE' }),
      rodar: (conv, opts) => rodaSecretaria(conv, opts),
      estagioPorStageId,
    },
  );
  assert.equal(itens.length, 1);
  const it = itens[0];
  assert.equal(it.nome, 'Artur Nunes filho');
  assert.equal(it.etapa_atual, 'Mapeamento');
  assert.equal(it.temCard, true);
  assert.equal(it.decisao.acao, 'ATUALIZAR'); // zona verde
  assert.ok(it.plano && it.plano.fields.STAGE_ID);
  assert.equal(it.campos.finalidade, 'moradia');
  assert.equal(it.campos.prazoMeses, 3);
});

test('processaConversas: sem achaDeal (sem card) -> não quebra, plano sem card', async () => {
  const itens = await processaConversas(
    [{ chave: '5511943340180', conv: convVerde }],
    { achaDeal: async () => null, rodar: (c, o) => rodaSecretaria(c, o), estagioPorStageId },
  );
  assert.equal(itens[0].temCard, false);
});

test('montaPropostas: SÓ lista zona vermelha (verde é aplicada calada)', () => {
  const itens = [
    { nome: 'Artur', etapa_atual: 'Mapeamento', decisao: { acao: 'ATUALIZAR' } }, // verde -> não entra
    { nome: 'Raciel', etapa_atual: 'Agendado Físico', decisao: { acao: 'PROPOR', parecer: { recommended_stage: 'Negociação' } } },
  ];
  const msg = montaPropostas(itens);
  assert.match(msg, /seu OK/i);
  assert.match(msg, /Raciel/);
  assert.match(msg, /Negociação/);
  assert.doesNotMatch(msg, /Artur/, 'zona verde não aparece (é aplicada calada)');
});

test('montaPropostas: sem zona vermelha -> string vazia (runner não manda nada)', () => {
  const itens = [{ nome: 'Artur', decisao: { acao: 'ATUALIZAR' } }];
  assert.equal(montaPropostas(itens), '');
});

// ─── integração: fluxo completo caller (processaConversas → aplica → processadosIds) ───

// Conversa com envio confirmado pela Helena (campos de confirmação no histórico).
const convConfirmada = {
  phone: '5511900000001',
  messages: [
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: 'Olá! Sou a Helena da Katzer 😊', messageId: 'wamid.integ001', envioConfirmado: true, enviadoEmMs: 1700000000000 },
  ],
};

test('integração caller: aplica:true → messageId adicionado ao processadosIds', async () => {
  const processadosIds = new Set();
  const itens = await processaConversas(
    [{ chave: '5511900000001', conv: convConfirmada }],
    {
      achaDeal: async () => ({ dealId: 'D-INT-001', stageId: 'C1:NEW' }),
      rodar: (conv, opts) => rodaSecretaria(conv, opts),
      estagioPorStageId,
      processadosIds,
    },
  );

  assert.equal(itens[0].decisao._regra, 'primeiro-contato');
  const messageId = itens[0].decisao.messageId;
  assert.ok(messageId);

  // Simula o loop do cron: aplica + adiciona ao Set somente após aplicado:true
  let escreveu = false;
  const resultado = await aplica(itens[0].plano, {
    modo: 'producao',
    atualizaNegocio: async () => { escreveu = true; return { ok: true }; },
  });
  if (resultado.aplicado === true && messageId) {
    processadosIds.add(messageId);
  }

  assert.equal(resultado.aplicado, true);
  assert.equal(escreveu, true);
  assert.ok(processadosIds.has(messageId), 'messageId deve estar no Set após aplica:true');
});

test('integração caller: DRY-RUN (homolog) → aplica:false → messageId NÃO adicionado ao Set', async () => {
  const processadosIds = new Set();
  const itens = await processaConversas(
    [{ chave: '5511900000001', conv: convConfirmada }],
    {
      achaDeal: async () => ({ dealId: 'D-INT-002', stageId: 'C1:NEW' }),
      rodar: (conv, opts) => rodaSecretaria(conv, opts),
      estagioPorStageId,
      processadosIds,
    },
  );

  const messageId = itens[0].decisao.messageId;
  const resultado = await aplica(itens[0].plano, {
    modo: 'homolog',
    atualizaNegocio: async () => ({ ok: true }),
  });
  if (resultado.aplicado === true && messageId) {
    processadosIds.add(messageId);
  }

  assert.equal(resultado.aplicado, false);
  assert.equal(processadosIds.size, 0, 'DRY-RUN não adiciona ao Set');
});

test('integração caller: aplica:false → messageId NÃO adicionado (writer indisponível)', async () => {
  const processadosIds = new Set();
  const itens = await processaConversas(
    [{ chave: '5511900000001', conv: convConfirmada }],
    {
      achaDeal: async () => ({ dealId: 'D-INT-003', stageId: 'C1:NEW' }),
      rodar: (conv, opts) => rodaSecretaria(conv, opts),
      estagioPorStageId,
      processadosIds,
    },
  );

  const messageId = itens[0].decisao.messageId;
  const resultado = await aplica(itens[0].plano, {
    modo: 'producao',
    atualizaNegocio: null, // writer indisponível
  });
  if (resultado.aplicado === true && messageId) {
    processadosIds.add(messageId);
  }

  assert.equal(resultado.aplicado, false);
  assert.equal(processadosIds.size, 0, 'writer indisponível não adiciona ao Set');
});

test('integração caller: exception em aplica → messageId NÃO adicionado', async () => {
  const processadosIds = new Set();
  const itens = await processaConversas(
    [{ chave: '5511900000001', conv: convConfirmada }],
    {
      achaDeal: async () => ({ dealId: 'D-INT-004', stageId: 'C1:NEW' }),
      rodar: (conv, opts) => rodaSecretaria(conv, opts),
      estagioPorStageId,
      processadosIds,
    },
  );

  const messageId = itens[0].decisao.messageId;
  let adicionou = false;
  try {
    await aplica(itens[0].plano, {
      modo: 'producao',
      atualizaNegocio: async () => { throw new Error('falha de rede simulada'); },
    });
    // nunca chega aqui — mas o padrão do cron é best-effort com try/catch
    adicionou = true;
  } catch {
    // exception: não adiciona
  }
  if (adicionou) processadosIds.add(messageId);

  assert.equal(processadosIds.size, 0, 'exception não adiciona ao Set');
});

test('integração caller: mesmo messageId depois do sucesso → segunda passagem retorna IGNORADO', async () => {
  const processadosIds = new Set();

  // Primeira passagem
  const itens1 = await processaConversas(
    [{ chave: '5511900000001', conv: convConfirmada }],
    {
      achaDeal: async () => ({ dealId: 'D-INT-005', stageId: 'C1:NEW' }),
      rodar: (conv, opts) => rodaSecretaria(conv, opts),
      estagioPorStageId,
      processadosIds,
    },
  );

  assert.equal(itens1[0].decisao._regra, 'primeiro-contato');
  const messageId = itens1[0].decisao.messageId;

  const resultado = await aplica(itens1[0].plano, {
    modo: 'producao',
    atualizaNegocio: async () => ({ ok: true }),
  });
  if (resultado.aplicado === true && messageId) {
    processadosIds.add(messageId);
  }
  assert.equal(resultado.aplicado, true);
  assert.ok(processadosIds.has(messageId));

  // Segunda passagem com o mesmo Set → IGNORADO (nenhuma segunda escrita)
  const itens2 = await processaConversas(
    [{ chave: '5511900000001', conv: convConfirmada }],
    {
      achaDeal: async () => ({ dealId: 'D-INT-005', stageId: 'C1:NEW' }),
      rodar: (conv, opts) => rodaSecretaria(conv, opts),
      estagioPorStageId,
      processadosIds,
    },
  );
  assert.equal(itens2[0].decisao.acao, 'IGNORADO', 'segundo processamento deve ser IGNORADO');
  assert.equal(itens2[0].decisao.messageId, messageId);
  assert.equal(processadosIds.size, 1, 'Set não cresce por duplicata');
});

test('processaConversas: processadosIds ausente nos deps -> funciona normalmente (backward compat)', async () => {
  const itens = await processaConversas(
    [{ chave: '5511900000001', conv: convConfirmada }],
    {
      achaDeal: async () => ({ dealId: 'D-INT-006', stageId: 'C1:NEW' }),
      rodar: (conv, opts) => rodaSecretaria(conv, opts),
      estagioPorStageId,
      // sem processadosIds
    },
  );
  assert.equal(itens.length, 1);
  assert.ok(itens[0].decisao);
});

