# RECOMENDAÇÃO PRÁTICA — Começar sem ferramenta grande

| | |
|---|---|
| **Status** | OFICIAL (CEO · 2026-07-23) |
| **Princípio** | Agilidade agora · aprender na operação · automatizar só o que se provar |
| **Prazo de aprendizado** | ~30 dias manuais/semi-manuais → aí automatizar o repetitivo e confiável |

---

## Começar sem construir uma ferramenta grande

Não abrir plataforma complexa antes de validar o Copiloto na rotina real do Michel.

---

## Primeira fase (agora)

1. **Michel** envia ou disponibiliza diariamente os dados da Meta.  
2. **A IA** gera o diagnóstico padronizado (cartão + 4 fases + árvore + professor 1 conceito).  
3. **Michel** executa as ações de baixo risco (**Nível 1**; Nível 2 só com ficha registrada).  
4. **Bruno** recebe apenas exceções e decisões relevantes (**Nível 3**).  
5. **O sistema** registra o que foi recomendado e o resultado (fechamento do dia).  
6. **Depois de 30 dias**, automatizamos **apenas** o que se mostrou repetitivo e confiável.

---

## O que isso evita

* Gastar tokens/dev numa estrutura enorme cedo demais.  
* Automatizar regra errada.  
* Transformar Michel em especialista técnico antes de operar.  
* Encher Bruno de ruído diário.

---

## Ligação com o resto do manual

| Artefato | Papel nesta fase |
|----------|------------------|
| `TEMPLATE-CARTAO-COPILOTO.md` | Diagnóstico padronizado (passo 2) |
| `AUTONOMIA-MICHEL-TRAFEGO.md` | O que Michel executa vs Bruno (passos 3–4) |
| `FECHAMENTO-DIARIO.md` | Registro recomendação → resultado (passo 5) |
| `PROTECAO-ERRO-DESPERDICIO.md` | Travas enquanto a fase 1 roda |
| `ROTINA-DIARIA-COPILOTO.md` | Manhã / meio-dia / fechamento |
| PR #7 Placar | Candidata a automatizar **depois** dos 30 dias o que for repetitivo |

---

## Critério para sair da primeira fase

Após 30 dias de cartões + fechamentos registrados:

* listar recomendações que se repetiram ≥ N vezes com bom resultado;  
* só essas viram automação (cron/API);  
* o resto continua assistido.
