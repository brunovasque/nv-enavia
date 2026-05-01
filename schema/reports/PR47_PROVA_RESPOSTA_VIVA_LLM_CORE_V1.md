# PR47 — Prova de Resposta Viva com LLM Core v1

**Tipo:** PR-PROVA
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior:** PR46 — PR-IMPL — LLM Core v1 (mergeada)
**Branch:** `copilot/claudepr47-prova-resposta-viva-llm-core-v1`
**Data:** 2026-05-01

---

## 1. Objetivo

Provar que o LLM Core v1 (PR46) preserva ou melhora a qualidade da resposta da
Enavia, sem voltar ao comportamento robótico, sem criar falsa capacidade, sem
quebrar anti-bot e sem relaxar governança. Esta PR é prova pura — não altera
runtime, painel, executor, deploy worker, workflows, wrangler, KV, bindings,
secrets nem cria endpoint.

---

## 2. PR46 validada

PR46 está mergeada em `main` (commit merge `b4780c5`, PR #207).

- `schema/enavia-llm-core.js` cria `buildLLMCoreBlock()` consolidando antigas
  seções 1, 1b, 2, 3, 4 do `buildChatSystemPrompt`.
- Economia documentada: **-449 chars / ~-112 tokens (-4,1%) por conversa**.
- "NV Imóveis" reduzido de 9 para 3 ocorrências.
- Brain Loader, envelope JSON, MODO OPERACIONAL condicional, sanitizers, gates,
  awareness, planner policy: todos preservados.

---

## 3. Cenários testados

Teste: `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` (10 cenários, 79
asserts).

| Cenário | Foco |
|---------|------|
| A | Identidade viva ("Quem é você?") |
| B | Pergunta de capacidade ("Você sabe operar seu sistema?") |
| C | Frustração / anti-bot emocional |
| D | Pedido de próxima PR ("Mande a próxima PR") |
| E | Pedido operacional real (revisar PR / verificar gate) |
| F | Falsa capacidade bloqueada (Skill Router / `/skills/run`) |
| G | `read_only` como gate, não tom |
| H | Tamanho / duplicação sem regressão (medição vs PR45) |
| I | Envelope JSON `{reply, use_planner}` preservado |
| J | Sanitizers/gates preservados indiretamente (PR36/PR37/PR38) |

---

## 4. Resultado por cenário

| Cenário | Asserts | Passa | Falha |
|---------|---------|-------|-------|
| A — Identidade viva | 12 | 12 | 0 |
| B — Capacidade | 11 | 11 | 0 |
| C — Frustração / anti-bot | 9 | 7 | **2 (achados reais)** |
| D — Próxima PR | 6 | 4 | **2 (achados reais)** |
| E — Operacional real | 7 | 7 | 0 |
| F — Falsa capacidade | 5 | 5 | 0 |
| G — `read_only` gate | 7 | 7 | 0 |
| H — Tamanho/duplicação | 14 | 14 | 0 |
| I — Envelope JSON | 5 | 5 | 0 |
| J — Sanitizers/gates | 7 | 7 | 0 |
| **Total** | **79** | **75** | **4** |

---

## 5. Identidade viva — ✅ PASSOU

O prompt cita "Enavia", define papel como **orquestrador cognitivo LLM-first**,
declara explicitamente que NÃO é assistente comercial, NÃO é atendente, NÃO é
a NV Imóveis nem a Enova. Independência cognitiva preservada. Owner name flui
quando informado. Brain Context complementa identidade sem contradizer LLM Core.

Indução negativa OK: prompt NÃO contém frases como "Você é o atendente da NV…",
"Você é o assistente comercial…" ou "Você é a Enova".

---

## 6. Capacidade sem falsa autonomia — ✅ PASSOU

Prompt expõe seções `CAPACIDADES REAIS` e `LIMITAÇÕES ATUAIS`. Declara:

- Skill Router runtime — **ainda NÃO existe**.
- `/skills/run` — **ainda NÃO existe**.
- Intent Engine completo — **ainda NÃO existe**.
- Brain Loader — **READ-ONLY**.
- Execução exige contrato + escopo + aprovação humana.

Bloco `FALSA CAPACIDADE BLOQUEADA` presente. Não há indução de "autonomia
total / autonomia plena / executo qualquer".

---

## 7. Frustração / anti-bot — ⚠️ PASSOU PARCIALMENTE (2 achados)

**Passa:**
- Mensagem de frustração pura NÃO ativa `isOperationalMessage`.
- Prompt reconhece frustração e instrui sinceridade + resposta técnica.
- Prompt NÃO usa frase canônica de empatia vazia.
- `MODO OPERACIONAL ATIVO` NÃO é injetado por frustração (mesmo via
  `recent_action`).

**Achados reais (falham):**

- **C1 — `excesso documental` ausente do prompt em runtime.** A regra 8 de
  `schema/brain/self-model/how-to-answer.md` ("Se a Enavia perceber que está
  gerando documentação além do necessário …") está na fonte mas é truncada
  pelo limite de 4.000 chars do Brain Loader.
- **C2 — Frase canônica "Isso é opcional. Não mexa agora." ausente.** Mesma
  causa: o snapshot do Brain corta o conteúdo após a regra 4 de how-to-answer
  (cenário comprovado no `getEnaviaBrainContext()` — termina em
  `[brain-context-truncated]`).

**Causa raiz:** O snapshot do Brain Loader (`schema/enavia-brain-loader.js`)
está saturado em 4.000 chars antes de chegar nas regras 5–10 de how-to-answer.

---

## 8. Pedido de próxima PR — ⚠️ PASSOU PARCIALMENTE (2 achados)

**Passa:**
- "Mande a próxima PR" não ativa contexto operacional sozinho.
- Prompt orienta resposta direta/natural/conversacional.
- Envelope JSON `{reply, use_planner}` continua exigido (estrutural).
- `próxima PR` é citado (em capabilities + frase do brain).

**Achados reais (falham):**

- **D1 — Regra "resposta curta + prompt completo" ausente do prompt em
  runtime.** Regra 7 de `how-to-answer.md` truncada antes de entrar no
  snapshot.
- **D2 — Regra "sem reabrir discussão desnecessária" ausente.** Mesma causa.

**Causa raiz:** mesma da seção 7 — truncamento do Brain Loader.

---

## 9. Pedido operacional real — ✅ PASSOU

`isOperationalMessage("Revise a PR 207 e veja se o LLM Core quebrou algum
gate.")` retorna `true` (PR38). Quando `is_operational_context=true`:

- `MODO OPERACIONAL ATIVO` é injetado.
- LLM Core e Brain Context coexistem.
- Execução continua exigindo contrato + aprovação.
- `read_only` segue como gate, não tom.
- Nenhuma indução de "deploy livre / merge livre / qualquer ação sem
  aprovação".

---

## 10. Skills documentais vs runtime — ✅ PASSOU

Prompt declara claramente que Skill Router runtime e `/skills/run` ainda NÃO
existem. Brain Context cita skills documentais (Loop Operator, Deploy
Governance, System Mapper, Contract Auditor) como guias. Regra de FALSA
CAPACIDADE BLOQUEADA presente.

---

## 11. `read_only` como gate — ✅ PASSOU

Com `context.target.mode = "read_only"` e `is_operational_context=false`:

- Target factual `[ALVO OPERACIONAL ATIVO]` aparece.
- Nota `Modo atual: read_only` aparece.
- `read_only` aparece como **GATE** ("read_only é GATE de execução, NÃO regra
  de tom").
- `MODO OPERACIONAL ATIVO` NÃO aparece.
- Prompt mantém liberdade de raciocinar/explicar/planejar.
- Prompt NÃO instrui a Enavia a se calar / ficar defensiva.

---

## 12. Duplicação e tamanho — ✅ PASSOU

| Cenário | PR45 baseline | PR47 medido | Delta |
|---------|---------------|-------------|-------|
| A — simples sem target | 10.945 | **10.496** | **-449** |
| B — target read_only sem op | 11.187 | **10.738** | **-449** |
| E — target operacional + flag | 12.812 | **12.363** | **-449** |
| F — operacional completo | 13.689 | **12.435** | **-1.254** |

`NV Imóveis` reduzido de **9 → 3 ocorrências**. Antigas seções 1b/2/3/4
verbosas NÃO retornaram. Tamanho não regrediu para PR45 em nenhum cenário.

---

## 13. Envelope JSON preservado — ✅ PASSOU

Seção `FORMATO DE RESPOSTA` presente. Contrato literal
`{"reply":"<sua resposta natural em português>","use_planner":<true ou false>}`
preservado. `use_planner` documentado como ferramenta interna; "Na dúvida,
prefira false". `reply` documentado como fala natural livre.

---

## 14. Regressões executadas

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

Smoke tests sintáticos:

- `node --check schema/enavia-llm-core.js` ✅
- `node --check schema/enavia-cognitive-runtime.js` ✅
- `node --check schema/enavia-brain-loader.js` ✅
- `node --check tests/pr47-resposta-viva-llm-core-v1.prova.test.js` ✅

PR47 prova: **75 passed / 4 failed** (4 achados reais — ver seções 7 e 8).

---

## 15. Riscos restantes

- **R1 — Truncamento do Brain Loader corta regras 5–10 de how-to-answer.**
  Conforme medido em `getEnaviaBrainContext()`, o snapshot termina em
  `[brain-context-truncated]` logo após a regra 4. As regras 5
  (`read_only` não define tom — já coberta no LLM Core), 6 (resposta curta em
  fluxo técnico), 7 (próxima PR = curta + prompt completo + sem reabrir),
  8 (excesso documental → "Isso é opcional. Não mexa agora."), 9 (exceção
  corretiva) e 10 (governança não é personalidade) **não chegam ao runtime**.
- **R2 — Identidade, capacidades, limitações e gates seguem firmes.** Os 4
  achados são tonais, não de segurança.
- **R3 — `próxima PR` aparece no prompt como capability ("identificar a
  próxima PR autorizada"), mas SEM a política de tom associada.** O
  comportamento atual provavelmente segue o estilo geral do LLM Core, sem o
  reforço explícito de regra 7.

---

## 16. Resultado final

**FALHOU PARCIALMENTE — 75/79 (94,9%)**

LLM Core v1 está sólido em identidade, capacidade, falsa capacidade, anti-bot
operacional, `read_only` como gate, skills documentais vs runtime, tamanho/
duplicação e envelope JSON. **8 de 10 cenários passaram totalmente** e
**601/601 regressões passaram**.

Os 4 achados são tonais e têm causa raiz única: **truncamento do snapshot do
Brain Loader em 4.000 chars**, que corta regras 5–10 de how-to-answer
(`schema/brain/self-model/how-to-answer.md`).

Conforme contrato PR47: "Se a prova falhar, documente e pare. Não avançar
para PR48 — Classificador de intenção. Próxima PR deve ser PR48 — PR-IMPL —
Correção cirúrgica do LLM Core v1".

---

## 17. Próxima PR recomendada

**PR48 — PR-IMPL — Correção cirúrgica do LLM Core v1 (regras tonais
truncadas)**

Escopo sugerido (a ser detalhado no prompt da PR48):

1. Levar regras 6, 7 e 8 de how-to-answer para o **LLM Core** (ou para um
   bloco compacto adjacente), evitando depender do truncamento variável do
   Brain Loader.
2. Frase canônica "Isso é opcional. Não mexa agora." precisa estar no prompt
   em runtime.
3. Política "próxima PR = resumo curto + prompt completo + sem reabrir
   discussão" precisa estar no prompt em runtime.
4. Reavaliar o snapshot do Brain Loader: ou aumentar limite por bloco para
   a fonte `how-to-answer.md`, ou compactar as regras 1–4 para abrir espaço
   para 5–10. Manter limite total ≤ 4.000 chars como princípio.

Escopo proibido em PR48 cirúrgica:

- Não implementar Intent Engine.
- Não implementar Skill Router runtime.
- Não criar `/skills/run`.
- Worker-only / patch cirúrgico.

Após PR48 cirúrgica + nova PR-PROVA verde, então sim avançar para PR49 com o
Classificador de intenção (antiga PR48 — Intent Engine v1).
