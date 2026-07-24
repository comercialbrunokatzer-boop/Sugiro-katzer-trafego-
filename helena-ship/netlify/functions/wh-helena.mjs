// Maestro WH-04 (Helena/Firebase "qualificado" -> Bitrix). Entry-point Netlify.
// O webhook mais importante: fecha o buraco do lead preso no WhatsApp/Firebase.
// Chama o handler SO com `event` (sem o context do Netlify) pra o Maestro montar
// as dependencias reais via montaDeps() em vez de confundir context com _deps.
import './_maestro-defaults.mjs'; // trava homolog-por-padrao (importar SEMPRE primeiro)
import { handler as maestro } from '../../maestro/functions/wh-helena.js';
export const handler = (event) => maestro(event);
