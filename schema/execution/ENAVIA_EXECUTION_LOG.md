# ENAVIA — Execution Log

Histórico cronológico de execuções de tarefas/PRs sob o contrato ativo.

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
