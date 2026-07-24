import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listaDecisoesCampanha,
  rotuloDecisaoCampanha,
  blocoCampanhasWhats,
  blocoCampanhasEmail,
} from '../netlify/functions/_campanhas-dia.mjs';

describe('listaDecisoesCampanha ordena pelo minuto (mais recente primeiro)', () => {
  it('ordena', () => {
    const lista = listaDecisoesCampanha({
      data: '2026-07-24',
      itens: {
        a: { id: 'a', campanha: 'A', tipo: 'escalar', decisao: 'aplicar', min: 600, hora: '10:00' },
        b: { id: 'b', campanha: 'B', tipo: 'revisar', decisao: 'ajustar', ajuste: 'corta 20', min: 700, hora: '11:40' },
      },
    });
    assert.equal(lista[0].id, 'b');
    assert.equal(lista[1].id, 'a');
  });
});

describe('rotulo e blocos cobrem aplicar / ajustar / vazio', () => {
  it('rotulos', () => {
    assert.match(rotuloDecisaoCampanha({ decisao: 'aplicar', tipo: 'escalar', campanha: 'X', hora: '09:00' }), /Aplicou/);
    assert.match(rotuloDecisaoCampanha({ decisao: 'ajustar', tipo: 'revisar', campanha: 'Y', ajuste: 'corta' }), /Ajustou/);
    assert.match(blocoCampanhasWhats([]), /nenhuma decisão/i);
    assert.match(blocoCampanhasWhats([{ decisao: 'agora-nao', tipo: 'observar', campanha: 'Z' }]), /Agora não/);
    assert.match(blocoCampanhasEmail([]), /Nenhuma decisão/);
    assert.match(blocoCampanhasEmail([{ decisao: 'aplicar', tipo: 'escalar', campanha: 'X' }]), /Aplicou/);
  });
});
