import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  notaDeal,
  notaCampanha,
  ajusteComentarios,
  comparaPorQualidadeFunil,
  top10PorNotaFunil,
  PESO_FASE,
} from '../netlify/functions/_nota-funil.mjs';

describe('ajusteComentarios', () => {
  it('sobe com visita/proposta e desce com fake', () => {
    const pos = ajusteComentarios('Cliente visitou e pediu proposta');
    assert.ok(pos.delta > 0);
    const neg = ajusteComentarios('Lead fake, sem interesse, número errado');
    assert.ok(neg.delta < 0);
  });
});

describe('notaDeal', () => {
  it('Ganhou > Mapeamento > Leads Novos > Perdido', () => {
    const g = notaDeal({ fase: 'Ganhou', nomeContato: 'Maria', telefone: '47999999999' });
    const m = notaDeal({ fase: 'Mapeamento', nomeContato: 'João', telefone: '47988888888' });
    const n = notaDeal({ fase: 'Leads Novos' });
    const p = notaDeal({ fase: 'Perdido', comments: 'sem interesse' });
    assert.ok(g.nota > m.nota);
    assert.ok(m.nota > n.nota);
    assert.ok(n.nota > p.nota);
    assert.equal(g.nota, Math.round(Math.min(100, PESO_FASE.Ganhou + 4 + 6)));
  });
});

describe('notaCampanha + ranking', () => {
  it('campanha com avanço no funil supera CPL barato parado no topo', () => {
    const boa = {
      name: 'Alicerce quente',
      cpl: 80,
      forms: 5,
      leadsTotal: 5,
      notaFunil: notaCampanha({
        forms: 5,
        deals: [
          { fase: 'Mapeamento', nomeContato: 'A', telefone: '47911111111', comments: 'agendado meet' },
          { fase: 'Negociação', nomeContato: 'B', telefone: '47922222222', comments: 'proposta enviada' },
          { fase: 'Follow Up', nomeContato: 'C', telefone: '47933333333' },
        ],
      }),
    };
    const barata = {
      name: 'CPL barato frio',
      cpl: 20,
      forms: 20,
      leadsTotal: 20,
      notaFunil: notaCampanha({
        forms: 20,
        deals: Array.from({ length: 12 }, (_, i) => ({
          fase: i % 2 ? 'Leads Novos' : 'Tentando Contato',
          comments: i < 3 ? 'fake sem interesse' : '',
        })),
      }),
    };
    assert.ok(boa.notaFunil.nota > barata.notaFunil.nota);
    assert.ok(comparaPorQualidadeFunil(boa, barata) < 0);

    const { melhores, piores } = top10PorNotaFunil([barata, boa]);
    assert.equal(melhores[0].name, 'Alicerce quente');
    assert.equal(piores[0].name, 'CPL barato frio');
  });

  it('forms sem deal Bitrix ficam com nota baixa (não inventa qualidade)', () => {
    const r = notaCampanha({ forms: 10, deals: [] });
    assert.ok(r.nota != null && r.nota < 25);
    assert.match(r.motivo, /sem negócio casado/i);
  });
});
