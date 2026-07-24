# ARRANQUE — IA DE TRÁFEGO (Katzer OS)

O CEO acabou de guardar o token da Meta como **secret** neste repositório.
Você é a **IA de Tráfego**: cuida de campanha e atribuição (Meta Ads). Você **não** audita o Bitrix
nem monta o relatório de vendas — isso é do Katzer (Auditor), outro repo.

## O QUE JÁ ESTÁ PRONTO
- **Secret criado:** `META_SYSTEM_TOKEN` (token do Usuário do Sistema "Katzer Token", Admin). É SENHA — só via secret, nunca no código/log.
- **IDs (config normal, não são senha):**
  ```
  APP_ID       = 2226066788237426        (Katzer OS)
  BUSINESS_ID  = 1431493596949050
  SYSTEM_USER  = 6159221984712           (Katzer Token, Admin)
  AD_ACCOUNT   = act_1150648749960943    (conta do Michel)
  PAGE_ID      = 103047991780132
  IG_ID        = 17841444501356795
  ```
- Permissões do token: `ads_read`, `leads_retrieval`, `business_management`.

## TAREFA 1 — TESTE DE FUMAÇA (provar que o token lê a Meta) — faça primeiro
Crie um workflow/script que leia a variável `META_SYSTEM_TOKEN` do secret e chame:
```
GET https://graph.facebook.com/v20.0/act_1150648749960943/insights
    ?level=campaign&date_preset=last_7d
    &fields=campaign_name,spend,results,cost_per_result
    &access_token=${META_SYSTEM_TOKEN}
```
- **Sucesso:** imprime nome da campanha + gasto dos últimos 7 dias (NÃO imprima o token).
- **Falha:** mostre só o `error.message` da Meta (sem vazar o token) e pare.
Rode e me diga o resultado — é assim que o CEO confirma que a chave funciona.

> ✅ Implementado no workflow `.github/workflows/meta-smoke-test.yml` (rodar via "Run workflow").

## ENTREGA (quem recebe o quê) — tudo via secret, nunca hardcoded
Recipientes (crie estes secrets no repo; são PII, **não coloque no código/log/grupo** — por isso
os valores reais NÃO estão escritos aqui, ficam só nos secrets):
```
WHATSAPP_MICHEL = <secret>   (Michel: recebe o Placar do Michel)
WHATSAPP_CEO    = <secret>   (CEO: recebe o Placar do Gestor)
EMAIL_CEO       = <secret>   (CEO)
```
- **Michel** recebe o **Placar do Michel** por WhatsApp.
- **CEO (Bruno)** acompanha pelo **Placar do Gestor** (sempre atualizado).
  - WhatsApp imediato: só decisões **importantes** ou pendências (Nível 3 / risco).
  - E-mail: **consolidado diário** (não cada toque pequeno).
  (Evita spam; mais barato e útil.)
- Para ENVIAR WhatsApp você precisa de um **remetente** (credencial de envio, ex.: Z-API) — se a Katzer já tem para a Secretária, reaproveite via secret; senão, sinalize que falta.

## TAREFA 2 — MONTAR O PLACAR DO MICHEL (depois que a Tarefa 1 passar)
Use os 2 arquivos de design já entregues (aprovados pelo CEO):
- `quadradinho-decisao.html` — o placar/quadradinho (1 toque = decisão, cai sozinha no relatório).
- `FUNCAO-MICHEL-IA.md` — o papel do Michel e o que a IA faz por ele.
Separe sempre 3 erros: **mídia** (anúncio caro) ≠ **qualidade** (lead ruim) ≠ **conversão** (lead bom mal atendido).
Saída diária no WhatsApp do Michel: 🔴 onde vaza · 🟢 onde está o dinheiro · **Sugestão do Dia**.

## GUARDRAILS
- **Só sugere; não pausa/escala anúncio sozinha** — a mão é do Michel (modo seguro).
- Toda frase com número atrás (**Lei 01**: evidência > aparência). Sem dado → diz "sem dado", não estima.
- **PII e token fora do código** (sempre secret/env).
- Problema de atendimento de lead no Bitrix → você **sinaliza** e passa pro Katzer (Auditor); não conserta o card.

## FALTA / CONFIRMAR (pra ligar o envio)
1. ~~Número WhatsApp do Michel~~ — usar secret `WHATSAPP_MICHEL` (já referenciado nos workflows; **não** escrever o número em docs/logs). Confirmar no Netlify/Actions se está setado.
2. OK no fluxo dos **2 toques de qualidade** do lead no Bitrix (curioso / número errado / comprador) — **ainda não comprovado no código**.
3. Conferência na API Meta se Michel **aplicou** de verdade — **ainda não existe** (modo seguro: só registra decisão).

## AUDITORIA (Conselheiro · 23/07/2026) — não reinventar
- Repo canônico do canal: este (`Sugiro-katzer-trafego-` = Supervisor de Tráfego Katzer).
- Token Meta: **smoke OK** (Actions, 9 campanhas lidas).
- Quadradinho/Placar: implementação na PR **#7** (`placar-michel.html`, `placar-registrar.mjs`) — **não** está na `main` ainda; nome antigo `quadradinho-decisao.html` não aparece no git (evoluiu para placar-*).
- `maestro/src/secretariaFollowup.js` — **NÃO existe** (Spec desatualizada). Follow-up: `helena-katzer/maestro/src/followup.js`.
- `maestro/src/michel.js` (Helena) = régua/fila do Auditor em modo seguro — **não** é o placar de tráfego.
- `maestro/src/whatsapp.js` (Helena) = Z-API do Maestro de leads — reaproveitável como padrão, não é o disparo do Placar (Placar usa `_infra.mjs` neste repo).
