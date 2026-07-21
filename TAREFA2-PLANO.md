# TAREFA 2 — Placar do Michel (plano)

> Estado: **Tarefa 1 concluída** (token da Meta lê a conta — teste de fumaça OK).
> Placar de teste **enviado ao vivo** no WhatsApp (CEO + Carol) com dados reais da Meta.
> Este arquivo guarda o escopo da Tarefa 2 pra não perder nada.

## O que a Tarefa 2 entrega
1. **Quadradinho hospedado** (página web) — a partir do design `quadradinho-decisao.html`:
   - **Tela do Michel:** a decisão do dia + botões **Aplicar / Ajustar / Pausar**.
   - **Tela do CEO (Placar do Gestor):** mostra o que o Michel decidiu, em tempo real.
   - O **CEO pode abrir a MESMA tela do Michel** (modo ver) — vê tudo, só não precisa clicar.
2. **Mensagem no WhatsApp** = curta + **link "▸ Abrir decisão do dia"** (abre o quadradinho).
   - Formato a decidir: **(A) texto + link** ou **(B) imagem + link** (placar renderizado como figura).
3. **Botões ligados de verdade:** ao tocar, registra a decisão E **avisa o CEO na hora** (WhatsApp + e-mail).
4. **Disparo diário automático** no horário escolhido (ex.: 08h).

## Ajustes pegos no teste (IMPORTANTE)
- **Nº de lead certo por campanha:** trocar o campo genérico `results` da Meta pelo **action de lead
  (`leadgen` / `actions`)** — hoje veio "s/ dado" em várias campanhas por causa do campo genérico.
- **Ligar anúncio → VENDA (não ao clique):** cruzar o lead da Meta com o **Bitrix** pra saber qual
  campanha vira dinheiro. É o que dá a inteligência real ("onde está o dinheiro").
- **3 erros separados:** mídia (anúncio caro) ≠ qualidade (lead ruim) ≠ conversão (lead bom mal atendido).

## Botão "Pausar" — decisão de modo
- **Reversível → pode ser 1 toque real, COM confirmação** ("tem certeza?").
- **Cancelar/excluir → fica só registrando** (na mão, sem 1-toque) — mais seguro.
- Pra pausar de verdade pela Meta, o token precisa de permissão de **escrita (`ads_management`)** —
  hoje é só leitura (`ads_read`). O CEO libera isso nas configs da Meta.

## O que o Executor faz (eu)
- Hospeda o quadradinho (site Netlify do Tráfego) + o backend dos botões.
- Corrige a leitura de leads (leadgen) e monta a inteligência da sugestão.
- Liga o aviso em tempo real pro CEO (WhatsApp + e-mail).
- Agenda o disparo diário.
- Reaproveita a Z-API (envio de WhatsApp) já configurada.

## O que preciso do CEO (decisões + 1-2 setups)
1. **Formato no WhatsApp:** (A) texto+link ou (B) imagem+link?
2. **Horário do disparo diário** (ex.: 08h).
3. **Botão Pausar:** real (com confirmação) ou só registra? Se real → liberar `ads_management` no token da Meta.
4. **Arquivo `FUNCAO-MICHEL-IA.md`** (o papel do Michel / regras) — mandar, ou eu deduzo do protótipo.
5. **E-mail do Placar do Gestor:** definir como enviar e-mail (um serviço de e-mail / credencial) — o
   WhatsApp já temos; o e-mail precisa de um remetente.

## Aplicação 2 do MESMO motor — Rotina do Michel (checklist)
O quadradinho é um **padrão reaproveitável**, não só de campanha. 2ª aplicação: a **Rotina da
Manhã do Michel** (`MICHEL_ROTINA_v7`).
- 8 tarefas viram itens **com horário**: 08:00 Reuniões · 08:10 Agend/Atend · 08:20 Pendências ·
  08:35 Instagram · 08:55 Campanhas · 09:15 Discadora · 09:35 Garimpo · 12:00 Lista do Auditor.
- Michel toca **"Feito"** + miniresumo (o "MANDA NO GRUPO — ASSIM" vira campo).
- Cada toque cai no **painel do CEO ao vivo**, com **horário por tarefa** (timestamp individual).
- Tarefa passou da hora e não veio → **sinaliza atraso** (vermelho) no painel.
- **Respeita a rotina:** toque = *avisar o feito*; dúvida/decisão/oportunidade = **LIGAR** (botão
  chama pra ligar, NÃO gera mensagem).
- **Entrega pro CEO:** painel ao vivo (link) sempre atualizado; WhatsApp em marcos/atrasos; e-mail =
  **1 resumo consolidado no fim da manhã** (evita 8 e-mails). *E-mail não se atualiza sozinho — é foto do momento.*
- **Janela:** lista é **por dia**; reseta a cada manhã. Tarefa pode ser marcada depois (fica "atrasada"
  mas registra). Regra de fechamento (ex.: trava à meia-noite) é opcional — a definir.

## Modo Casa / Katzer (a rotina tem 2 inícios)
Michel trabalha 3x/sem em **Piçarras (sede)** e 3x/sem em **Joinville (casa)**. Quebra de horário:
- **🏠 Casa:** começa **08:00** (a agenda que ele já mandou).
- **🏢 Katzer:** chega 08:30–09:00 → começa **08:45** (tudo **+45 min**; fecha 12:45 em vez de 12:00).
- **Como funciona:** no topo do card, 1 toque escolhe **Casa** ou **Katzer** → toda a agenda se desloca sozinha.
- **Pontualidade justa:** o previsto do dia é o do modo escolhido (não marca atraso por ter começado 08:45).
- **E-mail 13:30** cobre os dois (Katzer fecha 12:45) e anota se o dia foi 🏠 ou 🏢.
- (Simples: é offset de +45 min, não é rotina nova.)

## Horários (definidos pelo CEO)
- **07:55** — card da Rotina chega no **WhatsApp do Michel** (abre o dia; 1ª tarefa é 08:00).
- **Ao vivo (event-driven)** — cada "Feito" pinga o CEO no **WhatsApp na hora**, com o horário da tarefa.
- **E-mail consolidado** pro CEO (linha do tempo + ritmo/pontualidade): **13:30 nos dias Casa** · **14:30 nos dias Katzer** (Katzer fecha 12:45).
- **Painel (link):** sempre atualizado, abre a qualquer momento.
- Placar de **campanhas** (mídia): disparo **08:00** (ajustável).
- Ritmo/pontualidade do Michel (previsto × feito, e padrão semanal de atraso/adianto) entra no e-mail das 13:30.

## Obs — Interrupções (a ÚNICA exceção pra rotina atrasar)
Quando o **Bruno ou a Carol** pedem uma demanda em cima da hora, ela come o tempo do Michel. Essa é
a única exceção legítima pra uma tarefa da rotina atrasar. Michel registra numa **Obs** no fim do card:
- **Quem pediu** (Bruno / Carol) — campo obrigatório, com atribuição.
- **Nome da demanda** (ex.: "ligar cliente X", "puxar dado Y").
- **Início** e **duração** (quanto tempo consumiu).
- No relatório, esse tempo é **descontado / mostrado ao lado** do atraso das tarefas afetadas (pontualidade justa).

**Trava anti-brecha:** a Obs **exige dizer QUEM pediu** (Bruno ou Carol). Como aponta pro próprio CEO/
Carol, uma entrada falsa se expõe sozinha (você sabe na hora se pediu ou não). **Regra de cultura:** se
o Bruno/Carol NÃO pediram, Michel **não pode** abrir Obs nem gastar tempo — a rotina vem primeiro.
Benefício duplo: protege o Michel (interrupção real não conta contra ele) e mostra ao CEO **quanto
as próprias demandas dele/da Carol consomem** da manhã.

## Secrets já no repo (prontos)
`META_SYSTEM_TOKEN` · `ZAPI_INSTANCE` · `ZAPI_TOKEN` · `ZAPI_CLIENT_TOKEN` ·
`WHATSAPP_MICHEL` · `WHATSAPP_CEO` · `WHATSAPP_CAROL` · `EMAIL_CEO`
