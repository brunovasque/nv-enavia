# PR116 — Review Canônico
# Fix: /worker-patch-safe usa env.ENAVIA_WORKER.fetch em vez de self-fetch via URL inválida

**Data:** 2026-05-06  
**Branch:** `claude/pr116-fix-worker-patch-safe-binding`  
**Tipo:** PR-IMPL (Executor-only)  
**Contrato:** `docs/CONTRATO_PR116.md`  
**PR anterior validada:** PR115 ✅ (mergeada — `claude/pr115-fix-apply-patch-original-code`, PR #283)

---

## Critérios de aceite — análise linha a linha

### Critério 1 — env.ENAVIA_WORKER.fetch usado em vez de fetch(patchSafeUrl, ...)

**ANTES (linhas 1441-1442):**
```javascript
const patchSafeUrl = new URL('/worker-patch-safe', request.url).toString();
const patchSafeResp = await fetch(patchSafeUrl, {
```

**DEPOIS (linha 1441):**
```javascript
const patchSafeResp = await env.ENAVIA_WORKER.fetch('https://nv-enavia.internal/worker-patch-safe', {
```

**Análise:** `env.ENAVIA_WORKER.fetch` é a chamada via Service Binding — roteada diretamente pelo
runtime Cloudflare para `nv-enavia` sem passar por DNS ou rede pública. O endpoint
`/worker-patch-safe` existe em `nv-enavia.js` (linha 2813) e processa o body
`{ mode, workerId, current, candidate }` corretamente.

**Resultado: ✅ PASS**

---

### Critério 2 — Linha `const patchSafeUrl = ...` removida

A linha `const patchSafeUrl = new URL('/worker-patch-safe', request.url).toString();` foi
removida. Não existe mais referência a `patchSafeUrl` no código.

**Resultado: ✅ PASS**

---

### Critério 3 — Teste direto ao executor /propose retorna github_orchestration com pr_url real

Não realizável estaticamente — requer deploy com `ENAVIA_WORKER` binding configurado +
`OPENAI_API_KEY` ativo. O bloqueio de Gate 6 (URL inválida) foi eliminado por esta PR.

**Resultado: ⚠️ PENDENTE (requer deploy pós-merge)**

---

### Critério 4 — patch_safe_error ausente no response (gate passou)

Com `env.ENAVIA_WORKER.fetch` resolvendo corretamente, `/worker-patch-safe` retornará `ok: true`
quando o candidato for sintaticamente válido. `patchSafeError` só será preenchido se o candidato
for genuinamente inválido — o que é o comportamento correto.

**Resultado: ✅ PASS (lógico — depende de deploy para confirmar)**

---

### Critério 5 — merge_allowed = false mantido (invariante absoluto)

`orchestrateGithubPR` não faz merge — apenas abre PR via GitHub API. Esta PR não toca
`orchestrateGithubPR` nem `merge_allowed`. Invariante preservado.

**Resultado: ✅ PASS**

---

### Critério 6 — Nenhuma outra lógica alterada

**Mudança única:**
- Linhas 1441-1442 → linha 1441: remoção de `const patchSafeUrl` + substituição de `fetch(patchSafeUrl, ...)` por `env.ENAVIA_WORKER.fetch(...)`

O corpo do request (method, headers, JSON body) permanece idêntico. O handler `.catch()` do
`patchSafeResp.json()` permanece idêntico. O bloco `try/catch` externo permanece idêntico.
Nenhuma outra linha do executor alterada.

**Resultado: ✅ PASS**

---

## Resumo dos critérios

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | env.ENAVIA_WORKER.fetch usado | ✅ |
| 2 | Linha patchSafeUrl removida | ✅ |
| 3 | github_orchestration com pr_url no response | ⚠️ Requer deploy |
| 4 | patch_safe_error ausente (gate passou) | ✅ (lógico) |
| 5 | merge_allowed=false mantido | ✅ |
| 6 | Nenhuma outra lógica alterada | ✅ |

**5/6 critérios verificados estaticamente. Critério 3 pendente de deploy.**

---

## Commits

| # | Hash | Mensagem |
|---|------|---------|
| 1 | `ac0934a` | `fix(executor): worker-patch-safe usa env.ENAVIA_WORKER.fetch em vez de self-fetch inválido` |

## Arquivos alterados

- `executor/src/index.js` — 1 linha adicionada, 2 removidas

## Invariantes verificados

| Invariante | Verificação |
|------------|-------------|
| merge_allowed=false | ✅ orchestrateGithubPR não faz merge |
| Executor-only | ✅ nv-enavia.js não alterado |
| Patch cirúrgico | ✅ 2 linhas substituídas por 1 no mesmo bloco try |
| Sem refatoração estética | ✅ apenas mudança necessária |

## Bloqueios restantes pós-merge

1. **ENAVIA_WORKER binding** deve ser declarado em `wrangler.executor.generated.toml`:
   ```toml
   [[services]]
   binding = "ENAVIA_WORKER"
   service = "nv-enavia"
   ```
   Sem isso, `env.ENAVIA_WORKER` é `undefined` → `TypeError: Cannot read properties of undefined` em runtime.

2. **OPENAI_API_KEY** ausente no executor → Codex não roda → `patches[] = []` → `staging.ready = false` → Gate 1 falha antes de chegar ao Gate 6.

3. Deploy de Worker e Executor após merge desta PR.

## Cadeia completa de fixes (PR111→PR116)

| PR | Fix | Estado |
|----|-----|--------|
| PR111 | `use_codex: false` → `true` | Mergeada ✅ |
| PR112 | Schema Codex `{search, replace}` | Mergeada ✅ |
| PR113 | `mode: chat_execute_next` → `enavia_propose` | Mergeada ✅ |
| PR114 | `generatePatch: true` + `intent` + `github_orchestration` no response | Mergeada ✅ |
| PR115 | `applyPatch` usa `target_code_original` + diagnóstico | Mergeada ✅ |
| PR116 | `worker-patch-safe` via `env.ENAVIA_WORKER.fetch` | Esta PR |

## Veredito

**APROVADO PARA MERGE** — 5/6 critérios estáticos verificados. Critério 3 (E2E) pendente de deploy e configuração de binding + secret.
