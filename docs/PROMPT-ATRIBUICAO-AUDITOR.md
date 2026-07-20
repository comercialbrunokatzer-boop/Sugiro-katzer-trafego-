# Atribuição de venda — passo a passo + prompt pro Auditor

O que falta pra fechar o ciclo **gasto → lead → VENDA**. O dado de venda mora no
**Bitrix**, que é do **Auditor** — repo separado, fora do escopo do Tráfego. Então
ele **entra por arquivo (CSV)**, não misturando repositórios.

## Quem faz cada passo

| # | Passo | Quem faz |
|---|-------|----------|
| 1 | Definir as colunas do CSV | ✅ **Executor** (já feito — ver abaixo) |
| 2 | Extrair do Bitrix o CSV com essas colunas | **Auditor** (tem o acesso; eu não) |
| 3 | Resolver o "de-para" da campanha (nome na Meta × origem no Bitrix) | **Auditor + Executor** |
| 4 | Me mandar o CSV (upload nesta conversa) | **Você (Bruno)** |
| 5 | Cruzar com o gasto da Meta → montar custo/VENDA e a sugestão | ✅ **Executor** |

> **"Você faz?"** — passos 1 e 5 são meus. O passo 2 **não é**: eu não tenho
> acesso ao Bitrix e a doutrina me proíbe de mexer nele. Por isso o passo 2 é do
> Auditor, e o resultado chega por arquivo.

## Colunas que o CSV precisa ter (passo 1 — feito)

Uma linha por **lead**:

| Coluna | Obrigatória? | Observação |
|--------|--------------|------------|
| `id_lead` | ✅ | identificador do lead |
| `id_campanha` | ✅ | **tem que casar com o nome/id da campanha na Meta** |
| `qualidade` | ✅ | `curioso` / `numero_errado` / `comprador` |
| `virou_venda` | ✅ | `sim` / `nao` |
| `valor_venda` | ⬜ | R$ — habilita ROI real |
| `data_venda` | ⬜ | janela de atribuição |

## Prompt pro Auditor (passo 2 e 3)

Cole na sessão do **Auditor**:

```
Você está no repo do AUDITOR (Katzer / Bitrix). Preciso de um EXPORT de ATRIBUIÇÃO
DE VENDA pra mandar ao repo separado de TRÁFEGO PAGO. Não altere nada — só me
entregue os dados.

1. Gere um CSV com UMA LINHA POR LEAD e exatamente estas colunas:
   id_lead, id_campanha, qualidade, virou_venda, valor_venda, data_venda
   - qualidade = curioso | numero_errado | comprador
   - virou_venda = sim | nao
   - valor_venda e data_venda podem ficar vazios se não houver, mas NÃO invente.

2. id_campanha é a peça crítica: preciso que ele CASE com o nome/id da campanha na
   Meta (ex.: "EUA_Americanos", "BR_SC", "ROGGA GRANT"). Me diga qual campo do
   Bitrix carrega essa origem de campanha. Se o nome no Bitrix for diferente do da
   Meta, me entregue também um DE-PARA (nome_bitrix -> nome_meta).

3. Se algum lead não tiver campanha de origem, marque id_campanha = "SEM_ORIGEM" —
   não chute. Se não existir o dado de venda, deixe vazio, não preencha por
   suposição.

4. Me devolva: (a) o CSV, (b) o de-para de campanha (se houver), (c) a lista de
   quantos leads ficaram "SEM_ORIGEM".
```

## Depois que o CSV chegar (passo 4 → 5)

Você me manda o arquivo aqui (upload, igual fez com o `.docx`). A partir daí é
comigo: cruzo `id_campanha` com o gasto da Meta e monto o placar com **custo/VENDA
por campanha** — o número que a doutrina persegue. Onde faltar dado, a saída marca
`custo_venda = null` e a sugestão vira `"sem base — confira"` (coleira anti-invenção).
