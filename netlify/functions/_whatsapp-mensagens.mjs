/**
 * Textos WhatsApp explícitos — Bruno precisa entender SEM abrir o código.
 * Regra: toda automação explica O QUE É · O QUE NÃO É · O QUE FAZER.
 */

export function isDemoLead(lead = {}) {
  return lead?.fonte === 'demo'
    || String(lead?.id || '').startsWith('demo-')
    || /vermelho|joão silva|joao silva/i.test(String(lead?.nome || ''));
}

/** Chave de dedupe: 1 TRAVA WhatsApp por lead por dia. */
export function chaveTrava(dataBRT, leadId) {
  return `${dataBRT}|trava|${leadId || 'x'}`;
}

/** Filtra leads vermelhos que ainda não avisamos hoje. */
export function filtrarTravaPendentes(leadsVermelhos = [], enviados = {}, dataBRT = '') {
  const pendentes = [];
  const chaves = [];
  for (const l of leadsVermelhos || []) {
    const id = String(l.id || l.nome || '').trim();
    const k = chaveTrava(dataBRT, id);
    if (enviados[k]) continue;
    pendentes.push(l);
    chaves.push(k);
  }
  return { pendentes, chaves };
}

/**
 * TRAVA vermelha = status "Saiu" sem Qualidade Real A/B/C/D.
 * NÃO significa "lead sem potencial". Significa FALTOU REGISTRAR a nota final.
 */
export function mensagemTravaSaiuSemQualidadeReal({
  leads = [],
  hm = '',
  data = '',
} = {}) {
  const lista = (leads || []).filter((l) => !isDemoLead(l));
  const n = lista.length || leads.length;
  const quando = [hm, data].filter(Boolean).join(' · ');
  const nomes = (lista.length ? lista : leads).slice(0, 8).map((l) => {
    const camp = l.campanha ? ` · ${l.campanha}` : '';
    const corr = l.corretor ? ` · corretor: ${l.corretor}` : '';
    return `· *${l.nome || 'Lead'}*${camp}${corr}`;
  });

  return [
    '🔴 *TRAVA DE AUDITORIA — Caçador*',
    quando ? `⏰ ${quando}` : null,
    '',
    '*O que é isso?*',
    'O lead foi marcado como *Saiu* (saiu do mapeamento / não segue no funil),',
    'mas ninguém preencheu a *Qualidade Real* (nota A/B/C/D) no painel Caçador.',
    '',
    '*O que NÃO é?*',
    'Não quer dizer automaticamente que o lead “não tinha potencial”.',
    'Quer dizer que a *nota final ficou em branco* — processo incompleto.',
    '',
    '*O que fazer agora?*',
    '1) Abrir o Caçador (App Qualidade)',
    '2) No lead abaixo, marcar Qualidade Real:',
    '   A = Pronto até 3 meses',
    '   B = Quase pronto (4–12 meses)',
    '   C = Futuro / Curioso',
    '   D = Sem perfil',
    '3) Até marcar, a trava continua (e o avanço no Bitrix fica bloqueado nessa regra).',
    '',
    `*Lead(s) travado(s) (${n}):*`,
    ...nomes,
    n > 8 ? `… +${n - 8} outros` : null,
  ].filter((x) => x != null && x !== false).join('\n');
}

/** 1 toque BOM / COMPRADOR no Caçador. */
export function mensagemCacadorMarca({
  qualidade,
  nome,
  campanha,
  telefone,
  isDemo = false,
  fonte = null,
  hm = '',
} = {}) {
  const q = String(qualidade || '').toLowerCase();
  const label = q === 'comprador' ? 'COMPRADOR' : 'BOM';
  const ico = q === 'comprador' ? '💰' : '🟢';
  const linhas = [
    isDemo
      ? '⚠️ *TESTE/DEMO* — lead de treino · *NÃO está no Bitrix* · ignore na operação'
      : (fonte === 'bitrix' || fonte === 'FACEBOOK ADS' || fonte === 'PATROCINADO CORRETOR'
        ? '✅ Lead *real* (tráfego/Bitrix)'
        : '📋 Marca do Caçador (CPL BOM)'),
    '',
    '*O que é isso?*',
    `Michel (ou corretor) deu 1 toque *${label}* no Caçador.`,
    'Isso alimenta o *CPL BOM* da campanha (lead bom de verdade, não só form barato).',
    '',
    `${ico} Caçador — *${label}* · ${nome || 'Lead'}${campanha ? ` · ${campanha}` : ''}`,
    telefone && telefone !== '—' ? `Tel: ${telefone}` : null,
    hm ? `⏰ ${hm}` : null,
  ];
  return linhas.filter(Boolean).join('\n');
}
