// Netlify Function: inbox-list
// Endpoint: /.netlify/functions/inbox-list
// Lê /helena_inbox via Firebase Admin SDK (service account)
// O painel chama esse endpoint a cada 4s pra atualizar a lista

const admin = require('firebase-admin');

// Inicializa Firebase Admin uma vez (warm container reaproveita)
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  
  if (!admin.apps.length) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "firebase-admin não inicializado" }) };
  }
  
  try {
    const snap = await admin.database().ref('helena_inbox').once('value');
    const data = snap.val() || {};
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (e) {
    console.error("inbox-list erro", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
