# O que o Michel precisa me passar (lista de vendas)

Atalho pra montar o primeiro **custo/VENDA** sem esperar o export do Bitrix. O
Michel já sabe quem comprou — é só listar. **Simples, sem planilha bonita.**

## O que preciso: só as VENDAS (quem comprou)

Pra **cada cliente que FECHOU** (comprou de verdade), uma linha:

| Cliente (nome ou telefone) | Veio de qual campanha | Quando fechou (mês) | Valor da venda (se souber) |
|----------------------------|-----------------------|---------------------|----------------------------|
| ex: João Silva / (48) 9... | BR_SC | jul/2026 | R$ ... |
| | | | |

**Regras (pra não sujar o dado):**

1. **Nome da campanha** = o mesmo que aparece no placar: `EUA_Americanos`,
   `BR_SC`, `ROGGA GRANT`... Se o Michel não lembrar de qual campanha veio,
   escreve **"não sei"** — não chuta. "Não sei" é resposta válida.
2. Só entra quem **comprou** (fechou venda). Curioso e número errado **não** entram
   nesta lista.
3. Valor e mês são bônus — se não tiver, deixa vazio. **Não inventar.**

## O que eu NÃO preciso (pra não virar bagunça)

- **O vídeo / criativo da campanha:** não preciso. Meu trabalho é ligar
  **gasto → venda** (qual campanha traz comprador). O vídeo é a peça criativa; ele
  não muda a conta de custo/VENDA. Se um dia a gente for analisar *por que* um
  criativo vendeu mais, aí sim — mas não agora.
- **A contagem de leads e o gasto:** isso vem da **Meta** (Carol), não do Michel.
  O Michel só me dá a metade que só ele sabe: **quem virou venda**.

## Por que só isso basta

Eu junto três coisas:

```
GASTO por campanha (Meta/Carol)  +  Nº de leads (Meta/Carol)  +  VENDAS por campanha (Michel)
        →  CUSTO POR VENDA de cada campanha  →  o que cortar e o que escalar
```

O Michel me dá o pedaço final — o que fecha o ciclo. Sem ele, eu só teria
custo/lead (que não é o alvo).
