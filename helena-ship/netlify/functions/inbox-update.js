// Netlify Function: inbox-update
// Endpoint: /.netlify/functions/inbox-update
// Atualiza um item do /helena_inbox via Firebase Admin SDK
// Recebe: { key, patch }
// Usado pra: marcar como "respondendo", "answered", "ignored"

const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  } catch (e) {
    console.error("firebase-admin init falhou:", e.message);
  }
}

exports.handler = async function(event) {
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
  
  if (!admin.apps.length) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "firebase-admin não inicializado" }) };
  }
  
  try {
    const { key, patch } = JSON.parse(event.body || "{}");
    
    if (!key || typeof key !== "string") {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "key obrigatória" }) };
    }
    if (!patch || typeof patch !== "object") {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "patch obrigatório" }) };
    }
    
    // Sanitizar: não permite alterar campos críticos via API pública
    const allowedFields = ["status", "assignedTo", "answeredBy", "answer", "mode", "respondedAt"];
    const safePatch = {};
    for (const k of Object.keys(patch)) {
      if (allowedFields.includes(k)) safePatch[k] = patch[k];
    }
    
    if (Object.keys(safePatch).length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "patch sem campos válidos" }) };
    }
    
    await admin.database().ref(`helena_inbox/${key}`).update(safePatch);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, applied: safePatch }) };
    
  } catch (e) {
    console.error("inbox-update erro", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
