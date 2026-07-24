// =====================================================================
// CONTEXTO TEMPORAL INTELIGENTE (extraído de helena.js)
// =====================================================================
// Deriva saudação, horário comercial, fim de semana, sazonalidade e
// feriado próximo a partir do instante atual.
//
// Extraído para módulo próprio com relógio INJETÁVEL (parâmetro `now`),
// permitindo testes determinísticos. Sem argumento, usa `new Date()` —
// COMPORTAMENTO IDÊNTICO ao que estava inline no helena.js.
//
// NOTA (dívida técnica conhecida): `hora` e as strings usam o fuso
// America/Sao_Paulo, mas dow/mes_num/dia usam o fuso local do processo.
// Em produção o servidor deve rodar em America/Sao_Paulo (ou UTC-3) para
// os dois coincidirem. Comportamento preservado como estava.
// =====================================================================

function getDateContext(now = new Date()) {
  const opts = { timeZone: "America/Sao_Paulo" };

  const hora = parseInt(now.toLocaleTimeString("pt-BR", {
    ...opts, hour: "2-digit", hour12: false
  }), 10);

  let saudacao;
  if (hora >= 5 && hora < 12) saudacao = "bom dia";
  else if (hora >= 12 && hora < 18) saudacao = "boa tarde";
  else saudacao = "boa noite";

  // detecta horario fora do comercial (lead mandando tarde da noite)
  const fora_comercial = hora >= 22 || hora < 7;

  // detecta fim de semana
  const dow = now.getDay(); // 0 dom, 6 sab
  const fim_de_semana = dow === 0 || dow === 6;

  // mes (pra urgencia CUB +1%/mes)
  const mes = now.toLocaleDateString("pt-BR", { ...opts, month: "long" });
  const mes_num = now.getMonth() + 1;

  // sazonalidade
  let sazonalidade;
  if ([12, 1, 2].includes(mes_num)) sazonalidade = "alta_temporada_verao";
  else if ([6, 7].includes(mes_num)) sazonalidade = "ferias_inverno";
  else sazonalidade = "regular";

  // dia mes ano
  const data = now.toLocaleDateString("pt-BR", opts);
  const horaStr = now.toLocaleTimeString("pt-BR", { ...opts, hour: "2-digit", minute: "2-digit" });
  const dia_semana = now.toLocaleDateString("pt-BR", { ...opts, weekday: "long" });

  // detecta feriados/datas importantes
  const dia = now.getDate();
  let feriado_proximo = null;
  if (mes_num === 12 && dia >= 20 && dia <= 26) feriado_proximo = "natal";
  else if (mes_num === 12 && dia >= 28) feriado_proximo = "ano_novo";
  else if (mes_num === 1 && dia <= 3) feriado_proximo = "ano_novo";
  else if (mes_num === 4 && (dia === 21)) feriado_proximo = "tiradentes";
  else if (mes_num === 5 && (dia === 1)) feriado_proximo = "dia_trabalho";
  else if (mes_num === 9 && (dia === 7)) feriado_proximo = "independencia";
  else if (mes_num === 11 && (dia === 15)) feriado_proximo = "republica";

  return {
    data, hora: horaStr, dia_semana, mes, mes_num,
    saudacao, fora_comercial, fim_de_semana,
    sazonalidade, feriado_proximo
  };
}

module.exports = { getDateContext };
