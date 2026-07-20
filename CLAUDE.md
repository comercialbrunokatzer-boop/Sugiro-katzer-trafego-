# CLAUDE.md

Guia para assistentes de IA (e humanos) que forem trabalhar neste repositório.

## O que é este projeto

**Sugiro-katzer-trafego-** é o projeto de **tráfego pago da Katzer**: métrica de
campanha e decisão de mídia para o Michel.

A ideia central — e o critério que orienta todas as decisões de produto — é:

> **Ligar o anúncio à venda, não ao clique.**

Ou seja, o valor do projeto está em atribuir receita/venda de volta às campanhas
de mídia paga, em vez de otimizar por métricas de vaidade (cliques, impressões,
CTR isolado). Toda funcionalidade nova deve responder à pergunta "isso ajuda a
conectar gasto de mídia a venda real?".

## Estado atual do repositório

> ⚠️ **Repositório greenfield.** No momento este repo contém apenas o
> `README.md`. Ainda **não há** código-fonte, gerenciador de pacotes, build,
> testes ou pipeline de CI.

Arquivos versionados hoje:

```
README.md     # descrição de uma linha do propósito do projeto
CLAUDE.md     # este arquivo
```

Isso significa que a primeira contribuição de código também vai **definir a
stack**. Quando isso acontecer, atualize este arquivo (veja "Mantendo este
documento" abaixo) para registrar as escolhas reais — linguagem, framework,
comandos de build/test/lint e estrutura de pastas.

## Idioma e domínio

- O projeto é **brasileiro** e o domínio é **marketing de performance / tráfego
  pago**. Documentação, nomes de conceitos de negócio e comunicação com o
  usuário devem ser em **português (pt-BR)**.
- Identificadores de código (variáveis, funções, tipos) podem seguir a convenção
  padrão da linguagem escolhida (geralmente inglês), mas os **termos de domínio**
  devem permanecer reconhecíveis para o negócio.

### Glossário de domínio

| Termo | Significado |
|-------|-------------|
| Tráfego pago | Aquisição de visitantes via anúncios pagos (Meta Ads, Google Ads etc.) |
| Campanha | Conjunto de anúncios com um objetivo e orçamento |
| Atribuição | Ligar uma venda de volta à campanha/anúncio que a originou |
| Clique | Métrica intermediária — **não** é o objetivo final do projeto |
| Venda | Resultado de negócio; é a métrica-alvo real |
| Michel | Stakeholder principal / usuário das decisões de mídia |
| Katzer | Negócio para o qual as campanhas são feitas |

## Decisões pendentes (a definir na primeira PR de código)

Ao introduzir código, decida e **documente aqui** o seguinte:

- [ ] Linguagem e runtime (ex.: Node/TypeScript, Python, etc.)
- [ ] Gerenciador de pacotes e como instalar dependências
- [ ] Comando de build
- [ ] Comando de testes e framework
- [ ] Comando de lint/format
- [ ] Fontes de dados de campanha (APIs de Meta/Google Ads, planilhas, CSVs?)
- [ ] Onde/como o dado de venda entra (CRM, checkout, importação manual?)
- [ ] Estrutura de pastas

## Fluxo de trabalho de desenvolvimento

Como ainda não há tooling definido, siga estas práticas gerais:

1. **Branch de trabalho**: desenvolva em uma branch de feature (não commite
   direto em `main`). O padrão de nome usado por sessões de IA neste repo é
   `claude/<descrição-curta>`.
2. **Commits**: mensagens claras e descritivas, no imperativo. Um assunto por
   commit.
3. **Push**: `git push -u origin <branch>`.
4. **Pull Requests**: só abra PR quando explicitamente solicitado.
5. **Verificação**: quando existir suíte de testes/lint, rode-a antes de commitar
   e reporte o resultado com honestidade (inclusive falhas).

## Convenções para assistentes de IA

- **Não invente stack.** Enquanto o repo estiver vazio de código, não presuma
  que existe `package.json`, `requirements.txt` etc. Verifique antes.
- **Mantenha o foco no critério do produto**: anúncio → venda. Se uma tarefa
  parecer otimizar cliques/vaidade sem ligação com venda, sinalize isso.
- **Escreva em pt-BR** na comunicação e na documentação de negócio.
- **Atualize este arquivo** sempre que introduzir tooling, estrutura ou
  convenções novas — ele deve refletir o estado real do repositório.

## Mantendo este documento

Este `CLAUDE.md` é a fonte de verdade para o funcionamento do repositório.
Quando a realidade mudar (nova stack, novos comandos, nova estrutura de pastas),
**atualize as seções correspondentes na mesma PR** que introduz a mudança.
Um `CLAUDE.md` desatualizado é pior do que nenhum.
