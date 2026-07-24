// Configurações públicas da Meta (IDs de config, NÃO secrets).
// Importe daqui — nunca espalhe esses valores pelo código.

/** Conta de anúncios padrão. Sobrescrita por META_AD_ACCOUNT se definida. */
export const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT || 'act_1150648749960943';

/** Base URL da Graph API. Sobrescrita por META_GRAPH se definida. */
export const META_GRAPH = process.env.META_GRAPH || 'https://graph.facebook.com/v20.0';
