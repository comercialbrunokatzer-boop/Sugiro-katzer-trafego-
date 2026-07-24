// =====================================================================
// IDIOMA-CAMPANHA — decide o idioma de ABERTURA pela AUDIÊNCIA da campanha
// =====================================================================
// Lógica PURA (testável). NÃO muda comportamento sozinha — só decide.
//
// Regra do CEO: o idioma sai da NACIONALIDADE do público-alvo escrito no
// NOME da campanha/negócio — NUNCA da geografia do imóvel nem do DDD/país
// do telefone (o cliente pode ter telefone de outro país).
//
// Duas camadas, nesta ordem:
//   1) NACIONALIDADE do público (BRASILEIROS, AMERICANOS, ESPANHÓIS...) -> vence sempre.
//   2) PRAÇA/lugar do anúncio (Miami/EUA -> inglês; Espanha -> espanhol) -> só se
//      não houver nacionalidade explícita.
// Nome do empreendimento (Fort Myers = prédio da Vetter em Penha/SC) é ignorado.
//
//   Ex.: "LEAD PATROC. FORT M. EUA BRASILEIROS" -> pt  (BRASILEIROS vence o "EUA")
//   Ex.: "LEAD PATROC. Fort M. Miami"           -> en  (só a praça Miami/EUA, sem nacionalidade)
//   Ex.: "FORTMYERS/ESPANHA"                     -> es
//   Ex.: "... AMERICANOS"                        -> en
//
// Retorna { code, nome } ou null.
// null = sem sinal de campanha -> a Helena espelha o idioma do cliente
// (comportamento padrão). E MESMO com idioma de campanha, se o cliente
// escrever noutra língua, a Helena adapta (a fiação no prompt cuida disso).
// =====================================================================

function semAcento(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Ordem IMPORTA: a NACIONALIDADE do público (TIER 1) SEMPRE vence a praça/lugar
// (TIER 2). Por isso "EUA BRASILEIROS" -> pt, mas "Fort M. Miami" (sem
// nacionalidade) -> en. "LATINO"/"SUL-AMERICANO" vem antes de "AMERICAN"
// pra não virar inglês. Nomes de empreendimento (Fort Myers, Grant Home,
// Punta Cana...) não contêm nenhum destes tokens, então são ignorados.
const REGRAS = [
  // ---- TIER 1: nacionalidade do PÚBLICO buscado (sobrepõe a praça) ----
  // SUL-AMERICANO antes de AMERICAN: hífen cria fronteira e "AMERICANOS" sozinho
  // casaria EN (bug #91 — campanha sul-americana abria em inglês).
  { code: "es", nome: "espanhol",             re: /\bSUL[- ]?AMERICAN[OA]?S?\b|\bSULAMERICAN[OA]?S?\b/ },
  { code: "es", nome: "espanhol",             re: /\bLATIN[OA]?S?\b|LATINO-?AMERICAN/ },
  { code: "pt", nome: "português (Brasil)",   re: /\bBRASILEIR[OA]S?\b/ },
  { code: "en", nome: "inglês",               re: /\bAMERICAN[OA]?S?\b/ },
  { code: "es", nome: "espanhol",             re: /\bESPANH|\bESPANOL|\bHISPAN|\bARGENTIN|\bMEXICAN|\bCHILEN|\bCOLOMBIAN|\bURUGUAI/ },
  { code: "it", nome: "italiano",             re: /\bITALIAN[OA]?S?\b/ },
  { code: "fr", nome: "francês",              re: /\bFRANCES(ES)?\b|\bFRANCAIS\b/ },
  { code: "de", nome: "alemão",               re: /\bALEMA[EOS]{1,2}\b|\bGERMANS?\b/ },
  { code: "pt", nome: "português",            re: /\bPORTUGUES(ES)?\b/ },
  { code: "pt", nome: "português (Brasil)",   re: /\bBRASIL\b/ },
  // ---- TIER 2: praça/lugar onde o anúncio rodou (só se não houver nacionalidade) ----
  { code: "en", nome: "inglês (americano)",   re: /\bEUA\b|\bUSA\b|\bESTADOS UNIDOS\b|\bMIAMI\b|\bORLANDO\b|\bFLORIDA\b|\bNEW ?YORK\b|\bNY\b/ },
  { code: "es", nome: "espanhol",             re: /\bESPANHA\b|\bMADRI|\bBARCELONA\b|\bMEXICO\b/ },
  { code: "it", nome: "italiano",             re: /\bITALIA\b|\bROMA\b|\bMILAO\b/ },
  { code: "fr", nome: "francês",              re: /\bFRANCA\b|\bFRANCE\b|\bPARIS\b/ },
  { code: "de", nome: "alemão",               re: /\bALEMANHA\b|\bBERLIM\b/ },
  { code: "pt", nome: "português (Portugal)", re: /\bPORTUGAL\b/ },
];

/**
 * @param {string} campanha nome da campanha/negócio (ex.: da leadData.campanha)
 * @returns {{code:string, nome:string}|null}
 */
function idiomaDeCampanha(campanha) {
  const s = semAcento(campanha).toUpperCase();
  if (!s.trim()) return null;
  for (const r of REGRAS) if (r.re.test(s)) return { code: r.code, nome: r.nome };
  return null;
}

module.exports = { idiomaDeCampanha };
