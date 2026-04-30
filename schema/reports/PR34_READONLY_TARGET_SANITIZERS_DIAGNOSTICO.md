# PR34 — Diagnóstico de read_only, target default e sanitizers — ENAVIA JARVIS BRAIN

**Data:** 2026-04-30
**Tipo:** PR-DIAG (READ-ONLY)
**Branch:** `copilot/claude-pr34-diag-readonly-target-sanitizers`
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior:** PR33 — PR-DOCS — Ajuste do contrato Jarvis Brain pós-diagnóstico (mergeada ✅)
**Próxima PR autorizada:** PR35 — PR-DOCS — Política correta de modos: conversa vs diagnóstico vs execução

---

## 1. Objetivo

Diagnosticar, em modo READ-ONLY e sem alterar runtime, os **três fatores
técnicos** que mais estão matando o comportamento LLM-first da Enavia,
identificados como causas-raiz na PR32 e endereçados como Frente 2 corretiva
(PR33–PR36) na PR33:

1. `read_only` sendo interpretado como **regra de tom/persona** e não apenas
   como bloqueio de execução.
2. `target.mode = "read_only"` vindo por **default do painel** e ativando
   contexto operacional para qualquer conversa.
3. **Sanitizers/fallbacks pós-LLM** substituindo respostas vivas por frases
   robóticas fixas.

Adicionalmente, esta PR mapeia dois fatores acoplados que reforçam o
engessamento:

4. O envelope `{ reply, use_planner }` que constrange a saída do LLM.
5. A relação entre **planner** e **conversa** (PM4 + override operacional).

Esta PR produz **diagnóstico técnico profundo** e **proposta de correção
segura** para PR35 (Mode Policy) e PR36 (Response Policy), **sem alterar
runtime, sem alterar prompts, sem alterar painel, sem criar endpoints, sem
implementar correção, sem criar testes**.

---

## 2. Fontes analisadas

Toda evidência abaixo cita o caminho do arquivo e o intervalo de linhas reais
no commit corrente da branch `copilot/claude-pr34-diag-readonly-target-sanitizers`.

### Governança e contratos

- `CLAUDE.md`
- `schema/CODEX_WORKFLOW.md`
- `schema/contracts/INDEX.md`
- `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`
- `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`
- `schema/reports/PR33_AJUSTE_CONTRATO_JARVIS_POS_DIAGNOSTICO.md`

### Runtime do chat (Worker `nv-enavia`)

- `nv-enavia.js` — `handleChatLLM` (`/chat/run`), `_sanitizeChatReply`,
  `_isManualPlanReply`, `_MANUAL_PLAN_FALLBACK`, `_operationalContextBlock`.
- `schema/enavia-cognitive-runtime.js` — `buildChatSystemPrompt` (8 seções).
- `schema/enavia-identity.js` — identidade canônica.
- `schema/enavia-capabilities.js` — `can` / `cannot_yet`.
- `schema/enavia-constitution.js` — golden rule, mandatory_order,
  operational_security.
- `schema/operational-awareness.js` — snapshot de braços
  (browser/executor) + modo de aprovação.
- `schema/planner-classifier.js` — classificador PM4 (A/B/C).
- `schema/planner-output-modes.js` — envelope de saída do planner.
- `schema/memory-retrieval.js` — pipeline PR3 de memória.

### Painel (Vite/React em `panel/`)

- `panel/src/chat/useTargetState.js` — `DEFAULT_TARGET`, `ALLOWED_MODES`.
- `panel/src/pages/ChatPage.jsx` — `buildContext()`.
- `panel/src/chat/useChatState.js` — orquestração do envio.
- `panel/src/api/endpoints/chat.js` — `chatSend()` POST `/chat/run`.

### Notas de método

- Esta PR **NÃO altera nenhum desses arquivos**.
- Toda citação `arquivo:linha` foi confirmada por leitura direta no commit
  atual (mesmas linhas citadas pela PR32 — sem drift).

---

## 3. Resumo executivo

A PR32 já demonstrou a causa-raiz composta. A PR34 aprofunda os **três
fatores técnicos prioritários** que precisam ser separados e tratados
**conceitualmente** antes de qualquer alteração de runtime (PR40+):

- **`read_only`** nasce no **painel** (`panel/src/chat/useTargetState.js:36-47`)
  como **default de UI travado** (`ALLOWED_MODES = ["read_only"]`). Chega ao
  Worker como `context.target.mode` e é injetado **textualmente** no system
  prompt em **dois lugares** (`nv-enavia.js:4097-4099` e
  `schema/enavia-cognitive-runtime.js:239-241`), com semântica de **regra
  de tom/forma** ("não sugira ... foque exclusivamente em validação e
  leitura"), e **não** apenas como bloqueio de execução. Resultado: o LLM é
  instruído a evitar opinar/sugerir/planejar mesmo em conversa pura.

- **`target` default** está sempre presente: o painel envia `context.target`
  em **todo** `chatSend` (`panel/src/api/endpoints/chat.js:74-104` +
  `panel/src/pages/ChatPage.jsx:196-201` + `useTargetState.js:36-47`), e o
  Worker calcula `hasTarget = true` (`nv-enavia.js:3949-3950`) em qualquer
  mensagem. Isso ativa **três blocos operacionais** simultaneamente:
  (a) seção 5c do `chatSystemPrompt`
  (`schema/enavia-cognitive-runtime.js:218-265`),
  (b) `_operationalContextBlock` injetado **logo antes** da `user message`
  (`nv-enavia.js:4081-4126`),
  (c) `operationalDefaultsUsed` em telemetria (`nv-enavia.js:3953-3958`).
  Resultado: **toda** mensagem (inclusive "oi") é tratada como pergunta
  operacional. Não existe Intent Engine que diferencie conversa de operação.

- **Sanitizers/fallbacks pós-LLM** podem **substituir** o reply do LLM por
  uma frase robótica fixa em pelo menos quatro pontos:
  (a) `_sanitizeChatReply` (`nv-enavia.js:3530-3545`) — threshold ≥3 termos
  do planner → reply trocado por
  `"Entendido. Estou com isso — pode continuar."`;
  (b) `_isManualPlanReply` + `_MANUAL_PLAN_FALLBACK`
  (`nv-enavia.js:3549-3583, 4397-4401`) — threshold ≥2 padrões estruturais
  (`Fase \d+`, `Etapa \d+`, `Passo \d+`, headers `##`, "Critérios de aceite")
  → reply trocado por
  `"Entendido. Já organizei as etapas internamente — pode avançar ou me
  dizer se quer ajustar algo."`;
  (c) plain-text fallback (`nv-enavia.js:4164-4168`) — se JSON falha, reply
  vira `llmResult.text || "Instrução recebida."`;
  (d) painel — fallback de display (`panel/src/api/endpoints/chat.js:116`):
  `res.data.reply || "Instrução recebida. Processando."`.

Os pontos 4 (envelope JSON) e 5 (planner vs conversa) acoplam-se aos três
acima: o envelope obriga JSON `{reply, use_planner}` com proibições
expressas de markdown/headers/plano no reply, e o gate
`shouldActivatePlanner` (`nv-enavia.js:3943`) ativa planner pelo PM4 e por
termos hardcoded — usando o planner como **substituto de conversa
estruturada**, não como ferramenta interna.

Conclusão antecipada (detalhada nas seções 16–20):

- `read_only` precisa virar **bloqueio de execução/escrita/deploy**, **não
  regra de tom**.
- `target` operacional precisa exigir **detecção de intenção** antes de
  ativar contexto operacional.
- Sanitizers precisam **bloquear vazamento de planner/JSON interno** sem
  destruir resposta estratégica legítima.
- Envelope `{reply, use_planner}` deve ser revisto (relaxado, ou movido
  para camada interna) na PR36/PR40.

---

## 4. Mapa técnico do `read_only`

`read_only` aparece como **string** em três camadas distintas: painel,
Worker (telemetria + override) e cognitive runtime (system prompt).
Nenhuma delas o trata exclusivamente como gate de execução; todas o
traduzem em **instrução textual** para o LLM.

| Camada | Arquivo:linha | Forma | Papel real |
|--------|---------------|-------|-----------|
| Painel — default de UI | `panel/src/chat/useTargetState.js:36-47` | `DEFAULT_TARGET.mode = "read_only"` | Constante embutida; persistida em `sessionStorage` |
| Painel — trava de UI | `panel/src/chat/useTargetState.js:47` | `export const ALLOWED_MODES = ["read_only"];` | Bloqueia troca de modo na UI por design desta fase |
| Painel — payload | `panel/src/api/endpoints/chat.js:74-104` + `panel/src/pages/ChatPage.jsx:196-201` | `context.target.mode` | Sempre presente em `chatSend` |
| Worker — leitura | `nv-enavia.js:3949-3958` | `_chatTarget.mode === "read_only"` | Calcula `hasTarget` e adiciona `"read_only"` a `operationalDefaultsUsed` (telemetria) |
| Worker — override de prompt | `nv-enavia.js:4097-4099, 4123` | `readOnlyNote` injetado como **string** dentro do `_operationalContextBlock` | Vira instrução textual de **alta recência** (logo antes do `user`) |
| Cognitive runtime | `schema/enavia-cognitive-runtime.js:239-241` | `if (target?.mode === "read_only") sections.push(...)` | Vira instrução textual dentro do **system prompt** principal |
| Constituição | `schema/enavia-constitution.js` | `golden_rule`, `operational_security` | NÃO menciona `read_only`; regras gerais |

**Observações estruturais:**

- O Worker **não usa** `read_only` como gate determinístico de roteamento
  (não há `if (mode === "read_only") return reject_execution`). Ele apenas
  cita a string para o LLM via prompt.
- A única outra "trava" determinística próxima é o Bridge de Aprovação
  (`nv-enavia.js:3591-3596`) com `_CHAT_BRIDGE_DANGEROUS_TERMS = ["deploy",
  "delete", "rm ", "drop", "prod", "produção", "write", "patch", "post",
  "merge", "rollback"]`, que bloqueia despacho ao executor. Esse bloqueio
  **não usa** `target.mode` — é gate de mensagem, não de modo.
- Em outras palavras: a Enavia não tem hoje um gate verdadeiro de
  execução-vs-leitura amarrado a `read_only`. O `read_only` vive **apenas
  no prompt**.

---

## 5. Onde `read_only` nasce

### 5.1 Origem real (painel)

`panel/src/chat/useTargetState.js:36-47`:

```
export const DEFAULT_TARGET = {
  target_id:   "nv-enavia-prod",
  target_type: "cloudflare_worker",
  repo:        "brunovasque/nv-enavia",
  worker:      "nv-enavia",
  branch:      "main",
  environment: "prod",
  mode:        "read_only",
};
export const ALLOWED_MODES = ["read_only"];
```

- `mode: "read_only"` é **constante** embutida no código JS do painel.
- `ALLOWED_MODES = ["read_only"]` impede a UI de oferecer outros modos
  (write/patch/deploy estão **bloqueados por design** nesta fase).
- O hook `useTargetState` lê/persiste em `sessionStorage` chave
  `TARGET_STORAGE_KEY = "enavia_operational_target"`. Mesmo se o operador
  manipular o storage, o sanitizador do hook coage o valor para a lista
  `ALLOWED_MODES`.

### 5.2 Não vem de env, não vem do Worker, não vem do executor

Confirmado pela ausência total de leitura de `process.env` ou
`env.READ_ONLY` ou `env.MODE` no Worker:

```
$ grep -ni "read_only" nv-enavia.js
3955:        ...(_chatTarget?.mode === "read_only" ? ["read_only"] : []),
4097:      const readOnlyNote = _tgt.mode === "read_only"
4098:        ? "\nMODO READ-ONLY: resposta NÃO pode sugerir deploy, patch, merge, push ou escrita de qualquer tipo."
```

- Apenas três linhas em `nv-enavia.js` mencionam `read_only`, e todas
  derivam de `_chatTarget.mode` que vem **do painel via payload**.
- Em `schema/enavia-cognitive-runtime.js`, a única menção é
  `target?.mode === "read_only"` (linha 239), também derivada do painel.

### 5.3 Conclusão sobre nascimento

`read_only` nasce **inteiramente no painel** como default de UI travado.
Nenhum binding/secret/env do Cloudflare Worker controla este valor. Não há
"servidor que decreta read_only" — é uma decisão de UX de fase do painel.

Implicação: corrigir `read_only` exige tocar **tanto** o painel (PR fora do
escopo desta frente, planejada para futuro contrato de UI) **quanto** o
runtime (PR40 — LLM Core), para que o Worker pare de tratar `read_only`
como instrução de tom **mesmo** quando o painel continua enviando.

---

## 6. Onde `read_only` entra no prompt

### 6.1 Lugar 1 — `_operationalContextBlock` (alta recência)

`nv-enavia.js:4097-4099, 4123`:

```js
const readOnlyNote = _tgt.mode === "read_only"
  ? "\nMODO READ-ONLY: resposta NÃO pode sugerir deploy, patch, merge, push ou escrita de qualquer tipo."
  : "";
// ...
content: `INSTRUÇÃO OPERACIONAL PARA ESTA RESPOSTA:\n` +
  `Alvo ativo confirmado: ${targetDesc}.\n` +
  // ... 20+ linhas com FORMATO OBRIGATÓRIO ...
  readOnlyNote +
  memNote,
```

- Esse bloco é uma mensagem `system` injetada **imediatamente antes** da
  `user message` (`nv-enavia.js:4128-4134`):
  ```
  [
    { role: "system", content: chatSystemPrompt },
    ..._pr3MemoryBlock,
    ...conversationHistory,
    ..._operationalContextBlock,  // ← alta recência, o LLM "leu por último"
    { role: "user", content: message },
  ]
  ```
- A string injetada é **operacional/tonal**: "resposta NÃO pode sugerir
  deploy, patch, merge, push ou escrita de qualquer tipo". Note: "sugerir",
  não "executar". O LLM é instruído a **não falar sobre** essas
  possibilidades, não apenas a não executá-las.

### 6.2 Lugar 2 — `buildChatSystemPrompt` (system prompt principal, seção 5c)

`schema/enavia-cognitive-runtime.js:239-241`:

```js
if (target?.mode === "read_only") {
  sections.push("• MODO READ-ONLY CONFIRMADO: não sugira deploy, patch, merge, escrita ou qualquer operação de escrita. Foque exclusivamente em validação e leitura.");
}
```

Esse trecho está dentro de um bloco maior (linhas 218-265) ativado por
`hasActiveTarget || is_operational_context`. Inclui ainda:

- `"MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:"` (linha 234).
- `"Defaults seguros para validação de sistema/worker: health/status
  primeiro; leitura apenas; sem deploy; sem patch; sem escrita; pedir
  aprovação antes de qualquer execução."` (linha 245).
- `"FORMATO DA RESPOSTA OPERACIONAL (quando hasTarget=true)"` (linha 249) —
  exige até 7 passos numerados, cada passo começando com verbo de ação,
  máximo 1 pergunta bloqueante.

### 6.3 Lugar 3 — telemetria (não-prompt, mas sintoma)

`nv-enavia.js:3953-3958`:

```js
const operationalDefaultsUsed = isOperationalContext
  ? [
      ...(_chatTarget?.mode === "read_only" ? ["read_only"] : []),
      "health_first", "no_deploy", "no_write", "approval_required",
    ]
  : [];
```

Quando `isOperationalContext` é `true` (e ele é `true` sempre que
`hasTarget` é `true`), a telemetria registra que a Enavia operou em modo
"read_only + health_first + no_deploy + no_write + approval_required".
Isso documenta — em logs — que o **estado-padrão** da Enavia hoje é
defensivo.

### 6.4 Strings exatas injetadas

| Origem | String literal injetada |
|--------|--------------------------|
| `nv-enavia.js:4098` | `"\nMODO READ-ONLY: resposta NÃO pode sugerir deploy, patch, merge, push ou escrita de qualquer tipo."` |
| `enavia-cognitive-runtime.js:240` | `"• MODO READ-ONLY CONFIRMADO: não sugira deploy, patch, merge, escrita ou qualquer operação de escrita. Foque exclusivamente em validação e leitura."` |

Ambas usam o verbo "sugerir" / "não sugira" e exigem foco "exclusivamente
em validação e leitura". **Nenhuma** distingue entre "não execute" e "não
mencione/discuta".

---

## 7. Impacto real do `read_only` no tom

`read_only` deveria ser, conceitualmente, um **gate de execução**: a Enavia
**não tem braço executor habilitado para escrita** nesta sessão. Na
prática, ele opera como **regra de personalidade**:

| Faceta | Comportamento atual | Comportamento esperado |
|--------|---------------------|------------------------|
| Execução de escrita/deploy | Não há gate determinístico (ver §4); o painel só envia `read_only` | Gate de runtime: `if (mode === "read_only") refuse_dispatch_to_executor` |
| Sugerir patch/deploy em prosa estratégica | **Bloqueado** ("não sugira ... foque exclusivamente em validação e leitura") | **Permitido** — sugerir e raciocinar é parte do papel da Enavia, mesmo sem executar |
| Discordar de uma proposta | Suprimido por "FORMATO OBRIGATÓRIO ... até 7 passos numerados" + "siga defaults seguros" | Permitido — IA estratégica precisa discordar quando faz sentido |
| Opinar sobre direção de produto | Suprimido pelo bloco "MODO OPERACIONAL ATIVO" + override defensivo | Permitido em qualquer modo (opinar não é executar) |
| Planejar livremente em prosa | Conflitado: prompt exige plano operacional curto, mas proíbe "Fase 1/2/3" e "headers" | Planejar é parte do raciocínio; o **registro** estruturado é tarefa do planner interno |
| Conversar (cumprimento, dúvida geral) | Tratado como pergunta operacional, recebe override | Conversa não deveria acionar override operacional |

### 7.1 Por que é uma trava de tom e não de execução

1. As strings (§6.4) usam **"não sugira"**, **"foque exclusivamente em
   validação e leitura"**, **"não pode sugerir deploy/patch/merge"**. São
   instruções de **fala**, não de ação.
2. Não existe nenhum `if (mode === "read_only")` no Worker que bloqueie
   despacho ao executor. O Bridge de Aprovação
   (`_CHAT_BRIDGE_DANGEROUS_TERMS`, `nv-enavia.js:3591-3596`) bloqueia
   despacho por **termo na mensagem**, não por `mode`.
3. O bloco "MODO OPERACIONAL ATIVO" inclui regras de **forma**: "até 7
   passos numerados", "verbo de ação", "máximo 1 pergunta bloqueante",
   "sem markdown headers". Essas regras só fazem sentido para resposta
   tonal.
4. O LLM, ao receber simultaneamente "modo read-only" + "modo operacional
   ativo" + "formato obrigatório", entende — corretamente, do ponto de
   vista textual — que **toda resposta deve ser cautelosa, defensiva e
   curta**.

### 7.2 Conclusão obrigatória da seção

> `read_only` deve ser tratado como **bloqueio de execução/escrita/deploy
> no nível do runtime**, não como **regra de tom ou personalidade no
> prompt**. A Enavia em `read_only` continua livre para conversar,
> raciocinar, opinar, discordar, sugerir e planejar — apenas **não pode
> despachar ações de escrita** sem aprovação. Esta é a Regra **R1** já
> registrada no contrato (PR33).

---

## 8. Mapa técnico do `target` default do painel

### 8.1 `DEFAULT_TARGET` e `ALLOWED_MODES`

`panel/src/chat/useTargetState.js:36-47` (já citado em §5.1):

- `DEFAULT_TARGET` é a fonte única do `target` inicial.
- `ALLOWED_MODES = ["read_only"]` impede UI dropdown de outro modo.
- Não há código no painel que **remova** `target` do payload — sempre vai
  embutido.

### 8.2 Como o painel monta `context.target`

Sequência:

1. `panel/src/pages/ChatPage.jsx:196-201` — `buildContext()` retorna
   `{ target, attachments? }`. `target` vem do hook `useTargetState`.
2. `panel/src/chat/useChatState.js:492-553` — orquestra envio, repassa
   `context` para `chatSend`.
3. `panel/src/api/endpoints/chat.js:74-104` — `chatSend({ message,
   sessionId, context, conversationHistory? })` empacota
   `{ message, session_id, conversation_history?, context }` e faz
   `apiClient.request("/chat/run", { method: "POST", body: reqBody })`.

Não existe caminho de envio de chat que **omita** `context.target`.

### 8.3 `hasTarget` no Worker

`nv-enavia.js:3949-3950`:

```js
const _chatTarget = context.target && typeof context.target === "object" ? context.target : null;
const hasTarget = !!(_chatTarget && (_chatTarget.worker || _chatTarget.repo || _chatTarget.environment || _chatTarget.mode));
```

- `hasTarget` é `true` sempre que `context.target` traz **ao menos um**
  desses campos. Como o painel sempre envia 7 campos, `hasTarget` é
  **sempre** `true` em produção.

### 8.4 `isOperationalContext`

`nv-enavia.js:3951-3952`:

```js
const isOperationalMessage = _CHAT_OPERATIONAL_CONTEXT_MSG_TERMS.some((t) => msgLower.includes(t));
const isOperationalContext = hasTarget || isOperationalMessage;
```

- `isOperationalContext = hasTarget OR mensagem-com-termos-operacionais`.
- Como `hasTarget` é sempre `true`, `isOperationalContext` é **sempre**
  `true`. A segunda parte (`isOperationalMessage`) é **dead branch** na
  prática — nunca afeta resultado em produção.

### 8.5 Cadeia de ativação induzida por `hasTarget`

| Bloco ativado | Fonte | Conteúdo |
|---------------|-------|----------|
| Seção 5c do `chatSystemPrompt` | `enavia-cognitive-runtime.js:218-265` | `[ALVO OPERACIONAL ATIVO]` + `MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO` + `FORMATO DA RESPOSTA OPERACIONAL (quando hasTarget=true)` |
| `_operationalContextBlock` | `nv-enavia.js:4081-4126` | `INSTRUÇÃO OPERACIONAL PARA ESTA RESPOSTA` + `FORMATO OBRIGATÓRIO PARA RESPOSTA OPERACIONAL` + `RESOLUÇÃO DE AMBIGUIDADE` + `PRIORIDADE DE DECISÃO` + `readOnlyNote` + `memNote` |
| `operationalDefaultsUsed` (telemetria) | `nv-enavia.js:3953-3958` | `["read_only", "health_first", "no_deploy", "no_write", "approval_required"]` |
| `obviousQuestionsSuppressed` | `nv-enavia.js:3959` | `obviousQuestionsSuppressed = hasTarget` (suprime perguntas óbvias quando há target) |

### 8.6 Não há diferenciação conversa vs operação

- Não existe `if (intent === "conversation") skip_operational_block`.
- Não existe Intent Engine no Worker (`grep -ni "intent" nv-enavia.js` →
  zero resultados relevantes para classificação de intenção da mensagem).
- O único classificador é o PM4 (`schema/planner-classifier.js`), que
  decide **complexidade** (A/B/C) para gate do planner — não classifica
  intenção (conversa vs diagnóstico vs execução).

### 8.7 Existe forma de desligar `target`?

- **Painel:** não. `ALLOWED_MODES = ["read_only"]` trava o `mode`. Não há
  toggle "desligar target" na UI; `buildContext()` sempre envia o `target`
  do `useTargetState`.
- **Worker:** parcialmente. Se `context.target` chegar `null/undefined`,
  `_chatTarget` vira `null` e `hasTarget` vira `false`, desativando os
  blocos. Mas isso depende **do painel**, que não oferece esse caminho.
- **Dropdown real de modo:** não existe. A UI pode mostrar campos de
  `target` mas o `mode` é fixo `read_only` (nem dropdown nem toggle).

### 8.8 Conclusão da seção

> O `target` operacional, somado a `ALLOWED_MODES = ["read_only"]`, faz com
> que **toda** mensagem seja tratada como operacional/defensiva. Não existe
> distinção runtime entre "oi, tudo bem?" e "audite a fase atual do
> contrato". `target` default **não** deve transformar toda conversa em
> contexto operacional. Primeiro deve haver **detecção de intenção**
> (Intent Engine — PR42 do contrato atualizado). Esta é a Regra **R3** já
> registrada no contrato (PR33).

---

## 9. Como o `target` default ativa contexto operacional

Sequência completa, em ordem temporal de execução de uma única requisição
ao `/chat/run`:

1. **Painel cria `context.target`** com `mode: "read_only"` (default
   constante). Não há caminho que omita esse campo.
2. **Painel envia `chatSend`** sempre com `context.target`.
3. **Worker recebe o body** em `handleChatLLM` (`nv-enavia.js:3718-3744`).
4. **Worker calcula `hasTarget = true`** em `nv-enavia.js:3949-3950`.
5. **Worker calcula `isOperationalContext = true`** em
   `nv-enavia.js:3951-3952` (porque `hasTarget` é `true`).
6. **Worker calcula `operationalDefaultsUsed = ["read_only", "health_first",
   "no_deploy", "no_write", "approval_required"]`** em
   `nv-enavia.js:3953-3958`.
7. **Worker constrói `chatSystemPrompt`** chamando
   `buildChatSystemPrompt({ ownerName, context, operational_awareness,
   is_operational_context: true })` em `nv-enavia.js:3985`. Isso ativa a
   seção 5c (`enavia-cognitive-runtime.js:218-265`) com `MODO OPERACIONAL
   ATIVO`, `FORMATO DA RESPOSTA OPERACIONAL`, `NÃO PERGUNTAR/PODE
   PERGUNTAR`.
8. **Worker monta `_operationalContextBlock`** em `nv-enavia.js:4081-4126`
   (porque `hasTarget` é `true`). Esse bloco contém `FORMATO OBRIGATÓRIO`,
   `PRIORIDADE DE DECISÃO`, `readOnlyNote`, `memNote`.
9. **Worker envia para o LLM** o array `messages` em `nv-enavia.js:4128-4134`
   na ordem: `system → memória → histórico → operationalContextBlock →
   user`. O `_operationalContextBlock` tem **alta recência** (último system
   antes do user), o que dá-lhe peso desproporcional na atenção do modelo.
10. **LLM responde**. Por construção, o LLM segue as instruções textuais.
    Mesmo para um cumprimento, ele recebeu instruções para responder de
    forma operacional, defensiva, em até 7 passos.
11. **Worker aplica sanitizers** (§10) sobre o reply, que pode trocar
    resposta viva por fallback fixo se o LLM "se solta".
12. **Worker retorna `{ reply, planner_used, ... }`** ao painel.

Pontos de injeção textual que rotulam tudo como "operacional":

- `"INSTRUÇÃO OPERACIONAL PARA ESTA RESPOSTA"` — `nv-enavia.js:4103`.
- `"FORMATO OBRIGATÓRIO PARA RESPOSTA OPERACIONAL"` — `nv-enavia.js:4106`.
- `"O operador fez uma pergunta operacional."` — `nv-enavia.js:4105` (esta
  string é injetada **mesmo quando a mensagem não é operacional**, porque
  só depende de `hasTarget`).
- `"MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO"` —
  `enavia-cognitive-runtime.js:234`.
- `"FORMATO DA RESPOSTA OPERACIONAL (quando hasTarget=true)"` —
  `enavia-cognitive-runtime.js:249`.

A linha **`"O operador fez uma pergunta operacional."`** é **factualmente
falsa** quando a mensagem é "oi" ou "como você está?" — mas é injetada
incondicionalmente quando `hasTarget` é `true`. O LLM passa a tratar
qualquer entrada como operacional.

---

## 10. Diagnóstico dos sanitizers pós-LLM

### 10.1 `_sanitizeChatReply` — Layer 1 (planner leak)

`nv-enavia.js:3520-3545`:

```js
const _PLANNER_LEAK_PATTERNS = [
  /\bnext_action\b/i,
  /\breason:/i,
  /\bscope_summary\b/i,
  /\bacceptance_criteria\b/i,
  /\bplan_type\b/i,
  /\bcomplexity_level\b/i,
  /\boutput_mode\b/i,
  /\bplan_version\b/i,
  /\bneeds_human_approval\b/i,
  /\bneeds_formal_contract\b/i,
];
const _PLANNER_LEAK_THRESHOLD = 3;

function _sanitizeChatReply(reply) {
  if (!reply || typeof reply !== "string") return reply;
  let leakCount = 0;
  for (const pattern of _PLANNER_LEAK_PATTERNS) {
    if (pattern.test(reply)) leakCount++;
  }
  if (leakCount >= _PLANNER_LEAK_THRESHOLD) {
    return "Entendido. Estou com isso — pode continuar.";
  }
  return reply;
}
```

- **Threshold:** ≥3 termos **distintos** do planner.
- **Substituição:** reply inteiro → `"Entendido. Estou com isso — pode
  continuar."`
- **Aplicação:** sempre, em `nv-enavia.js:4177`, antes da decisão de
  planner. Não há flag para desativar.
- **Risco:** uma resposta estratégica que **explique** o que é
  `acceptance_criteria` ou `complexity_level` (legítimo!) é destruída.
  Mesmo uma análise técnica que **cite** termos do planner como conceito
  pode disparar o threshold.

### 10.2 `_isManualPlanReply` + `_MANUAL_PLAN_FALLBACK` — Layer 2 (plano manual)

`nv-enavia.js:3549-3583, 4397-4401`:

```js
const _MANUAL_PLAN_PATTERNS = [
  /\bFase\s+\d+/i,
  /\bEtapa\s+\d+/i,
  /\bPasso\s+\d+/i,
  /\bPhase\s+\d+/i,
  /\bStep\s+\d+/i,
  /^#{1,3}\s+\w/m,            // ##, ### markdown headers
  /\bCritérios de aceite\b/i,
  /\bCriteria\b.*:/i,
];
const _MANUAL_PLAN_THRESHOLD = 2;
const _MANUAL_PLAN_FALLBACK =
  "Entendido. Já organizei as etapas internamente — pode avançar ou me dizer se quer ajustar algo.";

function _isManualPlanReply(reply) {
  if (!reply || typeof reply !== "string") return false;
  let count = 0;
  for (const pattern of _MANUAL_PLAN_PATTERNS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    const globalPat = new RegExp(pattern.source, flags);
    const matches = reply.match(globalPat);
    if (matches) count += matches.length;
  }
  return count >= _MANUAL_PLAN_THRESHOLD;
}
```

E em `nv-enavia.js:4397-4401`:

```js
if (shouldActivatePlanner && _isManualPlanReply(reply)) {
  reply = _MANUAL_PLAN_FALLBACK;
}
```

- **Threshold:** ≥2 ocorrências **totais** (somando todos os patterns).
  "Fase 1 / Fase 2" **sozinho** já bate (2 hits no mesmo pattern).
- **Substituição:** reply inteiro → `_MANUAL_PLAN_FALLBACK`.
- **Aplicação:** condicionada a `shouldActivatePlanner === true`. Como o
  `shouldActivatePlanner` ativa para muitas mensagens (PM4 nível B/C ou
  termos operacionais hardcoded — §13), essa substituição é **frequente**.
- **Risco:** um plano **legítimo, vivo e estratégico** com headers
  Markdown (`## Diagnóstico`, `## Próximos passos`, "Critérios de aceite")
  é apagado. A resposta passa a ser uma frase fixa robótica.

### 10.3 Plain-text fallback (envelope JSON falhou)

`nv-enavia.js:4156-4168`:

```js
let reply = "";
let wantsPlan = false;
let llmParseMode = _LLM_PARSE_MODE.UNKNOWN;
try {
  const parsed = JSON.parse(llmResult.text);
  reply = typeof parsed.reply === "string" && parsed.reply.length > 0
    ? parsed.reply
    : llmResult.text;
  wantsPlan = parsed.use_planner === true;
  llmParseMode = _LLM_PARSE_MODE.JSON_PARSED;
} catch {
  reply = llmResult.text || "Instrução recebida.";
  wantsPlan = false;
  llmParseMode = _LLM_PARSE_MODE.PLAIN_TEXT_FALLBACK;
}
```

- Se o LLM retornar texto não-JSON: `reply = llmResult.text`. Tudo bem se
  o texto for útil; se vier vazio (raro), vira `"Instrução recebida."` —
  frase robótica.
- `wantsPlan = false`: planner desativa-se silenciosamente.

### 10.4 Painel — fallback de display

`panel/src/api/endpoints/chat.js:115-152`:

```js
// (aprox.) const text = res.data.reply || "Instrução recebida. Processando.";
```

- Se o reply chegar vazio do Worker, painel mostra `"Instrução recebida.
  Processando."`. Outra frase robótica fixa.

### 10.5 Tabela consolidada de sanitizers/fallbacks

| # | Origem | Arquivo:linha | Trigger | Substituição |
|---|--------|---------------|---------|--------------|
| 1 | `_sanitizeChatReply` | `nv-enavia.js:3530-3545, 4177` | ≥3 termos do planner no reply | `"Entendido. Estou com isso — pode continuar."` |
| 2 | `_isManualPlanReply` + `_MANUAL_PLAN_FALLBACK` | `nv-enavia.js:3549-3583, 4397-4401` | ≥2 padrões estruturais E `shouldActivatePlanner` | `"Entendido. Já organizei as etapas internamente — pode avançar ou me dizer se quer ajustar algo."` |
| 3 | Plain-text fallback (JSON parse falhou) | `nv-enavia.js:4156-4168` | `JSON.parse` lança | `llmResult.text` ou `"Instrução recebida."` |
| 4 | Painel — fallback de display | `panel/src/api/endpoints/chat.js:116` | reply vazio | `"Instrução recebida. Processando."` |
| 5 | Bridge bloqueada (aprovação + termo perigoso) | `nv-enavia.js:3762-3767` | aprovação textual + termo perigoso | (cai no fluxo normal silencioso) |

### 10.6 Conclusão da seção

> Os sanitizers foram criados, com razão, para **evitar vazamento de JSON
> interno do planner** na fala da Enavia (PR3 — Tool Arbitration). Hoje,
> porém, a heurística por threshold de palavras/padrões captura **respostas
> estratégicas legítimas**: análise técnica que cite os termos do planner
> como conceito, plano vivo com headers Markdown, ou resposta estruturada
> ao operador. Quando o LLM "se solta" e responde como IA estratégica, o
> sanitizer pode **destruir** o reply e devolver uma frase fixa robótica.
> Esta é a Regra **R2** já registrada no contrato (PR33): sanitizers devem
> bloquear vazamento de planner/JSON interno **sem** destruir resposta
> estratégica legítima.

---

## 11. Diagnóstico dos fallbacks robóticos

Frases fixas robóticas que podem aparecer ao operador:

| # | Frase fixa | Gerada em | Quando |
|---|------------|-----------|--------|
| F1 | `"Entendido. Estou com isso — pode continuar."` | `nv-enavia.js:3541` | `_sanitizeChatReply` ≥3 termos planner |
| F2 | `"Entendido. Já organizei as etapas internamente — pode avançar ou me dizer se quer ajustar algo."` | `nv-enavia.js:3565-3566` | `_isManualPlanReply` ≥2 padrões + `shouldActivatePlanner` |
| F3 | `"Instrução recebida."` | `nv-enavia.js:4166` | LLM retorna JSON inválido E texto vazio |
| F4 | `"Instrução recebida. Processando."` | `panel/src/api/endpoints/chat.js:116` | Worker devolve reply vazio |

**Padrões comuns:**

- Todas começam com "Entendido"/"Instrução recebida" — tom de bot de
  acknowledge.
- Nenhuma engaja, opina, sugere ou propõe próximos passos reais.
- Nenhuma está vinculada à **mensagem do operador** — são fixas
  globalmente.
- Nenhuma indica ao operador que **houve substituição** (silenciosa).

**Risco operacional:** o operador pode achar que "a Enavia entendeu e está
operando" quando, na verdade, **nada do conteúdo estratégico que a Enavia
gerou chegou até ele**. O reply foi destruído por heurística.

**Telemetria:** existe rastreio (`replyLayer1Sanitized`,
`llmParseMode = "plain_text_fallback"`), mas não chega ao painel; só em
logs internos.

### Conclusão

> Os fallbacks robóticos são uma **camada silenciosa de destruição de
> resposta**. Se o LLM produzir uma resposta estratégica viva que dispare
> qualquer dos triggers, o operador recebe uma frase neutra e o conteúdo é
> perdido. Sem telemetria visível, é impossível para o operador detectar
> que foi sanitizado. Em PR36 e PR40, sanitizers devem (a) ser estritos
> sobre vazamento de JSON puro e (b) tolerar prosa estratégica legítima.

---

## 12. Diagnóstico do envelope `{ reply, use_planner }`

### 12.1 Onde o envelope é exigido

`schema/enavia-cognitive-runtime.js:317-326`:

```
"FORMATO DE RESPOSTA (técnico — não afeta como você fala):",
"Responda SEMPRE em JSON válido com exatamente dois campos:",
'{"reply":"<sua resposta natural em português>","use_planner":<true ou false>}',
"",
"O campo reply é onde você fala livremente. Escreva como se fosse fala natural.",
"Nunca coloque campos extras no JSON. Nunca use markdown fora do JSON.",
```

- Campos obrigatórios: `reply: string`, `use_planner: boolean`.
- Plain text é **aceito como degradação** (§10.3), não como contrato.
- Markdown **fora do JSON** é proibido. **Dentro** do `reply` não fica
  claro — mas a seção 6 do mesmo prompt
  (`enavia-cognitive-runtime.js:284-291`) explicitamente proíbe headers
  `##`/`###` no reply (regra que aciona o sanitizer F2).

### 12.2 Plain text é aceito?

Sim, mas com perdas:

- `wantsPlan = false` por padrão (§10.3): planner não é ativado pela
  intenção do LLM, apenas pelo gate determinístico (PM4/override).
- `llmParseMode = PLAIN_TEXT_FALLBACK`: telemetria registra "fallback".
- Não há substituição de reply quando o texto vem fora do envelope (a
  menos que esteja vazio).

### 12.3 Como o envelope limita expressividade

| Constrangimento | Origem | Efeito |
|------------------|--------|--------|
| JSON obrigatório com 2 campos exatos | `enavia-cognitive-runtime.js:319-326` | LLM precisa "embrulhar" toda resposta — qualquer linha com aspas mal-escapadas quebra o JSON |
| Proibição de markdown fora do JSON | `enavia-cognitive-runtime.js:325` | LLM evita estilizar a fala (mesmo dentro do `reply`, tende a evitar) |
| Proibição explícita de headers no `reply` | `enavia-cognitive-runtime.js:286-288` ("NÃO use markdown headers (##, ###)") | Reply estruturado é desencorajado |
| Proibição de "Fase X / Etapa X / Passo X" | `enavia-cognitive-runtime.js:287` | Plano em prosa estruturada é desencorajado |
| Sanitizer Layer 2 (`_isManualPlanReply`) | `nv-enavia.js:3549-3583` | Mesmo se o LLM ousar headers, é destruído |
| Resposta-passo-numerado obrigatória (5c) | `enavia-cognitive-runtime.js:249-253` | Reply é puxado para "até 7 passos numerados" |
| `temperature: 0.6`, `max_tokens: 1600`, `gpt-4.1-mini` | `nv-enavia.js:4141-4147` + `935-1050` | Modelo pequeno, temperatura conservadora — favorece respostas previsíveis |

### 12.4 Conclusão

> O envelope `{reply, use_planner}` faz sentido **estruturalmente** (sinal
> determinístico de planner é útil), mas hoje é **acompanhado** por
> proibições no system prompt (sem markdown, sem headers, sem plano
> manual) que **constrangem a expressividade do `reply`**. Combinado com
> Layer 2 do sanitizer, força respostas curtas e neutras.
>
> **Decisão para PR36/PR40 (sem implementar agora):** o envelope deve
> permanecer como sinal interno (`use_planner` é útil), mas a proibição de
> markdown/headers/plano dentro do `reply` deve ser **relaxada** — ou o
> sinal deve ser movido para uma camada interna (chamada paralela /
> tool-call), não para o body principal da resposta. Isso libera o `reply`
> para ser **fala viva** do LLM, sem amarras de forma.

---

## 13. Relação planner vs conversa

### 13.1 Como `shouldActivatePlanner` é decidido

`nv-enavia.js:3927-3943`:

```js
const _CHAT_BRIDGE_OPERATIONAL_TERMS = [
  "executar", "execução", "executor", "deploy-worker", "healthcheck",
  "auditar", "validar", "plano operacional", "preparar execução",
];
const msgLower = message.toLowerCase();
const pm4AllowsPlanner = pm4Arbitration ? pm4Arbitration.allows_planner : false;
const hasOperationalIntent = _CHAT_BRIDGE_OPERATIONAL_TERMS.some((t) => msgLower.includes(t));
const hasDangerousTermForOverride = _CHAT_BRIDGE_DANGEROUS_TERMS.some((t) => {
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim();
  return new RegExp(escaped + "(?![\\w-])", "i").test(msgLower);
});
const operationalOverride = hasOperationalIntent && !hasDangerousTermForOverride;
const shouldActivatePlanner = pm4AllowsPlanner || operationalOverride;
```

- **Trigger 1:** PM4 (`schema/planner-classifier.js`) classifica nível B/C
  → `pm4AllowsPlanner = true`. Baseia-se em complexidade textual.
- **Trigger 2:** mensagem contém termo operacional hardcoded (`executar`,
  `auditar`, `validar`, etc.) E **não** contém termo perigoso (`deploy`,
  `delete`, `prod`, etc.). Esse `operationalOverride` **força** o planner
  mesmo se PM4 disser "Level A simples".

### 13.2 Como termos operacionais ativam planner

Exemplos práticos (qualquer um ativa `operationalOverride = true`):

- "Pode auditar a fase atual?" → `auditar` → planner ativo.
- "Quero validar o worker" → `validar` → planner ativo.
- "Como funciona o executor?" → `executor` → planner ativo (mesmo sendo
  pergunta conversacional).
- "Me explica o healthcheck" → `healthcheck` → planner ativo (mesmo sendo
  pergunta conversacional).

Note que "Como funciona o executor?" e "Me explica o healthcheck" são
**perguntas conversacionais**, não pedidos de execução de plano. Mas o
override ativa planner mesmo assim, porque a heurística é por **termo**,
não por **intenção**.

### 13.3 `target` default amplifica ativação indevida?

Não diretamente. `shouldActivatePlanner` **não usa** `hasTarget`. Mas:

- `hasTarget` ativa o **bloco operacional do prompt** (§9), o que pode
  induzir o LLM a usar termos operacionais no reply, o que pode disparar
  Layer 2 do sanitizer (§10.2) — destruindo o reply mesmo quando o
  `shouldActivatePlanner` está correto.
- O efeito combinado: `target` default + `operationalOverride` por termo =
  **toda** mensagem com palavra-chave operacional vira "modo planner +
  modo operacional + sanitizer agressivo" simultaneamente.

### 13.4 Planner como substituto de conversa?

Hoje, o planner roda **em paralelo** ao reply: o LLM gera `reply` (fala),
e quando `shouldActivatePlanner` é `true`, o Worker chama internamente
`classifyRequest → buildOutputEnvelope → buildCanonicalPlan →
evaluateApprovalGate → buildExecutorBridgePayload →
consolidateMemoryLearning` (`nv-enavia.js:4233-4389`). O resultado vai
para `plannerSnapshot` (telemetria + KV `planner:latest:{session_id}`),
**não substitui** o reply do LLM.

Porém:

- O system prompt **proíbe** o LLM de escrever um plano dentro do `reply`
  (`enavia-cognitive-runtime.js:284-291`). Logo, quando o operador pede um
  plano, o LLM dá uma fala curta de acknowledge ("Vou organizar isso") e o
  plano "real" vai para `plannerSnapshot` — que **o painel não exibe** de
  forma viva.
- Se o LLM ousar escrever um plano, Layer 2 do sanitizer destrói (§10.2).
- Resultado: o operador **percebe** o planner como substituto de conversa,
  porque a fala que recebe é vazia/genérica e o "plano vivo" some.

### 13.5 LLM tem liberdade para responder antes de estruturar?

Não. O system prompt (`enavia-cognitive-runtime.js:284-291`) instrui:

- "REGRA CRÍTICA: o campo reply é SEMPRE fala natural — curta, direta,
  conversacional."
- "NÃO expanda o reply em um plano completo com fases, etapas numeradas,
  seções ou estruturas."
- "O runtime ativa o planner internamente para organizar — seu reply
  confirma e conversa."

Ou seja: o LLM é **proibido** de raciocinar em prosa rica no reply. Ele
deve "confirmar" e "conversar" — o que, combinado com "FORMATO DA
RESPOSTA OPERACIONAL: até 7 passos numerados", gera uma esquizofrenia:
"seja conversacional curto" + "use até 7 passos numerados" + "não escreva
plano".

### 13.6 Conclusão

> O planner está sendo usado, na prática, como **substituto de
> conversa**: o LLM é instruído a não conversar profundamente e a delegar
> ao planner; o planner produz dados estruturados que o painel não exibe
> de forma viva. O resultado é que **o operador não vê pensamento, vê
> acknowledge**. A correção (PR40 — LLM Core, e PR42 — Intent Engine) é
> tornar o planner **ferramenta interna** e libertar o `reply` para ser a
> fala estratégica viva da Enavia.

---

## 14. Causa técnica refinada

A PR32 sintetizou a causa-raiz em 5 itens. A PR34 **refina** focando nos
três fatores prioritários e suas interações:

**Causa técnica refinada — em camadas:**

1. **Camada de origem (painel):** `DEFAULT_TARGET.mode = "read_only"` +
   `ALLOWED_MODES = ["read_only"]` + `buildContext()` sempre incluindo
   `target` = **toda** requisição chega ao Worker com sinal de "modo
   read-only ativo".

2. **Camada de leitura (Worker):** `hasTarget = true` ⇒
   `isOperationalContext = true` ⇒ ativa **três** mecanismos
   simultaneamente: (a) seção 5c do system prompt, (b)
   `_operationalContextBlock` de alta recência, (c) telemetria
   "operacional".

3. **Camada de tradução semântica (prompts):** `read_only` é convertido em
   **strings textuais** que instruem o LLM em **forma e tom**, não em
   gate de execução. As strings usam "não sugira", "foque exclusivamente
   em validação e leitura", "FORMATO OBRIGATÓRIO ... até 7 passos
   numerados", "sem markdown headers", "máximo 1 pergunta bloqueante".

4. **Camada de geração (LLM):** o LLM cumpre as instruções como qualquer
   modelo bem-treinado o faria — produz resposta defensiva, curta,
   estruturada-em-passos, sem opinião estratégica, sem markdown rico.

5. **Camada de pós-processamento (sanitizers):** se, ainda assim, o LLM
   "se solta" e produz uma resposta viva (com headers, plano em prosa,
   ou citação a termos do planner), **dois sanitizers** podem destruir o
   reply e substituí-lo por uma das frases fixas F1–F4.

6. **Camada de envelope:** o JSON `{reply, use_planner}` constrange ainda
   mais — markdown fora do JSON proibido, headers dentro do reply
   proibidos, e qualquer falha de parse vira plain-text fallback (sem
   planner, com risco de "Instrução recebida.").

7. **Camada de roteamento (planner):** `shouldActivatePlanner` ativa
   planner por **palavras-chave** (não por intenção), e quando ativo,
   reforça Layer 2 do sanitizer. O resultado estruturado vai para
   `plannerSnapshot` que o painel não mostra de forma viva.

**Síntese refinada:**

> A Enavia responde como bot porque cinco camadas se reforçam:
> (1) o painel força `read_only` em todas as mensagens;
> (2) `hasTarget=true` ativa "MODO OPERACIONAL ATIVO" para qualquer
>     conversa;
> (3) `read_only` é injetado como **regra de tom** em duas camadas do
>     prompt (override + system);
> (4) as próprias regras de prompt instruem "fala curta, sem markdown,
>     sem plano, até 7 passos";
> (5) sanitizers pós-LLM destroem qualquer resposta viva que escape;
> e (6) o envelope JSON + (7) o planner como substituto reforçam as
> camadas anteriores.
>
> Nenhum dos pontos isoladamente é "bug". O conjunto, porém, **garante**
> que a Enavia se comporte como bot mesmo com um LLM de boa qualidade.

---

## 15. Impacto nas próximas frentes do Jarvis Brain

Se PR37+ (Obsidian Brain, Self Model, LLM Core, Intent Engine, Skill
Router, Response Policy) forem implementadas **sem** corrigir os três
fatores diagnosticados acima, cada frente sofre da seguinte forma:

| Frente | Impacto se ignorar `read_only`/target/sanitizers |
|--------|---------------------------------------------------|
| **Obsidian Brain (PR37)** | Brain Loader injeta texto adicional. Se o `_operationalContextBlock` continuar de alta recência, suas regras dominam o brain. Brain vira decoração. |
| **Self Model (PR38)** | `self-model/how-to-answer.md` define identidade viva, mas `MODO OPERACIONAL ATIVO` (5c do prompt) sobrepõe. Identidade declarada não corresponde à executada. |
| **Memory Retrieval (PR3 atual / PR46 futuro)** | Retrieval por intenção pressupõe Intent Engine. Sem desativar override por target, retrieval traz memórias operacionais para conversa simples — irrelevância. |
| **LLM Core (PR40)** | `buildEnaviaCorePrompt()` precisa **substituir** as seções 5c + `_operationalContextBlock`, não acrescentar. Se acrescentar, o operacional ainda vence. |
| **Intent Engine (PR42)** | Classes (`conversation`/`diagnosis`/`planning`/.../`execution_request`) só fazem sentido se o **tom** mudar por classe. Se `MODO OPERACIONAL ATIVO` continuar sempre ativo, Intent Engine vira telemetria sem efeito. |
| **Skill Router (PR44)** | Skills viram contexto adicional. Se as restrições operacionais permanecerem, skills "sugeridas" sobre deploy/patch são suprimidas pelo `read_only` textual. |
| **Response Policy viva (PR51)** | Sem revisar sanitizers + envelope, qualquer política de resposta viva é apagada por Layer 2. Response Policy precisa **redesenhar** sanitizers, não conviver com eles. |
| **Self-Audit (PR48–PR50)** | Self-Audit pressupõe Enavia conseguir afirmar "minha resposta foi engessada porque X". Sem Intent + Mode Policy, ela não consegue distinguir. |

**Risco maior:** investir em Obsidian Brain (PR37–PR39) **antes** de PR35
(Mode Policy) e PR36 (Response Policy) significa construir conhecimento
sobre uma base que ainda traduz `read_only` como tom. O contrato (PR33) já
deslocou Obsidian Brain para PR37+ exatamente por isso. PR35 e PR36 **não
podem ser puladas**.

---

## 16. Recomendações para PR35 — Mode Policy

PR35 é **PR-DOCS** — não implementa, apenas documenta a **política
correta de modos**. Recomendações **conceituais** (sem código, sem
prompts):

### 16.1 Definir três modos canônicos

| Modo | Significado | Pode | Não pode |
|------|-------------|------|---------|
| `conversation` | Conversa, dúvida, opinião, raciocínio | Conversar livremente, opinar, sugerir, discordar, planejar em prosa, citar conceitos do planner como referência | Despachar executor, fazer write/deploy/patch |
| `diagnosis` | Diagnóstico, análise, mapeamento | Tudo do `conversation` + estruturar em prosa rica, usar headers Markdown, citar arquivos:linha, relatórios | Despachar executor, fazer write/deploy/patch |
| `execution` | Execução supervisionada de ação | Tudo do `diagnosis` + sugerir despacho ao executor (mediante aprovação humana via Bridge) | Executar sem aprovação humana E sem governança de PR |

**`read_only` = bloqueio de execução** (proíbe despacho ao executor),
**não** bloqueio de tom. Os três modos podem operar em `read_only`. A
Enavia em `read_only` continua livre para diagnosticar, planejar, opinar
e discordar.

### 16.2 Separar três planos conceituais

| Plano | O que define | Onde vive hoje | Onde deveria viver |
|-------|--------------|-----------------|---------------------|
| **Capacidade de execução** | A Enavia pode executar ação X? | Inferido de `target.mode` no prompt | Gate determinístico no Worker (`if (mode === "read_only") refuse_dispatch`) |
| **Intenção da mensagem** | O operador quer conversar/diagnosticar/executar? | Não existe | Intent Engine (PR42) |
| **Tom da resposta** | Como a Enavia responde? | Forçado a "operacional" sempre | Decisão derivada da intenção (PR42 + PR40) |

Hoje os três planos estão fundidos em **um único campo** (`target.mode`)
e em **um único lugar** (string injetada no prompt). PR35 deve
**desfundir** isso documentalmente.

### 16.3 Política de ativação do bloco operacional

PR35 deve documentar a regra:

- **Bloco operacional** (`_operationalContextBlock` + seção 5c) só ativa
  quando **intenção** ∈ `{deploy_decision, execution_request,
  pr_review-com-execução}`.
- Em `conversation`/`diagnosis`/`planning`/`memory_question`/
  `system_question`/`skill_request`, o bloco **não** ativa, mesmo se
  `hasTarget=true`.
- O `target` ainda é **conhecimento** (Enavia sabe sobre qual sistema o
  operador fala) — mas **não** é **gatilho de tom defensivo**.

### 16.4 Política de `read_only` no prompt

PR35 deve documentar que:

- O prompt **não** injeta `"MODO READ-ONLY: não sugira deploy/patch/..."`.
- O prompt pode injetar, no máximo, uma nota factual: `"O target ativo
  está em modo read-only — execução de escrita não é possível nesta
  sessão. Você pode discutir, opinar, planejar e sugerir livremente."`
- Toda restrição **real** de execução é gate determinístico no Worker
  (não em prompt).

### 16.5 Política de modos no painel (futuro)

Como PR35 é Docs-only e o painel está fora do escopo desta frente
corretiva, PR35 **apenas registra** que:

- `ALLOWED_MODES = ["read_only"]` deve eventualmente ser ampliado
  (`["read_only", "patch_supervised", "deploy_supervised"]`) em contrato
  futuro de UI.
- Enquanto isso, o Worker **deve** se proteger: tratar `read_only` como
  fato (sem braço executor de escrita disponível), não como tom.

---

## 17. Recomendações para PR36 — Response Policy

PR36 é **PR-DOCS** — documenta a **Response Policy viva** que PR40 (LLM
Core) e PR51 implementarão. Recomendações **conceituais**:

### 17.1 Princípios da Response Policy

1. **Resposta é fala estratégica viva** — não checklist defensivo.
2. **A forma deriva da intenção**, não do `target`. Conversa é
   conversacional; diagnóstico é analítico; plano é estruturado;
   execução é cautelosa.
3. **Markdown é permitido** quando a intenção pede (diagnóstico, plano,
   relatório). Headers `##`/`###` são ferramentas de clareza, não risco
   de leak.
4. **Sanitizers protegem JSON puro do planner**, não prosa estratégica.
5. **Frases fixas robóticas (F1–F4) são último recurso** — nunca devem
   substituir reply legítimo. Se substituir, painel deve ser
   **notificado** (telemetria visível).

### 17.2 Regras concretas para sanitizers (PR36 documenta, PR40+PR51 implementa)

- **Layer 1 (`_sanitizeChatReply`):** redefinir como detector de
  **JSON-leak** (resposta começa com `{`/contém estrutura JSON
  evidente), não como detector de menção textual de termos. Permite ao
  LLM **explicar** o planner.
- **Layer 2 (`_isManualPlanReply`):** desativar para intenções
  `diagnosis`/`planning`. Manter, no máximo, para intenções
  `execution_request` onde plano em prosa pode confundir com despacho.
- **Plain-text fallback (F3):** manter, mas substituir
  `"Instrução recebida."` por reply do próprio LLM (ou silêncio com erro
  estruturado), nunca por frase fixa neutra.
- **Painel (F4):** substituir `"Instrução recebida. Processando."` por
  exibição do erro real (ou retry).

### 17.3 Regras concretas para envelope `{reply, use_planner}`

PR36 documenta a decisão (a ser implementada em PR40):

- Manter `use_planner` como sinal interno, mas **mover** para um campo
  `meta.use_planner` do envelope, ou para uma chamada paralela
  (tool-call) — desacoplado do `reply`.
- Permitir markdown rico **dentro** do `reply`. Não proibir headers,
  bullets, "Fase X" — esses são tom legítimo de IA estratégica.
- Manter `temperature` configurável por intenção (mais alta para
  `conversation`, mais baixa para `execution_request`).

### 17.4 Observabilidade da Response Policy

PR36 documenta exigência de telemetria visível:

- Cada resposta carrega `meta.intent`, `meta.mode`, `meta.sanitized?`
  (boolean), `meta.fallback_used?` (string).
- Painel **mostra** quando houve sanitização (selo discreto), permitindo
  ao operador ver "sua resposta original foi modificada por
  sanitização".
- PR52 (anti-bot test) usa essa telemetria para falhar quando reply é
  trocado por F1/F2/F3/F4 indevidamente.

---

## 18. Correções futuras sugeridas, sem implementar

Sequência segura de PRs futuras (esta seção **não** implementa):

| PR | Tipo | Frente | Escopo (proposto, sem implementação aqui) |
|----|------|--------|---------------------------------------------|
| **PR35** | PR-DOCS | Frente 2 corretiva | Mode Policy: documenta os 3 modos canônicos, separação tom ↔ execução, definição correta de `read_only`, ativação condicional do bloco operacional |
| **PR36** | PR-DOCS | Frente 2 corretiva | Response Policy: documenta princípios, regras para sanitizers, envelope, observabilidade, fixtures anti-bot |
| **PR37** | PR-DOCS | Frente 3 — Obsidian Brain | Arquitetura `schema/brain/*` (INDEX, GRAPH, MEMORY_RULES, RETRIEVAL_POLICY, UPDATE_POLICY, SYSTEM_AWARENESS) + incidente `chat-engessado-readonly.md` |
| **PR38** | PR-DOCS | Frente 3 | Self Model — identidade viva, capacidades, limitações, R1 documentada em `how-to-answer.md` |
| **PR39** | PR-DOCS | Frente 3 | Migrar PR1–PR30 para Brain |
| **PR40** | PR-IMPL | Frente 4 | LLM Core: `buildEnaviaCorePrompt()` substituindo (não acrescentando) seção 5c + `_operationalContextBlock`. **Implementa Mode Policy (PR35)** no runtime |
| **PR41** | PR-PROVA | Frente 4 | Teste de resposta viva (fixtures de conversa, opinião, discordância) |
| **PR42** | PR-IMPL | Frente 5 | Intent Engine: 10 classes do contrato. Decide `intent`, propaga para LLM Core e Mode selector |
| **PR43** | PR-PROVA | Frente 5 | Teste de intenção |
| **PR44** | PR-IMPL | Frente 6 | Skill Router read-only |
| **PR45** | PR-PROVA | Frente 6 | Teste de roteamento de skills |
| **PR46** | PR-IMPL | Frente 7 | Memory retrieval por intenção |
| **PR47** | PR-PROVA | Frente 7 | Teste de retrieval contextual |
| **PR48–PR50** | DOCS/IMPL/PROVA | Frente 8 | Self-Audit Framework |
| **PR51** | PR-IMPL | Frente 9 | Response Policy viva: implementa PR36 — redesenha sanitizers, relaxa envelope, adiciona telemetria visível |
| **PR52** | PR-PROVA | Frente 9 | **Teste anti-bot** com fixtures: "Por que você está engessada?", "O que falta para virar Jarvis?", "Discorde de mim sobre X", "Sugira melhorias para o contrato" — falha se reply for F1/F2/F3/F4 |
| **PR53–PR64** | DOCS/IMPL/PROVA | Frentes 10–13 | Brain Update, Blueprint Skills, Integração final |

**Sequência crítica:** PR35 → PR36 → PR40 → PR42 → PR51 → PR52. Sem essa
ordem, o trabalho posterior é absorvido pelos defeitos atuais.

---

## 19. Riscos se ignorar este diagnóstico

Se PR35–PR36 forem puladas e PR37+ avançarem direto:

1. **Brain construído sobre tom errado:** Self Model define "Enavia é IA
   estratégica viva" mas runtime executa "MODO OPERACIONAL ATIVO". Drift
   entre identidade documentada e identidade executada.

2. **LLM Core sem efeito:** PR40 acrescenta texto ao prompt, mas as
   strings de `read_only` e `MODO OPERACIONAL ATIVO` continuam injetadas.
   Como `_operationalContextBlock` é alta recência, ele vence o LLM
   Core. Investimento perdido.

3. **Intent Engine sem efeito:** PR42 classifica intenção, mas ninguém
   usa a classe para mudar tom. Intent Engine vira telemetria. PR51
   precisará desfazer.

4. **Sanitizers continuam destruindo:** mesmo com LLM Core + Intent +
   Skill Router, se o LLM produz resposta estratégica viva, Layer 2 do
   sanitizer apaga. Operador continua vendo "Entendido. Já organizei as
   etapas internamente".

5. **Custo subindo sem ganho:** Brain Loader + Skills + Intent + Memory
   por intenção aumentam tokens enviados, latência e custo OpenAI. Sem
   liberdade de tom, o operador percebe **apenas** mais lentidão.

6. **Drift de governança:** painel continua enviando `read_only` como
   tom; Worker continua interpretando como tom. Cada PR nova precisa
   "lutar contra o `read_only`". Manutenção sobe.

7. **Risco de retrabalho amplo:** Response Policy (PR51) terá que
   refatorar prompts, sanitizers e envelope **e** reverter decisões de
   PR40+ que acomodaram o status atual. Custo de 2× a 3× se PR35–PR36
   forem puladas.

8. **PR52 (anti-bot) impossível de passar:** sem PR35–PR36, fixtures
   anti-bot encontrarão F1/F2/F3/F4 com facilidade. Métrica de
   personalidade viva fica vermelha indefinidamente.

---

## 20. Próximos passos

### 20.1 Próxima PR autorizada

**PR35 — PR-DOCS — Política correta de modos: conversa vs diagnóstico vs
execução**

- Tipo: PR-DOCS (sem alteração de runtime).
- Entrega esperada: documento de política de modos em `schema/policies/`
  (ou similar conforme contrato), separando tom/intenção/execução,
  redefinindo `read_only` como bloqueio de execução, especificando
  ativação condicional do bloco operacional.
- Pré-requisito: PR34 (esta) mergeada.
- Próxima PR após PR35: PR36 — Response Policy.

### 20.2 PRs subsequentes (referência, não escopo desta)

- PR36 — Response Policy viva (DOCS).
- PR37–PR39 — Obsidian Brain + Self Model + Migração (DOCS).
- PR40–PR41 — LLM Core (IMPL + PROVA) — primeira PR-IMPL da Frente 2/4.
- PR42–PR43 — Intent Engine.
- PR44–PR45 — Skill Router.
- PR46–PR47 — Memory Retrieval por intenção.
- PR48–PR50 — Self-Audit.
- PR51–PR52 — Response Policy viva (IMPL + anti-bot).
- PR53–PR64 — Brain Update + Blueprint Skills + Integração final.

### 20.3 Bloqueios desta PR — nenhum

- Branch sincronizada com `origin/main` (commit `be0a8b6`, PR33 mergeada).
- Contrato ativo identificado e lido integralmente.
- PR anterior (PR33) confirmada mergeada e refletida em status/handoff.
- Tipo declarado: PR-DIAG (READ-ONLY).
- Nenhum runtime alterado.
- Nenhum prompt real alterado.
- Nenhum arquivo do painel alterado.
- Nenhum endpoint criado.
- Nenhum teste criado.
- Nenhuma implementação iniciada.
- Diagnóstico read-only completo, ancorado em arquivo:linha.

### 20.4 Critérios de aceite desta PR34

| Critério | Status |
|----------|--------|
| Relatório PR34 criado | ✅ (este arquivo) |
| `read_only` mapeado de ponta a ponta com evidência real | ✅ (§4–§7) |
| `target` default mapeado com evidência real | ✅ (§8–§9) |
| Sanitizers/fallbacks mapeados com evidência real | ✅ (§10–§11) |
| Envelope `{ reply, use_planner }` analisado | ✅ (§12) |
| Relação planner vs conversa analisada | ✅ (§13) |
| Impacto sobre Jarvis Brain documentado | ✅ (§15) |
| Recomendações objetivas para PR35 e PR36 criadas | ✅ (§16–§17) |
| Causa técnica refinada | ✅ (§14) |
| Próximos passos seguros descritos | ✅ (§18, §20) |
| Nenhum runtime alterado | ✅ |
| Nenhum prompt real alterado | ✅ |
| Nenhum arquivo do painel alterado | ✅ |
| Nenhum endpoint criado | ✅ |
| Nenhum teste criado | ✅ |
| Governança atualizada (status/handoff/log/INDEX) | ✅ (commit complementar) |
| `INDEX.md` aponta PR35 como próxima PR autorizada | ✅ (commit complementar) |

---

*Relatório criado em: 2026-04-30*
*Branch: `copilot/claude-pr34-diag-readonly-target-sanitizers`*
*Contrato ativo: `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (PR31–PR64)*
*PR anterior: PR33 ✅ (PR-DOCS) — mergeada*
*Próxima PR autorizada: PR35 — PR-DOCS — Política correta de modos*
