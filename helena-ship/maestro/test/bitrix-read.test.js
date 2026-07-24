import { test } from 'node:test';
import assert from 'node:assert';
import {
  normalizaBaseUrl, montaUrl, montaQuery, bitrixGet, resumeCampos,
} from '../src/bitrixRead.js';

// Domínio TOTALMENTE fictício e sem relação com o valor real do BITRIX_WEBHOOK_READ
// (evita que o secret scanning do Netlify case um fragmento do segredo).
const TOKEN = 'https://exemplo.invalido/rest/1/abc123token/';

test('normalizaBaseUrl: garante barra final', () => {
  assert.equal(normalizaBaseUrl('https://x.invalido/rest/1/tok'), 'https://x.invalido/rest/1/tok/');
  assert.equal(normalizaBaseUrl(TOKEN), TOKEN);
});

test('normalizaBaseUrl: remove o profile.json (ou qualquer metodo) colado no fim', () => {
  assert.equal(normalizaBaseUrl(TOKEN + 'profile.json'), TOKEN);
  assert.equal(normalizaBaseUrl(TOKEN + 'crm.deal.list.json'), TOKEN);
  assert.equal(normalizaBaseUrl(TOKEN + 'crm.deal.fields'), TOKEN);
});

test('normalizaBaseUrl: vazio -> vazio (nao inventa)', () => {
  assert.equal(normalizaBaseUrl(''), '');
  assert.equal(normalizaBaseUrl(null), '');
});

test('montaUrl: base + metodo.json', () => {
  assert.equal(montaUrl(TOKEN, 'crm.deal.fields'), TOKEN + 'crm.deal.fields.json');
  // mesmo com profile.json colado, sai limpo:
  assert.equal(montaUrl(TOKEN + 'profile.json', 'crm.status.list'), TOKEN + 'crm.status.list.json');
});

test('montaUrl: base vazia -> erro claro', () => {
  assert.throws(() => montaUrl('', 'crm.deal.fields'), /BITRIX_WEBHOOK_READ/);
});

test('montaQuery: arrays e objetos no formato do Bitrix', () => {
  assert.equal(montaQuery({ id: 42 }), 'id=42');
  assert.equal(montaQuery({ select: ['ID', 'TITLE'] }), 'select%5B0%5D=ID&select%5B1%5D=TITLE');
});

test('bitrixGet: propaga erro do Bitrix (error_description)', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ error: 'QUERY_LIMIT_EXCEEDED', error_description: 'muitas chamadas' }) });
  await assert.rejects(
    () => bitrixGet('crm.deal.fields', {}, { base: TOKEN, fetchFn: fakeFetch }),
    /QUERY_LIMIT_EXCEEDED.*muitas chamadas/,
  );
});

test('bitrixGet: devolve result no caminho feliz', async () => {
  const fakeFetch = async (url) => {
    assert.ok(url.startsWith(TOKEN + 'crm.deal.fields.json'));
    return { ok: true, json: async () => ({ result: { TITLE: { type: 'string' } } }) };
  };
  const r = await bitrixGet('crm.deal.fields', {}, { base: TOKEN, fetchFn: fakeFetch });
  assert.deepEqual(r, { TITLE: { type: 'string' } });
});

test('resumeCampos: extrai id/tipo e TODAS as opcoes dos dropdowns', () => {
  const fields = {
    UF_CRM_FAIXA: {
      title: 'Faixa de preço', type: 'enumeration', isRequired: false,
      items: [{ ID: '101', VALUE: 'de 1mi até 2mi' }, { ID: '102', VALUE: 'acima de 2mi' }],
    },
    TITLE: { title: 'Nome', type: 'string', isRequired: true },
  };
  const r = resumeCampos(fields);
  const faixa = r.find((c) => c.id === 'UF_CRM_FAIXA');
  assert.equal(faixa.tipo, 'enumeration');
  assert.equal(faixa.opcoes.length, 2);
  assert.equal(faixa.opcoes[0].ID, '101');
  const nome = r.find((c) => c.id === 'TITLE');
  assert.equal(nome.obrigatorio, true);
  assert.equal(nome.opcoes, undefined); // campo não-lista não tem opções
});
