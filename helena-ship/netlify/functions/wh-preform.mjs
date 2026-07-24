// Maestro WH-03 (Pre-formulario -> Bitrix). Entry-point Netlify.
// Chama o handler SO com `event` (sem o context do Netlify) pra o Maestro montar
// as dependencias reais via montaDeps() em vez de confundir context com _deps.
import './_maestro-defaults.mjs'; // trava homolog-por-padrao (importar SEMPRE primeiro)
import { handler as maestro } from '../../maestro/functions/wh-preform.js';
export const handler = (event) => maestro(event);
