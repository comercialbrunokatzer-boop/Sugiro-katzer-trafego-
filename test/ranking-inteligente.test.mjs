import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  metricasCampanha,
  notaInteligente,
  comparaRankingInteligente,
  top10Inteligente,
  acaoMichel,
  cardsResumoMichel,
  enrichCampanhaInteligente,
} from '../netlify/functions/_ranking-inteligente.mjs';

describe('metricasCampanha', () => {
  it('forms=0 → taxaPerda 0 e custoPorAvanco Infinity', () => {
    const m = metricasCampanha({ forms: 0, gasto: 500, leadsNoBitrix: 0, fases: [] });
    assert.equal(m.taxaPerda, 0);
    assert.equal(m.custoPorAvanco, Infinity);
  });

  it('calcula taxaPerda e custoPorAvanco', () => {
    const m = metricasCampanha({
      forms: 10,
      gasto: 400,
      leadsNoBitrix: 8,
      fases: [
        { nome: 'Mapeamento', n: 2 },
        { nome: 'Agendamento Meetins', n: 1 },
        { nome: 'Tentando Contato', n: 5 },
      ],
    });
    assert.equal(m.taxaPerda, 20);
    assert.equal(m.leadsAvancaram, 3); // map + meetins
    assert.equal(m.custoPorAvanco, 400 / 3);
    assert.equal(m.custoPorMeetins, 400);
  });
});

describe('notaInteligente', () => {
  it('S / A / B / D', () => {
    assert.equal(notaInteligente({ custoPorAvanco: 100, taxaPerda: 10 }).selo, 'S');
    assert.equal(notaInteligente({ custoPorAvanco: 200, taxaPerda: 25 }).selo, 'A');
    assert.equal(notaInteligente({ custoPorAvanco: 350, taxaPerda: 40 }).selo, 'B');
    assert.equal(notaInteligente({ custoPorAvanco: 900, taxaPerda: 80 }).selo, 'D');
  });
});

describe('ranking — SC cara no fim, VIDEO02 barata no topo', () => {
  it('ordena custoPorAvanco → CPL → taxaPerda', () => {
    const video02 = enrichCampanhaInteligente({
      name: 'FortMyers_VIDEO02',
      forms: 12,
      gastoNum: 444, // CPL 37
      cpl: 37,
      fases: [
        { nome: 'Mapeamento', n: 4 },
        { nome: 'Agendamento Meetins', n: 2 },
      ],
      leadsTotal: 10,
      inicioISO: '2026-07-01T00:00:00-03:00',
    });
    const sc = enrichCampanhaInteligente({
      name: 'FortMyers_BR_SC',
      forms: 8,
      gastoNum: 576, // CPL 72
      cpl: 72,
      fases: [
        { nome: 'Tentando Contato', n: 2 },
        { nome: 'Leads Novos', n: 1 },
      ],
      leadsTotal: 3,
      inicioISO: '2026-07-01T00:00:00-03:00',
    });
    assert.ok(comparaRankingInteligente(video02, sc) < 0);
    const { melhores, piores } = top10Inteligente([sc, video02]);
    assert.equal(melhores[0].name, 'FortMyers_VIDEO02');
    assert.equal(piores[0].name, 'FortMyers_BR_SC');
    assert.equal(sc.acaoMichel.tipo, 'CORTAR');
    assert.equal(video02.acaoMichel.tipo, 'ESCALAR');
  });

  it('8 campanhas não repetem o mesmo motivo de funil', () => {
    const rows = [];
    for (let i = 0; i < 8; i += 1) {
      rows.push(enrichCampanhaInteligente({
        name: `Camp_${i}`,
        forms: 5 + i,
        gastoNum: 100 * (i + 1),
        cpl: 20 + i * 5,
        leadsTotal: i, // funil diferente por campanha
        fases: i === 0
          ? [{ nome: 'Agendamento Meetins', n: 1 }]
          : [{ nome: 'Tentando Contato', n: i }],
      }));
    }
    const motivos = new Set(rows.map((r) => r.notaFunil.motivo));
    assert.ok(motivos.size >= 6, `motivos distintos: ${motivos.size}`);
  });
});

describe('acaoMichel + cards', () => {
  it('CORTAR por taxaPerda > 50%', () => {
    const c = enrichCampanhaInteligente({
      name: 'Ruim',
      forms: 20,
      gastoNum: 1000,
      cpl: 50,
      leadsTotal: 4,
      fases: [{ nome: 'Leads Novos', n: 4 }],
    });
    assert.equal(c.acaoMichel.tipo, 'CORTAR');
    assert.match(c.acaoMichel.texto, /PAUSAR AGORA/);
  });

  it('LIGAR com >3 em Tentando Contato', () => {
    const a = acaoMichel({
      forms: 10,
      cpl: 40,
      gastoNum: 400,
      metricas: { taxaPerda: 10, custoPorAvanco: 100, leadsTentando: 7, leadsNovos: 2 },
      gargaloHumano: true,
    });
    assert.equal(a.tipo, 'LIGAR');
  });

  it('cards resumo', () => {
    const camps = [
      enrichCampanhaInteligente({
        name: 'Lixo', forms: 10, gastoNum: 500, cpl: 50,
        leadsTotal: 2, fases: [{ nome: 'Leads Novos', n: 2 }],
      }),
      enrichCampanhaInteligente({
        name: 'Verde', forms: 12, gastoNum: 400, cpl: 33,
        leadsTotal: 11,
        fases: [{ nome: 'Mapeamento', n: 5 }, { nome: 'Agendamento Meetins', n: 2 }],
      }),
    ];
    const r = cardsResumoMichel(camps);
    assert.ok(r.dinheiroNoLixo >= 500);
    assert.ok(r.oportunidadeEscala.some((x) => x.nome === 'Verde'));
    assert.ok(r.gargaloHumano >= 0);
  });
});
