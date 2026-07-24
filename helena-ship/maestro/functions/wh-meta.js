/**
 * WH-01 — META ADS -> BITRIX24.
 * Campanha gera lead -> nasce Negocio "Lead Novo" no Bitrix, atribuido pra fila da discadora.
 * Elimina a tarefa manual "Preencher formulario de CRM".
 * Payload de exemplo: test/payloads/wh-meta.json
 */
import { CFG } from '../src/config.js';
import { ingestLead } from '../src/ingest.js';
import { montaEvento } from '../src/evento.js';
import { montaDeps, corpo, resposta } from '../src/wiring.js';

export async function handler(event, _deps) {
  const deps = _deps || montaDeps('wh-meta');
  const bruto = corpo(event);
  const evento = montaEvento(bruto, { source: 'meta_ads', event_type: 'lead.created' });
  const r = await ingestLead(bruto, { origemPadrao: 'formulario_facebook', etapa: CFG.ETAPAS.LEAD_NOVO, qualificado: false, avisarCEO: true, evento }, deps);
  return resposta(r.ok ? 200 : 500, r);
}
