/**
 * Config do Maestro. IDs de etapa e campo REUSADOS do Auditor (src/config.js do repo
 * katzer-auditor001, confirmados no portal Bitrix). Credenciais e IDs incertos vem de env.
 * Regra: campo sem ID confirmado NAO e enviado (vazio > errado — Lei 01).
 */
const env = (k, d = '') => (process.env[k] ?? d).toString().trim();

export const CFG = {
  // ── Bitrix ──
  BITRIX_WEBHOOK_WRITE: env('BITRIX_WEBHOOK_WRITE').replace(/\/+$/, ''),
  CATEGORY_ID: env('BITRIX_CATEGORY_ID', '1'),

  ETAPAS: {
    LEAD_NOVO: env('STAGE_LEAD_NOVO', 'C1:NEW'),
    QUALIFICADO: env('STAGE_QUALIFICADO', 'C1:PREPARATION'),
    PRE_QUALIFICADO: env('STAGE_PRE_QUALIFICADO', 'C1:PREPARATION'),
  },

  // Campos confirmados no Auditor (11-12/07). Reuso direto.
  F: {
    PRODUTO: 'UF_CRM_1752266661',
    CIDADE: 'UF_CRM_1753709356',
    INTENCAO: 'UF_CRM_1753709401',          // finalidade: veraneio/moradia/investimento
    URGENCIA: 'UF_CRM_1753709436',
    TICKET_PERCEBIDO: 'UF_CRM_1760387036',  // "quanto o cliente quer investir" (orcamento_max)
    PRAZO_COMPRA: 'UF_CRM_DEAL_1756130041284', // estagio: pesquisando/comparando/pronto (parcial)
  },
  // Campos AINDA nao mapeados no Auditor — so enviam se o CEO preencher o ID no env.
  F_ENV: {
    ORIGEM: env('UF_ORIGEM'),
    PERFIL_DECISOR: env('UF_PERFIL_DECISOR'),
    NIVEL: env('UF_NIVEL'),
    EMAIL_EXTRA: env('UF_EMAIL_EXTRA'),
  },

  // ── Round-robin de corretores ──
  BROKER_POOL: env('BROKER_POOL', '985,1637,1613')
    .split(',').map((s) => s.trim()).filter(Boolean),
  BROKER_NOMES: { '985': 'Edsel Vidolin', '1637': 'Elyas Kimiecek', '1613': 'Leandro Gomes' },

  // ── Firebase ──
  FIREBASE_URL: env('FIREBASE_DATABASE_URL').replace(/\/+$/, ''),
  FIREBASE_SECRET: env('FIREBASE_DB_SECRET'),

  // ── Z-API ──
  ZAPI: {
    INSTANCE: env('ZAPI_INSTANCE_ID'),
    TOKEN: env('ZAPI_TOKEN'),
    CLIENT_TOKEN: env('ZAPI_CLIENT_TOKEN'),
  },

  // ── Discadora ──
  DISCADORA: {
    MODE: env('DISCADORA_MODE', 'bitrix'),
    URL: env('DISCADORA_API_URL'),
    TOKEN: env('DISCADORA_API_TOKEN'),
  },

  KATZER_ALERT_PHONE: env('KATZER_ALERT_PHONE'),

  // ── Abertura Helena (form Meta patrocinado do Bruno → 1ª msg WhatsApp) ──
  // Conjunto Bitrix (AND) — exemplo FLAVIUS ALVES:
  //   FONTE/ORIGEM DO ANÚNCIO = "Patrocinado Corretor"
  //   RESPONSÁVEL = Bruno · ROLETA = Não · PRODUTO = Fort Myers
  //   + sem histórico WhatsApp (rota lead-form).
  BRUNO_BITRIX_ID: env('BRUNO_BITRIX_ID', '1'), // Auditor: Bruno Katzer = user 1
  // Tokens das campanhas/produtos que o Michel está patrocinando agora (ou novas).
  // Ex.: fort myers,grant,portugal,br_sc,brasileiros — atualizar quando ele criar.
  // NÃO prova que o lead é do Bruno — isso é o RESPONSÁVEL (ASSIGNED_BY_ID).
  CAMPANHAS_HELENA: env('HELENA_CAMPANHAS_BRUNO')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  // URL da rota da Helena que gera a abertura. Default: a propria URL do site (Netlify
  // injeta process.env.URL). Se vazio, a abertura NAO dispara.
  HELENA_ABERTURA_URL: env('HELENA_ABERTURA_URL') || (env('URL') ? `${env('URL')}/api/helena/lead-form` : ''),
  // Token compartilhado (server-to-server): a rota da Helena só aceita se bater. Vazio = rota
  // recusa (seguro por padrão). Setar o MESMO valor nos dois lados (Maestro e Helena).
  HELENA_ABERTURA_TOKEN: env('HELENA_ABERTURA_TOKEN'),

  // ── Retomada automática (patrocinado Bruno · Novos / Tentando Contato) ──
  // RETOMADA_AUTO=1 liga o cron; RETOMADA_MODO=producao manda WhatsApp (senão só simula).
  RETOMADA_AUTO: /^(1|on|true|sim)$/i.test(env('RETOMADA_AUTO', '')),
  RETOMADA_MODO: env('RETOMADA_MODO', 'homolog'),
  BRUNO_BITRIX_ID: env('BRUNO_BITRIX_ID', '1'),

  // ── Gatekeeper do piloto (antes de contato automático) ──
  // FAIL-CLOSED no cérebro: listas vazias bloqueiam. Defaults da fiação:
  // responsável=Bruno, origens=patrocinado corretor/facebook.
  // Campanha/produto Michel = HELENA_CAMPANHAS_BRUNO (ehLeadDoBruno).
  PILOTO: {
    DEAL_IDS: env('PILOTO_DEAL_IDS'),
    PHONES: env('PILOTO_PHONES'),
    CAMPANHAS: env('PILOTO_CAMPANHAS'),
    RESPONSAVEIS: env('PILOTO_RESPONSAVEIS'),
    ORIGENS: env('PILOTO_ORIGENS'),
    IDADE_MAX_DIAS: Number(env('PILOTO_IDADE_MAX_DIAS', '30')) || 30,
  },

  HTTP_TIMEOUT_MS: 20000,
  // 'producao' escreve no Bitrix; 'homolog' simula (loga o que ESCREVERIA) — pra testar sem risco.
  MODO: env('MAESTRO_MODO', 'producao'),
  // INTERRUPTOR PRÓPRIO DA SECRETÁRIA (independente do MODO dos leads). Default 'homolog':
  // ela NÃO escreve no Bitrix até o Conselheiro aprovar e alguém setar SECRETARIA_MODO=producao.
  SECRETARIA_MODO: env('SECRETARIA_MODO', 'homolog'),
  // INTERRUPTOR MESTRE do runner automático (a cada 2h). Vazio/0 = desligado (a rotina roda mas
  // não faz nada). '1'/'on' = ligado. Com AUTO ligado + MODO homolog = OBSERVAÇÃO (só avisa o
  // Bruno o que faria). Com AUTO ligado + MODO producao = escreve de verdade na zona verde.
  SECRETARIA_AUTO: /^(1|on|true|sim)$/i.test(env('SECRETARIA_AUTO', '')),
  SECRETARIA_CRON_LIMITE: Number(env('SECRETARIA_CRON_LIMITE', '25')) || 25,
};

// Origens validas (bate com o schema do lead do CEO)
export const ORIGENS = ['formulario_facebook', 'whatsapp_direto', 'bitrix_campanha'];
