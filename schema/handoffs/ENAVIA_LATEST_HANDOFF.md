# ENAVIA — Latest Handoff

**Data:** 2026-05-06
**De:** PR121 — prompt Codex search ≤120 chars ✅ (branch: fix/pr121-codex-prompt-search-short)
**Para:** Deploy Worker + Executor pós-merge → OPENAI_API_KEY → teste E2E ciclo completo

## Handoff atual — PR121 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

2 commits na branch `fix/pr121-codex-prompt-search-short`:

1. **fix: systemLines search ≤120 chars** — `executor/src/index.js` linhas 5748-5761:
   - ANTES: `"search": string` sem restrição → Codex gerava bloco de ~1094 chars
   - DEPOIS: instrução explícita "máximo 120 chars, linha única, inequívoca, UMA SÓ VEZ"
   - Adicionada instrução CRÍTICO antes do "sem markdown"

2. **docs: PR121_REVIEW.md** — 4/7 critérios, APROVADO

### Estado do pipeline após PR121 — todos os bloqueios de código resolvidos

| Etapa | Fix | PR |
|-------|-----|-----|
| use_codex: true | ✅ | PR111 |
| Schema Codex {search, replace} | ✅ | PR112 |
| mode: enavia_propose | ✅ | PR113 |
| generatePatch: true + github_orchestration | ✅ | PR114 |
| applyPatch usa target_code_original (790k) | ✅ | PR115 |
| validateWorkerCode internalizada | ✅ | PR118 |
| action: edit-worker no dispatch | ✅ | PR119 |
| Parser callCodexEngine lê search/replace | ✅ | PR120 |
| Prompt Codex: search ≤120 chars, linha única | ✅ | PR121 |

### Único desbloqueador restante após merge

`OPENAI_API_KEY` — sem ele o Codex não é chamado, `patches=[]`, `staging.ready=false`.

```powershell
wrangler secret put OPENAI_API_KEY --name enavia-executor
cd D:\nv-enavia && npx wrangler deploy       # Worker
cd D:\nv-enavia\executor && npx wrangler deploy  # Executor
```

### Teste E2E após deploy

```
Bruno: "melhora o log de erro do /audit"
Enavia: "Entendi. Posso auditar e abrir uma PR em /audit. Confirma?"
Bruno: "sim"
→ verificar github_orchestration.pr_url no response do /propose
```

---

## Handoff anterior — PR120 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

2 commits na branch `fix/pr120-codex-parser-search-replace`:

1. **fix: parser callCodexEngine** — `executor/src/index.js` loop de normalização (linha ~5848):
   - ANTES: `rawPatch.patch_text || rawPatch.patchText` → sempre vazio → patch descartado
   - DEPOIS: `rawPatch.search || rawPatch.patch_text || rawPatch.patchText` → lê campo correto
   - `replace: rawPatch.replace || ""` adicionado
   - Objeto normalizado agora inclui `search`, `replace`, `patch_text` (retrocompat), `raw`

2. **docs: PR120_REVIEW.md** — 5/7 critérios, APROVADO

### Estado dos gates e pipeline após PR120

| Etapa | Condição | Estado |
|-------|----------|--------|
| Codex retorna {search, replace} | System prompt correto | ✅ PR112 |
| Parser lê search/replace | rawPatch.search | ✅ PR120 |
| patches[] não-vazio | normalized.length > 0 | ✅ (se OPENAI_API_KEY) |
| staging.ready = true | patches.length > 0 | ✅ (se OPENAI_API_KEY) |
| applyPatch recebe target_code_original | 790k snapshot | ✅ PR115 |
| worker-patch-safe inline | validateWorkerCode() | ✅ PR118 |
| action edit-worker no dispatch | _proposePayload | ✅ PR119 |

### Único bloqueador operacional restante

`OPENAI_API_KEY` ausente no executor → Codex não é chamado → `patches=[]` → ciclo não avança.

### Pendências após merge da PR120

1. Merge da PR #288 por Bruno ← GATE
2. `wrangler secret put OPENAI_API_KEY --name enavia-executor` ← DESBLOQUEADOR PRINCIPAL
3. `cd D:\nv-enavia && npx wrangler deploy`
4. `cd D:\nv-enavia\executor && npx wrangler deploy`
5. Teste: `POST /propose` com `use_codex=true` → `warnings` sem `CODEX_ENGINE_NO_PATCH`
6. Teste E2E: chat → "melhora o log de erro do /audit" → "sim" → `github_orchestration.pr_url`

---

## Handoff anterior — PR119 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

3 commits na branch `fix/pr119-action-edit-worker-dispatch`:

1. **fix: action edit-worker** — `nv-enavia.js` linha 3719:
   - `action: "edit-worker"` adicionado ao `_proposePayload`
   - Sem este campo o executor retornava `403 Invalid action: undefined`

2. **fix: validateWorkerCode em edit-worker** — `executor/src/index.js` bloco `if (action === "edit-worker")`:
   - `fetch(request.url.replace("/engineer-core", "/module-validate"), ...)` → `await validateWorkerCode(workerContent)`
   - Elimina error 1042 do Cloudflare (loop detection) neste handler

3. **docs: PR119_REVIEW.md** — 5/7 critérios, APROVADO

### Estado dos gates após PR119

| Gate | Condição | Estado esperado pós-deploy |
|------|----------|---------------------------|
| 1 | staging.ready=true | Requer OPENAI_API_KEY |
| 2 | originalCode existe | ✅ (PR115) |
| 3 | patchList não-vazio | Requer OPENAI_API_KEY |
| 4 | applyPatch.ok=true | ✅ (PR115) |
| 5 | patchResult.applied>0 | ✅ (PR115) |
| 6 | worker-patch-safe ok=true | ✅ (PR118) |
| 7 | action válida no executor | ✅ (PR119) |

### Pendências após merge da PR119

1. Merge da PR #287 por Bruno ← GATE
2. `wrangler secret put OPENAI_API_KEY --name enavia-executor`
3. `cd D:\nv-enavia && npx wrangler deploy` (Worker)
4. `cd D:\nv-enavia\executor && npx wrangler deploy` (Executor)
5. Teste E2E: chat → "melhora o log de erro do /audit" → "sim" → verificar `github_orchestration.pr_url`

---

## Handoff anterior — PR118 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

3 commits na branch `fix/pr118-worker-patch-safe-internal-validate`:

1. **feat: validateWorkerCode()** — `executor/src/index.js` antes do MÓDULO 9:
   - Função pura que replica a lógica de `/module-validate`
   - Validação acorn (module → fallback script), heurística de delimitadores, detecção de protectedVars
   - Mesma interface de retorno que o handler `/module-validate`

2. **fix: substituição do self-call** — `executor/src/index.js` linha ~2552:
   - ANTES: `fetch(request.url.replace("/worker-patch-safe", "/module-validate"), ...)`
   - DEPOIS: `await validateWorkerCode(candidate)`
   - Elimina o error 1042 (Cloudflare loop detection)

3. **docs: PR118_REVIEW.md** — 6/7 critérios, APROVADO

### Pendências após merge da PR118

1. Merge da PR #286 por Bruno ← GATE
2. `wrangler secret put OPENAI_API_KEY --name enavia-executor`
3. `cd D:\nv-enavia && npx wrangler deploy` (Worker)
4. `cd D:\nv-enavia\executor && npx wrangler deploy` (Executor)
5. Teste: `POST /worker-patch-safe` com candidate válido → `ok:true` sem error 1042
6. Teste ciclo completo: chat → "melhora o /audit" → "sim" → PR aberta

### Estado dos gates após PR118

| Gate | Condição | Estado esperado pós-deploy |
|------|----------|---------------------------|
| 1 | staging.ready=true | Requer OPENAI_API_KEY |
| 2 | originalCode existe | ✅ (PR115) |
| 3 | patchList não-vazio | Requer OPENAI_API_KEY |
| 4 | applyPatch.ok=true | ✅ (PR115) |
| 5 | patchResult.applied.length>0 | ✅ (PR115) |
| 6 | worker-patch-safe ok=true | ✅ (PR118 — sem error 1042) |

---

## Handoff anterior — PR117 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

2 commits na branch `claude/pr117-fix-worker-patch-safe-self-url`:

1. **fix: URL pública do executor** — `executor/src/index.js` linha 1441:
   - ANTES (PR116): `env.ENAVIA_WORKER.fetch('https://nv-enavia.internal/worker-patch-safe', ...)`
   - DEPOIS: `fetch('https://enavia-executor.brunovasque.workers.dev/worker-patch-safe', ...)`
   - Causa raiz: `/worker-patch-safe` existe no executor, não em `nv-enavia.js`. A chamada via `env.ENAVIA_WORKER` chegaria ao worker errado (404).

2. **docs: PR117_REVIEW.md** — 5/6 critérios, APROVADO

### Cadeia completa de fixes (PR111→PR117)

| PR | Fix | Estado |
|----|-----|--------|
| PR111 | `use_codex: false` → `true` | Mergeada ✅ |
| PR112 | Schema Codex `{search, replace}` | Mergeada ✅ |
| PR113 | `mode: chat_execute_next` → `enavia_propose` | Mergeada ✅ |
| PR114 | `generatePatch: true` + `intent` + `github_orchestration` | Mergeada ✅ |
| PR115 | `applyPatch` usa `target_code_original` + diagnóstico | Mergeada ✅ |
| PR116 | `worker-patch-safe` via `env.ENAVIA_WORKER.fetch` (intermediário) | Mergeada ✅ |
| PR117 | `worker-patch-safe` via URL pública do executor (fix definitivo) | Aguarda merge |

### Pendências após merge da PR117

1. Merge da PR #285 por Bruno ← GATE
2. `wrangler secret put OPENAI_API_KEY --name enavia-executor`
3. `cd D:\nv-enavia && npx wrangler deploy` (Worker)
4. `cd D:\nv-enavia\executor && npx wrangler deploy` (Executor)
5. Teste E2E real: "melhora o log de erro do /audit" → "sim" → verificar PR aberta

### Bloqueio operacional restante

| Bloqueio | Sintoma | Ação |
|----------|---------|------|
| `OPENAI_API_KEY` ausente | `patches[] = []` → `staging.ready = false` → Gate 1 falha | `wrangler secret put OPENAI_API_KEY --name enavia-executor` |

O binding `ENAVIA_WORKER` no executor já não é mais necessário para o Gate 6 (removido em PR117).

---

## Handoff anterior — PR116 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

2 commits na branch `claude/pr116-fix-worker-patch-safe-binding`:

1. **fix: env.ENAVIA_WORKER.fetch** — `executor/src/index.js` linhas 1441-1442:
   - ANTES: `const patchSafeUrl = new URL('/worker-patch-safe', request.url).toString();` + `fetch(patchSafeUrl, ...)`
   - DEPOIS: `env.ENAVIA_WORKER.fetch('https://nv-enavia.internal/worker-patch-safe', ...)`
   - Causa raiz: via Service Binding `request.url = https://internal/propose` → `patchSafeUrl = https://internal/worker-patch-safe` → URL não resolve → `worker_patch_safe_parse_error` → Gate 6 falha.

2. **docs: PR116_REVIEW.md** — 5/6 critérios, APROVADO

### Cadeia completa de fixes (PR111→PR116)

| PR | Fix | Estado |
|----|-----|--------|
| PR111 | `use_codex: false` → `true` | Mergeada ✅ |
| PR112 | Schema Codex `{search, replace}` | Mergeada ✅ |
| PR113 | `mode: chat_execute_next` → `enavia_propose` | Mergeada ✅ |
| PR114 | `generatePatch: true` + `intent` + `github_orchestration` | Mergeada ✅ |
| PR115 | `applyPatch` usa `target_code_original` + diagnóstico | Mergeada ✅ |
| PR116 | `worker-patch-safe` via `env.ENAVIA_WORKER.fetch` | Aguarda merge |

### Pendências após merge da PR116

1. Merge da PR #284 por Bruno ← GATE
2. Configurar `ENAVIA_WORKER` binding em `wrangler.executor.generated.toml`:
   ```toml
   [[services]]
   binding = "ENAVIA_WORKER"
   service = "nv-enavia"
   ```
3. `wrangler secret put OPENAI_API_KEY --name enavia-executor`
4. `cd D:\nv-enavia && npx wrangler deploy` (Worker)
5. `cd D:\nv-enavia\executor && npx wrangler deploy` (Executor)
6. Teste E2E real: Bruno digita "melhora o log de erro do /audit" → "sim" → verificar PR aberta

### Bloqueios operacionais conhecidos (após todos os code-fixes)

| Bloqueio | Sintoma | Ação |
|----------|---------|------|
| `ENAVIA_WORKER` binding ausente em `wrangler.executor.generated.toml` | `TypeError: Cannot read properties of undefined` em runtime | Adicionar `[[services]]` + redeploy |
| `OPENAI_API_KEY` ausente | `patches[] = []` → `staging.ready = false` → Gate 1 falha | `wrangler secret put OPENAI_API_KEY --name enavia-executor` |

---

## Handoff anterior — PR115 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

3 commits na branch `claude/pr115-fix-apply-patch-original-code`:

1. **fix: originalCode usa target_code_original** — `executor/src/index.js` linha 1416:
   - ANTES: `action.context?.target_code_original || action.context?.target_code || null`
   - DEPOIS: `action.context?.target_code_original || null`
   - Causa raiz: `target_code` é chunk de 16k (offset 86443). `applyPatch` falhava com `ANCHOR_NOT_FOUND`
     silenciosamente porque `async fetch(request, env, ctx) {` existe no arquivo completo mas não no chunk.

2. **feat: apply_patch_error + patch_safe_error no response** — `executor/src/index.js`:
   - `applyPatchError` capturado quando `!patchResult.ok`
   - `patchSafeError` capturado quando `!patchSafeData?.ok`
   - Ambos expostos no response HTTP como campos condicionais

3. **docs: PR115_REVIEW.md** — 6/7 critérios, APROVADO

### Cadeia completa de fixes (PR111→PR115)

| PR | Fix | Arquivo | Estado |
|----|-----|---------|--------|
| PR111 | `use_codex: false` → `true` | nv-enavia.js | Mergeada ✅ |
| PR112 | Schema Codex `{search, replace}` | executor/src/index.js | Mergeada ✅ |
| PR113 | `mode: chat_execute_next` → `enavia_propose` | nv-enavia.js | Mergeada ✅ |
| PR114 | `generatePatch: true` + `intent` + `github_orchestration` | ambos | Mergeada ✅ |
| PR115 | `applyPatch` usa `target_code_original` + diagnóstico | executor/src/index.js | Aguarda merge |

### Pendências após merge da PR115

1. Merge da PR #283 por Bruno ← GATE
2. `cd D:\nv-enavia && npx wrangler deploy` (Worker)
3. `cd D:\nv-enavia\executor && npx wrangler deploy` (Executor)
4. `wrangler secret put OPENAI_API_KEY --name enavia-executor` (sem isso Codex não roda)
5. Configurar binding `ENAVIA_WORKER` em `wrangler.executor.generated.toml` (sem isso orchestrateGithubPR retorna `ENAVIA_WORKER_BINDING_ABSENT`)
6. Teste E2E real: Bruno digita "melhora o log de erro do /audit" → "sim" → verificar PR aberta

### Bloqueios operacionais conhecidos (pós-code-fixes)

| Bloqueio | Sintoma | Ação necessária |
|----------|---------|-----------------|
| `OPENAI_API_KEY` ausente | `patches[] = []` → `staging.ready = false` → Gate 1 falha | `wrangler secret put OPENAI_API_KEY --name enavia-executor` |
| `ENAVIA_WORKER` binding ausente | `orchestrateGithubPR` → `ENAVIA_WORKER_BINDING_ABSENT` | Editar `wrangler.executor.generated.toml` + redeploy |

---



## Handoff atual — PR114 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

3 commits na branch `claude/pr114-fix-ciclo-chat-pr`:

1. **fix: generatePatch + intent** — `nv-enavia.js`:
   - `intent: "propose"` → `intent: pendingPlan.description || \`Melhoria...\``
   - Adição de `generatePatch: true,` no payload do dispatch

2. **fix: github_orchestration no response** — `executor/src/index.js`:
   - `let githubOrchestrationResult = null;` antes do bloco GitHub
   - `githubOrchestrationResult = orchestratorResult;` após `orchestrateGithubPR`
   - Spread condicional no response: `...(githubOrchestrationResult ? { github_orchestration: ... } : {})`

3. **docs: PR114_REVIEW.md** — 5/5 critérios, 4/4 invariantes

### Cadeia completa de fixes (PR111→PR114)

| PR | Fix | Arquivo | Estado |
|----|-----|---------|--------|
| PR111 | `use_codex: false` → `true` | nv-enavia.js | Mergeada ✅ |
| PR112 | Schema Codex `{search, replace}` | executor/src/index.js | Mergeada ✅ |
| PR113 | `mode: chat_execute_next` → `enavia_propose` | nv-enavia.js | Mergeada ✅ |
| PR114 | `generatePatch: true` + `intent` + `github_orchestration` | ambos | Aguarda merge |

### Pendências após merge da PR114

1. Merge da PR #282 por Bruno ← GATE
2. `cd D:\nv-enavia && npx wrangler deploy` (Worker)
3. `cd D:\nv-enavia && npx wrangler deploy --config wrangler.executor.generated.toml` (Executor)
4. `wrangler secret put OPENAI_API_KEY --name enavia-executor` (sem isso Codex não roda)
5. Verificar binding `ENAVIA_WORKER` no executor (sem isso orchestrateGithubPR falha)
6. Teste E2E real: Bruno digita "melhora o log de erro do /audit" → "sim" → verificar PR aberta

### O que ainda não foi endereçado

- I2: LLM não consultado para reply de IMPROVEMENT_REQUEST (template only)
- I4: Sem teste E2E automatizado com PR real via chat
- Binding `ENAVIA_WORKER` ausente em `wrangler.executor.generated.toml` — requer ação manual

## Handoff anterior — PR113 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

2 commits na branch `claude/pr113-fix-mode-dispatch`:

1. **fix: mode do dispatch** — `nv-enavia.js` linha 3718:
   - ANTES: `mode: "chat_execute_next"` — mode inexistente no executor
   - DEPOIS: `mode: "enavia_propose"` — mode reconhecido na linha 618 do executor
   - O executor entra agora no pipeline correto com `use_codex=true`

2. **docs: PR113_REVIEW.md** — 3/3 critérios, 4/4 invariantes atendidos

### Fixes encadeados nesta sessão (PR111 → PR112 → PR113)

| PR | Fix | Estado |
|----|-----|--------|
| PR111 | `use_codex: false` → `true` | Mergeada ✅ |
| PR112 | Formato patch: `anchor/patch_text` → `search/replace` | Mergeada ✅ |
| PR113 | Mode dispatch: `chat_execute_next` → `enavia_propose` | Aguarda merge |

### Pendências antes do próximo ciclo

1. Merge da PR #281 (PR113) por Bruno ← GATE
2. `cd D:\nv-enavia && npx wrangler deploy` ← deploy do Worker pós-merge
3. Teste manual: Bruno digita "melhora o log do /audit" → "sim" → verificar PR aberta

### O que falta após PR113

- Issues I2 (LLM não consultado para IMPROVEMENT_REQUEST) e I4 (sem teste E2E) não endereçados
- `OPENAI_API_KEY` no executor ainda requer ação manual

## Handoff anterior — PR112 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

3 commits na branch `claude/pr112-fix-codex-patch-format`:

1. **fix: schema systemLines** — `executor/src/index.js` linha 5688-5689:
   - ANTES: `"anchor": { "match": string } | null,` + `"patch_text": string`
   - DEPOIS: `"search": string,` + `"replace": string`
   - Codex agora é instruído a retornar o formato que `applyPatch` espera

2. **fix: consumer codexResult.patches** — `executor/src/index.js` linha 7265-7279:
   - ANTES: `p.patch_text || p.patchText` + `p.anchor`
   - DEPOIS: `p.search` + `p.replace`
   - Patches construídos com `{ search, replace }` — compatível com `applyPatch`

3. **docs: PR112_REVIEW.md** — 6/6 critérios, 5/5 invariantes atendidos

### Issues corrigidos nesta sessão (completo)

| Issue | Descrição | Fix |
|-------|-----------|-----|
| I3 | `use_codex: false` bloqueia Codex | PR111 ✅ mergeada |
| I1 | Formato patch incompatível | PR112 ✅ (esta PR) |
| Hotfix | "sim" ausente dos termos de aprovação | Commit `7e7ff47` em main |
| Hotfix | `target.workerId` ausente no payload | Commit `8c60368` em main |

### Issues ainda abertos

| Issue | Descrição | Status |
|-------|-----------|--------|
| I2 | LLM não consultado para IMPROVEMENT_REQUEST | Não endereçado |
| I4 | Sem teste E2E com PR real via chat | Não endereçado |
| F1 | OPENAI_API_KEY não declarado no executor | Requer ação manual |
| F3 | wrangler.executor.generated.toml commitado com IDs reais | Risco documentado |

### Pendências antes do próximo ciclo

1. Merge da PR #280 (PR112) por Bruno ← GATE
2. `cd executor && npx wrangler deploy` ← deploy pós-merge
3. `wrangler secret put OPENAI_API_KEY --name enavia-executor` ← sem isso Codex é ignorado
4. Teste manual: Bruno digita "melhora o log do /audit" → "sim" → verificar PR aberta

### Próxima sessão

Após merge e deploy: verificar ciclo E2E real. Se `staging.ready = true` e PR aberta, o loop chat→Codex→PR está funcional.

## Handoff atual — PR110 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

4 commits na branch `copilot/pr110-trigger-linguagem-natural`:

1. **feat(pr110): IMPROVEMENT_REQUEST no classificador de intent** — `schema/enavia-intent-classifier.js`:
   - Novo intent `IMPROVEMENT_REQUEST` com 24 termos gatilho
   - Extração de target: rotas /X, subsistemas (audit, chat, propose...), padrões de log/erro
   - Detecção de negação nos 40 chars anteriores ao gatilho
   - Confidence: high (2+ gatilhos + target), medium (1 gatilho + target), low (sem target)
   - Campo `target` retornado no resultado

2. **feat(pr110): pending_plan e confirmação em handleChatLLM** — `nv-enavia.js`:
   - Bloco PR110 após intent classification, antes do Skill Router
   - confidence=low ou sem target → pede clarificação (não cria pending_plan)
   - Com target → verifica contrato ativo em KV (`contract:index`)
   - Contrato ausente → explica ao usuário
   - Contrato presente → cria pending_plan com action: "execute_next", TTL=300s
   - Mensagem: "Entendi. Posso auditar e abrir uma PR em [target]. Confirma? (sim/não)"

3. **feat(pr110): _dispatchFromChat para execute_next** — `nv-enavia.js`:
   - Novo helper `_dispatchExecuteNextFromChat`: chama executor `/propose` via `env.EXECUTOR`
   - `_dispatchFromChat` desvia para o helper quando `pendingPlan.action === "execute_next"`
   - Response do chat_bridge inclui `pr_url` quando PR aberta
   - Reply: "PR aberta: [url] — revise e aprove o merge quando estiver pronto."

4. **test(pr110): classificador + fluxo chat→PR com mocks** — `tests/pr110-chat-trigger.prova.test.js`:
   - 60 cenários em 3 grupos (supera mínimo de 15 do contrato)
   - Grupo 1 (28): classificador — intent, target, negações, invariantes
   - Grupo 2 (22): pending_plan shape, TTL, mensagens
   - Grupo 3 (10): regressões PR49 inalteradas

### Estado atual

- Testes: 60/60 passando ✅
- Regressões: PR50 124/124 ✅, PR60 236/236 ✅
- PR GitHub: (ver link na PR aberta)
- Veredito: APROVADO PARA MERGE ✅

### O que PR111 pode usar (após merge da PR110)

1. `classifyEnaviaIntent` retorna `IMPROVEMENT_REQUEST` com `target`
2. pending_plan com `action: "execute_next"` funciona via chat_bridge
3. `_dispatchExecuteNextFromChat` chama executor `/propose` diretamente
4. Fluxo completo: "melhora o /audit" → confirmação → "sim" → PR aberta com `pr_url`

### Pendências antes de iniciar PR111

- Merge da PR110 aprovado por Bruno ← GATE OBRIGATÓRIO

### Próxima PR (PR111) — Deploy real supervisionado

- Objetivo: após PR aberta, deploy automático para ambiente TEST
- Bruno valida em TEST e aprova PROD
- Ciclo completo: chat → PR → deploy TEST → aprovação → PROD
