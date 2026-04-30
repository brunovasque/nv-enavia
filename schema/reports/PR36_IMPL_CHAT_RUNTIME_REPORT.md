# PR36 — Implementação inicial do Chat Runtime anti-bot

**Data:** 2026-04-30
**Tipo:** PR-IMPL
**Branch:** `copilot/claudepr36-impl-chat-runtime-readonly-target-sanit`
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR35 ✅ (PR-DOCS — Mode Policy criada + contrato ajustado para PR36 ser PR-IMPL)
**Próxima PR autorizada:** PR37 — PR-PROVA — Smoke anti-bot real do chat runtime
**Escopo:** Worker-only, patch cirúrgico

---

## 1. Objetivo

Aplicar a primeira correção real, pequena e cirúrgica no runtime do chat para
começar a transformar a Enavia de bot/checklist em IA LLM-first. Esta PR
implementa, no nível do Worker, as quatro frentes de patch definidas pela
Mode Policy (PR35) com base no diagnóstico técnico em 7 camadas da PR34:

1. `read_only` deixa de ser regra de tom e passa a ser nota factual de gate
   de execução.
2. `target` default do painel deixa de ativar contexto operacional sozinho —
   passa a depender de intenção operacional real na mensagem.
3. Sanitizers/fallbacks pós-LLM passam a tolerar prosa estratégica útil ao
   operador, mantendo bloqueio para vazamento de planner/JSON interno bruto.
4. Telemetria mínima de sanitização adicionada à resposta do `/chat/run`.

A PR não cria contratos, policies, endpoints, brains, intent engines ou
skill routers. Não toca painel, não relaxa gates de execução, não toca
deploy nem governança de runtime — apenas tom, prompt e sanitização.

---

## 2. Diagnósticos usados

- `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md` — causa raiz inicial.
- `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md` —
  diagnóstico técnico em 7 camadas (origem painel → leitura Worker →
  prompts → LLM → sanitizers → envelope JSON → planner).
- `schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md` — roadmap formal.
- `schema/policies/MODE_POLICY.md` — policy aplicada.

Não foi feito novo diagnóstico amplo — apenas implementação do que já
estava formalizado.

---

## 3. Arquivos alterados

| Arquivo | Tipo | Motivo |
|---------|------|--------|
| `nv-enavia.js` | runtime | helpers `_sanitizeChatReply`/`_isManualPlanReply`, novo `isOperationalMessage`, gate de `_operationalContextBlock`, nota factual de `read_only`, telemetria `sanitization`, named exports aditivos para testabilidade |
| `schema/enavia-cognitive-runtime.js` | runtime | `read_only` virou nota factual de capacidade no system prompt (`buildChatSystemPrompt`) |
| `tests/pr36-chat-runtime-anti-bot.smoke.test.js` | teste novo | smoke anti-bot com 25 asserts em 5 cenários |
| `schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md` | report | este arquivo |
| `schema/contracts/INDEX.md` | governança | PR36 ✅ + próxima PR = PR37 PR-PROVA |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | governança | PR36 registrada |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | governança | handoff PR36 → PR37 |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | governança | entrada cronológica |

**Arquivos NÃO alterados (proibidos pelo escopo):** `panel/`,
`contract-executor.js`, `executor/`, `.github/workflows/`, `wrangler.toml`,
`wrangler.executor.template.toml`, contratos encerrados, secrets, bindings,
KV config.

---

## 4. O que mudou em `read_only`

### 4.1 `schema/enavia-cognitive-runtime.js` (~linhas 239-241)

**Antes:**
```js
if (target?.mode === "read_only") {
  sections.push("• MODO READ-ONLY CONFIRMADO: não sugira deploy, patch, merge, escrita ou qualquer operação de escrita. Foque exclusivamente em validação e leitura.");
}
```

**Depois:**
```js
if (target?.mode === "read_only") {
  // PR36: read_only é nota factual de capacidade (gate de execução), não regra de tom.
  sections.push("• Modo atual: read_only. Ações com efeito colateral (deploy, patch, merge, escrita) estão bloqueadas sem aprovação/contrato. Conversar, raciocinar, explicar, diagnosticar e planejar continuam livres.");
}
```

### 4.2 `nv-enavia.js` (~linhas 4097-4099)

**Antes:**
```js
const readOnlyNote = _tgt.mode === "read_only"
  ? "\nMODO READ-ONLY: resposta NÃO pode sugerir deploy, patch, merge, push ou escrita de qualquer tipo."
  : "";
```

**Depois:**
```js
const readOnlyNote = _tgt.mode === "read_only"
  ? "\nModo atual: read_only. Ações com efeito colateral (deploy, patch, merge, push, escrita) estão bloqueadas sem aprovação/contrato. Isto é gate de execução, não regra de tom: você continua livre para conversar, opinar, sugerir, discordar, explicar e planejar."
  : "";
```

### 4.3 Resultado

- `read_only` continua aparecendo no prompt como **fato** (gate de execução).
- `read_only` deixa de instruir o LLM a "não sugerir" / "focar exclusivamente
  em validação".
- O Bridge de Aprovação (`_CHAT_BRIDGE_DANGEROUS_TERMS`) e demais gates
  reais de execução **não foram tocados**: a Enavia continua bloqueada para
  despachar deploy/patch/escrita sem aprovação.

---

## 5. O que mudou em `target` / contexto operacional

### 5.1 Helper novo em `nv-enavia.js`

Adicionado `isOperationalMessage(message, context)` com lista expandida
(incluindo `deploy`, `executor`, `contrato`, `worker`, `health`,
`diagnóstico`, `logs`, `erro`, `branch`, `merge`, `rollback`, `patch`,
`revisar pr`, `endpoint`, `produção`, `prod`, `staging`, `kv`, `binding`).

### 5.2 Mudança em `isOperationalContext`

**Antes:**
```js
const isOperationalContext = hasTarget || isOperationalMessage;
```

**Depois:**
```js
const isOperationalContext = hasOperationalMessageIntent || isOperationalMessageLegacy;
```

Agora `target` sozinho **NÃO** ativa contexto operacional. Conversas como
"oi", "você está parecendo um bot", "o que você sabe fazer?", "qual seu
estado atual?" não disparam mais o bloco `MODO OPERACIONAL ATIVO` /
`FORMATO OBRIGATÓRIO`.

Mensagens operacionais reais (`deploy`, `executor`, `contrato`, `worker`,
`health`, `diagnóstico`, `logs`, `erro`, `branch`, `merge`, `rollback`)
continuam ativando contexto operacional.

### 5.3 Gate complementar em `_operationalContextBlock`

**Antes:** ativado por `if (hasTarget)`.
**Depois:** ativado por `if (hasTarget && isOperationalContext)`.

O bloco operacional pesado (de alta recência, injetado imediatamente antes
da mensagem do user) só é injetado quando há intenção operacional real.

### 5.4 `obviousQuestionsSuppressed`

Era `obviousQuestionsSuppressed = hasTarget`. Passou a depender também de
`isOperationalContext` para ficar coerente: só faz sentido suprimir
"perguntas óbvias" quando o contexto operacional foi de fato ativado.

### 5.5 NÃO foi feito (escopo PR42+)

- Intent Engine completo.
- Classificador semântico de intenção (`conversation` / `diagnosis` /
  `execution`).
- Skill Router.
- Mudança no painel (continua enviando `target.mode = "read_only"`).

A heurística atual é mínima e segura — palavras-chave estendidas. Quando
o Intent Engine real for construído (PR42+), basta substituir o helper.

---

## 6. O que mudou em sanitizers / fallbacks

### 6.1 `_sanitizeChatReply` (planner term leak)

**Antes:**
- Patterns: `/\bnext_action\b/i`, `/\bscope_summary\b/i`, etc. (10 patterns
  por palavra solta).
- Threshold: 3 termos distintos.
- Substituía qualquer reply que mencionasse 3+ termos do planner.

**Depois:**
- Patterns: agora exigem forma de campo (`/\bnext_action\s*[:=]/i`,
  `/\bplanner_snapshot\b/i`, `/\bcanonical_plan\b/i`, `/\bapproval_gate\b/i`,
  `/\bexecution_payload\b/i`, etc.).
- Threshold: 4 termos.
- Sinal estrutural complementar: padrão JSON-like com campos do planner
  (`/"\s*(next_action|...)"\s*:/i`, `/\{[^}]{0,200}\bnext_action\b/i`).
- Dispara **sempre** que o sinal estrutural JSON-like aparecer; ou quando
  4+ termos com forma de campo aparecerem.

**Resultado:** menção em prosa estratégica legítima (ex: "vou usar os
critérios de aceite para validar o planner") não é mais destruída. Apenas
snapshot bruto JSON-like do planner é capturado.

### 6.2 `_isManualPlanReply` (manual plan leak)

**Antes:**
- Threshold: 2 ocorrências totais.
- Disparava em respostas legítimas com markdown headers + Critérios de
  aceite.

**Depois:**
- Threshold: 5 ocorrências totais.
- Bypass: `_looksLikeNaturalProse(reply)` — se o reply tem ≥200 chars e
  ≥3 transições de frase (`. A`, `. O`, `! E`, `? P`...), é considerado
  prosa natural útil ao operador e **não é destruído**.
- Lista mecânica curta de etapas (sem prosa explicativa) continua sendo
  detectada e substituída.

### 6.3 Bloqueios mantidos

- Snapshot JSON-like com `next_action`/`canonical_plan`/`approval_gate`/
  `execution_payload` continua bloqueado.
- Lista mecânica curta de Fase/Etapa/Passo/Critérios continua bloqueada.
- `acceptance_criteria` em formato schema/planner interno (`acceptance_criteria:`)
  continua bloqueado; `acceptance_criteria` em texto explicativo ao operador
  é tolerado.

### 6.4 Plain-text fallback

**Antes:**
```js
reply = llmResult.text || "Instrução recebida.";
```

**Depois:**
```js
const _rawText = llmResult.text;
if (!_rawText || _rawText.length === 0) {
  reply = "Instrução recebida.";
  _sanitization.applied = true;
  _sanitization.layer = "plain_text_fallback";
  _sanitization.reason = "llm_empty_text";
} else {
  reply = _rawText;
}
```

Comportamento canônico mantido (substituição quando vazio), mas registrado
em telemetria.

---

## 7. Telemetria adicionada

### 7.1 Campo `sanitization` na resposta do `/chat/run`

Shape:
```ts
sanitization: {
  applied: boolean,
  layer:   "planner_terms" | "manual_plan" | "plain_text_fallback" | null,
  reason:  string | null,
}
```

- `applied: false` → nenhuma sanitização agiu.
- `applied: true` + `layer: "planner_terms"` → `_sanitizeChatReply` substituiu.
- `applied: true` + `layer: "manual_plan"` → `_isManualPlanReply` substituiu.
- `applied: true` + `layer: "plain_text_fallback"` → reply vazio caiu no
  fallback canônico.

Campo aditivo, não-quebrante: consumidores existentes do painel não são
afetados. Não expõe conteúdo interno sensível — apenas a camada e a razão.

### 7.2 Logs adicionais no Worker

- `🛡️ [CHAT/LLM] Layer-1 sanitizer aplicado (planner_terms)` quando
  `_sanitizeChatReply` substitui.
- O log de manual plan leak já existia e foi mantido.

### 7.3 Telemetria pré-existente preservada

- `arbitration.reply_sanitized` (manual plan).
- `arbitration.reply_sanitized_layer1` (planner terms).
- `llm_parse_mode`.
- `operational_defaults_used`.

---

## 8. Testes executados

### 8.1 Syntax checks

```bash
node --check nv-enavia.js                                  # OK
node --check schema/enavia-cognitive-runtime.js            # OK
node --check tests/pr36-chat-runtime-anti-bot.smoke.test.js # OK
```

### 8.2 Smoke anti-bot novo

```bash
node tests/pr36-chat-runtime-anti-bot.smoke.test.js
```

**Resultado:** 25/25 ✅ passes.

Cobertura:
- **Cenário A** — read_only não injeta tom defensivo + conversas simples
  não são operacionais.
- **Cenário B** — mensagens operacionais reais ainda são detectadas;
  `is_operational_context=true` ativa o bloco operacional.
- **Cenário C** — sanitizer não destrói resposta estratégica longa com
  markdown/headers em prosa natural.
- **Cenário D** — JSON/planner snapshot continua sendo bloqueado; lista
  mecânica curta continua sendo detectada como manual plan.
- **Cenário E** — telemetria de sanitização tem shape esperado
  `{applied, layer, reason}`.

### 8.3 Regressões obrigatórias

```bash
node tests/pr21-loop-status-states.smoke.test.js          # 53/53  ✅
node tests/pr20-loop-status-in-progress.smoke.test.js     # 27/27  ✅
node tests/pr19-advance-phase-e2e.smoke.test.js           # 52/52  ✅
node tests/pr14-executor-deploy-real-loop.smoke.test.js   # 183/183 ✅
node tests/pr13-hardening-operacional.smoke.test.js       # 91/91  ✅
```

### 8.4 Regressões adicionais executadas

```bash
node tests/cognitive-runtime.smoke.test.js                # 44/44  ✅
node tests/pr3-tool-arbitration.smoke.test.js             # 84/84  ✅
node tests/chat-run.http.test.js                          # 24/24  ✅
```

Nenhuma regressão. Todas verdes.

---

## 9. Riscos restantes

1. **Painel ainda envia `target.mode = "read_only"` em toda mensagem.** A
   PR36 desacopla isso no Worker, mas a UX no painel continua mostrando
   "modo operacional" como default. Recomendação: PR separada Panel-only
   para revisar `panel/src/chat/useTargetState.js` e expor toggle real de
   modo.
2. **A heurística `isOperationalMessage` é por palavras-chave.** Mensagens
   ambíguas ("parece que algo quebrou" sem palavra-chave) podem cair no
   modo conversa. Aceitável para PR36 — Intent Engine real entra na PR42.
3. **Sanitizer com threshold mais alto pode deixar passar leaks brandos.**
   Mitigação: o sinal estrutural JSON-like (`{... next_action ...}`) ainda
   dispara independente do threshold.
4. **`_looksLikeNaturalProse` é heurística simples.** Se um plano mecânico
   for muito longo e bem pontuado, pode escapar. Mitigação aceitável: o
   sinal estrutural do planner (campo:) ainda bloqueia leak real.
5. **Telemetria `sanitization` é aditiva** — consumidores precisam ler
   esse campo para diagnosticar. Painel atual não exibe (não foi tocado).

---

## 10. O que NÃO foi feito (intencionalmente)

- Não criei novo contrato.
- Não criei nova policy.
- Não fiz novo diagnóstico amplo.
- Não implementei Obsidian Brain (PR37+ no plano original — agora
  deslocado para depois da Frente 2 corretiva).
- Não implementei LLM Core completo.
- Não implementei Intent Engine completo.
- Não implementei Skill Router.
- Não criei endpoint novo.
- Não alterei deploy/governance.
- Não relaxei gates reais de execução / aprovação / Bridge perigoso.
- Não expus JSON/planner interno ao usuário.
- Não removi sanitizers totalmente — apenas reduzi destrutividade.
- Não toquei produção.
- Não toquei painel.

---

## 11. Próxima PR recomendada

**PR37 — PR-PROVA — Smoke anti-bot real do chat runtime**

Como a PR36 foi PR-IMPL real, a próxima deve ser PROVA. PR37 deve:

- Subir o Worker em staging/test e exercitar `/chat/run` com cenários
  reais cobrindo:
  - conversa simples com `target.mode = "read_only"` (operador "oi") →
    confirmar que `operational_context_applied: false` e que o reply é
    natural (não fallback).
  - mensagem operacional real ("audita a fase atual do contrato") →
    confirmar `operational_context_applied: true` e reply útil.
  - injeção controlada de planner snapshot (ou simulação) → confirmar
    `sanitization.layer = "planner_terms"`.
  - resposta longa estruturada → confirmar que sanitizer não substituiu.
- Capturar evidências reais (request/response).
- Não alterar runtime.

Após PR37, a Frente 2 corretiva fica fechada e a Frente 3 (Brain/Intent/
Skill) pode reabrir conforme contrato.
