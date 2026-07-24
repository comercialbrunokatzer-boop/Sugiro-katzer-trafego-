// Construtor do relatório consolidado (WhatsApp + e-mail) — SÓ ROTINA.
// Painel de Campanhas = produto separado (/campanhas) — nunca misturar aqui.
import { pontualidade } from './_rotina.mjs';

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

export function dataExtenso(data, dow) {
  const [y, m, d] = data.split('-');
  return `${DIAS[dow]}, ${+d} de ${MESES[+m - 1]} de ${y}`;
}

/** Resumo WhatsApp do CEO — só tarefas / pontualidade da Rotina. */
export function resumoWhats(estado, now) {
  const P = pontualidade(estado, now.min);
  const modoIco = estado.modo === 'katzer' ? '🏢 Katzer' : '🏠 Jlle/Casa';
  const feitasNoHorario = P.linhas.filter((l) => l.feito && l.difMin <= 0).length;
  const adiantadas = P.linhas.filter((l) => l.feito && l.difMin < 0).length;
  const atrasadas = P.linhas.filter((l) => l.feito && l.difMin > 0).length;
  const pendentes = P.linhas.filter((l) => !l.feito).length;
  const destaques = P.linhas
    .filter((l) => l.feito && l.difMin > 0)
    .map((l) => `🔴 ${l.nome} −${l.difMin}′`).join(' · ');
  const obs = (estado.obs || []).map((o) => `🔔 ${o.quem}: ${o.nome}${o.duracao ? ` (${o.duracao}min)` : ''}`).join('\n');
  const linhas = [
    `📊 *Michel* — ${dataExtenso(estado.data, now.dow)} · ${modoIco}`,
    `*Meta do dia: ${P.pct}%* · saldo ${P.saldoMin > 0 ? '−' + P.saldoMin : '+' + (-P.saldoMin)}′`,
    `✅ ${feitasNoHorario} no horário · 💚 ${adiantadas} adiantada(s) · 🔴 ${atrasadas} atrasada(s)${pendentes ? ` · ⏳ ${pendentes} pendente(s)` : ''}`,
    destaques || '',
    obs || '',
  ].filter(Boolean);
  return linhas.join('\n');
}

/** E-mail HTML — só Rotina. */
export function emailHTML(estado, now) {
  const P = pontualidade(estado, now.min);
  const modo = estado.modo === 'katzer' ? '🏢 Katzer' : '🏠 Jlle/Casa';
  const cor = P.pct >= 90 ? '#e0be6e' : (P.pct >= 70 ? '#c9a24a' : '#d67a52');
  const rows = P.linhas.map((l) => {
    let tag; let tc = '#9a9283';
    if (l.feito && l.difMin > 0) { tag = `−${l.difMin}′`; tc = '#d67a52'; }
    else if (l.feito && l.difMin < 0) { tag = `+${-l.difMin}′ 💚`; tc = '#74b892'; }
    else if (l.feito) { tag = 'no horário'; tc = '#c9a24a'; }
    else if (l.difMin > 0) { tag = `atrasando ${l.difMin}′`; tc = '#d67a52'; }
    else tag = 'pendente';
    return `<tr>
      <td style="padding:9px 14px;border-bottom:1px solid #2a2732;color:#ece5d6;font-size:14px">${l.nome}
        <span style="color:#9a9283;font-size:12px"> · previsto ${l.previsto}${l.feito ? ' · feito ' + l.hora : ''}</span></td>
      <td style="padding:9px 14px;border-bottom:1px solid #2a2732;text-align:right;color:${tc};font-size:13px;font-weight:600;white-space:nowrap">${tag}</td>
    </tr>`;
  }).join('');
  const obsHtml = (estado.obs || []).length ? `
    <div style="margin:16px 22px 0;border:1px solid #8a6c2e;border-radius:10px;background:rgba(201,162,74,.05);padding:12px 14px">
      <div style="color:#c9a24a;font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700">🔔 Obs</div>
      ${estado.obs.map((o) => `<div style="color:#ece5d6;font-size:13px;margin-top:6px"><b style="color:#c9a24a">${o.quem}</b> · ${o.nome} — ${o.inicio}${o.duracao ? ` · ${o.duracao} min` : ''}</div>`).join('')}
    </div>` : '';
  const horaRodape = estado.modo === 'katzer' ? '14:30 (Katzer)' : '13:00 (Jlle/Casa)';
  return `<!doctype html><html><body style="margin:0;background:#08080a;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#0e0e11;border:1px solid #2a2732;border-radius:14px;overflow:hidden">
      <div style="padding:22px;text-align:center;border-bottom:1px solid #2a2732">
        <div style="letter-spacing:.34em;font-size:13px;color:#c9a24a;text-transform:uppercase;font-family:Georgia,serif">Katzer</div>
        <div style="color:#9a9283;font-size:11px;letter-spacing:.18em;text-transform:uppercase;margin-top:12px">Relatório da Rotina</div>
        <div style="color:#ece5d6;font-size:19px;font-family:Georgia,serif;margin-top:4px">${dataExtenso(estado.data, now.dow)}</div>
        <div style="margin-top:10px"><span style="color:#c9a24a;font-size:12px;border:1px solid #8a6c2e;border-radius:999px;padding:4px 12px">${modo}</span></div>
      </div>
      <div style="padding:22px;display:flex;align-items:center;gap:18px">
        <div style="font-family:Georgia,serif;font-size:56px;line-height:1;color:${cor};font-weight:600">${P.pct}<span style="font-size:20px;color:#c9a24a">%</span></div>
        <div><div style="color:#9a9283;font-size:11px;letter-spacing:.14em;text-transform:uppercase">Meta do dia</div>
          <div style="color:#ece5d6;font-size:14px;margin-top:4px">Saldo ${P.saldoMin > 0 ? '−' + P.saldoMin : '+' + (-P.saldoMin)}′</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #2a2732">${rows}</table>
      ${obsHtml}
      <div style="padding:18px 22px;color:#9a9283;font-size:12px;text-align:center;border-top:1px solid #2a2732;margin-top:16px">
        Enviado ${horaRodape} · seg–sáb · só Rotina (Campanhas = app separado).
      </div>
    </div></body></html>`;
}
