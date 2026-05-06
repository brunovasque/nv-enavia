# REVIEW — PR111: Ativar Codex no dispatch do chat

**Branch:** `claude/pr111-ativar-codex-dispatch`  
**Contrato:** `docs/CONTRATO_PR111_ATIVAR_CODEX_DISPATCH.md`  
**Data:** 2026-05-06  
**Revisor:** Claude Code (leitura do código real)

---

## 1. ARQUIVOS ALTERADOS

| Arquivo | Tipo | O que faz |
|---------|------|-----------|
| `nv-enavia.js` linha 3724 | Alterado (1 linha) | `use_codex: false` → `use_codex: true` em `_dispatchExecuteNextFromChat` |
| `schema/contracts/INDEX.md` | Alterado (+17/-5 linhas) | PR110 encerrado ✅, PR111 registrada como ativa |

Nenhum outro arquivo alterado. Invariante de patch cirúrgico respeitado.

---

## 2. CRITÉRIOS DO CONTRATO

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | Linha 3724 de `nv-enavia.js`: `false` → `true` | ✅ | `git show 0c97f1a` — 1 file, 1 insertion, 1 deletion |
| 2 | Nenhuma outra linha de `nv-enavia.js` alterada | ✅ | diff mostra apenas linha 3724 |
| 3 | `schema/contracts/INDEX.md`: PR110 = Encerrado ✅ | ✅ | commit `fd66d94` — PR110 marcada como `🔴 Encerrado ✅ (2026-05-06)` |
| 4 | `schema/contracts/INDEX.md`: PR111 = Ativa 🔄 | ✅ | commit `fd66d94` — PR111 marcada como `🟢 Ativo` |
| 5 | PR aberta com `docs/PR111_REVIEW.md` gerado | ✅ | este arquivo |

**5/5 critérios atendidos.**

---

## 3. INVARIANTES

| Invariante | Status | Evidência |
|-----------|--------|-----------|
| `merge_allowed = false` herdado | ✅ | Invariante do github-orchestrator.js — PR111 não altera |
| Branch não é `main` ou `master` | ✅ | `claude/pr111-ativar-codex-dispatch` |
| Nenhuma alteração em `executor/` | ✅ | Só `nv-enavia.js` e `schema/contracts/INDEX.md` |
| Nenhuma alteração em `deploy-worker/` | ✅ | Confirmado |
| Nenhuma alteração em `schema/enavia-*.js` | ✅ | Confirmado |
| Patch cirúrgico | ✅ | 1 linha alterada em nv-enavia.js |

**6/6 invariantes respeitados.**

---

## 4. COMMITS ATÔMICOS — SEQUÊNCIA CORRETA?

```
0c97f1a  fix(pr111): ativar use_codex=true no dispatch do chat       ← Commit 1
fd66d94  docs(pr111): encerrar PR110 no INDEX.md e registrar PR111   ← Commit 2
```

**Sequência:** ✅ Fix de código → governança.  
Dependência: Commit 2 documenta o estado após Commit 1 estar concluído.

---

## 5. ANÁLISE TÉCNICA

### 5.1 O que mudou exatamente

Em `nv-enavia.js`, função `_dispatchExecuteNextFromChat` (linha ~3703), o payload enviado ao executor `/propose`:

```diff
  const _proposePayload = {
    source: "chat_trigger",
    mode: "chat_execute_next",
    intent: "propose",
    improvement_target: improvementTarget,
    target: { system: "cloudflare_worker", workerId: "nv-enavia" },
    session_id: sessionId,
    github_token_available: true,
-   use_codex: false,
+   use_codex: true,
    context: {
      description: pendingPlan.description || `...`,
      require_live_read: true,
    },
  };
```

### 5.2 Como o executor usa `use_codex`

Em `executor/src/index.js` linhas ~7247–7252:

```javascript
const wantCodex =
  raw?.context?.use_codex === true ||
  raw?.use_codex === true ||
  a?.context?.use_codex === true;

if (wantCodex && (env?.OPENAI_API_KEY || env?.CODEX_API_KEY)) {
  // chama callCodexEngine — gera patchList
}
```

Com `use_codex: true`, o executor agora entra no bloco Codex.  
O Codex só executa se `env.OPENAI_API_KEY` (ou `CODEX_API_KEY`) estiver configurada.

### 5.3 Fluxo completo após esta PR

```
Usuário: "melhora o log de erro do /audit"
  → classifyEnaviaIntent → IMPROVEMENT_REQUEST (target="/audit")
  → bloco PR110: pending_plan criado (TTL=300s)
  → reply: "Confirma? (sim/não)"

Usuário: "sim"
  → BLOCO B chat_bridge: hasApproval=true
  → _dispatchFromChat → _dispatchExecuteNextFromChat
  → executor /propose com:
      target: { system: "cloudflare_worker", workerId: "nv-enavia" }
      require_live_read: true   → live_read do Worker ✅
      use_codex: true           → Codex Engine ✅ (se OPENAI_API_KEY disponível)
  → Codex gera patchList
  → staging.ready = true
  → orchestrateGithubPR abre PR
  → pr_url retornado ao chat
```

### 5.4 Dependência crítica (pré-condição de runtime)

Esta PR ativa o caminho mas **não garante que o Codex funcione** em produção.  
O executor precisa de `OPENAI_API_KEY` configurada como Cloudflare secret:

```bash
# No repo do executor (via wrangler)
wrangler secret put OPENAI_API_KEY --name enavia-executor
```

Se `OPENAI_API_KEY` não estiver configurada no executor, o bloco Codex é silenciosamente ignorado (`if (wantCodex && (env?.OPENAI_API_KEY || env?.CODEX_API_KEY))`), `staging.ready` continua `false`, nenhuma PR é aberta, e o usuário recebe `"Execução concluída, mas nenhuma PR foi aberta"`.

**Isso não é um bug desta PR** — é uma pré-condição de infra. O comportamento com Codex desabilitado é idêntico ao anterior (degradação graciosa).

### 5.5 Outras ocorrências de `use_codex` em nv-enavia.js

```javascript
// linha 6387 — handler de execute-next (POST /contracts/execute-next)
use_codex: !!env?.GITHUB_TOKEN,
```

Esta linha está no handler `handleExecuteNext`, **não** em `_dispatchExecuteNextFromChat`. Não foi alterada. Não há conflito — os dois handlers são independentes e cobrem caminhos diferentes.

---

## 6. ISSUES RESIDUAIS (para PR112+)

**I2 — LLM não consultado na detecção de IMPROVEMENT_REQUEST** (herdado de PR110)  
O reply de confirmação ainda é template fixo. PR112 pode chamar LLM para resposta mais rica.

**I4 — Fluxo não testado com PR real aberta** (herdado de PR110)  
PR111 não inclui testes E2E. A prova real requer executor com `OPENAI_API_KEY` configurada.  
PR112 deve incluir Grupo 3 de prova real (similar ao PR109 Grupo 3).

**Infra gap (novo)** — `OPENAI_API_KEY` não declarada no `executor/wrangler.toml`.  
Não bloqueador para esta PR, mas deve ser corrigido para garantir rastreabilidade.

---

## 7. VEREDITO

```
APROVADO PARA MERGE ✅

Critérios atendidos: 5/5 ✅
Invariantes respeitados: 6/6 ✅
Commits na sequência correta: ✅
Alteração cirúrgica: 1 linha em nv-enavia.js ✅
Issues residuais: 2 herdados (I2, I4) + 1 de infra (OPENAI_API_KEY) — não bloqueadores
```

**Pré-condição obrigatória pós-merge:** Configurar `OPENAI_API_KEY` no executor Cloudflare:
```bash
wrangler secret put OPENAI_API_KEY --name enavia-executor
```

**Pendente:** Aprovação de Bruno.
