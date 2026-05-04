# PR103 — GitHub Bridge Helper Supervisionado

**Data:** 2026-05-04
**Tipo:** PR-IMPL
**Contrato ativo:** `CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md`
**PR anterior validada:** PR102 — Diagnóstico READ-ONLY do GitHub Bridge Real ✅
**Próxima PR autorizada:** PR104 — Runtime mínimo supervisionado

---

## O que foi implementado

### `schema/enavia-github-bridge.js`

Helper puro supervisionado do GitHub Bridge. Funções entregues:

| Função | Descrição |
|--------|-----------|
| `planCreateBranch(input, context)` | Planeja criação de branch supervisionada (sem execução real) |
| `planOpenPullRequest(input, context)` | Planeja abertura de PR supervisionada (sem execução real) |
| `planUpdatePullRequest(input, context)` | Planeja atualização de PR supervisionada (sem execução real) |
| `planCommentPullRequest(input, context)` | Planeja comentário em PR supervisionado (sem execução real) |
| `validateGithubOperation(operation, context)` | Valida operação GitHub com Safety Guard + regras de contrato |
| `buildGithubOperationEvent(operation, validation, context)` | Gera evento Enavia para operação GitHub |
| `buildGithubBridgePlan(input, context)` | Agrega múltiplas operações em plano supervisionado |

### Tipos de operação suportados

**Permitidos (planejáveis, não executados):**
- `create_branch`
- `open_pr`
- `update_pr`
- `comment_pr`
- `attach_evidence`
- `request_review`

**Sempre bloqueados:**
- `merge` — bloqueado pelo Safety Guard e regra de contrato
- `deploy_prod` — bloqueado pelo Safety Guard e regra de contrato
- `secret_change` — bloqueado pelo Safety Guard e regra de contrato

### Campos mínimos garantidos por operação

- `ok`, `mode: "github_bridge"`, `operation_type`
- `repo`, `base_branch`, `head_branch`, `pr_number`
- `title`, `body`, `comment`, `files`, `commit_message`
- `safety` (resultado do Safety Guard), `event` (evento Enavia), `evidence`
- `requires_human_review`, `blocked`, `reasons`
- `github_execution: false`, `side_effects: false`, `awaiting_human_approval`
- `next_recommended_action`

### Campos mínimos garantidos pelo plano

- `ok`, `mode: "github_bridge_plan"`
- `operations`, `blocked_operations`
- `safety_summary`, `event_summary`, `health_summary`
- `requires_human_review`, `github_execution: false`, `side_effects: false`
- `ready_for_runtime_integration`, `ready_for_real_execution: false`
- `contract_id`, `operation_count`, `source_pr`
- `next_recommended_action`

### Proteções obrigatórias ativas

1. **Safety Guard (PR100):** toda operação passa por `evaluateSafetyGuard` com `action.type = 'external_integration'` e `blast_radius = 'external'`.
2. **Event Log (PR99):** toda operação gera evento via `createEnaviaEvent` com `subsystem: 'github_bridge'`.
3. **Health Snapshot:** se `context.health_snapshot.overall_status === 'failed'`, operações mutáveis são bloqueadas.
4. **Event Log Snapshot:** se `context.event_log_snapshot.blocked_count > 0` ou `requires_human_review_count > 0`, operações exigem revisão humana.
5. **Repo externo:** se `context.allowed_repos` não inclui o repo, exige revisão humana.
6. **Ausência de campos obrigatórios:** operações que exigem `repo`, `base_branch` ou `head_branch` retornam erro controlado.

### Teste criado

**`tests/pr103-github-bridge-helper-supervisionado.prova.test.js`**

- 76 cenários distribuídos em 14 seções (A–N)
- Cobre todos os cenários obrigatórios do contrato (cenários 1–76)

---

## O que não foi mexido (intocado — proibido pelo contrato)

Os seguintes arquivos e diretórios permaneceram **intocados** nesta PR103:

- `nv-enavia.js` — runtime principal não alterado
- `executor/src/index.js` — executor Cloudflare não alterado
- `contract-executor.js` — executor de contrato não alterado
- `.github/workflows/deploy.yml` — workflow de deploy não alterado
- `wrangler.toml` — configuração Cloudflare não alterada
- `panel/**` — painel frontend não alterado
- `schema/github-pr-arm-contract.js` — contrato P24 não alterado
- `schema/enavia-pr-planner.js` — PR Planner não alterado
- `schema/enavia-pr-executor-supervised.js` — PR Executor não alterado
- `schema/enavia-pr-readiness.js` — PR Readiness não alterado
- `schema/enavia-safety-guard.js` — Safety Guard não alterado
- `schema/enavia-anti-loop.js` — Anti-loop não alterado
- `schema/enavia-event-log.js` — Event Log não alterado
- `schema/enavia-health-snapshot.js` — Health Snapshot não alterado

**Nenhuma chamada GitHub API real, nenhum token, nenhum fetch, nenhum octokit, nenhum gh CLI, nenhum child_process.**

---

## O que fica para PR104

**PR104 — Runtime mínimo supervisionado** (próxima PR autorizada):

- Plugar `schema/enavia-github-bridge.js` no runtime de forma supervisionada.
- Adicionar rota/handler que chame as funções de planejamento do GitHub Bridge.
- Integrar com Safety Guard + Event Log no fluxo runtime real.
- Ainda sem token real, sem chamada GitHub API efetiva.
- Validar que as proteções (blocked, requires_human_review, github_execution=false) são propagadas até o response.

**PR105 — Prova Final do GitHub Bridge** (última PR do contrato):

- Cenários end-to-end cobrindo toda a cadeia PR102→PR103→PR104.
- Validação de que nenhum GitHub real foi executado.
- Validação de preservação de guardrails em todos os níveis.

---

## Evidência de execução

```
node tests/pr103-github-bridge-helper-supervisionado.prova.test.js
76/76 cenários passando ✅

Testes históricos mantidos passando:
- node tests/pr102-github-bridge-real-diagnostico.prova.test.js ✅
- node tests/pr101-observabilidade-autoprotecao-final.prova.test.js ✅
- node tests/pr100-safety-guard-antiautodestruction.prova.test.js ✅
- node tests/pr99-event-log-health-snapshot.prova.test.js ✅
```

---

## Guardrails confirmados

- ✅ `github_execution: false` — nenhuma operação GitHub real executada
- ✅ `side_effects: false` — nenhum side effect
- ✅ `ready_for_real_execution: false` — não pronto para execução real ainda
- ✅ `merge` bloqueado
- ✅ `deploy_prod` bloqueado
- ✅ `secret_change` bloqueado
- ✅ Safety Guard integrado
- ✅ Event Log integrado
- ✅ Health Snapshot considerado
- ✅ Nenhum runtime alterado
