// Persistência Garimpo → Blobs (sempre) + Google Sheets via webhook (se configurado).
// Colunas ABA GARIMPO: A Data | B Hora | C Responsável | D Quantidade | E Nome Cliente | F Telefone
import { getStore } from '@netlify/blobs';

const STORE = 'rotina-michel';

function abreStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: STORE, siteID, token });
  return getStore(STORE);
}

/**
 * @returns {{ ok: boolean, blobs: object, sheets: object }}
 */
export async function persisteGarimpo(registro) {
  const data = registro.data; // YYYY-MM-DD
  const key = `garimpo-log-${data}`;
  const store = abreStore();
  let log = (await store.get(key, { type: 'json' })) || { data, rows: [] };
  log.rows.push(registro);
  log.atualizadoEm = new Date().toISOString();
  await store.setJSON(key, log);

  const sheets = await enviaSheetsGarimpo(registro);
  return {
    ok: sheets.required ? sheets.ok : true,
    blobs: { ok: true, key, n: log.rows.length },
    sheets,
  };
}

async function enviaSheetsGarimpo(registro) {
  const webhook = process.env.GARIMPO_SHEETS_WEBHOOK || process.env.GOOGLE_SHEETS_WEBHOOK || '';
  if (!webhook) {
    return {
      ok: false,
      skipped: true,
      required: false,
      motivo: 'GARIMPO_SHEETS_WEBHOOK ausente — salvo só no Blobs',
    };
  }

  const leads = registro.leads?.length
    ? registro.leads
    : [{ nome: registro.nome || '', telefone: registro.telefone || '' }];

  // Uma linha por lead; qtd 0 → uma linha com nome vazio / "Nenhum"
  const rows = (leads.length ? leads : [{ nome: 'Nenhum lead encontrado', telefone: '' }]).map((l) => ({
    data: registro.dataBR || registro.data,
    hora: registro.hora,
    responsavel: registro.responsavel || 'Michel',
    quantidade: registro.qtd,
    nomeCliente: l.nome || '',
    telefone: l.telefone || '',
  }));

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aba: 'GARIMPO',
        rows,
        registro,
      }),
    });
    const text = await r.text().catch(() => '');
    if (!r.ok) {
      return {
        ok: false,
        skipped: false,
        required: true,
        motivo: `Sheets HTTP ${r.status}: ${text.slice(0, 180)}`,
      };
    }
    return { ok: true, skipped: false, required: true, n: rows.length };
  } catch (e) {
    return {
      ok: false,
      skipped: false,
      required: true,
      motivo: String((e && e.message) || e),
    };
  }
}
