// Mix de verba oficial (Bruno) — manter 80% onde já vende.
// Arquivo "_" = NÃO vira função Netlify.

import { slugMix } from './_mapeamento-v41.mjs';

/** 80% da verba nas 4 frentes que já vendem. */
export const MIX_VERBA_80 = [
  {
    chave: 'amanay',
    slug: 'AMANAY_ITAPOA_ROGGA_BR-SC',
    produto: 'Amanay',
    cidade: 'Itapoá',
    construtora: 'Rogga',
    publico: 'BR-SC',
    pct: 30,
  },
  {
    chave: 'fort_myers',
    slug: 'FORTMYERS_PENHA_VETTER_BR-SC',
    produto: 'Fort Myers',
    cidade: 'Penha',
    construtora: 'Vetter',
    publico: 'BR-SC',
    pct: 20,
  },
  {
    chave: 'barra_view',
    slug: 'BARRAVIEW_BARRAVELHA_SANTER_BR-SC',
    produto: 'Barra View',
    cidade: 'Barra Velha',
    construtora: 'Santer',
    publico: 'BR-SC',
    pct: 15,
  },
  {
    chave: 'grant_home',
    slug: 'GRANTHOME_BARRAVELHA_ROGGA_BR-SC',
    produto: 'Grant Home',
    cidade: 'Barra Velha',
    construtora: 'Rogga',
    publico: 'BR-SC',
    pct: 15,
  },
];

export const MIX_VERBA_TOTAL_PCT = MIX_VERBA_80.reduce((s, x) => s + x.pct, 0); // 80

/**
 * @param {number} verbaTotalDia — orçamento total do dia (R$)
 * @returns {{ ok, regra, totalPct, linhas, sobraPct }}
 */
export function montaMixVerba(verbaTotalDia = null) {
  const total = Number(verbaTotalDia);
  const temVerba = Number.isFinite(total) && total > 0;
  const linhas = MIX_VERBA_80.map((m) => ({
    ...m,
    slug: m.slug || slugMix(m.produto, m.cidade, m.construtora, m.publico),
    valorDia: temVerba ? Math.round((total * m.pct) / 100) : null,
  }));
  return {
    ok: true,
    regra: 'Mantém 80% da verba onde já vende (BR-SC). Sem estrutura EN → lead EN = Curioso.',
    totalPct: MIX_VERBA_TOTAL_PCT,
    sobraPct: 100 - MIX_VERBA_TOTAL_PCT,
    verbaTotalDia: temVerba ? total : null,
    linhas,
  };
}
