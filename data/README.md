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
1. ✅ **V3** — resolvido: era **30/11/2025** (Michel confirmou; erro de digitação
   no export, tinha ido pra 30/12/2026).
2. **PUNTA CANA** apareceu em 3 formas (`PUNTA CANA VIDEO 01`, `PUNTA CANA`,
   `PUNTA CANA OESTE`). Confirmar com a Carol se, na Meta, são campanhas
   separadas ou a mesma. **← ainda aberto**

### O que falta pra virar custo/VENDA
O **gasto + leads por campanha** (Meta / Carol), período **ago/2025 a abr/2026**.
Só então: `gasto ÷ vendas = custo/VENDA`.

### Reconciliação com a Meta (prints do Gerenciador, 21/07) — findings
Conta `act_1150648749960943`: **219 campanhas**, **R$ 64.893,84** gastos no total
(12/07/2025–21/07/2026). Ao conferir os nomes das vendas contra o Gerenciador:
- **ALICERCE**: gasto R$804,20 confere, mas a campanha é **VIDEO02** (não VIDEO03);
  31 leads → 2 vendas.
- **TORRESANI**: o gasto R$5.000,13 da planilha **NÃO reconcilia** — no Gerenciador
  as campanhas TORRESANI mostram ~R$109 / R$340 / R$230. **Conferir na API.**
- **PERSONALITE**: planilha R$480,26 vs Gerenciador R$291,71 + R$301,36. Não fecha.
- **BARRA VIEW**: não localizada nos prints (parciais: ~75 de 219 campanhas).
> Conclusão: o gasto digitado à mão é **não confiável**. Fechar só com o token/API
> (casar por **id_campanha**, não por nome). Não montar placar final pelos prints.
