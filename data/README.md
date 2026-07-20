# data/ — dados de entrada (versionados com cuidado)

## `vendas-katzer.csv`

Vendas atribuídas por campanha (metade "quem comprou" do custo/VENDA). Origem:
export do Michel (`VENDAS_KATZER.xlsx`, jul/2026).

**Privacidade — decisão registrada:** guardamos **sem nome e sem telefone** de
cliente, de propósito. O cálculo de custo/VENDA só precisa de **campanha, valor,
mês** e a contagem — nome de cliente é dado sensível e ficaria pra sempre no
histórico do Git sem ajudar em nada. A planilha crua com nomes **não entra no
repositório**.

> Regra pro futuro: **nunca commitar nome, telefone, CPF ou e-mail de cliente**
> neste repo. Se um export vier com isso, anonimizar antes (como foi feito aqui).

### Colunas
- `id_venda` — apelido anônimo (V1, V2…), só pra não contar em dobro.
- `campanha_original` — nome da campanha como veio do Michel. **Ainda precisa
  casar com o nome na Meta** (de-para pendente — ver `docs/CONTRATOS-DADOS.md`).
- `valor_venda` — R$ da venda.
- `mes_venda` — mês do fechamento (AAAA-MM).
- `obs` — pendências/flags a confirmar.

### Pendências a confirmar (não resolver por chute)
1. **V3** veio com data 30/12/2026 (futuro); a tag da campanha diz 30/11/25 →
   `mes_venda = A_CONFIRMAR` até o Michel confirmar.
2. **PUNTA CANA** apareceu em 3 formas (`PUNTA CANA VIDEO 01`, `PUNTA CANA`,
   `PUNTA CANA OESTE`). Confirmar com a Carol se, na Meta, são campanhas
   separadas ou a mesma.

### O que falta pra virar custo/VENDA
O **gasto + leads por campanha** (Meta / Carol), período **ago/2025 a abr/2026**.
Só então: `gasto ÷ vendas = custo/VENDA`.
