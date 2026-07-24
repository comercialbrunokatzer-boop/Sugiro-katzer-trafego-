// Garimpo Katzer — regras da auditoria (Parte 1) + multi-cliente.
// Qtd 0: sem nome/tel. Qtd >0: nome completo + celular obrigatórios por lead.
// Aceita quantos leads o Michel preencher (2, 3, 10…).

export const QTD_OPTS = ['0', '1', '2', '3', '4', '5+'];

export function normalizaQtd(raw) {
  const s = String(raw ?? '').trim();
  if (s === '5') return '5';
  if (QTD_OPTS.includes(s)) return s;
  const n = Number(s);
  if (Number.isFinite(n) && n >= 5) return '5+';
  if (Number.isFinite(n) && n >= 0 && n <= 4) return String(n);
  return null;
}

/** Número mínimo de leads esperados (5+ → pelo menos 5). */
export function qtdMinLeads(qtd) {
  if (qtd === '0') return 0;
  if (qtd === '5+') return 5;
  const n = Number(qtd);
  return Number.isFinite(n) ? n : 0;
}

/** Celular BR: pelo menos 10 dígitos (DDD + número). */
export function celularOk(tel) {
  const d = String(tel || '').replace(/\D+/g, '');
  return d.length >= 10 && d.length <= 13;
}

export function normalizaLeads(body = {}) {
  const lista = Array.isArray(body.leads) ? body.leads : null;
  if (lista) {
    return lista.map((l) => ({
      nome: String(l?.nome || '').trim(),
      telefone: String(l?.telefone || l?.fone || l?.celular || '').trim() || null,
    }));
  }
  const nome = String(body.nome || '').trim();
  const telefone = String(body.telefone || body.fone || body.celular || '').trim() || null;
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

  const filled = normalizaLeads(body);
  const min = qtdMinLeads(qtd);

  const incompleto = filled.find((l) => !l.nome || l.nome.length < 3 || !celularOk(l.telefone));
  if (incompleto) {
    const faltaNome = !incompleto.nome || incompleto.nome.length < 3;
    return {
      ok: false,
      erro: faltaNome
        ? 'Garimpo: informe o nome completo de cada cliente.'
        : 'Garimpo: informe o celular de cada cliente (DDD + número).',
    };
  }

  const validos = filled.filter((l) => l.nome.length >= 3 && celularOk(l.telefone));
  if (validos.length < min) {
    return {
      ok: false,
      erro: `Garimpo: cadastre pelo menos ${min} cliente(s) com nome completo e celular (qtd ${qtd}).`,
    };
  }

  // Aceita mais do que o mínimo (Michel pode ter 6, 10… quando escolheu 5+ ou adicionou linhas)
  const leadsFinal = validos;
  const qtdFinal = leadsFinal.length >= 5 ? '5+' : String(leadsFinal.length);
  const alertaGestor = qtdFinal === '5+' || Number(qtdFinal) >= 5;

  return {
    ok: true,
    meta: {
      qtd: qtdFinal,
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
