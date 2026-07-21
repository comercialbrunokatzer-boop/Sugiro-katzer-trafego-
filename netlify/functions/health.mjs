// Health-check do site do Tráfego. Diz se está de pé e quais credenciais EXISTEM
// (sem NUNCA expor valor). Nasce seguro: nada dispara sozinho.
export async function handler() {
  const tem = (k) => !!(process.env[k] && String(process.env[k]).trim());
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      ok: true,
      servico: 'katzer-trafego',
      credenciais: {
        meta: tem('META_SYSTEM_TOKEN'),
        zapi: tem('ZAPI_INSTANCE') && tem('ZAPI_TOKEN'),
        whatsapp_michel: tem('WHATSAPP_MICHEL'),
        whatsapp_ceo: tem('WHATSAPP_CEO'),
      },
      em: new Date().toISOString(),
    }, null, 2),
  };
}
