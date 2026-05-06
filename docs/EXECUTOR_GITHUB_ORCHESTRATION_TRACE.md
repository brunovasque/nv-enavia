# EXECUTOR — Trace completo: engineer → orchestrateGithubPR

**Arquivo:** `executor/src/index.js`  
**Data:** 2026-05-06  
**Lido de:** código real (sem assunções)

---

## Caminho completo de decisão

```
POST /propose
  └── /propose handler (linha 1054)
        ├── require_live_read → snapshot carregado em action.context.target_code
        ├── wantsPatch check (linha 1326):
        │     action.askSuggestions === true  OR
        │     action.ask_suggestions === true OR
        │     action.generatePatch === true   OR   ← GATE PRINCIPAL
        │     typeof action.prompt === "string" && prompt.trim().length > 0
        │
        │   SE wantsPatch=true:
        │     action.mode = "engineer"
        │     action.generatePatch = true
        │     action.askSuggestions = true
        │
        │   SE wantsPatch=false:
        │     action.executor_action = "propose"
        │     → enaviaExecutorCore com mode desconhecido → UNKNOWN MODE → ok:false
        │
        └── enaviaExecutorCore(env, action)  [modo "engineer"]
              └── if (mode === "engineer")  (linha 6827)
                    ├── shouldGeneratePatch = a?.generatePatch === true || raw?.generatePatch === true
                    │     (linha 6831)
                    │
                    ├── SE shouldGeneratePatch=false:
                    │     staging = { ready: false, notes: "Nenhum patch gerado automaticamente." }
                    │     patch: null
                    │     → retorna ok:true mas staging.ready=false
                    │
                    └── SE shouldGeneratePatch=true:  (linha 7019)
                          ├── patches = []  (linha 7060)
                          │
                          ├── [heurísticas de patches baseadas no snapshot]
                          │     → patches podem ser adicionados aqui (discovery, log helper, etc.)
                          │
                          ├── wantCodex check (linha 7251):
                          │     raw?.context?.use_codex === true  OR
                          │     raw?.use_codex === true           OR   ← este é o do chat
                          │     a?.context?.use_codex === true
                          │
                          │   SE wantCodex=true && (OPENAI_API_KEY || CODEX_API_KEY):
                          │     callCodexEngine(env, { workerCode, intentText, targetWorkerId, ... })
                          │     → se codexResult.ok && codexResult.patches[]:
                          │         patches.push({ search, replace, ... })
                          │     → se codexResult.ok=false:
                          │         result.warnings.push("CODEX_ENGINE_NO_PATCH:...")
                          │
                          │   SE wantCodex=false OU sem API key:
                          │     callCodexEngine não chamado (silencioso)
                          │
                          ├── ready = patches.length > 0  (linha 7307)
                          │
                          ├── SE requireAnchors=true && (!anchorProofOk || !ready):
                          │     staging = { ready: false, notes: "NO_ANCHOR_FOUND: ..." }
                          │
                          └── SENÃO:
                                staging = { ready, notes: ready ? "Patch_text gerado..." : "Nenhum patch gerado." }
                                patch = { mode: "patch_text", allowWorkerEdit: false, patchText: patches }
```

---

## Código real — guard gates antes de orchestrateGithubPR

**Localização:** `/propose` handler, logo após `enaviaExecutorCore` retornar.

```javascript
// linha 1413-1474 (executor/src/index.js, estado atual pós PR114)

// PR108: se github_token_available=true e staging.ready=true, acionar ciclo GitHub
let githubOrchestrationResult = null;
if (action.github_token_available === true && staging?.ready === true) {
  // GATE 1: staging.ready deve ser true
  //   → só é true se patches.length > 0 no modo engineer
  //   → patches só têm itens se: heurísticas encontraram âncoras válidas
  //                               OU Codex retornou patches ok

  const originalCode = action.context?.target_code_original || action.context?.target_code || null;
  const patchList = execResult?.patch?.patchText || null;

  if (originalCode && Array.isArray(patchList) && patchList.length > 0) {
    // GATE 2: originalCode deve existir (snapshot vivo carregado via require_live_read)
    // GATE 3: patchList deve ser array não-vazio (vem de execResult.patch.patchText)

    const patchResult = applyPatch(originalCode, patchList);

    if (patchResult.ok && patchResult.applied.length > 0) {
      // GATE 4: applyPatch deve retornar ok=true
      //   → falha se: search não encontrado (ANCHOR_NOT_FOUND)
      //               search ambíguo, 2+ matches (AMBIGUOUS_MATCH)
      //               candidato < 50% do original (CANDIDATE_TOO_SMALL)
      //               candidato vazio (EMPTY_CANDIDATE)
      // GATE 5: patchResult.applied.length > 0 (pelo menos 1 patch aplicado)

      const targetWorkerId = action?.target?.workerId || action?.workerId || 'unknown';
      const githubRepo = env?.GITHUB_REPO || 'brunovasque/nv-enavia';
      const githubFilePath = env?.GITHUB_FILE_PATH || 'nv-enavia.js';

      // PR108 B1: validar sintaxe via /worker-patch-safe antes de qualquer GitHub call
      let patchSafeData = null;
      try {
        const patchSafeUrl = new URL('/worker-patch-safe', request.url).toString();
        const patchSafeResp = await fetch(patchSafeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'stage',
            workerId: targetWorkerId,
            current: originalCode,
            candidate: patchResult.candidate,
          }),
        });
        patchSafeData = await patchSafeResp.json().catch(() => ({ ok: false, error: 'worker_patch_safe_parse_error' }));
      } catch (patchSafeErr) {
        patchSafeData = { ok: false, error: `worker_patch_safe_fetch_error: ${String(patchSafeErr)}` };
      }

      if (!patchSafeData?.ok) {
        // GATE 6: /worker-patch-safe deve retornar ok=true
        //   → se falhar: salva em KV { ok:false, step:'worker_patch_safe' }
        //   → githubOrchestrationResult permanece null
        //   → orchestrateGithubPR NÃO é chamada
        if (execIdForPropose) {
          await updateFlowStateKV(env, execIdForPropose, {
            github_orchestration: { ok: false, step: 'worker_patch_safe', error: patchSafeData?.error || 'STAGING_FAILED', detail: patchSafeData },
          });
        }
        // candidato invalido ou staging falhou — nao acionar GitHub

      } else {
        // ✅ TODOS OS GATES PASSADOS — orchestrateGithubPR é chamada aqui
        const orchestratorResult = await orchestrateGithubPR(env, {
          workerId: targetWorkerId,
          candidate: patchResult.candidate,
          filePath: githubFilePath,
          repo: githubRepo,
          patchTitle: execResult?.message || 'Patch automatico supervisionado',
          patchDescription: typeof execResult?.plan === 'string' ? execResult.plan : null,
          baseBranch: 'main',
        });

        githubOrchestrationResult = orchestratorResult;   // capturado para o response

        if (execIdForPropose) {
          await updateFlowStateKV(env, execIdForPropose, {
            github_orchestration: orchestratorResult,
          });
        }
      }
    }
  }
}

return withCORS(
  jsonResponse({
    system: SYSTEM_NAME,
    executor: "core_v2",
    route: "/propose",
    received_action: action,
    result: {
      ...execResult,
      ...(canonicalMap ? { map: canonicalMap } : {}),
    },
    ...(pipeline ? { pipeline } : {}),
    ...(githubOrchestrationResult ? { github_orchestration: githubOrchestrationResult } : {}),
    //                                 ↑ adicionado em PR114 — só aparece se PR foi aberta
  })
);
```

---

## Resumo dos 6 gates que devem passar para orchestrateGithubPR ser chamada

| Gate | Condição | Consequência se falhar |
|------|----------|------------------------|
| 1 | `action.github_token_available === true && staging?.ready === true` | skip silencioso, `githubOrchestrationResult = null` |
| 2 | `originalCode` existe (snapshot vivo) | skip silencioso |
| 3 | `patchList` é array não-vazio | skip silencioso |
| 4 | `applyPatch(originalCode, patchList).ok === true` | skip silencioso |
| 5 | `patchResult.applied.length > 0` | skip silencioso |
| 6 | `/worker-patch-safe` retorna `ok: true` | KV write com erro, skip, `githubOrchestrationResult = null` |

---

## O que `staging.ready` depende (origem no modo `engineer`)

```
staging.ready = true
  SE TODOS:
    ✓ shouldGeneratePatch = true          ← requer generatePatch=true no payload (adicionado em PR114)
    ✓ patches.length > 0                  ← heurísticas encontraram âncoras OU Codex retornou patches
    ✓ requireAnchors=false                ← ou requireAnchors=true E anchorProofOk=true
```

**`patches` pode ser preenchido por dois caminhos:**

1. **Heurísticas** (baseadas em análise do snapshot): procura `/__internal__/build` e padrões de `fetch()`/`.json()` no código. Só gera patches se encontrar linhas âncora concretas no snapshot.

2. **Codex** (`callCodexEngine`): chamado se `use_codex=true` (no payload) **E** `OPENAI_API_KEY` ou `CODEX_API_KEY` configurados. Retorna `{ search, replace }` — adicionados em `patches[]`.

Se **nenhum** dos dois produzir patches, `patches.length = 0` → `staging.ready = false` → Gate 1 falha → `orchestrateGithubPR` não é chamada.

---

## orchestrateGithubPR — pré-validações internas (github-orchestrator.js)

Antes de qualquer chamada GitHub, o orchestrator verifica:

```javascript
if (typeof env?.ENAVIA_WORKER?.fetch !== 'function')
  → { ok: false, error: 'ENAVIA_WORKER_BINDING_ABSENT' }
  // binding ENAVIA_WORKER ausente no wrangler do executor → PR nunca aberta

if (!workerId || !candidate || !filePath || !repo)
  → { ok: false, error: 'MISSING_REQUIRED_PARAMS' }

if (!candidate.trim())
  → { ok: false, error: 'EMPTY_CANDIDATE' }
```

**Estado atual:** `ENAVIA_WORKER` está ausente em `wrangler.executor.generated.toml` — esse é o próximo bloqueador operacional após deploy dos fixes de código.
