# ENAVIA — System Map

**Versão:** 1.0.0
**Data:** 2026-04-29
**PR:** PR22 — PR-DOCS
**Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`

> Este documento é a referência técnica de todos os componentes do sistema ENAVIA.
> Atualizar sempre que um componente, binding, rota ou estado for criado, alterado ou removido.
> Não inventar componentes — documentar apenas o que está confirmado no repo.

---

## 1. Objetivo do sistema

ENAVIA é um sistema de execução contratual supervisionada sobre Cloudflare Workers.

Seu propósito é executar **micro-PRs** (unidades atômicas de mudança de código) dentro de **contratos** compostos por **fases** e **tasks**, com gates de aderência, auditoria por IA e aprovação humana em cada passo.

O sistema garante que nenhuma mudança de produção seja aplicada sem:
1. Diagnóstico (`PR-DIAG`) ou proposta validada.
2. Aprovação supervisionada (`PR-IMPL` com gate).
3. Prova documentada (`PR-PROVA`).
4. Registro de governança (`schema/`).

---

## 2. Estado atual resumido

| Item | Estado |
|------|--------|
| Loop contratual supervisionado | **Consolidado** ✅ (PR17–PR21) |
| Frente System Map + Tool Registry | **Em andamento** 🔵 (PR22–PR25) |
| Frente Skills supervisionadas | Aguardando PR25 ⏳ |
| Contrato ativo | `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` |
| Próxima PR autorizada | PR23 — `ENAVIA_ROUTE_REGISTRY.json` |
| Último commit merge | `3d29b7d` (PR #182 — PR21) |
| Total de smoke tests | 451/451 ✅ (sem regressão) |

---

## 3. Componentes principais

O sistema ENAVIA é composto por 4 componentes de execução e 1 painel operacional:

| Componente | Tipo | Responsabilidade |
|------------|------|-----------------|
| `nv-enavia` | Cloudflare Worker (main) | Roteador HTTP, loop contratual supervisionado, integração com KV/Executor/Deploy |
| `enavia-executor` | Cloudflare Worker (service binding) | Auditoria de código, propostas de patch, validação de módulos, análise de risco |
| `deploy-worker` | Cloudflare Worker (service binding) | Recibo de audit, aplicação de patch em TEST, promoção a PROD, rollback |
| `contract-executor.js` | Módulo JS importado por `nv-enavia` | Engine contratual: resolveNextAction, advanceContractPhase, gates, state machine |
| `panel` (ENAVIA Panel) | Aplicação Vite/React | Interface operacional: loop, contratos, execuções, memória, planner, saúde |

### Componentes externos (dependências de integração)

| Componente | URL | Uso |
|------------|-----|-----|
| OpenAI API | `https://api.openai.com` | Geração de propostas, auditorias cognitivas |
| Supabase | `https://jsqvhmnjsbmtfyyukwsr.supabase.co` | Storage de artefatos (bucket `enavia-brain`) |
| Director Cognitive | `https://nv-director-cognitive.brunovasque.workers.dev/director/cognitive` | Raciocínio cognitivo / advisor |
| Browser Executor | `https://run.nv-imoveis.com/browser/run` | Execução de ações de browser arm |
| Vercel Executor | `https://nv-vercel-executor.brunovasque.workers.dev/vercel/patch` | Patches em projetos Vercel |

---

## 4. Arquivos centrais

| Arquivo | Tipo | Papel |
|---------|------|-------|
| `nv-enavia.js` | Worker entry point | Roteador principal; handlers HTTP; importa `contract-executor.js` e todos os módulos de schema |
| `contract-executor.js` | Módulo de engine | State machine contratual: `resolveNextAction`, `advanceContractPhase`, `handleCompleteTask`, `startTask`, `checkPhaseGate`, `handleCreateContract`, etc. |
| `wrangler.toml` | Config de deploy | Bindings KV, services, vars de ambiente (PROD e TEST) |
| `.github/workflows/deploy.yml` | CI/CD | Deploy automático do worker `nv-enavia` em PROD (push main) e TEST (workflow_dispatch) |
| `.github/workflows/deploy-executor.yml` | CI/CD | Deploy do `enavia-executor` com resolução de KV namespaces por title |
| `executor/src/index.js` | Source do executor | Código fonte do `enavia-executor` (versionado aqui; deploy via workflow) |
| `executor/wrangler.toml` | Config executor | Referência de bindings do executor (template com placeholders) |
| `panel/` | Frontend | Aplicação Vite/React com páginas: Loop, Contratos, Execuções, Memória, Planner, Saúde, Chat, Browser |

### Módulos de schema (`schema/*.js`)

| Módulo | Papel |
|--------|-------|
| `planner-classifier.js` | Classifica requisições para roteamento do planner |
| `planner-canonical-plan.js` | Constrói planos canônicos |
| `planner-output-modes.js` | Monta envelopes de output |
| `planner-approval-gate.js` | Gate de aprovação humana do planner |
| `planner-executor-bridge.js` | Payload de bridge planner → executor |
| `memory-consolidation.js` | Consolida aprendizados de memória |
| `memory-storage.js` | CRUD de memória no KV |
| `memory-schema.js` | Schema, tipos e status de memória |
| `memory-read.js` | Busca de memória relevante |
| `memory-retrieval.js` | Contexto e resumo de retrieval |
| `enavia-cognitive-runtime.js` | Prompts cognitivos e system prompt de chat |
| `operational-awareness.js` | Awareness operacional para contexto do LLM |
| `learning-candidates.js` | Registro e aprovação de candidatos a aprendizado |
| `memory-audit-log.js` | Log de auditoria de memória |

---

## 5. Contratos e governança

### Estrutura de governança (`schema/`)

| Arquivo | Papel |
|---------|-------|
| `schema/contracts/INDEX.md` | Índice central de contratos (ativo + histórico) |
| `schema/contracts/active/*.md` | Contratos ativos e históricos |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Estado operacional atual do sistema |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Handoff da última PR para a próxima sessão |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Log cronológico de execuções de PRs |
| `schema/system/` | Mapas e registries do sistema (esta frente: PR22–PR25) |
| `schema/playbooks/` | Playbooks operacionais (PR24) |

### Histórico de contratos

| Contrato | PRs | Estado |
|----------|-----|--------|
| `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` | PR1–PR7 | Encerrado ✅ |
| `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` | PR8–PR16 | Encerrado ✅ |
| `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` | PR0, PR17–PR30 | **Ativo** 🟢 |

### Taxonomia de PRs

| Tipo | Descrição |
|------|-----------|
| `PR-DIAG` | Diagnóstico read-only — sem alteração de runtime |
| `PR-IMPL` | Implementação supervisionada — altera runtime |
| `PR-PROVA` | Prova/testes — valida implementação |
| `PR-DOCS` | Documentação — sem alteração de runtime |

---

## 6. Loop contratual supervisionado

O loop contratual é o ciclo de execução que garante progresso seguro em cada contrato.

### Fluxo completo (PR17–PR21, consolidado)

```
GET /contracts/loop-status
         │
         ▼
  resolveNextAction(state, decomposition)
         │
    ┌────┴────┐
    │ Rules   │
    └────┬────┘
         │
    start_task ──────────────────────────▶ POST /contracts/execute-next
         │                                          │
         │                              startTask(queued→in_progress)
         │                                          │
         │                               callExecutorBridge /audit
         │                               callExecutorBridge /propose
         │                               callDeployBridge /audit
         │                               callDeployBridge /apply-test
         │
    in_progress ─────────────────────────▶ POST /contracts/complete-task
         │                                          │
         │                                evaluateAdherence (gate)
         │                               (MicrostepResultado com flags)
         │
    phase_complete ───────────────────────▶ POST /contracts/advance-phase
         │                                          │
         │                                checkPhaseGate (todas tasks done)
         │                                advanceContractPhase (KV write)
         │
    contract_complete ────────────────────▶ POST /contracts/close-final
         │
    plan_rejected / cancelled ───────────▶ ações bloqueadas (vazio)
```

### Funções centrais do engine (`contract-executor.js`)

| Função | Linha aprox. | Papel |
|--------|--------------|-------|
| `resolveNextAction(state, decomp)` | ~1440 | Determina próxima ação do loop (Rules 1–9) |
| `advanceContractPhase(env, contractId)` | ~1027 | Avança fase: checkPhaseGate + KV write |
| `checkPhaseGate(state, decomp)` | ~975 | Verifica se todas as tasks da fase estão done |
| `startTask(env, contractId, taskId)` | — | Transiciona task de `queued` para `in_progress` |
| `handleCompleteTask(request, env)` | — | Fecha task com gate de aderência |
| `handleCreateContract` | — | Cria contrato no KV |
| `handleGetContract` | — | Lê estado do contrato |
| `handleGetContractSummary` | — | Resumo do contrato |
| `handleGetActiveSurface` | — | Superfície ativa (active-surface) |
| `isPlanRejected(state)` | ~516 | `state.plan_rejection.plan_rejected === true` |
| `isCancelledContract(state)` | ~500 | `state.status_global === "cancelled"` |

### Rules de `resolveNextAction`

| Rule | Condição | Resultado |
|------|----------|-----------|
| Rule 1 | Todas as fases done | `contract_complete` |
| Rule 2 | `isPlanRejected` | `plan_rejected` |
| Rule 3 | `isCancelledContract` | `cancelled` |
| Rule 4 | Fase ativa com todas tasks done, há próxima fase | `phase_complete` |
| Rule 5 | Task `queued` disponível com deps satisfeitas | `start_task` |
| Rule 6 | Micro-PR candidata `queued` | `start_micro_pr` |
| Rule 7 | `awaiting_human_approval` | `awaiting_human_approval` |
| Rule 8 | Contrato awaiting sign-off final | `awaiting_signoff` |
| Rule 9 | Task `in_progress` | `no_action` + `status: "in_progress"` |

---

## 7. Estados operacionais

### Estados de `status_global` do contrato

| Estado | Descrição |
|--------|-----------|
| `executing` | Execução normal em andamento |
| `validating` | Em fase de validação |
| `blocked` | Bloqueado (aguarda ação humana) |
| `awaiting-human` | Aguardando aprovação humana |
| `test-complete` | Testes concluídos |
| `completed` | Contrato finalizado com sucesso |
| `cancelled` | Contrato cancelado |
| `failed` | Falha crítica |

### Transições válidas de `status_global` (`VALID_GLOBAL_TRANSITIONS`)

| De | Para |
|----|------|
| `executing` | `executing`, `validating`, `blocked`, `awaiting-human`, `test-complete`, `completed`, `cancelled`, `failed` |

### Estados de task

| Estado | Descrição |
|--------|-----------|
| `queued` | Aguardando execução |
| `in_progress` | Em execução |
| `done` | Concluída com sucesso |
| `merged` | PR mergeada (equivale a done) |
| `completed` | Concluída supervisionadamente |
| `skipped` | Pulada intencionalmente |

### Estados de fase (`phase.status`)

| Estado | Descrição |
|--------|-----------|
| `active` | Fase em execução |
| `queued` | Fase aguardando ativação |
| `done` | Fase concluída |

### Ações operacionais expostas pelo `loop-status`

| `nextAction.type` | `availableActions` | `operationalAction.type` |
|-------------------|--------------------|--------------------------|
| `start_task` / `start_micro_pr` | `POST /contracts/execute-next` | `execute_next` |
| `in_progress` (Rule 9) | `POST /contracts/complete-task` | `block` (can_execute:false) |
| `phase_complete` | `POST /contracts/advance-phase` | `advance_phase` |
| `awaiting_human_approval` | (sign-off actions) | `approve` |
| `contract_complete` | `POST /contracts/close-final` | `close_final` |
| `plan_rejected` / `cancelled` | `[]` | `block` |

---

## 8. Workers, bindings, KV namespaces e secrets

### Worker principal: `nv-enavia`

| Item | Valor |
|------|-------|
| Nome | `nv-enavia` |
| Entry point | `nv-enavia.js` |
| Compatibility date | `2026-04-10` |
| URL PROD | `https://nv-enavia.brunovasque.workers.dev` (workers_dev) |
| URL TEST | `https://enavia-worker-teste.brunovasque.workers.dev` |

### Bindings — `nv-enavia` PROD

| Binding | Tipo | Valor |
|---------|------|-------|
| `ENAVIA_BRAIN` | KV Namespace | ID: `722835b730dd44c79f6ff1f0cdc314a9` |
| `EXECUTOR` | Service Binding | `enavia-executor` |
| `DEPLOY_WORKER` | Service Binding | `deploy-worker` |

### Bindings — `nv-enavia` TEST (`env.test`)

| Binding | Tipo | Valor |
|---------|------|-------|
| `ENAVIA_BRAIN` | KV Namespace | ID: `235fd25ad3b44217975f6ce0d77615d0` (preview_id) |
| `EXECUTOR` | Service Binding | `enavia-executor-test` |
| `DEPLOY_WORKER` | Service Binding | `deploy-worker-test` |

### Variáveis de ambiente (`[vars]`)

| Variável | Valor PROD | Observação |
|----------|-----------|------------|
| `ENAVIA_MODE` | `supervised` | Modo de execução |
| `ENAVIA_VERSION` | `v2` | Versão do sistema |
| `OWNER` | `Vasques` | Proprietário |
| `SYSTEM_NAME` | `ENAVIA` | Nome do sistema |
| `OPENAI_MODEL` | `gpt-5.2` | Modelo OpenAI |
| `SUPABASE_URL` | `https://jsqvhmnjsbmtfyyukwsr.supabase.co` | URL do Supabase |
| `SUPABASE_BUCKET` | `enavia-brain` | Bucket de artefatos |
| `BROWSER_EXECUTOR_URL` | `https://run.nv-imoveis.com/browser/run` | URL do browser executor |
| `ENAVIA_EXECUTOR_URL` | `https://enavia-executor.brunovasque.workers.dev` | URL do executor (fallback HTTP) |
| `DIRECTOR_COGNITIVE_URL` | `https://nv-director-cognitive.brunovasque.workers.dev/director/cognitive` | URL do director cognitivo |
| `VERCEL_EXECUTOR_URL` | `https://nv-vercel-executor.brunovasque.workers.dev/vercel/patch` | URL do Vercel executor |

### Secrets obrigatórios (GitHub Actions / Cloudflare)

| Secret | Usado por | Obrigatório |
|--------|-----------|-------------|
| `CLOUDFLARE_API_TOKEN` | `deploy.yml`, `deploy-executor.yml` | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy.yml`, `deploy-executor.yml` | ✅ |
| `INTERNAL_TOKEN` | `deploy.yml` (smoke TEST de `/__internal__/build`) | ✅ (TEST) |
| `OPENAI_API_KEY` | Worker runtime | ✅ (não em wrangler.toml — injetado via CF secrets) |

### Worker: `enavia-executor`

| Item | Valor |
|------|-------|
| Nome | `enavia-executor` |
| Entry point | `executor/src/index.js` (no repo) |
| Deploy | `.github/workflows/deploy-executor.yml` |
| Bindings KV | `ENAVIA_BRAIN`, `ENAVIA_GIT`, `GIT_KV` |

#### KV namespaces do executor (resolvidos por title no CI)

| Binding | Title esperado |
|---------|----------------|
| `ENAVIA_BRAIN` | `ENAVIA_BRAIN` (PROD) / `ENAVIA_BRAIN_TEST` (TEST) |
| `ENAVIA_GIT` | `ENAVIA_GIT` (PROD) / `ENAVIA_GIT_TEST` (TEST) |
| `GIT_KV` | `GIT_KV` (PROD) / `GIT_KV_TEST` (TEST) |

### KV keys canônicas (`ENAVIA_BRAIN`)

| Key | Conteúdo |
|-----|----------|
| `contract:index` | Array JSON de contract IDs ativos |
| `contract:{id}:state` | Estado completo do contrato (shape abaixo) |
| `contract:{id}:decomposition` | Decomposição: fases, tasks, micro_pr_candidates |

#### Shape mínimo de `contract:{id}:state`

```json
{
  "contract_id": "string",
  "contract_name": "string",
  "status_global": "executing | validating | blocked | awaiting-human | completed | cancelled | failed",
  "current_phase": "string",
  "current_task": "string | null",
  "phases": [],
  "blockers": [],
  "plan_rejection": null,
  "scope": { "workers": ["nv-enavia"] },
  "definition_of_done": ["string"],
  "updated_at": "ISO8601"
}
```

#### Shape mínimo de `contract:{id}:decomposition`

```json
{
  "phases": [{ "id": "phase_01", "status": "active", "tasks": ["task_001"] }],
  "tasks": [{ "id": "task_001", "phase_id": "phase_01", "status": "queued", "depends_on": [], "description": "string" }],
  "micro_pr_candidates": []
}
```

---

## 9. Endpoints conhecidos

### Worker `nv-enavia` — Rotas de contratos

| Método | Rota | Handler | Escopo |
|--------|------|---------|--------|
| `POST` | `/contracts` | `handleCreateContract` | Cria contrato no KV |
| `GET` | `/contracts` | `handleGetContract` | Lê estado do contrato |
| `GET` | `/contracts/summary` | `handleGetContractSummary` | Resumo do contrato |
| `GET` | `/contracts/active-surface` | `handleGetActiveSurface` | Superfície ativa |
| `GET` | `/contracts/loop-status` | `handleGetLoopStatus` | Estado do loop supervisionado |
| `POST` | `/contracts/execute-next` | `handleExecuteNext` | Executa próxima ação (com gates) |
| `POST` | `/contracts/execute` | `handleExecuteContract` | Executa contrato direto |
| `POST` | `/contracts/close-test` | `handleCloseContractInTest` | Fecha contrato em TEST |
| `POST` | `/contracts/cancel` | `handleCancelContract` | Cancela contrato |
| `POST` | `/contracts/reject-plan` | `handleRejectDecompositionPlan` | Rejeita plano de decomposição |
| `POST` | `/contracts/resolve-plan-revision` | `handleResolvePlanRevision` | Resolve revisão de plano |
| `POST` | `/contracts/complete-task` | `handleCompleteTask` | Conclui task com gate de aderência |
| `POST` | `/contracts/advance-phase` | `handleAdvancePhase` | Avança fase (PR18) |
| `POST` | `/contracts/close-final` | `handleCloseFinalContract` | Fecha contrato final |

### Worker `nv-enavia` — Outras rotas

| Método | Rota | Escopo |
|--------|------|--------|
| `GET` | `/audit` | Health/audit público |
| `POST` | `/audit` | Audit de execução |
| `POST` | `/propose` | Proposta supervisionada |
| `GET` | `/__internal__/build` | Info de build (autenticado via `INTERNAL_TOKEN`) |
| `POST` | `/enavia/observe` | Observação de evento |
| `POST` | `/vercel/patch` | Patch Vercel |
| `POST` | `/director/cognitive` | Director cognitivo proxy |
| `POST` | `/brain-query` | Consulta ao brain |
| `GET` | `/brain/read` | Leitura de módulo do brain |
| `GET` | `/brain/index` | Índice do brain |
| `POST` | `/brain/get-module` | Módulo específico do brain |
| `POST` | `/brain/director-query` | Consulta director |
| `POST` | `/engineer` | Engineer proxy |
| `GET` | `/engineer` | Estado do engineer |
| `GET` | `/debug-brain` | Debug do brain |
| `POST` | `/github-pr/action` | Ação de GitHub PR arm |
| `POST` | `/github-pr/request-merge` | Solicita merge |
| `POST` | `/github-pr/approve-merge` | Aprova merge |
| `POST` | `/browser-arm/action` | Ação de browser arm |
| `GET` | `/browser-arm/state` | Estado do browser arm |
| `GET` | `/memory/manual` | Lista memórias manuais |
| `POST` | `/memory/manual` | Cria memória manual |
| `PATCH` | `/memory/manual` | Atualiza memória manual |
| `POST` | `/memory/manual/block` | Bloqueia memória |
| `POST` | `/memory/manual/invalidate` | Invalida memória |
| `GET` | `/memory/learning` | Lista candidatos a aprendizado |
| `POST` | `/memory/learning` | Registra candidato |
| `POST` | `/memory/learning/approve` | Aprova candidato |
| `POST` | `/memory/learning/reject` | Rejeita candidato |
| `GET` | `/memory/audit` | Auditoria de memória |
| `GET` | `/memory` | Memória geral |
| `GET` | `/` | Root / health |
| `POST` | `/` | Chat root |
| `POST` | `/reload` | Reload |
| `POST` | `/debug-load` | Debug load |

### Executor (`enavia-executor`) — Rotas usadas por `nv-enavia`

| Rota | Uso |
|------|-----|
| `POST /audit` | Auditoria de código / patch (chamado por `callExecutorBridge`) |
| `POST /propose` | Proposta de patch supervisionada (chamado por `callExecutorBridge`) |

### Deploy Worker — Rotas usadas por `nv-enavia`

| Rota | Uso |
|------|-----|
| `POST /audit` | Recibo de audit aprovado (chamado por `callDeployBridge`) |
| `POST /apply-test` | Aplicação de patch em TEST (`target_env:"test"`) |

---

## 10. Testes e provas

### Smoke tests existentes (testes formais de PR)

| Arquivo | PRs cobertas | Asserts | Estado |
|---------|-------------|---------|--------|
| `tests/pr8-hardening-producao.smoke.test.js` | PR8 | — | ✅ |
| `tests/pr13-hardening-operacional.smoke.test.js` | PR13 | 91 | ✅ |
| `tests/pr14-executor-deploy-real-loop.smoke.test.js` | PR14 | 183 | ✅ |
| `tests/pr18-advance-phase-endpoint.smoke.test.js` | PR18 | 45 | ✅ |
| `tests/pr19-advance-phase-e2e.smoke.test.js` | PR19 | 52 | ✅ |
| `tests/pr20-loop-status-in-progress.smoke.test.js` | PR20 | 27 | ✅ |
| `tests/pr21-loop-status-states.smoke.test.js` | PR21 | 53 | ✅ |

**Total consolidado: 451/451 ✅**

### Outros testes

| Categoria | Arquivos |
|-----------|---------|
| Contratos | `contracts-smoke.test.js`, `contract-active-state.smoke.test.js`, `contract-adherence-*.smoke.test.js`, `contract-cognitive-*.smoke.test.js`, `contract-final-audit.smoke.test.js`, `contract-ingestion.smoke.test.js` |
| Memória | `memory-*.smoke.test.js`, `p15/p16/p17-memory-*.smoke.test.js` |
| Planner | `planner-*.smoke.test.js`, `planner-*.http.test.js` |
| Executor bridge | `planner-executor-bridge.smoke.test.js` |
| GitHub PR arm | `github-pr-arm-*.smoke.test.js`, `github-pr-arm-runtime.integration.test.js` |
| Browser arm | `browser-arm-*.smoke.test.js`, `browser-arm-runtime.integration.test.js` |
| Segurança | `security-supervisor*.smoke.test.js` |
| Execução | `execution-audit.smoke.test.js`, `exec-event.smoke.test.js`, `execution-trail.smoke.test.js` |
| Cognitivo | `cognitive-runtime.smoke.test.js`, `contract-cognitive-orchestrator.smoke.test.js` |

---

## 11. O que está consolidado

| Área | Estado |
|------|--------|
| Worker `nv-enavia` com roteamento completo | ✅ |
| Engine contratual `contract-executor.js` | ✅ |
| Loop contratual supervisionado (`execute-next → complete-task → advance-phase`) | ✅ (PR17–PR21) |
| Gate de aderência (`evaluateAdherence` em `complete-task`) | ✅ |
| Gate de fase (`checkPhaseGate` em `advance-phase`) | ✅ |
| `loop-status` expõe ação correta para cada estado | ✅ (PR18 + PR20) |
| Matriz de estados formalmente provada | ✅ (PR21, 53 asserts) |
| `buildOperationalAction` com mapeamento correto | ✅ |
| Executor bridge (audit + propose) com gates | ✅ (PR14) |
| Deploy bridge (audit receipt + apply-test) com gates | ✅ (PR14) |
| Painel operacional com página de Loop | ✅ (PR12) |
| CORS em todos os endpoints do loop | ✅ (via `withCORS` / `jsonResponse`) |
| Governança: CLAUDE.md, contratos, INDEX, status, handoff, execution log | ✅ |
| Deploy automático PROD (push main) | ✅ |
| Deploy TEST (workflow_dispatch) | ✅ |
| Deploy executor via workflow com resolução de KV por title | ✅ |

---

## 12. O que ainda falta

| Área | PR prevista | Prioridade |
|------|------------|------------|
| `ENAVIA_ROUTE_REGISTRY.json` — registry JSON de todas as rotas | PR23 | Alta |
| `ENAVIA_OPERATIONAL_PLAYBOOK.md` — playbook de operação do loop | PR24 | Alta |
| Registry de workers, bindings, KV e secrets esperados | PR25 | Alta |
| Skill: Contract Loop Operator | PR26 | Média (após PR25) |
| Skill: Deploy Governance Operator | PR27 | Média (após PR25) |
| Skill: System Mapper | PR28 | Média (após PR25) |
| Skill: Contract Auditor | PR29 | Média (após PR25) |
| Fechamento, hardening e handoff final do contrato | PR30 | — |

### Observações documentadas (comportamento existente, não corrigido)

1. **`status_global: "blocked"` sozinho não esconde ações operacionais** — `resolveNextAction` só bloqueia via `plan_rejection.plan_rejected === true` ou `status_global === "cancelled"`. Comportamento preservado (PR21).

2. **Isolamento TEST/PROD incompleto** — `DIRECTOR_COGNITIVE_URL` é o mesmo em TEST e PROD. Isolamento total requer endpoint dedicado `nv-director-cognitive-test`. Anotado em `wrangler.toml`.

3. **Timeout seguro não implementado** — `handleExecuteContract` e `handleCloseFinalContract` não têm timeout com cancelamento real (não é seguro com `Promise.race` quando há mutação de KV). Aguarda handler cancelável/idempotente (futura PR-IMPL).

4. **`consolidateAfterSave()` é dead code** — função definida em `contract-executor.js` mas nunca chamada. Candidata a remoção em futura PR de housekeeping.

---

## 13. Itens opcionais / fora do escopo atual

| Item | Motivo de postergação |
|------|-----------------------|
| Endpoint de skills autônomas | Skills apenas após PR25 (System/Tool Registry completo) |
| Integração de `contract-active-state.js` | Risco de estado duplicado sem refatoração prévia |
| Integração de `contract-ingestion.js` | Upstream sem endpoint consumidor definido |
| Integração de `enavia-capabilities.js`, `enavia-constitution.js`, `enavia-identity.js` | Conteúdo estático sem fluxo consumidor |
| `planner-memory-audit.js` | Diagnóstico PM1–PM9 sem endpoint consumidor |
| Timeout real com cancelamento | Requer handler idempotente não disponível |
| Promoção automática de PROD via Deploy Worker | Produção bloqueada por design (gates manuais) |
| Integração `consolidateAfterSave` | Dead code; responsabilidade fora do ciclo contratual |

---

## 14. Regras de manutenção deste documento

1. **Atualizar após cada PR que altera componentes, rotas, bindings ou estados.**
2. **Nunca documentar o que não está confirmado no repo** — não inventar componentes ou rotas.
3. **Seções 8 (bindings) e 9 (rotas) devem estar em sincronia com `wrangler.toml` e `nv-enavia.js`.**
4. **Seção 10 (testes) deve refletir os smoke tests mais recentes com contagem de asserts.**
5. **Seções 11–12 devem ser revisadas a cada PR para refletir o que mudou de status.**
6. **Após criação de `ENAVIA_ROUTE_REGISTRY.json` (PR23), a seção 9 deste arquivo deve referenciar o registry como fonte de verdade primária.**
7. **O System Map é complementado por:**
   - `schema/system/ENAVIA_ROUTE_REGISTRY.json` (PR23) — rotas em formato machine-readable
   - `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` (PR24) — como operar o sistema
   - Registry de workers/bindings (PR25) — inventário completo para deploy
