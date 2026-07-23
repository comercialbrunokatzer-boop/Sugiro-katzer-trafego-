// PLACAR-REGISTRAR — toques do Michel no Painel de Campanhas → registra + avisa Bruno.
// POST body: { acao:'decisao', id, campanha, tipo, decisao, ajuste?, leads? }
//
// TRAVA 1 — SEM BASE MÍNIMA: nunca registra "aplicar" de ESCALAR com < 10 leads form.
import { agoraBRT, registraDecisao, rotuloDecisao } from './_placar-estado.mjs';
import { leDecisoes, salvaDecisoes, lePlacar } from './_placar-io.mjs';
import { enviaWhats, json } from './_infra.mjs';
import { LEADS_MIN_ESCALAR, podeEscalar } from './_campanhas-regras.mjs';

const TIPOS_ESCALA = new Set(['escalar', 'duplicar_escalar', 'mover', 'aumentar']);

function achaCampanha(placar, nome) {
  const n = String(nome || '');
  return (placar?.campanhas || []).find((c) => c.nome === n)
    || (placar?.campanhas || []).find((c) => n.includes(c.nome) || c.nome.includes(n.split('→')[0]?.trim() || '___'));
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') return json(405, { ok: false, erro: 'use POST' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, erro: 'body inválido' }); }
  if (body.acao !== 'decisao') return json(400, { ok: false, erro: 'ação desconhecida' });

  const tipo = String(body.tipo || '');
  const decisao = String(body.decisao || '');

  // TRAVA 1: aplicar escalar sem base mínima → bloqueia
  if (decisao === 'aplicar' && TIPOS_ESCALA.has(tipo)) {
    let leads = body.leads != null ? Number(body.leads) : null;
    let camp = null;
    try {
      const { placar } = await lePlacar({ preset: 'last_7d' });
      camp = achaCampanha(placar, body.campanha);
      if (leads == null && camp) leads = camp.leads;
      // mover: checa o destino (depois do →)
      if (tipo === 'mover' && String(body.campanha || '').includes('→')) {
        const destNome = String(body.campanha).split('→').pop().trim();
        camp = achaCampanha(placar, destNome) || camp;
        if (camp) leads = camp.leads;
      }
      if (camp && !podeEscalar(camp)) {
        return json(400, {
          ok: false,
          trava: 'SEM_BASE_MINIMA',
          erro: `TRAVA 1 — SEM BASE MÍNIMA: ${camp.leads || 0} leads form. (precisa ${LEADS_MIN_ESCALAR}). Não escale. Observe.`,
          leads: camp.leads ?? leads,
          precisa: LEADS_MIN_ESCALAR,
        });
      }
    } catch { /* se Meta falhar, ainda bloqueia se leads conhecidos < 10 */ }
    if (leads != null && leads < LEADS_MIN_ESCALAR) {
      return json(400, {
        ok: false,
        trava: 'SEM_BASE_MINIMA',
        erro: `TRAVA 1 — SEM BASE MÍNIMA: ${leads} leads form. (precisa ${LEADS_MIN_ESCALAR}). Não escale. Observe.`,
        leads,
        precisa: LEADS_MIN_ESCALAR,
      });
    }
  }

  const now = agoraBRT();
  const decisoes = await leDecisoes(now.data);
  let item;
  try {
    registraDecisao(decisoes, {
      id: body.id, campanha: body.campanha, tipo: body.tipo,
      decisao: body.decisao, ajuste: body.ajuste, hora: now.hm, min: now.min,
    });
    item = decisoes.itens[body.id];
  } catch (e) {
    return json(400, { ok: false, erro: String((e && e.message) || e) });
  }
  await salvaDecisoes(decisoes);

  const url = (process.env.CAMPANHAS_APP_URL || process.env.SITE_URL || 'https://dashing-elf-41a723.netlify.app').replace(/\/+$/, '');
  const ceo = process.env.WHATSAPP_CEO || '';
  const msg = [
    `📊 *Campanhas — Michel decidiu* · ${now.hm}`,
    rotuloDecisao(item),
    '',
    `Painel de Campanhas: ${url}/campanhas`,
    `Ranking CPL form.: ${url}/ranking-campanhas`,
  ].join('\n');
  const w = await enviaWhats(ceo, msg);

  return json(200, { ok: true, item, whats: w });
}
