// =====================================================================
// ESCALADA TÉCNICA / SENSÍVEL — módulo puro e testável
// =====================================================================
// A Helena emite o marcador [ESCALA:tecnico] quando o lead pergunta algo
// técnico/sensível que ela NÃO deve responder o mérito (ex.: atraso, prazo,
// reputação, confiabilidade, histórico do Grupo Estrutura). O helena.js
// intercepta: manda 1 frase-ponte com o nome do cliente ("meu diretor"),
// alerta o Bruno e fica muda até /devolver.
//
// Versão SIMPLES (sem timer de 5 min): frase NA HORA + modo humano até /devolver.
// =====================================================================

const RX_ESCALA = /\[\s*ESCALA\s*:\s*([a-z_]+)\s*\]/i;

// Detecta e remove o marcador [ESCALA:motivo] do texto.
// Retorna { escala: bool, motivo: string|null, textoLimpo: string }.
function parseMarcadorEscala(texto) {
  const t = typeof texto === "string" ? texto : "";
  const m = t.match(RX_ESCALA);
  if (!m) return { escala: false, motivo: null, textoLimpo: t };
  const motivo = (m[1] || "tecnico").toLowerCase();
  const textoLimpo = t.replace(RX_ESCALA, "").replace(/\n{3,}/g, "\n\n").trim();
  return { escala: true, motivo, textoLimpo };
}

// Monta a frase-ponte de escalada. SEMPRE cita o nome do cliente,
// NUNCA cita "Bruno" (usa "meu diretor").
function montarFraseEscala(nomeCliente) {
  const primeiro = (nomeCliente || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeiro ? `Olha ${primeiro}` : "Olha";
  return `${saudacao}, essa parte técnica é com o meu diretor — vou passar pra ele e já te retorno, pra não te deixar com dúvida, tá bem?`;
}

module.exports = { parseMarcadorEscala, montarFraseEscala };
