import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cidadeReal, publicoForaDoBrasil, semaforoCampanha, podeEscalar, LEADS_MIN_ESCALAR, resumoCplBom,
} from '../netlify/functions/_campanhas-regras.mjs';
import { montaPlacar } from '../netlify/functions/_placar.mjs';
import { montaSugestaoPrincipal } from '../netlify/functions/_placar-estado.mjs';

test('cidade real canônica', () => {
  assert.equal(cidadeReal('FortMyers_BR_SC'), 'Piçarras');
  assert.equal(cidadeReal('[ALICERCE][AYA]'), 'Piçarras');
  assert.equal(cidadeReal('[BARRA VIEW][SANDRA]'), 'Barra Velha');
  assert.equal(cidadeReal('[ROGGA][AMANAY]'), 'Itapoá');
});

test('público fora do Brasil alerta em Piçarras', () => {
  assert.equal(publicoForaDoBrasil('[FortMyers_EUA_Americanos]').alerta, true);
  assert.equal(publicoForaDoBrasil('FortMyers_MIAMI/ORLANDO').alerta, true);
  assert.equal(publicoForaDoBrasil('FortMyers cidades PORTUGAL').alerta, true);
  assert.equal(publicoForaDoBrasil('FortMyers_BR_SC').alerta, false);
});

test('semáforo: SEM BASE / BOA / ATENÇÃO / CARO', () => {
  assert.equal(semaforoCampanha({ leads: 3, cpl: 7 }).codigo, 'SEM_BASE');
  assert.equal(semaforoCampanha({ leads: 12, cpl: 18 }).codigo, 'BOA');
  assert.equal(semaforoCampanha({ leads: 12, cpl: 40 }).codigo, 'ATENCAO');
  assert.equal(semaforoCampanha({ leads: 12, cpl: 77 }).codigo, 'CARO');
});

test('não escala com < 10 leads nem público EUA/Miami/Portugal em Piçarras', () => {
  assert.equal(podeEscalar({ nome: 'EUA_Americanos', leads: 3, cpl: 7, leadConfirmado: true }), false);
  assert.equal(podeEscalar({ nome: 'FortMyers_BR_SC', leads: 12, cpl: 25, leadConfirmado: true }), true);
  assert.equal(podeEscalar({ nome: 'FortMyers PORTUGAL', leads: 12, cpl: 16, leadConfirmado: true }), false);
});

test('quadradinho: EUA_Americanos 3 leads → OBSERVAR, nunca escalar', () => {
  const p = montaPlacar([
    {
      campaign_name: '[FortMyers_EUA_Americanos][10/07/26]',
      spend: '19.87',
      actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '3' }],
    },
    {
      campaign_name: 'FortMyers_BR_SC[10/07/26]',
      spend: '613.48',
      actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '8' }],
    },
  ]);
  assert.equal(p.decisao.escalar.length, 0);
  assert.ok(p.decisao.observar.some((c) => /Americanos/i.test(c.nome)));
  const s = montaSugestaoPrincipal(p);
  assert.equal(s.tipo, 'observar');
  assert.match(s.titulo, /SEM BASE/i);
  assert.match(s.recomendacao, /OBSERVAR/i);
  assert.match(s.motivo, /precisa 10/i);
  assert.match(s.motivo, /Piçarras/i);
  assert.match(s.motivo, /fora do Brasil/i);
  assert.equal(s.leads, 3);
  assert.ok(s.leads < LEADS_MIN_ESCALAR);
});

test('resumoCplBom: média das boas + % bons', () => {
  const r = resumoCplBom([
    { gasto: 100, leads: 10, cpl: 20, leadConfirmado: true },
    { gasto: 100, leads: 10, cpl: 30, leadConfirmado: true },
    { gasto: 100, leads: 10, cpl: 80, leadConfirmado: true },
    { gasto: 50, leads: 1, cpl: 50, leadConfirmado: true },
  ]);
  // boas = cpl<=40 e leads>=3 → 2 de 3 avaliadas = 67%
  assert.equal(r.nBons, 2);
  assert.equal(r.cplBomMedio, 25);
  assert.equal(r.pctBons, 67);
  assert.match(r.texto, /CPL BOM médio: R\$ 25/);
  assert.match(r.texto, /67% bons/);
});
