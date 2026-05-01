# ENAVIA — Latest Handoff

**Data:** 2026-05-01
**De:** PR50 — PR-PROVA — Prova do Classificador de Intenção v1
**Para:** PR51 — PR-IMPL — Skill Router read-only

## O que foi feito nesta sessão

### PR50 — PR-PROVA — Prova do Classificador de Intenção v1

**Tipo:** `PR-PROVA` (Worker-only, prova pura)
**Branch:** `copilot/claudepr50-prova-teste-intencao`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR49 ✅ (PR-IMPL — Classificador de Intenção v1)

**Objetivo:**
Provar formalmente que o Classificador de Intenção v1 (PR49) funciona corretamente no
fluxo real do chat/prompt, preservando anti-bot, LLM Core, Brain Context, gates e
comportamento operacional. Nenhum runtime alterado.

**Resultado:**
✅ **124/124 asserts. 821/821 total com regressões.**

**Cenários provados (13):**
- A: Conversa simples não operacional ✅
- B: Frustração/desconfiança não operacional ✅
- C: Identidade, capacidade e estado do sistema ✅
- D: Próxima PR não operacional ✅
- E: Revisão de PR (operacional) ✅
- F: Diagnóstico técnico (operacional) ✅
- G: Deploy/execução (operacional com governança) ✅
- H: Contrato: ação vs pergunta conceitual ✅
- I: Skill: execução vs pergunta, Skill Router inexistente ✅
- J: Memória supervisionada, sem escrita ✅
- K: Estratégia não operacional pesada ✅
- L: Regressões PR37/PR38 preservadas ✅
- M: Campo `intent_classification` validado ✅

**Arquivos novos:**
- `tests/pr50-intent-runtime.prova.test.js` — 124 asserts, 13 cenários
- `schema/reports/PR50_PROVA_TESTE_INTENCAO.md` — relatório completo

**Arquivos NÃO alterados (prova pura):**
`schema/enavia-intent-classifier.js`, `nv-enavia.js`, `schema/enavia-cognitive-runtime.js`,
`schema/enavia-llm-core.js`, `schema/enavia-brain-loader.js`, painel, executor,
deploy worker, workflows, wrangler. Nenhum endpoint criado.

**Resultados dos testes:**
- PR50 prova: **124/124** ✅
- PR49 smoke: **96/96** ✅
- Regressões: **697/697** ✅
- **Total: 821/821** ✅

---

## Próxima PR autorizada

**PR51 — PR-IMPL — Skill Router read-only**

Objetivo: Implementar o Skill Router read-only que roteia pedidos `skill_request`
para skills documentais existentes (`schema/skills/`), sem criar endpoint `/skills/run`
em runtime. Classificador identifica a intenção; Skill Router seleciona e retorna
conteúdo documental da skill solicitada.

**Pré-requisito:** PR50 ✅ (concluída — 821/821 testes passando)

**O que está disponível para a PR51:**
- `classifyEnaviaIntent()` com `INTENT_TYPES.SKILL_REQUEST`
- Skills documentais em `schema/skills/` (4 skills: CONTRACT_LOOP_OPERATOR, DEPLOY_GOVERNANCE_OPERATOR, SYSTEM_MAPPER, CONTRACT_AUDITOR)
- `isOperationalMessage()` já identifica `skill_request` como `is_operational=true`
- `buildChatSystemPrompt()` estável



## O que foi feito nesta sessão

### PR49 — PR-IMPL — Classificador de Intenção v1

**Tipo:** `PR-IMPL` (Worker-only, cirúrgica)
**Branch:** `copilot/claudepr49-impl-classificador-intencao`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR48 ✅ (PR-IMPL cirúrgica — PR47 79/79 após correção)

**Objetivo:**
Implementar o Classificador de Intenção v1 para separar, de forma determinística e
segura, os principais tipos de mensagem antes de aplicar tom operacional, planner,
skill futura ou resposta conversacional. Retorno ao contrato principal após exceção
corretiva PR48.

**Arquitetura implementada:**
- `schema/enavia-intent-classifier.js` — Classificador de Intenção v1
  - `classifyEnaviaIntent({ message, context })` → `{ intent, confidence, is_operational, reasons, signals }`
  - `INTENT_TYPES` — 15 intenções canônicas
  - `CONFIDENCE_LEVELS` — high/medium/low
  - Pure function, determinístico, sem I/O, sem side-effects
- `nv-enavia.js` (patch mínimo):
  - Import do classificador
  - `isOperationalMessage()` delegando ao classificador como fonte primária
  - Campo aditivo `intent_classification` no response do `/chat/run`

**Intenções canônicas implementadas:**
`conversation`, `frustration_or_trust_issue`, `identity_question`, `capability_question`,
`system_state_question`, `next_pr_request`, `pr_review`, `technical_diagnosis`,
`execution_request`, `deploy_request`, `contract_request`, `skill_request`,
`memory_request`, `strategy_question`, `unknown`

**Garantias preservadas:**
- Frustração não ativa modo operacional
- Próxima PR não ativa modo operacional pesado
- Revisão de PR ativa operação
- Diagnóstico técnico ativa operação
- Deploy/execução ativa operação com governança
- Falsos positivos PR37/PR38 continuam corrigidos
- LLM Core intacto
- Brain Context intacto
- Anti-bot intacto
- read_only como gate (não tom) intacto

**Arquivos novos:**
- `schema/enavia-intent-classifier.js` — classificador v1
- `tests/pr49-intent-classifier.smoke.test.js` — 96 asserts, 14 cenários
- `schema/reports/PR49_IMPL_CLASSIFICADOR_INTENCAO.md` — relatório completo

**Arquivos modificados:**
- `nv-enavia.js` — import + isOperationalMessage + intent_classification aditivo
- `schema/contracts/INDEX.md` — próxima PR: PR50
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (este arquivo)
- `schema/execution/ENAVIA_EXECUTION_LOG.md`

**Arquivos NÃO alterados (escopo cirúrgico preservado):**
`schema/enavia-brain-loader.js`, `schema/enavia-cognitive-runtime.js`,
`schema/enavia-llm-core.js`, painel, executor, deploy worker, workflows,
`wrangler.toml`, `wrangler.executor.template.toml`, KV/bindings/secrets,
sanitizers, gates. Nenhum endpoint criado. Nenhum Skill Router implementado.
Nenhuma escrita de memória.

**Resultados dos testes:**
- PR49 smoke: **96/96** ✅
- PR47 prova: **79/79** ✅
- Regressões: **601/601** ✅
- **Total: 697/697** ✅

---

## Próxima PR autorizada

**PR50 — PR-PROVA — Teste de intenção**

Objetivo: criar prova formal do Classificador de Intenção v1, validando todos os
cenários do smoke em versão prova, integração real com o prompt do chat via
`isOperationalContext`, edge cases e mensagens ambíguas, e regressões completas.

**Pré-requisito:** PR49 ✅ (concluída — 697/697 testes passando)

**O que está disponível para a PR50:**
- `classifyEnaviaIntent()` testável isoladamente
- `isOperationalMessage()` delegando ao classificador
- `intent_classification` no response do `/chat/run`
- Todos os 15 INTENT_TYPES exportados e testáveis
- `buildChatSystemPrompt()` com integração completa



## O que foi feito nesta sessão

### PR48 — PR-IMPL — Correção cirúrgica do LLM Core v1

**Tipo:** `PR-IMPL` (Worker-only, patch cirúrgico)
**Branch:** `copilot/claudepr48-impl-correcao-cirurgica-llm-core-v1`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR47 ✅ (mergeada — PR #208, falha parcial 75/79 documentada)

**Objetivo:**
Corrigir os 4 achados reais da PR47 (regras tonais truncadas pelo Brain Loader)
sem abrir nova frente e sem avançar para Classificador de Intenção.

**Causa raiz:**
O snapshot do Brain Loader satura o limite de 4.000 chars logo após a regra 4
de `schema/brain/self-model/how-to-answer.md`. Regras 5–10 não chegavam ao
runtime. Especificamente ausentes: regra 7 (próxima PR = curta + prompt
completo + sem reabrir) e regra 8 (excesso documental → "Isso é opcional. Não
mexa agora.").

**Correção:**
Regras críticas movidas para `buildLLMCoreBlock()` no `schema/enavia-llm-core.js`,
em nova seção `COMPORTAMENTO OPERACIONAL`. O LLM Core sempre entra no prompt
e não pode ser truncado.

**Arquivos novos:**
- `tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` — 20 asserts
- `schema/reports/PR48_IMPL_CORRECAO_CIRURGICA_LLM_CORE_V1.md` — relatório completo

**Arquivos modificados:**
- `schema/enavia-llm-core.js` — seção COMPORTAMENTO OPERACIONAL adicionada
- `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` — [ACHADO PR47] removidos; tolerâncias de tamanho atualizadas
- `tests/pr46-llm-core-v1.smoke.test.js` — tolerâncias de tamanho atualizadas (consequência do LLM Core change)
- `schema/contracts/INDEX.md` — próxima PR autorizada: PR49
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (este arquivo)
- `schema/execution/ENAVIA_EXECUTION_LOG.md`

**Arquivos NÃO alterados (escopo cirúrgico preservado):**
`schema/enavia-brain-loader.js`, `schema/enavia-cognitive-runtime.js`,
`nv-enavia.js`, painel, executor, deploy worker, workflows, `wrangler.toml`,
`wrangler.executor.template.toml`, KV/bindings/secrets, sanitizers, gates,
endpoints.

**Achados corrigidos:**

| Achado | Descrição | Status |
|--------|-----------|--------|
| C1 | "excesso documental" ausente do prompt | ✅ Corrigido |
| C2 | "Isso é opcional. Não mexa agora." ausente | ✅ Corrigido |
| D1 | "resposta curta + prompt completo" ausente | ✅ Corrigido |
| D2 | "sem reabrir discussão" ausente | ✅ Corrigido |

**Medição de prompt pós-PR48:**

| Cenário | PR46 | PR48 | Delta |
|---------|------|------|-------|
| A — simples | 10.496 | 11.228 | +732 |
| B — target ro | 10.738 | 11.470 | +732 |
| E — operacional | 12.363 | 13.095 | +732 |
| F — completo | 12.435 | 13.167 | +732 |

Aumento de +732 chars (~183 tokens) documentado e aceito conforme enunciado PR48.

**Testes:**
- `node --check` em todos os arquivos alterados → OK
- PR48 smoke: **20/20** ✅
- PR47 prova: **79/79** ✅ (era 75/79)
- PR46 smoke: **43/43** ✅
- Regressões obrigatórias: **601/601** ✅

## Próxima etapa segura

**PR49 — PR-IMPL — Classificador de intenção**

Exceção corretiva PR48 encerrada. PR47 passou integralmente (79/79). Retorno ao
fluxo principal do contrato `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`.

A PR49 deve implementar o Classificador de intenção conforme previsto
originalmente como "PR48" no contrato antes do desvio cirúrgico.

## Bloqueios

Nenhum. Branch sem conflitos com main. Nenhum arquivo proibido foi alterado.
Governança atualizada.

## Riscos restantes

1. **R1 (baixo):** +732 chars por conversa (aceito — comportamento corrigido).
2. **R2 (baixo):** Brain Loader ainda trunca regras 5–10 de how-to-answer, mas
   as críticas agora estão no LLM Core. Não é mais um risco ativo.


## O que foi feito nesta sessão

### PR47 — PR-PROVA — Prova de Resposta Viva LLM Core v1

**Tipo:** `PR-PROVA` (sem alteração de runtime)
**Branch:** `copilot/claudepr47-prova-resposta-viva-llm-core-v1`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR46 ✅ (mergeada — PR #207)

**Objetivo:**
Provar que o LLM Core v1 (PR46) preserva ou melhora a qualidade da resposta da
Enavia, sem voltar ao comportamento robótico, sem criar falsa capacidade, sem
quebrar anti-bot, sem relaxar governança.

**Arquivos novos:**
- `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` — 10 cenários A–J, 79 asserts
- `schema/reports/PR47_PROVA_RESPOSTA_VIVA_LLM_CORE_V1.md` — relatório completo

**Arquivos modificados:**
- `schema/contracts/INDEX.md` — próxima PR autorizada virou PR48 cirúrgica
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (este arquivo)
- `schema/execution/ENAVIA_EXECUTION_LOG.md`

**Arquivos NÃO alterados (nenhum runtime tocado):**
`nv-enavia.js`, `schema/enavia-llm-core.js`, `schema/enavia-cognitive-runtime.js`,
`schema/enavia-brain-loader.js`, painel, executor, deploy worker, workflows,
`wrangler.toml`, `wrangler.executor.template.toml`, KV/bindings/secrets,
sanitizers, prompt real, gates, endpoints.

**Resultado da prova: ⚠️ FALHOU PARCIALMENTE — 75/79 asserts (94,9%)**

| Cenário | Resultado |
|---------|-----------|
| A — Identidade viva | ✅ 12/12 |
| B — Pergunta de capacidade | ✅ 11/11 |
| C — Frustração / anti-bot emocional | ⚠️ 7/9 (2 achados) |
| D — Pedido de próxima PR | ⚠️ 4/6 (2 achados) |
| E — Pedido operacional real | ✅ 7/7 |
| F — Falsa capacidade bloqueada | ✅ 5/5 |
| G — `read_only` como gate | ✅ 7/7 |
| H — Tamanho/duplicação | ✅ 14/14 |
| I — Envelope JSON preservado | ✅ 5/5 |
| J — Sanitizers/gates preservados | ✅ 7/7 |

**4 achados reais (causa raiz única):** o snapshot do Brain Loader trunca em
4.000 chars antes de incluir regras 5–10 de
`schema/brain/self-model/how-to-answer.md`. Especificamente ausentes do
prompt em runtime:

- **C1:** "excesso documental" (regra 8)
- **C2:** "Isso é opcional. Não mexa agora." (regra 8)
- **D1:** "resposta curta + prompt completo" (regra 7)
- **D2:** "sem reabrir discussão" (regra 7)

**O que foi preservado integralmente:**
- Identidade viva (Enavia, IA operacional estratégica, LLM-first, não é Enova/NV/atendente).
- Capacidades sem falsa autonomia (Skill Router runtime / `/skills/run` /
  Intent Engine completo declarados como ainda NÃO existentes).
- Anti-bot operacional: frustração não ativa MODO OPERACIONAL.
- `read_only` como gate de execução, não tom.
- Skills documentais vs runtime: skills citadas como guias documentais.
- Tamanho/duplicação sem regressão: A=10.496 (-449), B=10.738 (-449),
  E=12.363 (-449), F=12.435 (-1.254) chars vs PR45 baseline. "NV Imóveis" 3x.
- Envelope JSON `{reply, use_planner}` preservado.

**Testes:**
- `node --check` em `enavia-llm-core.js`, `enavia-cognitive-runtime.js`,
  `enavia-brain-loader.js`, `pr47-resposta-viva-llm-core-v1.prova.test.js` → OK
- PR47 prova: **75/79 (4 achados documentados)**
- Regressões obrigatórias: PR46 (43/43) ✅, PR44 (38/38) ✅, PR43 (32/32) ✅,
  PR37 (56/56) ✅, PR36 (26/26) ✅, PR21 (53/53) ✅, PR20 (27/27) ✅,
  PR19 (52/52) ✅, PR14 (183/183) ✅, PR13 (91/91) ✅ → **601/601 ✅**

## Próxima etapa segura

**PR48 — PR-IMPL — Correção cirúrgica do LLM Core v1 (regras tonais truncadas)**

Conforme contrato PR47 ("Se a prova falhar… próxima PR deve ser PR48 — PR-IMPL —
Correção cirúrgica do LLM Core v1"), a próxima PR NÃO é o Classificador de
intenção, mas a correção cirúrgica.

**Escopo sugerido (a detalhar no prompt da PR48):**
1. Levar regras 6, 7 e 8 de `how-to-answer.md` para o **LLM Core** (ou para um
   bloco compacto adjacente), evitando depender do truncamento variável do
   Brain Loader.
2. Frase canônica "Isso é opcional. Não mexa agora." precisa estar no prompt
   em runtime.
3. Política "próxima PR = resumo curto + prompt completo + sem reabrir
   discussão" precisa estar no prompt em runtime.
4. Reavaliar o snapshot do Brain Loader: ou aumentar limite por bloco para a
   fonte `how-to-answer.md`, ou compactar as regras 1–4 para abrir espaço
   para 5–10. Manter limite total ≤ 4.000 chars como princípio.

**Escopo proibido em PR48 cirúrgica:**
- Não implementar Intent Engine.
- Não implementar Skill Router runtime.
- Não criar `/skills/run`.
- Worker-only / patch cirúrgico.

Após PR48 cirúrgica + nova PR-PROVA verde, então sim avançar para PR49 com o
Classificador de intenção (antiga PR48 — Intent Engine v1).

## Bloqueios

Nenhum bloqueio impeditivo de criar PR47. Branch sem conflitos com `main`.
Nenhum runtime alterado. Governança atualizada. Achados são tonais e estão
documentados no relatório PR47.

## Riscos restantes

1. **R1 (alto, mapeado):** Truncamento do Brain Loader corta regras 5–10 de
   how-to-answer. Endereçável na PR48 cirúrgica.
2. **R2 (baixo):** Identidade, capacidades, limitações e gates de segurança
   seguem firmes — os achados são tonais, não de segurança.
3. **R3 (baixo):** "próxima PR" aparece no prompt como capability, mas SEM a
   política de tom associada (regra 7). Endereçável na PR48 cirúrgica.
