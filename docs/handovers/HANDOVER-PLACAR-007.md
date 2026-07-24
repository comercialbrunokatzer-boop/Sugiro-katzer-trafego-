# HANDOVER — PLACAR 007

## 1. Objetivo original

Placar de Campanhas do Michel: Meta Ads → gasto · leads · CPL · decisão do dia  
(PR: https://github.com/comercialbrunokatzer-boop/Sugiro-katzer-trafego-/pull/7)

## 2. Status final

**Substituído** — redesign / duplicata. Sucessor oficial: **PR #24**.

## 3. O que foi entregue

- Núcleo puro `_placar.mjs` (`montaPlacar`, `extraiLeads`, `decideDoDia`, `resumoPlacarWhats`)
- `GET /api/placar` + testes `test/placar.test.mjs`
- PWAs: `public/placar-michel.html`, `public/placar-gestor.html` + manifests
- Workflows de prova/teste do placar
- Correção parcial de leads (form + clique WhatsApp na contagem)

## 4. O que não foi entregue

- Leitura Meta estável em produção sem R$ 0 (token/arquitetura server-side)
- Ponte anúncio → venda Bitrix
- Cron WhatsApp diário do placar como produto oficial único
- Equivalência com o app oficial da PR #24 (Rotina ≠ Campanhas)

## 5. Evidências

- PR #7: branch `claude/placar-campanhas`, 8 commits, testes unitários do núcleo
- URLs legado (referência, não oficiais):
  - https://rotina-produtiva-michel.netlify.app/placar-michel
  - https://rotina-produtiva-michel.netlify.app/ (apps relacionados)
  - Painel executar: https://dashing-elf-41a723.netlify.app/campanhas
- Bug conhecido: painel com **R$ 0** quando `META_SYSTEM_TOKEN` ausente/inseguro no caminho client-side

## 6. Riscos conhecidos

- Dois trilhos ( #7 + #24 ) geram custo, confusão e decisão sobre dado zerado
- Token Meta **nunca** no frontend público
- PWAs legado não devem receber feature nova nem parecer sistema oficial

## 7. Pendências

- Dono da **PR #24**: leitura Meta server-side + secrets + health + fallback
- Após equivalência + OK Bruno/Michel: redirecionar URLs antigas e arquivar PWAs
- Não apagar código reutilizável (`_placar.mjs` etc.) até migração confirmada

## 8. Sucessor ou responsável atual

- **Sucessor:** PR #24 — `feat(apps): Rotina ≠ Campanhas — dois apps, dois ícones`  
  https://github.com/comercialbrunokatzer-boop/Sugiro-katzer-trafego-/pull/24  
  Branch: `cursor/ranking-cpl-formulario-f7d6`
- **Executor:** Cursor / Copilot (dono #24)
- **Claude:** não continua o #7 (só revisa P0 se acionado)

## 9. Decisões que não podem ser perdidas

- Especialização > Sobreposição (`docs/GOVERNANCA-AGENTES.md` no helena-katzer)
- #7 = redesign / substituído; #24 = trilha oficial
- Meta token só server-side; health-check + fallback obrigatórios
- PWAs #7 = legado até cutover

## 10. Próxima ação recomendada

Executor da PR #24: fechar leitura Meta segura (server-side) e validar painel oficial com Bruno/Michel — depois redirecionar/arquivar PWAs do #7.
