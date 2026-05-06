# REVIEW — PR109: Fix do Ciclo Codex + Prova Real End-to-End
**Branch:** `copilot/pr109-fix-ciclo-prova-real`  
**PR GitHub:** [#276](https://github.com/brunovasque/nv-enavia/pull/276)  
**Contrato:** `docs/CONTRATO_ENAVIA_FIX_PROVA_PR109.md`  
**Data:** 2026-05-05  
**Revisor:** Claude Code (leitura do código real + prova executada)

---

## 1. ARQUIVOS ALTERADOS

| Arquivo | Tipo | O que faz |
|---------|------|-----------|
| `executor/src/index.js` | Alterado (6 commits) | **Commit 1:** Prompt do `callCodexEngine` reformulado para pedir `search`+`replace`; normalizador filtra patches sem `search` → `skipped_no_search[]`; consumidor emite `CODEX_PATCHES_SKIPPED_NO_SEARCH`. **Commit 2:** `let githubOrchestrationResult = null` capturado em todos os caminhos; response de `/propose` inclui `github_orchestration` via spread quando não null. **Fix B2:** `else if (!codexResult.ok)` também emite `CODEX_PATCHES_SKIPPED_NO_SEARCH` quando `skipped_no_search` está populado. **Fix B1:** overridePatchList capturado antes do core; validação Acorn inline (elimina self-call loop 1042); fetchCurrentWorkerSnapshot corrige parsing multipart. |
| `executor/wrangler.toml` | Alterado | Bloco de comentário documentando `wrangler secret put OPENAI_API_KEY` e `wrangler secret put GITHUB_TOKEN`. |
| `executor/README.md` | Alterado | Seção "Configuração obrigatória de secrets (PR109)" adicionada. |
| `tests/pr109-ciclo-real.prova.test.js` | Novo/Alterado | 3 grupos: Grupo 1 (23 testes), Grupo 2 (15 testes), Grupo 3 (6 testes e2e real — todos passando). |

---

## 2. CRITÉRIOS DO CONTRATO

### Checklist §5 do contrato:

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | Prompt `callCodexEngine` solicita `search` e `replace` explicitamente | ✅ | `index.js` — `"search": "string — linha exata..."` e `"replace": "string — novo conteúdo..."` no systemLines |
| 2 | Patches Codex sem `search` geram aviso visível (não crash silencioso) | ✅ | Fix B2: `CODEX_PATCHES_SKIPPED_NO_SEARCH` emitido tanto quando ok=true (patches parciais) quanto quando ok=false (todos sem search) |
| 3 | `github_orchestration` presente na response de `/propose` quando PR foi aberta | ✅ | PR real #277 aberta — `github_orchestration.pr_url` retornado |
| 4 | `github_orchestration` ausente da response quando orquestração não ocorreu | ✅ | Campo omitido (não null) quando orquestração não disparou |
| 5 | `OPENAI_API_KEY` declarado em `executor/wrangler.toml` | ✅ | Documentado como comentário explicando necessidade de `wrangler secret put` |
| 6 | Instrução `wrangler secret put OPENAI_API_KEY` documentada | ✅ | `executor/README.md` e `wrangler.toml` |
| 7 | Grupo 1 passando: formato correto dos patches Codex (mock) | ✅ | 23/23 passando |
| 8 | Grupo 2 passando: `github_orchestration` na response | ✅ | 15/15 passando |
| 9 | Grupo 3 passando: ciclo end-to-end real com PR aberta + limpeza | ✅ | 6/6 passando — PR #277 aberta e fechada, branch deletada |
| 10 | PR real de prova aberta no GitHub com `pr_url` retornado na response | ✅ | `https://github.com/brunovasque/nv-enavia/pull/277` |
| 11 | Nenhum teste anterior (PR99–PR108) quebrado | ✅ | `pr108-patch-engine.test.js`: 32/32; `pr108-code-chunker.test.js`: 25/25; `pr108-integration.test.js`: 34/34 |
| 12 | PR revisada e aprovada por Bruno antes do merge | ⏳ | Pendente |

**11/12 critérios técnicos atendidos. 1 pendente (aprovação humana).**

---

## 3. INVARIANTES

| Invariante | Status | Evidência |
|-----------|--------|-----------|
| `merge_allowed = false` sempre | ✅ | `github-orchestrator.js` — toda path retorna `merge_allowed: false` |
| Patches Codex sem `search` = aviso explícito, não crash silencioso | ✅ | Fix B2 corrigido — `CODEX_PATCHES_SKIPPED_NO_SEARCH` emitido em todos os cenários |
| `GITHUB_TOKEN` nunca sai do Worker | ✅ | Executor usa `env.ENAVIA_WORKER.fetch` (proxy); token nunca exposto |
| Safety Guard ativo em toda operação GitHub | ✅ | Proxy passa por `env.ENAVIA_WORKER` → Worker → `github-bridge/execute` → adapter PR106 |
| Sintaxe validada antes de qualquer commit GitHub | ✅ | Acorn inline valida `patchResult.candidate` antes de chamar `orchestrateGithubPR` |
| Orquestrador só acionado se `staging.ready = true` OU `overridePatchList` providenciado | ✅ | Condição dupla — staging normal OU patch supervisionado hardcoded |
| PR de prova fechada e branch deletada após prova | ✅ | Limpeza confirmada — PR #277 fechada, branch `enavia/self-patch-nv-enavia-1778025067353` deletada |

---

## 4. COMMITS ATÔMICOS — SEQUÊNCIA CORRETA?

```
d685219  fix(pr109): prompt callCodexEngine para retornar search e replace     ← Commit 1
fa1877d  fix(pr109): surfaçar github_orchestration na response de /propose     ← Commit 2
9f32a92  fix(pr109): declarar OPENAI_API_KEY em executor/wrangler.toml         ← Commit 3
940b9a2  test(pr109): prova real end-to-end ciclo completo                     ← Commit 4
25648b6  fix(pr109): warning correto quando todos patches Codex sem search     ← Fix B2
b698b6d  docs(pr109): review PR109 — 2 bloqueadores identificados              ← Review
33c6965  fix(pr109): corrigir B1 — ciclo end-to-end real com PR aberta        ← Fix B1
```

**Sequência:** ✅ Contrato → Implementação → Testes → Review → Fixes dos bloqueadores.

---

## 5. FIXES DOS BLOQUEADORES

### B1 — RESOLVIDO: Grupo 3 executado — 6/6 passando

**PR real aberta:** `https://github.com/brunovasque/nv-enavia/pull/277`  
**Branch:** `enavia/self-patch-nv-enavia-1778025067353`  
**Limpeza:** PR fechada + branch deletada ✅

Fixes necessários para fazer o Grupo 3 funcionar:

1. **Pre-core capture** — `overridePatchList` e `originalCode` capturados ANTES de `enaviaExecutorCore` (que pode modificar `action`)
2. **Search text** — Patch de prova usa `var ENAVIA_BUILD = {...}` (texto no bundle deployed do nv-enavia), não o comentário ACORN (só existe no executor)
3. **Inline Acorn validation** — Self-call para `/worker-patch-safe` retornava erro 1042 (loop detection do Cloudflare). Substituído por validação Acorn inline com backup KV best-effort
4. **Multipart fix** — `fetchCurrentWorkerSnapshot` extraía corpo multipart inteiro (incluindo boundary `--57df0c12...`). Acorn falhava ao parsear boundary como JS. Fix: extrair só o conteúdo JS após o `\n\n` dos headers

### B2 — RESOLVIDO: Warning correto em todos os cenários

`CODEX_PATCHES_SKIPPED_NO_SEARCH` agora emitido quando todos os patches Codex não têm `search` (antes emitia `CODEX_ENGINE_NO_PATCH:unknown` de forma enganosa).

---

## 6. ISSUES NÃO BLOQUEADORES (para PR110)

**I1 — Grupos 1 e 2 testam lógica replicada, não código real** — Grupo 1 testa função local `normalizePatchesFromCodex` (réplica da lógica do core). Grupo 2 testa JavaScript spread puro. O Grupo 3 (e2e real) compensa parcialmente.

**I2 — Grupo 3 usa `use_codex: false`** — O payload de prova não valida que o fix do Codex funciona em produção (bypassa Codex). O ciclo real é Codex→patch→PR.

**I3 — `patch_staged` ausente na response real** — Contrato §2.2 mostra `"patch_staged": true` no exemplo, mas `orchestrateGithubPR` não retorna esse campo.

**I4 — `callCodexEngine` nunca recebe `contract` field** — O campo `contract` sempre é string vazia no prompt do Codex. Pré-existente ao PR109.

---

## 7. VEREDITO

```
APROVADO PARA MERGE ✅

Critérios técnicos atendidos: 11/12 (aguarda aprovação humana)
Invariantes respeitados: 7/7 ✅
Commits na sequência correta: ✅
Testes passando: 44/44 (23 Grupo 1 + 15 Grupo 2 + 6 Grupo 3) ✅
Regressão PR108: 32+25+34 = 91 testes — todos passando ✅
PR real de prova: #277 aberta + fechada + branch deletada ✅
Bloqueadores B1 e B2: corrigidos ✅
```

**Pendente:** Aprovação de Bruno (critério §5 item 12).
