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

## Secrets já no repo (prontos)
`META_SYSTEM_TOKEN` · `ZAPI_INSTANCE` · `ZAPI_TOKEN` · `ZAPI_CLIENT_TOKEN` ·
`WHATSAPP_MICHEL` · `WHATSAPP_CEO` · `WHATSAPP_CAROL` · `EMAIL_CEO`
