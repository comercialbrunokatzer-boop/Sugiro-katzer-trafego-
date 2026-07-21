// PREVIA-CEO — manda SÓ pro WhatsApp do CEO uma prévia de como o card cai todo dia (07:45).
// Não envia nada pro Michel. Protegido por ?key=<WHATSAPP_CEO>.
// GET /api/previa-ceo?key=<numero do CEO>&modo=casa|katzer
import { agoraBRT, previstoMin, min2hm, TAREFAS } from './_rotina.mjs';
import { enviaWhats, json } from './_infra.mjs';

const soDig = (s) => String(s || '').replace(/\D+/g, '');

export async function handler(event) {
  const q = event.queryStringParameters || {};
  const key = soDig(q.key);
  const ceo = soDig(process.env.WHATSAPP_CEO);
  if (!ceo || key !== ceo) return json(403, { ok: false, erro: 'passe ?key=<numero do CEO>' });

  const url = (process.env.SITE_URL || 'https://rotina-produtiva-michel.netlify.app').replace(/\/+$/, '');
  const modo = q.modo === 'katzer' ? 'katzer' : 'casa';
  const modoTxt = modo === 'katzer' ? '🏢 Katzer' : '🏠 Casa';
  const inicioTxt = modo === 'katzer' ? '08:45' : '08:00';
  const estadoFake = { modo, inicioMin: null };
  const agenda = TAREFAS
    .map((t) => `🕘 *${min2hm(previstoMin(t, estadoFake.modo, null))}* · ${t.nome}`)
    .join('\n');

  const msg = [
    '🔎 *PRÉVIA* — é assim que o card do Michel cai *todo dia às 07:45* (de amanhã em diante):',
    '━━━━━━━━━━━━━━',
    `☀️ *Bom dia, Michel!* — ${modoTxt} · início ${inicioTxt}`,
    '',
    agenda,
    '',
    `Toca *Feito* em cada uma aqui 👉 ${url}/painel-michel`,
    '━━━━━━━━━━━━━━',
    '📲 *No 1º dia* o Michel toca esse link e faz *“Adicionar à Tela de Início”* → vira o app *Rotina Katzer* (ícone). Depois é só tocar o ícone, sem link.',
    '🏠🏢 O modo (Casa/Katzer) ele escolhe no topo; o dia *zera sozinho* a cada manhã.',
  ].join('\n');

  const w = await enviaWhats(process.env.WHATSAPP_CEO, msg);
  return json(200, { ok: true, enviado: w.enviado, status: w.status, modo });
}
