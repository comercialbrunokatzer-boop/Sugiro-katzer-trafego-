import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dataColcheteCampanha,
  inicioFunilISO,
  inicioEfetivoFunil,
  produtoCampanha,
  dealBateCampanha,
  dealBateCampanhaLegacy,
  campanhaOrigemBate,
  filtroBitrixPorCampanha,
  fasesPorCampanha,
  nomeExibicaoDeal,
  UF_CAMPANHA_ORIGEM,
} from '../netlify/functions/_bitrix-funil.mjs';

describe('dataColcheteCampanha / inicioFunilISO', () => {
  it('lê [06/02/26] do nome Alicerce', () => {
    const iso = dataColcheteCampanha('[ALICERCE][AYA][VIDEO03][06/02/26] ALISSON');
    assert.ok(iso);
    assert.match(iso, /^2026-02-06/);
  });

  it('colchete ganha do created_time Meta antigo', () => {
    const funil = inicioFunilISO(
      '[ALICERCE][AYA][VIDEO03][06/02/26] ALISSON',
      '2025-11-22T17:08:58-0300',
    );
    assert.match(funil, /^2026-02-06/);
  });

  it('janela Meta last_30d corta histórico NOVACONFIG', () => {
    const efetivo = inicioEfetivoFunil(
      'FORT MYERS] TESTE PUBLICOS NOVO CONFIG. META',
      '2026-05-30T08:48:39-0300',
      '2026-06-23T00:00:00-03:00',
    );
    assert.match(efetivo, /^2026-06-23/);
  });
});

describe('produtoCampanha', () => {
  it('PUBLICOS/NOVACONFIG não vira FORT MYERS', () => {
    assert.equal(
      produtoCampanha('FORT MYERS] TESTE PUBLICOS NOVO CONFIG. META'),
      'NOVACONFIG',
    );
  });

  it('Alicerce Alisson', () => {
    assert.equal(produtoCampanha('[ALICERCE][AYA][VIDEO03][06/02/26] ALISSON'), 'ALICERCE');
  });
});

describe('UF_CRM_CAMPANHA_ORIGEM — sem vazamento', () => {
  it('filtro Bitrix nunca é {}', () => {
    const f = filtroBitrixPorCampanha('FortMyers_VIDEO02');
    assert.equal(f[UF_CAMPANHA_ORIGEM], '%FortMyers_VIDEO02%');
    assert.equal(filtroBitrixPorCampanha(''), null);
  });

  it('deal sem UF não conta (SEM RASTREIO)', () => {
    const camp = 'FortMyers_VIDEO02[10/07/26]';
    assert.equal(dealBateCampanha({
      titleForm: 'LEAD PATROC. KATZER FORT MYERS',
      fase: 'Agendamento Meetins',
    }, camp), false);
  });

  it('8 campanhas Fort Myers NÃO compartilham o mesmo deal', () => {
    const deal = {
      id: '99',
      campanhaOrigem: 'FortMyers_VIDEO02[10/07/26]',
      fase: 'Agendamento Meetins',
      dateCreate: '2026-07-15T12:00:00-03:00',
    };
    const camps = [
      'FortMyers_VIDEO02[10/07/26]',
      'FortMyers_VIDEO01[10/07/26]',
      'FortMyers_BR_SC[10/07/26]',
      'FortMyers_IMAGEM1[10/07/26]',
      'FortMyers_IMAGEM2[10/07/26]',
      'FortMyers_COPY_A[10/07/26]',
      'FortMyers_COPY_B[10/07/26]',
      'FortMyers_LOOKALIKE[10/07/26]',
    ];
    const hits = camps.filter((c) => dealBateCampanha(deal, c));
    assert.deepEqual(hits, ['FortMyers_VIDEO02[10/07/26]']);
  });

  it('casa por UF exato / contains', () => {
    assert.equal(
      campanhaOrigemBate('FortMyers_VIDEO02[10/07/26]', 'FortMyers_VIDEO02[10/07/26]'),
      true,
    );
    assert.equal(
      dealBateCampanha({
        campanhaOrigem: 'FortMyers_BR_SC[10/07/26]',
        fase: 'Mapeamento',
      }, 'FortMyers_BR_SC[10/07/26]'),
      true,
    );
  });

  it('fasesPorCampanha só conta UF da campanha', () => {
    const deals = [
      {
        id: '1',
        campanhaOrigem: 'FortMyers_VIDEO02[10/07/26]',
        fase: 'Agendamento Meetins',
        dateCreate: '2026-07-15T12:00:00-03:00',
        nomeContato: 'Ana',
      },
      {
        id: '2',
        campanhaOrigem: 'FortMyers_BR_SC[10/07/26]',
        fase: 'Agendamento Meetins',
        dateCreate: '2026-07-15T12:00:00-03:00',
        nomeContato: 'Bruno',
      },
      {
        id: '3',
        // sem UF — não conta em nenhuma
        titleForm: 'FORT MYERS CIDADES SC',
        fase: 'Agendamento Meetins',
        dateCreate: '2026-07-15T12:00:00-03:00',
      },
    ];
    const v2 = fasesPorCampanha(deals, 'FortMyers_VIDEO02[10/07/26]', []);
    const sc = fasesPorCampanha(deals, 'FortMyers_BR_SC[10/07/26]', []);
    assert.equal(v2.total, 1);
    assert.equal(sc.total, 1);
    assert.notEqual(
      v2.fases.find((f) => f.nome === 'Agendamento Meetins')?.leads[0]?.id,
      sc.fases.find((f) => f.nome === 'Agendamento Meetins')?.leads[0]?.id,
    );
    assert.equal(v2.fases.find((f) => f.nome === 'Agendamento Meetins')?.leads[0]?.nome, 'Ana');
    assert.equal(sc.fases.find((f) => f.nome === 'Agendamento Meetins')?.leads[0]?.nome, 'Bruno');
  });

  it('legacy fuzzy ainda existe mas NÃO é o default do painel', () => {
    assert.equal(
      dealBateCampanhaLegacy({
        titleForm: 'Preencher formulário de CRM "LEAD PATROC. ALISSON ALICERCE"',
      }, '[ALICERCE][AYA][VIDEO03][06/02/26] ALISSON'),
      true,
    );
    assert.equal(
      dealBateCampanha({
        titleForm: 'Preencher formulário de CRM "LEAD PATROC. ALISSON ALICERCE"',
      }, '[ALICERCE][AYA][VIDEO03][06/02/26] ALISSON'),
      false,
    );
  });
});

describe('nomeExibicaoDeal', () => {
  it('usa nomeContato quando existe', () => {
    assert.equal(nomeExibicaoDeal({ id: 9, nomeContato: 'Maria Souza', title: 'Preencher formulário' }), 'Maria Souza');
  });

  it('não mostra título de formulário', () => {
    assert.equal(
      nomeExibicaoDeal({
        id: 9,
        nomeContato: null,
        title: 'Preencher formulário de CRM "LEAD PATROC. ALISSON ALICERCE"',
      }),
      'Lead #9',
    );
  });
});
