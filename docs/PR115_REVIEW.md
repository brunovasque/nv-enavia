# PR115 — Review Canônico
# Fix: applyPatch usa target_code_original (código completo), não target_code (chunk)

**Data:** 2026-05-06  
**Branch:** `claude/pr115-fix-apply-patch-original-code`  
**Tipo:** PR-IMPL (Executor-only)  
**Contrato:** `docs/CONTRATO_PR115.md`  
**PR anterior validada:** PR114 ✅ (mergeada — `claude/pr114-fix-ciclo-chat-pr`, PR #282)

---

## Critérios de aceite — análise linha a linha

### Critério 1 — applyPatch chamado com target_code_original (790k), não com chunk (16k)

**ANTES (linha 1416):**
```javascript
const originalCode = action.context?.target_code_original || action.context?.target_code || null;
```

**DEPOIS:**
```javascript
const originalCode = action.context?.target_code_original || null;
```

**Análise:** O fallback `|| action.context?.target_code` foi removido. `target_code` é um chunk de 16k
extraído em `action.context.target_code` via `chunkResult.chunk` (linha ~1200 do executor), offset 86443
do arquivo real de 790k. `applyPatch` falha com `ANCHOR_NOT_FOUND` quando `search` aponta para código
fora do chunk. `target_code_original` (linha ~1198) é o snapshot completo. Agora `applyPatch` recebe
o arquivo inteiro.

**Resultado: ✅ PASS**

---

### Critério 2 — Teste: ciclo chat → "melhora X" → "sim" → PR aberta

Não realizável nesta PR (requer deploy com `OPENAI_API_KEY` + binding `ENAVIA_WORKER`). O bloqueador
desta PR (Gate 4 falhar silenciosamente) foi resolvido. Bloqueadores operacionais restantes documentados
no Critério 6.

**Resultado: ⚠️ PENDENTE (requer deploy pós-merge)**

---

### Critério 3 — github_orchestration aparece no response com pr_url real

Implementado em PR114 (PR #282, mergeada). Esta PR não altera esse comportamento.

**Resultado: ✅ PASS (herdado de PR114)**

---

### Critério 4 — Se applyPatch falhar, erro aparece em result.apply_patch_error

**Implementado (linhas ~1421–1429):**
```javascript
if (!patchResult.ok) {
  applyPatchError = {
    ok: false,
    reason: patchResult.reason || patchResult.error || 'APPLY_PATCH_FAILED',
    applied_count: patchResult.applied?.length ?? 0,
    failed_count: patchResult.failed?.length ?? 0,
  };
}
```

`applyPatchError` é exposto no response via `...(applyPatchError ? { apply_patch_error: applyPatchError } : {})`.
Captura todos os casos: `ANCHOR_NOT_FOUND`, `AMBIGUOUS_MATCH`, `CANDIDATE_TOO_SMALL`, `EMPTY_CANDIDATE`.

**Resultado: ✅ PASS**

---

### Critério 5 — Se worker-patch-safe falhar, erro aparece em result.patch_safe_error

**Implementado (linhas ~1455–1460):**
```javascript
patchSafeError = {
  ok: false,
  error: patchSafeData?.error || 'WORKER_PATCH_SAFE_FAILED',
  detail: patchSafeData,
};
```

`patchSafeError` é exposto no response via `...(patchSafeError ? { patch_safe_error: patchSafeError } : {})`.
Captura falhas de fetch, parse e validação de sintaxe.

**Resultado: ✅ PASS**

---

### Critério 6 — Nenhuma lógica de negócio alterada além da variável originalCode

**Mudanças realizadas:**
- Linha 1416: remoção do fallback `|| action.context?.target_code`
- Linhas 1414–1415: declaração de `applyPatchError` e `patchSafeError`
- Linhas 1421–1429: captura `applyPatchError` quando `!patchResult.ok`
- Linhas 1455–1460: captura `patchSafeError` quando `!patchSafeData?.ok`
- Linhas 1501–1502: spread condicional no response

Nenhuma decisão de fluxo alterada. Os blocos `if (patchResult.ok && ...)` e `if (!patchSafeData?.ok)`
preservam comportamento idêntico ao anterior. Apenas diagnóstico adicionado.

**Resultado: ✅ PASS**

---

### Critério 7 — merge_allowed = false mantido (invariante absoluto)

`orchestrateGithubPR` recebe `baseBranch: 'main'` mas não `merge_allowed`. O orchestrator
(`github-orchestrator.js`) não faz merge — apenas abre PR via GitHub API. Invariante preservado.

**Resultado: ✅ PASS**

---

## Resumo dos critérios

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | applyPatch usa target_code_original (790k) | ✅ |
| 2 | Ciclo E2E chat→PR | ⚠️ Requer deploy |
| 3 | github_orchestration com pr_url no response | ✅ (PR114) |
| 4 | apply_patch_error no response quando applyPatch falha | ✅ |
| 5 | patch_safe_error no response quando worker-patch-safe falha | ✅ |
| 6 | Nenhuma lógica de negócio alterada | ✅ |
| 7 | merge_allowed=false mantido | ✅ |

**6/7 critérios passam estaticamente. Critério 2 pendente de deploy.**

---

## Commits

| # | Hash | Mensagem |
|---|------|---------|
| 1 | `59f607c` | `fix(executor): applyPatch usa target_code_original ao invés do chunk` |
| 2 | `0410ff4` | `feat(executor): expor apply_patch_error e patch_safe_error no response para diagnóstico` |

## Arquivos alterados

- `executor/src/index.js` — 2 commits, 19 linhas adicionadas, 1 linha removida

## Invariantes verificados

| Invariante | Verificação |
|------------|-------------|
| merge_allowed=false | ✅ orchestrateGithubPR não faz merge |
| Executor-only | ✅ nv-enavia.js não alterado |
| Patch cirúrgico | ✅ 3 edições no mesmo bloco lógico |
| Sem refatoração estética | ✅ apenas mudanças necessárias |

## Bloqueios restantes pós-merge

1. **OPENAI_API_KEY** ausente no executor → Codex não é chamado → `patches[] = []` → `staging.ready = false` → Gate 1 falha
2. **ENAVIA_WORKER binding** ausente em `wrangler.executor.generated.toml` → `orchestrateGithubPR` retorna `ENAVIA_WORKER_BINDING_ABSENT`
3. Deploy de Worker (`nv-enavia`) e Executor após merge desta PR

## Veredito

**APROVADO PARA MERGE** — 6/7 critérios estáticos verificados. Critério 2 (E2E) pendente de deploy e configuração de secrets.
