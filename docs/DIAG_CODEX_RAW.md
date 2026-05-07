# DIAG — callCodexEngine raw OpenAI response

**Data:** 2026-05-07  
**Branch:** `fix/pr126-chunker-route-tokens-anti-hallucination`  
**Objetivo:** Capturar JSON exato que gpt-5.2 retorna no callCodexEngine para diagnosticar CODEX_ENGINE_NO_PATCH.

---

## Metodologia de captura

`wrangler tail` atingiu 256KB limit imediatamente:  
```
(warn) Log size limit exceeded: More than 256KB of data (across console.log statements, 
exception, request metadata and headers) was logged during a single request.
```

O executor loga `received_action` que inclui `target_code_original` (~374k chars). Isso preenche  
o budget antes dos console.log de `callCodexEngine`. Solução: endpoint `/diag-codex` dedicado  
que retorna o raw OpenAI no HTTP body.

---

## Resultado do diagnóstico

### Estado atual: CODEX_ENGINE_NO_PATCH NÃO ocorre com PR126 deployed

Com a versão PR126 (branch `fix/pr126-chunker-route-tokens-anti-hallucination`) deployada:

```json
POST /propose
→ staging.ready: true
→ warnings: []          ← sem CODEX_ENGINE_NO_PATCH
→ patchText.count: 2
→ apply_patch_error: { "ok": false, "reason": "AMBIGUOUS_MATCH" }
```

O Codex está gerando patches. O bloqueador atual é `AMBIGUOUS_MATCH`, não `CODEX_ENGINE_NO_PATCH`.

---

## Raw OpenAI response — capturado via /diag-codex

**Endpoint:** `POST /diag-codex`  
**Model:** `gpt-5.2` (resolve para `gpt-5.2-2025-12-11`)  
**Intent:** `melhora o log de erro do /audit`  
**HTTP status:** `200`  

### Raw response completo

```json
{
  "id": "chatcmpl-Dcrxd0rX6EDXCvnwOFt5IEsRWMEUj",
  "object": "chat.completion",
  "created": 1778156261,
  "model": "gpt-5.2-2025-12-11",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{ \"ok\": true, \"patches\": [ { \"title\": \"Melhorar log de erro do /audit com detalhes e fallback seguro\", \"search\": \"const _selfAuditResult = runEnaviaSelfAudit({\\n  message,\\n  context,\\n  sessionId: session_id,\\n});\\nconsole.log(\\\"audit result\\\", _selfAuditResult);\\nif (!_selfAuditResult.ok) {\\n  console.error(\\\"audit error:\\\", _selfAuditResult.error);\\n}\", \"replace\": \"const _selfAuditResult = runEnaviaSelfAudit({\\n  message,\\n  context,\\n  sessionId: session_id,\\n});\\n\\nconsole.log(\\\"audit result\\\", _selfAuditResult);\\n\\nif (!_selfAuditResult?.ok) {\\n  const _err = _selfAuditResult?.error;\\n  const _errObj = _err instanceof Error\\n    ? { name: _err.name, message: _err.message, stack: _err.stack }\\n    : _err;\\n\\n  console.error(\\\"audit error\\\", {\\n    sessionId: session_id,\\n    ok: _selfAuditResult?.ok,\\n    error: _errObj,\\n    result: _selfAuditResult,\\n  });\\n}\" } ], \"notes\": null }",
        "refusal": null,
        "annotations": []
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 164,
    "completion_tokens": 282,
    "total_tokens": 446,
    "prompt_tokens_details": { "cached_tokens": 0, "audio_tokens": 0 },
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "audio_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    }
  },
  "service_tier": "default",
  "system_fingerprint": null
}
```

### content_field (JSON que o modelo retornou, parsed)

```json
{
  "ok": true,
  "patches": [
    {
      "title": "Melhorar log de erro do /audit com detalhes e fallback seguro",
      "search": "const _selfAuditResult = runEnaviaSelfAudit({\n  message,\n  context,\n  sessionId: session_id,\n});\nconsole.log(\"audit result\", _selfAuditResult);\nif (!_selfAuditResult.ok) {\n  console.error(\"audit error:\", _selfAuditResult.error);\n}",
      "replace": "const _selfAuditResult = runEnaviaSelfAudit({\n  message,\n  context,\n  sessionId: session_id,\n});\n\nconsole.log(\"audit result\", _selfAuditResult);\n\nif (!_selfAuditResult?.ok) {\n  const _err = _selfAuditResult?.error;\n  const _errObj = _err instanceof Error\n    ? { name: _err.name, message: _err.message, stack: _err.stack }\n    : _err;\n\n  console.error(\"audit error\", {\n    sessionId: session_id,\n    ok: _selfAuditResult?.ok,\n    error: _errObj,\n    result: _selfAuditResult,\n  });\n}"
    }
  ],
  "notes": null
}
```

---

## Análise do raw

### O modelo gpt-5.2 funciona corretamente

| Campo | Valor | Status |
|-------|-------|--------|
| HTTP status | 200 | ✅ |
| `finish_reason` | stop | ✅ |
| `ok` no JSON | true | ✅ |
| `patches.length` | 1 | ✅ |
| `search` válido | usa código do snippet enviado | ✅ |
| `replace` válido | melhoria semântica real | ✅ |
| JSON puro (sem markdown) | sim | ✅ |

### O modelo gera patches corretos quando recebe código real

O `search` gerado usa exatamente o código fornecido no snippet:
```
const _selfAuditResult = runEnaviaSelfAudit({
  message,
  context,
  sessionId: session_id,
});
```
Isso confirma que **o modelo não alucina quando vê o código real**.

---

## Estado no /propose completo (PR126 deployed)

```
context_proof.snapshot_chars: 374087  ← GitHub source ✅
context_proof.source: "github"
staging.ready: true
patchText.count: 2
apply_patch_error: { "ok": false, "reason": "AMBIGUOUS_MATCH" }
```

### Patches gerados no /propose real

| # | search | ocorrências em nv-enavia.js | status |
|---|--------|-----------------------------|--------|
| 0 | `"  async fetch(request, env, ctx) {"` | 1 | ✅ match único |
| 1 | `"        detail: String(err),"` | **13** | ❌ AMBIGUOUS_MATCH |

```bash
grep -c "  async fetch(request, env, ctx) {" nv-enavia.js  # → 1
grep -c "        detail: String(err)," nv-enavia.js        # → 13
```

### Por que `patch[1].search` é ambíguo

O chunker ainda está enviando ao Codex um chunk que inclui código genérico de error handling. A linha `detail: String(err),` aparece em 13 lugares no arquivo — é o pattern padrão de todos os handlers de erro. O Codex usa essa linha como âncora porque ela está no chunk e parece relevante para "melhora o log de erro".

---

## Causa de CODEX_ENGINE_NO_PATCH (antes de PR126)

Antes do deploy de PR126:
- O chunk de 16k não incluía código real de audit
- O Codex gerava `search: "async function handleAudit..."` (alucinação)
- ANCHOR_NOT_FOUND → retorno `{ ok: false, reason: undefined }` do callCodexEngine
- `CODEX_ENGINE_NO_PATCH:unknown` no log de warnings

Com PR126 deployed:
- `routeHandlerMap` expande `/audit` → `runEnaviaSelfAudit`
- O chunk agora inclui código real do handler
- Codex gera patches reais → `staging.ready: true`
- Novo bloqueador: AMBIGUOUS_MATCH na string `detail: String(err)`

---

## Próxima ação: PR127

**Problema restante**: `patch[1].search = "        detail: String(err),"` — 13 ocorrências.

**Solução**: Forçar o Codex a usar `search` mais específico — com mais contexto ao redor do trecho.

**Opção A**: Aumentar exigência no system prompt: "o search deve ter pelo menos 3 linhas únicas de contexto para garantir unicidade"

**Opção B**: Pós-processar os patches antes de `applyPatch` — se o search tiver múltiplos matches, pedir ao Codex para refiná-lo

**Opção C**: Melhorar o chunker para enviar um bloco mais específico centrado no `runEnaviaSelfAudit` call site (não apenas o import)

---

## Logs diagnósticos mantidos

Conforme instrução, os seguintes logs foram mantidos no código:

### callCodexEngine (executor/src/index.js)

```js
console.log(`[DIAG_CODEX] calling OpenAI model=${model} ...`);
console.log(`[DIAG_CODEX] http_status=${resp.status} ok=${resp.ok} txt_len=${txt.length}`);
console.log(`[DIAG_CODEX] RAW_OPENAI_RESPONSE=${txt.slice(0, 4000)}`);
console.log(`[DIAG_CODEX] content_len=${content.length} content_preview=${content.slice(0, 1000)}`);
console.log(`[DIAG_CODEX] parsed_ok=... patches_type=... patches_count=...`);
console.log(`[DIAG_CODEX] normalized_count=... ok=...`);
```

### /diag-codex endpoint (executor/src/index.js)

Endpoint `POST /diag-codex` mantido — retorna raw OpenAI response no HTTP body.  
Contorna o limite de 256KB do wrangler tail.

**Uso:**
```bash
curl -X POST https://enavia-executor.brunovasque.workers.dev/diag-codex \
  -H "Content-Type: application/json" \
  -d '{"intent": "melhora o log de erro do /audit", "code": "<trecho do source>"}'
```
