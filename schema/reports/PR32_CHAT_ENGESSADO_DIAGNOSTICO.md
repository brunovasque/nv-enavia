# PR32 — Diagnóstico do Chat Engessado — ENAVIA JARVIS BRAIN

**Data:** 2026-04-30
**Tipo:** PR-DIAG (READ-ONLY)
**Branch:** `copilot/claude-pr32-diag-chat-engessado-jarvis-brain`
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior:** PR31 — PR-DOCS — Ativação do contrato Jarvis Brain v1 (mergeada ✅)

---

## 1. Objetivo

Diagnosticar, em modo READ-ONLY e sem alterar runtime, por que a Enavia
responde como **bot de checklist** e não como **IA estratégica LLM-first**.

Mapear o fluxo real da conversa entre painel e worker, identificar todos os
componentes envolvidos na geração da resposta final ao operador e isolar a(s)
causa(s) raiz da resposta engessada antes de qualquer implementação do Jarvis
Brain v1 (PR33+).

Esta PR é a base de evidências sobre a qual as PRs PR33–PR41 (Obsidian Brain,
Memory Runtime, LLM Core, Intent Engine, Skill Router) serão construídas.

---

## 2. Fontes analisadas

Toda evidência abaixo cita o caminho do arquivo e o intervalo de linhas reais
no commit corrente da branch.

### Governança e contrato

- `CLAUDE.md`
- `schema/CODEX_WORKFLOW.md`
- `schema/contracts/INDEX.md`
- `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`
- `schema/reports/PR31_ATIVACAO_CONTRATO_JARVIS_BRAIN.md`
- `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
- `schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md`
- `schema/handoffs/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_FINAL_HANDOFF.md`

### Skills e mapas do sistema

- `schema/skills/INDEX.md`
- `schema/skills/CONTRACT_LOOP_OPERATOR.md`
- `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md`
- `schema/skills/SYSTEM_MAPPER.md`
- `schema/skills/CONTRACT_AUDITOR.md`
- `schema/system/ENAVIA_SYSTEM_MAP.md`
- `schema/system/ENAVIA_ROUTE_REGISTRY.json`
- `schema/system/ENAVIA_WORKER_REGISTRY.md`
- `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md`

### Runtime do chat (Worker `nv-enavia`)

- `nv-enavia.js` — handler `handleChatLLM` (`/chat/run`), buildSystemPrompt
  legado (`/engineer`), sanitizadores, bridge de aprovação.
- `schema/enavia-cognitive-runtime.js` — `buildChatSystemPrompt`,
  `buildCognitiveRuntime`, `buildCognitivePromptBlock`.
- `schema/enavia-identity.js` — identidade canônica (nome, role, owner).
- `schema/enavia-capabilities.js` — `can` / `cannot_yet`.
- `schema/enavia-constitution.js` — regras operacionais (golden rule,
  mandatory_order, operational_security).
- `schema/operational-awareness.js` — snapshot de braços (browser/executor) e
  modo de aprovação.
- `schema/planner-classifier.js` — classificador PM4 (níveis A/B/C).
- `schema/planner-output-modes.js` — envelope de saída do planner.
- `schema/planner-canonical-plan.js` — plano canônico interno.
- `schema/memory-retrieval.js` / `schema/memory-read.js` /
  `schema/memory-storage.js` — pipeline de memória PR3.

### Painel (Vite/React em `panel/`)

- `panel/src/pages/ChatPage.jsx` — composição da página, `buildContext()`.
- `panel/src/chat/useChatState.js` — orquestração do envio.
- `panel/src/chat/useTargetState.js` — target padrão e travas de UI.
- `panel/src/api/endpoints/chat.js` — `chatSend()` que chama `/chat/run`.

---

## 3. Fluxo atual do chat

Sequência real de uma mensagem digitada no painel até a resposta exibida:

1. **Painel — composição do contexto.**
   `panel/src/pages/ChatPage.jsx:196-201` define `buildContext()`:
   `{ target, attachments? }`. O `target` vem do hook
   `useTargetState` (`panel/src/chat/useTargetState.js:35-46`) com default
   `{ target_id: "nv-enavia-prod", target_type: "cloudflare_worker", repo:
   "brunovasque/nv-enavia", worker: "nv-enavia", branch: "main", environment:
   "prod", mode: "read_only" }`.
2. **Painel — modos travados na UI.**
   `panel/src/chat/useTargetState.js:48-49` define
   `ALLOWED_MODES = ["read_only"]`. Mode `write/patch/deploy` está bloqueado
   por design no painel nesta fase.
3. **Painel — envio HTTP.**
   `panel/src/api/endpoints/chat.js:74-104` empacota
   `{ message, session_id, conversation_history?, context }` e faz
   `apiClient.request("/chat/run", { method: "POST", body: reqBody })`.
4. **Worker — entrada.**
   `nv-enavia.js:3718-3744` (`async function handleChatLLM`) lê o body, valida
   `message`, extrai `session_id`, `context`, `debug`.
5. **Worker — bridge de aprovação determinístico (BLOCO B).**
   `nv-enavia.js:3757-3825` checa termos `_CHAT_BRIDGE_APPROVAL_TERMS` /
   `_CHAT_BRIDGE_DANGEROUS_TERMS` (3591–3596) e, se houver aprovação + plano
   pendente, despacha o executor sem chamar o LLM.
6. **Worker — histórico de conversa (PR5).**
   `nv-enavia.js:3843-3862` aceita `body.conversation_history` (≤20 msgs,
   ≤4000 chars), apenas roles `user|assistant`.
7. **Worker — pré-classificação PM4.**
   `nv-enavia.js:3882-3894` chama `classifyRequest({ text: message, context })`
   de `schema/planner-classifier.js`. PM4 devolve `complexity_level` A/B/C e
   é tratado como gate determinístico para o planner — **não** como Intent
   Engine para a resposta.
8. **Worker — Operational Awareness (PR4).**
   `nv-enavia.js:3910-3915` chama `buildOperationalAwareness(env, ...)` de
   `schema/operational-awareness.js:97-177`.
9. **Worker — detecção de override operacional.**
   `nv-enavia.js:3927-3958` decide `shouldActivatePlanner` com base em PM4 +
   termos operacionais hardcoded (`executar`, `deploy-worker`, `healthcheck`,
   `auditar`, etc.) e detecta `isOperationalContext` (target ou termos
   sistêmicos).
10. **Worker — retrieval de memória (PR3).**
    `nv-enavia.js:3961-3973` chama
    `buildRetrievalContext(context, env)` de `schema/memory-retrieval.js`.
    Retorna 3 blocos: `validated_learning`, `manual_instructions`,
    `historical_memory`.
11. **Worker — montagem do system prompt.**
    `nv-enavia.js:3985` chama
    `buildChatSystemPrompt({ ownerName, context, operational_awareness,
    is_operational_context })` em
    `schema/enavia-cognitive-runtime.js:93-329`.
12. **Worker — bloco de memória PR3.**
    `nv-enavia.js:3996-4066` injeta `_pr3MemoryBlock` como mensagem `system`
    extra (texto + bullets). Em modo operacional vira "regra preferencial".
13. **Worker — bloco operacional de override (target).**
    `nv-enavia.js:4081-4126` injeta `_operationalContextBlock` como mensagem
    `system` adicional **imediatamente antes** da `user message`. Esse bloco
    contém o "FORMATO OBRIGATÓRIO PARA RESPOSTA OPERACIONAL" (até 7 passos
    numerados, sem markdown headers, etc.).
14. **Worker — chamada LLM.**
    `nv-enavia.js:4128-4147` monta `llmMessages = [system, _pr3MemoryBlock,
    conversationHistory, _operationalContextBlock, user]` e chama
    `callChatModel(env, llmMessages, { temperature: 0.6, max_tokens: 1600 })`.
    `callChatModel` (linhas 935-1050) faz `POST` para
    `https://api.openai.com/v1/chat/completions` com `model = env.OPENAI_MODEL
    || env.NV_OPENAI_MODEL || "gpt-4.1-mini"` e fallback para `gpt-4.1-mini`.
15. **Worker — parse JSON + sanitização.**
    `nv-enavia.js:4156-4178` faz `JSON.parse(llmResult.text)` esperando
    `{ reply, use_planner }`. Em caso de plain text o body inteiro vira reply.
    Em seguida, `_sanitizeChatReply(reply)` (3530-3545) **substitui** o reply
    por `"Entendido. Estou com isso — pode continuar."` quando detecta ≥3
    termos do planner (`next_action`, `reason:`, `scope_summary`,
    `acceptance_criteria`, `plan_type`, `complexity_level`, `output_mode`,
    `plan_version`, `needs_human_approval`, `needs_formal_contract`).
16. **Worker — gate de plano manual.**
    `nv-enavia.js:4397-4401` chama `_isManualPlanReply(reply)` (3572-3583).
    Se o LLM tiver escrito ≥2 padrões de plano (`Fase \d+`, `Etapa \d+`,
    `Passo \d+`, headers `##`, "Critérios de aceite"), o reply inteiro é
    **substituído** por
    `"Entendido. Já organizei as etapas internamente — pode avançar ou me
    dizer se quer ajustar algo."` (`_MANUAL_PLAN_FALLBACK`, linha 3565-3566).
17. **Worker — planner como tool (PM4 autoritativo).**
    `nv-enavia.js:4233-4389` executa `classifyRequest` →
    `buildOutputEnvelope` → `buildCanonicalPlan` → `evaluateApprovalGate` →
    `buildExecutorBridgePayload` → `consolidateMemoryLearning` somente quando
    `shouldActivatePlanner` é `true`. Resultado vai para `plannerSnapshot`,
    espelhado em KV `planner:latest:{session_id}`.
18. **Worker — resposta final.**
    `nv-enavia.js:4429-4475` retorna `{ ok, system, mode: "llm-first", reply,
    planner_used, memory_applied, memory_hits, operational_context_applied,
    planner?, telemetry }`.
19. **Painel — exibição.**
    `panel/src/api/endpoints/chat.js:115-152` lê `res.data.reply` direto e
    monta `data` via `mapChatResponse`. O texto exibido ao operador é
    `res.data.reply` puro (com fallback `"Instrução recebida. Processando."`).

---

## 4. Endpoint(s) e função(ões) envolvidos

| Camada | Símbolo | Arquivo:linha | Papel |
|--------|---------|---------------|-------|
| Painel | `chatSend` | `panel/src/api/endpoints/chat.js:74-156` | POST `/chat/run` com `{ message, session_id, conversation_history?, context }` |
| Painel | `useChatState` | `panel/src/chat/useChatState.js:492-553` | Empacota `target` em `context` |
| Painel | `useTargetState` / `DEFAULT_TARGET` | `panel/src/chat/useTargetState.js:35-49` | `mode: "read_only"` por design + `ALLOWED_MODES = ["read_only"]` |
| Painel | `buildContext` | `panel/src/pages/ChatPage.jsx:196-201` | `{ target, attachments? }` |
| Worker | `handleChatLLM` | `nv-enavia.js:3718-4609` | Handler único de `/chat/run` |
| Worker | `_sanitizeChatReply` | `nv-enavia.js:3530-3545` | **Substitui reply** se houver ≥3 termos mecânicos do planner |
| Worker | `_isManualPlanReply` + `_MANUAL_PLAN_FALLBACK` | `nv-enavia.js:3565-3583, 4397-4401` | **Substitui reply** se LLM escreveu plano inline |
| Worker | `_dispatchFromChat` | `nv-enavia.js:3608-3692` | Bridge de aprovação → executor |
| Cognitivo | `buildChatSystemPrompt` | `schema/enavia-cognitive-runtime.js:93-329` | System prompt principal (8 seções) |
| Cognitivo | `buildCognitiveRuntime` / `getEnaviaIdentity` / `getEnaviaCapabilities` / `getEnaviaConstitution` | `schema/enavia-cognitive-runtime.js:23-29`, `schema/enavia-identity.js`, `schema/enavia-capabilities.js`, `schema/enavia-constitution.js` | Identidade, capacidades, constituição (estáticas) |
| Operacional | `buildOperationalAwareness` / `renderOperationalAwarenessBlock` | `schema/operational-awareness.js:97-251` | Estado real de browser/executor + diferenciação Conversa/Plano/Ação |
| Memória | `buildRetrievalContext` / `buildRetrievalSummary` | `schema/memory-retrieval.js` | Pipeline PR3 — 3 blocos de memória |
| Planner | `classifyRequest` | `schema/planner-classifier.js` | PM4 — gate A/B/C (não é Intent Engine para resposta) |
| LLM | `callChatModel` | `nv-enavia.js:935-1050` | OpenAI API com `temperature: 0.6`, `max_tokens: 1600`, modelo `gpt-4.1-mini` por default |

**Endpoint único** que gera a resposta atual: `POST /chat/run` →
`handleChatLLM`. Não existe roteamento por intenção, não existe `/skills/run`,
não existe `/brain/*` que injete skills no chat.

---

## 5. Payload do painel e impacto de `read_only`

### Payload real

```jsonc
{
  "message": "<texto do operador>",
  "session_id": "<getSessionId()>",
  "conversation_history": [ /* opcional, ≤20, ≤4000 chars */ ],
  "context": {
    "target": {
      "target_id":   "nv-enavia-prod",
      "target_type": "cloudflare_worker",
      "repo":        "brunovasque/nv-enavia",
      "worker":      "nv-enavia",
      "branch":      "main",
      "environment": "prod",
      "mode":        "read_only"
    },
    "attachments": [ /* opcional */ ]
  }
}
```

### Origem do `read_only`

- **Painel:** default em `panel/src/chat/useTargetState.js:35-49`
  (`DEFAULT_TARGET.mode = "read_only"`) e trava na UI via
  `ALLOWED_MODES = ["read_only"]`. **Não vem de env nem do worker** — é uma
  decisão de UI persistida em `sessionStorage` (`TARGET_STORAGE_KEY =
  "enavia_operational_target"`).
- **Worker:** lido de `context.target.mode` em `nv-enavia.js:3949-3958`.

### Como `read_only` afeta a resposta

`read_only` **não bloqueia execução do LLM nem da rota** — entra como
**instrução textual** em três lugares:

1. **`operationalDefaultsUsed`** (telemetria):
   `nv-enavia.js:3953-3958` adiciona `"read_only"` à lista junto com
   `health_first, no_deploy, no_write, approval_required`.
2. **`_operationalContextBlock` (override de alta recência) — PRINCIPAL
   FONTE DE ENGESSAMENTO:** `nv-enavia.js:4097-4099, 4123` injeta o
   `readOnlyNote` literal:
   `"\nMODO READ-ONLY: resposta NÃO pode sugerir deploy, patch, merge, push
   ou escrita de qualquer tipo."`
   Esse bloco vem **imediatamente antes** da mensagem do usuário e é
   precedido por:
   - `"FORMATO OBRIGATÓRIO PARA RESPOSTA OPERACIONAL"` exigindo "até 7 passos
     numerados", "Cada passo começa com verbo de ação", "Sem markdown headers
     (##, ###)", "Sem 'Fase 1/2/3'", "no máximo 1 coisa bloqueante".
   - `"PRIORIDADE DE DECISÃO — siga esta ordem antes de responder"` (4
     itens).
3. **`buildChatSystemPrompt` — seção 5c:**
   `schema/enavia-cognitive-runtime.js:218-265` injeta, quando `target.mode
   === "read_only"`:
   `"MODO READ-ONLY CONFIRMADO: não sugira deploy, patch, merge, escrita ou
   qualquer operação de escrita. Foque exclusivamente em validação e
   leitura."`
   E logo depois um bloco "MODO OPERACIONAL ATIVO" + "FORMATO DA RESPOSTA
   OPERACIONAL (quando hasTarget=true)" com a mesma trava de "até 7 passos
   numerados".

**Conclusão sobre `read_only`:** ele *não* é apenas um bloqueio de execução —
é interpretado como **instrução de tom/forma**: vira uma regra de
checklist/comando-defensivo que se aplica a TODA mensagem (inclusive
cumprimentos), porque o `target` está sempre presente por ser default da UI.
A interação fica permanentemente em "MODO OPERACIONAL ATIVO".

---

## 6. Prompt atual e blocos de instrução

A montagem real do `messages[]` enviado à OpenAI em `nv-enavia.js:4128-4134`
é, nesta ordem:

```
[
  { role: "system", content: chatSystemPrompt },          // ~8 seções, ver abaixo
  ...(_pr3MemoryBlock),                                   // 0 ou 1 mensagem system
  ...(conversationHistory),                               // user/assistant alternados
  ...(_operationalContextBlock),                          // 0 ou 1 mensagem system (override forte)
  { role: "user", content: message },
]
```

### `chatSystemPrompt` — seções de `buildChatSystemPrompt`
(`schema/enavia-cognitive-runtime.js:93-329`)

| # | Seção | Linhas | Conteúdo |
|---|-------|--------|----------|
| 1 | Identidade viva | 105-112 | Nome ENAVIA, role "Inteligência operacional e cognitiva", owner NV Imóveis |
| 1b | **PAPEL OPERACIONAL + PAPEL PROIBIDO** | 117-134 | Força "ORQUESTRADOR COGNITIVO", proíbe explicitamente assistente comercial/atendente |
| 2 | Como você deve conversar | 137-149 | Tom natural, casual/técnico, sem templates rígidos, identidade fixa |
| 3 | Capacidades reais (`can`/`cannot_yet`) | 152-165 | Listas estáticas de `enavia-capabilities.js` |
| 4 | **Guardrails (constituição)** | 168-176 | `golden_rule` + `operational_security` (sempre injetado) |
| 5 | Contexto dinâmico (page/topic/recent_action/metadata) | 179-199 | Inerte hoje — nenhum desses campos é populado pelo painel |
| 5b | **Operational Awareness (PR4)** | 204-209 | `renderOperationalAwarenessBlock` (estado de browser/executor) |
| 5c | **MODO OPERACIONAL ATIVO + FORMATO DA RESPOSTA OPERACIONAL** | 215-266 | "Use até 7 passos numerados", "verbo de ação", "Defaults seguros: health/status primeiro; leitura apenas; sem deploy; sem patch; sem escrita; pedir aprovação"; bloco "NÃO PERGUNTAR/PODE PERGUNTAR" |
| 6 | **Política de uso de ferramentas internas (planner)** | 270-292 | "REGRA CRÍTICA: o campo reply é SEMPRE fala natural — curta, direta, conversacional. NÃO expanda o reply em um plano completo. NÃO escreva Fase 1/Etapa 1. NÃO use markdown headers." |
| 7 | Continuidade de conversa | 295-298 | Use o histórico se existir |
| 7b | Uso e criação de memória | 302-315 | "Use memórias para agir, não apenas listar" |
| 8 | **Contrato de envelope JSON** | 319-326 | `{"reply":"...","use_planner":true|false}` obrigatório, sem markdown fora do JSON |

### `_operationalContextBlock` — override de alta recência
(`nv-enavia.js:4101-4125`, ativo sempre que `hasTarget` for true — i.e.,
**sempre**, dado o default da UI)

```
INSTRUÇÃO OPERACIONAL PARA ESTA RESPOSTA:
Alvo ativo confirmado: worker: nv-enavia | repo: brunovasque/nv-enavia |
  branch: main | environment: prod | mode: read_only.
O operador fez uma pergunta operacional. Você CONHECE o alvo acima — não
  pergunte qual sistema, worker ou ambiente.

FORMATO OBRIGATÓRIO PARA RESPOSTA OPERACIONAL:
Resposta deve ser OBJETIVA, PRÁTICA e ACIONÁVEL — não um artigo ou
  explicação longa.
• Comece diretamente com a ação recomendada — sem introdução longa.
• Use até 7 passos numerados. Cada passo começa com verbo de ação ...
• Finalize com uma próxima ação clara e objetiva ...
• Se precisar perguntar algo, pergunte no máximo 1 coisa bloqueante ...
• Sem markdown headers (##, ###). Sem "Fase 1/2/3" ...

RESOLUÇÃO DE AMBIGUIDADE — REGRA OBRIGATÓRIA: ...
PRIORIDADE DE DECISÃO — siga esta ordem antes de responder: 1...4...
[+ readOnlyNote +]
[+ memNote +]
```

### Sanitizadores pós-LLM (engessamento garantido)

- `_sanitizeChatReply` — `nv-enavia.js:3512-3545`. Threshold 3 termos →
  reply substituído por `"Entendido. Estou com isso — pode continuar."`
- `_isManualPlanReply` + `_MANUAL_PLAN_FALLBACK` — `nv-enavia.js:3549-3583,
  4397-4401`. Threshold 2 padrões estruturais → reply substituído por
  `"Entendido. Já organizei as etapas internamente — pode avançar ou me
  dizer se quer ajustar algo."`
- Plain-text fallback — `nv-enavia.js:4164-4168`. Se o LLM retornar texto
  fora do envelope JSON: `reply = llmResult.text || "Instrução recebida."`
- Painel exibe `res.data.reply || "Instrução recebida. Processando."`
  (`panel/src/api/endpoints/chat.js:116`).

### Prompt legado `/engineer` (não é o do chat)

`buildSystemPrompt` em `nv-enavia.js:719-873` é **outro** prompt usado por
`/engineer` e por `buildBrain` legado (Memory V2/V3 com KV `SYSTEM_PROMPT`,
`brain:train:*`). **Não** é usado pelo `/chat/run`. Mantemos a observação
porque o operador pode confundir as duas superfícies.

### Conclusão da seção 6

O prompt do `/chat/run` está **estruturalmente orientado a governança e
checklist operacional**, com pelo menos **três camadas redundantes** que
empurram o LLM para o formato "passos numerados, leitura apenas, defaults
seguros":

1. Seção 5c do `chatSystemPrompt`.
2. `_operationalContextBlock` injetado imediatamente antes da `user
   message` (alta recência).
3. Seção 6 do `chatSystemPrompt` que proíbe planos no reply.

Como `target` é sempre presente (default da UI), o "MODO OPERACIONAL ATIVO"
é a postura padrão da Enavia em qualquer mensagem — inclusive cumprimentos
e perguntas conversacionais.

---

## 7. Memória atual: leitura, escrita e injeção no prompt

### Pipeline real (PR3)

- **Leitura:** `buildRetrievalContext(context, env)` em
  `schema/memory-retrieval.js`, chamado em `nv-enavia.js:3961-3973`.
  Apenas se `env.ENAVIA_BRAIN` (KV) estiver ligado. Saída:
  `{ ok, blocks: { validated_learning, manual_instructions,
  historical_memory } }`.
- **Injeção no prompt:** `_pr3MemoryBlock` é montado em
  `nv-enavia.js:3996-4066`. Vira **uma única mensagem `system`** com
  bullets de até 6 itens (`title`, `memory_type`, `content_structured.text`
  ou `summary`).
- **Escrita:** `writeMemory` / `updateMemory` / `blockMemory` /
  `invalidateMemory` em `schema/memory-storage.js` — **não** são chamados
  por `handleChatLLM`. A escrita só ocorre via endpoints separados
  (`/memory/...`) e via `consolidateMemoryLearning` dentro do planner
  quando `shouldActivatePlanner` é true.
- **Storage real:** Cloudflare KV binding `ENAVIA_BRAIN`. Sem ranking
  semântico no caminho do chat — apenas filtro por tipo/status conforme
  `memory-read.js`.
- **Recorte:** sem janela explícita de tokens. Seleção é por tipo
  (`validated_learning`, `manual_instructions`, `historical_memory`) e
  status `MEMORY_STATUS.ACTIVE`.

### O que o chat **não** sabe sobre o estado contratual

Em nenhum ponto do `handleChatLLM` há leitura de:

- `schema/contracts/INDEX.md`
- `schema/contracts/active/*.md`
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`
- `schema/system/ENAVIA_SYSTEM_MAP.md`
- `schema/system/ENAVIA_ROUTE_REGISTRY.json`
- `schema/system/ENAVIA_WORKER_REGISTRY.md`
- `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md`
- Skills documentais (`schema/skills/*.md`)

Esses arquivos vivem no repo. O Worker rodando em produção **não tem
acesso a eles** — não há binding/loader/asset que os carregue. O chat
**não sabe** que o contrato PR17–PR30 foi encerrado nem que o
`CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` está ativo. Toda "consciência
de sistema" hoje vem do prompt estático em
`schema/enavia-cognitive-runtime.js` + `schema/enavia-identity.js` +
`schema/enavia-capabilities.js`, que **não foram atualizados** após
PR17–PR30 nem após PR31.

### Memórias "brain:train:*" do `/engineer`

`nv-enavia.js:436-797` carrega memórias dinâmicas de `brain:train:*` no KV
e injeta em `buildSystemPrompt` (legado, `/engineer`). Esse caminho **não
alcança o `/chat/run`**.

---

## 8. Skills documentais: uso atual e lacunas

Existem 4 skills documentais ativas em `schema/skills/`:

- `CONTRACT_LOOP_OPERATOR.md` (PR26)
- `DEPLOY_GOVERNANCE_OPERATOR.md` (PR27)
- `SYSTEM_MAPPER.md` (PR28)
- `CONTRACT_AUDITOR.md` (PR29)

### Evidência de não-uso no runtime

```
$ grep -n -i "skill\|jarvis\|intent.engine\|skill.router" nv-enavia.js
(zero resultados)
```

- Não existe loader de skills.
- Não existe endpoint `/skills/run`, `/skills/list`, `/skills/route`.
- Não existe Skill Router.
- Skills **não entram** no prompt do `chatSystemPrompt`.
- O chat **não sabe** que `CONTRACT_AUDITOR` ou `DEPLOY_GOVERNANCE_OPERATOR`
  existem.

A skill é, por definição da PR30 (final report) e do INDEX.md, **documental
até que um executor seja implementado via PR-IMPL supervisionada**. PR32
confirma: o executor de skills **não existe**, e o chat **não consulta** as
skills nem como referência textual.

### Lacuna

| Componente esperado | Existe no runtime? | Evidência |
|---------------------|---------------------|-----------|
| Skill loader (lê `schema/skills/*.md` em runtime) | **Não** | nenhum `import`/`fetch`/`KV.get("skills:...")` |
| Skill Router (escolhe skill por intenção) | **Não** | nenhum dispatch por intenção em `handleChatLLM` |
| Skill como contexto do prompt | **Não** | `buildChatSystemPrompt` não injeta skills |
| Endpoint `/skills/*` | **Não** | nenhum match em `nv-enavia.js` |

---

## 9. LLM Core: existe ou não existe

### Não existe `buildEnaviaCorePrompt()` ou equivalente

O que existe hoje (`buildChatSystemPrompt` em
`schema/enavia-cognitive-runtime.js:93-329`) é um **system prompt
conversacional** — não um LLM Core. Ele:

- Concatena identidade + capacidades + constituição (estáticas).
- Adiciona Operational Awareness (estado de braços).
- Adiciona "MODO OPERACIONAL ATIVO" (regras de checklist).
- Adiciona Política de tools (planner interno).
- Adiciona contrato JSON `{ reply, use_planner }`.

### O que **falta** para virar LLM Core

| Camada esperada | Estado |
|-----------------|--------|
| Separação clara entre identidade ↔ memória ↔ intenção ↔ skill ↔ execução | **Misturado** num único prompt monolítico |
| Injeção de **estado atual real** (contrato ativo, fase, próxima PR) | **Ausente** — o prompt não conhece nada de `INDEX.md` ou `STATUS_ATUAL.md` |
| Injeção de **intenção detectada** (Intent Engine) | **Ausente** — só PM4 A/B/C, que é gate de planner |
| Injeção de **skill sugerida** | **Ausente** |
| Injeção de **memória relevante por intenção** | **Parcial** — retrieval roda mas é cego à intenção da mensagem |
| Camada explícita "núcleo cognitivo" diferente do system prompt operacional | **Ausente** — o "core" e o "modo operacional" estão fundidos |

A camada que mais **causa "bot de checklist"** é a 5c (`MODO OPERACIONAL
ATIVO`) + bloco `_operationalContextBlock`, que sempre injetam
"FORMATO OBRIGATÓRIO" (até 7 passos numerados, verbo de ação, sem
markdown headers, defaults seguros health-first/no-deploy/no-write).

---

## 10. Intent Engine: existe ou não existe

**Não existe.**

O que existe é o classificador PM4 (`schema/planner-classifier.js`) que
devolve `complexity_level` ∈ {A, B, C} e `category` ∈
{simple, tactical, complex}. Esse classificador serve **apenas** como gate
para ativar o planner interno (`shouldActivatePlanner` em
`nv-enavia.js:3943`). Ele **não classifica intenção** no sentido pedido pelo
contrato Jarvis Brain (conversation, diagnosis, planning, contract_creation,
pr_review, deploy_decision, memory_question, system_question, skill_request,
execution_request).

A "decisão de tom" do chat hoje vem inteira do prompt estático + override
operacional, **não** de uma classificação de intenção da mensagem.

### Lacuna

| Funcionalidade | Estado |
|----------------|--------|
| Classes de intenção do contrato (10 classes na PR42) | **Inexistentes** |
| Decisão de tom por intenção | **Inexistente** — tom é fixo "MODO OPERACIONAL ATIVO" |
| Decisão de retrieval por intenção | **Inexistente** — retrieval roda igual para tudo |
| Decisão de skill por intenção | **Inexistente** |

---

## 11. Skill Router: existe ou não existe

**Não existe.** Veja seção 8.

Não há código que mapeie intenção → skill, nem que injete uma skill como
contexto. As 4 skills documentais existem **apenas** como Markdown em
`schema/skills/` e não são lidas pelo runtime.

---

## 12. System Awareness: existe ou não existe

**Parcialmente — apenas para braços operacionais (browser/executor),
nada do estado contratual.**

### O que existe

`schema/operational-awareness.js` (271 linhas) — `buildOperationalAwareness`
+ `renderOperationalAwarenessBlock`. Detecta:

- Estado real do braço Browser (`url_configured`, `status`, `can_act`).
- Estado real do braço Executor (`configured`).
- Modo de aprovação (`supervised` / `autonomous`) por `env.ENAVIA_MODE`.
- Tipos canônicos de interação (`conversation` / `plan` / `action`) — mas
  como **labels estáticos**, não como classificação dinâmica.

### O que NÃO existe

- O chat **não consulta**: `INDEX.md`, contratos ativos, status, handoff,
  execution log, system map, route registry, worker registry, playbook,
  skills.
- O chat **não sabe** qual a próxima PR autorizada.
- O chat **não sabe** que ele mesmo é o Worker `nv-enavia` (apenas o
  painel sabe via `target`, e injeta via prompt).
- O chat **não sabe** que `CONTRACT_AUDITOR` existe.
- O chat **não consegue afirmar nada com fonte** sobre o repo.

Essa lacuna é exatamente a Camada 4 do contrato Jarvis Brain (Sistema
Awareness). PR33–PR35 propõem o **Obsidian Brain** como solução: docs
estruturadas em `schema/brain/` carregadas em runtime por um Brain Loader
read-only (PR37).

---

## 13. Response formatter / fallbacks

### Formatters/fallbacks ativos

| # | Origem | Arquivo:linha | Ação |
|---|--------|---------------|------|
| 1 | Plain-text fallback do LLM | `nv-enavia.js:4164-4168` | `reply = llmResult.text \|\| "Instrução recebida."` |
| 2 | `_sanitizeChatReply` (Layer 1) | `nv-enavia.js:3530-3545, 4177` | Substitui por `"Entendido. Estou com isso — pode continuar."` se ≥3 termos do planner |
| 3 | `_isManualPlanReply` (Layer 2) | `nv-enavia.js:3565-3583, 4397-4401` | Substitui por `"Entendido. Já organizei as etapas internamente — pode avançar ou me dizer se quer ajustar algo."` se ≥2 padrões de plano |
| 4 | Painel — fallback de display | `panel/src/api/endpoints/chat.js:116` | `res.data.reply \|\| "Instrução recebida. Processando."` |
| 5 | Bridge bloqueada por aprovação + termo perigoso | `nv-enavia.js:3762-3767` | Cai no fluxo normal silenciosamente |
| 6 | Mock mode (apenas em `mode !== "real"`) | `panel/src/api/endpoints/chat.js:23-60` | 6 respostas robóticas pré-definidas (não afeta produção) |

### Instruções de "MODE" / formato no prompt que enrijecem

- `"FORMATO OBRIGATÓRIO PARA RESPOSTA OPERACIONAL"` — duas vezes
  (seção 5c do `chatSystemPrompt` e `_operationalContextBlock`).
- `"Use até 7 passos numerados. Cada passo começa com verbo de ação"` —
  duas vezes.
- `"Sem markdown headers (##, ###). Sem 'Fase 1/2/3'"` — duas vezes.
- `"Defaults seguros para validação: health/status primeiro; leitura
  apenas; sem deploy; sem patch; sem escrita; pedir aprovação antes de
  qualquer execução"` — uma vez.
- `"Se precisar perguntar algo, pergunte no máximo 1 coisa bloqueante"` —
  duas vezes.
- `"NÃO PERGUNTAR (quando já existem no alvo operacional)"` — uma vez.
- Contrato JSON `{ reply, use_planner }` obrigatório — uma vez (seção 8).

Essas instruções, somadas, **garantem** que mesmo um LLM com personalidade
viva responda como operador defensivo: ações em passos numerados, foco em
read-only, perguntas mínimas, formato fixo. Em mensagens conversacionais
("oi", "tudo bem?") o LLM ainda recebe TODO esse aparato porque
`hasTarget` é sempre `true` (default da UI).

---

## 14. Causa raiz do comportamento robótico

A causa raiz é **composta**, com **três fontes principais que se reforçam
mutuamente**, e **três fontes secundárias** que travam a saída final.

### Causa raiz #1 — `target` default da UI faz a Enavia operar SEMPRE em "MODO OPERACIONAL ATIVO"

- **Onde:** `panel/src/chat/useTargetState.js:35-49` define
  `DEFAULT_TARGET.mode = "read_only"` e tranca via `ALLOWED_MODES`.
  O painel **sempre** envia `context.target` em `chatSend` via
  `buildContext()` (`panel/src/pages/ChatPage.jsx:196-201`).
- **Consequência:** `nv-enavia.js:3949-3952` calcula `hasTarget = true`
  para qualquer mensagem. Daí em diante:
  - `_operationalContextBlock` é sempre injetado
    (`nv-enavia.js:4081-4126`).
  - `buildChatSystemPrompt` ativa a seção 5c "MODO OPERACIONAL ATIVO"
    (`schema/enavia-cognitive-runtime.js:218-265`).
- **Efeito observável:** mesmo um cumprimento simples recebe um system
  prompt orientado a "passos numerados, defaults seguros, sem
  deploy/patch/merge, perguntar 1 coisa por vez".

### Causa raiz #2 — `read_only` é interpretado como REGRA DE TOM, não como bloqueio de execução

- **Onde:** `nv-enavia.js:4097-4099` injeta literalmente
  `"MODO READ-ONLY: resposta NÃO pode sugerir deploy, patch, merge, push
  ou escrita de qualquer tipo."` no prompt.
  `schema/enavia-cognitive-runtime.js:239-241` injeta
  `"MODO READ-ONLY CONFIRMADO: ... Foque exclusivamente em validação e
  leitura."`.
- **Consequência:** o LLM trata `read_only` como instrução conversacional
  ("não fale de patch") e não como "não execute patch". A Enavia perde
  liberdade de **opinar, sugerir, planejar, conversar livremente**.
- **Efeito observável:** respostas defensivas, foco em "o que validar",
  "o que ler", evitando opinião estratégica.

### Causa raiz #3 — Não existe LLM Core / Intent Engine / Skill Router / Brain — o que existe é prompt monolítico orientado a governança

- **Onde:** `schema/enavia-cognitive-runtime.js:93-329` mistura
  identidade + governança + tom + formato em um único bloco.
  `nv-enavia.js` tem zero referências a `skill`/`jarvis`/`intent.engine`.
  Não há leitura de contrato/status/handoff/system map em runtime.
- **Consequência:** o "núcleo cognitivo" da Enavia é, na prática, o
  conjunto de regras de governança traduzidas em prompt. A
  personalidade ("orquestradora cognitiva") é um rótulo; a substância é
  checklist operacional.
- **Efeito observável:** a Enavia "não pensa" — ela executa um
  formulário de governança em prosa.

### Causas secundárias

- **#4 — Sanitizadores pós-LLM substituem reply inteiro** quando o LLM
  ousa ser estratégico (`_sanitizeChatReply`, `_isManualPlanReply`,
  `nv-enavia.js:3530-3583, 4177, 4397-4401`). Se o LLM responder com
  uma estrutura de plano viva, ela é trocada por uma frase robótica
  fixa. Mesmo que o LLM melhore (Causas 1–3), esses dois guards podem
  zerar o reply.
- **#5 — Contrato JSON `{reply, use_planner}` força saída
  estruturada.** Seção 8 de `buildChatSystemPrompt`
  (`schema/enavia-cognitive-runtime.js:319-326`) exige JSON válido. Se
  o LLM falhar o JSON, cai no fallback `"Instrução recebida."`. Esse
  envelope, somado às proibições de markdown/headers no reply, pressiona
  o LLM para texto plano e curto.
- **#6 — `temperature: 0.6` + `max_tokens: 1600` + `gpt-4.1-mini`
  default** — modelo pequeno, temperatura conservadora. Não é a causa
  primária, mas reforça respostas previsíveis.

### Síntese da causa raiz

> A Enavia responde como bot porque (a) o painel sempre coloca o sistema
> em "MODO OPERACIONAL ATIVO read_only" via target default, (b) o prompt
> traduz `read_only` como regra de tom em vez de bloqueio de execução,
> (c) não existe LLM Core / Intent Engine / Skill Router / Brain
> conectado ao runtime — apenas um prompt monolítico orientado a
> governança, (d) dois sanitizadores pós-LLM podem substituir respostas
> vivas por frases robóticas fixas, e (e) o contrato JSON force respostas
> curtas estruturadas.

Nada disso é "bug" — é **a soma de decisões anteriores** (PR1–PR30) que
priorizaram governança sobre vivacidade. A PR32 confirma que a próxima
fase precisa **separar** identidade ↔ tom ↔ governança.

---

## 15. Matriz de lacunas

| Lacuna | Evidência | Impacto | PR recomendada (contrato Jarvis Brain) |
|--------|-----------|---------|-----------------------------------------|
| **Memory Brain (Obsidian) ausente do runtime** | Nenhum loader lê `schema/contracts`, `schema/status`, `schema/handoffs`, `schema/system`, `schema/skills` — `grep -i "skill\|jarvis" nv-enavia.js` = 0. | Enavia não sabe nada do estado real do repo; toda awareness é estática no prompt. | **PR33–PR35 (DOCS), PR37 (IMPL — Brain Loader read-only), PR38 (PROVA)** |
| **LLM Core ausente** | `schema/enavia-cognitive-runtime.js:93-329` é um system prompt monolítico, não separa identidade/intenção/memória/skill. | Sem camada cognitiva clara → personalidade fundida com governança → bot. | **PR39 (DIAG prompt), PR40 (IMPL `buildEnaviaCorePrompt()`), PR41 (PROVA)** |
| **Intent Engine ausente** | Apenas PM4 A/B/C como gate de planner; sem classificação `conversation/diagnosis/planning/contract_creation/pr_review/deploy_decision/...`. | Tom e tools são fixos para qualquer mensagem. | **PR42 (IMPL Intent Engine), PR43 (PROVA)** |
| **Skill Router ausente** | Skills só existem como `.md`; runtime não as carrega; sem `/skills/*`. | Skills documentais não influenciam o chat. | **PR44 (IMPL Skill Router read-only), PR45 (PROVA)** |
| **System Awareness restrita a braços** | `operational-awareness.js` só conhece browser/executor/approval. Estado contratual ausente. | Enavia não pode afirmar/responder sobre o próprio sistema com fonte. | **PR33 (DOCS Brain Architecture) + PR37 (IMPL Brain Loader)** |
| **`read_only` mal interpretado (regra de tom, não de execução)** | `nv-enavia.js:4097-4099` e `enavia-cognitive-runtime.js:239-241` injetam `read_only` como instrução textual no prompt. | Engessa todas as respostas, inclusive conversa simples. | **PR40 (LLM Core) + PR51 (Response Policy viva)** |
| **`_operationalContextBlock` injetado para qualquer mensagem** | `nv-enavia.js:4081` ativa quando `hasTarget`; `hasTarget` é sempre `true` por causa do default da UI (`panel/src/chat/useTargetState.js:35-49`). | "MODO OPERACIONAL ATIVO" vira o estado padrão da Enavia. | **PR40 (LLM Core) + PR42 (Intent Engine — só ativar override em intenções operacionais)** |
| **Response formatter rígido (sanitizers + envelope JSON)** | `_sanitizeChatReply` (3530-3545), `_isManualPlanReply` (3572-3583), envelope JSON obrigatório (`enavia-cognitive-runtime.js:319-326`). | Respostas vivas podem ser substituídas por frases robóticas fixas. | **PR51 (IMPL Response Policy viva), PR52 (PROVA anti-bot)** |
| **Payload do painel sempre força target** | `panel/src/pages/ChatPage.jsx:196-201` + `useTargetState` default. | Worker recebe target inclusive em "oi". | **PR40 (LLM Core) — usar target como contexto opcional, não trigger global; ajustes de painel ficam para contrato futuro de UI** |
| **Ausência de teste anti-bot** | `panel/src/__tests__/` não tem suite que prove resposta viva; tests existentes (`p7-p8-proof`, `p10-operational-states`, `p27-planner-gate-brief`) cobrem planner/operacional, não personalidade. | Não há sinalização automática quando a Enavia volta a ser bot. | **PR41 (PROVA resposta viva) + PR52 (PROVA anti-bot)** |
| **Memory Retrieval cego à intenção** | `buildRetrievalContext` (`schema/memory-retrieval.js`) chamado em `nv-enavia.js:3961-3973` sem distinguir `conversation` vs `planning`. | Mesma memória injetada para tudo. | **PR46 (IMPL Retrieval por intenção), PR47 (PROVA)** |
| **Sem Self-Audit conectado ao chat** | `schema/contract-final-audit.js` e correlatos existem mas não são chamados por `handleChatLLM`. | Enavia não percebe lacunas próprias. | **PR48–PR50 (Self-Audit Framework + IMPL + PROVA)** |

---

## 16. Riscos se implementar sem corrigir a causa

Se PR33+ implementarem Brain/LLM Core/Intent/Skill Router **sem** revisar o
prompt operacional + sanitizers + payload do painel, os seguintes problemas
permanecerão:

1. **Brain ignorado pelo prompt monolítico:** se o `chatSystemPrompt`
   continuar com a seção 5c "MODO OPERACIONAL ATIVO", as instruções do
   Brain serão sobrescritas pela última instrução de alta recência.
2. **Intent Engine sem efeito:** se a intenção classificada não for
   propagada para um seletor de tom (que substitua o
   `_operationalContextBlock` para `conversation`), a Enavia continua em
   modo checklist.
3. **Skill Router como decoração:** sem mudar o prompt, mesmo a "skill
   sugerida" vira mais uma instrução defensiva.
4. **Sanitizadores neutralizam ganhos:** `_isManualPlanReply` substitui
   replies vivos quando o LLM se solta. Se o operador pedir um plano
   estratégico em prosa rica, o reply vira `_MANUAL_PLAN_FALLBACK`.
5. **Envelope JSON inviabiliza prosa rica:** se a PR51 não revisar o
   contrato `{reply, use_planner}`, o LLM continuará constrangido a
   respostas curtas.
6. **Custo subindo sem ganho:** Brain Loader injeta texto adicional. Se
   o LLM continua engessado por outras causas, o operador perceberá
   apenas latência maior.
7. **Drift de governança:** se o painel continuar enviando
   `mode: "read_only"` por default e o prompt seguir interpretando isso
   como tom, a "personalidade viva" dependerá inteiramente de o operador
   destravar manualmente o `mode`, o que a UI hoje **não permite**
   (`ALLOWED_MODES = ["read_only"]`).

**Mitigação contratual:** as PRs PR40 (LLM Core), PR42 (Intent Engine),
PR51 (Response Policy viva) e PR52 (anti-bot test) devem ser tratadas
como **um conjunto coerente**. Implementar Brain (PR37) ou Skill Router
(PR44) sem o LLM Core revisado significa **adicionar contexto a um prompt
que vai ignorá-lo**.

---

## 17. Recomendação para PR33

**Próxima PR autorizada pelo contrato:** **PR33 — PR-DOCS — Arquitetura
do Obsidian Brain.**

Conforme `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
seção "Frente 2 — Obsidian Brain completo" (linhas 105-111 e 246-262):

- Arquivos esperados:
  - `schema/brain/INDEX.md`
  - `schema/brain/GRAPH.md`
  - `schema/brain/MEMORY_RULES.md`
  - `schema/brain/RETRIEVAL_POLICY.md`
  - `schema/brain/UPDATE_POLICY.md`
  - `schema/brain/SYSTEM_AWARENESS.md`
  - Pastas: `maps/`, `decisions/`, `contracts/`, `memories/`, `incidents/`,
    `learnings/`, `open-questions/`, `self-model/`
- Tipo: PR-DOCS, sem alteração de runtime.
- Próxima PR autorizada após PR33: PR34 — PR-DOCS — Self Model.

### Bloqueios encontrados nesta PR32 que afetam o plano da PR33

**Nenhum bloqueio de execução.** A PR33 pode prosseguir como descrito no
contrato.

### Recomendações **não bloqueantes** para a equipe da PR33

Estas observações **não alteram** a PR33; servem para que ela seja escrita
com pleno conhecimento das causas raiz mapeadas aqui:

1. **`SYSTEM_AWARENESS.md` precisa cobrir 4 dimensões reais:**
   contratos (`schema/contracts/`), estado (`status/handoffs/execution`),
   sistema (`schema/system/*`, `playbooks`), skills (`schema/skills/*`).
   Cada uma com fonte explícita — Enavia não pode afirmar nada sem fonte.
2. **`MEMORY_RULES.md` precisa diferenciar regra operacional ↔
   personalidade ↔ checklist.** A causa raiz #2 (read_only como tom)
   surgiu por falta dessa separação. O Brain deve carregar regras
   operacionais sem que elas virem instruções de tom.
3. **`RETRIEVAL_POLICY.md` deve antecipar PR42 (Intent Engine):** o que
   carregar para `conversation` vs `planning` vs `pr_review` vs
   `system_question`. Sem isso, PR46 (Retrieval por intenção) chega sem
   política.
4. **`self-model/how-to-answer.md` deve registrar explicitamente que
   `read_only` é bloqueio de execução, NÃO regra de tom.** Esta é a
   semente da revisão que PR40 (LLM Core) e PR51 (Response Policy viva)
   farão no prompt.
5. **`incidents/chat-engessado-readonly.md` é um incidente real
   diagnosticado nesta PR32** e deve ser referenciado no Brain — para
   que o LLM Core (PR40) e o Self-Audit (PR49) possam recuperar a
   evidência quando relevante.

### Bloqueio de processo — nenhum

Branch sincronizada com `origin/main`, contrato ativo identificado,
governança coerente, próxima PR clara. Nenhum desvio do contrato Jarvis
Brain. Nenhum runtime alterado. Diagnóstico read-only completo.

---

## 18. Próximos passos no contrato Jarvis Brain

Sequência exata conforme contrato (`CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
seções 5–6):

| PR | Tipo | Frente | Objetivo (ancorado nas lacunas desta PR32) |
|----|------|--------|---------------------------------------------|
| **PR33** | **PR-DOCS** | Frente 2 — Obsidian Brain | **Arquitetura do Obsidian Brain.** Endereça lacunas: System Awareness, Memory Brain, Self-Audit base. **Próxima PR autorizada.** |
| PR34 | PR-DOCS | Frente 2 | Self Model da Enavia — `identity.md`, `capabilities.md`, `limitations.md`, `current-state.md`, `how-to-answer.md` |
| PR35 | PR-DOCS | Frente 2 | Migrar conhecimento PR1–PR30 para o Brain |
| PR36 | PR-DIAG | Frente 3 | Diagnóstico da memória atual no runtime |
| PR37 | PR-IMPL | Frente 3 | Brain Loader read-only — Worker passa a ler `schema/brain/*` em runtime |
| PR38 | PR-PROVA | Frente 3 | Provar Brain Loader |
| PR39 | PR-DIAG | Frente 4 | Diagnóstico do prompt atual do chat (aprofundamento desta PR32 focado em prompt) |
| PR40 | PR-IMPL | Frente 4 | **LLM Core v1 — `buildEnaviaCorePrompt()`. Endereça causas raiz #2 e #3.** |
| PR41 | PR-PROVA | Frente 4 | Teste de resposta viva |
| PR42 | PR-IMPL | Frente 5 | Intent Engine (10 classes do contrato) |
| PR43 | PR-PROVA | Frente 5 | Teste de intenção |
| PR44 | PR-IMPL | Frente 6 | Skill Router read-only |
| PR45 | PR-PROVA | Frente 6 | Teste de roteamento de skills |
| PR46 | PR-IMPL | Frente 7 | Retrieval por intenção |
| PR47 | PR-PROVA | Frente 7 | Memória contextual |
| PR48–50 | DOCS/IMPL/PROVA | Frente 8 | Self-Audit Framework + IMPL + descoberta de lacunas |
| PR51 | PR-IMPL | Frente 9 | **Response Policy viva. Endereça causas raiz #4 e #5 (sanitizers + envelope).** |
| PR52 | PR-PROVA | Frente 9 | **Teste anti-bot — fixtures do contrato (PR41 estende):** "Por que você está engessada?", "O que falta para virar Jarvis?", etc. |
| PR53–54 | IMPL/PROVA | Frente 10 | Brain Update supervisionado |
| PR55–56 | DOCS/DIAG | Frente 11 | Blueprint Runtime de Skills |
| PR57–60 | PROVA/HARDENING/DOCS | Frente 12 | Integração final + jornada Jarvis + fechamento v1 |

---

## Anexo A — Verificações de aderência da PR32

| Item | Status |
|------|--------|
| Branch sincronizada com `origin/main` (sem divergência) | ✅ |
| Contrato ativo identificado (`CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`) | ✅ |
| PR anterior (PR31) confirmada como mergeada | ✅ |
| Tipo da PR declarado: PR-DIAG (READ-ONLY) | ✅ |
| Fluxo do chat mapeado de ponta a ponta com arquivo:linha | ✅ (seções 3, 4, 6) |
| Impacto do `read_only` analisado | ✅ (seção 5) |
| Uso real de memória analisado | ✅ (seção 7) |
| Uso real de skills analisado | ✅ (seção 8) |
| Prompt atual analisado | ✅ (seção 6) |
| Lacunas LLM Core / Intent Engine / Skill Router / Brain documentadas | ✅ (seções 9, 10, 11, 12, 15) |
| Causa raiz documentada com evidência real | ✅ (seção 14) |
| Matriz de lacunas | ✅ (seção 15) |
| Recomendação para PR33 | ✅ (seção 17) |
| Nenhum runtime alterado | ✅ (smoke `git diff --name-only` na seção governança) |
| Nenhum endpoint criado | ✅ |
| Nenhum teste criado | ✅ |
| Nenhum prompt modificado | ✅ |
| Nenhum brain implementado | ✅ |
| PR33 não iniciada nesta PR | ✅ |

---

*Relatório criado em: 2026-04-30. Diagnóstico read-only puro. Sem alteração de runtime.*
