// =====================================================================
// DOSSIÊ DO LEAD — lógica pura e testável (v7.2)
// =====================================================================
// Suporta 3 ajustes:
//  (1) enriquecer o alerta interno (produto + resumo + sugestão) e gerar um
//      dossiê durável (o helena.js salva no Firebase).
//  (2) Bruno pedir resumo de um lead e a Helena responder formatado.
//  (3) detectar eco do bot vs humano assumindo a linha (fromMe).
// Aqui SÓ lógica pura. Chamadas ao Claude/Firebase/Z-API ficam no helena.js.
// =====================================================================

// --- detecção de produto de interesse (heurística por palavra-chave) ---
const PRODUTOS_KEYWORDS = [
  { key: "Fort Myers", rx: /fort\s*myers|forte?\s*mye/i },
  { key: "Grant Home Club", rx: /grant\s*home|punta\s*cana|barra\s*view/i },
  { key: "Al Mare", rx: /al\s*mare|almare/i },
  { key: "Celebration", rx: /celebration|alicerce/i },
  { key: "Ora", rx: /\bora\b|ora by daxo/i },
  { key: "Tropicale", rx: /tropicale/i },
  { key: "Amanay", rx: /amanay/i },
  { key: "Personalite", rx: /personalite/i },
  { key: "Infinity Exclusive Home", rx: /infinity/i },
  { key: "Jardim da Costa", rx: /jardim\s*da\s*costa/i },
  { key: "Destin Beach", rx: /destin/i },
  { key: "Golden Beach", rx: /golden\s*beach|golden/i },
  { key: "Marítimo", rx: /mar[ií]timo/i },
  { key: "Zaya Home Resort", rx: /zaya/i }
];

function detectarProdutoInteresse(texto) {
  const t = String(texto || "");
  for (const p of PRODUTOS_KEYWORDS) if (p.rx.test(t)) return p.key;
  return null;
}

// --- sugestão sempre aponta pro Bruno (Carol de licença) ---------------
function montarSugestaoBruno(produto) {
  const p = produto && produto !== "a confirmar" ? `no ${produto}` : "no imóvel";
  return `Bruno, o cliente deu corda ${p} — sugiro você ligar ou chamar no WhatsApp pra puxar a reunião. (Carol está de licença.)`;
}

// --- dossiê heurístico (fallback quando o Claude falha) ----------------
function montarDossieHeuristico({ nome, mensagens } = {}) {
  const arr = Array.isArray(mensagens) ? mensagens : [];
  const textoTudo = arr.map(m => m.content || "").join(" ");
  const falasLead = arr.filter(m => m.role === "user").map(m => m.content || "").filter(Boolean);
  const ultimaFala = falasLead.length ? falasLead[falasLead.length - 1] : "";
  const produto = detectarProdutoInteresse(textoTudo) || "a confirmar";
  const resumoBase = falasLead.slice(-3).join(" | ").slice(0, 300) || "(sem falas registradas do lead)";
  return {
    produto,
    resumo: `Últimas falas do lead: ${resumoBase}`,
    sugestao: montarSugestaoBruno(produto),
    ultimaFala
  };
}

// --- prompt + parse pro dossiê via Claude ------------------------------
function montarPromptDossie({ nome, mensagens } = {}) {
  const linhas = (Array.isArray(mensagens) ? mensagens : [])
    .slice(-16)
    .map(m => `${m.role === "user" ? "LEAD" : "HELENA"}: ${m.content}`)
    .join("\n");
  return (
    "Você é um analista comercial. Resuma a conversa abaixo pro Bruno (dono da imobiliária). " +
    "Responda SÓ com um JSON compacto, nada além dele.\n" +
    'Formato: {"produto":"<empreendimento de maior interesse ou a confirmar>",' +
    '"resumo":"<2-3 frases: o que o lead quer, objeção, momento de compra>",' +
    '"sugestao":"<próximo passo objetivo pro Bruno, ex: ligar agora>"}\n' +
    `Lead: ${nome || "sem nome"}\nConversa:\n${linhas}`
  );
}

function parseDossieResposta(texto) {
  const t = String(texto || "");
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (o && (o.produto || o.resumo || o.sugestao)) {
      return {
        produto: o.produto || null,
        resumo: o.resumo || null,
        sugestao: o.sugestao || null
      };
    }
  } catch { /* ignora */ }
  return null;
}

// --- bloco de dossiê pra ANEXAR no alerta interno ----------------------
function formatarBlocoDossie(d) {
  const produto = (d && d.produto) || "a confirmar";
  const resumo = (d && d.resumo) || "(sem resumo)";
  const sugestao = (d && d.sugestao) || montarSugestaoBruno(produto);
  return `*🏠 Produto de interesse:* ${produto}\n` +
    `*📝 Resumo:* ${resumo}\n` +
    `*✅ Próximo passo:* ${sugestao}`;
}

// --- dossiê formatado pro admin (quando o Bruno pede) ------------------
function formatarDossieParaAdmin(d) {
  const nome = (d && d.nome) || "Lead sem nome";
  const tel = (d && d.telefone) || "s/ telefone";
  const produto = (d && d.produto) || "a confirmar";
  const resumo = (d && d.resumo) || "(sem resumo)";
  const sugestao = (d && d.sugestao) || montarSugestaoBruno(produto);
  return `📋 *Dossiê — ${nome}*\n` +
    `*Telefone:* ${tel}\n` +
    `*Produto:* ${produto}\n\n` +
    `*Resumo:* ${resumo}\n\n` +
    `*Próximo passo:* ${sugestao}`;
}

// --- Bruno pediu resumo? ----------------------------------------------
const GATILHOS_RESUMO = [
  "resumo", "resume", "resumir", "dossie", "dossiê",
  "me fala do", "me fala da", "me fala sobre", "me atualiza",
  "quem e o", "quem é o", "quem e a", "quem é a",
  "quem e esse", "quem é esse", "quem foi", "quem era",
  "me passa o resumo", "informacoes do", "informações do",
  "sobre o cliente", "sobre o lead", "historico do", "histórico do",
  "o que ele falou", "o que ela falou", "o que ele quer", "o que ela quer"
];
function ehPedidoDeResumo(texto) {
  const t = String(texto || "").toLowerCase();
  if (!t.trim()) return false;
  return GATILHOS_RESUMO.some(g => t.includes(g));
}

// --- resolve qual lead o admin quer -----------------------------------
// Retorna { tipo: "phone"|"nome"|"ultimo"|null, valor }.
function resolverAlvoResumo(texto, pendingHelpEntries) {
  const t = String(texto || "");
  const digits = t.replace(/[^\d]/g, "");
  if (digits.length >= 10) return { tipo: "phone", valor: digits };
  const mNome = t.match(/\b(?:do|da|de|sobre)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'’\s]{1,40})/i);
  if (mNome) {
    const nome = mNome[1].trim().replace(/\s+(por favor|pra mim|agora|ai|aí)$/i, "").trim();
    if (nome && !/^(cliente|lead|imovel|imóvel)$/i.test(nome)) return { tipo: "nome", valor: nome };
  }
  const entries = Array.isArray(pendingHelpEntries) ? pendingHelpEntries : [];
  if (entries.length) {
    const sorted = [...entries].sort((a, b) => (b[1] && b[1].ts || 0) - (a[1] && a[1].ts || 0));
    return { tipo: "ultimo", valor: sorted[0][0] };
  }
  return { tipo: null, valor: null };
}

// --- Ajuste 3: o texto do fromMe é eco do bot? ------------------------
function textoBateComUltima(texto, ultimaMsgHelena) {
  const norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const a = norm(texto), b = norm(ultimaMsgHelena);
  if (!a || !b) return false;
  if (a === b) return true;
  // o bot fatia mensagens longas: considera eco se um contém o outro (>=20 chars)
  if (a.length >= 20 && (b.includes(a) || a.includes(b))) return true;
  return false;
}

module.exports = {
  detectarProdutoInteresse,
  montarSugestaoBruno,
  montarDossieHeuristico,
  montarPromptDossie,
  parseDossieResposta,
  formatarBlocoDossie,
  formatarDossieParaAdmin,
  ehPedidoDeResumo,
  resolverAlvoResumo,
  textoBateComUltima
};
