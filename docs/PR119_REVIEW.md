# PR119 — Review Canônico
# Fix: action edit-worker no dispatch + eliminar self-call em edit-worker

**Data:** 2026-05-06  
**Branch:** `fix/pr119-action-edit-worker-dispatch`  
**Tipo:** PR-IMPL (Worker + Executor)  
**Contrato:** `docs/CONTRATO_PR119.md`  
**PR anterior validada:** PR118 ✅ (mergeada — `fix/pr118-worker-patch-safe-internal-validate`, PR #286)

---

## Contexto

Dois problemas encadeados bloqueavam o ciclo E2E:

1. **nv-enavia.js**: `_dispatchExecuteNextFromChat` enviava payload sem o campo `action`. O executor
   validava `action` contra lista permitida e retornava `403 Invalid action: undefined`.

2. **executor/src/index.js**: O handler `edit-worker` chamava `/module-validate` via self-call HTTP
   `request.url.replace("/engineer-core", "/module-validate")` — bloqueado pelo Cloudflare com
   error 1042 (loop detection). Mesmo padrão resolvido na PR118 para `/worker-patch-safe`.

---

## Critérios de aceite — análise

### Critério 1 — `action: "edit-worker"` dentro de `_proposePayload` em nv-enavia.js

**Diff (linha 3719):**
```diff
   const _proposePayload = {
     source: "chat_trigger",
     mode: "enavia_propose",
+    action: "edit-worker",
     intent: pendingPlan.description || `Melhoria solicitada via chat em ${improvementTarget}`,
```

`action: "edit-worker"` adicionado na posição correta — entre `mode` e `intent`.

**Resultado: ✅ PASS**

---

### Critério 2 — `request.url.replace.*module-validate` ausente no bloco `edit-worker`

**Grep em executor/src/index.js para `request.url.replace.*module-validate`:**

| Linha | Contexto | Bloco |
|-------|----------|-------|
| 2018 | `if (action === "validate")` | action=validate — **fora de edit-worker** |
| 2054 | outro action branch | action de módulo — **fora de edit-worker** |

O bloco `if (action === "edit-worker")` (linha 2114) **não contém mais** `request.url.replace`.

**Resultado: ✅ PASS**

---

### Critério 3 — `validateWorkerCode(workerContent)` presente no bloco `edit-worker`

**Após a substituição (linha ~2118):**
```javascript
// PR119: internalizar validação — self-call HTTP bloqueado pelo Cloudflare (error 1042)
// validateWorkerCode() disponível desde PR118
const validateData = await validateWorkerCode(workerContent);
```

`validateWorkerCode` declarada na linha 2441 (MÓDULO 9A, inserida em PR118). Chamada correta
com `workerContent` — mesmo argumento que antes era enviado como `content` no body do fetch.

**Resultado: ✅ PASS**

---

### Critério 4 — Teste E2E: received_action=edit-worker no propose_result

Não realizável estaticamente — requer deploy com `OPENAI_API_KEY`. Com `action: "edit-worker"`
no payload, o executor receberá `received_action.action = "edit-worker"` e roteará para o
handler correto em vez de retornar 403.

**Resultado: ⚠️ PENDENTE (requer deploy pós-merge)**

---

### Critério 5 — Teste E2E: github_orchestration não é null após confirmação

Não realizável estaticamente — requer deploy + OPENAI_API_KEY + ciclo completo.
Estruturalmente, com os 6 gates todos corrigidos (PR111–PR119), este resultado é esperado.

**Resultado: ⚠️ PENDENTE (requer deploy pós-merge)**

---

### Critério 6 — merge_allowed=false intocado

Nenhuma alteração em `orchestrateGithubPR`, `merge_allowed` ou pontos de decisão de merge.
Invariante preservado.

**Resultado: ✅ PASS**

---

### Critério 7 — Nenhum outro handler modificado fora do escopo

**Mudanças desta PR:**
1. `nv-enavia.js` linha 3719: 1 linha adicionada (`action: "edit-worker"`)
2. `executor/src/index.js` bloco `edit-worker`: 12 linhas removidas, 3 adicionadas

Os handlers `/propose`, `/worker-patch-safe`, `/module-validate`, `/audit` e todos os demais
permanecem intocados.

**Resultado: ✅ PASS**

---

## Resumo dos critérios

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | `action: "edit-worker"` no `_proposePayload` | ✅ |
| 2 | `request.url.replace.*module-validate` removido de `edit-worker` | ✅ |
| 3 | `validateWorkerCode(workerContent)` no bloco `edit-worker` | ✅ |
| 4 | E2E: received_action=edit-worker | ⚠️ Requer deploy |
| 5 | E2E: github_orchestration não null | ⚠️ Requer deploy |
| 6 | merge_allowed=false intocado | ✅ |
| 7 | Nenhum outro handler modificado | ✅ |

**5/7 verificados estaticamente. Critérios 4 e 5 pendentes de deploy.**

---

## Commits

| # | Hash | Arquivo | Mensagem |
|---|------|---------|---------|
| 1 | `efadfea` | `nv-enavia.js` | `fix(pr119): adicionar action edit-worker no payload do _dispatchExecuteNextFromChat` |
| 2 | `692e3f2` | `executor/src/index.js` | `fix(pr119): substituir self-call HTTP module-validate por validateWorkerCode() em edit-worker` |

## Arquivos alterados

- `nv-enavia.js` — 1 linha adicionada
- `executor/src/index.js` — 3 linhas adicionadas, 12 removidas

## Invariantes verificados

| Invariante | Verificação |
|------------|-------------|
| merge_allowed=false | ✅ não tocado |
| Patch cirúrgico | ✅ 1 inserção + 1 substituição |
| Sem refatoração estética | ✅ apenas mudanças necessárias |

## Cadeia completa de fixes (PR111→PR119)

| PR | Fix | Estado |
|----|-----|--------|
| PR111–PR114 | use_codex, schema, mode, generatePatch | Mergeadas ✅ |
| PR115 | applyPatch usa target_code_original | Mergeada ✅ |
| PR116–PR117 | worker-patch-safe URL (intermediários) | Mergeadas ✅ |
| PR118 | validateWorkerCode internalizada | Mergeada ✅ |
| PR119 | action edit-worker + validateWorkerCode em edit-worker | Esta PR |

## Próximos passos obrigatórios pós-merge

1. `wrangler secret put OPENAI_API_KEY --name enavia-executor`
2. `cd D:\nv-enavia && npx wrangler deploy`
3. `cd D:\nv-enavia\executor && npx wrangler deploy`
4. Teste E2E: chat → "melhora o log de erro do /audit" → "sim" → verificar `github_orchestration.pr_url`

## Veredito

**APROVADO PARA MERGE** — 5/7 critérios verificados estaticamente. Critérios 4 e 5 pendentes de deploy.
