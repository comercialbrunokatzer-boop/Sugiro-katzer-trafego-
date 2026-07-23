// GET  /api/qualidade          → mapa de qualidade + CPL Bruto/BOM das campanhas 7d
// POST /api/qualidade          → { id?, nome, bom, curioso, errado, comprador }
//
// Caçador: Michel marca na Discadora/Garimpo → alimenta CPL BOM do Painel de Campanhas.
import { json } from './_infra.mjs';
import { lePlacar } from './_placar-io.mjs';
import { leQualidade, salvaQualidadeCampanha, mapaQualidade } from './_qualidade-io.mjs';
import {
  enriqueceComQualidade, calculaCplQualidade, textoCplBrutoVsBom, QUALIDADE_TIPOS,
} from './_qualidade.mjs';
import { cidadeReal } from './_campanhas-regras.mjs';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body: '',
    };
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {
      return json(400, { ok: false, erro: 'body inválido' });
    }
    try {
      const item = await salvaQualidadeCampanha({
        id: body.id,
        nome: body.nome || body.campanha,
        bom: body.bom,
        curioso: body.curioso,
        errado: body.errado,
        comprador: body.comprador,
        quem: body.quem || 'Michel',
      });
      return json(200, { ok: true, item, tipos: QUALIDADE_TIPOS });
    } catch (e) {
      return json(400, { ok: false, erro: String((e && e.message) || e) });
    }
  }

  if (event.httpMethod !== 'GET') return json(405, { ok: false, erro: 'use GET ou POST' });

  const [{ placar, meta }, qualDoc] = await Promise.all([
    lePlacar({ preset: 'last_7d' }),
    leQualidade(),
  ]);
  const mapa = mapaQualidade(qualDoc);
  const campanhas = (placar.campanhas || []).map((c) => {
    const e = enriqueceComQualidade(c, mapa);
    return {
      ...e,
      cidade: e.cidade || cidadeReal(e.nome),
      comparativo: textoCplBrutoVsBom(calculaCplQualidade(
        { gasto: e.gasto, leads: e.leads },
        e.qualidade,
      )),
    };
  });

  // ranking por CPL BOM (só quem tem qualidade); fallback bruto
  const comBom = campanhas.filter((c) => c.temQualidade && c.cplBom != null)
    .sort((a, b) => a.cplBom - b.cplBom);
  const semQualidade = campanhas.filter((c) => !c.temQualidade);

  return json(200, {
    ok: true,
    metrica: {
      cplBruto: 'gasto ÷ leads formulário (Meta)',
      cplBom: 'gasto ÷ (Bom + Comprador) — caçado na Discadora/Garimpo',
    },
    meta: {
      status: meta?.status,
      confiavel: meta?.confiavel !== false,
      mensagem: meta?.mensagemPainel || meta?.mensagem || null,
    },
    campanhas,
    rankingCplBom: comBom.slice(0, 15),
    semQualidade: semQualidade.length,
    atualizadoEm: qualDoc.atualizadoEm,
    regra: 'CPL Bruto engana. CPL BOM decide. TRAVA 1: sem 10 leads form. não escala.',
  });
}
