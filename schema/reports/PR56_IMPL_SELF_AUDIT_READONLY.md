# PR56 — Self-Audit read-only

**Tipo:** PR-IMPL (Worker-only, campo aditivo)
**Branch:** `copilot/claudepr56-impl-self-audit-readonly`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR55 ✅ (PR-DOCS — Self-Audit Framework documental)

---

## 1. Objetivo

Implementar o Self-Audit read-only runtime da Enavia: módulo determinístico que analisa os metadados do fluxo de chat e retorna um campo aditivo `self_audit` na resposta do `/chat/run`.

O Self-Audit v1 é somente leitura — observa e sinaliza riscos, sem alterar respostas, bloquear fluxo automaticamente, criar endpoints, escrever memória ou chamar LLM externo.

---

## 2. Framework usado

Baseado integralmente nos documentos criados na PR55:

- `schema/self-audit/OUTPUT_CONTRACT.md` — contrato de saída JSON
- `schema/self-audit/RISK_MODEL.md` — 5 níveis de risco, 13 categorias
- `schema/self-audit/SIGNALS.md` — 30+ sinais de detecção (FC, OP, ED, DC, SEC)
- `schema/self-audit/FRAMEWORK.md` — 10 camadas conceituais
- `schema/self-audit/CHECKLISTS.md` — checklists A–F

---

## 3. Arquitetura implementada

```
message
  → intent classification (enavia-intent-classifier.js) ← já existia
  → skill routing (enavia-skill-router.js)               ← já existia
  → intent retrieval (enavia-intent-retrieval.js)        ← já existia
  → isOperationalContext determinado                     ← já existia
  → Self-Audit read-only (enavia-self-audit.js)          ← PR56 ✅
  → response final com campo aditivo self_audit          ← PR56 ✅
```

O módulo `runEnaviaSelfAudit(input)` recebe os metadados disponíveis e retorna `{ self_audit: { ... } }` conforme o contrato de saída.

A integração em `nv-enavia.js` é defensiva: qualquer falha interna do módulo resulta em `_selfAudit = null` e o campo é omitido, sem quebrar a resposta principal.

---

## 4. Categorias implementadas

As 10 categorias obrigatórias v1 foram implementadas com detectores específicos:

| Categoria | Detector | Severidade padrão |
|---|---|---|
| `secret_exposure` | `_detectSecretExposure` | `blocking` |
| `fake_execution` | `_detectFakeExecution` | `blocking` |
| `unauthorized_action` | `_detectUnauthorizedAction` | `blocking` |
| `scope_violation` | `_detectScopeViolation` | `blocking` |
| `contract_drift` | `_detectContractDrift` | `blocking` / `high` |
| `false_capability` | `_detectFalseCapability` | `high` |
| `runtime_vs_documentation_confusion` | `_detectRuntimeVsDocumentationConfusion` | `medium` |
| `wrong_mode` | `_detectWrongMode` | `medium` / `low` |
| `missing_source` | `_detectMissingSource` | `medium` / `low` |
| `docs_over_product` | `_detectDocsOverProduct` | `medium` |

Categorias do RISK_MODEL.md reconhecidas mas não priorizadas nesta v1 (sem detector específico): `prompt_bloat`, `stale_context`, `regression_risk`. Serão adicionadas em PRs futuras conforme ROADMAP.

---

## 5. Regras de risco

- `blocking` — secret exposto, falsa execução, ação não autorizada, violação de escopo, drift com proof_failed+advancing
- `high` — falsa capacidade grave, drift de contrato sem advancing, proof_failed isolado
- `medium` — wrong_mode, missing_source, docs_over_product, runtime_vs_doc_confusion
- `low` — wrong_mode para conversa simples com contexto operacional, missing_source com metadata presente
- `none` — sem findings

`should_block = true` somente quando `risk_level === "blocking"` com evidência real.

---

## 6. Integração com /chat/run

Em `nv-enavia.js`, a integração ocorre:

1. **Posição:** após intent classification, skill routing, intent retrieval e definição de `isOperationalContext` — antes de montar a resposta final.
2. **Chamada:**
   ```js
   const _selfAuditResult = runEnaviaSelfAudit({
     message,
     context,
     intentClassification: _intentClassification || undefined,
     skillRouting:         _skillRouting         || undefined,
     intentRetrieval:      _intentRetrieval      || undefined,
     isOperationalContext,
   });
   _selfAudit = _selfAuditResult?.self_audit ?? null;
   ```
3. **Campo aditivo:**
   ```js
   ...(_selfAudit ? { self_audit: _selfAudit } : {})
   ```
4. **Proteção:** try/catch defensivo — falha interna omite o campo, não quebra a resposta.

**Nota:** O `responseDraft` não está disponível neste ponto do fluxo (a resposta ainda não foi gerada pelo LLM). Os detectores baseados em `responseDraft` serão úteis quando o self-audit for movido para após a resposta LLM, em PR futura. Para esta PR56, a análise é feita sobre os metadados disponíveis: mensagem, context, intent, skill routing, retrieval e isOperationalContext.

---

## 7. O que foi alterado

| Arquivo | Tipo de alteração |
|---|---|
| `schema/enavia-self-audit.js` | **CRIADO** — módulo Self-Audit read-only v1 |
| `nv-enavia.js` | **MODIFICADO** — import + chamada + campo aditivo `self_audit` |
| `tests/pr56-self-audit-readonly.smoke.test.js` | **CRIADO** — 64 asserts, cenários A–N |
| `schema/reports/PR56_IMPL_SELF_AUDIT_READONLY.md` | **CRIADO** — este relatório |
| `schema/contracts/INDEX.md` | **ATUALIZADO** — PR56 ✅, próxima PR57 |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | **ATUALIZADO** |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | **ATUALIZADO** |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | **ATUALIZADO** |

---

## 8. O que NÃO foi alterado

- **Resposta NÃO alterada automaticamente** — `reply` preservado integralmente.
- **Fluxo NÃO bloqueado automaticamente** — `should_block` é campo informativo, não gate de execução nesta PR.
- **Nenhum endpoint criado** — `/self-audit` e `/audit/run` não existem.
- **Nenhuma memória escrita** — zero escrita em KV, Brain, memória contextual.
- **Nenhum LLM externo chamado** — módulo é 100% determinístico.
- **KV/rede/filesystem não usados** — pure function sem side-effects.
- **Panel não alterado** — `panel/` intocado.
- **Deploy/gates não alterados** — workflows, wrangler.toml intocados.
- **Executor não alterado** — `executor/` intocado.
- **Self-Audit Executor não implementado** — esta PR é somente read-only.
- `enavia-cognitive-runtime.js` — não alterado.
- `enavia-llm-core.js` — não alterado.
- `enavia-brain-loader.js` — não alterado.
- `enavia-intent-classifier.js` — não alterado.
- `enavia-skill-router.js` — não alterado.
- `enavia-intent-retrieval.js` — não alterado.

---

## 9. Testes executados

### Smoke PR56

```
node tests/pr56-self-audit-readonly.smoke.test.js
```

**Resultado: 64/64 ✅**

Cenários cobertos:
- A — Shape básico (11 asserts)
- B — Caso limpo
- C — False capability (/skills/run)
- D — Fake execution (deploy afirmado)
- E — Unauthorized action (manda pra produção)
- F — Wrong mode (frustração + isOperationalContext=true)
- G — Docs over product
- H — Missing source
- I — Runtime vs documentation
- J — Secret exposure (Bearer token, should_block=true)
- K — Scope violation (PR-DOCS com nv-enavia.js)
- L — Contract drift (proof_failed + advancing_to_next_phase)
- M — Integração com chat response shape (inspeção de código)
- N — Robustez e edge cases (8 asserts)

---

## 10. Regressões

| Teste | Resultado |
|---|---|
| `node tests/pr54-memoria-contextual.prova.test.js` | 93/93 ✅ |
| `node tests/pr53-intent-retrieval.smoke.test.js` | 82/82 ✅ |
| `node tests/pr52-skill-routing-runtime.prova.test.js` | 202/202 ✅ |
| `node tests/pr51-skill-router-readonly.smoke.test.js` | 168/168 ✅ |
| `node tests/pr50-intent-runtime.prova.test.js` | 124/124 ✅ |
| `node tests/pr49-intent-classifier.smoke.test.js` | 96/96 ✅ |
| `node tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` | 20/20 ✅ |
| `node tests/pr47-resposta-viva-llm-core-v1.prova.test.js` | 79/79 ✅ |
| `node tests/pr46-llm-core-v1.smoke.test.js` | 43/43 ✅ |
| `node tests/pr44-brain-loader-chat-runtime.prova.test.js` | 38/38 ✅ |
| `node tests/pr43-brain-loader-readonly.smoke.test.js` | 32/32 ✅ |
| `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | 56/56 ✅ |
| `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` | 26/26 ✅ |
| `node tests/pr21-loop-status-states.smoke.test.js` | 53/53 ✅ |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` | 27/27 ✅ |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` | 52/52 ✅ |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` | 183/183 ✅ |
| `node tests/pr13-hardening-operacional.smoke.test.js` | 91/91 ✅ |

**Total regressões: 1.375/1.375 ✅**
**Total geral (incluindo PR56): 1.439/1.439 ✅**

---

## 11. Riscos restantes

1. **responseDraft na posição atual** — O detector de `fake_execution`, `false_capability`, `missing_source` e `runtime_vs_documentation_confusion` analisa `responseDraft`, que na integração atual não está disponível (a resposta LLM ainda não foi gerada). Em PR futura (PR57+), o self-audit pode ser movido para após a resposta LLM para análise completa do draft.

2. **Categorias não implementadas em profundidade** — `prompt_bloat`, `stale_context`, `regression_risk` são reconhecidas pelo framework mas sem detector específico nesta v1. Serão adicionadas conforme ROADMAP.

3. **`should_block` informativo** — Nesta PR56, `should_block=true` é apenas sinalização no campo `self_audit`. O fluxo de resposta não é bloqueado automaticamente. O bloqueio real será implementado em PR futura conforme contrato.

4. **Análise de `responseDraft` via metadados externos** — O consumidor do campo `self_audit` pode injetar `responseDraft` via `metadata` para análise mais rica dos detectores de conteúdo.

---

## 12. Próxima PR recomendada

**Todos os testes passaram: PR57 — PR-PROVA — Teste do Self-Audit read-only**

> Criar prova formal do Self-Audit: validar campo `self_audit` no response do `/chat/run`, validar que nenhum runtime foi quebrado, validar que self-audit não altera reply, não bloqueia fluxo, não cria endpoint, não escreve memória. Baseado nos smoke tests PR56 + análise do fluxo real.
