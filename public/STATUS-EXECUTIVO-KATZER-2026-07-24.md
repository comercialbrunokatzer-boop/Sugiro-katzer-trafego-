# STATUS EXECUTIVO COMPLETO — Operação Katzer

| | |
|---|---|
| **Data** | 2026-07-24 |
| **Autor** | Cursor (executor) |
| **Destino** | Conselheiro / CEO |
| **Regra** | Não é o relatório do último commit — é o estado real de cada frente. |

**Leitura ao vivo (24/07):** Helena **v7.63** no ar (`regal-chaja-662035`); Maestro em **`modo: homolog`** (credenciais Bitrix write / Firebase / ZAPI ok); tráfego **Meta + ZAPI + WhatsApps ok**, placar com **cartões Copiloto** e Meta confiável.

---

# 1. HELENA

### Situação atual
Helena é o produto comercial vivo: SDR de WhatsApp com IA, no Netlify **regal-chaja-662035**, versão **7.63**. Atende, qualifica, trava produto (Product Lock), mídia, idioma (PT/EN/ES — SUL-AMERICANOS → ES corrigido), flerte v2, cartão de alerta ao Bruno, Whisper, time Bruno/Carol/Michel configurados.

Ela **conversa em produção**. O que ainda não opera sozinho é a camada CRM/automação à volta dela (Secretária write, cadências ligadas, follow-up genérico).

### O que já está em produção
- Conversa WhatsApp (ZAPI) com cérebro IA.
- Product Lock, Admin CMD, mídia inteligente, trava de orçamento (código na `main` + deploy).
- Idioma por campanha (incl. SUL-AMERICANOS → espanhol).
- Abertura Form → Helena (**desligada por padrão**; liga com `HELENA_CAMPANHAS_BRUNO` + token).
- Flerte v2, cartões de alerta, anti-spam básico de conversa.
- Health: `ok`, Whisper OpenAI ok, team Bruno/Carol/Michel ok.

### O que está em homologação / código pronto sem GO
- **Primeiro contato → Tentando Contato** (#90): lógica pronta, **dry-run** — não afirmar escrita Bitrix em produção.
- **Gatekeeper + varredura de carteira**: cérebros no repo; cron de varredura em dry-run; **não dispara WhatsApp em massa** sem GO.
- **Retomada patrocinado** e **cadência** (Tentando Contato / Mapeamento): crons existem, **OFF por default**.
- **Secretária**: lê e decide; **não grava Bitrix** enquanto `SECRETARIA_MODO ≠ producao` + GO Bruno.
- Homologação formal **testes 1–25** (docs `STATUS-HELENA-HOMOLOGACAO.md`): planilha existe; **validação WhatsApp real do Bruno ainda é o gargalo**, não o código.

### O que ainda falta
- Validação prática Bruno dos testes Product Lock / orçamento / mídia / idioma no WhatsApp real.
- Mídia Drive pull-list (**#48**) — bloqueado sem **P18** (Google Drive API).
- Dados de produto: P12–P17 (plantas, Infinity, Destin, Celebration, Tropicale…).
- Decisão **P8**: responder na hora × esquentar.
- Draft **#140** Michel `filaDeAcao` (homolog) — não mergeado.
- Draft **#96** fallback AI — WIP/obsoleto relativo ao #95.

### Principais riscos
1. Achar que “está na main” = “validado no WhatsApp” (não é).
2. Ligar Bitrix write / cadência / gatekeeper sem GO → regressão de estágio ou spam na base.
3. Mídia incompleta → Helena promete o que não entrega.
4. Maestro em homolog: escrita ampla ainda travada de propósito.

### Próximo passo
1. Bruno roda (ou manda Michel/Carol) a bateria mínima dos testes 1–11 + 14–20 no WhatsApp.
2. Em paralelo: **não** ligar escrita Bitrix até isso.
3. Só depois: GO Secretária / cadência em lote controlado.

---

# 2. CADÊNCIA "TENTANDO CONTATO"

### Status geral
**Parcialmente pronta no código · não operando sozinha em produção.**

| Pergunta | Resposta sincera |
|---|---|
| Pronta? | **Cérebro + templates + cron: sim. Operação automática: não.** |
| Parcialmente pronta? | **Sim.** |
| Em desenvolvimento? | Núcleo estável; refinamentos possíveis. |
| Falta deploy? | Função já no site (`cadencia-cron`). Falta **ligar env**. |
| Falta integração? | Integra Bitrix leitura + Firebase estado + POST retomada Helena. Falta **GO + `CADENCIA_AUTO=1` + `CADENCIA_MODO=producao`**. |

### O que funciona (código)
- Stage Bitrix: `C1:PREPARATION` = Tentando Contato.
- Elegibilidade: responsável Bruno, lead patrocinado, telefone válido, idade ≤ 90 dias.
- Template próprio `tentando_contato`.
- Anti-spam (intervalo ~36h, teto diário ~12, lote ~4).
- Janela comercial.
- Cron: **10h30 / 13h30 / 16h30 BRT**, seg–sáb.

### O que ainda não funciona operacionalmente
- **Default OFF** (`CADENCIA_AUTO` desligado → cron responde “pulado”).
- Sem `CADENCIA_MODO=producao` → só simula (homolog).
- Não há evidência de lote real saindo sozinho para a base hoje.
- Não cobre corretores (só Bruno + patrocinado).
- Mídia da cadência ainda depende do inventário/Drive (#48).

**Veredito:** etapa **pronta para homolog controlada**; **não pronta para “ligar e esquecer”**.

---

# 3. CADÊNCIA "MAPEAMENTO"

### Funcionamento
Mesmo motor que Tentando Contato (`cadenciaPatrocinado.js` + `cadencia-cron`).  
Stage: `C1:PREPAYMENT_INVOICE` = Mapeamento.  
Template próprio `mapeamento` (valores/condições × bate-papo).

### Integração
- Lê deals Bruno nesses stages via Bitrix.
- Monta fila com mensagem + chave de mídia.
- Envio real só com os mesmos switches da cadência.
- Follow Up (`C1:UC_7P0WD3`) entra como **gancho** no mesmo cron (não é cadência de mapeamento contextual completa).

### Automações
- Cron compartilhado (3×/dia útil).
- Anti-spam compartilhado.
- **Não** há automação rica tipo “lembrete amanhã / 2 dias” (ainda não implementado).

### Pendências
- Ligar `CADENCIA_*` com GO.
- Follow-up **contextual** de Mapeamento (arquitetura só — PR exclusiva futura).
- Validar textos + mídia por produto no WhatsApp real.
- Separar métricas Tentando Contato × Mapeamento no relatório (hoje é um lote só).

### Testes realizados
- Testes unitários do cérebro de fila existem no repo.
- Homolog WhatsApp ponta a ponta da cadência **não está marcada como VALIDADO EM PRODUÇÃO**.

### Bloqueios
- GO Bruno para disparo automático.
- P18/mídia para anexos corretos.
- Confiança de que não vai cutucar lead que humano já assumiu (flags Firebase precisam estar consistentes na operação real).

**Veredito:** **mesmo estágio da Tentando Contato** — código irmão, operação **ainda desligada**.

---

# 4. FOLLOW-UP (PÓS-ATENDIMENTO)

### Já existe?
**Sim o cérebro. Não o operador completo.**

- Existe: `maestro/src/followup.js` — 30 min Helena → 2 h Michel → 4 h Bruno; relógio para com humano / resposta / opt-out / agendamento / fora da janela.
- Existe: gancho dentro da **cadência patrocinado** para fase Follow Up (`followup_pos_interesse`) — só Helena no lote; Michel/Bruno viram alerta na fila, não disparo completo genérico.
- **Não existe** cron dedicado `followup-cron` ligado (SPEC aprovada pelo Olheiro; implementação do agendador genérico ainda pendente).

### Quem dispara?
Hoje, na prática: **ninguém de forma confiável e geral**.  
Parcialmente: `cadencia-cron` **se** `CADENCIA_AUTO` ligado e o deal estiver em Follow Up patrocinado Bruno.

### Quem controla o tempo?
O cérebro (`proximoFollowup` + estado Firebase). Sem agendador genérico rodando, o tempo **não é cobrado** na operação.

### Já conversa com Bitrix?
Leitura de stage/deal na cadência: **sim (quando o cron roda)**.  
Escrita de estágio por follow-up: **não é o papel principal deste módulo** (isso é Secretária).

### Já conversa com Maestro?
Sim — vive dentro do Maestro. Não é um serviço separado.

### Regras que já existem
- Escala 30 / 120 / 240 min.
- Não pula nível.
- Limite diário (default 3).
- Paradas: encerrado, opt-out, agendamento, humano, cliente respondeu, fora da janela, follow-up pendente.
- Spec Olheiro: etapas Tentando Contato / Mapeamento / Follow Up; v1 com template curto; `FOLLOWUP_AUTO` off + homolog.

### O que falta para operar sozinho
1. Cron genérico (a cada ~15 min) montando estado de todos os leads ativos (não só patrocinado Bruno).
2. Persistência idempotente de `niveis_disparados`.
3. Disparo real: WhatsApp Helena + alertas Michel/Bruno.
4. `FOLLOWUP_AUTO` + GO produção.
5. Não conflitar com `cadencia-cron` no mesmo lead.
6. Lembretes (“amanhã”, “2 dias”) — **ainda não existem**.

**Veredito sincero:** follow-up **não opera sozinho hoje**. É cérebro + SPEC + gancho parcial.

---

# 5. SECRETÁRIA IA

### Relatório completo

| Capacidade | Status real |
|---|---|
| **Leitura de WhatsApp** | **Sim** — lê `helena_conversas` no Firebase (últimas 48h, sem `handledByHuman`). Dry-run já rodou ponta a ponta (ex.: Artur Nunes). |
| **Interpretação** | **Sim** — farejador determinístico + caminho Claude para leitura fina; funil oficial 18 fases mapeado. |
| **Mudança automática de estágio** | **Código sim · produção não.** Zona verde (até reunião) pode `ATUALIZAR`; zona vermelha só propõe. Só escreve se `SECRETARIA_MODO=producao` + `SECRETARIA_AUTO` + GO. Maestro health hoje: **`modo: homolog`**. |
| **Geração de tarefas** | Parcial — plano de ação / comentários no card; não é um task manager completo separado. |
| **Atualização Bitrix** | Cliente write existe; **credencial bitrix_write=true**; **modo operacional ainda homolog** → não tratar como “já grava sozinha na base”. |
| **Fila de revisão** | Zona vermelha → proposta (WhatsApp Bruno); zona verde em homolog fica inerte (nem escreve nem avisa em excesso). |
| **Classificação por confiança** | **Sim** — limiar de confiança; abaixo → `requer_revisao`; anti-regressão de estágio (**#118**) clampada. |
| **Próximos passos** | 1) Manter AUTO off até testes Helena ok. 2) GO Bruno P4 (`MAESTRO_MODO`/`SECRETARIA_MODO=producao`). 3) Confirmar webhook write (P5). 4) Rodar lote pequeno zona verde. 5) Só então ampliar. |

### Percentual aproximado de conclusão
- **Código / arquitetura:** ~**75%**
- **Operação autônoma real:** ~**35–40%** (lê e decide; **não fecha o ciclo sozinha em produção**)
- **Pronto para “Bruno nunca mais preenche CRM”:** **não** — depende de GO + validação.

Vocab/funil (#47), campos oficiais (#66/#67), anti-regressão (#118): **feitos**. Fase 2 (escrita ampla confiável): **travada em Bruno**.

---

# 6. MAESTRO

### Infraestrutura
- Embutido no repo Helena / Netlify regal-chaja.
- Health próprio: `maestro-health` → `ok`, `modo: homolog`, broker pool 3.
- Firebase + ZAPI + Bitrix read: ok. Alerta CEO Maestro: `alerta_ceo: false` no health.

### Webhooks
- Leitura Bitrix: **feito** (raio-x 18 fases).
- Escrita: código + credencial presente; **porta de produção = GO Bruno (P4/P5)**.

### Filas
- Secretária cron (2h) — gated.
- Cadência cron (3×/dia) — gated.
- Retomada cron — gated.
- Varredura/gatekeeper — dry-run / gated.
- Michel `filaDeAcao` — **PR draft #140**, ainda não na operação.
- Follow-up genérico — **sem cron**.

### Eventos
- Contrato de eventos / wiring existe no Maestro (`evento.js`, ingest, etc.).
- Helena deve gerar evento em movimentação relevante (mapa de governança). Cobertura ponta a ponta ainda uneven por frente.

### Integrações
| Sistema | Status |
|---|---|
| Bitrix | Leitura ok · escrita gated |
| Firebase | ok |
| ZAPI / WhatsApp | ok |
| Helena HTTP (retomada/abertura) | token-gated |
| Tráfego / Meta | **outro site** (não misturar); corte de escopo issue #6 |

### Produção vs homologação
- Site no ar = **produção de código**.
- Maestro **declarado homolog** no health = **comportamento seguro** (não escrever/disparar amplo).
Isso é correto e intencional — não é “Maestro fora do ar”.

---

# 7. AUDITOR

### Funcionando?
**Sim, como funcionário digital read-only** no repo `katzer-auditor001`.  
Heartbeat e Supervisor rodaram com sucesso (23–24/07).  
**Relatório de Recuperação (Rampage)** está **falhando** de forma recorrente (22–24/07) — buraco real.

### Lendo Bitrix?
**Sim** (webhook read-only). Nunca escreve CRM.

### Enviando relatórios?
Sim via **GitHub Actions → Issues** (e e-mail do repo privado).  
Nem todos os relatórios “dos sonhos do CEO” estão no ar.

### Quais relatórios já produz / workflows ativos
Já existentes (amostra): Diário · Semanal · Auditoria de etapa · Supervisor · Batimento · Raio-X Bitrix · Raio-X duplicados · Top 20 faturamento · Auditoria Top 20 · Caça-Baleia · Uso de campos · Relatório recuperação (quebrado) · Ranking fluxo (rascunho) · várias sondas.

### O que falta
- Os **3 e-mails oficiais do CEO** (Empresa / CEO / Placar Michel) — SPEC ainda marca **a fazer**.
- Consertar **Recuperação Rampage**.
- Inventário de frentes (**Helena #122**) aguardando specs.
- Cadência 3 ligações/dia + Carteira corretor + leads pagos parados em Leads Novos — README do Auditor: **ainda não faz**.
- Validar **15 regras** para Michel sair do modo seguro e cobrar de verdade.
- Não confundir com **Helena Auditora** do tráfego (qualidade de lead Meta) — é outro módulo.

---

# 8. SUPERVISOR META ADS

| Pergunta | Resposta |
|---|---|
| Existe? | **Sim** — canal Supervisor / Copiloto no repo tráfego + site **rotina-produtiva-michel**. |
| Começou? | **Sim, Fase A operacional.** |
| Arquitetura pronta? | **Fase A sim. Fase B (cruzar CRM/Helena/venda) não.** |
| Integração Meta? | **Sim** — health Meta ok; placar lê insights; token server-side. |
| Relatórios automáticos? | Crons de relatório (manhã/tarde/16h), placar-estado, cartões WhatsApp Copiloto (8 blocos Fase A). |
| CPL | Ranking CPL bruto + CPL bom; decisões/sugestões no placar. |
| Campanhas | Leitura + recomendação; **Michel executa**; IA **não pausa sozinha**. |
| E-mails diários | Canal principal = **WhatsApp/placar**, não “e-mail diário Meta” como produto separado. |

**Não iniciado / fraco:** auto-execução Meta (proibido sem GO), cruzamento qualidade→venda (Fase B), e-mail diário estilo Auditor 3-way.

---

# 9. KATZER OS — MAPA DE MÓDULOS

| Módulo | Status |
|---|---|
| Helena SDR (WhatsApp IA) | 🟢 Produção |
| Product Lock / Admin / Mídia local | 🟢 Produção (validação WA parcial) |
| Idioma por campanha | 🟢 Produção |
| Form → abertura Helena | 🟡 Código pronto · default OFF |
| Maestro (orquestração) | 🟡 No ar em **homolog operacional** |
| Secretária IA | 🟡 Cérebro pronto · escrita OFF |
| Cadência Tentando Contato | 🟡 Código + cron · AUTO OFF |
| Cadência Mapeamento | 🟡 Código + cron · AUTO OFF |
| Retomada patrocinado (Leads Novos / Tentando) | 🟡 Código + cron · AUTO OFF |
| Follow-up pós-atendimento (cérebro) | 🟡 Cérebro pronto · agendador incompleto |
| Follow-up contextual Mapeamento | 🔴 Não iniciado (só arquitetura) |
| Lembretes (“amanhã / 2 dias”) | 🔴 Não iniciado |
| Gatekeeper / varredura carteira | 🟡 Dry-run / gated · sem GO base antiga |
| Bitrix write produção | 🔴 Travado em GO Bruno |
| Mídia Drive pull-list (#48) | 🔴 Bloqueado P18 |
| Auditor 001 (leitura Bitrix) | 🟢 Operando (com falhas pontuais) |
| 3 relatórios e-mail CEO (SPEC) | 🔴 Ainda não entregues como especificado |
| Michel filaDeAcao / régua | 🟡 Modo seguro · draft #140 |
| Supervisor Meta / Copiloto Fase A | 🟢 Produção (recomenda, não executa Meta) |
| Copiloto Fase B (Meta × CRM × venda) | 🔴 Não iniciado de verdade |
| Placar / ranking CPL / mix verba | 🟢 Produção |
| Helena Auditora (qualidade lead tráfego) | 🟡 Existe no tráfego · evolução contínua |
| Garimpo multi-cliente | 🟢 No ar (painel Michel) |
| Caçador / alertas CEO campanhas | 🟡 Funções no tráfego · maturidade mista |
| PWA / painéis Michel–gestor | 🟡 Legado + novos; consolidação em curso |
| Diretor 002 | 🔴 Preparação / não operação |
| Corte Tráfego → Maestro (#6) | 🟡 Decidido · migração multi-fase |
| Olheiro / Claude P0 / ChatGPT Arquiteto | 🟢 Processo (não produto deployável) |

---

# 10. PRÓXIMOS 10 PASSOS (prioridade)

1. **Homologar Helena no WhatsApp real** (testes Product Lock / orçamento / mídia / idioma) — sem isso o resto é teatro.
2. **Corrigir Relatório de Recuperação do Auditor** (falha recorrente).
3. **Fechar/avançar inventário Auditor (#122)** + alinhar os 3 e-mails do CEO.
4. **Validar 15 regras do Auditor** → destravar Michel cobrar de verdade.
5. **Merge controlado #140** (Michel fila homolog) depois de 2–4.
6. **GO Bruno Bitrix write** só após 1 estável → ligar Secretária em lote pequeno zona verde.
7. **Homolog cadência** Tentando Contato + Mapeamento com `CADENCIA_AUTO` em modo observação, depois produção limitada.
8. **Implementar follow-up-cron genérico** (SPEC já aprovada) em homolog.
9. **P18 + #48** mídia Drive (desbloqueia qualidade comercial da Helena).
10. **Copiloto Fase B** (cruzar Meta × Bitrix/Helena) — maior ROI de tráfego depois da base estável.

---

# 11. BLOQUEIOS — SÓ BRUNO

Tudo que **não anda sem você**:

| # | Bloqueio |
|---|---|
| **P4** | GO explícito Bitrix write / `MAESTRO_MODO` + Secretária produção |
| **P5** | Confirmar/usar webhook de **escrita** Bitrix na operação |
| **P8** | Decidir timing: responder na hora × esquentar |
| **P12–P17** | Dados/mídia de produto (plantas, Infinity, Destin, Celebration, Tropicale…) |
| **P18** | Conta Google / Drive API → destrava #48 |
| **GO cadência / retomada / gatekeeper** | Qualquer disparo automático em base real |
| **GO Meta** | Pausar/escalar/orçamento em massa (Copiloto não faz sozinho) |
| **Validação WhatsApp** | Aprovar/reprovar testes 1–25 (Michel painel é seu, não do executor) |
| **Validar 15 regras Auditor** | Para Michel sair do modo seguro |
| **GO follow-up produção** | Quando o cron genérico existir |
| **Classe C / método comercial** | Mudança de método de venda |

Executor **não** deve pedir GO para bug operacional ao vivo da Helena (já autorizado na Política de GO).

---

# 12. OPORTUNIDADES (podem começar agora, fora da fila quente)

1. **Follow-up-cron em homolog** — SPEC pronta; não depende de Bitrix write.
2. **Fix Relatório Recuperação** — valor imediato, read-only.
3. **Protótipo dos 3 e-mails do Auditor** (mesmo que v1 feia) — CEO pediu e ainda não tem.
4. **Dashboard único de switches** (CADENCIA/SECRETARIA/RETOMADA/FOLLOWUP) — reduz erro humano no Netlify.
5. **Telemetria de cadência em dry-run** (quantos elegíveis/dia por stage) — prepara GO com número.
6. **Copiloto: enriquecer “dado comercial” stub** mesmo sem Fase B completa (avisar “só Meta hoje”).
7. **Consolidar PWAs legados** → um placar só.
8. **Testes golden Secretária** em mais cards (confiança/zona) sem escrever Bitrix.
9. **Inventário de mídia local vs Drive** (lista do que falta ao Bruno — acelera P12–P17).
10. **Diretor 002 / régua Michel** em modo só leitura — sem cobrar ninguém ainda.

---

## Leitura final (sem perfume)

A Katzer **já tem sistema**. O que falta não é “inventar arquitetura”.

- **Helena conversa** (produção).
- **Tráfego recomenda** (produção Fase A).
- **Auditor mede** (produção parcial, com buracos).
- **Maestro / Secretária / Cadências / Follow-up** estão em **modo seguro**: código avançado, **autonomia desligada** de propósito.

O gargalo real da operação não é o último PR — é a trinca **validação WhatsApp + GO Bitrix + mídia/dados**. Até isso, o OS está **montado**, mas **ainda não governa o comercial sozinho**.
