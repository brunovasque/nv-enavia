# PR114 REVIEW — Fixes finais para fechar o ciclo chat→Codex→PR

**Data:** 2026-05-06  
**Branch:** claude/pr114-fix-ciclo-chat-pr  
**Contrato:** docs/CONTRATO_PR114_FIX_CICLO_CHAT_PR.md  
**Diagnóstico base:** docs/DIAGNOSTICO_ARQUITETURAL_2026-05-06.md  
**Tipo da PR:** PR-IMPL  
**PRs anteriores validadas:** PR111 ✅, PR112 ✅, PR113 ✅ — todas mergeadas

---

## Critérios de aceite

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | `_proposePayload` contém `generatePatch: true` | ✅ | Linha 3725: `generatePatch: true,` |
| 2 | `intent` usa `pendingPlan.description` em vez de `"propose"` fixo | ✅ | Linha 3719: `intent: pendingPlan.description \|\| \`Melhoria...\`` |
| 3 | Response do `/propose` inclui `github_orchestration` quando PR aberta | ✅ | Linha 1487: `...(githubOrchestrationResult ? { github_orchestration: githubOrchestrationResult } : {})` |
| 4 | Nenhuma outra linha alterada fora do escopo | ✅ | Commit 1: 1 file, 2 ins + 1 del. Commit 2: 1 file, 4 ins |
| 5 | PR aberta com `docs/PR114_REVIEW.md` gerado | ✅ | Este arquivo |

**Resultado: 5/5 critérios atendidos**

---

## Invariantes

| # | Invariante | Status |
|---|------------|--------|
| 1 | `merge_allowed = false` | ✅ Respeitado |
| 2 | Branch nunca é `main` ou `master` | ✅ Branch: `claude/pr114-fix-ciclo-chat-pr` |
| 3 | Nenhuma alteração em `schema/`, `deploy-worker/`, `patch-engine.js` | ✅ Apenas `nv-enavia.js` e `executor/src/index.js` |
| 4 | Patch cirúrgico — sem refatoração | ✅ 7 linhas modificadas no total (2 arquivos) |

**Resultado: 4/4 invariantes respeitadas**

---

## Commits atômicos

### Commit 1 — `94aac3b`
`fix(pr114): adicionar generatePatch=true e intent descritivo ao dispatch do chat`
- Arquivo: `nv-enavia.js`
- 2 alterações cirúrgicas em `_proposePayload` (linha ~3716):
  1. `intent: "propose"` → `intent: pendingPlan.description || \`Melhoria solicitada via chat em ${improvementTarget}\``
  2. Adição de `generatePatch: true,` após `use_codex: true,`

### Commit 2 — `7c79e4d`
`fix(pr114): incluir github_orchestration no response do /propose`
- Arquivo: `executor/src/index.js`
- 3 alterações cirúrgicas no handler POST `/propose`:
  1. Declaração: `let githubOrchestrationResult = null;` antes do bloco GitHub
  2. Captura: `githubOrchestrationResult = orchestratorResult;` após `orchestrateGithubPR`
  3. Spread no response: `...(githubOrchestrationResult ? { github_orchestration: githubOrchestrationResult } : {})`

---

## Análise de impacto

### Fix 1 — `generatePatch: true`

**Problema corrigido:** sem esse campo, `/propose` calculava `wantsPatch = false` e não forçava `mode = "engineer"`. O `enaviaExecutorCore` recebia `mode: "enavia_propose"` que não é reconhecido → UNKNOWN MODE → `ok: false` → `staging.ready = false` → PR nunca aberta.

**Com o fix:** `/propose` detecta `action.generatePatch === true` → `wantsPatch = true` → `mode = "engineer"` → pipeline correto → `callCodexEngine` chamado (se OPENAI_API_KEY presente) → patches gerados → `staging.ready = true`.

### Fix 2 — `intent` descritivo

**Problema corrigido:** `intent: "propose"` era passado literalmente como `intentText` para `callCodexEngine`. O Codex recebia "propose" como objetivo — sem saber o que melhorar.

**Com o fix:** `intentText` = ex: `"Melhoria solicitada via chat em /audit"` ou o que `pendingPlan.description` tiver — o Codex recebe o objetivo real do usuário.

### Fix 3 — `github_orchestration` no response

**Problema corrigido:** `orchestrateGithubPR` era chamado, o resultado ia apenas para KV via `updateFlowStateKV`. O HTTP response nunca incluía `github_orchestration`. `_dispatchExecuteNextFromChat` lia `proposeJson?.github_orchestration?.pr_url` que era sempre `undefined` → `pr_url: null` → usuário nunca via a URL da PR no chat.

**Com o fix:** `githubOrchestrationResult` captura o resultado de `orchestrateGithubPR` e é incluído no response via spread condicional. `_dispatchExecuteNextFromChat` consegue ler `proposeJson.github_orchestration.pr_url`.

**Sem risco de regressão:** spread condicional — se PR não foi aberta, `githubOrchestrationResult = null` e o campo não aparece no response. Comportamento idêntico ao anterior quando PR não é aberta.

---

## Fluxo corrigido (pós-merge + deploy)

```
Bruno: "melhora o log de erro do /audit"
→ Enavia: "Entendi. Posso auditar e abrir uma PR em /audit. Confirma?"
→ Bruno: "sim"
→ _dispatchExecuteNextFromChat envia:
    { mode: "enavia_propose",
      intent: "Melhoria solicitada via chat em /audit",  ← Fix 2
      generatePatch: true,                               ← Fix 1
      use_codex: true,
      target: { workerId: "nv-enavia" },
      context: { require_live_read: true } }
→ /propose: wantsPatch = true → mode = "engineer"
→ snapshot vivo carregado
→ callCodexEngine(intentText="Melhoria solicitada...", workerCode=snapshot)
→ patches com {search, replace}
→ applyPatch → patchResult.ok = true
→ orchestrateGithubPR → PR aberta
→ githubOrchestrationResult = { ok: true, pr_url: "...", ... }  ← Fix 3
→ response: { ..., github_orchestration: { pr_url: "..." } }
→ _dispatchExecuteNextFromChat: prUrl = proposeJson.github_orchestration.pr_url
→ Chat reply: "PR aberta: https://github.com/..."
```

---

## Pré-requisitos operacionais (não código)

Para o ciclo funcionar após merge e deploy:

1. `OPENAI_API_KEY` configurado no executor:
   ```
   wrangler secret put OPENAI_API_KEY --name enavia-executor
   ```
   Sem isso, `callCodexEngine` retorna `{ ok: false, reason: "missing_api_key" }` e o fallback são apenas patches heurísticos (log helper, execution_id). Esses podem ou não gerar `staging.ready = true`.

2. `ENAVIA_WORKER` binding no executor (para `orchestrateGithubPR`):
   Ausente em `wrangler.executor.generated.toml` — sem isso, `orchestrateGithubPR` retorna `ENAVIA_WORKER_BINDING_ABSENT` e `pr_url = null`.

---

## Veredito: APROVADO PARA MERGE
