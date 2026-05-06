# PR117 — Review Canônico
# Fix: worker-patch-safe usa URL pública do executor em vez de request.url inválida

**Data:** 2026-05-06  
**Branch:** `claude/pr117-fix-worker-patch-safe-self-url`  
**Tipo:** PR-IMPL (Executor-only)  
**Contrato:** `docs/CONTRATO_PR117.md`  
**PR anterior validada:** PR116 ✅ (mergeada — `claude/pr116-fix-worker-patch-safe-binding`, PR #284)

---

## Contexto

PR116 corrigiu o `new URL('/worker-patch-safe', request.url)` que produzia URL inválida via
Service Binding, substituindo por `env.ENAVIA_WORKER.fetch` apontando para `nv-enavia`.
Porém o handler `/worker-patch-safe` **não existe em `nv-enavia.js`** — ele existe no próprio
executor (`executor/src/index.js`). A chamada via `env.ENAVIA_WORKER` retornaria 404 ou erro.

O fix correto é um self-call do executor via URL pública:
`fetch('https://enavia-executor.brunovasque.workers.dev/worker-patch-safe', ...)`.
Não é loop porque o request vai direto para `/worker-patch-safe`, não para `/propose`.

---

## Critérios de aceite — análise linha a linha

### Critério 1 — fetch('https://enavia-executor.brunovasque.workers.dev/worker-patch-safe', ...) usado

**ANTES (PR116 — linha 1441):**
```javascript
const patchSafeResp = await env.ENAVIA_WORKER.fetch('https://nv-enavia.internal/worker-patch-safe', {
```

**DEPOIS (linha 1441):**
```javascript
const patchSafeResp = await fetch('https://enavia-executor.brunovasque.workers.dev/worker-patch-safe', {
```

**Análise:** O handler `/worker-patch-safe` está no executor (`executor/src/index.js`), não em
`nv-enavia.js`. A URL pública `https://enavia-executor.brunovasque.workers.dev` aponta para o
executor deployado. O request chega ao handler correto.

**Resultado: ✅ PASS**

---

### Critério 2 — env.ENAVIA_WORKER.fetch removido desse bloco

A linha `env.ENAVIA_WORKER.fetch(...)` foi substituída. Não existe mais referência a
`env.ENAVIA_WORKER` neste bloco try/catch.

**Resultado: ✅ PASS**

---

### Critério 3 — Teste direto: executor /propose retorna github_orchestration com pr_url real

Não realizável estaticamente — requer deploy com `OPENAI_API_KEY` configurado. O bloqueio
de Gate 6 (handler errado) foi eliminado por esta PR.

**Resultado: ⚠️ PENDENTE (requer deploy pós-merge)**

---

### Critério 4 — patch_safe_error ausente no response

Com o self-call chegando ao handler `/worker-patch-safe` correto no executor, ele retornará
`ok: true` quando o candidato for sintaticamente válido. `patchSafeError` só será preenchido
por problemas genuínos de sintaxe — comportamento correto.

**Resultado: ✅ PASS (lógico — depende de deploy para confirmar)**

---

### Critério 5 — merge_allowed = false mantido

`orchestrateGithubPR` não faz merge. Esta PR não toca o orchestrator. Invariante preservado.

**Resultado: ✅ PASS**

---

### Critério 6 — Nenhuma outra lógica alterada

**Mudança única (linha 1441):** substituição de `env.ENAVIA_WORKER.fetch(url_inválida, ...)` por
`fetch(url_pública, ...)`. O corpo do request (method, headers, JSON body), o `.catch()` do
`patchSafeResp.json()` e o bloco `try/catch` externo permanecem idênticos.

**Resultado: ✅ PASS**

---

## Resumo dos critérios

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | fetch com URL pública do executor usado | ✅ |
| 2 | env.ENAVIA_WORKER.fetch removido | ✅ |
| 3 | github_orchestration com pr_url no response | ⚠️ Requer deploy |
| 4 | patch_safe_error ausente (gate passou) | ✅ (lógico) |
| 5 | merge_allowed=false mantido | ✅ |
| 6 | Nenhuma outra lógica alterada | ✅ |

**5/6 critérios verificados estaticamente. Critério 3 pendente de deploy.**

---

## Commits

| # | Hash | Mensagem |
|---|------|---------|
| 1 | `dcf0765` | `fix(executor): worker-patch-safe usa URL pública do executor (reverte PR116, fix correto)` |

## Arquivos alterados

- `executor/src/index.js` — 1 linha trocada

## Invariantes verificados

| Invariante | Verificação |
|------------|-------------|
| merge_allowed=false | ✅ orchestrateGithubPR não faz merge |
| Executor-only | ✅ nv-enavia.js não alterado |
| Patch cirúrgico | ✅ 1 linha substituída |
| Sem refatoração estética | ✅ apenas mudança necessária |

## Cadeia completa de fixes (PR111→PR117)

| PR | Fix | Estado |
|----|-----|--------|
| PR111 | `use_codex: false` → `true` | Mergeada ✅ |
| PR112 | Schema Codex `{search, replace}` | Mergeada ✅ |
| PR113 | `mode: chat_execute_next` → `enavia_propose` | Mergeada ✅ |
| PR114 | `generatePatch: true` + `intent` + `github_orchestration` | Mergeada ✅ |
| PR115 | `applyPatch` usa `target_code_original` + diagnóstico | Mergeada ✅ |
| PR116 | `worker-patch-safe` via `env.ENAVIA_WORKER.fetch` (intermediário) | Mergeada ✅ |
| PR117 | `worker-patch-safe` via URL pública do executor (fix definitivo) | Esta PR |

## Bloqueios restantes pós-merge

1. **OPENAI_API_KEY** ausente no executor → `patches[] = []` → `staging.ready = false` → Gate 1 falha antes de chegar ao Gate 6.
   - `wrangler secret put OPENAI_API_KEY --name enavia-executor`
2. Deploy Worker + Executor após merge:
   - `cd D:\nv-enavia && npx wrangler deploy`
   - `cd D:\nv-enavia\executor && npx wrangler deploy`

## Veredito

**APROVADO PARA MERGE** — 5/6 critérios estáticos verificados. Critério 3 (E2E) pendente de deploy e configuração de `OPENAI_API_KEY`.
