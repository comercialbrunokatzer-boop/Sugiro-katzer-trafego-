// REGISTRAR — toques do Michel + ações do Gestor. Persiste auto → gestor atualiza sozinho.
// POST /api/registrar  body: { acao, ... }
//   acao='feito'  { tarefa, nota? }            -> marca + WhatsApp CEO (CADA movimento)
//   acao='desfazer' { tarefa }
//   acao='modo'   { modo:'casa'|'katzer' }
//   acao='obs'    { quem, nome, duracao? }
//   acao='inicio' { hm }                       -> desloca agenda do dia
//   acao='ajuste-horario' { tarefa, hm }       -> gestor edita horário (ex.: Garimpo)
//   acao='gestor-decisao' { id, campanha, tipo, decisao, ajuste? }  -> pausar/escalar
import { createHash } from 'node:crypto';
import { agoraBRT, previstoMin, min2hm, hm2min, TAREFAS } from './_rotina.mjs';
import { leEstado, salvaEstado, enviaWhats, json } from './_infra.mjs';
import { registraDecisao, rotuloDecisao } from './_placar-estado.mjs';
import { leDecisoes, salvaDecisoes } from './_placar-io.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';

function senhaGestorOk(event, body = {}) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || body.gestorKey || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

const nomeTarefa = (id) => (TAREFAS.find((t) => t.id === id)?.nome) || id;

function emojiDif(dif) {
  if (dif > 0) return `⏰ atrasou ${dif}′`;
  if (dif < 0) return `💚 adiantou ${-dif}′`;
  return '✅ no horário';
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, x-gestor-key',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') return json(405, { ok: false, erro: 'use POST' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, erro: 'body inválido' }); }
  const acao = body.acao;
  const now = agoraBRT();
  const estado = await leEstado(now.data, body.modo || 'casa');
  if (!estado.overrides) estado.overrides = {};
  const ceo = process.env.WHATSAPP_CEO || '';

  if (acao === 'modo') {
    const modo = body.modo === 'katzer' ? 'katzer' : 'casa';
    const anterior = estado.modo === 'katzer' ? 'katzer' : 'casa';
    // Anti-spam: NÃO manda WhatsApp se já estava nesse modo (clique repetido / loop).
    if (anterior === modo) {
      return json(200, { ok: true, modo, unchanged: true, whats: { enviado: false, motivo: 'modo igual — sem aviso' } });
    }
    estado.modo = modo;
    await salvaEstado(estado);
    let w = { enviado: false, motivo: 'WHATSAPP_CEO ausente' };
    if (ceo) {
      const de = anterior === 'katzer' ? '🏢 Katzer' : '🏠 Casa';
      const para = modo === 'katzer' ? '🏢 Katzer' : '🏠 Casa';
      w = await enviaWhats(ceo, `🗓️ Modo do dia: ${de} → *${para}* · ${now.hm}`);
    }
    return json(200, { ok: true, modo, whats: w });
  }

  // Início do dia SÓ HOJE (ex.: começar 09:00). Desloca a agenda mantendo os intervalos.
  if (acao === 'inicio') {
    if (!senhaGestorOk(event, body) && body.requireGestor) {
      return json(401, { ok: false, erro: 'senha do gestor necessária' });
    }
    if (body.limpar || body.hm === '' || body.min === null) { delete estado.inicioMin; }
    else {
      const min = body.min != null ? Number(body.min) : (body.hm ? hm2min(body.hm) : null);
      if (min == null || Number.isNaN(min)) return json(400, { ok: false, erro: 'passe hm (ex.: "09:00") ou min' });
      estado.inicioMin = min;
    }
    await salvaEstado(estado);
    if (ceo) {
      await enviaWhats(ceo, `🗓️ Gestor ajustou início do dia → *${estado.inicioMin != null ? min2hm(estado.inicioMin) : 'padrão'}*`);
    }
    return json(200, { ok: true, inicioMin: estado.inicioMin ?? null, inicio: estado.inicioMin != null ? min2hm(estado.inicioMin) : '(padrão do modo)' });
  }

  // Gestor edita horário de UMA tarefa (ex.: Garimpo 10:15 → 10:30)
  if (acao === 'ajuste-horario') {
    if (!senhaGestorOk(event, body)) {
      return json(401, { ok: false, erro: 'senha do gestor necessária' });
    }
    const t = TAREFAS.find((x) => x.id === body.tarefa);
    if (!t) return json(400, { ok: false, erro: 'tarefa desconhecida' });
    const prev = estado.overrides[t.id];
    if (body.limpar) {
      delete estado.overrides[t.id];
    } else {
      const hm = body.hm || body.horario;
      if (!hm || !/^\d{1,2}:\d{2}$/.test(String(hm))) {
        return json(400, { ok: false, erro: 'passe hm (ex.: "10:30")' });
      }
      const novoMin = hm2min(hm);
      if (prev === novoMin) {
        return json(200, {
          ok: true,
          tarefa: t.id,
          previsto: min2hm(novoMin),
          unchanged: true,
          overrides: estado.overrides,
        });
      }
      estado.overrides[t.id] = novoMin;
    }
    await salvaEstado(estado);
    const novo = estado.overrides[t.id] != null ? min2hm(estado.overrides[t.id]) : t.base;
    if (ceo) {
      await enviaWhats(ceo, `🛠️ Gestor editou *${t.nome}* → previsto *${novo}*`);
    }
    return json(200, { ok: true, tarefa: t.id, previsto: novo, overrides: estado.overrides });
  }

  // Gestor registra pausar / escalar / ajustar campanha
  if (acao === 'gestor-decisao') {
    if (!senhaGestorOk(event, body)) {
      return json(401, { ok: false, erro: 'senha do gestor necessária' });
    }
    const acaoG = String(body.decisao || '').toLowerCase();
    let decisao = 'ajustar';
    let tipo = String(body.tipo || 'gestor');
    let ajuste = body.ajuste || '';
    if (acaoG === 'pausar') {
      decisao = 'agora-nao';
      tipo = 'pausar';
      ajuste = ajuste || 'PAUSAR (gestor Bruno)';
    } else if (acaoG === 'escalar') {
      decisao = 'aplicar';
      tipo = 'escalar';
      ajuste = ajuste || 'ESCALAR (gestor Bruno)';
    } else if (['aplicar', 'ajustar', 'agora-nao', 'desistir', 'manter', 'aumentar'].includes(acaoG)) {
      decisao = acaoG;
    }
    const id = body.id || `gestor-${Date.now()}`;
    const decisoes = await leDecisoes(now.data);
    let item;
    try {
      registraDecisao(decisoes, {
        id,
        campanha: body.campanha || 'Campanha (gestor)',
        tipo,
        decisao,
        ajuste,
        hora: now.hm,
        min: now.min,
      });
      item = decisoes.itens[id];
    } catch (e) {
      return json(400, { ok: false, erro: String((e && e.message) || e) });
    }
    await salvaDecisoes(decisoes);
    const url = (process.env.CAMPANHAS_APP_URL || 'https://dashing-elf-41a723.netlify.app').replace(/\/+$/, '');
    const msg = [
      `🛠️ *Gestor Bruno* · ${now.hm}`,
      rotuloDecisao(item),
      body.campanha ? `Campanha: ${body.campanha}` : '',
      '',
      `Painel: ${url}/painel.html`,
    ].filter(Boolean).join('\n');
    const w = await enviaWhats(ceo, msg);
    return json(200, { ok: true, item, whats: w });
  }

  if (acao === 'feito') {
    const t = TAREFAS.find((x) => x.id === body.tarefa);
    if (!t) return json(400, { ok: false, erro: 'tarefa desconhecida' });
    let nota = (body.nota || '').toString().slice(0, 400);
    let garimpoMeta = null;

    // V6 FINAL: formulário Garimpo — qtd 0–5+ · nome · telefone opcional
    if (t.id === 'garimpo') {
      const qtdRaw = body.qtd != null ? String(body.qtd).trim() : '';
      const qtdOk = ['0', '1', '2', '3', '4', '5', '5+'].includes(qtdRaw);
      const qtd = qtdOk ? (qtdRaw === '5' ? '5' : qtdRaw) : null;
      const nome = String(body.nome || '').trim() || (nota.match(/^[^|]+/) || [''])[0].trim();
      const telefone = String(body.telefone || body.fone || '').trim();
      if (!qtd) {
        return json(400, { ok: false, erro: 'Garimpo: selecione a quantidade (0 a 5+).' });
      }
      if (qtd !== '0' && nome.length < 3) {
        return json(400, { ok: false, erro: 'Garimpo: nome completo do cliente é obrigatório (exceto qtd 0).' });
      }
      const nomeFinal = nome.length >= 3 ? nome : 'Nenhum lead encontrado';
      garimpoMeta = { qtd, nome: nomeFinal, telefone: telefone || null, alertaGestor: qtd === '0' || qtd === '5+' };
      nota = [
        `Qtd ${qtd}`,
        `Cliente: ${nomeFinal}`,
        telefone ? `Tel: ${telefone}` : null,
      ].filter(Boolean).join(' · ');
    }

    estado.tarefas[t.id] = {
      min: now.min,
      hora: now.hm,
      nota,
      ...(garimpoMeta ? { garimpo: garimpoMeta } : {}),
    };
    await salvaEstado(estado);
    const dif = now.min - previstoMin(t, estado.modo, estado.inicioMin, estado.overrides);
    const modoIco = estado.modo === 'katzer' ? '🏢' : '🏠';
    let msg = `✅ Michel — *${t.nome}* · feito ${now.hm} · ${emojiDif(dif)} ${modoIco}`;
    if (t.id === 'garimpo' && garimpoMeta) {
      const flag = garimpoMeta.alertaGestor
        ? (garimpoMeta.qtd === '0' ? '⚠️ QTD 0 — ouro zerado hoje' : '🔥 QTD 5+ — ouro cheio')
        : '⛏️ Relatório Garimpo';
      msg = [
        `${flag}`,
        `*Garimpo 10:15* · ${now.hm} · ${emojiDif(dif)} ${modoIco}`,
        `Quantidade: *${garimpoMeta.qtd}*`,
        `Cliente: *${garimpoMeta.nome}*`,
        garimpoMeta.telefone ? `Tel: ${garimpoMeta.telefone}` : null,
        '',
        'Planilha Katzer · meta diária 0–5+',
      ].filter(Boolean).join('\n');
    } else if (nota) {
      msg += `\n📝 ${nota}`;
    }
    const w = ceo ? await enviaWhats(ceo, msg) : { enviado: false, motivo: 'WHATSAPP_CEO ausente' };
    return json(200, { ok: true, tarefa: t.id, hora: now.hm, difMin: dif, whats: w, garimpo: garimpoMeta });
  }

  if (acao === 'desfazer') {
    if (estado.tarefas[body.tarefa]) delete estado.tarefas[body.tarefa];
    await salvaEstado(estado);
    return json(200, { ok: true, desfeito: body.tarefa });
  }

  if (acao === 'obs') {
    const TIPOS = ['Bruno', 'Carol', 'Bitrix', 'Discadora', 'Sistema', 'Outro'];
    const quem = TIPOS.includes(body.quem) ? body.quem : null;
    if (!quem) return json(400, { ok: false, erro: `obs exige quem em: ${TIPOS.join(', ')}` });
    const nome = (body.nome || '').toString().trim();
    if (nome.length < 100) return json(400, { ok: false, erro: `explique melhor: mínimo 100 caracteres (veio ${nome.length})` });
    const item = { quem, nome: nome.slice(0, 600), inicio: now.hm, duracao: Number(body.duracao) || null };
    estado.obs.push(item);
    await salvaEstado(estado);
    const pediu = ['Bruno', 'Carol'].includes(quem);
    const cabec = pediu ? `🔔 Obs (${quem} pediu)` : `⚠️ Imprevisto (${quem})`;
    await enviaWhats(ceo, `${cabec}: *${item.nome}* — início ${item.inicio}${item.duracao ? ` · ${item.duracao} min` : ''}`);
    return json(200, { ok: true, obs: item });
  }

  return json(400, { ok: false, erro: 'ação desconhecida' });
}
