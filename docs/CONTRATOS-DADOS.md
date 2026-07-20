# Contratos de dado — o que entra e o que sai

> Define **o que o Executor precisa receber** pra trabalhar e **o que ele
> entrega**. É o "encaixe" entre as partes (Carol/Meta, atribuição da Katzer,
> Maestro). Enquanto um contrato não é cumprido, o número dele é
> **"NÃO SEI / insuficiente"** — sem fingir. Fonte de verdade do papel:
> [`../DOUTRINA.md`](../DOUTRINA.md).

---

## ENTRADA 1 — Meta Ads (quem entrega: Carol) — "ficha completa da campanha"

Por **campanha** e por **período**, o Executor precisa de:

| Campo | Pra quê | Obrigatório? |
|-------|---------|--------------|
| `id_campanha` | chave que casa com a atribuição | ✅ |
| `nome_campanha` | mostrar no placar | ✅ |
| `gasto_total` (R$) | numerador do custo | ✅ |
| `leads` | custo/lead + ver se é volume ou comprador | ✅ |
| `data_inicio` / `data_fim` | **quanto tempo rodou** (dias) | ✅ |
| `status_campanha` (ativa/pausada) | dá pra escalar? já parou? | ✅ |
| `gasto_por_dia` | tamanho da torneira (pra escalar/cortar) | ⬜ desejável |

> **Por que leads e "tempo que rodou" são obrigatórios:** sem leads, não dá pra
> saber se a campanha traz comprador ou só volume de curioso (duas campanhas com o
> mesmo custo/venda podem ser uma máquina e uma furada). Sem saber se ainda está
> ativa, não dá pra mandar "escalar" uma campanha que já parou.
>
> **Já temos, parcial (via Michel):** `gasto_total` de 4 das 6 campanhas
> (confirmado = gasto total). **Falta:** `leads`, `data_inicio/fim`, `status`, e o
> `gasto_total` das 2 campanhas PUNTA CANA (VIDEO 01 e OESTE).

**Via de acesso** (a Carol decide com o CEO):
- **Token da Meta (API)** — preferido: além do placar, permite o **"confere na
  Meta"** (checar se a mudança de verba entrou). Ver `SPEC` seção 5.
- **Export manual (CSV)** — funciona pro placar, mas **não** faz o "confere na
  Meta" sozinho.

> O Michel **não** entrega isso — a Meta é com a Carol (ver `FUNCAO-MICHEL-IA.md`).

## ENTRADA 2 — Atribuição de venda (quem entrega: Katzer / Bitrix) ⭐

**É o pulo do gato.** Sem isto, só existe custo/lead — nunca custo/VENDA. Por
**lead**:

| Campo | Pra quê | Obrigatório? |
|-------|---------|--------------|
| `id_lead` | identificar o lead | ✅ |
| `id_campanha` | **casar com a ENTRADA 1** (mesma chave) | ✅ |
| `qualidade` (curioso / número errado / comprador) | separar mídia × qualidade | ✅ |
| `virou_venda` (sim/não) | ligar anúncio → VENDA | ✅ |
| `valor_venda` (R$) | custo/venda e ROI real | ⬜ desejável |
| `data_venda` | janela de atribuição | ⬜ desejável |

**Formato:** CSV/export por arquivo (repos separados — nunca misturar). **A definir
com o Auditor:** nomes exatos das colunas e como sai do Bitrix.

> ⚠️ A chave `id_campanha` das duas entradas **tem que bater**. Se a Meta chama de
> "EUA_Americanos" e o Bitrix de outra coisa, precisamos de um "de-para". Sem chave
> comum, não dá pra ligar gasto → venda.

## SAÍDA — o que o Executor entrega (pro Maestro hospedar a página)

O Executor produz o **conteúdo**; o Maestro só hospeda/entrega (ver `SPEC` seção
2). O conteúdo é:

**a) Placar do dia** — uma linha por campanha:

```json
{
  "data": "AAAA-MM-DD",
  "campanhas": [
    {
      "id_campanha": "",
      "nome": "",
      "gasto": 0,
      "leads": 0,
      "custo_lead": 0,
      "vendas_atribuidas": 0,
      "custo_venda": null,
      "semaforo": "verde | atencao | vermelho"
    }
  ]
}
```

**b) Sugestão do dia** — ação + motivo, sempre citando o dado:

```json
{
  "acao": "mover_verba | manter | sem_base",
  "origem_campanha": "",
  "destino_campanha": "",
  "valor_dia_sugerido": 0,
  "motivo": "cita gasto, leads e custo/venda",
  "confianca": "ok | sem_base_confira"
}
```

> **Coleira:** se faltar atribuição de venda, `custo_venda` = `null`, `acao` =
> `"sem_base"` e `confianca` = `"sem_base_confira"`. Nunca inventar custo/venda.

**c) Registro da decisão** — o data model do toque do Michel (ver `SPEC` seção 4).

---

## Placar de bloqueios (o que falta pra funcionar)

| Peça | Dono | Status |
|------|------|--------|
| Acesso Meta Ads (token ou export) | Carol + CEO | 🟡 em andamento |
| Export de atribuição de venda (colunas + de-para de campanha) | Auditor / Katzer | 🟡 em andamento — passo a passo em [`PROMPT-ATRIBUICAO-AUDITOR.md`](./PROMPT-ATRIBUICAO-AUDITOR.md) |
| Google Ads (mesmo contrato da ENTRADA 1) | Carol + CEO | ✅ confirmado — entra; executar quando concluir |
| Stack do repo (linguagem/runtime pra produzir o conteúdo) | CEO + Executor | ⬜ decidir na 1ª PR de código |
| Contrato de entrega com o Maestro (formato acima serve?) | Maestro | ⬜ validar |
