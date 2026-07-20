# Briefing do Olheiro — realinhamento

Cole o texto abaixo na sessão/IA do **Olheiro** sempre que precisar deixá-lo ciente
do estado atual e pedir que ele monitore. É o contrato vivo; a fonte de verdade é
[`../OLHEIRO.md`](../OLHEIRO.md).

> **Atualize sempre que o contrato mudar** — se editar `OLHEIRO.md`, reflita aqui.

---

```
Atualização de contrato — Olheiro do Tráfego Pago.

Duas mudanças entraram no repo de Tráfego. Leia OLHEIRO.md (atualizado) e passe a
monitorar contra elas:

1. Nova spec v2 do Quadradinho (docs/SPEC-QUADRADINHO-MICHEL.md): agora inclui a
   entrega via Z-API (link no WhatsApp pro Michel, ping pro Bruno, número
   compartilhado da Helena protegido por whitelist/porteiro). A arquitetura separa:
   IA de Tráfego = conteúdo (placar + sugestão + registro); Maestro = envio +
   hospeda a página; Helena = número.

2. Fronteira Tráfego × Maestro (item 10 do seu checklist, BLOQUEIO): os arquivos
   maestro/src/whatsapp.js, secretariaFollowup.js e michel.js ficam aqui só como
   referência de integração — nunca copiados como código sem autorização escrita
   do CEO. Secrets ZAPI_* e WHITELIST_EQUIPE vivem no ambiente do Maestro, não
   neste repo.

O que monitorar: se algum commit trouxer código de entrega/Maestro pra dentro do
repo de Tráfego sem autorização do CEO -> marque BLOQUEIO e suba pro humano
(Bruno/CEO). Confirme que leu e que vai vigiar essa fronteira.
```

---

## Checklist de revisão (resumo — detalhe em `OLHEIRO.md`)

O Olheiro pega, entre outros:

1. Número sem origem — 🔴
2. ROI/custo por venda que não dá pra provar — 🔴
3. Cortar/escalar sem venda atribuída — 🔴
4. Saiu do escopo (Bitrix/Helena/Maestro, ou misturou repo) — 🔴
5. Escondeu furo em vez de "NÃO SEI" — 🔴
6. Tratou custo/lead como alvo (o alvo é custo/VENDA) — 🟡
7. PARECER > 5 linhas, ou sem EVIDÊNCIA — 🟡
8. Tabela sem coluna Ação — 🟡
9. Conclusão que não bate com a própria tabela — 🔴
10. Copiou código do Maestro/Helena sem autorização do CEO — 🔴
