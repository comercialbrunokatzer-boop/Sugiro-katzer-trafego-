# MAPEAMENTO OFICIAL — KATZER OS V4.1

## Nome canônico da campanha

```
[PRODUTO]_[CIDADE]_[CONSTRUTORA]_[PÚBLICO]_[DATA]_[TIPO]
```

Exemplo:

```
[FORT MYERS]_[PIÇARRAS]_[VETTER]_[BR_SC]_[23/07/26]_[LEAD]
[AMANAY]_[ITAPOÁ]_[ROGGA]_[SC+PR]_[27/09/25]_[VIDEO]
```

| Slot | O que é | Exemplo |
|------|---------|---------|
| 1 PRODUTO | Empreendimento | Fort Myers · Amanay · Barra View · Aya |
| 2 CIDADE | Cidade real | Piçarras · Itapoá · Barra Velha |
| 3 CONSTRUTORA | Construtora | Vetter · Rogga · Alicerce |
| 4 PÚBLICO | Público do anúncio | BR_SC · SC+PR · EUA_Americanos |
| 5 DATA | Data da campanha | 23/07/26 |
| 6 TIPO | Formato | LEAD · VIDEO · IMAGEM |

## Por que importa
Antes misturava tudo como “cidade” (Fort Myers, Rogga, Sandra…).
Agora o painel lê os 6 slots e mostra **Produto · Cidade**; a trava PUBLICO EXTERNO usa o slot **PÚBLICO**.

Nomes legados da Meta (`FortMyers_BR_SC`, `[ROGGA][AMANAY][data]`) ainda resolvem via alias — mas o padrão novo é o de 6 slots.
