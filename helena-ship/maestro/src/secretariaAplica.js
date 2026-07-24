/**
 * APLICADOR da Secretária — transforma a DECISÃO (de secretaria.js/decideAtualizacao)
 * no que efetivamente escreve no Bitrix, e SÓ escreve quando liberado.
 *
 * TRAVAS (pra ser seguro ligar depois do Conselheiro):
 *  - SÓ escreve na ZONA VERDE (decisao.acao === 'ATUALIZAR'). PROPOR/REVISAO_HUMANA nunca escrevem.
 *  - SÓ escreve quando SECRETARIA_MODO === 'producao' (interruptor próprio; default homolog = dry-run).
 *  - Lei 01: campo/opção sem valor confirmado NÃO entra (montaFieldsUF pula o que não resolve).
 * Puro/testável: recebe a decisão + campos, devolve o PLANO; aplica() recebe o writer injetável.
 */
import {
  CAMPO, opcaoDe, prazoOpcao, faixaPrecoOpcao, finalidadeOpcao,
} from './camposSecretaria.js';

/**
 * Monta os campos UF do Bitrix a partir de um objeto de campos interpretados.
 * Só inclui o que RESOLVE num ID de opção (Lei 01: vazio > errado).
 * @param {object} campos  { produto, temperatura, cidade, perfil, momento, finalidade,
 *                           faixaValor|faixaTexto, prazoMeses, numCompradores }
 */
export function montaFieldsUF(campos = {}) {
  const f = {};
  const set = (campoNome, id) => { if (CAMPO[campoNome] && id) f[CAMPO[campoNome]] = id; };

  set('PRODUTO', opcaoDe('PRODUTO', campos.produto));
  set('TEMPERATURA', opcaoDe('TEMPERATURA', campos.temperatura));
  set('CIDADE', opcaoDe('CIDADE', campos.cidade));
  set('PERFIL_IMOVEL', opcaoDe('PERFIL_IMOVEL', campos.perfil));
  set('MOMENTO_OBRA', opcaoDe('MOMENTO_OBRA', campos.momento));
  set('NUM_COMPRADORES', opcaoDe('NUM_COMPRADORES', campos.numCompradores));
  set('FINALIDADE', finalidadeOpcao(campos.finalidade));
  set('FAIXA_PRECO', faixaPrecoOpcao(campos.faixaValor != null ? campos.faixaValor : campos.faixaTexto));
  set('PRAZO_COMPRA', prazoOpcao(campos.prazoMeses));
  return f;
}

/**
 * Constrói o PLANO de escrita a partir da decisão da Secretária.
 * Só a ZONA VERDE (ATUALIZAR) vira plano de escrita. Junta STAGE_ID + COMMENTS (já montados
 * por decideAtualizacao) com os campos UF interpretados.
 * @returns {null|{id, fields, _estagio, _zona:'verde'}}
 */
export function planoDeEscrita(decisao = {}, { dealId, campos = {} } = {}) {
  if (decisao.acao !== 'ATUALIZAR') return null;      // PROPOR/REVISAO nunca escrevem sozinhos
  const up = decisao.update || {};
  const base = (up.fields && typeof up.fields === 'object') ? up.fields : {};
  const uf = montaFieldsUF(campos);
  const fields = { ...base, ...uf };
  if (!Object.keys(fields).length) return null;
  return { id: String(dealId || up.id || ''), fields, _estagio: up._estagio || null, _zona: 'verde' };
}

/**
 * Aplica o plano — SÓ escreve em producao. Em homolog devolve o plano (dry-run), não toca no Bitrix.
 * @param {object} plano            saída de planoDeEscrita (ou null)
 * @param {object} opts             { modo, atualizaNegocio, logger }
 */
export async function aplica(plano, { modo = 'homolog', atualizaNegocio = null, logger = null } = {}) {
  if (!plano) return { aplicado: false, motivo: 'sem plano (não é zona verde ou sem campos)' };
  if (modo !== 'producao') {
    logger?.info?.('Secretária: escrita SIMULADA (SECRETARIA_MODO != producao)', { dealId: plano.id, campos: Object.keys(plano.fields) });
    return { aplicado: false, motivo: 'homolog (dry-run)', plano };
  }
  if (typeof atualizaNegocio !== 'function') return { aplicado: false, motivo: 'writer indisponível', plano };
  if (!plano.id) return { aplicado: false, motivo: 'sem dealId', plano };
  const r = await atualizaNegocio(plano.id, plano.fields);
  logger?.info?.('Secretária: card atualizado no Bitrix', { dealId: plano.id, campos: Object.keys(plano.fields) });
  return { aplicado: true, resultado: r, plano };
}
