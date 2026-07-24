/**
 * WH-04 — HELENA -> BITRIX24 (O MAIS IMPORTANTE).
 * Helena conclui a qualificacao no WhatsApp (Firebase marca status "qualificado") ->
 * Maestro cria/atualiza o Negocio "Pre-Qualificado" com tudo que a Helena coletou ->
 * atribui corretor (round-robin) -> joga na discadora -> avisa o lead ("o corretor X ja vai te chamar").
 * Fecha o achado nº 1: nenhum lead qualificado fica preso no WhatsApp/Firebase.
 * Payload de exemplo: test/payloads/wh-helena.json
 */
import { CFG } from '../src/config.js';
import { ingestLead } from '../src/ingest.js';
import { montaEvento } from '../src/evento.js';
import { montaDeps, corpo, resposta } from '../src/wiring.js';

export async function handler(event, _deps) {
  const deps = _deps || montaDeps('wh-helena');
  const bruto = corpo(event);
  // aceita tanto o lead direto quanto o envelope do Firebase ({ status, lead })
  const lead = bruto.lead || bruto;
  if (bruto.status && bruto.status !== 'qualificado') {
    return resposta(200, { ok: true, ignorado: `status=${bruto.status}` });
  }
  const evento = montaEvento(lead, { source: 'helena', event_type: 'lead.qualificado' });
  const r = await ingestLead(lead, { origemPadrao: 'whatsapp_direto', etapa: CFG.ETAPAS.PRE_QUALIFICADO, qualificado: true, avisarCEO: true, evento }, deps);
  return resposta(r.ok ? 200 : 500, r);
}
