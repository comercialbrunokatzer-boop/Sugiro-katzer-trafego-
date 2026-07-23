// Relatório 16h — GET/POST /api/relatorio-16h
// Gestor: só olhar no /gestor.html OU botão "Enviar relatório 16h no WhatsApp".
// Auth: x-gestor-key (mesma senha do placar gestor).
import { createHash } from 'node:crypto';
import { agoraBRT, pontualidade } from './_rotina.mjs';
import { leEstado, enviaWhats, json } from './_infra.mjs';
import { disparaRelatorio } from './_disparo.mjs';
import { resumoWhats } from './_relatorio.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';

function senhaGestorOk(event, body = {}) {
  const h = event.headers || {};
  const params = event.queryStringParameters || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || body.gestorKey || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type, x-gestor-key',
      },
      body: '',
    };
  }

  let body = {};
  try { if (event.body) body = JSON.parse(event.body); } catch { /* ignore */ }

  if (!senhaGestorOk(event, body)) {
    return json(401, { ok: false, precisaSenha: true, erro: 'senha do gestor necessária' });
  }

  const now = agoraBRT();
  const estado = await leEstado(now.data);
  const P = pontualidade(estado, now.min, {
    domingo: now.dow === 0,
    fimDiaMin: estado.modo === 'katzer' ? (14 * 60 + 30) : (13 * 60),
  });
  const texto = resumoWhats(estado, now);
  const preview = {
    ok: true,
    data: now.data,
    agora: now.hm,
    pct: P.pct,
    saldoMin: P.saldoMin,
    linhas: P.linhas,
    obs: estado.obs || [],
    textoWhats: texto,
    auto: true,
    dica: 'Clica 16h e olha. Botão envia no WhatsApp se quiser.',
  };

  // POST = enviar no WhatsApp agora (opcional)
  if (event.httpMethod === 'POST' || (event.queryStringParameters || {}).enviar === '1') {
    const r = await disparaRelatorio(now, { teste: true });
    const ceo = process.env.WHATSAPP_CEO || '';
    // Se disparaRelatorio skipou, força envio do texto
    let whats = r.whats;
    if (!whats?.enviado && ceo) {
      whats = await enviaWhats(ceo, `🕔 *Relatório 16h (gestor)*\n${texto}`);
    }
    return json(200, { ...preview, enviado: true, whats: whats || r.whats, email: r.email });
  }

  if (event.httpMethod !== 'GET') return json(405, { ok: false, erro: 'use GET ou POST' });
  return json(200, preview);
}
