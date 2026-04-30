# PR37 — Prova do Chat Runtime Anti-Bot

**Data:** 2026-04-30
**Tipo:** PR-PROVA
**Branch:** `copilot/claude-pr37-prova-chat-runtime-anti-bot-real`
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR36 ✅ (PR-IMPL — correção inicial do chat runtime anti-bot)
**Resultado:** ⚠️ FALHOU PARCIALMENTE — 51/56 passaram, 5 achados reais

---

## 1. Objetivo

Provar que a PR36 realmente reduziu o comportamento robótico da Enavia no
runtime do chat, sem quebrar segurança, planner, contrato, loop ou gates.
Esta é a PR-PROVA da PR36 — nenhum runtime foi alterado.

---

## 2. PR36 validada

A PR36 foi mergeada na branch
`copilot/claudepr36-impl-chat-runtime-readonly-target-sanit`. Os seguintes
itens foram validados antes de iniciar a prova:

| Item | Status |
|------|--------|
| PR36 mergeada | ✅ |
| `node --check nv-enavia.js` | ✅ |
| `node --check schema/enavia-cognitive-runtime.js` | ✅ |
| `tests/pr36-chat-runtime-anti-bot.smoke.test.js` (26/26) | ✅ |
| Regressões PR13/PR14/PR19/PR20/PR21 | ✅ |

---

## 3. Cenários testados

Arquivo: `tests/pr37-chat-runtime-anti-bot-real.smoke.test.js`

| Cenário | Descrição | Asserts | Passou | Falhou |
|---------|-----------|---------|--------|--------|
| A | Conversa simples com target read_only | 10 | 9 | 1 |
| B | Frustração do usuário | 7 | 6 | 1 |
| C | Pergunta sobre capacidade/estado | 6 | 5 | 1 |
| D | Mensagem operacional real | 9 | 8 | 1 |
| E | Resposta estruturada útil | 4 | 4 | 0 |
| F | Vazamento interno real | 11 | 11 | 0 |
| G | Regressão de segurança | 9 | 8 | 1 |
| **Total** | | **56** | **51** | **5** |

---

## 4. Resultado por cenário

### Cenário A — Conversa simples com target read_only

**Passou (9/10):**
- `oi` com `target.mode = "read_only"` NÃO é detectado como mensagem operacional ✅
- Prompt NÃO contém `MODO READ-ONLY CONFIRMADO` (regra de tom removida pela PR36) ✅
- Prompt NÃO contém `FORMATO OBRIGATÓRIO` ✅
- `read_only` aparece como nota factual de gate (`Modo atual: read_only`) ✅
- Prompt NÃO instrui LLM a `Foque exclusivamente em validação e leitura` ✅
- Prompt NÃO instrui LLM a `não sugira deploy, patch, merge` como regra de tom ✅
- Resposta natural simples NÃO é sanitizada ✅
- Resposta natural simples NÃO é classificada como manual plan ✅
- `sanitization.applied = false` para conversa simples (telemetria) ✅

**Falhou (1/10):**
- **A2**: `buildChatSystemPrompt` com `target` ainda injeta `MODO OPERACIONAL ATIVO`
  mesmo com `is_operational_context=false`.

  **Causa raiz:** `buildChatSystemPrompt` em `schema/enavia-cognitive-runtime.js:218`
  usa `if (hasActiveTarget || is_operational_context)` onde `hasActiveTarget` é
  verdadeiro sempre que há target com campos (`worker`, `repo`, `environment`, `mode`).
  A PR36 corrigiu o `_operationalContextBlock` no nível de mensagens em `nv-enavia.js`,
  mas NÃO corrigiu a injeção no system prompt do cognitive runtime.

  **Impacto:** O LLM recebe `MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:` no
  system prompt em toda conversa com target, mesmo que a mensagem seja `oi`. A correção
  da PR36 reduziu o impacto (o bloco de mensagem pesado foi suprimido), mas o system
  prompt ainda injeta o texto operacional.

### Cenário B — Frustração do usuário

**Passou (6/7):**
- Frustração NÃO é detectada como operacional ✅
- Resposta que reconhece frustração NÃO é sanitizada pelo Layer 1 ✅
- Resposta que reconhece frustração NÃO é classificada como manual plan ✅
- Resposta a frustração NÃO é o fallback robótico canônico ✅
- Resposta a frustração NÃO é `Instrução recebida. Processando.` ✅
- Resposta a frustração é detectada como prosa natural ✅

**Falhou (1/7):**
- **B2**: Mesmo problema que A2 — sistema prompt injeta `MODO OPERACIONAL ATIVO`
  mesmo para mensagem de frustração quando há target ativo.

### Cenário C — Pergunta sobre capacidade/estado

**Passou (5/6):**
- Prompt NÃO contém `MODO READ-ONLY CONFIRMADO` ✅
- Prompt afirma que raciocinar/planejar continuam livres ✅
- Resposta explicativa sobre capacidade NÃO é sanitizada pelo Layer 1 ✅
- Resposta explicativa NÃO é classificada como manual plan ✅
- Resposta sobre capacidade é detectada como prosa natural ✅

**Falhou (1/6):**
- **C1**: `isOperationalMessage("Você sabe operar seu sistema?")` retorna `true`
  (falso positivo).

  **Causa raiz:** A palavra `sistema` está em `_CHAT_OPERATIONAL_INTENT_TERMS`
  em `nv-enavia.js`. Isso causa falso positivo para perguntas conceituais sobre
  capacidades que simplesmente mencionam a palavra "sistema".

  **Impacto:** Uma pergunta sobre o que a Enavia é capaz de fazer ativa o contexto
  operacional erroneamente. O LLM recebe o bloco `MODO OPERACIONAL ATIVO` em mensagens
  como "explique o sistema", "o que é o sistema?", "você sabe operar seu sistema?".

### Cenário D — Mensagem operacional real

**Passou (8/9):**
- `is_operational_context=true` ativa bloco operacional no prompt ✅
- `deploy do executor` é operacional ✅
- `logs de erro do worker` é operacional ✅
- `rollback da branch main` é operacional ✅
- `diagnóstico do runtime de prod` é operacional ✅
- `healthcheck do kv binding` é operacional ✅
- `merge do PR37 no staging` é operacional ✅
- Resposta operacional longa em prosa NÃO é sanitizada pelo Layer 1 ✅

**Falhou (1/9):**
- **D1**: `isOperationalMessage("Revise a PR 197 e veja se o runtime quebrou algum gate")`
  retorna `false` (falso negativo).

  **Causa raiz:** A lista `_CHAT_OPERATIONAL_INTENT_TERMS` inclui `"revisar pr"` e
  `"revisar a pr"` como frases compostas, mas NÃO inclui `"revise"` (imperativo) nem
  `"runtime"`. A mensagem usa a forma imperativa `Revise` e não contém
  exatamente `"revisar pr"`.

  **Impacto:** Mensagem claramente operacional ("revisar uma PR", "ver se o runtime
  quebrou gate") não ativa contexto operacional. O LLM responde sem o bloco operacional
  que seria útil para tarefa de inspeção técnica.

### Cenário E — Resposta estruturada útil

**Passou (4/4):** ✅

- `_sanitizeChatReply` NÃO substitui resposta estruturada útil com markdown/headers ✅
- `_isManualPlanReply` NÃO classifica resposta estratégica útil como manual plan ✅
- `_looksLikeNaturalProse` detecta a resposta como prosa natural (bypass ativo) ✅
- Resposta com `critérios de aceite` em texto explicativo NÃO é sanitizada ✅

Este cenário passou completamente — a principal entrega da PR36 (sanitizers preservam
prosa estratégica útil) funciona corretamente.

### Cenário F — Vazamento interno real

**Passou (11/11):** ✅

- Snapshot JSON-like do planner é sanitizado pelo Layer 1 ✅
- Substituição pelo fallback canônico Layer 1 ✅
- Leak com 4+ campos do planner em forma `chave:` é sanitizado ✅
- Leak JSON-like com aspas em campos do planner é bloqueado ✅
- `sanitization.applied = true` quando Layer 1 age ✅
- `sanitization.layer = "planner_terms"` para Layer 1 ✅
- `sanitization.reason` é string não vazia ✅
- Lista mecânica Fase/Etapa/Passo/Critérios detectada como manual plan ✅
- `sanitization.applied = true` quando Layer 2 age ✅
- `sanitization.layer = "manual_plan"` para Layer 2 ✅
- `_MANUAL_PLAN_FALLBACK` exportado e não-vazio ✅

Bloqueio de vazamento de planner interno — prova completamente válida.

### Cenário G — Regressão de segurança

**Passou (8/9):**
- `deploy do worker em prod` é operacional ✅
- `patch cirúrgico no runtime` é operacional ✅
- `merge do branch` é operacional ✅
- `como você está?` NÃO é operacional ✅
- Prosa explicativa sobre segurança de deploy NÃO é sanitizada ✅
- Prompt ainda menciona `bloqueadas sem aprovação/contrato` ✅
- `read_only` ainda aparece no prompt (gate de execução preservado) ✅
- Prompt operacional também preserva `bloqueadas sem aprovação/contrato` ✅

**Falhou (1/9):**
- **G5**: `isOperationalMessage("explique o que é o contrato Jarvis Brain em termos simples")`
  retorna `true` (falso positivo).

  **Causa raiz:** `"contrato"` está em `_CHAT_OPERATIONAL_INTENT_TERMS`. Pedidos de
  explicação conceitual que mencionam "contrato" ativam contexto operacional
  erroneamente.

  **Impacto:** Perguntas como "explique o contrato Jarvis Brain", "o que é o contrato
  ativo?" ativam o bloco operacional pesado quando deveriam ser tratadas como conversa
  natural. A Enavia responde como "MODO OPERACIONAL ATIVO" quando o usuário quer apenas
  uma explicação conceitual.

---

## 5. O que melhorou com a PR36

Os cenários E e F passaram completamente:

1. **Sanitizers preservam prosa estratégica útil** — a principal entrega da PR36
   funciona. Resposta longa com markdown, headers e critérios de aceite em prosa
   natural sobrevive ao sanitizer. O bypass `_looksLikeNaturalProse` é efetivo.

2. **Bloqueio de vazamento de planner interno** — snapshot JSON-like bruto com
   `next_action`, `canonical_plan`, `approval_gate`, `execution_payload` continua
   sendo bloqueado. Layer 1 e Layer 2 funcionam corretamente.

3. **Telemetria de sanitização** — `sanitization: {applied, layer, reason}` tem
   shape correto e reflete o comportamento real dos sanitizers.

4. **`read_only` como nota factual** — a regra de tom defensiva foi removida do
   `buildChatSystemPrompt`. `MODO READ-ONLY CONFIRMADO`, `Foque exclusivamente em
   validação e leitura` e `não sugira deploy, patch, merge` NÃO aparecem mais.

5. **Gate de execução preservado** — `bloqueadas sem aprovação/contrato` ainda
   aparece no prompt. O bloqueio real de execução está intacto.

---

## 6. O que ainda não é Jarvis completo

Limitações identificadas pelos 5 achados desta prova:

### 6.1 System prompt ainda injeta "MODO OPERACIONAL ATIVO" com target ativo (A2, B2)

O `buildChatSystemPrompt` em `schema/enavia-cognitive-runtime.js:218` usa
`hasActiveTarget || is_operational_context`. Mesmo que `nv-enavia.js` não injete
mais o `_operationalContextBlock` em mensagens para conversas simples, o **system
prompt** ainda contém `MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:` quando
há target com campos. Isso significa que o LLM é orientado para modo operacional
mesmo em conversas simples como "oi" ou "você está parecendo um bot".

**Correção necessária:** `buildChatSystemPrompt` em `schema/enavia-cognitive-runtime.js`
deve receber `is_operational_context` como critério principal para a injeção do bloco
operacional. `hasActiveTarget` sozinho não deve ativar o bloco
`MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:`. O target pode continuar sendo
exibido (linhas de worker/repo/mode), mas as instruções operacionais pesadas devem
exigir `is_operational_context=true`.

### 6.2 Falsos positivos em `isOperationalMessage` (C1, G5)

Palavras genéricas como `"sistema"` e `"contrato"` causam falsos positivos. Qualquer
mensagem que mencione "sistema" ou "contrato" (mesmo em contexto conceitual) ativa
o contexto operacional. Isso torna a heurística mais restritiva do que deveria ser.

**Correção necessária:** Refinar `_CHAT_OPERATIONAL_INTENT_TERMS` para remover termos
muito genéricos (`"sistema"`, `"contrato"`) ou exigir termos compostos que indiquem
intenção de execução real (ex: `"estado do contrato"`, `"contrato ativo"`,
`"sistema em prod"`).

### 6.3 Falsos negativos em `isOperationalMessage` (D1)

Variações léxicas de termos operacionais (forma imperativa `"Revise"` vs.
infinitivo `"revisar pr"`, ou `"runtime"` não coberto) causam falsos negativos.
Mensagens claramente operacionais como "Revise a PR 197 e veja se o runtime quebrou
algum gate" não são detectadas.

**Correção necessária:** Expandir `_CHAT_OPERATIONAL_INTENT_TERMS` com formas verbais
adicionais (`"revise"`, `"verifique"`, `"cheque"`) e termos técnicos relevantes
(`"runtime"`, `"gate"`).

---

## 7. Regressões executadas

| Teste | Resultado |
|-------|-----------|
| `node --check nv-enavia.js` | ✅ OK |
| `node --check schema/enavia-cognitive-runtime.js` | ✅ OK |
| `node --check tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | ✅ OK |
| `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | ⚠️ 51/56 (5 achados) |
| `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` | ✅ 26/26 |
| `node tests/pr21-loop-status-states.smoke.test.js` | ✅ 53/53 |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` | ✅ 27/27 |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` | ✅ 52/52 |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` | ✅ 183/183 |
| `node tests/pr13-hardening-operacional.smoke.test.js` | ✅ 91/91 |

Nenhuma regressão nos testes existentes. Os 5 achados são limitações novas
identificadas pela prova PR37 — não eram cobertos pelos testes anteriores.

---

## 8. Riscos restantes

1. **System prompt operacional com target sempre ativo** — LLM recebe "MODO
   OPERACIONAL ATIVO" mesmo em conversas simples quando o painel envia target.
   Impacto direto no tom e comportamento da Enavia.

2. **Falsos positivos em "sistema" e "contrato"** — Conversas conceituais comuns
   ativam contexto operacional desnecessariamente.

3. **Falsos negativos em formas verbais imperativas** — Mensagens operacionais
   reais com variações léxicas não são detectadas.

4. **Painel ainda envia `target.mode = "read_only"` em toda mensagem** — Raiz do
   problema A2/B2. Enquanto o painel sempre enviar target com campos, o
   `buildChatSystemPrompt` sempre injetará o bloco operacional.

5. **Intent Engine real ainda não existe** — A heurística de palavras-chave é
   provisória e tem falsos positivos/negativos documentados.

---

## 9. Próxima PR autorizada

**PR38 — PR-IMPL — Correção cirúrgica dos pontos anti-bot que falharam na PR37**

A prova falhou parcialmente com 5 achados reais. Conforme contrato, quando a prova
falha, a próxima PR deve ser PR-IMPL (correção), não PR-DOCS (documentação do Brain).

### Escopo técnico esperado para PR38

**Worker-only.** Patch cirúrgico em dois arquivos:

1. **`schema/enavia-cognitive-runtime.js`** (seção 5c):
   - Alterar `if (hasActiveTarget || is_operational_context)` para
     `if (hasActiveTarget || is_operational_context)` com injeção do bloco operacional
     pesado (`MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:`) **somente** quando
     `is_operational_context=true`.
   - Manter exibição do target (worker/repo/mode) separada das instruções operacionais
     pesadas — o target pode aparecer como contexto informativo sem ativar o bloco
     comportamental.

2. **`nv-enavia.js`** (helper `isOperationalMessage` e `_CHAT_OPERATIONAL_INTENT_TERMS`):
   - Remover ou transformar termos muito genéricos (`"sistema"`, `"contrato"`) em
     termos compostos que indiquem intenção real.
   - Adicionar formas verbais imperativas para operações comuns (`"revise"`,
     `"verifique"`, `"cheque"`, `"inspecione"`).
   - Adicionar `"runtime"` e `"gate"` como termos operacionais.

A PR38 deve repassar nos testes A2, B2, C1, D1 e G5 desta prova (PR37).
