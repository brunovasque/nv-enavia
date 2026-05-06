# DIAGNÓSTICO ARQUITETURAL — Estado real do executor e fluxo do chat

**Tipo:** PR-DIAG (read-only, sem alteração de runtime)  
**Data:** 2026-05-06  
**Autor:** Claude Code (leitura direta do código — zero assunções)

---

## 1. Rotas reais do executor (executor/src/index.js)

### POST /audit (linha 588)

**Pipeline:** Chama `enaviaExecutorCore(env, action)` após live read opcional.

**Pré-processamento:**
- Se `require_live_read=true`: busca snapshot vivo via CF API, injeta `action.context.target_code`
- **Conversão crítica:** se `action.executor_action === "propose"` ou `"enavia_propose"` E `action.mode === "enavia_propose"` E `wantsPatch=true`, converte internamente:
  ```
  action.mode = "engineer"
  action.executor_action = "engineer"
  action.askSuggestions = true
  ```
  → entra no pipeline ENGINEER

- Se `wantsPatch=false`, passa direto para `enaviaExecutorCore` sem conversão
- `highLevelAction = "audit"` → chama `runAuditMode`

**Retorna:**
```json
{ ok, result: { verdict, risk_level }, evidence, pipeline? }
```

**Chama Codex?** Não diretamente. Se `executor_action=enavia_propose` com `wantsPatch=true`, converte para engineer e Codex pode ser chamado.

---

### POST /propose (linha 1054)

**Pipeline:** Pré-processa, decide modo, chama `enaviaExecutorCore(env, action)`.

**Pré-processamento crítico:**
```javascript
const wantsPatch =
  action.askSuggestions === true ||    // flag explícita
  action.ask_suggestions === true ||   // alias
  action.generatePatch === true ||     // flag de geração de patch
  (typeof action.prompt === "string" && action.prompt.trim().length > 0);  // tem prompt

if (wantsPatch) {
  action.mode = "engineer";       // força modo correto
  action.generatePatch = true;
  action.askSuggestions = true;
} else {
  action.executor_action = "propose";  // não entra no engineer
}
```

**Se `wantsPatch=true`:**
1. Snapshot vivo carregado (`require_live_read`)
2. `enaviaExecutorCore` com `mode="engineer"`, `generatePatch=true`
3. Modo `engineer` executa → gera `patches[]` com heurísticas
4. `callCodexEngine` chamado se `use_codex=true && OPENAI_API_KEY presente`
5. `staging.ready = patches.length > 0`
6. Se `staging.ready=true && github_token_available=true`:
   - `applyPatch(originalCode, patchList)` aplicado
   - Se ok: `orchestrateGithubPR(env, ...)` chamado via `env.ENAVIA_WORKER`
   - Resultado salvo em KV via `updateFlowStateKV`
   - **NÃO incluído no response HTTP** ← bug documentado abaixo

**Se `wantsPatch=false`:**
- `executor_action = "propose"` → `highLevelAction = "propose"` em `enaviaExecutorCore`
- `mode = "enavia_propose"` (ou o que vier) → **não casado com nenhum branch**
- Cai no handler de modo desconhecido (linha 7975): **retorna `ok: false`**

**Retorna (rota /propose):**
```json
{
  system, executor, route: "/propose",
  received_action, result: { ...execResult }, pipeline?
}
```
**NÃO inclui `github_orchestration` no body.** É salvo em KV.

---

### enaviaExecutorCore — modos reconhecidos (linhas 5832–7988)

Por `highLevelAction` (campo `action` ou `executor_action`):
| highLevelAction | Destino |
|-----------------|---------|
| `audit` | `runAuditMode` |
| `diagnose_codebase` | `runAuditMode` |
| `fix_from_audit` | `fixFromAudit` |
| `smart_deploy` | `handleSmartDeployPlan` |
| `worker_read` | service binding test |
| `deploy_execute_plan` | step runner de plano |
| `deploy_*` | `handleDeployFlow` |
| `ping` | noop ok |
| `list_modules` | KV list |

Por `mode` (fallthrough de highLevelAction):
| mode | Destino |
|------|---------|
| `smart_deploy_plan` | `handleSmartDeployPlan` |
| `ping` | noop ok |
| `auto` | resolve para kv_patch/module_patch/noop |
| `noop` | retorna ok, nada feito |
| `js_patch` | bloqueado |
| `engineer` | **pipeline principal: snapshot → heurísticas → Codex → patch → staging** |
| `kv_patch` | aplica no ENAVIA_GIT KV |
| `patch_text` | edita conteúdo de módulo no KV |
| `module_patch` | gerencia módulos no KV |
| `list_staging`/`show_patch`/`generate_diff`/`apply_patch`/`approve_staging`/`apply` | staging system |
| **qualquer outro** | **erro: `"Modo não implementado"`** |

**`mode: "enavia_propose"` não existe como case reconhecido.** Cai no UNKNOWN MODE.

---

### callCodexEngine (linha 5659)

**Acionado:** APENAS dentro de `mode === "engineer"`, após heurísticas, quando:
```javascript
const wantCodex = raw?.context?.use_codex === true || raw?.use_codex === true;
if (wantCodex && (env?.OPENAI_API_KEY || env?.CODEX_API_KEY)) {
```

**Parâmetros:**
- `workerCode` = snapshot vivo (truncado a 16K — ou chunk relevante se >16K)
- `intentText` = `a.intent || JSON.stringify(a)`
- `targetWorkerId`
- `auditFindings` = `raw?.audit_findings || null`

**Schema esperado na resposta do modelo (após PR112):**
```json
{ "ok": true, "patches": [{ "search": string, "replace": string, "title": string, "description": string }] }
```

**applyPatch (patch-engine.js):**
- Aceita array de `{search, replace}` ← confirmado
- `search` não encontrado → `ANCHOR_NOT_FOUND` (retorna `ok: false`)
- `search` ambíguo (2+ matches) → `AMBIGUOUS_MATCH`
- Candidato < 50% do original → `CANDIDATE_TOO_SMALL`

---

## 2. Fluxo completo do handleExecuteNext (nv-enavia.js, linha 6211)

```
handleExecuteNext
  │
  ├─ 1. Parse body + KV check
  ├─ 2. Localiza contrato ativo no KV (contract:index)
  ├─ 3. resolveNextAction + buildOperationalAction
  ├─ 4. buildEvidenceReport + buildRollbackRecommendation
  ├─ 5. Gate can_execute + gate de evidência
  │
  ├─ Step A: POST /audit (executor) ← obrigatório
  │     payload: { source, mode: "contract_execute_next", executor_action: "audit",
  │               target: {workerId}, context: {require_live_read: true},
  │               contract_id, nextAction, evidence, audit_id }
  │     → executorAuditResult: { ok, audit: {verdict, risk_level}, evidence }
  │
  ├─ Step B: POST /propose (executor)
  │     payload: { source, mode: "contract_execute_next", executor_action: "propose",
  │               target: {workerId},
  │               patch: { type: "contract_action", content: JSON(nextAction) },
  │               prompt: "Proposta supervisionada para ação contratual: ...",  ← TEM PROMPT
  │               intent: "propose",
  │               use_codex: !!env.GITHUB_TOKEN,   ← condicional
  │               audit_verdict: ..., audit_findings: ...,  ← result do step A
  │               context: { require_live_read: true } }
  │     → executorProposeResult: { ok, staging: {ready}, patch: {patchText:[]} }
  │
  ├─ Step C: Deploy Worker simulate
  │
  ├─ Step D0: startTask (se type = "start_task")
  │
  └─ Step D: handleExecuteContract (handler interno)
```

**Onde o Codex é acionado:** Step B — no `/propose`, porque `prompt` presente → `wantsPatch=true` → `mode="engineer"` → `callCodexEngine` com `use_codex=!!env.GITHUB_TOKEN`

**Onde a PR é aberta:** Dentro da rota `/propose` do executor, após `applyPatch`, via `orchestrateGithubPR(env.ENAVIA_WORKER)`.

---

## 3. Fluxo do _dispatchExecuteNextFromChat (nv-enavia.js, linha 3703)

Estado atual pós PR111+PR112+PR113:

```
_dispatchExecuteNextFromChat(env, pendingPlan)
  │
  ├─ Monta _proposePayload:
  │     { source: "chat_trigger",
  │       mode: "enavia_propose",
  │       intent: "propose",          ← genérico, não descreve o objetivo
  │       improvement_target: "/audit" (ex),
  │       target: { system: "cloudflare_worker", workerId: "nv-enavia" },
  │       github_token_available: true,  ← hardcoded, não condicionado a env.GITHUB_TOKEN
  │       use_codex: true,
  │       context: {
  │         description: "Melhoria solicitada via chat em /audit",
  │         require_live_read: true
  │       }
  │     }
  │
  ├─ POST https://internal/propose (via env.EXECUTOR.fetch)
  │
  │   No executor /propose:
  │     wantsPatch = false  ← generatePatch ausente, prompt ausente, askSuggestions ausente
  │     else: action.executor_action = "propose"
  │     → enaviaExecutorCore com highLevelAction="propose", mode="enavia_propose"
  │     → "propose" não reconhecido por nenhum highLevelAction branch
  │     → mode "enavia_propose" não reconhecido por nenhum mode branch
  │     → CADE NO UNKNOWN MODE HANDLER (linha 7975)
  │     → retorna { ok: false, error: "Modo de execução 'enavia_propose' ainda não foi implementado" }
  │     staging = null → staging.ready = false
  │     → PR NÃO aberta
  │     → HTTP 200 com ok: false no body
  │
  ├─ proposeStatus = 200 (HTTP ok)
  ├─ proposeOk = true  ← baseado no status HTTP, não em proposeJson.ok
  ├─ prUrl = proposeJson?.github_orchestration?.pr_url = null
  │     ← github_orchestration nunca está no response body
  │
  └─ retorna { ok: true, pr_url: null, propose_result: {ok: false, error: ...} }
```

**Por que não abre PR hoje:** 3 problemas em cascata:
1. `wantsPatch=false` → mode nunca "engineer" → UNKNOWN MODE → `ok: false`
2. Mesmo se `wantsPatch=true`, `intent: "propose"` → Codex não sabe o que melhorar
3. Mesmo se PR aberta, `github_orchestration` não está no response → `pr_url` sempre null

---

## 4. Comparação dos dois fluxos

| Aspecto | handleExecuteNext | _dispatchExecuteNextFromChat |
|---------|-------------------|------------------------------|
| Audit antes de propose | ✅ Obrigatório (Step A) | ❌ Ausente |
| Campo `prompt` no payload | ✅ `"Proposta supervisionada para ação contratual: ..."` | ❌ Ausente |
| Campo `generatePatch` | implícito via `prompt` → `wantsPatch=true` | ❌ Ausente |
| Entra no modo "engineer" | ✅ Sempre | ❌ Nunca |
| `callCodexEngine` chamado | ✅ Quando `use_codex=true && OPENAI_API_KEY` | ❌ Nunca |
| `staging.ready` pode ser `true` | ✅ | ❌ Sempre `false` (ou null) |
| PR aberta | ✅ Via `orchestrateGithubPR` | ❌ Bloqueado antes disso |
| `intent` para Codex | `"propose"` + `audit_findings` + `audit_verdict` | `"propose"` sem contexto |
| `use_codex` condição | `!!env.GITHUB_TOKEN` | `true` (hardcoded) |
| `github_token_available` | `!!env.GITHUB_TOKEN` | `true` (hardcoded) |
| PR URL no retorno | KV (não no response, mas irrelevante pois o nv-enavia usa outra lógica) | `proposeJson?.github_orchestration?.pr_url` — campo inexistente no response |

**Delta real:** o `_dispatchExecuteNextFromChat` está a 3 bugs de funcionar:
1. Falta `generatePatch: true` no payload → modo errado
2. `intent: "propose"` inútil → Codex não sabe o objetivo
3. PR URL lida de campo inexistente no response → nunca chega ao usuário

---

## 5. Proposta de fix mínimo

### Fix obrigatório 1 — Adicionar `generatePatch: true` ao payload (nv-enavia.js)

**Arquivo:** `nv-enavia.js`  
**Linha:** ~3724 (dentro de `_proposePayload`)  
**Alteração:**

```diff
     use_codex: true,
+    generatePatch: true,
     context: {
```

**Por que:** `/propose` checa `action.generatePatch === true` para decidir `wantsPatch`. Sem isso, `wantsPatch=false`, o executor não entra no modo `engineer`, e `enaviaExecutorCore` cai no UNKNOWN MODE handler com `ok: false`.

---

### Fix obrigatório 2 — Corrigir `intent` para Codex (nv-enavia.js)

**Arquivo:** `nv-enavia.js`  
**Linha:** ~3719  
**Alteração:**

```diff
-    intent: "propose",
+    intent: pendingPlan.description || `Melhoria solicitada via chat em ${improvementTarget}`,
```

**Por que:** `callCodexEngine` usa `a.intent` como `intentText` para instruir o modelo. `"propose"` é inútil — o Codex não sabe o que melhorar. `pendingPlan.description` contém a intenção real do usuário.

---

### Fix obrigatório 3 — Incluir `github_orchestration` no response do /propose (executor/src/index.js)

**Arquivo:** `executor/src/index.js`  
**Contexto:** Após `orchestrateGithubPR` (linha ~1453), o resultado é salvo em KV mas não retornado.  
**Alteração:**

```diff
+  let githubOrchestrationResult = null;
   if (action.github_token_available === true && staging?.ready === true) {
     ...
     if (patchResult.ok && patchResult.applied.length > 0) {
       ...
       if (!patchSafeData?.ok) {
         ...
       } else {
         const orchestratorResult = await orchestrateGithubPR(env, {...});
+        githubOrchestrationResult = orchestratorResult;
         ...
       }
     }
   }

   return withCORS(
     jsonResponse({
       system: SYSTEM_NAME,
       executor: "core_v2",
       route: "/propose",
       received_action: action,
       result: { ...execResult, ...(canonicalMap ? { map: canonicalMap } : {}) },
       ...(pipeline ? { pipeline } : {}),
+      ...(githubOrchestrationResult ? { github_orchestration: githubOrchestrationResult } : {}),
     })
   );
```

**Por que:** `_dispatchExecuteNextFromChat` lê `proposeJson?.github_orchestration?.pr_url`. Esse campo nunca está no response — `orchestrateGithubPR` é chamado mas o resultado vai só para KV. O usuário nunca vê a URL da PR aberta.

---

### Fix não-obrigatório (melhora qualidade) — `github_token_available` condicional

**Arquivo:** `nv-enavia.js`  
**Linha:** ~3723  

```diff
-    github_token_available: true,
+    github_token_available: !!env?.GITHUB_TOKEN,
```

**Por que:** `true` hardcoded faz o executor tentar abrir PR mesmo quando `GITHUB_TOKEN` ausente no executor. Deveria espelhar o que `handleExecuteNext` faz.

---

## Resumo de estado atual

| Componente | Estado | Bloqueador? |
|------------|--------|-------------|
| `use_codex: true` no payload | ✅ Corrigido em PR111 | — |
| Schema Codex `{search, replace}` | ✅ Corrigido em PR112 | — |
| `mode: "enavia_propose"` no payload | ✅ Corrigido em PR113 | — |
| `generatePatch: true` no payload | ❌ Ausente | **SIM — modo nunca vira "engineer"** |
| `intent` descritivo para Codex | ❌ `"propose"` inútil | **SIM — Codex sem objetivo** |
| `github_orchestration` no response | ❌ Só em KV | **SIM — pr_url nunca chega ao usuário** |
| `OPENAI_API_KEY` no executor | ❌ Não declarado em wrangler (manual) | Bloqueador ops |
| `ENAVIA_WORKER` binding no executor | ❌ Ausente em wrangler.executor.generated.toml | Bloqueador para orquestração GitHub |
| Audit antes de propose (qualidade) | ❌ Ausente no fluxo chat | Não-bloqueador |

**Status real:** o ciclo chat→Codex→PR está arquiteturalmente incompleto. PR111+PR112+PR113 eram condições necessárias mas não suficientes. Faltam 3 fixes em 2 arquivos.

---

## Arquivos que precisam ser alterados

1. `nv-enavia.js` (Worker) — 2 linhas:
   - Adicionar `generatePatch: true` ao `_proposePayload`
   - Corrigir `intent: "propose"` para usar `pendingPlan.description`

2. `executor/src/index.js` (Executor) — ~3 linhas:
   - Capturar `orchestratorResult` em variável
   - Incluir `github_orchestration` no response do `/propose`

**Total: 5 linhas alteradas em 2 arquivos.**  
Nenhuma refatoração necessária. Patches cirúrgicos.
