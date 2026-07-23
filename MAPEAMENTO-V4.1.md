# MAPEAMENTO OFICIAL CORRIGIDO — KATZER OS V4.1

O painel organiza campanha por **4 campos** (não misturar tudo como cidade):

| Campo | Exemplo |
|--------|---------|
| **PRODUTO** | Fort Myers · Amanay · Barra View · Aya |
| **CIDADE** | Piçarras · Itapoá · Barra Velha |
| **CONSTRUTORA** | Vetter · Rogga · Alicerce · Torresani |
| **CORRETOR** | Sandra · Alisson · Edsel |

## Por que importa
Antes: “Fort Myers” / “Rogga” / “Sandra” pareciam cidade → Michel confundia.
Agora: **Fort Myers · Piçarras** (produto + cidade). Escala por cidade certa + trava de público.

## Linhas no código (`_mapeamento-v41.mjs`)

| Produto | Cidade | Construtora | Corretor (se no nome) |
|---------|--------|-------------|------------------------|
| Fort Myers | Piçarras | Vetter | — |
| Amanay | Itapoá | Rogga | — |
| Barra View | Barra Velha | — | Sandra |
| Aya | Piçarras | Alicerce | Alisson / Edsel |
| Punta Cana | Punta Cana | Torresani | — |

Painel mostra sob o nome da campanha: `Produto · Cidade`.

> Se a tabela completa V4.1 do Bruno tiver linhas a mais/corrigidas, colar de novo — a mensagem anterior cortou depois dos dois pontos.
