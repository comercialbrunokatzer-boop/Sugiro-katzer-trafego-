// Maestro WH-02 (WhatsApp direto -> Bitrix). Entry-point Netlify.
// Chama o handler SO com `event` (sem o context do Netlify) pra o Maestro montar
// as dependencias reais via montaDeps() em vez de confundir context com _deps.
import './_maestro-defaults.mjs'; // trava homolog-por-padrao (importar SEMPRE primeiro)
import { handler as maestro } from '../../maestro/functions/wh-whatsapp.js';
export const handler = (event) => maestro(event);
