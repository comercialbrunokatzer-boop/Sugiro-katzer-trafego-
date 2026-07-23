# CANAL — Supervisor de Tráfego Katzer

| | |
|---|---|
| **Status** | OFICIAL (decisão do CEO · 2026-07-23) |
| **Repo** | `Sugiro-katzer-trafego-` |
| **Dono operacional** | Michel (mão na Meta) · IA trabalha PARA ele |

---

## Decisão

**Manter o canal Supervisor de Tráfego Katzer.**

A **Meta IA** (ou qualquer assistente da Meta) entra como **ferramenta especializada** desse canal — leitura/sugestão auxiliar — **e não substitui o canal**.

O canal Katzer continua sendo a fonte de:

- placar diário (gasto · leads · CPL · sugestão do dia);
- registro da decisão do Michel (1 toque);
- Placar do Gestor para o Bruno;
- separação dos 3 erros: **mídia ≠ qualidade ≠ conversão**;
- modo seguro (IA **não** pausa/escala anúncio sozinha).

---

## Pipeline oficial (CEO)

```
META ADS + ADVANTAGE+ + META IA
              ↓
      DADOS DE CAMPANHA
              ↓
 SUPERVISOR DE TRÁFEGO KATZER
              ↓
 CRUZA COM HELENA + CRM + TIME + VENDAS
              ↓
   RECOMENDAÇÃO PARA MICHEL
              ↓
 PARECER FINAL DE BRUNO QUANDO NECESSÁRIO
```

### Leitura de cada etapa

| Etapa | O que acontece | Quem / o quê |
|-------|----------------|--------------|
| **Meta Ads + Advantage+ + Meta IA** | Origem da mídia paga e sinais da plataforma | Conta Meta do Michel; Meta IA = ferramenta, não canal |
| **Dados de campanha** | Gasto, leads, resultados, CPL bruto | Graph API (`ads_read`) — aritmética em **código** |
| **Supervisor de Tráfego Katzer** | Placar, alertas 🔴/🟢, sugestão do dia, 1 toque de decisão | Este repo — motor Katzer |
| **Cruza Helena + CRM + time + vendas** | Liga anúncio → lead real → atendimento → conversão | Helena + Bitrix + Auditor + corretores — **não** só clique |
| **Recomendação para Michel** | O que pausar / escalar / mover verba | IA sugere; **Michel executa na Meta** |
| **Parecer final de Bruno** | Só quando necessário (risco, verba alta, exceção) | CEO — não no fluxo diário rotineiro |

### O que este cruzamento deve separar (sempre)

1. Erro de **mídia** — anúncio caro / Advantage+ ineficiente  
2. Erro de **qualidade** — lead curioso / número errado (Michel marca no Bitrix)  
3. Erro de **conversão** — lead bom mal atendido (Helena / time / CRM)

Sem misturar os três no mesmo “CPL ruim”.

---

## Escada de custo neste canal

Segue a governança Katzer OS (`helena-katzer` → `docs/GOVERNANCA-CUSTO-IA.md`):

1. Aritmética de CPL / filtros / ranking → **código**.
2. Regras de alerta (🔴/🟢) → **determinístico**.
3. Texto de sugestão do dia, se precisar de NLG → **modelo barato**.
4. Claude → **somente** se investigação complexa de campanha for P0 (raro).

Meta IA = ferramenta opcional **dentro** do Supervisor; nunca canal paralelo que dispense o placar Katzer.

---

## Papel do Michel (resumo)

Ver `FUNCAO-MICHEL-IA.md`: recebe placar, decide na Meta, marca qualidade do lead no Bitrix. A IA não acusa e não executa pausa sozinha.
