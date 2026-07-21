// PLACAR-REGISTRAR — recebe os toques do Michel no Placar e avisa o CEO na hora.
// POST /api/placar-registrar  body: { acao:'decisao', id, campanha, tipo, decisao, ajuste? }
//   decisao = 'aplicar' | 'ajustar' | 'agora-nao'
// O Gestor confere ao vivo pelo painel; o WhatsApp é o reforço em tempo real.
import { agoraBRT, registraDecisao, rotuloDecisao } from './_placar-estado.mjs';
import { leDecisoes, salvaDecisoes } from './_placar-io.mjs';
import { enviaWhats, json } from './_infra.mjs';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { ok: false, erro: 'use POST' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, erro: 'body inválido' }); }
  if (body.acao !== 'decisao') return json(400, { ok: false, erro: 'ação desconhecida' });

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

  // Reforço em tempo real pro CEO (as decisões são poucas por dia — não é spam).
  const ceo = process.env.WHATSAPP_CEO || '';
  const w = await enviaWhats(ceo, `📊 *Placar — Michel decidiu:*\n${rotuloDecisao(item)} · ${now.hm}`);

  return json(200, { ok: true, item, whats: w });
}
