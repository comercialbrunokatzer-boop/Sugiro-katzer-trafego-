// Garimpo Katzer — regras da auditoria (Parte 1).
// Qtd 0: sem nome/tel. Qtd >0: nome por lead. Alerta 0 ou ≥5.

export const QTD_OPTS = ['0', '1', '2', '3', '4', '5+'];

export function normalizaQtd(raw) {
  const s = String(raw ?? '').trim();
  if (s === '5') return '5';
  if (QTD_OPTS.includes(s)) return s;
  return null;
}

/** Número mínimo de leads esperados (5+ → pelo menos 5). */
export function qtdMinLeads(qtd) {
  if (qtd === '0') return 0;
  if (qtd === '5+') return 5;
  const n = Number(qtd);
  return Number.isFinite(n) ? n : 0;
}

export function normalizaLeads(body = {}) {
  const lista = Array.isArray(body.leads) ? body.leads : null;
  if (lista) {
    return lista.map((l) => ({
      nome: String(l?.nome || '').trim(),
      telefone: String(l?.telefone || l?.fone || '').trim() || null,
    }));
  }
  const nome = String(body.nome || '').trim();
  const telefone = String(body.telefone || body.fone || '').trim() || null;
  if (!nome && !telefone) return [];
  return [{ nome, telefone }];
}

/**
 * Valida payload Garimpo. Retorna { ok, erro?, meta }.
 * meta: { qtd, leads, alertaGestor, nomeResumo }
 */
export function validaGarimpo(body = {}) {
  const qtd = normalizaQtd(body.qtd);
  if (!qtd) {
    return { ok: false, erro: 'Garimpo: selecione a quantidade (0 a 5+).' };
  }

  if (qtd === '0') {
    return {
      ok: true,
      meta: {
        qtd: '0',
        leads: [],
        nome: 'Nenhum lead encontrado',
        telefone: null,
        alertaGestor: true,
      },
    };
  }

  const filled = normalizaLeads(body).map((l) => ({
    nome: l.nome,
    telefone: l.telefone,
  }));

  const min = qtdMinLeads(qtd);
  const validos = filled.filter((l) => l.nome.length >= 3);
  if (validos.length < min) {
    return {
      ok: false,
      erro: `Garimpo: informe o nome completo de cada lead (${min} obrigatório${min > 1 ? 's' : ''} para qtd ${qtd}).`,
    };
  }
  // Aceita exatamente min (ou mais se 5+)
  const leadsFinal = validos.slice(0, Math.max(min, validos.length));
  if (qtd !== '5+' && leadsFinal.length !== min) {
    // se mandou a mais, corta; se a menos já falhou acima
  }

  const alertaGestor = qtd === '5+' || Number(qtd) >= 5;
  return {
    ok: true,
    meta: {
      qtd,
      leads: leadsFinal,
      nome: leadsFinal.map((l) => l.nome).join(' · '),
      telefone: leadsFinal.map((l) => l.telefone).filter(Boolean).join(' · ') || null,
      alertaGestor,
    },
  };
}

/** Mensagem canônica do alerta gestor (doc auditoria). */
export function mensagemAlertaGarimpo({ qtd, dataHm, leads = [] }) {
  const linhas = [
    `GARIMPO KATZER: Michel encontrou *${qtd}* hoje - ${dataHm}`,
  ];
  if (qtd === '0') linhas.push('→ Atenção: dia zerado');
  else if (qtd === '5+' || Number(qtd) >= 5) linhas.push('→ 🔥 Dia excelente!');
  for (const l of leads) {
    linhas.push(`· ${l.nome}${l.telefone ? ` · ${l.telefone}` : ''}`);
  }
  return linhas.join('\n');
}
