// =====================================================================
// MEMÓRIA APRENDIDA — "caderninho de respostas ensinadas"
// =====================================================================
// Lógica pura (testável) do aprendizado com aprovação humana:
//  - ehSim / ehNao: interpreta a confirmação do admin (SIM/NÃO)
//  - montarPerguntaConfirmacao: texto que a Helena manda pedindo permissão
//  - montarRegistroAprendido: monta o registro a ser salvo
//  - selecionarRelevantes: escolhe respostas aprendidas parecidas com a pergunta
//  - formatarMemoriaPromptSection: monta o trecho do prompt com o que ela aprendeu
//
// A GRAVAÇÃO/LEITURA no Firebase e o envio via Z-API ficam no helena.js.
// Aqui só a lógica — 100% coberta por testes.
// =====================================================================

// Remove acentos, baixa a caixa, tira pontuação das pontas
function normalizar(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Interpreta um "SIM" (guardar na memória)
function ehSim(text) {
  const t = normalizar(text);
  if (!t) return false;
  const exatos = new Set([
    "sim", "s", "isso", "isso ai", "pode", "pode sim", "guarda", "guardar",
    "salva", "salvar", "acrescenta", "acrescentar", "aprende", "aprender",
    "memoriza", "memorizar", "pode guardar", "pode salvar", "1"
  ]);
  if (exatos.has(t)) return true;
  return /^(sim|isso|pode|guarda|salva|acrescenta|aprende|memoriza)\b/.test(t);
}

// Interpreta um "NÃO" (só esse caso, não guarda)
function ehNao(text) {
  const t = normalizar(text);
  if (!t) return false;
  const exatos = new Set([
    "nao", "n", "so esse", "so esse caso", "somente esse", "apenas esse",
    "so essa", "descarta", "descartar", "esquece", "esquecer", "2"
  ]);
  if (exatos.has(t)) return true;
  return /^(nao|so esse|so essa|somente esse|apenas esse|descarta|esquece)\b/.test(t);
}

// Texto que a Helena manda pro admin pedindo permissão pra guardar
function montarPerguntaConfirmacao(pergunta) {
  const p = (pergunta || "").toString().trim();
  const preview = p
    ? `\n\nPergunta do cliente: "${p.slice(0, 140)}${p.length > 140 ? "..." : ""}"`
    : "";
  return (
    `Prontinho, chefe! ✅ Já mandei pro cliente.${preview}\n\n` +
    `Quer que eu guarde essa resposta pra responder sozinha quando aparecer um caso parecido? ` +
    `Manda SIM que eu guardo, ou NÃO se foi só pra esse cliente.`
  );
}

// Detecta um comando de ENSINO DIRETO do Bruno pelo WhatsApp e extrai o conteúdo.
// Ex.: "grava isso: X", "aprende que X", "anota aí: X", "/ensina X", "memoriza: X".
// Retorna { ensinar, conteudo }. Sem confirmação — o Bruno já mandou gravar.
const GATILHOS_ENSINO = [
  "ensina", "ensinar", "grava", "gravar", "guarda", "guardar", "aprende", "aprender",
  "anota", "anotar", "memoriza", "memorizar", "salva", "salvar", "lembra", "lembrar",
  "registra", "registrar"
];
function parseComandoEnsino(text) {
  const raw = (text || "").toString().trim();
  if (!raw) return { ensinar: false, conteudo: "" };
  // tira vocativo "Helena," / "ei helena" do começo
  const base = raw.replace(/^\s*(ei\s+|oi\s+)?helena[\s,:!-]+/i, "").trim() || raw;
  let gatilhoOk = false, resto = "";
  // 1) com barra: /ensina, /grava, /anota ...
  const comando = base.match(/^\/([a-zà-ú]+)\b[\s:.-]*([\s\S]*)$/i);
  if (comando && GATILHOS_ENSINO.includes(normalizar(comando[1]))) {
    gatilhoOk = true; resto = comando[2] || "";
  } else {
    // 2) linguagem natural: primeira palavra é um gatilho
    const primeira = normalizar(base).split(" ")[0];
    if (GATILHOS_ENSINO.includes(primeira)) {
      gatilhoOk = true;
      const idx = base.indexOf(":");
      if (idx >= 0) {
        resto = base.slice(idx + 1);
      } else {
        resto = base.split(/\s+/).slice(1).join(" ");
        resto = resto.replace(/^\s*(isso|ai|aí|que|disso|na mem[oó]ria|aqui)\b[\s,:.-]*/i, "");
      }
    }
  }
  if (!gatilhoOk) return { ensinar: false, conteudo: "" };
  const conteudo = (resto || "").trim().replace(/^[:,\-\s]+/, "").trim();
  return { ensinar: !!conteudo, conteudo };
}

// Monta o registro que vai pro banco
function montarRegistroAprendido({ pergunta, resposta, aprovadoPor, ts }) {
  return {
    pergunta: (pergunta || "").toString().trim(),
    resposta: (resposta || "").toString().trim(),
    aprovadoPor: (aprovadoPor || "admin").toString().trim(),
    ts: ts || 0
  };
}

// Stopwords pt-BR curtas pra não casar por palavras vazias
const STOPWORDS = new Set(
  ("a o e de da do que em um uma para pra por com no na os as se sua seu meu " +
   "minha isso esse essa este esta como quando onde qual quais tem ter mais " +
   "mas ou ao aos das dos pelo pela vc voce você sobre ja já").split(" ")
);

function palavrasChave(s) {
  return normalizar(s)
    .split(" ")
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

// Escolhe registros aprendidos parecidos com a pergunta (sobreposição de palavras)
function selecionarRelevantes(registros, pergunta, max = 5) {
  const kw = new Set(palavrasChave(pergunta));
  if (!kw.size) return [];
  return (registros || [])
    .map(r => {
      const rkw = palavrasChave(r && r.pergunta);
      const overlap = rkw.filter(w => kw.has(w)).length;
      return { r, overlap };
    })
    .filter(x => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, max)
    .map(x => x.r);
}

// Monta o trecho do system prompt com as respostas já aprendidas
function formatarMemoriaPromptSection(registros) {
  if (!registros || !registros.length) return "";
  let s = "\nRESPOSTAS JA APRENDIDAS (aprovadas pelo Bruno/Carol - use quando a pergunta do cliente for igual ou parecida com uma destas):\n";
  registros.forEach((r, i) => {
    s += `${i + 1}. Pergunta: ${r.pergunta}\n   Resposta aprovada: ${r.resposta}\n`;
  });
  return s;
}

module.exports = {
  normalizar,
  ehSim,
  ehNao,
  parseComandoEnsino,
  montarPerguntaConfirmacao,
  montarRegistroAprendido,
  palavrasChave,
  selecionarRelevantes,
  formatarMemoriaPromptSection
};
