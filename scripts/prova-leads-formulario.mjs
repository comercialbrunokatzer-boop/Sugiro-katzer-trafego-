#!/usr/bin/env node
/**
 * Prova segura: lê Meta (token só em env), inventaria action_types
 * e monta placar só com lead de formulário. Nunca imprime o token.
 *
 * Uso (CI): META_TOKEN=… node scripts/prova-leads-formulario.mjs
 */
import fs from 'node:fs';
import { montaPlacar, inventariarAcoes, PRIORIDADE_LEAD_FORMULARIO } from '../netlify/functions/_placar.mjs';

const token = process.env.META_TOKEN || process.env.META_SYSTEM_TOKEN;
const acct = process.env.AD_ACCOUNT || process.env.META_AD_ACCOUNT || 'act_1150648749960943';
const graph = process.env.GRAPH || process.env.META_GRAPH || 'https://graph.facebook.com/v20.0';

if (!token) {
  console.error('Falta META_TOKEN / META_SYSTEM_TOKEN');
  process.exit(2);
}

const url = new URL(`${graph}/${acct}/insights`);
url.searchParams.set('level', 'campaign');
url.searchParams.set('date_preset', 'last_7d');
url.searchParams.set('fields', 'campaign_id,campaign_name,spend,clicks,actions,results');
url.searchParams.set('limit', '500');
url.searchParams.set('access_token', token);

const r = await fetch(url.toString());
const body = await r.json();
if (body?.error) {
  console.error('Meta:', body.error.message || body.error);
  process.exit(2);
}

const data = body.data || [];
const inv = inventariarAcoes(data);
const p = montaPlacar(data);
const cpl = (v) => (v == null ? '—' : `R$ ${v}`);

let out = '## Prova — leads de formulário (últimos 7 dias)\n\n';
out += `**Conta:** \`${acct}\` (token oculto)\n\n`;
out += `**Prioridade de action_type:** ${PRIORIDADE_LEAD_FORMULARIO.join(' → ')}\n\n`;
out += `**Fontes usadas nesta leitura:** ${(p.fontesLead || []).join(', ') || '(nenhuma)'}\n\n`;
out += '### Formulários nos totais da API\n\n';
if (!inv.formulariosNosTotais.length) out += '_Nenhum action_type de formulário encontrado._\n\n';
else {
  out += '| action_type | soma |\n|---|--:|\n';
  for (const x of inv.formulariosNosTotais) out += `| \`${x.action_type}\` | ${x.value} |\n`;
  out += '\n';
}
out += '### Top action_types (todos)\n\n| action_type | soma |\n|---|--:|\n';
for (const x of inv.totais.slice(0, 20)) out += `| \`${x.action_type}\` | ${x.value} |\n`;
out += '\n### Placar (só formulário)\n\n| Campanha | Gasto | Leads form. | Fonte | CPL |\n|---|--:|--:|---|--:|\n';
for (const c of p.campanhas) {
  out += `| ${c.nome} | R$ ${c.gasto} | ${c.leads} | \`${c.fonteLead || '—'}\` | ${cpl(c.cpl)} |\n`;
}
out += `\n**Total:** R$ ${p.totalGasto} · ${p.totalLeads} cadastros form. · CPL médio ${cpl(p.cplMedio)}\n`;

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) fs.appendFileSync(summary, out);
console.log(out);

// JSON compacto pra parsing (sem token)
const safe = {
  conta: acct,
  fontesLead: p.fontesLead,
  formulariosNosTotais: inv.formulariosNosTotais,
  totalGasto: p.totalGasto,
  totalLeads: p.totalLeads,
  cplMedio: p.cplMedio,
  campanhas: p.campanhas.map((c) => ({
    nome: c.nome, gasto: c.gasto, leads: c.leads, fonteLead: c.fonteLead, cpl: c.cpl, avisoLead: c.avisoLead,
  })),
};
fs.writeFileSync('/tmp/prova-formulario.json', JSON.stringify(safe, null, 2));
console.log('\n(JSON seguro em /tmp/prova-formulario.json)');
