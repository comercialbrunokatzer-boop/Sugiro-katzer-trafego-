import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dataColcheteCampanha,
  inicioFunilISO,
  produtoCampanha,
  dealBateCampanha,
  fasesPorCampanha,
  nomeExibicaoDeal,
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

describe('dealBateCampanha + fase atual', () => {
  it('casa Alicerce Alisson e respeita data do colchete', () => {
    const deals = [
      {
        id: '1',
        titleForm: 'Preencher formulário de CRM "LEAD PATROC. ALISSON ALICERCE"',
        title: 'Preencher formulário de CRM "LEAD PATROC. ALISSON ALICERCE"',
        fase: 'Tentando Contato',
        stageId: 'C1:PREPARATION',
        dateCreate: '2026-03-01T12:00:00+03:00',
        nomeContato: null,
      },
      {
        id: '2',
        titleForm: 'Preencher formulário de CRM "LEAD PATROC. KATZER ALICERCE"',
        title: 'Preencher formulário de CRM "LEAD PATROC. KATZER ALICERCE"',
        fase: 'Perdido',
        stageId: 'C1:APOLOGY',
        dateCreate: '2025-12-01T12:00:00+03:00', // antes de 06/02/26
        nomeContato: null,
      },
      {
        id: '3',
        titleForm: 'Preencher formulário de CRM "LEAD PATROC. ALICERCE EDSEL"',
        title: 'Preencher formulário de CRM "LEAD PATROC. ALICERCE EDSEL"',
        fase: 'Leads Novos',
        stageId: 'C1:NEW',
        dateCreate: '2026-03-01T12:00:00+03:00',
        nomeContato: null,
      },
    ];
    const camp = '[ALICERCE][AYA][VIDEO03][06/02/26] ALISSON';
    assert.equal(dealBateCampanha(deals[0], camp), true);
    assert.equal(dealBateCampanha(deals[2], camp), false); // EDSEL
    const fases = fasesPorCampanha(deals, camp, [], { inicioISO: '2025-11-22T17:08:58-0300' });
    assert.equal(fases.total, 1);
    assert.equal(fases.fases.find((f) => f.nome === 'Tentando Contato')?.n, 1);
    assert.equal(fases.fases.find((f) => f.nome === 'Tentando Contato')?.leads[0]?.nome, 'Lead #1');
  });

  it('TESTE PUBLICOS só casa form NOVACONFIG/PUBLICOS', () => {
    const camp = 'FORT MYERS] TESTE PUBLICOS NOVO CONFIG. META';
    assert.equal(
      dealBateCampanha({
        titleForm: 'Preencher formulário de CRM "LEAD PATROC. KATZER FORT MYERS CIDADES SC"',
        title: 'x',
      }, camp),
      false,
    );
    assert.equal(
      dealBateCampanha({
        titleForm: 'Preencher formulário de CRM "LEAD PATROC. KATZER NOVACONFIG"',
        title: 'x',
      }, camp),
      true,
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
