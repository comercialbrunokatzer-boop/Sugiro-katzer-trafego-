// Núcleo compartilhado da Rotina Produtiva do Michel (arquivo com "_" = NÃO vira função).
// Tarefas, horários, modo Casa/Katzer e as regras de pontualidade (tudo em BRT, UTC-3).

export const TZ = 'America/Sao_Paulo';

// 8 tarefas da manhã (horário base = modo CASA). Katzer = tudo +45 min.
export const TAREFAS = [
  { id: 'reunioes',  nome: 'Reuniões',            base: '08:00' },
  { id: 'agend',     nome: 'Agendamentos/Atend.', base: '08:10' },
  { id: 'pendencias',nome: 'Pendências',          base: '08:20' },
  { id: 'instagram', nome: 'Instagram',           base: '08:35' },
  { id: 'campanhas', nome: 'Campanhas',           base: '08:55' },
  { id: 'discadora', nome: 'Discadora',           base: '09:15' },
  { id: 'garimpo',   nome: 'Garimpo',             base: '09:35' },
  { id: 'auditor',   nome: 'Lista do Auditor',    base: '12:00' },
];

export const OFFSET_KATZER = 45; // minutos

/** "HH:MM" -> minutos desde 00:00 */
export function hm2min(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
/** minutos -> "HH:MM" */
export function min2hm(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Horário previsto de uma tarefa no modo escolhido (em minutos). */
export function previstoMin(tarefa, modo) {
  return hm2min(tarefa.base) + (modo === 'katzer' ? OFFSET_KATZER : 0);
}

/** Agora em BRT: { data:'YYYY-MM-DD', hm:'HH:MM', min:Number, dow:0..6 } */
export function agoraBRT(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const data = `${p.year}-${p.month}-${p.day}`;
  const hh = p.hour === '24' ? '00' : p.hour;
  const hm = `${hh}:${p.minute}`;
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { data, hm, min: hm2min(hm), dow: dowMap[p.weekday] ?? 0 };
}

/** Estado inicial de um dia. */
export function estadoVazio(data, modo = 'casa') {
  return { data, modo, tarefas: {}, obs: [], criadoEm: data };
}

/**
 * Calcula pontualidade (VISÃO CEO — o Michel não vê isto).
 * Regra do CEO: começa 100%; cada min de atraso -1%; adiantar devolve (saldo líquido);
 * teto 100%. Tarefa não feita e já vencida conta como atraso aberto (até 'agoraMin').
 * @returns { pct, saldoMin, linhas:[{id,nome,previsto,feito,hora,difMin,estado}] }
 */
export function pontualidade(estado, agoraMin) {
  let saldo = 0; // minutos: >0 atrasado, <0 adiantado
  const linhas = TAREFAS.map((t) => {
    const prev = previstoMin(t, estado.modo);
    const reg = estado.tarefas[t.id];
    if (reg && reg.min != null) {
      const dif = reg.min - prev; // + atrasou, - adiantou
      saldo += dif;
      return { id: t.id, nome: t.nome, previsto: min2hm(prev), feito: true, hora: min2hm(reg.min), difMin: dif, estado: dif > 0 ? 'atrasado' : 'ok', nota: reg.nota || '' };
    }
    // não feita: se já venceu, atraso aberto
    const aberto = agoraMin != null && agoraMin > prev ? agoraMin - prev : 0;
    if (aberto > 0) saldo += aberto;
    return { id: t.id, nome: t.nome, previsto: min2hm(prev), feito: false, hora: null, difMin: aberto, estado: aberto > 0 ? 'pendente' : 'aguardando' };
  });
  const pct = Math.max(0, Math.min(100, Math.round(100 - saldo)));
  return { pct, saldoMin: saldo, linhas };
}
