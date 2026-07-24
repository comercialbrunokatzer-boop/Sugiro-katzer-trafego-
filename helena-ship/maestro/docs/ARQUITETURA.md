# ARQUITETURA — Maestro (documentação automática · regra #9)

**Módulo:** Maestro (barramento de entrada de leads) · **Versão:** 0.1.0 · **Runtime:** Node.js 20 (ESM), Netlify Functions + Firebase RTDB.

## 1. Fluxograma
```
Meta Ads ─┐   WhatsApp ─┐   Pré-form ─┐   Helena/Firebase ─┐
          ▼             ▼             ▼                     ▼
      wh-meta      wh-whatsapp    wh-preform            wh-helena
          └─────────────┴─────────────┴─────────────────────┘
                              │
                     src/ingest.js  (PIPELINE ÚNICO)
                              │
   normaliza(lead) → deduplica(telefone) → corretor(round-robin|dono)
                              │
                     bitrixWrite.upsertNegocio
                       ├─ contato (findbycomm | contact.add)
                       └─ deal.add / deal.update  (etapa, campos, dono)
                              │
             estado.vincular(lead↔deal) + estado.logEvento
                              │
              se qualificado ▼
        discadora.enfileira  +  whatsapp.enviaTexto("corretor já vai te chamar")
                              │
                     erro? → alert (WhatsApp Katzer)
```

## 2. Fluxo de dados
- **Entrada:** payload do webhook (JSON) → `normalizaLead()` → **lead canônico** (chave = últimos 11 dígitos do telefone).
- **Estado (Firebase):** `maestro/rr/indice` (round-robin), `maestro/links/<leadId>` (vínculo), `maestro/eventos` (log append-only).
- **Saída (Bitrix):** `crm.contact.add`, `crm.deal.add`/`crm.deal.update` (categoria 1, etapa por webhook, `ASSIGNED_BY_ID`, campos UF).

## 3. Variáveis de ambiente
Escrita Bitrix (`BITRIX_WEBHOOK_WRITE`), etapas (`STAGE_LEAD_NOVO|QUALIFICADO|PRE_QUALIFICADO`, `BITRIX_CATEGORY_ID`), campos incertos (`UF_ORIGEM|PERFIL_DECISOR|NIVEL`), pool (`BROKER_POOL`), Firebase (`FIREBASE_DATABASE_URL|DB_SECRET`), Z-API (`ZAPI_INSTANCE_ID|TOKEN|CLIENT_TOKEN`), discadora (`DISCADORA_MODE|API_URL|API_TOKEN`), alerta (`KATZER_ALERT_PHONE`). Detalhe em `.env.example`.

## 4. Integrações
| Sistema | Direção | Módulo | Estado |
|---|---|---|---|
| Bitrix24 | escrita | `src/bitrixWrite.js` | pronto (falta o webhook de escrita) |
| Firebase RTDB | leitura/escrita | `src/state.js` | pronto (fallback em memória) |
| Z-API (WhatsApp) | saída | `src/whatsapp.js` | pronto (falta credencial) |
| Discadora | saída | `src/discadora.js` | modo `bitrix` (puxa do CRM) por padrão |
| Meta / Pré-form / Helena | entrada | `functions/wh-*.js` | pronto (falta apontar os webhooks) |

## 5. Dependências
Zero libs externas — só `fetch` nativo (Node 20) e `node:test`. Redução consciente de superfície de risco.

## 6. Pontos críticos (o Olheiro falando)
1. **Escrita no Bitrix é irreversível** — dedup por telefone é obrigatório (implementado). Sem ele = negócio duplicado.
2. **Etapas "Qualificado/Pré-Qualificado" ainda não confirmadas** no funil real → padrão cai em "Tentando Contato". Trocar assim que o CEO confirmar.
3. **Z-API é ponto único de falha que já caiu em silêncio** → alerta obrigatório se cair (não ficar mudo).
4. **Nunca rebaixa etapa** — `upsertNegocio` promove, não retrocede (evita jogar um negócio adiantado de volta pra "Lead Novo").
5. **Campos sem ID confirmado não são enviados** (Lei 01: vazio > errado).

## 6.1 Fundação P0.1 (KOS-001 §5) — o núcleo endurecido
- **Contrato de evento** (`src/evento.js`): toda entrada vira `{event_id, correlation_id, source, contact, context, payload_original, processing_status}` antes de processar.
- **Idempotência** (`src/state.js` + `src/ingest.js`): `event_id` já processado nunca roda de novo (persistente no Firebase).
- **Retry com backoff** (`src/retry.js`): só erro recuperável (429/5xx/rede); 4xx falha rápido. Usado no cliente Bitrix.
- **Fila de erro** (`estado.enfileiraErro`): falha nunca some — pode ser reprocessada.
- **Máscara de dados** (`evento.mascara`): telefone/e-mail/token nunca aparecem inteiros no log.
- **Health-check** (`functions/health.js`): diz se está de pé e quais credenciais existem (sem expor valor).
- **Modo homologação** (`MAESTRO_MODO=homolog`): roda o fluxo real SIMULANDO a escrita no Bitrix.

## 6.2 Módulos P1 (já construídos e testados — falta só ligar entrada/saída no deploy)
- **Secretária IA** (`src/secretaria.js`): 6 estágios, travas §6A (confiança, evidência, "Fechado" objetivo, regressão, fala da equipe não vira intenção), roteamento de revisão (Michel × Bruno), comportamento contínuo + trilha de mudança de estágio.
- **Cartão do lead** (`src/cartaoLead.js`): o alerta no WhatsApp do CEO (formato oficial).
- **Follow-up** (`src/followup.js`): 30min→Helena, 2h→Michel, 4h→Bruno, com travas do relógio + limite diário.
- **Homologação** (`src/homolog.js`): banco de casos golden que prova a decisão da Secretária.
- **Michel** (`src/michel.js`): retrato → fila de ação + régua que mede o Michel (modo seguro).
- **Briefings** (`src/briefings.js`): Top 3 diário por corretor (motivo + próxima ação + script).
- **Painéis** (`src/paineis.js`): painel operacional do Michel + parecer executivo do Bruno.

## 7. O que ainda depende de deploy / dados externos
Ligar entrada (mensagens reais da Helena) e saída (escrita real no Bitrix); validar as 15 regras
do Auditor pra a fila do Michel cobrar com prova; áudio de ligação (gravação acessível). Ver KOS-002.
