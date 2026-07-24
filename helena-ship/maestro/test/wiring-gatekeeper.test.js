/**
 * Fiação do Gatekeeper na abertura Helena — decisão pura (sem rede).
 * Critério: Patrocinado Corretor + responsável Bruno + fora da roleta + campanha Michel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAberturaComGatekeeper } from '../src/wiring.js';

const AGORA = Date.parse('2026-07-23T12:00:00-03:00');

function cfgBase(over = {}) {
  return {
    BRUNO_BITRIX_ID: '1',
    CAMPANHAS_HELENA: [], // vazio = não corta por campanha (ainda exige 1–4)
    HELENA_ABERTURA_URL: 'https://site.invalido/api/helena/lead-form',
    CATEGORY_ID: '1',
    ETAPAS: { LEAD_NOVO: 'C1:NEW' },
    PILOTO: {
      DEAL_IDS: '',
      PHONES: '',
      CAMPANHAS: '',
      RESPONSAVEIS: '',
      ORIGENS: '',
      IDADE_MAX_DIAS: 30,
    },
    ...over,
  };
}

const leadOk = {
  telefone: '5547999998888',
  campanha: 'Praça Qualquer Sem Nome Especial',
  title: 'LEAD PATROC. KATZER XYZ',
  origem: 'formulario_facebook',
  entraNaRoleta: 'Não',
};

test('abertura: responsável Edsel (rodízio) → não abre', () => {
  const d = decideAberturaComGatekeeper(
    leadOk,
    { dealId: '1', stageId: 'C1:NEW', corretorId: '985' },
    cfgBase(),
    { agoraMs: AGORA },
  );
  assert.equal(d.abrir, false);
  assert.match(d.motivo, /patrocinado Bruno|responsável/i);
});

test('abertura: sem URL → não abre', () => {
  const d = decideAberturaComGatekeeper(
    leadOk,
    { corretorId: '1', stageId: 'C1:NEW' },
    cfgBase({ HELENA_ABERTURA_URL: '' }),
    { agoraMs: AGORA },
  );
  assert.equal(d.abrir, false);
});

test('abertura: patrocinado + Facebook + Bruno + fase OK → abre', () => {
  const d = decideAberturaComGatekeeper(
    leadOk,
    { dealId: '100', stageId: 'C1:NEW', corretorId: '1' },
    cfgBase(),
    { agoraMs: AGORA },
  );
  assert.equal(d.abrir, true, d.motivo);
  assert.equal(d.gatekeeper.codigo, 'OK');
});

test('abertura: Gatekeeper bloqueia Rampage mesmo sendo Bruno', () => {
  const d = decideAberturaComGatekeeper(
    leadOk,
    { dealId: '100', stageId: 'C1:LOSE', corretorId: '1' },
    cfgBase(),
    { agoraMs: AGORA },
  );
  assert.equal(d.abrir, false);
  assert.equal(d.motivo, 'gatekeeper:FASE_TERMINAL');
});

test('abertura: origem whatsapp_direto → não é Patrocinado Corretor', () => {
  const d = decideAberturaComGatekeeper(
    { ...leadOk, origem: 'whatsapp_direto', title: 'LEAD PATROC. X', fonte: '' },
    { dealId: '100', stageId: 'C1:NEW', corretorId: '1' },
    cfgBase(),
    { agoraMs: AGORA },
  );
  assert.equal(d.abrir, false);
});

test('abertura: exemplo FLAVIUS ALVES (Patrocinado Corretor + Fort Myers) → abre', () => {
  const d = decideAberturaComGatekeeper(
    {
      telefone: '15086422340',
      title: 'Preencher formulário de CRM "LEAD PATROC. FORT MYERS"',
      fonte: 'Patrocinado Corretor',
      origemAnuncio: 'Patrocinado Corretor',
      produto: 'Fort Myers',
      entraNaRoleta: 'Não',
      origem: 'formulario_facebook',
    },
    { dealId: '200', stageId: 'C1:NEW', corretorId: '1' },
    cfgBase({ CAMPANHAS_HELENA: ['fort myers', 'grant', 'portugal', 'br_sc', 'brasileiros'] }),
    { agoraMs: AGORA },
  );
  assert.equal(d.abrir, true, d.motivo);
});

test('abertura: roleta = Sim → não abre', () => {
  const d = decideAberturaComGatekeeper(
    { ...leadOk, entraNaRoleta: 'Sim' },
    { dealId: '100', stageId: 'C1:NEW', corretorId: '1' },
    cfgBase(),
    { agoraMs: AGORA },
  );
  assert.equal(d.abrir, false);
});

test('abertura: campanha Michel na lista (token portugal) → abre', () => {
  const d = decideAberturaComGatekeeper(
    {
      telefone: '5547999998888',
      campanha: 'FortMyers cidades PORTUGAL',
      title: 'LEAD PATROC. PORTUGAL',
      titleForm: 'Preencher formulário de CRM "LEAD PATROC. PORTUGAL"',
      origem: 'formulario_facebook',
      entraNaRoleta: 'Não',
    },
    { dealId: '200', stageId: 'C1:NEW', corretorId: '1' },
    cfgBase({ CAMPANHAS_HELENA: ['portugal', 'grant', 'br_sc', 'brasileiros'] }),
    { agoraMs: AGORA },
  );
  assert.equal(d.abrir, true, d.motivo);
});

test('abertura: campanha fora dos patrocínios Michel → não abre', () => {
  const d = decideAberturaComGatekeeper(
    {
      telefone: '5547999998888',
      campanha: 'LEAD PATROC. ALICERCE',
      title: 'LEAD PATROC. ALICERCE',
      origem: 'formulario_facebook',
    },
    { dealId: '200', stageId: 'C1:NEW', corretorId: '1' },
    cfgBase({ CAMPANHAS_HELENA: ['portugal', 'grant', 'br_sc', 'brasileiros'] }),
    { agoraMs: AGORA },
  );
  assert.equal(d.abrir, false);
  assert.match(d.motivo, /campanha Michel|patrocinado Bruno/i);
});
