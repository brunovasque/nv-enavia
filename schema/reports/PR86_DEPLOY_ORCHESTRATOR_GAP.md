# PR86 — Deploy Orchestrator Gap Proof (PR-PROVA)

**Data:** 2026-05-03  
**Escopo:** Tests + relatório diagnóstico (sem alterar runtime)  
**Tipo:** PR-PROVA

---

## Pré-checks obrigatórios

- `schema/contracts/ACTIVE_CONTRACT.md`: **sem contrato ativo**, aguardando próxima fase.
- `schema/contracts/INDEX.md`: PR82, PR83, PR84 e PR85 marcadas como **concluídas/encerradas**.
- Arquivos localizados:
  - `contract-executor.js`
  - `nv-enavia.js`
  - `executor/src/index.js`
  - `tests/pr14-executor-deploy-real-loop.smoke.test.js`
  - `tests/pr18-advance-phase-endpoint.smoke.test.js`
  - `tests/pr19-advance-phase-e2e.smoke.test.js`
  - `tests/pr20-loop-status-in-progress.smoke.test.js`
  - `tests/pr21-loop-status-states.smoke.test.js`

---

## Mapeamento vivo (o que existe hoje)

### Worker/contrato (loop contratual)

- `advance phase` existe no Worker:
  - handler `handleAdvancePhase` em `nv-enavia.js`
  - rota `POST /contracts/advance-phase` em `nv-enavia.js`
- `loop status` existe no Worker:
  - handler `handleGetLoopStatus` em `nv-enavia.js`
  - rota `GET /contracts/loop-status` em `nv-enavia.js`
- `contract_id` aparece de ponta a ponta (`contract-executor.js` + `nv-enavia.js`).

### Executor/Deploy (loop interno de deploy)

- `smart_deploy_plan` existe em `executor/src/index.js` via `handleSmartDeployPlan`.
- `deploy_execute_plan` existe em `executor/src/index.js` como high-level action.
- `execution_id` aparece no fluxo (`nv-enavia.js` e `executor/src/index.js`).
- `AUDIT` está mapeado:
  - Worker chama `callExecutorBridge(..., "/audit", ...)`.
  - Executor roteia `highLevelAction === "audit"`.
- `PROPOSE` está mapeado:
  - Worker chama `callExecutorBridge(..., "/propose", ...)`.
  - Executor trata `stepType === "propose"` no runner de `deploy_execute_plan`.
- `SIMULATE` está mapeado:
  - Worker chama `callDeployBridge(..., "simulate", ...)`.
  - Executor tem caminho de planejamento `smart_deploy`.

---

## Onde o loop quebra

### Fluxo alvo esperado

`AUDIT → PROPOSE → smart_deploy_plan/SIMULATE → deploy_execute_plan → finalize`

### Achado objetivo

Em `executor/src/index.js`:

1. `smart_deploy_plan` grava `plan.steps` com:
   - `audit`
   - `apply_test`
   - `deploy_test`
   - `await_proof`
   - `finalize`

2. `deploy_execute_plan` implementa runner apenas para:
   - `audit` (junto com `propose`)
   - `propose`
   - `apply_test`
   - `await_proof`

3. Não há branch para `deploy_test` nem para `finalize`.

4. Quando chega num step não implementado, o executor retorna caminho explícito de erro:
   - `STEP_TYPE_NOT_IMPLEMENTED_V2`
   - mensagem com `STEP_TYPE_NOT_IMPLEMENTED_V3 (...)`.

### Ponto provável de quebra

- Primeira quebra provável: **step `deploy_test`** (3º passo do plano).
- Mesmo que esse ponto seja contornado, `finalize` também está sem implementação no runner atual.

---

## O que já funciona (e deve ser preservado)

- Loop contratual Worker (`loop-status`, `execute-next`, `complete-task`, `advance-phase`) validado por PR14/18/19/20/21.
- Gate de evidência/segurança em `handleExecuteNext`.
- Bridges atuais:
  - `callExecutorBridge`
  - `callDeployBridge`
- Motor de decisão contratual:
  - `resolveNextAction`
  - `transitionStatusGlobal`
- Endpoint de planejamento interno `smart_deploy_plan`.
- Endpoint/ação `deploy_execute_plan` com passos já implementados (`audit/propose/apply_test/await_proof`).

---

## Menor patch recomendado para PR87

Objetivo mínimo: fechar a costura entre `smart_deploy_plan` e `deploy_execute_plan` sem ampliar escopo.

1. **Alinhar step types** entre planner e runner:
   - opção A: adicionar handlers para `deploy_test` e `finalize` no runner;
   - opção B: ajustar `smart_deploy_plan.steps` para apenas tipos já executáveis.
2. Garantir que o passo final não caia em `STEP_TYPE_NOT_IMPLEMENTED`.
3. Manter comportamento existente de `AUDIT/PROPOSE/apply_test/await_proof` sem refatoração lateral.

---

## Funções que NÃO devem ser refatoradas

- `callExecutorBridge` (`nv-enavia.js`)
- `callDeployBridge` (`nv-enavia.js`)
- `handleExecuteNext` (`nv-enavia.js`)
- `transitionStatusGlobal` (`contract-executor.js`)
- `resolveNextAction` (`contract-executor.js`)
- gates atuais do fluxo contratual/deploy

---

## Sequência recomendada (sem abrir novo escopo)

- **PR87:** patch mínimo de costura planner ↔ execute-plan (resolver gap `deploy_test/finalize`).
- **PR88:** prova dirigida do fluxo completo interno (`smart_deploy_plan` até final).
- **PR89:** hardening de telemetria/evidência do loop já corrigido.

**Observação:** manter escopo restrito ao orchestrator interno; **sem abrir novo escopo** (sem panel/chat/deploy.yml/runtime paralelo).

