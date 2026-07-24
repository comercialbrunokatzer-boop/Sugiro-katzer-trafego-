/**
 * LEITOR da conversa da Helena no Firebase (RTDB REST) — SÓ LEITURA.
 * A Helena grava em `helena_conversas/<fk>` (fk = só dígitos do telefone).
 * A Secretária lê essa conversa aqui pra interpretar a etapa/campos SEM tocar
 * na conversa. Nada é escrito. fetch injetável -> 100% testável sem rede.
 */

/** Chave do Firebase: só os dígitos do telefone (igual ao normalizePhone da Helena). */
export function chaveConversa(tel = '') {
  return String(tel || '').replace(/\D+/g, '');
}

/**
 * Candidatos de chave pra MESMA pessoa. O WhatsApp/Z-API salva número BR com variação
 * de país (55) e do 9º dígito do celular — então a busca EXATA erra por 1 dígito. Aqui
 * geramos todas as formas plausíveis (com/sem 55, com/sem 9) e a busca tenta cada uma.
 * Ex.: "5548999814075" -> ["5548999814075","48999814075","554899814075","4899814075", ...].
 */
export function candidatosChave(tel = '') {
  const d = String(tel || '').replace(/\D+/g, '');
  const out = [];
  const add = (x) => { if (x && x.length >= 10 && !out.includes(x)) out.push(x); };
  if (!d) return out;
  add(d); // como veio (dígitos)
  let nac = d;
  if (nac.startsWith('55') && nac.length >= 12) nac = nac.slice(2); // tira país
  if (nac.length >= 10) {
    const ddd = nac.slice(0, 2);
    const resto = nac.slice(2); // 8 ou 9 dígitos
    let com9 = resto; let sem9 = resto;
    if (resto.length === 9 && resto[0] === '9') sem9 = resto.slice(1);
    else if (resto.length === 8) com9 = `9${resto}`;
    for (const r of [resto, com9, sem9]) {
      add(ddd + r);          // nacional (DDD + número)
      add(`55${ddd}${r}`);   // com país
    }
  }
  return out;
}

/**
 * Forma canônica de um telefone BR pra COMPARAÇÃO tolerante: DDD (2) + últimos 8 dígitos.
 * Absorve as duas variações que quebram o reconhecimento: com/sem país (55) e com/sem o
 * 9º dígito do celular. Ex. (fictício): "5547999990000", "47999990000" e "4799990000" -> "4799990000".
 */
export function canonTelBR(tel = '') {
  let d = String(tel || '').replace(/\D+/g, '');
  if (!d) return '';
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2); // tira país
  if (d.length >= 10) return d.slice(0, 2) + d.slice(-8);   // DDD + 8 finais
  return d;
}

/** Dois telefones são a MESMA pessoa? Tolerante a 55/9º dígito. Vazio nunca casa. */
export function mesmoTelefone(a, b) {
  const x = canonTelBR(a); const y = canonTelBR(b);
  return !!x && x === y;
}

/** Tira barras finais e um /path colado; devolve a base https da RTDB. */
export function baseFirebase(raw) {
  return String(raw || '').trim().replace(/\/+$/, '');
}

/**
 * Monta a URL REST da conversa. auth (opcional) = DB secret/token, quando as
 * regras do RTDB exigem autenticação pra ler.
 */
export function montaUrlConversa(base, tel, auth = '') {
  const b = baseFirebase(base);
  if (!b) throw new Error('FIREBASE_DATABASE_URL ausente/vazio');
  const fk = chaveConversa(tel);
  if (!fk) throw new Error('telefone inválido');
  const q = auth ? `?auth=${encodeURIComponent(auth)}` : '';
  return `${b}/helena_conversas/${fk}.json${q}`;
}

/**
 * Lê a conversa (payload salvo pela Helena) do Firebase. Devolve o objeto
 * { messages, leadData, handledByHuman, flags, ... } ou null se não existir.
 */
export async function leConversa(tel, {
  base = process.env.FIREBASE_DATABASE_URL,
  auth = process.env.FIREBASE_DB_SECRET || '',
  fetchFn = globalThis.fetch,
} = {}) {
  if (typeof fetchFn !== 'function') throw new Error('fetch indisponível no runtime');
  const cands = candidatosChave(tel);
  if (!cands.length) throw new Error('telefone inválido');
  // Tenta cada variação (com/sem 55, com/sem 9) até achar a conversa.
  for (const fk of cands) {
    const url = montaUrlConversa(base, fk, auth);
    const r = await fetchFn(url);
    if (!r.ok) throw new Error(`Firebase HTTP ${r.status}`);
    let j = null;
    try { j = await r.json(); } catch { j = null; }
    if (j != null) return j; // RTDB devolve `null` quando o nó não existe.
  }
  return null;
}
