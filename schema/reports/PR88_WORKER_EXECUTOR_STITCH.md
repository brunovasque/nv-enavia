# PR88 — Worker ↔ Executor Stitch (execution_id/contract_id)

**Data:** 2026-05-03  
**Tipo:** PR-IMPL  
**Escopo:** Worker + bridge + tests + docs mínimo

---

## Pré-checks obrigatórios

- Branch confirmada: `codex/pr88-worker-executor-execution-stitch`.
- `main` confirmado com PR87 mergeada (`Merge pull request #252 ... pr87-deploy-test-finalize-runner`, commit `1ee0dc0`).
- Arquivos localizados:
  - `nv-enavia.js`
  - `executor/src/index.js`
  - `contract-executor.js`
  - `tests/pr87-deploy-test-finalize-runner.smoke.test.js`
  - `tests/pr86-deploy-orchestrator-gap.prova.test.js`
  - `tests/pr14-executor-deploy-real-loop.smoke.test.js`
  - `tests/pr18-advance-phase-endpoint.smoke.test.js`
  - `tests/pr19-advance-phase-e2e.smoke.test.js`
  - `tests/pr20-loop-status-in-progress.smoke.test.js`
  - `tests/pr21-loop-status-states.smoke.test.js`

---

## Diagnóstico usado (antes do patch)

### Onde o Worker chama o Executor

1. Bridge contratual em `handleExecuteNext`:
- `callExecutorBridge(env, "/audit", ...)`
- `callExecutorBridge(env, "/propose", ...)`
- `callExecutorBridge(env, "/audit", ...)` no caminho `approve`

2. Proxy genérico em `POST /engineer` (`handleEngineerRequest`):
- ação direta para `env.EXECUTOR.fetch(...)` com payload reduzido.

3. Rota `/audit` do Worker também chama Executor (`executor_action: "audit"`) para auditoria real.

### Onde `execution_id` nasce/é recebido

- Em `handleExecuteNext`, nascia como `auditId = exec-next:<timestamp>` e era usado no `_deployPayload`, mas não era enviado explicitamente ao Executor em `audit/propose`.
- Em `/engineer`, `execution_id` vinha do body do cliente, mas era perdido no caminho de ação direta (`{ action }` apenas).
- No Executor, `deploy_execute_plan` exige `execution_id` (top-level ou `plan.execution_id`).

### Onde `contract_id` nasce/é recebido

- Em `handleExecuteNext`, vem do contrato ativo (`rehydrateContract` + `resolveNextAction`) e compõe payloads.
- Em `/engineer`, `contract_id` pode vir do body do cliente, mas era perdido no caminho de ação direta.
- No Executor, `contract_id` é resolvido de `raw.contract_id`/`raw.contract`/`execDoc`/`plan`.

### Âncoras obrigatórias identificadas

- `handleExecuteNext`: `nv-enavia.js`
- `callExecutorBridge`: `nv-enavia.js`
- `callDeployBridge`: `nv-enavia.js`
- `transitionStatusGlobal`: `contract-executor.js`
- `resolveNextAction`: `contract-executor.js`

### `deploy_execute_plan` é chamado pelo Worker?

- Não há chamada explícita hardcoded em `handleExecuteNext`.
- O caminho real é via `POST /engineer` (ação direta/proxy): o Worker encaminha payload para o Executor.
- Gap identificado: na ação direta, o Worker truncava payload para `{ action }`, quebrando a preservação de `execution_id`/`contract_id`/`plan` para `deploy_execute_plan`.

### Menor patch necessário (definido antes de implementar)

1. `nv-enavia.js`:
- Preservar no `POST /engineer` (ação direta) campos mínimos de identidade/estado (`execution_id`, `contract_id`, `plan`, `mode` etc.) quando presentes.
- Em `handleExecuteNext`, enviar `execution_id` explícito para `callExecutorBridge` em `audit`, `propose` e `approve:audit`.

2. `executor/src/index.js`:
- Sem patch (PR87 já cobre `deploy_test/finalize` e preserva IDs).

3. Criar teste PR88 e atualizar docs/governança mínima.

---

## Implementação aplicada

### 1) Patch mínimo no Worker (`nv-enavia.js`)

- `POST /engineer` (ação direta): adicionada lista de passthrough para manter contexto de execução.
- `handleExecuteNext`:
  - `_auditPayload` agora inclui `execution_id: auditId`.
  - `_proposePayload` agora inclui `execution_id: auditId`.
  - `_auditPayloadApprove` agora inclui `execution_id: auditId`.

### 2) Executor

- `executor/src/index.js` **não alterado** (PR87 mantida).

### 3) Teste novo

- `tests/pr88-worker-executor-stitch.smoke.test.js` criado (36 cenários).

---

## O que foi costurado

- Worker preserva identidade (`execution_id`, `contract_id`) em bridge contratual e em ação direta para Executor.
- Payload de `deploy_execute_plan` pode atravessar o Worker sem perder `plan`/IDs.
- Runner do Executor (PR87) segue recebendo IDs em `deploy_test` e `finalize`.
- Fluxo alvo permanece representável:
  - `AUDIT → PROPOSE → smart_deploy_plan / SIMULATE → deploy_execute_plan → deploy_test → await_proof → finalize`.

---

## O que NÃO foi mexido

- `executor/src/index.js`
- `contract-executor.js`
- `.github/workflows/deploy.yml`
- `wrangler.toml`
- painel
- chat
- Skill Factory
- SELF_WORKER_AUDITOR
- rotas novas (nenhuma criada)
- deploy real/secrets/KV novo/banco novo

---

## O que fica para PR89

- Hardening de telemetria/evidência do loop interno costurado (logs e prova dinâmica adicional do estado entre steps).
- Prova adicional com foco em rastreabilidade de `execution_id` por ciclo (sem ampliar escopo para painel/chat).
