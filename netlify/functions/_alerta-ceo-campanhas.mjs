/**
 * Alertas obrigatórios ao Bruno (CEO) sobre campanhas do Michel.
 * Regras comerciais:
 * 1) Toda ação do Michel (manter / parar / orçamento) → avisar
 * 2) Campanha nova ACTIVE → avisar
 * 3) Campanha que parou (saiu de ACTIVE) → avisar
 * 4) Campanha ruim/cara e Michel não mexeu → avisar
 */
import { badgeCampanha, deveAlertarManter } from './_qualidade-trafego.mjs';

export const ACOES_MICHEL = new Set(['manter', 'parar', 'orcamento', 'budget']);

/** Ignora testes de público / [TESTE] no vigilante (não poluir WhatsApp). */
export function campanhaOperacional(nome = '') {
  const n = String(nome || '');
  if (!n.trim()) return false;
  if (/\[TESTE\]/i.test(n)) return false;
  if (/PUBLICOS/i.test(n) && /NOVACONFIG|NOVO\s*CONFIG|TESTE/i.test(n)) return false;
  return true;
}

/**
 * Snapshot mínimo por campanha ACTIVE (id estável).
 * @param {Array<{id:string,nome:string,status?:string,ativa?:boolean}>} lista
 */
export function montaSnapshotAtivas(lista = []) {
  const mapa = {};
  for (const c of lista || []) {
    const id = String(c.id || '').replace(/\D/g, '');
    if (!id) continue;
    if (!campanhaOperacional(c.nome || c.name)) continue;
    const ativa = c.ativa === true || String(c.status || '').toUpperCase() === 'ACTIVE';
    if (!ativa) continue;
    mapa[id] = {
      id,
      nome: c.nome || c.name || id,
      status: 'ACTIVE',
      em: c.em || null,
    };
  }
  return mapa;
}

/**
 * Diff de ativas: novas (apareceram) e paradas (sumiram do ACTIVE).
 */
export function diffAtivas(anterior = {}, atual = {}) {
  const prev = anterior || {};
  const next = atual || {};
  const novas = [];
  const paradas = [];
  for (const id of Object.keys(next)) {
    if (!prev[id]) novas.push(next[id]);
  }
  for (const id of Object.keys(prev)) {
    if (!next[id]) paradas.push(prev[id]);
  }
  return { novas, paradas };
}

/**
 * Campanha cara / ruim (mesma régua do App Decisão).
 */
export function campanhaRuimOuCara(cam = {}) {
  const cpl = cam.cpl != null ? Number(cam.cpl) : null;
  const detail = cam.detail || {};
  const forms = cam.forms ?? cam.leads ?? 0;
  const gasto = cam.gastoNum ?? cam.gasto ?? 0;
  const qual = cam.qual || badgeCampanha(cpl, detail, { forms, gasto });
  if (qual === 'bad') return { ruim: true, qual, motivo: 'badge bad (CPL/gasto/Fake)' };
  if (deveAlertarManter({ cpl, detail, qual })) {
    return { ruim: true, qual, motivo: 'CPL alto + Fake/Ruim ou badge bad' };
  }
  if (cpl != null && cpl >= 70 && Number(gasto) >= 200) {
    return { ruim: true, qual: qual || 'bad', motivo: `CPL R$ ${Math.round(cpl)} com gasto ≥ R$ 200` };
  }
  return { ruim: false, qual, motivo: null };
}

/**
 * Michel “mexeu” nesta campanha no feed (hoje ou janela).
 * @param {Array} itens feed decisao
 * @param {{ campanhaId?: string, nome?: string, desdeISO?: string, dataBRT?: string }} opts
 */
export function michelMexeuNaCampanha(itens = [], opts = {}) {
  const id = opts.campanhaId ? String(opts.campanhaId).replace(/\D/g, '') : '';
  const nome = String(opts.nome || '').toLowerCase();
  const desde = opts.desdeISO ? Date.parse(opts.desdeISO) : NaN;
  const dataBRT = opts.dataBRT || null;

  for (const it of itens || []) {
    const acao = String(it.acao || '').toLowerCase();
    if (!ACOES_MICHEL.has(acao)) continue;
    if (dataBRT && it.data && it.data !== dataBRT && !String(it.data).startsWith(dataBRT)) continue;
    if (Number.isFinite(desde)) {
      const t = Date.parse(it.em || '');
      if (Number.isFinite(t) && t < desde) continue;
    }
    const itId = String(it.campanhaId || '').replace(/\D/g, '');
    const itNome = String(it.campanha || '').toLowerCase();
    if (id && itId && id === itId) return true;
    if (nome && itNome && (itNome === nome || itNome.includes(nome) || nome.includes(itNome))) return true;
  }
  return false;
}

/**
 * Lista ruins ACTIVE onde Michel ainda não mexeu (hoje).
 */
export function ruinsSemMovimento(campanhas = [], feedItens = [], { dataBRT = null } = {}) {
  const out = [];
  for (const c of campanhas || []) {
    if (!campanhaOperacional(c.name || c.nome)) continue;
    if (c.ativa !== true) continue;
    const check = campanhaRuimOuCara(c);
    if (!check.ruim) continue;
    const id = String(c.id || '').replace(/\D/g, '');
    const nome = c.name || c.nome || '';
    if (michelMexeuNaCampanha(feedItens, { campanhaId: id, nome, dataBRT })) continue;
    out.push({
      id,
      nome,
      cpl: c.cpl,
      custo: c.custo,
      forms: c.forms,
      qual: check.qual,
      motivo: check.motivo,
    });
  }
  return out;
}

/** Texto WhatsApp — ação do Michel (sempre). */
export function mensagemAcaoMichel({
  acao,
  textoFeed,
  campanhaId,
  metaOk,
  hm,
  alertaManterRuim = false,
  custo = null,
  fakeRuim = 0,
} = {}) {
  const a = String(acao || '').toLowerCase();
  const label = a === 'parar' ? '🛑 PAROU'
    : (a === 'manter' ? '▶️ MANTEVE / REATIVOU'
      : '💰 ORÇAMENTO');
  const linhas = [
    `${label} · *Michel · App Decisão* · ${hm || ''}`.trim(),
    textoFeed || '',
    campanhaId ? `Meta ID: ${campanhaId}` : '',
    metaOk ? '✅ Meta confirmou' : (metaOk === false ? '⚠️ Meta não confirmou / só registro' : ''),
  ].filter(Boolean);
  if (alertaManterRuim) {
    linhas.unshift('⚠️ *ALERTA GESTOR* — manteve campanha ruim/cara');
    if (custo) linhas.push(`Custo ${custo} · Fake/Ruim: ${fakeRuim}`);
  }
  return linhas.join('\n');
}

/** Textos para novas / paradas / ruins sem movimento. */
export function mensagensVigilante({
  novas = [],
  paradas = [],
  ruins = [],
  hm = '',
  data = '',
} = {}) {
  const msgs = [];
  if (novas.length) {
    const linhas = [
      `🆕 *Campanha NOVA ACTIVE* · ${hm || data}`.trim(),
      ...novas.slice(0, 8).map((c) => `• ${c.nome}${c.id ? ` (${c.id})` : ''}`),
      novas.length > 8 ? `… +${novas.length - 8} outras` : '',
      'Michel precisa decidir (Manter / R$ / Parar).',
    ].filter(Boolean);
    msgs.push({ tipo: 'nova', texto: linhas.join('\n'), ids: novas.map((c) => c.id) });
  }
  if (paradas.length) {
    const linhas = [
      `⏸️ *Campanha PAROU* (saiu de ACTIVE) · ${hm || data}`.trim(),
      ...paradas.slice(0, 8).map((c) => `• ${c.nome}${c.id ? ` (${c.id})` : ''}`),
      paradas.length > 8 ? `… +${paradas.length - 8} outras` : '',
    ].filter(Boolean);
    msgs.push({ tipo: 'parada', texto: linhas.join('\n'), ids: paradas.map((c) => c.id) });
  }
  if (ruins.length) {
    const linhas = [
      `⚠️ *Campanha RUIM/CARA — Michel NÃO mexeu* · ${hm || data}`.trim(),
      ...ruins.slice(0, 8).map((c) => {
        const cpl = c.cpl != null ? `CPL R$ ${Math.round(Number(c.cpl))}` : (c.custo || 'CPL —');
        return `• ${c.nome} · ${cpl} · ${c.motivo || 'ruim'}`;
      }),
      ruins.length > 8 ? `… +${ruins.length - 8} outras` : '',
      'Sem Manter / Parar / Orçamento no App Decisão hoje.',
    ].filter(Boolean);
    msgs.push({ tipo: 'ruim_sem_movimento', texto: linhas.join('\n'), ids: ruins.map((c) => c.id) });
  }
  return msgs;
}

/**
 * Filtra alertas já enviados (dedupe por tipo+id+dia).
 * @param {Record<string,string>} enviados mapa chave → ISO
 * @param {string} dataBRT
 */
export function chaveAlerta(tipo, id, dataBRT) {
  return `${dataBRT}|${tipo}|${id || 'x'}`;
}

export function filtraNovosAlertas(mensagens = [], enviados = {}, dataBRT = '') {
  const out = [];
  const novasChaves = [];
  for (const m of mensagens || []) {
    const ids = (m.ids && m.ids.length) ? m.ids : ['lote'];
    const pendentes = ids.filter((id) => !enviados[chaveAlerta(m.tipo, id, dataBRT)]);
    if (!pendentes.length) continue;
    out.push({ ...m, ids: pendentes });
    for (const id of pendentes) novasChaves.push(chaveAlerta(m.tipo, id, dataBRT));
  }
  return { mensagens: out, novasChaves };
}
