// =====================================================================
// MÍDIA INTELIGENTE — seleção automática de foto/vídeo por perfil (Problema 3)
// =====================================================================
// A Helena não envia mídia aleatória. Ela primeiro entende o cliente
// (intent) e só então seleciona o material mais adequado.
//
// Fluxo:
//   1. detectarIntentoMidia(text) → string de intent
//   2. selecionarMidiaParaIntento(intent, produto) → [{ marcador, tipo }]
//   3. gerarComentarioMidia(intent, nomeLead, idioma) → texto de abertura
//
// Lógica pura (testável). Os marcadores gerados seguem o padrão
// [MIDIA:produto:tipo(:arg)?] já suportado por helena.js.
// =====================================================================

// ---- Intents possíveis -----------------------------------------------

const INTENTS = {
  VISTA_MAR:    "vista_mar",    // "frente-mar", "vista", "pé na areia"
  INVESTIDOR:   "investidor",   // "investir", "retorno", "renda"
  MORADIA:      "moradia",      // "morar", "moradia", "segunda residência"
  TIPOLOGIA_2S: "tipologia_2s", // "2 suítes", "dois quartos"
  TIPOLOGIA_3S: "tipologia_3s", // "3 suítes", "três quartos"
  LAZER:        "lazer",        // "lazer", "piscina", "kids"
  PLANTA:       "planta",       // "planta", "layout", "metragem"
  LOCALIZACAO:  "localizacao",  // "onde fica", "mapa", "endereço"
  GERAL:        "geral",        // sem perfil específico → fotos gerais
};

// ---- Padrões de detecção de intent (multi-idioma) --------------------

const DETECTORES = [
  // VISTA_MAR — PT, EN, ES
  {
    intent: INTENTS.VISTA_MAR,
    rx: [
      /\b(?:frente[\s-]?mar|p[ée][\s-]na[\s-]areia|vista\s+pro\s+mar|vista\s+(?:do|para\s+o|pra\s+o)?\s*mar|vista\s+(?:definitiva|livre|desobstruida|aberta)|ocean\s*view|beachfront|sea[\s-]?view|frente\s+al\s+mar|vista\s+al\s+mar|vistas?\s+al\s+oceano)\b/i,
      /\b(?:quero\s+(?:ver\s+)?(?:a\s+)?vista|quero\s+frente[\s-]?mar|gosto\s+de\s+vista|preciso\s+de\s+vista|quero\s+(?:ficar\s+)?(?:de\s+frente|olhando)\s+(?:pro|para\s+o)\s+mar)\b/i,
    ],
  },
  // INVESTIDOR — PT, EN, ES
  {
    intent: INTENTS.INVESTIDOR,
    rx: [
      /\b(?:invest(?:ir|imento|idor)|retorno|rentab(?:ilidade|ilizar)|renda|aluguel|locar|locacao|valoriza[çc][aã]o|revender|revenda|airbnb|short\s+stay|temporada|lucro|ganhar|render|portfolio)\b/i,
      /\b(?:invest(?:ment|or|ing|s?)\b|return\s+on|rental\s+income|rental\s+yield|appreciation|airbnb|short[\s-]?term|profitability|returns?)\b/i,
      /\b(?:invertir|inversi[oó]n|rentabilidad|alquiler|arrendamiento|valorizaci[oó]n|airbnb)\b/i,
    ],
  },
  // MORADIA — PT, EN, ES
  {
    intent: INTENTS.MORADIA,
    rx: [
      /\b(?:morar|moradia|segunda\s+resid[eê]ncia|casa\s+(?:de\s+)?praia|viver|residir|mudar\s+pra|mudar\s+para|cidad[ãa]o|residencia\s+permanente|fixar|me\s+mudar)\b/i,
      /\b(?:live|living|residence|primary\s+home|vacation\s+home|beach\s+house|move\s+(?:in|to)|settle\s+(?:in|down)|permanent\s+residence)\b/i,
      /\b(?:vivir|residencia|segunda\s+residencia|casa\s+(?:de\s+)?playa|mudarme|residir)\b/i,
    ],
  },
  // TIPOLOGIA_2S — PT, EN, ES (deve vir ANTES de _3S para não sobrepor)
  {
    intent: INTENTS.TIPOLOGIA_2S,
    rx: [
      /\b(?:2\s*su[ií]tes?|dois\s+su[ií]tes?|duas\s+su[ií]tes?|2\s*quartos?|dois\s+quartos?|duas\s+(?:pe[çc]as?|habita[çc][oõ]es?))\b/i,
      /\b(?:2[\s-]?(?:suite|bedroom|bed)s?|two[\s-]?(?:suite|bedroom|bed)s?)\b/i,
      /\b(?:2\s*(?:dormitorios?|habitaciones?|suites?)|dos\s*(?:dormitorios?|habitaciones?|suites?))\b/i,
    ],
  },
  // TIPOLOGIA_3S — PT, EN, ES
  {
    intent: INTENTS.TIPOLOGIA_3S,
    rx: [
      /\b(?:3\s*su[ií]tes?|tr[eê]s\s+su[ií]tes?|3\s*quartos?|tr[eê]s\s+quartos?|3\s*dormit[oó]rios?|tr[eê]s\s+dormit[oó]rios?)\b/i,
      /\b(?:3[\s-]?(?:suite|bedroom|bed)s?|three[\s-]?(?:suite|bedroom|bed)s?)\b/i,
      /\b(?:3\s*(?:dormitorios?|habitaciones?|suites?)|tres\s*(?:dormitorios?|habitaciones?|suites?))\b/i,
    ],
  },
  // LAZER — PT, EN, ES
  {
    intent: INTENTS.LAZER,
    rx: [
      /\b(?:lazer|[aá]rea\s+de\s+lazer|piscina|academia|playground|kids?|brinquedoteca|churrasqueira|espa[çc]o\s+(?:gourmet|festas?|kids?)|spa|hidro|sauna|quadra|sal[aã]o)\b/i,
      /\b(?:amenities|pool|gym|fitness|kids?\s+(?:area|zone|room)|playground|jacuzzi|sauna|rooftop|bbq|barbecue|party\s+room)\b/i,
      /\b(?:amenidades|piscina|gimnasio|zona\s+de\s+juegos|barbacoa|spa|sauna|jacuzzi)\b/i,
    ],
  },
  // PLANTA — PT, EN, ES
  {
    intent: INTENTS.PLANTA,
    rx: [
      /\b(?:planta|layout|metragem|metro(?:s?)\s+quadrados?|pe\s+direito|d[íi]metro|tamanho|tipo\s+(?:de\s+)?planta)\b|(?:^|\s)m[²2](?:\s|$)/i,
      /\b(?:floor\s*plan|layout|square\s+(?:foot|feet|meter|metre|footage)|floorplan|unit\s+size|apartment\s+size)\b/i,
      /\b(?:plano|planta\s+arquitect[oó]nica|metros?\s+cuadrados?|distribu[ci][oó]n)\b|(?:^|\s)m[²2](?:\s|$)/i,
    ],
  },
  // LOCALIZACAO — PT, EN, ES
  {
    intent: INTENTS.LOCALIZACAO,
    rx: [
      /\b(?:onde\s+fica|endere[çc]o|localiza[çc][aã]o|mapa|google\s+maps?|como\s+chegar|fica\s+onde|cidade|bairro|distancia|dist[âa]ncia)\b/i,
      /\b(?:where\s+(?:is\s+it|is\s+the|located)|location|address|directions|how\s+to\s+get|map|google\s+maps?|city|neighborhood|distance)\b/i,
      /\b(?:d[oó]nde\s+(?:est[áa]|queda)|direcci[oó]n|ubicaci[oó]n|localizaci[oó]n|mapa|c[oó]mo\s+llegar|ciudad|barrio|distancia)\b/i,
    ],
  },
];

// ---- detectarIntentoMidia --------------------------------------------

// Analisa o texto do cliente e retorna o intent dominante.
// Retorna uma string INTENTS.* ou "geral" se nenhum padrão casar.
function detectarIntentoMidia(text) {
  if (!text || typeof text !== "string") return INTENTS.GERAL;

  // Testa em ordem de prioridade. Tipologias antes de GERAL.
  for (const det of DETECTORES) {
    if (det.rx.some(rx => rx.test(text))) {
      return det.intent;
    }
  }
  return INTENTS.GERAL;
}

// ---- selecionarMidiaParaIntento --------------------------------------

// Retorna lista ordenada de seletores de mídia para um dado intent+produto.
// Cada item: { tipo, arg } onde tipo é o tipo do marcador (fotos/video/planta/lazer/local)
// e arg é opcional (ex.: "mais", número de unidade).
//
// Regra: a Helena emite 1 mídia por mensagem (regra do CEO). A lista representa
// a sequência recomendada de envios ao longo da conversa.
//
// O produto "chave" é a chave do catálogo (ex.: "fort_myers").
function selecionarMidiaParaIntento(intent, produto) {
  if (!produto) return [];

  switch (intent) {
    case INTENTS.VISTA_MAR:
      // Vista → melhor foto de destaque + vídeo
      return [
        { tipo: "fotos", arg: null },
        { tipo: "video", arg: null },
      ];

    case INTENTS.INVESTIDOR:
      // Investidor quer ver valor real: localização + vista + fachada + vídeo
      return [
        { tipo: "local",  arg: null },
        { tipo: "fotos",  arg: null },
        { tipo: "video",  arg: null },
      ];

    case INTENTS.MORADIA:
      // Moradia: vista + vídeo (sentimento de lar)
      return [
        { tipo: "fotos", arg: null },
        { tipo: "video", arg: null },
      ];

    case INTENTS.TIPOLOGIA_2S:
      // 2 suítes: planta de 2 suítes + fotos
      return [
        { tipo: "planta", arg: "2s" },
        { tipo: "fotos",  arg: null },
      ];

    case INTENTS.TIPOLOGIA_3S:
      // 3 suítes: planta 3s + vídeo frontal (final 03) — vista que emociona
      return [
        { tipo: "planta", arg: "3s" },
        { tipo: "video",  arg: "03" },
      ];

    case INTENTS.LAZER:
      return [
        { tipo: "lazer", arg: null },
      ];

    case INTENTS.PLANTA:
      return [
        { tipo: "planta", arg: null },
      ];

    case INTENTS.LOCALIZACAO:
      return [
        { tipo: "local", arg: null },
      ];

    case INTENTS.GERAL:
    default:
      // Sem perfil definido: foto geral de destaque
      return [
        { tipo: "fotos", arg: null },
      ];
  }
}

// ---- gerarComentarioMidia --------------------------------------------

// Retorna o comentário de abertura ANTES de enviar a mídia.
// nomeLead: primeiro nome do cliente (pode ser vazio).
// idioma: "pt" | "en" | "es" (padrão "pt").
function gerarComentarioMidia(intent, nomeLead, idioma) {
  const lang = (idioma || "pt").toLowerCase().slice(0, 2);
  const nome = (nomeLead || "").trim().split(/\s+/)[0] || "";
  const vocativo = nome ? `${nome}, ` : "";

  const COMENTARIOS = {
    [INTENTS.VISTA_MAR]: {
      pt: `${vocativo}olha essa vista — achei uma das imagens mais bonitas desse empreendimento.\n\nVocê prefere uma vista totalmente aberta pro mar ou uma lateral também faria sentido?`,
      en: `${vocativo}look at this view — I think it's one of the most beautiful shots of this development.\n\nDo you prefer a completely open ocean view, or would a side view work for you too?`,
      es: `${vocativo}mira esta vista — creo que es una de las imágenes más bonitas de este emprendimiento.\n\n¿Prefieres una vista completamente abierta al mar o también te funcionaría una lateral?`,
    },
    [INTENTS.INVESTIDOR]: {
      pt: `${vocativo}deixa eu te mostrar onde fica e o potencial real desse empreendimento.\n\nO que pesa mais pra você: a valorização ao longo do tempo ou a renda de aluguel?`,
      en: `${vocativo}let me show you where this development is and its real potential.\n\nWhat matters more to you: long-term appreciation or rental income?`,
      es: `${vocativo}déjame mostrarte dónde está y el potencial real de este emprendimiento.\n\n¿Qué pesa más para ti: la valorización a largo plazo o los ingresos por alquiler?`,
    },
    [INTENTS.MORADIA]: {
      pt: `${vocativo}olha como fica o dia a dia aqui — acho que você vai se imaginar morando.\n\nO que mais importa pra você numa casa de praia: a tranquilidade ou a estrutura de lazer?`,
      en: `${vocativo}look at what day-to-day life looks like here — I think you'll picture yourself living in it.\n\nWhat matters most to you in a beach home: the peace and quiet, or the amenities?`,
      es: `${vocativo}mira cómo es el día a día aquí — creo que te vas a imaginar viviendo ahí.\n\n¿Qué es más importante para ti en una casa de playa: la tranquilidad o las amenidades?`,
    },
    [INTENTS.TIPOLOGIA_2S]: {
      pt: `${vocativo}essa planta combina bastante com o que você comentou. Gostei muito dessa integração da varanda com o living.\n\nO que você achou?`,
      en: `${vocativo}this floor plan really matches what you mentioned. I love how the balcony flows into the living area.\n\nWhat do you think?`,
      es: `${vocativo}esta planta combina bastante con lo que mencionaste. Me encanta la integración del balcón con el living.\n\n¿Qué te parece?`,
    },
    [INTENTS.TIPOLOGIA_3S]: {
      pt: `${vocativo}nossa, que excelente escolha! Preparei uma vista especial pra você — olha como fica linda a vista dessa planta de 3 suítes.\n\nO que achou?`,
      en: `${vocativo}what an excellent choice! I put together a special view for you — look how beautiful the view is from this 3-suite floor plan.\n\nWhat do you think?`,
      es: `${vocativo}¡qué excelente elección! Preparé una vista especial para ti — mira qué linda queda la vista de esta planta de 3 suites.\n\n¿Qué te parece?`,
    },
    [INTENTS.LAZER]: {
      pt: `${vocativo}olha a área de lazer — acho que vai gostar bastante dessa estrutura.\n\nTem alguma área que mais importa pra você: piscina, espaço kids ou academia?`,
      en: `${vocativo}take a look at the amenity areas — I think you'll really enjoy this setup.\n\nIs there one area that matters most to you: the pool, kids' area, or gym?`,
      es: `${vocativo}mira el área de amenidades — creo que te va a gustar bastante esta estructura.\n\n¿Hay alguna área que sea más importante para ti: la piscina, el espacio para niños o el gimnasio?`,
    },
    [INTENTS.PLANTA]: {
      pt: `${vocativo}deixa eu te mostrar a planta — fica mais fácil visualizar os espaços assim.\n\nO que achou do layout geral?`,
      en: `${vocativo}let me show you the floor plan — it's easier to visualize the spaces this way.\n\nWhat do you think of the overall layout?`,
      es: `${vocativo}déjame mostrarte la planta — así es más fácil visualizar los espacios.\n\n¿Qué te parece el diseño general?`,
    },
    [INTENTS.LOCALIZACAO]: {
      pt: `${vocativo}aqui está a localização exata — fica em uma posição privilegiada na região.\n\nO que achou da distância pro mar?`,
      en: `${vocativo}here's the exact location — it's in a prime spot in the area.\n\nWhat do you think about the distance to the beach?`,
      es: `${vocativo}aquí está la ubicación exacta — está en un lugar privilegiado de la región.\n\n¿Qué te parece la distancia al mar?`,
    },
    [INTENTS.GERAL]: {
      pt: `${vocativo}deixa eu te mostrar o empreendimento — acho que vai gostar do que vai ver.\n\nO que mais chama sua atenção?`,
      en: `${vocativo}let me show you the development — I think you'll like what you see.\n\nWhat catches your eye the most?`,
      es: `${vocativo}déjame mostrarte el emprendimiento — creo que te va a gustar lo que ves.\n\n¿Qué es lo que más llama tu atención?`,
    },
  };

  const grupo = COMENTARIOS[intent] || COMENTARIOS[INTENTS.GERAL];
  return (grupo[lang] || grupo["pt"]).trim();
}

// ---- gerarPromptMidiaInteligente ------------------------------------

// Gera o bloco de system prompt que instrui a Helena sobre seleção inteligente
// de mídia. Injeta na seção de regras do buildHelenaSystemBlocks.
function gerarPromptMidiaInteligente() {
  return `
MÍDIA INTELIGENTE — SELEÇÃO AUTOMÁTICA (obrigatória)
----------------------------------------------------
ANTES de enviar qualquer foto ou vídeo:
1. ENTENDA o perfil do cliente (o que ele mencionou até agora).
2. SELECIONE o material mais adequado para aquele perfil:
   - Frente-mar / vista → fotos de destaque de vista + vídeo do tour
   - Investidor → localização + fotos gerais + vídeo
   - Moradia → fotos do living/ambiente + vídeo
   - 2 suítes → planta de 2 suítes + fotos
   - 3 suítes → planta de 3 suítes + vídeo
   - Lazer → fotos de lazer
   - Planta → planta da tipologia pedida
3. NUNCA envie mais de 1 mídia por mensagem.
4. SEMPRE comente ANTES de enviar: uma frase calorosa ligada ao perfil do cliente.
5. SEMPRE termine a mensagem com UMA ÚNICA pergunta para manter o diálogo.
6. NUNCA envie mídia sem contexto. Nunca envie foto ou vídeo "de graça".

FORMATO: emita o marcador [MIDIA:chave:tipo] AO FINAL do texto, depois do comentário.
Exemplo correto:
  "João, olha essa vista — é uma das melhores do empreendimento.
   O que você achou? [MIDIA:fort_myers:fotos]"

PROIBIDO:
  - Enviar foto sem comentar
  - Enviar vídeo sem contexto
  - Mandar várias mídias na mesma mensagem
  - Usar mídia aleatória (escolha sempre com base no que o cliente disse)
`.trim();
}

module.exports = {
  INTENTS,
  detectarIntentoMidia,
  selecionarMidiaParaIntento,
  gerarComentarioMidia,
  gerarPromptMidiaInteligente,
};
