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

### Reconciliação com a Meta (prints do Gerenciador, 21/07) — CORRIGIDO
Conta `act_1150648749960943`: **219 campanhas**, **R$ 64.893,84** gastos no total
(12/07/2025–21/07/2026). Com o conjunto completo de prints, o gasto digitado pelo
Michel **RECONCILIOU** (retratação de nota anterior que o chamou de "não
confiável" — foi engano por prints parciais):
- **ALICERCE**: R$804,20 · 31 leads → campanha `[ALICERCE][AYA][VIDEO02][22/11/25]`
  (Michel rotulou VIDEO03; o gasto/leads são da VIDEO02, mesma data). ✓
- **BARRA VIEW**: R$446,28 · 28 leads → `[BARRA VIEW][SANDRA][VIDEO02][26/11/25]`. ✓
- **PERSONALITE**: R$480,26 · 18 leads → `[PERSONALITE][BRCON][VIDEO1][25/01/26]`. ✓
- **TORRESANI**: R$5.000,13 · 269 leads → `[TORRESANI]PUNTACANA][IMAGEM1][12/07/25]`. ✓
- **PUNTA CANA VIDEO 01** e **PUNTA CANA OESTE**: após varredura completa (12 telas
  distintas, topo→base da conta), **esses nomes NÃO existem literalmente** no
  Gerenciador. O que existe de "punta cana": `[alisson][punta cana][video][04/04/26]`
  e a família `[TORRESANI]PUNTACANA]`. Conclusão: é **de-para** (Michel rotulou com
  nome diferente do da Meta) — resolver casando por **id_campanha** (token), não por
  nome. Seguem NÃO SEI até então.
> Placar parcial montado em `placar-parcial.csv`. Fechar 100% (todas as 219 +
> os 2 PUNTA CANA que faltam) só via token/API, casando por id_campanha.
