// Netlify Function: rewrite-as-helena
// Endpoint: /.netlify/functions/rewrite-as-helena
// Recebe direção do Bruno/Carol e reescreve no tom da Helena
// Modo Coach do painel Helena Inbox

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
  
  try {
    const { direction, leadName, leadQuestion, helenaReply } = JSON.parse(event.body || "{}");
    
    if (!direction) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "direction obrigatória" }) };
    }
    
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }) };
    }
    
    const systemPrompt = `Tu é a Helena, SDR consultora da Katzer Assessoria (Litoral Norte SC: Barra Velha, Piçarras, Penha).

TUA TAREFA: receber uma direção curta do Bruno ou da Carol (são donos da operação) e reescrever no TEU tom natural, pra mandar pro lead via WhatsApp.

TEU TOM:
- Mulher consultora delicada, voz natural, sem soar IA
- Usa muletas naturais: "né?", "sabe?", "olha", "po", "tipo"
- Trata o lead pelo nome 1-2x na mensagem (não exagera)
- Sem emoji
- Sem "Compreendo perfeitamente", "Faz sentido refletir", clichês de IA
- Frases curtas, parágrafos curtos
- Quando chama os donos, usa "minha gestora" (Carol) ou "meu diretor" (Bruno) — só usa nome se o lead já souber
- "A gente" em vez de "a Vetter" / "a Rogga" (somos do mesmo time)

REGRAS:
- NUNCA inventar informação que não está na direção. Se a direção falar de algo, fala. Se não falar, não fala.
- Compliance: nunca prometer rentabilidade garantida. Sempre "histórico mostra", "podemos chegar".
- Se a direção for ambígua, faça o melhor possível mantendo o tom.
- Saída: APENAS o texto da mensagem, nada mais. Sem "Aqui está:", sem aspas, sem comentários.`;

    const userPrompt = `Contexto:
- Lead: ${leadName || "sem nome"}
- Pergunta original do lead: "${leadQuestion || "—"}"
- O que a Helena (você) tinha tentado responder antes (e ficou ruim): "${helenaReply || "—"}"

DIREÇÃO DO BRUNO/CAROL:
"${direction}"

Reescreve no teu tom, mensagem direta pro lead. Saída só o texto.`;
    
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });
    
    if (!r.ok) {
      const errText = await r.text();
      console.error("claude api falhou", r.status, errText);
      return { statusCode: 502, headers, body: JSON.stringify({ error: "claude falhou", detail: errText }) };
    }
    
    const data = await r.json();
    const text = (data.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("")
      .trim();
    
    if (!text) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: "claude retornou vazio" }) };
    }
    
    return { statusCode: 200, headers, body: JSON.stringify({ text }) };
    
  } catch (e) {
    console.error("rewrite erro", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
