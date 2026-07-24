// =====================================================================
// Testes de IDIOMA-CAMPANHA (netlify/functions/lib/idioma-campanha.js)
// =====================================================================
// Regra: idioma sai da AUDIÊNCIA (nacionalidade) no nome da campanha,
// NUNCA da geografia do imóvel nem do telefone.

const { test } = require("node:test");
const assert = require("node:assert");
const { idiomaDeCampanha } = require("../netlify/functions/lib/idioma-campanha.js");

test("audiência BRASILEIROS vence a geografia EUA -> português", () => {
  const r = idiomaDeCampanha("LEAD PATROC. FORT M. EUA BRASILEIROS");
  assert.equal(r.code, "pt");
});

test("ESPANHA -> espanhol", () => {
  assert.equal(idiomaDeCampanha("FORTMYERS/ESPANHA").code, "es");
});

test("AMERICANOS -> inglês (mesmo com EUA no nome)", () => {
  assert.equal(idiomaDeCampanha("LEAD PATROC. FORT MYERS EUA AMERICANOS").code, "en");
});

test("acento em ESPANHÓIS é tratado", () => {
  assert.equal(idiomaDeCampanha("Fort Myers Espanhóis").code, "es");
});

test("ITALIANOS -> italiano", () => {
  assert.equal(idiomaDeCampanha("Campanha Italianos Litoral").code, "it");
});

test("praça Miami (sem nacionalidade) -> inglês", () => {
  assert.equal(idiomaDeCampanha("LEAD PATROC. Fort M. Miami").code, "en");
});

test("praça EUA (sem nacionalidade) -> inglês", () => {
  assert.equal(idiomaDeCampanha("FORT MYERS EUA").code, "en");
  assert.equal(idiomaDeCampanha("KTZ GRANT HOME TESTE EUA/EUROPA").code, "en");
});

test("nacionalidade sobrepõe a praça: EUA + BRASILEIROS -> português", () => {
  assert.equal(idiomaDeCampanha("LEAD PATROC. FORT M. EUA BRASILEIROS").code, "pt");
});

test("sem audiência e sem praça (só nome de prédio) -> null (espelha o cliente)", () => {
  assert.equal(idiomaDeCampanha("Patrocinado Corretor"), null);
  assert.equal(idiomaDeCampanha("Punta Cana Grant Home"), null);
});

test("LATINOS / SUL-AMERICANOS não vira inglês -> espanhol", () => {
  assert.equal(idiomaDeCampanha("Campanha Latinos Miami").code, "es");
  assert.equal(idiomaDeCampanha("CAMPANHA SUL-AMERICANOS").code, "es");
  assert.equal(idiomaDeCampanha("CAMPANHA SULAMERICANOS").code, "es");
  assert.equal(idiomaDeCampanha("Fort Myers Sul Americanos").code, "es");
  assert.notEqual(idiomaDeCampanha("CAMPANHA SUL-AMERICANOS").code, "en");
});

test("vazio / null / não-string -> null", () => {
  assert.equal(idiomaDeCampanha(""), null);
  assert.equal(idiomaDeCampanha(null), null);
  assert.equal(idiomaDeCampanha(undefined), null);
  assert.equal(idiomaDeCampanha(12345), null);
});
