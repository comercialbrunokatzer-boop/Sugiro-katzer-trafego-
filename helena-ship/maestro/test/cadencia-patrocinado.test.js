import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ehElegivelCadencia,
  mensagemCadencia,
  montaFilaCadencia,
  montaLeadFollowup,
  passaAntiSpamCadencia,
  tipoCadencia,
} from '../src/cadenciaPatrocinado.js';

const AGORA = Date.parse('2026-07-24T15:00:00-03:00'); // sex 15h BRT
const H = 3600000;

const base = {
  id: '9101',
  title: 'Preencher formulario de CRM "LEAD PATROC. FORT MYERS"',
  fonte: 'Patrocinado Corretor',
  assignedById: '1',
  stageId: 'C1:PREPARATION',
  fase: 'Tentando Contato',
  telefone: '5547999000101',
  nome: 'CARLA SILVA',
  dateCreate: '2026-07-22T12:00:00-03:00',
};

test('tipoCadencia: reconhece Tentando, Mapeamento e Follow Up', () => {
  assert.equal(tipoCadencia(base), 'tentando_contato');
  assert.equal(tipoCadencia({ ...base, stageId: 'C1:PREPAYMENT_INVOICE', fase: 'Mapeamento' }), 'mapeamento');
  assert.equal(tipoCadencia({ ...base, stageId: 'C1:UC_7P0WD3', fase: 'Follow Up' }), 'followup_pos_interesse');
});

test('ehElegivelCadencia: exige Bruno + patrocinado + fase permitida + telefone', () => {
  assert.equal(ehElegivelCadencia(base, { agoraMs: AGORA }).ok, true);
  assert.equal(ehElegivelCadencia({ ...base, assignedById: '985' }, { agoraMs: AGORA }).motivo, 'nao_bruno');
  assert.equal(ehElegivelCadencia({ ...base, fonte: '', title: 'WhatsApp direto' }, { agoraMs: AGORA }).motivo, 'nao_patrocinado');
  assert.equal(ehElegivelCadencia({ ...base, stageId: 'C1:LOSE', fase: 'Rampage' }, { agoraMs: AGORA }).motivo, 'fase_fora');
  assert.equal(ehElegivelCadencia({ ...base, telefone: '' }, { agoraMs: AGORA }).motivo, 'sem_telefone');
});

test('mensagemCadencia: personaliza nome e produto sem passar de limite curto', () => {
  const msg = mensagemCadencia({ ...base, nome: 'CARLA SILVA' }, 'tentando_contato');
  assert.match(msg, /Oi Carla/);
  assert.match(msg, /Fort Myers/);
  assert.ok(msg.length < 600);
});

test('passaAntiSpamCadencia: reaproveita ultimo toque de retomada ou cadencia', () => {
  assert.equal(passaAntiSpamCadencia({}, { agoraMs: AGORA }).ok, true);
  assert.equal(
    passaAntiSpamCadencia({ lastRetomadaMs: AGORA - 2 * H }, { agoraMs: AGORA, intervaloMinHoras: 36 }).motivo,
    'intervalo_minimo',
  );
  assert.equal(
    passaAntiSpamCadencia({ lastCadenciaMs: AGORA - 2 * H }, { agoraMs: AGORA, intervaloMinHoras: 36 }).motivo,
    'intervalo_minimo',
  );
});

test('montaFilaCadencia: lote pequeno para Tentando e Mapeamento, com teto diario', () => {
  const deals = [
    base,
    { ...base, id: '9102', stageId: 'C1:PREPAYMENT_INVOICE', fase: 'Mapeamento', telefone: '5547999000102', title: 'LEAD PATROC. GRANT' },
    { ...base, id: '9103', assignedById: '985', telefone: '5547999000103' },
  ];
  const { lote, pulados } = montaFilaCadencia(deals, { agoraMs: AGORA, maxLote: 5 });
  assert.equal(lote.length, 2);
  assert.ok(lote.some((x) => x.tipo === 'mapeamento' && x.produtoKey === 'grant_home'));
  assert.ok(pulados.some((p) => p.motivo === 'nao_bruno'));

  const cap = montaFilaCadencia([base], { agoraMs: AGORA, enviadasHojeGlobal: 12, limiteDiario: 12 });
  assert.equal(cap.lote.length, 0);
});

test('montaFilaCadencia: nao cutuca cliente recente nem humano assumido', () => {
  const { lote, pulados } = montaFilaCadencia([base], {
    agoraMs: AGORA,
    estadosPorTel: {
      [base.telefone]: { lastClientMsgMs: AGORA - H },
    },
  });
  assert.equal(lote.length, 0);
  assert.equal(pulados[0].motivo, 'cliente_respondeu_recente');

  const humano = montaFilaCadencia([base], {
    agoraMs: AGORA,
    estadosPorTel: { [base.telefone]: { handledByHuman: true } },
  });
  assert.equal(humano.lote.length, 0);
  assert.equal(humano.pulados[0].motivo, 'humano_assumiu');
});

test('Follow Up: usa cerebro de followup para Helena e separa alerta humano', () => {
  const follow = {
    ...base,
    id: '9201',
    stageId: 'C1:UC_7P0WD3',
    fase: 'Follow Up',
    telefone: '5547999000201',
  };
  const helena = montaFilaCadencia([follow], {
    agoraMs: AGORA,
    estadosPorTel: { [follow.telefone]: { lastHelenaMs: AGORA - 31 * 60000 } },
  });
  assert.equal(helena.lote.length, 1);
  assert.equal(helena.lote[0].tipo, 'followup_pos_interesse');

  const michel = montaFilaCadencia([follow], {
    agoraMs: AGORA,
    estadosPorTel: {
      [follow.telefone]: {
        lastHelenaMs: AGORA - 121 * 60000,
        niveisDisparadosFollowup: [1],
      },
    },
  });
  assert.equal(michel.lote.length, 0);
  assert.equal(michel.alertas[0].para, 'MICHEL');
});

test('montaLeadFollowup: para o relogio se cliente respondeu depois da Helena', () => {
  const lead = montaLeadFollowup(base, {
    lastHelenaMs: AGORA - 2 * H,
    lastClientMsgMs: AGORA - H,
  }, { agoraMs: AGORA });
  assert.equal(lead.cliente_respondeu, true);
});
