# DIAG_FETCHSOURCE — Diagnóstico: _fetchWorkerSource inconsistente

**Data:** 2026-05-07  
**Branch:** `diag/pr128-fetchsource-inconsistency`  
**Tipo:** PR-DIAG (read-only — zero alterações de runtime)  
**Sintoma:** `snapshot_chars` alterna entre `374087` (GitHub source) e `796366` (CF bundle) em requests diferentes para o mesmo endpoint

---

## 1. Mapa do fluxo atual

```
POST /propose (requireLiveRead=true)
  │
  ├─ 1. fetchCurrentWorkerSnapshot (CF API)  ← sempre roda
  │      → snap.code = CF bundle (~796366 chars, esbuild-compilado)
  │      → action.context.target_code = snap.code
  │      → action.context.target_code_original = snap.code
  │
  ├─ 2. _fetchWorkerSource(GitHub first, CF fallback)  ← PR125
  │      → try GitHub API (Accept: application/vnd.github.v3.raw)
  │        SE ok: retorna { code: ghSource, source: "github" }
  │        SE falha: tenta CF API
  │          SE ok: retorna { code: cfBundle, source: "cloudflare_api" }
  │          SE falha: retorna null
  │
  │      CONDIÇÃO de override (linha 1204):
  │        if (_ghResult?.code && _ghResult.source === "github")
  │          → target_code_original = GitHub source (374087 chars)
  │          → target_code = GitHub source
  │        ELSE:
  │          → target_code_original PERMANECE como CF bundle ← INCONSISTÊNCIA
  │
  ├─ 3. Chunking (se use_codex=true)
  │      → _codeForChunking = target_code_original (GitHub ou CF bundle)
  │      → target_code = chunk de 16k de target_code_original
  │
  └─ 4. enaviaExecutorCore (engineer mode)
         → lê CF API novamente de forma independente (workerCode = CF bundle)
         → callCodexEngine: workerCode = raw.context.target_code || workerCode
```

---

## 2. Root cause da inconsistência

### Bug 1 — Silent catch na chamada GitHub (linha 1202–1215)

```js
try {
  const _ghResult = await _fetchWorkerSource(env, targetWorkerId, ...);
  if (_ghResult?.code && _ghResult.source === "github") {
    action.context.target_code_original = _ghResult.code;  // override ✅
    ...
  }
  // SE _ghResult.source !== "github": NÃO há override → CF bundle permanece
} catch (_gh_err) {}  // ← SILENCIA QUALQUER ERRO sem log
```

**Quando GitHub falha**, o catch é acionado silenciosamente OU `_ghResult.source !== "github"`,
e `target_code_original` PERMANECE como o CF bundle do step 1. Não há log, não há warning,
não há campo na resposta indicando o motivo da falha.

**Razões prováveis de falha do GitHub:**
1. `GITHUB_TOKEN` ausente ou expirado (unauthenticated: 60 req/h)
2. Secondary rate limit do GitHub (abuse detection em bursts)
3. Timeout de rede (sem timeout explícito no fetch)
4. Resposta GitHub não-ok (403, 404, 5xx)

### Bug 2 — _fetchWorkerSource está DENTRO do try do CF API (linha 1147)

A estrutura aninhada é:

```
try {  ← linha 1147 (CF API outer try)
  snap = fetchCurrentWorkerSnapshot(CF API)
  ...
  try {  ← linha 1202 (GitHub inner try)
    _ghResult = _fetchWorkerSource(...)
    ...
  } catch (_gh_err) {}
  
} catch (err) {  ← linha 1324 — retorna 422 se CF API falhar
  return 422 live_read_failed
}
```

Consequência: se o CF API falhar (linha 1148 lança), o código salta direto para o catch
de linha 1324 — **GitHub nunca é tentado como alternativa**.

Isso é um problema de ordem incorreta de tentativa. O GitHub deveria ser tentado primeiro,
e o CF API deveria ser o fallback — mas hoje o oposto acontece.

### Bug 3 — Chamada CF API duplicada quando GitHub falha

Quando `_fetchWorkerSource` é chamado e GitHub falha, internamente a função tenta o CF API:

```js
// _fetchWorkerSource (linha 5657-5667)
try {
  const cfResp = await fetch(CF API);  // ← 2ª chamada CF API
  if (cfResp.ok) {
    return { code: bundle, source: "cloudflare_api" };
  }
} catch (_) {}
```

O `/propose` já fez uma chamada CF API na linha 1148 (`fetchCurrentWorkerSnapshot`).
Quando GitHub falha, `_fetchWorkerSource` faz uma **SEGUNDA chamada CF API idêntica**
sem usar o resultado — os dados já estão em `snap.code`.

Resultado: 2 subrequests CF API por request quando GitHub não está disponível.

---

## 3. Impacto da inconsistência

```
GitHub SUCESSO (snapshot_chars: 374087):
  target_code_original = GitHub source (legível, nomes originais)
  → Codex recebe chunk de código legível
  → Codex gera search com nomes reais (runEnaviaSelfAudit, etc.)
  → applyPatch procura no GitHub source → match esperado
  → /worker-patch-safe recebe "current" = GitHub source ✅

GitHub FALHA (snapshot_chars: 796366):
  target_code_original = CF bundle (esbuild-compilado, nomes manglados)
  → Codex recebe chunk de código compilado
  → Codex gera search com código esbuild (nomes diferentes ou inexistentes)
  → applyPatch procura no CF bundle → match imprevisível
  → /worker-patch-safe recebe "current" = CF bundle ❌ (muito maior, código manglado)
```

### Campo "current" no /worker-patch-safe (linha 1466)

```js
const originalCode = action.context?.target_code_original || null;
// ...
body: JSON.stringify({
  current: originalCode,        // ← GitHub source OU CF bundle (inconsistente)
  candidate: patchResult.candidate,
}),
```

`originalCode` (= `target_code_original`) é usado tanto para `applyPatch` (linha 1441)
quanto para o campo `current` enviado ao `/worker-patch-safe`. A inconsistência propaga:
quando CF bundle → `/worker-patch-safe` recebe 796366 chars de código esbuild.

---

## 4. Bug secundário — canonical map usa snap.code (CF bundle), nunca GitHub source

```js
// linha 1232-1233
try {
  const code = String(snap?.code || "");  // ← snap.code = CF bundle (linha 1148)
  // extrai routes, env_keys, invariants...
```

Mesmo quando GitHub override tem sucesso (`target_code_original` = GitHub source),
o canonical map (routes, env_keys, invariants) continua sendo extraído de `snap.code`
(CF bundle esbuild-compilado). As rotas extraídas do bundle podem não corresponder
às rotas do source legível.

---

## 5. Bug terciário — engineer mode lê CF API independentemente

```js
// enaviaExecutorCore → engineer mode (linha 7031-7038)
const snap = await fetchCurrentWorkerSnapshot({ accountId, apiToken, scriptName });
workerCode = String(snap?.code || "");  // ← sempre CF bundle (796366)

// linha 7054
context_summary.snapshot_chars = snapshot_chars;  // ← sempre 796366
```

O engineer mode ignora completamente o `raw.context.target_code_original` (que pode ser
GitHub source) e lê o CF API de forma independente. O campo `context_summary.snapshot_chars`
na resposta do engineer mode sempre mostra `796366`, independente de o GitHub ter funcionado
no /propose requireLiveRead.

---

## 6. Evidências — grep no código

```
_fetchWorkerSource chamada em /propose requireLiveRead:
  linha 1203: _fetchWorkerSource(env, targetWorkerId, action.target?.repo || null)

_fetchWorkerSource NÃO chamada em /audit requireLiveRead:
  linha 636-740: somente fetchCurrentWorkerSnapshot (CF API)

_fetchWorkerSource NÃO chamada em runAuditMode (linha 4280-4295):
  somente fetchCurrentWorkerSnapshot (CF API)

_fetchWorkerSource NÃO chamada no engineer mode de enaviaExecutorCore (linha 7031):
  somente fetchCurrentWorkerSnapshot (CF API)

target_code_original → applyPatch:
  linha 1437: const originalCode = action.context?.target_code_original || null

target_code_original → /worker-patch-safe:
  linha 1466: current: originalCode

GITHUB_TOKEN no wrangler.executor.generated.toml: NÃO PRESENTE
GITHUB_TOKEN como wrangler secret: CONFIRMADO (npx wrangler secret list)
```

---

## 7. Conclusão — root cause e árvore de falha

```
REQUEST → POST /propose (require_live_read=true)
  │
  ├─ [1] CF API fetch (SEMPRE) → snap.code = CF bundle
  │       target_code_original = snap.code  ← default ruim
  │
  ├─ [2] GitHub fetch (tenta) → _fetchWorkerSource
  │   │
  │   ├─ SUCESSO: target_code_original = GitHub source (374087) ✅
  │   │   Codex recebe código legível → patch correto
  │   │
  │   └─ FALHA SILENCIOSA: target_code_original permanece CF bundle (796366) ❌
  │       Motivo desconhecido (sem log)
  │       Codex recebe código esbuild → patch imprevisível
  │       /worker-patch-safe recebe bundle como "current"
  │
  └─ [3] engineer mode: IGNORA o resultado do step 2
          Lê CF API de novo (3ª chamada CF API potencial)
          context_summary.snapshot_chars = 796366 SEMPRE
```

---

## 8. Solução proposta (para PR128)

### Correção mínima e cirúrgica (Executor-only)

**Arquivo:** `executor/src/index.js` — bloco requireLiveRead do `/propose` (linhas 1200-1215)

**Mudança 1 — Log explícito no catch do GitHub:**

```js
// ANTES (linha 1215):
} catch (_gh_err) {}

// DEPOIS:
} catch (_gh_err) {
  console.warn('[_fetchWorkerSource] GitHub fetch falhou, usando CF bundle:',
    _gh_err?.message || String(_gh_err));
}
```

**Mudança 2 — Log do resultado da tentativa GitHub (visible em context_proof):**

```js
if (_ghResult?.code && _ghResult.source === "github") {
  action.context.target_code_original = _ghResult.code;
  action.context.target_code = _ghResult.code;
  action.context.target_code_source = "github";
  action.context_proof.snapshot_chars = _ghResult.code.length;
  action.context_proof.source = "github";
} else {
  // Log de fallback para diagnóstico
  action.context_proof.github_fetch_result =
    _ghResult?.source || 'null';
  console.warn('[_fetchWorkerSource] fallback para CF bundle, source:',
    _ghResult?.source || 'null');
}
```

**Mudança 3 — Evitar chamada CF duplicada em _fetchWorkerSource:**

Em vez de chamar CF API de novo dentro de `_fetchWorkerSource` (linha 5657-5667),
a função pode receber o `snap.code` já disponível como parâmetro de fallback:

```js
// ANTES:
async function _fetchWorkerSource(env, targetWorkerId, targetRepo)

// DEPOIS:
async function _fetchWorkerSource(env, targetWorkerId, targetRepo, cfFallbackCode = null)

// Dentro do fallback CF:
if (cfFallbackCode) {
  return { code: cfFallbackCode, source: "cloudflare_api_cached", repo: null, file: null };
}
// ... só então tenta CF API se não tiver fallback
```

**Mudança 4 — Reordenar: GitHub ANTES do CF API (fix arquitetural):**

```js
// DEPOIS (ordem correta):
// 1. Tentar GitHub primeiro (source legível)
let target_code_original = null;
let target_code_source = "unknown";
try {
  const _ghResult = await _fetchWorkerSource(env, targetWorkerId, ...);
  if (_ghResult?.source === "github") {
    target_code_original = _ghResult.code;
    target_code_source = "github";
  }
} catch (_gh_err) {
  console.warn('[requireLiveRead] GitHub failed:', _gh_err?.message);
}

// 2. CF API: sempre para metadata (etag, last_modified), fallback para code
const snap = await fetchCurrentWorkerSnapshot({ accountId, apiToken, scriptName });
if (!target_code_original) {
  // GitHub falhou → usar CF bundle
  target_code_original = snap.code;
  target_code_source = "cf_api_live_read";
}
// metadata sempre vem do CF
action.context_proof = {
  snapshot_fingerprint: `fnv1a32:${fnv1a32(snap.code)}`,
  snapshot_chars: target_code_original.length,
  ...snap metadata
  source: target_code_source,
};
action.context.target_code_original = target_code_original;
action.context.target_code = target_code_original;
action.context.target_code_source = target_code_source;
```

---

## 9. Scope da correção

| Arquivo | Mudança |
|---------|---------|
| `executor/src/index.js` | requireLiveRead /propose: reorder + logging |
| `executor/src/index.js` | `_fetchWorkerSource`: aceitar cfFallbackCode opcional |

**Fora do escopo desta PR:**
- engineer mode independente (Bug 3) — requer refatoração maior
- canonical map usando snap.code (Bug secundário) — baixo impacto

---

## 10. Próximo passo seguro

PR128 — PR-IMPL — Executor-only:
1. Reordenar GitHub antes de CF API no requireLiveRead do /propose
2. Adicionar log explícito de falha do GitHub (visível via wrangler tail)
3. Adicionar `target_code_source` no context_proof retornado ao cliente

Branch sugerido: `fix/pr128-fetchsource-github-first`
