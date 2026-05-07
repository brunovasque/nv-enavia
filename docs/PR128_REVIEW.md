# PR128 — Review Canônico
# Fix: GitHub source propagado para engineer mode + log de fallback + reorder GitHub-first

**Data:** 2026-05-07  
**Branch:** `fix/pr128-fetchsource-github-first`  
**Tipo:** PR-IMPL (Executor-only)  
**Contrato:** `docs/CONTRATO_PR128.md`  
**PR anterior validada:** PR127 ✅ (mergeada — `fix/pr127-codex-one-patch-unique-search`, PR #295)  
**Diagnóstico:** `docs/DIAG_FETCHSOURCE.md` — 3 bugs identificados

---

## Contexto

Diagnóstico identificou 3 bugs:

1. **Silent catch (linha 1215)**: quando GitHub falha, `target_code_original` permanece como CF bundle sem log
2. **Engineer mode ignora GitHub source**: fazia fetch CF API independentemente, sempre mostrando `snapshot_chars: 796366`
3. **CF API dupla**: `_fetchWorkerSource` fazia 2ª chamada CF API quando GitHub falhava (dados já em `snap.code`)

---

## Deploy

**Versão:** `b2019017-31c8-4280-9762-9dba268d15c1`  
**Comando:** `npx wrangler deploy --config wrangler.executor.generated.toml`  
**Resultado:** ✅ Deployed (414.97 KiB)

---

## Critérios de aceite — análise

### Critério 1 — `cfFallbackCode` na assinatura de `_fetchWorkerSource`

```
5632: async function _fetchWorkerSource(env, targetWorkerId, targetRepo, cfFallbackCode = null) {
5658:   if (cfFallbackCode) {
5659:     return { code: cfFallbackCode, source: "cloudflare_api_cached", repo: null, file: null };
```

**Resultado: ✅ PASS**

---

### Critério 2 — `[PR128] GitHub fallback` no bloco requireLiveRead

```
1220: console.warn("[PR128] GitHub fallback para CF bundle, source:", _ghResult?.source || "null");
1225: console.warn("[PR128] GitHub fetch erro:", _gh_err?.message || String(_gh_err));
```

**Resultado: ✅ PASS**

---

### Critério 3 — `_injectedCode = raw?.context?.target_code_original` no engineer mode

```
7048: const _injectedCode = raw?.context?.target_code_original || null;
7050: if (_injectedCode) {
7051:   workerCode = _injectedCode;
```

**Resultado: ✅ PASS**

---

### Critério 4 — `POST /propose` → `context_proof.source = "github"`

**Teste executado:**
```
POST https://enavia-executor.brunovasque.workers.dev/propose
{
  "use_codex": true,
  "generatePatch": true,
  "intent": "melhora o log de erro do /audit",
  "target": { "workerId": "nv-enavia" },
  "context": { "require_live_read": true }
}
```

**Resultado:** `context_proof.source: "github"` ✅  
Sem `github_fetch_result` na resposta (campo ausente = GitHub teve sucesso, não entrou no else/catch)

**Resultado: ✅ PASS**

---

### Critério 5 — `context_proof.snapshot_chars` = ~374087

**Resultado:** `context_proof.snapshot_chars: 374087` ✅  
`context_proof.github_file: "nv-enavia.js"` ✅

**Resultado: ✅ PASS**

---

### Critério 6 — `context_summary.snapshot_chars` no result = ~374087

**Antes de PR128:** engineer mode sempre mostrava `context_summary.snapshot_chars: 796366`  
(fazia fetch CF API independentemente, ignorando `target_code_original`)

**Após PR128:** `context_summary.snapshot_chars: 374087` ✅  
O engineer mode agora usa `_injectedCode = raw.context.target_code_original` (GitHub source)  
em vez de chamar CF API novamente.

**Resultado: ✅ PASS — melhoria significativa**

---

### Critério 7 — `apply_patch_error` ausente

**Resultado:** `apply_patch_error: null` ✅  
`warnings: []` ✅  
`result.ok: true` ✅

**Resultado: ✅ PASS**

---

### Critério 8 — E2E: chat → "melhora o log de erro do /audit" → pr_url não null

Não verificável sem teste E2E completo. Depende do ciclo chat → aprovação → github.

**Resultado: ⚠️ PENDENTE (requer teste E2E via chat)**

---

### Critério 9 — `merge_allowed=false` intocado

Nenhuma alteração em `orchestrateGithubPR`, `merge_allowed` ou pontos de decisão de merge.

**Resultado: ✅ PASS**

---

## Resumo dos critérios

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | `cfFallbackCode` na assinatura de `_fetchWorkerSource` | ✅ |
| 2 | `[PR128] GitHub fallback` no requireLiveRead | ✅ |
| 3 | `_injectedCode = raw?.context?.target_code_original` no engineer mode | ✅ |
| 4 | `context_proof.source = "github"` | ✅ |
| 5 | `context_proof.snapshot_chars` = ~374087 | ✅ |
| 6 | `context_summary.snapshot_chars` = ~374087 (engineer mode) | ✅ |
| 7 | `apply_patch_error` ausente | ✅ |
| 8 | E2E: pr_url não null | ⚠️ Pendente |
| 9 | `merge_allowed=false` intocado | ✅ |

**8/9 verificados. Critério 8 pendente de E2E.**

---

## Commits

| # | Hash | Mensagem |
|---|------|---------|
| 1 | `6ddbfd5` | `fix(pr128): _fetchWorkerSource aceita cfFallbackCode — evita CF API dupla` |
| 2 | `8f622ed` | `fix(pr128): requireLiveRead GitHub-first com log explícito de fallback` |
| 3 | `e22efa3` | `fix(pr128): engineer mode usa target_code_original injetado em vez de nova chamada CF API` |
| 4 | `(este commit)` | `docs(pr128): PR128_REVIEW.md com prova dos critérios e resultado de deploy` |

---

## Arquivos alterados

- `executor/src/index.js` — 3 pontos cirúrgicos:
  - `_fetchWorkerSource`: assinatura + fallback `cfFallbackCode` (linhas 5632, 5658-5660)
  - requireLiveRead: `_fetchWorkerSource(... snap.code)` + else/catch com `console.warn` (linhas 1200-1226)
  - engineer mode: `_injectedCode` check + `snap?.etag` safe access (linhas 7046-7092)

---

## Diff resumo

### _fetchWorkerSource (assinatura + fallback)

```diff
-async function _fetchWorkerSource(env, targetWorkerId, targetRepo) {
+async function _fetchWorkerSource(env, targetWorkerId, targetRepo, cfFallbackCode = null) {
 
   // GitHub fetch...
 
+  // PR128: usar snap.code já disponível se passado como parâmetro (evita CF API dupla)
+  if (cfFallbackCode) {
+    return { code: cfFallbackCode, source: "cloudflare_api_cached", repo: null, file: null };
+  }
+
   // Fallback: CF API (bundle compilado — só se não tiver snap.code disponível)
   try { ... }
```

### requireLiveRead (GitHub override com log)

```diff
-      // PR125: tentar GitHub como fonte primária
-      try {
-        const _ghResult = await _fetchWorkerSource(env, targetWorkerId, action.target?.repo || null);
+      // PR128: GitHub-first com snap.code como fallback (sem CF API dupla)
+      try {
+        const _ghResult = await _fetchWorkerSource(
+          env, targetWorkerId, action.target?.repo || null, snap.code
+        );
         if (_ghResult?.code && _ghResult.source === "github") {
           // override ✅
+        } else {
+          action.context_proof.github_fetch_result = _ghResult?.source || "null";
+          action.context_proof.source = "cloudflare_api";
+          console.warn("[PR128] GitHub fallback para CF bundle, source:", ...);
         }
-      } catch (_gh_err) {}
+      } catch (_gh_err) {
+        action.context_proof.github_fetch_result = "error";
+        action.context_proof.source = "cloudflare_api";
+        console.warn("[PR128] GitHub fetch erro:", _gh_err?.message || String(_gh_err));
+      }
```

### engineer mode (usa target_code_original injetado)

```diff
-          // ✅ caminho canônico: snapshot live
-          const snap = await fetchCurrentWorkerSnapshot({ accountId, apiToken, scriptName });
-          workerCode = String(snap?.code || "");
-          if (!workerCode.trim()) { throw new Error("Snapshot vazio"); }
+          // PR128: usar target_code_original se disponível (pode ser GitHub source)
+          const _injectedCode = raw?.context?.target_code_original || null;
+          let snap = null;
+          if (_injectedCode) {
+            workerCode = _injectedCode;
+          } else {
+            snap = await fetchCurrentWorkerSnapshot({ accountId, apiToken, scriptName });
+            workerCode = String(snap?.code || "");
+          }
+          if (!workerCode.trim()) { throw new Error("Snapshot vazio"); }
 
           const context_proof_local = {
-            cf_etag: snap.etag,
-            cf_last_modified: snap.last_modified,
-            fetched_at_ms: snap.fetched_at_ms,
+            cf_etag: snap?.etag || null,
+            cf_last_modified: snap?.last_modified || null,
+            fetched_at_ms: snap?.fetched_at_ms || null,
           };
```

---

## Resultado do teste pós-deploy

```
POST /propose + generatePatch:true + use_codex:true + require_live_read:true
→ context_proof.source: "github" ✅
→ context_proof.snapshot_chars: 374087 ✅  (antes: 374087 apenas quando GitHub ok)
→ context_summary.snapshot_chars: 374087 ✅  (antes: SEMPRE 796366)
→ context_proof.github_file: "nv-enavia.js" ✅
→ apply_patch_error: null ✅
→ warnings: [] ✅
→ result.ok: true ✅
```

---

## Impacto quantificado

| Métrica | Antes PR128 | Depois PR128 |
|---------|-------------|--------------|
| CF API calls por request (GitHub ok) | 2 (1 /propose + 1 engineer) | 1 (apenas /propose) |
| CF API calls por request (GitHub falha) | 3 (snap + _fetchWorkerSource fallback + engineer) | 2 (snap + engineer) |
| `context_summary.snapshot_chars` | 796366 (sempre CF bundle) | 374087 (GitHub source) |
| Visibilidade de falha GitHub | Nenhuma (catch silencioso) | `console.warn` + `context_proof.github_fetch_result` |

---

## Invariantes verificados

| Invariante | Verificação |
|------------|-------------|
| `merge_allowed=false` | ✅ não tocado |
| Executor-only | ✅ nv-enavia.js não alterado |
| Patch cirúrgico | ✅ 3 pontos cirúrgicos em executor/src/index.js |
| Sem refatoração estética | ✅ apenas mudanças necessárias |

---

## Veredito

**APROVADO PARA MERGE** — 8/9 critérios verificados. Critério 8 (E2E) pendente de teste manual.
