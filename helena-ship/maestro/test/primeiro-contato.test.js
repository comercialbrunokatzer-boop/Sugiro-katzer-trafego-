import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidePrimeiroContato, estadoCadenciaInicial } from '../src/primeiroContato.js';
import { planoDeEscrita, aplica } from '../src/secretariaAplica.js';
import { rodaSecretaria, validaEventoConfirmado, encontraPrimeiroContatoConfirmado, conversaHelenaParaMsgs } from '../src/secretariaRun.js';

// ─── decidePrimeiroContato ────────────────────────────────────────────────────

test('lead em Leads Novos (C1:NEW) -> move pra Tentando Contato + comentário', () => {
  const d = decidePrimeiroContato({
    stageId: 'C1:NEW', dealId: 6639, resumo: 'Cliente pediu vídeo do Fort Myers, orçamento até 900k.',
    contatoConfirmado: true, messageId: 'wamid.fort001', enviadoEmMs: 1000,
  });
  assert.equal(d.acao, 'ATUALIZAR');
  assert.equal(d.update.fields.STAGE_ID, 'C1:PREPARATION');
  assert.match(d.update.fields.COMMENTS, /Fort Myers/);
  assert.match(d.update.fields.COMMENTS, /Leads Novos → Tentando Contato/);
  assert.equal(d._idempotencyKey, 'primeiro-contato:6639:wamid.fort001');
  assert.equal(d._cadencia.ultimo_contato_ms, 1000);
});

test('envio confirmado em Leads Novos -> Tentando Contato + cadência (API main)', () => {
  const d = decidePrimeiroContato({
    stageId: 'C1:NEW', dealId: 6639, resumo: 'Cliente recebeu a abertura.',
    contatoConfirmado: true, messageId: 'zapi-1', enviadoEmMs: 1000,
  });
  assert.equal(d.acao, 'ATUALIZAR');
  assert.equal(d.update.fields.STAGE_ID, 'C1:PREPARATION');
  assert.equal(d._idempotencyKey, 'primeiro-contato:6639:zapi-1');
  assert.equal(d._cadencia.ultimo_contato_ms, 1000);
});

test('sem confirmação de envio -> não move', () => {
  assert.equal(decidePrimeiroContato({
    stageId: 'C1:NEW', dealId: 1, messageId: 'x', enviadoEmMs: 1000,
  }), null);
});

test('lead já em Tentando Contato (ou além) -> não age (não regride nem re-move)', () => {
  assert.equal(decidePrimeiroContato({
    stageId: 'C1:PREPARATION', dealId: 1, contatoConfirmado: true,
    messageId: 'x', enviadoEmMs: 1000,
  }), null);
});

test('lead em Mapeamento -> não regride para Tentando Contato', () => {
  assert.equal(decidePrimeiroContato({
    estagioAtual: 'Mapeamento', dealId: 2, contatoConfirmado: true,
    messageId: 'x', enviadoEmMs: 1000,
  }), null);
});

test('lead em Follow Up -> não regride', () => {
  assert.equal(decidePrimeiroContato({
    estagioAtual: 'Follow Up', dealId: 3, contatoConfirmado: true,
    messageId: 'x', enviadoEmMs: 1000,
  }), null);
});

test('lead em Negociação -> não regride', () => {
  assert.equal(decidePrimeiroContato({
    estagioAtual: 'Negociação', dealId: 4, contatoConfirmado: true,
    messageId: 'x', enviadoEmMs: 1000,
  }), null);
});

test('sem resumo -> comentário padrão de contato iniciado', () => {
  const d = decidePrimeiroContato({
    stageId: 'C1:NEW', dealId: 2, contatoConfirmado: true,
    messageId: 'wamid.2', enviadoEmMs: 1000,
  });
  assert.match(d.update.fields.COMMENTS, /Helena iniciou o contato/);
});

// ─── portão aplica() ──────────────────────────────────────────────────────────

test('a decisão passa pelo portão: DRY-RUN em homolog (não escreve)', async () => {
  const d = decidePrimeiroContato({
    stageId: 'C1:NEW', dealId: 6639, resumo: 'ok',
    contatoConfirmado: true, messageId: 'wamid.dry', enviadoEmMs: 1000,
  });
  const plano = planoDeEscrita(d, { dealId: 6639 });
  assert.ok(plano && plano.fields.STAGE_ID === 'C1:PREPARATION');
  let escreveu = false;
  const r = await aplica(plano, { modo: 'homolog', atualizaNegocio: async () => { escreveu = true; } });
  assert.equal(r.aplicado, false);
  assert.equal(escreveu, false); // homolog NÃO toca no Bitrix
});

test('em producao com writer, escreve o plano (fase + comentário)', async () => {
  const d = decidePrimeiroContato({
    stageId: 'C1:NEW', dealId: 6639, resumo: 'ok',
    contatoConfirmado: true, messageId: 'wamid.prod', enviadoEmMs: 1000,
  });
  const plano = planoDeEscrita(d, { dealId: 6639 });
  let recebeu = null;
  const r = await aplica(plano, { modo: 'producao', atualizaNegocio: async (id, fields) => { recebeu = { id, fields }; return { ok: true }; } });
  assert.equal(r.aplicado, true);
  assert.equal(recebeu.fields.STAGE_ID, 'C1:PREPARATION');
});

// ─── estadoCadenciaInicial ────────────────────────────────────────────────────

test('estadoCadenciaInicial: zera a cadência a partir de agora', () => {
  const e = estadoCadenciaInicial(1000);
  assert.equal(e.ultimo_contato_ms, 1000);
  assert.deepEqual(e.niveis_disparados, []);
});

test('cadência rejeita horário inválido', () => {
  assert.throws(() => estadoCadenciaInicial(undefined), /inválido/);
});

// ─── validaEventoConfirmado ───────────────────────────────────────────────────

test('validaEventoConfirmado: evento válido da Helena', () => {
  assert.equal(validaEventoConfirmado({ enviado: true, messageId: 'wamid.abc', sentAt: 1000, autor: 'helena' }), true);
});

test('validaEventoConfirmado: enviado:false -> rejeita', () => {
  assert.equal(validaEventoConfirmado({ enviado: false, messageId: 'wamid.abc', autor: 'helena' }), false);
});

test('validaEventoConfirmado: enviado ausente -> rejeita', () => {
  assert.equal(validaEventoConfirmado({ messageId: 'wamid.abc', autor: 'helena' }), false);
});

test('validaEventoConfirmado: autor "Bruno" -> rejeita (humano)', () => {
  assert.equal(validaEventoConfirmado({ enviado: true, messageId: 'wamid.abc', autor: 'Bruno' }), false);
});

test('validaEventoConfirmado: autor "equipe" -> rejeita (genérico demais)', () => {
  assert.equal(validaEventoConfirmado({ enviado: true, messageId: 'wamid.abc', autor: 'equipe' }), false);
});

test('validaEventoConfirmado: autor "Carol" -> rejeita (humano)', () => {
  assert.equal(validaEventoConfirmado({ enviado: true, messageId: 'wamid.abc', autor: 'Carol' }), false);
});

test('validaEventoConfirmado: autor "Michel" -> rejeita (humano)', () => {
  assert.equal(validaEventoConfirmado({ enviado: true, messageId: 'wamid.abc', autor: 'Michel' }), false);
});

test('validaEventoConfirmado: messageId vazio -> rejeita', () => {
  assert.equal(validaEventoConfirmado({ enviado: true, messageId: '', autor: 'helena' }), false);
});

test('validaEventoConfirmado: messageId ausente -> rejeita', () => {
  assert.equal(validaEventoConfirmado({ enviado: true, autor: 'helena' }), false);
});

test('validaEventoConfirmado: não-objeto -> rejeita', () => {
  assert.equal(validaEventoConfirmado(null), false);
  assert.equal(validaEventoConfirmado('wamid.abc'), false);
  assert.equal(validaEventoConfirmado(undefined), false);
});

// ─── encontraPrimeiroContatoConfirmado ────────────────────────────────────────

test('encontraPrimeiroContatoConfirmado: extrai primeira mensagem da Helena confirmada', () => {
  const msgs = conversaHelenaParaMsgs({ messages: [
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: 'Olá!', messageId: 'zapi-100', envioConfirmado: true, enviadoEmMs: 1000 },
  ] });
  const c = encontraPrimeiroContatoConfirmado(msgs);
  assert.ok(c);
  assert.equal(c.messageId, 'zapi-100');
  assert.equal(c.enviadaEmMs, 1000);
});

test('encontraPrimeiroContatoConfirmado: sem mensagem confirmada da Helena -> null', () => {
  const msgs = conversaHelenaParaMsgs({ messages: [
    { role: 'user', content: 'oi' },
  ] });
  assert.equal(encontraPrimeiroContatoConfirmado(msgs), null);
});

// ─── rodaSecretaria — primeiro contato com evento explícito confirmado ────────

test('rodaSecretaria: envio atual da Helena confirmado + Leads Novos -> move para Tentando Contato', async () => {
  const conv = { messages: [
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: 'Oi! Sou a Helena da Katzer 😊' },
  ] };
  const evt = { enviado: true, messageId: 'wamid.test001', sentAt: 1700000000000, autor: 'helena' };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 6639, primeiroContatoConfirmado: evt });
  assert.equal(r.acao, 'ATUALIZAR');
  assert.equal(r.update.fields.STAGE_ID, 'C1:PREPARATION');
  assert.equal(r._regra, 'primeiro-contato');
  assert.equal(r.messageId, 'wamid.test001');
});

test('rodaSecretaria: C1:NEW como estagioAtual normaliza para Leads Novos e move', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const evt = { enviado: true, messageId: 'wamid.test002', sentAt: 1700000000000, autor: 'helena' };
  const r = await rodaSecretaria(conv, { estagioAtual: 'C1:NEW', dealId: 6639, primeiroContatoConfirmado: evt });
  assert.equal(r.acao, 'ATUALIZAR');
  assert.equal(r._regra, 'primeiro-contato');
  assert.equal(r.update.fields.STAGE_ID, 'C1:PREPARATION');
});

test('rodaSecretaria: mensagem antiga sem campos de confirmação + sem evento -> não move', async () => {
  // Histórico tem apenas {role, content} sem envioConfirmado/messageId — não deve mover.
  const conv = { messages: [
    { role: 'assistant', content: 'Mensagem antiga da Helena sem campos de envio' },
    { role: 'user', content: 'oi' },
  ] };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 100 });
  assert.notEqual(r._regra, 'primeiro-contato');
});

test('rodaSecretaria: envio com enviado:false -> não move', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const evt = { enviado: false, messageId: 'wamid.falhou', autor: 'helena' };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 101, primeiroContatoConfirmado: evt });
  assert.notEqual(r._regra, 'primeiro-contato');
});

test('rodaSecretaria: histórico com mensagem da equipe humana (sem confirmação) + sem evento -> não move', async () => {
  const conv = { messages: [
    { role: 'assistant', content: 'Aqui é o Bruno, pode falar' },
    { role: 'user', content: 'oi tudo bem' },
  ] };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 102 });
  assert.notEqual(r._regra, 'primeiro-contato');
});

test('rodaSecretaria: mesmo messageId processado duas vezes -> segunda chamada retorna IGNORADO', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const evt = { enviado: true, messageId: 'wamid.dedup001', sentAt: 1700000000000, autor: 'helena' };
  const processadosIds = new Set(['wamid.dedup001']);
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 103, primeiroContatoConfirmado: evt, processadosIds });
  assert.equal(r.acao, 'IGNORADO');
  assert.equal(r.motivo, 'duplicate');
  assert.equal(r.messageId, 'wamid.dedup001');
  // a função NÃO muta o Set — o caller adiciona o id após aplica() confirmar
  assert.equal(processadosIds.size, 1);
});

test('rodaSecretaria: mesmo messageId NÃO duplicado quando não está no Set -> processa normalmente', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const evt = { enviado: true, messageId: 'wamid.novo001', sentAt: 1700000000000, autor: 'helena' };
  const processadosIds = new Set(['wamid.outro']);
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 104, primeiroContatoConfirmado: evt, processadosIds });
  assert.equal(r._regra, 'primeiro-contato');
});

test('rodaSecretaria: card em Mapeamento com evento confirmado -> não regride', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const evt = { enviado: true, messageId: 'wamid.mapeamento', sentAt: 1700000000000, autor: 'helena' };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Mapeamento', dealId: 105, primeiroContatoConfirmado: evt });
  assert.notEqual(r._regra, 'primeiro-contato');
});

test('rodaSecretaria: card em Follow Up com evento confirmado -> não regride', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const evt = { enviado: true, messageId: 'wamid.followup', sentAt: 1700000000000, autor: 'helena' };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Follow Up', dealId: 106, primeiroContatoConfirmado: evt });
  assert.notEqual(r._regra, 'primeiro-contato');
});

test('rodaSecretaria: card em Negociação com evento confirmado -> não regride', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const evt = { enviado: true, messageId: 'wamid.negociacao', sentAt: 1700000000000, autor: 'helena' };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Negociação', dealId: 107, primeiroContatoConfirmado: evt });
  assert.notEqual(r._regra, 'primeiro-contato');
});

test('rodaSecretaria: card antigo voltou para Leads Novos mas sem novo envio -> não move', async () => {
  // Simula card reativado: histórico legado sem campos de confirmação, sem evento explícito.
  const conv = { messages: [
    { role: 'assistant', content: 'Olá, acompanhamento de 6 meses atrás' },
    { role: 'user', content: 'oi' },
  ] };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 108 });
  assert.notEqual(r._regra, 'primeiro-contato');
});

test('rodaSecretaria: cliente falou mas sem envio confirmado da Helena -> não força primeiro contato', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 1 });
  assert.notEqual(r._regra, 'primeiro-contato');
});

test('rodaSecretaria: DRY-RUN — primeiro contato confirmado não escreve em homolog', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const evt = { enviado: true, messageId: 'wamid.dryrun', sentAt: 1700000000000, autor: 'helena' };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 6639, primeiroContatoConfirmado: evt });
  assert.equal(r.acao, 'ATUALIZAR');
  const plano = planoDeEscrita(r, { dealId: 6639 });
  let escreveu = false;
  const aplicado = await aplica(plano, { modo: 'homolog', atualizaNegocio: async () => { escreveu = true; } });
  assert.equal(aplicado.aplicado, false);
  assert.equal(escreveu, false);
});

test('rodaSecretaria: produção só escreve com portão autorizado (atualizaNegocio)', async () => {
  const conv = { messages: [{ role: 'user', content: 'oi' }] };
  const evt = { enviado: true, messageId: 'wamid.producao', sentAt: 1700000000000, autor: 'helena' };
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 6639, primeiroContatoConfirmado: evt });
  const plano = planoDeEscrita(r, { dealId: 6639 });
  let escreveu = false;
  const aplicado = await aplica(plano, { modo: 'producao', atualizaNegocio: async () => { escreveu = true; return { ok: true }; } });
  assert.equal(aplicado.aplicado, true);
  assert.equal(escreveu, true);
});

// ─── idempotência via messageId extraído do histórico ─────────────────────────

test('idempotência: messageId do histórico já em processadosIds -> IGNORADO', async () => {
  const conv = { messages: [
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: 'Olá!', messageId: 'zapi-legacy', envioConfirmado: true, enviadoEmMs: 1700000000000 },
  ] };
  const processadosIds = new Set(['zapi-legacy']);
  const r = await rodaSecretaria(conv, { estagioAtual: 'Leads Novos', dealId: 200, processadosIds });
  assert.equal(r.acao, 'IGNORADO');
  assert.equal(r.messageId, 'zapi-legacy');
  assert.equal(processadosIds.size, 1); // Set não mutado
});
