# PR54 — Prova de Memória Contextual

**Data:** 2026-05-01
**Tipo:** `PR-PROVA`
**Branch:** `copilot/claudepr54-prova-memoria-contextual`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR53 ✅ (PR-IMPL — Retrieval por Intenção — 82/82 smoke + 1.290/1.290 regressões)

---

## 1. Objetivo

Provar que o Retrieval por Intenção v1 (PR53) funciona como **memória contextual read-only** no fluxo real do prompt/chat da Enavia:

- O contexto recuperado aparece no prompt quando `applied=true`.
- O contexto **não** aparece quando `applied=false`.
- O contexto é coerente com intenção/skill.
- O bloco não ativa modo operacional sozinho.
- O bloco não executa skill, não cria `/skills/run`, não inventa capacidade.
- O bloco não expõe markdown inteiro nem conteúdo sensível.
- O campo `intent_retrieval` é aditivo e seguro.

**Escopo:** `PR-PROVA` pura. Nenhum runtime alterado. Nenhum LLM externo chamado.

---

## 2. PR53 validada

| Campo | Valor |
|-------|-------|
| Tipo | PR-IMPL cirúrgica |
| Branch | `copilot/claudepr53-impl-retrieval-por-intencao` |
| Arquivo criado | `schema/enavia-intent-retrieval.js` |
| Função principal | `buildIntentRetrievalContext()` |
| Snapshot | 4 skills documentais + 5 intenções sem skill |
| Limite | 2.000 chars, truncamento seguro com `[intent-retrieval-truncated]` |
| Integração | `buildChatSystemPrompt` seção `7d` + campo `intent_retrieval` no response do `/chat/run` |
| Smoke PR53 | 82/82 ✅ |
| Regressões | 1.290/1.290 ✅ |
| Garantias | Determinístico, sem KV, sem rede, sem FS, sem execução de skill, `/skills/run` inexistente |

---

## 3. Cenários testados

13 cenários (A–M), totalizando **93 asserts**.

| Cenário | Mensagem | Intent | Skill | Applied |
|---------|----------|--------|-------|---------|
| A | `revise a PR 214` | `pr_review` | `CONTRACT_AUDITOR` | ✅ true |
| B | `oi` | `conversation` | — | ✅ false |
| C | `mande a próxima PR` | `next_pr_request` | `CONTRACT_LOOP_OPERATOR` | ✅ true |
| D | `revise a PR 214 e veja se quebrou algo` | `pr_review` | `CONTRACT_AUDITOR` | ✅ true |
| E | `deploya em test` | `deploy_request` | `DEPLOY_GOVERNANCE_OPERATOR` | ✅ true |
| F | `quais workers existem?` | `unknown`/`system_state` | `SYSTEM_MAPPER` (via routing) | ✅ true |
| G | `isso está virando só documento` | `frustration_or_trust_issue` | — (intent block) | ✅ true |
| H | `você já tem Skill Router?` | `capability_question` | `SYSTEM_MAPPER` (via intent map) | ✅ true |
| I | `isso vale a pena agora?` | `strategy_question` | — (intent block) | ✅ true |
| J | vários (truncamento) | — | `CONTRACT_AUDITOR` | ✅ trunca corretamente |
| K | `revise a PR 214` | — | — | ✅ shape canônico + inspeção |
| L | vários (segurança) | — | — | ✅ nenhuma violação |
| M | vários (regressão) | — | — | ✅ sem regressão |

---

## 4. Resultado por cenário

### Cenário A — Retrieval aplicado entra no prompt (10/10 ✅)
- intent=`pr_review` ✅
- skill=`CONTRACT_AUDITOR` ✅
- `applied=true` ✅
- Prompt contém `CONTEXTO RECUPERADO POR INTENÇÃO — READ-ONLY` ✅
- Prompt contém contexto de revisão de PR ✅
- Prompt contém LLM Core ✅
- Prompt contém Brain Context ✅
- Prompt contém envelope JSON ✅
- mode=`read_only` ✅
- context_block é string não vazia ✅

### Cenário B — Retrieval não aplicado não entra no prompt (5/5 ✅)
- `applied=false` para `oi` ✅
- Prompt SEM retrieval NÃO contém `CONTEXTO RECUPERADO POR INTENÇÃO — READ-ONLY` ✅
- LLM Core presente ✅
- Brain Context presente ✅
- `MODO OPERACIONAL ATIVO` não ativado ✅

### Cenário C — Contract Loop contextual (7/7 ✅)
- skill=`CONTRACT_LOOP_OPERATOR` ✅
- `applied=true` ✅
- Prompt contém referência ao loop contratual ✅
- Contexto orienta resposta curta + prompt completo ✅
- `is_operational=false` para `next_pr_request` ✅
- intent=`next_pr_request` ✅
- context_block menciona próxima PR ou loop ✅

### Cenário D — Contract Auditor contextual com modo operacional (5/5 ✅)
- skill=`CONTRACT_AUDITOR` ✅
- `applied=true` ✅
- context_block contém escopo/arquivos alterados/regressões/evidência ✅
- `is_operational=true` para `pr_review` ✅
- `MODO OPERACIONAL ATIVO` aparece no prompt operacional ✅
- Contexto não assume merge sem evidência ✅

### Cenário E — Deploy Governance contextual (5/5 ✅)
- skill=`DEPLOY_GOVERNANCE_OPERATOR` ✅
- `applied=true` ✅
- context_block contém gate + aprovação ✅
- context_block menciona test + prod + rollback ✅
- Contexto não autoriza deploy sozinho ✅
- Contexto não relaxa gates ✅

### Cenário F — System Mapper contextual (5/5 ✅)
- `SYSTEM_MAPPER` via routing direto ✅
- `applied=true` ✅
- context_block menciona mapa/registries ✅
- Contexto orienta não inventar worker/rota/binding ✅
- Determinístico (sem KV/rede/FS) ✅

### Cenário G — Frustração sem skill (7/7 ✅)
- intent=`frustration_or_trust_issue` ✅
- `applied=true` (via intent block, sem skill de routing) ✅
- context_block menciona excesso documental ✅
- context_block contém `"Isso é opcional. Não mexa agora."` ✅
- `is_operational=false` ✅
- `MODO OPERACIONAL ATIVO` não aparece no prompt ✅

### Cenário H — Capacidade/estado sem falsa capacidade (5/5 ✅)
- `applied=true` ✅
- Contexto diferencia capacidade atual vs futura ✅
- Prompt não contém afirmação positiva falsa de `/skills/run` ✅
- Contexto não finge Skill Executor disponível ✅
- Contexto afirma que Skill Router é read-only e `/skills/run` não existe ✅

### Cenário I — Estratégia sem modo pesado (5/5 ✅)
- intent=`strategy_question` ✅
- `applied=true` ✅
- context_block orienta ponderar custo/tempo/risco ✅
- `is_operational=false` ✅
- `MODO OPERACIONAL ATIVO` não aparece ✅
- Contexto não cria ação automática ✅

### Cenário J — Limite e truncamento (7/7 ✅)
- `actual_chars <= max_chars` com `_max_chars=50` ✅ (actual=50)
- `truncated=true` quando `max_chars` pequeno ✅
- context_block contém `[intent-retrieval-truncated]` quando truncado ✅
- mode=`read_only` preservado mesmo com truncamento ✅
- Sem `_max_chars` → `truncated=false` ✅
- context_block normal sem marcador de truncamento ✅
- `actual_chars` normal = 485 <= 2000 ✅
- warnings menciona truncamento quando truncado ✅

### Cenário K — Campo `intent_retrieval` (10/10 ✅)
- `applied` é boolean ✅
- `mode` é string ✅
- `intent` é string|null ✅
- `skill_id` é string|null ✅
- `sources` é array ✅
- `token_budget_hint` com `max_chars`, `actual_chars` e `truncated` ✅
- `warnings` é array ✅
- campo `intent_retrieval` existe no response do `/chat/run` (inspeção) ✅
- `context_block` NÃO está no response do `/chat/run` (apenas metadados) ✅
- warnings não vazio para resultado aplicado ✅

### Cenário L — Segurança (7/7 ✅)
- `/skills/run` não tem rota de pathname registrada no worker ✅
- Retrieval determinístico (sem KV/rede/FS) ✅
- context_block é compacto (485 chars < 1500 — não é markdown completo) ✅
- context_block não contém secrets ✅
- context_block não ecoa mensagem do usuário (sem vazamento de input) ✅
- Determinístico para `deploya em test` ✅
- mode=`read_only` em todos os casos ✅

### Cenário M — Não regressão de operação (9/9 ✅)
- Conversa simples sem `MODO OPERACIONAL ATIVO` ✅
- `next_pr_request` → `is_operational=false` (sem modo pesado) ✅
- Revisão de PR → `is_operational=true` ✅
- `MODO OPERACIONAL ATIVO` presente no prompt operacional ✅
- Deploy → `is_operational=true` ✅
- read_only aparece como gate de execução, não regra de tom ✅
- context_block do retrieval não contém `MODO OPERACIONAL ATIVO` ✅
- Retrieval aplicado sem `is_operational=true` NÃO ativa modo operacional ✅
- LLM Core sempre presente ✅
- Envelope JSON sempre presente ✅

---

## 5. Retrieval aplicado no prompt

**Provado em**: Cenários A, C, D, E, F, G, H, I.

Quando `applied=true`, o `buildChatSystemPrompt` injeta:
```
CONTEXTO RECUPERADO POR INTENÇÃO — READ-ONLY
Este bloco orienta a resposta com base na intenção detectada.
Não autoriza execução de skill. Não ativa modo operacional sozinho.
<context_block do retrieval>
```

O marcador canônico `CONTEXTO RECUPERADO POR INTENÇÃO — READ-ONLY` foi verificado em todos os cenários com `applied=true`.

---

## 6. Retrieval omitido quando não aplicado

**Provado em**: Cenário B (`oi`).

- `buildIntentRetrievalContext({ message: "oi" })` → `applied=false`
- `buildChatSystemPrompt({})` (sem `intent_retrieval_context`) → NÃO contém o marcador canônico
- LLM Core e Brain Context permanecem presentes
- Nenhum modo operacional ativado

---

## 7. Contexto por skill

| Skill | Mensagem de teste | Applied | Conteúdo validado |
|-------|-------------------|---------|-------------------|
| `CONTRACT_AUDITOR` | `revise a PR 214` | ✅ | escopo, arquivos, regressões, evidência |
| `CONTRACT_LOOP_OPERATOR` | `mande a próxima PR` | ✅ | loop PR a PR, resposta curta, próxima PR |
| `DEPLOY_GOVERNANCE_OPERATOR` | `deploya em test` | ✅ | gate, aprovação, test/prod, rollback |
| `SYSTEM_MAPPER` | `quais workers existem?` | ✅ | mapa/registries, não inventar worker/binding |

---

## 8. Contexto por intenção sem skill

| Intenção | Mensagem de teste | Applied | Skill routing | Conteúdo validado |
|----------|-------------------|---------|---------------|-------------------|
| `frustration_or_trust_issue` | `isso está virando só documento` | ✅ | sem match | excesso documental, "Isso é opcional. Não mexa agora." |
| `strategy_question` | `isso vale a pena agora?` | ✅ | sem match | custo/tempo/risco, sem ação automática |

Nota: Para `capability_question` (`você já tem Skill Router?`), o intent mapping ativa `SYSTEM_MAPPER` via `_INTENT_TO_SKILL`. O contexto é documental, diferenciando capacidade atual vs futura.

---

## 9. Limite e truncamento

- Limite padrão: **2.000 chars**.
- Com `_max_chars=50`: truncamento ocorre, `actual_chars=50`, marcador `[intent-retrieval-truncated]` presente.
- Sem limite pequeno: `actual_chars=485` (CONTRACT_AUDITOR), `truncated=false`.
- mode=`read_only` **preservado** mesmo com truncamento.
- warnings menciona truncamento quando ocorre.
- context_block normal **não** contém marcador de truncamento.

---

## 10. Campo `intent_retrieval`

### Shape canônico validado (unitário)

```js
{
  applied: boolean,          // K1 ✅
  mode: "read_only",         // K2 ✅
  intent: string | null,     // K3 ✅
  skill_id: string | null,   // K4 ✅
  sources: string[],         // K5 ✅
  token_budget_hint: {
    max_chars: number,       // K6 ✅
    actual_chars: number,    // K6 ✅
    truncated: boolean,      // K6 ✅
  },
  warnings: string[],        // K7 ✅
}
```

### context_block não exposto no response

Validado por **inspeção de código** (`K8a`, `K8b`):

O campo `intent_retrieval` no response do `/chat/run` (linha ~4656 de `nv-enavia.js`) contém apenas:
```js
intent_retrieval: {
  applied, mode, intent, skill_id,
  sources, token_budget_hint, warnings
}
```

`context_block` **não** está neste objeto — apenas no prompt interno do sistema.

### Limitação documentada

Não há harness seguro para testar o response do `/chat/run` sem LLM externo real (requer binding de AI worker Cloudflare + KV). A validação foi feita por:
1. Inspeção de código (`nv-enavia.js`) — resultado `K8b: ✅`
2. Teste unitário do shape de `buildIntentRetrievalContext()` — `K1–K9: ✅`

---

## 11. Segurança e falsa capacidade

| Verificação | Resultado |
|-------------|-----------|
| `/skills/run` sem rota de pathname no worker | ✅ |
| Retrieval determinístico (pure function, sem KV/rede/FS) | ✅ |
| context_block compacto (485 chars, não markdown completo) | ✅ |
| context_block sem secrets | ✅ |
| context_block não ecoa mensagem do usuário | ✅ |
| mode=`read_only` em todos os casos | ✅ |
| Prompt não contém afirmação positiva falsa de `/skills/run` | ✅ |
| Contexto não finge Skill Executor disponível | ✅ |
| Contexto não finge execução de skill | ✅ |

---

## 12. Não regressão de operação

| Verificação | Resultado |
|-------------|-----------|
| Conversa simples sem `MODO OPERACIONAL ATIVO` | ✅ |
| `next_pr_request` sem modo pesado | ✅ |
| Revisão de PR continua operacional | ✅ |
| Deploy continua operacional com gates | ✅ |
| read_only continua gate, não tom | ✅ |
| context_block do retrieval não ativa modo operacional | ✅ |
| Retrieval sem `is_operational` NÃO ativa modo pesado | ✅ |
| LLM Core sempre presente | ✅ |
| Envelope JSON sempre presente | ✅ |

---

## 13. Regressões executadas

| Teste | Asserts | Resultado |
|-------|---------|-----------|
| `tests/pr53-intent-retrieval.smoke.test.js` | 82/82 | ✅ |
| `tests/pr52-skill-routing-runtime.prova.test.js` | 202/202 | ✅ |
| `tests/pr51-skill-router-readonly.smoke.test.js` | 168/168 | ✅ |
| `tests/pr50-intent-runtime.prova.test.js` | 124/124 | ✅ |
| `tests/pr49-intent-classifier.smoke.test.js` | 96/96 | ✅ |
| `tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` | 20/20 | ✅ |
| `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` | 79/79 | ✅ |
| `tests/pr46-llm-core-v1.smoke.test.js` | 43/43 | ✅ |
| `tests/pr44-brain-loader-chat-runtime.prova.test.js` | 38/38 | ✅ |
| `tests/pr43-brain-loader-readonly.smoke.test.js` | 32/32 | ✅ |
| `tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | 56/56 | ✅ |
| `tests/pr36-chat-runtime-anti-bot.smoke.test.js` | 26/26 | ✅ |
| `tests/pr21-loop-status-states.smoke.test.js` | 53/53 | ✅ |
| `tests/pr20-loop-status-in-progress.smoke.test.js` | 27/27 | ✅ |
| `tests/pr19-advance-phase-e2e.smoke.test.js` | 52/52 | ✅ |
| `tests/pr14-executor-deploy-real-loop.smoke.test.js` | 183/183 | ✅ |
| `tests/pr13-hardening-operacional.smoke.test.js` | 91/91 | ✅ |
| **TOTAL REGRESSÕES** | **1.372/1.372** | **✅** |

**Grand total (PR54 + regressões): 93 + 1.372 = 1.465/1.465 ✅**

---

## 14. Riscos restantes

1. **Harness de /chat/run sem LLM**: Não foi possível testar o response real do `/chat/run` sem um binding de AI worker. A validação do campo `intent_retrieval` foi feita por inspeção de código e teste unitário. Risco baixo — a inspeção confirma que `context_block` não está exposto.

2. **Cobertura de intenções futuras**: O retrieval cobre 4 skills documentais + 5 intenções sem skill. Intenções adicionais (ex.: `identity_question`, `technical_diagnosis`) não têm contexto específico — aplicam `applied=false`. Isso é comportamento correto e conservador.

3. **Limits em produção**: O limite de 2.000 chars é defensivo. Em produção real, o context_block para CONTRACT_AUDITOR tem 485 chars (medido), bem dentro do limite. Sem risco imediato.

4. **Intent mapping vs routing**: Para `capability_question`, o routing não detecta skill diretamente — o intent mapping em `_INTENT_TO_SKILL` mapeia para `SYSTEM_MAPPER`. Isso é correto mas requer que o classificador de intenção seja preciso para este tipo de pergunta.

---

## 15. Resultado final

**✅ PASSOU — 93/93 + 1.372/1.372 = 1.465/1.465**

Memória contextual read-only da Enavia v1 validada:
- Retrieval por intenção funciona como memória contextual no fluxo real do prompt.
- Contexto aplicado aparece no prompt com marcador canônico.
- Contexto não aplicado não contamina o prompt.
- Contexto é coerente com intenção e skill.
- Nenhum runtime alterado.
- Nenhum endpoint criado.
- `/skills/run` continua inexistente.
- Nenhuma skill executada.
- Campo `intent_retrieval` aditivo e seguro.
- Falsa capacidade bloqueada.
- Não regressão operacional confirmada.

---

## 16. Próxima PR recomendada

**Todos os testes passaram → Próxima PR autorizada:**

```
PR55 — PR-DOCS — Self-Audit Framework
```

Contrato ativo: `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`

> Memória contextual read-only v1 provada. Intent Retrieval, Skill Router, Intent Classifier, LLM Core e Brain Loader todos funcionando como stack coerente e testado. Nenhum endpoint de execução criado. Sistema pronto para documentar o Self-Audit Framework como próxima fase.
