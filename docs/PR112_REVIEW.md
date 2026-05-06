# PR112 REVIEW — Corrigir formato do patch gerado pelo Codex

**Data:** 2026-05-06  
**Branch:** claude/pr112-fix-codex-patch-format  
**Contrato:** docs/CONTRATO_PR112_FIX_CODEX_PATCH_FORMAT.md  
**Tipo da PR:** PR-IMPL  
**PR anterior validada:** PR111 — mergeada ✅ (use_codex=true ativo)

---

## Critérios de aceite

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | `systemLines` do prompt não contém mais `anchor` nem `patch_text` | ✅ | `grep p\.patch_text\|p\.anchor → 0 matches` |
| 2 | `systemLines` contém `search` e `replace` no schema | ✅ | Linhas 5688-5689: `"search": string,` / `"replace": string` |
| 3 | Consumer não usa mais `p.patch_text`, `p.patchText` nem `p.anchor` | ✅ | `grep p\.patch_text\|p\.patchText\|p\.anchor → 0 matches` |
| 4 | Consumer usa `p.search` e `p.replace` | ✅ | Linhas 7265-7266: `const search = p.search \|\| ""` / `const replace = p.replace ?? ""` |
| 5 | Nenhuma outra linha alterada fora do escopo | ✅ | 2 commits, 8 linhas modificadas no total |
| 6 | PR aberta com `docs/PR112_REVIEW.md` gerado | ✅ | Este arquivo |

**Resultado: 6/6 critérios atendidos**

---

## Invariantes

| # | Invariante | Status |
|---|------------|--------|
| 1 | `merge_allowed = false` | ✅ Respeitado |
| 2 | Branch nunca é `main` ou `master` | ✅ Branch: `claude/pr112-fix-codex-patch-format` |
| 3 | Nenhuma alteração em `nv-enavia.js`, `deploy-worker/`, `schema/` | ✅ Apenas `executor/src/index.js` |
| 4 | Nenhuma alteração em `patch-engine.js` | ✅ Não tocado |
| 5 | Patch cirúrgico — sem refatoração | ✅ 2 alterações atômicas, escopo mínimo |

**Resultado: 5/5 invariantes respeitadas**

---

## Commits atômicos

1. `a43118d` — `fix(pr112): corrigir schema do prompt Codex para search/replace`
   - Arquivo: `executor/src/index.js`, linhas 5688-5689
   - Alteração: `anchor/patch_text` → `search/replace` no schema do systemLines

2. `e94f11f` — `fix(pr112): corrigir consumer de codexResult.patches para search/replace`
   - Arquivo: `executor/src/index.js`, linhas 7265-7279
   - Alteração: consumer de `p.patch_text/p.patchText/p.anchor` para `p.search/p.replace`

---

## Diff resumido

### Commit 1 — systemLines schema (linhas 5688-5689)

```diff
-      '      "anchor": { "match": string } | null,',
-      '      "patch_text": string',
+      '      "search": string,',
+      '      "replace": string',
```

### Commit 2 — consumer (linhas 7265-7279)

```diff
-        const patchText = p.patch_text || p.patchText || "";
-        if (!patchText) continue;
+        const search = p.search || "";
+        const replace = p.replace ?? "";
+        if (!search) continue;
 
         patches.push({
           target: "cloudflare_worker",
           workerId: targetWorkerId || (target && target.workerId) || null,
           title: p.title || "Patch codex",
           description: p.description || "Patch sugerido pelo motor Codex.",
-          anchor:
-            p.anchor && typeof p.anchor.match === "string"
-              ? { match: p.anchor.match }
-              : null,
-          patch_text: patchText,
-          reason:
-            p.reason ||
-            "Patch sugerido via Codex (não aplicado automaticamente).",
+          search,
+          replace,
+          reason:
+            p.reason ||
+            "Patch sugerido via Codex.",
         });
```

---

## Análise de impacto

**Corrige:** Issue I1 — incompatibilidade de formato entre `callCodexEngine` e `applyPatch`.

**Fluxo corrigido:**
```
callCodexEngine retorna { patches: [{ search, replace, title, ... }] }
    ↓
consumer lê p.search / p.replace  ← CORRIGIDO
    ↓
patches.push({ search, replace, ... })
    ↓
applyPatch recebe { search, replace } — formato esperado ✅
    ↓
staging.ready = true → github_orchestration abre PR
```

**Sem risco de regressão:** `patch-engine.js` não foi tocado. Outros usos de `anchor`/`patchText` no arquivo são de funções independentes (evidence building, patchText array, etc.) — não conflitam.

---

## Pós-merge obrigatório

```powershell
cd D:\nv-enavia\executor
npx wrangler deploy
```

**Requisito adicional:** `OPENAI_API_KEY` deve estar configurado como secret no executor:
```
wrangler secret put OPENAI_API_KEY --name enavia-executor
```
Sem a chave, `callCodexEngine` é silenciosamente ignorado (gate em linha ~7247).

---

## Veredito: APROVADO PARA MERGE
