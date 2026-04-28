# ENAVIA — Status Atual

**Data:** 2026-04-28
**Branch ativa:** claude/pr6-loop-supervisionado
**Última tarefa:** PR6 — Worker-only — loop contratual supervisionado em `nv-enavia.js`.

## Estado geral
- Contrato ativo: `schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` ✅
- Estrutura de governança mínima: ✅
- PR1 — active surface: **concluída** ✅ (branch: `claude/pr1-active-surface`, merged)
- PR2 — executor governado: **concluída** ✅ (branch: `claude/pr2-executor-governado`, merged)
- PR3 — panel backend real: **concluída** ✅ (branch: `claude/pr3-panel-backend-real`, merged)
- PR4 — worker confiabilidade: **concluída** ✅ (branch: `claude/pr4-worker-confiabilidade`)
- PR5 — observabilidade real: **concluída** ✅ (branch: `claude/pr5-observabilidade-real`, PR #153) — ajuste de coerência `summary.total` aplicado
- PR6 — loop supervisionado: **concluída** ✅ (branch: `claude/pr6-loop-supervisionado`)

## PRs do contrato
- PR1 — active surface: **concluída** ✅
- PR2 — executor governado: **concluída** ✅
- PR3 — panel backend real: **concluída** ✅
- PR4 — worker confiabilidade: **concluída** ✅
- PR5 — observabilidade real: **concluída** ✅ (ajuste de coerência `summary.total` aplicado)
- PR6 — loop supervisionado: **concluída** ✅
- PR7 — schemas orquestração: pendente

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

## Bloqueios
- nenhum

## Próxima etapa segura
- Aguardar merge da PR6 e autorização para iniciar PR7 (schemas orquestração) em branch `claude/pr7-schemas-orquestracao`.
- PR7 é Worker-only: mapear schemas desconectados, integrar somente os necessários à orquestração atual.
