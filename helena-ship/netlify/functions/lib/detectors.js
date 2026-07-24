// =====================================================================
// DETECTORES DE LEAD + HELPERS DE TELEFONE (extraído de helena.js)
// =====================================================================
// Funções puras que decidem o comportamento da Helena:
//  - normalizePhone / hashPhone / phoneInList (identidade + LGPD)
//  - detectTicketSize (valor mencionado → flag VIP)
//  - detectUrgency / detectFlertOrAbuse / detectTroll (classificação)
//  - detectInteractionType (first / comeback / ongoing)
//  - parseFacebookLead (payload Meta Ads → campos)
//
// Extraído para módulo próprio para permitir cobertura de testes.
// COMPORTAMENTO IDÊNTICO ao que estava inline no helena.js.
// =====================================================================

const crypto = require("crypto");

// --- Telefone ---------------------------------------------------------

function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

// LGPD: hash de telefone para uso em logs (8 chars hex).
// Mesmo numero sempre gera mesmo hash, permitindo correlacao entre eventos.
function hashPhone(phone) {
  if (!phone) return "[no-phone]";
  return "[" + crypto.createHash("sha256")
    .update(String(phone))
    .digest("hex")
    .slice(0, 8) + "]";
}

// Verifica se um telefone (normalizado) está numa lista (também normalizada).
function phoneInList(phone, list) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  return (list || []).some(b => normalizePhone(b) === normalized);
}

// Forma canônica de um telefone BR pra comparação tolerante: DDD (2) + últimos 8 dígitos.
// Absorve as duas variações que quebravam o reconhecimento do admin:
//   - com/sem código do país (55)
//   - com/sem o 9º dígito do celular (o Z-API às vezes entrega sem)
// Ex. (fictício): "5547999990000", "554799990000" e "47999990000" -> todos "4799990000".
function canonPhoneBR(phone) {
  let d = normalizePhone(phone);
  if (!d) return "";
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2); // tira país
  if (d.length >= 10) return d.slice(0, 2) + d.slice(-8);   // DDD + 8 finais
  return d;
}

// Comparação tolerante de telefones (usar SÓ para reconhecer admin/equipe - conjunto
// pequeno e conhecido; nunca para identidade de cliente). Casa mesmo com variação
// de 55/9º dígito. Retorna true se batem exatamente OU na forma canônica BR.
function mesmoTelefone(a, b) {
  const na = normalizePhone(a), nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ca = canonPhoneBR(na), cb = canonPhoneBR(nb);
  return !!ca && ca === cb;
}

// Versão tolerante do phoneInList (para listas de admin/equipe).
function phoneMatchesAny(phone, list) {
  if (!phone) return false;
  return (list || []).some(b => b && mesmoTelefone(phone, b));
}

// --- Parser de lead do Facebook / Meta Ads ----------------------------

function parseFacebookLead(text) {
  if (!text || typeof text !== "string") return null;

  // Aceita o formato real do formulário Meta ("Full name:", "Phone number:"
  // com espaço) além do formato com underline ("full_name:", "phone_number:").
  const isFromFacebook =
    /Preenchi seu formul[áa]rio/i.test(text) ||
    /full[_ ]?name:/i.test(text) ||
    /phone[_ ]?number:\s*\+?\d/i.test(text);

  if (!isFromFacebook) return null;

  const lead = { source: "facebook_ads", raw: text };

  const get = (regex) => {
    const m = text.match(regex);
    return m ? m[1].trim() : null;
  };

  lead.full_name = get(/full[_ ]?name:\s*([^\n]+)/i);
  lead.phone = get(/phone[_ ]?number:\s*([^\n]+)/i);
  lead.email = get(/email:\s*([^\n]+)/i);
  lead.cidade = get(/(?:em_qual_cidade_voc[eê]_deseja_investir|cidade)[^:]*:\s*([^\n]+)/i);
  lead.faixa = get(/(?:qual_faixa_de_investimento|faixa_de_investimento|faixa)[^:]*:\s*([^\n]+)/i);
  // "intenção" ou "objetivo" (o formulário real usa "objetivo")
  lead.intencao = get(/(?:qual_sua_inten[çc][ãa]o_de_compra|inten[çc][ãa]o|objetivo)[^:]*:\s*([^\n]+)/i);
  // prazo de compra ("Em quanto tempo você pretende comprar...")
  lead.prazo = get(/(?:em quanto tempo|quando[^:]*pretende|prazo)[^:]*:\s*([^\n]+)/i);

  return lead;
}

// Mapa ANÚNCIO -> EMPREENDIMENTO (extensível). CEO (19/07): cada campanha de uma
// região aponta pro imóvel daquela região. Frente-mar Penha = Fort Myers; frente-mar
// Barra Velha = Grant Home Club. Pra somar uma campanha nova, é só acrescentar aqui.
const MAPA_ANUNCIO = [
  {
    produto: "Fort Myers", chave: "fort_myers", regiao: "Penha",
    rx: [
      /frente\s*-?\s*mar[^.]{0,25}penha/i, /penha[^.]{0,25}frente\s*-?\s*mar/i,
      /praia\s+fortaleza/i, /fb\.me\/7aknb6as1/i, /\bfort\s*myers\b/i,
    ],
  },
  {
    produto: "Grant Home Club", chave: "grant", regiao: "Barra Velha",
    rx: [
      /frente\s*-?\s*mar[^.]{0,25}barra\s*velha/i, /barra\s*velha[^.]{0,25}frente\s*-?\s*mar/i,
      /\bgrant\s*home\b/i, /\bgrant\b/i,
    ],
  },
];

// Identifica o empreendimento a partir do anúncio de origem (referral/card do FB,
// texto da campanha ou link). Retorna { produto, chave, regiao } ou null.
function detectProdutoDoAnuncio(text) {
  if (!text || typeof text !== "string") return null;
  for (const m of MAPA_ANUNCIO) {
    if (m.rx.some((rx) => rx.test(text))) {
      return { produto: m.produto, chave: m.chave, regiao: m.regiao };
    }
  }
  return null;
}

// --- Detectores inteligentes ------------------------------------------

// Detecta valores monetarios mencionados pelo lead
function detectTicketSize(text) {
  if (!text) return null;
  // captura padroes "R$ 5M", "5 milhoes", "5kk", "500 mil"
  // IMPORTANTE: "milh\w*" cobre milhão/milhões/milhoes; as abreviações
  // (mi|mm|kk) exigem fronteira de palavra (\b) para NÃO casar dentro de
  // "mil" — senão "500 mil" seria lido como 500 milhões (bug corrigido).
  const patterns = [
    { rx: /(\d+[,.]?\d*)\s*(?:milh\w*|mi|mm|kk)\b/i, mult: 1000000 },
    { rx: /(\d+[,.]?\d*)\s*mil\b/i, mult: 1000 },
    { rx: /R\$\s*(\d+[,.]?\d*)\s*M/i, mult: 1000000 },
    { rx: /R\$\s*([\d.,]+)/i, mult: 1 }
  ];
  for (const p of patterns) {
    const m = text.match(p.rx);
    if (m) {
      const v = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(v)) return v * p.mult;
    }
  }
  return null;
}

// Detecta urgencia explicita
function detectUrgency(text) {
  if (!text) return false;
  return /\b(urgente|hoje|amanh[ãa]|essa semana|esse m[eê]s|fim do m[eê]s|preciso (?:comprar|fechar|decidir)|n[aã]o posso esperar|t[oô] correndo)\b/i.test(text);
}

// Detecta flerte / cantada / abuso.
// FLERTE = cantada DIRIGIDA À HELENA (nela). NAO confundir com elogio ao imovel:
// "que vista linda", "que delicia de lugar", "praia gostosa" -> NAO e flerte (é lead feliz).
// So marca flerte quando o elogio aponta pra ELA (voce/vc/tu/comigo) ou e cantada clara.
function detectFlertOrAbuse(text) {
  if (!text) return null;
  const flert =
    /\b(voc[eê]|vc|tu|c[eê])\s+(é|e|és|es|ta|tá|fica|ficou|parece)\s+(muito\s+|bem\s+|super\s+)?(linda|gata|gostosa|maravilhosa|perfeita|sexy|um\s+amor|uma\s+gata|tes[ãa]o)/i.test(text) ||
    /\b(linda|gata|gostosa|maravilhosa|sexy|gatinha|princesa|del[íi]cia)\s+(demais\s+)?(voc[eê]|vc|tu|hein|viu|mesmo|ein|n[ée])(?=[\s!?.,;]|$)/i.test(text) ||
    /\bque\s+(gata|gostosa|linda|del[íi]cia)\s+(voc[eê]|vc|é|es|tu|essa\s+atendente|hein)(?=[\s!?.,;]|$)/i.test(text) ||
    /(sair|jantar|encontro|um\s+caf[eé]|tomar\s+algo|rol[êe])\s+(comigo|com\s+voc[eê])/i.test(text) ||
    /\bcas(a|ar)\s+comigo\b|\bnamora(r)?\s+comigo\b|\bfica\s+comigo\b/i.test(text) ||
    /\bte\s+(amo|adoro|acho\s+linda|quero|desejo)\b/i.test(text) ||
    /\bquero\s+(te|voc[eê])\s+(ver|conhecer|beijar|pegar|encontrar|namorar)\b/i.test(text) ||
    /\b(seu|teu)\s+(zap|whats|n[uú]mero|telefone)\s+pessoal\b/i.test(text) ||
    /\bme\s+(d[aá]|passa)\s+(o\s+)?(seu|teu)\s+(zap|whats|n[uú]mero|telefone)/i.test(text);
  // (pergunta pessoal — "é casada?", "tem namorado?", "que idade?" — saiu daqui:
  //  virou categoria propria em detectPerguntaPessoal, que escala ja na 1a vez.)
  // Xingamento REAL. NAO usar padroes amplos: "sua [a-z]+" casava "sua intencao",
  // "sua cidade", "sua faixa" (incl. o rotulo do formulario Meta "qual sua intencao"),
  // e "vai" isolado casava "vai valorizar", "quando vai lancar". Isso fazia a Helena
  // hostilizar lead qualificado com a resposta enlatada. Agora so casa insulto de fato.
  const xingaPalavra = /\b(idiotas?|burr[oa]s?|imbecil|imbecis|ot[áa]ri[oa]s?|babacas?|arrombad[oa]s?|vagabund[oa]s?|escrot[oa]s?|corn[oa]s?|desgra[çc]ad[oa]s?|fdp|vtnc|vsf)\b/i;
  const xingaFrase = /(vai\s+(?:se\s+)?(?:fud|tomar\s+no|catar|a\s+merda|pra\s+(?:puta|pqp))|filh[oa]\s+da\s+puta|puta\s+que\s+(?:o\s+)?pariu|toma\s+no\s+c[uú]|cala\s+(?:a\s+)?boca)/i;
  const abuso = xingaPalavra.test(text) || xingaFrase.test(text);
  if (abuso) return "abuse";
  if (flert) return "flert";
  return null;
}

// Detecta PERGUNTA PESSOAL sobre a Helena (vida dela) — categoria SEPARADA da cantada.
// Ex.: "você é casada/solteira?", "tem namorado?", "onde você mora?", "quantos anos?",
// "você tem filhos?". Regra do CEO: já na 1a vez NÃO responde -> escala pro Bruno.
// Cuidado pra NAO pegar pergunta sobre o IMOVEL ("tem área pra filhos?"): exige que
// aponte pra ELA (voce/vc/tu) ou seja claramente sobre a pessoa.
function detectPerguntaPessoal(text) {
  if (!text) return false;
  return (
    /\b(voc[eê]|vc|tu)\s+(é|e|és|es|[ée]h)\s+(casad|solteir|comprometid|divorciad|viuv)/i.test(text) ||
    /\b(voc[eê]|vc|tu)\s+tem\s+(namorad|marido|esposa|filhos?|algu[ée]m)\b/i.test(text) ||
    /\btem\s+namorad[oa]\b/i.test(text) ||
    /\b(onde\s+(voc[eê]|vc|tu)\s+mora|voc[eê]\s+mora\s+onde|onde\s+(tu\s+)?mora)\b/i.test(text) ||
    /\b(quantos\s+anos\s+(voc[eê]|vc|tu)|que\s+idade\s+(voc[eê]|vc|tu|tem)|sua\s+idade)/i.test(text) ||
    /\bqual\s+(o\s+)?seu\s+(nome\s+completo|instagram|insta|face)\b/i.test(text)
  );
}

// Detecta troll / spam / mensagem absurda
function detectTroll(text) {
  if (!text) return false;
  // mensagem muito curta sem contexto + sem ser saudacao normal
  const tiny = text.trim().length < 3;
  // mensagem so com numeros aleatorios ou caracteres especiais
  const garbage = /^[\d\W_]{5,}$/.test(text.trim());
  // teste obvio
  const teste = /^\s*(teste|test|abc|asdf|qwerty|123|aaa)\s*$/i.test(text);
  return tiny || garbage || teste;
}

// Detecta primeira interacao vs follow-up.
// opts.staleLeadHours: limiar de "comeback" (default 24h, igual ao helena.js)
// opts.now: instante de referência em ms (default Date.now()), injetável em teste
function detectInteractionType(conv, text, opts = {}) {
  const staleLeadHours = opts.staleLeadHours != null ? opts.staleLeadHours : 24;
  const now = opts.now != null ? opts.now : Date.now();
  if (!conv || conv.messages.length <= 1) return "first";
  const msSinceLast = conv.lastUpdate ? (now - conv.lastUpdate) : 0;
  const horasSinceLast = msSinceLast / (1000 * 60 * 60);
  if (horasSinceLast > staleLeadHours) return "comeback";
  return "ongoing";
}

module.exports = {
  normalizePhone,
  hashPhone,
  phoneInList,
  canonPhoneBR,
  mesmoTelefone,
  phoneMatchesAny,
  parseFacebookLead,
  detectProdutoDoAnuncio,
  detectTicketSize,
  detectUrgency,
  detectFlertOrAbuse,
  detectPerguntaPessoal,
  detectTroll,
  detectInteractionType
};
