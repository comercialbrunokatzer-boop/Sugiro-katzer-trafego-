"use strict";

// ============================================================
// AI Provider Layer — Anthropic principal, OpenAI fallback
// ============================================================
// Interface pública:
//   callAI({ purpose, system, messages, maxTokens, timeoutMs, correlationId })
//   → { text: string, provider: "anthropic"|"openai", fallbackReason?: string }
//
// Política de fallback:
//   - Tenta Anthropic primeiro
//   - Classifica o erro por status HTTP e por tipo de exceção
//   - Se elegível (créditos, rate-limit, timeout, 5xx, auth),
//     aciona OpenAI automaticamente
//   - Se ambos falharem, lança erro descritivo para o chamador
//     tratar como "inbox humano"
//   - Mascaramento de dados sensíveis em todos os logs
//   - correlationId preservado em todos os registros (rastreabilidade)
//   - correlationId NÃO implementa idempotência/deduplicação
//     (responsabilidade da camada superior da Helena: mutex/messageId/locks)
// ============================================================

// Categorias de erro que autorizam fallback para o provider secundário
const FALLBACK_ELIGIBLE = new Set([
  "auth_error",    // 401, 403
  "no_credits",    // 402, 529
  "rate_limit",    // 429
  "timeout",       // AbortError / ECONNABORTED
  "server_error",  // 5xx
  "invalid_response", // resposta vazia ou malformada
]);

// Modelos OpenAI por tamanho da tarefa.
// TEMPORÁRIO: seleção por maxTokens.
// Próxima etapa: migrar seleção para `purpose` (ex.: whisper, helena_reply, classifier,
// pitch, secretaria), independente do tamanho de saída.
function selectOpenAIModel(maxTokens) {
  return maxTokens <= 300 ? "gpt-4o-mini" : "gpt-4o";
}

// Mascara padrões de chaves API nos logs (sk-..., ****** x-api-key)
function maskSensitiveData(str) {
  if (typeof str !== "string") return String(str || "");
  return str
    .replace(/\b(sk-[A-Za-z0-9]{3,4})[A-Za-z0-9_-]*/g, "$1***")
    .replace(/(Bearer\s+[A-Za-z0-9]{4})[A-Za-z0-9_.-]*/gi, "$1***")
    .replace(/(x-api-key["\s:]+[A-Za-z0-9]{4})[A-Za-z0-9_-]*/gi, "$1***");
}

// Classifica um erro de provider em categoria + elegibilidade para fallback.
// Usa status HTTP como fonte primária; keywords como fallback secundário.
function classifyAIError(err) {
  if (!err) return { eligible: false, category: "unknown", reason: "no_error" };

  // AbortError = timeout (AbortController disparou)
  if (err.name === "AbortError" || err.code === "ECONNABORTED") {
    return { eligible: true, category: "timeout", reason: "abort_error" };
  }

  const msg = typeof err.message === "string" ? err.message : "";

  // Extrai status HTTP da mensagem de erro formatada como "API erro NNN:"
  const statusMatch = msg.match(/\berro\s+(\d{3})\b/i) || msg.match(/\bstatus[:\s]+(\d{3})\b/i);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

  if (status === 401 || status === 403) return { eligible: true, category: "auth_error", reason: `http_${status}` };
  if (status === 402)                   return { eligible: true, category: "no_credits", reason: "http_402" };
  if (status === 429)                   return { eligible: true, category: "rate_limit", reason: "http_429" };
  if (status === 529)                   return { eligible: true, category: "no_credits", reason: "http_529_overloaded" };
  if (status >= 500 && status < 600)    return { eligible: true, category: "server_error", reason: `http_${status}` };

  // Keyword matching como fallback secundário
  if (/credit|saldo|insufficient|quota/i.test(msg))       return { eligible: true, category: "no_credits", reason: "msg_credits" };
  if (/rate.?limit|too.?many.?request/i.test(msg))        return { eligible: true, category: "rate_limit", reason: "msg_rate_limit" };
  if (/timeout|timed.?out|aborted/i.test(msg))            return { eligible: true, category: "timeout", reason: "msg_timeout" };
  if (/overload|service.?unavailable|unavailable/i.test(msg)) return { eligible: true, category: "server_error", reason: "msg_unavailable" };
  if (/invalid.?response|resposta.?vazia|empty.?response/i.test(msg)) return { eligible: true, category: "invalid_response", reason: "msg_invalid" };

  return { eligible: false, category: "client_error", reason: "non_eligible" };
}

// Chama a API Anthropic e retorna { text: string }
async function callAnthropic({ system, messages, maxTokens, timeoutMs, apiKey }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: maxTokens,
        system,
        messages
      }),
      signal: ctrl.signal
    });

    if (!r.ok) {
      const errBody = await r.text();
      throw new Error(`Claude API erro ${r.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    if (!text.trim()) throw new Error("Claude API: resposta vazia ou sem conteúdo de texto");
    return { text: text.trim() };
  } finally {
    clearTimeout(timer);
  }
}

// Chama a API OpenAI (chat completions) e normaliza para { text: string }
async function callOpenAI({ system, messages, maxTokens, timeoutMs, apiKey, model }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  // Converte formato Anthropic (system separado + messages) para OpenAI
  const openAIMessages = [
    { role: "system", content: system || "" },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: openAIMessages
      }),
      signal: ctrl.signal
    });

    if (!r.ok) {
      const errBody = await r.text();
      throw new Error(`OpenAI API erro ${r.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await r.json();
    const text = (data.choices?.[0]?.message?.content || "").trim();

    if (!text) throw new Error("OpenAI API: resposta vazia ou sem conteúdo");
    return { text };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Ponto de entrada público
// ============================================================
async function callAI({
  purpose = "default",
  system = "",
  messages = [],
  maxTokens = 800,
  timeoutMs = 24000,
  correlationId = ""
}) {
  const tag = correlationId ? `[AI:${correlationId}]` : "[AI]";
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    throw new Error("Nenhuma chave de IA configurada (ANTHROPIC_API_KEY e OPENAI_API_KEY ausentes)");
  }

  // ── Tenta Anthropic ──────────────────────────────────────
  if (anthropicKey) {
    try {
      const result = await callAnthropic({ system, messages, maxTokens, timeoutMs, apiKey: anthropicKey });
      console.log(`${tag} provider=anthropic purpose=${purpose} chars=${result.text.length}`);
      return { text: result.text, provider: "anthropic" };
    } catch (err) {
      const cls = classifyAIError(err);
      console.warn(
        `${tag} anthropic_failed category=${cls.category} reason=${cls.reason}` +
        ` eligible_fallback=${cls.eligible} msg=${maskSensitiveData(err.message || "")}`
      );

      if (!cls.eligible) {
        // Erro não elegível para fallback (ex.: 400 bad request do chamador)
        throw err;
      }

      if (!openaiKey) {
        throw new Error(
          `Anthropic falhou (${cls.reason}) e OPENAI_API_KEY não configurada — ambos os providers indisponíveis`
        );
      }

      // ── Fallback para OpenAI ─────────────────────────────
      const model = selectOpenAIModel(maxTokens);
      try {
        const result = await callOpenAI({ system, messages, maxTokens, timeoutMs, apiKey: openaiKey, model });
        console.log(
          `${tag} provider=openai model=${model} purpose=${purpose}` +
          ` fallback_reason=${cls.reason} chars=${result.text.length}`
        );
        return { text: result.text, provider: "openai", fallbackReason: cls.reason };
      } catch (openaiErr) {
        console.error(
          `${tag} openai_failed msg=${maskSensitiveData(openaiErr.message || "")}`
        );
        throw new Error(
          `Ambos os providers falharam. Anthropic: ${cls.reason}. OpenAI: ${maskSensitiveData(openaiErr.message || "erro")}`
        );
      }
    }
  }

  // ── Anthropic não configurado: usa OpenAI diretamente ────
  const model = selectOpenAIModel(maxTokens);
  try {
    const result = await callOpenAI({ system, messages, maxTokens, timeoutMs, apiKey: openaiKey, model });
    console.log(
      `${tag} provider=openai model=${model} purpose=${purpose}` +
      ` fallback_reason=no_anthropic_key chars=${result.text.length}`
    );
    return { text: result.text, provider: "openai", fallbackReason: "no_anthropic_key" };
  } catch (openaiErr) {
    throw new Error(`OpenAI falhou (sem Anthropic configurado): ${maskSensitiveData(openaiErr.message || "erro")}`);
  }
}

module.exports = { callAI, classifyAIError, maskSensitiveData, selectOpenAIModel };
