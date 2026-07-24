import { test } from 'node:test';
import assert from 'node:assert';
import {
  CAMPO, opcaoDe, prazoOpcao, faixaPrecoOpcao, finalidadeOpcao,
} from '../src/camposSecretaria.js';

test('IDs reais (raio-x) dos campos confirmados', () => {
  assert.equal(CAMPO.PRODUTO, 'UF_CRM_1752266661');
  assert.equal(CAMPO.TEMPERATURA, 'UF_CRM_1753709436');
  assert.equal(CAMPO.CIDADE, 'UF_CRM_1755626500');
  assert.equal(CAMPO.RESUMO_CARTEIRA, 'UF_CRM_1762177343263');
});

test('faixa/finalidade: IDs oficiais definidos pelo Michel/Auditor (20/07)', () => {
  assert.equal(CAMPO.FAIXA_PRECO, 'UF_CRM_1760387036');
  assert.equal(CAMPO.FINALIDADE, 'UF_CRM_1753709401');
});

test('opcaoDe resolve a opção real do dropdown (exato e por conteúdo)', () => {
  assert.equal(opcaoDe('PRODUTO', 'Fort Myers'), '767');
  assert.equal(opcaoDe('PRODUTO', 'quero saber do fort myers frente mar'), '767'); // por conteúdo
  assert.equal(opcaoDe('TEMPERATURA', 'Quente'), '89');
  assert.equal(opcaoDe('CIDADE', 'Penha'), '283');
  assert.equal(opcaoDe('CIDADE', 'Barra Velha'), '281');
  assert.equal(opcaoDe('PERFIL_IMOVEL', 'pé na areia'), '529');
});

test('opcaoDe não chuta: sem correspondência -> null (Lei 01)', () => {
  assert.equal(opcaoDe('PRODUTO', 'empreendimento que não existe'), null);
  assert.equal(opcaoDe('CIDADE', ''), null);
  assert.equal(opcaoDe('CAMPO_INEXISTENTE', 'x'), null);
});

test('prazoOpcao mapeia meses reais (1..6) e recusa fora da faixa', () => {
  assert.equal(prazoOpcao(1), '625');
  assert.equal(prazoOpcao(3), '629');
  assert.equal(prazoOpcao(6), '635');
  assert.equal(prazoOpcao(9), null);
  assert.equal(prazoOpcao(null), null);
});

test('faixaPrecoOpcao mapeia o VALOR do orçamento na banda certa (campo oficial)', () => {
  assert.equal(faixaPrecoOpcao(400_000), '477');   // Até 500k
  assert.equal(faixaPrecoOpcao(500_000), '477');   // limite inferior fecha em 500k
  assert.equal(faixaPrecoOpcao(700_000), '479');   // De 500k até 750k
  assert.equal(faixaPrecoOpcao(1_000_000), '481'); // De 750k até 1mi
  assert.equal(faixaPrecoOpcao(1_200_000), '483'); // De 1mi até 1.5mi
  assert.equal(faixaPrecoOpcao(3_800_000), '485'); // Acima de 1.5mi (maior imóvel do portfólio)
});

test('faixaPrecoOpcao aceita texto de faixa e recusa lixo (Lei 01)', () => {
  assert.equal(faixaPrecoOpcao('de 500k até 750k'), '479');
  assert.equal(faixaPrecoOpcao(''), null);
  assert.equal(faixaPrecoOpcao(null), null);
  assert.equal(faixaPrecoOpcao(0), null);
});

test('finalidadeOpcao: Moradia / Locação / Revenda (e sinônimos), sem chutar', () => {
  assert.equal(finalidadeOpcao('Moradia'), '79');
  assert.equal(finalidadeOpcao('quero pra morar'), '79');
  assert.equal(finalidadeOpcao('Locação'), '81');
  assert.equal(finalidadeOpcao('é pra alugar'), '81');
  assert.equal(finalidadeOpcao('Revenda'), '83');
  assert.equal(finalidadeOpcao('comprei pra revender'), '83');
  assert.equal(finalidadeOpcao('sei lá'), null);
  assert.equal(finalidadeOpcao('investimento'), null); // ambíguo -> não chuta (Lei 01)
});
