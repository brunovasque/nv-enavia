# PR59 — Response Policy viva

**Data:** 2026-05-01
**Branch:** `copilot/claudepr59-impl-response-policy-viva`
**Tipo:** `PR-IMPL` (Worker-only)
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR58 ✅ (Self-Audit v1 completo — 99/99)

---

## 1. Objetivo

Implementar a Response Policy viva da Enavia: uma camada de política de resposta que usa os sinais já existentes no fluxo (intenção, skill routing, retrieval, self_audit, modo operacional, contexto) para orientar como a Enavia deve responder de forma mais viva, honesta, estratégica e segura.

A Response Policy transforma os achados do Self-Audit em orientação de resposta — sem executar nada automaticamente, sem bloquear programaticamente e sem criar endpoint.

---

## 2. Diagnóstico usado

- **PR55 (PR-DOCS):** Framework do Self-Audit documentado — categorias, sinais, risk model, escalation policy, output contract.
- **PR56 (PR-IMPL):** `schema/enavia-self-audit.js` implementado e integrado — 10 categorias de risco, campo aditivo `self_audit`.
- **PR57 (PR-PROVA):** Self-Audit provado com 99/99 asserts (após PR58).
- **PR58 (PR-IMPL cirúrgica):** Correção do `_detectMissingSource` — regex `\w+` → `[\w-]+`.
- **PR49–PR53:** Intent Classifier, Skill Router, Intent Retrieval — base de sinais disponíveis para a policy.

---

## 3. Arquitetura implementada

```
Input do fluxo
    ↓
buildEnaviaResponsePolicy(input)
    ├── intentClassification.intent
    ├── selfAudit.findings[].category
    ├── selfAudit.should_block / risk_level
    ├── isOperationalContext
    └── (message, context, skillRouting, intentRetrieval — disponíveis)
    ↓
ResponsePolicyResult
    ├── applied: true
    ├── mode: "read_only"
    ├── response_style: conversational|strategic|operational|corrective|blocking_notice
    ├── should_adjust_tone: boolean
    ├── should_warn: boolean
    ├── should_refuse_or_pause: boolean
    ├── policy_block: string (orientação compacta)
    ├── warnings: string[]
    └── reasons: string[]
    ↓
buildResponsePolicyPromptBlock(policy)
    └── "POLÍTICA DE RESPOSTA VIVA — READ-ONLY\n{policy_block}"
    ↓
buildChatSystemPrompt(opts) ← seção 7e
    └── injetado APÓS Intent Retrieval, ANTES do envelope JSON
```

---

## 4. Relação com Self-Audit

| Self-Audit | Response Policy |
|---|---|
| Detecta risco | Orienta como responder |
| Produz findings com category/severity | Policy lê findings e gera policy_block |
| `should_block=true` → risco de bloqueio | `should_refuse_or_pause=true` → orientação no prompt |
| Read-only | Read-only |
| Campo aditivo no response | Campo aditivo no response |
| Não altera reply | Não altera reply |
| Não bloqueia programaticamente | Não bloqueia programaticamente |

**Nesta PR:** `should_refuse_or_pause=true` é orientação para o prompt LLM — não é bloqueio mecânico. A resposta principal continua retornando normalmente. A policy influencia o LLM via injeção de texto no system prompt.

---

## 5. Regras de resposta implementadas

| Categoria/Intenção | Estilo | should_warn | should_refuse_or_pause | Comportamento |
|---|---|---|---|---|
| Caso limpo (conversation, identity, capability) | conversational | false | false | policy_block vazio ou mínimo |
| `strategy_question` | strategic | false | false | custo/tempo/risco, obrigatório vs opcional, próximo passo |
| `next_pr_request` | operational | false | false | resposta curta, prompt completo, seguir contrato |
| `pr_review` | operational | false | false | escopo, arquivos, testes, regressões, governança, evidência |
| `deploy_request` | operational | true | false | gate/aprovação, separar test/prod, não afirmar deploy sem prova |
| `frustration_or_trust_issue` / `docs_over_product` | corrective | false | false | sinceridade, "Isso é opcional", sem modo operacional pesado |
| `false_capability` | corrective | true | false (se high) / true (se blocking) | marcar documental/read-only/futuro |
| `fake_execution` | corrective → blocking_notice | true | false (se high) / true (se blocking) | não afirmar execução, pedir evidência |
| `runtime_vs_documentation_confusion` | corrective | true | false | separar runtime de documental |
| `unauthorized_action` | corrective → blocking_notice | true | true (se blocking) | gate/aprovação obrigatória |
| `scope_violation` / `contract_drift` | corrective | true | false | parar avanço, corrigir escopo, voltar ao contrato |
| `secret_exposure` | blocking_notice | true | true | remover segredo, não expor dado sensível |

---

## 6. Integração com prompt

Arquivo modificado: `schema/enavia-cognitive-runtime.js`

- Import adicionado: `import { buildResponsePolicyPromptBlock } from "./enavia-response-policy.js";`
- Parâmetro adicionado em `buildChatSystemPrompt()`: `response_policy?: object`
- Seção `7e` adicionada: injeção do bloco APÓS Intent Retrieval (7d), ANTES do envelope JSON (8)
- Condição: `response_policy.applied === true` E `policy_block` não vazio
- Bloco injetado: `"POLÍTICA DE RESPOSTA VIVA — READ-ONLY\n{policy_block}"`
- Se `should_warn=true` e `warnings[0]` existe: alerta é adicionado ao bloco
- Sem policy ou policy_block vazio → nada é injetado

**O LLM Core, Brain Context, Intent Retrieval e envelope JSON continuam intactos.**

---

## 7. Integração com chat/run

Arquivo modificado: `nv-enavia.js`

- Import adicionado: `import { buildEnaviaResponsePolicy } from "./schema/enavia-response-policy.js";`
- Chamada após `_selfAudit` (linhas ~4137–4156): `buildEnaviaResponsePolicy(...)` com todos os sinais do fluxo
- Falha com segurança: `try/catch` → `_responsePolicy = null` se falhar
- `buildChatSystemPrompt(...)` recebe `response_policy: _responsePolicy || undefined`
- Campo aditivo no response: `response_policy` com metadados seguros (sem `policy_block` inteiro)
- Campos expostos no response: `applied`, `mode`, `response_style`, `should_adjust_tone`, `should_warn`, `should_refuse_or_pause`, `warnings`, `reasons`

---

## 8. O que foi alterado

| Arquivo | Tipo | O que mudou |
|---|---|---|
| `schema/enavia-response-policy.js` | **NOVO** | Módulo completo com `buildEnaviaResponsePolicy()` e `buildResponsePolicyPromptBlock()` |
| `schema/enavia-cognitive-runtime.js` | Modificado | Import + parâmetro `response_policy` + seção 7e no prompt |
| `nv-enavia.js` | Modificado | Import + chamada após self_audit + campo aditivo no response |
| `tests/pr59-response-policy-viva.smoke.test.js` | **NOVO** | 96 asserts, cenários A–O |
| `schema/reports/PR59_IMPL_RESPONSE_POLICY_VIVA.md` | **NOVO** | Este relatório |
| `schema/contracts/INDEX.md` | Governança | PR59 ✅, próxima PR60 |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Governança | Atualizado |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Governança | Atualizado |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Governança | Atualizado |

---

## 9. O que NÃO foi alterado

- **Não executa nada:** policy_block é texto de orientação — não dispara ação
- **Não cria endpoint:** nenhuma rota `/response-policy`, `/self-audit`, `/audit/run` ou `/skills/run` foi criada
- **Não escreve memória:** nenhum `writeMemory()` ou KV write
- **Não altera resposta automaticamente:** `reply` e `use_planner` não são modificados pela policy
- **Não bloqueia resposta programaticamente:** `should_refuse_or_pause=true` é orientação de prompt, não interceptação de resposta
- **Não chama LLM externo:** pure function, sem fetch
- **Não usa KV/rede/filesystem:** determinístico, sem side-effects
- **Não altera painel:** panel/src/ intocado
- **Não altera deploy/gates:** wrangler.toml, wrangler.executor.template.toml intocados
- **Não implementa runtime de skills:** /skills/run não existe, skill_routing permanece read-only
- **Não remove módulos:** LLM Core, Brain Loader, Intent Classifier, Skill Router, Intent Retrieval, Self-Audit — todos intactos
- **Não altera sanitizers:** os dois layers de sanitização em nv-enavia.js permanecem intocados
- **Não altera executor, workflows ou secrets**

---

## 10. Testes executados

### Smoke PR59

```
node tests/pr59-response-policy-viva.smoke.test.js
```

**Resultado: 96/96 ✅**

Cenários:
- A — Shape básico (13 asserts)
- B — Caso limpo (6 asserts)
- C — Frustração / docs over product (7 asserts)
- D — Próxima PR (4 asserts)
- E — Revisão de PR (3 asserts)
- F — Deploy / produção (8 asserts)
- G — False capability (3 asserts)
- H — Fake execution (5 asserts)
- I — Secret exposure blocking (7 asserts)
- J — Scope violation / contract drift (5 asserts)
- K — Estratégia (4 asserts)
- L — Integração com prompt (8 asserts)
- M — /chat/run shape por inspeção de código (6 asserts)
- N — Não alteração automática de resposta (4 asserts)
- O — Segurança / side effects (15 asserts)

---

## 11. Regressões

Todos os testes abaixo foram executados e passaram:

| Teste | Resultado |
|---|---|
| pr57-self-audit-readonly.prova.test.js | 99/99 ✅ |
| pr56-self-audit-readonly.smoke.test.js | 64/64 ✅ |
| pr54-memoria-contextual.prova.test.js | 93/93 ✅ |
| pr53-intent-retrieval.smoke.test.js | 82/82 ✅ |
| pr52-skill-routing-runtime.prova.test.js | 202/202 ✅ |
| pr51-skill-router-readonly.smoke.test.js | 168/168 ✅ |
| pr50-intent-runtime.prova.test.js | 124/124 ✅ |
| pr49-intent-classifier.smoke.test.js | 96/96 ✅ |
| pr48-correcao-cirurgica-llm-core-v1.smoke.test.js | ✅ |
| pr47-resposta-viva-llm-core-v1.prova.test.js | ✅ |
| pr46-llm-core-v1.smoke.test.js | ✅ |
| pr44-brain-loader-chat-runtime.prova.test.js | 38/38 ✅ |
| pr43-brain-loader-readonly.smoke.test.js | 32/32 ✅ |
| pr37-chat-runtime-anti-bot-real.smoke.test.js | 56/56 ✅ |
| pr36-chat-runtime-anti-bot.smoke.test.js | 26/26 ✅ |
| pr21-loop-status-states.smoke.test.js | 53/53 ✅ |
| pr20-loop-status-in-progress.smoke.test.js | 27/27 ✅ |
| pr19-advance-phase-e2e.smoke.test.js | 52/52 ✅ |
| pr14-executor-deploy-real-loop.smoke.test.js | 183/183 ✅ |
| pr13-hardening-operacional.smoke.test.js | 91/91 ✅ |

**Total regressões: 1.375/1.375 ✅ (sem novos testes PR59 = 1.471/1.471)**

---

## 12. Riscos restantes

- **Risco baixo — cobertura de prompt LLM:** A policy orienta o LLM via texto no system prompt. A eficácia real depende do LLM respeitar as orientações — não há garantia mecânica (intencional por design: não é bloqueio programático).
- **Risco baixo — policy_block como checklist visual:** Em alguns cenários o policy_block pode ficar parecido com checklist se intenções múltiplas forem ativadas simultâneamente. O bloco foi mantido compacto com separador " | ".
- **Risco baixo — intent `execution_request`:** Rota para deploy block idêntico ao `deploy_request`. Aceitável para esta versão.
- **Não implementado nesta PR (previsto em PRs futuras):** Prova formal da Response Policy (PR60).

---

## 13. Próxima PR recomendada

**PR60 — PR-PROVA — Prova anti-bot final**

> Smoke PR59 passou 96/96 ✅. Regressões 1.375/1.375 ✅. Response Policy viva implementada, integrada ao prompt e ao /chat/run. Nenhuma regressão. Próxima PR autorizada: PR60 — PR-PROVA — Prova anti-bot final.
