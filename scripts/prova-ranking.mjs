#!/usr/bin/env node
/**
 * Prova segura do ranking CPL formulário (7d + 30d).
 * Não imprime token nem response bruto — só campanha/leads/gasto/CPL/período.
 */
import fs from 'node:fs';
import { montaRanking, contaDiasNoAr } from '../netlify/functions/_ranking.mjs';

const token = process.env.META_TOKEN || process.env.META_SYSTEM_TOKEN;
const acct = process.env.AD_ACCOUNT || process.env.META_AD_ACCOUNT || 'act_1150648749960943';
const graph = process.env.GRAPH || 'https://graph.facebook.com/v20.0';

if (!token) {
  console.error('Falta META_TOKEN');
  process.exit(2);
}

async function puxa(preset, timeIncrement = null) {
  const url = new URL(`${graph}/${acct}/insights`);
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('date_preset', preset);
  url.searchParams.set('fields', 'campaign_id,campaign_name,spend,actions,results,clicks');
  url.searchParams.set('limit', '500');
  if (timeIncrement) url.searchParams.set('time_increment', String(timeIncrement));
  url.searchParams.set('access_token', token);
  const r = await fetch(url.toString());
  const body = await r.json();
  if (body?.error) throw new Error(body.error.message || 'Meta error');
  return body.data || [];
}

function imprime(titulo, ranking) {
  let out = `\n## ${titulo}\n\n`;
  out += `**Totais:** gasto R$ ${ranking.totais?.totalGasto} · leads form. ${ranking.totais?.totalLeadsForm} · CPL méd. R$ ${ranking.totais?.cplMedioForm}\n\n`;
  out += '| Pos | Campanha | Leads | Gasto | CPL | Dias | Status |\n|--:|---|--:|--:|--:|--:|---|\n';
  for (const c of ranking.rankingCpl) {
    out += `| ${c.pos} | ${c.campanha} | ${c.leadsForm} | R$ ${c.gasto} | R$ ${c.cplForm} | ${c.diasNoAr ?? '—'} | ${c.status} |\n`;
  }
  out += '\n### Volume × CPL ≤ R$ 40\n\n';
  out += '| Pos | Campanha | Leads | CPL |\n|--:|---|--:|--:|\n';
  for (const c of ranking.rankingVolumeCpl) {
    out += `| ${c.pos} | ${c.campanha} | ${c.leadsForm} | R$ ${c.cplForm} |\n`;
  }
  const br = (ranking.logSeguro || []).find((x) => /BR_SC/i.test(x.campanha));
  if (br) out += `\n**Conferência BR_SC:** leads=${br.leads} gasto=${br.gasto} cpl=${br.cpl} (ref. Gerenciador 9)\n`;
  console.log(out);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out);
  return out;
}

const safe = { conta: acct, periodos: {} };
for (const preset of ['last_7d', 'last_30d']) {
  const [camp, daily] = await Promise.all([puxa(preset), puxa(preset, 1)]);
  const ranking = montaRanking(camp, {
    periodo: preset,
    leituraOk: true,
    conta: acct,
    horarioLeitura: new Date().toISOString(),
    diasPorCampanha: contaDiasNoAr(daily),
  });
  for (const row of ranking.logSeguro) {
    console.log(`[ranking] ${row.periodo} | ${row.campanha} | leads=${row.leads} | gasto=${row.gasto} | cpl=${row.cpl}`);
  }
  imprime(preset === 'last_7d' ? 'Operacional 7d' : 'Histórico 30d', ranking);
  safe.periodos[preset] = {
    totais: ranking.totais,
    rankingCpl: ranking.rankingCpl.map((c) => ({
      pos: c.pos, campanha: c.campanha, leadsForm: c.leadsForm, gasto: c.gasto, cplForm: c.cplForm, diasNoAr: c.diasNoAr, status: c.status,
    })),
    rankingVolumeCpl: ranking.rankingVolumeCpl.map((c) => ({
      pos: c.pos, campanha: c.campanha, leadsForm: c.leadsForm, cplForm: c.cplForm,
    })),
  };
}
fs.writeFileSync('/tmp/ranking-campanhas.json', JSON.stringify(safe, null, 2));
console.log('\nJSON seguro: /tmp/ranking-campanhas.json');
