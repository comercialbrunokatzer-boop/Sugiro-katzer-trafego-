# TEMPLATE — Cartão diário do Copiloto (por campanha)

Formato oficial que o Michel recebe. Exemplo real de estilo (CEO · 2026-07-23).

Os números abaixo são **ilustrativos do formato**. Em produção, vêm do Placar (Meta) +, na Fase B, de Helena/CRM.

---

```
CAMPANHA: Fort Myers — Investidores

SITUAÇÃO:
CPL subiu de R$ 38 para R$ 54 nos últimos 3 dias.

O QUE ISSO SIGNIFICA:
Estamos pagando mais por cada cadastro, mas isso ainda não significa
que a campanha piorou.

DADO COMERCIAL:
Dos 12 leads recentes:
- 9 receberam atendimento;
- 4 foram qualificados;
- 2 agendaram;
- 1 compareceu;
- nenhum entrou em negociação ainda.

RECOMENDAÇÃO:
Não pausar hoje.

AÇÃO PARA O MICHEL:
1. Abrir o conjunto “Investidores SC”.
2. Verificar frequência.
3. Conferir se passou de 3.
4. Não alterar orçamento.
5. Preparar uma nova variação do criativo.

POR QUE:
O custo subiu, mas ainda existem sinais de qualidade. Precisamos
comparar o novo criativo antes de tomar uma decisão.

APRENDIZADO DO DIA:
CPL isolado não define campanha boa ou ruim. O que importa é o
caminho até reunião, negociação e venda.

PRECISA DE APROVAÇÃO DO BRUNO?
Não, porque hoje haverá apenas análise e preparação de criativo.
(Nível 1 — Michel executa sozinho.)
```

---

## Nível de autonomia no cartão

Incluir implícito ou explícito: **Nível 1 / 2 / 3** conforme `AUTONOMIA-MICHEL-TRAFEGO.md`.  
O exemplo Fort Myers acima é **Nível 1** (análise + preparar criativo em rascunho).  
Trocar o criativo no ar ou redistribuir verba → sobe para **Nível 2** (recomendação registrada).
## Campos obrigatórios (todo cartão)

| Campo | Regra |
|-------|--------|
| **CAMPANHA** | Nome exatamente como na Meta |
| **SITUAÇÃO** | 1 fato numérico (CPL, gasto, leads) + janela de tempo |
| **O QUE ISSO SIGNIFICA** | Traduz o número em português simples; evita pânico |
| **DADO COMERCIAL** | Funil pós-cadastro (atendeu → qualificou → agendou → compareceu → negociou). Fase A: “ainda sem cruzamento CRM” se não houver dado; Fase B: números reais |
| **RECOMENDAÇÃO** | Uma linha: pausar / não pausar / escalar / manter |
| **AÇÃO PARA O MICHEL** | Lista numerada, clicável na prática (conjunto, frequência, orçamento, criativo) |
| **POR QUE** | Liga mídia ≠ qualidade ≠ conversão |
| **APRENDIZADO DO DIA** | 1 frase que ensina o Michel |
| **PRECISA DE APROVAÇÃO DO BRUNO?** | Sim/Não + motivo. Ligado ao **nível de autonomia** (`AUTONOMIA-MICHEL-TRAFEGO.md`): Nível 1 = Não; Nível 2 = Não, se recomendação registrada; Nível 3 = Sim |

---

## O que NÃO vai no cartão

- Jargão de API / tokens / Graph  
- “A Meta IA disse que…” como ordem  
- Pausar automático  
- Planilha para o Michel preencher  
- Mais de **uma** campanha crítica por cartão prioritário (outras vão num resumo curto abaixo, se precisar)

---

## Implementação (Fase A)

Estender `resumoPlacarWhats` / tela do placar para emitir este layout.
Enquanto não houver CRM: em **DADO COMERCIAL** usar:

```
DADO COMERCIAL:
Cruzamento Helena/CRM ainda não ligado nesta fase.
Hoje a leitura é só Meta (gasto · leads · CPL).
Não pause só por CPL — espere o funil comercial.
```

Fase B preenche o funil de verdade.
