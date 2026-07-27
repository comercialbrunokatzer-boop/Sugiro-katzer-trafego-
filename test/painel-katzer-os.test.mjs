import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  montaFunilCusto,
  parecerConjuntos,
  top10CustoVenda,
  enrichPainelKatzerOs,
  contaEtapa,
  ETAPAS_FUNIL_PAINEL,
} from '../netlify/functions/_painel-katzer-os.mjs';

describe('contaEtapa', () => {
  it('conta fase ATUAL (não acumulada) — vendas pode > proposta', () => {
    const deals = [
      { fase: 'Mapeamento' },
      { fase: 'Mapeamento' },
      { fase: 'Proposta' },
      { fase: 'Ganhou' },
      { fase: 'Ganhou' },
    ];
    const vendas = ETAPAS_FUNIL_PAINEL.find((e) => e.id === 'vendas');
    const proposta = ETAPAS_FUNIL_PAINEL.find((e) => e.id === 'proposta');
    assert.equal(contaEtapa(deals, vendas).n, 2);
    assert.equal(contaEtapa(deals, proposta).n, 1);
  });
});

describe('montaFunilCusto', () => {
  it('calcula R$ por etapa e custo por venda', () => {
    const funil = montaFunilCusto({
      gasto: 1444,
      deals: [
        ...Array.from({ length: 20 }, () => ({ fase: 'Mapeamento' })),
        ...Array.from({ length: 8 }, () => ({ fase: 'Agendamento Meetins' })),
        ...Array.from({ length: 5 }, () => ({ fase: 'Agendado Físico' })),
        { fase: 'Proposta' },
        { fase: 'Ganhou' },
        { fase: 'Ganhou' },
      ],
    });
    assert.equal(funil.etapas[0].n, 20);
    assert.equal(funil.etapas[0].custo, 72.2);
    assert.equal(funil.etapas[4].n, 2);
    assert.equal(funil.etapas[4].custo, 722);
    assert.equal(funil.custoPorVenda, 722);
    assert.equal(funil.vendas, 2);
  });
});

describe('top10CustoVenda', () => {
  it('melhores = menor custo/venda; piores = gasto sem venda', () => {
    const ads = [
      { name: 'A', gastoNum: 1000, forms: 10, cpl: 100, custoPorVenda: 500, vendas: 2, funilPainel: { vendas: 2, custoPorVenda: 500 } },
      { name: 'B', gastoNum: 500, forms: 5, cpl: 100, custoPorVenda: 250, vendas: 2, funilPainel: { vendas: 2, custoPorVenda: 250 } },
      { name: 'C', gastoNum: 800, forms: 20, cpl: 40, custoPorVenda: null, vendas: 0, funilPainel: { vendas: 0, custoPorVenda: null } },
      { name: 'D', gastoNum: 50, forms: 2, cpl: 25, custoPorVenda: null, vendas: 0, funilPainel: { vendas: 0, custoPorVenda: null } },
    ];
    const { melhores, piores } = top10CustoVenda(ads);
    assert.equal(melhores[0].name, 'B');
    assert.equal(melhores[0].custoPorVenda, 250);
    assert.equal(piores[0].name, 'C');
    assert.equal(piores[0].rankingTipo, 'pior');
  });
});

describe('parecerConjuntos', () => {
  it('sugere PARAR sem venda e MANTER+ADICIONAR com venda', () => {
    const p = parecerConjuntos({
      gasto: 1400,
      forms: 20,
      cpl: 70,
      deals: [
        ...Array.from({ length: 12 }, () => ({ fase: 'Mapeamento', adsetOrigem: 'Conjunto A' })),
        ...Array.from({ length: 6 }, () => ({ fase: 'Mapeamento', adsetOrigem: 'Conjunto B' })),
        { fase: 'Ganhou', adsetOrigem: 'Conjunto B' },
        { fase: 'Ganhou', adsetOrigem: 'Conjunto B' },
      ],
    });
    const parar = p.decisoes.find((d) => d.acao === 'PARAR');
    const manter = p.decisoes.find((d) => d.acao === 'MANTER_ADICIONAR');
    assert.equal(parar?.conjunto, 'Conjunto A');
    assert.equal(manter?.conjunto, 'Conjunto B');
    assert.match(manter.texto, /ADICIONAR/);
  });
});

describe('enrichPainelKatzerOs', () => {
  it('anexa funilPainel, custoPorVenda e parecerKatzer', () => {
    const out = enrichPainelKatzerOs(
      { name: 'FortMyers SC', gastoNum: 1444, forms: 20, cpl: 72.2 },
      [
        ...Array.from({ length: 12 }, () => ({ fase: 'Mapeamento', adsetOrigem: 'A' })),
        ...Array.from({ length: 6 }, () => ({ fase: 'Mapeamento', adsetOrigem: 'B' })),
        { fase: 'Ganhou', adsetOrigem: 'B' },
        { fase: 'Ganhou', adsetOrigem: 'B' },
      ],
    );
    assert.equal(out.custoPorVenda, 722);
    assert.equal(out.funilPainel.etapas.length, 5);
    assert.ok(out.parecerKatzer.decisoes.length);
    assert.equal(out.parecerKatzer.decisoes.find((d) => d.acao === 'PARAR')?.conjunto, 'A');
  });
});

describe('normalizaLeadLinks', () => {
  it('sintetiza bitrixUrl a partir do id do deal', async () => {
    const { normalizaLeadLinks } = await import('../netlify/functions/_painel-katzer-os.mjs');
    const l = normalizaLeadLinks({ id: 99901, nome: 'Maria', telefone: '47999998888' });
    assert.match(l.bitrixUrl, /\/crm\/deal\/details\/99901\//);
    assert.match(l.whatsappUrl, /wa\.me\/55/);
    assert.equal(l.temBitrix, true);
    assert.equal(l.temWhatsApp, true);
  });

  it('etapa vazia traz motivoVazio claro', () => {
    const funil = montaFunilCusto({ gasto: 100, deals: [] });
    assert.equal(funil.etapas[0].motivoVazio, 'Nenhum lead nesta etapa.');
    assert.equal(funil.etapas[0].temBitrix, false);
  });

  it('com deal id → temBitrix mesmo sem bitrixUrl prévio', () => {
    const funil = montaFunilCusto({
      gasto: 100,
      deals: [{ id: 42, fase: 'Mapeamento', nomeContato: 'Ana' }],
    });
    assert.equal(funil.etapas[0].n, 1);
    assert.equal(funil.etapas[0].temBitrix, true);
    assert.ok(funil.etapas[0].leads[0].bitrixUrl);
  });
});
