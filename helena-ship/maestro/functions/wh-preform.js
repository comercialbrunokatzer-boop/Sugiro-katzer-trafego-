/**
 * WH-03 — PRE-FORMULARIO -> BITRIX24.
 * Lead preenche formulario completo (ex: Paulo Cezar) -> nasce Negocio "Qualificado" com TODOS os campos,
 * corretor atribuido. Dados nascem completos (regra #3: sem preenchimento manual).
 * Payload de exemplo: test/payloads/wh-preform.json
 */
import { CFG } from '../src/config.js';
import { ingestLead } from '../src/ingest.js';
import { montaEvento } from '../src/evento.js';
import { montaDeps, corpo, resposta } from '../src/wiring.js';

export async function handler(event, _deps) {
  const deps = _deps || montaDeps('wh-preform');
  const bruto = corpo(event);
  const evento = montaEvento(bruto, { source: 'preformulario', event_type: 'lead.qualificado' });
  const r = await ingestLead(bruto, { origemPadrao: 'formulario_facebook', etapa: CFG.ETAPAS.QUALIFICADO, qualificado: false, avisarCEO: true, evento }, deps);
  return resposta(r.ok ? 200 : 500, r);
}
