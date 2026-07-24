# Missão Copilot — 1 tarefa só

O token do Cursor **não tem scope `workflow`**, então não consegue commitar `.github/workflows/*`.

1. Copiar `scripts/set-env-trafego.COM-META.yml` → `.github/workflows/set-env-trafego.yml` (substituir).
2. Commit + push na branch `cursor/placar-formato-rotina-f7d6` (ou main, se preferir).
3. Rodar: `gh workflow run set-env-trafego.yml -f site_name=rotina-produtiva-michel`
4. Aceite: `curl -s https://rotina-produtiva-michel.netlify.app/health | jq .credenciais.meta` → `true`
5. Não logar o token. Não pedir nada ao Bruno.
