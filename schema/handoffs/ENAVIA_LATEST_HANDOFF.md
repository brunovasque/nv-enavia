# ENAVIA — Latest Handoff

**Data:** 2026-05-01
**De:** PR46 — PR-IMPL — LLM Core v1: consolidar identidade, Brain Context e política de resposta
**Para:** PR47 — PR-PROVA — Teste de resposta viva com LLM Core v1

## O que foi feito nesta sessão

### PR46 — PR-IMPL — LLM Core v1

**Tipo:** `PR-IMPL` (Worker-only, patch cirúrgico)
**Branch:** `copilot/claudepr46-impl-llm-core-v1`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR45 ✅

**Objetivo:**
Implementar o LLM Core v1 da Enavia, consolidando identidade, capacidades, política de
resposta e relação com o Brain Context em uma camada central do prompt do chat,
reduzindo redundância sem perder segurança, anti-bot, governança ou envelope JSON.

**Arquivos novos:**
- `schema/enavia-llm-core.js` — `buildLLMCoreBlock()` + `getLLMCoreMetadata()` (camada LLM Core v1, pure function determinística)
- `tests/pr46-llm-core-v1.smoke.test.js` — smoke test (7 cenários A–G, 43 asserts)
- `schema/reports/PR46_IMPL_LLM_CORE_V1.md` — relatório completo

**Arquivos modificados:**
- `schema/enavia-cognitive-runtime.js` — substituiu antigas seções 1+1b+2+3+4 do `buildChatSystemPrompt` por chamada única ao `buildLLMCoreBlock({ ownerName })`. Demais seções (Brain Context, target, MODO OPERACIONAL condicional, planner, memória, envelope JSON) inalteradas.

**Arquivos NÃO alterados:**
`nv-enavia.js`, `schema/enavia-brain-loader.js` (snapshot principal preservado por escopo),
`schema/enavia-identity.js`, `schema/enavia-capabilities.js`, `schema/enavia-constitution.js`,
`schema/operational-awareness.js`, painel, executor, deploy worker, workflows,
`wrangler.toml`, `wrangler.executor.template.toml`, KV/bindings/secrets, sanitizers.

**Medição (chars / tokens estimados, todos os 6 cenários da PR45):**

| Cenário | PR45 baseline | PR46 atual | Δ chars | Δ tokens |
|---------|--------------:|-----------:|--------:|---------:|
| A — simples sem target | 10.945 | 10.496 | -449 | -112 |
| B — simples target read_only | 11.187 | 10.738 | -449 | -112 |
| C — identidade | 10.945 | 10.496 | -449 | -112 |
| D — capacidade | 10.945 | 10.496 | -449 | -112 |
| E — operacional real | 12.812 | 12.363 | -449 | -112 |
| F — operacional completo + awareness | 13.689 | 13.240 | -449 | -112 |

**Economia: -4,1% por conversa, constante em todos os cenários.**

**Outros marcadores:**
- "NV Imóveis": 9 → **3** ocorrências
- "ENAVIA": 11 → ~7 ocorrências
- "não é assistente": 1 (preservado para blindagem)

**Por que a economia é menor que o estimado pela PR45 (~400-450 tok)?**
A PR45 estimou assumindo redução também dos Brain blocks 1-3. O escopo desta PR46
proíbe alteração do snapshot principal do Brain Loader. Por isso a economia veio
exclusivamente da consolidação das antigas seções 1+1b+2+3+4 no Core. Documentado
no relatório seção 9.

**Testes:**
- `node --check` em `enavia-llm-core.js`, `enavia-cognitive-runtime.js`, `enavia-brain-loader.js`, `pr46-llm-core-v1.smoke.test.js` → OK
- Smoke PR46: **43/43 ✅**
- Regressões PR44 (38/38), PR43 (32/32), PR37 (56/56), PR36 (26/26), PR21 (53/53), PR20 (27/27), PR19 (52/52), PR14 (183/183), PR13 (91/91) → **558/558 ✅**
- **TOTAL geral: 601/601 ✅**

**Mantidos integralmente:**
- Brain Context (injetado por padrão, desligável por flag, antes do envelope JSON)
- Envelope JSON `{reply, use_planner}`
- Target informativo factual + nota `read_only` como gate
- `MODO OPERACIONAL ATIVO` apenas quando `is_operational_context=true`
- Sanitizers (não tocados — em `nv-enavia.js`)
- Gates de execução (não tocados)
- Política de planner / `use_planner`
- Continuidade + uso/criação de memória
- Operational Awareness
- `buildCognitivePromptBlock` e demais consumidores

## Próxima etapa segura

**PR47 — PR-PROVA — Teste de resposta viva com LLM Core v1**

Validar com cenários reais (chat live ou simulação com LLM externo) que o LLM Core v1
produz respostas vivas, naturais e não engessadas, mantendo anti-bot, gates de execução
e falsa capacidade bloqueada.

Se algo falhar antes da PR47:
**PR47 — PR-IMPL — Correção cirúrgica do LLM Core v1**

## Bloqueios

Nenhum. Branch sem conflitos com `main`. Todos os testes passando. Governança atualizada.

## Riscos restantes

1. Duplicação Core ↔ Brain blocks 2-3 (R2/C3 PR45) ainda existe — endereçável quando
   o escopo permitir alterar o snapshot do Brain Loader.
2. Economia menor que o estimado pela PR45 — documentado.
3. Validação subjetiva da resposta viva (qualidade humana) ainda não foi feita —
   é exatamente o objetivo da PR47.
