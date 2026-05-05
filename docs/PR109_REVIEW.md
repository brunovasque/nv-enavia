# REVIEW — PR109: Fix do Ciclo Codex + Prova Real End-to-End
**Branch:** `copilot/pr109-fix-ciclo-prova-real`  
**PR GitHub:** [#276](https://github.com/brunovasque/nv-enavia/pull/276)  
**Contrato:** `docs/CONTRATO_ENAVIA_FIX_PROVA_PR109.md`  
**Data:** 2026-05-05  
**Revisor:** Claude Code (leitura do código real)

---

## 1. ARQUIVOS ALTERADOS

| Arquivo | Tipo | O que faz |
|---------|------|-----------|
| `executor/src/index.js` | Alterado (2 commits) | **Commit 1:** Prompt do `callCodexEngine` reformulado para pedir `search`+`replace`; normalizador filtra patches sem `search` → `skipped_no_search[]`; consumidor emite `CODEX_PATCHES_SKIPPED_NO_SEARCH` quando `codexResult.ok=true` e há skips. **Commit 2:** `let githubOrchestrationResult = null` capturado em todos os caminhos do bloco GitHub; response de `/propose` inclui `github_orchestration` via spread quando não null. |
| `executor/wrangler.toml` | Alterado | Bloco de comentário documentando `wrangler secret put OPENAI_API_KEY` e `wrangler secret put GITHUB_TOKEN` como ação manual obrigatória. |
| `executor/README.md` | Alterado | Seção "Configuração obrigatória de secrets (PR109)" adicionada com comandos explícitos e explicação de impacto. |
| `tests/pr109-ciclo-real.prova.test.js` | Novo | 3 grupos de teste: Grupo 1 (normalização Codex, 23 testes), Grupo 2 (github_orchestration na response, 15 testes), Grupo 3 (e2e real opt-in, skipped por padrão). |

---

## 2. CRITÉRIOS DO CONTRATO

### Checklist §5 do contrato:

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | Prompt `callCodexEngine` solicita `search` e `replace` explicitamente | ✅ | `index.js:5694-5695` — `"search": "string — linha exata..."` e `"replace": "string — novo conteúdo..."` no systemLines |
| 2 | Patches Codex sem `search` geram aviso visível (não crash silencioso) | ⚠️ PARCIAL | Aviso existe, mas é o aviso errado. Ver **BUG B2** abaixo. |
| 3 | `github_orchestration` presente na response de `/propose` quando PR foi aberta | ✅ | `index.js:1489` — `...(githubOrchestrationResult !== null ? { github_orchestration: githubOrchestrationResult } : {})` |
| 4 | `github_orchestration` ausente da response quando orquestração não ocorreu | ✅ | `index.js:1489` — campo omitido (não incluído) quando `null` |
| 5 | `OPENAI_API_KEY` declarado em `executor/wrangler.toml` | ⚠️ PARCIAL | Documentado como comentário (`wrangler.toml:56`), não como entrada TOML formal. Cloudflare não lê comentários — é apenas documentação. Funcionalmente correto (secrets são gerenciados via CLI), mas o critério diz "declarar" não "comentar". |
| 6 | Instrução `wrangler secret put OPENAI_API_KEY` documentada | ✅ | `executor/README.md:99` e `wrangler.toml:56` — instrução clara |
| 7 | Grupo 1 passando: formato correto dos patches Codex (mock) | ⚠️ PARCIAL | 23/23 passando, mas os testes testam uma **réplica local** (`normalizePatchesFromCodex`) no arquivo de teste — não o `callCodexEngine` real de `executor/src/index.js`. Se o código real divergir da réplica, os testes continuam passando. |
| 8 | Grupo 2 passando: `github_orchestration` na response | ⚠️ PARCIAL | 15/15 passando, mas os testes simulam spreading de objetos JavaScript puro — não exercitam o handler `/propose` real. Testam que `...(null ? {x} : {})` omite `x`, que é comportamento nativo do JS. |
| 9 | Grupo 3 passando: ciclo end-to-end real com PR aberta + limpeza | ❌ | **BLOQUEADOR B1:** Grupo 3 completamente skipped quando `ENAVIA_EXECUTOR_URL` ou `GITHUB_TOKEN` ausentes. Os 5 testes retornam `skip()` sem executar. O critério §5 lista isso como exigência sem marcação de opt-in. |
| 10 | PR real de prova aberta no GitHub com `pr_url` retornado na response | ❌ | **BLOQUEADOR B1:** Nunca foi executado. Depende do Grupo 3 rodando. |
| 11 | Nenhum teste anterior (PR99–PR108) quebrado | ✅ | `pr108-patch-engine.test.js`: 32/32; `pr108-code-chunker.test.js`: 25/25; `pr108-integration.test.js`: 34/34 |
| 12 | PR revisada e aprovada por Bruno antes do merge | ⏳ | Pendente |

**10/12 critérios técnicos atendidos (com ressalvas). 2 bloqueadores.**

---

## 3. INVARIANTES

| Invariante | Status | Evidência |
|-----------|--------|-----------|
| `merge_allowed = false` sempre | ✅ | `github-orchestrator.js:40,43,46,95-99,119-126,150-158,162` — toda path retorna `merge_allowed: false` |
| Patches Codex sem `search` = aviso explícito, não crash silencioso | ⚠️ BUG B2 | Aviso existe mas é o errado. Ver análise abaixo. |
| `GITHUB_TOKEN` nunca sai do Worker | ✅ | `github-orchestrator.js` — Executor chama `env.ENAVIA_WORKER.fetch` (proxy); nenhum acesso direto ao token |
| Safety Guard ativo em toda operação GitHub | ✅ | Proxy passa por `env.ENAVIA_WORKER` → Worker → `github-bridge/execute` → adapter PR106 |
| `/worker-patch-safe` valida sintaxe antes de qualquer commit | ✅ | `index.js:1427-1444` — self-call antes de `orchestrateGithubPR` |
| Orquestrador só acionado se `staging.ready = true` | ✅ | `index.js:1415` — segunda condição do `if` |
| PR de prova fechada e branch deletada após prova (limpeza obrigatória) | ⚠️ NÃO PROVADO | A limpeza existe no código do Grupo 3 (`pr109-ciclo-real.prova.test.js:479-525`), mas como o Grupo 3 nunca foi executado, a limpeza nunca foi testada em prática. |

---

## 4. COMMITS ATÔMICOS — SEQUÊNCIA CORRETA?

```
d685219  fix(pr109): prompt callCodexEngine para retornar search e replace     ← Commit 1
fa1877d  fix(pr109): surfaçar github_orchestration na response de /propose     ← Commit 2
9f32a92  fix(pr109): declarar OPENAI_API_KEY em executor/wrangler.toml         ← Commit 3
940b9a2  test(pr109): prova real end-to-end ciclo completo                     ← Commit 4
```

**Sequência:** ✅ Exatamente na ordem definida no contrato §7.  
**Independência de 1, 2, 3:** ✅ Commits 1, 2 e 3 são independentes entre si.  
**Commit 4 após 1, 2 e 3:** ✅ Testes após os fixes.

---

## 5. O QUE ESTÁ FALTANDO

### B1 — BLOQUEADOR: Grupo 3 nunca executado

O critério §5 lista explicitamente:
- `- [ ] Grupo 3 passando: ciclo end-to-end real com PR aberta + limpeza`
- `- [ ] PR real de prova aberta no GitHub com pr_url retornado na response`

Ambos são checkboxes na lista de critérios de conclusão — sem marcação de "opt-in" ou "quando possível".

O que acontece na prática: `runGrupo3()` verifica `process.env.ENAVIA_EXECUTOR_URL` e `process.env.GITHUB_TOKEN`. Se ausentes, retorna com 5 `skip()` imediatamente. Nunca foi executado.

A mitigação do §6 ("Prova cai para patches hardcoded — documentar comportamento esperado") existe no código do payload de prova, mas o teste em si não cai para hardcoded — **ele simplesmente sai**. O fallback para patches hardcoded mencionado no §6 é o payload que SERIA usado quando rodado, mas isso não substitui executar o teste.

---

### B2 — BUG: Warning errado quando TODOS patches Codex são sem `search`

**Cenário:** Codex retorna `[{title: 'X', patch_text: 'blah'}]` (nenhum com `search`).

**Fluxo real:**
1. `callCodexEngine` normaliza: `search = null` para todos → `skippedNoSearch = ['X']` → `normalized = []` → retorna `{ ok: false, patches: [], skipped_no_search: ['X'] }`
2. Em `enaviaExecutorCore` linha 7275: `if (codexResult.ok && ...)` — **NÃO entra** (`ok = false`)
3. Linha 7301: `else if (!codexResult.ok)` — **ENTRA** → `reason = codexResult.reason || "unknown"` → `reason = "unknown"` (o campo `reason` não é setado no retorno de normalização com todos patches skippados)
4. Warning emitido: `CODEX_ENGINE_NO_PATCH:unknown` — aparece como falha do Codex, não como formato errado

**O warning `CODEX_PATCHES_SKIPPED_NO_SEARCH` só é emitido** quando `codexResult.ok === true` — ou seja, quando ALGUNS patches têm `search` e outros não. Quando NENHUM tem `search`, o warning informativo é perdido.

O aviso existe mas é enganoso: `CODEX_ENGINE_NO_PATCH:unknown` parece que o Codex falhou (ausência de chave, erro HTTP, JSON inválido) quando na verdade retornou patches no formato legado.

Corrigir: no branch `else if (!codexResult.ok)`, também checar e emitir `CODEX_PATCHES_SKIPPED_NO_SEARCH` se `skipped_no_search` estiver populado.

---

### Issues não bloqueadores (para PR110):

**I1 — Grupos 1 e 2 testam lógica replicada, não código real**

Grupo 1 testa `normalizePatchesFromCodex` — uma função definida DENTRO do arquivo de teste (linhas 89–120), que replica a lógica do normalizador em `callCodexEngine`. O código real nunca é importado ou chamado. Se `callCodexEngine` em `index.js` tiver um bug diferente da réplica, os 23 testes passam sem detectá-lo.

Grupo 2 testa JavaScript spread puro: `...(null ? {x} : {})` não inclui `x` — isso é garantia do runtime JS, não do handler. O handler real de `/propose` nunca é exercitado.

**I2 — Grupo 3 usa `use_codex: false` no payload de prova**

O payload do Grupo 3 tem `use_codex: false`, usando patches hardcoded em vez do Codex. Quando o Grupo 3 for rodado, não vai validar que o fix do Codex (I1 do diagnóstico) funciona em produção. O ciclo real é Codex→patch→PR; o payload de prova bypassa o Codex.

**I3 — `patch_staged` ausente na response real**

O contrato §2.2 mostra `"patch_staged": true` no exemplo de response. O `orchestrateGithubPR` retorna `{ ok, merge_allowed, branch, pr_number, pr_url, commit_sha }` — sem `patch_staged`. O campo não existe na implementação. Inconsistência menor com o exemplo do contrato.

**I4 — `callCodexEngine` nunca recebe o `contract` field**

A chamada de `callCodexEngine` em `enaviaExecutorCore` (linha 7267) não passa `contract`. Dentro de `callCodexEngine`, `const contract = String(p.contract || "").slice(0, 8000)` sempre é string vazia. O bloco "CONTRATO / CONTEXTO TÉCNICO:" nunca é incluído no prompt do Codex. Pré-existente ao PR109, mas relevante para qualidade das sugestões.

---

## 6. VEREDITO

```
BLOQUEADO ❌

Bloqueador B1: Grupo 3 não executado
  tests/pr109-ciclo-real.prova.test.js — runGrupo3() retorna com skip() quando 
  ENAVIA_EXECUTOR_URL ou GITHUB_TOKEN ausentes.
  2 critérios §5 não atendidos:
    - "Grupo 3 passando: ciclo end-to-end real com PR aberta + limpeza"
    - "PR real de prova aberta no GitHub com pr_url retornado na response"
  Ação: executar Grupo 3 com secrets configurados OU o contrato deve ser 
  explicitamente aditado para aceitar o estado atual como atendido.

Bloqueador B2: Warning errado quando todos patches Codex são sem search
  index.js:7275-7303 — codexResult.ok=false quando todos patches não têm search.
  Entra no branch else if (!codexResult.ok) → emite CODEX_ENGINE_NO_PATCH:unknown.
  CODEX_PATCHES_SKIPPED_NO_SEARCH nunca emitido nesse cenário (linha 7277 não 
  é alcançada porque está dentro do if (codexResult.ok)).
  Ação: no branch else if, adicionar verificação de skipped_no_search.
```

**Critérios técnicos atendidos:** 8/12 (com ressalvas nos parciais)  
**Invariantes respeitados:** 5/7 (2 com ressalvas)  
**Commits na sequência correta:** ✅  
**Testes passando:** 38 (Grupos 1+2) + 91 regressão PR108 ✅  
**Bloqueadores para merge:** 2 (B1 e B2)
