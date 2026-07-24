/**
 * Testes do GATEKEEPER DO PILOTO (cérebro puro — sem rede / sem Bitrix).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliaGatekeeper,
  filtraElegiveis,
  normalizaConfigPiloto,
  FASES_AUTO_OK,
  FASES_BLOQUEIO_ABSOLUTO,
} from '../src/gatekeeper.js';

const AGORA = Date.parse('2026-07-23T12:00:00-03:00');

const PILOTO = normalizaConfigPiloto({
  dealIds: ['100', '200'],
  phones: ['5547999998888'],
  campanhas: ['fort myers'],
  idadeMaxDias: 30,
  categoryId: '1',
});

function cardBase(over = {}) {
  return {
    dealId: '100',
    stageId: 'C1:NEW', // Leads Novos
    phone: '5547999998888',
    campanha: 'Leads Patroc. Fort Myers Frente Mar',
    origem: 'formulario_facebook',
    assignedById: '985',
    categoryId: '1',
    criadoEmMs: AGORA - 2 * 86400000,
    ultimaAtividadeMs: AGORA - 86400000,
    ...over,
  };
}

test('FASES: só Leads Novos / Tentando Contato no automático', () => {
  assert.ok(FASES_AUTO_OK.has('Leads Novos'));
  assert.ok(FASES_AUTO_OK.has('Tentando Contato'));
  assert.ok(FASES_BLOQUEIO_ABSOLUTO.has('Rampage'));
  assert.ok(FASES_BLOQUEIO_ABSOLUTO.has('Perdido'));
  assert.ok(FASES_BLOQUEIO_ABSOLUTO.has('Ganhou'));
});

test('OK: card no piloto em Leads Novos é permitido', () => {
  const r = avaliaGatekeeper(cardBase(), PILOTO, { agoraMs: AGORA });
  assert.equal(r.permitido, true);
  assert.equal(r.codigo, 'OK');
  assert.equal(r.estagio, 'Leads Novos');
  assert.equal(r.noPiloto, true);
});

test('OK: Tentando Contato também passa', () => {
  const r = avaliaGatekeeper(cardBase({ stageId: 'C1:PREPARATION' }), PILOTO, { agoraMs: AGORA });
  assert.equal(r.permitido, true);
  assert.equal(r.estagio, 'Tentando Contato');
});

test('BLOQUEIA: Rampage nunca passa', () => {
  const r = avaliaGatekeeper(cardBase({ stageId: 'C1:LOSE' }), PILOTO, { agoraMs: AGORA });
  assert.equal(r.permitido, false);
  assert.equal(r.codigo, 'FASE_TERMINAL');
});

test('BLOQUEIA: Perdido e Ganhou', () => {
  assert.equal(avaliaGatekeeper(cardBase({ stageId: 'C1:APOLOGY' }), PILOTO, { agoraMs: AGORA }).codigo, 'FASE_TERMINAL');
  assert.equal(avaliaGatekeeper(cardBase({ stageId: 'C1:WON' }), PILOTO, { agoraMs: AGORA }).codigo, 'FASE_TERMINAL');
});

test('BLOQUEIA: fase avançada (Mapeamento / Negociação)', () => {
  const map = avaliaGatekeeper(cardBase({ stageId: 'C1:PREPAYMENT_INVOICE' }), PILOTO, { agoraMs: AGORA });
  assert.equal(map.permitido, false);
  assert.equal(map.codigo, 'FASE_AVANCADA');

  const neg = avaliaGatekeeper(cardBase({ stageId: 'C1:UC_3NOP4U' }), PILOTO, { agoraMs: AGORA });
  assert.equal(neg.codigo, 'FASE_AVANCADA');
});

test('BLOQUEIA: STAGE_ID desconhecido', () => {
  const r = avaliaGatekeeper(cardBase({ stageId: 'C9:XYZ' }), PILOTO, { agoraMs: AGORA });
  assert.equal(r.codigo, 'FASE_DESCONHECIDA');
});

test('OK: piloto só com responsável+origem (padrão Bruno patrocinado)', () => {
  const cfg = normalizaConfigPiloto({
    responsaveis: ['1'],
    origens: ['formulario_facebook'],
    categoryId: '1',
  });
  const r = avaliaGatekeeper(
    cardBase({ dealId: '999', phone: '5547111111111', campanha: 'qualquer', assignedById: '1' }),
    cfg,
    { agoraMs: AGORA },
  );
  assert.equal(r.permitido, true);
  assert.equal(r.codigo, 'OK');
});

test('BLOQUEIA: fora do piloto (deal/telefone/campanha)', () => {
  const r = avaliaGatekeeper(
    cardBase({ dealId: '999', phone: '5547000000000', campanha: 'outra coisa' }),
    PILOTO,
    { agoraMs: AGORA },
  );
  assert.equal(r.codigo, 'FORA_PILOTO');
});

test('OK: casa piloto só por campanha (contains)', () => {
  const r = avaliaGatekeeper(
    cardBase({ dealId: '999', phone: '5547000000000', campanha: 'XXX Fort Myers YYY' }),
    PILOTO,
    { agoraMs: AGORA },
  );
  assert.equal(r.permitido, true);
});

test('OK: casa piloto só por dealId', () => {
  const r = avaliaGatekeeper(
    cardBase({ dealId: '200', phone: '5547111111111', campanha: '' }),
    PILOTO,
    { agoraMs: AGORA },
  );
  assert.equal(r.permitido, true);
});

test('BLOQUEIA: sem telefone', () => {
  const r = avaliaGatekeeper(cardBase({ phone: '' }), PILOTO, { agoraMs: AGORA });
  assert.equal(r.codigo, 'SEM_TELEFONE');
});

test('BLOQUEIA: fora do funil (categoryId)', () => {
  const r = avaliaGatekeeper(cardBase({ categoryId: '7' }), PILOTO, { agoraMs: AGORA });
  assert.equal(r.codigo, 'FORA_FUNIL');
});

test('BLOQUEIA: origem fora da allowlist (quando configurada)', () => {
  const cfg = normalizaConfigPiloto({
    dealIds: ['100'],
    origens: ['formulario_facebook'],
  });
  const r = avaliaGatekeeper(cardBase({ origem: 'whatsapp_direto' }), cfg, { agoraMs: AGORA });
  assert.equal(r.codigo, 'ORIGEM_BLOQUEADA');
});

test('BLOQUEIA: responsável fora do pool (quando configurado)', () => {
  const cfg = normalizaConfigPiloto({
    dealIds: ['100'],
    responsaveis: ['985', '1637'],
  });
  const r = avaliaGatekeeper(cardBase({ assignedById: '1' }), cfg, { agoraMs: AGORA });
  assert.equal(r.codigo, 'RESPONSAVEL_FORA');
});

test('BLOQUEIA: card antigo sem atividade recente', () => {
  const r = avaliaGatekeeper(
    cardBase({
      criadoEmMs: AGORA - 60 * 86400000,
      ultimaAtividadeMs: AGORA - 40 * 86400000,
    }),
    PILOTO,
    { agoraMs: AGORA },
  );
  assert.equal(r.codigo, 'CARD_ANTIGO');
});

test('OK: card antigo MAS com atividade recente (<7d) passa', () => {
  const r = avaliaGatekeeper(
    cardBase({
      criadoEmMs: AGORA - 60 * 86400000,
      ultimaAtividadeMs: AGORA - 2 * 86400000,
    }),
    PILOTO,
    { agoraMs: AGORA },
  );
  assert.equal(r.permitido, true);
});

test('filtraElegiveis: separa permitidos e bloqueados', () => {
  const cards = [
    cardBase({ dealId: '100' }),
    cardBase({ dealId: '999', phone: '5547000000000', campanha: 'x', stageId: 'C1:LOSE' }),
    cardBase({ dealId: '200', phone: '5547111222333', campanha: '' }),
  ];
  const { elegiveis, bloqueados } = filtraElegiveis(cards, PILOTO, { agoraMs: AGORA });
  assert.equal(elegiveis.length, 2);
  assert.equal(bloqueados.length, 1);
  assert.equal(bloqueados[0]._gatekeeper.codigo, 'FASE_TERMINAL');
});
