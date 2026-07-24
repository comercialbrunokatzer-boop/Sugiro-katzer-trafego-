# MAESTRO — barramento único do Katzer OS

> **Objetivo (P0):** nenhum lead qualificado vive apenas no WhatsApp/Firebase. **Todo lead nasce dentro do Bitrix24, automaticamente.**

O Maestro é a camada de middleware por onde passa **toda** comunicação de entrada de lead. Nada de integração ponto-a-ponto: Meta, WhatsApp, pré-formulário e Helena entram pelo Maestro, e é ele quem cria/atualiza o negócio no Bitrix, atribui corretor e joga na discadora.

## Os 4 webhooks (P0)
| Endpoint | Entrada | O que faz | Etapa Bitrix |
|---|---|---|---|
| `/api/wh-meta` | Meta Ads (form) | cria negócio "Lead Novo", elimina o "Preencher formulário CRM" | `STAGE_LEAD_NOVO` |
| `/api/wh-whatsapp` | WhatsApp direto | cria negócio "Lead Novo" só com número + fonte | `STAGE_LEAD_NOVO` |
| `/api/wh-preform` | Pré-formulário | cria negócio com TODOS os campos, corretor atribuído | `STAGE_QUALIFICADO` |
| `/api/wh-helena` ⭐ | Helena (Firebase "qualificado") | cria/atualiza negócio, atribui corretor, **discadora + avisa o lead** | `STAGE_PRE_QUALIFICADO` |

## Como rodar os testes (sem rede)
```bash
cd maestro
node --test        # 6 testes: pipeline, dedup, round-robin, teto, guard
```

## Deploy (Netlify)
1. Configure as variáveis do `.env.example` no painel do Netlify.
2. `netlify deploy` (ou push no repositório conectado). As functions ficam em `/.netlify/functions/*` e os atalhos `/api/*` vêm do `netlify.toml`.
3. Aponte os webhooks das origens (Meta Lead Ads, Z-API, formulário, Helena) para os endpoints.

## O lead canônico (o formato único)
Espelha o schema pedido pelo CEO. A Helena deve gravar isto no Firebase:
```json
{
  "leadId":"whatsapp_number","nome":"...","telefone":"...","email":"...",
  "origem":"formulario_facebook | whatsapp_direto | bitrix_campanha",
  "interesse":"...","finalidade":"veraneio|moradia|investimento",
  "orcamento_max":0,"perfil_decisor":"unico_tomador|conjunta|precisa_consultar",
  "estagio":"pesquisando|comparando|pronto","observacoes":"...",
  "nivel":"quente|morno|frio","timestamp":"ISO"
}
```
Payloads de exemplo por webhook: `test/payloads/*.json`.

## As 10 regras do Executor — onde cada uma vive no código
1. **Nada isolado** → tudo passa por `src/ingest.js` (pipeline único).
2. **Automatizar antes de tela** → P0 é só webhook, zero UI.
3. **Eliminar tarefa manual** → fim do "Preencher formulário CRM".
4. **Nada em um só sistema** → `estado.vincular()` grava o vínculo lead↔negócio nos dois lados.
5. **Rastreabilidade** → `estado.logEvento()` em cada passo.
6. **Logs** → `src/logger.js` (JSON por linha).
7. **Erro gera alerta** → `src/alert.js` (WhatsApp pro Katzer).
8. **Fallback** → Z-API/discadora/Firebase degradam sem quebrar (in-memory, "não configurado").
9. **Documentação** → este README + `docs/ARQUITETURA.md`.
10. **Reduz trabalho humano?** → sim: lead nasce completo no CRM sem digitação.

## ⚠️ Fios ao vivo (o que falta pra ligar em produção — não chutado)
Está tudo em `.env.example`, marcado. Nada disso está no código:
- `BITRIX_WEBHOOK_WRITE` — webhook de **escrita** (isolado do Auditor).
- `STAGE_QUALIFICADO` / `STAGE_PRE_QUALIFICADO` — **confirmar** quais etapas do Bitrix representam esses níveis (hoje caem em "Tentando Contato" como padrão seguro).
- `UF_ORIGEM`, `UF_PERFIL_DECISOR`, `UF_NIVEL` — IDs dos campos que o Auditor ainda não mapeia (campo sem ID **não é enviado** — vazio > errado).
- `FIREBASE_*`, `ZAPI_*`, `DISCADORA_*` — vêm do repo/painel da Helena.

> Enquanto esses env não vierem, o Maestro **roda e passa nos testes** com fakes/estado em memória; ele só não escreve no Bitrix real. É proposital: código pronto, ligação consciente.
