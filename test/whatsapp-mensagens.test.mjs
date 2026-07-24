import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDemoLead,
  mensagemTravaSaiuSemQualidadeReal,
  mensagemCacadorMarca,
  filtrarTravaPendentes,
  chaveTrava,
} from '../netlify/functions/_whatsapp-mensagens.mjs';

test('Carlos Vermelho / demo-id = demo (não vaza no WhatsApp de operação)', () => {
  assert.equal(isDemoLead({ id: 'demo-vermelho-saiu', nome: 'Carlos Vermelho', fonte: 'FACEBOOK ADS' }), true);
  assert.equal(isDemoLead({ id: 'demo-maria', fonte: 'demo' }), true);
  assert.equal(isDemoLead({ id: 'bitrix-99', nome: 'Maria Real', fonte: 'bitrix' }), false);
});

test('mensagem TRAVA explica o que é / não é / o que fazer', () => {
  const t = mensagemTravaSaiuSemQualidadeReal({
    leads: [{ id: '1', nome: 'Fulano', campanha: 'Amanay', corretor: 'Edsel' }],
    hm: '00:09',
  });
  assert.match(t, /TRAVA DE AUDITORIA/i);
  assert.match(t, /O que é isso/i);
  assert.match(t, /O que NÃO é/i);
  assert.match(t, /Qualidade Real/i);
  assert.match(t, /A = Pronto/i);
  assert.match(t, /Fulano/);
  assert.doesNotMatch(t, /^🔴 \*TRAVA\* — \d+ lead/m);
});

test('mensagem Caçador BOM explica CPL BOM', () => {
  const t = mensagemCacadorMarca({
    qualidade: 'bom',
    nome: 'Maria',
    campanha: 'Amanay Itapoá',
    isDemo: true,
  });
  assert.match(t, /TESTE\/DEMO/);
  assert.match(t, /CPL BOM/);
  assert.match(t, /Maria/);
});

test('dedupe: mesmo lead não reentra no mesmo dia', () => {
  const leads = [{ id: 'x1', nome: 'A' }, { id: 'x2', nome: 'B' }];
  const enviados = { [chaveTrava('2026-07-24', 'x1')]: 'já' };
  const { pendentes, chaves } = filtrarTravaPendentes(leads, enviados, '2026-07-24');
  assert.equal(pendentes.length, 1);
  assert.equal(pendentes[0].id, 'x2');
  assert.equal(chaves.length, 1);
});
