# REVIEW — PR108: Motor de Patch + Orquestrador Self-Patch
**Branch:** `copilot/pr108-motor-patch-orquestrador`  
**PR GitHub:** [#275](https://github.com/brunovasque/nv-enavia/pull/275)  
**Contrato:** `docs/CONTRATO_ENAVIA_MOTOR_PATCH_PR108.md`  
**Data:** 2026-05-05  
**Revisor:** Claude Code (leitura do código real)

---

## 1. ARQUIVOS ALTERADOS

| Arquivo | Tipo | O que faz |
|---------|------|-----------|
| `executor/src/patch-engine.js` | Novo | `applyPatch(originalCode, patches)` — aplica patches `{anchor, search, replace}` com 7 invariantes de segurança (EMPTY_ORIGINAL, NO_PATCHES, NO_SEARCH_TEXT, ANCHOR_NOT_FOUND, AMBIGUOUS_MATCH, EMPTY_CANDIDATE, CANDIDATE_TOO_SMALL) |
| `executor/src/code-chunker.js` | Novo | `extractRelevantChunk(code, intentText, maxChars)` — extrai chunk de 16K ao redor de âncora encontrada por tokens (rotas HTTP, camelCase, UPPER_CASE, palavras longas); fallback para início do arquivo |
| `executor/src/github-orchestrator.js` | Novo | `orchestrateGithubPR(env, options)` — ciclo branch→commit→PR via `env.ENAVIA_WORKER.fetch`; para na primeira falha; `merge_allowed: false` em todo retorno |
| `executor/src/index.js` | Alterado | 3 novos imports; chunking do código antes de Codex quando `use_codex=true` e código > 16K; `auditFindings` passado ao `callCodexEngine`; bloco de orquestração GitHub após `updateFlowStateKV` |
| `nv-enavia.js` | Alterado | `_proposePayload` agora inclui `audit_verdict`, `audit_findings`, `context: { require_live_read: true }`, `use_codex: !!env.GITHUB_TOKEN` |
| `tests/pr108-patch-engine.test.js` | Novo | 32 testes de unidade para `applyPatch` |
| `tests/pr108-code-chunker.test.js` | Novo | 25 testes de unidade para `extractRelevantChunk` |
| `tests/pr108-integration.test.js` | Novo | 34 testes de integração do ciclo `applyPatch + orchestrateGithubPR` (mock do proxy) |

---

## 2. CRITÉRIOS DO CONTRATO

### Checklist §5 do contrato:

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | `executor/src/patch-engine.js` existe e exporta `applyPatch` | ✅ | `patch-engine.js:27` — `export async function` → CORRIGIDO: `export function applyPatch` (sync) |
| 2 | `applyPatch` retorna erro para anchor não encontrado | ✅ | `patch-engine.js:49` — `return { ok: false, error: 'ANCHOR_NOT_FOUND', patch_title: title }` |
| 3 | `applyPatch` retorna erro para candidato < 50% do original | ✅ | `patch-engine.js:80-87` — `if (candidate.length < originalCode.length * 0.5)` → `CANDIDATE_TOO_SMALL` |
| 4 | `executor/src/code-chunker.js` existe e exporta `extractRelevantChunk` | ✅ | `code-chunker.js:20` — `export function extractRelevantChunk` |
| 5 | `_proposePayload` inclui `audit_findings`, `require_live_read: true`, `use_codex: true` | ✅ | `nv-enavia.js:6200-6203` — todos os 4 campos presentes |
| 6 | `github_token_available` consumido no handler de `/propose` | ✅ | `index.js:1414` — `if (action.github_token_available === true && staging?.ready === true)` |
| 7 | `executor/src/github-orchestrator.js` existe e exporta `orchestrateGithubPR` | ✅ | `github-orchestrator.js:27` — `export async function orchestrateGithubPR` |
| 8 | Orquestrador só acionado quando `staging.ready = true` | ✅ | `index.js:1414` — `staging?.ready === true` é a segunda condição do `if` |
| 9 | Branch gerada com padrão `enavia/self-patch-{workerId}-{timestamp}` | ✅ | `github-orchestrator.js:59` — `` `enavia/self-patch-${safeWorkerId}-${timestamp}` `` |
| 10 | `callCodexEngine` acionado quando `use_codex: true` no payload | ✅ | `index.js:7219-7224` — `raw?.use_codex === true` dispara a chamada |
| 11 | `extractRelevantChunk` usado antes de `callCodexEngine` | ✅ | `index.js:1200-1209` (chunking em `/propose`) → Codex usa `raw?.context?.target_code` em `index.js:7227` |
| 12 | Testes de unidade `applyPatch` — mínimo 10 cenários | ✅ | 32 cenários em `tests/pr108-patch-engine.test.js` |
| 13 | Testes de unidade `extractRelevantChunk` — mínimo 5 cenários | ✅ | 25 cenários em `tests/pr108-code-chunker.test.js` |
| 14 | Testes de integração ciclo completo (mock do proxy GitHub) | ✅ | 34 cenários em `tests/pr108-integration.test.js` |
| 15 | Nenhum teste anterior (PR99–PR107) quebrado | ✅ | `pr105-cjs-esm-interop`: 32/32; `pr106-github-bridge-prova-real`: 19/19 |
| 16 | PR revisada e aprovada por Bruno antes do merge | ⏳ | Pendente |

**15/16 critérios técnicos atendidos.**

---

## 3. INVARIANTES

| Invariante | Status | Evidência |
|-----------|--------|-----------|
| `merge_allowed = false` sempre | ✅ | `github-orchestrator.js` — toda branch de retorno (pre_check, create_branch, create_commit, open_pr, sucesso) retorna `merge_allowed: false` |
| Branch de self-patch nunca pode ser `main` ou `master` | ✅ | `github-orchestrator.js:59` — pattern `enavia/self-patch-*` nunca coincide com main/master |
| Candidato vazio = bloqueio imediato antes de qualquer GitHub call | ✅ | `github-orchestrator.js:45-47` — pre_check bloqueia candidate vazio antes de qualquer proxy call |
| Candidato < 50% do original = bloqueio | ✅ | `patch-engine.js:80-87` — CANDIDATE_TOO_SMALL bloqueia antes de retornar candidato |
| GITHUB_TOKEN nunca sai do Worker — Executor usa proxy | ✅ | `github-orchestrator.js` — Executor chama `env.ENAVIA_WORKER.fetch` (proxy); nunca acessa GITHUB_TOKEN diretamente |
| Safety Guard ativo em toda operação GitHub (via proxy → Worker → adapter) | ✅ | Proxy passa por `env.ENAVIA_WORKER` → Worker → `github-bridge/execute` → adapter PR106 com Safety Guard |
| **`/worker-patch-safe` valida sintaxe antes de staging — patch inválido não vai para o GitHub** | ❌ **VIOLADO** | `index.js:1413-1443` — o código vai direto de `applyPatch` para `orchestrateGithubPR` sem chamar `/worker-patch-safe`. Candidato não é validado sintaticamente antes do commit no GitHub. |
| Orquestrador só acionado se `staging.ready = true` | ✅ | `index.js:1414` — segunda condição do `if` |
| Erro em qualquer etapa do orquestrador = para e retorna erro (sem continuar parcialmente) | ✅ | `github-orchestrator.js:92-99, 117-126, 148-158` — cada etapa tem `if (!result.ok) return {...}` |

---

## 4. COMMITS ATÔMICOS — SEQUÊNCIA CORRETA?

```
ab64d5f  feat(pr108): motor de aplicação de patch              ← Commit 1
26fd384  feat(pr108): chunking para arquivos grandes           ← Commit 2
c492b83  feat(pr108): encadeamento audit->propose no Worker    ← Commit 3
c9e3ff9  feat(pr108): orquestrador GitHub no Executor         ← Commit 4
4d2af1b  feat(pr108): consumo de github_token_available e ativação do ciclo  ← Commit 5
2290372  test(pr108): testes do motor de patch, chunker e ciclo integrado     ← Commit 6
```

**Sequência:** ✅ Exatamente na ordem definida no contrato §7.  
**Dependências respeitadas:**
- Commit 4 depende de 1 → ✅ (usa `applyPatch` do Commit 1 na lógica do orquestrador — indiretamente via Commit 5)
- Commit 5 depende de 2, 3 e 4 → ✅ (importa todos os 3 módulos novos)
- Commit 6 após Commit 5 → ✅

---

## 5. O QUE ESTÁ FALTANDO

### B1 — BLOQUEADOR: `/worker-patch-safe` ausente no ciclo de orquestração

**Contrato §2.4 (sequência obrigatória):**
```
1. applyPatch(currentCode, patches) → candidate
2. POST /worker-patch-safe { mode: "stage", workerId, current, candidate }  ← AUSENTE
3. Se staging ok: acionar orchestrateGithubPR
4. Se staging falhar: retornar erro — NÃO acionar GitHub
```

**Implementação atual (`index.js:1413-1443`):**
```javascript
const patchResult = applyPatch(originalCode, patchList);
if (patchResult.ok && patchResult.applied.length > 0) {
  // ← /worker-patch-safe NUNCA É CHAMADO
  const orchestratorResult = await orchestrateGithubPR(env, { ... });
}
```

**Impacto:** Patches sintaticamente inválidos podem ser commitados no GitHub. A invariante explícita do contrato é violada: *"/worker-patch-safe valida sintaxe antes de staging — patch inválido não vai para o GitHub"*. O endpoint `/worker-patch-safe` existe no executor (`index.js:2407`) com `mode: "stage"` que chama `/module-validate` → valida sintaxe → só então salva no KV. Este passo está completamente ausente.

---

### Issues não bloqueadores (para documentar em PR109):

**I1 — Codex patches (format: `patch_text`) são inaplicáveis por `applyPatch`**

Quando `use_codex=true` e Codex retorna patches, esses patches têm formato:
```javascript
{ title, anchor, patch_text, reason }  // Codex output (index.js:7240-7254)
```
`applyPatch` espera `{ search, replace }`. Patches sem `search` são todos skipados (`NO_SEARCH_TEXT`). Resultado: `patchResult.applied.length === 0` → orquestração não é acionada. **O ciclo end-to-end Codex→PR é silencioso** — não há erro, mas também não há PR.

Somente hardcoded patches (ex: extração de `execution_id`, que tem `search`/`replace` reais) acionariam a orquestração. Esses só existem quando o código do alvo tem linhas de `JSON.parse()`.

**I2 — `orchestratorResult` não retornado na response de `/propose`**

`index.js:1436-1440` — resultado da orquestração é salvo em KV mas **não aparece na resposta da API**. O Worker não sabe se uma PR foi aberta, qual o `pr_url`, qual o `branch`. Informação enterrada em KV sem forma de surfacear ao chamador.

**I3 — Double-fetch do código do Worker por request**

`index.js:1145` (handler `/propose`) + `index.js:6871` (dentro de `enaviaExecutorCore` engineer mode) — duas chamadas separadas à CF API para buscar o mesmo código. A variável `raw?.context?.target_code` resolve o Codex, mas o engineer mode faz seu próprio live read independentemente. Duas chamadas desnecessárias à CF API por request de `/propose`.

**I4 — `GITHUB_REPO` e `GITHUB_FILE_PATH` não configurados em `executor/wrangler.toml`**

`index.js:1423-1424` — defaults hardcoded `brunovasque/nv-enavia` / `nv-enavia.js`. Não são vars/secrets declarados no `executor/wrangler.toml`. Correto para este repo mas não configurável sem editar código.

**I5 — `OPENAI_API_KEY` não declarado em `executor/wrangler.toml`**

`executor/wrangler.toml` tem `OPENAI_CODE_MODEL = "gpt-5.2"` mas não declara `OPENAI_API_KEY` como secret. Sem esse secret, `callCodexEngine` retorna `ok: false, reason: "missing_api_key"` silenciosamente — o ciclo Codex é pulado sem aviso visível ao operador.

---

## 6. VEREDITO

```
BLOQUEADO ❌

Bloqueador: B1
Etapa: executor/src/index.js:1413-1443
Causa: chamada ao /worker-patch-safe (mode:"stage") ausente no ciclo de orquestração
Invariante violada: "/worker-patch-safe valida sintaxe antes de staging — patch inválido não vai para o GitHub"

Correção necessária:
  Após applyPatch retornar ok=true e applied.length > 0:
  1. Chamar env.ENAVIA_WORKER.fetch("POST /worker-patch-safe", { mode:"stage", workerId, current: originalCode, candidate: patchResult.candidate })
     OU chamar diretamente o endpoint interno do Executor (self-call via fetch ao próprio URL)
  2. Se staging.ok=false → retornar erro, NÃO chamar orchestrateGithubPR
  3. Se staging.ok=true → chamar orchestrateGithubPR

Issues I1-I5 documentados acima — não bloqueiam merge, devem ser resolvidos em PR109.
```

**Critérios técnicos atendidos:** 15/16  
**Invariantes respeitados:** 8/9  
**Commits na sequência correta:** ✅  
**Testes passando:** 91 novos + 51 regressão ✅  
**Bloqueador para merge:** 1 (B1)
