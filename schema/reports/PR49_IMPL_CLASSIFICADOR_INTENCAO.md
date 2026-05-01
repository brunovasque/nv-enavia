# PR49 — Classificador de Intenção v1

**Data:** 2026-05-01
**Tipo:** PR-IMPL (Worker-only, cirúrgica)
**Branch:** `copilot/claudepr49-impl-classificador-intencao`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR48 ✅ (correção cirúrgica LLM Core — PR47 79/79 após correção)

---

## 1. Objetivo

Implementar o Classificador de Intenção v1 da Enavia para separar, de forma
determinística e segura, os principais tipos de mensagem antes de aplicar tom
operacional, planner, skill futura ou resposta conversacional.

A PR49 retoma o fluxo principal do contrato após a exceção corretiva PR48.

---

## 2. Diagnóstico usado

- **PR32:** chat engessado por tom operacional indevido (`MODO OPERACIONAL ATIVO` injetado por qualquer target).
- **PR34:** 7 camadas de causa técnica (target default → leitura no Worker → tradução semântica).
- **PR36:** `isOperationalMessage` introduzida — heurística de termos simples.
- **PR38:** refinamento cirúrgico — "sistema" e "contrato" isolados removidos; termos compostos e verbos imperativos adicionados.
- **PR37:** prova identificou falsos positivos com "sistema" e "contrato" isolados, e falso negativo com forma imperativa "Revise".
- **PR45:** diagnóstico de prompt pós-Brain Loader — contexto base confirmado.
- **PR48:** regras tonais críticas movidas para LLM Core — PR47 79/79 restaurado.

---

## 3. Arquitetura implementada

### Novo arquivo: `schema/enavia-intent-classifier.js`

Módulo pure function, sem I/O, sem side-effects:

```
classifyEnaviaIntent(input)
  input: { message: string, context?: object }
  output: {
    intent: string,
    confidence: "high"|"medium"|"low",
    is_operational: boolean,
    reasons: string[],
    signals: string[]
  }
```

Exporta também:
- `INTENT_TYPES` — enum de intenções canônicas v1
- `CONFIDENCE_LEVELS` — enum de confiança

### Integração em `nv-enavia.js` (patch mínimo)

1. Import do classificador adicionado.
2. `isOperationalMessage()` atualizada para:
   - Usar o classificador como fonte **primária**.
   - Manter fallback para `_CHAT_OPERATIONAL_INTENT_TERMS` quando o classificador retorna `unknown` (sem match).
   - Quando o classificador identifica a intenção e a declara não-operacional, respeitar essa decisão (não sobrescrever com legado).
3. `classifyEnaviaIntent()` chamado no fluxo `/chat/run` para gerar campo aditivo `intent_classification` na resposta.

---

## 4. Intenções canônicas v1

| Intent | Código | is_operational |
|--------|--------|---------------|
| Conversa simples | `conversation` | false |
| Frustração/desconfiança | `frustration_or_trust_issue` | false |
| Pergunta de identidade | `identity_question` | false |
| Pergunta de capacidade | `capability_question` | false |
| Pergunta de estado do sistema | `system_state_question` | false |
| Pedido de próxima PR | `next_pr_request` | false |
| Revisão de PR | `pr_review` | **true** |
| Diagnóstico técnico | `technical_diagnosis` | **true** |
| Pedido de execução | `execution_request` | **true** |
| Pedido de deploy | `deploy_request` | **true** |
| Ação de contrato | `contract_request` | **true** |
| Execução de skill | `skill_request` (run) | **true** |
| Pergunta sobre skill | `skill_request` (question) | false |
| Pedido de memória | `memory_request` | **true** |
| Pergunta estratégica | `strategy_question` | false |
| Desconhecido | `unknown` | false |

---

## 5. Regras de classificação

### Ordem de verificação (prioridade decrescente)
1. PR Review — URL de GitHub ou pedido explícito
2. Deploy/Rollback — antes de execução genérica
3. Execução técnica genérica
4. Diagnóstico técnico
5. Memória — escrita supervisionada
6. Contrato — ação vs pergunta conceitual (inclui "estado do contrato", "contrato ativo")
7. Capacidade — verificada ANTES de skill (evita falso positivo "você já tem Skill Router?")
8. Skill — execução vs pergunta
9. Próxima PR
10. Frustração/desconfiança
11. Identidade
12. Estado do sistema
13. Estratégia
14. Cumprimento/conversa
15. Mensagem curta sem match → `unknown` (permite fallback legado)
16. Fallback → `unknown`

### Regras críticas de segurança
- `frustration_or_trust_issue` → is_operational=false (frustração não ativa modo operacional)
- `next_pr_request` → is_operational=false (não aciona deploy/execução)
- `capability_question` verificada antes de `skill_request` para evitar que "você já tem X?" vire execução
- Mensagem curta sem match → `unknown` (não bloqueia heurística legada)
- Quando intent != unknown: isOperationalMessage respeita a decisão do classificador

---

## 6. Integração com isOperationalMessage

### Lógica atual (após PR49)

```
isOperationalMessage(message, context):
  1. Chama classifyEnaviaIntent() como fonte primária
  2. Se is_operational=true → retorna true
  3. Se is_operational=false E intent != unknown → retorna false (classificador identificou e decidiu)
  4. Se intent == unknown (ou erro) → usa fallback legado _CHAT_OPERATIONAL_INTENT_TERMS
```

### Acertos preservados (PR36/PR37/PR38)

| Mensagem | Resultado | Origem |
|----------|-----------|--------|
| "oi" | false | classificador |
| "você está parecendo um bot" | false | classificador |
| "mande a próxima PR" | false | classificador |
| "revise a PR 209" | true | classificador |
| "diagnostique o runtime" | true | classificador |
| "faça o deploy" | true | classificador |
| "faça rollback" | true | classificador |
| "qual é o estado do contrato ativo?" | true | classificador (contract_request) |
| "validar worker" | true | fallback legado (unknown→legado) |

---

## 7. O que foi alterado

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `schema/enavia-intent-classifier.js` | **NOVO** | Classificador de Intenção v1 completo |
| `tests/pr49-intent-classifier.smoke.test.js` | **NOVO** | Smoke test — 96 asserts, 14 cenários |
| `schema/reports/PR49_IMPL_CLASSIFICADOR_INTENCAO.md` | **NOVO** | Este relatório |
| `nv-enavia.js` | **MODIFICADO** | Import + isOperationalMessage + intent_classification no response |
| `schema/contracts/INDEX.md` | **MODIFICADO** | Próxima PR: PR50 |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | **MODIFICADO** | Status atualizado |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | **MODIFICADO** | Handoff PR49→PR50 |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | **MODIFICADO** | Log atualizado |

---

## 8. O que NÃO foi alterado

- **Skill Router NÃO foi implementado** — `classifyEnaviaIntent` apenas identifica o pedido; o router em runtime não existe.
- **/skills/run não existe** — nenhum endpoint criado.
- **Sem escrita de memória** — `memory_request` classificado mas nenhuma escrita implementada.
- **Sem endpoint novo** — apenas lógica interna.
- **Sem alteração de deploy/gates** — gates de execução (`read_only`) intactos.
- **Sem painel alterado** — Panel, Executor, Deploy Worker, workflows intocados.
- **Brain Loader não alterado** — `schema/enavia-brain-loader.js` intocado.
- **LLM Core não alterado** — `schema/enavia-llm-core.js` intocado.
- **Cognitive Runtime não alterado** — `schema/enavia-cognitive-runtime.js` intocado.
- **Sanitizers não alterados** — comportamento de sanitização preservado.
- **wrangler.toml / wrangler.executor.template.toml** — intocados.
- **KV/bindings/secrets** — nenhuma alteração.

---

## 9. Testes executados

### Smoke PR49 — `tests/pr49-intent-classifier.smoke.test.js`

**96/96 ✅**

| Cenário | Cobertura | Resultado |
|---------|-----------|-----------|
| A — Conversa simples | 11 asserts | ✅ 11/11 |
| B — Frustração/desconfiança | 8 asserts | ✅ 8/8 |
| C — Identidade/Capacidade | 12 asserts | ✅ 12/12 |
| D — Próxima PR | 6 asserts | ✅ 6/6 |
| E — Revisão de PR | 7 asserts | ✅ 7/7 |
| F — Diagnóstico técnico | 6 asserts | ✅ 6/6 |
| G — Deploy/execução | 6 asserts | ✅ 6/6 |
| H — Contrato (ação vs pergunta) | 3 asserts | ✅ 3/3 |
| I — Skill (execução vs pergunta) | 5 asserts | ✅ 5/5 |
| J — Memória | 4 asserts | ✅ 4/4 |
| K — Regressões PR37/PR38 | 4 asserts | ✅ 4/4 |
| L — Integração isOperationalMessage | 9 asserts | ✅ 9/9 |
| M — Integração com prompt | 5 asserts | ✅ 5/5 |
| N — Estrutura canônica | 10 asserts | ✅ 10/10 |

---

## 10. Regressões

**697/697 ✅** — zero regressões.

| Teste | Antes | Depois |
|-------|-------|--------|
| PR49 smoke | — | ✅ 96/96 |
| PR48 smoke | ✅ 20/20 | ✅ 20/20 |
| PR47 prova | ✅ 79/79 | ✅ 79/79 |
| PR46 smoke | ✅ 43/43 | ✅ 43/43 |
| PR44 prova | ✅ 38/38 | ✅ 38/38 |
| PR43 smoke | ✅ 32/32 | ✅ 32/32 |
| PR37 prova | ✅ 56/56 | ✅ 56/56 |
| PR36 smoke | ✅ 26/26 | ✅ 26/26 |
| PR21 smoke | ✅ 53/53 | ✅ 53/53 |
| PR20 smoke | ✅ 27/27 | ✅ 27/27 |
| PR19 E2E | ✅ 52/52 | ✅ 52/52 |
| PR14 smoke | ✅ 183/183 | ✅ 183/183 |
| PR13 smoke | ✅ 91/91 | ✅ 91/91 |

---

## 11. Riscos restantes

1. **Falsos positivos/negativos residuais:** O classificador usa termos exatos. Mensagens criativas ou ambíguas que não caem em nenhuma lista podem ser classificadas como `unknown` e herdar o comportamento legado. Isso é intencional (conservador).

2. **Skill Router ainda não existe:** `skill_request` com `is_operational=true` identifica a intenção, mas a execução real depende de PR futura (Skill Router).

3. **Memory request ainda não escreve:** `memory_request` identificado, mas nenhuma escrita é feita nesta PR. Escrita supervisionada depende de PR futura.

4. **Cobertura de termos:** As listas de termos são baseadas em casos canônicos. Variações idiomáticas não previstas podem não ser classificadas corretamente — aceitável para v1.

5. **Integração com prompté indireta:** O classificador informa `isOperationalMessage()` que informa `isOperationalContext`. A intenção não muda diretamente o system prompt nesta PR — isso é escopo de PR futura (Intent Engine completo).

---

## 12. Próxima PR recomendada

### Se todos os testes passarem (confirmado: 697/697 ✅):

**PR50 — PR-PROVA — Teste de intenção**

Objetivo: criar prova formal do Classificador de Intenção v1, validando:
- Todos os cenários do smoke em versão prova (com asserções mais rígidas).
- Integração real com o prompt do chat via `isOperationalContext`.
- Cobertura de edge cases e mensagens ambíguas.
- Regressões completas do sistema.

---

*Relatório gerado em 2026-05-01. Sem LLM externo, KV, rede, filesystem ou side-effects.*
