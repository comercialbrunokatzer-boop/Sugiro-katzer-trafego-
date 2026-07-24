/**
 * Autorização Meta — só o Michel clica (Manter / Parar / Orçamento).
 * Bruno (gestor) vê o feed; NÃO executa na Meta por esta API.
 */
import { createHash } from 'node:crypto';

/** SHA-256 de "MichelMeta2026" — troque via MICHEL_DECISAO_KEY no Netlify. */
export const MICHEL_HASH_PADRAO = '54cd1cf7b5c6f08b4265e93c65941a6d79981b043774e2c7310c611b42dd2ad8';

/** Hash do gestor (Davi2026@) — leitura só; NUNCA libera clique Meta. */
export const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';

export function sha256(texto) {
  return createHash('sha256').update(String(texto || '')).digest('hex');
}

export function hashMichelEsperado() {
  const envKey = String(process.env.MICHEL_DECISAO_KEY || '').trim();
  if (envKey) return sha256(envKey);
  return MICHEL_HASH_PADRAO;
}

export function extraiChaveMichel(event = {}, body = {}) {
  const h = event.headers || {};
  const params = event.queryStringParameters || {};
  return String(
    h['x-michel-key']
    || h['X-Michel-Key']
    || body.michelKey
    || body.michel_key
    || params.michelKey
    || '',
  ).trim();
}

export function extraiChaveGestor(event = {}, body = {}) {
  const h = event.headers || {};
  const params = event.queryStringParameters || {};
  return String(
    h['x-gestor-key']
    || h['X-Gestor-Key']
    || body.gestorKey
    || params.k
    || '',
  ).trim();
}

export function senhaGestorOk(event = {}, body = {}) {
  const chave = extraiChaveGestor(event, body);
  if (!chave) return false;
  return sha256(chave) === GESTOR_HASH;
}

/**
 * Só Michel. Gestor key NÃO passa (mesmo se correta).
 * @returns {{ ok: boolean, motivo?: string }}
 */
export function autorizaCliqueMichel(event = {}, body = {}) {
  const chave = extraiChaveMichel(event, body);
  if (!chave) {
    return {
      ok: false,
      motivo: 'Só o Michel pode clicar na Meta. Informe a chave (x-michel-key).',
      precisaMichel: true,
    };
  }
  // Bloqueia uso da senha do gestor como se fosse Michel
  if (sha256(chave) === GESTOR_HASH) {
    return {
      ok: false,
      motivo: 'Senha do gestor não executa Meta — só o Michel clica.',
      precisaMichel: true,
    };
  }
  if (sha256(chave) !== hashMichelEsperado()) {
    return {
      ok: false,
      motivo: 'Chave do Michel inválida. Meta não alterada.',
      precisaMichel: true,
    };
  }
  return { ok: true, quem: 'Michel' };
}
