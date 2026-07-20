# SPEC — Quadradinho de Decisão do Michel

> Especificação do **widget de decisão de campanha** (protótipo já montado).
> Origem: `SpecQuadradinhoMichel.docx`. Copiada para o repo do Tráfego conforme a
> própria spec manda (seção 7). Em caso de conflito com a doutrina,
> [`../DOUTRINA.md`](../DOUTRINA.md) vence.

**Princípio:** o Michel **TOCA, não escreve**. Cada toque registra sozinho no
relatório do gestor (Bruno). **Modo seguro: a IA sugere e registra — NÃO executa
na Meta.** Quem pausa / escala o anúncio é o Michel, na mão.

---

## 1. O fluxo — 4 estados (as 4 telas do protótipo)

Referência visual em [`prototipos/`](./prototipos/):

| Estado | Tela | Arquivo |
|--------|------|---------|
| 0 | Placar de campanhas | `prototipos/tela-0-placar-campanhas.jpeg` |
| 1 | Decisão do dia | `prototipos/tela-1-decisao-do-dia.jpeg` |
| 2 | Registrado | `prototipos/tela-2-registrado.jpeg` |
| 1b | Ajustar (campo livre) | `prototipos/tela-3-ajustar.jpeg` |

### Estado 0 — Placar de campanhas (chega por link no WhatsApp)

Cartão "Campanhas — hoje": uma linha por campanha com custo/lead, número de leads
e semáforo. Botão "Abrir decisão do dia". Exemplo real do protótipo:

| Campanha | Custo / leads | Status |
|----------|---------------|--------|
| EUA_Americanos | R$257 · 0 lead | 🔴 vermelho |
| BR_SC | R$66/lead · 11 | 🟢 verde |
| ROGGA GRANT | R$49/lead · 0 fechou | 🟡 atenção |

### Estado 1 — Decisão do dia (1 toque)

Bloco "SUGESTÃO DA IA" com a ação recomendada + o motivo, baseado em **custo por
VENDA**. Ex.: "Mover R$50/dia do EUA_Americanos → BR_SC. Motivo: R$257 gastos, 0
lead. BR_SC tem o melhor custo por venda."

Três botões (Michel só toca):

- **Aplicar** — registra a decisão (ele aplica na Meta depois).
- **Ajustar** — abre o campo livre "Valor por dia — você decide" (ex.: R$80) e
  escolher origem / destino.
- **Agora não** — registra que decidiu esperar (não some, fica anotado).

### Estado 2 — Registrado

Confirmação "Registrado". Texto: "Sua decisão ficou anotada. Agora é só aplicar na
Meta." E aparece no relatório do gestor: "Michel aplicou — mover R$50 Americanos →
BR_SC — 09:04 — confere na Meta".

## 2. O relatório do gestor (lado direito) — "Placar do Gestor"

Toda decisão do Michel entra aqui sozinha, em tempo real. Cada linha:
**quem — o que — hora — "confere na Meta"**. Rodapé fixo:

> "Modo seguro: a IA registra o fato, não julga. Quem lê e conclui é você."

## 3. Como a IA monta a SUGESTÃO

Cruza as 3 camadas (**Mídia × Qualidade × Conversão**) e prioriza **custo por
VENDA**, não custo por lead. Regra: tirar verba de quem gasta e não traz venda;
pôr em quem tem o melhor custo por venda. É **SUGESTÃO** (modo seguro), nunca
ordem.

**Coleira anti-invenção:** a sugestão sempre cita o dado (R$ gastos, número de
leads, custo/venda). Sem dado suficiente: **"sem base pra sugerir, confira"**.

## 4. O que cada decisão registra (data model)

Cada toque grava um registro (pro relatório e pra medir o Michel):

```json
{
  "timestamp": "",
  "quem": "Michel",
  "acao": "aplicar | ajustar | adiar",
  "origem_campanha": "",
  "destino_campanha": "",
  "valor_dia": 0,
  "motivo_sugestao": "",
  "status": "registrado"
}
```

## 5. "Confere na Meta" — fecha o ciclo

Depois de "Aplicar", o sistema checa na Meta (API) se a mudança de verba
**REALMENTE** entrou — liga o "decidiu" ao "fez". Se o Michel registrou mas não
aplicou, o placar mostra a pendência. É aqui que entra o **token da Meta** (ver o
doc de Entrega da IA de Tráfego).

## 6. Fronteira / modo seguro (inegociável)

| Regra | O que significa |
|-------|-----------------|
| **A IA NÃO mexe na Meta** | o widget só sugere e registra. Pausar/escalar é o Michel, na mão. |
| **A IA nunca acusa** | entrega fato + sugestão; o julgamento é do humano. |
| **Toca, não escreve** | o padrão é botão; texto livre só no "Ajustar" (valor/origem/destino). |
| **Tudo registra** | aplicar, ajustar ou adiar — todos viram linha no relatório. Nada se perde no silêncio. |

## 7. Onde já existe (ponto de partida pro dev)

- Protótipo interativo já montado:
  [`prototipos/quadradinho-decisao.html`](./prototipos/quadradinho-decisao.html)
  (as 4 telas deste spec saíram dele). **✅ Copiado** do Auditor.
- Papel do Michel: [`FUNCAO-MICHEL-IA.md`](./FUNCAO-MICHEL-IA.md). **✅ Copiado** do
  Auditor.
- Régua que mede o próprio Michel (cobrou? em quanto tempo?):
  `maestro/src/michel.js → reguaDoMichel()`. Vive no repo do Auditor; **não** é
  copiado pra cá (fora do escopo Tráfego).

> **Resumo:** placar → sugestão da IA (custo por venda) → Michel toca
> (Aplicar / Ajustar / Agora não) → registra no relatório do gestor → sistema
> confere na Meta. **A IA sugere e anota; o humano decide e executa.**

---

## Nota do Executor (honestidade / Olheiro)

O exemplo da seção 1 diz *"BR_SC tem o melhor custo por venda"*, mas os dados das
telas mostram só **leads**, não **vendas** (BR_SC: 11 leads; ROGGA GRANT: "0
fechou"). Afirmar "melhor custo por venda" sem venda atribuída é exatamente o que
a **coleira anti-invenção** (seção 3) proíbe e o que o Olheiro marca como
🔴 BLOQUEIO ([`../OLHEIRO.md`](../OLHEIRO.md), item 2).

**Enquanto não houver atribuição de venda ligada à campanha**, a sugestão real
deve cair no fallback da coleira: **"sem base pra sugerir por venda — decisão por
custo/lead, confira"** — nunca fabricar "custo por venda". O exemplo do protótipo
é ilustrativo; a regra da coleira vence.
