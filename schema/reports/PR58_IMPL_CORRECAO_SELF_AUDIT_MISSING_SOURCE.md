# PR58 — Correção cirúrgica do Self-Audit missing_source

**Tipo:** PR-IMPL  
**Branch:** `copilot/claudepr58-impl-correcao-self-audit-missing-source`  
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`  
**PR anterior validada:** PR57 ⚠️ (PR-PROVA — Prova do Self-Audit read-only — 96/99, falha parcial Cenário H)

---

## 1. Objetivo

Corrigir exclusivamente o detector `_detectMissingSource` em `schema/enavia-self-audit.js` para capturar nomes de workers com hífen (ex: `payments-worker`, `nv-enavia`).

A PR57 (PR-PROVA) revelou que o Cenário H falhava em 0/3 asserts porque o regex `\w+` não captura hífens. Esta PR58 é uma exceção corretiva cirúrgica autorizada pelo contrato para corrigir esse achado antes de retornar ao fluxo principal.

---

## 2. Causa raiz vinda da PR57

**Achado PR57 — Cenário H — Missing source (0/3 falhas):**

O detector `_detectMissingSource` em `schema/enavia-self-audit.js` continha o seguinte padrão regex:

```js
/o worker\s+\w+\s+já está (ativo|funcionando|online|em produção)/i
```

O metacaracter `\w+` corresponde apenas a `[A-Za-z0-9_]` — **não captura hífens**.

O input de teste do Cenário H era:
```
"O worker payments-worker já está ativo em produção."
```

O nome `payments-worker` contém hífen, portanto o padrão não casava com a string, e o finding `missing_source` não era gerado.

**Por que o smoke PR56 passou:** O smoke PR56 usou `"O worker X já está ativo em produção."` com nome sem hífen (`X`). O problema só foi revelado pela prova PR57 com nome real hiphenado.

**Impacto:** Nomes reais de workers na Enavia usam hífens (ex: `nv-enavia`, `payments-worker`, `nv-workers`). O detector tinha cobertura insuficiente para o padrão real do sistema.

---

## 3. Correção aplicada

**Arquivo:** `schema/enavia-self-audit.js`  
**Função:** `_detectMissingSource` (linha 402)

**Antes:**
```js
/o worker\s+\w+\s+já está (ativo|funcionando|online|em produção)/i,
```

**Depois:**
```js
/o worker\s+[\w-]+\s+já está (ativo|funcionando|online|em produção)/i,
```

**Justificativa:** `[\w-]+` equivale a `[A-Za-z0-9_-]+`, capturando palavras, underscores e hífens. Padrão seguro e minimal para nomes de worker hiphenados.

**Demais padrões do detector verificados:**

Os outros 6 padrões em `_detectMissingSource` foram verificados:
- `/o sistema (está|fica|roda) em produção/i` — genérico, sem nome de worker, não precisa de correção.
- `/o endpoint (está|fica|responde|existe)/i` — genérico, sem nome de worker/endpoint específico, não precisa de correção.
- `/o deploy (está|foi|ficou) (completo|ativo|rodando)/i` — genérico, não captura nome, não precisa de correção.
- `/a rota (está|existe|responde)/i` — genérico, não captura nome, não precisa de correção.
- `/o binding (está|existe|está configurado)/i` — genérico, não precisa de correção.
- `/o worker (está|existe|responde|roda)/i` — genérico sem nome de worker específico, não precisa de correção.

**Apenas o primeiro padrão foi alterado.** É o único que captura um nome de worker específico via `\w+`.

---

## 4. Arquivos alterados

| Arquivo | Tipo de alteração |
|---------|-------------------|
| `schema/enavia-self-audit.js` | Regex `\w+` → `[\w-]+` na linha 402 do detector `_detectMissingSource` |
| `schema/reports/PR58_IMPL_CORRECAO_SELF_AUDIT_MISSING_SOURCE.md` | Criado (este relatório) |
| `schema/contracts/INDEX.md` | Atualizado — PR58 ✅, próxima PR59 |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Atualizado |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Atualizado |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Atualizado |

---

## 5. Resultado PR57 após correção

```bash
node tests/pr57-self-audit-readonly.prova.test.js
# → Total: 99 | ✅ Passaram: 99 | ❌ Falharam: 0
# → ✅ Todos os testes passaram.
```

| | Antes (PR57 original) | Depois (PR58 correção) |
|---|---|---|
| **Total** | 96/99 | **99/99** |
| **Cenário H** | 0/3 ❌ | **3/3 ✅** |
| **Outros cenários** | 96/96 ✅ | 96/96 ✅ |

---

## 6. Regressões executadas

| Teste | Resultado |
|-------|-----------|
| `node --check schema/enavia-self-audit.js` | **SYNTAX OK ✅** |
| `node --check tests/pr57-self-audit-readonly.prova.test.js` | **SYNTAX OK ✅** |
| `node tests/pr57-self-audit-readonly.prova.test.js` | **99/99 ✅** |
| `node tests/pr56-self-audit-readonly.smoke.test.js` | **64/64 ✅** |
| `node tests/pr54-memoria-contextual.prova.test.js` | **93/93 ✅** |
| `node tests/pr53-intent-retrieval.smoke.test.js` | **82/82 ✅** |
| `node tests/pr52-skill-routing-runtime.prova.test.js` | **202/202 ✅** |
| `node tests/pr51-skill-router-readonly.smoke.test.js` | **168/168 ✅** |
| `node tests/pr50-intent-runtime.prova.test.js` | **124/124 ✅** |
| `node tests/pr49-intent-classifier.smoke.test.js` | **96/96 ✅** |
| `node tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` | **20/20 ✅** |
| `node tests/pr47-resposta-viva-llm-core-v1.prova.test.js` | **79/79 ✅** |
| `node tests/pr46-llm-core-v1.smoke.test.js` | **43/43 ✅** |
| `node tests/pr44-brain-loader-chat-runtime.prova.test.js` | **38/38 ✅** |
| `node tests/pr43-brain-loader-readonly.smoke.test.js` | **32/32 ✅** |
| `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | **56/56 ✅** |
| `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` | **26/26 ✅** |
| `node tests/pr21-loop-status-states.smoke.test.js` | **53/53 ✅** |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` | **27/27 ✅** |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` | **52/52 ✅** |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` | **183/183 ✅** |
| `node tests/pr13-hardening-operacional.smoke.test.js` | **91/91 ✅** |

**Total regressões: 1.375/1.375 ✅**

---

## 7. O que NÃO foi alterado

- **Não alterou `nv-enavia.js`** — runtime do worker principal intacto.
- **Não alterou resposta automaticamente** — Self-Audit continua read-only.
- **Não criou endpoint** — nenhum novo endpoint em nenhum arquivo.
- **Não criou `/self-audit`** — ausente.
- **Não criou `/audit/run`** — ausente.
- **Não alterou gates** — nenhum gate de bloqueio automático implementado.
- **Não alterou painel** — Panel intacto.
- **Não alterou Executor** — Executor intacto.
- **Não alterou Deploy Worker** — Deploy Worker intacto.
- **Não alterou KV/bindings/secrets** — KV intacto.
- **Não implementou Response Policy** — reservado para PR59+.
- **Não alterou `schema/enavia-cognitive-runtime.js`** — intacto.
- **Não alterou `schema/enavia-llm-core.js`** — intacto.
- **Não alterou `schema/enavia-brain-loader.js`** — intacto.
- **Não alterou `schema/enavia-intent-classifier.js`** — intacto.
- **Não alterou `schema/enavia-skill-router.js`** — intacto.
- **Não alterou `schema/enavia-intent-retrieval.js`** — intacto.
- **Não refatorou o módulo** — única alteração foi o padrão regex na linha 402.
- **Não alterou outras categorias de risco** — apenas `_detectMissingSource`.
- **Não mexeu em severidade** — lógica de severidade intacta.
- **Não mexeu no output contract** — shape de saída intacto.

---

## 8. Riscos restantes

### Risco R1 — Outros padrões missing_source sem nome de worker (mitigado)

Os demais padrões em `_detectMissingSource` são genéricos (sem captura de nome específico) e não precisam de correção para hífens. Verificado e documentado.

### Risco R2 — responseDraft não disponível na posição atual (pré-existente)

**Impacto:** Médio (pré-existente, documentado nas PR56 e PR57)  
O `runEnaviaSelfAudit()` é chamado antes da geração da resposta LLM. O `responseDraft` não está disponível em produção via integração atual. Os detectores que dependem de `responseDraft` (fake_execution, false_capability, missing_source, runtime_vs_doc_confusion) só operam quando injetados explicitamente via `metadata.responseDraft`.  
**Status:** Pré-existente. Documentado. Correção (reposicionamento para após o LLM) em PR futura.

### Risco R3 — Categorias sem detector específico (pré-existente)

**Impacto:** Baixo  
`prompt_bloat`, `stale_context`, `regression_risk` reconhecidas pelo framework mas sem detector em v1.  
**Status:** Pré-existente. Planejado para PRs futuras.

### Risco R4 — should_block informativo (intencional)

**Impacto:** Baixo (intencional, documentado)  
`should_block=true` é apenas sinalização. Response Policy (PR59) abordará o bloqueio real.  
**Status:** Intencional nesta fase.

---

## 9. Retorno ao contrato

Com PR57 passando **99/99** após a correção da PR58, a próxima PR volta ao fluxo principal do contrato.

**Próxima PR autorizada:** PR59 — PR-IMPL — Response Policy viva.

O achado do Cenário H (missing_source com nomes hiphenados) foi corrigido. Self-Audit read-only está completo e validado com 99/99.
