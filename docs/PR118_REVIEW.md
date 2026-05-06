# PR118 — Review Canônico
# Fix: Eliminar self-call HTTP no /worker-patch-safe — internalizar validateWorkerCode

**Data:** 2026-05-06  
**Branch:** `fix/pr118-worker-patch-safe-internal-validate`  
**Tipo:** PR-IMPL (Executor-only)  
**Contrato:** `docs/CONTRATO_PR118.md`  
**PR anterior validada:** PR117 ✅ (mergeada — `claude/pr117-fix-worker-patch-safe-self-url`, PR #285)

---

## Contexto

O handler `/worker-patch-safe` (modo `stage`) chamava `/module-validate` via self-call HTTP:
```javascript
const validateResp = await fetch(
  request.url.replace("/worker-patch-safe", "/module-validate"), ...
);
```
O Cloudflare bloqueia self-calls HTTP com error 1042 (loop detection), causando
`worker_patch_safe_parse_error` → Gate 6 falha → `orchestrateGithubPR` nunca chamada.

PR117 (URL pública) também não resolvia o problema porque o Cloudflare ainda detecta o loop.

Solução: extrair a lógica de validação em `validateWorkerCode(content)` e chamá-la diretamente.

---

## Critérios de aceite — análise

### Critério 1 — `request.url.replace.*module-validate` ausente no bloco /worker-patch-safe

**Grep no executor/src/index.js para `request.url.replace.*module-validate`:**
- Linha 2018: `/engineer-core` handler — fora do escopo
- Linha 2054: `/engineer-core` handler — fora do escopo
- Linha 2120: `/engineer-core` handler — fora do escopo
- **Zero ocorrências dentro do bloco `/worker-patch-safe`** ✅

O bloco `/worker-patch-safe` (modo stage) agora usa apenas `validateWorkerCode(candidate)`.

**Resultado: ✅ PASS**

---

### Critério 2 — Função `validateWorkerCode` existe antes do handler /worker-patch-safe

`validateWorkerCode` declarada na **linha 2441** (bloco MÓDULO 9A).  
Handler `/worker-patch-safe` inicia na **linha 2516**.  
Chamada em **linha 2552**: `const validateData = await validateWorkerCode(candidate);`

Ordem correta: declaração antes do uso. `acornParse` importado na linha 5 — disponível.

**Resultado: ✅ PASS**

---

### Critério 3 — POST /worker-patch-safe retorna `{ok:true/false}` sem error 1042

Não realizável estaticamente — requer deploy. O bloqueio estrutural (self-call HTTP) foi
eliminado. `validateWorkerCode` executa inline sem nenhuma chamada de rede.

**Resultado: ⚠️ PENDENTE (requer deploy pós-merge)**

---

### Critério 4 — Candidate JS válido → `ok:true, syntaxOK:true`

`validateWorkerCode("function test(){return 2;}")`:
- `content.length >= 10` ✅
- Nenhuma `protectedVar` com atribuição → `protectedHits = []`
- `acornParse` sem erro → `syntaxOK = true`
- Delimitadores balanceados → sem `syntaxError`
- `riskLevel = "low"`, `requiresApproval = false`
- Retorna `{ ok: true, syntaxOK: true, ... }` ✅

**Resultado: ✅ PASS (verificação estática do fluxo)**

---

### Critério 5 — Candidate JS inválido (`function test({`) → `ok:false, syntaxOK:false`

`validateWorkerCode("function test({")`:
- `content.length >= 10` ✅
- `acornParse` em modo module lança erro → tenta script → também lança erro
- `syntaxOK = false`, `syntaxError` preenchido, `notes.push(...)`
- `riskLevel = "high"`, `requiresApproval = true`
- Retorna `{ ok: false, syntaxOK: false, ... }` ✅

**Resultado: ✅ PASS (verificação estática do fluxo)**

---

### Critério 6 — merge_allowed=false intocado

Esta PR não toca `orchestrateGithubPR`, `merge_allowed` nem nenhum ponto de decisão de merge.
Invariante preservado.

**Resultado: ✅ PASS**

---

### Critério 7 — Nenhum outro handler modificado

**Mudanças desta PR:**
1. Inserção de `validateWorkerCode()` antes do bloco MÓDULO 9 (60 linhas adicionadas)
2. Substituição do self-call no handler `/worker-patch-safe` modo `stage` (14 linhas removidas, 2 adicionadas)

Os handlers `/module-validate`, `/engineer-core`, `/propose`, `/audit` e todos os demais
permanecem intocados.

**Resultado: ✅ PASS**

---

## Resumo dos critérios

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | `request.url.replace.*module-validate` removido de /worker-patch-safe | ✅ |
| 2 | `validateWorkerCode` existe antes do handler | ✅ |
| 3 | POST /worker-patch-safe sem error 1042 | ⚠️ Requer deploy |
| 4 | Candidate válido → `ok:true, syntaxOK:true` | ✅ (estático) |
| 5 | Candidate inválido → `ok:false, syntaxOK:false` | ✅ (estático) |
| 6 | merge_allowed=false intocado | ✅ |
| 7 | Nenhum outro handler modificado | ✅ |

**6/7 critérios verificados. Critério 3 pendente de deploy.**

---

## Commits

| # | Hash | Mensagem |
|---|------|---------|
| 1 | `85860b2` | `feat(pr118): extrair validateWorkerCode como função interna no executor` |
| 2 | `2e52692` | `fix(pr118): substituir self-call HTTP /module-validate por validateWorkerCode()` |

## Arquivos alterados

- `executor/src/index.js` — 62 linhas adicionadas, 14 removidas

## Invariantes verificados

| Invariante | Verificação |
|------------|-------------|
| merge_allowed=false | ✅ não tocado |
| Executor-only | ✅ nv-enavia.js não alterado |
| Sem mudança de comportamento | ✅ mesma lógica acorn + heurística + protectedVars |
| Sem refatoração estética | ✅ apenas mudanças necessárias |

## Cadeia completa de fixes (PR111→PR118)

| PR | Fix | Estado |
|----|-----|--------|
| PR111–PR114 | use_codex, schema, mode, generatePatch | Mergeadas ✅ |
| PR115 | `applyPatch` usa `target_code_original` | Mergeada ✅ |
| PR116 | worker-patch-safe via ENAVIA_WORKER (intermediário) | Mergeada ✅ |
| PR117 | worker-patch-safe via URL pública (intermediário) | Mergeada ✅ |
| PR118 | Eliminar self-call — internalizar validateWorkerCode | Esta PR |

## Próximos passos obrigatórios pós-merge

1. `wrangler secret put OPENAI_API_KEY --name enavia-executor`
2. `cd D:\nv-enavia && npx wrangler deploy`
3. `cd D:\nv-enavia\executor && npx wrangler deploy`
4. Teste E2E: `POST /worker-patch-safe` com candidate válido → `ok:true` (sem error 1042)
5. Teste ciclo completo: chat → "melhora o /audit" → "sim" → PR aberta

## Veredito

**APROVADO PARA MERGE** — 6/7 critérios verificados estaticamente. Critério 3 pendente de deploy.
