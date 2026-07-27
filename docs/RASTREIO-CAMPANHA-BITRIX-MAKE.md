# Rastreio Campanha Bitrix ↔ Make — Registro oficial

| | |
|---|---|
| **Atualizado** | 2026-07-27 |
| **CEO** | Bruno Katzer |
| **Painel** | App Decisão (custo/venda · funil · parecer) |
| **Portal Bitrix** | `katzerassessoria.bitrix24.com.br` |
| **App** | https://rotina-produtiva-michel.netlify.app/app.html |

---

## Status (validação live 27/07)

| Parte | Status | Quem |
|-------|--------|------|
| Campos no Bitrix | **FEITO** | Bruno |
| Código painel (UF + custo/venda + botões) | **FEITO** — PRs #43–#47 | Cursor |
| Make: parar `teste-integracao` | **FEITO** (ontem) | Bruno / Michel |
| Make: gravar no **Deal** `campaign_name` + `adset_name` | **CHECAR AGORA** | Make (módulo criar/atualizar **Deal**) |
| API live `bitrixUfPreenchidos` | **ainda 0** | Aguardando lead **novo** com UF no Deal |
| Badge SEM RASTREIO nas ACTIVE | **ainda ON** (FortMyers SC / Brasileiros) | Some quando UF casar |

> **Importante:** o painel lê `crm.deal` (Funil Novo · CATEGORY_ID=1), **não** só Lead.  
> Se o Make mapear só no Lead, a API continua `UF=0` e o funil fica zerado.

---

## Mapeamento obrigatório no Make (Deal)

1. https://www.make.com → **Scenarios** → cenário **Facebook Lead Ads → Bitrix**
2. Módulo Bitrix = **criar/atualizar Deal** (negócio do Funil Novo Katzer), **não** só Lead
3. Mapear:

| Campo Bitrix (Deal) | Valor Make (Meta) | ID técnico esperado |
|---------------------|-------------------|---------------------|
| Campanha Origem | `{{campaign_name}}` | `UF_CRM_CAMPANHA_ORIGEM` |
| Conjunto Origem | `{{adset_name}}` | `UF_CRM_ADSET_ORIGEM` |

4. Remover / não gravar mais `teste-integracao` nesses campos  
5. Salvar cenário **ON**

**Não mexer** Facebook/Instagram — conexão Face ↔ Make já existe.

---

## Como validar (ordem)

1. Cair **1 lead novo** do Facebook (lead antigo sem UF não “cura” sozinho)
2. Abrir o **negócio** no Bitrix → Campanha Origem = nome real da campanha Meta (ex.: `FortMyers_SANTACATARINA_…`)
3. Hard refresh no app: https://rotina-produtiva-michel.netlify.app/app.html  
4. Esperado:
   - badge **SEM RASTREIO** some na campanha casada
   - funil sai de `0 / Nenhum lead nesta etapa`
   - Bitrix / WhatsApp ligam (1 lead = direto; vários = lista)
   - **Custo por venda** e TOP 10 passam a ter base de Ganhou

### API (smoke)

```
GET /api/decisao-app
→ bitrixUfPreenchidos > 0
→ ativas[].semRastreio = false (nas que tiverem UF)
→ ativas[].leadsTotal > 0
→ ativas[].funilPainel.etapas[].leads[].bitrixUrl
```

---

## O que o painel já faz sozinho (depois do UF)

- Card: Investido · Leads/CPL · **Custo por venda** (verde)
- Funil por etapa atual + R$/etapa + Bitrix + WhatsApp
- TOP 10 melhores (menor custo/venda) · TOP 10 piores (gasto sem venda)
- Parecer: PARAR / MANTER+ADICIONAR · botões MANTER = · ADICIONAR + · DIMINUIR − · PARAR
- Gestor 🔒 com senha

---

## Não confundir com Operação 79

| Sistema | O que é | Estabilidade / pendentes |
|---------|---------|---------------------------|
| **App Decisão** (tráfego) | Meta + Bitrix UF · funil custo/venda | SEM RASTREIO some com UF no **Deal** |
| **Op.79** (Helena) | Fila oficial 79 WhatsApp | `cadencia-monitor` · ESTAVEL após **20 ticks** 5–6 min |

Os **~61–62 pendentes** da Op.79 **não** são forms Meta sem UF. São contatos da fila Helena.  
Make/UF destrava o **App Decisão**; o monitor de estabilidade da Op.79 é outro endpoint.

---

## Mensagem pronta (WhatsApp)

```
Make → Bitrix DEAL (não só Lead):
• Campanha Origem ← {{campaign_name}}
• Conjunto Origem ← {{adset_name}}
Sem teste-integracao.

Depois do 1º lead novo:
hard refresh no app → SEM RASTREIO some → Bitrix/WhatsApp ligam.
```
