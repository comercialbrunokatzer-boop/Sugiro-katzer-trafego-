// REGISTRAR — recebe os toques do Michel (Feito / Obs / trocar modo) e avisa o CEO na hora.
// POST /api/registrar  body: { acao, ... }
//   acao='feito'  { tarefa, nota? }            -> marca a tarefa com o horário atual (BRT)
//   acao='desfazer' { tarefa }                 -> desmarca
//   acao='modo'   { modo:'casa'|'katzer' }     -> troca o modo do dia
//   acao='obs'    { quem:'Bruno'|'Carol', nome, duracao? } -> registra interrupção
import { agoraBRT, previstoMin, min2hm, hm2min, TAREFAS } from './_rotina.mjs';
import { leEstado, salvaEstado, enviaWhats, json } from './_infra.mjs';

const nomeTarefa = (id) => (TAREFAS.find((t) => t.id === id)?.nome) || id;

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { ok: false, erro: 'use POST' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, erro: 'body inválido' }); }
  const acao = body.acao;
  const now = agoraBRT();
  const estado = await leEstado(now.data, body.modo || 'casa');
  const ceo = process.env.WHATSAPP_CEO || '';

  if (acao === 'modo') {
    const modo = body.modo === 'katzer' ? 'katzer' : 'casa';
    estado.modo = modo;
    await salvaEstado(estado);
    return json(200, { ok: true, modo });
  }

  // Início do dia SÓ HOJE (ex.: começar 09:00). Desloca a agenda mantendo os intervalos.
  // body.hm="09:00" (ou body.min). "" / null limpa o override (volta ao padrão do modo).
  if (acao === 'inicio') {
    if (body.limpar || body.hm === '' || body.min === null) { delete estado.inicioMin; }
    else {
      const min = body.min != null ? Number(body.min) : (body.hm ? hm2min(body.hm) : null);
      if (min == null || Number.isNaN(min)) return json(400, { ok: false, erro: 'passe hm (ex.: "09:00") ou min' });
      estado.inicioMin = min;
    }
    await salvaEstado(estado);
    return json(200, { ok: true, inicioMin: estado.inicioMin ?? null, inicio: estado.inicioMin != null ? min2hm(estado.inicioMin) : '(padrão do modo)' });
  }

  if (acao === 'feito') {
    const t = TAREFAS.find((x) => x.id === body.tarefa);
    if (!t) return json(400, { ok: false, erro: 'tarefa desconhecida' });
    estado.tarefas[t.id] = { min: now.min, hora: now.hm, nota: (body.nota || '').toString().slice(0, 400) };
    await salvaEstado(estado);
    const dif = now.min - previstoMin(t, estado.modo, estado.inicioMin);
    // O painel é AO VIVO -> WhatsApp só na EXCEÇÃO (atraso). No horário/adiantado = só painel.
    let w = { enviado: false, motivo: 'no horário — só painel ao vivo' };
    if (dif > 0) {
      const modoIco = estado.modo === 'katzer' ? '🏢' : '🏠';
      const nota = body.nota ? `\n📝 ${body.nota}` : '';
      w = await enviaWhats(ceo, `⏰ Michel — *${t.nome}* atrasou ${dif}′ (feito ${now.hm}) ${modoIco}${nota}`);
    }
    return json(200, { ok: true, tarefa: t.id, hora: now.hm, difMin: dif, whats: w });
  }

  if (acao === 'desfazer') {
    if (estado.tarefas[body.tarefa]) delete estado.tarefas[body.tarefa];
    await salvaEstado(estado);
    return json(200, { ok: true, desfeito: body.tarefa });
  }

  if (acao === 'obs') {
    const quem = ['Bruno', 'Carol'].includes(body.quem) ? body.quem : null;
    if (!quem) return json(400, { ok: false, erro: 'obs exige quem = Bruno ou Carol' });
    const item = { quem, nome: (body.nome || '').toString().slice(0, 200), inicio: now.hm, duracao: Number(body.duracao) || null };
    estado.obs.push(item);
    await salvaEstado(estado);
    await enviaWhats(ceo, `🔔 Obs (${quem} pediu): *${item.nome}* — início ${item.inicio}${item.duracao ? ` · ${item.duracao} min` : ''}`);
    return json(200, { ok: true, obs: item });
  }

  return json(400, { ok: false, erro: 'ação desconhecida' });
}
