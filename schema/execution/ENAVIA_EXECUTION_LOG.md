# ENAVIA — Execution Log

Histórico cronológico de execuções de tarefas/PRs sob o contrato ativo.

---

## 2026-05-01 — PR52 — PR-PROVA — Teste de roteamento de skills

- **Branch:** `copilot/claude-pr52-prova-roteamento-skills`
- **Tipo:** `PR-PROVA` (Worker-only, prova pura)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR51 ✅ (PR-IMPL — Skill Router read-only — 168/168)
- **Escopo:** Prova formal do Skill Router read-only v1 (PR51).

### Objetivo

Provar que o Skill Router read-only implementado na PR51 roteia corretamente pedidos de
skill no fluxo real do chat/prompt, sem executar nenhuma skill, sem criar endpoint,
sem criar `/skills/run`, sem falsa capacidade.

### Resultado

✅ **PASSOU — 202/202 PR52 prova. Total com regressões: 1.290/1.290.**

Skill Router read-only validado formalmente. 4 skills documentais roteadas corretamente
(CONTRACT_LOOP_OPERATOR, DEPLOY_GOVERNANCE_OPERATOR, SYSTEM_MAPPER, CONTRACT_AUDITOR).
Campo `skill_routing` validado (shape canônico). Falsa capacidade bloqueada. /skills/run
inexistente confirmado. Nenhuma skill executada. Nenhum endpoint criado.

### Arquivos novos

- `tests/pr52-skill-routing-runtime.prova.test.js` — 202 asserts (12 cenários A–L)
- `schema/reports/PR52_PROVA_ROTEAMENTO_SKILLS.md` — relatório completo

### Arquivos modificados

- `schema/contracts/INDEX.md` — próxima PR: PR53
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Arquivos NÃO alterados (confirmado por `git diff --name-only`)

- `schema/enavia-skill-router.js` ✅
- `schema/enavia-intent-classifier.js` ✅
- `nv-enavia.js` ✅
- `schema/enavia-cognitive-runtime.js` ✅
- `schema/enavia-llm-core.js` ✅
- `schema/enavia-brain-loader.js` ✅
- painel ✅ | executor ✅ | deploy worker ✅ | workflows ✅
- `wrangler.toml` ✅ | `wrangler.executor.template.toml` ✅
- KV/bindings/secrets ✅ | sanitizers ✅ | gates ✅

### Smoke tests

- `node --check schema/enavia-skill-router.js` → ✅
- `node --check tests/pr52-skill-routing-runtime.prova.test.js` → ✅
- `node tests/pr52-skill-routing-runtime.prova.test.js` → ✅ **202/202**

### Regressões

| Teste | Resultado |
|-------|-----------|
| `tests/pr51-skill-router-readonly.smoke.test.js` | **168/168** ✅ |
| `tests/pr50-intent-runtime.prova.test.js` | **124/124** ✅ |
| `tests/pr49-intent-classifier.smoke.test.js` | **96/96** ✅ |
| `tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` | **20/20** ✅ |
| `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` | **79/79** ✅ |
| `tests/pr46-llm-core-v1.smoke.test.js` | **43/43** ✅ |
| `tests/pr44-brain-loader-chat-runtime.prova.test.js` | **38/38** ✅ |
| `tests/pr43-brain-loader-readonly.smoke.test.js` | **32/32** ✅ |
| `tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | **56/56** ✅ |
| `tests/pr36-chat-runtime-anti-bot.smoke.test.js` | **26/26** ✅ |
| `tests/pr21-loop-status-states.smoke.test.js` | **53/53** ✅ |
| `tests/pr20-loop-status-in-progress.smoke.test.js` | **27/27** ✅ |
| `tests/pr19-advance-phase-e2e.smoke.test.js` | **52/52** ✅ |
| `tests/pr14-executor-deploy-real-loop.smoke.test.js` | **183/183** ✅ |
| `tests/pr13-hardening-operacional.smoke.test.js` | **91/91** ✅ |
| **Total geral (incluindo PR52)** | **1.290/1.290** ✅ |

---



- **Branch:** `copilot/claudepr51-impl-skill-router-readonly`
- **Tipo:** `PR-IMPL` (Worker-only, cirúrgica)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR50 ✅ (PR-PROVA — 821/821)
- **Escopo:** Implementação do Skill Router read-only v1.

### Objetivo

Implementar o Skill Router read-only da Enavia, ligando o Classificador de Intenção (PR49)
às skills documentais existentes. O router seleciona qual skill documental usar como
referência para uma mensagem, sem executar nada e sem criar endpoint.

### Resultado

✅ **PASSOU — 168/168 PR51 smoke. Regressões 920/920 ✅. Total: 1.088/1.088.**

Skill Router read-only v1 criado. 4 skills documentais mapeadas. Roteamento correto
para CONTRACT_LOOP_OPERATOR, DEPLOY_GOVERNANCE_OPERATOR, SYSTEM_MAPPER e CONTRACT_AUDITOR.
Integração com Intent Classifier validada. Campo aditivo `skill_routing` no `/chat/run`.
Skill Executor não implementado. /skills/run não existe. Nenhuma skill executada.

### Arquivos novos

- `schema/enavia-skill-router.js` — Skill Router v1 (`routeEnaviaSkill`, 4 skills)
- `tests/pr51-skill-router-readonly.smoke.test.js` — 168 asserts (10 cenários A–J)
- `schema/reports/PR51_IMPL_SKILL_ROUTER_READONLY.md` — relatório completo

### Arquivos modificados

- `nv-enavia.js` — import `routeEnaviaSkill` + campo `skill_routing` aditivo no response
- `schema/contracts/INDEX.md` — próxima PR: PR52
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Arquivos NÃO alterados (confirmado por `git diff --name-only`)

- `schema/enavia-brain-loader.js` ✅
- `schema/enavia-cognitive-runtime.js` ✅
- `schema/enavia-llm-core.js` ✅
- `schema/enavia-intent-classifier.js` ✅
- painel ✅ | executor ✅ | deploy worker ✅ | workflows ✅
- `wrangler.toml` ✅ | `wrangler.executor.template.toml` ✅
- KV/bindings/secrets ✅ | sanitizers ✅ | gates ✅

### Smoke tests

- `node --check schema/enavia-skill-router.js` → ✅
- `node --check tests/pr51-skill-router-readonly.smoke.test.js` → ✅
- `node --check nv-enavia.js` → ✅
- `node tests/pr51-skill-router-readonly.smoke.test.js` → ✅ **168/168**

### Regressões

- PR50: 124/124 ✅
- PR49: 96/96 ✅
- PR48: 20/20 ✅
- PR47: 79/79 ✅
- PR46: 43/43 ✅
- PR44: 38/38 ✅
- PR43: 32/32 ✅
- PR37: 56/56 ✅
- PR36: 26/26 ✅
- PR21: 53/53 ✅
- PR20: 27/27 ✅
- PR19: 52/52 ✅
- PR14: 183/183 ✅
- PR13: 91/91 ✅
- **Total regressões: 920/920 ✅**
- **Total geral: 1.088/1.088 ✅**

### Próxima PR autorizada

**PR52 — PR-PROVA — Teste de roteamento de skills**

---

## 2026-05-01 — PR50 — PR-PROVA — Teste de intenção

- **Branch:** `copilot/claudepr50-prova-teste-intencao`
- **Tipo:** `PR-PROVA` (Worker-only, prova pura)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR49 ✅ (PR-IMPL — Classificador de Intenção v1)
- **Escopo:** Prova formal do Classificador de Intenção v1 no fluxo real do chat/prompt.

### Objetivo

Provar que o Classificador de Intenção v1 (PR49) funciona corretamente no fluxo real do
chat/prompt, preservando anti-bot, LLM Core, Brain Context, gates e comportamento operacional.
Nenhum runtime alterado.

### Resultado

✅ **PASSOU — 124/124 asserts PR50. Regressões 697/697 ✅. Total: 821/821.**

Todos os 13 cenários (A–M) passaram. Classificador de Intenção v1 validado formalmente.
Conversa/frustração não operacional. Próxima PR não operacional. PR review/diagnóstico/deploy
operacionais. Contrato conceitual sem falso positivo. Skill Router runtime inexistente
confirmado. Memória sem escrita. Estratégia não operacional pesada. Regressões PR37/PR38
preservadas. Campo `intent_classification` validado por inspeção + unitário.
Nenhum runtime alterado. Próxima PR: **PR51 — PR-IMPL — Skill Router read-only**.
Relatório: `schema/reports/PR50_PROVA_TESTE_INTENCAO.md`.

### Arquivos novos

- `tests/pr50-intent-runtime.prova.test.js` — 124 asserts (13 cenários A–M)
- `schema/reports/PR50_PROVA_TESTE_INTENCAO.md` — relatório completo

### Arquivos NÃO alterados (confirmado por `git diff --name-only`)

- `schema/enavia-intent-classifier.js` ✅
- `nv-enavia.js` ✅
- `schema/enavia-cognitive-runtime.js` ✅
- `schema/enavia-llm-core.js` ✅
- `schema/enavia-brain-loader.js` ✅

### Smoke tests

- `node --check schema/enavia-intent-classifier.js` → ✅
- `node --check tests/pr50-intent-runtime.prova.test.js` → ✅
- `node tests/pr50-intent-runtime.prova.test.js` → ✅ 124/124

### Regressões

| Teste | Resultado |
|-------|-----------|
| PR49 smoke | ✅ 96/96 |
| PR48 smoke | ✅ 20/20 |
| PR47 prova | ✅ 79/79 |
| PR46 smoke | ✅ 43/43 |
| PR44 prova | ✅ 38/38 |
| PR43 smoke | ✅ 32/32 |
| PR37 prova | ✅ 56/56 |
| PR36 smoke | ✅ 26/26 |
| PR21 smoke | ✅ 53/53 |
| PR20 smoke | ✅ 27/27 |
| PR19 E2E | ✅ 52/52 |
| PR14 smoke | ✅ 183/183 |
| PR13 smoke | ✅ 91/91 |

---

## 2026-05-01 — PR49 — PR-IMPL — Classificador de Intenção v1

- **Branch:** `copilot/claudepr49-impl-classificador-intencao`
- **Tipo:** `PR-IMPL` (Worker-only, cirúrgica)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR48 ✅ (PR-IMPL cirúrgica — PR47 79/79 após correção)
- **Escopo:** Classificador de Intenção v1. Worker-only.

### Objetivo

Implementar o Classificador de Intenção v1 para separar, de forma determinística e segura,
os principais tipos de mensagem antes de aplicar tom operacional, planner, skill futura
ou resposta conversacional. Retorno ao contrato principal após exceção corretiva PR48.

### Resultado

✅ **PASSOU — 96/96 asserts PR49. Regressões 601/601 ✅. Total: 697/697.**

Classificador de Intenção v1 criado. 15 intenções canônicas implementadas.
Frustração não ativa operação. Próxima PR não ativa operação pesada. Revisão de PR ativa
operação. Diagnóstico técnico ativa operação. Deploy/execução ativa operação com
governança. Falsos positivos PR37/PR38 continuam corrigidos. LLM Core/Brain/anti-bot
preservados. Smoke PR49 96/96 ✅. Regressões 601/601 ✅.
Próxima PR: **PR50 — PR-PROVA — Teste de intenção**.
Relatório: `schema/reports/PR49_IMPL_CLASSIFICADOR_INTENCAO.md`.

### Arquivos novos

- `schema/enavia-intent-classifier.js` — Classificador de Intenção v1
- `tests/pr49-intent-classifier.smoke.test.js` — 96 asserts (14 cenários)
- `schema/reports/PR49_IMPL_CLASSIFICADOR_INTENCAO.md` — relatório completo

### Arquivos modificados

- `nv-enavia.js` — import + isOperationalMessage delegando ao classificador + intent_classification aditivo no response
- `schema/contracts/INDEX.md` — próxima PR: PR50
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Arquivos NÃO alterados

`schema/enavia-intent-classifier.js` (criado do zero — sem alterar existente),
`schema/enavia-brain-loader.js`, `schema/enavia-cognitive-runtime.js`,
`schema/enavia-llm-core.js`, painel, executor, deploy worker, workflows,
`wrangler.toml`, KV/bindings/secrets, sanitizers, gates. Nenhum endpoint criado.

### Testes executados

- `node --check schema/enavia-intent-classifier.js` ✅
- `node --check tests/pr49-intent-classifier.smoke.test.js` ✅
- PR49 smoke: **96/96** ✅
- PR48 smoke: **20/20** ✅
- PR47 prova: **79/79** ✅
- PR46 smoke: **43/43** ✅
- PR44 prova: 38/38 ✅
- PR43 smoke: 32/32 ✅
- PR37 smoke: 56/56 ✅
- PR36 smoke: 26/26 ✅
- PR21 smoke: 53/53 ✅
- PR20 smoke: 27/27 ✅
- PR19 smoke: 52/52 ✅
- PR14 smoke: 183/183 ✅
- PR13 smoke: 91/91 ✅
- **Total: 697/697** ✅

---

## 2026-05-01 — PR48 — PR-IMPL — Correção Cirúrgica do LLM Core v1

- **Branch:** `copilot/claudepr48-impl-correcao-cirurgica-llm-core-v1`
- **Tipo:** `PR-IMPL` (Worker-only, patch cirúrgico)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR47 ✅ (mergeada — PR #208, falha parcial 75/79 documentada)
- **Escopo:** correção das 4 regras tonais truncadas pelo Brain Loader. Worker-only.

### Objetivo

Corrigir os 4 achados da PR47 (C1, C2, D1, D2) sem abrir nova frente. Mover
regras críticas de how-to-answer para o LLM Core, que sempre entra no prompt.

### Resultado

✅ **PASSOU — 79/79 asserts PR47 após correção.**

4 achados corrigidos: "excesso documental", "Isso é opcional. Não mexa agora.",
"resposta curta + prompt completo", "sem reabrir discussão" — todos no LLM Core.
Brain Loader não alterado. Limite 4.000 chars preservado. Exceção corretiva
encerrada. Próxima PR: **PR49 — PR-IMPL — Classificador de intenção**.
Relatório: `schema/reports/PR48_IMPL_CORRECAO_CIRURGICA_LLM_CORE_V1.md`.

### Achados corrigidos (C1, C2, D1, D2)

- **C1:** "excesso documental" → adicionado ao LLM Core ✅
- **C2:** "Isso é opcional. Não mexa agora." → adicionado ao LLM Core ✅
- **D1:** "resposta curta + prompt completo" → adicionado ao LLM Core ✅
- **D2:** "sem reabrir discussão" → adicionado ao LLM Core ✅

### Arquivos novos

- `tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` — 20 asserts
- `schema/reports/PR48_IMPL_CORRECAO_CIRURGICA_LLM_CORE_V1.md` — relatório completo

### Arquivos modificados

- `schema/enavia-llm-core.js` — seção COMPORTAMENTO OPERACIONAL adicionada ao `buildLLMCoreBlock()`
- `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` — [ACHADO PR47] removidos; tolerâncias atualizadas
- `tests/pr46-llm-core-v1.smoke.test.js` — tolerâncias de tamanho atualizadas
- `schema/contracts/INDEX.md` — próxima PR: PR49
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Arquivos NÃO alterados

`schema/enavia-brain-loader.js` (não alterado — limite preservado),
`schema/enavia-cognitive-runtime.js`, `nv-enavia.js`, painel, executor,
deploy worker, workflows, `wrangler.toml`, KV/bindings/secrets, sanitizers,
gates, endpoints. Nenhum runtime de produção tocado.

### Testes executados

- `node --check schema/enavia-llm-core.js` ✅
- `node --check tests/pr47-resposta-viva-llm-core-v1.prova.test.js` ✅
- `node --check tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` ✅
- PR48 smoke: **20/20** ✅
- PR47 prova: **79/79** ✅ (era 75/79)
- PR46 smoke: **43/43** ✅
- PR44 prova: 38/38 ✅
- PR43 smoke: 32/32 ✅
- PR37 smoke: 56/56 ✅
- PR36 smoke: 26/26 ✅
- PR21 smoke: 53/53 ✅
- PR20 smoke: 27/27 ✅
- PR19 smoke: 52/52 ✅
- PR14 smoke: 183/183 ✅
- PR13 smoke: 91/91 ✅
- **Total regressões: 601/601** ✅

---



- **Branch:** `copilot/claudepr47-prova-resposta-viva-llm-core-v1`
- **Tipo:** `PR-PROVA` (sem alteração de runtime)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR46 ✅ (mergeada — PR #207)
- **Escopo:** prova pura. Não chama LLM externo. Testa o prompt, regras, blocos
  e simulação determinística da resposta esperada.

### Objetivo

Provar que o LLM Core v1 (PR46) preserva ou melhora a qualidade da resposta da
Enavia, sem voltar ao comportamento robótico, sem criar falsa capacidade, sem
quebrar anti-bot, sem relaxar governança.

### Resultado

⚠️ **FALHOU PARCIALMENTE — 75/79 asserts (94,9%).** 8 de 10 cenários passaram
totalmente. Cenários C (frustração) e D (próxima PR) falharam parcialmente —
4 achados reais com causa raiz única (truncamento do Brain Loader em 4.000
chars). Conforme contrato PR47, próxima PR vira cirúrgica (PR48 — PR-IMPL —
Correção cirúrgica do LLM Core v1, NÃO o Classificador de intenção).
Relatório: `schema/reports/PR47_PROVA_RESPOSTA_VIVA_LLM_CORE_V1.md`.

### Arquivos novos

- `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` — 10 cenários A–J, 79 asserts
- `schema/reports/PR47_PROVA_RESPOSTA_VIVA_LLM_CORE_V1.md` — relatório completo

### Arquivos modificados

- `schema/contracts/INDEX.md` — próxima PR autorizada virou PR48 cirúrgica
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Arquivos NÃO alterados

`nv-enavia.js`, `schema/enavia-llm-core.js`, `schema/enavia-cognitive-runtime.js`,
`schema/enavia-brain-loader.js`, painel, executor, deploy worker, workflows,
`wrangler.toml`, `wrangler.executor.template.toml`, KV/bindings/secrets,
sanitizers, prompt real, gates, endpoints. Nenhum runtime tocado.

### Achados reais (4)

| ID | Cenário | Achado | Causa raiz |
|----|---------|--------|-----------|
| C1 | Frustração | "excesso documental" ausente do prompt em runtime | Brain truncado |
| C2 | Frustração | "Isso é opcional. Não mexa agora." ausente do prompt em runtime | Brain truncado |
| D1 | Próxima PR | "resposta curta + prompt completo" ausente do prompt em runtime | Brain truncado |
| D2 | Próxima PR | "sem reabrir discussão" ausente do prompt em runtime | Brain truncado |

Causa raiz única: o snapshot estático do `schema/enavia-brain-loader.js`
satura o limite total de 4.000 chars logo após a regra 4 de
`schema/brain/self-model/how-to-answer.md`. Regras 5–10 não chegam ao
runtime. Verificado via `getEnaviaBrainContext()` terminando em
`[brain-context-truncated]`.

### Cenários que passaram totalmente

- A (Identidade viva) 12/12 — Enavia, IA operacional estratégica, LLM-first,
  não é Enova/NV/atendente.
- B (Capacidade) 11/11 — Skill Router runtime / `/skills/run` / Intent Engine
  declarados como ainda NÃO existentes; Brain Loader READ-ONLY.
- E (Operacional real) 7/7 — `MODO OPERACIONAL ATIVO` injetado para
  `is_operational_context=true`, contrato + aprovação preservados.
- F (Falsa capacidade bloqueada) 5/5.
- G (`read_only` como gate) 7/7 — não impede raciocínio nem deixa defensiva.
- H (Tamanho/duplicação) 14/14 — A=10.496 (-449), B=10.738 (-449), E=12.363
  (-449), F=12.435 (-1.254) chars vs PR45 baseline. "NV Imóveis" 9→3.
- I (Envelope JSON) 5/5 — `{reply, use_planner}` literal preservado.
- J (Sanitizers/gates) 7/7 — `isOperationalMessage` exportado, falsos
  positivos PR37 corrigidos seguem corrigidos, Brain determinístico.

### Smoke / regressões

- `node --check schema/enavia-llm-core.js` ✅
- `node --check schema/enavia-cognitive-runtime.js` ✅
- `node --check schema/enavia-brain-loader.js` ✅
- `node --check tests/pr47-resposta-viva-llm-core-v1.prova.test.js` ✅
- PR47 prova: **75/79** (4 achados documentados)
- PR46 smoke: **43/43** ✅
- PR44 prova: **38/38** ✅
- PR43 smoke: **32/32** ✅
- PR37 prova: **56/56** ✅
- PR36 smoke: **26/26** ✅
- PR21 smoke: **53/53** ✅
- PR20 smoke: **27/27** ✅
- PR19 smoke: **52/52** ✅
- PR14 smoke: **183/183** ✅
- PR13 smoke: **91/91** ✅
- **Regressões obrigatórias: 601/601 ✅**

### Próxima PR

**PR48 — PR-IMPL — Correção cirúrgica do LLM Core v1 (regras tonais
truncadas).** Levar regras 6, 7, 8 de `how-to-answer.md` para o LLM Core
(ou bloco compacto adjacente). Worker-only, patch cirúrgico. NÃO é o
Classificador de intenção (esse vira PR49 após cirúrgica + nova prova
verde).

### Rollback

Reverter `tests/pr47-resposta-viva-llm-core-v1.prova.test.js`,
`schema/reports/PR47_PROVA_RESPOSTA_VIVA_LLM_CORE_V1.md` e ajustes em
`schema/contracts/INDEX.md`, `schema/status/ENAVIA_STATUS_ATUAL.md`,
`schema/handoffs/ENAVIA_LATEST_HANDOFF.md` e este log. Nenhum runtime para
reverter — nada foi alterado.

---

## 2026-05-01 — PR46 — PR-IMPL — LLM Core v1: consolidar identidade, Brain Context e política de resposta

- **Branch:** `copilot/claudepr46-impl-llm-core-v1`
- **Tipo:** `PR-IMPL` (Worker-only, patch cirúrgico)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR45 ✅ (PR-DIAG — relatório `schema/reports/PR45_PROMPT_CHAT_POS_BRAIN_DIAGNOSTICO.md`)
- **Escopo:** Worker-only. Patch cirúrgico. Consolidação de seções redundantes no LLM Core v1.

### Objetivo

Consolidar identidade, capacidades, política de resposta e relação com o Brain Context
em uma camada central do prompt do chat (LLM Core v1), reduzindo redundância sem perder
segurança, anti-bot, governança ou envelope JSON.

### Resultado

✅ CONCLUÍDO. Relatório: `schema/reports/PR46_IMPL_LLM_CORE_V1.md`.

### Arquivos novos
- `schema/enavia-llm-core.js` — `buildLLMCoreBlock()` + `getLLMCoreMetadata()` (pure function determinística, sem I/O).
- `tests/pr46-llm-core-v1.smoke.test.js` — smoke test (cenários A–G, 43 asserts).
- `schema/reports/PR46_IMPL_LLM_CORE_V1.md` — relatório completo.

### Arquivos modificados
- `schema/enavia-cognitive-runtime.js` — antigas seções 1, 1b, 2, 3, 4 substituídas por chamada única ao `buildLLMCoreBlock({ ownerName })`. Demais seções (Brain Context, target, MODO OPERACIONAL condicional, planner, memória, envelope JSON) inalteradas.

### Arquivos NÃO alterados
`nv-enavia.js`, `schema/enavia-brain-loader.js` (snapshot principal preservado por escopo),
`schema/enavia-identity.js`, `schema/enavia-capabilities.js`, `schema/enavia-constitution.js`,
`schema/operational-awareness.js`, painel, executor, deploy worker, workflows,
`wrangler.toml`, `wrangler.executor.template.toml`, KV/bindings/secrets, sanitizers.

### Medição (todos os 6 cenários da PR45)

| Cenário | PR45 baseline | PR46 atual | Δ chars | Δ tokens |
|---------|--------------:|-----------:|--------:|---------:|
| A — simples sem target | 10.945 | 10.496 | -449 | -112 |
| B — simples target read_only | 11.187 | 10.738 | -449 | -112 |
| C — identidade | 10.945 | 10.496 | -449 | -112 |
| D — capacidade | 10.945 | 10.496 | -449 | -112 |
| E — operacional real | 12.812 | 12.363 | -449 | -112 |
| F — operacional completo + awareness | 13.689 | 13.240 | -449 | -112 |

**Economia: -4,1% por conversa, constante. "NV Imóveis" 9 → 3 ocorrências.**

### Testes
- Sintaxe (`node --check`): OK em `enavia-llm-core.js`, `enavia-cognitive-runtime.js`, `enavia-brain-loader.js`, `pr46-llm-core-v1.smoke.test.js`.
- Smoke PR46: **43/43 ✅**
- Regressões PR44 (38/38), PR43 (32/32), PR37 (56/56), PR36 (26/26), PR21 (53/53), PR20 (27/27), PR19 (52/52), PR14 (183/183), PR13 (91/91) → **558/558 ✅**
- **TOTAL geral: 601/601 ✅**

### Próxima etapa
**PR47 — PR-PROVA — Teste de resposta viva com LLM Core v1**

---

## 2026-05-01 — PR45 — PR-DIAG — Diagnóstico do prompt atual do chat pós-Brain Loader

- **Branch:** `copilot/claudepr45-diag-prompt-atual-chat-pos-brain`
- **Tipo:** `PR-DIAG` (READ-ONLY, Worker-only)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR44 ✅ (PR-PROVA — relatório `schema/reports/PR44_PROVA_BRAIN_LOADER_CHAT_RUNTIME.md`)
- **Escopo:** READ-ONLY. Diagnóstico puro. Nenhum runtime alterado.

### Objetivo

Diagnosticar o estado atual do system prompt completo pós-Brain Loader. Medir tamanho
por cenário, mapear blocos em ordem real, identificar redundâncias e conflitos, avaliar
risco de engessamento, recomendar PR46.

### Resultado

✅ CONCLUÍDO — Diagnóstico completo. Relatório: `schema/reports/PR45_PROMPT_CHAT_POS_BRAIN_DIAGNOSTICO.md`.

### Medições executadas

| Cenário | Chars | Tokens est. |
|---------|------:|:-----------:|
| A — simples sem target | 10.945 | ~2.736 |
| B — simples com target read_only | 11.205 | ~2.801 |
| E — operacional (is_op=true) | 12.840 | ~3.210 |
| F — operacional completo + awareness | 13.743 | ~3.436 |
| Brain Context isolado | 4.002 | ~1.001 |
| Baseline sem Brain Context | 6.943 | ~1.736 |

### Principais achados

- Brain Context adiciona +4.002 chars / +1.000 tokens a **toda** conversa (constante).
- Principal redundância (problemática): capacidades/limitações duplicadas entre seções 1-4 e Brain blocks 1-3.
- Brain NÃO engessou — reforça `inteligência antes de checklist`, `read_only é gate`, naturalidade.
- Seção 1b (PAPEL PROIBIDO) volumosa (~286 tokens) — candidata à redução na PR46.
- Conflito latente: duas listas de capacidades com wording diferente (C3).
- Nenhum bloqueio real para PR46.

### Arquivos criados/alterados

- `schema/reports/PR45_PROMPT_CHAT_POS_BRAIN_DIAGNOSTICO.md` (NOVO)
- `schema/contracts/INDEX.md` (EDIT — PR45 marcada ✅, próxima PR46)
- `schema/status/ENAVIA_STATUS_ATUAL.md` (EDIT — estado pós-PR45)
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (EDIT — handoff PR45→PR46)
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Próxima PR autorizada

`PR46 — PR-IMPL — LLM Core v1: consolidar identidade, Brain Context e política de resposta`

---

## 2026-05-01 — PR44 — PR-PROVA — Prova Brain Loader read-only no chat runtime

- **Branch:** `copilot/claudepr44-prova-brain-loader-chat-runtime`
- **Tipo:** `PR-PROVA` (Worker-only, sem alteração de runtime)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR43 ✅ (PR-IMPL — relatório `schema/reports/PR43_IMPL_BRAIN_LOADER_READONLY.md`)
- **Escopo:** Worker-only. Criação de teste de prova + relatório + governança. Nenhum runtime alterado.

### Objetivo

Provar que o Brain Loader read-only (PR43) influencia o chat runtime da Enavia
de forma segura, validando identidade, ausência de capacidade falsa, anti-bot
preservado e não ativação indevida de tom operacional.

### Resultado

✅ PASSOU — Brain Loader read-only validado. 38/38 asserts. Regressões 520/520.

### Testes executados

| Teste | Resultado |
|-------|-----------|
| `node --check schema/enavia-brain-loader.js` | ✅ |
| `node --check schema/enavia-cognitive-runtime.js` | ✅ |
| `node --check tests/pr44-brain-loader-chat-runtime.prova.test.js` | ✅ |
| `node tests/pr44-brain-loader-chat-runtime.prova.test.js` | **38/38 ✅** |
| `node tests/pr43-brain-loader-readonly.smoke.test.js` | **32/32 ✅** |
| `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | **56/56 ✅** |
| `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` | **26/26 ✅** |
| `node tests/pr21-loop-status-states.smoke.test.js` | **53/53 ✅** |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` | **27/27 ✅** |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` | **52/52 ✅** |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` | **183/183 ✅** |
| `node tests/pr13-hardening-operacional.smoke.test.js` | **91/91 ✅** |
| **Total geral** | **558/558 ✅** |

### Arquivos criados/alterados

- `tests/pr44-brain-loader-chat-runtime.prova.test.js` (NOVO)
- `schema/reports/PR44_PROVA_BRAIN_LOADER_CHAT_RUNTIME.md` (NOVO)
- `schema/contracts/INDEX.md` (EDIT — PR44 marcada ✅, próxima PR45)
- `schema/status/ENAVIA_STATUS_ATUAL.md` (EDIT — estado pós-PR44)
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (EDIT — handoff PR44→PR45)
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Arquivos NÃO alterados

`schema/enavia-brain-loader.js`, `schema/enavia-cognitive-runtime.js`,
`nv-enavia.js`, painel, executor, deploy worker, workflows, wrangler,
KVs, bindings, secrets.

---

## 2026-04-30 — PR43 — PR-IMPL — Brain Loader read-only Worker-only

- **Branch:** `copilot/claudepr43-impl-brain-loader-readonly-worker`
- **Tipo:** `PR-IMPL` (Worker-only, cirúrgica)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR42 ✅ (PR-DIAG — relatório `schema/reports/PR42_MEMORY_RUNTIME_DIAGNOSTICO.md`)
- **Escopo:** Worker-only. Loader + integração no cognitive runtime + smoke test + relatório + governança.

### Objetivo

Implementar o primeiro Brain Loader read-only conectando uma allowlist
pequena do Obsidian Brain ao contexto do chat (`buildChatSystemPrompt`),
sem escrita, sem painel, sem endpoint novo, sem alteração de infraestrutura.

### Resultado

✅ Brain Loader implementado, integrado e provado por smoke test.

### Implementação

- **Loader:** `schema/enavia-brain-loader.js` (novo).
  - `getEnaviaBrainContext(options)` — função pura, determinística, sem FS/KV/rede.
  - `getEnaviaBrainAllowlist()` — auditoria das fontes do snapshot.
  - Constantes: `BRAIN_CONTEXT_TOTAL_LIMIT=4000`, `BRAIN_CONTEXT_PER_BLOCK_LIMIT=1500`, `BRAIN_CONTEXT_TRUNCATION_MARK="[brain-context-truncated]"`.
  - Snapshot estático embutido com 7 blocos (resumo manual fiel das fontes).
- **Allowlist (hard-coded no loader):**
  1. `schema/brain/self-model/identity.md`
  2. `schema/brain/self-model/capabilities.md`
  3. `schema/brain/self-model/limitations.md`
  4. `schema/brain/self-model/current-state.md`
  5. `schema/brain/self-model/how-to-answer.md`
  6. `schema/brain/SYSTEM_AWARENESS.md`
  7. `schema/brain/memories/INDEX.md` (excerto)
- **Integração:** `schema/enavia-cognitive-runtime.js` (edit).
  - Import de `getEnaviaBrainContext`.
  - Nova seção `7c` em `buildChatSystemPrompt` — `CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY` —, posicionada após o bloco de uso/criação de memória (7b) e antes do envelope JSON (8).
  - Flag interna `include_brain_context` (default true). **Sem env var nova.**
- **Segurança:**
  - Read-only, determinístico, sem rede, sem FS, sem KV.
  - Cabeçalho do bloco deixa explícito que é documental, **não autoriza execução** e **não é estado runtime**.
  - Não substitui `MODO OPERACIONAL ATIVO` nem nota factual de `read_only`.
  - Não altera sanitizers.

### Arquivos alterados

- `schema/enavia-brain-loader.js` (NOVO)
- `schema/enavia-cognitive-runtime.js` (EDIT — import + seção 7c)
- `tests/pr43-brain-loader-readonly.smoke.test.js` (NOVO)
- `schema/reports/PR43_IMPL_BRAIN_LOADER_READONLY.md` (NOVO)
- `schema/contracts/INDEX.md` (EDIT — próxima PR autorizada e PR43 marcada)
- `schema/status/ENAVIA_STATUS_ATUAL.md` (EDIT — estado pós-PR43)
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (EDIT — handoff PR43→PR44)
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

**NÃO alterados:** `nv-enavia.js`, `wrangler.toml`, `wrangler.executor.template.toml`, painel, executor, deploy worker, workflows, secrets, bindings, KVs.

### Smoke tests

```
node --check nv-enavia.js                                  ✅
node --check schema/enavia-cognitive-runtime.js            ✅
node --check schema/enavia-brain-loader.js                 ✅
node --check tests/pr43-brain-loader-readonly.smoke.test.js ✅
node tests/pr43-brain-loader-readonly.smoke.test.js        ✅ 32/32
```

### Regressões

```
node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js   ✅ 56/56
node tests/pr36-chat-runtime-anti-bot.smoke.test.js        ✅ 26/26
node tests/pr21-loop-status-states.smoke.test.js           ✅ 53/53
node tests/pr20-loop-status-in-progress.smoke.test.js      ✅ 27/27
node tests/pr19-advance-phase-e2e.smoke.test.js            ✅ 52/52
node tests/pr14-executor-deploy-real-loop.smoke.test.js    ✅ 183/183
node tests/pr13-hardening-operacional.smoke.test.js        ✅ 91/91
```

Total agregado: **520/520 verdes**.

### Bloqueios

- Nenhum.

### Observação

Os arquivos `schema/brain/memories/operator-preferences.md`,
`operating-style.md`, `project-principles.md`, `hard-rules.md` e
`recurring-patterns.md` mencionados no enunciado da PR ainda não existem
no repo (apenas `INDEX.md` em `memories/`, criado na PR39). O snapshot
do loader incluiu um excerto rastreável desse INDEX. Quando os arquivos
forem populados em PRs futuras, podem ser adicionados ao snapshot dentro
do mesmo limite total.

### Próxima PR autorizada

**PR44 — PR-PROVA — Provar Brain Loader read-only no chat runtime**
(se algum cenário falhar em runtime real, abrir como `PR-IMPL — Corrigir
falhas do Brain Loader read-only`).

---

## 2026-04-30 — PR42 — PR-DIAG — Diagnóstico da Memória Atual no Runtime

- **Branch:** `copilot/claudepr42-diag-memoria-runtime-brain`
- **Tipo:** `PR-DIAG` (read-only, nenhum runtime alterado)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR41 ✅ (PR-DOCS — mergeada como PR #202 — relatório: `schema/reports/PR41_POPULAR_OBSIDIAN_BRAIN_REPORT.md`)
- **Escopo:** Docs-only. Diagnóstico de memória runtime + relatório + governança.

### Objetivo

Diagnosticar como a memória atual funciona no runtime. Mapear bindings KV,
chaves/shapes, fluxo de chat, participação do painel, relação com Brain documental
e preparar recomendação técnica para PR43 Brain Loader.

### Resultado

✅ Diagnóstico completo — 13 seções mapeadas com evidência de código real.

### Principais achados

1. `ENAVIA_BRAIN` EXISTE com ID real em wrangler.toml (PROD + TEST)
2. `DEPLOY_KV` e `PROOF_KV` não existem no repo
3. `ENAVIA_GIT` e `GIT_KV` existem apenas no executor template (não no worker principal)
4. KV ENAVIA_BRAIN é multipropósito — todos os namespaces em um único KV
5. Fluxo legado (POST /): buildBrain carrega brain:index + brain:train:* no boot
6. Fluxo LLM-first (POST /chat/run): pipeline PM2-PM9, retrieval por PM3
7. Painel envia context.target — sem botão "Salvar na memória" no chat
8. Brain documental NÃO está conectado ao runtime
9. Brain Loader via bundle estático é viável para PR43
10. Brain Loader via bundle estático é viável para PR43

### Arquivos criados

- `schema/reports/PR42_MEMORY_RUNTIME_DIAGNOSTICO.md`

### Arquivos atualizados

- `schema/contracts/INDEX.md`
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Verificações

| Verificação | Resultado |
|-------------|-----------|
| `git diff --name-only` — nenhum `.js`, `.ts`, `.toml`, `.yml` alterado | ✅ |
| `schema/reports/PR42_MEMORY_RUNTIME_DIAGNOSTICO.md` criado | ✅ |
| Relatório menciona `ENAVIA_BRAIN` explicitamente | ✅ (Seção 3.1) |
| Relatório mapeia painel apenas como leitura | ✅ (Seção 6) |
| Relatório recomenda PR43 com base em evidência | ✅ (Seção 11) |
| Governança atualizada | ✅ |
| Nenhum runtime alterado | ✅ |

### Próxima PR

**PR43 — PR-IMPL — Brain Loader read-only Worker-only**

---

## 2026-04-30 — PR40 — PR-DOCS — Self Model da Enavia

- **Branch:** `copilot/claude-pr40-docs-self-model-enavia`
- **Tipo:** `PR-DOCS` (Docs-only, nenhum runtime alterado)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR39 ✅ (PR-DOCS — Obsidian Brain Architecture)
- **Escopo:** Docs-only. Criação do self-model em `schema/brain/self-model/` + relatório + governança.

### Objetivo

Criar o self-model documental da Enavia. Definir identidade, capacidades (atuais vs. futuras),
limitações, estado atual e forma de resposta. Base de identidade para Brain Loader, LLM Core,
Intent Engine e Skill Router (frentes futuras).

### Resultado

✅ Self-model criado — 5 arquivos obrigatórios + INDEX.md atualizado.

### Arquivos criados

- `schema/brain/self-model/identity.md`
- `schema/brain/self-model/capabilities.md`
- `schema/brain/self-model/limitations.md`
- `schema/brain/self-model/current-state.md`
- `schema/brain/self-model/how-to-answer.md`
- `schema/reports/PR40_SELF_MODEL_ENAVIA_REPORT.md`

### Arquivos atualizados

- `schema/brain/self-model/INDEX.md`
- `schema/contracts/INDEX.md`
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Verificações

| Verificação | Resultado |
|-------------|-----------|
| `git diff --name-only` — nenhum `.js/.ts/.toml/.yml` alterado | ✅ |
| 5 arquivos obrigatórios criados | ✅ |
| `identity.md` contém frase canônica | ✅ |
| `current-state.md` menciona PR38 56/56 e PR39 Brain Architecture | ✅ |
| `how-to-answer.md` contém regra sobre excesso documental | ✅ |
| `INDEX.md` lista os 5 arquivos | ✅ |
| Governança atualizada | ✅ |

### Próxima PR

**PR41 — PR-DOCS — Migrar conhecimento consolidado para Brain**

---

## 2026-04-30 — PR39 — PR-DOCS — Arquitetura do Obsidian Brain

- **Branch:** `copilot/claude-pr39-docs-arquitetura-obsidian-brain`
- **Tipo:** `PR-DOCS` (Docs-only, nenhum runtime alterado)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR38 ✅ (PR-IMPL — 56/56 anti-bot, frente 2 corretiva encerrada)
- **Escopo:** Docs-only. Criação da estrutura `schema/brain/` + relatório + governança.

### Objetivo

Criar a estrutura documental completa do Obsidian Brain da Enavia, conforme contrato
Jarvis Brain. Esqueleto do brain com regras, políticas, grafos e incidente documentado.

### Resultado

✅ Brain criado — estrutura documental completa.

### Arquivos criados

- `schema/brain/INDEX.md`
- `schema/brain/ARCHITECTURE.md`
- `schema/brain/GRAPH.md`
- `schema/brain/MEMORY_RULES.md`
- `schema/brain/RETRIEVAL_POLICY.md`
- `schema/brain/UPDATE_POLICY.md`
- `schema/brain/SYSTEM_AWARENESS.md`
- `schema/brain/maps/INDEX.md`
- `schema/brain/decisions/INDEX.md`
- `schema/brain/contracts/INDEX.md`
- `schema/brain/memories/INDEX.md`
- `schema/brain/incidents/INDEX.md`
- `schema/brain/learnings/INDEX.md`
- `schema/brain/open-questions/INDEX.md`
- `schema/brain/self-model/INDEX.md`
- `schema/brain/incidents/chat-engessado-readonly.md`
- `schema/reports/PR39_OBSIDIAN_BRAIN_ARCHITECTURE_REPORT.md`

### Testes

| Verificação | Resultado |
|-------------|-----------|
| `git diff --name-only` — nenhum `.js/.ts/.toml/.yml` alterado | ✅ |
| `schema/brain/INDEX.md` existe | ✅ |
| `schema/brain/ARCHITECTURE.md` existe | ✅ |
| `schema/brain/GRAPH.md` existe | ✅ |
| `schema/brain/MEMORY_RULES.md` existe | ✅ |
| `schema/brain/RETRIEVAL_POLICY.md` existe | ✅ |
| `schema/brain/UPDATE_POLICY.md` existe | ✅ |
| `schema/brain/SYSTEM_AWARENESS.md` existe | ✅ |
| Todos os INDEX de subpastas existem | ✅ |
| `schema/brain/incidents/chat-engessado-readonly.md` existe | ✅ |

### Rollback

```bash
git revert HEAD  # remove pasta schema/brain/ e atualizações de governança
```

### Próxima etapa segura

**PR40 — PR-DOCS — Self Model da Enavia**

---

## 2026-04-30 — PR38 — PR-IMPL — Correção cirúrgica dos achados PR37 anti-bot

- **Branch:** `copilot/claudepr38-impl-corrigir-achados-pr37-anti-bot`
- **Tipo:** `PR-IMPL` (worker-only, patch cirúrgico, runtime alterado)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR37 ✅ (PR-PROVA — 51/56, falha parcial documentada)
- **Escopo:** Worker-only. Patch cirúrgico em 2 arquivos de runtime + relatório + governança.

### Objetivo

Corrigir exclusivamente os 5 achados reais da PR37 (prova anti-bot parcialmente falha).

### Resultado

**56/56 — PASSOU** ✅ (era 51/56 na PR37)

Achados corrigidos:

1. **A2/B2**: `buildChatSystemPrompt` em `schema/enavia-cognitive-runtime.js` — separação
   cirúrgica entre target informativo e bloco comportamental operacional. `MODO OPERACIONAL
   ATIVO` só injetado quando `is_operational_context=true`. `hasActiveTarget` sozinho não
   ativa mais o bloco pesado.

2. **C1**: `"sistema"` removido de `_CHAT_OPERATIONAL_INTENT_TERMS` em `nv-enavia.js` —
   `isOperationalMessage("Você sabe operar seu sistema?")` agora retorna `false`.

3. **D1**: `"revise"`, `"verifique"`, `"cheque"`, `"inspecione"`, `"runtime"`, `"gate"`,
   `"gates"` adicionados — `isOperationalMessage("Revise a PR 197 e veja se o runtime
   quebrou algum gate")` agora retorna `true`.

4. **G5**: `"contrato"` isolado removido, substituído por `"estado do contrato"` e
   `"contrato ativo"` — `isOperationalMessage("explique o que é o contrato Jarvis Brain")`
   agora retorna `false`. Teste PR36 (`"estado do contrato"`) continua passando.

### Arquivos alterados (runtime)

- `schema/enavia-cognitive-runtime.js` (MODIFICADO — seção 5c)
- `nv-enavia.js` (MODIFICADO — `_CHAT_OPERATIONAL_INTENT_TERMS`)

### Arquivos criados/atualizados (relatório + governança)

- `schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md` (NOVO)
- `schema/contracts/INDEX.md` (atualizado — PR37 ✅, PR38 ✅, próxima PR39)
- `schema/status/ENAVIA_STATUS_ATUAL.md` (atualizado)
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (atualizado)
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)

### Testes

| Teste | Resultado |
|-------|-----------|
| `node --check nv-enavia.js` | ✅ OK |
| `node --check schema/enavia-cognitive-runtime.js` | ✅ OK |
| `node --check tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | ✅ OK |
| `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | ✅ **56/56** |
| `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` | ✅ 26/26 |
| `node tests/pr21-loop-status-states.smoke.test.js` | ✅ 53/53 |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` | ✅ 27/27 |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` | ✅ 52/52 |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` | ✅ 183/183 |
| `node tests/pr13-hardening-operacional.smoke.test.js` | ✅ 91/91 |

### Rollback

```bash
git revert HEAD  # reverte patch do cognitive runtime + nv-enavia.js
```

Os dois arquivos de runtime alterados são independentes — podem ser revertidos
separadamente se necessário.

### Próxima etapa segura

**PR39 — PR-DOCS — Arquitetura do Obsidian Brain**
Frente 2 corretiva encerrada. Retorno ao fluxo principal do contrato Jarvis Brain.

---

## 2026-04-30 — PR37 — PR-PROVA — Prova anti-bot real do chat runtime

- **Branch:** `copilot/claude-pr37-prova-chat-runtime-anti-bot-real`
- **Tipo:** `PR-PROVA` (worker-only, prova real, nenhum runtime alterado)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR36 ✅ (PR-IMPL — correção inicial do chat runtime anti-bot)
- **Escopo:** Worker-only. Criação de smoke test real (7 cenários, 56 asserts) + relatório + governança. Nenhum runtime alterado.

### Objetivo

Provar que a PR36 realmente reduziu o comportamento robótico da Enavia no runtime
do chat, sem quebrar segurança, planner, contrato, loop ou gates.

### Resultado

**51/56 — FALHOU PARCIALMENTE** (5 achados reais documentados).

O que passou completamente:
- **Cenário E** (sanitizer preserva prosa útil): 4/4 ✅
- **Cenário F** (bloqueio de vazamento interno): 11/11 ✅
- Regressões: todas verdes (PR36 26/26, PR13/14/19/20/21)

Os 5 achados:
1. **A2/B2**: `buildChatSystemPrompt` ainda injeta `MODO OPERACIONAL ATIVO` com `hasActiveTarget=true`, mesmo com `is_operational_context=false`. Arquivo: `schema/enavia-cognitive-runtime.js:218`.
2. **C1**: `isOperationalMessage("Você sabe operar seu sistema?")` → falso positivo pela palavra `"sistema"`.
3. **D1**: `isOperationalMessage("Revise a PR 197...")` → falso negativo, forma imperativa `"Revise"` não coberta.
4. **G5**: `isOperationalMessage("explique o que é o contrato Jarvis Brain")` → falso positivo pela palavra `"contrato"`.

### Arquivos criados

- `tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` (NOVO — 56 asserts, 51 passaram)
- `schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md` (NOVO — 9 seções)

### Arquivos atualizados (governança)

- `schema/contracts/INDEX.md`: PR37 ⚠️ + próxima PR = PR38 PR-IMPL
- `schema/status/ENAVIA_STATUS_ATUAL.md`: PR37 registrada
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`: handoff PR37 → PR38
- `schema/execution/ENAVIA_EXECUTION_LOG.md`: este bloco

### Arquivos NÃO alterados (proibidos pelo escopo)

- `nv-enavia.js` (nenhuma alteração)
- `schema/enavia-cognitive-runtime.js` (nenhuma alteração)
- `panel/` (nenhum arquivo tocado)
- `contract-executor.js`, `executor/`, `.github/workflows/`, `wrangler.toml`
- secrets, bindings, KV config, contratos encerrados

### Smoke tests executados

- `node --check nv-enavia.js` → OK
- `node --check schema/enavia-cognitive-runtime.js` → OK
- `node --check tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` → OK
- `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` → 51/56 ⚠️ (5 achados)
- `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` → 26/26 ✅
- `node tests/pr21-loop-status-states.smoke.test.js` → 53/53 ✅
- `node tests/pr20-loop-status-in-progress.smoke.test.js` → 27/27 ✅
- `node tests/pr19-advance-phase-e2e.smoke.test.js` → 52/52 ✅
- `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → 183/183 ✅
- `node tests/pr13-hardening-operacional.smoke.test.js` → 91/91 ✅

### Próxima PR

**PR38 — PR-IMPL — Correção cirúrgica dos pontos anti-bot que falharam na PR37**

---

## 2026-04-30 — PR36 — PR-IMPL — Correção inicial do chat runtime anti-bot

- **Branch:** `copilot/claudepr36-impl-chat-runtime-readonly-target-sanit`
- **Tipo:** `PR-IMPL` (worker-only, patch cirúrgico)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR35 ✅ (PR-DOCS — Mode Policy criada, contrato ajustado)
- **Escopo:** Worker-only. Patch cirúrgico em `nv-enavia.js` e `schema/enavia-cognitive-runtime.js`. Smoke test novo + regressões + relatório + governança. Nenhum painel/contrato/policy/brain/endpoint/deploy alterado ou criado.

### Objetivo

Aplicar a primeira correção real do chat runtime baseada no diagnóstico em 7 camadas (PR34) e na Mode Policy (PR35). Começar a transformar a Enavia de bot/checklist em IA LLM-first via patch mínimo.

### Implementação

1. **`read_only`** (em `nv-enavia.js:~4097-4099` e `schema/enavia-cognitive-runtime.js:~239-241`): virou nota factual de gate de execução. Removidas instruções "não sugira deploy/patch/merge" e "foque exclusivamente em validação e leitura" do prompt. A Enavia em `read_only` continua livre para conversar, raciocinar, opinar, discordar, explicar, diagnosticar e planejar — apenas não pode despachar ações de escrita real.
2. **`target` / contexto operacional**: helper novo `isOperationalMessage(message, context)` com lista expandida. `isOperationalContext` agora depende de intenção real, não da mera presença de `target` default do painel. `_operationalContextBlock` ativado apenas quando há `hasTarget` E `isOperationalContext`. Conversa simples ("oi", "você está parecendo um bot") não dispara mais o bloco "MODO OPERACIONAL ATIVO".
3. **Sanitizers**: `_sanitizeChatReply` exige forma de campo (`chave:`/`chave=`) ou sinal estrutural JSON-like; threshold 3 → 4. `_isManualPlanReply` threshold 2 → 5 + bypass `_looksLikeNaturalProse` para preservar prosa estratégica útil. Snapshot bruto JSON-like do planner continua bloqueado.
4. **Telemetria**: campo aditivo `sanitization: {applied, layer, reason}` na resposta `/chat/run`. Layers: `planner_terms`, `manual_plan`, `plain_text_fallback`. Não-quebrante para consumidores existentes do painel.

### Arquivos alterados

- `nv-enavia.js` (helpers, gate, prompt note, telemetria, named exports aditivos)
- `schema/enavia-cognitive-runtime.js` (`read_only` virou nota factual)
- `tests/pr36-chat-runtime-anti-bot.smoke.test.js` (NOVO — 25/25 ✅)
- `schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md` (NOVO — 11 seções)

### Arquivos atualizados (governança)

- `schema/contracts/INDEX.md`: PR36 ✅ + próxima PR = PR37 PR-PROVA
- `schema/status/ENAVIA_STATUS_ATUAL.md`: PR36 registrada
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`: handoff PR36 → PR37
- `schema/execution/ENAVIA_EXECUTION_LOG.md`: este bloco

### Arquivos NÃO alterados (proibidos pelo escopo)

- `panel/` (nenhum arquivo tocado)
- `contract-executor.js`, `executor/`
- `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`
- secrets, bindings, KV config
- contratos encerrados
- Nenhum endpoint criado, brain/intent engine/skill router criado, deploy executado
- Nenhum gate real de execução / aprovação / Bridge perigoso relaxado

### Smoke tests executados

- `node --check nv-enavia.js` → OK
- `node --check schema/enavia-cognitive-runtime.js` → OK
- `node --check tests/pr36-chat-runtime-anti-bot.smoke.test.js` → OK
- `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` → 25/25 ✅
- `node tests/pr21-loop-status-states.smoke.test.js` → 53/53 ✅
- `node tests/pr20-loop-status-in-progress.smoke.test.js` → 27/27 ✅
- `node tests/pr19-advance-phase-e2e.smoke.test.js` → 52/52 ✅
- `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → 183/183 ✅
- `node tests/pr13-hardening-operacional.smoke.test.js` → 91/91 ✅
- `node tests/cognitive-runtime.smoke.test.js` → 44/44 ✅ (regressão extra)
- `node tests/pr3-tool-arbitration.smoke.test.js` → 84/84 ✅ (regressão extra)
- `node tests/chat-run.http.test.js` → 24/24 ✅ (regressão extra)

### Critérios de aceite verificados

- ✅ `read_only` não é mais instrução de tom defensivo
- ✅ `read_only` continua bloqueando execução real (gates não relaxados)
- ✅ `target` sozinho não ativa tom operacional
- ✅ Mensagem operacional real ainda ativa contexto operacional
- ✅ Sanitizer não destrói resposta útil estruturada (prosa natural preservada)
- ✅ JSON/planner interno bruto continua protegido
- ✅ Telemetria mínima de sanitização/fallback existe
- ✅ Smoke anti-bot criado e passando
- ✅ Regressões principais passando
- ✅ Governança atualizada
- ✅ Próxima PR = PR37 PR-PROVA
- ✅ Nenhum Panel alterado
- ✅ Nenhum endpoint criado
- ✅ Nenhum deploy feito

### Próxima PR autorizada

**PR37 — PR-PROVA — Smoke anti-bot real do chat runtime.**

---

## 2026-04-30 — PR35 — PR-DOCS — Mode Policy + ajuste do contrato para execução real

- **Branch:** `copilot/claudepr35-docs-mode-policy-e-ajuste-para-execucao`
- **Tipo:** `PR-DOCS` (sem alteração de runtime)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR34 ✅ (PR-DIAG — diagnóstico técnico profundo de read_only, target e sanitizers, mergeada)
- **Escopo:** Docs/Policies-only. Mode Policy criada. Contrato ajustado para PR36 ser PR-IMPL. Governança atualizada. Nenhum runtime, endpoint, teste, prompt, brain, skill ou intent engine alterado/criado.

### Objetivo

Criar a política de modos da Enavia (`schema/policies/MODE_POLICY.md`) e ajustar o contrato para que a próxima PR seja implementação real, não mais documentação. Esta é a última PR-DOCS antes da execução na Frente 2. Risco de excesso documental reconhecido — o objetivo agora é produto funcionando, não apenas contrato bonito.

### Arquivos criados

- **`schema/policies/MODE_POLICY.md`** (NOVO): 9 seções. `read_only` como gate de execução. 3 modos canônicos (conversation/diagnosis/execution). Regra de target, tom, planner, sanitizers e comportamento esperado. Roadmap da PR36.
- **`schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md`** (NOVO): Relatório completo da PR35, diagnóstico resumido, riscos reconhecidos e critérios de aceite verificados.

### Arquivos atualizados (governança e contrato)

- **`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`**: PR36 mudou de PR-DOCS para PR-IMPL. Seção PR36 reescrita com escopo técnico real. Próxima PR autorizada atualizada.
- **`schema/contracts/INDEX.md`**: PR35 ✅ adicionada. Próxima PR autorizada → PR36 PR-IMPL.
- **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR35 registrada. Próxima PR: PR36 PR-IMPL.
- **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`**: handoff atualizado de PR35 para PR36. Escopo técnico da PR36 detalhado.

### Arquivos NÃO alterados (proibidos pelo escopo)

- `nv-enavia.js`, `schema/enavia-cognitive-runtime.js` e todos os arquivos `.js`/`.ts`/`.jsx`/`.tsx`/`.toml`/`.yml` — nenhum alterado.
- Nenhum sanitizer, prompt, endpoint, teste, brain, LLM Core, Intent Engine ou Skill Router alterado/criado.

### Regras R1-R4 confirmadas

- **R1:** `read_only` = bloqueio de execução, NÃO regra de tom — formalizado em `MODE_POLICY.md §2`.
- **R2:** Sanitizadores pós-LLM destroem resposta viva legítima — política de correção em `MODE_POLICY.md §7` e roadmap PR36 em `§9`.
- **R3:** Target operacional ativa contexto operacional para qualquer conversa — política de correção em `MODE_POLICY.md §4` e roadmap PR36 `§9.2`.
- **R4:** Brain (PR37+) nasce ciente do incidente — registrado em contrato e relatório.

### Decisão registrada

> Diagnóstico suficiente já existe. A PR36 é implementação real. Não haverá mais PR-DOCS antes da execução nesta frente. Objetivo: produto funcionando, não contrato bonito.

---

## 2026-04-30 — PR34 — PR-DIAG — Diagnóstico de read_only, target default e sanitizers


- **Branch:** `copilot/claude-pr34-diag-readonly-target-sanitizers`
- **Tipo:** `PR-DIAG` (READ-ONLY — sem alteração de runtime)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢 — ampliado para PR31-PR64)
- **PR anterior validada:** PR33 ✅ (PR-DOCS — ajuste do contrato pós-diagnóstico, mergeada)
- **Escopo:** Docs/Reports-only. Diagnóstico técnico profundo + governança. Nenhum runtime, endpoint, teste, prompt, brain, skill ou intent engine alterado/criado.

### Objetivo

Diagnosticar em profundidade, em modo READ-ONLY, os 3 fatores técnicos que mais matam o comportamento LLM-first da Enavia: (1) `read_only` interpretado como regra de tom; (2) `target.mode` default do painel ativando contexto operacional para qualquer conversa; (3) sanitizers/fallbacks pós-LLM substituindo respostas vivas por frases robóticas fixas. Refinar a causa-raiz da PR32 e propor — sem implementar — recomendações conceituais para PR35 (Mode Policy) e PR36 (Response Policy).

### Arquivos criados

- **`schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`** (NOVO):
  - 20 seções obrigatórias (objetivo, fontes, resumo executivo, mapa técnico de read_only, onde nasce, onde entra no prompt, impacto no tom, mapa do target default, ativação operacional, sanitizers, fallbacks robóticos, envelope JSON, planner vs conversa, causa técnica refinada, impacto nas próximas frentes, PR35, PR36, correções futuras, riscos, próximos passos).
  - Causa técnica refinada em **7 camadas** (origem painel → leitura Worker → tradução semântica → geração LLM → sanitizers → envelope JSON → roteamento planner).
  - Sequência segura: PR35 → PR36 → PR40 → PR42 → PR51 → PR52.

### Arquivos atualizados (governança)

- **`schema/contracts/INDEX.md`**: PR34 ✅ adicionada. Próxima PR autorizada → PR35.
- **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR34 registrada. Próxima PR: PR35. Refinamento em 7 camadas resumido.
- **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`**: handoff atualizado de PR34 para PR35. Histórico PR33→PR34 preservado.

### Arquivos NÃO alterados (proibidos pelo escopo)

- `nv-enavia.js`, `schema/enavia-cognitive-runtime.js`, `schema/enavia-identity.js`, `schema/enavia-capabilities.js`, `schema/enavia-constitution.js`, `schema/operational-awareness.js`, `schema/planner-classifier.js`, `schema/planner-output-modes.js`, `schema/memory-retrieval.js`.
- `panel/src/chat/useTargetState.js`, `panel/src/pages/ChatPage.jsx`, `panel/src/api/endpoints/chat.js`, `panel/src/chat/useChatState.js`.
- `contract-executor.js`, `executor/`, `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`, `tests/`.
- Nenhum `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Nenhum sanitizer alterado. Nenhum prompt real alterado.
- Nenhum endpoint criado. Nenhum teste criado. Nenhum brain/LLM Core/Intent Engine/Skill Router criado.
- Nenhum deploy. Nenhuma alteração em produção. PR35 NÃO iniciada.

### Confirmação das Regras R1-R4 (PR33)

- **R1:** `read_only` = bloqueio de execução, NÃO regra de tom — confirmada com evidência arquivo:linha (§4–§7 do relatório).
- **R2:** Sanitizadores pós-LLM destroem resposta viva legítima — confirmada com evidência (§10–§11).
- **R3:** Target operacional ativa contexto operacional para qualquer conversa — confirmada com evidência (§8–§9).
- **R4:** Brain (PR37+) precisa nascer ciente do incidente — reafirmada (§15).

### Diagnóstico

- **read_only:** nasce no painel (`useTargetState.js:36-47`), chega ao Worker via payload, é injetado como string textual no prompt em 2 lugares (`nv-enavia.js:4097-4099` + `enavia-cognitive-runtime.js:239-241`) com semântica de tom ("não sugira", "foque exclusivamente em validação e leitura"). Não existe gate determinístico de execução amarrado a `read_only`.
- **target default:** `DEFAULT_TARGET.mode = "read_only"` + `ALLOWED_MODES = ["read_only"]` + `buildContext()` sempre incluindo `target` ⇒ `hasTarget = true` em toda mensagem ⇒ `isOperationalContext = true` ⇒ ativa seção 5c do prompt + `_operationalContextBlock` de alta recência + `operationalDefaultsUsed`. Não há diferenciação entre conversa e operação.
- **sanitizers:** F1 (`_sanitizeChatReply` ≥3 termos planner → `"Entendido. Estou com isso — pode continuar."`), F2 (`_isManualPlanReply` ≥2 padrões estruturais E `shouldActivatePlanner` → `_MANUAL_PLAN_FALLBACK`), F3 (plain-text fallback → `"Instrução recebida."`), F4 (painel display → `"Instrução recebida. Processando."`). Frases fixas substituem reply silenciosamente.
- **envelope:** `{reply, use_planner}` JSON obrigatório + proibições explícitas de markdown/headers/plano dentro do reply (`enavia-cognitive-runtime.js:284-291, 319-326`) constrangem expressividade.
- **causa refinada:** 7 camadas reforçam-se mutuamente. Nenhuma é "bug" isolado; o conjunto garante comportamento de bot mesmo com LLM bom.

### Recomendações

- **PR35 (Mode Policy):** definir 3 modos canônicos (conversation/diagnosis/execution); separar capacidade de execução ↔ intenção ↔ tom; redefinir `read_only` como gate determinístico; ativação condicional do bloco operacional só em intenções de execução.
- **PR36 (Response Policy):** redesenhar Layer 1 como detector de JSON-leak (não menção textual); Layer 2 desativada em diagnosis/planning; envelope com markdown permitido dentro do reply; telemetria visível de sanitização.
- **PRs futuras:** sequência crítica PR35 → PR36 → PR40 (LLM Core) → PR42 (Intent Engine) → PR51 (Response Policy viva) → PR52 (anti-bot test).

### Smoke / verificações

- `git diff --name-only` → apenas `.md` em `schema/contracts/`, `schema/status/`, `schema/handoffs/`, `schema/execution/`, `schema/reports/`. ✅
- Nenhum `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado. ✅
- `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md` existe. ✅
- Relatório contém evidência ancorada arquivo:linha de: read_only, target default, sanitizers, fallback, envelope `{reply, use_planner}`. ✅
- Status, handoff e execution log atualizados. ✅
- INDEX.md aponta PR35 como próxima PR autorizada. ✅
- Branch sincronizada com `origin/main` (`be0a8b6`). ✅

### Próxima PR autorizada

**PR35 — PR-DOCS — Política correta de modos: conversa vs diagnóstico vs execução**

### Bloqueios

- nenhum

### Rollback

- Reverter o commit desta PR. Apenas arquivos `.md` foram criados/atualizados. Nenhum runtime impactado. Risco operacional: zero.

---

## 2026-04-30 — PR33 — PR-DOCS — Ajuste do contrato pós-diagnóstico PR32

- **Branch:** `copilot/claudepr33-docs-ajuste-contrato-jarvis-pos-diagnos`
- **Tipo:** `PR-DOCS` (sem alteração de runtime)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢 — ampliado para PR31-PR64)
- **PR anterior validada:** PR32 ✅ (diagnóstico do chat engessado, mergeada)
- **Escopo:** Docs-only. Atualização do contrato e governança. Nenhum runtime, endpoint, teste, prompt, brain, skill ou intent engine alterado/criado.

### Objetivo

Atualizar o contrato JARVIS BRAIN com base nas descobertas da PR32. Inserir Frente 2 corretiva antes do Obsidian Brain. Registrar Regras R1-R4 sobre read_only, sanitizers e target default. Deslocar Obsidian Brain para PR37+.

### Arquivos atualizados

- **`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`** (ATUALIZADO):
  - Seção 5: Nova Frente 2 corretiva (PR33-PR36). Frentes 3-13 (renumeradas). PRs 37-64 (renumeradas).
  - Seção 4: Regras R1-R4 adicionadas.
  - Seção 6: PR33-PR36 detalhadas. Todos os blocos PRs renumerados (+4).
  - Contrato ampliado de PR31-PR60 para PR31-PR64.
- **`schema/contracts/INDEX.md`**: PR33 ✅. Próxima PR → PR34.
- **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR33 registrada. Próxima PR: PR34.
- **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`**: handoff atualizado de PR33 para PR34.
- **`schema/reports/PR33_AJUSTE_CONTRATO_JARVIS_POS_DIAGNOSTICO.md`** (NOVO): relatório curto.

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`, `tests/`.
- Nenhum `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Nenhum endpoint criado. Nenhum teste criado. Nenhum prompt do runtime modificado. Nenhum brain implementado.

### Regras adicionadas ao contrato (seção 4)

- **R1:** `read_only` = bloqueio de execução, NÃO regra de tom.
- **R2:** Sanitizadores pós-LLM não destroem resposta viva legítima.
- **R3:** Target default não transforma toda conversa em modo operacional.
- **R4:** Brain (PR37+) nasce ciente do incidente `chat-engessado-readonly`.

### Smoke / verificações

- `git diff --name-only` → apenas `.md` em `schema/contracts/`, `schema/status/`, `schema/handoffs/`, `schema/execution/`, `schema/reports/`. ✅
- Nenhum `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado. ✅
- Contrato menciona `read_only` como bloqueio de execução (Regra R1). ✅
- Contrato menciona sanitizers como risco (Regra R2). ✅
- Contrato menciona target default como risco (Regra R3). ✅
- INDEX.md aponta PR34 como próxima PR autorizada. ✅
- Status, handoff e execution log atualizados. ✅

---



- **Branch:** `copilot/claude-pr32-diag-chat-engessado-jarvis-brain`
- **Tipo:** `PR-DIAG` (READ-ONLY — sem alteração de runtime)
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)
- **PR anterior validada:** PR31 ✅ (contrato Jarvis Brain ativado, mergeada)
- **Escopo:** Docs-only. Diagnóstico read-only do chat. Nenhum runtime, endpoint, teste, prompt, brain, skill ou intent engine alterado/criado.

### Objetivo

Diagnosticar, em modo READ-ONLY, por que a Enavia responde como bot/checklist e não como IA estratégica LLM-first. Mapear o fluxo real do chat painel→worker, identificar a causa raiz com evidência de arquivo:linha e produzir matriz de lacunas que ancore as PRs subsequentes do contrato Jarvis Brain.

### Arquivos criados

- **`schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`** (NOVO):
  - 18 seções obrigatórias + Anexo A (verificações de aderência).
  - Mapeamento ponta-a-ponta: 19 passos do fluxo, 11 funções-chave catalogadas com arquivo:linha.
  - Análise dos 3 blocos de prompt do `/chat/run` (chatSystemPrompt 8 seções + _pr3MemoryBlock + _operationalContextBlock).
  - Análise de payload do painel: `panel/src/api/endpoints/chat.js`, `useTargetState`, `ChatPage.jsx:buildContext`.
  - Causa raiz identificada (5 fatores compostos).
  - Matriz de lacunas (12 itens) ligadas a PRs PR33–PR60.
  - Riscos de implementar Brain/LLM Core/Skill Router sem corrigir causa raiz.
  - Recomendação confirmada para PR33 + 5 observações não-bloqueantes.

### Arquivos atualizados

- **`schema/contracts/INDEX.md`**: "Próxima PR autorizada" → PR33 — PR-DOCS — Arquitetura do Obsidian Brain. PR31 e PR32 marcadas como concluídas.
- **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR32 registrada. Causa raiz resumida com referências `arquivo:linha`. Próxima PR: PR33.
- **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`**: handoff atualizado de PR32 para PR33 + resumo da causa raiz + recomendações não-bloqueantes para PR33.
- **`schema/execution/ENAVIA_EXECUTION_LOG.md`** (este arquivo): bloco PR32 adicionado no topo.

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`, `tests/`.
- Nenhum `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Nenhum endpoint criado. Nenhum teste criado. Nenhum prompt do runtime modificado. Nenhum brain implementado. Nenhum secret/binding/KV alterado.

### Causa raiz (resumo)

A Enavia responde como bot porque:
1. Painel sempre envia `target.mode = "read_only"` por default (`panel/src/chat/useTargetState.js:35-49`, `ALLOWED_MODES = ["read_only"]`).
2. `read_only` é interpretado como REGRA DE TOM, não como bloqueio de execução (`nv-enavia.js:4097-4099`, `schema/enavia-cognitive-runtime.js:239-241`).
3. Não existe LLM Core / Intent Engine / Skill Router / Brain — só prompt monolítico orientado a governança (`schema/enavia-cognitive-runtime.js:93-329`; `grep -i "skill\|jarvis\|intent.engine" nv-enavia.js` = 0).
4. Sanitizadores pós-LLM substituem reply vivo por frase robótica fixa (`nv-enavia.js:_sanitizeChatReply 3530-3545`, `_isManualPlanReply 3572-3583, 4397-4401`).
5. Contrato JSON `{reply, use_planner}` força respostas curtas estruturadas (`schema/enavia-cognitive-runtime.js:319-326`).

### Smoke / verificações

- `git diff --name-only` → apenas `.md` em `schema/reports/`, `schema/status/`, `schema/handoffs/`, `schema/execution/`, `schema/contracts/INDEX.md`.
- Nenhum `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado. ✅
- Relatório PR32 existe e contém evidências de arquivos/funções/rotas. ✅
- Status, handoff e execution log atualizados. ✅
- INDEX.md aponta PR33 como próxima PR autorizada. ✅

### Próxima PR autorizada

**PR33 — PR-DOCS — Arquitetura do Obsidian Brain.**

### Bloqueios

- nenhum

---

## 2026-04-30 — PR31 — PR-DOCS — Ativação do contrato ENAVIA JARVIS BRAIN v1

- **Branch:** `copilot/claude-pr31-docs-ativar-contrato-jarvis-brain`
- **Tipo:** `PR-DOCS`
- **Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` → **Criado e Ativo 🟢**
- **PR anterior validada:** PR30 ✅ (contrato PR17–PR30 encerrado formalmente)
- **Escopo:** Docs-only. Ativação do novo contrato macro. Nenhum runtime alterado.

### Objetivo

Criar e ativar o novo contrato macro da ENAVIA: `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`. Religar o loop contratual após encerramento do contrato PR17–PR30. PR-DOCS pura — sem alteração de runtime.

### Arquivos criados

- **`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`** (NOVO):
  - 11 seções: status, objetivo macro, filosofia (LLM-first), arquitetura alvo (7 camadas), regras de segurança, escopo PR31–PR60 (12 frentes, 30 PRs), detalhamento completo de PR31–PR60, Obsidian Brain estrutura alvo, critérios de sucesso, riscos, regras de bloqueio, estado inicial.

- **`schema/reports/PR31_ATIVACAO_CONTRATO_JARVIS_BRAIN.md`** (NOVO):
  - Relatório de ativação.

### Arquivos atualizados

- **`schema/contracts/INDEX.md`**: contrato ativo → `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`. Próxima PR → PR32.
- **`schema/status/ENAVIA_STATUS_ATUAL.md`**: novo contrato ativo. Próxima PR: PR32.
- **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`**: de PR31 para PR32.
- **`schema/execution/ENAVIA_EXECUTION_LOG.md`**: esta entrada.

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`, Panel, Executor, Deploy Worker.
- `wrangler.toml`, `wrangler.executor.template.toml`.
- `.github/workflows/`.
- Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Nenhum teste criado ou modificado.
- Nenhum secret, binding, KV ou env var alterado.

### Próxima PR autorizada

**PR32 — PR-DIAG — Diagnóstico do chat atual, memória atual, prompts, modos e causa da resposta engessada**

---

## 2026-04-30 — PR30 — PR-DOCS/PR-PROVA — Fechamento formal do contrato PR17–PR30

- **Branch:** `copilot/claude-pr30-fechamento-contrato-loop-skills-system`
- **Tipo:** `PR-DOCS/PR-PROVA`
- **Contrato:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` → **Encerrado ✅**
- **PR anterior validada:** PR29 ✅ (schema/skills/CONTRACT_AUDITOR.md criado)
- **Escopo:** Docs-only. Fechamento formal, hardening documental, relatório final, handoff final. Nenhum runtime alterado.

### Objetivo

Encerrar formalmente o contrato PR17–PR30. Revisar completude das três frentes (loop, system map, skills), criar relatório final, atualizar governança, marcar contrato como encerrado, preparar handoff para próximo contrato.

### Arquivos criados

- **`schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md`** (NOVO):
  - Relatório final completo — 11 seções.
  - Objetivo do contrato, resultado executivo, tabela de 15 PRs, loop consolidado, mapas, skills, o que está consolidado, o que é documental (não runtime), riscos restantes, recomendações para próximo contrato, handoff final.

- **`schema/handoffs/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_FINAL_HANDOFF.md`** (NOVO):
  - Handoff final de fechamento — 8 seções.
  - Contrato encerrado, resumo das três frentes, o que NÃO foi alterado, skills são documentais, relatório final, próximos contratos possíveis, estado final do sistema, próxima ação esperada do operador humano.

### Arquivos atualizados

- **`schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`**:
  - Banner de encerramento no topo.
  - Seção 17 adicionada ao final (checklist completo + resultado final + próxima etapa).
  - Histórico preservado.

- **`schema/contracts/INDEX.md`**:
  - Seção "Contrato ativo" → "Nenhum contrato ativo".
  - Contrato PR17–PR30 movido para "Contratos encerrados" com data 2026-04-30.
  - "Próxima PR autorizada" → "Nenhuma. Aguardar operador humano."

- **`schema/status/ENAVIA_STATUS_ATUAL.md`**:
  - Contrato encerrado registrado.
  - Entregas por frente listadas.
  - Skills explicitadas como documentais.
  - Estado: aguardando próximo contrato.

- **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`**:
  - Handoff final transformado — De: PR30, Para: próximo contrato.

- **`schema/execution/ENAVIA_EXECUTION_LOG.md`**:
  - Esta entrada.

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`, Panel, Executor, Deploy Worker.
- `wrangler.toml`, `wrangler.executor.template.toml`.
- `.github/workflows/`.
- Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Nenhum teste criado ou modificado.
- Nenhum secret, binding, KV ou env var alterado.
- Nenhum endpoint criado.

### Verificações smoke

- `git diff --name-only`: apenas arquivos de `schema/` (relatório, handoffs, contrato, INDEX, status, execution log).
- Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado ✅.
- Relatório final existe ✅.
- Contrato PR17–PR30 marcado como encerrado ✅.
- `schema/contracts/INDEX.md` não aponta próxima PR do contrato encerrado ✅.
- `schema/status/ENAVIA_STATUS_ATUAL.md` registra "aguardando próximo contrato" ✅.
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` é handoff final ✅.
- `schema/skills/INDEX.md` lista 4 skills ativas ✅.
- Nenhum documento sugere que `/skills/run` já existe ✅.

### Rollback

Esta PR é docs-only. Se necessário reverter: `git revert` dos commits de fechamento. O sistema operacional (Worker, Executor) não foi alterado — nenhum rollback de runtime necessário.

---



- **Branch:** `copilot/claudepr29-docs-contract-auditor-skill`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR28 ✅ (PR #189 mergeada — commit merge `daefe36`)
- **Escopo:** Docs-only. Criação de `schema/skills/CONTRACT_AUDITOR.md` + atualização de `schema/skills/INDEX.md` + governança. Nenhum runtime alterado.

### Objetivo

Criar a quarta skill oficial supervisionada da ENAVIA — Contract Auditor — que audita aderência contratual de PRs, tarefas e execuções. Skill supervisionada e documental: não corrige automaticamente, não faz deploy, não atualiza mapas diretamente, não aprova merge sem intervenção humana.

### Arquivos criados/alterados

- **`schema/skills/CONTRACT_AUDITOR.md`** (NOVO):
  - 24 seções obrigatórias.
  - Frase obrigatória: "Auditoria boa não é a que bloqueia tudo; é a que separa risco real de ruído." (Seção 3).
  - Seção 9: Matriz de auditoria por tipo de PR (PR-DIAG, PR-IMPL, PR-PROVA, PR-DOCS).
  - Seção 10: Checklist de aderência contratual (13 itens).
  - Seções 11–15: Auditorias específicas (arquivos, governança, testes, rollback, segurança).
  - Seção 16: Critérios de severidade (BLOCKER, HIGH, MEDIUM, LOW, INFO + exemplos).
  - Seções 17–19: Relação com Contract Loop Operator (PR26), Deploy Governance Operator (PR27) e System Mapper (PR28).
  - Seção 20: Critérios para sugerir nova skill + template.
  - Seção 21: 7 exemplos de uso concretos.
  - Seção 23: "Isso é opcional. Não mexa agora." (9 itens).
  - Seção 24: Checklist final (11 itens).

- **`schema/skills/INDEX.md`** (ATUALIZADO):
  - Contract Auditor movida de "previstas" para "ativas".
  - Total: 4 skills ativas (PR26, PR27, PR28, PR29), 0 previstas.

- **Governança:**
  - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
  - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — recriado para PR29→PR30.
  - `schema/contracts/INDEX.md` — próxima PR autorizada = PR30 (fechamento do contrato).
  - `schema/execution/ENAVIA_EXECUTION_LOG.md` — esta entrada.

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`, Panel, Executor, Deploy Worker.
- `wrangler.toml`, `wrangler.executor.template.toml`.
- `.github/workflows/`.
- Nenhum teste criado ou modificado.
- Nenhum secret, binding, KV ou env var alterado.

### Verificações smoke

- `git diff --name-only`: apenas `schema/skills/CONTRACT_AUDITOR.md` (novo), `schema/skills/INDEX.md`, `schema/contracts/INDEX.md`, `schema/status/ENAVIA_STATUS_ATUAL.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, `schema/execution/ENAVIA_EXECUTION_LOG.md`.
- Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Frase "Auditoria boa não é a que bloqueia tudo; é a que separa risco real de ruído." presente (Seção 3).
- Frase "Isso é opcional. Não mexa agora." presente (Seção 23).
- Referências a `CONTRACT_LOOP_OPERATOR.md`, `DEPLOY_GOVERNANCE_OPERATOR.md` e `SYSTEM_MAPPER.md` presentes.
- `schema/contracts/INDEX.md` aponta PR30 como próxima PR autorizada.

---

## 2026-04-30 — PR28 — PR-DOCS — Criar schema/skills/SYSTEM_MAPPER.md

- **Branch:** `claude/pr28-docs-system-mapper-skill`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR27 ✅ (PR #188 mergeada — commit merge `0f43c29`)
- **Escopo:** Docs-only. Criação de `schema/skills/SYSTEM_MAPPER.md` + atualização de `schema/skills/INDEX.md` + governança. Nenhum runtime alterado.

### Objetivo

Criar a terceira skill oficial supervisionada da ENAVIA — System Mapper — que governa a manutenção dos documentos de sistema (System Map, Route Registry, Worker Registry, Operational Playbook, Skills Index). Skill supervisionada e documental: não atualiza documentos automaticamente, não inventa rota/worker/binding, não altera runtime.

### Arquivos criados/alterados

- **`schema/skills/SYSTEM_MAPPER.md`** (NOVO):
  - 23 seções obrigatórias.
  - Frase obrigatória: "Mapa bom não é mapa bonito; é mapa fiel ao sistema real." (Seção 3).
  - Seção 7: Tabela de 9 documentos sob responsabilidade da skill com função, quando atualizar e fonte primária.
  - Seções 8–12: Regras específicas para System Map, Route Registry, Worker Registry, Operational Playbook e Skills Index.
  - Seção 13: Matriz de impacto documental (11 cenários).
  - Seção 14: Procedimento supervisionado de mapeamento (10 passos).
  - Seção 15: Tabela de divergências (9 cenários).
  - Seções 16–18: Relação com Contract Loop Operator (PR26), Deploy Governance Operator (PR27) e futura Contract Auditor (PR29).
  - Seção 19: Critérios para sugerir nova skill + template.
  - Seção 20: 6 exemplos de uso concretos.
  - Seção 22: "Isso é opcional. Não mexa agora." (9 itens).
  - Seção 23: Checklist final (11 itens).

- **`schema/skills/INDEX.md`** (ATUALIZADO):
  - System Mapper movida de "previstas" para "ativas".
  - Total: 3 skills ativas (PR26, PR27, PR28), 1 prevista (PR29).

- **Governança:**
  - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
  - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — recriado para PR28→PR29.
  - `schema/contracts/INDEX.md` — próxima PR autorizada = PR29 (Contract Auditor).
  - `schema/execution/ENAVIA_EXECUTION_LOG.md` — esta entrada.

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`, Panel, Executor, Deploy Worker.
- `wrangler.toml`, `wrangler.executor.template.toml`.
- `.github/workflows/`.
- Nenhum teste criado ou modificado.
- Nenhum secret, binding, KV ou env var alterado.

### Verificações smoke

- `git diff --name-only`: apenas `schema/skills/SYSTEM_MAPPER.md` (novo), `schema/skills/INDEX.md`, `schema/contracts/INDEX.md`, `schema/status/ENAVIA_STATUS_ATUAL.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, `schema/execution/ENAVIA_EXECUTION_LOG.md`.
- Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Frase "Mapa bom não é mapa bonito; é mapa fiel ao sistema real." presente.
- Frase "Isso é opcional. Não mexa agora." presente.
- Referências a `CONTRACT_LOOP_OPERATOR.md`, `DEPLOY_GOVERNANCE_OPERATOR.md` e futura `CONTRACT_AUDITOR.md` presentes.

### Rollback

- `git revert <commit>` reverte a criação da skill e retorna `schema/skills/INDEX.md`, `schema/contracts/INDEX.md` e governança ao estado pós-PR27.
- Não há impacto em runtime.

### Próxima ação autorizada

**PR29** — PR-DOCS — Criar skill: Contract Auditor (`schema/skills/CONTRACT_AUDITOR.md`).

### Bloqueios

- nenhum.

---

## 2026-04-30 — PR27 — PR-DOCS — Criar schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md

- **Branch:** `claude/pr27-docs-deploy-governance-operator-skill`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR26 ✅ (commit `0b3b7db`, PR #187 mergeada — commit merge `2954fef`)
- **Escopo:** Docs-only. Criação de `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` + atualização de `schema/skills/INDEX.md` + governança. Nenhum runtime alterado.

### Objetivo

Criar a segunda skill oficial supervisionada da ENAVIA — Deploy Governance Operator — que governa deploy, rollback e promoção PROD/TEST. Skill supervisionada, sem autonomia sobre PROD: promoção exige aprovação humana explícita.

### Arquivos criados/alterados

- **`schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md`** (NOVO):
  - 23 seções obrigatórias.
  - Frase obrigatória 1: "Deploy seguro não é deploy travado; é deploy com prova, rollback e aprovação clara."
  - Frase obrigatória 2: "Sem aprovação humana explícita, PROD é bloqueado."
  - Seção 9: Matriz de decisão TEST vs PROD (8 tipos de PR/ação mapeados).
  - Seção 10: 12 gates obrigatórios antes de qualquer deploy.
  - Seção 11: Relação com Contract Loop Operator — ponto de integração `execute-next → /apply-test`.
  - Seção 12: Relação com Worker Registry — fonte de verdade para workers, bindings, secrets, workflows.
  - Seção 13: Relação com Route Registry — `known_external_routes` para deploy.
  - Seção 14: Relação com Operational Playbook — rollback e smoke suite.
  - Seções 15–16: Procedimento passo a passo para deploy TEST e promoção PROD.
  - Seção 17: Rollback por tipo (DOCS, PROVA, IMPL Worker, workflow/config, KV/data, PROD) + log format.
  - Seção 18: Tabela de diagnóstico de falhas (12 linhas).
  - Seção 19: Critérios para sugerir nova skill (8 gatilhos + template).
  - Seção 20: 7 exemplos de uso concretos.
  - Seção 21: Segurança e limites (nunca expor secrets, nunca alterar bindings/KV, nunca auto-promover PROD).
  - Seção 22: "Isso é opcional. Não mexa agora." (11 itens).
  - Seção 23: Checklist final (12 itens).

- **`schema/skills/INDEX.md`** (ATUALIZADO):
  - Deploy Governance Operator movida de "previstas" para "ativas".
  - Agora 2 skills ativas, 2 previstas (PR28–PR29).

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`
- Nenhum teste criado ou modificado.

### Verificações

| Verificação | Resultado |
|-------------|-----------|
| 23 seções numeradas presentes | ✅ |
| "Deploy seguro não é deploy travado..." presente | ✅ (2 ocorrências) |
| "Sem aprovação humana explícita, PROD é bloqueado." presente | ✅ |
| CONTRACT_LOOP_OPERATOR referenciado | ✅ (1 ocorrência) |
| ENAVIA_WORKER_REGISTRY referenciado | ✅ (10 ocorrências) |
| ENAVIA_ROUTE_REGISTRY referenciado | ✅ (5 ocorrências) |
| ENAVIA_OPERATIONAL_PLAYBOOK referenciado | ✅ (3 ocorrências) |
| "Isso é opcional. Não mexa agora." presente | ✅ |
| Nenhum .js/.ts/.toml/.yml alterado | `0 arquivos` ✅ |

---

## 2026-04-30 — PR26 — PR-DOCS — Criar schema/skills/CONTRACT_LOOP_OPERATOR.md

- **Branch:** `claude/pr26-docs-contract-loop-operator-skill`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR25 ✅ (commit `599a499`, PR #186 mergeada — commit merge `fb8e640`)
- **Escopo:** Docs-only. Criação de `schema/skills/CONTRACT_LOOP_OPERATOR.md` + `schema/skills/INDEX.md` + governança. Nenhum runtime alterado.

### Objetivo

Criar a primeira skill oficial supervisionada da ENAVIA — Contract Loop Operator — que encapsula o loop contratual completo (`loop-status → execute-next → complete-task → advance-phase`). Skill segura mas não engessada: permite sugestão de novas skills sob governança, sem autonomia cega.

### Arquivos criados

- **`schema/skills/CONTRACT_LOOP_OPERATOR.md`** (NOVO):
  - 20 seções obrigatórias.
  - Frase obrigatória: "Segurança não significa engessamento."
  - Seção 3: Princípio de segurança sem engessamento — equilibra proteção e evolução.
  - Seção 9: Matriz operacional com 7 estados + observação PR21.
  - Seção 11: Bodies mínimos dos 5 endpoints de loop com shapes completos do Route Registry.
  - Seção 13: Critérios para sugerir nova skill (8 gatilhos).
  - Seção 14: Template padrão de sugestão de nova skill.
  - Seção 15: Relação com PR27 (Deploy Governance), PR28 (System Mapper), PR29 (Contract Auditor).
  - Seção 18: 5 exemplos de uso concretos (queued, in_progress, phase_complete, plan_rejected, sugestão de skill).
  - Seção 20: "Isso é opcional. Não mexa agora." (9 itens).
  - Referências: 21× documentos oficiais (System Map, Route Registry, Playbook, Worker Registry).

- **`schema/skills/INDEX.md`** (NOVO):
  - Índice de skills ativas (1), previstas (3: PR27–PR29) e sugeridas.
  - Regras de uso e relação com documentos oficiais.

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`
- Nenhum teste criado ou modificado.

### Verificações

| Verificação | Resultado |
|-------------|-----------|
| 20 seções numeradas presentes | ✅ |
| Frase "Segurança não significa engessamento" presente | ✅ |
| Seção de sugestão de nova skill presente | ✅ (seções 13, 14, Exemplo 5) |
| "Isso é opcional. Não mexa agora." presente | ✅ |
| Refs a documentos oficiais | `21 ocorrências` ✅ |
| PR21 observação sobre `status_global:"blocked"` presente | ✅ |
| `git diff --name-only` (runtime) | `(vazio)` ✅ |
| Nenhum .js/.ts/.toml/.yml alterado | `0 arquivos` ✅ |

---

## 2026-04-29 — PR25 — PR-DOCS — Criar schema/system/ENAVIA_WORKER_REGISTRY.md

- **Branch:** `claude/pr25-docs-enavia-worker-registry`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR24 ✅ (commit `8c5670f`, PR #185 mergeada — commit merge `b54e74c`)
- **Escopo:** Docs-only. Apenas criação de `schema/system/ENAVIA_WORKER_REGISTRY.md` + governança. Nenhum runtime alterado.

### Objetivo

Criar o inventário oficial de infraestrutura da ENAVIA documentando workers, service bindings, KV namespaces, secrets esperados, env vars, workflows e dependências externas. Todas as informações baseadas em evidência real das fontes: `wrangler.toml`, `wrangler.executor.template.toml`, `executor/wrangler.toml`, `.github/workflows/deploy.yml`, `.github/workflows/deploy-executor.yml`, `nv-enavia.js`, `contract-executor.js`.

### Arquivo criado

- **`schema/system/ENAVIA_WORKER_REGISTRY.md`** (NOVO):
  - 18 seções obrigatórias.
  - 6 workers Cloudflare confirmados (3 PROD + 3 TEST via bindings).
  - 5 workers externos por URL (Browser, Director Cognitive, Vercel, Deploy Worker URL, ENAVIA Executor URL).
  - Service bindings EXECUTOR e DEPLOY_WORKER — PROD e TEST separados.
  - KV ENAVIA_BRAIN com 2 IDs visíveis (PROD/TEST); executor com 3 bindings KV adicionais.
  - 14 key shapes do ENAVIA_BRAIN confirmados por evidência direta de código.
  - Secrets esperados: `INTERNAL_TOKEN`, `OPENAI_API_KEY` (confirmados); `SUPABASE_KEY` [A VERIFICAR]; executor: `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `OPENAI_API_KEY`/`CODEX_API_KEY`.
  - GitHub Secrets confirmados: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_TOKEN`.
  - Env vars PROD vs TEST documentadas (11 vars nv-enavia + 5 vars executor por ambiente).
  - 2 workflows documentados: `deploy.yml` e `deploy-executor.yml`.
  - Checklist de saúde com 18 itens.
  - Diagnóstico de 10 falhas comuns.
  - Seção 16: 8 incertezas marcadas como [A VERIFICAR].
  - Seção 17: "Isso é opcional. Não mexa agora." com 9 itens.
  - Referências: 3× ENAVIA_SYSTEM_MAP, 13× ENAVIA_ROUTE_REGISTRY, 4× ENAVIA_OPERATIONAL_PLAYBOOK.

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`
- Nenhum teste criado ou modificado.

### Verificações

| Verificação | Resultado |
|-------------|-----------|
| 18 seções numeradas presentes | ✅ |
| Referências a ENAVIA_SYSTEM_MAP.md | `3 ocorrências` ✅ |
| Referências a ENAVIA_ROUTE_REGISTRY.json | `13 ocorrências` ✅ |
| Referências a ENAVIA_OPERATIONAL_PLAYBOOK.md | `4 ocorrências` ✅ |
| "NUNCA DOCUMENTAR" na coluna de valores de secrets | ✅ |
| Nenhum valor de secret exposto | ✅ |
| "Isso é opcional. Não mexa agora." presente | ✅ |
| `git diff --name-only` (runtime) | `(vazio)` ✅ |
| Nenhum .js/.ts/.toml/.yml alterado | `0 arquivos` ✅ |

---

## 2026-04-29 — PR24 — PR-DOCS — Criar schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md

- **Branch:** `claude/pr24-docs-enavia-operational-playbook`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR23 ✅ (commit `a799fd2`, PR #184 mergeada — commit merge `beb3dfa`)
- **Escopo:** Docs-only. Apenas criação de `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` + governança. Nenhum runtime alterado.

### Objetivo

Criar o playbook operacional completo do projeto ENAVIA com 18 seções obrigatórias cobrindo: como executar o loop contratual supervisionado passo a passo, como diagnosticar estados bloqueados, como fazer rollback, como avançar de fase, referências cruzadas ao System Map (PR22) e Route Registry (PR23), procedimento de handoff, regras de segurança e checklist final.

### Arquivo criado

- **`schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md`** (NOVO):
  - 18 seções obrigatórias + Apêndice A (referências rápidas).
  - Seção 6: Matriz de ações por estado com observação PR21 (`status_global:"blocked"` sozinho não bloqueia via `resolveNextAction`).
  - Seção 17: "Isso é opcional. Não mexa agora." com 9 itens.
  - Apêndice A: quick reference de governança, endpoints de loop, padrão de branch, formato de resposta.
  - Fontes: `ENAVIA_SYSTEM_MAP.md` (PR22), `ENAVIA_ROUTE_REGISTRY.json` (PR23), contrato ativo, testes PR13–PR21.
  - Referências verificadas: 5× ENAVIA_SYSTEM_MAP, 10× ENAVIA_ROUTE_REGISTRY.
  - Total smoke tests documentados: 451 (PR13: 91, PR14: 183, PR18: 45, PR19: 52, PR20: 27, PR21: 53).

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`
- Nenhum teste criado ou modificado.

### Verificações

| Verificação | Resultado |
|-------------|-----------|
| 18 seções numeradas presentes | ✅ |
| Referências a ENAVIA_SYSTEM_MAP.md | `5 ocorrências` ✅ |
| Referências a ENAVIA_ROUTE_REGISTRY.json | `10 ocorrências` ✅ |
| `git diff --name-only HEAD` | `(vazio)` ✅ |

---

## 2026-04-29 — PR23 — PR-DOCS — Criar schema/system/ENAVIA_ROUTE_REGISTRY.json

- **Branch:** `claude/pr23-docs-enavia-route-registry`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR22 ✅ (commit `0899557`, PR #183 mergeada — commit merge `fc7a4ec`)
- **Escopo:** Docs-only. Apenas criação de `schema/system/ENAVIA_ROUTE_REGISTRY.json` + governança. Nenhum runtime alterado.

### Objetivo

Criar registry machine-readable das 68 rotas HTTP reais do worker `nv-enavia`, baseado exclusivamente em evidência do código (`nv-enavia.js`). Campos por rota: id, method, path, handler, scope, status, auth, cors, input, output, evidence (file/pattern/confidence), notes.

### Arquivo criado

- **`schema/system/ENAVIA_ROUTE_REGISTRY.json`** (NOVO):
  - 68 rotas em 14 grupos.
  - Validação de enums: 0 violações (scope, status, auth.type, confidence).
  - Campos obrigatórios: 0 ausentes.
  - Rotas obrigatórias do spec: 10/10 ✅.
  - 3 unknowns documentados.
  - 5 external routes documentadas (EXECUTOR, DEPLOY_WORKER, BROWSER_EXECUTOR_URL, DIRECTOR_COGNITIVE_URL, VERCEL_EXECUTOR_URL).

### Arquivos NÃO alterados

- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`
- Nenhum teste criado ou modificado.

### Verificações

| Comando | Resultado |
|---------|-----------|
| `node -e "JSON.parse(...)"` | `JSON válido` ✅ |
| Validação de enums (script Node) | `0 violações` ✅ |
| Campos obrigatórios (script Node) | `0 ausentes` ✅ |
| Rotas obrigatórias do spec | `10/10` ✅ |
| `git diff --name-only` | `(vazio)` ✅ |

---

## 2026-04-29 — PR22 — PR-DOCS — Criar schema/system/ENAVIA_SYSTEM_MAP.md

- **Branch:** `claude/pr22-docs-enavia-system-map`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR21 ✅ (commit `6a0595e`, PR #182 mergeada — commit merge `3d29b7d`)
- **Escopo:** Docs-only. Apenas criação de `schema/system/ENAVIA_SYSTEM_MAP.md` + governança. Nenhum runtime alterado.

### Objetivo

Criar o mapeamento técnico completo do sistema ENAVIA com 14 seções cobrindo: objetivo, estado atual, componentes principais, arquivos centrais, contratos/governança, loop contratual, estados operacionais, workers/bindings/KV/secrets, endpoints, testes/provas, consolidado, pendências, itens opcionais e regras de manutenção.

### Arquivos alterados

1. **`schema/system/ENAVIA_SYSTEM_MAP.md`** (NOVO — criado):
   - Seção 1: Objetivo do sistema
   - Seção 2: Estado atual resumido
   - Seção 3: Componentes principais (worker, executor, deploy-worker, contract-executor, panel)
   - Seção 4: Arquivos centrais (nv-enavia.js, contract-executor.js, wrangler.toml, workflows, módulos de schema)
   - Seção 5: Contratos e governança (estrutura, histórico, taxonomia)
   - Seção 6: Loop contratual supervisionado (fluxo, funções, Rules 1–9)
   - Seção 7: Estados operacionais (status_global, task, phase, ações por estado)
   - Seção 8: Workers, bindings, KV namespaces e secrets (PROD + TEST, KV keys canônicas, shapes)
   - Seção 9: Endpoints conhecidos (contratos, outras rotas, executor, deploy)
   - Seção 10: Testes e provas (smoke tests formais + outros)
   - Seção 11: O que está consolidado
   - Seção 12: O que ainda falta (PR23–PR30)
   - Seção 13: Itens opcionais / fora do escopo
   - Seção 14: Regras de manutenção
2. **Governança:**
   - `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR22 no topo.
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — atualizado para PR23.
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
   - `schema/contracts/INDEX.md` — próxima PR autorizada = PR23.

### Arquivos NÃO alterados (proibido pelo escopo)

- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, deploy worker, `.github/workflows/`, `wrangler.toml`
- Nenhum teste pré-existente modificado.

### Fontes consultadas para construção do mapa

- `wrangler.toml` (bindings PROD e TEST, vars, services)
- `nv-enavia.js` (rotas via grep, imports, funções)
- `contract-executor.js` (funções, Rules, estados, linhas de referência)
- `.github/workflows/deploy.yml` e `deploy-executor.yml`
- `executor/wrangler.toml` e `executor/src/index.js`
- `schema/status/ENAVIA_STATUS_ATUAL.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (histórico de decisões)
- `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- `tests/` (smoke tests PR13–PR21)

### Smoke tests

| Verificação | Resultado |
|-------------|-----------|
| Arquivo criado em `schema/system/ENAVIA_SYSTEM_MAP.md` | ✅ |
| Nenhum arquivo `.js`, `.toml`, `.yml` alterado | ✅ |
| 14 seções presentes no documento | ✅ |
| Bindings consistentes com `wrangler.toml` | ✅ |
| Rotas consistentes com grep de `nv-enavia.js` | ✅ |
| Testes consistentes com smoke tests PR13–PR21 (totais confirmados) | ✅ |

---

## 2026-04-29 — PR21 — PR-PROVA — Smoke do loop-status com task in_progress e phase_complete

- **Branch:** `claude/pr21-prova-loop-status-states`
- **Tipo:** `PR-PROVA`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR20 ✅ (commit `a563a97`, PR #181 mergeada — commit merge `028862d`)
- **Escopo:** PR-PROVA. Apenas teste novo + governança. Nenhum runtime alterado.

### Objetivo

Provar formalmente, em uma matriz cruzada e focada, que o `GET /contracts/loop-status` está coerente em todos os estados operacionais relevantes:

1. `queued` / `start_task` → `POST /contracts/execute-next`
2. `in_progress` → `POST /contracts/complete-task` (PR20)
3. `phase_complete` → `POST /contracts/advance-phase` (PR18)
4. `plan_rejected` / `cancelled` / `contract_complete` → vazio ou seguro

### Arquivos alterados

1. **`tests/pr21-loop-status-states.smoke.test.js`** (novo, 53 asserts em 5 cenários):
   - 1. queued → execute-next exclusivo (10 asserts)
   - 2. in_progress → complete-task exclusivo + guidance c/ contract_id/task_id/resultado (12 asserts)
   - 3. phase_complete → advance-phase exclusivo + operationalAction.advance_phase (10 asserts)
   - 4a. plan_rejected → ações vazias (4 asserts)
   - 4b. cancelled → ações vazias (4 asserts)
   - 4c. contract_complete (todas fases done) → ações vazias (4 asserts)
   - 5. Consistência cruzada — matriz de unicidade (9 asserts)
2. **Governança:**
   - `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR21 no topo.
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — atualizado para PR22.
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
   - `schema/contracts/INDEX.md` — próxima PR autorizada = PR22.

### Arquivos NÃO alterados (proibido pelo escopo)

- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, deploy worker, `.github/workflows/`, `wrangler.toml`
- Nenhum teste pré-existente modificado.

### Observação documentada (sem corrigir comportamento)

Durante a construção do teste 4a foi confirmado que `status_global: "blocked"` sozinho **não** faz `resolveNextAction` esconder ações operacionais — o sistema só bloqueia via:
- `state.plan_rejection.plan_rejected === true` (`isPlanRejected` em `contract-executor.js:516`)
- `state.status_global === "cancelled"` (`isCancelledContract` em `contract-executor.js:500`)

Esse é o comportamento existente. PR21 ajustou o cenário 4a para usar `plan_rejection` no shape correto, sem alterar runtime. Se for desejado bloquear via `status_global` no futuro, isso seria uma PR-IMPL separada (não nesta).

### Smoke tests

| Comando | Resultado |
|---------|-----------|
| `node --check tests/pr21-loop-status-states.smoke.test.js` | ✅ |
| `node tests/pr21-loop-status-states.smoke.test.js` | **53 passed, 0 failed** ✅ |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` (regressão) | **27 passed, 0 failed** ✅ |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` (regressão) | **52 passed, 0 failed** ✅ |
| `node tests/pr18-advance-phase-endpoint.smoke.test.js` (regressão) | **45 passed, 0 failed** ✅ |
| `node tests/pr13-hardening-operacional.smoke.test.js` (regressão) | **91 passed, 0 failed** ✅ |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` (regressão) | **183 passed, 0 failed** ✅ |

**Total: 451/451 sem regressão.**

### Bloqueios

Nenhum.

### Próxima etapa autorizada

**PR22** — `PR-DOCS` — Criar `schema/system/ENAVIA_SYSTEM_MAP.md` (mapeamento de componentes, workers, bindings, KV namespaces, rotas e estados do sistema ENAVIA).

---

## 2026-04-29 — PR20 — PR-IMPL — Worker-only — loop-status expõe complete-task em task in_progress

- **Branch:** `claude/pr20-impl-loop-status-in-progress`
- **Tipo:** `PR-IMPL`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR19 ✅ (commit `3662891`, PR #180 mergeada — commit merge `fbf8813`)
- **Escopo:** Worker-only, ajuste cirúrgico em `nv-enavia.js`. Nenhum outro arquivo de runtime alterado.

### Diagnóstico (read-only, antes do patch)

1. `handleGetLoopStatus` em `nv-enavia.js:5024-5047`.
2. `nextAction` montado via `resolveNextAction(state, decomposition)` (linha 5018).
3. Quando task está `in_progress`: `resolveNextAction` Rule 9 (`contract-executor.js:1594-1605`) retorna:
   ```js
   { type: "no_action", phase_id, task_id, reason, status: "in_progress" }
   ```
4. `availableActions` é montado dentro de `if (isReady) { ... } else if (isAwaitingApproval) { ... }` — sem ramo para `isIdle`/`status === "in_progress"`.
5. Confirmado: `start_task` → `execute-next`; `phase_complete` → `advance-phase`; `in_progress` → vazio (gap).

### Patch aplicado em `nv-enavia.js` (cirúrgico)

Adicionado novo `else if` ao `handleGetLoopStatus`, sem refatorar o resto:

```js
} else if (nextAction.status === "in_progress") {
  // PR20 — task em progresso pode ser concluída supervisionadamente via complete-task.
  availableActions = ["POST /contracts/complete-task"];
  guidance = "Task in_progress. Use POST /contracts/complete-task com { contract_id, task_id, resultado } para concluir com gate de aderência.";
}
```

E `canProceed` atualizado para incluir o novo estado válido:
```js
const canProceed = isReady || isAwaitingApproval || (nextAction.status === "in_progress");
```

### Não alterado (proibido pelo escopo)

- `contract-executor.js` — Rule 9 já produz o shape correto, nenhuma mudança necessária ✅
- Endpoints `complete-task`, `execute-next`, `advance-phase` — comportamento intocado
- `panel/`, `executor/`, deploy worker, workflows, `wrangler.toml`
- `buildOperationalAction` — não alterada (`no_action` continua mapeando para `block`, o que é correto: não libera execução errada em `in_progress`)

### Smoke tests

| Comando | Resultado |
|---------|-----------|
| `node --check nv-enavia.js` | ✅ |
| `node --check tests/pr20-loop-status-in-progress.smoke.test.js` | ✅ |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` | **27 passed, 0 failed** ✅ |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` (regressão) | **52 passed, 0 failed** ✅ |
| `node tests/pr18-advance-phase-endpoint.smoke.test.js` (regressão) | **45 passed, 0 failed** ✅ |
| `node tests/pr13-hardening-operacional.smoke.test.js` (regressão) | **91 passed, 0 failed** ✅ |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` (regressão) | **183 passed, 0 failed** ✅ |

**Total: 398/398 sem regressão.**

### Cobertura PR20 (4 seções, 27 asserts)

- **A. Task in_progress** — `loop-status` expõe `POST /contracts/complete-task`, `canProceed:true`, NÃO mostra `execute-next`/`advance-phase`/`close-final`.
- **B. Estados indevidos** — `queued` → execute-next sem complete-task; `phase_complete` → advance-phase sem complete-task; contrato `blocked` → sem complete-task.
- **C. operationalAction** — em `in_progress` permanece `type:block`, `can_execute:false` (não libera execução errada).
- **D. canProceed** — verdadeiro em `start_task`, `phase_complete` e `in_progress`.

### Bloqueios

Nenhum.

### Próxima etapa autorizada

**PR21** — `PR-PROVA` — Smoke do `loop-status` com task `in_progress` e `phase_complete` (cobertura cruzada complementar dos estados operacionais).

---

## 2026-04-29 — PR19 — PR-PROVA — Smoke real ponta a ponta do ciclo execute → complete → advance-phase

- **Branch:** `claude/pr19-prova-advance-phase-e2e`
- **Tipo:** `PR-PROVA`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR18 ✅ (commit `0a1d771`, PR #179 mergeada — commit merge `9b45395`)
- **Escopo:** PR-PROVA. Apenas teste novo + governança. Nenhum runtime alterado.

### Objetivo

Provar via smoke test E2E que o ciclo completo funciona ponta a ponta:

```
loop-status (start_task)
  → execute-next (queued → in_progress)
    → complete-task (in_progress → completed)
      → loop-status (phase_complete)
        → advance-phase (phase_01 → phase_02)
          → loop-status (start_task na phase_02)
```

### Arquivos alterados

1. **`tests/pr19-advance-phase-e2e.smoke.test.js`** (novo, ~330 linhas, 52 asserts):
   - Fixture: contrato com 2 fases reais (`phase_01`, `phase_02`), 2 tasks reais (`task_001`, `task_002`), ambas iniciando como `queued`.
   - Mocks: `EXECUTOR.fetch` (audit + propose ok) e `DEPLOY_WORKER.fetch` (apply-test ok) — padrão idêntico ao PR14.
   - State da fixture inclui `definition_of_done: [...]` (exigido por `auditExecution` em `complete-task`).
   - 4 cenários: HAPPY PATH (Steps 1–6), BLOQUEIO (Step 7), ISOLAMENTO (Step 8), GUARD (Step 9).
2. **Governança:**
   - `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR19 no topo.
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — atualizado para PR20.
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
   - `schema/contracts/INDEX.md` — próxima PR autorizada = PR20.

### Arquivos NÃO alterados (proibido pelo escopo)

- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, deploy worker, `.github/workflows/`, `wrangler.toml`
- Nenhum teste existente foi modificado.

### Cobertura (9 steps, 52 asserts)

| Step | Cenário | Asserts |
|------|---------|---------|
| 1 | `loop-status` inicial → `start_task` para `task_001` | 7 |
| 2 | `execute-next` → `task_001` queued → in_progress | 4 |
| 3 | `complete-task` aderente → `task_001` completed | 6 |
| 4 | `loop-status` → `phase_complete` + `advance-phase` disponível | 8 |
| 5 | `advance-phase` → `phase_01` done, `current_phase` = `phase_02` | 9 |
| 6 | `loop-status` → próxima ação `start_task` para `task_002` | 7 |
| 7 | `advance-phase` antes de completar tasks → 409 + blockers persistidos | 7 |
| 8 | `execute-next` em `phase_complete` NÃO avança fase implicitamente | 2 |
| 9 | `loop-status` em `start_task` NÃO mostra `advance-phase` | 3 |

### Smoke tests

| Comando | Resultado |
|---------|-----------|
| `node --check tests/pr19-advance-phase-e2e.smoke.test.js` | ✅ |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` | **52 passed, 0 failed** ✅ |
| `node tests/pr18-advance-phase-endpoint.smoke.test.js` (regressão) | **45 passed, 0 failed** ✅ |
| `node tests/pr13-hardening-operacional.smoke.test.js` (regressão) | **91 passed, 0 failed** ✅ |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` (regressão) | **183 passed, 0 failed** ✅ |

**Total: 371/371 sem regressão.**

### Bloqueios

Nenhum.

### Próxima etapa autorizada

**PR20** — `PR-IMPL` — Worker-only — `loop-status` expõe ação correta quando task está `in_progress` (deve incluir `POST /contracts/complete-task` em `availableActions`).

---

## 2026-04-29 — PR18 — PR-IMPL — Worker-only — Endpoint supervisionado de avanço de fase

- **Branch:** `claude/pr18-impl-advance-phase-endpoint`
- **Tipo:** `PR-IMPL`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR17 ✅ (commit `f0c1d29`, PR #178 mergeada — commit merge `38582b4`)
- **Escopo:** Worker-only. Apenas `nv-enavia.js`, novo smoke test e governança.

### Objetivo

Fechar o gap diagnosticado em PR17: criar endpoint HTTP supervisionado `POST /contracts/advance-phase` reutilizando integralmente `advanceContractPhase` de `contract-executor.js`. Sem duplicar lógica nem gate.

### Alterações em `nv-enavia.js`

1. **Imports** (linha ~14): adicionado `advanceContractPhase` ao import de `contract-executor.js`.
2. **`buildOperationalAction`** (linha ~4809):
   - `phase_complete` mapeia agora para `advance_phase` (não mais `block`).
   - Comentário do mapeamento atualizado.
   - `EVIDENCE_MAP` ganhou `advance_phase: ["contract_id"]`.
3. **`handleGetLoopStatus`** (linha ~5031):
   - `availableActions = ["POST /contracts/advance-phase"]` quando `nextAction.type === "phase_complete"`.
   - `guidance` reescrita para instruir o uso do endpoint (não diz mais "no phase-advance endpoint exists yet").
4. **Novo handler `handleAdvancePhase`** (antes de `handleExecuteNext`):
   - Lê body JSON; valida `contract_id` (aceita `contract_id` ou `contractId`).
   - Delega para `advanceContractPhase(env, contractId)`.
   - 200 → `{ ok: true, status: "advanced", contract_id, result }`.
   - 400 → JSON inválido ou `contract_id` ausente.
   - 409 → gate falhou ou contrato não encontrado, com `reason` derivada de `result.error/reason/gate.reason`.
   - 500 → exceção não esperada.
5. **Routing** (próximo a `/contracts/complete-task`): `POST /contracts/advance-phase` → `handleAdvancePhase`.
6. **Help text** atualizado com a nova rota.

### Não alterado (proibido pelo escopo)

- `contract-executor.js` (não foi necessário modificar — função já estava completa)
- `panel/`, `executor/`, deploy worker, workflows, `wrangler.toml`
- Nenhum gate paralelo criado, nenhuma lógica de avanço duplicada.

### Smoke tests

- `node --check nv-enavia.js` ✅
- `node --check tests/pr18-advance-phase-endpoint.smoke.test.js` ✅
- `node tests/pr18-advance-phase-endpoint.smoke.test.js` → **45 passed, 0 failed** ✅
- `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅ (regressão)
- `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **183 passed, 0 failed** ✅ (regressão)

### Cobertura do novo smoke test PR18 (5 seções, 45 asserts)

- **A. Validação de input:** JSON inválido → 400, body sem `contract_id` → 400, alias `contractId` aceito.
- **B. Avanço happy path:** `phase_complete` com gate ok → 200 + KV `state` e `decomposition` atualizados; única fase done → `current_phase = "all_phases_complete"`.
- **C. Gate de segurança:** task incompleta → 409, blockers persistidos no state; contract inexistente → 409 `CONTRACT_NOT_FOUND`.
- **D. `loop-status`:** expõe `availableActions = ["POST /contracts/advance-phase"]` e `operationalAction.type === "advance_phase"` com `can_execute: true`.
- **E. Isolamento:** `execute-next` em `phase_complete` NÃO avança fase implicitamente — avanço só via endpoint explícito.

### Bloqueios

Nenhum.

### Próxima etapa autorizada

**PR19** — `PR-PROVA` — Smoke real: `execute-next → complete-task → phase_complete → advance-phase → próxima task/fase` (ciclo completo de ponta a ponta).

---

## 2026-04-29 — PR17 — PR-DIAG — Diagnóstico READ-ONLY de phase_complete e avanço de fase

- **Branch:** `claude/pr17-diag-phase-complete-advance-phase`
- **Tipo:** `PR-DIAG`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR0 ✅ (commit `3629698`, PR #177 mergeada)
- **Escopo:** READ-ONLY. Nenhum arquivo de runtime alterado.

### Objetivo

Mapear o gap `phase_complete → advance-phase`: o sistema chega em `phase_complete` mas não possui mecanismo HTTP supervisionado de avanço de fase.

### Diagnóstico — 10 questões

#### 1. Como phase_complete é gerado?

`resolveNextAction(state, decomposition)` em `contract-executor.js` linha 1479 (Rule 4):

```js
// Rule 4: Check if ALL phase tasks are complete → phase_complete
const incompleteInPhase = phaseTasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status));
if (incompleteInPhase.length === 0 && phaseTasks.length > 0) {
  return {
    type: "phase_complete",
    phase_id: activePhase.id,
    task_id: null,
    reason: `All tasks in phase "${activePhase.id}" are complete. Ready to advance.`,
    status: "ready",
  };
}
```

Condição: todas as tasks da fase ativa com status em `["done", "merged", "completed", "skipped"]` e fase tem ao menos 1 task.

#### 2. O que o sistema faz atualmente quando chega em phase_complete?

`buildOperationalAction` em `nv-enavia.js` linha 4809:

```js
phase_complete: "block",
```

E no handler de `loop-status` (linha 5031–5034):

```js
} else if (nextAction.type === "phase_complete") {
  // Não há endpoint de avanço de fase disponível; documentar em guidance.
  guidance = "Phase complete. No phase-advance endpoint exists yet; manual phase transition required.";
}
```

**Resultado:** `availableActions = []` (vazia), `can_execute: false`, `guidance` informativo. O operador fica sem ação automática disponível — exige intervenção manual.

#### 3. advanceContractPhase existe?

**Sim.** `contract-executor.js` linha 1027–1117. Implementação completa. Exportada na linha 5120.

Fluxo interno:
1. `rehydrateContract(env, contractId)` — lê KV (INVARIANT 1+3)
2. `checkPhaseGate(state, decomposition)` — valida que todas as tasks da fase ativa estão done (INVARIANT 2)
3. Marca fase ativa como `"done"` na decomposição
4. Determina próxima fase (`current_phase = next_phase.id` ou `"all_phases_complete"`)
5. Persiste `contract:{id}:state` e `contract:{id}:decomposition` no KV

Retorna: `{ ok: true, state, decomposition, gate }` ou `{ ok: false, error, gate }`.

#### 4. advanceContractPhase está disponível via HTTP?

**Não.** Grep em `nv-enavia.js` por `advance-phase` e `advance_phase` → zero resultados. Não há rota `POST /contracts/advance-phase`.

#### 5. advanceContractPhase está importada em nv-enavia.js?

**Não.** Imports de `contract-executor.js` (linhas 1–30) listam: `handleCreateContract`, `handleGetContract`, `handleGetContractSummary`, `handleGetActiveSurface`, `handleExecuteContract`, `handleCloseContractInTest`, `handleCancelContract`, `handleRejectDecompositionPlan`, `handleResolvePlanRevision`, `handleCompleteTask`, `handleCloseFinalContract`, `resolveNextAction`, `startTask`, `buildExecutionHandoff`, `rehydrateContract`, `readExecEvent`, `readFunctionalLogs`, `handleGitHubPrAction`, `handleRequestMergeApproval`, `handleApproveMerge`, `handleBrowserArmAction`, `getBrowserArmState`, `getBrowserArmStateWithKV`. **`advanceContractPhase` ausente.**

#### 6. Qual estado precisa mudar para sair de phase_complete?

Em `advanceContractPhase`:
- `state.current_phase` → atualizado para o ID da próxima fase ou `"all_phases_complete"`
- `decomposition.phases[activeIndex].status` → marcado como `"done"`
- Ambos persistidos no KV: `contract:{id}:state` e `contract:{id}:decomposition`

#### 7. Quais KV keys/estado são lidos/escritos?

| Operação | KV Key |
|----------|--------|
| Leitura | `contract:{id}:state` |
| Leitura | `contract:{id}:decomposition` |
| Escrita | `contract:{id}:state` (current_phase atualizado) |
| Escrita | `contract:{id}:decomposition` (phase.status = "done") |

Via `rehydrateContract` (leitura) e puts diretos (escrita).

#### 8. Quais gates precisam existir antes de permitir avanço de fase?

`checkPhaseGate(state, decomposition)` — `contract-executor.js` linha 975:
- Encontra a primeira fase com `status !== "done"` (fase ativa)
- Filtra tasks da fase ativa
- Filtra tasks incompletas (`status NOT in ["done", "merged", "completed", "skipped"]`)
- Se `incompleteTasks.length > 0` → `{ canAdvance: false, reason: "Phase X has N incomplete task(s): ..." }`
- Se tudo completo → `{ canAdvance: true, reason: "Phase X acceptance criteria met." }`
- Se todas as fases já done → `{ canAdvance: true, activePhaseId: null, reason: "All phases are complete." }`

O gate já está implementado e já é chamado internamente por `advanceContractPhase`. Nenhum gate adicional precisa ser criado.

#### 9. Quais testes já cobrem ou não cobrem esse cenário?

**Cobrem via função direta (`advanceContractPhase` importada nos testes):**
- `tests/contracts-smoke.test.js`: Tests 18, 19, 20, 23, 24, 25 e dezenas de outros testes usam `advanceContractPhase` como setup ou como subject direto
- `tests/exec-event.smoke.test.js`: linha 90
- `tests/get-health-exec-event.smoke.test.js`: linha 98
- `tests/macro2-f5-enrichment.smoke.test.js`: linhas 101, 251
- `tests/get-execution-exec-event.smoke.test.js`: linha 94

**NÃO cobrem:**
- Nenhum teste de `POST /contracts/advance-phase` via HTTP endpoint (endpoint não existe)
- `tests/pr13-hardening-operacional.smoke.test.js` — zero ocorrências de `phase_complete`
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` — não testa phase_complete nem advance-phase

#### 10. Recomendação objetiva e patch mínimo para PR18

**Diagnóstico:** A função `advanceContractPhase` está **completa, testada e exportada** em `contract-executor.js`. O único gap é a **exposição HTTP supervisionada** via `POST /contracts/advance-phase` em `nv-enavia.js`. Não é necessário criar nenhuma lógica nova — apenas conectar o que já existe.

**Patch mínimo para PR18 (não implementado aqui):**

1. **`nv-enavia.js` — imports** (linha ~11): adicionar `advanceContractPhase` à lista de imports de `contract-executor.js`

2. **`nv-enavia.js` — novo handler** `handleAdvancePhase(request, env)`:
   - Ler `contractId` do body JSON
   - Chamar `await advanceContractPhase(env, contractId)`
   - Retornar JSON com resultado

3. **`nv-enavia.js` — routing** (após `complete-task`, linha ~8210):
   ```js
   if (method === "POST" && path === "/contracts/advance-phase") {
     const result = await handleAdvancePhase(request, env);
     return jsonResponse(result.body, result.status);
   }
   ```

4. **`nv-enavia.js` — `buildOperationalAction`** e handler de `loop-status` (linha ~5031): atualizar `phase_complete` para expor `availableActions = ["POST /contracts/advance-phase"]` em vez de guidance morto.

**Não criar:** nenhuma lógica nova de gate, nenhuma nova função de advance — reutilizar `advanceContractPhase` integralmente.

### Endpoints mapeados

| Endpoint | Existe? | Observação |
|----------|---------|------------|
| `POST /contracts/complete-task` | ✅ | Linha 8207 em nv-enavia.js |
| `GET /contracts/loop-status` | ✅ | Expõe phase_complete mas sem ação disponível |
| `POST /contracts/advance-phase` | ❌ AUSENTE | Gap confirmado |

### Smoke tests desta PR

- `git diff --name-only` na branch → apenas arquivos de governança (nenhum runtime) ✅
- `advanceContractPhase` exportada em `contract-executor.js` linha 5120 ✅ (confirmado via Read)
- Nenhum endpoint `/contracts/advance-phase` em `nv-enavia.js` ✅ (confirmado via Grep — zero resultados)
- `advanceContractPhase` ausente dos imports em `nv-enavia.js` ✅ (confirmado via Read linhas 1–30)
- `phase_complete` mapeia para `block` em `buildOperationalAction` ✅ (linha 4809)
- Guidance na linha 5034 documenta o gap explicitamente ✅

### Bloqueios

Nenhum. Diagnóstico completo. PR18 pode iniciar.

### Próxima etapa autorizada

**PR18** — PR-IMPL — Worker-only — Endpoint supervisionado de avanço de fase (`POST /contracts/advance-phase`).

---

## 2026-04-29 — PR0 (revisão) — Reestruturação do contrato PR17–PR30 por feedback

- **Branch:** `claude/pr0-docs-loop-obrigatorio`
- **Tipo:** `PR-DOCS` (revisão pós-feedback)
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **Escopo:** Docs-only. Sem alteração em Worker, Panel, Executor, Deploy Worker, workflows, JS/TS/JSX/TSX.
- **Motivo:** Feedback @brunovasque: contrato original priorizava "loop de skills" cedo demais. Gap real é o mecanismo de avanço de fase (`phase_complete → advance-phase`). Skills só devem entrar após loop perfeito + System/Tool Registry.
- **Alterações:**
  1. `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — seções 2, 4, 6–13 reestruturadas:
     - Seção 2: objetivo macro revisado com 4 frentes em ordem estrita de dependência.
     - Seção 4: nova ordem obrigatória de PRs (PR17=DIAG phase_complete, PR18=IMPL advance-phase, PR19=PROVA ciclo completo, PR20=IMPL loop-status in_progress, PR21=PROVA, PR22–PR25=DOCS system map, PR26–PR29=DOCS skills, PR30=fechamento).
     - Seções 6–13: detalhamento de cada PR com objetivo, pré-requisito, escopo e critérios de aceite.
  2. `schema/contracts/INDEX.md` — "Próxima PR autorizada" atualizada para PR17 com contexto do gap.
  3. `schema/status/ENAVIA_STATUS_ATUAL.md` — decisões de PR0 atualizadas com revisão.
  4. `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — próxima ação e descrição do contrato atualizadas.
  5. `schema/execution/ENAVIA_EXECUTION_LOG.md` — este bloco.
- **Smoke tests:**
  - `git diff --name-only` — confirma Docs-only ✅
  - Contrato contém `phase_complete` como prioridade antes de skills ✅
  - PR17 é PR-DIAG read-only ✅
  - Skills (PR26–PR29) só entram após PR21 e PR25 ✅
  - Nenhum endpoint de skills antes de PR26 ✅
  - Governança atualizada (status, handoff, execution log, INDEX.md) ✅
- **Bloqueios:** nenhum.
- **Próxima etapa autorizada:** PR17 — PR-DIAG — Diagnóstico READ-ONLY de `phase_complete` e avanço de fase.

---



- **Branch:** `claude/pr0-docs-loop-obrigatorio`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` (criado nesta PR)
- **Escopo:** Docs-only. Sem alteração em Worker, Panel, Executor, Deploy Worker, workflows, JS/TS/JSX/TSX.
- **Alterações:**
  1. `CLAUDE.md` — adicionada seção `## Loop obrigatório de execução por PR` (seção 4, 17 passos + regras de bloqueio); referência fixa ao contrato `PR1–PR7` removida; orientação para localizar contrato ativo em `schema/contracts/active/`; seções renumeradas 4→5, 5→6, 6→7, 7→8, 8→9; `schema/contracts/INDEX.md` adicionado à estrutura obrigatória.
  2. `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — criado. Novo contrato ativo PR17–PR30.
  3. `schema/contracts/INDEX.md` — criado. Índice central de todos os contratos.
  4. Governança: status, handoff, execution log atualizados.
- **Histórico de contratos:**
  - PR1–PR7: `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` — Encerrado ✅
  - PR8–PR16: `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` (+ fixes PR14–PR16) — Encerrado ✅
  - Novo: `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — Ativo 🟢
- **Smoke tests:**
  - `git diff --name-only` — confirma Docs-only ✅
  - `CLAUDE.md` contém `Loop obrigatório de execução por PR` ✅
  - `CLAUDE.md` não fixa mais `PR1–PR7` como contrato ativo exclusivo ✅
  - Status, handoff, execution log e INDEX.md atualizados ✅
- **Bloqueios:** nenhum.
- **Próxima etapa autorizada:** PR17 — PR-DIAG — Diagnóstico do estado atual do loop de skills.

---

## 2026-04-29 — PR16 — Fix: execute-next inicia task queued antes de delegar execução

- **Branch:** `claude/pr16-fix-execute-next-starttask`
- **Escopo:** Worker-only (`nv-enavia.js` + `tests/pr14-executor-deploy-real-loop.smoke.test.js`). Sem alteração em Executor, Panel, Deploy Worker externo, gates, contract-executor.js ou bindings.
- **Problema diagnosticado (READ-ONLY):** `POST /contracts/execute-next` retornava HTTP 409 `TASK_NOT_IN_PROGRESS` porque `resolveNextAction` retorna `start_task` para tasks em status `queued`, mas o fluxo não chamava `startTask` antes de delegar ao `handleExecuteContract`. O gate 2 de `executeCurrentMicroPr` exige `task.status === "in_progress"` e bloqueava. Adicionalmente, `handleGetLoopStatus` mostrava `availableActions: ["POST /contracts/execute"]` em vez do endpoint supervisionado canônico.
- **Correção cirúrgica (3 pontos):**
  1. `nv-enavia.js` — import de `startTask` de `contract-executor.js` adicionado.
  2. `nv-enavia.js` (`handleGetLoopStatus`): `availableActions` de `start_task`/`start_micro_pr` atualizado para `["POST /contracts/execute-next"]`.
  3. `nv-enavia.js` (`handleExecuteNext`, step D0): bloco inserido após `deploy simulate` OK e antes de `syntheticReq`. Se `nextAction.type === "start_task"` e `nextAction.task_id`, chama `startTask(env, contractId, nextAction.task_id)` com try/catch. Falha bloqueia com reason claro; sucesso segue para handler interno.
- **Testes novos (seção F):**
  - F1: task queued + tudo ok → startTask chamado, KV tem writes, NÃO retorna TASK_NOT_IN_PROGRESS.
  - F2: KV.put falha → startTask bloqueado, retorna blocked com reason.
  - F3: loop-status start_task → availableActions contém POST /contracts/execute-next, não contém POST /contracts/execute.
- **Testes executados:**
  - `node --check nv-enavia.js` → OK ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **183 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Arquivos alterados:**
  - `nv-enavia.js`
  - `tests/pr14-executor-deploy-real-loop.smoke.test.js`
  - `schema/status/ENAVIA_STATUS_ATUAL.md`
  - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
  - `schema/execution/ENAVIA_EXECUTION_LOG.md`

---

## 2026-04-29 — FIX — incluir `patch.content` no payload do Deploy Worker `/apply-test`

- **Branch:** `copilot/fix-nv-enavia-payload`
- **Escopo:** Worker-only. Sem alteração em Executor, Panel, Deploy Worker externo, gates ou bindings.
- **Problema:** após a PR174 (que corrigiu `target.workerId`), o loop operacional voltou a falhar em TEST com HTTP 400 `patch.content obrigatório` no `DEPLOY_WORKER /apply-test`. O `_deployPayload` já tinha `workerId`/`target.workerId`, mas não incluía o campo `patch`.
- **Correção cirúrgica:**
  1. `nv-enavia.js` (`handleExecuteNext`, step C do execute_next): `_deployPayload` agora inclui `patch: { type: "contract_action", content: JSON.stringify(nextAction) }`, reutilizando exatamente o mesmo shape já montado para `_proposePayload`.
  2. `tests/pr14-executor-deploy-real-loop.smoke.test.js` ampliado com 3 novos asserts (C5 e E1) para validar:
     - `/apply-test` recebe `patch` como objeto;
     - `patch.content` não vazio;
     - `patch.content` consistente com o mesmo campo enviado ao `/propose`.
- **Testes executados:**
  - `node --check nv-enavia.js` → OK ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **168 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Shape final do patch enviado ao /apply-test:**
  ```json
  { "type": "contract_action", "content": "<JSON.stringify(nextAction)>" }
  ```
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** revalidar o fluxo real `POST /contracts/execute-next` em TEST com `DEPLOY_WORKER` real e confirmar que `/apply-test` deixa de retornar `patch.content obrigatório`.

---

## 2026-04-29 — FIX — enviar `target.workerId` no payload do Deploy Worker `/apply-test`

- **Branch:** `copilot/nv-enavia-include-target-workerid`
- **Commit de código:** `354d9be`
- **Escopo:** Worker-only. Sem alteração em Executor, Panel, Deploy Worker externo ou bindings.
- **Problema:** o loop operacional já resolvia o target worker dinâmico para `POST /audit` e `POST /propose`, mas o `_deployPayload` enviado por `callDeployBridge(...)/apply-test` não carregava `workerId`/`target.workerId`. Em TEST isso gerava bloqueio real no Deploy Worker com HTTP 400 e erro `target.workerId obrigatório`.
- **Correção:**
  1. `nv-enavia.js` (`handleExecuteNext`, step C do execute_next) agora inclui `...buildExecutorTargetPayload(auditTargetResolution.workerId)` no `_deployPayload`.
  2. O payload de `/apply-test` passa a reutilizar exatamente a mesma fonte de verdade dinâmica já usada em `/audit` e `/propose`.
  3. `tests/pr14-executor-deploy-real-loop.smoke.test.js` foi ampliado para validar explicitamente que `/apply-test` recebe `workerId` e `target.workerId` consistente.
- **Testes executados:**
  - `node --check nv-enavia.js` → OK ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **164 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** revalidar o fluxo real em TEST com `DEPLOY_WORKER` real e confirmar que `/apply-test` deixa de retornar `target.workerId obrigatório`.

---

## 2026-04-29 — FIX — bootstrap do snapshot canônico do Executor no KV após deploy TEST

- **Branch:** `copilot/bootstrap-snapshot-canonico-executor-kv`
- **Commit de código:** `b4ba2a2`
- **Escopo:** Executor-only + workflow do executor. Sem alteração em `nv-enavia.js`, painel, Deploy Worker ou bindings.
- **Problema:** o self-audit do Executor em TEST já conseguia fazer live-read, mas continuava emitindo finding crítico `Snapshot canônico do executor ausente no KV` logo após deploy porque o namespace `ENAVIA_GIT_TEST` ainda não tinha bootstrap de snapshot para o runtime recém-publicado.
- **Correção:**
  1. `saveVersion(...)` em `executor/src/index.js` passou a sincronizar também o alias legado `git:code:latest` junto com o snapshot canônico (`git:latest` + `git:code:<id>`).
  2. `.github/workflows/deploy-executor.yml` ganhou a etapa `Bootstrap canonical Executor snapshot TEST` logo após `Deploy Executor TEST`.
  3. Essa etapa monta payload com o `executor/src/index.js` do commit atual e chama `POST /apply-patch` em `https://enavia-executor-test.brunovasque.workers.dev/apply-patch` com `auto_deploy:false`.
  4. O workflow falha cedo se o bootstrap não devolver `meta.id` canônico e `code_length` válido.
  5. O smoke `POST /audit` live-read continua rodando depois do bootstrap, validando a prova `snapshot_fingerprint`.
- **Testes executados:**
  - `node --check executor/src/index.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → **34 passed, 0 failed** ✅
  - `node --test executor/tests/cloudflare-credentials.test.js` → **4 passed, 0 failed** ✅
  - `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-executor.yml')); print('YAML válido')"` → YAML válido ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** rodar `Deploy enavia-executor` em `target_env=test` e confirmar no log do workflow o bootstrap via `/apply-patch` seguido do smoke `/audit` sem finding de snapshot ausente.

---

## 2026-04-29 — FIX — resolução canônica de credenciais Cloudflare no runtime do Executor

- **Branch:** `copilot/port-cloudflare-credentials-fix`
- **Commit de código:** `f73744b`
- **Escopo:** Executor-only + workflow do executor. Sem alteração em `nv-enavia.js`, painel, Deploy Worker ou gates de `risk_level`.
- **Problema:** o runtime `enavia-executor-test` publicado por este repo ainda resolvia credenciais Cloudflare de forma divergente entre `/audit`, `/propose`, listagem de scripts e live-read interno. Isso fazia o ramo `context.require_live_read:true` falhar com `CF_ACCOUNT_ID/CF_API_TOKEN ausentes no Executor.` mesmo quando os secrets existiam sob aliases compatíveis.
- **Correção:**
  1. Novo helper `executor/src/cloudflare-credentials.mjs` com:
     - `resolveCloudflareCredentials(env)`
     - `getCloudflareCredentialPresence(env)`
     - `createCloudflareCredentialsError(env, message)`
  2. Aliases suportados de forma canônica:
     - account: `CF_ACCOUNT_ID`, `CLOUDFLARE_ACCOUNT_ID`, `CF_ACCOUNT`, `CLOUDFLARE_ACCOUNT`
     - token: `CF_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CF_TOKEN`
  3. `/audit` e `/propose` agora usam o helper único e retornam apenas booleans `has_*` quando as credenciais faltam.
  4. Caminhos internos de Cloudflare API (`listCloudflareWorkerScripts`, live-read do worker alvo em `/audit`/`engineer`, snapshot helpers) foram alinhados ao mesmo resolver.
  5. Erros internos de live-read por credenciais ausentes propagam apenas `message` + booleans `has_*`, sem valores de credenciais.
  6. `.github/workflows/deploy-executor.yml` agora:
     - roda `node --test executor/tests/cloudflare-credentials.test.js`;
     - faz smoke `POST /audit` com `workerId`, `target.workerId` e `context.require_live_read:true`;
     - falha se a resposta mencionar credenciais ausentes;
     - falha se não houver `snapshot_fingerprint`.
- **Testes executados:**
  - `node --check executor/src/index.js` → OK ✅
  - `node --check executor/src/cloudflare-credentials.mjs` → OK ✅
  - `node --check executor/tests/cloudflare-credentials.test.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → **33 passed, 0 failed** ✅
  - `node --test executor/tests/cloudflare-credentials.test.js` → **4 passed, 0 failed** ✅
  - `python3 -c "import yaml; yaml.safe_load(...deploy-executor.yml...)"` → **YAML válido** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** disparar `Deploy enavia-executor` em TEST para publicar o patch e confirmar o smoke live-read no runtime `enavia-executor-test`.

---

## 2026-04-29 — FIX — target dinâmico para o Executor `/audit` em `POST /contracts/execute-next`

- **Branch:** `copilot/investigate-risk-level-audit`
- **Commit de código:** `d3e0ee2`
- **Escopo:** Worker-only. Sem tocar em painel, executor externo, KV runtime ou relaxamento do gate de recibo.
- **Problema:** o loop operacional chamava o Executor `/audit` com payload pobre, sem alvo confiável. Isso permitia `workerId` hardcoded no `/propose` e deixava o `/audit` sem `workerId`/`target.workerId`, o que inviabiliza auditoria segura do alvo real.
- **Correção:**
  1. `nv-enavia.js` passou a importar `buildExecutionHandoff`.
  2. Novo helper `resolveAuditTargetWorker(state, decomposition, nextAction)` resolve o alvo em ordem segura:
     - `state.current_execution.handoff_used.scope.workers`
     - micro-PR da `nextAction`
     - `buildExecutionHandoff(...).scope.workers`
     - `state.scope.workers`
  3. Se existir exatamente um alvo confiável:
     - `/audit` recebe `workerId`, `target.workerId` e `context.require_live_read:true`;
     - `/propose` reutiliza o mesmo `workerId`.
  4. Se não houver alvo confiável, `POST /contracts/execute-next` bloqueia antes do Executor com:
     - `status: "blocked"`
     - `reason: "target worker ausente para auditoria segura"`
  5. Se houver ambiguidade de múltiplos workers, o fluxo também bloqueia sem assumir um alvo artificial.
  6. Follow-up pós-code-review:
     - helper `buildExecutorTargetPayload(workerId)` evita duplicação do bloco `{ workerId, target }`;
     - testes PR14 agora validam payloads com null-check antes de fazer parse.
- **Smoke tests atualizados (`tests/pr14-executor-deploy-real-loop.smoke.test.js`):**
  - fixture `execute_next` agora inclui micro-PR TEST com `target_workers`.
  - fixture `approve` agora inclui `current_execution.handoff_used.scope.workers`.
  - novo cenário `C0`: bloqueio explícito sem target worker confiável, sem chamar Executor nem Deploy Worker.
  - cenário `C5`: valida que `/audit` recebe `workerId` dinâmico, `target.workerId` consistente e `context.require_live_read:true`.
  - cenário `D1`: valida `workerId` dinâmico também no path `approve`.
- **Validações locais:**
  - `node --check nv-enavia.js` → OK ✅
  - `node --check contract-executor.js` → OK ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **161 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** rodar o loop real em TEST com contrato/micro-PR contendo `target_workers` explícito e confirmar se o `/audit` do Executor retorna `risk_level` coerente com o alvo real, sem alterar o gate de recibo.

---

## 2026-04-29 — FIX — registrar recibo de audit aprovado antes do `/apply-test` (revisão pós-review)

- **Branch:** `copilot/nv-enavia-register-audit-receipt`
- **Escopo:** Worker-only. Correção dos dois bloqueios apontados no code review da PR:
  1. Rota de registro do recibo: `/audit` → `/__internal__/audit` (rota canônica confirmada)
  2. Validação forte antes de registrar o recibo: nova função `validateExecutorAuditForReceipt`
- **Correções desta sessão:**
  1. Rota do recibo corrigida para `/__internal__/audit`.
  2. `validateExecutorAuditForReceipt(executorAudit)` valida obrigatoriamente:
     - `executor_audit` existe e é objeto.
     - `verdict` extraído de `result.verdict | audit.verdict | verdict` é exatamente `"approve"`.
     - `risk_level` extraído não é `"high"` nem `"critical"`.
     - `risk_level` **desconhecido/null** retorna erro (sem default silencioso para "low" ou "medium").
  3. `extractDeployAuditRiskLevel` atualizado para incluir `"critical"` e retornar `null` para níveis desconhecidos.
  4. O campo `audit.ok=true` só é incluído no payload do recibo após validação bem-sucedida com dados reais.
  5. `deploy_route` reflete rota real (`/__internal__/audit` ou `/apply-test`).
- **Smoke tests ampliados (`tests/pr14-executor-deploy-real-loop.smoke.test.js`):**
  - B4a: verdict "conditional" (passa executor bridge, falha no gate de validação).
  - B4b: verdict "reject" → executor bridge bloqueia (deploy_status: not_reached).
  - B4c: verdict ausente → executor bridge bloqueia (deploy_status: not_reached).
  - B4d: verdict "approve" + risk_level "high" → gate de validação bloqueia.
  - B4e: verdict "approve" + risk_level "critical" → gate de validação bloqueia.
  - B4f: verdict "approve" + risk_level desconhecido → gate de validação bloqueia (sem fabricação).
  - Todas as asserções de rota no mock de deploy atualizadas para `/__internal__/audit`.
- **Validações locais:**
  - `node --check nv-enavia.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **148 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** validar o fluxo real em TEST com `DEPLOY_WORKER` real para confirmar que `POST /__internal__/audit` é aceito antes do `/apply-test`.

---

## 2026-04-29 — FIX — Resolver KV namespace IDs por title (deploy-executor.yml)

- **Branch:** `copilot/update-deploy-executor-workflow`
- **Commit:** `80fd164`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, executor runtime, painel, KV runtime, `wrangler.toml` principal ou bindings.
- **Problema:** o token/conta do GitHub Actions enxerga o namespace `enavia-brain-test`, mas o secret manual `ENAVIA_BRAIN_TEST_KV_ID` continuava validando como `INVALID`. Depender de 6 secrets manuais de KV ID gerava fragilidade e tentativa cega.
- **Correção:** o workflow passou a rodar `npx wrangler kv namespace list > /tmp/kv_namespaces.json` e resolver internamente os IDs pelo `.title`:
  - PROD: `enavia-brain`, `ENAVIA_GIT`.
  - TEST: `enavia-brain-test`, `ENAVIA_GIT_TEST`.
  - `GIT_KV_ID` reutiliza o ID resolvido de `ENAVIA_GIT`.
  - `GIT_KV_TEST_ID` reutiliza o ID resolvido de `ENAVIA_GIT_TEST`.
- **Segurança de logs:** o workflow imprime apenas titles/nomes e mensagens `KV namespace resolvido por title: <title>`. IDs não são impressos. Em erro de namespace ausente, a falha mostra apenas o title obrigatório faltante.
- **Secrets:** os 6 secrets manuais de KV ID não são mais exigidos nem referenciados no workflow. Continuam obrigatórios apenas `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
- **Arquivo gerado:** `wrangler.executor.generated.toml` continua sendo gerado a partir de `wrangler.executor.template.toml`.
- **Validações locais:**
  - `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-executor.yml')); print('YAML válido')"` → YAML válido ✅
  - Smoke local com `/tmp/kv_namespaces.json` sintético → resolução por title OK, TOML sem placeholders fora de comentários e output sem IDs ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** reexecutar `Deploy enavia-executor` em `target_env=test` e validar o deploy/smoke real.

---

## 2026-04-29 — DIAGNÓSTICO — Listar TÍTULOS dos KV namespaces visíveis na conta/token (deploy-executor.yml)

- **Branch:** `copilot/improve-validate-kv-namespace-ids`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, `executor/src/index.js`, `panel/`, `wrangler.toml`, bindings ou KV runtime.
- **Motivação:** A execução anterior provou que os 3 secrets `*_TEST_KV_ID` retornam `INVALID` enquanto os 3 PROD retornam `OK`. Para decidir entre "conta/token errado" vs "valor de secret errado" sem trocar secrets no escuro, é preciso saber quais KV namespaces o token do GitHub Actions efetivamente enxerga.
- **Patch:** Na etapa `Validate KV namespace IDs against Cloudflare`, após validar que `wrangler kv namespace list` retornou JSON array e antes do loop `check_kv`, imprime `KV namespaces visíveis nesta conta/token:` seguido de uma lista ordenada e única dos `.title` (com fallback para `.name`) de cada namespace, prefixados com `- `. Sem IDs. Sem secrets.
- **Comando-chave:** `jq -r '.[] | (.title // .name // empty)' /tmp/kv_namespaces.json | sort -u | sed 's/^/- /'`
- **Validação:** `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-executor.yml'))"` → OK.
- **Critério de leitura no próximo run:**
  1. Sem `enavia-brain-test` / `ENAVIA_GIT_TEST` / `enavia-executor-test` → problema é `CLOUDFLARE_ACCOUNT_ID`/token.
  2. Com eles na lista → problema é valor dos secrets TEST.
- **Próximo passo:** Reexecutar `Deploy enavia-executor` em TEST e analisar a nova seção "KV namespaces visíveis nesta conta/token".

---

## 2026-04-29 — FIX — Robustez do parse na validação de KV namespace IDs (deploy-executor.yml)

- **Branch:** `copilot/fix-validate-kv-namespace-ids`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, `executor/src/index.js`, `panel/`, `wrangler.toml`, bindings ou KV runtime.
- **Problema:** a etapa `Validate KV namespace IDs against Cloudflare` capturava `npx wrangler kv namespace list 2>&1` dentro de `KV_LIST_JSON`. Qualquer warning/banner em stderr contaminava o stdout e o `jq` passava a falhar para todos os checks, gerando falso-positivo de 6 secrets `INVALID`.
- **Correção:** stdout e stderr separados em arquivos temporários:
  1. `npx wrangler kv namespace list > /tmp/kv_namespaces.json 2> /tmp/wrangler_kv_list.err`
  2. Se o comando falhar, o workflow imprime erro claro + stderr e encerra.
  3. Se stdout não for JSON array válido, o workflow imprime erro claro + stderr + preview curto do stdout e encerra.
  4. `check_kv()` passou a consultar `/tmp/kv_namespaces.json` com `jq --arg id`, sem expor secret.
- **Validações locais:**
  - `node --check executor/src/index.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → **33 passed, 0 failed** ✅
  - `python3 yaml.safe_load(...)` em `.github/workflows/deploy-executor.yml` → **YAML válido** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** reexecutar o workflow `Deploy enavia-executor` em `target_env=test` e observar se a etapa passa a distinguir erro de parse JSON vs. KV ID realmente inválido.

---

## 2026-04-29 — FIX — Validação KV namespace IDs contra Cloudflare (deploy-executor.yml)

- **Branch:** `copilot/fix-kv-secret-validation`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, `executor/src/index.js`, `panel/`, `wrangler.toml`, KV runtime.
- **Problema:** Deploy falhava com `KV namespace '***' is not valid [code: 10042]`. O GitHub mascarava o valor com `***`, impossibilitando diagnóstico. Não era possível saber qual dos 6 KV secrets estava inválido.
- **Correção:** Nova etapa `Validate KV namespace IDs against Cloudflare` adicionada após `Setup Node` e antes de qualquer `wrangler deploy`. A etapa:
  1. Chama `npx wrangler kv namespace list` (requer `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`).
  2. Para cada um dos 6 secrets/bindings, verifica se o ID aparece no JSON retornado.
  3. Imprime `OK` ou `INVALID` sem imprimir o valor do secret.
  4. Se algum for INVALID, falha antes do deploy com mensagem clara.
- **Validação YAML:** `python3 yaml.safe_load(...)` → **YAML válido** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** rodar workflow `Deploy enavia-executor` com `target_env=test`. O output do novo step mostrará exatamente qual(is) KV ID(s) está(ão) inválido(s).

---

## 2026-04-29 — FIX — Validação falso-positivo no deploy-executor (comentários)

- **Branch:** `copilot/fix-validate-generated-config`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, `executor/`, `panel/`, `wrangler.toml`, KV.
- **Problema:** Passo "Validate generated config (no placeholders remaining)" usava `grep -q "REPLACE_WITH_REAL_"` que capturava o texto `REPLACE_WITH_REAL_*` em linhas de comentário do `wrangler.executor.generated.toml`, mesmo após todos os IDs terem sido substituídos.
- **Correção:** Substituído por `grep -v '^[[:space:]]*#' ... | grep -q "REPLACE_WITH_REAL_"` para ignorar linhas comentadas antes de buscar placeholders.
- **Evidência:** Grep antigo → "FALSO POSITIVO detectado"; grep novo → "OK: nenhum placeholder fora de comentários" ✅
- **Validação YAML:** `python3 yaml.safe_load(...)` → **YAML válido** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** rodar workflow `Deploy enavia-executor` com `target_env=test`.

---

## 2026-04-29 — INFRA-ONLY — Deploy separado para o Executor (enavia-executor-test / enavia-executor)

- **Branch:** `copilot/create-separate-deploy-executor`
- **Escopo:** Infra-only. Nenhuma alteração em `nv-enavia.js`, `contract-executor.js`, `executor/src/index.js`, `executor/src/audit-response.js`, `wrangler.toml` (principal), painel ou KV.
- **Arquivos criados:**
  1. `wrangler.executor.toml` — config de deploy do Executor: PROD (`enavia-executor`) e TEST (`enavia-executor-test`). `main = "executor/src/index.js"`. KV namespaces como placeholders (requer preenchimento com IDs reais antes do deploy).
  2. `executor/package.json` — declara dependência `acorn ^8.16.0` (usado em `executor/src/index.js`). Necessário para `npm install --prefix executor` no workflow.
  3. `.github/workflows/deploy-executor.yml` — workflow manual (`workflow_dispatch`) com input `target_env: test | prod`. Valida secrets, placeholders e roda testes antes do deploy.
- **Fluxo TEST:** `wrangler deploy --config wrangler.executor.toml --env test` → publica em `enavia-executor-test`.
- **Fluxo PROD:** `wrangler deploy --config wrangler.executor.toml` → publica em `enavia-executor`.
- **Smoke TEST embutido no workflow:** `POST /audit` em `enavia-executor-test` valida `result.verdict` e `audit.verdict`.
- **Testes executados localmente:**
  - `node --check executor/src/index.js` → OK ✅
  - `node --check executor/src/audit-response.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → **33 passed, 0 failed** ✅
  - Validação YAML: `python3 yaml.safe_load(...)` → **YAML válido** ✅
- **Bloqueios:** nenhum. KV namespace IDs precisam ser preenchidos no `wrangler.executor.toml` antes do primeiro deploy real.
- **Próxima etapa segura:** preencher IDs reais no `wrangler.executor.toml` e rodar o workflow `Deploy enavia-executor` com `target_env=test`.

---

## 2026-04-28 — PR14 ajuste P1 — bloquear JSON inválido em bridges do Executor/Deploy

- **Branch:** `claude/pr14-executor-deploy-real-loop`
- **PR:** #162
- **Escopo:** Worker-only. Ajuste cirúrgico em `nv-enavia.js` + smoke tests da PR14. Sem alteração em Panel, Executor externo, Deploy Worker externo, `contract-executor.js`, `executor/` ou `wrangler.toml`.
- **Diagnóstico:**
  1. `callExecutorBridge(...)` convertia parse inválido para `{ raw: ... }`; como isso é objeto, o fluxo ainda podia cair em `status: "passed"`.
  2. `callDeployBridge(...)` tinha o mesmo problema.
  3. Isso permitia tratar body HTTP 200 ilegível como resposta válida, o que é inseguro.
- **Patch aplicado:**
  1. `callExecutorBridge(...)` agora retorna imediatamente `ok:false`, `status:"ambiguous"`, `reason:"Resposta do Executor não é JSON válido."` e `data:{ raw }` quando `JSON.parse` falha.
  2. `callDeployBridge(...)` agora retorna imediatamente `ok:false`, `status:"ambiguous"`, `reason:"Resposta do Deploy Worker não é JSON válido."` e `data:{ raw }` quando `JSON.parse` falha.
  3. `tests/pr14-executor-deploy-real-loop.smoke.test.js` ampliado com:
     - `/propose` HTTP 200 + body não-JSON → bloqueia antes do deploy.
     - Deploy Worker HTTP 200 + body não-JSON → bloqueia antes do handler interno.
     - `makeKV().writes` para provar ausência de execução do handler interno.
- **Smoke tests:**
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **111 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **CI/Actions investigado:** run `Addressing comment on PR #162` (`25080312763`) encontrada em andamento; sem job falho no momento da inspeção.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** aguardar revisão do ajuste P1 na PR #162.

---

## 2026-04-28 — PR14 — Worker-only — Executor real + Deploy Worker no loop operacional

- **Branch:** `claude/pr14-executor-deploy-real-loop`
- **Escopo:** Worker-only. Apenas `nv-enavia.js`. Sem alteração em Panel, Executor externo, Deploy Worker externo, `contract-executor.js` ou `executor/`.
- **Helpers criados em `nv-enavia.js`:**
  1. `callExecutorBridge(env, route, payload)` — chama `env.EXECUTOR.fetch` para `/audit` e `/propose`. Bloqueia se `env.EXECUTOR` ausente, resposta não-ok, ambígua ou `verdict:reject`. Retorna `{ ok, route, status, reason, data }`.
  2. `callDeployBridge(env, action, payload)` — chama `env.DEPLOY_WORKER.fetch` apenas em modo seguro (`/apply-test`, `target_env:"test"`). Bloqueia ações de produção (approve/promote/prod), `target_env:prod` e ausência de binding. Retorna `{ ok, action, status, reason, data }`.
- **`buildExecutorPathInfo` atualizado:** `execute_next` e `approve` agora refletem `uses_service_binding: true` e o novo `handler` chain com bridges.
- **`handleExecuteNext` integrado:**
  - `execute_next`: gates atuais → audit → propose → deploy (simulate) → handler interno KV.
  - `approve`: gates atuais (confirm+approved_by) → audit → handler interno KV. Sem propose, sem deploy.
  - Produção automaticamente bloqueada.
  - Handler interno só roda depois de todos os bridges passarem.
- **Response estendida:** `executor_audit`, `executor_propose`, `executor_status`, `executor_route`, `executor_block_reason`, `deploy_result`, `deploy_status`, `deploy_route`, `deploy_block_reason` em todos os paths.
- **Smoke tests:**
  - `tests/pr14-executor-deploy-real-loop.smoke.test.js` → **93 passed, 0 failed** ✅
  - `tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅ (3 asserts atualizados para refletir mudança intencional de PR14 em `buildExecutorPathInfo`)
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** Novo contrato se necessário.

---

## 2026-04-28 — PR13 — Worker-only — hardening final e encerramento do contrato PR8–PR13

- **Branch:** `claude/pr13-hardening-final-operacional`
- **Contrato:** `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`
- **Escopo:** Worker-only. Diagnóstico e testes de hardening. Sem alteração em Panel, Executor ou `contract-executor.js`.
- **Diagnóstico:**
  1. CORS confirmado: `jsonResponse()` chama `withCORS()` internamente em todas as respostas.
  2. `GET /contracts/loop-status` confirmado no routing block; resposta inclui `ok`, `generatedAt`, `contract`, `nextAction`, `operationalAction`, `loop`.
  3. `POST /contracts/execute-next` confirmado com 8 gates: JSON inválido, sem KV, sem contrato, `can_execute:false`, evidence faltando, evidence presente, approve sem `confirm`, approve sem `approved_by`.
  4. `env.EXECUTOR.fetch` confirmado como NÃO chamado em nenhum path do execute-next (fluxo inteiramente KV).
  5. Rollback confirmado como recomendação pura — sem execução automática.
  6. `Promise.race` ausente — design correto para handlers que mutam KV.
- **Smoke test criado:** `tests/pr13-hardening-operacional.smoke.test.js`
  - Seção A: shape do loop-status, CORS, sem KV, index vazio, contrato ativo
  - Seção B: todos os gates do execute-next
  - Seção C: isolamento do executor, rollback como recomendação, status presente em todos os paths
  - Seção D: CORS no execute-next, OPTIONS preflight
  - **Resultado: 91 passed, 0 failed ✅**
- **Bloqueios:** nenhum.
- **Contrato PR8–PR13: FORMALMENTE ENCERRADO ✅**
- **Próxima etapa segura:** Nenhuma. Contrato concluído.

---

## 2026-04-28 — PR12 Ajuste — feedback da PR #160 na `LoopPage`

- **Branch:** `claude/pr12-panel-botoes-operacionais`
- **PR:** #160
- **Escopo:** Panel-only. Ajuste cirúrgico em `panel/src/pages/LoopPage.jsx` + teste direcionado. Sem alteração em Worker, Executor, `contract-executor.js` ou `wrangler.toml`.
- **Patch aplicado:**
  1. Seção "Status do Loop" passou a usar `loopData.contract.{id,status,current_phase,current_task,updated_at}`.
  2. `loop` ficou restrito aos campos de supervisão (`canProceed`, `blockReason`, `availableActions`, `guidance`).
  3. `handleExecute` agora prioriza `r.data` mesmo com `r.ok === false`, preservando o payload canônico do backend.
  4. Teste direcionado adicionado em `panel/src/__tests__/pr12-loop-page-contract-and-error-payload.test.js`.
- **Smoke tests:**
  - `npx vitest run src/__tests__/pr12-loop-page-contract-and-error-payload.test.js` → 4 testes, 4 passed ✅
  - `npm test` → 31 arquivos, 894 testes passed ✅
  - `npm run build` → 141 modules transformed, 0 errors ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR13 — Worker-only — hardening final.

---

## 2026-04-28 — PR12 — Panel-only — botões operacionais no painel

- **Branch:** `claude/pr12-panel-botoes-operacionais`
- **Contrato:** `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`
- **Escopo:** Panel-only. Sem alteração em Worker, Executor, `contract-executor.js` ou `wrangler.toml`.
- **Arquivos criados:**
  - `panel/src/api/endpoints/loop.js` — `fetchLoopStatus()` (GET /contracts/loop-status) + `executeNext(body)` (POST /contracts/execute-next).
  - `panel/src/pages/LoopPage.jsx` — página `/loop` com loop operacional completo.
- **Arquivos alterados:**
  - `panel/src/api/index.js` — exports de `fetchLoopStatus` e `executeNext`.
  - `panel/src/App.jsx` — rota `/loop` → `<LoopPage />`.
  - `panel/src\Sidebar.jsx` — item "Loop" com badge "PR12" entre Contrato e Saúde.
- **Funcionalidades da LoopPage:**
  1. `GET /contracts/loop-status` — carrega ao montar + botão Atualizar.
  2. Exibe `loop.status_global`, `canProceed`, `blockReason`, `availableActions`.
  3. Exibe `operationalAction` (type, can_execute, block_reason, evidence_required).
  4. Exibe `nextAction` contratual em seção colapsável.
  5. Zona de execução: campo `approved_by` + botão desabilitado quando `can_execute: false`.
  6. Chama `POST /contracts/execute-next` com `{ confirm: true, approved_by, evidence: [] }`.
  7. Exibe resultado com badge de status (EXECUTADO/BLOQUEADO/AGUARDANDO APROVAÇÃO/ERRO).
  8. Seção colapsável de detalhes: `evidence`, `rollback`, `executor_path`, `execution_result`.
  9. Em modo mock: aviso honesto ("configure VITE_NV_ENAVIA_URL").
  10. Backend bloqueia → painel mostra motivo. Sem decisão no front.
- **Smoke tests:**
  - `npx vite build` → 141 modules transformed, 0 errors ✅.
  - Aviso de chunk pré-existente, não relacionado às mudanças.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR13 — Worker-only — hardening final.

---

## 2026-04-28 — PR11 — Worker-only — integração segura com executor

- **Branch:** `claude/pr11-integracao-segura-executor`
- **Contrato:** `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`
- **Escopo:** Worker-only. Diagnóstico do caminho executor + auditoria, sem timeout local inseguro. Sem alteração em Panel, Executor ou `contract-executor.js`.
- **Diagnóstico realizado:**
  - `env.EXECUTOR.fetch` é usado APENAS em `handleEngineerRequest` (rota `/engineer`, proxy direto). NÃO é usado no fluxo de contratos.
  - Caminho `handleExecuteNext → handleExecuteContract → executeCurrentMicroPr` é integralmente KV puro. Sem Service Binding.
  - `executeCurrentMicroPr` tem supervisor gate, task status check, TEST-only guard e active micro-PR check — gates suficientes.
- **Alterações em `nv-enavia.js`:**
  1. Helper puro `buildExecutorPathInfo(env, opType)` — retorna `{ type, handler, uses_service_binding, service_binding_available, note }`.
  2. `handleExecuteContract` (step 6) mantido sem `Promise.race`: o handler pode alterar KV, e timeout local não cancela a Promise original.
  3. `handleCloseFinalContract` (step 7) mantido sem `Promise.race`: mesmo motivo acima.
  4. Código documenta explicitamente que, sem `AbortSignal`/cancelamento real, timeout local seria inseguro.
  5. Timeout seguro fica para PR futura somente com handler cancelável/idempotente.
  6. Campo `executor_path` adicionado a todos os paths de resposta (aditivo backward-compat). Paths antes do step 4: `null`. Paths após: `executorPathInfo`.
- **Campos novos no response (backward-compat):**
  - `executor_path: { type, handler, uses_service_binding, service_binding_available, note }`
- **Smoke tests:**
  - `node --test tests/pr8-hardening-producao.smoke.test.js` → 41 passed, 0 failed.
  - `node --input-type=module <<'EOF' ... worker.fetch('/contracts/execute-next') ... EOF` → `executor_path` presente nos paths `blocked` e `awaiting_approval`; `EXECUTOR.fetch` não chamado.
  - `node --input-type=module <<'EOF' ... fs.readFileSync('./nv-enavia.js') ... EOF` → `handleExecuteNext` sem `Promise.race` e sem `env.EXECUTOR.fetch`.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR12 — Panel-only — botões operacionais no painel.

---

## 2026-04-28 — PR10 Ajuste — honestidade de validação em `execute-next`

- **Branch:** `claude/pr10-gates-evidencias-rollback`
- **PR:** #158
- **Escopo:** Worker-only. Ajuste cirúrgico em `nv-enavia.js` apenas. Sem alteração em Panel, Executor ou `contract-executor.js`.
- **Problema tratado:** o gate de `evidence` já aceitava `evidence: []`, o que é correto como ACK operacional mínimo, mas o response ainda não deixava explícito que PR10 faz somente validação de presença, não validação semântica profunda.
- **Patch aplicado:**
  1. `buildEvidenceReport(...)` agora retorna também `validation_level: "presence_only"` e `semantic_validation: false`.
  2. O bloqueio por ausência de `evidence` agora explica: campo obrigatório mesmo vazio para ACK operacional mínimo; validação atual é apenas de presença.
  3. Mantido comportamento atual: sem campo `evidence` → bloqueado; com `evidence: []` → prossegue.
- **Smoke tests:**
  - `node --input-type=module <<'EOF' ... worker.fetch('/contracts/execute-next') ... EOF` → sem `evidence` retorna bloqueio com mensagem explícita + `validation_level`; com `evidence: []` mantém `missing: []` ✅
  - `node tests/pr8-hardening-producao.smoke.test.js` → 41 passed, 0 failed ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR11 — integração segura com executor.

---

## 2026-04-28 — PR10 — Worker-only — gates, evidências e rollback

- **Branch:** `claude/pr10-gates-evidencias-rollback`
- **Contrato:** `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`
- **Escopo:** Worker-only. Adição de helpers puros + enriquecimento de `handleExecuteNext`. Sem persistência nova. Sem alteração em Panel, Executor ou `contract-executor.js`.
- **Helpers criados (puros, `nv-enavia.js:4991–5059`):**
  - `buildEvidenceReport(opType, contractId, body)` → `{ required, provided, missing }`.
  - `buildRollbackRecommendation(opType, contractId, executed)` → `{ available, type, recommendation, command }`.
- **Gates adicionados a `handleExecuteNext`:**
  1. Contrato ausente / KV indisponível → `status: "blocked"`, `evidence: null, rollback: null`.
  2. Estado terminal → `status: "blocked"`, `evidence: null, rollback: null`.
  3. `can_execute !== true` → bloqueado com `evidence` + `rollback`.
  4. `evidenceReport.missing.length > 0` → bloqueado com `evidence` + `rollback`.
  5. `approve` sem `confirm === true` → `status: "awaiting_approval"`.
  6. `approve` sem `approved_by` → 400.
  7. Resultado ambíguo (status 200 sem `ok` explícito) → bloqueado + log de aviso.
  8. Tipo sem caminho seguro → `status: "blocked"`.
- **Campos adicionados ao response (backward-compat):**
  - `evidence: { required, provided, missing }` — auditabilidade de evidências.
  - `rollback: { available, type, recommendation, command }` — orientação de rollback sem execução.
- **Smoke tests:**
  - `execute_next` sem `evidence` no body → `missing: ["evidence[]"]` → bloqueado ✅.
  - `execute_next` com `evidence: []` no body → `missing: []` → prossegue ✅.
  - `approve` sem `confirm` → `awaiting_approval` com `evidence` + `rollback` ✅.
  - Execução sucedida → `rollback: { available: true, type: "manual_review" }` ✅.
  - Bloqueio → `rollback: { available: false, type: "no_state_change" }` ✅.
  - Panel/Executor/`contract-executor.js` intocados ✅.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR11 — integração segura com executor.

---

## 2026-04-28 — PR9 Ajuste — Gate booleano estrito em `handleExecuteNext`

- **Branch:** `claude/pr9-execute-next-supervisionado`
- **Problema:** Gate `if (!body.confirm)` aceitava truthy não booleanos (`"false"`, `"yes"`, `1`) como aprovação. Inseguro para gate humano.
- **Correção:** `if (body.confirm !== true)` — boolean estrito. Apenas `true` (JS boolean) passa.
- **Smoke tests:** `confirm: false` → bloqueado ✅; `confirm: "false"` → bloqueado ✅; `confirm: 1` → bloqueado ✅; `confirm: true` + `approved_by` → passa ✅; `execute_next` inalterado ✅.
- **Bloqueios:** nenhum.

---

## 2026-04-28 — PR9 — Worker-only — `POST /contracts/execute-next` supervisionado

- **Branch:** `claude/pr9-execute-next-supervisionado`
- **Contrato:** `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`
- **Escopo:** Worker-only. Criação de `handleExecuteNext` + rota `POST /contracts/execute-next`. Sem alteração em Panel, Executor ou `contract-executor.js`.
- **Handler criado:** `handleExecuteNext(request, env)` em `nv-enavia.js:4991–5181`.
- **Fluxo do endpoint:**
  1. Parse body (`confirm`, `approved_by`, `evidence`).
  2. Valida KV disponível.
  3. Localiza contrato ativo mais recente (não-terminal) via `rehydrateContract`.
  4. Chama `resolveNextAction` + `buildOperationalAction`.
  5. Gate primário: se `operationalAction.can_execute !== true` → retorna `status: "blocked"`.
  6. `execute_next` → synthetic Request → `handleExecuteContract` (handler interno existente).
  7. `approve` → gate humano (`confirm: true` + `approved_by`) → synthetic Request → `handleCloseFinalContract`.
  8. Fallback: qualquer tipo sem caminho mapeado → `status: "blocked"`.
- **Resposta canônica:** `{ ok, executed, status, reason, nextAction, operationalAction, execution_result?, audit_id }`.
- **Smoke tests:**
  - `git diff --name-only origin/main...HEAD` → somente `nv-enavia.js` + governança ✅.
  - `block` quando `can_execute: false` ✅.
  - `awaiting_approval` quando `approve` sem `confirm` ✅.
  - `execute_next` delega a `handleExecuteContract` sem chamar executor externo ✅.
  - Panel/Executor/`contract-executor.js` intocados ✅.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR10 — gates, evidências e rollback.

---

## 2026-04-28 — PR8 Ajuste — Correção `contract_complete` em `buildOperationalAction`

- **Branch:** `claude/pr8-operational-action-contract`
- **Problema:** `contract_complete` mapeava para `close_final` → `can_execute: true`. Inconsistente com PR6, onde `contract_complete` não expunha `availableActions`. Contrato já concluído não deve anunciar ação executável.
- **Correção:** `contract_complete` → `"block"` no `OP_TYPE_MAP`. `block_reason` específico: `"Contrato já concluído. Nenhuma ação adicional disponível."`.
- **Smoke tests:** `contract_complete` → `can_execute: false` ✅; `awaiting_human_approval` → `approve`/`can_execute: true` ✅; `start_task`/`start_micro_pr` → `execute_next`/`can_execute: true` ✅; Panel/Executor intocados ✅.
- **Bloqueios:** nenhum.

---

## 2026-04-28 — PR8 — Worker-only — contrato operacional de ações e estado

- **Branch:** `claude/pr8-operational-action-contract`
- **Contrato:** `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`
- **Escopo:** Worker-only. Diagnóstico de rotas + criação de shape canônico `buildOperationalAction`. Sem execução real. Sem alteração em Panel ou Executor.
- **Diagnóstico de rotas:**
  - `GET /contracts/loop-status` (PR6) — read-only, retorna `nextAction` + `loop`. Base para o loop operacional.
  - `POST /contracts/execute` — requer `contract_id`, opcional `evidence[]`. Executa micro-PR atual em TEST.
  - `POST /contracts/complete-task` — requer `contract_id`, `task_id`, `resultado`. Gate de aderência obrigatório.
  - `POST /contracts/close-final` — requer `contract_id`. Gate final pesado do contrato.
  - `POST /contracts/cancel` — cancelamento formal.
  - `POST /contracts/reject-plan` — rejeição formal do plano de decomposição.
- **Mapeamento `nextAction.type` → tipo operacional:**
  - `start_task` / `start_micro_pr` → `execute_next` (endpoint: `POST /contracts/execute`)
  - `awaiting_human_approval` → `approve` (endpoint: `POST /contracts/close-final`)
  - `contract_complete` → `close_final` (endpoint: `POST /contracts/close-final`)
  - `contract_blocked` / `phase_complete` / `plan_rejected` / `contract_cancelled` / `no_action` → `block`
- **Código adicionado:**
  - `buildOperationalAction(nextAction, contractId)` — função pura em `nv-enavia.js` (~4799–4835). Produz o shape canônico: `{ action_id, contract_id, type, requires_human_approval, evidence_required, can_execute, block_reason }`.
  - `GET /contracts/loop-status` enriquecido com campo `operationalAction` (aditivo, backward-compat).
- **Smoke tests:** `git diff --stat origin/main...HEAD` → somente `nv-enavia.js` + governança ✅.
- **Alterações em Panel/Executor:** nenhuma.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR9 — `POST /contracts/execute-next` supervisionado.

---

## 2026-04-28 — PR7 — Worker-only — diagnóstico de schemas desconectados

- **Branch:** `claude/pr7-schemas-orquestracao`
- **Escopo:** Worker-only. Diagnóstico formal + governança. Sem alteração de código.
- **Schemas avaliados (30 total = 21 JS + arquivos MD/PDF/não-JS):**
  - **Já conectados (21):** `planner-classifier`, `planner-output-modes`, `planner-canonical-plan`, `planner-approval-gate`, `planner-executor-bridge`, `memory-consolidation`, `memory-storage`, `memory-schema`, `memory-read`, `memory-retrieval`, `enavia-cognitive-runtime`, `operational-awareness`, `learning-candidates`, `memory-audit-log` (via `nv-enavia.js`) + `contract-adherence-gate`, `execution-audit`, `contract-final-audit`, `autonomy-contract`, `github-pr-arm-contract`, `browser-arm-contract`, `security-supervisor` (via `contract-executor.js`).
  - **Desconectados (9):** `contract-active-state`, `contract-adherence-engine`, `contract-cognitive-advisor`, `contract-cognitive-orchestrator`, `contract-ingestion`, `enavia-capabilities`, `enavia-constitution`, `enavia-identity`, `planner-memory-audit`.
- **Schemas integrados:** nenhum.
- **Justificativas de não-integração:**
  - `contract-active-state.js` — KV próprio (`KV_ACTIVE_CONTRACT_KEY`) paralelo ao `readContractState`/`rehydrateContract` — integrar criaria estado duplicado.
  - `contract-adherence-engine.js`, `contract-cognitive-advisor.js`, `contract-cognitive-orchestrator.js` — dependem de `contract-active-state.js` (bloqueio acima); sem ponto de integração no ciclo atual sem refatoração.
  - `contract-ingestion.js` — upstream do ciclo; requereria novo endpoint de ingestão fora do escopo de PR7.
  - `enavia-capabilities.js`, `enavia-constitution.js`, `enavia-identity.js` — conteúdo estático; sem fluxo consumidor no ciclo atual. Identidade já coberta por `enavia-cognitive-runtime.js`.
  - `planner-memory-audit.js` — diagnóstico PM1-PM9 útil mas sem endpoint consumidor; memória já funciona via imports existentes.
- **Smoke tests:** `git diff --name-only` → somente arquivos de governança ✅. `git diff --stat origin/main...HEAD` → 0 linhas de código alteradas ✅.
- **Alterações em Panel/Executor:** nenhuma.
- **Alterações em código de produção:** nenhuma.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** contrato PR1–PR7 formalmente concluído.

---

## 2026-04-28 — PR6 Ajuste — Correções `awaiting_human_approval` e `phase_complete` em `handleGetLoopStatus`

- **Branch:** `claude/pr6-loop-supervisionado`
- **PR:** #154 — ajuste cirúrgico solicitado via comentário Codex
- **Escopo:** Worker-only. `nv-enavia.js` apenas.
- **Problema 1 corrigido:** `awaiting_human_approval` tem `status: "awaiting_approval"` — nunca entrava no guard `isReady`. Movido para `else if (isAwaitingApproval)` fora do bloco `isReady`. `canProceed` atualizado para `isReady || isAwaitingApproval`.
- **Problema 2 corrigido:** `phase_complete` anunciava `complete-task`/`execute` que falham deterministicamente sem task `in_progress`. `availableActions` agora é `[]`; campo `guidance` documenta ausência de endpoint de avanço de fase.
- **Smoke tests:** 3 cenários verificados via node (awaiting_human_approval, phase_complete, start_task). Handler read-only confirmado (sem KV put).
- **Arquivos alterados:** `nv-enavia.js` (somente).
- **Panel/Executor/contract-executor.js:** sem alteração.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** aguardar merge PR6, iniciar PR7 (`claude/pr7-schemas-orquestracao`) após autorização.

---

## 2026-04-26 — Setup de governança

- **Branch:** `claude/setup-governance-files`
- **Escopo:** criar estrutura mínima de governança exigida por `CLAUDE.md`.
- **Ações:**
  - Validado `CLAUDE.md` na raiz.
  - Confirmado contrato ativo `schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md`.
  - Criadas pastas: `schema/status/`, `schema/handoffs/`, `schema/execution/`.
  - Criados arquivos:
    - `schema/status/ENAVIA_STATUS_ATUAL.md`
    - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
    - `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)
- **Smoke tests:** `git status` + verificação de existência dos arquivos.
- **Alterações em código de produção:** nenhuma.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR1 — active surface em branch separada.

---

## 2026-04-26 — PR1 — Worker-only — `GET /contracts/active-surface`

- **Branch:** `claude/pr1-active-surface`
- **Escopo:** Worker-only. Sem tocar Panel, sem tocar lógica de execução.
- **Diagnóstico:**
  - Rota `GET /contracts/active-surface` já existia em `nv-enavia.js` linha 6937.
  - Handler: `handleGetActiveSurface` em `contract-executor.js` linha 3597.
  - CORS: aplicado via `jsonResponse → withCORS` (ok).
  - Shape anterior: `{ ok, active_state, adherence }` — Panel lê `active_state` e `adherence`.
  - Shape exigido por PR1: adicionar `source`, `contract`, `surface`.
- **Ações:**
  - Patch cirúrgico em `contract-executor.js` função `handleGetActiveSurface`:
    - Adicionados: `source: "active-contract"`, `contract: { id, title, status, current_phase, current_pr, updated_at }`, `surface: { available, next_action, blocked, block_reason }`.
    - Mantidos: `active_state` e `adherence` (backward-compat com Panel).
    - `current_pr` usa `state.current_task` como fallback explícito (campo dedicado inexistente — documentado).
- **Smoke tests:**
  - `git diff contract-executor.js` — revisado manualmente, apenas `handleGetActiveSurface` alterada.
  - Estrutura de resposta verificada contra shape do contrato.
- **Alterações em código de produção:** `contract-executor.js` — 1 função, additive only.
- **Bloqueios:** nenhum.
- **Status:** mergeada na main.
- **Próxima etapa segura:** PR2 — Executor-only.

---

## 2026-04-26 — PR2 — Executor-only — espelho governado do `enavia-executor`

- **Branch:** `claude/pr2-executor-governado`
- **Escopo:** Executor-only. Sem alterar Worker, Panel, deploy externo, Service Binding.
- **Diagnóstico:**
  - `enavia-executor` é Cloudflare Worker separado em repo privado `brunovasque/enavia-executor`.
  - Nenhuma pasta `executor/` existia no repo `nv-enavia`.
  - Código-fonte acessado via GitHub API com autenticação `gh`.
  - `src/index.js` do executor: 247.531 bytes, rotas confirmadas: `/health`, `/audit`, `/propose`, `/engineer`, `/engineer-core`, `/boundary`, `/status`.
  - Bug documentado: linha 5722 de `nv-enavia.js` usa `https://executor.invalid/audit` — URL inválida, a ser corrigida em PR4.
- **Ações:**
  - Criada pasta `executor/` com 5 arquivos:
    - `executor/src/index.js` — cópia fiel do repo externo (245.762 chars)
    - `executor/wrangler.toml` — referência sanitizada (sem IDs/secrets reais)
    - `executor/README.md` — explica espelho governado, Service Binding, deploy externo
    - `executor/CONTRACT.md` — contrato canônico: entradas, saídas, rotas, compatibilidade
    - `executor/tests/executor.contract.test.js` — smoke test estático
- **Smoke tests:**
  - `node executor/tests/executor.contract.test.js` → 23 passed, 0 failed
  - `git status` → apenas `executor/` como novo, sem alterações em Worker/Panel
- **Alterações em código de produção:** nenhuma (apenas arquivos novos em `executor/`)
- **Bloqueios:** nenhum.
- **Status:** mergeada na main.
- **Próxima etapa segura:** PR3 — Panel-only — ligar painel no backend real.

---

## 2026-04-26 — PR3 — Panel-only — ligar painel no backend real

- **Branch:** `claude/pr3-panel-backend-real`
- **Escopo:** Panel-only. Sem alterar Worker, Executor, deploy externo, Service Binding ou componentes React.
- **Diagnóstico:**
  - `panel/vercel.json` tinha `VITE_API_MODE: "mock"` hardcoded — forçava mock em produção.
  - `panel/src/api/config.js` já tinha lógica correta: se `VITE_NV_ENAVIA_URL` estiver definido, o default é `real`.
  - O `VITE_API_MODE: "mock"` explícito sobrescrevia esse default.
  - ContractPage, HealthPage e ExecutionPage já estavam preparados para modo real — faltava apenas a configuração de deploy.
- **Ações:**
  - Patch cirúrgico em `panel/vercel.json`:
    - Adicionado `VITE_NV_ENAVIA_URL: "https://nv-enavia.brunovasque.workers.dev"`.
    - Alterado `VITE_API_MODE: "mock"` para `VITE_API_MODE: "real"`.
- **Smoke tests:**
  - Simulação de `config.js` com novos valores → `baseUrl: https://nv-enavia.brunovasque.workers.dev`, `mode: real`.
  - `curl GET /contracts/active-surface` → 200, `{ ok: true, source: "active-contract" }`.
  - `curl GET /health` → 200, `{ ok: true, health: {...} }`.
  - `curl GET /execution` → 200, `{ ok: true, execution: {...} }`.
- **Alterações em código de produção:** `panel/vercel.json` — 1 linha adicionada, 1 linha alterada.
- **Worker/Executor:** nenhuma alteração.
- **Bloqueios:** nenhum.
- **Status:** mergeada na main.
- **Próxima etapa segura:** PR4 — Worker-only — fixes cirúrgicos de confiabilidade.

---

## 2026-04-26 — PR4 — Worker-only — fixes cirúrgicos de confiabilidade

- **Branch:** `claude/pr4-worker-confiabilidade`
- **Escopo:** Worker-only. Sem alterar Panel, Executor, `contract-executor.js`, `executor/` ou `wrangler.toml`.
- **Diagnóstico e decisões:**
  1. **URL `executor.invalid` (linha 5722):** corrigida para `https://enavia-executor.internal/audit`. Verificado: 0 ocorrências restantes.
  2. **`ENAVIA_BUILD.deployed_at`:** data stale atualizada para 2026-04-26. Limitação documentada — sem API runtime disponível; automação futura requer CI/CD injection.
  3. **`consolidateAfterSave()`:** dead code confirmado (definida mas nunca chamada). Marcada formalmente fora do escopo de PR4; candidata para PR6.
- **Patch:** `nv-enavia.js` — 2 patches pontuais, total de 4 linhas alteradas.
- **Smoke tests:**
  - `git diff --name-only` → somente `nv-enavia.js` ✅
  - `grep -c "executor.invalid" nv-enavia.js` → 0 ✅
  - `grep -n "consolidateAfterSave" nv-enavia.js` → apenas definição, 0 chamadas ✅
- **Alterações em Panel/Executor:** nenhuma.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR5 — Worker-only — observabilidade real mínima (`/health` e `/execution`).

---

## 2026-04-26 — PR5 — Worker-only — observabilidade real mínima consolidada

- **Branch:** `claude/pr5-observabilidade-real`
- **Escopo:** Worker-only. Sem alterar Panel, Executor, `contract-executor.js`, `executor/` ou `wrangler.toml`.
- **Diagnóstico:**
  - `handleGetHealth` já lia `exec_event` real, mas `blockedExecutions` era sempre `[]` e `summary.blocked` sempre `0`.
  - `handleGetExecution` já lia trail + exec_event + functional logs. Faltava `decision:latest`.
  - Fonte real disponível para "bloqueadas": `decision:latest` (P14) — decisões `rejected` pelo gate humano.
- **Patches em `nv-enavia.js` (commit d2db458):**
  1. **`handleGetHealth`:** leitura de `decision:latest` (não-crítica). `blockedExecutions` agora reflete decisões P14 rejeitadas. `summary.blocked` = `blockedExecutions.length`. Campo `latestDecision` adicionado. Status `"degraded"` se há bloqueios.
  2. **`handleGetExecution`:** leitura de `decision:latest` (não-crítica). Campo `latestDecision` adicionado como top-level aditivo (backward-compat).
- **Ajuste complementar (PR #153):** adicionado `_limitations: { blockedExecutions: "derived_from_latest_decision_only" }` ao health response — deixa explícito que `blockedExecutions` é derivado apenas da última decisão P14, não é lista histórica completa.
- **Smoke tests:**
  - `git diff --name-only origin/main...HEAD` → somente `nv-enavia.js` + arquivos de governança ✅
  - `grep -c "decision:latest" nv-enavia.js` → 7 ✅
  - `grep -n "latestDecision" nv-enavia.js` → 7 ocorrências nos dois handlers ✅
  - `grep -n "_limitations" nv-enavia.js` → presente em todos os paths de `handleGetHealth` ✅
  - `summary.total >= blocked` em ambos os paths: `total = blockedExecutions.length` (sem exec_event) e `total = 1 + blockedExecutions.length` (com exec_event) ✅
- **Alterações em Panel/Executor:** nenhuma.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR6 — Worker-only — loop contratual supervisionado.

---

## 2026-04-28 — PR6 — Worker-only — loop contratual supervisionado

- **Branch:** `claude/pr6-loop-supervisionado`
- **Escopo:** Worker-only. Sem alterar Panel, Executor, `contract-executor.js`, `executor/`, `panel/` ou `wrangler.toml`.
- **Diagnóstico:**
  - `resolveNextAction(state, decomposition)` já existe em `contract-executor.js` linha 1371 — 9 regras, retorna `{ type, phase_id, task_id, micro_pr_candidate_id, reason, status }`. Já é exportada.
  - `rehydrateContract(env, contractId)` já existe — lê state + decomposition do KV via `Promise.all`.
  - Ambas já exportadas mas NÃO importadas no Worker.
  - Não havia endpoint público `GET /contracts/loop-status` — operador/painel não conseguia consultar próxima ação sem disparar execução.
  - `TERMINAL_STATUSES = ["completed", "cancelled", "failed"]` — não exportada; usada inline.
- **Patches em `nv-enavia.js`:**
  1. **Import:** `resolveNextAction` e `rehydrateContract` adicionados aos imports de `contract-executor.js`.
  2. **Handler:** `async function handleGetLoopStatus(env)` adicionado — read-only, lê index, encontra contrato ativo, chama `resolveNextAction`, retorna `{ ok, generatedAt, contract, nextAction, loop }`.
  3. **Rota:** `GET /contracts/loop-status` adicionado ao router, após `GET /contracts/active-surface`.
- **Shape de resposta:**
  - `loop.supervised: true` — sempre; nunca automação cega.
  - `loop.canProceed` — derivado de `nextAction.status === "ready"`.
  - `loop.blocked` / `loop.blockReason` — derivados de `nextAction.status === "blocked"`.
  - `loop.availableActions` — lista de endpoints disponíveis no estado atual.
- **Garantias:**
  - Zero KV puts no handler — puramente leitura.
  - Sem dispatch ao executor.
  - Backward-compat total — nova rota, endpoints existentes intocados.
- **Smoke tests:**
  - `git diff --name-only` → somente `nv-enavia.js` ✅
  - `grep "resolveNextAction" nv-enavia.js` → importado na linha 14, usado na linha 4865 ✅
  - `grep "rehydrateContract" nv-enavia.js` → importado na linha 15, usado na linha 4839 ✅
  - `grep "loop-status" nv-enavia.js` → handler + rota presentes ✅
  - Verificação estrutural via node: handler sem KV put, `supervised: true`, `canProceed`, `blockReason` todos presentes ✅
- **Alterações em Panel/Executor:** nenhuma.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR7 — Worker-only — integrar schemas desconectados.

---

## 2026-04-29 — PR15: EXECUTOR-ONLY: contrato `/audit` com verdict explícito

- **Branch:** `copilot/fix-audit-response-contract`
- **Escopo:** EXECUTOR-ONLY. Nenhuma mudança em Worker `nv-enavia`, Painel, Deploy Worker ou KV.
- **Problema observado em smoke real TEST:**
  - `POST /contracts` → 201, `GET /contracts/loop-status` → contrato ativo, `POST /contracts/execute-next` → chama binding `EXECUTOR`.
  - `POST /audit` no Executor real (`enavia-executor-test`) respondia HTTP 200 com JSON válido, mas sem `verdict`.
  - `nv-enavia.js → callExecutorBridge` (linha 5179) bloqueava com: `Audit sem verdict explícito. Resposta ambígua bloqueada por segurança.`
- **Patch cirúrgico:**
  - `executor/src/index.js` — handler `POST /audit` (return final, ~linha 991): injeta `verdict` (`approve`/`reject`) e `risk_level` no objeto `result`, e adiciona campo top-level `audit: { verdict, risk_level }` espelhando os mesmos valores. Restante do envelope (`system`, `executor`, `route`, `received_action`, `evidence`, `pipeline`, `result.map`) preservado.
  - `executor/CONTRACT.md` — exemplo de Response 200 atualizado e nota PR15 explicando o mapeamento.
- **Mapeamento determinístico:**
  - `execResult.ok === false` → `verdict: "reject"`.
  - Caso contrário → `verdict: "approve"`.
  - `risk_level` deriva de `riskReport.risk_level | level | risk`, fallback `execResult.risk_level`, fallback final `"low"`.
- **Garantias:**
  - Zero alteração em comportamento dos demais handlers (`/propose`, `/engineer`, `/health`, `/boundary`, `/status`).
  - Compatível com ambos os ramos do contrato do Worker (`data.result.verdict` e `data.audit.verdict`).
  - Não altera lógica do core_v2 — apenas o envelope de resposta do `/audit`.
- **Smoke tests:**
  - `node --check executor/src/index.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → 23/23 ✅
  - Mocks em `tests/pr14-executor-deploy-real-loop.smoke.test.js` confirmam o formato esperado pelo Worker (`result: { verdict: "approve", risk_level: "low" }`).
- **Rollback:** `git revert <commit>` desta PR; arquivos afetados isolados em `executor/src/index.js`, `executor/CONTRACT.md` e governança.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** deploy do Executor em TEST e re-rodar smoke real `execute-next` para confirmar `executor_status: "passed"`.

### 2026-04-29 — follow-up PR15: regra conservadora do `verdict`

- **Origem:** comentário de revisão na PR (`comment_id: 4340101564`).
- **Risco apontado:** a primeira versão do patch aprovava qualquer caso que não fosse `ok === false`, o que ainda permitia `approve` em payload vazio, `error:true`, `status:"failed"` ou `ok` ausente.
- **Correção aplicada (Executor-only):**
  - Novo helper puro `executor/src/audit-response.js`.
  - `normalizeAuditVerdict(execResult)`:
    - retorna `"approve"` somente com `execResult.ok === true` **e** `execResult.error !== true`;
    - retorna `"reject"` em qualquer outro caso;
    - preserva `execResult.verdict` apenas quando já for `"approve"` (com sucesso explícito) ou `"reject"`;
    - descarta valores inválidos como `"passed"` e recalcula de forma conservadora.
  - `normalizeAuditRiskLevel(execResult, riskReport)`:
    - aceita apenas valores string não-vazios vindos de `riskReport` ou `execResult.risk_level`;
    - fallback final seguro `"low"`.
- **Arquivos alterados:**
  - `executor/src/audit-response.js`
  - `executor/src/index.js`
  - `executor/tests/executor.contract.test.js`
  - `executor/CONTRACT.md`
  - governança (`schema/status`, `schema/handoffs`, `schema/execution`)
- **Testes:**
  - `node executor/tests/executor.contract.test.js` → 33/33 ✅
  - `node --check executor/src/index.js` → OK ✅
  - `node --check executor/src/audit-response.js` → OK ✅
  - `node --check executor/tests/executor.contract.test.js` → OK ✅
- **Escopo preservado:** sem mudanças em `nv-enavia.js`, `panel/`, Deploy Worker, KV ou `wrangler.toml`.
- **Próxima etapa segura:** deploy do Executor em TEST e repetir o smoke real do loop para validar o mesmo comportamento no binding `EXECUTOR`.
