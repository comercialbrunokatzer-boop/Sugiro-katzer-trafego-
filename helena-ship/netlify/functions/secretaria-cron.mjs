// RUNNER AUTOMÁTICO da Secretária — função AGENDADA (a cada 2h).
// Lê as conversas recentes da Helena, roda o cérebro e:
//   - modo OBSERVAÇÃO (SECRETARIA_MODO != producao): monta o que FARIA e avisa o Bruno (NÃO escreve).
//   - modo PRODUÇÃO (SECRETARIA_MODO = producao): aplica a zona verde no Bitrix; zona vermelha propõe.
// Duplo interruptor: SECRETARIA_AUTO liga a rotina; SECRETARIA_MODO decide observar x escrever.
// Só age em conversa NOVA/alterada desde a última passada (throttle via secretaria_estado/<fk>).
import { rodaSecretaria } from '../../maestro/src/secretariaRun.js';
import { achaDealLeitura } from '../../maestro/src/bitrixRead.js';
import { estagioPorStageId } from '../../maestro/src/secretaria.js';
import { processaConversas, montaPropostas } from '../../maestro/src/secretariaCron.js';
import { aplica } from '../../maestro/src/secretariaAplica.js';
import { criaBitrix } from '../../maestro/src/bitrixWrite.js';
import { criaWhatsapp } from '../../maestro/src/whatsapp.js';
import { CFG } from '../../maestro/src/config.js';

export const config = { schedule: '0 */2 * * *' }; // a cada 2 horas

const JANELA_MS = 48 * 3600 * 1000; // só conversas mexidas nas últimas 48h

async function adminDb() {
  const { default: admin } = await import('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  return admin.database();
}

export async function handler() {
  if (!CFG.SECRETARIA_AUTO) {
    return resp({ ok: true, pulado: 'SECRETARIA_AUTO desligado' });
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.FIREBASE_DATABASE_URL) {
    return resp({ ok: false, erro: 'Firebase não configurado' });
  }

  const db = await adminDb();
  const agora = Date.now();

  // 1) conversas recentes, não assumidas por humano, com mensagem — e ainda não processadas nesta versão.
  const snap = await db.ref('helena_conversas').once('value');
  const val = snap.val() || {};
  const estSnap = await db.ref('secretaria_estado').once('value');
  const est = estSnap.val() || {};

  const candidatos = [];
  for (const [chave, conv] of Object.entries(val)) {
    if (!conv || conv.handledByHuman) continue;
    if (!Array.isArray(conv.messages) || conv.messages.length === 0) continue;
    const lastUpdate = conv.lastUpdate || 0;
    if (agora - lastUpdate > JANELA_MS) continue;               // muito antiga
    if (est[chave] && String(est[chave].lastUpdate) === String(lastUpdate)) continue; // sem novidade
    candidatos.push({ chave, conv, lastUpdate });
  }
  candidatos.sort((a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0));
  const lote = candidatos.slice(0, CFG.SECRETARIA_CRON_LIMITE);

  if (!lote.length) return resp({ ok: true, processadas: 0, total_recentes: candidatos.length });

  // 2) roda o cérebro em cada conversa.
  //    processadosIds: garante que o mesmo messageId não move nem comenta o card duas vezes
  //    (o Set é populado depois de aplica() confirmar aplicado:true).
  const processadosIds = new Set();
  const itens = await processaConversas(lote, {
    achaDeal: async (tel) => achaDealLeitura(tel),
    rodar: (conv, opts) => rodaSecretaria(conv, opts),
    estagioPorStageId,
    processadosIds,
  });

  // 3) ZONA VERDE: aplica CALADA (o registro fica no próprio card — sem WhatsApp de rotina).
  //    Só escreve em produção. Em homolog o runner é inerte (nem escreve, nem avisa).
  let escritas = 0;
  if (CFG.SECRETARIA_MODO === 'producao') {
    const bitrix = criaBitrix({});
    for (const it of itens) {
      const acao = it.decisao && it.decisao.acao;
      if (acao !== 'ATUALIZAR' || !it.plano || !it.temCard) continue; // só zona verde COM card real
      try {
        const resultado = await aplica(it.plano, { modo: 'producao', atualizaNegocio: bitrix.atualizaNegocio });
        if (resultado.aplicado === true && it.decisao.messageId) {
          processadosIds.add(it.decisao.messageId);
        }
        if (resultado.aplicado) escritas += 1;
      } catch { /* best-effort: uma falha não derruba o lote */ }
    }
  }

  // 4) ZONA VERMELHA: NÃO escreve — só PROPÕE pro Bruno (trava do Conselho). WhatsApp SÓ
  //    quando há proposta; nunca um resumo de rotina.
  const propostas = montaPropostas(itens);
  let avisou = false;
  if (propostas) {
    try {
      const whatsapp = criaWhatsapp({});
      const alvo = process.env.BRUNO_PHONE || CFG.KATZER_ALERT_PHONE;
      if (alvo) { await whatsapp.enviaTexto(alvo, propostas); avisou = true; }
    } catch (e) {
      console.error('[secretaria-cron] falha ao propor pro Bruno', e && e.message);
    }
  }

  // 5) marca as conversas do lote como processadas (throttle).
  const updates = {};
  for (const it of lote) updates[`secretaria_estado/${it.chave}`] = { lastUpdate: it.lastUpdate, em: agora };
  try { await db.ref().update(updates); } catch { /* não crítico */ }

  return resp({ ok: true, modo: CFG.SECRETARIA_MODO, processadas: itens.length, escritas, propos_zona_vermelha: avisou });
}

function resp(body) {
  return { statusCode: 200, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body, null, 2) };
}
