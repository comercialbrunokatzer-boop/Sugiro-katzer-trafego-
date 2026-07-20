# CLAUDE.md

Orientações para o Claude Code (e outros assistentes de IA) ao trabalhar neste repositório.

## O que é este projeto

**katzer-trafego-** — Tráfego pago da Katzer.

Ferramenta de **métrica de campanha e decisão de mídia** para o Michel. A tese central do
produto: **ligar o anúncio à venda, não ao clique**. Ou seja, o valor está em atribuir
receita/vendas reais às campanhas de mídia paga, em vez de otimizar por métricas de vaidade
(cliques, impressões, CTR).

Domínio: marketing de performance / tráfego pago (Meta Ads, Google Ads e afins), atribuição
de conversão e apoio à decisão de alocação de verba.

## Estado atual do repositório

> **Importante:** o projeto está em estágio inicial (greenfield). No momento o repositório
> contém **apenas** o `README.md` — ainda **não há código, stack definida, build ou testes**.

```
.
├── README.md      # descrição de uma linha do propósito do projeto
└── CLAUDE.md      # este arquivo
```

Não presuma a existência de framework, linguagem, gerenciador de pacotes ou pipeline de CI.
Nada disso foi escolhido ainda. Antes de escrever código, **confirme com o usuário** a stack
e a estrutura desejadas, ou proponha uma e peça aprovação.

## Idioma

- O projeto é conduzido em **português (Brasil)**. O `README.md` está em português.
- Escreva documentação, mensagens de commit, comentários e textos voltados ao usuário em
  português, salvo pedido em contrário.
- Nomes de identificadores em código podem seguir a convenção da stack escolhida (comumente
  inglês), mas mantenha consistência com o que já existir no repositório.

## Fluxo de trabalho com Git

- **Branch de desenvolvimento designada:** `claude/claude-md-documentation-0y7toe`.
  Desenvolva e faça push nesta branch; não faça push para `main` sem permissão explícita.
- Branch padrão do projeto: `main`.
- Faça commits com mensagens claras e descritivas (em português).
- Push: `git push -u origin <branch>`. Em falha de rede, repita com backoff (2s, 4s, 8s, 16s).
- **Não abra Pull Request** a menos que o usuário peça explicitamente.

## Diretrizes ao evoluir o projeto

Quando começar a existir código, **atualize este CLAUDE.md** para refletir a realidade:
adicione a stack, os comandos de build/lint/test, a estrutura de pastas e as convenções que
forem sendo estabelecidas. Este arquivo deve sempre descrever o estado atual — não o
planejado.

Ao introduzir a primeira estrutura, considere documentar aqui:

- **Stack e ferramentas** — linguagem, framework, gerenciador de pacotes.
- **Comandos essenciais** — como instalar dependências, rodar, buildar, lintar e testar.
- **Arquitetura** — onde ficam ingestão de dados de campanha, modelo de atribuição
  (anúncio → venda), integrações com plataformas de anúncios e camada de relatório/decisão.
- **Segredos e credenciais** — nunca comitar chaves de API (Meta, Google Ads etc.); usar
  variáveis de ambiente e um `.env` fora do controle de versão (com `.env.example`).
- **Convenções** — estilo de código, padrão de nomes, formato de commits.

## Regras gerais

- Não invente comandos, scripts ou arquivos que não existem. Se algo ainda não foi definido,
  diga que não existe em vez de supor.
- Mantenha as mudanças enxutas e alinhadas ao propósito do produto: **atribuição de venda,
  não de clique**.
- Trate qualquer dado de campanha ou de cliente como sensível.
