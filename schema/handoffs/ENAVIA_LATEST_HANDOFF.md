# ENAVIA — Latest Handoff

**Data:** 2026-04-28
**De:** PR14 — Worker-only — Executor real + Deploy Worker no loop operacional
**Para:** Novo contrato (se necessário)

## O que foi feito nesta sessão

### PR14 — Worker-only — Executor real + Deploy Worker

**Helpers criados em `nv-enavia.js`:**

1. `callExecutorBridge(env, route, payload)`:
   - Chama `env.EXECUTOR.fetch("https://enavia-executor.internal" + route, ...)`
   - Rotas suportadas: `/audit`, `/propose`
   - Gates: EXECUTOR ausente → blocked; HTTP não-ok → failed; JSON inválido → ambiguous; `ok:false` → blocked; `/audit` sem `verdict` → ambiguous; `verdict:reject` → blocked
   - Retorna `{ ok, route, status: "passed"|"blocked"|"failed"|"ambiguous", reason, data }`

2. `callDeployBridge(env, action, payload)`:
   - Chama `env.DEPLOY_WORKER.fetch("https://deploy-worker.internal/apply-test", ...)` somente em modo seguro
   - Força `target_env:"test"`, `deploy_action:"simulate"` no payload
   - Guards: ações prod (approve/promote/rollback/prod) → blocked imediato; `target_env:prod` → blocked; DEPLOY_WORKER ausente → `deploy_status:"blocked"`
   - Retorna `{ ok, action, status, reason, data }`

**`buildExecutorPathInfo` atualizado:**
- `execute_next`: `uses_service_binding:true`, `handler: "callExecutorBridge(/audit) → callExecutorBridge(/propose) → callDeployBridge(simulate) → handleExecuteContract"`, `deploy_binding_available` adicionado
- `approve`: `uses_service_binding:true`, `handler: "callExecutorBridge(/audit) → handleCloseFinalContract"`
- blocked: `deploy_binding_available` adicionado, `uses_service_binding:false`

**`handleExecuteNext` integrado:**
- `execute_next` (após gates existentes):
  1. `callExecutorBridge(env, "/audit", auditPayload)` — bloqueia se não passar
  2. `callExecutorBridge(env, "/propose", proposePayload)` — bloqueia se não passar
  3. `callDeployBridge(env, "simulate", deployPayload)` — bloqueia se não passar
  4. Delega a `handleExecuteContract` (handler interno KV) — somente depois de todos os bridges passarem
- `approve` (após gates confirm+approved_by):
  1. `callExecutorBridge(env, "/audit", auditPayloadApprove)` — bloqueia se não passar
  2. Delega a `handleCloseFinalContract` — somente depois do audit passar
  - Sem `/propose`, sem deploy para approve

**Response estendida com 9 campos novos** (presentes em todos os paths):
- `executor_audit`, `executor_propose`, `executor_status`, `executor_route`, `executor_block_reason`
- `deploy_result`, `deploy_status`, `deploy_route`, `deploy_block_reason`

**Arquivos alterados:**
- `nv-enavia.js` — helpers + integração em `handleExecuteNext`
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` — criado (93 testes)
- `tests/pr13-hardening-operacional.smoke.test.js` — 3 asserts atualizados para refletir mudança intencional de PR14
- Governança: status, handoff, execution log

**Arquivos NÃO alterados (por escopo):**
- `contract-executor.js` — sem alteração
- `executor/` — sem alteração
- `panel/` — sem alteração
- `wrangler.toml` — sem alteração (bindings EXECUTOR e DEPLOY_WORKER já existiam)

**Resultados smoke tests:**
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` → **93 passed, 0 failed ✅**
- `tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed ✅**

## Próxima ação segura

- Nenhuma. PR14 concluída. Aguardando novo contrato.

## Bloqueios

- nenhum
