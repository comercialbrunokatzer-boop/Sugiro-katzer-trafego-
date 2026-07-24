/**
 * Mídia honesta — não mentir pro cliente; pedir à equipe; salvar no acervo.
 * Envio NATIVO (nunca encaminhar): texto + foto/vídeo como se a Helena tivesse
 * escrito e gravado. Lógica pura (testável sem rede).
 */

"use strict";

const { resolverMidia, resolverPlanta, extrairFinalAndar } = require("./midia.js");

/** Temas/tags que a Helena deve lembrar ao salvar. */
const TEMAS_ACERVO = [
  "vista", "fachada", "lazer", "piscina", "planta", "video", "tour",
  "capa", "kids", "academia", "gourmet", "local", "obra", "interior",
];

/** Acima disso, texto vai em mensagem separada + mídia sem legenda (mais humano). */
const LIMITE_LEGENDA_CURTA = 140;

/**
 * O catálogo consegue entregar esta mídia agora?
 * @returns {{ ok: boolean, motivo?: string }}
 */
function midiaDisponivel(catalogo, produto, tipo, arg = null) {
  if (!catalogo || !produto || !tipo) {
    return { ok: false, motivo: "parametro_invalido" };
  }
  const p = catalogo[produto];
  if (!p) return { ok: false, motivo: "produto_sem_entrada" };

  if (tipo === "local") {
    return p.local ? { ok: true } : { ok: false, motivo: "sem_local" };
  }
  if (tipo === "anuncio") {
    const va = p.videoAnuncio || {};
    const lang = String(arg || "").toLowerCase();
    const ok = !!(va[lang] || va.es || va.en);
    return ok ? { ok: true } : { ok: false, motivo: "sem_video_anuncio" };
  }
  if (tipo === "video" && arg) {
    const vf = p.videosFinais || {};
    const finalKey = /^\d{2}$/.test(String(arg)) ? String(arg) : (extrairFinalAndar(arg) || {}).final;
    if (finalKey && vf[finalKey]) return { ok: true };
    // cai no video geral
  }
  if (tipo === "lazer" && arg) {
    const temas = p.lazerTemas || {};
    if (temas[String(arg).toLowerCase()]) return { ok: true };
    // cai no lazer geral
  }
  if (tipo === "planta") {
    const url = resolverPlanta(p.plantas, arg);
    return url ? { ok: true } : { ok: false, motivo: "planta_sem_match" };
  }
  if (tipo === "fotos" && arg === "mais") {
    const midia = resolverMidia(catalogo, produto, "fotos");
    if (!midia || midia.urls.length <= 2) {
      return { ok: false, motivo: "sem_mais_fotos" };
    }
    return { ok: true };
  }
  const midia = resolverMidia(catalogo, produto, tipo);
  if (!midia) return { ok: false, motivo: "sem_midia_no_catalogo" };
  return { ok: true };
}

/**
 * Remove do texto promessas de envio ("olha o video", "te mandei", etc.)
 * quando a mídia NÃO vai sair. Deixa vazio se só havia a promessa.
 */
function sanitizarTextoSemMidia(texto = "") {
  let t = String(texto || "");
  // frases típicas de "já enviei / olha aqui"
  t = t.replace(
    /\b(olha|veja|segue|te enviei|já enviei|ja enviei|te mandei|já mandei|ja mandei|mandeí|mandei|to te mandando|tô te mandando|estou te mandando)[^.!?\n]*[.!?]?/gi,
    "",
  );
  t = t.replace(/\b(aqui (o|a|o link do|o vídeo|o video|a foto|as fotos))[^.!?\n]*[.!?]?/gi, "");
  t = t.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return t;
}

/** Mensagem curta ao cliente ENQUANTO pede à equipe (opcional). */
function fraseEsperaCliente(nome = "") {
  const n = String(nome || "").trim().split(/\s+/)[0];
  if (n) return `${n}, já te trago isso certinho — um minutinho.`;
  return "Já te trago isso certinho — um minutinho.";
}

/**
 * Texto do pedido pra Bruno/Carol/Michel.
 * Destaca: envio NATIVO (não encaminhar) + texto comercial vira fala da Helena + memória.
 */
function montarPedidoMidiaEquipe({
  nomeCliente = "",
  clientPhone = "",
  produto = "",
  tipo = "",
  arg = null,
  tema = "",
  motivo = "",
} = {}) {
  const quem = nomeCliente || clientPhone || "cliente";
  const detalhe = [tipo, arg, tema].filter(Boolean).join(" · ");
  return [
    "📎 *HELENA · FALTA MÍDIA*",
    `Cliente: *${quem}*`,
    `Produto: *${produto || "—"}*`,
    `Pediu: *${detalhe || "mídia"}*`,
    motivo ? `Motivo: ${motivo}` : "",
    "",
    "Eu *não* falei pro cliente que mandei (não tenho no acervo).",
    "",
    "*Como me ensinar (sem encaminhar):*",
    "1) Escreve o texto que *eu* vou dizer pro cliente (na legenda *ou* numa mensagem antes).",
    "   Ex.: _Claro Sr. João, separei um vídeo especial pra você ver essa vista…_",
    "2) Manda a *foto/vídeo* pra mim (pode marcar *manda pro cliente*).",
    "",
    "Eu mando *como se eu tivesse escrito e gravado* (envio nativo — *não* encaminho).",
    "Guardo o texto + a mídia no acervo: da próxima vez eu já uso sozinha.",
    clientPhone ? `Lead: ${clientPhone}` : "",
  ].filter(Boolean).join("\n");
}

/** Detecta intenção de repassar mídia ao lead (legenda ou comando). */
function ehComandoRepasseMidia(caption = "") {
  return /manda\s+pro\s+cliente|envia\s+pro\s+cliente|repassa|pro\s+lead|manda\s+pra\s+ele|manda\s+pra\s+ela/i.test(
    String(caption || ""),
  );
}

/**
 * Limpa comandos de admin / telefone da legenda, deixando só o texto comercial
 * que a Helena deve “escrever” pro cliente.
 */
function limparLegendaAdmin(caption = "") {
  let t = String(caption || "");
  t = t
    .replace(/manda\s+pro\s+cliente/gi, "")
    .replace(/envia\s+pro\s+cliente/gi, "")
    .replace(/\brepassa\b/gi, "")
    .replace(/\bpro\s+lead\b/gi, "")
    .replace(/manda\s+pra\s+(ele|ela)\b/gi, "")
    .replace(/\+?\d{10,13}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t;
}

/** Pergunta-chave pra memória regenerativa (quando o cliente pedir de novo). */
function montarPerguntaMemoriaMidia({ produto = "", tipo = "", arg = null } = {}) {
  const detalhe = [tipo, arg].filter(Boolean).join(" ");
  const prod = produto || "o empreendimento";
  if (/vista/i.test(String(arg || "")) || /vista/i.test(String(tipo || ""))) {
    return `Cliente pediu vídeo/foto da vista de ${prod}`;
  }
  if (tipo === "video") return `Cliente pediu o vídeo de ${prod}${arg ? ` (${arg})` : ""}`;
  if (tipo === "lazer") return `Cliente pediu fotos do lazer de ${prod}${arg ? ` (${arg})` : ""}`;
  if (tipo === "planta") return `Cliente pediu a planta de ${prod}${arg ? ` unidade ${arg}` : ""}`;
  if (tipo === "fotos") return `Cliente pediu fotos de ${prod}`;
  return `Cliente pediu ${detalhe || "mídia"} de ${prod}`;
}

/**
 * Plano de envio NATIVO (nunca forward):
 * - texto longo → mensagem de texto + mídia sem caption
 * - texto curto → caption na mídia
 * - sem texto → só mídia
 */
function planoEnvioNativo({ texto = "", isVideo = false } = {}) {
  const t = String(texto || "").trim();
  if (!t) {
    return { textoSeparado: "", captionMidia: "", soMidia: true, isVideo: !!isVideo };
  }
  if (t.length > LIMITE_LEGENDA_CURTA || /\n/.test(t)) {
    return { textoSeparado: t, captionMidia: "", soMidia: false, isVideo: !!isVideo };
  }
  return { textoSeparado: "", captionMidia: t, soMidia: false, isVideo: !!isVideo };
}

function chaveLegendaAcervo(produto, tipo, arg = null) {
  return [String(produto || "").toLowerCase(), String(tipo || "").toLowerCase(), String(arg || "").toLowerCase()]
    .join(":");
}

/** Guarda legenda comercial no Map (runtime). Retorna se salvou. */
function guardarLegendaAcervo(mapa, { produto, tipo, arg = null, caption = "" } = {}) {
  const t = String(caption || "").trim();
  if (!mapa || !produto || !tipo || t.length < 12) return false;
  mapa.set(chaveLegendaAcervo(produto, tipo, arg), t);
  // também salva sem arg (fallback genérico do tipo)
  if (arg) mapa.set(chaveLegendaAcervo(produto, tipo, null), t);
  return true;
}

/** Busca legenda aprendida (específica → genérica do tipo). */
function obterLegendaAcervo(mapa, produto, tipo, arg = null) {
  if (!mapa || !produto || !tipo) return "";
  return mapa.get(chaveLegendaAcervo(produto, tipo, arg))
    || mapa.get(chaveLegendaAcervo(produto, tipo, null))
    || "";
}

/**
 * Inferência de tags pro acervo a partir de produto/tipo/arg/caption.
 */
function inferirTagsAcervo({ produto = "", tipo = "", arg = "", caption = "" } = {}) {
  const blob = `${produto} ${tipo} ${arg} ${caption}`.toLowerCase();
  const tags = new Set();
  if (produto) tags.add(String(produto).toLowerCase());
  if (tipo) tags.add(String(tipo).toLowerCase());
  if (arg) tags.add(String(arg).toLowerCase());
  for (const t of TEMAS_ACERVO) {
    if (blob.includes(t)) tags.add(t);
  }
  if (/fachada|torre|a[eé]reo|aereo/.test(blob)) tags.add("fachada");
  if (/vista|mar|frente/.test(blob)) tags.add("vista");
  if (/lazer|piscina|deck|kids|academia/.test(blob)) tags.add("lazer");
  if (/planta|final|suite|su[ií]te/.test(blob)) tags.add("planta");
  return [...tags];
}

/**
 * Registro pra Firebase / memória de acervo.
 */
function montarRegistroAcervo({
  produto,
  tipo,
  arg = null,
  url,
  isVideo = false,
  caption = "",
  aprovadoPor = "Bruno",
  ts = Date.now(),
} = {}) {
  const tags = inferirTagsAcervo({ produto, tipo, arg, caption });
  return {
    id: `acervo_${ts}_${String(produto || "x")}_${String(tipo || "x")}`,
    produto: produto || null,
    tipo: tipo || (isVideo ? "video" : "fotos"),
    arg: arg || null,
    url,
    isVideo: !!isVideo,
    caption: (caption || "").slice(0, 500),
    tags,
    aprovadoPor,
    ts,
  };
}

/**
 * Aplica um registro de acervo no objeto catálogo em memória (mutação controlada).
 * Não grava disco — só runtime + o caller persiste no Firebase.
 */
function aplicarAcervoNoCatalogo(catalogo, registro) {
  if (!catalogo || !registro || !registro.produto || !registro.url) {
    return { ok: false, motivo: "incompleto" };
  }
  const chave = registro.produto;
  if (!catalogo[chave]) catalogo[chave] = { fotos: [], video: null };
  const entry = catalogo[chave];
  const tipo = registro.tipo || (registro.isVideo ? "video" : "fotos");

  if (tipo === "video" || registro.isVideo) {
    if (!entry.video) entry.video = registro.url;
    else if (registro.arg && /^\d{2}$/.test(String(registro.arg))) {
      entry.videosFinais = entry.videosFinais || {};
      entry.videosFinais[registro.arg] = registro.url;
    }
    return { ok: true, aplicado: "video" };
  }
  if (tipo === "capa") {
    entry.capa = registro.url;
    return { ok: true, aplicado: "capa" };
  }
  if (tipo === "lazer") {
    entry.lazer = entry.lazer || [];
    if (Array.isArray(entry.lazer)) {
      if (!entry.lazer.includes(registro.url)) entry.lazer.push(registro.url);
    }
    if (registro.arg) {
      entry.lazerTemas = entry.lazerTemas || {};
      entry.lazerTemas[String(registro.arg).toLowerCase()] = registro.url;
    }
    return { ok: true, aplicado: "lazer" };
  }
  // default: fotos
  entry.fotos = Array.isArray(entry.fotos) ? entry.fotos : [];
  if (!entry.fotos.includes(registro.url)) entry.fotos.unshift(registro.url);
  return { ok: true, aplicado: "fotos" };
}

module.exports = {
  TEMAS_ACERVO,
  LIMITE_LEGENDA_CURTA,
  midiaDisponivel,
  sanitizarTextoSemMidia,
  fraseEsperaCliente,
  montarPedidoMidiaEquipe,
  ehComandoRepasseMidia,
  limparLegendaAdmin,
  montarPerguntaMemoriaMidia,
  planoEnvioNativo,
  chaveLegendaAcervo,
  guardarLegendaAcervo,
  obterLegendaAcervo,
  inferirTagsAcervo,
  montarRegistroAcervo,
  aplicarAcervoNoCatalogo,
};
