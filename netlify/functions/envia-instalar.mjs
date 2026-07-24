// ENVIA-INSTALAR — manda pro WhatsApp do CEO DUAS mensagens:
//  1) a do Michel (repassável) — link do painel do Michel.
//  2) a do Gestor (PRIVADA — tem o %) — link do painel-gestor c/ ícone próprio.
// Protegido por ?key=<WHATSAPP_CEO>. GET /api/envia-instalar?key=<numero do CEO>
import { enviaWhats, json } from './_infra.mjs';

const soDig = (s) => String(s || '').replace(/\D+/g, '');

export async function handler(event) {
  const key = soDig((event.queryStringParameters || {}).key);
  const ceo = soDig(process.env.WHATSAPP_CEO);
  if (!ceo || key !== ceo) return json(403, { ok: false, erro: 'passe ?key=<numero do CEO>' });

  const url = (process.env.SITE_URL || 'https://rotina-produtiva-michel.netlify.app').replace(/\/+$/, '');

  // 1) Pro Michel (pode repassar): Rotina + Campanhas (sem %).
  const msgMichel = [
    '📲 *Michel — deixa os apps na tela (1 vez, 10 seg):*',
    '',
    `Rotina / Placar 👉 ${url}/placar-michel`,
    `Campanhas (decisão) 👉 ${url}/campanhas`,
    `Passo a passo 👉 ${url}/como-instalar`,
    '',
    'Depois é só tocar o ícone *KZ Katzer* / *Campanhas*. Sem link.',
  ].join('\n');

  // 2) Só pro CEO (NÃO repassar — tem o %): painel-gestor com ícone 📊 próprio.
  const msgGestor = [
    '🔒 *SÓ SEU — não repassa pro Michel (tem o %):*',
    '',
    `Teu *Placar do Gestor* 👉 ${url}/placar-gestor`,
    `Campanhas (só olhar / histórico) 👉 ${url}/campanhas`,
    'Adiciona à Tela de Início igual (Compartilhar → Adicionar).',
    '',
    '📊 O ícone é o *gráfico dourado “GESTOR”* — diferente do KZ do Michel.',
    '⚠️ Se já tem o antigo *“P”* na tela, apaga ele e adiciona de novo pra pegar o ícone novo.',
  ].join('\n');

  const wM = await enviaWhats(process.env.WHATSAPP_CEO, msgMichel);
  const wG = await enviaWhats(process.env.WHATSAPP_CEO, msgGestor);
  return json(200, {
    ok: true,
    michel: { enviado: wM.enviado, status: wM.status },
    gestor: { enviado: wG.enviado, status: wG.status },
  });
}
