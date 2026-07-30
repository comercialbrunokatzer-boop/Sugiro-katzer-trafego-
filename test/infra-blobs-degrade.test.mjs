import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Garante que leEstado não propaga BlobsInternalError (P0 #50).
 * Mocka @netlify/blobs via env inválido + monkeypatch dinâmico é frágil;
 * aqui exercitamos o contrato: leEstado sempre resolve objeto com data.
 *
 * Com BLOBS_* apontando para lixo, getStore ainda cria client — get() falha em runtime Netlify.
 * No unit test local sem credencial, o client auto pode falhar no get; leEstado deve engolir.
 */
describe('leEstado degradação Blobs', () => {
  let prevSite;
  let prevTok;
  before(() => {
    prevSite = process.env.BLOBS_SITE_ID;
    prevTok = process.env.BLOBS_TOKEN;
    process.env.BLOBS_SITE_ID = 'site-invalido-teste';
    process.env.BLOBS_TOKEN = 'token-invalido-teste';
  });
  after(() => {
    if (prevSite === undefined) delete process.env.BLOBS_SITE_ID;
    else process.env.BLOBS_SITE_ID = prevSite;
    if (prevTok === undefined) delete process.env.BLOBS_TOKEN;
    else process.env.BLOBS_TOKEN = prevTok;
  });

  it('leEstado resolve mesmo com credencial inválida (ou marca blobsOk)', async () => {
    const { leEstado } = await import('../netlify/functions/_infra.mjs');
    const e = await leEstado('2099-01-01', 'casa');
    assert.ok(e);
    assert.equal(e.data, '2099-01-01');
    assert.equal(typeof e._blobsOk, 'boolean');
    // Em ambiente sem rede Blobs, tipicamente _blobsOk === false
    if (e._blobsOk === false) {
      assert.ok(e._blobsErro);
      assert.deepEqual(e.tarefas, {});
    }
  });
});
