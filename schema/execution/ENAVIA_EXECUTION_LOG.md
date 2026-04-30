# ENAVIA — Execution Log

Histórico cronológico de execuções de tarefas/PRs sob o contrato ativo.

---

## 2026-04-29 — PR21 — PR-PROVA — Smoke do loop-status com task in_progress e phase_complete

- **Branch:** `claude/pr21-prova-loop-status-states`
- **Tipo:** `PR-PROVA`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR20 ✅ (commit `a563a97`, PR #181 mergeada — commit merge `028862d`)
- **Escopo:** PR-PROVA. Apenas teste novo + governança. Nenhum runtime alterado.

### Objetivo

Provar formalmente, em uma matriz cruzada e focada, que o `GET /contracts/loop-status` está coerente em todos os estados operacionais relevantes:

1. `queued` / `start_task` → `POST /contracts/execute-next`
2. `in_progress` → `POST /contracts/complete-task` (PR20)
3. `phase_complete` → `POST /contracts/advance-phase` (PR18)
4. `plan_rejected` / `cancelled` / `contract_complete` → vazio ou seguro

### Arquivos alterados

1. **`tests/pr21-loop-status-states.smoke.test.js`** (novo, 53 asserts em 5 cenários):
   - 1. queued → execute-next exclusivo (10 asserts)
   - 2. in_progress → complete-task exclusivo + guidance c/ contract_id/task_id/resultado (12 asserts)
   - 3. phase_complete → advance-phase exclusivo + operationalAction.advance_phase (10 asserts)
   - 4a. plan_rejected → ações vazias (4 asserts)
   - 4b. cancelled → ações vazias (4 asserts)
   - 4c. contract_complete (todas fases done) → ações vazias (4 asserts)
   - 5. Consistência cruzada — matriz de unicidade (9 asserts)
2. **Governança:**
   - `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR21 no topo.
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — atualizado para PR22.
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
   - `schema/contracts/INDEX.md` — próxima PR autorizada = PR22.

### Arquivos NÃO alterados (proibido pelo escopo)

- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, deploy worker, `.github/workflows/`, `wrangler.toml`
- Nenhum teste pré-existente modificado.

### Observação documentada (sem corrigir comportamento)

Durante a construção do teste 4a foi confirmado que `status_global: "blocked"` sozinho **não** faz `resolveNextAction` esconder ações operacionais — o sistema só bloqueia via:
- `state.plan_rejection.plan_rejected === true` (`isPlanRejected` em `contract-executor.js:516`)
- `state.status_global === "cancelled"` (`isCancelledContract` em `contract-executor.js:500`)

Esse é o comportamento existente. PR21 ajustou o cenário 4a para usar `plan_rejection` no shape correto, sem alterar runtime. Se for desejado bloquear via `status_global` no futuro, isso seria uma PR-IMPL separada (não nesta).

### Smoke tests

| Comando | Resultado |
|---------|-----------|
| `node --check tests/pr21-loop-status-states.smoke.test.js` | ✅ |
| `node tests/pr21-loop-status-states.smoke.test.js` | **53 passed, 0 failed** ✅ |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` (regressão) | **27 passed, 0 failed** ✅ |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` (regressão) | **52 passed, 0 failed** ✅ |
| `node tests/pr18-advance-phase-endpoint.smoke.test.js` (regressão) | **45 passed, 0 failed** ✅ |
| `node tests/pr13-hardening-operacional.smoke.test.js` (regressão) | **91 passed, 0 failed** ✅ |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` (regressão) | **183 passed, 0 failed** ✅ |

**Total: 451/451 sem regressão.**

### Bloqueios

Nenhum.

### Próxima etapa autorizada

**PR22** — `PR-DOCS` — Criar `schema/system/ENAVIA_SYSTEM_MAP.md` (mapeamento de componentes, workers, bindings, KV namespaces, rotas e estados do sistema ENAVIA).

---

## 2026-04-29 — PR20 — PR-IMPL — Worker-only — loop-status expõe complete-task em task in_progress

- **Branch:** `claude/pr20-impl-loop-status-in-progress`
- **Tipo:** `PR-IMPL`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR19 ✅ (commit `3662891`, PR #180 mergeada — commit merge `fbf8813`)
- **Escopo:** Worker-only, ajuste cirúrgico em `nv-enavia.js`. Nenhum outro arquivo de runtime alterado.

### Diagnóstico (read-only, antes do patch)

1. `handleGetLoopStatus` em `nv-enavia.js:5024-5047`.
2. `nextAction` montado via `resolveNextAction(state, decomposition)` (linha 5018).
3. Quando task está `in_progress`: `resolveNextAction` Rule 9 (`contract-executor.js:1594-1605`) retorna:
   ```js
   { type: "no_action", phase_id, task_id, reason, status: "in_progress" }
   ```
4. `availableActions` é montado dentro de `if (isReady) { ... } else if (isAwaitingApproval) { ... }` — sem ramo para `isIdle`/`status === "in_progress"`.
5. Confirmado: `start_task` → `execute-next`; `phase_complete` → `advance-phase`; `in_progress` → vazio (gap).

### Patch aplicado em `nv-enavia.js` (cirúrgico)

Adicionado novo `else if` ao `handleGetLoopStatus`, sem refatorar o resto:

```js
} else if (nextAction.status === "in_progress") {
  // PR20 — task em progresso pode ser concluída supervisionadamente via complete-task.
  availableActions = ["POST /contracts/complete-task"];
  guidance = "Task in_progress. Use POST /contracts/complete-task com { contract_id, task_id, resultado } para concluir com gate de aderência.";
}
```

E `canProceed` atualizado para incluir o novo estado válido:
```js
const canProceed = isReady || isAwaitingApproval || (nextAction.status === "in_progress");
```

### Não alterado (proibido pelo escopo)

- `contract-executor.js` — Rule 9 já produz o shape correto, nenhuma mudança necessária ✅
- Endpoints `complete-task`, `execute-next`, `advance-phase` — comportamento intocado
- `panel/`, `executor/`, deploy worker, workflows, `wrangler.toml`
- `buildOperationalAction` — não alterada (`no_action` continua mapeando para `block`, o que é correto: não libera execução errada em `in_progress`)

### Smoke tests

| Comando | Resultado |
|---------|-----------|
| `node --check nv-enavia.js` | ✅ |
| `node --check tests/pr20-loop-status-in-progress.smoke.test.js` | ✅ |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` | **27 passed, 0 failed** ✅ |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` (regressão) | **52 passed, 0 failed** ✅ |
| `node tests/pr18-advance-phase-endpoint.smoke.test.js` (regressão) | **45 passed, 0 failed** ✅ |
| `node tests/pr13-hardening-operacional.smoke.test.js` (regressão) | **91 passed, 0 failed** ✅ |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` (regressão) | **183 passed, 0 failed** ✅ |

**Total: 398/398 sem regressão.**

### Cobertura PR20 (4 seções, 27 asserts)

- **A. Task in_progress** — `loop-status` expõe `POST /contracts/complete-task`, `canProceed:true`, NÃO mostra `execute-next`/`advance-phase`/`close-final`.
- **B. Estados indevidos** — `queued` → execute-next sem complete-task; `phase_complete` → advance-phase sem complete-task; contrato `blocked` → sem complete-task.
- **C. operationalAction** — em `in_progress` permanece `type:block`, `can_execute:false` (não libera execução errada).
- **D. canProceed** — verdadeiro em `start_task`, `phase_complete` e `in_progress`.

### Bloqueios

Nenhum.

### Próxima etapa autorizada

**PR21** — `PR-PROVA` — Smoke do `loop-status` com task `in_progress` e `phase_complete` (cobertura cruzada complementar dos estados operacionais).

---

## 2026-04-29 — PR19 — PR-PROVA — Smoke real ponta a ponta do ciclo execute → complete → advance-phase

- **Branch:** `claude/pr19-prova-advance-phase-e2e`
- **Tipo:** `PR-PROVA`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR18 ✅ (commit `0a1d771`, PR #179 mergeada — commit merge `9b45395`)
- **Escopo:** PR-PROVA. Apenas teste novo + governança. Nenhum runtime alterado.

### Objetivo

Provar via smoke test E2E que o ciclo completo funciona ponta a ponta:

```
loop-status (start_task)
  → execute-next (queued → in_progress)
    → complete-task (in_progress → completed)
      → loop-status (phase_complete)
        → advance-phase (phase_01 → phase_02)
          → loop-status (start_task na phase_02)
```

### Arquivos alterados

1. **`tests/pr19-advance-phase-e2e.smoke.test.js`** (novo, ~330 linhas, 52 asserts):
   - Fixture: contrato com 2 fases reais (`phase_01`, `phase_02`), 2 tasks reais (`task_001`, `task_002`), ambas iniciando como `queued`.
   - Mocks: `EXECUTOR.fetch` (audit + propose ok) e `DEPLOY_WORKER.fetch` (apply-test ok) — padrão idêntico ao PR14.
   - State da fixture inclui `definition_of_done: [...]` (exigido por `auditExecution` em `complete-task`).
   - 4 cenários: HAPPY PATH (Steps 1–6), BLOQUEIO (Step 7), ISOLAMENTO (Step 8), GUARD (Step 9).
2. **Governança:**
   - `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR19 no topo.
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — atualizado para PR20.
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
   - `schema/contracts/INDEX.md` — próxima PR autorizada = PR20.

### Arquivos NÃO alterados (proibido pelo escopo)

- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, deploy worker, `.github/workflows/`, `wrangler.toml`
- Nenhum teste existente foi modificado.

### Cobertura (9 steps, 52 asserts)

| Step | Cenário | Asserts |
|------|---------|---------|
| 1 | `loop-status` inicial → `start_task` para `task_001` | 7 |
| 2 | `execute-next` → `task_001` queued → in_progress | 4 |
| 3 | `complete-task` aderente → `task_001` completed | 6 |
| 4 | `loop-status` → `phase_complete` + `advance-phase` disponível | 8 |
| 5 | `advance-phase` → `phase_01` done, `current_phase` = `phase_02` | 9 |
| 6 | `loop-status` → próxima ação `start_task` para `task_002` | 7 |
| 7 | `advance-phase` antes de completar tasks → 409 + blockers persistidos | 7 |
| 8 | `execute-next` em `phase_complete` NÃO avança fase implicitamente | 2 |
| 9 | `loop-status` em `start_task` NÃO mostra `advance-phase` | 3 |

### Smoke tests

| Comando | Resultado |
|---------|-----------|
| `node --check tests/pr19-advance-phase-e2e.smoke.test.js` | ✅ |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` | **52 passed, 0 failed** ✅ |
| `node tests/pr18-advance-phase-endpoint.smoke.test.js` (regressão) | **45 passed, 0 failed** ✅ |
| `node tests/pr13-hardening-operacional.smoke.test.js` (regressão) | **91 passed, 0 failed** ✅ |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` (regressão) | **183 passed, 0 failed** ✅ |

**Total: 371/371 sem regressão.**

### Bloqueios

Nenhum.

### Próxima etapa autorizada

**PR20** — `PR-IMPL` — Worker-only — `loop-status` expõe ação correta quando task está `in_progress` (deve incluir `POST /contracts/complete-task` em `availableActions`).

---

## 2026-04-29 — PR18 — PR-IMPL — Worker-only — Endpoint supervisionado de avanço de fase

- **Branch:** `claude/pr18-impl-advance-phase-endpoint`
- **Tipo:** `PR-IMPL`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR17 ✅ (commit `f0c1d29`, PR #178 mergeada — commit merge `38582b4`)
- **Escopo:** Worker-only. Apenas `nv-enavia.js`, novo smoke test e governança.

### Objetivo

Fechar o gap diagnosticado em PR17: criar endpoint HTTP supervisionado `POST /contracts/advance-phase` reutilizando integralmente `advanceContractPhase` de `contract-executor.js`. Sem duplicar lógica nem gate.

### Alterações em `nv-enavia.js`

1. **Imports** (linha ~14): adicionado `advanceContractPhase` ao import de `contract-executor.js`.
2. **`buildOperationalAction`** (linha ~4809):
   - `phase_complete` mapeia agora para `advance_phase` (não mais `block`).
   - Comentário do mapeamento atualizado.
   - `EVIDENCE_MAP` ganhou `advance_phase: ["contract_id"]`.
3. **`handleGetLoopStatus`** (linha ~5031):
   - `availableActions = ["POST /contracts/advance-phase"]` quando `nextAction.type === "phase_complete"`.
   - `guidance` reescrita para instruir o uso do endpoint (não diz mais "no phase-advance endpoint exists yet").
4. **Novo handler `handleAdvancePhase`** (antes de `handleExecuteNext`):
   - Lê body JSON; valida `contract_id` (aceita `contract_id` ou `contractId`).
   - Delega para `advanceContractPhase(env, contractId)`.
   - 200 → `{ ok: true, status: "advanced", contract_id, result }`.
   - 400 → JSON inválido ou `contract_id` ausente.
   - 409 → gate falhou ou contrato não encontrado, com `reason` derivada de `result.error/reason/gate.reason`.
   - 500 → exceção não esperada.
5. **Routing** (próximo a `/contracts/complete-task`): `POST /contracts/advance-phase` → `handleAdvancePhase`.
6. **Help text** atualizado com a nova rota.

### Não alterado (proibido pelo escopo)

- `contract-executor.js` (não foi necessário modificar — função já estava completa)
- `panel/`, `executor/`, deploy worker, workflows, `wrangler.toml`
- Nenhum gate paralelo criado, nenhuma lógica de avanço duplicada.

### Smoke tests

- `node --check nv-enavia.js` ✅
- `node --check tests/pr18-advance-phase-endpoint.smoke.test.js` ✅
- `node tests/pr18-advance-phase-endpoint.smoke.test.js` → **45 passed, 0 failed** ✅
- `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅ (regressão)
- `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **183 passed, 0 failed** ✅ (regressão)

### Cobertura do novo smoke test PR18 (5 seções, 45 asserts)

- **A. Validação de input:** JSON inválido → 400, body sem `contract_id` → 400, alias `contractId` aceito.
- **B. Avanço happy path:** `phase_complete` com gate ok → 200 + KV `state` e `decomposition` atualizados; única fase done → `current_phase = "all_phases_complete"`.
- **C. Gate de segurança:** task incompleta → 409, blockers persistidos no state; contract inexistente → 409 `CONTRACT_NOT_FOUND`.
- **D. `loop-status`:** expõe `availableActions = ["POST /contracts/advance-phase"]` e `operationalAction.type === "advance_phase"` com `can_execute: true`.
- **E. Isolamento:** `execute-next` em `phase_complete` NÃO avança fase implicitamente — avanço só via endpoint explícito.

### Bloqueios

Nenhum.

### Próxima etapa autorizada

**PR19** — `PR-PROVA` — Smoke real: `execute-next → complete-task → phase_complete → advance-phase → próxima task/fase` (ciclo completo de ponta a ponta).

---

## 2026-04-29 — PR17 — PR-DIAG — Diagnóstico READ-ONLY de phase_complete e avanço de fase

- **Branch:** `claude/pr17-diag-phase-complete-advance-phase`
- **Tipo:** `PR-DIAG`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **PR anterior validada:** PR0 ✅ (commit `3629698`, PR #177 mergeada)
- **Escopo:** READ-ONLY. Nenhum arquivo de runtime alterado.

### Objetivo

Mapear o gap `phase_complete → advance-phase`: o sistema chega em `phase_complete` mas não possui mecanismo HTTP supervisionado de avanço de fase.

### Diagnóstico — 10 questões

#### 1. Como phase_complete é gerado?

`resolveNextAction(state, decomposition)` em `contract-executor.js` linha 1479 (Rule 4):

```js
// Rule 4: Check if ALL phase tasks are complete → phase_complete
const incompleteInPhase = phaseTasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status));
if (incompleteInPhase.length === 0 && phaseTasks.length > 0) {
  return {
    type: "phase_complete",
    phase_id: activePhase.id,
    task_id: null,
    reason: `All tasks in phase "${activePhase.id}" are complete. Ready to advance.`,
    status: "ready",
  };
}
```

Condição: todas as tasks da fase ativa com status em `["done", "merged", "completed", "skipped"]` e fase tem ao menos 1 task.

#### 2. O que o sistema faz atualmente quando chega em phase_complete?

`buildOperationalAction` em `nv-enavia.js` linha 4809:

```js
phase_complete: "block",
```

E no handler de `loop-status` (linha 5031–5034):

```js
} else if (nextAction.type === "phase_complete") {
  // Não há endpoint de avanço de fase disponível; documentar em guidance.
  guidance = "Phase complete. No phase-advance endpoint exists yet; manual phase transition required.";
}
```

**Resultado:** `availableActions = []` (vazia), `can_execute: false`, `guidance` informativo. O operador fica sem ação automática disponível — exige intervenção manual.

#### 3. advanceContractPhase existe?

**Sim.** `contract-executor.js` linha 1027–1117. Implementação completa. Exportada na linha 5120.

Fluxo interno:
1. `rehydrateContract(env, contractId)` — lê KV (INVARIANT 1+3)
2. `checkPhaseGate(state, decomposition)` — valida que todas as tasks da fase ativa estão done (INVARIANT 2)
3. Marca fase ativa como `"done"` na decomposição
4. Determina próxima fase (`current_phase = next_phase.id` ou `"all_phases_complete"`)
5. Persiste `contract:{id}:state` e `contract:{id}:decomposition` no KV

Retorna: `{ ok: true, state, decomposition, gate }` ou `{ ok: false, error, gate }`.

#### 4. advanceContractPhase está disponível via HTTP?

**Não.** Grep em `nv-enavia.js` por `advance-phase` e `advance_phase` → zero resultados. Não há rota `POST /contracts/advance-phase`.

#### 5. advanceContractPhase está importada em nv-enavia.js?

**Não.** Imports de `contract-executor.js` (linhas 1–30) listam: `handleCreateContract`, `handleGetContract`, `handleGetContractSummary`, `handleGetActiveSurface`, `handleExecuteContract`, `handleCloseContractInTest`, `handleCancelContract`, `handleRejectDecompositionPlan`, `handleResolvePlanRevision`, `handleCompleteTask`, `handleCloseFinalContract`, `resolveNextAction`, `startTask`, `buildExecutionHandoff`, `rehydrateContract`, `readExecEvent`, `readFunctionalLogs`, `handleGitHubPrAction`, `handleRequestMergeApproval`, `handleApproveMerge`, `handleBrowserArmAction`, `getBrowserArmState`, `getBrowserArmStateWithKV`. **`advanceContractPhase` ausente.**

#### 6. Qual estado precisa mudar para sair de phase_complete?

Em `advanceContractPhase`:
- `state.current_phase` → atualizado para o ID da próxima fase ou `"all_phases_complete"`
- `decomposition.phases[activeIndex].status` → marcado como `"done"`
- Ambos persistidos no KV: `contract:{id}:state` e `contract:{id}:decomposition`

#### 7. Quais KV keys/estado são lidos/escritos?

| Operação | KV Key |
|----------|--------|
| Leitura | `contract:{id}:state` |
| Leitura | `contract:{id}:decomposition` |
| Escrita | `contract:{id}:state` (current_phase atualizado) |
| Escrita | `contract:{id}:decomposition` (phase.status = "done") |

Via `rehydrateContract` (leitura) e puts diretos (escrita).

#### 8. Quais gates precisam existir antes de permitir avanço de fase?

`checkPhaseGate(state, decomposition)` — `contract-executor.js` linha 975:
- Encontra a primeira fase com `status !== "done"` (fase ativa)
- Filtra tasks da fase ativa
- Filtra tasks incompletas (`status NOT in ["done", "merged", "completed", "skipped"]`)
- Se `incompleteTasks.length > 0` → `{ canAdvance: false, reason: "Phase X has N incomplete task(s): ..." }`
- Se tudo completo → `{ canAdvance: true, reason: "Phase X acceptance criteria met." }`
- Se todas as fases já done → `{ canAdvance: true, activePhaseId: null, reason: "All phases are complete." }`

O gate já está implementado e já é chamado internamente por `advanceContractPhase`. Nenhum gate adicional precisa ser criado.

#### 9. Quais testes já cobrem ou não cobrem esse cenário?

**Cobrem via função direta (`advanceContractPhase` importada nos testes):**
- `tests/contracts-smoke.test.js`: Tests 18, 19, 20, 23, 24, 25 e dezenas de outros testes usam `advanceContractPhase` como setup ou como subject direto
- `tests/exec-event.smoke.test.js`: linha 90
- `tests/get-health-exec-event.smoke.test.js`: linha 98
- `tests/macro2-f5-enrichment.smoke.test.js`: linhas 101, 251
- `tests/get-execution-exec-event.smoke.test.js`: linha 94

**NÃO cobrem:**
- Nenhum teste de `POST /contracts/advance-phase` via HTTP endpoint (endpoint não existe)
- `tests/pr13-hardening-operacional.smoke.test.js` — zero ocorrências de `phase_complete`
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` — não testa phase_complete nem advance-phase

#### 10. Recomendação objetiva e patch mínimo para PR18

**Diagnóstico:** A função `advanceContractPhase` está **completa, testada e exportada** em `contract-executor.js`. O único gap é a **exposição HTTP supervisionada** via `POST /contracts/advance-phase` em `nv-enavia.js`. Não é necessário criar nenhuma lógica nova — apenas conectar o que já existe.

**Patch mínimo para PR18 (não implementado aqui):**

1. **`nv-enavia.js` — imports** (linha ~11): adicionar `advanceContractPhase` à lista de imports de `contract-executor.js`

2. **`nv-enavia.js` — novo handler** `handleAdvancePhase(request, env)`:
   - Ler `contractId` do body JSON
   - Chamar `await advanceContractPhase(env, contractId)`
   - Retornar JSON com resultado

3. **`nv-enavia.js` — routing** (após `complete-task`, linha ~8210):
   ```js
   if (method === "POST" && path === "/contracts/advance-phase") {
     const result = await handleAdvancePhase(request, env);
     return jsonResponse(result.body, result.status);
   }
   ```

4. **`nv-enavia.js` — `buildOperationalAction`** e handler de `loop-status` (linha ~5031): atualizar `phase_complete` para expor `availableActions = ["POST /contracts/advance-phase"]` em vez de guidance morto.

**Não criar:** nenhuma lógica nova de gate, nenhuma nova função de advance — reutilizar `advanceContractPhase` integralmente.

### Endpoints mapeados

| Endpoint | Existe? | Observação |
|----------|---------|------------|
| `POST /contracts/complete-task` | ✅ | Linha 8207 em nv-enavia.js |
| `GET /contracts/loop-status` | ✅ | Expõe phase_complete mas sem ação disponível |
| `POST /contracts/advance-phase` | ❌ AUSENTE | Gap confirmado |

### Smoke tests desta PR

- `git diff --name-only` na branch → apenas arquivos de governança (nenhum runtime) ✅
- `advanceContractPhase` exportada em `contract-executor.js` linha 5120 ✅ (confirmado via Read)
- Nenhum endpoint `/contracts/advance-phase` em `nv-enavia.js` ✅ (confirmado via Grep — zero resultados)
- `advanceContractPhase` ausente dos imports em `nv-enavia.js` ✅ (confirmado via Read linhas 1–30)
- `phase_complete` mapeia para `block` em `buildOperationalAction` ✅ (linha 4809)
- Guidance na linha 5034 documenta o gap explicitamente ✅

### Bloqueios

Nenhum. Diagnóstico completo. PR18 pode iniciar.

### Próxima etapa autorizada

**PR18** — PR-IMPL — Worker-only — Endpoint supervisionado de avanço de fase (`POST /contracts/advance-phase`).

---

## 2026-04-29 — PR0 (revisão) — Reestruturação do contrato PR17–PR30 por feedback

- **Branch:** `claude/pr0-docs-loop-obrigatorio`
- **Tipo:** `PR-DOCS` (revisão pós-feedback)
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- **Escopo:** Docs-only. Sem alteração em Worker, Panel, Executor, Deploy Worker, workflows, JS/TS/JSX/TSX.
- **Motivo:** Feedback @brunovasque: contrato original priorizava "loop de skills" cedo demais. Gap real é o mecanismo de avanço de fase (`phase_complete → advance-phase`). Skills só devem entrar após loop perfeito + System/Tool Registry.
- **Alterações:**
  1. `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — seções 2, 4, 6–13 reestruturadas:
     - Seção 2: objetivo macro revisado com 4 frentes em ordem estrita de dependência.
     - Seção 4: nova ordem obrigatória de PRs (PR17=DIAG phase_complete, PR18=IMPL advance-phase, PR19=PROVA ciclo completo, PR20=IMPL loop-status in_progress, PR21=PROVA, PR22–PR25=DOCS system map, PR26–PR29=DOCS skills, PR30=fechamento).
     - Seções 6–13: detalhamento de cada PR com objetivo, pré-requisito, escopo e critérios de aceite.
  2. `schema/contracts/INDEX.md` — "Próxima PR autorizada" atualizada para PR17 com contexto do gap.
  3. `schema/status/ENAVIA_STATUS_ATUAL.md` — decisões de PR0 atualizadas com revisão.
  4. `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — próxima ação e descrição do contrato atualizadas.
  5. `schema/execution/ENAVIA_EXECUTION_LOG.md` — este bloco.
- **Smoke tests:**
  - `git diff --name-only` — confirma Docs-only ✅
  - Contrato contém `phase_complete` como prioridade antes de skills ✅
  - PR17 é PR-DIAG read-only ✅
  - Skills (PR26–PR29) só entram após PR21 e PR25 ✅
  - Nenhum endpoint de skills antes de PR26 ✅
  - Governança atualizada (status, handoff, execution log, INDEX.md) ✅
- **Bloqueios:** nenhum.
- **Próxima etapa autorizada:** PR17 — PR-DIAG — Diagnóstico READ-ONLY de `phase_complete` e avanço de fase.

---



- **Branch:** `claude/pr0-docs-loop-obrigatorio`
- **Tipo:** `PR-DOCS`
- **Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` (criado nesta PR)
- **Escopo:** Docs-only. Sem alteração em Worker, Panel, Executor, Deploy Worker, workflows, JS/TS/JSX/TSX.
- **Alterações:**
  1. `CLAUDE.md` — adicionada seção `## Loop obrigatório de execução por PR` (seção 4, 17 passos + regras de bloqueio); referência fixa ao contrato `PR1–PR7` removida; orientação para localizar contrato ativo em `schema/contracts/active/`; seções renumeradas 4→5, 5→6, 6→7, 7→8, 8→9; `schema/contracts/INDEX.md` adicionado à estrutura obrigatória.
  2. `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — criado. Novo contrato ativo PR17–PR30.
  3. `schema/contracts/INDEX.md` — criado. Índice central de todos os contratos.
  4. Governança: status, handoff, execution log atualizados.
- **Histórico de contratos:**
  - PR1–PR7: `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` — Encerrado ✅
  - PR8–PR16: `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` (+ fixes PR14–PR16) — Encerrado ✅
  - Novo: `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — Ativo 🟢
- **Smoke tests:**
  - `git diff --name-only` — confirma Docs-only ✅
  - `CLAUDE.md` contém `Loop obrigatório de execução por PR` ✅
  - `CLAUDE.md` não fixa mais `PR1–PR7` como contrato ativo exclusivo ✅
  - Status, handoff, execution log e INDEX.md atualizados ✅
- **Bloqueios:** nenhum.
- **Próxima etapa autorizada:** PR17 — PR-DIAG — Diagnóstico do estado atual do loop de skills.

---

## 2026-04-29 — PR16 — Fix: execute-next inicia task queued antes de delegar execução

- **Branch:** `claude/pr16-fix-execute-next-starttask`
- **Escopo:** Worker-only (`nv-enavia.js` + `tests/pr14-executor-deploy-real-loop.smoke.test.js`). Sem alteração em Executor, Panel, Deploy Worker externo, gates, contract-executor.js ou bindings.
- **Problema diagnosticado (READ-ONLY):** `POST /contracts/execute-next` retornava HTTP 409 `TASK_NOT_IN_PROGRESS` porque `resolveNextAction` retorna `start_task` para tasks em status `queued`, mas o fluxo não chamava `startTask` antes de delegar ao `handleExecuteContract`. O gate 2 de `executeCurrentMicroPr` exige `task.status === "in_progress"` e bloqueava. Adicionalmente, `handleGetLoopStatus` mostrava `availableActions: ["POST /contracts/execute"]` em vez do endpoint supervisionado canônico.
- **Correção cirúrgica (3 pontos):**
  1. `nv-enavia.js` — import de `startTask` de `contract-executor.js` adicionado.
  2. `nv-enavia.js` (`handleGetLoopStatus`): `availableActions` de `start_task`/`start_micro_pr` atualizado para `["POST /contracts/execute-next"]`.
  3. `nv-enavia.js` (`handleExecuteNext`, step D0): bloco inserido após `deploy simulate` OK e antes de `syntheticReq`. Se `nextAction.type === "start_task"` e `nextAction.task_id`, chama `startTask(env, contractId, nextAction.task_id)` com try/catch. Falha bloqueia com reason claro; sucesso segue para handler interno.
- **Testes novos (seção F):**
  - F1: task queued + tudo ok → startTask chamado, KV tem writes, NÃO retorna TASK_NOT_IN_PROGRESS.
  - F2: KV.put falha → startTask bloqueado, retorna blocked com reason.
  - F3: loop-status start_task → availableActions contém POST /contracts/execute-next, não contém POST /contracts/execute.
- **Testes executados:**
  - `node --check nv-enavia.js` → OK ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **183 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Arquivos alterados:**
  - `nv-enavia.js`
  - `tests/pr14-executor-deploy-real-loop.smoke.test.js`
  - `schema/status/ENAVIA_STATUS_ATUAL.md`
  - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
  - `schema/execution/ENAVIA_EXECUTION_LOG.md`

---

## 2026-04-29 — FIX — incluir `patch.content` no payload do Deploy Worker `/apply-test`

- **Branch:** `copilot/fix-nv-enavia-payload`
- **Escopo:** Worker-only. Sem alteração em Executor, Panel, Deploy Worker externo, gates ou bindings.
- **Problema:** após a PR174 (que corrigiu `target.workerId`), o loop operacional voltou a falhar em TEST com HTTP 400 `patch.content obrigatório` no `DEPLOY_WORKER /apply-test`. O `_deployPayload` já tinha `workerId`/`target.workerId`, mas não incluía o campo `patch`.
- **Correção cirúrgica:**
  1. `nv-enavia.js` (`handleExecuteNext`, step C do execute_next): `_deployPayload` agora inclui `patch: { type: "contract_action", content: JSON.stringify(nextAction) }`, reutilizando exatamente o mesmo shape já montado para `_proposePayload`.
  2. `tests/pr14-executor-deploy-real-loop.smoke.test.js` ampliado com 3 novos asserts (C5 e E1) para validar:
     - `/apply-test` recebe `patch` como objeto;
     - `patch.content` não vazio;
     - `patch.content` consistente com o mesmo campo enviado ao `/propose`.
- **Testes executados:**
  - `node --check nv-enavia.js` → OK ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **168 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Shape final do patch enviado ao /apply-test:**
  ```json
  { "type": "contract_action", "content": "<JSON.stringify(nextAction)>" }
  ```
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** revalidar o fluxo real `POST /contracts/execute-next` em TEST com `DEPLOY_WORKER` real e confirmar que `/apply-test` deixa de retornar `patch.content obrigatório`.

---

## 2026-04-29 — FIX — enviar `target.workerId` no payload do Deploy Worker `/apply-test`

- **Branch:** `copilot/nv-enavia-include-target-workerid`
- **Commit de código:** `354d9be`
- **Escopo:** Worker-only. Sem alteração em Executor, Panel, Deploy Worker externo ou bindings.
- **Problema:** o loop operacional já resolvia o target worker dinâmico para `POST /audit` e `POST /propose`, mas o `_deployPayload` enviado por `callDeployBridge(...)/apply-test` não carregava `workerId`/`target.workerId`. Em TEST isso gerava bloqueio real no Deploy Worker com HTTP 400 e erro `target.workerId obrigatório`.
- **Correção:**
  1. `nv-enavia.js` (`handleExecuteNext`, step C do execute_next) agora inclui `...buildExecutorTargetPayload(auditTargetResolution.workerId)` no `_deployPayload`.
  2. O payload de `/apply-test` passa a reutilizar exatamente a mesma fonte de verdade dinâmica já usada em `/audit` e `/propose`.
  3. `tests/pr14-executor-deploy-real-loop.smoke.test.js` foi ampliado para validar explicitamente que `/apply-test` recebe `workerId` e `target.workerId` consistente.
- **Testes executados:**
  - `node --check nv-enavia.js` → OK ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **164 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** revalidar o fluxo real em TEST com `DEPLOY_WORKER` real e confirmar que `/apply-test` deixa de retornar `target.workerId obrigatório`.

---

## 2026-04-29 — FIX — bootstrap do snapshot canônico do Executor no KV após deploy TEST

- **Branch:** `copilot/bootstrap-snapshot-canonico-executor-kv`
- **Commit de código:** `b4ba2a2`
- **Escopo:** Executor-only + workflow do executor. Sem alteração em `nv-enavia.js`, painel, Deploy Worker ou bindings.
- **Problema:** o self-audit do Executor em TEST já conseguia fazer live-read, mas continuava emitindo finding crítico `Snapshot canônico do executor ausente no KV` logo após deploy porque o namespace `ENAVIA_GIT_TEST` ainda não tinha bootstrap de snapshot para o runtime recém-publicado.
- **Correção:**
  1. `saveVersion(...)` em `executor/src/index.js` passou a sincronizar também o alias legado `git:code:latest` junto com o snapshot canônico (`git:latest` + `git:code:<id>`).
  2. `.github/workflows/deploy-executor.yml` ganhou a etapa `Bootstrap canonical Executor snapshot TEST` logo após `Deploy Executor TEST`.
  3. Essa etapa monta payload com o `executor/src/index.js` do commit atual e chama `POST /apply-patch` em `https://enavia-executor-test.brunovasque.workers.dev/apply-patch` com `auto_deploy:false`.
  4. O workflow falha cedo se o bootstrap não devolver `meta.id` canônico e `code_length` válido.
  5. O smoke `POST /audit` live-read continua rodando depois do bootstrap, validando a prova `snapshot_fingerprint`.
- **Testes executados:**
  - `node --check executor/src/index.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → **34 passed, 0 failed** ✅
  - `node --test executor/tests/cloudflare-credentials.test.js` → **4 passed, 0 failed** ✅
  - `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-executor.yml')); print('YAML válido')"` → YAML válido ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** rodar `Deploy enavia-executor` em `target_env=test` e confirmar no log do workflow o bootstrap via `/apply-patch` seguido do smoke `/audit` sem finding de snapshot ausente.

---

## 2026-04-29 — FIX — resolução canônica de credenciais Cloudflare no runtime do Executor

- **Branch:** `copilot/port-cloudflare-credentials-fix`
- **Commit de código:** `f73744b`
- **Escopo:** Executor-only + workflow do executor. Sem alteração em `nv-enavia.js`, painel, Deploy Worker ou gates de `risk_level`.
- **Problema:** o runtime `enavia-executor-test` publicado por este repo ainda resolvia credenciais Cloudflare de forma divergente entre `/audit`, `/propose`, listagem de scripts e live-read interno. Isso fazia o ramo `context.require_live_read:true` falhar com `CF_ACCOUNT_ID/CF_API_TOKEN ausentes no Executor.` mesmo quando os secrets existiam sob aliases compatíveis.
- **Correção:**
  1. Novo helper `executor/src/cloudflare-credentials.mjs` com:
     - `resolveCloudflareCredentials(env)`
     - `getCloudflareCredentialPresence(env)`
     - `createCloudflareCredentialsError(env, message)`
  2. Aliases suportados de forma canônica:
     - account: `CF_ACCOUNT_ID`, `CLOUDFLARE_ACCOUNT_ID`, `CF_ACCOUNT`, `CLOUDFLARE_ACCOUNT`
     - token: `CF_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CF_TOKEN`
  3. `/audit` e `/propose` agora usam o helper único e retornam apenas booleans `has_*` quando as credenciais faltam.
  4. Caminhos internos de Cloudflare API (`listCloudflareWorkerScripts`, live-read do worker alvo em `/audit`/`engineer`, snapshot helpers) foram alinhados ao mesmo resolver.
  5. Erros internos de live-read por credenciais ausentes propagam apenas `message` + booleans `has_*`, sem valores de credenciais.
  6. `.github/workflows/deploy-executor.yml` agora:
     - roda `node --test executor/tests/cloudflare-credentials.test.js`;
     - faz smoke `POST /audit` com `workerId`, `target.workerId` e `context.require_live_read:true`;
     - falha se a resposta mencionar credenciais ausentes;
     - falha se não houver `snapshot_fingerprint`.
- **Testes executados:**
  - `node --check executor/src/index.js` → OK ✅
  - `node --check executor/src/cloudflare-credentials.mjs` → OK ✅
  - `node --check executor/tests/cloudflare-credentials.test.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → **33 passed, 0 failed** ✅
  - `node --test executor/tests/cloudflare-credentials.test.js` → **4 passed, 0 failed** ✅
  - `python3 -c "import yaml; yaml.safe_load(...deploy-executor.yml...)"` → **YAML válido** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** disparar `Deploy enavia-executor` em TEST para publicar o patch e confirmar o smoke live-read no runtime `enavia-executor-test`.

---

## 2026-04-29 — FIX — target dinâmico para o Executor `/audit` em `POST /contracts/execute-next`

- **Branch:** `copilot/investigate-risk-level-audit`
- **Commit de código:** `d3e0ee2`
- **Escopo:** Worker-only. Sem tocar em painel, executor externo, KV runtime ou relaxamento do gate de recibo.
- **Problema:** o loop operacional chamava o Executor `/audit` com payload pobre, sem alvo confiável. Isso permitia `workerId` hardcoded no `/propose` e deixava o `/audit` sem `workerId`/`target.workerId`, o que inviabiliza auditoria segura do alvo real.
- **Correção:**
  1. `nv-enavia.js` passou a importar `buildExecutionHandoff`.
  2. Novo helper `resolveAuditTargetWorker(state, decomposition, nextAction)` resolve o alvo em ordem segura:
     - `state.current_execution.handoff_used.scope.workers`
     - micro-PR da `nextAction`
     - `buildExecutionHandoff(...).scope.workers`
     - `state.scope.workers`
  3. Se existir exatamente um alvo confiável:
     - `/audit` recebe `workerId`, `target.workerId` e `context.require_live_read:true`;
     - `/propose` reutiliza o mesmo `workerId`.
  4. Se não houver alvo confiável, `POST /contracts/execute-next` bloqueia antes do Executor com:
     - `status: "blocked"`
     - `reason: "target worker ausente para auditoria segura"`
  5. Se houver ambiguidade de múltiplos workers, o fluxo também bloqueia sem assumir um alvo artificial.
  6. Follow-up pós-code-review:
     - helper `buildExecutorTargetPayload(workerId)` evita duplicação do bloco `{ workerId, target }`;
     - testes PR14 agora validam payloads com null-check antes de fazer parse.
- **Smoke tests atualizados (`tests/pr14-executor-deploy-real-loop.smoke.test.js`):**
  - fixture `execute_next` agora inclui micro-PR TEST com `target_workers`.
  - fixture `approve` agora inclui `current_execution.handoff_used.scope.workers`.
  - novo cenário `C0`: bloqueio explícito sem target worker confiável, sem chamar Executor nem Deploy Worker.
  - cenário `C5`: valida que `/audit` recebe `workerId` dinâmico, `target.workerId` consistente e `context.require_live_read:true`.
  - cenário `D1`: valida `workerId` dinâmico também no path `approve`.
- **Validações locais:**
  - `node --check nv-enavia.js` → OK ✅
  - `node --check contract-executor.js` → OK ✅
  - `node --check tests/pr14-executor-deploy-real-loop.smoke.test.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **161 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** rodar o loop real em TEST com contrato/micro-PR contendo `target_workers` explícito e confirmar se o `/audit` do Executor retorna `risk_level` coerente com o alvo real, sem alterar o gate de recibo.

---

## 2026-04-29 — FIX — registrar recibo de audit aprovado antes do `/apply-test` (revisão pós-review)

- **Branch:** `copilot/nv-enavia-register-audit-receipt`
- **Escopo:** Worker-only. Correção dos dois bloqueios apontados no code review da PR:
  1. Rota de registro do recibo: `/audit` → `/__internal__/audit` (rota canônica confirmada)
  2. Validação forte antes de registrar o recibo: nova função `validateExecutorAuditForReceipt`
- **Correções desta sessão:**
  1. Rota do recibo corrigida para `/__internal__/audit`.
  2. `validateExecutorAuditForReceipt(executorAudit)` valida obrigatoriamente:
     - `executor_audit` existe e é objeto.
     - `verdict` extraído de `result.verdict | audit.verdict | verdict` é exatamente `"approve"`.
     - `risk_level` extraído não é `"high"` nem `"critical"`.
     - `risk_level` **desconhecido/null** retorna erro (sem default silencioso para "low" ou "medium").
  3. `extractDeployAuditRiskLevel` atualizado para incluir `"critical"` e retornar `null` para níveis desconhecidos.
  4. O campo `audit.ok=true` só é incluído no payload do recibo após validação bem-sucedida com dados reais.
  5. `deploy_route` reflete rota real (`/__internal__/audit` ou `/apply-test`).
- **Smoke tests ampliados (`tests/pr14-executor-deploy-real-loop.smoke.test.js`):**
  - B4a: verdict "conditional" (passa executor bridge, falha no gate de validação).
  - B4b: verdict "reject" → executor bridge bloqueia (deploy_status: not_reached).
  - B4c: verdict ausente → executor bridge bloqueia (deploy_status: not_reached).
  - B4d: verdict "approve" + risk_level "high" → gate de validação bloqueia.
  - B4e: verdict "approve" + risk_level "critical" → gate de validação bloqueia.
  - B4f: verdict "approve" + risk_level desconhecido → gate de validação bloqueia (sem fabricação).
  - Todas as asserções de rota no mock de deploy atualizadas para `/__internal__/audit`.
- **Validações locais:**
  - `node --check nv-enavia.js` → OK ✅
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **148 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** validar o fluxo real em TEST com `DEPLOY_WORKER` real para confirmar que `POST /__internal__/audit` é aceito antes do `/apply-test`.

---

## 2026-04-29 — FIX — Resolver KV namespace IDs por title (deploy-executor.yml)

- **Branch:** `copilot/update-deploy-executor-workflow`
- **Commit:** `80fd164`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, executor runtime, painel, KV runtime, `wrangler.toml` principal ou bindings.
- **Problema:** o token/conta do GitHub Actions enxerga o namespace `enavia-brain-test`, mas o secret manual `ENAVIA_BRAIN_TEST_KV_ID` continuava validando como `INVALID`. Depender de 6 secrets manuais de KV ID gerava fragilidade e tentativa cega.
- **Correção:** o workflow passou a rodar `npx wrangler kv namespace list > /tmp/kv_namespaces.json` e resolver internamente os IDs pelo `.title`:
  - PROD: `enavia-brain`, `ENAVIA_GIT`.
  - TEST: `enavia-brain-test`, `ENAVIA_GIT_TEST`.
  - `GIT_KV_ID` reutiliza o ID resolvido de `ENAVIA_GIT`.
  - `GIT_KV_TEST_ID` reutiliza o ID resolvido de `ENAVIA_GIT_TEST`.
- **Segurança de logs:** o workflow imprime apenas titles/nomes e mensagens `KV namespace resolvido por title: <title>`. IDs não são impressos. Em erro de namespace ausente, a falha mostra apenas o title obrigatório faltante.
- **Secrets:** os 6 secrets manuais de KV ID não são mais exigidos nem referenciados no workflow. Continuam obrigatórios apenas `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
- **Arquivo gerado:** `wrangler.executor.generated.toml` continua sendo gerado a partir de `wrangler.executor.template.toml`.
- **Validações locais:**
  - `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-executor.yml')); print('YAML válido')"` → YAML válido ✅
  - Smoke local com `/tmp/kv_namespaces.json` sintético → resolução por title OK, TOML sem placeholders fora de comentários e output sem IDs ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** reexecutar `Deploy enavia-executor` em `target_env=test` e validar o deploy/smoke real.

---

## 2026-04-29 — DIAGNÓSTICO — Listar TÍTULOS dos KV namespaces visíveis na conta/token (deploy-executor.yml)

- **Branch:** `copilot/improve-validate-kv-namespace-ids`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, `executor/src/index.js`, `panel/`, `wrangler.toml`, bindings ou KV runtime.
- **Motivação:** A execução anterior provou que os 3 secrets `*_TEST_KV_ID` retornam `INVALID` enquanto os 3 PROD retornam `OK`. Para decidir entre "conta/token errado" vs "valor de secret errado" sem trocar secrets no escuro, é preciso saber quais KV namespaces o token do GitHub Actions efetivamente enxerga.
- **Patch:** Na etapa `Validate KV namespace IDs against Cloudflare`, após validar que `wrangler kv namespace list` retornou JSON array e antes do loop `check_kv`, imprime `KV namespaces visíveis nesta conta/token:` seguido de uma lista ordenada e única dos `.title` (com fallback para `.name`) de cada namespace, prefixados com `- `. Sem IDs. Sem secrets.
- **Comando-chave:** `jq -r '.[] | (.title // .name // empty)' /tmp/kv_namespaces.json | sort -u | sed 's/^/- /'`
- **Validação:** `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-executor.yml'))"` → OK.
- **Critério de leitura no próximo run:**
  1. Sem `enavia-brain-test` / `ENAVIA_GIT_TEST` / `enavia-executor-test` → problema é `CLOUDFLARE_ACCOUNT_ID`/token.
  2. Com eles na lista → problema é valor dos secrets TEST.
- **Próximo passo:** Reexecutar `Deploy enavia-executor` em TEST e analisar a nova seção "KV namespaces visíveis nesta conta/token".

---

## 2026-04-29 — FIX — Robustez do parse na validação de KV namespace IDs (deploy-executor.yml)

- **Branch:** `copilot/fix-validate-kv-namespace-ids`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, `executor/src/index.js`, `panel/`, `wrangler.toml`, bindings ou KV runtime.
- **Problema:** a etapa `Validate KV namespace IDs against Cloudflare` capturava `npx wrangler kv namespace list 2>&1` dentro de `KV_LIST_JSON`. Qualquer warning/banner em stderr contaminava o stdout e o `jq` passava a falhar para todos os checks, gerando falso-positivo de 6 secrets `INVALID`.
- **Correção:** stdout e stderr separados em arquivos temporários:
  1. `npx wrangler kv namespace list > /tmp/kv_namespaces.json 2> /tmp/wrangler_kv_list.err`
  2. Se o comando falhar, o workflow imprime erro claro + stderr e encerra.
  3. Se stdout não for JSON array válido, o workflow imprime erro claro + stderr + preview curto do stdout e encerra.
  4. `check_kv()` passou a consultar `/tmp/kv_namespaces.json` com `jq --arg id`, sem expor secret.
- **Validações locais:**
  - `node --check executor/src/index.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → **33 passed, 0 failed** ✅
  - `python3 yaml.safe_load(...)` em `.github/workflows/deploy-executor.yml` → **YAML válido** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** reexecutar o workflow `Deploy enavia-executor` em `target_env=test` e observar se a etapa passa a distinguir erro de parse JSON vs. KV ID realmente inválido.

---

## 2026-04-29 — FIX — Validação KV namespace IDs contra Cloudflare (deploy-executor.yml)

- **Branch:** `copilot/fix-kv-secret-validation`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, `executor/src/index.js`, `panel/`, `wrangler.toml`, KV runtime.
- **Problema:** Deploy falhava com `KV namespace '***' is not valid [code: 10042]`. O GitHub mascarava o valor com `***`, impossibilitando diagnóstico. Não era possível saber qual dos 6 KV secrets estava inválido.
- **Correção:** Nova etapa `Validate KV namespace IDs against Cloudflare` adicionada após `Setup Node` e antes de qualquer `wrangler deploy`. A etapa:
  1. Chama `npx wrangler kv namespace list` (requer `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`).
  2. Para cada um dos 6 secrets/bindings, verifica se o ID aparece no JSON retornado.
  3. Imprime `OK` ou `INVALID` sem imprimir o valor do secret.
  4. Se algum for INVALID, falha antes do deploy com mensagem clara.
- **Validação YAML:** `python3 yaml.safe_load(...)` → **YAML válido** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** rodar workflow `Deploy enavia-executor` com `target_env=test`. O output do novo step mostrará exatamente qual(is) KV ID(s) está(ão) inválido(s).

---

## 2026-04-29 — FIX — Validação falso-positivo no deploy-executor (comentários)

- **Branch:** `copilot/fix-validate-generated-config`
- **Escopo:** Apenas `.github/workflows/deploy-executor.yml`. Nenhuma alteração em `nv-enavia.js`, `executor/`, `panel/`, `wrangler.toml`, KV.
- **Problema:** Passo "Validate generated config (no placeholders remaining)" usava `grep -q "REPLACE_WITH_REAL_"` que capturava o texto `REPLACE_WITH_REAL_*` em linhas de comentário do `wrangler.executor.generated.toml`, mesmo após todos os IDs terem sido substituídos.
- **Correção:** Substituído por `grep -v '^[[:space:]]*#' ... | grep -q "REPLACE_WITH_REAL_"` para ignorar linhas comentadas antes de buscar placeholders.
- **Evidência:** Grep antigo → "FALSO POSITIVO detectado"; grep novo → "OK: nenhum placeholder fora de comentários" ✅
- **Validação YAML:** `python3 yaml.safe_load(...)` → **YAML válido** ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** rodar workflow `Deploy enavia-executor` com `target_env=test`.

---

## 2026-04-29 — INFRA-ONLY — Deploy separado para o Executor (enavia-executor-test / enavia-executor)

- **Branch:** `copilot/create-separate-deploy-executor`
- **Escopo:** Infra-only. Nenhuma alteração em `nv-enavia.js`, `contract-executor.js`, `executor/src/index.js`, `executor/src/audit-response.js`, `wrangler.toml` (principal), painel ou KV.
- **Arquivos criados:**
  1. `wrangler.executor.toml` — config de deploy do Executor: PROD (`enavia-executor`) e TEST (`enavia-executor-test`). `main = "executor/src/index.js"`. KV namespaces como placeholders (requer preenchimento com IDs reais antes do deploy).
  2. `executor/package.json` — declara dependência `acorn ^8.16.0` (usado em `executor/src/index.js`). Necessário para `npm install --prefix executor` no workflow.
  3. `.github/workflows/deploy-executor.yml` — workflow manual (`workflow_dispatch`) com input `target_env: test | prod`. Valida secrets, placeholders e roda testes antes do deploy.
- **Fluxo TEST:** `wrangler deploy --config wrangler.executor.toml --env test` → publica em `enavia-executor-test`.
- **Fluxo PROD:** `wrangler deploy --config wrangler.executor.toml` → publica em `enavia-executor`.
- **Smoke TEST embutido no workflow:** `POST /audit` em `enavia-executor-test` valida `result.verdict` e `audit.verdict`.
- **Testes executados localmente:**
  - `node --check executor/src/index.js` → OK ✅
  - `node --check executor/src/audit-response.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → **33 passed, 0 failed** ✅
  - Validação YAML: `python3 yaml.safe_load(...)` → **YAML válido** ✅
- **Bloqueios:** nenhum. KV namespace IDs precisam ser preenchidos no `wrangler.executor.toml` antes do primeiro deploy real.
- **Próxima etapa segura:** preencher IDs reais no `wrangler.executor.toml` e rodar o workflow `Deploy enavia-executor` com `target_env=test`.

---

## 2026-04-28 — PR14 ajuste P1 — bloquear JSON inválido em bridges do Executor/Deploy

- **Branch:** `claude/pr14-executor-deploy-real-loop`
- **PR:** #162
- **Escopo:** Worker-only. Ajuste cirúrgico em `nv-enavia.js` + smoke tests da PR14. Sem alteração em Panel, Executor externo, Deploy Worker externo, `contract-executor.js`, `executor/` ou `wrangler.toml`.
- **Diagnóstico:**
  1. `callExecutorBridge(...)` convertia parse inválido para `{ raw: ... }`; como isso é objeto, o fluxo ainda podia cair em `status: "passed"`.
  2. `callDeployBridge(...)` tinha o mesmo problema.
  3. Isso permitia tratar body HTTP 200 ilegível como resposta válida, o que é inseguro.
- **Patch aplicado:**
  1. `callExecutorBridge(...)` agora retorna imediatamente `ok:false`, `status:"ambiguous"`, `reason:"Resposta do Executor não é JSON válido."` e `data:{ raw }` quando `JSON.parse` falha.
  2. `callDeployBridge(...)` agora retorna imediatamente `ok:false`, `status:"ambiguous"`, `reason:"Resposta do Deploy Worker não é JSON válido."` e `data:{ raw }` quando `JSON.parse` falha.
  3. `tests/pr14-executor-deploy-real-loop.smoke.test.js` ampliado com:
     - `/propose` HTTP 200 + body não-JSON → bloqueia antes do deploy.
     - Deploy Worker HTTP 200 + body não-JSON → bloqueia antes do handler interno.
     - `makeKV().writes` para provar ausência de execução do handler interno.
- **Smoke tests:**
  - `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **111 passed, 0 failed** ✅
  - `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅
- **CI/Actions investigado:** run `Addressing comment on PR #162` (`25080312763`) encontrada em andamento; sem job falho no momento da inspeção.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** aguardar revisão do ajuste P1 na PR #162.

---

## 2026-04-28 — PR14 — Worker-only — Executor real + Deploy Worker no loop operacional

- **Branch:** `claude/pr14-executor-deploy-real-loop`
- **Escopo:** Worker-only. Apenas `nv-enavia.js`. Sem alteração em Panel, Executor externo, Deploy Worker externo, `contract-executor.js` ou `executor/`.
- **Helpers criados em `nv-enavia.js`:**
  1. `callExecutorBridge(env, route, payload)` — chama `env.EXECUTOR.fetch` para `/audit` e `/propose`. Bloqueia se `env.EXECUTOR` ausente, resposta não-ok, ambígua ou `verdict:reject`. Retorna `{ ok, route, status, reason, data }`.
  2. `callDeployBridge(env, action, payload)` — chama `env.DEPLOY_WORKER.fetch` apenas em modo seguro (`/apply-test`, `target_env:"test"`). Bloqueia ações de produção (approve/promote/prod), `target_env:prod` e ausência de binding. Retorna `{ ok, action, status, reason, data }`.
- **`buildExecutorPathInfo` atualizado:** `execute_next` e `approve` agora refletem `uses_service_binding: true` e o novo `handler` chain com bridges.
- **`handleExecuteNext` integrado:**
  - `execute_next`: gates atuais → audit → propose → deploy (simulate) → handler interno KV.
  - `approve`: gates atuais (confirm+approved_by) → audit → handler interno KV. Sem propose, sem deploy.
  - Produção automaticamente bloqueada.
  - Handler interno só roda depois de todos os bridges passarem.
- **Response estendida:** `executor_audit`, `executor_propose`, `executor_status`, `executor_route`, `executor_block_reason`, `deploy_result`, `deploy_status`, `deploy_route`, `deploy_block_reason` em todos os paths.
- **Smoke tests:**
  - `tests/pr14-executor-deploy-real-loop.smoke.test.js` → **93 passed, 0 failed** ✅
  - `tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅ (3 asserts atualizados para refletir mudança intencional de PR14 em `buildExecutorPathInfo`)
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** Novo contrato se necessário.

---

## 2026-04-28 — PR13 — Worker-only — hardening final e encerramento do contrato PR8–PR13

- **Branch:** `claude/pr13-hardening-final-operacional`
- **Contrato:** `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`
- **Escopo:** Worker-only. Diagnóstico e testes de hardening. Sem alteração em Panel, Executor ou `contract-executor.js`.
- **Diagnóstico:**
  1. CORS confirmado: `jsonResponse()` chama `withCORS()` internamente em todas as respostas.
  2. `GET /contracts/loop-status` confirmado no routing block; resposta inclui `ok`, `generatedAt`, `contract`, `nextAction`, `operationalAction`, `loop`.
  3. `POST /contracts/execute-next` confirmado com 8 gates: JSON inválido, sem KV, sem contrato, `can_execute:false`, evidence faltando, evidence presente, approve sem `confirm`, approve sem `approved_by`.
  4. `env.EXECUTOR.fetch` confirmado como NÃO chamado em nenhum path do execute-next (fluxo inteiramente KV).
  5. Rollback confirmado como recomendação pura — sem execução automática.
  6. `Promise.race` ausente — design correto para handlers que mutam KV.
- **Smoke test criado:** `tests/pr13-hardening-operacional.smoke.test.js`
  - Seção A: shape do loop-status, CORS, sem KV, index vazio, contrato ativo
  - Seção B: todos os gates do execute-next
  - Seção C: isolamento do executor, rollback como recomendação, status presente em todos os paths
  - Seção D: CORS no execute-next, OPTIONS preflight
  - **Resultado: 91 passed, 0 failed ✅**
- **Bloqueios:** nenhum.
- **Contrato PR8–PR13: FORMALMENTE ENCERRADO ✅**
- **Próxima etapa segura:** Nenhuma. Contrato concluído.

---

## 2026-04-28 — PR12 Ajuste — feedback da PR #160 na `LoopPage`

- **Branch:** `claude/pr12-panel-botoes-operacionais`
- **PR:** #160
- **Escopo:** Panel-only. Ajuste cirúrgico em `panel/src/pages/LoopPage.jsx` + teste direcionado. Sem alteração em Worker, Executor, `contract-executor.js` ou `wrangler.toml`.
- **Patch aplicado:**
  1. Seção "Status do Loop" passou a usar `loopData.contract.{id,status,current_phase,current_task,updated_at}`.
  2. `loop` ficou restrito aos campos de supervisão (`canProceed`, `blockReason`, `availableActions`, `guidance`).
  3. `handleExecute` agora prioriza `r.data` mesmo com `r.ok === false`, preservando o payload canônico do backend.
  4. Teste direcionado adicionado em `panel/src/__tests__/pr12-loop-page-contract-and-error-payload.test.js`.
- **Smoke tests:**
  - `npx vitest run src/__tests__/pr12-loop-page-contract-and-error-payload.test.js` → 4 testes, 4 passed ✅
  - `npm test` → 31 arquivos, 894 testes passed ✅
  - `npm run build` → 141 modules transformed, 0 errors ✅
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR13 — Worker-only — hardening final.

---

## 2026-04-28 — PR12 — Panel-only — botões operacionais no painel

- **Branch:** `claude/pr12-panel-botoes-operacionais`
- **Contrato:** `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`
- **Escopo:** Panel-only. Sem alteração em Worker, Executor, `contract-executor.js` ou `wrangler.toml`.
- **Arquivos criados:**
  - `panel/src/api/endpoints/loop.js` — `fetchLoopStatus()` (GET /contracts/loop-status) + `executeNext(body)` (POST /contracts/execute-next).
  - `panel/src/pages/LoopPage.jsx` — página `/loop` com loop operacional completo.
- **Arquivos alterados:**
  - `panel/src/api/index.js` — exports de `fetchLoopStatus` e `executeNext`.
  - `panel/src/App.jsx` — rota `/loop` → `<LoopPage />`.
  - `panel/src\Sidebar.jsx` — item "Loop" com badge "PR12" entre Contrato e Saúde.
- **Funcionalidades da LoopPage:**
  1. `GET /contracts/loop-status` — carrega ao montar + botão Atualizar.
  2. Exibe `loop.status_global`, `canProceed`, `blockReason`, `availableActions`.
  3. Exibe `operationalAction` (type, can_execute, block_reason, evidence_required).
  4. Exibe `nextAction` contratual em seção colapsável.
  5. Zona de execução: campo `approved_by` + botão desabilitado quando `can_execute: false`.
  6. Chama `POST /contracts/execute-next` com `{ confirm: true, approved_by, evidence: [] }`.
  7. Exibe resultado com badge de status (EXECUTADO/BLOQUEADO/AGUARDANDO APROVAÇÃO/ERRO).
  8. Seção colapsável de detalhes: `evidence`, `rollback`, `executor_path`, `execution_result`.
  9. Em modo mock: aviso honesto ("configure VITE_NV_ENAVIA_URL").
  10. Backend bloqueia → painel mostra motivo. Sem decisão no front.
- **Smoke tests:**
  - `npx vite build` → 141 modules transformed, 0 errors ✅.
  - Aviso de chunk pré-existente, não relacionado às mudanças.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR13 — Worker-only — hardening final.

---

## 2026-04-28 — PR11 — Worker-only — integração segura com executor

- **Branch:** `claude/pr11-integracao-segura-executor`
- **Contrato:** `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`
- **Escopo:** Worker-only. Diagnóstico do caminho executor + auditoria, sem timeout local inseguro. Sem alteração em Panel, Executor ou `contract-executor.js`.
- **Diagnóstico realizado:**
  - `env.EXECUTOR.fetch` é usado APENAS em `handleEngineerRequest` (rota `/engineer`, proxy direto). NÃO é usado no fluxo de contratos.
  - Caminho `handleExecuteNext → handleExecuteContract → executeCurrentMicroPr` é integralmente KV puro. Sem Service Binding.
  - `executeCurrentMicroPr` tem supervisor gate, task status check, TEST-only guard e active micro-PR check — gates suficientes.
- **Alterações em `nv-enavia.js`:**
  1. Helper puro `buildExecutorPathInfo(env, opType)` — retorna `{ type, handler, uses_service_binding, service_binding_available, note }`.
  2. `handleExecuteContract` (step 6) mantido sem `Promise.race`: o handler pode alterar KV, e timeout local não cancela a Promise original.
  3. `handleCloseFinalContract` (step 7) mantido sem `Promise.race`: mesmo motivo acima.
  4. Código documenta explicitamente que, sem `AbortSignal`/cancelamento real, timeout local seria inseguro.
  5. Timeout seguro fica para PR futura somente com handler cancelável/idempotente.
  6. Campo `executor_path` adicionado a todos os paths de resposta (aditivo backward-compat). Paths antes do step 4: `null`. Paths após: `executorPathInfo`.
- **Campos novos no response (backward-compat):**
  - `executor_path: { type, handler, uses_service_binding, service_binding_available, note }`
- **Smoke tests:**
  - `node --test tests/pr8-hardening-producao.smoke.test.js` → 41 passed, 0 failed.
  - `node --input-type=module <<'EOF' ... worker.fetch('/contracts/execute-next') ... EOF` → `executor_path` presente nos paths `blocked` e `awaiting_approval`; `EXECUTOR.fetch` não chamado.
  - `node --input-type=module <<'EOF' ... fs.readFileSync('./nv-enavia.js') ... EOF` → `handleExecuteNext` sem `Promise.race` e sem `env.EXECUTOR.fetch`.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR12 — Panel-only — botões operacionais no painel.

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

---

## 2026-04-29 — PR15: EXECUTOR-ONLY: contrato `/audit` com verdict explícito

- **Branch:** `copilot/fix-audit-response-contract`
- **Escopo:** EXECUTOR-ONLY. Nenhuma mudança em Worker `nv-enavia`, Painel, Deploy Worker ou KV.
- **Problema observado em smoke real TEST:**
  - `POST /contracts` → 201, `GET /contracts/loop-status` → contrato ativo, `POST /contracts/execute-next` → chama binding `EXECUTOR`.
  - `POST /audit` no Executor real (`enavia-executor-test`) respondia HTTP 200 com JSON válido, mas sem `verdict`.
  - `nv-enavia.js → callExecutorBridge` (linha 5179) bloqueava com: `Audit sem verdict explícito. Resposta ambígua bloqueada por segurança.`
- **Patch cirúrgico:**
  - `executor/src/index.js` — handler `POST /audit` (return final, ~linha 991): injeta `verdict` (`approve`/`reject`) e `risk_level` no objeto `result`, e adiciona campo top-level `audit: { verdict, risk_level }` espelhando os mesmos valores. Restante do envelope (`system`, `executor`, `route`, `received_action`, `evidence`, `pipeline`, `result.map`) preservado.
  - `executor/CONTRACT.md` — exemplo de Response 200 atualizado e nota PR15 explicando o mapeamento.
- **Mapeamento determinístico:**
  - `execResult.ok === false` → `verdict: "reject"`.
  - Caso contrário → `verdict: "approve"`.
  - `risk_level` deriva de `riskReport.risk_level | level | risk`, fallback `execResult.risk_level`, fallback final `"low"`.
- **Garantias:**
  - Zero alteração em comportamento dos demais handlers (`/propose`, `/engineer`, `/health`, `/boundary`, `/status`).
  - Compatível com ambos os ramos do contrato do Worker (`data.result.verdict` e `data.audit.verdict`).
  - Não altera lógica do core_v2 — apenas o envelope de resposta do `/audit`.
- **Smoke tests:**
  - `node --check executor/src/index.js` → OK ✅
  - `node executor/tests/executor.contract.test.js` → 23/23 ✅
  - Mocks em `tests/pr14-executor-deploy-real-loop.smoke.test.js` confirmam o formato esperado pelo Worker (`result: { verdict: "approve", risk_level: "low" }`).
- **Rollback:** `git revert <commit>` desta PR; arquivos afetados isolados em `executor/src/index.js`, `executor/CONTRACT.md` e governança.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** deploy do Executor em TEST e re-rodar smoke real `execute-next` para confirmar `executor_status: "passed"`.

### 2026-04-29 — follow-up PR15: regra conservadora do `verdict`

- **Origem:** comentário de revisão na PR (`comment_id: 4340101564`).
- **Risco apontado:** a primeira versão do patch aprovava qualquer caso que não fosse `ok === false`, o que ainda permitia `approve` em payload vazio, `error:true`, `status:"failed"` ou `ok` ausente.
- **Correção aplicada (Executor-only):**
  - Novo helper puro `executor/src/audit-response.js`.
  - `normalizeAuditVerdict(execResult)`:
    - retorna `"approve"` somente com `execResult.ok === true` **e** `execResult.error !== true`;
    - retorna `"reject"` em qualquer outro caso;
    - preserva `execResult.verdict` apenas quando já for `"approve"` (com sucesso explícito) ou `"reject"`;
    - descarta valores inválidos como `"passed"` e recalcula de forma conservadora.
  - `normalizeAuditRiskLevel(execResult, riskReport)`:
    - aceita apenas valores string não-vazios vindos de `riskReport` ou `execResult.risk_level`;
    - fallback final seguro `"low"`.
- **Arquivos alterados:**
  - `executor/src/audit-response.js`
  - `executor/src/index.js`
  - `executor/tests/executor.contract.test.js`
  - `executor/CONTRACT.md`
  - governança (`schema/status`, `schema/handoffs`, `schema/execution`)
- **Testes:**
  - `node executor/tests/executor.contract.test.js` → 33/33 ✅
  - `node --check executor/src/index.js` → OK ✅
  - `node --check executor/src/audit-response.js` → OK ✅
  - `node --check executor/tests/executor.contract.test.js` → OK ✅
- **Escopo preservado:** sem mudanças em `nv-enavia.js`, `panel/`, Deploy Worker, KV ou `wrangler.toml`.
- **Próxima etapa segura:** deploy do Executor em TEST e repetir o smoke real do loop para validar o mesmo comportamento no binding `EXECUTOR`.
