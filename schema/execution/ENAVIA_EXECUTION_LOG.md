# ENAVIA — Execution Log

Histórico cronológico de execuções de tarefas/PRs sob o contrato ativo.

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
