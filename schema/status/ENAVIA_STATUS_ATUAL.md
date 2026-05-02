# ENAVIA — Status Atual

**Data:** 2026-05-02 (atualizado após PR65 — Blueprint do Runtime de Skills ✅)
**Branch ativa:** `copilot/claudepr65-docs-blueprint-runtime-skills`
**Última tarefa:** PR65 — PR-DOCS — Blueprint documental do Runtime de Skills. Pasta `schema/skills-runtime/` criada com 8 arquivos. Arquitetura futura, contrato de execução, gates de aprovação, matriz de capacidades, modelo de segurança, rollout por fases (0–6) e 12 open questions para PR66 documentados. Brain/governança atualizados. Nenhum runtime alterado. Relatório: `schema/reports/PR65_BLUEPRINT_RUNTIME_SKILLS.md`.

## Estado atual do sistema

**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` — Ativo 🟢 (ampliado para PR31-PR64)

**Objetivo do contrato:** Transformar a Enavia de sistema governado/documental em uma IA operacional viva — LLM Core, Memory Brain, Skill Router, Intent Engine, Self-Audit e resposta LLM-first.

**Frase central:** "A Enavia pensa livremente, lembra com estrutura, sugere com inteligência e executa somente com governança."

**Sistema operacional:** Estável. Runtime não alterado. Loop contratual supervisionado funcional.

## Causa raiz do chat engessado (PR32) + ajustes contratuais (PR33)

A Enavia responde como bot porque:
1. O painel sempre coloca o sistema em "MODO OPERACIONAL ATIVO read_only" via target default (`panel/src/chat/useTargetState.js:35-49`).
2. O prompt traduz `read_only` como regra de tom em vez de bloqueio de execução (`nv-enavia.js:4097-4099`, `schema/enavia-cognitive-runtime.js:239-241`).
3. Não existe LLM Core / Intent Engine / Skill Router / Brain conectado ao runtime — apenas um prompt monolítico orientado a governança (`schema/enavia-cognitive-runtime.js:93-329`).
4. Dois sanitizadores pós-LLM substituem respostas vivas por frases robóticas fixas (`nv-enavia.js:3530-3583, 4177, 4397-4401`).
5. O contrato JSON `{reply, use_planner}` força respostas curtas estruturadas (`schema/enavia-cognitive-runtime.js:319-326`).

Detalhes completos em `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`.

**Correção contratual (PR33):** O contrato foi atualizado com Regras R1-R4 para garantir que o Brain seja construído sobre a base correta. O Obsidian Brain não pode ser construído antes da correção conceitual. PR34 diagnosticou especificamente read_only, target default e sanitizers.

**Diagnóstico PR34 (refinamento):** A causa técnica foi refinada em 7 camadas (origem no painel → leitura no Worker → tradução semântica em prompts → geração no LLM → pós-processamento por sanitizers → constrangimento por envelope JSON → roteamento por planner). Detalhes em `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`.

**Mode Policy PR35:** Política criada em `schema/policies/MODE_POLICY.md`. `read_only` definido como gate de execução. 3 modos canônicos (conversation/diagnosis/execution). Target default não decide tom. Contrato ajustado para PR36 ser PR-IMPL. Diagnóstico suficiente — próxima entrega é produto.

## Próxima PR autorizada

**PR66 — PR-DIAG — Diagnóstico técnico para Runtime de Skills**

> ✅ PR65 (PR-DOCS) — concluída. Blueprint documental do Runtime de Skills criado. Pasta `schema/skills-runtime/` com 8 arquivos: INDEX.md, ARCHITECTURE.md (fluxo 11 camadas), EXECUTION_CONTRACT.md, APPROVAL_GATES.md, SKILL_CAPABILITY_MATRIX.md, SECURITY_MODEL.md, ROLLOUT_PLAN.md (Fases 0–6), OPEN_QUESTIONS.md (12 perguntas para PR66). SYSTEM_AWARENESS (seção 9), unresolved-technical-gaps (G1/G2 atualizados), future-risks (R10-R13 adicionados), skills/INDEX.md (referência ao blueprint) atualizados. Relatório: `schema/reports/PR65_BLUEPRINT_RUNTIME_SKILLS.md`. Nenhum runtime alterado. Nenhum endpoint criado.
> ✅ PR64 (PR-DOCS) — concluída. Encerramento formal da frente de atualização supervisionada de memória. Contrato atualizado (seção 12F). G3 on-hold. UPDATE_POLICY modo vigente documentado. future-risks R1 atualizado. SYSTEM_AWARENESS estado pós-PR64 adicionado. Próxima frente: Blueprint do Runtime de Skills. Nenhum runtime alterado. Relatório: `schema/reports/PR64_ENCERRAR_MEMORIA_LIBERAR_SKILLS.md`.
> ✅ PR63 (PR-DIAG) — concluída. Diagnóstico da frente "Atualização supervisionada de memória". Decisão: Opção B (parcialmente concluída) com absorção do mecanismo manual. PR61 entregou camada documental (M1-M7, PROPOSED_MEMORY_UPDATES, memória consolidada). Mecanismo técnico de escrita supervisionada automática NÃO implementado e NÃO blocking para Runtime de Skills. Fluxo manual via PR é o mecanismo vigente (`UPDATE_POLICY.md` seção 8). G3 on-hold. Implementar `/memory/write` antes de skills gera R1 (docs_over_product). Relatório: `schema/reports/PR63_DIAG_ATUALIZACAO_SUPERVISIONADA_MEMORIA.md`.
> ✅ PR62 (PR-DOCS) — concluída. Reconciliação documental do contrato Jarvis Brain. Seção 12 adicionada ao contrato com: plano original, execução real, tabela de equivalência, regra de interpretação. Próxima PR: PR63 — PR-DIAG — decidir se atualização supervisionada de memória foi absorvida pela PR61 documental ou precisa de implementação real. Relatório: `schema/reports/PR62_RECONCILIACAO_CONTRATO_JARVIS_BRAIN.md`.
> ✅ PR59 (PR-IMPL) — concluída. `schema/enavia-response-policy.js` criado com `buildEnaviaResponsePolicy()` (15 regras: secret_exposure, fake_execution, false_capability, runtime_vs_documentation_confusion, unauthorized_action, scope_violation, contract_drift, docs_over_product, frustration, deploy_request, strategy_question, next_pr_request, pr_review, technical_diagnosis, caso limpo). Integrado em `schema/enavia-cognitive-runtime.js` (seção 7e) e `nv-enavia.js` (campo aditivo `response_policy`). Smoke PR59 96/96 ✅. Regressões 1.375/1.375 ✅. Total 1.471/1.471 ✅. Read-only. Não altera reply. Não bloqueia fluxo. Não cria endpoint. Não usa KV/rede/FS. Relatório: `schema/reports/PR59_IMPL_RESPONSE_POLICY_VIVA.md`. Response Policy viva v1 completa e validada.
> ✅ PR58 (PR-IMPL cirúrgica) — concluída. Regex `\w+` → `[\w-]+` em `_detectMissingSource` (`schema/enavia-self-audit.js` linha 402). PR57 agora passa **99/99 ✅** (antes: 96/99, falha Cenário H). Regressões 1.375/1.375 ✅. Nenhum arquivo proibido alterado. Self-Audit continua read-only. Resposta não alterada automaticamente. Nenhum endpoint criado. Relatório: `schema/reports/PR58_IMPL_CORRECAO_SELF_AUDIT_MISSING_SOURCE.md`. Self-Audit v1 completo e validado. Retorno ao fluxo principal do contrato.
> ✅ PR56 (PR-IMPL) — concluída. `schema/enavia-self-audit.js` criado com `runEnaviaSelfAudit()` (10 categorias: secret_exposure, fake_execution, unauthorized_action, scope_violation, contract_drift, false_capability, runtime_vs_documentation_confusion, wrong_mode, missing_source, docs_over_product). Campo aditivo `self_audit` integrado defensivamente em `nv-enavia.js`. Smoke PR56 64/64 ✅. Regressões 1.375/1.375 ✅. Total 1.439/1.439 ✅. Read-only. Não altera resposta. Não bloqueia fluxo. Não cria endpoint. Relatório: `schema/reports/PR56_IMPL_SELF_AUDIT_READONLY.md`.
> ✅ PR55 (PR-DOCS) — concluída. `schema/self-audit/` criada com 8 arquivos documentais: INDEX.md, FRAMEWORK.md (10 camadas), CHECKLISTS.md (48 itens A–F), RISK_MODEL.md (5 níveis + 13 categorias), SIGNALS.md (30+ sinais), OUTPUT_CONTRACT.md (contrato JSON), ESCALATION_POLICY.md, ROADMAP.md (PR55–PR61+). `schema/brain/SYSTEM_AWARENESS.md` atualizado para referenciar Self-Audit como documental. Nenhum runtime alterado. Nenhum endpoint criado. Relatório: `schema/reports/PR55_SELF_AUDIT_FRAMEWORK.md`.
> ✅ PR54 (PR-PROVA) — concluída. `tests/pr54-memoria-contextual.prova.test.js` criado (93 asserts, 13 cenários A–M). Todos passaram. Retrieval por Intenção v1 validado formalmente como memória contextual read-only: contexto aplicado aparece no prompt com marcador canônico, não aplicado não aparece, coerência por skill/intenção provada, bloco não ativa modo operacional sozinho, falsa capacidade bloqueada, campo `intent_retrieval` aditivo e seguro, `/skills/run` confirmado inexistente. Regressões 1.372/1.372 ✅. Total 1.465/1.465 ✅. Relatório: `schema/reports/PR54_PROVA_MEMORIA_CONTEXTUAL.md`.
> ✅ PR53 (PR-IMPL cirúrgica) — concluída. `schema/enavia-intent-retrieval.js` criado com `buildIntentRetrievalContext()` (snapshot estático, 4 skills documentais + 5 intenções sem skill, limite 2.000 chars, truncamento seguro). Integrado em `buildChatSystemPrompt` (seção `7d`) e `nv-enavia.js` (campo aditivo `intent_retrieval`). Smoke PR53 82/82 ✅. Regressões 1.290/1.290 ✅. Total 1.372/1.372 ✅. Nenhum endpoint criado. Nenhuma skill executada. /skills/run não existe. Relatório: `schema/reports/PR53_IMPL_RETRIEVAL_POR_INTENCAO.md`.
> ✅ PR52 (PR-PROVA) — concluída. `tests/pr52-skill-routing-runtime.prova.test.js` criado (202 asserts, 12 cenários A–L). Todos passaram. Skill Router read-only validado: 4 skills documentais roteadas, campo `skill_routing` provado, falsa capacidade bloqueada, /skills/run inexistente confirmado. Total 1.290/1.290 ✅. Relatório: `schema/reports/PR52_PROVA_ROTEAMENTO_SKILLS.md`.
> ✅ PR51 (PR-IMPL cirúrgica) — concluída. `schema/enavia-skill-router.js` criado com `routeEnaviaSkill()` (4 skills documentais mapeadas, roteamento determinístico, integração com Classificador de Intenção). Campo aditivo `skill_routing` no response do `/chat/run`. Smoke PR51 168/168 ✅. Regressões 920/920 ✅. Total 1.088/1.088 ✅. Relatório: `schema/reports/PR51_IMPL_SKILL_ROUTER_READONLY.md`.
> ✅ PR50 (PR-PROVA) — concluída. `tests/pr50-intent-runtime.prova.test.js` criado com 124 asserts (13 cenários A–M). Todos passaram. Classificador de Intenção v1 validado formalmente: conversa/frustração não operacional, próxima PR não operacional, revisão de PR/diagnóstico/deploy operacionais com governança, contrato conceitual sem falso positivo, Skill Router runtime inexistente confirmado, memória sem escrita, estratégia não operacional pesada, regressões PR37/PR38 preservadas, campo `intent_classification` validado por inspeção + unitário. Nenhum runtime alterado. Smoke PR50 124/124 ✅. Regressões 697/697 ✅. Total 821/821 ✅. Relatório: `schema/reports/PR50_PROVA_TESTE_INTENCAO.md`.
> ✅ PR49 (PR-IMPL cirúrgica) — concluída. `schema/enavia-intent-classifier.js` criado com 15 intenções canônicas v1.
> ✅ PR42 diagnosticou a memória runtime. ENAVIA_BRAIN existe com ID real. Brain não estava conectado ao runtime.
> ✅ PR43 implementou Brain Loader read-only. `schema/enavia-brain-loader.js` criado. Allowlist de 7 fontes hard-coded. `getEnaviaBrainContext()` plugado em `buildChatSystemPrompt` (seção `7c`). Limite total 4.000 chars. Determinístico, sem FS/KV/rede. Smoke PR43 32/32. Regressões verdes (520/520). Relatório: `schema/reports/PR43_IMPL_BRAIN_LOADER_READONLY.md`.
> ✅ PR44 provou o Brain Loader read-only no chat runtime. Teste `tests/pr44-brain-loader-chat-runtime.prova.test.js` criado, 38/38 ✅. Regressões 558/558. Nenhum runtime alterado. Relatório: `schema/reports/PR44_PROVA_BRAIN_LOADER_CHAT_RUNTIME.md`.
> ✅ PR45 diagnosticou o prompt pós-Brain Loader. READ-ONLY. Prompt medido: 10.945–13.743 chars (2.736–3.436 tokens). Brain Context: +4.002 chars / +1.000 tokens constantes. Principal problema: duplicação caps/limitações entre seções 1-4 e Brain blocks 1-3. Brain NÃO engessou — reforça naturalidade. Recomendação PR46: consolidar identidade+caps no LLM Core, reduzir seção 1b. Relatório: `schema/reports/PR45_PROMPT_CHAT_POS_BRAIN_DIAGNOSTICO.md`.
> ✅ PR46 implementou o LLM Core v1. `schema/enavia-llm-core.js` criado (`buildLLMCoreBlock()` + `getLLMCoreMetadata()`). Antigas seções 1+1b+2+3+4 consolidadas. "NV Imóveis" 9→3 ocorrências. Economia real: -449 chars / ~-112 tokens (-4,1%) por conversa. Brain Loader inalterado por escopo. Smoke PR46 43/43 ✅. Regressões 558/558 ✅. Total 601/601 ✅. Relatório: `schema/reports/PR46_IMPL_LLM_CORE_V1.md`.

## Histórico de contratos

| Contrato | PRs | Estado | Encerrado em |
|----------|-----|--------|--------------|
| `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` | PR1–PR7 | Encerrado ✅ | 2026-04-27 |
| `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` | PR8–PR16 (+ fixes) | Encerrado ✅ | 2026-04-29 |
| `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` | PR0, PR17–PR30 | **Encerrado ✅** | 2026-04-30 |

## O que foi entregue no contrato PR17–PR30

### Loop contratual supervisionado (PR17–PR21) — Consolidado ✅

- Loop funcional: `queued → execute-next → in_progress → complete-task → phase_complete → advance-phase → próxima fase`
- Smoke tests: PR19 (52/52 ✅), PR21 (53/53 ✅)

### System Map + Tool Registry (PR22–PR25) — Concluído ✅

- `schema/system/ENAVIA_SYSTEM_MAP.md` — 14 seções
- `schema/system/ENAVIA_ROUTE_REGISTRY.json` — 68 rotas, 0 violações
- `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` — 18 seções + Apêndice A
- `schema/system/ENAVIA_WORKER_REGISTRY.md` — 18 seções

### Skills documentais (PR26–PR29) — Concluídas ✅

- `schema/skills/CONTRACT_LOOP_OPERATOR.md` — 20 seções (PR26)
- `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` — 23 seções (PR27)
- `schema/skills/SYSTEM_MAPPER.md` — 23 seções (PR28)
- `schema/skills/CONTRACT_AUDITOR.md` — 24 seções (PR29)
- **Skills são documentais — não há executor automático, não há `/skills/run`, não há UI de skills**

### Fechamento (PR30) — Concluído ✅

- Relatório final: `schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md`
- Handoff final: `schema/handoffs/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_FINAL_HANDOFF.md`
- Contrato encerrado e governança atualizada

## Próxima etapa

**PR33 — PR-DOCS — Arquitetura do Obsidian Brain.**

Contrato `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` ativo. PR31 (DOCS) e PR32 (DIAG) concluídas. Loop contratual em sequência. Próxima entrega esperada: estrutura completa de `schema/brain/` (INDEX, GRAPH, MEMORY_RULES, RETRIEVAL_POLICY, UPDATE_POLICY, SYSTEM_AWARENESS + pastas `maps/`, `decisions/`, `contracts/`, `memories/`, `incidents/`, `learnings/`, `open-questions/`, `self-model/`).



## Prova formalizada em PR21

- Novo smoke test focado `tests/pr21-loop-status-states.smoke.test.js` (53/53 ✅, 5 cenários).
- Matriz cruzada validando que o `loop-status` expõe **apenas** a ação correta em cada estado:
  - `queued` → `execute-next` exclusivo
  - `in_progress` → `complete-task` exclusivo (PR20)
  - `phase_complete` → `advance-phase` exclusivo (PR18)
  - `plan_rejected` / `cancelled` / `contract_complete` → ações vazias/seguras
- Cenário 5 (consistência cruzada): nenhum estado expõe duas ações conflitantes.
- Observação documentada (sem corrigir nesta PR): `status_global: "blocked"` sozinho não esconde ações via `resolveNextAction` — o sistema só bloqueia via `plan_rejection.plan_rejected` ou `status_global === "cancelled"`. Comportamento existente preservado.
- Loop contratual supervisionado (PR17→PR18→PR19→PR20→PR21) consolidado e formalmente provado.

## Implementação formalizada em PR20

- `handleGetLoopStatus` (`nv-enavia.js:5024-5050`): novo `else if (nextAction.status === "in_progress")` adicionado. `availableActions = ["POST /contracts/complete-task"]` + guidance instruindo `{ contract_id, task_id, resultado }`.
- `canProceed` agora inclui `nextAction.status === "in_progress"`.
- `contract-executor.js` NÃO alterado — Rule 9 (`resolveNextAction`) já produzia o shape correto `{ type: "no_action", status: "in_progress", task_id }`.
- `buildOperationalAction` NÃO alterada — em `in_progress` permanece `type:block`/`can_execute:false`, evitando liberação errada de execute-next.
- Cobertura PR20: 4 seções (A: in_progress expõe complete-task; B: estados indevidos NÃO mostram complete-task; C: operationalAction não libera execução errada; D: canProceed correto em todos os estados).

## Prova formalizada em PR19

- Novo smoke test E2E `tests/pr19-advance-phase-e2e.smoke.test.js` (52/52 ✅, 9 steps).
- Cobertura do ciclo completo: `loop-status (start_task) → execute-next → complete-task → loop-status (phase_complete) → advance-phase → loop-status (start_task na phase_02)`.
- Cenários adicionais: bloqueio do `advance-phase` antes de tasks completas (Step 7), isolamento — `execute-next` não avança fase (Step 8), guard — `advance-phase` só aparece em `phase_complete` (Step 9).
- Fixture com 2 fases reais e 2 tasks reais; `state.definition_of_done` exigido por `auditExecution` em `complete-task`.
- Mocks de `EXECUTOR` e `DEPLOY_WORKER` reaproveitam padrão estabelecido em PR14.
- Nenhum runtime alterado.

## Implementação formalizada em PR18

- Import `advanceContractPhase` adicionado em `nv-enavia.js`.
- `buildOperationalAction`: `phase_complete` → `advance_phase` (não mais `block`); `EVIDENCE_MAP.advance_phase = ["contract_id"]`.
- `handleGetLoopStatus`: `availableActions = ["POST /contracts/advance-phase"]` em `phase_complete`; guidance reescrita.
- Novo handler `handleAdvancePhase`: valida JSON + `contract_id`, delega para `advanceContractPhase`, mapeia para 200/400/409/500.
- Nova rota `POST /contracts/advance-phase` (próxima a `/contracts/complete-task`).
- Help text atualizado.
- Novo smoke test `tests/pr18-advance-phase-endpoint.smoke.test.js`: 45/45 ✅ (cobre input inválido, happy path, gate bloqueado, integração com loop-status, isolamento de execute-next).
- `contract-executor.js` NÃO foi alterado (função já estava completa).

## Diagnóstico formalizado em PR17

- `phase_complete` gerado por `resolveNextAction` Rule 4 (`contract-executor.js:1479`) quando todas as tasks da fase ativa têm status done/merged/completed/skipped.
- `advanceContractPhase` implementada em `contract-executor.js:1027`, exportada em linha 5120. Não importada nem usada em `nv-enavia.js`.
- Nenhum endpoint `POST /contracts/advance-phase` existe em `nv-enavia.js` (grep confirmado).
- `loop-status` mapeia `phase_complete` → `block` (linha 4809) com guidance "No phase-advance endpoint exists yet" (linha 5034).
- Gate de avanço: `checkPhaseGate` (`contract-executor.js:975`) — já implementado, chamado internamente por `advanceContractPhase`.
- KV keys: `contract:{id}:state` e `contract:{id}:decomposition` (leitura e escrita).
- Testes de `advanceContractPhase` existem em `contracts-smoke.test.js` (via import direto) — nenhum teste via HTTP.
- Patch mínimo para PR18: (1) importar `advanceContractPhase`, (2) criar handler, (3) adicionar rota, (4) atualizar `availableActions` em `loop-status`.

## Decisões formalizadas em PR0 (revisão pós-feedback)

- `CLAUDE.md` seção `## 4. Loop obrigatório de execução por PR` adicionada com 17 passos e regras de bloqueio explícitas.
- Referência fixa ao `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` como contrato ativo exclusivo removida.
- Agente orientado a identificar contrato ativo via `schema/contracts/INDEX.md`.
- `schema/contracts/INDEX.md` criado como índice central.
- `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` criado como novo contrato ativo.
- **Contrato reestruturado por feedback @brunovasque:** nova ordem prioriza loop `phase_complete → advance-phase` (PR17–PR21) antes de System Map (PR22–PR25) e skills (PR26–PR29).
- Próxima PR autorizada pelo contrato: **PR17** (PR-DIAG — `phase_complete` e avanço de fase).
- Escopo Docs-only: nenhum arquivo de runtime alterado.

## Decisões formalizadas em sessão anterior (PR15/PR16 fixes)
- `handleExecuteNext` → step C (`_deployPayload`) agora inclui `patch: { type: "contract_action", content: JSON.stringify(nextAction) }`.
- O patch reutiliza exatamente o mesmo shape e fonte de verdade do `_proposePayload` — sem duplicação de lógica, sem patch inventado.
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` ampliado com 3 novos asserts em C5 e E1 validando:
  - `/apply-test` recebe `patch` como objeto;
  - `patch.content` não vazio;
  - `patch.content` consistente com o campo enviado ao `/propose`.
- Validações desta sessão:
  - `node --check nv-enavia.js` ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **168 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅

## Estado geral
- Contrato anterior: `schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` ✅ (encerrado)
- Contrato ativo: `schema/contracts/active/CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` ✅
- Estrutura de governança mínima: ✅
- PR1–PR7: **CONCLUÍDAS** ✅ (contrato anterior)

## PRs do contrato operacional (PR8–PR13)
- PR8 — contrato operacional de ações e estado: **concluída** ✅ (branch: `claude/pr8-operational-action-contract`)
- PR9 — execute-next supervisionado: **concluída** ✅ (branch: `claude/pr9-execute-next-supervisionado`)
- PR10 — gates, evidências e rollback: **concluída** ✅ (branch: `claude/pr10-gates-evidencias-rollback`) — ajuste final de honestidade aplicado na PR #158
- PR11 — integração segura com executor: **concluída** ✅ (branch: `claude/pr11-integracao-segura-executor`)
- PR12 — botões operacionais no painel: **concluída** ✅ (branch: `claude/pr12-panel-botoes-operacionais`)
- PR13 — hardening final: **concluída** ✅ (branch: `claude/pr13-hardening-final-operacional`)

## Decisões formalizadas em PR4
- `executor.invalid` — corrigido para `https://enavia-executor.internal/audit`.
- `consolidateAfterSave()` — dead code (definida mas nunca chamada). Integração fora do escopo de PR4; deixada para PR6 (loop supervisionado) se for necessária.
- `ENAVIA_BUILD.deployed_at` — sem automação possível via CF Workers runtime. Atualização manual por deploy; CI/CD injection é o caminho correto no futuro.

## Decisões formalizadas em PR5
- `handleGetHealth` enriquecida com `decision:latest` (P14) — execuções rejeitadas pelo gate humano surfacadas como `blockedExecutions` reais. `summary.blocked` agora reflete dado real.
- `handleGetExecution` enriquecida com `decision:latest` como campo aditivo `latestDecision` — backward-compat.
- Ambas as leituras são não-críticas (try/catch silencioso).
- Ajuste de honestidade: `_limitations: { blockedExecutions: "derived_from_latest_decision_only" }` adicionado ao health response para deixar explícito que `blockedExecutions` é derivado apenas da última decisão P14, não lista histórica.
- Ajuste de coerência (PR #153, feedback Codex): `summary.total` agora é coerente com contadores — no path `exec_event_absent`: `total = blockedExecutions.length`; no path `exec_event`: `total = 1 + blockedExecutions.length`. Garante `total >= completed + failed + blocked + running`.

## Decisões formalizadas em PR6
- `resolveNextAction` e `rehydrateContract` importadas de `contract-executor.js` no Worker (já existiam e eram exportadas, mas não importadas).
- `GET /contracts/loop-status` — novo endpoint read-only. Resolve próxima ação contratual e retorna estado do loop supervisionado. Sem KV put, sem dispatch ao executor.
- `consolidateAfterSave()` — avaliada: não integrada ao loop supervisionado. Sua responsabilidade (consolidar memória após brain saves) não pertence ao ciclo contratual; permanece como dead code candidata a remoção futura.

## Ajustes PR6 (feedback Codex — commit após PR #154)
- `awaiting_human_approval` tratado fora do guard `isReady`: `status: "awaiting_approval"` ≠ `"ready"`, logo `isReady` era `false` e `availableActions` ficava `[]`. Corrigido com `isAwaitingApproval` fora do bloco `isReady`.
- `canProceed` atualizado para `isReady || isAwaitingApproval`.
- `phase_complete`: removidos `complete-task`/`execute` (falham deterministicamente sem task in_progress). `availableActions: []` + campo `guidance` documenta ausência de endpoint de avanço de fase.
- Panel e Executor: sem alteração.

## Decisões formalizadas em PR7
- 21 schemas já conectados (14 via `nv-enavia.js`, 7 via `contract-executor.js`).
- 9 schemas desconectados avaliados; nenhum integrado:
  - `contract-active-state`, `contract-adherence-engine`, `contract-cognitive-advisor`, `contract-cognitive-orchestrator`: mecanismo de estado KV paralelo ao existente — risco de estado duplicado sem refatoração.
  - `contract-ingestion`: upstream do ciclo; sem endpoint consumidor.
  - `enavia-capabilities`, `enavia-constitution`, `enavia-identity`: conteúdo estático sem fluxo consumidor; identidade já coberta por `enavia-cognitive-runtime`.
  - `planner-memory-audit`: diagnóstico PM1-PM9 sem endpoint consumidor; memória funciona.
- `consolidateAfterSave()` — mantida como dead code; formalmente fora do escopo de PR7.
- **Contrato PR1–PR7: FORMALMENTE CONCLUÍDO.**

## Bloqueios
- nenhum

## Decisão operacional — Deploy Executor KV por title

- `deploy-executor.yml` passou a usar os KV namespaces visíveis ao token/conta do GitHub Actions como fonte de verdade.
- Secrets manuais `ENAVIA_BRAIN_KV_ID`, `ENAVIA_BRAIN_TEST_KV_ID`, `ENAVIA_GIT_KV_ID`, `ENAVIA_GIT_TEST_KV_ID`, `GIT_KV_ID` e `GIT_KV_TEST_ID` não são mais exigidos nem usados pelo workflow.
- Se faltar algum title obrigatório, o workflow falha antes do deploy mostrando apenas o title faltante.
- IDs resolvidos são usados somente internamente para gerar `wrangler.executor.generated.toml`; não são impressos no log.

## Decisões formalizadas em PR8
- `buildOperationalAction(nextAction, contractId)` — função pura em `nv-enavia.js:4799–4835`. Shape canônico: `{ action_id, contract_id, type, requires_human_approval, evidence_required, can_execute, block_reason }`.
- Mapeamento: `start_task`/`start_micro_pr` → `execute_next`; `awaiting_human_approval` → `approve`; `contract_complete` → `close_final`; blocked states → `block`.
- `GET /contracts/loop-status` enriquecido com `operationalAction` (aditivo). Paths sem contrato retornam `operationalAction: null`.
- Sem execução real. Sem alteração em Panel ou Executor.

## Decisões formalizadas em PR9
- `handleExecuteNext(request, env)` — `nv-enavia.js`. Gate primário: `can_execute !== true` → bloqueio imediato. `execute_next` delega a `handleExecuteContract` via synthetic Request. `approve` exige `confirm === true` + `approved_by` antes de delegar a `handleCloseFinalContract`. Fallback: qualquer tipo sem caminho → bloqueado.
- Nenhum executor externo chamado diretamente. Sem deploy. Sem produção automática.

## Decisões formalizadas em PR10
- `buildEvidenceReport(opType, contractId, body)` — `nv-enavia.js:5003–5023`. Puro. Retorna `{ required, provided, missing }`.
- `buildRollbackRecommendation(opType, contractId, executed)` — `nv-enavia.js:5025–5058`. Puro. Retorna `{ available, type, recommendation, command }`. Sem execução de rollback.
- Gate de evidência adicionado: `evidenceReport.missing.length > 0` → `status: "blocked"`.
- Gate de resultado ambíguo: status 200 sem `ok` explícito → bloqueado + log `⚠️`.
- Todos os paths de `handleExecuteNext` incluem `evidence` + `rollback` (backward-compat).
- Resposta canônica: `{ ok, executed, status, reason, nextAction, operationalAction, evidence, rollback, execution_result?, audit_id }`.
- Ajuste final PR #158: `evidence` agora explicita limitação de escopo com `validation_level: "presence_only"` e `semantic_validation: false`. O bloqueio por ausência de `evidence` explica que o campo é obrigatório mesmo vazio, apenas como ACK operacional mínimo.

## Decisões formalizadas em PR11
- Diagnóstico: `env.EXECUTOR.fetch` usado APENAS em `handleEngineerRequest` (`/engineer` proxy). Fluxo de contratos é inteiramente KV.
- `buildExecutorPathInfo(env, opType)` — helper puro, retorna `{ type, handler, uses_service_binding, service_binding_available, note }`.
- Timeout local removido de `handleExecuteContract` e `handleCloseFinalContract`: ambos podem alterar KV, e `Promise.race` não cancela a Promise original.
- Sem `AbortSignal`/cancelamento real, responder timeout local seria inseguro porque o handler poderia continuar mutando estado após a resposta.
- Timeout seguro fica para PR futura somente se existir handler cancelável/idempotente.
- Campo `executor_path` aditivo em todos os paths de resposta (backward-compat): `null` antes do step 4; `executorPathInfo` após.

## Decisões formalizadas em PR12
- `fetchLoopStatus()` — `panel/src/api/endpoints/loop.js`. GET /contracts/loop-status. Modo mock retorna `null` com flag `mock:true` — sem fixture inventada.
- `executeNext(body)` — mesma arquivo. POST /contracts/execute-next. Modo mock retorna resposta honesta explicando que backend é necessário.
- `LoopPage` — `/loop` route. Exibe loop/nextAction/operationalAction/availableActions. Botão desabilitado quando `can_execute: false`. Mostra motivo de bloqueio. Seções colapsáveis: evidence, rollback, executor_path.
- Body enviado: `{ confirm: true, approved_by: <input>, evidence: [] }`.
- Modo mock: aviso honesto com instrução para configurar `VITE_NV_ENAVIA_URL`.
- Build: 141 modules, 0 errors.
- Ajuste PR #160: seção "Status do Loop" agora lê `loopData.contract.{id,status,current_phase,current_task,updated_at}`; `loop` fica restrito a `canProceed`, `blockReason`, `availableActions` e `guidance`.
- Ajuste PR #160: `handleExecute` prioriza `r.data` mesmo quando `r.ok === false`, preservando `reason`, `evidence`, `rollback`, `executor_path` e `audit_id` do backend.

## Decisões formalizadas em PR13

- `GET /contracts/loop-status` e `POST /contracts/execute-next` — CORS confirmado via `jsonResponse()` → `withCORS()` internamente. Sem necessidade de wrapper manual.
- 8 gates do execute-next verificados e documentados via smoke test: JSON inválido, sem KV, sem contrato, `can_execute:false`, evidence faltando, evidence presente, approve sem confirm, approve sem approved_by.
- `env.EXECUTOR.fetch` confirmado como nunca chamado em nenhum path do execute-next (fluxo KV puro naquela PR).
- Rollback confirmado como recomendação pura (`buildRollbackRecommendation`) — sem execução automática.
- `Promise.race` confirmado como ausente — design correto para handlers que mutam KV.
- Smoke test: `tests/pr13-hardening-operacional.smoke.test.js` → 91 passed, 0 failed.
- **Contrato `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`: FORMALMENTE ENCERRADO ✅**

## Decisões formalizadas em PR14

- `callExecutorBridge(env, route, payload)` — `nv-enavia.js`. Chama `env.EXECUTOR.fetch` para `/audit` e `/propose`. Gates: EXECUTOR ausente → blocked; resposta não-ok → failed; `ok:false` → blocked; `/audit` sem verdict → ambiguous; `verdict:reject` → blocked.
- `callDeployBridge(env, action, payload)` — `nv-enavia.js`. Chama `env.DEPLOY_WORKER.fetch` somente via `/apply-test` com `target_env:"test"`. Guards: ações prod (approve/promote/rollback) bloqueadas; `target_env:prod` bloqueado; binding ausente → `deploy_status:"blocked"`.
- `handleExecuteNext` — execute_next: audit → propose → deploy (simulate) → handler interno KV. Approve: confirm+approved_by gate → audit → handler interno KV. Sem propose, sem deploy para approve.
- `buildExecutorPathInfo` atualizado: `execute_next` e `approve` agora têm `uses_service_binding:true` e chain completo no campo `handler`.
- Response estendida com 9 campos novos: `executor_audit`, `executor_propose`, `executor_status`, `executor_route`, `executor_block_reason`, `deploy_result`, `deploy_status`, `deploy_route`, `deploy_block_reason`.
- Produção automaticamente bloqueada. Handler interno só roda depois de todos os bridges passarem.
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` → 93 passed, 0 failed ✅.
- `tests/pr13-hardening-operacional.smoke.test.js` atualizado (3 asserts ajustados para mudança intencional de PR14 em `buildExecutorPathInfo`) → 91 passed, 0 failed ✅.

## Ajuste P1 na PR14 — comentários Codex (PR #162)

- `callExecutorBridge(...)` agora retorna imediatamente `{ ok:false, status:"ambiguous", reason:"Resposta do Executor não é JSON válido.", data:{ raw } }` quando `JSON.parse` falha em `/audit` ou `/propose`.
- `callDeployBridge(...)` agora retorna imediatamente `{ ok:false, status:"ambiguous", reason:"Resposta do Deploy Worker não é JSON válido.", data:{ raw } }` quando `JSON.parse` falha.
- Confirmado por smoke test que `/propose` com body não-JSON bloqueia antes do deploy.
- Confirmado por smoke test que Deploy Worker com body não-JSON bloqueia antes do handler interno.
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` ampliado para esses cenários → **111 passed, 0 failed** ✅.

## Ajuste follow-up PR14 — recibo de audit aprovado antes do `/apply-test`

- `callDeployBridge(env, action, payload)` agora executa dois passos no `DEPLOY_WORKER` em TEST:
  1. `POST /audit` para registrar o recibo do audit aprovado.
  2. `POST /apply-test` somente se o recibo anterior passar.
- O bridge força `execution_id` estável a partir de `audit_id`, preserva `audit_id` no payload e envia `audit: { ok: true, verdict: "approve", risk_level }` para o recibo.
- Se o recibo em `/audit` falhar, o fluxo retorna bloqueado antes do `/apply-test`; `deploy_route` passa a mostrar a rota real atingida (`/audit` ou `/apply-test`).
- `deploy_result` agora inclui `audit_receipt` de forma aditiva para auditoria/debug sem quebrar compatibilidade.
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` ampliado para validar:
  - ordem `executor:/audit → executor:/propose → deploy:/audit → deploy:/apply-test`;
  - bloqueio quando `DEPLOY_WORKER /audit` retorna `ok:false`;
  - JSON inválido isolado em `/apply-test` sem perder o recibo já gravado.
- Validações desta sessão:
  - `node --check nv-enavia.js` ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **122 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅

## Decisões formalizadas em PR16

- `startTask` importado de `contract-executor.js` em `nv-enavia.js`.
- Step D0 inserido em `handleExecuteNext` (execute_next path): se `nextAction.type === "start_task"` e `nextAction.task_id` existir, chama `startTask(env, contractId, nextAction.task_id)` antes do synthetic request para `handleExecuteContract`. Try/catch cobre falhas de KV/runtime.
- `handleGetLoopStatus`: `availableActions` de `start_task`/`start_micro_pr` agora aponta para `POST /contracts/execute-next` (era `POST /contracts/execute`, que era o endpoint direto sem gates).
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` ampliado com seção F (3 novos cenários: F1 startTask ok, F2 startTask falha, F3 availableActions correto) → **183 passed, 0 failed**.
- Gates de audit/propose/deploy (high/critical bloqueados) não alterados.

- Rodar o fluxo real `POST /contracts/execute-next` em TEST com `DEPLOY_WORKER` real, usando um contrato novo (ex: `ctr_smoke_pr175_20260429`), e confirmar que:
  1. task transiciona de `queued` para `in_progress` (via startTask);
  2. `executeCurrentMicroPr` prossegue além do Gate 2;
  3. `/apply-test` recebe `patch.content` não-vazio (PR175);
  4. não há mais HTTP 409 `TASK_NOT_IN_PROGRESS`.
- Se ainda surgir bloqueio, diagnosticar o próximo campo obrigatório faltante sem tocar Panel/Executor.

## Bloqueios
- nenhum