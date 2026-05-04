# PR90 — Diagnóstico READ-ONLY do PR Orchestrator

**Data:** 2026-05-03  
**Branch:** `codex/pr90-diagnostico-pr-orchestrator`  
**Tipo:** PR-DIAG (read-only)  
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93.md`

---

## 0) Confirmações obrigatórias (pré-edição)

1. Branch atual confirmada: `codex/pr90-diagnostico-pr-orchestrator`.
2. Contrato ativo confirmado: `CONTRATO_ENAVIA_PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93.md`.
3. Próxima PR autorizada confirmada: **PR90 — Diagnóstico READ-ONLY do PR Orchestrator**.
4. PR86–PR89 confirmadas como base histórica concluída (`ACTIVE_CONTRACT.md`, `INDEX.md`, `status/handoff/log`, relatórios PR86–PR89).
5. Diagnóstico executado em leitura antes dos artefatos desta PR.

---

## 1) Mapa atual (estado real)

Legenda: **código real** | **docs-only** | **parcial** | **ausente**

| Item | Estado | Evidência objetiva |
|---|---|---|
| GitHub bridge | **parcial** | Endpoints `/github-pr/*` vivos em `nv-enavia.js` + enforcement em `contract-executor.js` + `schema/github-pr-arm-contract.js`; sem adapter API GitHub real. |
| criação de branch | **parcial** | Ação `open_branch` existe no contrato/integração P24 (enforcement), mas sem execução real contra GitHub API. |
| abertura de PR | **parcial** | Ação `open_pr` existe no contrato/integração P24; sem chamada real de API GitHub. |
| atualização de PR | **parcial** | Ação `update_pr` existe no contrato/integração P24; sem chamada real de API GitHub. |
| `pr_body` / `pr_title` | **ausente** | Não há campo/runtime específico no fluxo atual Worker↔Executor para PR metadata de GitHub. |
| testes a rodar | **código real** | Testes/smokes já definidos e usados no loop (`tests/pr86..pr89`, `executor/tests/*`, workflows com smoke TEST/PROD). |
| `rollback_plan` | **parcial** | Existe `rollback` recomendado no fluxo (`buildRollbackRecommendation`) e `rollback_plan` no executor para propose; não há plano PR-ready canônico do PR91 ainda. |
| `acceptance_criteria` | **parcial** | Presente no núcleo contratual/handoff (`contract-executor.js`), mas não no pacote PR-ready do PR Orchestrator. |
| `ready_for_merge` | **docs-only** | Só no contrato PR90–PR93; sem marcação runtime persistida hoje. |
| `deploy_test_ready` | **docs-only** | Só no contrato PR90–PR93; sem marcação runtime persistida hoje. |
| `awaiting_human_approval` | **código real** | Next action canônica em `resolveNextAction` (`contract-executor.js`) e refletida em `loop-status`/`execute-next`. |
| `prod_blocked_until_human_approval` | **docs-only** | Só no contrato PR90–PR93; gate prod real existe por outras vias (workflow + bridge), mas sem esse campo literal. |
| `evidence` / `proof` | **código real** | `buildEvidenceReport`, proofs em `tests/pr86..pr89` e relatórios em `schema/reports/`. |
| `execution_id` / `contract_id` | **código real** | Preservados no Worker↔Executor↔Deploy bridge e runner do executor (PR88/PR89). |
| deploy TEST | **código real** | `callDeployBridge` (modo `simulate`/`apply-test`, `target_env:test`) + `deploy.yml` e `deploy-executor.yml` por `workflow_dispatch`. |
| deploy PROD | **parcial (manual gateado)** | Existe no workflow manual com gate explícito; automático por push removido; PROD bloqueado sem confirmação humana. |
| rollback | **parcial supervisionado** | Runbook explícito + recomendação no runtime + rota executor de rollback/delegação; sem rollback PROD autônomo. |

---

## 2) Fluxo real atual (sem invenção)

1. `GET /contracts/loop-status` resolve próxima ação via `resolveNextAction`.
2. `POST /contracts/execute-next` roda com gates de evidência/segurança.
3. Para `execute_next`: Worker chama `callExecutorBridge(/audit)`, `callExecutorBridge(/propose)`, depois `callDeployBridge(simulate/test)`.
4. Executor suporta `smart_deploy_plan` + `deploy_execute_plan` com `deploy_test` e `finalize` (prova PR89).
5. `execution_id` e `contract_id` são preservados ponta a ponta.
6. Rotas `/github-pr/action`, `/github-pr/request-merge`, `/github-pr/approve-merge` existem como enforcement/gate lógico (não execução API GitHub real).
7. Deploy via workflow é manual (`workflow_dispatch`) para TEST/PROD com gate humano explícito em PROD.

---

## 3) Ponto exato onde falta costura

**Falta um PR Planner canônico que gere pacote PR-ready supervisionado (branch/arquivos/patch/testes/rollback/aceite/pr_title/pr_body/risco) e conecte isso ao braço GitHub sem executar integração real nesta PR.**

---

## 4) Arquivos vivos (comando do fluxo real)

- `nv-enavia.js`
- `contract-executor.js`
- `executor/src/index.js`
- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-executor.yml`
- `wrangler.toml`
- `schema/github-pr-arm-contract.js`
- `schema/deploy/RUNBOOK_DEPLOY_LOOP.md`
- `tests/pr89-internal-loop-final-proof.smoke.test.js`
- `tests/pr88-worker-executor-stitch.smoke.test.js`
- `tests/pr87-deploy-test-finalize-runner.smoke.test.js`
- `tests/pr86-deploy-orchestrator-gap.prova.test.js`

---

## 5) Arquivos documentais (descrevem, não executam o loop)

- `schema/contracts/ACTIVE_CONTRACT.md`
- `schema/contracts/INDEX.md`
- `schema/contracts/active/CONTRATO_ENAVIA_PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93.md`
- `schema/reports/PR86_DEPLOY_ORCHESTRATOR_GAP.md`
- `schema/reports/PR87_DEPLOY_TEST_FINALIZE_RUNNER.md`
- `schema/reports/PR88_WORKER_EXECUTOR_STITCH.md`
- `schema/reports/PR89_INTERNAL_LOOP_FINAL_PROOF.md`
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`

---

## 6) O que NÃO deve ser refatorado

Preservar exatamente os blocos vivos abaixo:

- `callExecutorBridge` (`nv-enavia.js`)
- `callDeployBridge` (`nv-enavia.js`)
- `handleExecuteNext` (`nv-enavia.js`)
- `transitionStatusGlobal` (`contract-executor.js`)
- `resolveNextAction` (`contract-executor.js`)
- runner `deploy_execute_plan` (`executor/src/index.js`)
- steps `deploy_test` e `finalize` (`executor/src/index.js`)
- workflow protegido `.github/workflows/deploy.yml` (gate PROD + sem push automático)

---

## 7) Menor patch recomendado para PR91 (máximo 5 mudanças)

1. Criar helper puro de planejamento PR-ready (sem side effects) em módulo dedicado de schema.
2. Definir schema canônico do pacote PR-ready com campos obrigatórios: `branch_name`, `files_to_change`, `patch_plan`, `tests_to_run`, `rollback_plan`, `acceptance_criteria`, `pr_title`, `pr_body`, `risk_level`, `ready_for_human_review`.
3. Criar validação pura do pacote (erros estruturados + deny-by-default de campos faltantes).
4. Criar teste unitário/prova PR91 para casos: mínimo válido, inválidos, bloqueios e estabilidade de shape.
5. Integrar apenas como saída aditiva de planejamento interno (sem endpoint novo obrigatório, sem executor, sem GitHub real).

---

## 8) Risco

**Risco: médio.**

O runtime vivo de execução/deploy já está estável e provado (PR86–PR89), mas há risco de deriva se PR91 misturar planejamento com execução GitHub/deploy. O risco cai para baixo mantendo PR91 como helper/schema puro, sem tocar bridges e sem alterar runtime executor/deploy.

---

## 9) Testes recomendados PR91–PR93

### Novos testes

- `tests/pr91-pr-planner-schema.prova.test.js` (shape obrigatório + validação de campos + bloqueios)
- `tests/pr91-pr-planner-readonly.smoke.test.js` (sem side effects, sem rede, sem GitHub API)
- `tests/pr92-pr-executor-supervisionado-mock.prova.test.js` (adapter mockado, sem merge)
- `tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js` (marcadores + gates humanos)

### Regressões obrigatórias (manter)

- `tests/pr89-internal-loop-final-proof.smoke.test.js`
- `tests/pr88-worker-executor-stitch.smoke.test.js`
- `tests/pr87-deploy-test-finalize-runner.smoke.test.js`
- `tests/pr86-deploy-orchestrator-gap.prova.test.js`
- `tests/pr85-autoevolucao-operacional.fechamento.test.js`
- `executor/tests/executor.contract.test.js`
- `executor/tests/cloudflare-credentials.test.js`

---

## 10) Conclusão (decisão para PR91)

**PR91 deve ser: E) combinação mínima.**

Combinação mínima recomendada para PR91, sem abrir escopo indevido:
- **A (schema/modelo PR-ready)** + **B (helper puro + teste)**,
- **sem** endpoint novo,
- **sem** execução GitHub real,
- **sem** tocar Executor/Worker/deploy runtime.

---

## Declaração final de diagnóstico

- Este relatório declara objetivamente o que **existe** em código real.
- Este relatório declara objetivamente o que **falta** para PR Orchestrator supervisionado PR90–PR93.
- Este relatório fixa o menor patch recomendado para PR91 sem violar escopo.
- Este relatório explicita os blocos vivos que **não devem ser refatorados**.
- Painel **não é necessário para PR90** (diagnóstico read-only).
- Escopo permanece **somente `nv-enavia`**; outros repositórios ficam fora.
