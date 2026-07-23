// Configurações públicas da Meta (IDs de config, NÃO secrets).
// Importe daqui — nunca espalhe esses valores pelo código.

/** Conta de anúncios padrão. Sobrescrita por META_AD_ACCOUNT se definida. */
export const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT || 'act_1150648749960943';

/** Base URL da Graph API. Sobrescrita por META_GRAPH se definida. */
export const META_GRAPH = process.env.META_GRAPH || 'https://graph.facebook.com/v20.0';

// IDs de referência opcionais — lidos do ambiente se existirem.
export const META_APP_ID         = process.env.META_APP_ID         || null;
export const META_BUSINESS_ID    = process.env.META_BUSINESS_ID    || null;
export const META_PAGE_ID        = process.env.META_PAGE_ID        || null;
export const META_INSTAGRAM_ID   = process.env.META_INSTAGRAM_ID   || null;
export const META_SYSTEM_USER_ID = process.env.META_SYSTEM_USER_ID || null;
