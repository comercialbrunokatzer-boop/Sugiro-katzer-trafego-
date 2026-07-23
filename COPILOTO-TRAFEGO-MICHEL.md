# COPILOTO DE TRÁFEGO DO MICHEL

| | |
|---|---|
| **Status** | SPEC OFICIAL (CEO · 2026-07-23) — Conselheiro |
| **Canal** | Supervisor de Tráfego Katzer |
| **Princípio** | IA recomenda, explica e ensina · Michel executa · Bruno aprova o relevante |
| **Escada de custo** | Código/regra → modelo barato → Claude só se P0 |
| **Autonomia** | Ver `AUTONOMIA-MICHEL-TRAFEGO.md` (Níveis 1 · 2 · 3) |

---

## 1. Objetivo

Transformar o Michel em **operador de tráfego assistido por IA**, sem exigir que ele vire especialista técnico antes de começar.

Não é um sistema novo complexo. É uma **função diária** dentro do Supervisor de Tráfego Katzer, alimentada por Meta Ads (+ Advantage+ / Meta IA como ferramenta), e depois por Helena + CRM + vendas.

---

## 2. Papéis (não negociar)

| Quem | Faz | Não faz |
|------|-----|---------|
| **Copiloto Katzer** | Recomenda, explica, ensina, mostra onde clicar | Não pausa/escala sozinho; não é professor único da Meta |
| **Michel** | Executa na Meta (1 toque / decisão) | Não monta planilha; não precisa decifrar API |
| **Bruno** | Parecer em verba alta, risco, exceção, arquitetura | Não opera o dia a dia do placar |
| **Meta AI Business Assistant + Advantage+** | Otimização e insights **dentro da plataforma** | Não decide verba Katzer sozinha; não vê Helena/CRM/venda sozinha |

Pipeline (já no canal):

```
Meta Ads + Advantage+ + Meta IA
        ↓
  Dados de campanha
        ↓
 Supervisor / Copiloto Katzer
        ↓
 Cruza Helena + CRM + time + vendas
        ↓
 Recomendação para Michel
        ↓
 Parecer Bruno quando necessário
```

---

## 3. Entrega diária ao Michel (formato fixo)

**Template oficial (exemplo do CEO):** ver `TEMPLATE-CARTAO-COPILOTO.md`  
(Campanha Fort Myers — Investidores: situação → significado → dado comercial → recomendação → ação → por quê → aprendizado → precisa Bruno?).

Resumo dos blocos obrigatórios:

1. **CAMPANHA / SITUAÇÃO** — fato numérico + janela  
2. **O QUE ISSO SIGNIFICA** — traduz sem pânico  
3. **DADO COMERCIAL** — funil pós-cadastro (Fase B); na A, avisar se só Meta  
4. **RECOMENDAÇÃO** — pausar / não pausar / escalar / manter  
5. **AÇÃO PARA O MICHEL** — passos numerados (onde clicar / o que não alterar)  
6. **POR QUE** — mídia ≠ qualidade ≠ conversão  
7. **APRENDIZADO DO DIA** — 1 frase  
8. **PRECISA DE APROVAÇÃO DO BRUNO?** — Sim/Não + motivo  

Modo seguro: a mão que pausa/escala é do **Michel**. O Copiloto **sugere**.

---

## 4. Fases (simples → completo)

### Fase A — MVP (já quase pronto na PR #7)
- Motor determinístico: gasto · leads · CPL · decidir escalar/revisar (`_placar.mjs`)  
- Mensagem WhatsApp + tela `placar-michel`  
- **Estender** o texto para cobrir os 8 blocos acima (hoje a PR cobre bem 1–3 e parte de 5; faltam 4, 6, 7, 8 de forma explícita)  
- **Sem** modelo caro: templates + regras  
- Meta IA: opcional, o Michel pode abrir na Meta **depois** de ler o Copiloto Katzer  

### Fase B — Cruzamento Katzer (valor real)
- Cruzar campanha → leads Helena/Bitrix → resposta → agendamento → venda  
- Separar erro de mídia / qualidade / conversão com dado, não achismo  
- “Por que” e “aprendizado” passam a usar evidência do CRM  

### Fase C — Meta IA como ferramenta especializada
- Conector/API oficial onde fizer sentido  
- Copiloto Katzer **ingere** insight da Meta e **confronta** com CRM  
- Nunca substitui o canal Katzer nem o parecer do Bruno em verba relevante  

---

## 5. Impacto de custo (checklist)

| # | Resposta (Fase A) |
|---|-------------------|
| 1. Aumenta chamadas de IA? | **Não** (templates + regras) |
| 2. Modelo? | Nenhum no MVP |
| 3. Frequência? | **1× por dia** (cron) + sob demanda `?key=` |
| 4. Alternativa sem IA? | **Sim — é o default** |
| 5. Modelo barato depois? | Só se o texto “por que/aprendizado” precisar de NLG na Fase B+ |
| 6. Cache? | Blobs/estado do placar do dia (já previsto na #7) |
| 7. Loop agentes? | Não — um cron, um canal |
| 8. Duas IAs na mesma coisa? | Meta IA **fora** do loop automático no MVP |
| 9. Limite mensal? | ~0 tokens MVP; custo = Netlify + Graph API |
| 10. Kill switch? | Desligar cron / secret WhatsApp / key do placar |

---

## 5.1. Proteção contra erro e desperdício

Ver `PROTECAO-ERRO-DESPERDICIO.md`: decisão certa, verba, tokens e não culpar a fase errada.

## 6. Relação com o que já existe

| Artefato | Papel |
|----------|--------|
| PR **#7** Placar | Base técnica do Copiloto (núcleo + UI + API) |
| `FUNCAO-MICHEL-IA.md` | Contrato humano do Michel |
| `CANAL-SUPERVISOR-TRAFEGO.md` | Canal oficial + pipeline |
| Rotina Michel (já na `main`) | Outro card (checklist do dia); **não** substitui o Copiloto de mídia |
| Helena / Auditor | Entrada da Fase B (cruzamento) |

**Não criar** repo novo. **Não renomear** o canal para “Sugiro”. Nome da função: **Copiloto de Tráfego do Michel**.

---

## 7. Critérios de aceite — Fase A

- [ ] Michel recebe 1 mensagem/dia com os **8 blocos**  
- [ ] Decisão 🟢/🔴 vem de regra determinística testada  
- [ ] Existe “não altere isto hoje”  
- [ ] Existe 1 aprendizado do dia persistido (estado/histórico)  
- [ ] Zero pausa automática de campanha  
- [ ] Bruno só é acionado se verba/risco passar do limiar (definir com CEO: ex. revisar campanha > R$ X/dia)

---

## 8. Aprendizado do dia (professor embutido)

O Copiloto **ensina** no fluxo. Spec: `PROFESSOR-EMBUTIDO-MICHEL.md` + campo no `TEMPLATE-CARTAO-COPILOTO.md`.

**Obrigatório em cada recomendação:** `APRENDIZADO DO DIA` (1 frase no caso).  
**Opcional (1 conceito/dia):** bloco `MICHEL, APRENDA ISTO`:

```
MICHEL, APRENDA ISTO:

CTR: Mostra quantas pessoas clicaram após ver o anúncio.
CPM: Mostra quanto estamos pagando por mil impressões.
Frequência: Mostra quantas vezes, em média, cada pessoa viu o anúncio.
CPL: Mostra o custo de cada cadastro.

Mas nenhum deles sozinho mostra se estamos vendendo.
```

(Usar **só um** desses quatro por dia no cartão; o bloco completo fica no guia do painel.)

**Regra:** um conceito por dia, numa campanha real — ver `ROTINA-DIARIA-COPILOTO.md`. Em ~60 dias Michel aprende na própria operação.

---

## 9. Auditoria GitHub (não reinventar)

Checklist dos 12 pontos + política de notificação: `AUDITORIA-GITHUB-CHECKLIST.md`.

Missão ao Executor: **auditar → validar → completar só o ausente.**

---

## 10. Próximo passo recomendado (Bruno)

**Recomendação prática (oficial):** ver `RECOMENDACAO-PRATICA-FASE1.md`

Começar **sem** ferramenta grande. Primeira fase: Michel manda dados Meta → IA diagnostica → Michel executa baixo risco → Bruno só exceções → registra resultado → em **30 dias** automatiza só o repetitivo/confiável.

Docs: mergear esta PR **#10**. Código do placar (#7) entra quando a rotina manual/semi já estiver rodando. Ajustar notificação Bruno na #7 conforme política do checklist.
