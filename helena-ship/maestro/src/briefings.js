/**
 * BRIEFING DIÁRIO DO CORRETOR (KOS-002 P1.B4 / "IA por corretor").
 * Cada corretor recebe no WhatsApp: Top 3 pra ligar hoje (com motivo + próxima ação + script),
 * pendências vencidas e agenda do dia. Sem abrir sistema.
 * Puro e testável: recebe os leads do corretor, devolve o briefing pronto.
 */
import { proximaAcaoSugerida } from './secretaria.js';

const SCRIPT = {
  'Lead Novo': 'Oi {nome}, aqui é da Katzer. Vi seu interesse — posso te mostrar as opções?',
  'Qualificado': 'Oi {nome}, sobre o imóvel que você quis conhecer: consigo te encaixar uma visita. Qual o melhor dia?',
  'Negociação': 'Oi {nome}, preparei uma condição boa pra fechar. Posso te passar a proposta?',
  'Documentação': 'Oi {nome}, pra avançar eu preciso de alguns documentos — te mando a listinha?',
  'Fechado': 'Parabéns pela conquista, {nome}! Já te acompanho na próxima etapa.',
  'Pós-venda': 'Oi {nome}, tudo certo com o imóvel? Qualquer coisa, estou por aqui.',
};

export function scriptSugerido(estagio, nome = '') {
  return (SCRIPT[estagio] || 'Oi {nome}, tudo bem? Retomando nosso contato.').replace('{nome}', nome || 'cliente');
}

export function briefingCorretor(corretor, leads = [], { max = 3 } = {}) {
  const ativos = (leads || []).filter((l) => !l.encerrado);
  const ordenados = [...ativos].sort(
    (a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0) || (b.valor ?? 0) - (a.valor ?? 0),
  );
  const top3 = ordenados.slice(0, max).map((l) => ({
    cliente: l.cliente,
    estagio: l.estagio,
    motivo: l.motivo || `prioridade ${l.prioridade ?? '—'}${l.valor ? ` · ticket ${l.valor}` : ''}`,
    ultimo_contato: l.ultimo_contato_dias != null ? `${l.ultimo_contato_dias}d atrás` : '—',
    proxima_acao: l.proxima_acao || proximaAcaoSugerida(l.estagio),
    script: scriptSugerido(l.estagio, l.cliente),
  }));
  return {
    corretor,
    top3,
    pendencias: ativos.filter((l) => l.pendencia_vencida).map((l) => ({ cliente: l.cliente, o_que: l.pendencia || 'tarefa vencida' })),
    agenda: ativos.filter((l) => l.agendado_hoje).map((l) => ({ cliente: l.cliente, hora: l.hora || '—' })),
    sem_movimento: ativos.filter((l) => (l.ultimo_contato_dias ?? 0) >= 7).length,
  };
}
