# PR44 — Prova do Brain Loader no Chat Runtime

**Data:** 2026-05-01
**Tipo:** PR-PROVA (Worker-only)
**Branch:** `copilot/claudepr44-prova-brain-loader-chat-runtime`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR43 — PR-IMPL — mergeada (PR #204). Relatório: `schema/reports/PR43_IMPL_BRAIN_LOADER_READONLY.md`.

---

## 1. Objetivo

Provar que o Brain Loader read-only implementado na PR43 realmente influencia o
chat runtime da Enavia de forma segura, validando:

- O Brain Context entra no system prompt com a seção correta.
- A Enavia passa a ter identidade/self-model no contexto.
- Não inventa capacidades futuras como atuais.
- Não cria permissão de execução.
- Não ativa tom operacional em conversa simples.
- Não quebra anti-bot (PR36/PR37/PR38).
- Não quebra regressões do loop contratual.

**Restrição total desta PR:** nenhum runtime alterado. Apenas criação de teste e
relatório, mais atualização de governança.

---

## 2. PR43 validada

| Item | Estado |
|------|--------|
| `schema/enavia-brain-loader.js` criado | ✅ |
| `getEnaviaBrainContext()` — pura, determinística, sem FS/KV/rede | ✅ |
| `getEnaviaBrainAllowlist()` — auditoria das fontes | ✅ |
| Integração em `buildChatSystemPrompt` — seção `7c` | ✅ |
| Flag interna `include_brain_context` (sem env var nova) | ✅ |
| Limites defensivos: 4.000 chars total, 1.500/bloco, marca de truncamento | ✅ |
| Smoke PR43: **32/32 ✅** | ✅ |
| Regressões PR37/PR36/PR21/PR20/PR19/PR14/PR13: **520/520 ✅** | ✅ |

---

## 3. Cenários testados

Arquivo: `tests/pr44-brain-loader-chat-runtime.prova.test.js`

| Cenário | Descrição |
|---------|-----------|
| A | Brain Context presente no prompt |
| B | Brain Context desligável por flag interna |
| C | Ordem correta no prompt |
| D | Não cria capacidade falsa |
| E | Não ativa tom operacional em conversa simples |
| F | Contexto operacional real preservado |
| G | Limite e determinismo |
| H | Experiência esperada simulada (sem LLM externo) |

---

## 4. Resultado por cenário

### Cenário A — Brain Context presente no prompt ✅

`buildChatSystemPrompt({ include_brain_context: true })` contém:
- `CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY` ✅
- `Enavia` ✅
- `LLM-first` ✅
- `read_only é gate de execução` ✅
- `não autoriza execução` ✅

### Cenário B — Brain Context desligável por flag interna ✅

`buildChatSystemPrompt({ include_brain_context: false })` NÃO contém:
- `CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY` ✅
- Prompt ainda é string não vazia (demais seções intactas) ✅

### Cenário C — Ordem correta no prompt ✅

- Brain aparece depois de `USO DE MEMÓRIA RECUPERADA:` ✅
- Brain aparece antes de `FORMATO DE RESPOSTA` ✅
- `MODO OPERACIONAL ATIVO` não aparece em prompt simples ✅

### Cenário D — Não cria capacidade falsa ✅

- Brain descrito como read-only/documental ✅
- `/skills/run` mencionado como ainda NÃO existente em runtime ✅
- Skill Router mencionado como não existente em runtime ✅
- Intent Engine mencionado como documental ✅
- Execução exige contrato/aprovação ✅
- Prompt não afirma Skill Router como disponível agora ✅

### Cenário E — Não ativa tom operacional em conversa simples ✅

Com `context.target.mode = "read_only"`, `is_operational_context = false`, `include_brain_context = true`:
- Brain Context aparece ✅
- `MODO OPERACIONAL ATIVO` não aparece ✅
- Target informativo `[ALVO OPERACIONAL ATIVO]` aparece (factual) ✅
- Nota factual de `read_only` aparece (gate, não tom) ✅

### Cenário F — Contexto operacional real preservado ✅

Com `is_operational_context = true`, target ativo, Brain ativo:
- Brain Context aparece ✅
- `MODO OPERACIONAL ATIVO` aparece ✅
- Brain e MODO OPERACIONAL coexistem ✅
- Brain não autoriza execução mesmo em contexto operacional ✅

### Cenário G — Limite e determinismo ✅

- Determinístico: duas chamadas idênticas produzem resultado igual ✅
- Tamanho total <= `BRAIN_CONTEXT_TOTAL_LIMIT` (4000 chars) ✅
- Allowlist não está vazia ✅
- Todas as fontes referenciadas estão na allowlist ✅
- Contexto não contém sequência de maiúsculas/dígitos longas (padrão secret) ✅
- Contexto não contém IDs hexadecimais longos (padrão KV namespace ID) ✅

### Cenário H — Experiência esperada simulada ✅

Sem LLM externo, o prompt contém informação suficiente para responder:
- "Quem é você?" → identidade Enavia como orquestrador cognitivo ✅
- "Você sabe operar seu sistema?" → seção de capacidades reais atuais ✅
- "Você já tem Skill Router?" → Skill Router marcado como não disponível em runtime ✅
- "Você pode executar sem aprovação?" → aprovação/contrato explicitamente exigidos ✅
- Capacidades futuras marcadas como não presentes ✅
- Sem falsa autonomia no prompt ✅
- Cinco modos de operação identificáveis ✅

---

## 5. Evidências de Brain Context no prompt

**Trecho do cabeçalho do Brain Context:**
```
CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY
[Fonte documental do Obsidian Brain. Não é estado runtime e não autoriza execução.
 Para estado atual do sistema, use o awareness operacional e o target da sessão.
 Para executar, é exigido contrato ativo, escopo e aprovação.]
```

**Posição no prompt:**
- Após: `USO DE MEMÓRIA RECUPERADA:` / `CRIAÇÃO DE MEMÓRIA` (seção 7b)
- Antes: `FORMATO DE RESPOSTA` (seção 8 — envelope JSON)

**Tamanho medido:** 4000 chars (no limite exato — determinístico).

---

## 6. Evidências de não falsa capacidade

O Brain Context contém explicitamente:

```
O que ainda NÃO existe em runtime:
  • Brain Loader vivo só foi acabado de plugar (esta PR43, read-only).
  • LLM Core completo, Intent Engine completo, Skill Router em runtime.
  • Endpoint `/skills/run`, escrita de memória automatizada, ...
```

```
Não fingir que skills executam quando ainda são documentais.
```

```
Não inventar memória; não afirmar runtime onde ainda é documental.
```

O prompt global também contém seção `O que você ainda NÃO consegue (não prometa):` da
`enavia-capabilities.js`, reforçando a barreira dupla contra falsa capacidade.

---

## 7. Evidências de anti-bot preservado

Cenário E reproduz o cenário central da PR36/PR38 (target ativo + read_only,
sem intenção operacional):

- `MODO OPERACIONAL ATIVO` não injetado ✅
- Target informativo `[ALVO OPERACIONAL ATIVO]` continua aparecendo (comportamento factual preservado) ✅
- Nota factual de `read_only` continua aparecendo (gate de execução, não tom) ✅
- Brain Context não interfere na lógica de `is_operational_context` ✅

---

## 8. Regressões executadas

| Teste | Resultado |
|-------|-----------|
| `node tests/pr43-brain-loader-readonly.smoke.test.js` | **32/32 ✅** |
| `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | **56/56 ✅** |
| `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` | **26/26 ✅** |
| `node tests/pr21-loop-status-states.smoke.test.js` | **53/53 ✅** |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` | **27/27 ✅** |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` | **52/52 ✅** |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` | **183/183 ✅** |
| `node tests/pr13-hardening-operacional.smoke.test.js` | **91/91 ✅** |

**Total regressões: 520/520 ✅**

---

## 9. Riscos restantes

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Snapshot pode divergir do conteúdo documental real ao longo do tempo (sem CI de sync) | Baixo | Cabeçalho marca como documental; PRs futuras podem regenerar |
| Aumento marginal de tokens no prompt (~1k tokens extras pelo Brain Context) | Baixo | Aceitável; limite de 4.000 chars é conservador |
| Sem prova de LLM real — cenário H só verifica contexto disponível, não resposta gerada | Baixo | Prova de runtime real exigiria credenciais de produção; fora do escopo desta PR |
| Allowlist estática pode crescer indefinidamente se não revisada | Baixo | Limite total defensivo (4.000 chars) impede crescimento descontrolado |

---

## 10. Resultado final

**✅ PASSOU — Brain Loader read-only validado.**

Todos os 38 asserts do teste PR44 passaram.
Todas as 520 regressões passaram.
Nenhum runtime alterado.
Nenhum painel, executor, deploy worker, workflow, wrangler, KV, binding ou secret modificado.

### Resumo quantitativo

| Teste | Resultado |
|-------|-----------|
| PR44 (novo — 8 cenários, 38 asserts) | **38/38 ✅** |
| PR43 smoke (regressão) | **32/32 ✅** |
| PR37 anti-bot real | **56/56 ✅** |
| PR36 anti-bot | **26/26 ✅** |
| PR21 loop states | **53/53 ✅** |
| PR20 loop in_progress | **27/27 ✅** |
| PR19 advance phase e2e | **52/52 ✅** |
| PR14 executor deploy loop | **183/183 ✅** |
| PR13 hardening | **91/91 ✅** |
| **Total geral** | **558/558 ✅** |

---

## 11. Próxima PR recomendada

Como todos os testes passaram, a próxima PR volta para o contrato principal:

**PR45 — PR-DIAG — Diagnóstico do prompt atual do chat**

Objetivo: diagnosticar o estado atual do system prompt completo em produção,
medir o tamanho total, identificar seções que podem estar pesando no orçamento
de tokens, e mapear o que ainda falta para o LLM Core completo.
