/**
 * CARTÃO DO LEAD — o alerta que cai no WhatsApp do CEO (formato oficial travado pelo CEO).
 * Puro e testável: recebe o lead canônico, devolve o texto pronto pra Helena/Z-API disparar.
 * Campos vazios são omitidos (card limpo — nunca mostra "[cidade]" em branco).
 */
const NIVEL = { quente: '🔥 Quente', morno: '🟡 Morno', frio: '🔵 Frio' };
const ORIGEM = {
  formulario_facebook: 'Formulário Facebook',
  whatsapp_direto: 'WhatsApp',
  bitrix_campanha: 'Campanha Bitrix',
};

function brl(n) {
  if (!n) return null;
  try { return 'R$ ' + Number(n).toLocaleString('pt-BR'); } catch { return 'R$ ' + n; }
}

export function composeCartao(lead, { campanha } = {}) {
  const camp = (campanha || lead.campanha || lead.interesse || '').trim();
  const nivel = NIVEL[String(lead.nivel || '').toLowerCase()] || '⚪ A conferir';
  const origem = ORIGEM[lead.origem] || lead.origem || 'tráfego pago';
  const veio = camp ? `${origem} — ${camp}` : origem;

  const L = [];
  L.push(`💎 LEAD DE TRÁFEGO PAGO${camp ? ' — ' + camp.toUpperCase() : ''}`);
  L.push(nivel + (lead.estagio ? ` — ${lead.estagio}` : ''));
  L.push('');
  if (lead.nome) L.push(`👤 ${lead.nome}`);
  if (lead.telefone) L.push(`📞 ${lead.telefone}`);
  if (lead.email) L.push(`✉️ ${lead.email}`);
  if (lead.cidade || lead.estado) L.push(`📍 ${[lead.cidade, lead.estado].filter(Boolean).join(' / ')}`);
  L.push('');
  if (lead.orcamento_max) L.push(`💰 Faixa: ${brl(lead.orcamento_max)}`);
  if (lead.finalidade) L.push(`🎯 Objetivo: ${lead.finalidade}`);
  if (lead.estagio) L.push(`⏱ Prazo: ${lead.estagio}`);
  L.push(`📢 Veio de: ${veio}`);
  L.push('');
  L.push('👉 Você liga ou a Helena liga? Cliente esperando.');
  return L.join('\n');
}
