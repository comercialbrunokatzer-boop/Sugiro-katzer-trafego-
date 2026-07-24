/**
 * HOMOLOGAÇÃO DA SECRETÁRIA (KOS-002 P1.A2).
 * Roda um banco de casos (pareceres da IA) pela camada de decisão do Maestro e confere
 * se ela AGE certo: aprova o que deve, manda pra revisão o que é duvidoso, roteia pra quem
 * deve olhar. É a prova de que a Secretária pode ser ligada com segurança.
 */
import { decideAtualizacao } from './secretaria.js';

/** Casos golden — o comportamento esperado da Secretária, caso a caso. */
export const CASOS_GOLDEN = [
  { nome: 'interesse/visita → Mapeamento (zona verde, Michel acompanha)',
    parecer: { recommended_stage: 'Mapeamento', confidence: 0.9, evidence: ['quero marcar uma visita'] },
    esperado: { acao: 'ATUALIZAR', acompanhamento: 'MICHEL' } },
  { nome: 'negociação REAL → PROPÕE pro Bruro (não move sozinha)',
    parecer: { recommended_stage: 'Negociação', confidence: 0.9, evidence: ['fecho se abaixar pra 950'] },
    esperado: { acao: 'PROPOR', revisor: 'BRUNO' } },
  { nome: 'Ganhou sem confirmação objetiva → revisão do Bruno',
    parecer: { recommended_stage: 'Ganhou', confidence: 0.99, evidence: ['ele gostou muito'] },
    esperado: { acao: 'REVISAO_HUMANA', revisor: 'BRUNO' } },
  { nome: 'confiança baixa → revisão',
    parecer: { recommended_stage: 'Negociação', confidence: 0.3, evidence: ['talvez desconto'] },
    esperado: { acao: 'REVISAO_HUMANA' } },
  { nome: 'regressão sem justificativa → revisão',
    parecer: { recommended_stage: 'Leads Novos', confidence: 0.9, evidence: [] },
    estagioAtual: 'Negociação',
    esperado: { acao: 'REVISAO_HUMANA' } },
  { nome: 'Ganhou com assinatura → PROPÕE pro Bruno (fase crítica: só com OK)',
    parecer: { recommended_stage: 'Ganhou', confidence: 0.98, evidence: ['cliente disse que já assinou o contrato'] },
    esperado: { acao: 'PROPOR', revisor: 'BRUNO' } },
];

export function homologaSecretaria(casos = CASOS_GOLDEN) {
  const resultados = casos.map((c) => {
    const d = decideAtualizacao(c.parecer, { estagioAtual: c.estagioAtual || null, dealId: 'HOMOLOG' });
    const checks = [];
    if (c.esperado.acao) checks.push(d.acao === c.esperado.acao);
    if (c.esperado.acompanhamento) checks.push(d.acompanhamento === c.esperado.acompanhamento);
    if (c.esperado.revisor) checks.push(d.revisor === c.esperado.revisor);
    const ok = checks.every(Boolean);
    return { nome: c.nome, ok, obtido: { acao: d.acao, acompanhamento: d.acompanhamento, revisor: d.revisor }, esperado: c.esperado };
  });
  const passou = resultados.filter((r) => r.ok).length;
  return { total: resultados.length, passou, falhou: resultados.length - passou, resultados, aprovado: passou === resultados.length };
}
