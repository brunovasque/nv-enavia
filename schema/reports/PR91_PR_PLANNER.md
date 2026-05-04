# PR91 — PR Planner

**Data:** 2026-05-04  
**Branch:** `codex/pr91-pr-planner`  
**Tipo:** PR-IMPL (schema/modelo + helper puro + testes + docs/governanca minima)  
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93.md`

---

## Confirmacoes pre-implementacao

1. Branch confirmada: `codex/pr91-pr-planner`.
2. PR90 confirmada como mergeada no `main` (`main` e `origin/main` em commit com merge da PR90).
3. Contrato ativo confirmado: `CONTRATO_ENAVIA_PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93.md`.
4. Proxima PR autorizada confirmada antes da implementacao: PR91 — PR Planner.
5. Arquivos de referencia localizados antes do patch:
   - `schema/reports/PR90_PR_ORCHESTRATOR_DIAGNOSTICO.md`
   - `schema/github-pr-arm-contract.js`
   - `nv-enavia.js`
   - `contract-executor.js`
   - `executor/src/index.js`
   - `tests/pr90-pr-orchestrator-diagnostico.prova.test.js`

---

## O que foi implementado

1. Helper puro criado: `schema/enavia-pr-planner.js`.
2. Funcoes puras entregues:
   - `buildPrReadyPackage(input)`
   - `validatePrReadyPackage(pkg)`
   - `normalizePrBranchName(input)`
   - `classifyPrRisk(input)`
   - `buildPrBody(pkg)`
3. Modelo PR-ready com campos obrigatorios:
   - `ok`, `mode`, `branch_name`, `files_to_change`, `patch_plan`, `tests_to_run`, `rollback_plan`,
     `acceptance_criteria`, `pr_title`, `pr_body`, `risk_level`, `ready_for_human_review`,
     `awaiting_human_approval`, `merge_allowed`, `prod_deploy_allowed`, `github_execution`,
     `side_effects`, `evidence`.
4. Guardrails implementados (deny-by-default):
   - bloqueio de merge automatico;
   - bloqueio de deploy PROD automatico;
   - bloqueio de pedidos com secrets/credenciais;
   - bloqueio de outro repositorio;
   - bloqueio de Enova;
   - bloqueio de browser action;
   - bloqueio de alteracao direta de `main`.
5. Teste de prova criado: `tests/pr91-pr-planner-schema.prova.test.js` com 52 cenarios minimos cobrindo API, shape, bloqueios, isolamento e regressao obrigatoria.

---

## O que nao foi mexido

- `nv-enavia.js`
- `executor/src/index.js`
- `contract-executor.js`
- `.github/workflows/deploy.yml`
- `wrangler.toml`
- painel/chat
- integracao GitHub real
- qualquer execucao de merge/deploy real

Sem endpoint novo. Sem executor novo. Sem deploy. Sem secrets. Sem side effects de runtime.

---

## O que fica para PR92

PR92 — PR Executor supervisionado:

1. Consumir pacote PR-ready validado.
2. Aplicar pacote em fluxo supervisionado sem merge automatico.
3. Manter `github_execution=false` enquanto nao houver bridge GitHub real aprovada.
4. Preservar guardrails de aprovacao humana para merge e PROD.

---

## Diagnostico usado

Baseado no relatorio da PR90:
`schema/reports/PR90_PR_ORCHESTRATOR_DIAGNOSTICO.md`

Decisao seguida: combinacao minima A+B para PR91 (schema/modelo + helper puro + teste), sem alterar runtime vivo.
