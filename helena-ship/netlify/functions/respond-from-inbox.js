// Netlify Function: respond-from-inbox
// Endpoint: /.netlify/functions/respond-from-inbox
// Recebe: { leadPhone, text, respondedBy }
// Envia mensagem via Z-API pro lead

exports.handler = async function(event) {
  // CORS pra painel
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "method not allowed" }) };
  }
  
  try {
    const { leadPhone, text, respondedBy } = JSON.parse(event.body || "{}");
    
    if (!leadPhone || !text) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "leadPhone e text obrigatórios" }) };
    }
    
    // helena.js exige ZAPI_INSTANCE_ID; aceitamos também ZAPI_INSTANCE por
    // compatibilidade (bug: antes lia só ZAPI_INSTANCE e quebrava o envio).
    const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE;
    const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
    const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
    
    if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "ZAPI não configurado" }) };
    }
    
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;
    
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ZAPI_CLIENT_TOKEN ? { "Client-Token": ZAPI_CLIENT_TOKEN } : {})
      },
      body: JSON.stringify({
        phone: leadPhone,
        message: text
      })
    });
    
    const respText = await r.text();
    
    if (!r.ok) {
      console.error("zapi falhou", r.status, respText);
      return { statusCode: 502, headers, body: JSON.stringify({ error: "zapi falhou", detail: respText }) };
    }
    
    console.log(`[INBOX] ${respondedBy} respondeu ${leadPhone}: ${text.slice(0,80)}`);
    
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: true }) };
    
  } catch (e) {
    console.error("respond-from-inbox erro", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
