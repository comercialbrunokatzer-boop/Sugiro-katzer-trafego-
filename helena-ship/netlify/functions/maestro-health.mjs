// Maestro health-check. Entry-point Netlify.
// Nome distinto de "health" pra NAO colidir com o /api/health da Helena (helena.js).
// Diz se o Maestro esta de pe, em qual MODO, e quais credenciais existem (sem expor valor).
import './_maestro-defaults.mjs'; // trava homolog-por-padrao (importar SEMPRE primeiro)
export { handler } from '../../maestro/functions/health.js';
