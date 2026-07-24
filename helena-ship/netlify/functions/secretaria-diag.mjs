// DIAGNÓSTICO da Secretária — testa o BITRIX_WEBHOOK_READ e puxa o raio-x (schema).
// SÓ LEITURA. Protegido por ?key=<numero admin BRUNO_PHONE>.
// Uso: abrir /api/secretaria-diag?key=SEU_NUMERO  -> volta os campos + etapas do Bitrix.
// Depois de capturar o schema, este endpoint pode ser removido.
import {
  dealFields, contactFields, statusList, categoryList, resumeCampos, bitrixGet,
} from '../../maestro/src/bitrixRead.js';
import { mesmoTelefone } from '../../maestro/src/secretariaConversa.js';

const soDigitos = (s) => String(s || '').replace(/\D+/g, '');

export async function handler(event) {
  const key = (event.queryStringParameters || {}).key || '';
  const bruno = process.env.BRUNO_PHONE || '';
  // Trava tolerante ao formato BR (com/sem 55, com/sem 9): o mesmo número admin passa
  // em qualquer forma; qualquer outro número é barrado.
  if (!bruno || !mesmoTelefone(key, bruno)) {
    return json(403, { ok: false, erro: 'acesso negado — passe ?key=<seu numero admin (BRUNO_PHONE)>' });
  }
  // Checa o webhook de ESCRITA do Maestro (leitura inofensiva) — pra saber se o Bruno
  // apagou ele sem querer. Se estiver vivo, a Helena continua gravando lead no Bitrix.
  const escrita = { configurado: !!process.env.BITRIX_WEBHOOK_WRITE };
  if (escrita.configurado) {
    try {
      await bitrixGet('crm.deal.fields', {}, { base: process.env.BITRIX_WEBHOOK_WRITE });
      escrita.vivo = true;
    } catch (e) {
      escrita.vivo = false;
      escrita.erro = String((e && e.message) || e);
    }
  }

  if (!process.env.BITRIX_WEBHOOK_READ) {
    return json(500, {
      ok: false,
      erro: 'BITRIX_WEBHOOK_READ não está configurado no Netlify',
      webhook_escrita: escrita,
    });
  }

  // MODO EXEMPLO: puxa negócios REAIS e mostra os campos ambíguos (faixa/finalidade)
  // PREENCHIDOS, com o valor legível — pro Bruno casar com o card no Bitrix pelo VALOR.
  const params = event.queryStringParameters || {};
  if (params.exemplo || params.cards) {
    try {
      return await modoExemplo(params);
    } catch (e) {
      return json(502, { ok: false, erro: String((e && e.message) || e) });
    }
  }
  if (params.usuarios || params.users) {
    try {
      return await modoUsuarios();
    } catch (e) {
      return json(502, { ok: false, erro: String((e && e.message) || e) });
    }
  }

  try {
    const [df, cf, st, cat] = await Promise.all([
      dealFields(), contactFields(), statusList(), categoryList(),
    ]);
    const dealResumo = resumeCampos(df);
    const contatoResumo = resumeCampos(cf);
    return json(200, {
      ok: true,
      mensagem: 'Webhook de leitura OK ✅ — raio-x do Bitrix abaixo.',
      webhook_leitura: { vivo: true },
      webhook_escrita: escrita, // { configurado, vivo, erro? } — diz se o de ESCRITA foi apagado
      contagem: {
        campos_negocio: dealResumo.length,
        campos_contato: contatoResumo.length,
        etapas: Array.isArray(st) ? st.length : 0,
        pipelines: Array.isArray(cat) ? cat.length : 0,
      },
      raio_x: {
        campos_negocio: dealResumo,
        campos_contato: contatoResumo,
        etapas: st,
        pipelines: cat,
      },
    });
  } catch (e) {
    return json(502, { ok: false, erro: String((e && e.message) || e) });
  }
}

// Campos que ainda temos dúvida (candidatos), com nome amigável pro Bruno reconhecer.
const CAMPOS_AMBIGUOS = [
  { id: 'UF_CRM_1752266661', nome: 'Empreendimento (confirmado)' },
  { id: 'UF_CRM_1753709436', nome: 'Temperatura (confirmado)' },
  { id: 'UF_CRM_1755626500', nome: 'Cidade (confirmado)' },
  { id: 'UF_CRM_DEAL_1753707338531', nome: 'FAIXA-A (Até R$500.000,00 / …)' },
  { id: 'UF_CRM_1753714832', nome: 'FAIXA-B (500k-750k / Até 1mi / …)' },
  { id: 'UF_CRM_1760387036', nome: 'FAIXA-C (Até 500k / 750k / …)' },
  { id: 'UF_CRM_1762350624742', nome: 'FAIXA-D (Até 500k / … / 2-3mi)' },
  { id: 'UF_CRM_1753709401', nome: 'FINALIDADE-A (Moradia/Locação/Revenda)' },
  { id: 'UF_CRM_1753714679', nome: 'FINALIDADE-B (Veraneio/Invest…)' },
  { id: 'UF_CRM_1762178029', nome: 'FINALIDADE-C (Investimento/Moradia)' },
  { id: 'UF_CRM_1762350667018', nome: 'FINALIDADE-D (Locação/Revenda/Moradia)' },
];

/** Resolve um valor de enumeration pro texto legível, usando o schema. */
function legivel(df, fieldId, valor) {
  const def = df[fieldId];
  if (def && def.type === 'enumeration' && Array.isArray(def.items)) {
    const achados = [].concat(valor).map((v) => {
      const it = def.items.find((o) => String(o.ID) === String(v));
      return it ? it.VALUE : v;
    });
    return achados.join(', ');
  }
  return Array.isArray(valor) ? valor.join(', ') : valor;
}

/** Puxa os últimos negócios do funil 1 e mostra os campos ambíguos preenchidos. */
async function modoExemplo(params) {
  const df = await dealFields();
  const ids = CAMPOS_AMBIGUOS.map((c) => c.id);
  const negocios = await bitrixGet('crm.deal.list', {
    filter: { CATEGORY_ID: 1 },
    order: { DATE_CREATE: 'DESC' },
    select: ['ID', 'TITLE', 'STAGE_ID', ...ids],
  });
  const lista = (Array.isArray(negocios) ? negocios : []).slice(0, 12).map((d) => {
    const preenchidos = {};
    for (const c of CAMPOS_AMBIGUOS) {
      const v = d[c.id];
      if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
        preenchidos[c.nome] = legivel(df, c.id, v);
      }
    }
    return { ID: d.ID, titulo: d.TITLE, fase: d.STAGE_ID, campos_preenchidos: preenchidos };
  });
  return json(200, {
    ok: true,
    mensagem: 'Exemplos reais — abra o mesmo card (pelo ID) no Bitrix e compare pelo VALOR qual campo de FAIXA/FINALIDADE é o usado.',
    como_ler: 'Em cada negócio, "campos_preenchidos" mostra só o que TEM valor. Se só a FAIXA-B aparecer preenchida nos cards, é ela a oficial.',
    negocios: lista,
  });
}

/** Lista os usuários ATIVOS (nome + ID + cargo) — pro Bruno achar o próprio ID e os da equipe. */
async function modoUsuarios() {
  const ATIVO = new Set(['Y', '1', 1, true]);
  const users = await bitrixGet('user.get', { ADMIN_MODE: true });
  const ativos = (Array.isArray(users) ? users : [])
    .filter((u) => ATIVO.has(u.ACTIVE))
    .map((u) => ({
      ID: u.ID,
      nome: [u.NAME, u.LAST_NAME].filter(Boolean).join(' ') || u.EMAIL || `user ${u.ID}`,
      cargo: u.WORK_POSITION || '',
      email: u.EMAIL || '',
    }))
    .sort((a, b) => Number(a.ID) - Number(b.ID));
  return json(200, {
    ok: true,
    mensagem: 'Usuários ATIVOS do Bitrix (nome + ID). Ache "Bruno Katzer" pra pegar o seu ID.',
    total: ativos.length,
    usuarios: ativos,
  });
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body, null, 2),
  };
}
