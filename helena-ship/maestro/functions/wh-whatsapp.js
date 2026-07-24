/**
 * WH-02 — WHATSAPP DIRETO -> BITRIX24.
 * Numero novo cai no WhatsApp (sem pre-formulario) -> nasce Negocio "Lead Novo" com o numero + fonte.
 * A qualificacao pela Helena vem depois (o WH-04 promove o mesmo negocio).
 * Payload de exemplo: test/payloads/wh-whatsapp.json
 */
import { CFG } from '../src/config.js';
import { ingestLead } from '../src/ingest.js';
import { montaEvento } from '../src/evento.js';
import { montaDeps, corpo, resposta } from '../src/wiring.js';

export async function handler(event, _deps) {
  const deps = _deps || montaDeps('wh-whatsapp');
  const bruto = corpo(event);
  const evento = montaEvento(bruto, { source: 'whatsapp_direto', event_type: 'lead.created' });
  const r = await ingestLead(bruto, { origemPadrao: 'whatsapp_direto', etapa: CFG.ETAPAS.LEAD_NOVO, qualificado: false, avisarCEO: true, evento }, deps);
  return resposta(r.ok ? 200 : 500, r);
}
