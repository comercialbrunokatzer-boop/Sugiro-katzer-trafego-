// =====================================================================
// CATÁLOGO DE MÍDIA — URLs reais (hospedadas no próprio site Netlify)
// =====================================================================
// Arquivos ficam em midia/<produto>/ e o Netlify publica a raiz (publish="."),
// então cada arquivo tem link público automático. O Z-API baixa e envia como
// mídia NATIVA (cliente recebe a foto/vídeo, nunca o link).
//
// Formato por produto:
//   fotos:   [ "https://.../foto1.jpg", ... ]      (imagens, valem p/ qualquer unidade)
//   video:   "https://.../tour.mp4"                (<= ~16MB) ou null
//   plantas: { base, exatas:{unidade:arq}, regras:[{final,andarMin,andarMax,arq}] }
//            resolvida pela UNIDADE (ver lib/midia.js resolverPlanta). Se não bater
//            -> null -> Helena faz referência + reunião (NUNCA a planta errada).
//
// Produto sem mídia = { fotos: [], video: null } (dormente).
// =====================================================================

const SITE = "https://regal-chaja-662035.netlify.app";
const FM = `${SITE}/midia/fort_myers`;
const CE = `${SITE}/midia/celebration`;
const DE = `${SITE}/midia/destin`;
const GB = `${SITE}/midia/golden_beach`;
const MA = `${SITE}/midia/maritimo`;
const ZA = `${SITE}/midia/zaya`;
const TR = `${SITE}/midia/tropicale`;
const AM = `${SITE}/midia/amanay`;

const CATALOGO_MIDIA = {
  // ===================== FORT MYERS (ATIVO) =====================
  // fotos: as 2 PRIMEIRAS são as de destaque (a Helena manda só 2 por padrão;
  //   o resto sai só se o cliente pedir "mais"). PRIORIZAR vista pro mar.
  // ⚠️ PENDENTE (Bruno): faltam as imagens de VISTA / living com vista pro mar.
  //   Quando chegarem: colocar como foto-01 (primeira = destaque) e mandar pra cá.
  // lazer: fotos da área de lazer (mandadas quando o cliente pede LAZER, não planta).
  fort_myers: {
    // LOCAL: link do Google Maps (mandado quando o cliente pede a localização).
    // Link EXATO do prédio (enviado pelo Bruno).
    local: "https://maps.app.goo.gl/42aRLu2bwHUpcETG6",
    // VIDEO DO ANUNCIO patrocinado, por idioma (pra retomada / cliente relembrar
    // o anuncio que viu). Comprimidos p/ <16MB. es=espanhol, en=ingles.
    videoAnuncio: {
      es: `${FM}/anuncio-es.mp4`,
      en: `${FM}/anuncio-en.mp4`
    },
    // CAPA: imagem-herói da ABERTURA (1ª mensagem quando já se sabe o produto).
    // Aéreo FRENTE-MAR (sacada + mar/praia) — impacto máximo (pedido do CEO).
    capa: `${FM}/capa-frente-mar.jpg`,
    fotos: [
      `${FM}/capa.jpg`,                    // living integrado c/ VISTA PRO MAR (destaque 1 — a estrela)
      `${FM}/foto-living-cozinha-vista.jpg`,// cozinha/jantar c/ VISTA PRO MAR (destaque 2)
      `${FM}/foto-01.jpg`,                 // prédio com paisagem
      `${FM}/foto-02.jpg`,                 // torre completa
      `${FM}/foto-04.jpg`                  // mar/água (sai no "mais")
    ],
    lazer: [
      `${FM}/lazer-piscina-vista.jpg`,     // piscina borda infinita com VISTA PRO MAR
      `${FM}/lazer-lounge-vista.jpg`,      // lounge/fire pit frente-mar no pôr do sol
      `${FM}/lazer-deck-bar-vista.jpg`,    // rooftop bar/deck com vista pro mar
      `${FM}/foto-03.jpg`                  // fachada/lazer (lounge, palmeiras)
    ],
    // LAZER POR TEMA (fotos oficiais Vetter) — pra mídia proativa/emocional (REGRA 6K):
    // manda a área que casa com o que o cliente contou. Marcador [MIDIA:fort_myers:lazer:TEMA].
    lazerTemas: {
      kids:          `${FM}/lazer/lazer-kids.jpg`,          // splash kids (crianças)
      pub:           `${FM}/lazer/lazer-pub.jpg`,           // pub (receber amigos)
      churrasqueira: `${FM}/lazer/lazer-churrasqueira.jpg`, // grill/beer (curtir, gourmet)
      academia:      `${FM}/lazer/lazer-academia.jpg`,      // fitness club (treino)
      gameroom:      `${FM}/lazer/lazer-gameroom.jpg`,      // sala de jogos
      cinema:        `${FM}/lazer/lazer-cinema.jpg`,        // cinema
      hidro:         `${FM}/lazer/lazer-hidro.jpg`,         // hidro (descanso)
      festa:         `${FM}/lazer/lazer-salao-festa.jpg`,   // salão de festas
      amigos:        `${FM}/lazer/lazer-piscina-amigos.jpg` // piscina social (curtir)
    },
    video: `${FM}/tour.mp4`,
    // VIDEO POR FINAL: dron subindo a torre mostrando a VISTA de cada final (o andar
    // aparece no canto; sobe do 1o ao ~30o; acima vira SKY view). Manda pela terminacao
    // do apto. FRONTAIS (vista total pro mar de frente) = finais 01, 02, 03.
    // LATERAIS = finais 04 e 05. Falta so o 02 (Bruno manda depois).
    videosFinais: {
      "01": `${FM}/video-final01.mp4`,   // frontal
      "03": `${FM}/video-final03.mp4`,   // frontal
      "04": `${FM}/video-final04.mp4`,   // lateral
      "05": `${FM}/video-final05.mp4`    // lateral
    },
    plantas: {
      base: `${FM}/plantas/`,
      // aptos específicos (BeachHouse / Cobertura) — match exato pela unidade
      exatas: {
        "3201": "planta-beachhouse-3201-3suites-228m2.jpg",
        "3203": "planta-beachhouse-3203-3suites-210m2.jpg",
        "4601": "planta-cobertura-4601-3suites-182m2.jpg",
        "4602": "planta-cobertura-4602-3suites-179m2.jpg"
      },
      // por terminação do apto (final) + faixa de andar
      regras: [
        // FINAL 01 — 3 suítes
        { final: "01", andarMin: 5, andarMax: 5, arq: "planta-diferenciado-final01-3suites-139m2.jpg" },
        { final: "01", andarMin: 6, andarMax: 31, arq: "planta-tipo-final01-3suites-129m2.jpg" },
        { final: "01", andarMin: 33, andarMax: 45, arq: "planta-skyview-final01-3suites-134m2.jpg" },
        // FINAL 02 — 2 suítes
        { final: "02", andarMin: 5, andarMax: 5, arq: "planta-diferenciado-final02-2suites-112m2.jpg" },
        { final: "02", andarMin: 6, andarMax: 32, arq: "planta-tipo-final02-2suites-88m2.jpg" },
        { final: "02", andarMin: 33, andarMax: 45, arq: "planta-skyview-final02-2suites-89m2.jpg" },
        // FINAL 03 — 3 suítes
        { final: "03", andarMin: 5, andarMax: 31, arq: "planta-tipo-final03-3suites-124m2.jpg" },
        { final: "03", andarMin: 33, andarMax: 45, arq: "planta-skyview-final03-3suites-135m2.jpg" },
        // FINAL 04 — 2 suítes
        { final: "04", andarMin: 5, andarMax: 31, arq: "planta-tipo-final04-2suites-86m2.jpg" },
        // FINAL 05 — 2 suítes
        { final: "05", andarMin: 5, andarMax: 31, arq: "planta-tipo-final05-2suites-85m2.jpg" }
      ]
    }
  },

  // ===================== CELEBRATION (mídia carregada, gatilho DORMENTE) =====
  // Fotos/plantas prontas; sem vídeo ainda. Só ativar o gatilho no prompt quando
  // o CEO autorizar (por ora só o Fort Myers está ligado).
  celebration: {
    local: "https://maps.app.goo.gl/KVRzRazhFWD5Ac2H9",
    capa: `${CE}/capa.jpg`,          // render do empreendimento (hero)
    fotos: [
      `${CE}/foto-01.jpg`,
      `${CE}/foto-02.jpg`,
      `${CE}/foto-03.jpg`
    ],
    video: null,
    plantas: {
      base: `${CE}/plantas/`,
      exatas: {},
      regras: [
        { final: "01", andarMin: 1, andarMax: 99, arq: "planta-final01-1suite-2dorm-101m2.jpg" },
        { final: "02", andarMin: 1, andarMax: 99, arq: "planta-final02-1suite-2dorm-101m2.jpg" },
        { final: "03", andarMin: 1, andarMax: 99, arq: "planta-final03-1suite-1dorm-75m2.jpg" },
        { final: "04", andarMin: 1, andarMax: 99, arq: "planta-final04-1suite-1dorm-76m2.jpg" },
        { final: "05", andarMin: 1, andarMax: 99, arq: "planta-final05-1suite-1dorm-76m2.jpg" },
        { final: "06", andarMin: 1, andarMax: 99, arq: "planta-final06-1suite-1dorm-75m2.jpg" }
      ]
    }
  },

  // DESTIN BEACH (Vetter, Bal. Piçarras) — mídia completa (teaser oficial V5).
  // Ver midia/destin/MAPA.md. Vídeo é INSTITUCIONAL GERAL (não por final).
  destin: {
    local: "https://maps.app.goo.gl/q1MhYCMqihFtXues5",
    capa: `${DE}/foto-02.jpg`,          // piscina borda infinita (torre + mar)
    fotos: [
      `${DE}/foto-02.jpg`,             // piscina borda infinita c/ torre e mar (destaque 1)
      `${DE}/foto-03.jpg`,             // lounge vista verde+mar (destaque 2)
      `${DE}/foto-01.jpg`,             // fachada Vetter (esquina, fachada ativa)
      `${DE}/foto-04.jpg`             // aéreo praia Piçarras (localização)
    ],
    lazer: [
      `${DE}/foto-02.jpg`,            // piscina borda infinita
      `${DE}/foto-03.jpg`            // lounge/espreguiçadeiras vista mar
    ],
    video: `${DE}/tour.mp4`,          // institucional de lançamento (GERAL do produto)
    plantas: {
      base: `${DE}/plantas/`,
      exatas: {},
      // por terminação do apto (a planta vale pra qualquer andar do mesmo final)
      regras: [
        { final: "01", andarMin: 1, andarMax: 99, arq: "planta-final01-3suites-130m2.jpg" },
        { final: "02", andarMin: 1, andarMax: 99, arq: "planta-final02-3suites-130m2.jpg" },
        { final: "03", andarMin: 1, andarMax: 99, arq: "planta-final03-2suites-82m2.jpg" },
        { final: "04", andarMin: 1, andarMax: 99, arq: "planta-final04-2suites-85m2.jpg" },
        { final: "05", andarMin: 1, andarMax: 99, arq: "planta-final05-2suites-81m2.jpg" },
        { final: "06", andarMin: 1, andarMax: 99, arq: "planta-final06-3suites-114m2.jpg" },
        { final: "07", andarMin: 1, andarMax: 99, arq: "planta-final07-2suites-82m2.jpg" }
      ]
    }
  },

  // ===================== DORMENTES (sem mídia ainda) =====================
  // Ora by DAXO (Bal. Piçarras) - FRENTE MAR. Renders recortados dos stories oficiais
  // (limpos, sem marca/CTA). Planta = PAVIMENTO TIPO (4 aptos/andar, finais 1-4).
  ora: {
    local: "https://maps.app.goo.gl/5DizHgJDYyFFK8YH8",
    capa: `${SITE}/midia/ora/capa.jpg`,                    // living com VISTA PRO MAR (pôr do sol)
    fotos: [
      `${SITE}/midia/ora/foto-living-vista-mar.jpg`,       // living com VISTA PRO MAR (destaque 1 - a estrela)
      `${SITE}/midia/ora/foto-rooftop-vista.jpg`,          // rooftop/piscina com vista pra baía/BC (destaque 2)
      `${SITE}/midia/ora/foto-jardim-piscina.jpg`,         // jardim/piscina térreo + gourmet (sai no "mais")
      `${SITE}/midia/ora/foto-torre.jpg`                   // torre (fachada, arquitetura Leo Maia)
    ],
    video: null,
    plantas: {
      base: `${SITE}/midia/ora/plantas/`,
      exatas: {},
      // só o PAVIMENTO TIPO (mostra os 4 aptos do andar). Vale de referência p/ qualquer
      // final; a planta detalhada da unidade + medidas = reunião.
      regras: [
        { final: "01", andarMin: 1, andarMax: 99, arq: "planta-pavimento-tipo.jpg" },
        { final: "02", andarMin: 1, andarMax: 99, arq: "planta-pavimento-tipo.jpg" },
        { final: "03", andarMin: 1, andarMax: 99, arq: "planta-pavimento-tipo.jpg" },
        { final: "04", andarMin: 1, andarMax: 99, arq: "planta-pavimento-tipo.jpg" }
      ]
    }
  },
  // Infinity Exclusive Home (BRcon, Barra Velha) - FRENTE MAR. Renders do book oficial
  // (extraidos do PDF). Frente mar = LESTE = sol da manha (implantacao pag 37).
  infinity_exclusive_home: {
    local: "https://maps.app.goo.gl/nLiwKUuVfMBPPQvDA",   // Av. Avelino Jose Borges, beira mar, Barra Velha
    capa: `${SITE}/midia/infinity/capa.jpg`,          // living com VISTA PRO MAR
    fotos: [
      `${SITE}/midia/infinity/foto-vista-mar.jpg`,    // sacada/varanda com VISTA PRO MAR (destaque 1)
      `${SITE}/midia/infinity/foto-piscina.jpg`,      // piscina borda infinita frente mar (destaque 2)
      `${SITE}/midia/infinity/foto-aereo.jpg`,        // aereo da torre + praia do Tabuleiro
      `${SITE}/midia/infinity/foto-torre.jpg`         // torre (fachada)
    ],
    video: null,
    lazerTemas: {
      kids:     `${SITE}/midia/infinity/lazer/lazer-kids.jpg`,     // brinquedoteca (criancas)
      festa:    `${SITE}/midia/infinity/lazer/lazer-festa.jpg`,    // salao de festas
      academia: `${SITE}/midia/infinity/lazer/lazer-academia.jpg`, // academia (treino)
      gameroom: `${SITE}/midia/infinity/lazer/lazer-gameroom.jpg`, // salao de jogos
      hidro:    `${SITE}/midia/infinity/lazer/lazer-hidro.jpg`     // spa (descanso)
    }
  },
  // Tropicale (Rogga) - video tour + renders oficiais Rogga (do Drive).
  tropicale: {
    local: "https://maps.app.goo.gl/c8wgwyuXSMUag2716",
    capa: `${TR}/capa.jpg`,                 // fachada da torre ao entardecer
    fotos: [
      `${TR}/foto-fachada.jpg`,             // fachada (hero)
      `${TR}/foto-aereo.jpg`,               // aereo: torres + orla de Penha ao fundo
      `${TR}/foto-portaria.jpg`             // acesso/portaria
    ],
    video: `${TR}/tour.mp4`
  },
  // Jardim da Costa (Rogga) - video tour + renders oficiais Rogga (do Drive).
  jardim_da_costa: {
    local: "https://maps.app.goo.gl/gwMncoQn7NcZkt3J6",
    capa: `${SITE}/midia/jardim_da_costa/capa.jpg`,           // fachada noturna (2 torres)
    fotos: [
      `${SITE}/midia/jardim_da_costa/foto-fachada.jpg`,       // fachada noturna (hero)
      `${SITE}/midia/jardim_da_costa/foto-lazer.jpg`          // deck de lazer (piscina + playground)
    ],
    video: `${SITE}/midia/jardim_da_costa/tour.mp4`
  },
  // Personalite (BRcon, Picarras) - QUADRA MAR. Renders oficiais BRCON (do Drive).
  personalite: {
    local: "https://maps.app.goo.gl/LTESj3TMbLwAQag27",
    capa: `${SITE}/midia/personalite/capa.jpg`,               // sacada gourmet com vista pra praia/cidade
    fotos: [
      `${SITE}/midia/personalite/foto-sacada-vista.jpg`,      // sacada gourmet + VISTA (destaque)
      `${SITE}/midia/personalite/foto-fachada.jpg`            // fachada
    ],
    video: null
  },
  // ===================== AMANAY BEACH CLUB (Rôgga - Itapoá/SC) =====================
  // Mídia extraída do book oficial "Treinamento comercial - Amanay Beach Club" (Rôgga).
  // 2 torres, 256 aptos, 16 pav, 8 aptos/andar (finais 01-08). 3º pav = giardinos; 4-18 = tipo.
  // Tipo 01 (finais 01/02/07/08) = 62,86m²; Tipo 02 (finais 03/04/05/06) = 63,52m².
  // Vídeo: pendente (Bruno manda comprimido ≤10MB).
  amanay: {
    local: "https://maps.app.goo.gl/fc1m9PqSDwydDV6UA",
    capa: `${AM}/capa.jpg`,                       // rooftop/piscina no amanhecer (herói)
    fotos: [
      `${AM}/foto-torres.jpg`,                    // torres gêmeas no pôr do sol (destaque 1)
      `${AM}/foto-fachada.jpg`,                   // fachada (destaque 2)
      `${AM}/foto-sacada-vista-mar.jpg`,          // sacada com churrasqueira + vista mar
      `${AM}/foto-living.jpg`,                     // living decorado (planta tipo)
      `${AM}/foto-piscina-adulto.jpg`,            // piscina adulto borda no rooftop
      `${AM}/foto-portaria.jpg`,                  // portaria
      `${AM}/foto-aereo-local.jpg`                // aéreo: prédio + Rua Ceará + mar pertinho
    ],
    lazer: [
      `${AM}/foto-piscina-adulto.jpg`,            // piscina rooftop
      `${AM}/lazer/lazer-prainha.jpg`,            // prainha (piscina)
      `${AM}/lazer/lazer-beach-tennis.jpg`,       // quadra beach tennis
      `${AM}/lazer/lazer-salao-festas.jpg`        // salão de festas
    ],
    // LAZER POR TEMA (renders oficiais Rôgga) — mídia proativa/emocional (REGRA 6K):
    lazerTemas: {
      kids:          `${AM}/lazer/lazer-brinquedoteca.jpg`, // brinquedoteca (crianças)
      pub:           `${AM}/lazer/lazer-jogos.jpg`,         // sala de jogos (receber/curtir)
      churrasqueira: `${AM}/lazer/lazer-quiosque.jpg`,      // quiosque/churrasqueira
      academia:      `${AM}/lazer/lazer-academia.jpg`,      // academia
      gameroom:      `${AM}/lazer/lazer-jogos.jpg`,         // sala de jogos
      festa:         `${AM}/lazer/lazer-salao-festas.jpg`,  // salão de festas
      piscina:       `${AM}/lazer/lazer-prainha.jpg`,       // prainha/piscina
      beachtennis:   `${AM}/lazer/lazer-beach-tennis.jpg`,  // beach tennis
      zen:           `${AM}/lazer/lazer-espaco-zen.jpg`,    // espaço zen (descanso)
      pet:           `${AM}/lazer/lazer-pet-place.jpg`      // pet place (quem tem pet)
    },
    video: null, // PENDENTE: Bruno manda o vídeo comprimido ≤10MB
    plantas: {
      base: `${AM}/plantas/`,
      // 3º pavimento = GIARDINOS (prancha única p/ todos os finais);
      // 4º ao 18º = TIPO (Tipo 01: finais 01/02/07/08 · Tipo 02: finais 03/04/05/06).
      // Referências gerais no book (não resolvidas por unidade, ficam no repo):
      //   plantas/implantacao-finais.jpg  · plantas/planta-tipo-detalhada.jpg
      regras: [
        { final: "01", andarMin: 3, andarMax: 3, arq: "planta-giardino.jpg" },
        { final: "02", andarMin: 3, andarMax: 3, arq: "planta-giardino.jpg" },
        { final: "03", andarMin: 3, andarMax: 3, arq: "planta-giardino.jpg" },
        { final: "04", andarMin: 3, andarMax: 3, arq: "planta-giardino.jpg" },
        { final: "05", andarMin: 3, andarMax: 3, arq: "planta-giardino.jpg" },
        { final: "06", andarMin: 3, andarMax: 3, arq: "planta-giardino.jpg" },
        { final: "07", andarMin: 3, andarMax: 3, arq: "planta-giardino.jpg" },
        { final: "08", andarMin: 3, andarMax: 3, arq: "planta-giardino.jpg" },
        { final: "01", andarMin: 4, andarMax: 18, arq: "planta-tipo-01-finais-01-02-07-08.jpg" },
        { final: "02", andarMin: 4, andarMax: 18, arq: "planta-tipo-01-finais-01-02-07-08.jpg" },
        { final: "07", andarMin: 4, andarMax: 18, arq: "planta-tipo-01-finais-01-02-07-08.jpg" },
        { final: "08", andarMin: 4, andarMax: 18, arq: "planta-tipo-01-finais-01-02-07-08.jpg" },
        { final: "03", andarMin: 4, andarMax: 18, arq: "planta-tipo-02-finais-03-04-05-06.jpg" },
        { final: "04", andarMin: 4, andarMax: 18, arq: "planta-tipo-02-finais-03-04-05-06.jpg" },
        { final: "05", andarMin: 4, andarMax: 18, arq: "planta-tipo-02-finais-03-04-05-06.jpg" },
        { final: "06", andarMin: 4, andarMax: 18, arq: "planta-tipo-02-finais-03-04-05-06.jpg" }
      ]
    }
  },

  // Grant Home Club (Rogga, Barra Velha) - PE NA AREIA. Aereo real da obra (do Drive)
  // + planta dos finais 01/02. (Sem link de mapa cadastrado ainda.)
  grant_home: {
    local: "https://maps.app.goo.gl/4ouYv5teYEPjFrva6",      // Praia do Tabuleiro, Barra Velha (pe na areia)
    capa: `${SITE}/midia/grant_home/capa.jpg`,               // aereo da obra na beira da praia (pe na areia)
    fotos: [
      `${SITE}/midia/grant_home/foto-torre.jpg`,             // render da torre (destaque 1)
      `${SITE}/midia/grant_home/foto-aereo-pe-na-areia.jpg`, // aereo pe na areia (comprova frente mar - destaque 2)
      `${SITE}/midia/grant_home/foto-aereo.jpg`,             // voo/aereo do complexo
      `${SITE}/midia/grant_home/foto-piscina.jpg`,           // piscina
      `${SITE}/midia/grant_home/foto-living-tipo.jpg`,       // living do apto tipo
      `${SITE}/midia/grant_home/foto-garden.jpg`             // giardino/garden
    ],
    lazer: [
      `${SITE}/midia/grant_home/foto-piscina.jpg`,           // piscina borda infinita
      `${SITE}/midia/grant_home/lazer/lazer-salao.jpg`       // salao de festas
    ],
    video: null,
    plantas: {
      base: `${SITE}/midia/grant_home/plantas/`,
      exatas: {},
      // so temos a planta dos finais 01/02 (3 dorms, 106,16m2). Outros finais -> referencia + reuniao.
      regras: [
        { final: "01", andarMin: 1, andarMax: 99, arq: "planta-finais-01-02-3dorms-106m2.jpg" },
        { final: "02", andarMin: 1, andarMax: 99, arq: "planta-finais-01-02-3dorms-106m2.jpg" }
      ]
    }
  },

  // ===================== GOLDEN BEACH (VSK, Bal. Piçarras) =====================
  // Mídia do teaser oficial (ver midia/golden_beach/MAPA.md). Sem vídeo ainda.
  // Plantas do teaser são AGRUPADAS por página (torre/giardino/cobertura) — não dá
  // pra resolver a planta EXATA por terminação sem recorte 1-por-apto, então
  // deixamos plantas.regras vazio (Helena faz referência + reunião = fallback seguro).
  golden_beach: {
    local: "https://maps.app.goo.gl/zt2gVFzrrmfJHfhD7",
    capa: `${GB}/foto-02.jpg`,          // torre + mar (~150m da praia)
    fotos: [
      `${GB}/foto-01.jpg`,             // fachada noturna das 2 torres (hero)
      `${GB}/foto-02.jpg`,             // torre + mar
      `${GB}/foto-03.jpg`,             // terraço giardino c/ spa/churrasqueira
      `${GB}/foto-04.jpg`             // suíte master
    ],
    video: null,
    plantas: {
      base: `${GB}/plantas/`,
      exatas: {},
      // a folha "torre-tipo" mostra TODAS as tipologias do pavimento tipo (finais 01-08).
      // Vale de referencia do layout por final; a planta detalhada + medidas = reuniao.
      // (Giardino/terreo e cobertura duplex tem folha propria - mandar por referencia/reuniao.)
      regras: [
        { final: "01", andarMin: 1, andarMax: 99, arq: "plantas-torre-tipo.jpg" },
        { final: "02", andarMin: 1, andarMax: 99, arq: "plantas-torre-tipo.jpg" },
        { final: "03", andarMin: 1, andarMax: 99, arq: "plantas-torre-tipo.jpg" },
        { final: "04", andarMin: 1, andarMax: 99, arq: "plantas-torre-tipo.jpg" },
        { final: "05", andarMin: 1, andarMax: 99, arq: "plantas-torre-tipo.jpg" },
        { final: "06", andarMin: 1, andarMax: 99, arq: "plantas-torre-tipo.jpg" },
        { final: "07", andarMin: 1, andarMax: 99, arq: "plantas-torre-tipo.jpg" },
        { final: "08", andarMin: 1, andarMax: 99, arq: "plantas-torre-tipo.jpg" }
      ]
    }
  },

  // ===================== MARÍTIMO "Privilégio Absoluto" (VSK, Barra Velha) =====
  // Mídia da apresentação oficial (ver midia/maritimo/MAPA.md). Vídeo = drone da
  // vista real, pé na areia (GERAL). Plantas por terminação (Final 1-4).
  maritimo: {
    local: "https://maps.app.goo.gl/52qrBDftumkzeqow5",
    capa: `${MA}/foto-03.jpg`,          // living com vista pro mar
    fotos: [
      `${MA}/foto-03.jpg`,             // living c/ VISTA PRO MAR (destaque 1 — vista mar primeiro)
      `${MA}/foto-01.jpg`,             // aéreo torre + orla ao pôr do sol (destaque 2)
      `${MA}/foto-02.jpg`,             // fachada/entrada térrea
      `${MA}/foto-04.jpg`            // família na praia (lifestyle)
    ],
    video: `${MA}/video-vista.mp4`,     // drone da vista real, pé na areia (GERAL)
    plantas: {
      base: `${MA}/plantas/`,
      exatas: {},
      // vista muda pela POSIÇÃO: Final 1/2 = frente; Final 3/4 = lateral. Nunca cruzar.
      regras: [
        { final: "01", andarMin: 1, andarMax: 99, arq: "planta-tipo1-final1-3suites-150m2.jpg" },
        { final: "02", andarMin: 1, andarMax: 99, arq: "planta-tipo2-final2-3suites-150m2.jpg" },
        { final: "03", andarMin: 1, andarMax: 99, arq: "planta-tipo3-final3-3suites-124m2.jpg" },
        { final: "04", andarMin: 1, andarMax: 99, arq: "planta-tipo4-final4-3suites-140m2.jpg" }
      ]
    }
  },

  // ===================== ZAYA HOME RESORT (Bertoldi, Penha) =====================
  // ÂNCORA = Beto Carrero + rentabilidade Airbnb, NUNCA o mar (fotos lideram pelo
  // resort/torres, não pela orla). Sem link de mapa ainda (Bruno não mandou).
  // Plantas por TIPO (não mapeadas por terminação) -> referência + reunião.
  zaya: {
    local: "https://maps.app.goo.gl/bpZLmdURNRx1EJeN6",   // Penha, Rota do Beto Carrero
    capa: `${ZA}/foto-03.jpg`,          // praça central c/ as torres (o produto — não o mar)
    fotos: [
      `${ZA}/foto-03.jpg`,             // praça central + torres (destaque 1)
      `${ZA}/foto-04.jpg`,             // lazer resort (coworking, cinema, jogos) (destaque 2)
      `${ZA}/foto-02.jpg`,             // castelo Beto Carrero (âncora de venda)
      `${ZA}/foto-01.jpg`            // aéreo orla de Penha (mar — só se pedir; NÃO liderar)
    ],
    video: null,
    plantas: { base: `${ZA}/plantas/`, exatas: {}, regras: [] }
  },

  // Al Mare (Grupo Estrutura, Picarras) - PE NA AREIA. Fotos profissionais GE (baixadas
  // do Drive, orientacao EXIF corrigida). Video: ha um tour.mp4 na pasta, mas e um reel
  // de corretora (com locutora na tela) - aguardando o Bruno decidir se usa. Por ora null.
  al_mare: {
    local: "https://maps.app.goo.gl/NxBexXs5e5gVrezX7",
    capa: `${SITE}/midia/al_mare/capa.jpg`,          // vista pro mar (praia de Picarras)
    fotos: [
      `${SITE}/midia/al_mare/foto-vista-01.jpg`,     // VISTA PRO MAR (destaque 1 - a estrela)
      `${SITE}/midia/al_mare/foto-piscina.jpg`,      // piscina/raia com vista (destaque 2)
      `${SITE}/midia/al_mare/foto-vista-oficial.jpg`,// vista oficial GE (render de mira)
      `${SITE}/midia/al_mare/foto-externa.jpg`,      // torres (fachada)
      `${SITE}/midia/al_mare/foto-vista-02.jpg`      // mais uma da praia/mar (sai no "mais")
    ],
    lazer: [
      `${SITE}/midia/al_mare/foto-piscina-oficial.jpg`, // piscina oficial GE
      `${SITE}/midia/al_mare/lazer/lazer-cinema.jpg`    // sala de cinema
    ],
    lazerTemas: {
      cinema:  `${SITE}/midia/al_mare/lazer/lazer-cinema.jpg`,    // cinema
      piscina: `${SITE}/midia/al_mare/foto-piscina-oficial.jpg`   // piscina
    },
    video: null
  }
};

module.exports = { CATALOGO_MIDIA };
