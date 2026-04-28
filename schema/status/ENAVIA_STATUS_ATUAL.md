# ENAVIA — Status Atual

**Data:** 2026-04-28
**Branch ativa:** claude/pr13-hardening-final-operacional
**Última tarefa:** PR13 — Worker-only — hardening final. Diagnóstico das rotas `GET /contracts/loop-status` e `POST /contracts/execute-next`. CORS confirmado via `jsonResponse`/`withCORS`. Todos os 8 gates do execute-next confirmados. `env.EXECUTOR.fetch` confirmado como nunca chamado. Smoke test criado: `tests/pr13-hardening-operacional.smoke.test.js` → 91 passed, 0 failed. Sem alteração em Panel, Executor ou contract-executor.js. Contrato PR8–PR13 formalmente encerrado.

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
- `env.EXECUTOR.fetch` confirmado como nunca chamado em nenhum path do execute-next — fluxo inteiramente KV, sem service binding para contratos.
- Rollback confirmado como recomendação pura (`buildRollbackRecommendation`) — sem execução automática em nenhum path.
- `Promise.race` confirmado como ausente — design correto: handlers mutam KV, race não cancela promise original (documentado em PR11).
- Smoke test: `tests/pr13-hardening-operacional.smoke.test.js` → 91 passed, 0 failed.
- **Contrato `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`: FORMALMENTE ENCERRADO ✅**

## Próxima etapa segura
- Nenhuma. Contrato PR8–PR13 concluído. Aguardando novo contrato.
