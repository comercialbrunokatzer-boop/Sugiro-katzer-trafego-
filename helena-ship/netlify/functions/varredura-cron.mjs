/**
 * CRON — varredura da carteira parada (DRY-RUN por padrão).
 *
 * Seguro:
 *   VARREDURA_AUTO=1        -> liga a rotina
 *   VARREDURA_MODO=producao -> (futuro) envio real — HOJE este cron NÃO envia, só lista
 *
 * Sem GO do CEO + piloto gatekeeper: zero WhatsApp.
 */
import './_maestro-defaults.mjs';
import { bitrixGet } from '../../maestro/src/bitrixRead.js';
import { CFG } from '../../maestro/src/config.js';
import { montaLoteVarreduraSeguro } from '../../maestro/src/varreduraComGatekeeper.js';
import { normalizaConfigPiloto } from '../../maestro/src/gatekeeper.js';
import { soDigitos } from '../../maestro/src/retomadaPatrocinado.js';

export const config = { schedule: '0 14 * * 1-6' }; // 11h BRT seg-sáb

const STAGE_NOVOS = process.env.STAGE_LEADS_NOVOS || 'C1:NEW';
const STAGE_TENTANDO = process.env.STAGE_TENTANDO_CONTATO || process.env.STAGE_QUALIFICADO || 'C1:PREPARATION';

function envOn(k) {
  return /^(1|on|true|sim)$/i.test(String(process.env[k] || '').trim());
}

async function telefoneDoContato(contactId) {
  if (!contactId) return '';
  try {
    const c = await bitrixGet('crm.contact.get', { id: contactId });
    const phones = Array.isArray(c?.PHONE) ? c.PHONE : [];
    return soDigitos(phones[0]?.VALUE || '');
  } catch {
    return '';
  }
}

async function listaCarteiraParada({ max = 120 } = {}) {
  const categoryId = Number(process.env.BITRIX_CATEGORY_ID || CFG.CATEGORY_ID || 1);
  const select = [
    'ID', 'TITLE', 'STAGE_ID', 'CONTACT_ID', 'ASSIGNED_BY_ID',
    'DATE_CREATE', 'DATE_MODIFY', 'SOURCE_DESCRIPTION', 'SOURCE_ID',
  ];
  const out = [];
  for (const stageId of [STAGE_NOVOS, STAGE_TENTANDO]) {
    let start = 0;
    for (let page = 0; page < 3; page += 1) {
      const batch = await bitrixGet('crm.deal.list', {
        filter: { CATEGORY_ID: categoryId, STAGE_ID: stageId },
        select,
        order: { DATE_MODIFY: 'ASC' },
        start,
      }) || [];
      if (!Array.isArray(batch) || !batch.length) break;
      out.push(...batch);
      if (batch.length < 50) break;
      start += batch.length;
      if (out.length >= max) break;
    }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

function toMs(bitrixDate) {
  if (!bitrixDate) return null;
  const t = Date.parse(bitrixDate);
  return Number.isFinite(t) ? t : null;
}

export async function handler() {
  if (!envOn('VARREDURA_AUTO')) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, skipped: true, motivo: 'VARREDURA_AUTO off' }),
    };
  }

  const agoraMs = Date.now();
  const maxLote = Number(process.env.VARREDURA_MAX_LOTE || '10') || 10;
  const paradoHorasMin = Number(process.env.VARREDURA_PARADO_HORAS || '24') || 24;
  const piloto = normalizaConfigPiloto({
    dealIds: process.env.PILOTO_DEAL_IDS || '',
    phones: process.env.PILOTO_PHONES || '',
    campanhas: process.env.PILOTO_CAMPANHAS || process.env.HELENA_CAMPANHAS_BRUNO || '',
    idadeMaxDias: process.env.PILOTO_IDADE_MAX_DIAS || '30',
    categoryId: process.env.BITRIX_CATEGORY_ID || CFG.CATEGORY_ID || '1',
  });

  const raw = await listaCarteiraParada({ max: Number(process.env.VARREDURA_MAX_SCAN || '120') || 120 });
  const deals = [];
  for (const d of raw) {
    const phone = await telefoneDoContato(d.CONTACT_ID);
    deals.push({
      dealId: String(d.ID),
      stageId: d.STAGE_ID,
      phone,
      assignedById: d.ASSIGNED_BY_ID,
      categoryId: String(process.env.BITRIX_CATEGORY_ID || CFG.CATEGORY_ID || '1'),
      campanha: d.SOURCE_DESCRIPTION || '',
      origem: d.SOURCE_ID || '',
      criadoEmMs: toMs(d.DATE_CREATE),
      ultimaAtividadeMs: toMs(d.DATE_MODIFY),
      title: d.TITLE,
    });
  }

  const resultado = montaLoteVarreduraSeguro(deals, {
    agoraMs,
    paradoHorasMin,
    maxLote,
    gatekeeper: piloto,
  });

  // DRY-RUN obrigatório neste PR: nunca envia WhatsApp
  const payload = {
    ok: true,
    modo: 'dry-run',
    aviso: 'Sem envio WhatsApp neste cron. Produção exige GO CEO + PR de fiação de envio.',
    selecionados: resultado.selecionados,
    lote: resultado.lote.map((x) => ({
      dealId: x.dealId,
      phone: x.phone ? `***${String(x.phone).slice(-4)}` : '',
      stageId: x.stageId,
      gate: x._gatekeeper?.codigo,
    })),
    bloqueados: resultado.bloqueados.length,
    restam: resultado.restam,
    em: new Date(agoraMs).toISOString(),
  };

  console.log('[varredura-cron]', JSON.stringify(payload));
  return { statusCode: 200, body: JSON.stringify(payload) };
}

export default { handler };
