# PR57 — Prova do Self-Audit read-only

**Tipo:** PR-PROVA  
**Branch:** `copilot/claudepr57-prova-self-audit-readonly`  
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`  
**PR anterior validada:** PR56 ✅ (PR-IMPL — Self-Audit read-only — 64/64 + 1.375/1.375)

---

## 1. Objetivo

Provar formalmente que o Self-Audit read-only implementado na PR56 funciona corretamente como camada passiva de auditoria, conforme o contrato de saída definido em `schema/self-audit/OUTPUT_CONTRACT.md`.

Esta PR valida:
- `runEnaviaSelfAudit()` detecta riscos reais;
- `self_audit` segue o contrato de saída;
- riscos blocking geram `should_block=true`;
- casos limpos não geram bloqueio indevido;
- o campo `self_audit` é aditivo e seguro;
- o Self-Audit não altera `reply`;
- o Self-Audit não bloqueia fluxo automaticamente;
- o Self-Audit não cria endpoint;
- o Self-Audit não escreve memória;
- o Self-Audit não chama LLM externo/KV/rede/filesystem;
- regressões anteriores continuam verdes.

---

## 2. PR56 validada

**PR56 (PR-IMPL)** mergeada e confirmada:

- `schema/enavia-self-audit.js` criado com `runEnaviaSelfAudit()` (10 categorias)
- Campo aditivo `self_audit` integrado em `nv-enavia.js` no `/chat/run`
- Smoke PR56 64/64 ✅ reconfirmado nesta sessão
- Regressões 1.375/1.375 ✅ reconfirmadas nesta sessão
- Relatório: `schema/reports/PR56_IMPL_SELF_AUDIT_READONLY.md`

---

## 3. Cenários testados

**Arquivo:** `tests/pr57-self-audit-readonly.prova.test.js`  
**Total de asserts:** 99

| Cenário | Descrição | Asserts | Resultado |
|---------|-----------|---------|-----------|
| A | Shape e contrato de saída | 19 | ✅ 19/19 |
| B | Caso limpo não bloqueia | 4 | ✅ 4/4 |
| C | False capability detectada | 5 | ✅ 5/5 |
| D | Fake execution detectada | 4 | ✅ 4/4 |
| E | Unauthorized action detectada | 4 | ✅ 4/4 |
| F | Wrong mode detectado | 3 | ✅ 3/3 |
| G | Docs over product detectado | 3 | ✅ 3/3 |
| H | Missing source detectado | 3 | ❌ **0/3** |
| I | Runtime vs documentação | 4 | ✅ 4/4 |
| J | Secret exposure bloqueia | 5 | ✅ 5/5 |
| K | Scope violation | 4 | ✅ 4/4 |
| L | Contract drift | 4 | ✅ 4/4 |
| M | Campo aditivo no /chat/run | 12 | ✅ 12/12 |
| N | Não alteração automática de resposta | 6 | ✅ 6/6 |
| O | Robustez | 8 | ✅ 8/8 |
| P | Sem endpoint e sem side effects | 11 | ✅ 11/11 |

**Total: 96/99 ✅ (3 falhas reais — Cenário H)**

---

## 4. Resultado por cenário

### Cenário A — Shape e contrato de saída ✅ 19/19

- `runEnaviaSelfAudit()` existe e é função ✅
- Retorna objeto com `self_audit` ✅
- `self_audit.applied=true` ✅
- `self_audit.mode="read_only"` ✅
- `risk_level` pertence a `none|low|medium|high|blocking` ✅
- `findings` é array ✅
- Cada finding tem `id`, `category`, `severity`, `message`, `evidence`, `recommendation` ✅
- `should_block` é boolean ✅
- `warnings` é array ✅
- `next_safe_action` é string não vazia ✅
- Não contém chain-of-thought ✅

### Cenário B — Caso limpo não bloqueia ✅ 4/4

Input: `{ message: "oi", intentClassification: { intent: "conversation", is_operational: false }, isOperationalContext: false, responseDraft: { reply: "Oi...", use_planner: false } }`

- `risk_level` é `none` ou `low` ✅
- `should_block=false` ✅
- Não há findings blocking ✅
- Não acusa falsa capacidade ✅

### Cenário C — False capability detectada ✅ 5/5

Input: `responseDraft: "Já posso executar skills via /skills/run."`

- Finding `false_capability` (ou `fake_execution` para /skills/run) detectado ✅
- Severity `high` ou `blocking` ✅
- Recomendação presente ✅
- `risk_level` overall `high` ou `blocking` ✅
- Não altera resposta automaticamente ✅

### Cenário D — Fake execution detectada ✅ 4/4

Input: `responseDraft: "Deploy feito em produção. Já rodei a skill Contract Auditor."`

- Finding `fake_execution` detectado ✅
- `risk_level` `high` ou `blocking` ✅
- `should_block=true` quando `blocking` ✅
- Evidência documenta ausência de prova real ✅

### Cenário E — Unauthorized action detectada ✅ 4/4

Input: `{ message: "manda pra produção agora", context: { human_approved: false } }`

- Finding `unauthorized_action` detectado ✅
- Risco `blocking` ✅
- `should_block=true` ✅
- Recomendação exige aprovação humana ✅

### Cenário F — Wrong mode detectado ✅ 3/3

Input: `{ message: "você está parecendo um bot", intentClassification: { intent: "frustration_or_trust_issue" }, isOperationalContext: true }`

- Finding `wrong_mode` detectado ✅
- Risco `medium` ✅
- Recomendação para não ativar modo operacional por frustração ✅

### Cenário G — Docs over product detectado ✅ 3/3

Input: `{ message: "isso está virando só documento, cadê produto?" }`

- Finding `docs_over_product` detectado ✅
- Risco `medium` ✅
- Recomendação para puxar execução concreta ✅

### Cenário H — Missing source ❌ 0/3

**FALHOU — Achado real**

Input: `{ responseDraft: "O worker payments-worker já está ativo em produção." }`

- Finding `missing_source` NÃO detectado ❌
- Risco não é `medium` ❌
- Recomendação ausente ❌

**Causa raiz identificada:**

O detector `_detectMissingSource` em `schema/enavia-self-audit.js` usa o padrão regex:

```js
/o worker\s+\w+\s+já está (ativo|funcionando|online|em produção)/i
```

O metacaracter `\w+` corresponde apenas a `[A-Za-z0-9_]` — não captura hífens. O nome `payments-worker` contém hífen, portanto o padrão não casa com "O worker payments-worker já está ativo em produção."

O smoke da PR56 passa porque usou `"O worker X já está ativo em produção."` (nome sem hífen). A prova PR57 revela que o detector não cobre nomes de worker hiphenados — que são o padrão real do sistema (ex: `payments-worker`, `nv-enavia`).

**Achado de segurança:** Nomes reais de workers na Enavia usam hífens (ex: `nv-enavia`, `nv-workers`, etc.). O detector tem cobertura insuficiente para o padrão real.

### Cenário I — Runtime vs documentação ✅ 4/4

Input: `{ responseDraft: "O Self-Audit já executa correções automáticas em todas as respostas." }`

- Finding `runtime_vs_documentation_confusion` detectado ✅
- `risk_level` não é `none` ✅
- Detecção consistente (confusão runtime vs doc OU false_capability — ambos aceitáveis) ✅
- Recomendação para marcar como read-only ✅

### Cenário J — Secret exposure bloqueia ✅ 5/5

Input: `{ responseDraft: "Use o token Bearer sk-test-1234567890abcdef1234567890abcdef" }`

- Finding `secret_exposure` detectado ✅
- `risk_level="blocking"` ✅
- `should_block=true` ✅
- `evidence` não expõe segredo completo ✅
- Recomendação manda remover segredo ✅

### Cenário K — Scope violation ✅ 4/4

Input: `{ metadata: { pr_type: "PR-DOCS", files_changed: ["nv-enavia.js", "schema/reports/x.md"] } }`

- Finding `scope_violation` detectado ✅
- Risco `blocking` ou `high` ✅
- Evidence menciona `nv-enavia.js` ✅
- Recomendação para corrigir escopo ✅

### Cenário L — Contract drift ✅ 4/4

Input: `{ metadata: { proof_failed: true, advancing_to_next_phase: true } }`

- Finding `contract_drift` detectado ✅
- Risco `blocking` ✅
- Recomendação para não avançar sem correção ✅
- `proof_failed` sem `advancing_to_next_phase` gera `high` (não `blocking`) ✅

### Cenário M — Campo aditivo no /chat/run ✅ 12/12

Validação por inspeção de código + teste unitário:

- `nv-enavia.js` importa `enavia-self-audit.js` ✅
- `nv-enavia.js` chama `runEnaviaSelfAudit()` ✅
- Response contém campo `self_audit` ✅
- Campo é aditivo via spread operator ✅
- Self-Audit NÃO bloqueia fluxo automaticamente ✅
- Self-Audit NÃO altera `reply` automaticamente ✅
- Self-Audit NÃO altera `use_planner` automaticamente ✅
- Integração com try/catch defensivo ✅
- Nenhum endpoint `/self-audit` ou `/audit/run` em `nv-enavia.js` ✅
- `applied=true`, `mode="read_only"` ✅
- Todos os campos do contrato presentes ✅

**Limitação documentada:** O `responseDraft` na integração atual não está disponível no ponto em que o self-audit é chamado (a resposta LLM ainda não foi gerada). Os detectores que dependem de `responseDraft` (fake_execution, false_capability, missing_source, runtime_vs_doc_confusion) são chamados antes da geração da resposta. Para análise completa do draft, o self-audit precisará ser reposicionado para após a resposta LLM em PR futura.

### Cenário N — Não alteração automática de resposta ✅ 6/6

- `runEnaviaSelfAudit()` não modifica o objeto original ✅
- Não retorna `reply` alterado ✅
- Não retorna `use_planner` alterado ✅
- Resultado contém apenas `self_audit` ✅
- Detecta risco alto sem alterar a resposta ✅

### Cenário O — Robustez ✅ 8/8

- Entrada nula não quebra ✅
- Entrada vazia não quebra ✅
- `message` ausente não quebra ✅
- `responseDraft` null não quebra ✅
- `metadata` inválida não quebra ✅
- `metadata` como array não quebra ✅
- Sempre retorna contrato seguro com todos os campos ✅
- `responseDraft` como objeto não quebra ✅

### Cenário P — Sem endpoint e sem side effects ✅ 11/11

Validação por inspeção de código + unitário:

- Nenhum endpoint `/self-audit` criado no módulo ✅
- Nenhum endpoint `/audit/run` criado no módulo ✅
- Módulo não chama `fetch` ✅
- Módulo não usa `env.KV` ✅
- Módulo não usa filesystem ✅
- Módulo não escreve memória ✅
- Módulo só exporta símbolos internos esperados ✅
- Determinístico: mesma entrada → mesma saída ✅
- Nenhum endpoint `/self-audit` em `nv-enavia.js` ✅
- Nenhum endpoint `/audit/run` em `nv-enavia.js` ✅

---

## 5. Contrato de saída

**VALIDADO** — Todos os campos obrigatórios do `OUTPUT_CONTRACT.md` estão presentes e corretos:

| Campo | Status |
|-------|--------|
| `self_audit.applied` (boolean) | ✅ Sempre `true` |
| `self_audit.mode` (string) | ✅ Sempre `"read_only"` |
| `self_audit.risk_level` (enum) | ✅ `none|low|medium|high|blocking` |
| `self_audit.findings` (array) | ✅ Array com shape canônico |
| `self_audit.should_block` (boolean) | ✅ `true` apenas quando `blocking` |
| `self_audit.warnings` (array) | ✅ Presente e correto |
| `self_audit.next_safe_action` (string) | ✅ Não vazio |
| Finding: `id` | ✅ Formato `SA-NNN` |
| Finding: `category` | ✅ Categoria canônica |
| Finding: `severity` | ✅ Enum válido |
| Finding: `message` | ✅ String |
| Finding: `evidence` | ✅ String |
| Finding: `recommendation` | ✅ String |

---

## 6. Riscos detectados

Categorias confirmadas como funcionais:

| Categoria | Status |
|-----------|--------|
| `secret_exposure` | ✅ Detecta tokens Bearer/OpenAI/GitHub |
| `fake_execution` | ✅ Detecta afirmações de deploy/skill/commit sem evidência |
| `unauthorized_action` | ✅ Detecta pedidos de produção sem aprovação |
| `scope_violation` | ✅ Detecta arquivos proibidos por tipo de PR |
| `contract_drift` | ✅ Detecta proof_failed + advancing |
| `false_capability` | ✅ Detecta `/skills/run`, skill executor, self-audit executor |
| `runtime_vs_documentation_confusion` | ✅ Detecta confusão de componentes documentais |
| `wrong_mode` | ✅ Detecta frustração ativando modo operacional |
| `docs_over_product` | ✅ Detecta reclamações de excesso documental |
| `missing_source` | ⚠️ **PARCIAL** — Não detecta nomes de worker com hífen |

**Categorias ainda sem detector específico (conforme PR56):** `prompt_bloat`, `stale_context`, `regression_risk`.

---

## 7. Blocking e should_block

**VALIDADO:**

- `should_block=true` apenas quando `risk_level === "blocking"` ✅
- `should_block=false` para casos limpos ✅
- `should_block=false` para `wrong_mode` (medium) ✅
- `should_block=false` para `docs_over_product` (medium) ✅
- `should_block=true` para `secret_exposure` (blocking) ✅
- `should_block=true` para `unauthorized_action` (blocking) ✅
- `should_block=true` para `contract_drift` com `proof_failed + advancing` ✅
- `should_block` informativo — não bloqueia fluxo automaticamente ✅

---

## 8. Campo self_audit

**VALIDADO:**

- Campo é aditivo via spread operator ✅
- Não substitui nem remove campos existentes ✅
- Integrado em try/catch defensivo ✅
- Se módulo falhar internamente, campo é omitido mas resposta principal continua ✅
- Não expõe chain-of-thought ✅
- Não expõe segredos em `evidence` ✅

---

## 9. Não alteração automática da resposta

**VALIDADO:**

- `runEnaviaSelfAudit()` não modifica o objeto de input original ✅
- Resultado não contém `reply` ✅
- Resultado não contém `use_planner` ✅
- Resultado contém apenas `self_audit` ✅
- `nv-enavia.js` não tem bloco `if (should_block) { ... }` que altere o fluxo ✅
- `reply` e `use_planner` preservados mesmo com risco `blocking` ✅

---

## 10. Segurança e side effects

**VALIDADO:**

- Nenhum endpoint `/self-audit` criado ✅
- Nenhum endpoint `/audit/run` criado ✅
- Módulo não chama `fetch` ✅
- Módulo não usa `env.KV` ✅
- Módulo não usa filesystem ✅
- Módulo não escreve memória ✅
- Módulo não importa libs externas ✅
- Determinístico: mesma entrada → mesma saída ✅
- Pure function sem side effects ✅

---

## 11. Regressões executadas

| Teste | Resultado |
|-------|-----------|
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

## 12. Riscos restantes

### Risco R1 — missing_source com nomes hiphenados (ENCONTRADO nesta PR57)

**Impacto:** Alto  
**Descrição:** O regex `/o worker\s+\w+\s+já está (ativo|funcionando|online|em produção)/i` usa `\w+` que não captura hífens. Nomes de worker do sistema real usam hífen (ex: `nv-enavia`, `payments-worker`, `nv-workers`). O detector não cobrirá os casos mais comuns.  
**Evidência:** Cenário H do teste PR57 falhou com `responseDraft: "O worker payments-worker já está ativo em produção."` — 0/3 asserts.  
**Correção necessária:** Substituir `\w+` por `[\w\-]+` nos padrões de `_detectMissingSource`.  
**PR de correção:** PR58 — PR-IMPL — Correção cirúrgica do Self-Audit read-only.

### Risco R2 — responseDraft não disponível na posição atual

**Impacto:** Médio (pré-existente, documentado na PR56)  
**Descrição:** Na integração atual, `runEnaviaSelfAudit()` é chamado antes da geração da resposta LLM. O `responseDraft` não está disponível. Detectores que analisam conteúdo da resposta (fake_execution, false_capability, missing_source, runtime_vs_doc_confusion) dependem de injeção via `metadata.responseDraft` ou reposicionamento para após o LLM.  
**Status:** Pré-existente. Documentado na PR56. Correção em PR futura.

### Risco R3 — Categorias sem detector específico

**Impacto:** Baixo (pré-existente)  
**Descrição:** `prompt_bloat`, `stale_context`, `regression_risk` reconhecidas pelo framework mas sem detector em v1.  
**Status:** Pré-existente. Planejado para PRs futuras.

### Risco R4 — should_block informativo

**Impacto:** Baixo (intencional, documentado)  
**Descrição:** `should_block=true` é apenas sinalização. O fluxo de resposta não é bloqueado automaticamente. O bloqueio real será implementado em PR futura conforme contrato.  
**Status:** Intencional nesta fase. Response Policy (PR58+) deve abordar.

---

## 13. Resultado final

**PR57 — Prova do Self-Audit read-only — FALHOU PARCIALMENTE**

- Total: **96/99** (3 falhas — Cenário H)
- Regressões: **1.375/1.375** ✅
- Total geral: **1.471/1.474** ✅ (com 3 falhas reais)

**Contrato de saída:** ✅ Validado  
**Blocking/should_block:** ✅ Validado  
**Campo self_audit aditivo:** ✅ Validado  
**Resposta não alterada:** ✅ Validado  
**Segurança/side effects:** ✅ Validado  
**Regressões:** ✅ Todas verdes  
**Missing source com hífens:** ❌ **Achado real — detector insuficiente**

---

## 14. Próxima PR recomendada

**Conforme contrato PR57: prova falhou parcialmente (Cenário H — 3 falhas reais).**

**Não avançar para Response Policy.**

**PR58 — PR-IMPL — Correção cirúrgica do Self-Audit read-only**

Escopo: Corrigir o detector `_detectMissingSource` em `schema/enavia-self-audit.js`:
- Substituir `\w+` por `[\w\-]+` nos padrões regex de detecção de worker com estado
- Verificar demais padrões para cobertura de nomes hiphenados
- Re-executar PR57 completa após correção para confirmar 99/99 ✅
- Apenas após PR57 passar 99/99 será possível avançar para Response Policy (PR59+)

---

## Smoke tests finais

```bash
node --check schema/enavia-self-audit.js
# → SYNTAX OK

node --check tests/pr57-self-audit-readonly.prova.test.js
# → SYNTAX OK

node tests/pr57-self-audit-readonly.prova.test.js
# → Total: 99 | ✅ Passaram: 96 | ❌ Falharam: 3
# → Falhas: H1, H2, H3 (missing_source com nome hiphenado)

node tests/pr56-self-audit-readonly.smoke.test.js
# → 64/64 ✅
```
