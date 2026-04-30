# PR38 — Correção dos Achados PR37 Anti-Bot

**Data:** 2026-04-30
**Tipo:** PR-IMPL
**Branch:** `copilot/claudepr38-impl-corrigir-achados-pr37-anti-bot`
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR37 ✅ (PR-PROVA — mergeada, falha parcial documentada: 51/56)
**Resultado:** ✅ PASSOU — 56/56 após correção

---

## 1. Objetivo

Corrigir exclusivamente os 5 achados reais da PR37 (prova anti-bot), sem abrir nova
frente, sem criar novo contrato, sem criar nova policy e sem adiar o retorno ao
contrato Jarvis Brain.

PR-IMPL cirúrgica: dois arquivos de runtime alterados, um teste de regressão verificado,
relatório criado, governança atualizada.

---

## 2. Achados corrigidos

| Achado | Descrição | Arquivo | Correção |
|--------|-----------|---------|----------|
| **A2/B2** | `buildChatSystemPrompt` injeta `MODO OPERACIONAL ATIVO` com `hasActiveTarget=true` mesmo com `is_operational_context=false` | `schema/enavia-cognitive-runtime.js` | Separar target informativo de bloco comportamental operacional |
| **C1** | `isOperationalMessage("Você sabe operar seu sistema?")` → falso positivo em `"sistema"` | `nv-enavia.js` | Remover `"sistema"` como termo isolado |
| **D1** | `isOperationalMessage("Revise a PR 197...")` → falso negativo, forma imperativa não coberta | `nv-enavia.js` | Adicionar `"revise"`, `"verifique"`, `"cheque"`, `"inspecione"`, `"runtime"`, `"gate"`, `"gates"` |
| **G5** | `isOperationalMessage("explique o que é o contrato Jarvis Brain")` → falso positivo em `"contrato"` | `nv-enavia.js` | Remover `"contrato"` como termo isolado, substituir por `"estado do contrato"` e `"contrato ativo"` |

---

## 3. Arquivos alterados

```
schema/enavia-cognitive-runtime.js   — seção 5c: separação target/bloco operacional
nv-enavia.js                         — _CHAT_OPERATIONAL_INTENT_TERMS refinado
schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md  — este relatório (NOVO)
schema/contracts/INDEX.md            — governança
schema/status/ENAVIA_STATUS_ATUAL.md — governança
schema/handoffs/ENAVIA_LATEST_HANDOFF.md — governança
schema/execution/ENAVIA_EXECUTION_LOG.md — governança
```

---

## 4. Correção em `buildChatSystemPrompt`

**Arquivo:** `schema/enavia-cognitive-runtime.js`
**Linha:** seção 5c (anteriormente linha ~218)

### Problema

O código original usava:

```js
if (hasActiveTarget || is_operational_context) {
  // target informativo
  // MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:   ← sempre injetado
}
```

Isso fazia com que o bloco `MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:` fosse
injetado em toda conversa com target ativo, mesmo que `is_operational_context=false`.
Mensagens como "oi" ou "você está parecendo um bot" recebiam o bloco operacional pesado
no system prompt.

### Correção

Separação em dois blocos independentes:

```js
// Target informativo: sempre exibido quando há target ativo
if (hasActiveTarget) {
  // [ALVO OPERACIONAL ATIVO] + campos + nota read_only factual
}

// Bloco comportamental pesado: SOMENTE quando is_operational_context === true
if (is_operational_context) {
  // MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:
  // instruções operacionais detalhadas
}
```

### Resultado

- `hasActiveTarget=true` + `is_operational_context=false` → target informativo exibido,
  bloco comportamental operacional **não** injetado.
- `hasActiveTarget=true` + `is_operational_context=true` → target informativo + bloco
  comportamental operacional ambos exibidos (para inspeção técnica real).
- Gate de execução (`read_only`) continua aparecendo como nota factual para qualquer
  conversa com target read_only — não é regra de tom.

---

## 5. Correção em `isOperationalMessage`

**Arquivo:** `nv-enavia.js`
**Constante:** `_CHAT_OPERATIONAL_INTENT_TERMS`

### Problema

Termos genéricos demais causavam falsos positivos:
- `"sistema"` → "Você sabe operar seu **sistema**?" = falso positivo
- `"contrato"` → "explique o que é o **contrato** Jarvis Brain" = falso positivo

Formas imperativas e termos técnicos ausentes causavam falsos negativos:
- `"revise"` não coberto → "**Revise** a PR 197..." = falso negativo
- `"runtime"` não coberto → "...veja se o **runtime** quebrou..." = falso negativo
- `"gate"` não coberto → "...quebrou algum **gate**" = falso negativo

### Correção

**Removidos como termos isolados:**
- `"sistema"` — muito genérico em português
- `"contrato"` — muito genérico, presente em perguntas conceituais comuns

**Adicionados (termos compostos para "contrato"):**
- `"estado do contrato"` — consulta de estado operacional real
- `"contrato ativo"` — referência ao contrato em execução (também cobria PR36 test)

**Adicionados (verbos imperativos operacionais):**
- `"revise"` — "Revise a PR 197..."
- `"verifique"` — "verifique os logs do worker"
- `"cheque"` — "cheque o deploy"
- `"inspecione"` — "inspecione o runtime"

**Adicionados (termos técnicos de infraestrutura):**
- `"runtime"` — "veja se o runtime quebrou..."
- `"gate"` — "...algum gate"
- `"gates"` — forma plural

### Resultado

| Mensagem | Antes | Depois | Esperado |
|----------|-------|--------|----------|
| "Você sabe operar seu sistema?" | `true` (falso positivo) | `false` | `false` ✅ |
| "explique o que é o contrato Jarvis Brain" | `true` (falso positivo) | `false` | `false` ✅ |
| "Revise a PR 197 e veja se o runtime quebrou algum gate" | `false` (falso negativo) | `true` | `true` ✅ |
| "qual é o estado do contrato ativo?" | `true` (via "contrato") | `true` (via "estado do contrato") | `true` ✅ |
| "deploy do executor agora" | `true` | `true` | `true` ✅ |
| "merge do PR37 no staging" | `true` | `true` | `true` ✅ |

---

## 6. Testes executados

### Syntax check

```
node --check nv-enavia.js                                        OK
node --check schema/enavia-cognitive-runtime.js                  OK
node --check tests/pr37-chat-runtime-anti-bot-real.smoke.test.js OK
```

### Smoke test PR37 (principal)

```
node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js
Results: 56 passed, 0 failed   ✅
```

### Regressões

```
node tests/pr36-chat-runtime-anti-bot.smoke.test.js    → 26/26 ✅
node tests/pr21-loop-status-states.smoke.test.js       → 53/53 ✅
node tests/pr20-loop-status-in-progress.smoke.test.js  → 27/27 ✅
node tests/pr19-advance-phase-e2e.smoke.test.js        → 52/52 ✅
node tests/pr14-executor-deploy-real-loop.smoke.test.js → 183/183 ✅
node tests/pr13-hardening-operacional.smoke.test.js    → 91/91 ✅
```

---

## 7. Resultado do PR37 após correção

**56/56 — PASSOU** ✅

| Cenário | Asserts | Resultado |
|---------|---------|-----------|
| A — Conversa simples com target read_only | 10 | 10/10 ✅ |
| B — Frustração do usuário | 7 | 7/7 ✅ |
| C — Pergunta sobre capacidade/estado | 6 | 6/6 ✅ |
| D — Mensagem operacional real | 9 | 9/9 ✅ |
| E — Resposta estruturada útil | 4 | 4/4 ✅ |
| F — Vazamento interno real | 11 | 11/11 ✅ |
| G — Regressão de segurança | 9 | 9/9 ✅ |
| **Total** | **56** | **56/56** ✅ |

---

## 8. Regressões

Nenhuma regressão introduzida. Todos os testes históricos passaram após a correção:

- PR36: 26/26 ✅ (incluindo o teste `'estado do contrato' é operacional` que dependia de "contrato")
- PR21, PR20, PR19, PR14, PR13: todos verdes

A remoção de `"contrato"` como termo isolado não quebrou o teste PR36 porque o teste
usa a frase `"qual é o estado do contrato ativo?"`, que contém `"estado do contrato"`
(novo termo composto adicionado).

---

## 9. Riscos restantes

1. **Intent Engine real ainda não existe** — A heurística de palavras-chave é provisória
   e pode ter falsos positivos/negativos em mensagens não cobertas pelos testes atuais.
   A heurística atual é suficiente para o momento, conforme escopo do contrato.

2. **Painel ainda envia `target.mode = "read_only"` em toda mensagem** — O painel
   (`panel/src/chat/useTargetState.js`) continua sendo a raiz técnica do problema A2/B2.
   A correção no worker elimina o sintoma (bloco pesado no system prompt), mas a raiz
   no painel não foi tocada (fora do escopo Worker-only desta PR).

3. **`_CHAT_OPERATIONAL_CONTEXT_MSG_TERMS` ainda tem "sistema"** — Essa lista legada
   também contém "sistema" e é usada em `isOperationalContext` (interno ao
   `handleChatLLM`). Não foi tocada pois não afeta os testes da prova e está fora do
   escopo cirúrgico desta PR.

4. **Testes cobrem heurística de palavras-chave, não semântica** — Variações léxicas
   não previstas nos testes podem ter comportamento inesperado. O Intent Engine real
   (PR42+) resolverá isso com classificação semântica.

---

## 10. Retorno ao contrato Jarvis Brain

Com os achados da PR37 corrigidos e a prova anti-bot passando, a próxima PR retorna ao
fluxo principal do contrato Jarvis Brain.

**PR39 — PR-DOCS — Arquitetura do Obsidian Brain** está autorizada.

O bloqueio que havia desde PR37 (prova parcial com 5 achados) foi resolvido. A Frente 2
corretiva do contrato Jarvis Brain está encerrada com evidência real (56/56 ✅).

A Frente 3 — Brain, Intent Engine, Skill Router, LLM Core — pode ser iniciada conforme
o planejamento do contrato.
