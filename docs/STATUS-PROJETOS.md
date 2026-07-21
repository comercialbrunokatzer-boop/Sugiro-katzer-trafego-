# Status dos 2 projetos

Balanço rápido pra abrir e ver de relance onde cada ferramenta está.

---

## Projeto 1 — A MÉTRICA (placar de custo/VENDA)

**O que é:** a IA que pega gasto + venda de cada campanha e diz o que **escalar** e
o que **cortar**. É o motor de números.

**Estágio:** o mais avançado em dado. Já cruzei venda × gasto de 4 campanhas.

**O que falta (só isto):** o Michel trazer a **lista completa das campanhas** —
gasto das 2 que faltam (PUNTA CANA VIDEO 01 e OESTE), **leads**, **tempo que
rodou**, **status**, e as campanhas que **gastaram e não venderam** (pra achar o
desperdício). Pedido pronto em [`PEDIDO-MICHEL-CAMPANHAS.md`](./PEDIDO-MICHEL-CAMPANHAS.md).

> **Resumo:** essa está a **um passo** — a lista completa do Michel — de sair o
> primeiro placar de verdade. Roda **na mão** já; o token só automatiza.

## Projeto 2 — O QUADRADINHO DO MICHEL (o das fotos, 4 telas)

**O que é:** o widget onde o Michel **toca** (Aplicar / Ajustar / Agora não) e a
decisão cai sozinha no relatório. É a "cara" que o Michel usa.

**Estágio:** protótipo visual pronto (as 4 telas —
[`prototipos/quadradinho-decisao.html`](./prototipos/quadradinho-decisao.html)).
Falta ligar no mundo real.

**O que falta (são 3, não 1):**
1. **Token da Meta** — ✅ *você já tem* — pro "confere na Meta" (checar se a verba
   que o Michel aplicou realmente entrou).
2. **Entrega no WhatsApp** (Z-API) + **hospedar a página** — é do **Maestro**, não
   do Executor.
3. **Backend** que salva cada toque no relatório.

> **Resumo:** o token era a peça da Meta que faltava — mas **não** é a única. Sem a
> entrega (Maestro) e o backend, o toque do Michel ainda não vira link no WhatsApp.

---

## Passo a passo do TOKEN (você já tem — o que fazer agora)

1. **NÃO cola o token no chat nem no repositório.** É chave de acesso; no Git fica
   pra sempre no histórico. Guarda como **secret / variável de ambiente**
   (ex.: `META_ACCESS_TOKEN`), igual os secrets do Z-API no Maestro.
2. **Me confirma 3 coisas que NÃO são o token** (pode mandar):
   - **Qual conta de anúncios?** o ID (parece `act_1234567890`).
   - **Tipo do token:** "Usuário do Sistema" (permanente) ou temporário? — pra não
     expirar.
   - Tem permissão de **leitura de anúncios** (`ads_read`)?
3. **Aí eu construo a integração** (decidindo a stack/linguagem): um script que usa
   o token pra puxar da Meta gasto, leads, tempo e status de todas as campanhas —
   e o placar (Projeto 1) passa a se montar sozinho + liga o "confere na Meta"
   (Projeto 2).

> O token **destrava os dois**: automatiza o Projeto 1 e liga o "confere" do
> Projeto 2. Mas **nenhum dos dois depende só dele** — o Projeto 1 anda na mão com
> o Michel, e o Projeto 2 ainda precisa da entrega (Maestro).
