import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ehLeadDoBruno,
  ehPatrocinado,
  ehFonteFacebookAds,
  ehFontePatrocinadoCorretor,
  ehResponsavelBruno,
  ehCampanhaMichelRecente,
  ehForaDaRoleta,
  acionaAberturaHelena,
} from '../src/aberturaHelena.js';
import { normalizaLead } from '../src/lead.js';
import { ingestLead } from '../src/ingest.js';
import { criaEstado } from '../src/state.js';

const cfgBruno = { BRUNO_BITRIX_ID: '1' };

/** Exemplo real Bitrix (FLAVIUS ALVES) — print do CEO. */
const flaviusAlves = {
  nome: 'FLAVIUS ALVES',
  telefone: '15086422340',
  title: 'Preencher formulário de CRM "LEAD PATROC. FORT MYERS"',
  titleForm: 'Preencher formulário de CRM "LEAD PATROC. FORT MYERS"',
  fonte: 'Patrocinado Corretor',
  origemAnuncio: 'Patrocinado Corretor',
  produto: 'Fort Myers',
  entraNaRoleta: 'Não',
  finalidade: 'moradia',
  origem: 'formulario_facebook',
};

test('ehPatrocinado: LEAD PATROC / formulario / Patrocinado Corretor', () => {
  assert.equal(ehPatrocinado({ campanha: 'LEAD PATROC. KATZER FORT MYERS' }), true);
  assert.equal(ehPatrocinado({ origem: 'formulario_facebook' }), true);
  assert.equal(ehPatrocinado({ fonte: 'Patrocinado Corretor' }), true);
  assert.equal(ehPatrocinado({ campanha: 'Rodízio corretor Edsel' }), false);
});

test('ehFontePatrocinadoCorretor: Bitrix FONTE/ORIGEM DO ANÚNCIO', () => {
  assert.equal(ehFontePatrocinadoCorretor({ fonte: 'Patrocinado Corretor' }), true);
  assert.equal(ehFontePatrocinadoCorretor({ origemAnuncio: 'Patrocinado Corretor' }), true);
  assert.equal(ehFontePatrocinadoCorretor({ origem: 'formulario_facebook' }), true);
  assert.equal(ehFonteFacebookAds({ fonte: 'FACEBOOK ADS' }), true); // alias
  assert.equal(ehFontePatrocinadoCorretor({ origem: 'whatsapp_direto' }), false);
});

test('ehResponsavelBruno: ASSIGNED_BY_ID = 1', () => {
  assert.equal(ehResponsavelBruno({}, '1', cfgBruno), true);
  assert.equal(ehResponsavelBruno({ assignedById: '1' }, null, cfgBruno), true);
  assert.equal(ehResponsavelBruno({}, '985', cfgBruno), false); // Edsel
});

test('ehForaDaRoleta: Não = ok · Sim = bloqueia', () => {
  assert.equal(ehForaDaRoleta({ entraNaRoleta: 'Não' }), true);
  assert.equal(ehForaDaRoleta({}), true); // campo ausente = não bloqueia
  assert.equal(ehForaDaRoleta({ entraNaRoleta: 'Sim' }), false);
  assert.equal(ehForaDaRoleta({ roleta: '1' }), false);
});

test('ehLeadDoBruno: exemplo Bitrix FLAVIUS ALVES (Patrocinado Corretor + Bruno + Fort Myers)', () => {
  const cfg = {
    BRUNO_BITRIX_ID: '1',
    CAMPANHAS_HELENA: ['fort myers', 'grant', 'portugal', 'br_sc', 'brasileiros'],
  };
  assert.equal(ehLeadDoBruno(flaviusAlves, cfg, { corretorId: '1' }), true);
  assert.equal(ehLeadDoBruno(flaviusAlves, cfg, { corretorId: '985' }), false); // rodízio
  assert.equal(ehLeadDoBruno({ ...flaviusAlves, entraNaRoleta: 'Sim' }, cfg, { corretorId: '1' }), false);
});

test('ehLeadDoBruno: patrocinado + Facebook + responsável Bruno (lista campanha vazia = não corta)', () => {
  const lead = {
    campanha: 'Qualquer praça XYZ',
    origem: 'formulario_facebook',
    title: 'LEAD PATROC. KATZER XYZ',
  };
  assert.equal(ehLeadDoBruno(lead, cfgBruno, { corretorId: '1' }), true);
  assert.equal(ehLeadDoBruno(lead, cfgBruno, { corretorId: '985' }), false);
  assert.equal(ehLeadDoBruno({ ...lead, origem: 'whatsapp_direto', title: 'x' }, cfgBruno, { corretorId: '1' }), false);
});

test('ehCampanhaMichelRecente: filtra por campanha OU produto Bitrix', () => {
  assert.equal(ehCampanhaMichelRecente({ campanha: 'LEAD PATROC. GRANT HOME' }, ['grant', 'portugal']), true);
  assert.equal(ehCampanhaMichelRecente({ produto: 'Fort Myers' }, ['fort myers', 'grant']), true);
  assert.equal(ehCampanhaMichelRecente({ campanha: 'LEAD PATROC. ALICERCE' }, ['grant', 'portugal']), false);
  assert.equal(ehCampanhaMichelRecente({ campanha: 'qualquer' }, []), true);
});

test('ehLeadDoBruno: campanha Michel fora da lista → não abre', () => {
  const lead = {
    campanha: 'LEAD PATROC. ALICERCE',
    origem: 'formulario_facebook',
    title: 'LEAD PATROC. ALICERCE',
  };
  const cfg = { BRUNO_BITRIX_ID: '1', CAMPANHAS_HELENA: ['grant', 'portugal', 'br_sc', 'brasileiros'] };
  assert.equal(ehLeadDoBruno(lead, cfg, { corretorId: '1' }), false);
  assert.equal(
    ehLeadDoBruno(
      { ...lead, campanha: 'FortMyers cidades PORTUGAL', title: 'LEAD PATROC. PORTUGAL' },
      cfg,
      { corretorId: '1' },
    ),
    true,
  );
});

test('acionaAberturaHelena: sem URL -> não dispara', async () => {
  const r = await acionaAberturaHelena({ telefone: '5547999990000' }, { url: '' });
  assert.equal(r.disparado, false);
});

test('acionaAberturaHelena: homolog -> simula, não chama a rede', async () => {
  let chamou = false;
  const r = await acionaAberturaHelena(
    { telefone: '5547999990000', nome: 'X' },
    { url: 'https://x.invalido/api/helena/lead-form', modo: 'homolog', fetchFn: async () => { chamou = true; return { ok: true }; } },
  );
  assert.equal(r.disparado, false);
  assert.match(r.motivo, /homolog/);
  assert.equal(chamou, false);
});

test('acionaAberturaHelena: produção -> POSTa o payload', async () => {
  let capturado = null;
  const fakeFetch = async (url, opts) => {
    capturado = { url, body: JSON.parse(opts.body), method: opts.method };
    return { ok: true, status: 200 };
  };
  const lead = { telefone: '5547999990000', nome: 'Maria Souza', interesse: 'Fort Myers', campanha: 'Patroc Portugal' };
  const r = await acionaAberturaHelena(lead, {
    url: 'https://site.invalido/api/helena/lead-form', key: 'segredo123', dealId: '900', modo: 'producao', fetchFn: fakeFetch,
  });
  assert.equal(r.disparado, true);
  assert.equal(capturado.method, 'POST');
  assert.match(capturado.url, /key=segredo123/);
  assert.equal(capturado.body.phone, '5547999990000');
});

test('normalizaLead: captura campanha', () => {
  assert.equal(normalizaLead({ telefone: '5547999990000', campaign_name: 'Fort Myers' }).campanha, 'Fort Myers');
});

function fakeBitrix() {
  return {
    achaNegocioPorTelefone: async () => null,
    upsertNegocio: async (lead, { corretorId }) => ({ dealId: '900', contactId: 'c', created: true, corretorId }),
  };
}

test('ingest: patrocinado Facebook → ASSIGNED Bruno (não rodízio)', async () => {
  const deps = {
    bitrix: fakeBitrix(),
    estado: criaEstado({ memoria: {} }),
    discadora: { enfileira: async () => null },
    whatsapp: { enviaTexto: async () => null },
    alerta: async () => {},
    logger: { info() {}, ok() {}, erro() {} },
    aberturaHelena: async () => ({ disparado: false, motivo: 'teste' }),
  };
  const r = await ingestLead(
    { telefone: '5547999990001', nome: 'Lead', campaign_name: 'LEAD PATROC. GRANT' },
    { origemPadrao: 'formulario_facebook', etapa: 'C1:NEW' },
    deps,
  );
  assert.equal(r.ok, true);
  assert.equal(String(r.corretorId), '1');
});
