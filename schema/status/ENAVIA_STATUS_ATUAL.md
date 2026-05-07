# ENAVIA — Status Atual

**Data:** 2026-05-06 (atualizado após PR125 — GitHub source + keep_names)
**Branch ativa:** `feat/pr125-github-source-keep-names`
**Última tarefa:** PR125 — ler source GitHub em vez do bundle CF API + keep_names no wrangler.toml ✅

## Atualização PR125 — GitHub source + keep_names — 2026-05-06

- Branch: `feat/pr125-github-source-keep-names`
- PR GitHub: [#293](https://github.com/brunovasque/nv-enavia/pull/293) — aguarda merge
- Tipo: PR-IMPL (Executor-only + Worker-config)
- Contrato: `docs/CONTRATO_PR125.md` ✅
- PR anterior: PR124 ✅ (mergeada — PR #292)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | fd6a989 | `wrangler.toml` | `keep_names = true` na seção `[esbuild]` |
| 2 | 25ec093 | `executor/src/index.js` | função `_fetchWorkerSource` |
| 3 | 6cbb7f3 | `executor/src/index.js` | `/propose` usa `_fetchWorkerSource` com fallback CF API |
| 4 | d2d6776 | `docs/PR125_REVIEW.md` | Review 4/8 critérios, APROVADO |

### Critérios de conclusão: 4/8 ✅ (4 pendentes de deploy)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.



## Atualização PR124 — normalização de quebras de linha — 2026-05-06

- Branch: `fix/pr124-patch-engine-normalize-newlines`
- PR GitHub: [#292](https://github.com/brunovasque/nv-enavia/pull/292) — aguarda merge
- Tipo: PR-IMPL (Executor-only)
- Contrato: `docs/CONTRATO_PR124.md` ✅
- PR anterior: PR123 ✅ (mergeada — PR #291)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | c3b8e62 | `executor/src/patch-engine.js` | normalização de `\n`, `\r\n`, `\r`, `\\n` em search/replace/candidateNorm |
| 2 | 2f57ad7 | `docs/PR124_REVIEW.md` | Review 4/7 critérios, APROVADO |

### Critérios de conclusão: 4/7 ✅ (3 pendentes de deploy + OPENAI_API_KEY)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.



## Atualização PR123 — loop de validação + retry — 2026-05-06

- Branch: `feat/pr123-validation-loop-retry-bruno`
- PR GitHub: [#291](https://github.com/brunovasque/nv-enavia/pull/291) — aguarda merge
- Tipo: PR-IMPL (Worker-only)
- Contrato: `docs/CONTRATO_PR123.md` ✅
- PR anterior: PR122 ✅ (mergeada — PR #290)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | ed0a290 | `nv-enavia.js` | `_dispatchExecuteNextFromChat`: loop 5 tentativas + `_gerarPossívelSolução` |
| 2 | 9102b31 | `docs/PR123_REVIEW.md` | Review 8/8 critérios, APROVADO |

### Critérios de conclusão: 8/8 ✅ (todos verificados estaticamente)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.



## Atualização PR122 — prompt Codex exemplos concretos — 2026-05-06

- Branch: `fix/pr122-codex-prompt-exemplo-search`
- PR GitHub: [#290](https://github.com/brunovasque/nv-enavia/pull/290) — aguarda merge
- Tipo: PR-IMPL (Executor-only)
- Contrato: `docs/CONTRATO_PR122.md` ✅
- PR anterior: PR121 ✅ (mergeada — PR #289)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | b6d2333 | `executor/src/index.js` | systemLines: exemplos concretos de search (ex: `console.log`, `async function`) |
| 2 | c7e9a7b | `docs/PR122_REVIEW.md` | Review 3/7 critérios, APROVADO |

### Critérios de conclusão: 3/7 ✅ (4 pendentes de deploy + OPENAI_API_KEY)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.



## Atualização PR121 — prompt Codex search curto — 2026-05-06

- Branch: `fix/pr121-codex-prompt-search-short`
- PR GitHub: [#289](https://github.com/brunovasque/nv-enavia/pull/289) — aguarda merge
- Tipo: PR-IMPL (Executor-only)
- Contrato: `docs/CONTRATO_PR121.md` ✅
- PR anterior: PR120 ✅ (mergeada — PR #288)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | 127d46f | `executor/src/index.js` | systemLines: search ≤120 chars + instrução CRÍTICO |
| 2 | a642fbc | `docs/PR121_REVIEW.md` | Review 4/7 critérios, APROVADO |

### Critérios de conclusão: 4/7 ✅ (3 pendentes de deploy + OPENAI_API_KEY)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.



## Atualização PR120 — parser callCodexEngine search/replace — 2026-05-06

- Branch: `fix/pr120-codex-parser-search-replace`
- PR GitHub: [#288](https://github.com/brunovasque/nv-enavia/pull/288) — aguarda merge
- Tipo: PR-IMPL (Executor-only)
- Contrato: `docs/CONTRATO_PR120.md` ✅
- PR anterior: PR119 ✅ (mergeada — PR #287)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | a1b569e | `executor/src/index.js` | parser `callCodexEngine` lê `rawPatch.search`/`rawPatch.replace` |
| 2 | 0039879 | `docs/PR120_REVIEW.md` | Review 5/7 critérios, APROVADO |

### Critérios de conclusão: 5/7 ✅ (2 pendentes de deploy + OPENAI_API_KEY)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.



## Atualização PR119 — action edit-worker + self-call edit-worker — 2026-05-06

- Branch: `fix/pr119-action-edit-worker-dispatch`
- PR GitHub: [#287](https://github.com/brunovasque/nv-enavia/pull/287) — aguarda merge
- Tipo: PR-IMPL (Worker + Executor)
- Contrato: `docs/CONTRATO_PR119.md` ✅
- PR anterior: PR118 ✅ (mergeada — PR #286)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | efadfea | `nv-enavia.js` | `action: "edit-worker"` no `_proposePayload` |
| 2 | 692e3f2 | `executor/src/index.js` | self-call `edit-worker` → `validateWorkerCode(workerContent)` |
| 3 | 3b98a86 | `docs/PR119_REVIEW.md` | Review 5/7 critérios, APROVADO |

### Critérios de conclusão: 5/7 ✅ (2 pendentes de deploy)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.



## Atualização PR118 — Internalizar validateWorkerCode — 2026-05-06

- Branch: `fix/pr118-worker-patch-safe-internal-validate`
- PR GitHub: [#286](https://github.com/brunovasque/nv-enavia/pull/286) — aguarda merge
- Tipo: PR-IMPL (Executor-only)
- Contrato: `docs/CONTRATO_PR118.md` ✅
- PR anterior: PR117 ✅ (mergeada — PR #285)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | 85860b2 | `executor/src/index.js` | `validateWorkerCode()` inserida antes do handler |
| 2 | 2e52692 | `executor/src/index.js` | self-call HTTP → `await validateWorkerCode(candidate)` |
| 3 | 3bfb43c | `docs/PR118_REVIEW.md` | Review 6/7 critérios, APROVADO |

### Critérios de conclusão: 6/7 ✅ (1 pendente de deploy)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.



## Atualização PR117 — Fix worker-patch-safe URL pública — 2026-05-06

- Branch: `claude/pr117-fix-worker-patch-safe-self-url`
- PR GitHub: [#285](https://github.com/brunovasque/nv-enavia/pull/285) — aguarda merge
- Tipo: PR-IMPL (Executor-only)
- Contrato: `docs/CONTRATO_PR117.md` ✅
- PR anterior: PR116 ✅ (mergeada — PR #284)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | dcf0765 | `executor/src/index.js` | `fetch(URL_pública)` em vez de `env.ENAVIA_WORKER.fetch` |
| 2 | 69ccdbc | `docs/PR117_REVIEW.md` | Review 5/6 critérios, APROVADO |

### Critérios de conclusão: 5/6 ✅ (1 pendente de deploy)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.



## Atualização PR116 — Fix worker-patch-safe binding — 2026-05-06

- Branch: `claude/pr116-fix-worker-patch-safe-binding`
- PR GitHub: [#284](https://github.com/brunovasque/nv-enavia/pull/284) — aguarda merge
- Tipo: PR-IMPL (Executor-only)
- Contrato: `docs/CONTRATO_PR116.md` ✅
- PR anterior: PR115 ✅ (mergeada — PR #283)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | ac0934a | `executor/src/index.js` | `env.ENAVIA_WORKER.fetch` em vez de `fetch(patchSafeUrl, ...)` |
| 2 | 9a4ca98 | `docs/PR116_REVIEW.md` | Review 5/6 critérios, APROVADO |

### Critérios de conclusão: 5/6 ✅ (1 pendente de deploy)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.

## Atualização PR115 — Fix applyPatch: target_code_original — 2026-05-06

- Branch: `claude/pr115-fix-apply-patch-original-code`
- PR GitHub: [#283](https://github.com/brunovasque/nv-enavia/pull/283) — aguarda merge
- Tipo: PR-IMPL (Executor-only)
- Contrato: `docs/CONTRATO_PR115.md` ✅
- PR anterior: PR114 ✅ (mergeada — PR #282)

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | 59f607c | `executor/src/index.js` | `originalCode` = `target_code_original` sem fallback para chunk |
| 2 | 0410ff4 | `executor/src/index.js` | `apply_patch_error` + `patch_safe_error` no response |
| 3 | 0436bb8 | `docs/PR115_REVIEW.md` | Review 6/7 critérios, APROVADO |

### Critérios de conclusão: 6/7 ✅ (1 pendente de deploy)

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.

## Atualização PR114 — Fix Ciclo Chat→PR — 2026-05-06

- Branch: `claude/pr114-fix-ciclo-chat-pr`
- PR GitHub: [#282](https://github.com/brunovasque/nv-enavia/pull/282) — aguarda merge
- Tipo: PR-IMPL (Worker + Executor)
- Contrato: `docs/CONTRATO_PR114_FIX_CICLO_CHAT_PR.md` ✅
- PRs anteriores: PR111 ✅, PR112 ✅, PR113 ✅ — todas mergeadas

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | 94aac3b | `nv-enavia.js` | `generatePatch: true` + `intent` descritivo no payload |
| 2 | 7c79e4d | `executor/src/index.js` | `github_orchestration` incluído no response do /propose |
| 3 | 9774e17 | `docs/PR114_REVIEW.md` | Review 5/5 critérios, 4/4 invariantes, APROVADO |

### Critérios de conclusão: 5/5 ✅

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.

## Atualização PR113 — Fix Mode Dispatch — 2026-05-06

- Branch: `claude/pr113-fix-mode-dispatch`
- PR GitHub: [#281](https://github.com/brunovasque/nv-enavia/pull/281) — aguarda merge
- Tipo: PR-IMPL (Worker-only)
- Contrato: `docs/CONTRATO_PR113_FIX_MODE_DISPATCH.md` ✅
- PR anterior: PR112 ✅ (mergeada)

### Commits executados

| # | Hash | Entrega |
|---|------|---------|
| 1 | a0c58bb | `nv-enavia.js` linha 3718: `mode: "chat_execute_next"` → `mode: "enavia_propose"` |
| 2 | 426ab8f | `docs/PR113_REVIEW.md` — 3/3 critérios, 4/4 invariantes, APROVADO |

### Critérios de conclusão: 3/3 ✅

- [x] Linha 3718: `"chat_execute_next"` → `"enavia_propose"`
- [x] Nenhuma outra linha alterada
- [x] PR aberta com `docs/PR113_REVIEW.md` gerado

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.

## Atualização PR112 — Fix Codex Patch Format — 2026-05-06

- Branch: `claude/pr112-fix-codex-patch-format`
- PR GitHub: [#280](https://github.com/brunovasque/nv-enavia/pull/280) — aguarda merge
- Tipo: PR-IMPL
- Contrato: `docs/CONTRATO_PR112_FIX_CODEX_PATCH_FORMAT.md` ✅
- PR anterior: PR111 ✅ (mergeada — `use_codex=true` ativo)

### Commits executados

| # | Hash | Entrega |
|---|------|---------|
| 1 | a43118d | `executor/src/index.js` — schema systemLines: `anchor/patch_text` → `search/replace` |
| 2 | e94f11f | `executor/src/index.js` — consumer codexResult.patches: `p.patch_text/p.anchor` → `p.search/p.replace` |
| 3 | f915118 | `docs/PR112_REVIEW.md` — 6/6 critérios, 5/5 invariantes, APROVADO |

### Critérios de conclusão: 6/6 ✅

- [x] `systemLines` não contém mais `anchor` nem `patch_text`
- [x] `systemLines` contém `search` e `replace` no schema
- [x] Consumer não usa mais `p.patch_text`, `p.patchText` nem `p.anchor`
- [x] Consumer usa `p.search` e `p.replace`
- [x] Nenhuma outra linha alterada fora do escopo
- [x] PR aberta com `docs/PR112_REVIEW.md` gerado

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.

## Hotfixes aplicados em main (2026-05-05)

- `7e7ff47` — `"sim"` adicionado a `_CHAT_BRIDGE_APPROVAL_TERMS`
- `8c60368` — `target.workerId` corrigido em `_dispatchExecuteNextFromChat`
- `0c97f1a` — PR111: `use_codex=true` ativo

## PR pendente de merge

- PR #280 — PR112: Fix Codex patch format (`claude/pr112-fix-codex-patch-format`)

## Próximo passo após merge

```powershell
cd D:\nv-enavia\executor
npx wrangler deploy
```
E configurar: `wrangler secret put OPENAI_API_KEY --name enavia-executor`



## Atualização PR110 — Trigger em Linguagem Natural via Chat ✅ — 2026-05-05

- Branch: `copilot/pr110-trigger-linguagem-natural`
- PR GitHub: (a abrir)
- Tipo: PR-IMPL (bridge chat → ciclo de autoevolução)
- Contrato: `docs/CONTRATO_ENAVIA_CHAT_TRIGGER_PR110.md` ✅
- PR anterior: PR109 ✅ (copilot/pr109-fix-ciclo-prova-real, PR #276, aguarda merge)

### Commits executados

| # | Hash | Entrega |
|---|------|---------|
| 1 | 5096066 | `schema/enavia-intent-classifier.js` — IMPROVEMENT_REQUEST: intent, target, negações |
| 2 | 51e491f | `nv-enavia.js` — pending_plan execute_next + contrato check + confirmação |
| 3 | fe03264 | `nv-enavia.js` — _dispatchExecuteNextFromChat + pr_url na response |
| 4 | b4ff5df | `tests/pr110-chat-trigger.prova.test.js` — 60 cenários |

### Critérios de conclusão do contrato: 13/14 ✅ (1 pendente — aprovação humana)

- [x] IMPROVEMENT_REQUEST adicionado ao classificador com termos gatilho
- [x] Negações próximas ao gatilho resultam em intent diferente
- [x] Target extraído e retornado no resultado da classificação
- [x] handleChatLLM detecta IMPROVEMENT_REQUEST e cria pending_plan
- [x] pending_plan tem TTL de 5 minutos (300s)
- [x] Usuário recebe mensagem de confirmação com target identificado
- [x] confidence=low sem target → pede clarificação, não cria pending_plan
- [x] _dispatchFromChat suporta action === "execute_next"
- [x] Response do chat inclui pr_url quando PR foi aberta
- [x] Contrato ativo verificado antes de criar pending_plan
- [x] Testes: classificador com mínimo 15 cenários (60 total)
- [x] Testes: fluxo completo chat→confirmação→PR com mock do execute-next
- [x] Nenhum teste anterior (PR50, PR60) quebrado
- [ ] PR revisada e aprovada por Bruno ← PENDENTE

### Resultado geral: 60 testes passando, 0 falhas

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.

## Status anterior PR109 — Fix Ciclo Codex + Prova Real ✅ APROVADO

- Branch: `copilot/pr109-fix-ciclo-prova-real`
- PR GitHub: #276 (aguarda merge por Bruno)
- Testes: 44/44 passando
- PR real de prova: #277 aberta e fechada ✅

## Próxima PR planejada: PR111

- Deploy real supervisionado (após merge de PR110 por Bruno)
- Enavia faz deploy da PR para ambiente TEST automaticamente
- Bruno valida em TEST e aprova PROD

## Status anterior PR108 — Motor de Patch + Orquestrador Self-Patch ✅ — mergeado via PR #275

- Branch: `copilot/pr108-motor-patch-orquestrador`
- PR GitHub: [#275](https://github.com/brunovasque/nv-enavia/pull/275) — mergeada em main ✅
- Tipo: PR-IMPL (fundação do ciclo de autoevolução)
- Contrato: `docs/CONTRATO_ENAVIA_MOTOR_PATCH_PR108.md` ✅
- PR anterior validada: PR107 ✅ (mergeada como PR #274)
