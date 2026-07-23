import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cidadeReal, publicoForaDoBrasil, semaforoCampanha, podeEscalar, LEADS_MIN_ESCALAR, resumoCplBom, rotuloSemBase, travaEscalar,
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

test('semáforo bruto: SEM BASE / BOA / ATENÇÃO / CARO', () => {
  assert.equal(semaforoCampanha({ leads: 3, cpl: 7 }).codigo, 'SEM_BASE');
  assert.equal(semaforoCampanha({ leads: 3, cpl: 7 }).detalhe, '⚪ SEM BASE - 3 leads, precisa 10');
  assert.equal(semaforoCampanha({ leads: 12, cpl: 18 }).codigo, 'BOA');
  assert.equal(semaforoCampanha({ leads: 12, cpl: 40 }).codigo, 'ATENCAO');
  assert.equal(semaforoCampanha({ leads: 12, cpl: 77 }).codigo, 'CARO');
});

test('semáforo BOM: <25 verde · 25–45 amarelo · >45 vermelho · <10 cinza', () => {
  assert.equal(semaforoCampanha({ leads: 3, cpl: 7 }, { modo: 'bom' }).cor, 'cinza');
  assert.equal(semaforoCampanha({ leads: 12, cpl: 13 }, { modo: 'bom' }).cor, 'verde');
  assert.equal(semaforoCampanha({ leads: 12, cpl: 30 }, { modo: 'bom' }).cor, 'amarelo');
  assert.equal(semaforoCampanha({ leads: 12, cpl: 56 }, { modo: 'bom' }).cor, 'vermelho');
});

test('trava PUBLICO EXTERNO em Piçarras', () => {
  const t = travaEscalar({ nome: '[FortMyers_EUA_Americanos]', leads: 12, cpl: 20, leadConfirmado: true });
  assert.equal(t.ok, false);
  assert.equal(t.codigo, 'PUBLICO_EXTERNO');
  assert.match(t.rotulo, /PUBLICO EXTERNO/);
  const ok = travaEscalar({ nome: 'FortMyers_BR_SC', leads: 12, cpl: 20, leadConfirmado: true });
  assert.equal(ok.ok, true);
  const sem = travaEscalar({ nome: 'FortMyers_BR_SC', leads: 3, cpl: 7, leadConfirmado: true });
  assert.equal(sem.codigo, 'SEM_BASE');
});


test('rotuloSemBase canônico Bruno', () => {
  assert.equal(rotuloSemBase(3), '⚪ SEM BASE - 3 leads, precisa 10');
  assert.equal(rotuloSemBase(1), '⚪ SEM BASE - 1 leads, precisa 10');
});

test('EUA_Americanos 3 leads CPL R$7 → NÃO escala (BLOQUEADO)', () => {
  assert.equal(podeEscalar({
    nome: '[FortMyers_EUA_Americanos][10/07/26]',
    leads: 3, cpl: 7, leadConfirmado: true,
  }), false);
});

test('quadradinho: com Americanos + BR_SC sem base → OBSERVAR BR_SC (nunca escalar Americanos)', () => {
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
  // V4: observar prioriza SEM BASE sem público proibido (BR_SC antes de Americanos)
  assert.equal(p.decisao.observar[0].nome, 'FortMyers_BR_SC[10/07/26]');
  const s = montaSugestaoPrincipal(p);
  assert.equal(s.tipo, 'observar');
  assert.equal(s.titulo, '⚪ SEM BASE - 8 leads, precisa 10');
  assert.match(s.recomendacao, /BLOQUEADO/i);
  assert.ok(!/Americanos/i.test(s.campanha || ''));
  assert.equal(s.bloqueadoEscalar, true);
});

test('quadradinho: só EUA_Americanos 3 leads → OBSERVAR bloqueado (nunca escalar)', () => {
  const p = montaPlacar([
    {
      campaign_name: '[FortMyers_EUA_Americanos][10/07/26]',
      spend: '19.87',
      actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '3' }],
    },
  ]);
  const s = montaSugestaoPrincipal(p);
  assert.equal(s.tipo, 'observar');
  assert.equal(s.titulo, '⚪ SEM BASE - 3 leads, precisa 10');
  assert.match(s.motivo, /fora do Brasil/i);
  assert.equal(s.bloqueadoEscalar, true);
});

test('não escala com público EUA/Miami/Portugal em Piçarras mesmo com ≥10 leads', () => {
  assert.equal(podeEscalar({ nome: 'FortMyers_BR_SC', leads: 12, cpl: 25, leadConfirmado: true }), true);
  assert.equal(podeEscalar({ nome: 'FortMyers PORTUGAL', leads: 12, cpl: 16, leadConfirmado: true }), false);
});

test('resumoCplBom: média das boas + % bons + destaque cidade', () => {
  const r = resumoCplBom([
    { nome: 'AMANAY Itapoá', gasto: 100, leads: 10, cpl: 13, leadConfirmado: true },
    { nome: 'FortMyers_BR_SC', gasto: 100, leads: 10, cpl: 30, leadConfirmado: true },
    { nome: 'PORTUGAL', gasto: 100, leads: 10, cpl: 80, leadConfirmado: true },
    { gasto: 50, leads: 1, cpl: 50, leadConfirmado: true },
  ]);
  // boas = cpl<=40 e leads>=3 → 2 de 3 avaliadas = 67%
  assert.equal(r.nBons, 2);
  assert.equal(r.cplBomMedio, 22);
  assert.equal(r.pctBons, 67);
  assert.equal(r.destaque.cidade, 'Itapoá');
  assert.equal(r.destaque.cpl, 13);
  assert.match(r.texto, /CPL BOM méd R\$ 22/);
  assert.match(r.texto, /67% bons/);
  assert.match(r.texto, /Itapoá: R\$ 13 BOM/);
});
