/**
 * Log estruturado (regra #6: toda automacao tem logs). JSON por linha — o Netlify coleta.
 * Nunca loga credencial. `dados` deve ser objeto ja limpo de segredo.
 */
export function logger(scope) {
  const base = (nivel, msg, dados = {}) => {
    const linha = { t: new Date().toISOString(), nivel, scope, msg, ...dados };
    const s = JSON.stringify(linha);
    if (nivel === 'erro') console.error(s); else console.log(s);
    return linha;
  };
  return {
    info: (msg, d) => base('info', msg, d),
    ok: (msg, d) => base('ok', msg, d),
    erro: (msg, d) => base('erro', msg, d),
  };
}
