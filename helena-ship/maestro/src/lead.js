/**
 * Normalizacao e validacao do lead (regra #4: nada existe em um so sistema — aqui ele
 * vira um formato unico). Espelha o schema do CEO. Telefone vira a CHAVE de deduplicacao.
 */
import { ORIGENS } from './config.js';

export function soDigitos(tel = '') {
  return (tel || '').toString().replace(/\D+/g, '');
}

/** Chave de dedup: ultimos 10-11 digitos (ignora +55 / DDI), pra bater o mesmo numero. */
export function chaveTelefone(tel = '') {
  const d = soDigitos(tel);
  if (!d) return '';
  return d.length > 11 ? d.slice(-11) : d;
}

/** Normaliza qualquer entrada num lead canonico. Lanca se faltar o minimo (telefone). */
export function normalizaLead(bruto = {}, origemPadrao = null) {
  const telefone = (bruto.telefone || bruto.phone || bruto.number || '').toString().trim();
  const chave = chaveTelefone(telefone);
  if (!chave) {
    const e = new Error('lead sem telefone valido');
    e.code = 'LEAD_SEM_TELEFONE';
    throw e;
  }
  const origem = ORIGENS.includes(bruto.origem) ? bruto.origem : (origemPadrao || 'whatsapp_direto');
  const num = (v) => {
    const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    leadId: bruto.leadId || chave,
    chave,
    nome: (bruto.nome || bruto.name || '').toString().trim() || null,
    telefone,
    email: (bruto.email || '').toString().trim() || null,
    origem,
    interesse: (bruto.interesse || '').toString().trim() || null,
    // Campanha do anúncio (Meta). Aceita vários formatos porque o webhook do Meta pode
    // mandar por nomes diferentes (campanha, campaign_name, utm_campaign, form_name...).
    campanha: (bruto.campanha || bruto.campaign_name || bruto.utm_campaign
      || bruto.form_name || bruto.ad_name || bruto.form_id || '').toString().trim() || null,
    finalidade: (bruto.finalidade || '').toString().trim() || null,      // veraneio|moradia|investimento
    orcamento_max: num(bruto.orcamento_max),
    perfil_decisor: (bruto.perfil_decisor || '').toString().trim() || null,
    estagio: (bruto.estagio || '').toString().trim() || null,            // pesquisando|comparando|pronto
    observacoes: (bruto.observacoes || '').toString().trim() || null,
    nivel: (bruto.nivel || '').toString().trim() || null,                // quente|morno|frio
    timestamp: bruto.timestamp || new Date().toISOString(),
  };
}
