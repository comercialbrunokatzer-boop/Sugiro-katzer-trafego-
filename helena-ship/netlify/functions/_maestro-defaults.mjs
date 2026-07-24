// Suporte (arquivo com prefixo "_" => Netlify NAO publica como endpoint).
// TRAVA DE SEGURANCA DO DEPLOY: se ninguem definir MAESTRO_MODO, o Maestro sobe
// em HOMOLOG — roda o fluxo real mas SIMULA a escrita no Bitrix (nao escreve nada).
// Isso e proposital: o deploy nasce seguro. Para ir a PRODUCAO (escrita real),
// defina MAESTRO_MODO=producao nas Environment variables do Netlify (painel do site).
//
// Importado PRIMEIRO por cada wrapper, antes do maestro/src/config.js ler o env,
// garantindo o default independente de como o Netlify propaga env pras functions.
if (!process.env.MAESTRO_MODO || !process.env.MAESTRO_MODO.trim()) {
  process.env.MAESTRO_MODO = 'homolog';
}
