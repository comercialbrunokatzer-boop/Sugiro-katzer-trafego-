/**
 * Cartão do lead — o alerta que cai no WhatsApp do CEO. Formato oficial travado pelo CEO.
 * Testado com os dados REAIS da Fabiana (print do CEO) e com o guard de campos vazios.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeCartao } from '../src/cartaoLead.js';
import { normalizaLead } from '../src/lead.js';

test('CARTÃO: monta o formato oficial com os dados da Fabiana', () => {
  const lead = normalizaLead({
    nome: 'Fabiana Araujo', telefone: '+1 813 325-6038', email: 'fevelynbrasil@yahoo.com.br',
    origem: 'formulario_facebook', interesse: 'Fort Myers', finalidade: 'investimento',
    orcamento_max: 2000000, estagio: 'próximos dias', nivel: 'quente',
  });
  const txt = composeCartao(lead, { campanha: 'Fort Myers' });
  assert.match(txt, /LEAD DE TRÁFEGO PAGO — FORT MYERS/);
  assert.match(txt, /🔥 Quente/);
  assert.match(txt, /Fabiana Araujo/);
  assert.match(txt, /\+1 813 325-6038/);
  assert.match(txt, /Objetivo: investimento/);
  assert.match(txt, /Faixa: R\$/);
  assert.match(txt, /Você liga ou a Helena liga\?/);
});

test('CARTÃO: campos vazios são omitidos (card limpo, sem placeholder)', () => {
  const lead = normalizaLead({ telefone: '5547999990000', origem: 'whatsapp_direto' });
  const txt = composeCartao(lead, {});
  assert.doesNotMatch(txt, /✉️/, 'sem email -> sem linha de email');
  assert.doesNotMatch(txt, /💰/, 'sem orçamento -> sem linha de faixa');
  assert.match(txt, /📞 5547999990000/);
  assert.match(txt, /Veio de: WhatsApp/);
});
