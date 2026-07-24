// Classificação pura do status da Meta (sem I/O) — erro NUNCA vira “R$ 0 real”.

/** Mensagem segura pro painel (sem token). */
export function mensagemMeta(meta = {}) {
  switch (meta.status) {
    case 'ok':
      return null;
    case 'sem_gasto':
      return 'Nenhum gasto registrado nos últimos 7 dias.';
    case 'sem_campanha':
      return 'Nenhuma campanha encontrada na conta configurada.';
    case 'token_ausente':
    case 'token_invalido':
    case 'permissao':
    case 'conta_inacessivel':
      return 'Não foi possível acessar os dados da Meta. Integração precisa de correção.';
    case 'erro_temporario':
      return meta.ultimaLeituraValida
        ? `Dados temporariamente indisponíveis. Última leitura válida: ${meta.ultimaLeituraValida}.`
        : 'Dados da Meta indisponíveis.';
    default:
      return 'Dados da Meta indisponíveis.';
  }
}

/**
 * Classifica o resultado da Meta (puro — testável).
 */
export function classificaMetaResultado({
  temToken, httpOk, bodyError, nBruto, nComGasto, conta, etapa = 'insights',
} = {}) {
  const base = { conta: conta || '', etapa, confiavel: false };
  if (!temToken) {
    return {
      ...base, status: 'token_ausente', codigo: 'META_TOKEN_AUSENTE',
      mensagemPainel: mensagemMeta({ status: 'token_ausente' }),
    };
  }
  if (bodyError) {
    const code = Number(bodyError.code) || 0;
    const msg = String(bodyError.message || '').toLowerCase();
    let status = 'erro_temporario';
    if (code === 190 || msg.includes('session') || msg.includes('expired') || msg.includes('invalid')) {
      status = 'token_invalido';
    } else if (code === 10 || code === 200 || msg.includes('permission')) {
      status = 'permissao';
    } else if (msg.includes('unsupported get request') || msg.includes('does not exist')) {
      status = 'conta_inacessivel';
    }
    return {
      ...base, status, codigo: String(bodyError.code || bodyError.type || 'META_API_ERROR'),
      mensagemPainel: mensagemMeta({ status }),
    };
  }
  if (!httpOk) {
    return {
      ...base, status: 'erro_temporario', codigo: 'META_HTTP',
      mensagemPainel: mensagemMeta({ status: 'erro_temporario' }),
    };
  }
  if ((nBruto || 0) === 0) {
    return {
      ...base, status: 'sem_campanha', codigo: 'SEM_CAMPANHA', confiavel: true,
      mensagemPainel: mensagemMeta({ status: 'sem_campanha' }),
    };
  }
  if ((nComGasto || 0) === 0) {
    return {
      ...base, status: 'sem_gasto', codigo: 'SEM_GASTO', confiavel: true,
      mensagemPainel: mensagemMeta({ status: 'sem_gasto' }),
    };
  }
  return {
    ...base, status: 'ok', codigo: 'OK', confiavel: true,
    mensagemPainel: null,
  };
}
