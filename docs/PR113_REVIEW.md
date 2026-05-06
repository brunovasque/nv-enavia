# PR113 REVIEW — Corrigir mode do dispatch do chat para enavia_propose

**Data:** 2026-05-06  
**Branch:** claude/pr113-fix-mode-dispatch  
**Contrato:** docs/CONTRATO_PR113_FIX_MODE_DISPATCH.md  
**Tipo da PR:** PR-IMPL  
**PR anterior validada:** PR112 ✅ mergeada (executor patch format corrigido)

---

## Critérios de aceite

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | Linha 3718 de `nv-enavia.js`: `"chat_execute_next"` → `"enavia_propose"` | ✅ | Leitura direta: `mode: "enavia_propose"` na linha 3718 |
| 2 | Nenhuma outra linha alterada | ✅ | `git diff --stat`: 1 arquivo, 1 insertion, 1 deletion |
| 3 | PR aberta com `docs/PR113_REVIEW.md` gerado | ✅ | Este arquivo |

**Resultado: 3/3 critérios atendidos**

---

## Invariantes

| # | Invariante | Status |
|---|------------|--------|
| 1 | `merge_allowed = false` | ✅ Respeitado |
| 2 | Branch nunca é `main` ou `master` | ✅ Branch: `claude/pr113-fix-mode-dispatch` |
| 3 | Nenhuma alteração em `executor/`, `deploy-worker/`, `schema/` | ✅ Apenas `nv-enavia.js` |
| 4 | Patch cirúrgico — sem refatoração | ✅ 1 linha alterada |

**Resultado: 4/4 invariantes respeitadas**

---

## Commit atômico

`a0c58bb` — `fix(pr113): corrigir mode do dispatch do chat para enavia_propose`
- Arquivo: `nv-enavia.js`, linha 3718
- 1 insertion, 1 deletion

---

## Diff

```diff
-    mode: "chat_execute_next",
+    mode: "enavia_propose",
```

---

## Análise de impacto

**Problema corrigido:** `_dispatchExecuteNextFromChat` enviava `mode: "chat_execute_next"` ao executor. Esse mode não existe — o payload caía no `else` genérico do executor sem `action` definida, o pipeline engineer rodava sem saber o que gerar, `staging.ready = false`, nenhuma PR era aberta.

**Solução:** `mode: "enavia_propose"` é o mode reconhecido pelo executor na linha 618 de `executor/src/index.js`:
```javascript
action.mode === "enavia_propose" || action.mode === "propose"
```

**Fluxo corrigido:**
```
Bruno digita "melhora o log do /audit" → "sim"
    ↓
_dispatchExecuteNextFromChat envia mode: "enavia_propose"  ← CORRIGIDO
    ↓
executor entra no pipeline correto (linha 618)
    ↓
use_codex=true → callCodexEngine chamado
    ↓
patches com {search, replace} (corrigido em PR112)
    ↓
applyPatch aplica → staging.ready = true
    ↓
github_orchestration abre PR → pr_url no reply
```

**Sem risco de regressão:** único lugar no arquivo que enviava `chat_execute_next` era a linha 3718 — confirmado por `grep chat_execute_next → 0 matches`. `enavia_propose` já existia em linha 8221 (outro handler) — consistência mantida.

---

## Pós-merge obrigatório

```powershell
cd D:\nv-enavia
npx wrangler deploy
```

---

## Veredito: APROVADO PARA MERGE
