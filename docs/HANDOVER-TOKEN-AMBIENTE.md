# Handover — cadastrar o token da Meta no ambiente (pro dev/executor)

> ⚠️ Este documento explica **onde** cadastrar o token. Ele **NÃO** contém o token
> e nunca deve conter. O token é uma senha — vai só no painel de secrets do
> ambiente, nunca em arquivo/repo/log.

## O problema
A sessão da **IA de Tráfego** (repo `comercialbrunokatzer-boop/sugiro-katzer-trafego-`)
não enxerga o token da Meta. O secret `META_SYSTEM_TOKEN` **não está no ambiente
desta sessão** — deve ter sido criado em outro ambiente. Cada ambiente só enxerga
os próprios secrets.

## O que precisa ser feito
Cadastrar **uma variável de ambiente (secret)** no ambiente que roda as sessões
deste repo:

```
Nome:  META_SYSTEM_TOKEN
Valor: <token do Usuário do Sistema "Katzer Token"> (a senha entregue em privado)
```

- **Onde:** na configuração do **ambiente** do Claude Code na web (variáveis/secrets
  do ambiente), NÃO no GitHub, NÃO no repositório, NÃO num `.md`.
- Doc oficial de como configurar ambiente/variáveis:
  https://code.claude.com/docs/en/claude-code-on-the-web
- Depois de salvar, o secret entra numa **sessão nova** desse ambiente.

## O que NÃO fazer
- ❌ Não commitar o token em nenhum arquivo (nem `.env` versionado).
- ❌ Não colar o token em chat.
- ❌ Não precisa criar ambiente novo nem excluir o antigo — só **acrescentar** o
  secret no ambiente que já existe.

## Como confirmar que funcionou
Numa sessão nova desse ambiente, a IA de Tráfego roda o teste de fumaça:
```
GET https://graph.facebook.com/v20.0/act_1150648749960943/insights
    ?level=campaign&date_preset=maximum&fields=campaign_name,spend
Authorization: Bearer $META_SYSTEM_TOKEN
```
Sucesso = imprime nome da campanha + gasto (sem nunca imprimir o token).

## Contexto (IDs — não são senha, já estão no repo)
`AD_ACCOUNT = act_1150648749960943` · demais IDs em
[`TRANSFERENCIA-TRAFEGO.md`](./TRANSFERENCIA-TRAFEGO.md).
