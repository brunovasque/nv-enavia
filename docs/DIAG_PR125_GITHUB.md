# DIAG PR125 — Diagnóstico GitHub fetch em _fetchWorkerSource

**Data:** 2026-05-06  
**Branch:** `feat/pr125-github-source-keep-names`  
**Objetivo:** Verificar por que `_fetchWorkerSource` falha silenciosamente e o fallback CF API é usado.

---

## Resultado do diagnóstico

### _fetchWorkerSource NÃO está falhando

A hipótese inicial estava **incorreta**. O GitHub fetch está funcionando.

Evidência direta do `POST /propose`:

```json
"received_action.context_proof": {
  "snapshot_chars": 374087,
  "snapshot_lines": 10191,
  "source": "github",
  "github_file": "nv-enavia.js"
},
"received_action.context.target_code_source": "github",
"received_action.context.target_code_original": "import {\n  handleCreateContract,\n  handleGetContract,\n  ..."
```

- `snapshot_chars: 374087` → GitHub source (~350k), **não** o bundle CF (~790k) ✅
- `source: "github"` → confirmado ✅
- `target_code_original` começa com ESM imports (`import { handleCreateContract, ... }`) → é o source real ✅

### Por que o usuário viu `snapshot_chars: 796366`

O valor `796366` (bundle CF) foi observado **antes do deploy de PR125**. Após o deploy (Version ID `2635d0be-cc6f-4139-adf0-82553a4df553`), o GitHub source é lido corretamente.

---

## Causa real do ANCHOR_NOT_FOUND persistente

### Patch gerado pelo Codex

```json
"patch[0].search": "  async fetch(request, env, ctx) {",
"patch[1].search": "async function handleAudit(request, env) {"
```

### Verificação no source real (nv-enavia.js)

| Search string | Ocorrências em nv-enavia.js |
|---------------|------------------------------|
| `"  async fetch(request, env, ctx) {"` | **1** ✅ |
| `"async function handleAudit(request, env) {"` | **0** ❌ |

```bash
grep -c "  async fetch(request, env, ctx) {" nv-enavia.js  # → 1
grep -c "async function handleAudit" nv-enavia.js           # → 0
```

### `patch[0]` aplicado com sucesso

`"  async fetch(request, env, ctx) {"` existe 1 vez → sem ambiguidade → seria aplicado.

### `patch[1]` falha com ANCHOR_NOT_FOUND

`"async function handleAudit(request, env) {"` **não existe** em `nv-enavia.js`.

A função `handleAudit` é uma **alucinação do Codex**. O arquivo real implementa audit via:
- `runEnaviaSelfAudit` (import de `./schema/enavia-self-audit.js`)
- Não existe um handler monolítico `handleAudit(request, env)`

---

## Por que o Codex alucina `handleAudit`

### Chunk enviado ao Codex

O `extractRelevantChunk` extrai ~16k chars relevantes do source de 374k. Para o intent  
`"melhora o log de erro do /audit"`, o chunk provavelmente contém código de logging  
genérico (`console.log`, `withCORS`, `handleBrainQuery`) mas **não contém o bloco de  
código que lida com `/audit` especificamente**.

### Inferência incorreta do Codex

Sem ver o handler real de `/audit`, o Codex:
1. Reconhece a rota `/audit` como existente (mencionada em listas de rotas)
2. **Infere** que deve existir uma função `handleAudit` por convenção de nomenclatura
3. Gera `search: "async function handleAudit(request, env) {"` — string que não existe

---

## Comportamento misleading de `apply_patch_error`

```json
{
  "ok": false,
  "reason": "ANCHOR_NOT_FOUND",
  "applied_count": 0,
  "failed_count": 0
}
```

- `applied_count: 0` é **enganoso** — patch[0] foi aplicado com sucesso internamente
- `failed_count: 0` é **enganoso** — patch[1] falhou mas `patchResult.failed` não existe (`patchResult.skipped` é o campo correto)
- Causa: `patch-engine.js` faz early-return sem incluir `applied` no resultado de falha

---

## Fluxo completo confirmado

```
POST /propose (require_live_read=true, use_codex=true, github_token_available=true)
│
├── fetchCurrentWorkerSnapshot → snap.code (CF bundle, 796366 chars) [fallback]
│
├── _fetchWorkerSource → GitHub OK → source (374087 chars) ✅
│   └── target_code_original = github source
│   └── target_code_source = "github"
│   └── context_proof.snapshot_chars = 374087
│
├── extractRelevantChunk(374087 chars, "melhora o log de erro do /audit")
│   └── chunk de ~16k enviado ao Codex
│
├── callCodexEngine (gpt-5.2)
│   └── patch[0].search = "  async fetch(request, env, ctx) {" ✅ (existe)
│   └── patch[1].search = "async function handleAudit(request, env) {" ❌ (não existe)
│
├── applyPatch(github_source, patches)
│   ├── patch[0]: found at index N → applied ✅
│   └── patch[1]: indexOf → -1 → ANCHOR_NOT_FOUND → early return ❌
│
└── github_orchestration: ABSENT (apply falhou → PR não aberta)
```

---

## Próxima ação necessária

### Problema a resolver: Codex alucina `handleAudit`

**Opção A — Melhorar o chunking para incluir o código de audit real**  
O `extractRelevantChunk` deve incluir o bloco que menciona `runEnaviaSelfAudit` e a rota `/audit` real.

**Opção B — Instruir o Codex a gerar `search` APENAS do código que VÊ no chunk**  
Adicionar ao system prompt: "Use ONLY code that appears verbatim in the provided chunk. Do NOT infer or generate function names not visible in the chunk."

**Opção C — Melhorar o `extractRelevantChunk` para incluir mais contexto de rota**  
Buscar pelo pattern `pathname.*audit` ou `runEnaviaSelfAudit` e incluir o bloco vizinho.

### Recomendação

Combinação de **Opção B** (prompt mais restritivo) + **Opção C** (chunk mais relevante).  
O intent "melhora o log de erro do /audit" deve fazer o chunker incluir o código que realmente lida com a lógica de audit em nv-enavia.js.

---

## Status final da PR125

| Componente | Status |
|------------|--------|
| `_fetchWorkerSource` funcionando | ✅ GitHub source lido |
| `snapshot_chars` correto | ✅ 374087 (GitHub) |
| `source: "github"` confirmado | ✅ |
| `patch[0]` (`async fetch`) aplicado | ✅ |
| `patch[1]` (`handleAudit`) falha | ❌ Alucinação Codex |
| `apply_patch_error` presente | ❌ ANCHOR_NOT_FOUND |
| `github_orchestration.pr_url` | ❌ PR não aberta |

**Desbloqueador**: PR126 — fix do chunking/prompt para evitar alucinação de `handleAudit`.
