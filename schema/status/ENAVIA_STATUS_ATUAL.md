# ENAVIA — Status Atual

**Data:** 2026-04-28
**Branch ativa:** claude/pr8-operational-action-contract
**Última tarefa:** PR8 — Worker-only — shape canônico operacional `buildOperationalAction()` criado em `nv-enavia.js`. Campo `operationalAction` adicionado a `GET /contracts/loop-status`. Sem execução real. Sem alteração em Panel/Executor.

## Estado geral
- Contrato anterior: `schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` ✅ (encerrado)
- Contrato ativo: `schema/contracts/active/CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` ✅
- Estrutura de governança mínima: ✅
- PR1–PR7: **CONCLUÍDAS** ✅ (contrato anterior)

## PRs do contrato operacional (PR8–PR13)
- PR8 — contrato operacional de ações e estado: **concluída** ✅ (branch: `claude/pr8-operational-action-contract`)
- PR9 — execute-next supervisionado: **pendente**
- PR10 — gates, evidências e rollback: **pendente**
- PR11 — integração segura com executor: **pendente**
- PR12 — botões operacionais no painel: **pendente**
- PR13 — hardening final: **pendente**

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

## Próxima etapa segura
- PR9 — Worker-only — `POST /contracts/execute-next` supervisionado.
