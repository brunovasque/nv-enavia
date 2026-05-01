# PR48 — Correção Cirúrgica do LLM Core v1

**Tipo:** PR-IMPL
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR47 — PR-PROVA — mergeada, com falha parcial documentada (75/79)
**Branch:** `copilot/claudepr48-impl-correcao-cirurgica-llm-core-v1`
**Data:** 2026-05-01

---

## 1. Objetivo

Corrigir exclusivamente os 4 achados reais da PR47 sem abrir nova frente e sem
avançar para Classificador de Intenção. A PR47 provou que o LLM Core v1 estava
preservando identidade, anti-bot, falsa capacidade, read_only como gate, skills
documentais vs runtime e envelope JSON — mas falhava parcialmente porque o Brain
Loader trunca em 4.000 chars antes de incluir regras críticas do
`how-to-answer.md`.

---

## 2. Causa raiz vinda da PR47

O snapshot do `schema/enavia-brain-loader.js` satura o limite total de 4.000
chars logo após a regra 4 de `schema/brain/self-model/how-to-answer.md`. As
regras 5–10 não chegam ao runtime. Especificamente:

- Regra 7 ("próxima PR = curta + prompt completo + sem reabrir") → ausente
- Regra 8 ("excesso documental → Isso é opcional. Não mexa agora.") → ausente

O Brain Context termina com `[brain-context-truncated]` e não inclui essas
regras.

---

## 3. Achados corrigidos

| Achado | Descrição | Correção |
|--------|-----------|----------|
| **C1** | "excesso documental" ausente do prompt em runtime | Adicionado ao LLM Core |
| **C2** | "Isso é opcional. Não mexa agora." ausente do prompt | Adicionado ao LLM Core |
| **D1** | "resposta curta + prompt completo" ausente do prompt | Adicionado ao LLM Core |
| **D2** | "sem reabrir discussão" ausente do prompt | Adicionado ao LLM Core |

---

## 4. Arquivos alterados

| Arquivo | Tipo de alteração |
|---------|------------------|
| `schema/enavia-llm-core.js` | Adição de seção `COMPORTAMENTO OPERACIONAL` ao `buildLLMCoreBlock()` |
| `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` | Remoção de marcações `[ACHADO PR47]`; atualização de tolerâncias de tamanho para PR48 |
| `tests/pr46-llm-core-v1.smoke.test.js` | Atualização de tolerâncias de tamanho para PR48 (consequência direta do LLM Core change) |
| `tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` | Novo smoke test (20 asserts) |
| `schema/reports/PR48_IMPL_CORRECAO_CIRURGICA_LLM_CORE_V1.md` | Este relatório |
| `schema/contracts/INDEX.md` | Próxima PR autorizada: PR49 |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Atualizado |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Atualizado |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Atualizado |

---

## 5. O que foi adicionado ao LLM Core

Nova seção `COMPORTAMENTO OPERACIONAL` adicionada ao final de
`buildLLMCoreBlock()`, antes do `return lines.join("\n")`:

```
• COMPORTAMENTO OPERACIONAL — regras tonais obrigatórias:
  • Frustração/desconfiança do operador: reconhecer com sinceridade, responder
    tecnicamente na sequência. Sem empatia vazia nem clichê de atendimento. Não
    ativar modo operacional só por frustração.
  • excesso documental detectado: sinalizar diretamente com
    'Isso é opcional. Não mexa agora.' e puxar para execução concreta
    (próxima PR-IMPL ou PR-PROVA). Separar docs necessários de produto real.
  • Próxima PR solicitada: entregar resposta curta (objetivo em 1–3 linhas) +
    prompt completo pronto. Sem reabrir discussão desnecessária — o operador
    já decidiu.
  • Exceção corretiva: declarar que é exceção, corrigir cirurgicamente, provar,
    voltar imediatamente ao contrato.
```

Metadata atualizada: `operational-behavior-rules` adicionado ao array `includes`.

**Princípio:** Estas regras ficam no LLM Core porque são essenciais ao
comportamento observável e NÃO podem depender de bloco do Brain que pode ser
truncado.

---

## 6. O que NÃO foi alterado

- `schema/enavia-brain-loader.js` — não alterado. Limite de 4.000 chars preservado.
- `schema/enavia-cognitive-runtime.js` — não alterado.
- `nv-enavia.js` — não alterado.
- Painel, Executor, Deploy Worker, workflows, wrangler.toml — não alterados.
- KV, bindings, secrets — não alterados.
- Sanitizers, gates, envelope JSON — não alterados.
- Endpoints — nenhum criado.
- Intent Engine / Skill Router / Self-Audit — não implementados.

---

## 7. Medição de prompt pós-PR48

| Cenário | PR45 baseline | PR46 medido | PR48 medido | Delta PR46→PR48 |
|---------|---------------|-------------|-------------|----------------|
| A — simples sem target | 10.945 | 10.496 | **11.228** | +732 |
| B — target read_only | 11.187 | 10.738 | **11.470** | +732 |
| E — target operacional + flag | 12.812 | 12.363 | **13.095** | +732 |
| F — operacional completo | 13.689 | 12.435 | **13.167** | +732 |

O aumento de +732 chars (~183 tokens, ~1,7% do token budget típico) é
esperado e aceito. Esta PR corrige comportamento essencial — não economia.

`NV Imóveis`: ainda 3 ocorrências (PR45 era 9). Não regrediu.

---

## 8. Testes executados

### Sintaxe
- `node --check schema/enavia-llm-core.js` ✅
- `node --check tests/pr47-resposta-viva-llm-core-v1.prova.test.js` ✅
- `node --check tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` ✅

### Smoke PR48
- `node tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` → **20/20** ✅

### Prova PR47
- `node tests/pr47-resposta-viva-llm-core-v1.prova.test.js` → **79/79** ✅

### Regressões
| Teste | Resultado |
|-------|-----------|
| `pr46-llm-core-v1.smoke.test.js` | **43/43** ✅ |
| `pr44-brain-loader-chat-runtime.prova.test.js` | **38/38** ✅ |
| `pr43-brain-loader-readonly.smoke.test.js` | **32/32** ✅ |
| `pr37-chat-runtime-anti-bot-real.smoke.test.js` | **56/56** ✅ |
| `pr36-chat-runtime-anti-bot.smoke.test.js` | **26/26** ✅ |
| `pr21-loop-status-states.smoke.test.js` | **53/53** ✅ |
| `pr20-loop-status-in-progress.smoke.test.js` | **27/27** ✅ |
| `pr19-advance-phase-e2e.smoke.test.js` | **52/52** ✅ |
| `pr14-executor-deploy-real-loop.smoke.test.js` | **183/183** ✅ |
| `pr13-hardening-operacional.smoke.test.js` | **91/91** ✅ |
| **Total regressões** | **601/601** ✅ |

---

## 9. Resultado da PR47 após correção

**79/79 — PASSOU INTEGRALMENTE ✅**

| Cenário | Antes PR48 | Depois PR48 |
|---------|-----------|------------|
| A — Identidade viva | 12/12 ✅ | 12/12 ✅ |
| B — Capacidade | 11/11 ✅ | 11/11 ✅ |
| C — Frustração / anti-bot | 7/9 ⚠️ | **9/9** ✅ |
| D — Próxima PR | 4/6 ⚠️ | **6/6** ✅ |
| E — Operacional real | 7/7 ✅ | 7/7 ✅ |
| F — Falsa capacidade | 5/5 ✅ | 5/5 ✅ |
| G — read_only gate | 7/7 ✅ | 7/7 ✅ |
| H — Tamanho/duplicação | 14/14 ✅ | 14/14 ✅ |
| I — Envelope JSON | 5/5 ✅ | 5/5 ✅ |
| J — Sanitizers/gates | 7/7 ✅ | 7/7 ✅ |
| **Total** | **75/79** | **79/79** ✅ |

---

## 10. Riscos restantes

- **R1 (baixo):** Aumento de +732 chars (~183 tokens) por conversa. Impacto
  no custo negligível. Comportamento corrigido justifica o custo.
- **R2 (baixo):** Brain Loader ainda trunca regras 5–10 de `how-to-answer.md`.
  Isso não é mais um problema porque as regras críticas agora estão no LLM Core.
  O Brain continua valioso para regras menos críticas e contexto de self-model.
- **R3 (baixo):** O limite de 4.000 chars do Brain Loader está preservado. Não
  houve risco de aumento de custo por truncamento.

---

## 11. Retorno ao contrato

Com a PR47 passando integralmente após a correção, a próxima PR volta ao fluxo
principal do contrato.

**PR49 — PR-IMPL — Classificador de intenção**

Esta PR48 foi uma exceção corretiva obrigatória (conforme o próprio contrato
PR47 prescreveu: "Se a prova falhar, documente e pare. Próxima PR deve ser
correção cirúrgica"). Exceção declarada, executada cirurgicamente, provada,
encerrada. O contrato principal retoma.
