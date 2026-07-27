/**
 * Painel Katzer OS — custo por venda + funil por etapa + parecer por conjunto (adset).
 * Make: Campanha Origem = campaign_name · Conjunto Origem = adset_name.
 */
import { ORDEM_FUNIL, normalizaNomeFase, linkWhatsApp, portalBase } from './_bitrix-funil.mjs';

/** Etapas do card Funil de Conversão (CEO). */
export const ETAPAS_FUNIL_PAINEL = [
  { id: 'mapeamento', label: 'Mapeamento', fases: ['Mapeamento', 'Aprovação Viagem', 'Cliente em viagem'] },
  { id: 'agendaram', label: 'Agendaram', fases: ['Agendamento Meetins', 'Reagendamento de Visita'] },
  { id: 'atenderam', label: 'Atenderam', fases: ['Agendado Físico', 'Follow Up', 'Negociação'] },
  { id: 'proposta', label: 'Proposta', fases: ['Proposta', 'Contrato', 'Aprovação Exceção', 'Exceção'] },
  { id: 'vendas', label: 'Vendas', fases: ['Ganhou'] },
];

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function brl(v, dig = 2) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `R$${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dig, maximumFractionDigits: dig })}`;
}

/**
 * Garante bitrixUrl (deal/lead id) + whatsappUrl (telefone).
 * Nunca devolver lead com id sem link Bitrix.
 */
export function normalizaLeadLinks(l = {}) {
  const id = l.id != null ? String(l.id) : '';
  const isDemo = id.startsWith('demo-');
  let bitrixUrl = l.bitrixUrl || null;
  if (!bitrixUrl && id && !isDemo) {
    const path = l.tipo === 'lead' || l.entityType === 'lead'
      ? `/crm/lead/details/${id}/`
      : `/crm/deal/details/${id}/`;
    bitrixUrl = `${portalBase()}${path}`;
  }
  if (bitrixUrl) {
    bitrixUrl = String(bitrixUrl).replace(
      /https?:\/\/katzer\.bitrix24\.com\.br/gi,
      portalBase(),
    );
  }
  const telefone = l.telefone || null;
  const whatsappUrl = l.whatsappUrl || linkWhatsApp(telefone) || null;
  return {
    id: l.id ?? null,
    nome: l.nome || l.nomeContato || l.title || (id ? `Lead #${id}` : 'Lead'),
    contactId: l.contactId || null,
    bitrixUrl,
    whatsappUrl,
    telefone,
    fase: l.fase || null,
    temBitrix: !!bitrixUrl,
    temWhatsApp: !!whatsappUrl,
  };
}

/**
 * Conta leads na etapa (fase ATUAL ∈ fases da etapa).
 * Não é cumulativo — bate com o mock do CEO (ex.: 2 vendas e 1 proposta).
 */
export function contaEtapa(deals = [], etapa) {
  const set = new Set((etapa.fases || []).map((f) => normalizaNomeFase(f)));
  const leads = [];
  for (const d of deals || []) {
    const fase = normalizaNomeFase(d.fase || d.stageId);
    if (set.has(fase)) leads.push(d);
  }
  return { n: leads.length, leads };
}

/**
 * Funil com custo por etapa = gasto / n.
 */
export function montaFunilCusto({ gasto = 0, deals = [], fases = [] } = {}) {
  const g = n(gasto);
  // Prefer deals; fallback buckets de fase (já vêm com bitrix/wa de fasesPorCampanha)
  let lista = deals || [];
  if (!lista.length && Array.isArray(fases)) {
    lista = [];
    for (const f of fases) {
      const nn = n(f.n);
      for (let i = 0; i < nn; i += 1) {
        const src = (f.leads && f.leads[i]) ? f.leads[i] : {};
        lista.push({
          ...src,
          fase: f.nome,
          bitrixUrl: src.bitrixUrl || null,
          whatsappUrl: src.whatsappUrl || null,
          telefone: src.telefone || null,
          contactId: src.contactId || null,
        });
      }
    }
  }

  const etapas = ETAPAS_FUNIL_PAINEL.map((et) => {
    const { n: qtd, leads } = contaEtapa(lista, et);
    const custo = qtd > 0 ? g / qtd : null;
    const leadsNorm = leads.slice(0, 40).map(normalizaLeadLinks);
    return {
      id: et.id,
      label: et.label,
      n: qtd,
      custo,
      custoFmt: custo != null ? brl(custo) : '—',
      labelCusto: qtd > 0 ? `${brl(custo)} por ${et.label.toLowerCase().replace(/am$/, 'amento').replace(/as$/, 'a')}` : 'sem volume',
      leads: leadsNorm,
      temBitrix: leadsNorm.some((l) => l.temBitrix),
      temWhatsApp: leadsNorm.some((l) => l.temWhatsApp),
      motivoVazio: qtd === 0 ? 'Nenhum lead nesta etapa.' : null,
    };
  });

  const mapLabel = {
    mapeamento: 'por mapeamento',
    agendaram: 'por agendamento',
    atenderam: 'por atendimento',
    proposta: 'por proposta',
    vendas: 'por venda',
  };
  for (const e of etapas) {
    if (e.custo != null) e.labelCusto = `${e.custoFmt} ${mapLabel[e.id] || ''}`.trim();
  }

  const vendas = etapas.find((e) => e.id === 'vendas');
  const custoPorVenda = vendas && vendas.n > 0 ? g / vendas.n : null;

  return {
    gasto: g,
    gastoFmt: brl(g),
    etapas,
    custoPorVenda,
    custoPorVendaFmt: custoPorVenda != null ? brl(custoPorVenda) : '—',
    vendas: vendas?.n || 0,
  };
}

function nomeConjunto(deal) {
  return String(deal.adsetOrigem || deal.conjuntoOrigem || deal.UF_CRM_ADSET_ORIGEM || deal.UF_CRM_CONJUNTO_ORIGEM || '')
    .trim() || 'Sem conjunto';
}

/**
 * Parecer por conjunto (adset): PARAR / MANTER+ADICIONAR.
 */
export function parecerConjuntos({ deals = [], gasto = 0, forms = 0, cpl = null, incrementoDia = 20 } = {}) {
  const g = n(gasto);
  const map = new Map();
  for (const d of deals || []) {
    const key = nomeConjunto(d);
    if (!map.has(key)) map.set(key, { nome: key, deals: [], vendas: 0 });
    const b = map.get(key);
    b.deals.push(d);
    if (normalizaNomeFase(d.fase) === 'Ganhou') b.vendas += 1;
  }

  const conjuntos = [...map.values()].map((c) => {
    const share = (deals || []).length ? c.deals.length / (deals || []).length : 0;
    const gastoEst = g * share;
    const leads = c.deals.length;
    const cplEst = leads > 0 ? gastoEst / leads : null;
    const cpv = c.vendas > 0 ? gastoEst / c.vendas : null;
    return {
      nome: c.nome,
      leads,
      vendas: c.vendas,
      gastoEst,
      cpl: cplEst,
      custoPorVenda: cpv,
    };
  }).sort((a, b) => b.vendas - a.vendas || (a.custoPorVenda ?? 1e12) - (b.custoPorVenda ?? 1e12));

  const comVenda = conjuntos.filter((c) => c.vendas > 0);
  const semVenda = conjuntos.filter((c) => c.vendas === 0 && c.leads > 0);

  const melhores = comVenda[0] || null;
  const pior = [...semVenda].sort((a, b) => (b.cpl ?? 0) - (a.cpl ?? 0) || b.gastoEst - a.gastoEst)[0]
    || (conjuntos.length && !comVenda.length ? conjuntos[0] : null);

  const decisoes = [];
  if (pior && pior.vendas === 0 && (pior.cpl == null || pior.cpl >= 50 || pior.leads >= 3)) {
    decisoes.push({
      acao: 'PARAR',
      conjunto: pior.nome,
      cor: 'vermelho',
      texto: `PARAR ${pior.nome}`,
      motivo: `Baixo desempenho — ${pior.vendas} vendas — CPL ${pior.cpl != null ? brl(pior.cpl, 0) : 'alto'}`,
    });
  }
  if (melhores) {
    decisoes.push({
      acao: 'MANTER_ADICIONAR',
      conjunto: melhores.nome,
      cor: 'verde',
      incrementoDia,
      texto: `MANTER + ADICIONAR R$${incrementoDia}/dia ${melhores.nome}`,
      motivo: `${melhores.vendas} venda(s) — melhor eficiência — recomendo aumentar orçamento`,
    });
  }
  if (!decisoes.length) {
    decisoes.push({
      acao: 'MANTER',
      conjunto: null,
      cor: 'cinza',
      texto: 'MANTER',
      motivo: forms ? `CPL ${cpl != null ? brl(cpl, 0) : '—'} · sem sinal forte por conjunto ainda` : 'Sem forms no período',
    });
  }

  return { conjuntos, decisoes };
}

/** Ranking: melhores = menor custo/venda (com venda); piores = sem venda + maior gasto/CPL. */
export function top10CustoVenda(campanhas = []) {
  const comVenda = (campanhas || [])
    .filter((c) => n(c.funilPainel?.vendas || c.vendas) > 0 && Number.isFinite(Number(c.custoPorVenda ?? c.funilPainel?.custoPorVenda)))
    .sort((a, b) => n(a.custoPorVenda ?? a.funilPainel?.custoPorVenda) - n(b.custoPorVenda ?? b.funilPainel?.custoPorVenda));

  const semVenda = (campanhas || [])
    .filter((c) => n(c.funilPainel?.vendas || c.vendas) === 0 && n(c.forms) > 0)
    .sort((a, b) => {
      const ga = n(a.gastoNum);
      const gb = n(b.gastoNum);
      if (gb !== ga) return gb - ga;
      return n(b.cpl) - n(a.cpl);
    });

  const melhores = comVenda.slice(0, 10).map((c, i) => ({ ...c, pos: i + 1, rankingTipo: 'melhor' }));
  const piores = semVenda.slice(0, 10).map((c, i) => ({ ...c, pos: i + 1, rankingTipo: 'pior' }));
  if (!piores.length) {
    const alt = [...(campanhas || [])]
      .filter((c) => n(c.forms) > 0)
      .sort((a, b) => n(b.cpl) - n(a.cpl) || n(b.gastoNum) - n(a.gastoNum))
      .slice(0, 10)
      .map((c, i) => ({ ...c, pos: i + 1, rankingTipo: 'pior' }));
    return { melhores, piores: alt };
  }
  return { melhores, piores };
}

/** Enriquece campanha do app com funil + parecer. */
export function enrichPainelKatzerOs(cam, dealsCamp = []) {
  const funil = montaFunilCusto({
    gasto: cam.gastoNum,
    deals: dealsCamp,
    fases: cam.fases,
  });
  const parecer = parecerConjuntos({
    deals: dealsCamp,
    gasto: cam.gastoNum,
    forms: cam.forms,
    cpl: cam.cpl,
  });
  return {
    ...cam,
    funilPainel: funil,
    custoPorVenda: funil.custoPorVenda,
    custoPorVendaFmt: funil.custoPorVendaFmt,
    vendas: funil.vendas,
    parecerKatzer: parecer,
  };
}

export default {
  ETAPAS_FUNIL_PAINEL,
  montaFunilCusto,
  parecerConjuntos,
  top10CustoVenda,
  enrichPainelKatzerOs,
  contaEtapa,
  normalizaLeadLinks,
};
