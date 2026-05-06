# PR120 — Review Canônico
# Fix: parser do callCodexEngine — alinhar leitura de {search, replace} com applyPatch

**Data:** 2026-05-06  
**Branch:** `fix/pr120-codex-parser-search-replace`  
**Tipo:** PR-IMPL (Executor-only)  
**Contrato:** `docs/CONTRATO_PR120.md`  
**PR anterior validada:** PR119 ✅ (mergeada — `fix/pr119-action-edit-worker-dispatch`, PR #287)

---

## Contexto

O `callCodexEngine` instrui o Codex a retornar `{search, replace}`, mas o parser interno lia:
```javascript
const patchText = rawPatch.patch_text || rawPatch.patchText || "";
if (!patchText) continue;
```

Como o Codex retorna `search`/`replace` (não `patch_text`), `patchText` ficava sempre `""` e
o patch era descartado. Resultado: `patches=[]` → `staging.ready=false` → `github_orchestration=null`.

O `applyPatch` em `patch-engine.js` espera `{search, replace}`. O alinhamento correto é
ler `rawPatch.search` e `rawPatch.replace` do objeto retornado pelo Codex.

---

## Critérios de aceite — análise

### Critério 1 — `rawPatch.search` dentro do loop de normalização do `callCodexEngine`

**Grep em executor/src/index.js:**
```
5852: const search = rawPatch.search || rawPatch.patch_text || rawPatch.patchText || "";
```

Dentro do `for (const rawPatch of patches)` em `callCodexEngine` (linha 5848).

**Resultado: ✅ PASS**

---

### Critério 2 — Objeto normalizado contém campos `search` e `replace`

**Diff do `normalized.push({...})`:**
```diff
+        search: String(search),
+        replace: String(replace),
         patch_text: String(search), // retrocompatibilidade
```

`search` e `replace` presentes. `patch_text` mantido por retrocompatibilidade.

**Resultado: ✅ PASS**

---

### Critério 3 — `warnings` NÃO contém `CODEX_ENGINE_NO_PATCH`

Não verificável estaticamente — requer deploy com `OPENAI_API_KEY`. Com `search` preenchido
a partir de `rawPatch.search`, o patch não é mais descartado, `normalized.length > 0` →
`patches.length > 0` → `staging.ready = true` → `CODEX_ENGINE_NO_PATCH` não emitido.

**Resultado: ⚠️ PENDENTE (requer deploy + OPENAI_API_KEY)**

---

### Critério 4 — `staging.ready = true` na resposta do `/propose`

Com `normalized.length > 0` (patches não descartados), `patches` no modo `engineer` terá
itens → `ready = patches.length > 0` → `staging.ready = true`. Lógica direta.

**Resultado: ✅ PASS (verificação estática do fluxo)**

---

### Critério 5 — E2E: `github_orchestration.pr_url` não null

Não verificável estaticamente — requer deploy. Com `staging.ready = true` e os 6 gates
corrigidos (PR111–PR119), este resultado é o esperado após deploy + OPENAI_API_KEY.

**Resultado: ⚠️ PENDENTE (requer deploy + OPENAI_API_KEY)**

---

### Critério 6 — `merge_allowed=false` intocado

Nenhuma alteração em `orchestrateGithubPR`, `merge_allowed` ou pontos de decisão de merge.
Invariante preservado.

**Resultado: ✅ PASS**

---

### Critério 7 — Nenhum outro handler modificado

**Mudança única:** loop de normalização dentro de `callCodexEngine` (linhas 5848–5882).
Nenhum handler de rota (`/propose`, `/worker-patch-safe`, `/engineer-core`, `/audit`) alterado.

**Resultado: ✅ PASS**

---

## Resumo dos critérios

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | `rawPatch.search` no loop de `callCodexEngine` | ✅ |
| 2 | Objeto normalizado contém `search` e `replace` | ✅ |
| 3 | `warnings` sem `CODEX_ENGINE_NO_PATCH` | ⚠️ Requer deploy |
| 4 | `staging.ready = true` | ✅ (estático) |
| 5 | E2E: `github_orchestration.pr_url` não null | ⚠️ Requer deploy |
| 6 | `merge_allowed=false` intocado | ✅ |
| 7 | Nenhum outro handler modificado | ✅ |

**5/7 verificados estaticamente. Critérios 3 e 5 pendentes de deploy.**

---

## Commit

| # | Hash | Mensagem |
|---|------|---------|
| 1 | `a1b569e` | `fix(pr120): parser callCodexEngine — ler search/replace do Codex alinhado com applyPatch` |

## Arquivo alterado

- `executor/src/index.js` — 10 linhas adicionadas, 6 removidas (loop de normalização em `callCodexEngine`)

## Diff resumido

```diff
-      const patchText =
-        rawPatch.patch_text ||
-        rawPatch.patchText ||
-        "";
-      if (!patchText) continue;
+      // PR120: Codex retorna {search, replace} — alinhado com applyPatch em patch-engine.js
+      const search = rawPatch.search || rawPatch.patch_text || rawPatch.patchText || "";
+      const replace = rawPatch.replace || "";
+      if (!search) continue;
 
       normalized.push({
         ...
-        patch_text: String(patchText),
+        search: String(search),
+        replace: String(replace),
+        patch_text: String(search), // retrocompatibilidade
         ...
+        raw: rawPatch,
       });
```

## Invariantes verificados

| Invariante | Verificação |
|------------|-------------|
| merge_allowed=false | ✅ não tocado |
| Executor-only | ✅ nv-enavia.js não alterado |
| Patch cirúrgico | ✅ apenas o loop de normalização |
| Sem refatoração estética | ✅ apenas mudanças necessárias |

## Cadeia de fixes — estado final após PR120

| PR | Fix | Estado |
|----|-----|--------|
| PR111 | `use_codex: true` | Mergeada ✅ |
| PR112 | Schema Codex `{search, replace}` no system prompt | Mergeada ✅ |
| PR113 | `mode: enavia_propose` | Mergeada ✅ |
| PR114 | `generatePatch: true` + `github_orchestration` no response | Mergeada ✅ |
| PR115 | `applyPatch` usa `target_code_original` | Mergeada ✅ |
| PR116–PR117 | worker-patch-safe URL (intermediários) | Mergeadas ✅ |
| PR118 | `validateWorkerCode` internalizada | Mergeada ✅ |
| PR119 | `action: edit-worker` + `validateWorkerCode` em edit-worker | Mergeada ✅ |
| PR120 | Parser `callCodexEngine` lê `search`/`replace` | Esta PR |

## Próximos passos obrigatórios pós-merge

1. `wrangler secret put OPENAI_API_KEY --name enavia-executor`
2. `cd D:\nv-enavia && npx wrangler deploy`
3. `cd D:\nv-enavia\executor && npx wrangler deploy`
4. Teste direto: `POST /propose` com `use_codex=true` → verificar `warnings` sem `CODEX_ENGINE_NO_PATCH`
5. Teste E2E: chat → "melhora o log de erro do /audit" → "sim" → `github_orchestration.pr_url`

## Veredito

**APROVADO PARA MERGE** — 5/7 critérios verificados estaticamente. Critérios 3 e 5 pendentes de deploy + OPENAI_API_KEY.
