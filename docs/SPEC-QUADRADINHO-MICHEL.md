# SPEC — Quadradinho de Decisão do Michel

> Especificação do **widget de decisão de campanha + entrega no WhatsApp**
> (protótipo já montado). Origem: `SpecQuadradinhoMichel.docx` (v2). Copiada para
> o repo do Tráfego conforme a seção 7. Em conflito com a doutrina,
> [`../DOUTRINA.md`](../DOUTRINA.md) vence.

**Princípio:** o Michel **TOCA, não escreve**. Cada toque registra sozinho no
relatório do gestor (Bruno). **Modo seguro: a IA sugere e registra — NÃO executa
na Meta.**

---

## 1. O fluxo — 4 estados (as 4 telas do protótipo)

Referência visual em [`prototipos/`](./prototipos/) e protótipo clicável em
[`prototipos/quadradinho-decisao.html`](./prototipos/quadradinho-decisao.html).

### Estado 0 — Placar de campanhas

Cartão "Campanhas — hoje": uma linha por campanha com custo/lead, número de leads
e semáforo. Botão "Abrir decisão do dia".

| Campanha | Custo / leads | Status |
|----------|---------------|--------|
| EUA_Americanos | R$257 · 0 lead | 🔴 vermelho |
| BR_SC | R$66/lead · 11 | 🟢 verde |
| ROGGA GRANT | R$49/lead · 0 fechou | 🟡 atenção |

### Estado 1 — Decisão do dia (1 toque)

Bloco "SUGESTÃO DA IA" + motivo (**custo por VENDA**). Ex.: "Mover R$50/dia do
EUA_Americanos → BR_SC. Motivo: R$257 gastos, 0 lead. BR_SC tem o melhor custo por
venda."

Três botões: **Aplicar** (registra; ele aplica na Meta), **Ajustar** (campo livre
"valor por dia" + origem/destino), **Agora não** (registra que decidiu esperar).

### Estado 2 — Registrado

"Registrado". Aparece no relatório do gestor: "Michel aplicou — mover R$50
Americanos → BR_SC — 09:04 — confere na Meta".

## 2. Como chega no WhatsApp (entrega via Z-API)

**Ponto-chave:** o quadradinho é uma **PÁGINA WEB**. O WhatsApp não mostra
formulário interativo dentro do chat — então o sistema manda um **LINK**, e o
Michel toca no link pra abrir a página no navegador do celular.

**Fluxo de entrega:**

1. De manhã (ex.: 09:00) o sistema envia, pelo Z-API, no WhatsApp do **Michel**:
   "Bom dia! Placar de campanhas de hoje: [link]".
2. Michel toca no link → abre o quadradinho no navegador → decide
   (Aplicar / Ajustar / Agora não).
3. O backend salva a decisão e registra no relatório do gestor.
4. O **Bruno** recebe, pelo mesmo Z-API, um ping no seu WhatsApp: "Michel aplicou
   — mover R$50 Americanos → BR_SC — 09:04". E aparece no Placar do Gestor.

Cada um recebe o que é dele: o **LINK** do quadradinho vai pro Michel (quem
decide); o **RESUMO/atualização** vai pro Bruno (quem acompanha).

**Por que compartilhar o número é seguro:** sai tudo pelo **mesmo Z-API da Helena**
(número compartilhado), via `send-text`. A segurança vem da **WHITELIST/porteiro**:
como Michel, Bruno e Carol estão na lista da equipe, a Secretaria **não** trata as
respostas deles como cliente (senão uma resposta do Michel viraria um "lead").

Secrets do Z-API (no ambiente do **Maestro**): `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`,
`ZAPI_CLIENT_TOKEN`, e `WHITELIST_EQUIPE` (números da equipe).

**Link com token:** cada link carrega um token do dia/do Michel, pra só a decisão
dele contar e não dar pra forjar.

### Quem faz o quê (arquitetura da entrega)

| Camada | Papel na entrega |
|--------|------------------|
| **IA de Tráfego** (este escopo) | produz o placar + a sugestão + registra a decisão (**o conteúdo**). |
| **Maestro** | faz o **ENVIO** no WhatsApp (já tem Z-API/`send-text` em `maestro/src/whatsapp.js` + o porteiro `deveIgnorarMensagem`). **Hospeda** a página do quadradinho. |
| **Helena** | divide o mesmo número; a whitelist garante que os toques/respostas da equipe não viram atendimento. |

## 3. Como a IA monta a SUGESTÃO

Cruza as 3 camadas (**Mídia × Qualidade × Conversão**) e prioriza **CUSTO POR
VENDA**, não custo por lead. Tira verba de quem gasta e não traz venda; põe em quem
tem o melhor custo por venda. **Coleira:** sempre cita o dado; sem dado, **"sem
base pra sugerir, confira"**. É sugestão (modo seguro), nunca ordem.

## 4. O que cada decisão registra (data model)

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

Depois de "Aplicar", o sistema checa na Meta (API, com o token) se a mudança de
verba **REALMENTE** entrou — liga o "decidiu" ao "fez". Se registrou mas não
aplicou, o placar mostra a pendência.

## 6. Fronteira / modo seguro (inegociável)

| Regra | O que significa |
|-------|-----------------|
| **A IA NÃO mexe na Meta** | o widget só sugere e registra. Pausar/escalar é o Michel, na mão. |
| **A IA nunca acusa** | entrega fato + sugestão; o julgamento é do humano. |
| **Toca, não escreve** | padrão é botão; texto livre só no "Ajustar". |
| **Tudo registra** | aplicar, ajustar ou adiar — todos viram linha no relatório. |

## 7. Onde já existe (ponto de partida pro dev)

- Protótipo:
  [`prototipos/quadradinho-decisao.html`](./prototipos/quadradinho-decisao.html).
  **✅ Copiado.**
- Papel do Michel: [`FUNCAO-MICHEL-IA.md`](./FUNCAO-MICHEL-IA.md). **✅ Copiado.**
- Envio no WhatsApp + porteiro: `maestro/src/whatsapp.js` e
  `maestro/src/secretariaFollowup.js` (`deveIgnorarMensagem`, `ehEquipe`).
  **Do Maestro** — ver Nota de escopo abaixo.
- Régua do Michel: `maestro/src/michel.js`. **Do Maestro** — ver Nota de escopo.

> **Resumo:** Z-API manda o LINK pro Michel → ele toca e decide na página →
> backend registra → Bruno recebe o ping + vê no Placar do Gestor. Mesmo número da
> Helena, seguro pela whitelist. **A IA sugere e anota; o humano decide e executa.**

---

## Nota de escopo do Executor (o que é meu × o que é do Maestro)

A tabela de arquitetura (seção 2) já separa: **meu escopo é o CONTEÚDO** — produzir
o placar, a sugestão (custo por venda) e registrar a decisão. **A entrega**
(Z-API/`send-text`, hospedar a página, porteiro/whitelist) e a **régua do Michel**
são do **Maestro/Helena**, que a doutrina me manda **não** tocar
([`../DOUTRINA.md`](../DOUTRINA.md): "SÓ tráfego pago. NÃO mexe no Maestro nem na
Helena").

Por isso os arquivos `maestro/src/whatsapp.js`, `secretariaFollowup.js` e
`michel.js` ficam aqui só como **referência de integração** (o contrato de como meu
conteúdo é entregue) — **não** os copio como código pra dentro deste repo sem o CEO
decidir, pra não misturar repositórios. Os secrets do Z-API vivem no ambiente do
Maestro, não aqui.

## Nota de honestidade do Executor (Olheiro)

O exemplo *"BR_SC tem o melhor custo por venda"* usa dado **ilustrativo**: as telas
mostram só **leads**, não **vendas** atribuídas. Afirmar "custo por venda" sem
atribuição é 🔴 BLOQUEIO ([`../OLHEIRO.md`](../OLHEIRO.md), item 2) e viola a
própria coleira (seção 3). **Sem atribuição de venda ligada à campanha**, a
sugestão real cai no fallback: **"sem base pra sugerir por venda — decisão por
custo/lead, confira"**. Nunca fabricar custo por venda.
