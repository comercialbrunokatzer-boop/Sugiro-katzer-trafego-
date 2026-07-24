// HOMOLOGAÇÃO da Secretária IA — roda o cérebro sobre uma conversa REAL e mostra
// a DECISÃO (etapa recomendada + o que faria no Bitrix). *** DRY-RUN: NÃO ESCREVE ***
// no Bitrix nem na conversa. Protegido por ?key=<BRUNO_PHONE>.
//
// Uso:
//   GET  /api/secretaria-run?key=<numero>&tel=<telefone do cliente>
//        -> lê a conversa da Helena no Firebase + a etapa atual do card no Bitrix
//           e mostra o que a Secretária FARIA (sem aplicar).
//   POST /api/secretaria-run?key=<numero>   body: { "messages":[{role,content}...],
//        "estagioAtual":"Mapeamento" }  -> roda sobre a conversa colada (sem Firebase).
import { rodaSecretaria, conversaHelenaParaMsgs, textoDoCliente } from '../../maestro/src/secretariaRun.js';
import { leConversa, candidatosChave, mesmoTelefone } from '../../maestro/src/secretariaConversa.js';
import { achaDealLeitura } from '../../maestro/src/bitrixRead.js';
import { estagioPorStageId } from '../../maestro/src/secretaria.js';
import { planoDeEscrita, aplica } from '../../maestro/src/secretariaAplica.js';
import { extraiCampos } from '../../maestro/src/secretariaExtrai.js';
import { criaBitrix } from '../../maestro/src/bitrixWrite.js';
import { CFG } from '../../maestro/src/config.js';

const soDigitos = (s) => String(s || '').replace(/\D+/g, '');

/**
 * Leitor via SDK admin (MESMO caminho da Helena — ignora as regras do RTDB, então
 * lê garantido). Só é usado quando FIREBASE_SERVICE_ACCOUNT_JSON está configurado.
 * Import dinâmico pra não pesar o cold start quando não há credencial.
 */
async function leConversaAdmin(tel) {
  const { default: admin } = await import('firebase-admin');
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  // Número BR varia (com/sem 55, com/sem 9) — tenta cada variação até achar.
  const cands = candidatosChave(tel);
  if (!cands.length) throw new Error('telefone inválido');
  const db = admin.database();
  for (const fk of cands) {
    const snap = await db.ref(`helena_conversas/${fk}`).once('value');
    if (snap.exists()) return { conv: snap.val() || null, chave: fk };
  }
  return { conv: null, chave: null };
}

/**
 * DIAGNÓSTICO: lista as conversas salvas no Firebase (chave/telefone + nome + qtd de
 * mensagens + última atualização). SEM conteúdo das mensagens (privacidade). Ordena da
 * mais recente pra mais antiga e corta no limite. Só admin (o handler já checou o key).
 */
async function listaConversasAdmin(limite = 40) {
  const { default: admin } = await import('firebase-admin');
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  const snap = await admin.database().ref('helena_conversas').once('value');
  const val = snap.val() || {};
  const linhas = Object.entries(val).map(([chave, c]) => ({
    chave,
    nome: (c && c.leadData && (c.leadData.full_name || c.leadData.leadName)) || null,
    msgs: (c && Array.isArray(c.messages)) ? c.messages.length : 0,
    ultima: (c && c.lastUpdate) ? new Date(c.lastUpdate).toISOString() : null,
    humano: !!(c && c.handledByHuman),
  }));
  linhas.sort((a, b) => (b.ultima || '').localeCompare(a.ultima || ''));
  return { total: linhas.length, conversas: linhas.slice(0, limite) };
}

export async function handler(event) {
  const params = event.queryStringParameters || {};
  const bruno = process.env.BRUNO_PHONE || '';
  // Gate tolerante ao formato BR (com/sem 55, com/sem 9) — o mesmo número em qualquer forma passa.
  if (!bruno || !mesmoTelefone(params.key, bruno)) {
    return json(403, { ok: false, erro: 'acesso negado — passe ?key=<seu numero admin (BRUNO_PHONE)>' });
  }

  // MODO LISTA (default amigável): ?listar=1 OU um GET sem ?tel= -> mostra as conversas
  // salvas no Firebase. Assim a URL mais simples possível (só ?key=...) já lista — sem
  // depender do "&listar=1" (que somia ao abrir no celular).
  if (params.listar || params.conversas || (!params.tel && event.httpMethod !== 'POST')) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return json(500, { ok: false, erro: 'FIREBASE_SERVICE_ACCOUNT_JSON não configurado' });
    try {
      const lim = Math.min(Number(params.limite) || 40, 100);
      const r = await listaConversasAdmin(lim);
      return json(200, { ok: true, modo: 'lista de conversas salvas', ...r });
    } catch (e) {
      return json(502, { ok: false, erro: String((e && e.message) || e) });
    }
  }

  // Conversa: do corpo (POST, colada) OU do Firebase por telefone (GET ?tel=).
  let conv = null;
  let tel = params.tel || '';
  let estagioAtual = params.estagioAtual || null;
  let dealCtx = null;

  if (event.httpMethod === 'POST' && event.body) {
    let body = {};
    try { body = JSON.parse(event.body); } catch { return json(400, { ok: false, erro: 'body não é JSON' }); }
    tel = body.tel || tel;
    estagioAtual = body.estagioAtual || estagioAtual;
    conv = Array.isArray(body.messages) ? { messages: body.messages } : (body.conv || null);
  }

  let chaveUsada = null;
  if (!conv) {
    if (!tel) return json(400, { ok: false, erro: 'passe ?tel=<telefone> (GET) ou messages no body (POST)' });
    if (!process.env.FIREBASE_DATABASE_URL) return json(500, { ok: false, erro: 'FIREBASE_DATABASE_URL não configurado' });
    // Prefere o SDK admin (mesma leitura da Helena, ignora regras do RTDB). Sem
    // credencial, cai no REST (que depende das regras permitirem leitura).
    const usaAdmin = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    try {
      if (usaAdmin) {
        const r = await leConversaAdmin(tel);
        conv = r.conv; chaveUsada = r.chave;
      } else {
        conv = await leConversa(tel);
      }
    } catch (e) {
      return json(502, { ok: false, erro: `falha lendo a conversa no Firebase (${usaAdmin ? 'admin' : 'rest'}): ${String((e && e.message) || e)}` });
    }
    if (!conv) {
      return json(404, {
        ok: false,
        erro: `nenhuma conversa em helena_conversas para ${soDigitos(tel)}`,
        variacoes_testadas: candidatosChave(tel),
        dica: 'Se o cliente conversou mesmo, o número pode estar salvo em outro formato — me manda que eu confiro.',
      });
    }
  }

  // Etapa atual do card (contexto). Best-effort: se o webhook de leitura falhar,
  // segue sem — o dry-run continua útil só com a conversa.
  if (tel && !estagioAtual && process.env.BITRIX_WEBHOOK_READ) {
    try {
      const d = await achaDealLeitura(tel);
      if (d) {
        dealCtx = { dealId: d.dealId, stageId: d.stageId, title: d.title };
        estagioAtual = estagioPorStageId(d.stageId) || estagioAtual;
      }
    } catch (e) {
      dealCtx = { erro: String((e && e.message) || e) };
    }
  }

  const msgs = Array.isArray(conv.messages) ? conv.messages : [];
  const decisao = await rodaSecretaria(conv, {
    estagioAtual: estagioAtual || 'Leads Novos',
    dealId: (dealCtx && dealCtx.dealId) || 'HOMOLOG',
  });

  // APLICAR (?aplicar=1): monta o PLANO de escrita (só zona verde) e aplica APENAS se
  // SECRETARIA_MODO=producao. Em homolog devolve o plano sem tocar no Bitrix.
  // Fase 1: move etapa + comentário. Fase 2: preenche os campos extraídos da conversa.
  let aplicacao = null;
  if (params.aplicar || params.aplicar1) {
    try {
      const dealId = dealCtx && dealCtx.dealId;
      const campos = extraiCampos(textoDoCliente(conversaHelenaParaMsgs(conv)));
      const plano = planoDeEscrita(decisao, { dealId, campos });
      const bitrix = criaBitrix({});
      aplicacao = await aplica(plano, {
        modo: CFG.SECRETARIA_MODO,
        atualizaNegocio: bitrix.atualizaNegocio,
        logger: { info: (m, x) => console.log('[secretaria-aplica]', m, JSON.stringify(x || {})) },
      });
      aplicacao.secretaria_modo = CFG.SECRETARIA_MODO;
      aplicacao.campos_extraidos = campos;
    } catch (e) {
      aplicacao = { aplicado: false, erro: String((e && e.message) || e), secretaria_modo: CFG.SECRETARIA_MODO };
    }
  }

  return json(200, {
    ...(aplicacao ? { aplicacao } : {}),
    ok: true,
    modo: 'DRY-RUN (não escreve no Bitrix)',
    telefone: soDigitos(tel) || null,
    chave_encontrada: chaveUsada, // a variação (com/sem 9/55) que casou no Firebase
    mensagens_lidas: msgs.length,
    etapa_atual_no_card: estagioAtual || '(desconhecida)',
    card: dealCtx,
    decisao: renderDecisao(decisao),
    _cru: decisao,
  });
}

/** Deixa a decisão legível pro Bruno entender de bate. */
function renderDecisao(d = {}) {
  const acaoTxt = {
    ATUALIZAR: '🟢 ZONA VERDE — a Secretária MOVERIA sozinha (Michel acompanha)',
    PROPOR: '🔴 ZONA VERMELHA — só PROPÕE; espera o OK do Bruno no WhatsApp',
    REVISAO_HUMANA: '🟡 REVISÃO — não passou nas travas; alguém confere',
  }[d.acao] || d.acao;
  const up = d.update || {};
  return {
    acao: d.acao,
    o_que_significa: acaoTxt,
    fonte_da_leitura: d.fonte, // deterministico | claude | deterministico_fallback
    etapa_recomendada: up._estagio || (d.parecer && d.parecer.recommended_stage) || null,
    confianca: d.confidence != null ? d.confidence : (d.parecer && d.parecer.confidence),
    proxima_acao: d.proxima_acao || null,
    resumo: d.parecer && d.parecer.resumo,
    evidencias: (d.parecer && d.parecer.evidence) || [],
    motivos_da_revisao: d.motivos || [],
    comentario_que_iria_pro_card: up.fields ? up.fields.COMMENTS : null,
    stage_id_bitrix: up.fields ? up.fields.STAGE_ID : null,
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body, null, 2),
  };
}
