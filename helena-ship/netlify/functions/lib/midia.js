// =====================================================================
// MÍDIA NATIVA — foto / vídeo / planta no WhatsApp (lógica pura)
// =====================================================================
// A Helena emite um marcador no fim da resposta, ex.: [MIDIA:fort_myers:video]
// Para PLANTA, o marcador leva a UNIDADE: [MIDIA:fort_myers:planta:604]
// O código detecta, REMOVE do texto e dispara a mídia nativa do catálogo.
//
// Aqui só a LÓGICA (parser + resolver + validador). O envio via Z-API e o
// catálogo com URLs reais ficam no helena.js / lib/midia-catalogo.js.
// =====================================================================

const TIPOS_MIDIA = ["fotos", "video", "planta", "lazer", "capa"];

// Extrai o PRIMEIRO marcador [MIDIA:produto:tipo(:arg)?] e devolve o texto SEM
// nenhum marcador. { produto, tipo, arg, textoLimpo }.
// arg = unidade/apto (só usado por planta), ex.: [MIDIA:fort_myers:planta:604].
function parseMarcadorMidia(text) {
  if (!text || typeof text !== "string") {
    return { produto: null, tipo: null, arg: null, textoLimpo: text };
  }
  const acha = /\[MIDIA:\s*([a-z0-9_]+)\s*:\s*([a-z]+)\s*(?::\s*([a-z0-9]+)\s*)?\]/i;
  const m = text.match(acha);
  const textoLimpo = text
    .replace(/\[MIDIA:\s*[a-z0-9_]+\s*:\s*[a-z]+\s*(?::\s*[a-z0-9]+\s*)?\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!m) return { produto: null, tipo: null, arg: null, textoLimpo };
  return {
    produto: m[1].toLowerCase(),
    tipo: m[2].toLowerCase(),
    arg: m[3] ? m[3].toLowerCase() : null,
    textoLimpo
  };
}

// Resolve fotos/video/lazer no catálogo. Retorna { tipo, urls: [...] } ou null.
// (planta NÃO passa por aqui — usa resolverPlanta, que depende da unidade.)
function resolverMidia(catalogo, produto, tipo) {
  if (!catalogo || !produto || !tipo) return null;
  if (tipo !== "fotos" && tipo !== "video" && tipo !== "lazer" && tipo !== "capa") return null;
  const p = catalogo[produto];
  if (!p) return null;
  const val = p[tipo];
  if (!val) return null;
  const urls = (Array.isArray(val) ? val : [val]).filter(Boolean);
  if (!urls.length) return null;
  return { tipo, urls };
}

// Extrai { final, andar } de uma unidade (ex.: "604" -> {final:"04", andar:6};
// "3201" -> {final:"01", andar:32}). Retorna null se não der pra ler.
function extrairFinalAndar(unidade) {
  const u = String(unidade == null ? "" : unidade).replace(/\D/g, "");
  if (u.length < 3) return null; // precisa de pelo menos 1 dígito de andar + 2 de final
  const final = u.slice(-2);
  const andar = parseInt(u.slice(0, -2), 10);
  if (!Number.isFinite(andar)) return null;
  return { final, andar };
}

/** Tipologia pedida sem apto: "3s", "2s", "3suites", "2 suítes". */
function parseTipologiaSuites(arg) {
  const s = String(arg == null ? "" : arg).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!s) return null;
  // 3s / 2s / 03s
  let m = s.match(/^(\d)\s*s$/i);
  if (m) return Number(m[1]);
  m = s.match(/(\d)\s*(?:suites?|quartos?|dormitorios?|bedrooms?)/i);
  if (m) return Number(m[1]);
  m = s.match(/(?:tres|três|three)\s*(?:suites?|quartos?)/i);
  if (m) return 3;
  m = s.match(/(?:duas|dois|two)\s*(?:suites?|quartos?)/i);
  if (m) return 2;
  return null;
}

/**
 * Planta por tipologia (2s/3s) — usa arquivo do catálogo que contém "Nsuites" no nome.
 * Preferência: planta-tipo (andar médio) > diferenciado/sky > qualquer.
 */
function resolverPlantaPorTipologia(cfg, suites) {
  if (!cfg || !suites) return null;
  const base = cfg.base || "";
  const rx = new RegExp(`${suites}\\s*suites?`, "i");
  const regras = [...(cfg.regras || [])];
  const score = (arq) => {
    if (!rx.test(arq || "")) return -1;
    if (/tipo/i.test(arq)) return 30;
    if (/diferenciado/i.test(arq)) return 20;
    if (/sky/i.test(arq)) return 15;
    if (/beachhouse|cobertura/i.test(arq)) return 10;
    return 5;
  };
  let best = null;
  let bestScore = -1;
  for (const r of regras) {
    const sc = score(r.arq);
    if (sc > bestScore) {
      bestScore = sc;
      best = r.arq;
    }
  }
  for (const arq of Object.values(cfg.exatas || {})) {
    const sc = score(arq);
    if (sc > bestScore) {
      bestScore = sc;
      best = arq;
    }
  }
  return best ? base + best : null;
}

// Resolve a PLANTA: unidade (604) OU tipologia (3s / 2 suítes) OU fallback tipo.
// cfg = catalogo[produto].plantas:
//   { base, exatas:{unidade:arq}, regras:[{final,andarMin,andarMax,arq}] }
// Retorna URL ou null (null => não inventa planta errada).
function resolverPlanta(cfg, unidade) {
  if (!cfg) return null;
  const raw = String(unidade == null ? "" : unidade).trim();
  const base = cfg.base || "";

  // Tipologia sem apto (bug Leandro: arg "3s" → planta_sem_match indevido)
  const suites = parseTipologiaSuites(raw);
  if (suites) {
    const byTipo = resolverPlantaPorTipologia(cfg, suites);
    if (byTipo) return byTipo;
  }

  const u = raw.replace(/\D/g, "");
  if (!u) {
    // Pedido genérico "planta": primeira planta-tipo do catálogo
    const tipo = (cfg.regras || []).find((r) => /tipo/i.test(r.arq || ""));
    if (tipo) return base + tipo.arq;
    if ((cfg.regras || [])[0]) return base + cfg.regras[0].arq;
    const firstExata = Object.values(cfg.exatas || {})[0];
    return firstExata ? base + firstExata : null;
  }
  // 1) match exato (BeachHouse/Cobertura têm apto específico)
  if (cfg.exatas && cfg.exatas[u]) return base + cfg.exatas[u];
  // 2) regra por final + faixa de andar
  const fa = extrairFinalAndar(u);
  if (!fa) return null;
  for (const r of (cfg.regras || [])) {
    if (r.final === fa.final && fa.andar >= r.andarMin && fa.andar <= r.andarMax) {
      return base + r.arq;
    }
  }
  return null;
}

// Valida o catálogo contra os produtos obrigatórios (regra de ouro da mídia).
// requeridos: tipos que cada produto DEVE ter (default: fotos+video).
function validarCatalogoMidia(catalogo, produtosObrigatorios, requeridos = ["fotos", "video"]) {
  const problemas = [];
  for (const prod of (produtosObrigatorios || [])) {
    if (!catalogo || !catalogo[prod]) {
      problemas.push({ produto: prod, campo: "_existencia", erro: `sem entrada de mídia` });
      continue;
    }
    for (const tipo of requeridos) {
      if (tipo === "planta") {
        const pl = catalogo[prod].plantas;
        if (!pl || !(pl.exatas || pl.regras)) problemas.push({ produto: prod, campo: "planta", erro: "falta planta" });
      } else if (!resolverMidia(catalogo, prod, tipo)) {
        problemas.push({ produto: prod, campo: tipo, erro: `falta ${tipo}` });
      }
    }
  }
  return { ok: problemas.length === 0, problemas };
}

module.exports = {
  TIPOS_MIDIA, parseMarcadorMidia, resolverMidia,
  extrairFinalAndar, parseTipologiaSuites, resolverPlantaPorTipologia,
  resolverPlanta, validarCatalogoMidia
};
