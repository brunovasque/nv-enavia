# PR104 — Runtime mínimo supervisionado do GitHub Bridge Real

**Data:** 2026-05-04  
**Tipo:** PR-IMPL  
**Contrato ativo:** `CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md`  
**PR anterior validada:** PR103 ✅ GitHub Bridge helper real supervisionado  
**Branch:** `copilot/pr-104-runtime-minimo-supervisionado`

---

## O que foi implementado

### 1. Integração runtime mínima — `contract-executor.js`

- Adicionado import CJS interop de `schema/enavia-github-bridge.js` via esbuild/wrangler:
  ```javascript
  import _githubBridgeNs from "./schema/enavia-github-bridge.js";
  const _buildGithubBridgePlan = _githubBridgeNs.buildGithubBridgePlan;
  ```
- Criada função interna `_handleGithubBridgeRuntime(body)` que:
  - Aceita payload com `mode: "github_bridge_runtime"` + `operations` (array) ou `operation` (objeto único)
  - Normaliza input para `buildGithubBridgePlan`
  - Retorna plano supervisionado com todos os campos obrigatórios
- Estendido `handleGitHubPrAction` para detectar `body.mode === "github_bridge_runtime"` ANTES da lógica P24, despachar para `_handleGithubBridgeRuntime` e retornar

### 2. Roteamento — rota existente reaproveitada

- **Nenhum endpoint novo criado.**
- A rota `POST /github-pr/action` já existia (P24, linha 9142 de `nv-enavia.js`).
- O modo `github_bridge_runtime` é detectado dentro do mesmo handler existente.
- Compatibilidade com handlers P24 existentes preservada (`body.mode !== "github_bridge_runtime"` continua no fluxo original).

### 3. Bloqueios duros preservados via GitHub Bridge helper (PR103)

- `merge` — sempre bloqueado (via `BLOCKED_OPERATION_TYPES` do bridge)
- `deploy_prod` — sempre bloqueado
- `secret_change` — sempre bloqueado
- Repo sem allowlist — exige revisão humana
- Health snapshot `failed` — bloqueia operações mutáveis
- Event log com operações bloqueadas — exige revisão humana
- Safety Guard integrado em toda operação

### 4. Invariantes de segurança em toda resposta

- `github_execution: false` — sempre (sem execução real no GitHub)
- `side_effects: false` — sempre
- `ready_for_real_execution: false` — sempre (sem aprovação humana explícita)

### 5. Formato de resposta do runtime

Toda resposta `mode: "github_bridge_runtime"` contém:
- `ok` — boolean
- `mode: "github_bridge_runtime"`
- `bridge_plan` — plano completo do GitHub Bridge (PR103)
- `safety_summary` — resumo de segurança
- `event_summary` — resumo de eventos Enavia
- `requires_human_review` — boolean
- `blocked_operations` — array de operações bloqueadas
- `github_execution: false`
- `side_effects: false`
- `ready_for_real_execution: false`
- `next_recommended_action` — próxima ação recomendada

### 6. Testes

- Criado `tests/pr104-github-bridge-runtime-minimo.prova.test.js` com 52 cenários.
- Todos os testes obrigatórios executados (PR103, PR102, PR101, PR100, PR99, PR98, PR93, PR90, PR89, PR84, PR59).

---

## O que não foi mexido (intocado)

- `nv-enavia.js` — roteamento existente preservado sem alteração
- `schema/enavia-github-bridge.js` — nenhum ajuste necessário (helper PR103 funciona sem modificação)
- `schema/github-pr-arm-contract.js` — P24 intocado
- `schema/enavia-safety-guard.js` — intocado
- `schema/enavia-event-log.js` — intocado
- `schema/enavia-health-snapshot.js` — intocado
- `.github/workflows/deploy.yml` — não alterado
- `wrangler.toml` — não alterado
- `panel/**` — não alterado
- PR Orchestrator (PR90–PR93) — não refatorado
- Chat Livre + Cockpit (PR94–PR97) — não refatorado
- Observabilidade + Autoproteção (PR98–PR101) — não refatorado
- Deploy loop (PR86–PR89) — não refatorado
- Skill Factory/Runner — não refatorado
- SELF_WORKER_AUDITOR — intocado
- Gates humanos — intocados
- Bloqueios de PROD/merge/secrets — reforçados, não liberados
- Bindings Cloudflare — nenhum novo binding adicionado

---

## Diagrama de fluxo

```
POST /github-pr/action
  ↓
handleGitHubPrAction (contract-executor.js)
  ↓ body.mode === "github_bridge_runtime"?
  ├── SIM → _handleGithubBridgeRuntime(body)
  │         ↓
  │         _buildGithubBridgePlan({ operations }, context)
  │         ↓ [schema/enavia-github-bridge.js — PR103]
  │         validateGithubOperation × N
  │         + evaluateSafetyGuard × N
  │         + buildGithubOperationEvent × N
  │         ↓
  │         response { mode: "github_bridge_runtime", bridge_plan, safety_summary, ... }
  │         github_execution=false, side_effects=false, ready_for_real_execution=false
  └── NÃO → fluxo P24 original (executeGitHubPrAction)
```

---

## Riscos restantes

1. **CJS interop via esbuild**: O import de `schema/enavia-github-bridge.js` (CJS) em `contract-executor.js` (ESM) depende do interop automático do esbuild/Wrangler. Fallback seguro implementado caso o módulo não carregue.
2. **Sem token real**: Esta PR não conecta token GitHub nem realiza chamada `api.github.com`. O plano é supervisionado apenas. Token real e execução real ficam para PR105 (com aprovação humana explícita).
3. **Sem prova de operação real**: A prova de que o plano pode virar ação real supervisionada é responsabilidade da PR105.
4. **Aprovação humana não implementada**: O campo `ready_for_real_execution` permanece `false`. O mecanismo de aprovação humana para liberar execução real é escopo de PR105.

---

## O que fica para PR105 — Prova real supervisionada

- Prova de operação real mínima no GitHub (create_branch ou comment em repo permitido)
- Token GitHub supervisionado (via KV ou env seguro)
- Safety Guard validado em operação real
- Event Log gerado com evidência real
- Trava antes de merge/deploy_prod mantida
- Relatório de prova com evidência real

---

## Operações disponíveis via modo github_bridge_runtime

| Operação | Status |
|----------|--------|
| create_branch | ✅ Planejada — bloqueio se base/head ausente |
| open_pr | ✅ Planejada — bloqueio se base/head ausente |
| update_pr | ✅ Planejada — exige pr_number |
| comment_pr | ✅ Planejada — exige pr_number |
| attach_evidence | ✅ Planejada |
| request_review | ✅ Planejada |
| merge | ❌ Sempre bloqueado |
| deploy_prod | ❌ Sempre bloqueado |
| secret_change | ❌ Sempre bloqueado |

---

## Testes executados

| Teste | Resultado |
|-------|-----------|
| `tests/pr104-github-bridge-runtime-minimo.prova.test.js` | ✅ 52/52 |
| `tests/pr103-github-bridge-helper-supervisionado.prova.test.js` | ✅ pass |
| `tests/pr102-github-bridge-real-diagnostico.prova.test.js` | ✅ pass |
| `tests/pr101-observabilidade-autoprotecao-final.prova.test.js` | ✅ pass |
| `tests/pr100-safety-guard-antiautodestruction.prova.test.js` | ✅ pass |
| `tests/pr99-event-log-health-snapshot.prova.test.js` | ✅ pass |
| `tests/pr98-observabilidade-autoprotecao-diagnostico.prova.test.js` | ✅ pass |
| `tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js` | ✅ pass |
| `tests/pr90-pr-orchestrator-diagnostico.prova.test.js` | ✅ pass |
| `tests/pr89-internal-loop-final-proof.smoke.test.js` | ✅ pass |
| `tests/pr84-chat-vivo.smoke.test.js` | ✅ pass |
| `tests/pr59-response-policy-viva.smoke.test.js` | ✅ pass |

---

_PR104 concluída em 2026-05-04. Próxima: PR105 — Prova real supervisionada._
