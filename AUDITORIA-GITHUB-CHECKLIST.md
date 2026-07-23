# AUDITORIA GitHub — Copiloto / Placar do Michel

| | |
|---|---|
| **Status** | CHECKLIST OPERACIONAL (Conselheiro · 2026-07-23) |
| **Regra** | Auditar o que existe → validar se funciona → completar só o ausente. **Não** pedir “criar do zero”. |
| **Repo canônico** | Este (`Sugiro-katzer-trafego-` = Supervisor de Tráfego Katzer) |

Documentos misturam três estados: **aprovado** · **prototipado** · **implementado**. Só a coluna “prova” abaixo vale para produção.

---

## 12 pontos a comprovar

| # | Pergunta | Estado | Prova / onde |
|---|----------|--------|----------------|
| 1 | Token Meta passou no teste real de leitura? | **SIM** | Actions smoke OK; ~9 campanhas lidas (`META_SYSTEM_TOKEN`) |
| 2 | Protótipo HTML no repositório correto? | **PARCIAL** | PR **#7**: `placar-michel.html` / `placar-gestor.html`. Nome antigo `quadradinho-decisao.html` **não** está no git (evoluiu). Ainda **não** na `main`. |
| 3 | Backend para salvar a decisão? | **SIM (PR #7)** | `placar-registrar.mjs` + estado em blobs — merge pendente |
| 4 | Link com token seguro por Michel e por dia? | **A CONFIRMAR** | Revisar geração de `?key=` / assinatura na #7 antes do merge |
| 5 | Disparo agendado ~9h do placar de campanha? | **A CONFIRMAR** | Rotina Michel (~07:45) ≠ placar de campanha. Cron do placar: validar workflow Netlify/Actions |
| 6 | Bruno recebe WhatsApp + e-mail em tempo real a cada toque? | **REVISAR POLÍTICA** | Código #7 tende a WhatsApp a cada decisão. **Nova regra:** WhatsApp só importante/N3; Placar do Gestor sempre; e-mail **diário consolidado** |
| 7 | Placar do Gestor real (não só demo)? | **PARCIAL** | UI + dados Meta reais na #7; números fixos só no protótipo visual antigo. Produção agendada ainda não comprovada |
| 8 | Sistema confere na API Meta se Michel aplicou? | **NÃO** | Modo seguro: registra intenção. Sem `ads_management` write / sem verificação pós-ação |
| 9 | Dois toques de qualidade no Bitrix? | **NÃO COMPROVADO** | Contrato em `FUNCAO-MICHEL-IA.md`; falta evidência de campo/fluxo no código |
| 10 | Dados de venda suficientes p/ custo por venda? | **NÃO (Fase A)** | Placar hoje: gasto · leads · CPL. Custo/venda exige cruzamento CRM/Helena (Fase B) |
| 11 | IA de Tráfego em repo próprio? | **SIM** | Este repo. Não dispersar lógica nova só no Maestro Helena |
| 12 | Meta IA integrada? | **NÃO** | Apoio humano via `META-IA-ROTEIRO-MICHEL.md`. Decisão diária = Supervisor Katzer |

---

## Spec desatualizada (não seguir à letra)

| Citação antiga | Realidade |
|----------------|-----------|
| `maestro/src/secretariaFollowup.js` | **Não existe**. Follow-up: `helena-katzer/maestro/src/followup.js` |
| `maestro/src/michel.js` = placar de tráfego | Em Helena = régua/fila do Auditor (modo seguro), **não** placar Meta |
| `maestro/src/whatsapp.js` = disparo do Placar | Z-API do Maestro de leads; Placar usa `_infra.mjs` **neste** repo |
| “Falta o WhatsApp do Michel” + número em secret | Contraditório. Usar secret `WHATSAPP_MICHEL`; **nunca** repetir número em docs/logs |

---

## O que aproveitar integralmente (não reinventar)

1. **Papel do Michel** — IA faz o braçal; Michel decide e executa na Meta; marca qualidade no Bitrix.  
2. **Quadradinho de Decisão** — Aplicar / Ajustar / Agora não; modo seguro (IA não altera verba).  
3. **Três problemas** — Mídia ≠ Qualidade ≠ Conversão.  
4. **Custo por venda > CPL** — sem base → “sem base para sugerir”.  
5. **Meta IA = especialista auxiliar** — interpreta, explica, hipóteses, públicos/criativos; **não** chefia a decisão diária.

---

## Política de notificação ao Bruno (oficial)

| Canal | Quando |
|-------|--------|
| **Placar do Gestor** | Sempre atualizado a cada decisão |
| **WhatsApp** | Só decisões **importantes**, pendências ou **Nível 3** |
| **E-mail** | **1 consolidado diário** (não cada toque pequeno) |

---

## Missão correta para o Executor (Copilot)

**Não:** “Crie do zero um sistema para o Michel receber decisões pelo WhatsApp.”

**Sim:** “Audite PR #7 + secrets + workflows; valide os 12 pontos; complete somente as partes ausentes (token diário, cron placar, política de notificação, aprendizado no cartão). Preserve mídia≠qualidade≠conversão e modo seguro.”
