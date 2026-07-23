// PLACAR-ESTADO — alimenta Campanhas / Quadradinho / snapshot do Gestor.
// GET /api/placar-estado
// GET /api/placar-estado?ceo=1  (senha gestor)
// GET /api/placar-estado?refresh=1  (força Meta, ignora cache curto)
// GET /api/placar-estado?diag=1     (inventário de action_types — sem token)
import { createHash } from 'node:crypto';
import { agoraBRT, montaSugestoes, montaSugestaoPrincipal, listaDecisoes } from './_placar-estado.mjs';
import { lePlacar, leDecisoes, mensagemMeta } from './_placar-io.mjs';
import { json } from './_infra.mjs';

const GESTOR_HASH = 'ab341344e639296c0070e1a831d551d0e24798f926e27576078b5c95341ef143';
function senhaGestorOk(event, params) {
  const h = event.headers || {};
  const chave = h['x-gestor-key'] || h['X-Gestor-Key'] || params.k || '';
  if (!chave) return false;
  return createHash('sha256').update(String(chave)).digest('hex') === GESTOR_HASH;
}

export async function handler(event) {
  const params = event.queryStringParameters || {};

  if (params.ceo && !senhaGestorOk(event, params)) {
    return json(401, { ok: false, precisaSenha: true, erro: 'senha do gestor necessária' });
  }

  const now = agoraBRT();
  const [{ placar, ts, cacheHit, meta, inventario }, decisoes] = await Promise.all([
    lePlacar({ preset: 'last_7d', force: params.refresh === '1' }),
    leDecisoes(now.data),
  ]);

  const metaOut = {
    status: meta?.status || 'ok',
    codigo: meta?.codigo || 'OK',
    etapa: meta?.etapa || 'insights',
    conta: meta?.conta || (process.env.META_AD_ACCOUNT || 'act_1150648749960943'),
    confiavel: meta?.confiavel !== false,
    cacheHit: !!cacheHit,
    usandoCache: !!meta?.usandoCache,
    mensagem: meta?.mensagemPainel || mensagemMeta(meta),
    // Nunca incluir token
  };

  const sugestaoPrincipal = metaOut.confiavel && metaOut.status === 'ok'
    ? montaSugestaoPrincipal(placar)
    : null;

  const body = {
    ok: true,
    metricaPrincipal: 'lead_formulario',
    data: now.data,
    agora: now.hm,
    ultimaLeitura: ts ? agoraBRT(new Date(ts)).hm : null,
    periodo: 'last_7d',
    placar,
    sugestoes: metaOut.confiavel ? montaSugestoes(placar) : [],
    sugestaoPrincipal,
    decisoes: listaDecisoes(decisoes),
    meta: metaOut,
    // Atalhos pro front distinguir cenários
    dadosConfiaveis: metaOut.confiavel && (metaOut.status === 'ok' || metaOut.status === 'sem_gasto' || metaOut.status === 'sem_campanha'),
    integracaoOk: metaOut.confiavel || !!meta?.usandoCache,
  };

  if (params.diag === '1') {
    body.diagnostico = {
      metrica: 'lead_formulario',
      fontesLead: placar?.fontesLead || [],
      prioridade: [
        'onsite_conversion.lead_grouped',
        'leadgen_grouped',
        'onsite_conversion.lead',
        'leadgen.other',
        'lead',
      ],
      inventario: inventario || null,
      aviso: 'Inventário sem token. Clique/messaging nunca entram como lead.',
    };
  }

  return json(200, body);
}
