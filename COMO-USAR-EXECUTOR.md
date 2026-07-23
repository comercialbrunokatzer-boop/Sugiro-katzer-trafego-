# COMO USAR — ZIP PRO EXECUTOR (Netlify)
**Katzer OS · Tráfego · Versão painel Campanhas + Rotina**

Não queimar token. Seguir na ordem.

---

## 1. O que é este pacote

Dois intuitos. Não misturar.

| App | Site Netlify | Função |
|-----|----------------|--------|
| **Disciplina (Rotina)** | `rotina-produtiva-michel` | **Visualizar** — ranking CPL form., resumo, tarefas. Sem escalar. |
| **Painel isolado (Campanhas)** | `campanhas-katzer` (hoje: `dashing-elf-41a723`) | **Executar** — 2 quadradinhos + lead flutuante. |

Repo: `comercialbrunokatzer-boop/Sugiro-katzer-trafego-`  
Branch de trabalho: `cursor/ranking-cpl-formulario-f7d6` (ou a que o Bruno indicar).

---

## 2. Subir no Netlify (corrigir 404)

1. Confirmar que `public/index.html` existe (publish = `public` no `netlify.toml`).
2. Deploy dos **dois** sites na mesma branch:
   ```bash
   gh workflow run deploy-trafego.yml --ref <BRANCH> -f site_name=rotina-produtiva-michel
   gh workflow run deploy-trafego.yml --ref <BRANCH> -f site_name=dashing-elf-41a723
   ```
3. Não inventar site novo (`campanhas-katzer`) no dispatch se o slug ainda não existir no Netlify — usa `dashing-elf-41a723` até renomear no painel Netlify.
4. Testar URLs (tem que ser 200, não Page Not Found):
   - https://rotina-produtiva-michel.netlify.app/
   - https://rotina-produtiva-michel.netlify.app/ranking-campanhas
   - https://rotina-produtiva-michel.netlify.app/placar-michel
   - https://dashing-elf-41a723.netlify.app/
   - https://dashing-elf-41a723.netlify.app/campanhas

Se der 404: publish dir errado, arquivo fora de `public/`, ou deploy no site errado.

---

## 3. Michel — como usar no dia a dia

### Na Rotina (disciplina · visualizar)
- Abre Placar / Ranking.
- Vê gasto, leads form., CPL (nunca clique).
- **Não** tem botão Aplicar / escalar / Caçador.
- CTA: **▶ Executar** → abre o painel isolado.

### No Campanhas (executar · 2 quadradinhos)

**① Decisão do dia**  
- Aplicar · Ajustar · Agora não  
- Travas: SEM BASE (&lt;10 leads) · PUBLICO EXTERNO (EUA/MIAMI/PORTUGAL)  
- Mix 80% onde já vende (Amanay 30 · Fort Myers Penha 20 · Barra View 15 · Grant Home 15)

**② Caçador de qualidade**  
- 2 toques: Bom / Curioso / Errado / Comprador  
- Alimenta **CPL BOM** = gasto ÷ (Bom + Comprador)  
- Sem estrutura EN → lead inglês continua **Curioso**

**Lead ao vivo flutuante**  
- Quando cai lead sem qualidade: card flutuante + **bipe chato** a cada ~8s  
- Para quando Michel marcar qualidade  
- iPhone: 1 toque na tela libera o áudio

---

## 4. Nome canônico de campanha (V4.1)

```
[PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]
```

Ex.: `AMANAY_ITAPOA_ROGGA_BR-SC` · `FORTMYERS_PENHA_VETTER_BR-SC`

Não misturar produto/construtora como se fosse cidade.  
Fort Myers = **Penha** · Barra View = **Santer** · Amanay = **Itapoá**.

---

## 5. O que NÃO fazer

- Não colar link `embed.fbsbx.com/playables/...` — isso **não é ZIP**, é Playable da Meta (jogo).
- Não escalar na Rotina.
- Não sugerir EUA_Americanos / MIAMI / PORTUGAL barato.
- Não contar clique como lead.
- Não inventar slug Netlify novo no workflow sem o site existir.

---

## 6. Checklist rápido do executor

- [ ] Deploy Rotina OK  
- [ ] Deploy Campanhas OK  
- [ ] `/` e `/campanhas` e `/ranking-campanhas` sem 404  
- [ ] Ranking mostra form. (não clique)  
- [ ] Campanhas mostra ① Decisão + ② Caçador  
- [ ] Lead pendente sobe float (demo João/Maria)  
- [ ] Bruno: status **PRONTO PARA TESTE DO BRUNO**

---

## 7. Contatos de URL (colar no WhatsApp do Michel)

| Uso | Link |
|-----|------|
| Disciplina / Ranking | https://rotina-produtiva-michel.netlify.app/ranking-campanhas |
| Placar tarefas | https://rotina-produtiva-michel.netlify.app/placar-michel |
| Executar (2 quadradinhos) | https://dashing-elf-41a723.netlify.app/campanhas |
