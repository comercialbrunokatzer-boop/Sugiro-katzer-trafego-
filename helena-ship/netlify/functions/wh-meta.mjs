// Maestro WH-01 (Meta Ads -> Bitrix). Entry-point Netlify.
// Codigo-fonte vive em maestro/ (ESM, testado — 56/56).
//
// IMPORTANTE: o handler do Maestro tem assinatura (event, _deps), onde _deps e
// injecao de dependencias usada nos testes. O Netlify chama (event, context) e o
// context e um objeto truthy — se repassado, ele viraria "_deps" e o Maestro pularia
// montaDeps() (bitrix/firebase/zapi reais), quebrando. Por isso chamamos SO com event:
// assim _deps fica undefined e o Maestro monta as dependencias reais a partir do env.
import './_maestro-defaults.mjs'; // trava homolog-por-padrao (importar SEMPRE primeiro)
import { handler as maestro } from '../../maestro/functions/wh-meta.js';
export const handler = (event) => maestro(event);
