import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fatiaHelenaDePayload,
  buscaFatiaHelena,
} from '../netlify/functions/_katzer-os-cliente.mjs';

describe('fatiaHelenaDePayload', () => {
  it('extrai enviados/respondidos do placar Helena', () => {
    const f = fatiaHelenaDePayload({
      ok: true,
      versao: 'katzer-os-1.0-fonte-unica',
      buildMs: 1,
      snapshot: {
        helena: {
          enviados: 18,
          responderam: 0,
          placar: { enviados: 18, respondidos: 2, fonte: 'helena_operacao_oficial' },
          ultimaSincronizacao: '01:33:29',
          fonte: 'operacao-oficial-painel',
        },
      },
    });
    assert.equal(f.ok, true);
    assert.equal(f.origem, 'katzer-os');
    assert.equal(f.enviados, 18);
    assert.equal(f.respondidos, 2);
    assert.equal(f.versao, 'katzer-os-1.0-fonte-unica');
  });

  it('falha com payload inválido', () => {
    assert.equal(fatiaHelenaDePayload(null).ok, false);
    assert.equal(fatiaHelenaDePayload({ ok: false }).ok, false);
  });
});

describe('buscaFatiaHelena', () => {
  it('nunca lança — devolve ok:false em HTTP erro', async () => {
    const fakeFetch = async () => ({ ok: false, status: 502, json: async () => ({}) });
    const r = await buscaFatiaHelena({ fetchImpl: fakeFetch, timeoutMs: 500 });
    assert.equal(r.ok, false);
    assert.match(r.erro, /HTTP 502/);
  });

  it('parseia resposta ok', async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        versao: 'v-test',
        snapshot: { helena: { placar: { enviados: 3, respondidos: 1 } } },
      }),
    });
    const r = await buscaFatiaHelena({ fetchImpl: fakeFetch, timeoutMs: 500 });
    assert.equal(r.ok, true);
    assert.equal(r.enviados, 3);
    assert.equal(r.respondidos, 1);
  });
});
