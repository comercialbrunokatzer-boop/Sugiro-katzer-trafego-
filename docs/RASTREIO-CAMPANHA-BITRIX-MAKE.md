# Rastreio Campanha Bitrix ↔ Make — Registro oficial

| | |
|---|---|
| **Data** | 2026-07-26 |
| **CEO** | Bruno Katzer |
| **Painel** | App Decisão / Ranking inteligente (PR #43) |
| **Portal Bitrix** | `katzerassessoria.bitrix24.com.br` |

---

## Status

| Parte | Status | Quem |
|-------|--------|------|
| Campos no Bitrix (Lead) | **FEITO** | Bruno |
| Código do painel (filtro UF + ranking) | **FEITO** — PR #43 | Cursor |
| Mapear Make Facebook → Bitrix | **PENDENTE** | Michel (ou Carol — quem tem login Make) |
| Facebook / Instagram | **Não mexer** | Já conectado (Michel/Carol) |

---

## O que o Bruno já fez (100%)

No Bitrix Katzer → CRM → Campos personalizados → **Lead**:

1. **Campanha origem** (tipo Série/texto, não obrigatório, mostrar no filtro)  
2. **Adset origem** (tipo Série/texto, não obrigatório, mostrar no filtro)

IDs técnicos esperados pelo painel (no **negócio/deal** do Funil Novo Katzer):
- `UF_CRM_CAMPANHA_ORIGEM`
- `UF_CRM_ADSET_ORIGEM`

> O App Decisão lê **crm.deal** (CATEGORY_ID=1), não só Lead. Se o Make gravar só no Lead, o funil continua **SEM RASTREIO** e os botões Bitrix/WhatsApp ficam sem lead na etapa. Ideal: mesmos campos no Deal **ou** Make atualizar o negócio.
>
> Confirmar no Bitrix (editar campo → ver ID) se os códigos internos batem. Se o Bitrix gerou outro ID numérico, avisar o Cursor.

---

## O que depende do Michel (Make)

1. Entrar em https://www.make.com  
2. **Scenarios** → abrir o cenário **Facebook Lead Ads → Bitrix**  
3. No módulo **Bitrix** (criar/atualizar Lead), mapear:

| Campo Bitrix | Valor Make (Facebook) |
|--------------|------------------------|
| Campanha origem / Campanha Origem | `campaign_name` |
| Adset origem / Conjunto Origem | `adset_name` |

> No painel Katzer OS o ranking usa **custo por venda** (gasto ÷ Ganhou). Parecer por conjunto lê `UF_CRM_ADSET_ORIGEM` (alias `UF_CRM_CONJUNTO_ORIGEM`).

4. Salvar e deixar o cenário **ON**

**Não precisa** entrar de novo no Facebook/Instagram. A conexão Face ↔ Make já existe.

---

## Como validar (depois do Make)

1. Cai um lead **novo** do Facebook  
2. Abrir o lead no Bitrix Katzer  
3. Campo **Campanha origem** deve vir com o nome da campanha Meta  
4. No painel App Decisão → Ranking: funil **diferente por campanha** (não mais 8 iguais)  
5. Sem UF preenchido → badge **SEM RASTREIO — CORRIGIR MAKE**

---

## Código (já no GitHub)

- Branch: `cursor/ranking-inteligente-bitrix-f7d6`  
- PR: https://github.com/comercialbrunokatzer-boop/Sugiro-katzer-trafego-/pull/43  
- Funil só conta com `UF_CRM_CAMPANHA_ORIGEM`  
- Ranking: custo/avanço → CPL → taxa de perda  
- Badges Michel: CORTAR / AJUSTAR / ESCALAR / LIGAR  

Merge do PR pode ir mesmo antes do Make; até mapear, campanhas novas aparecem **SEM RASTREIO** (honesto) em vez do funil vazado.

---

## Mensagem pronta (WhatsApp → Michel)

```
Michel, Bitrix já tem 2 campos no Lead:
• Campanha origem
• Adset origem

No Make (cenário Facebook → Bitrix), no módulo Bitrix, mapeia:
• Campanha origem ← campaign_name
• Adset origem ← adset_name

Salva e deixa ON. Não precisa mexer no Face.
Doc: docs/RASTREIO-CAMPANHA-BITRIX-MAKE.md
```
