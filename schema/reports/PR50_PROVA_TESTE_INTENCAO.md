# PR50 — Prova do Classificador de Intenção v1

**Data:** 2026-05-01
**Tipo:** PR-PROVA (Worker-only)
**Branch:** `copilot/claudepr50-prova-teste-intencao`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR49 ✅ (PR-IMPL — Classificador de Intenção v1)

---

## 1. Objetivo

Provar formalmente que o Classificador de Intenção v1 implementado na PR49 funciona
corretamente no fluxo real do chat/prompt, preservando anti-bot, LLM Core, Brain Context,
gates e comportamento operacional.

Esta PR é prova pura. Nenhum runtime foi alterado.

---

## 2. PR49 validada

| Item | Status |
|------|--------|
| `schema/enavia-intent-classifier.js` criado | ✅ |
| `isOperationalMessage()` delegando ao classificador | ✅ |
| Campo aditivo `intent_classification` no response | ✅ |
| Smoke PR49 96/96 | ✅ |
| Regressões 697/697 | ✅ |
| Relatório: `schema/reports/PR49_IMPL_CLASSIFICADOR_INTENCAO.md` | ✅ |

---

## 3. Cenários testados

| Cenário | Mensagens | Asserts |
|---------|-----------|---------|
| A — Conversa simples | `oi`, `bom dia`, `tudo bem?` | 12 |
| B — Frustração/desconfiança | `parecendo um bot`, `virando só documento`, `não estou confiando` | 11 |
| C — Identidade/capacidade/estado | `Quem é você?`, `sabe operar?`, `estado atual da Enavia?`, `já tem Skill Router?` | 12 |
| D — Próxima PR | `mande a próxima PR`, `ok, monte a próxima`, `pode mandar a próxima pr` | 10 |
| E — Revisão de PR | `revise a PR 210`, `veja se essa PR quebrou algo`, URL GitHub | 12 |
| F — Diagnóstico técnico | `diagnostique o runtime`, `verifique os logs`, `por que esse endpoint falhou?` | 10 |
| G — Deploy/execução | `deploya em test`, `faça rollback`, `aplique o patch` | 9 |
| H — Contrato | `monte um contrato macro`, `volte ao contrato`, `o que é esse contrato?` | 8 |
| I — Skill | `rode a skill Contract Auditor`, `qual skill devo usar?`, `/skills/run` | 8 |
| J — Memória | `salve isso na memória`, `lembre dessa regra`, `guarde isso` | 8 |
| K — Estratégia | `qual o melhor caminho?`, `isso vale a pena agora?`, `devemos seguir com isso?` | 8 |
| L — Regressões PR37/PR38 | `sistema`, `contrato`, operacional real, conceitual | 7 |
| M — Campo `intent_classification` | inspeção + unitário | 9 |
| **TOTAL** | | **124** |

---

## 4. Resultado por cenário

**124/124 ✅ — todos passaram.**

---

## 5. Conversa e frustração

**Cenário A — Conversa simples:** ✅ 12/12
- `oi`, `bom dia`, `tudo bem?` → `conversation`, `is_operational=false`
- `isOperationalMessage` retorna `false` para todos
- Prompt NÃO injeta `MODO OPERACIONAL ATIVO`
- LLM Core e Brain Context presentes no prompt base

**Cenário B — Frustração/desconfiança:** ✅ 11/11
- `Você está parecendo um bot`, `virando só documento`, `não estou confiando` → `frustration_or_trust_issue`, `is_operational=false`
- `isOperationalMessage` retorna `false` para frustração
- Prompt NÃO injeta `MODO OPERACIONAL ATIVO`
- Prompt contém regra de reconhecer com sinceridade (PR48 LLM Core)
- Prompt contém `Isso é opcional. Não mexa agora.`
- Prompt orienta puxar para execução concreta

---

## 6. Identidade, capacidade e estado

**Cenário C:** ✅ 12/12
- `Quem é você?` → `identity_question`, `is_operational=false`
- `Você sabe operar seu sistema?` → `capability_question`, `is_operational=false`
- `Qual o estado atual da Enavia?` → `system_state_question`, `is_operational=false`
- `Você já tem Skill Router?` → `capability_question` (NÃO `skill_request`) — classificado antes de skill, `is_operational=false`
- Nenhum ativa modo operacional pesado
- Falsa capacidade bloqueada no prompt: Skill Router runtime e `/skills/run` marcados como inexistentes

---

## 7. Próxima PR

**Cenário D:** ✅ 10/10
- `mande a próxima PR`, `ok, monte a próxima`, `pode mandar a próxima pr` → `next_pr_request`, `is_operational=false`
- `isOperationalMessage` retorna `false` para todos
- MODO OPERACIONAL ATIVO NÃO injetado
- Prompt contém orientação de resposta curta + prompt completo
- Prompt contém sem reabrir discussão desnecessária

---

## 8. Revisão de PR e diagnóstico técnico

**Cenário E — Revisão de PR:** ✅ 12/12
- `revise a PR 210` → `pr_review`, `is_operational=true`
- `veja se essa PR quebrou algo` → `pr_review`, `is_operational=true`
- URL `https://github.com/brunovasque/nv-enavia/pull/210` → `pr_review`, `is_operational=true`
- `isOperationalMessage` retorna `true`
- `MODO OPERACIONAL ATIVO` injetado corretamente
- Contrato + aprovação exigidos
- Sem deploy automático
- LLM Core e Brain Context presentes em contexto operacional

**Cenário F — Diagnóstico técnico:** ✅ 10/10
- `diagnostique o runtime`, `verifique os logs do worker`, `por que esse endpoint falhou?` → `technical_diagnosis`, `is_operational=true`
- `isOperationalMessage` retorna `true`
- `MODO OPERACIONAL ATIVO` injetado
- LLM Core e Brain Context coexistem em modo operacional

---

## 9. Deploy, execução e contrato

**Cenário G — Deploy/execução:** ✅ 9/9
- `deploya em test` → `deploy_request`, `is_operational=true`
- `faça rollback` → `deploy_request`, `is_operational=true`
- `aplique o patch` → `execution_request`, `is_operational=true`
- Modo operacional ativo no prompt
- Execução exige contrato + aprovação humana explícita
- Gates NÃO relaxados

**Cenário H — Contrato:** ✅ 8/8
- `monte um contrato macro` → `contract_request`, `is_operational=true`
- `volte ao contrato` → `contract_request`, `is_operational=true`
- `o que é esse contrato?` → `is_operational=false` (pergunta conceitual)
- Palavra `contrato` isolada NÃO ativa operacional (regressão PR38)
- `explique o que é o contrato Jarvis Brain` NÃO ativa operacional

---

## 10. Skill e memória

**Cenário I — Skill:** ✅ 8/8
- `rode a skill Contract Auditor` → `skill_request`, `is_operational=true` (sem criar runtime falso)
- `qual skill devo usar?` → `skill_request`, `is_operational=false`, `confidence=medium`
- `você já tem /skills/run?` → `is_operational=false` (capability_question, verificado antes)
- Skill Router runtime inexistente declarado no prompt
- `/skills/run` inexistente declarado no prompt

**Cenário J — Memória:** ✅ 8/8
- `salve isso na memória`, `lembre dessa regra`, `guarde isso` → `memory_request`, `is_operational=true`
- Nenhuma escrita de memória ocorre (identificação apenas)
- Prompt contém política de CRIAÇÃO DE MEMÓRIA
- Prompt instrui não salvar baseado em interação única ambígua

---

## 11. Estratégia

**Cenário K:** ✅ 8/8
- `qual o melhor caminho?`, `isso vale a pena agora?`, `devemos seguir com isso?` → `strategy_question`, `is_operational=false`
- `isOperationalMessage` retorna `false` para todos
- MODO OPERACIONAL ATIVO NÃO injetado por perguntas estratégicas
- Resposta estratégica continua permitida

---

## 12. Regressões PR37/PR38

**Cenário L:** ✅ 7/7

| Mensagem | Resultado esperado | Resultado real |
|----------|-------------------|----------------|
| `sistema` | `is_operational=false` | ✅ false |
| `contrato` | `is_operational=false` | ✅ false |
| `Você sabe operar seu sistema?` | `is_operational=false` | ✅ false |
| `explique o que é o contrato Jarvis Brain` | `is_operational=false` | ✅ false |
| `Revise a PR 197 e veja se o runtime quebrou algum gate` | `is_operational=true` | ✅ true |

Todos os falsos positivos da PR37 continuam corrigidos.
Falso negativo da PR37 ("Revise...") continua ativando operacional.

---

## 13. Campo `intent_classification`

**Cenário M:** ✅ 9/9

Validação por inspeção de código + teste unitário do classificador puro
(sem harness de `/chat/run` — evita LLM externo):

- `intent_classification.intent` → string ✅
- `intent_classification.confidence` → string ✅
- `intent_classification.is_operational` → boolean ✅
- `intent_classification.reasons` → array ✅
- `signals` existe internamente no classificador como campo de debugging ✅
- Shape canônico presente em todos os intents ✅
- 15 INTENT_TYPES canônicos v1 presentes ✅

**Nota sobre `signals` no response da API:**
O campo `signals` é excluído propositalmente do response da API `/chat/run`
(documentado em `nv-enavia.js:~4595`): *"signals é excluído propositalmente do
response API — é campo de debugging interno com detalhes de termos casados que
não agrega valor para o consumidor externo"*. Este comportamento está correto e
foi validado pelo exame do código.

---

## 14. Regressões executadas

| Teste | Resultado | Asserts |
|-------|-----------|---------|
| `tests/pr50-intent-runtime.prova.test.js` (PR50) | ✅ | 124/124 |
| `tests/pr49-intent-classifier.smoke.test.js` | ✅ | 96/96 |
| `tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` | ✅ | 20/20 |
| `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` | ✅ | 79/79 |
| `tests/pr46-llm-core-v1.smoke.test.js` | ✅ | 43/43 |
| `tests/pr44-brain-loader-chat-runtime.prova.test.js` | ✅ | 38/38 |
| `tests/pr43-brain-loader-readonly.smoke.test.js` | ✅ | 32/32 |
| `tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | ✅ | 56/56 |
| `tests/pr36-chat-runtime-anti-bot.smoke.test.js` | ✅ | 26/26 |
| `tests/pr21-loop-status-states.smoke.test.js` | ✅ | 53/53 |
| `tests/pr20-loop-status-in-progress.smoke.test.js` | ✅ | 27/27 |
| `tests/pr19-advance-phase-e2e.smoke.test.js` | ✅ | 52/52 |
| `tests/pr14-executor-deploy-real-loop.smoke.test.js` | ✅ | 183/183 |
| `tests/pr13-hardening-operacional.smoke.test.js` | ✅ | 91/91 |
| **TOTAL** | **✅** | **821/821** |

---

## 15. Riscos restantes

1. **Skill Router ainda não existe em runtime:** `skill_request` com `is_operational=true` identifica a intenção mas não executa. Escopo de PR51.

2. **Memory request ainda não escreve:** `memory_request` classificado corretamente, mas escrita supervisionada depende de PR futura.

3. **Cobertura de termos:** Variações idiomáticas criativas não previstas podem retornar `unknown` e herdar comportamento legado. Intencional (conservador).

4. **Intent Engine completo:** O classificador informa `isOperationalMessage()` que informa `is_operational_context`. A intenção não muda diretamente o system prompt nesta PR — escopo de PR futura.

---

## 16. Resultado final

### **✅ CLASSIFICADOR DE INTENÇÃO v1 VALIDADO**

**124/124 asserts passaram. 821/821 total com regressões.**

Confirmações obrigatórias:
- ✅ `schema/enavia-intent-classifier.js` — NÃO alterado
- ✅ `nv-enavia.js` — NÃO alterado
- ✅ `schema/enavia-cognitive-runtime.js` — NÃO alterado
- ✅ `schema/enavia-llm-core.js` — NÃO alterado
- ✅ `schema/enavia-brain-loader.js` — NÃO alterado
- ✅ Nenhum painel alterado
- ✅ Nenhum endpoint criado
- ✅ Nenhum deploy automático
- ✅ `tests/pr50-intent-runtime.prova.test.js` criado e passando 124/124
- ✅ `schema/reports/PR50_PROVA_TESTE_INTENCAO.md` criado

---

## 17. Próxima PR recomendada

**Todos os testes passaram → PR51 autorizada:**

```
PR51 — PR-IMPL — Skill Router read-only
```

Objetivo: Implementar o Skill Router read-only que roteia pedidos `skill_request`
para skills documentais existentes (`schema/skills/`), sem criar endpoint `/skills/run`
em runtime. Skills são selecionadas por nome e retornam conteúdo documental.

---

*Relatório gerado em 2026-05-01. PR-PROVA pura. Sem LLM externo, KV, rede, filesystem ou side-effects.*
