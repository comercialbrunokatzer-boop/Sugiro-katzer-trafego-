# Pacote V6.0 — entregar ao executor

```
pacote-v6/
├── PROMPT-FINAL-V6-EXECUTOR.txt     ← ler PRIMEIRO
├── MICHEL-ROTINA-INDEX-RAIZ-PUBLICO/
│   └── index.html                   ← raiz Netlify rotina-produtiva-michel (anti-404)
├── MICHEL-PAINEL-2-E-3/
│   └── painel.html                  ← Painel 2 Execução + Painel 3 Caçador (pling)
└── BRUNO-GESTOR/
    └── gestor.html                  ← /gestor.html ao vivo + relatório tarde
```

Gerar ZIP:
```bash
cd pacote-v6 && zip -r ../KATZER-V6-EXECUTOR.zip .
```

Ou no repo já alinhado em `public/` + `gh workflow run deploy-trafego.yml`.
