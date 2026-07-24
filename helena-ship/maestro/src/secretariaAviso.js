/**
 * AVISO DA SECRETÁRIA — como ela PERGUNTA pro Bruno no WhatsApp (zona vermelha) e como
 * o "pode / não / ajusta" dele cai na PERGUNTA CERTA.
 *
 * Regra do CEO:
 *  - Zona VERDE (até a reunião): a Secretária aplica sozinha, NÃO pergunta.
 *  - Zona VERMELHA (Negociação+): ela PROPÕE e espera o OK do Bruno.
 *  - Tudo vem pelo número da Helena (Z-API) -> celular do Bruno, com etiqueta 🗂️
 *    (a Helena fala com o CLIENTE; a Secretária fala com o CHEFE — canais separados
 *    por QUEM fala, então não tem interferência).
 *  - Se tiver mais de uma pendência ao mesmo tempo, ela NUMERA pra não misturar.
 *
 * Este módulo é PURO (sem Z-API/Firebase): formata a pergunta e interpreta a resposta.
 * O envio real e a escrita no Bitrix são o wiring do Maestro (só em produção).
 */

export const PREFIXO_SECRETARIA = '🗂️ SECRETÁRIA';

/** Só os dígitos de um telefone (chave estável do store, tolerante a formatação). */
export function soDigitos(tel) {
  return String(tel || '').replace(/\D+/g, '');
}

/**
 * Monta o texto que vai pro WhatsApp do Bruno.
 * @param {object} prop  { cliente, telefone, produto, de, para, motivo }
 * @param {object} opts  { ordem, total } — pra numerar quando há várias pendências
 */
export function formatPergunta(prop = {}, { ordem = 1, total = 1 } = {}) {
  const { cliente = 'Lead sem nome', telefone = '', produto = '', de = '', para = '', motivo = '' } = prop;
  const cabecalho = total > 1
    ? `${PREFIXO_SECRETARIA} · preciso do teu ok (${ordem}/${total})`
    : `${PREFIXO_SECRETARIA} · preciso do teu ok`;
  const linhas = [
    `*${cabecalho}*`,
    '',
    `*👤 Cliente:* ${cliente}${telefone ? ` (${telefone})` : ''}`,
  ];
  if (produto) linhas.push(`*🏠 Produto:* ${produto}`);
  linhas.push(`*↪️ Sugiro mover:* ${de ? `${de} → ` : ''}*${para}*`);
  if (motivo) linhas.push(`*📝 Porquê:* ${motivo}`);
  linhas.push('');
  linhas.push(total > 1
    ? `Responde com o número + *pode* / *não* (ex.: "${ordem} pode"), ou me diz a etapa certa.`
    : 'Responde: *pode* / *não* / ou me diz a etapa certa.');
  return linhas.join('\n');
}

/** Registra uma pendência aguardando o OK do Bruno. store = Map(adminDigits -> array). */
export function registraPendencia(store, adminPhone, pendencia = {}) {
  const k = soDigitos(adminPhone);
  const lista = store.get(k) || [];
  lista.push({ ts: pendencia.ts || 0, ...pendencia });
  store.set(k, lista);
  return lista.length;
}

/** Pendências abertas de um admin (ordem de chegada). */
export function pendenciasDe(store, adminPhone) {
  return store.get(soDigitos(adminPhone)) || [];
}

/** Remove uma pendência resolvida do store. */
export function resolvePendencia(store, adminPhone, pendencia) {
  const k = soDigitos(adminPhone);
  const lista = (store.get(k) || []).filter((p) => p !== pendencia);
  if (lista.length) store.set(k, lista); else store.delete(k);
  return lista.length;
}

const RX_POSITIVO = /\b(pode|podes|sim|isso|ok|okay|beleza|blz|fechado|fechou|manda|aplica|confirmo|confirmado|autoriz\w*|libera|libero|correto|exato|certo)\b|👍|✅/i;
const RX_NEGATIVO = /\b(n[aã]o|nao|nega\w*|negativo|espera|aguarda|ainda\s+n[aã]o|agora\s+n[aã]o|nem|cancela|segura)\b|👎|❌/i;
const RX_AJUSTE   = /\b(muda|troca|na\s+verdade|na\s+real|coloca|p[oõ]e|bota|marca\s+(como|pra|em)|deixa\s+em|deixa\s+(no|na)|ajusta|melhor\s+(deixa|coloca|pra|p[oõ]e))\b/i;

/**
 * Interpreta a resposta do Bruno e casa com a pendência certa.
 * @returns {object} {
 *   acao: 'APLICAR' | 'RECUSAR' | 'AJUSTAR' | 'AMBIGUO' | 'SEM_PENDENCIA',
 *   pendencia?, ajuste?, motivo?
 * }
 * Em APLICAR/RECUSAR/AJUSTAR a pendência já sai do store (resolvida).
 */
export function interpretaResposta(store, adminPhone, texto) {
  const lista = pendenciasDe(store, adminPhone);
  if (!lista.length) return { acao: 'SEM_PENDENCIA' };
  const t = String(texto || '').trim();

  // 1) Escolher a pendência-alvo quando há várias.
  let alvo = null;
  if (lista.length === 1) {
    alvo = lista[0];
  } else {
    // (a) por número no começo/qualquer lugar: "2 pode", "pode a 2"
    const mNum = t.match(/(?:^|\D)([1-9])\b/);
    if (mNum) {
      const idx = parseInt(mNum[1], 10) - 1;
      if (idx >= 0 && idx < lista.length) alvo = lista[idx];
    }
    // (b) por nome do cliente citado
    if (!alvo) {
      alvo = lista.find((p) => {
        const primeiro = String(p.cliente || '').trim().split(/\s+/)[0];
        return primeiro && primeiro.length >= 3
          && new RegExp(`\\b${primeiro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t);
      }) || null;
    }
    if (!alvo) {
      return { acao: 'AMBIGUO', motivo: 'Mais de uma pendência aberta e a resposta não disse qual (número ou nome).' };
    }
  }

  // 2) Ação sobre a pendência-alvo (ajuste tem prioridade: "não, deixa em X" = redirecionar).
  if (RX_AJUSTE.test(t)) {
    resolvePendencia(store, adminPhone, alvo);
    return { acao: 'AJUSTAR', pendencia: alvo, ajuste: t };
  }
  if (RX_NEGATIVO.test(t)) {
    resolvePendencia(store, adminPhone, alvo);
    return { acao: 'RECUSAR', pendencia: alvo };
  }
  if (RX_POSITIVO.test(t)) {
    resolvePendencia(store, adminPhone, alvo);
    return { acao: 'APLICAR', pendencia: alvo };
  }
  return { acao: 'AMBIGUO', pendencia: alvo, motivo: 'Não deu pra entender se é pode / não / ajuste.' };
}
