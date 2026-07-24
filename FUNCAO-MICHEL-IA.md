# FUNÇÃO DO MICHEL COM A IA (Katzer OS)

| | |
|---|---|
| **Status** | OFICIAL (define o papel operacional do Michel no sistema) |
| **Data** | 2026-07-19 |
| **Aprovado por** | CEO |
| **Princípio** | A IA trabalha PARA o Michel. Ela faz o trabalho braçal; ele decide e age. |

> Regra de ouro do papel: a IA **nunca acusa** (modo seguro). Ela entrega fato + sugestão;
> a mão que pausa/escala anúncio e fala com corretor é humana.

---

## 1. QUAL É A FUNÇÃO DO MICHEL
O Michel é o **gestor** e o **maestro da operação diária**. Com a IA, ele deixa de *montar* relatório e passa a
*comandar* com base nele. Duas responsabilidades:

1. **Monitorar as campanhas** todo dia pelo placar que chega pronto (ver onde vaza dinheiro, onde
   está o resultado) e **aplicar ele mesmo na Meta** (pausar/escalar — decisão e execução dele;
   a Carol é dona do Instagram/acesso, **não aprova nem executa** campanha). A decisão é registrada
   com **1 toque no quadradinho** — ele não escreve, e o registro cai sozinho no relatório do Bruno.
2. **Marcar a qualidade do lead** no Bitrix (curioso / número errado / comprador). São 2 toques que
   **ensinam a IA** a descobrir campanha ruim em dias — ele é o "cérebro" que o sistema aprende.

---

## 2. O BENEFÍCIO PRA ELE (por que isso é bom pro Michel)
- **Acaba o trabalho braçal:** nunca mais montar planilha/relatório na mão. Chega pronto.
- **Sabe onde agir em 30 segundos:** o placar aponta o vazamento e o acerto — sem adivinhação.
- **Os números dele melhoram:** a IA acha o dinheiro jogado fora (ex.: R$ 257 gastos, 0 lead) antes
  de queimar um mês de verba. Ele corrige cedo e entrega mais resultado.
- **Protege ele:** modo seguro — a IA não expõe ninguém; dá **fatos** pra ele agir com segurança.
- **Ele fica mais forte:** as marcações dele deixam o sistema mais inteligente. Vira peça-chave, não
  fiscalizado.

---

## 3. O QUE ELE FAZ POR DIA (passo a passo)
**De manhã (2 minutos):**
1. Abre o placar que chegou no WhatsApp.
2. Lê os 🔴 (onde vaza) e o 🟢 (onde está o dinheiro).
3. Olha a **Sugestão do Dia** (ex.: "mover verba de X pra Y") e **decide**: aplica ou não na Meta.

**Ao longo do dia (quando falar/qualificar um lead):**
4. No card do lead no Bitrix, marca a qualidade em 2 toques: *curioso / número errado / comprador*.

Só isso. Nada de criar, preencher ou manter planilha — o placar se refaz sozinho todo dia.

---

## 4. O QUE A IA FAZ (pra ele confiar no que chega)
- Lê sozinha a Meta (gasto, custo/lead) + o Bitrix (quem fechou) e monta o placar.
- Separa sempre: erro de **mídia** (anúncio caro) ≠ erro de **qualidade** (lead ruim) ≠ erro de
  **conversão** (lead bom mal atendido). Não mistura.
- Toda frase tem número atrás (Lei 01). Sem "achismo".
- Só sugere; **não pausa anúncio sozinha**.

> **Nota de escopo do Tráfego (CEO · item 4):**  
> “Lê o Bitrix” no texto acima é papel do **Auditor (Katzer)**. O Executor deste repo (**Tráfego**)  
> **não** acessa o Bitrix. Atribuição venda↔campanha entra por **export/arquivo/contrato** —  
> nunca misturando repositório nem lendo CRM direto. Fase A do Copiloto usa só Meta (gasto · leads · CPL).

---

## 5. O QUE PRECISO DA PARTE DO MICHEL (só isto)
1. ~~Número de WhatsApp~~ — destino via secret `WHATSAPP_MICHEL` (confirmar setado no Netlify/Actions; **não** escrever o número em docs/logs).
2. **OK no fluxo dos 2 toques** de qualidade do lead no Bitrix (curioso / número errado / comprador) — ainda a comprovar no código.

> O Michel **não coleta nada da Meta** — isso é com a Carol. A parte dele é receber, decidir no quadradinho, executar na Meta e marcar qualidade.
