# ENAVIA — Latest Handoff

**Data:** 2026-04-30
**De:** PR36 — PR-IMPL — Correção inicial do chat runtime (read_only como gate, target sem tom forçado, sanitizers não destrutivos, telemetria)
**Para:** PR37 — PR-PROVA — Smoke anti-bot real do chat runtime

## O que foi feito nesta sessão

### PR36 — PR-IMPL — Chat runtime anti-bot inicial

**Tipo:** `PR-IMPL` (worker-only, patch cirúrgico)
**Branch:** `copilot/claudepr36-impl-chat-runtime-readonly-target-sanit`

**Arquivos alterados (runtime):**

1. **`nv-enavia.js`**:
   - `_sanitizeChatReply`: patterns mais estritos (forma de campo `chave:` ou `chave=`), threshold elevado (3 → 4), sinal estrutural complementar JSON-like que dispara independente do threshold.
   - `_isManualPlanReply`: threshold elevado (2 → 5) + bypass `_looksLikeNaturalProse` para preservar prosa estratégica útil ao operador.
   - Helper novo `isOperationalMessage(message, context)` com lista expandida (deploy, executor, contrato, worker, health, diagnóstico, logs, erro, branch, merge, rollback, patch, revisar pr, endpoint, prod, staging, kv, binding, etc.).
   - `isOperationalContext` agora depende de intenção operacional real, não de `hasTarget` sozinho.
   - `_operationalContextBlock` ativado por `(hasTarget && isOperationalContext)` em vez de `hasTarget` puro.
   - `readOnlyNote` reescrito como nota factual de gate de execução.
   - Telemetria `sanitization: {applied, layer, reason}` adicionada à resposta `/chat/run` (campo aditivo).
   - Named exports aditivos para testabilidade (`_sanitizeChatReply`, `_isManualPlanReply`, `_looksLikeNaturalProse`, `_MANUAL_PLAN_FALLBACK`, `isOperationalMessage`).

2. **`schema/enavia-cognitive-runtime.js`**:
   - Seção 5c: `read_only` virou nota factual ("Modo atual: read_only. Ações com efeito colateral estão bloqueadas sem aprovação/contrato. Conversar, raciocinar, explicar, diagnosticar e planejar continuam livres.") — não mais regra de tom defensiva.

**Arquivos criados (testes + governança):**

3. **`tests/pr36-chat-runtime-anti-bot.smoke.test.js`** (NOVO): 5 cenários, 25 asserts, todos verdes.
4. **`schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md`** (NOVO): 11 seções com objetivo, diagnósticos usados, arquivos alterados, mudanças, telemetria, testes, riscos, o que NÃO foi feito e próxima PR.

**Arquivos atualizados (governança):**

5. **`schema/contracts/INDEX.md`**: PR36 ✅ adicionada. Próxima PR autorizada → PR37 PR-PROVA.
6. **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR36 registrada. Próxima PR: PR37.
7. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo): handoff atualizado para PR37.
8. **`schema/execution/ENAVIA_EXECUTION_LOG.md`**: bloco PR36 adicionado.

**Arquivos NÃO alterados (proibidos pelo escopo):**

- `panel/` (nenhum arquivo tocado)
- `contract-executor.js`, `executor/`
- `.github/workflows/`
- `wrangler.toml`, `wrangler.executor.template.toml`
- secrets, bindings, KV config
- contratos encerrados
- Nenhum endpoint criado, nenhum brain/intent engine/skill router criado, nenhum deploy.
- Nenhum gate real de execução / aprovação / Bridge perigoso relaxado.

## Smoke tests executados

```bash
node --check nv-enavia.js                                         # OK
node --check schema/enavia-cognitive-runtime.js                   # OK
node --check tests/pr36-chat-runtime-anti-bot.smoke.test.js       # OK
node tests/pr36-chat-runtime-anti-bot.smoke.test.js               # 25/25  ✅
node tests/pr21-loop-status-states.smoke.test.js                  # 53/53  ✅
node tests/pr20-loop-status-in-progress.smoke.test.js             # 27/27  ✅
node tests/pr19-advance-phase-e2e.smoke.test.js                   # 52/52  ✅
node tests/pr14-executor-deploy-real-loop.smoke.test.js           # 183/183 ✅
node tests/pr13-hardening-operacional.smoke.test.js               # 91/91  ✅
node tests/cognitive-runtime.smoke.test.js                        # 44/44  ✅
node tests/pr3-tool-arbitration.smoke.test.js                     # 84/84  ✅
node tests/chat-run.http.test.js                                  # 24/24  ✅
```

Nenhuma regressão.

## Próxima ação autorizada

**PR37 — PR-PROVA — Smoke anti-bot real do chat runtime**

A PR36 foi PR-IMPL real, então a próxima é PROVA (não volta para PR-DOCS).

### Escopo técnico esperado para PR37

- Subir Worker em staging/test e exercitar `/chat/run` com cenários reais.
- Confirmar comportamento end-to-end:
  - Conversa simples + `target.mode = "read_only"` → `operational_context_applied: false`, reply natural, sem fallback.
  - Mensagem operacional real → `operational_context_applied: true`, reply útil estruturado.
  - Snapshot de planner injetado (controlado) → `sanitization.layer = "planner_terms"`.
  - Resposta longa estratégica → preservada, sem `manual_plan` fallback.
- Capturar request/response como evidência.
- Não alterar runtime nem painel.

Após PR37, a Frente 2 corretiva (PR33-PR37) fica fechada e a Frente 3 (Brain/Intent Engine/Skill Router) pode iniciar.

---

## Histórico: PR35

**De:** PR34 — PR-DIAG — Diagnóstico técnico profundo
**Para:** PR36 (esta PR)

### PR35 — PR-DOCS — Mode Policy + ajuste do contrato para execução real na PR36

**Tipo:** `PR-DOCS` (sem alteração de runtime)  
**Branch:** `copilot/claudepr35-docs-mode-policy-e-ajuste-para-execucao`

**Arquivos criados:**

1. **`schema/policies/MODE_POLICY.md`** (NOVO):
   - 9 seções obrigatórias.
   - Separação explícita: intenção da mensagem ↔ permissão de execução ↔ tom da resposta.
   - `read_only` = gate de execução, não regra de tom.
   - 3 modos canônicos: `conversation`, `diagnosis`, `execution`.
   - Regra de target: painel não decide tom.
   - Regra de tom: IA estratégica primeiro.
   - Regra de planner: ferramenta interna, não personalidade.
   - Regra de sanitizers: bloqueiam vazamento, não destroem resposta útil.
   - 4 exemplos concretos de comportamento esperado.
   - Seção 9: roadmap da PR36 com 5 frentes de patch cirúrgico.

2. **`schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md`** (NOVO):
   - Relatório completo da PR35.
   - Diagnóstico que fundamenta a policy (resumido).
   - Riscos reconhecidos (excesso documental, regressão em sanitizers, acoplamento Worker/Panel).
   - Critérios de aceite verificados.

**Arquivos atualizados:**

3. **`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`**:
   - `Próxima PR autorizada` atualizado: PR36 → PR-IMPL.
   - Frente 2: PR36 mudou de PR-DOCS para PR-IMPL.
   - Seção de PR35 no detalhamento: atualizada com escopo real.
   - Seção de PR36 no detalhamento: reescrita como PR-IMPL com escopo técnico detalhado, arquivos esperados, critérios de aceite e smoke tests.

4. **`schema/contracts/INDEX.md`**:
   - Próxima PR autorizada → PR36 PR-IMPL.
   - PR35 ✅ adicionada ao histórico.

5. **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR35 registrada. Próxima PR: PR36 PR-IMPL.
6. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo): handoff atualizado de PR35 para PR36.
7. **`schema/execution/ENAVIA_EXECUTION_LOG.md`**: bloco PR35 adicionado.

**Arquivos NÃO alterados (proibidos pelo escopo):**

- `nv-enavia.js` ✅ (não tocado)
- `schema/enavia-cognitive-runtime.js` ✅ (não tocado)
- `schema/enavia-identity.js`, `schema/enavia-capabilities.js`, `schema/enavia-constitution.js` ✅
- `schema/operational-awareness.js`, `schema/planner-classifier.js`, `schema/planner-output-modes.js`, `schema/memory-retrieval.js` ✅
- `panel/src/chat/useTargetState.js` ✅ (não tocado)
- `panel/src/pages/ChatPage.jsx` ✅ (não tocado)
- `panel/src/api/endpoints/chat.js` ✅ (não tocado)
- `panel/src/chat/useChatState.js` ✅ (não tocado)
- Nenhum sanitizer alterado. Nenhum prompt real alterado.
- Nenhum endpoint criado. Nenhum teste criado.
- Nenhum Brain/LLM Core/Intent Engine/Skill Router criado.
- Nenhum deploy. Nenhuma alteração em produção.

## Próxima ação autorizada

**PR36 — PR-IMPL — Correção inicial do chat runtime**

### Escopo técnico da PR36

Patch cirúrgico mínimo com 5 frentes (conforme `schema/policies/MODE_POLICY.md`, seção 9):

1. **Separar `read_only` como gate de execução** — remover instruções de tom nos prompts, manter gate determinístico.
   - Referências: `nv-enavia.js:4097-4099`, `schema/enavia-cognitive-runtime.js:239-241`.

2. **Desacoplar `isOperationalContext` de `target` default** — `isOperationalContext` não deve ser `true` apenas porque `hasTarget = true`.
   - Referência: `schema/enavia-cognitive-runtime.js:buildContext()`, seção 5c do prompt.

3. **Reduzir sanitizers destrutivos** — aumentar threshold ou adicionar verificação de contexto em `_sanitizeChatReply` e `_isManualPlanReply`.
   - Referências: `nv-enavia.js:3530-3583, 4177, 4397-4401`.

4. **Adicionar telemetria de fallback** — log visível no Worker quando qualquer sanitizer substituir resposta.

5. **Preservar segurança** — nenhuma mudança deve expor JSON interno ou remover gates de deploy.

### Prioridade de escopo

- **Worker-only** (preferencial).
- Panel apenas se inevitável — nesse caso, avaliar PR separada.
- Não implementar Intent Engine completo.
- Não implementar LLM Core completo.
- Não tocar Obsidian Brain.

### Pré-requisitos da PR36

- PR35 ✅ (Mode Policy criada, contrato ajustado).
- PR34 ✅ (diagnóstico técnico com evidência de arquivo:linha disponível).
- PR33 ✅ (Regras R1-R4 no contrato).
- Diagnóstico suficiente — nenhuma PR-DIAG adicional necessária antes de PR36.

### Por que PR36 é PR-IMPL e não mais PR-DOCS

O diagnóstico está completo:
- PR32: causa raiz identificada.
- PR34: causa técnica refinada em 7 camadas com evidência de arquivo:linha.
- PR35: policy definindo o comportamento correto.

Mais documentação seria excesso documental. O contrato agora força produto.

---

## Histórico: PR34

**De:** PR33 — PR-DOCS — Ajuste do contrato pós-diagnóstico  
**Para:** PR35 (esta PR)

### PR34 — PR-DIAG — Diagnóstico profundo (READ-ONLY)

**Tipo:** `PR-DIAG` (READ-ONLY — sem alteração de runtime)
**Branch:** `copilot/claude-pr34-diag-readonly-target-sanitizers`

**Arquivo criado:** `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`
- 20 seções + causa técnica refinada em 7 camadas.
- Mapeamento ponta-a-ponta de `read_only`, `target` default e 5 sanitizers/fallbacks.
- Análise do envelope `{reply, use_planner}` e planner vs conversa.

**Arquivos atualizados:** `schema/contracts/INDEX.md`, `schema/status/ENAVIA_STATUS_ATUAL.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, `schema/execution/ENAVIA_EXECUTION_LOG.md`.

Detalhes completos em `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`.


## O que foi feito nesta sessão

### PR34 — PR-DIAG — Diagnóstico profundo (READ-ONLY)

**Tipo:** `PR-DIAG` (READ-ONLY — sem alteração de runtime)
**Branch:** `copilot/claude-pr34-diag-readonly-target-sanitizers`

**Arquivos criados:**

1. **`schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`** (NOVO):
   - Estrutura completa: 20 seções obrigatórias + critérios de aceite.
   - Ancorado em arquivo:linha real do commit corrente (sem drift vs PR32).
   - Mapeamento ponta-a-ponta de `read_only` (3 camadas: painel, Worker, runtime cognitivo).
   - Mapeamento ponta-a-ponta de `target` default (sempre presente, ativa 3 blocos operacionais).
   - Mapeamento ponta-a-ponta dos 5 sanitizers/fallbacks (F1: `_sanitizeChatReply`, F2: `_isManualPlanReply`+`_MANUAL_PLAN_FALLBACK`, F3: plain-text, F4: painel display, F5: bridge bloqueada).
   - Análise do envelope `{reply, use_planner}` e suas proibições (markdown, headers, plano).
   - Análise da relação planner vs conversa (`shouldActivatePlanner`, override por termos hardcoded).
   - Causa técnica refinada em **7 camadas** (origem painel → leitura Worker → tradução semântica em prompts → geração LLM → pós-processamento sanitizers → envelope JSON → roteamento planner).
   - Impacto em cada frente futura do Jarvis Brain (Brain, Self Model, LLM Core, Intent Engine, Skill Router, Response Policy, Self-Audit).
   - Recomendações conceituais (sem código) para PR35 (Mode Policy: 3 modos canônicos + separação tom/intenção/execução) e PR36 (Response Policy: redesenhar sanitizers + relaxar envelope + telemetria visível).
   - Sequência segura PR35 → PR36 → PR40 → PR42 → PR51 → PR52.

**Arquivos atualizados (governança):**

2. **`schema/contracts/INDEX.md`**: PR34 ✅. Próxima PR autorizada → PR35.
3. **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR34 registrada. Próxima PR: PR35. Resumo do refinamento em 7 camadas.
4. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo): handoff atualizado de PR34 para PR35.
5. **`schema/execution/ENAVIA_EXECUTION_LOG.md`**: bloco PR34 adicionado no topo.

**Arquivos NÃO alterados (proibidos pelo escopo desta PR):**

- `nv-enavia.js` ✅ (não tocado)
- `schema/enavia-cognitive-runtime.js` ✅ (não tocado)
- `schema/enavia-identity.js`, `schema/enavia-capabilities.js`, `schema/enavia-constitution.js` ✅
- `schema/operational-awareness.js`, `schema/planner-classifier.js`, `schema/planner-output-modes.js`, `schema/memory-retrieval.js` ✅
- `panel/src/chat/useTargetState.js` ✅ (não tocado)
- `panel/src/pages/ChatPage.jsx` ✅ (não tocado)
- `panel/src/api/endpoints/chat.js` ✅ (não tocado)
- `panel/src/chat/useChatState.js` ✅ (não tocado)
- Nenhum sanitizer alterado.
- Nenhum prompt real alterado.
- Nenhum endpoint criado.
- Nenhum teste criado.
- Nenhum Brain/LLM Core/Intent Engine/Skill Router criado.
- Nenhum deploy. Nenhuma alteração em produção.
- PR35 NÃO iniciada nesta PR.

## Próxima ação autorizada

**PR35 — PR-DOCS — Política correta de modos: conversa vs diagnóstico vs execução**

### O que a PR35 deve produzir

- Documento de política de modos (em `schema/policies/` ou pasta acordada pelo contrato), em português, sem alteração de runtime.
- Definição dos 3 modos canônicos: `conversation`, `diagnosis`, `execution`.
- Separação explícita entre 3 planos: capacidade de execução ↔ intenção da mensagem ↔ tom da resposta.
- Redefinição de `read_only` como **bloqueio de execução** (gate determinístico futuro), nunca como regra de tom.
- Política de ativação condicional do bloco operacional (só em `deploy_decision`/`execution_request`/`pr_review-com-execução`).
- Política de `read_only` no prompt: nota factual, sem instrução de fala defensiva.
- Registro de que `ALLOWED_MODES` no painel deve ser ampliado em contrato futuro de UI.

### Pré-requisitos da PR35

- PR34 mergeada ✅ (objetivo desta PR).
- Diagnóstico PR34 disponível como referência conceitual.
- Contrato ativo PR31-PR64 com Regras R1-R4 já registradas.

### Entrega esperada da PR35

Documento(s) markdown definindo a Mode Policy. Sem `.js`/`.ts`/`.jsx`/`.tsx`/`.toml`/`.yml` alterados. Sem implementação. Sem teste.

## Causa técnica refinada (PR34)

A causa-raiz da PR32 foi refinada em **7 camadas que se reforçam**:

1. **Origem (painel):** `DEFAULT_TARGET.mode = "read_only"` + `ALLOWED_MODES = ["read_only"]` + `buildContext()` sempre incluindo `target`.
2. **Leitura (Worker):** `hasTarget=true ⇒ isOperationalContext=true` ativa 3 blocos operacionais simultaneamente.
3. **Tradução semântica (prompts):** `read_only` injetado como string textual ("não sugira", "foque exclusivamente em validação e leitura") em `nv-enavia.js:4097-4099` e `enavia-cognitive-runtime.js:239-241`.
4. **Geração (LLM):** o LLM cumpre as instruções de tom defensivo.
5. **Pós-processamento (sanitizers):** Layer 1 (`_sanitizeChatReply` ≥3 termos planner) e Layer 2 (`_isManualPlanReply` ≥2 padrões estruturais) podem destruir reply vivo.
6. **Envelope JSON:** `{reply, use_planner}` + proibições de markdown/headers/plano constrangem expressividade.
7. **Roteamento (planner):** `shouldActivatePlanner` ativa por palavras-chave (não por intenção); plano vai para `plannerSnapshot` que o painel não exibe de forma viva.

## Regras R1-R4 (do contrato, registradas em PR33)

- **R1:** `read_only` é bloqueio de execução, NÃO regra de tom. **Confirmada e detalhada na PR34 (§4–§7).**
- **R2:** Sanitizadores pós-LLM não podem substituir resposta viva legítima por fallback robótico. **Confirmada e detalhada na PR34 (§10–§11).**
- **R3:** Target operacional não deve transformar toda conversa em modo operacional. Intent Engine decide o tom. **Confirmada e detalhada na PR34 (§8–§9).**
- **R4:** O Brain (PR37+) nasce ciente do incidente `chat-engessado-readonly`. **Reafirmada na PR34 (§15).**

## Contrato ativo

`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` — **Ativo 🟢** (ampliado para PR31-PR64)

## Bloqueios

- nenhum

---

## Histórico — PR33 — PR-DOCS — Ajuste do contrato Jarvis Brain após diagnóstico PR32

(handoff anterior preservado abaixo para referência)

**De:** PR33 — PR-DOCS — Ajuste do contrato Jarvis Brain após diagnóstico PR32
**Para:** PR34 — PR-DIAG — Diagnóstico específico de read_only, target default e sanitizers

## O que foi feito nesta sessão

### PR33 — PR-DOCS — Ajuste do contrato pós-diagnóstico PR32

**Tipo:** `PR-DOCS` (sem alteração de runtime)
**Branch:** `copilot/claudepr33-docs-ajuste-contrato-jarvis-pos-diagnos`

**Arquivos atualizados:**

1. **`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`** (ATUALIZADO):
   - Título atualizado: PR31–PR64 (era PR31–PR60).
   - Seção 0: próxima PR autorizada → PR34.
   - Seção 4: Regras R1-R4 adicionadas após a tabela de ações.
   - Seção 5: Nova Frente 2 corretiva (PR33-PR36) inserida. Frentes 2–12 renumeradas para 3–13. PRs 33-60 renumeradas para 37-64.
   - Seção 6: Detalhamento completo de PR33, PR34, PR35, PR36 adicionado. Todos os blocos PR33→PR37, PR34→PR38, ..., PR60→PR64 renumerados. Notas sobre diagnóstico PR32 adicionadas em PR37, PR38, PR39, PR44, PR46.
   - Seção 7: "a partir da PR33" → "a partir da PR37".
   - Seção 11: Nota de atualização pós-PR33 adicionada no final.

2. **`schema/contracts/INDEX.md`** (ATUALIZADO):
   - Próxima PR autorizada → PR34.
   - PR33 marcada como concluída.
   - PRs do contrato: PR31-PR64.

3. **`schema/status/ENAVIA_STATUS_ATUAL.md`** (ATUALIZADO):
   - Última tarefa: PR33.
   - Branch: copilot/claudepr33.
   - Próxima PR: PR34.
   - Contexto das Regras R1-R4 adicionado.

4. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo):
   - Handoff atualizado de PR33 para PR34.

5. **`schema/execution/ENAVIA_EXECUTION_LOG.md`** (ATUALIZADO):
   - Bloco PR33 adicionado no topo.

6. **`schema/reports/PR33_AJUSTE_CONTRATO_JARVIS_POS_DIAGNOSTICO.md`** (NOVO):
   - Relatório curto da PR33.

**Arquivos NÃO alterados:**
- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`
- Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Nenhum teste criado ou modificado.
- Nenhum secret, binding ou KV alterado.
- Nenhum endpoint criado.
- Nenhum prompt do runtime modificado.
- Nenhum brain/Intent Engine/Skill Router implementado.

## Causa raiz e regras derivadas do diagnóstico PR32

Registradas no contrato como Regras R1-R4:

- **R1:** `read_only` é bloqueio de execução, NÃO regra de tom. A Enavia conversa livremente mesmo em read_only.
- **R2:** Sanitizadores pós-LLM não podem substituir resposta viva legítima por fallback robótico.
- **R3:** Target operacional não deve transformar toda conversa em modo operacional. Intent Engine decide o tom.
- **R4:** O Brain (PR37+) nasce ciente do incidente `chat-engessado-readonly` (PR32).

## Contrato ativo

`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` — **Ativo 🟢** (ampliado para PR31-PR64)

## Próxima ação autorizada

**PR34 — PR-DIAG — Diagnóstico específico de read_only, target default e sanitizers**

### O que a PR34 deve investigar

- `useTargetState.js:35-49` — como o painel força `read_only` por default e qual o impacto exato
- `nv-enavia.js:4097-4099` — como `read_only` vira instrução de tom no runtime
- `schema/enavia-cognitive-runtime.js:239-241` — instrução de tom derivada de `read_only`
- `nv-enavia.js:3530-3583` — `_sanitizeChatReply` e como/quando substitui respostas
- `nv-enavia.js:4177, 4397-4401` — outros sanitizadores/filtros
- `schema/enavia-cognitive-runtime.js:319-326` — envelope JSON `{reply, use_planner}`
- Impacto de cada um no comportamento final

### Entrega esperada da PR34

`schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`

## Bloqueios

- nenhum



## O que foi feito nesta sessão

### PR32 — PR-DIAG — Diagnóstico READ-ONLY do chat engessado

**Tipo:** `PR-DIAG` (READ-ONLY — sem alteração de runtime)
**Branch:** `copilot/claude-pr32-diag-chat-engessado-jarvis-brain`

**Arquivos criados:**

1. **`schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`** (NOVO):
   - Relatório com 18 seções obrigatórias + Anexo A.
   - Mapeamento ponta-a-ponta do fluxo `/chat/run` (painel → worker → LLM → display).
   - Causa raiz documentada com evidência de arquivo:linha.
   - Matriz de lacunas (12 itens) ligadas a PRs do contrato Jarvis Brain.
   - Riscos de implementar Brain/LLM Core/Skill Router sem corrigir causa raiz.
   - Recomendação confirmada para PR33 — sem bloqueios.

**Arquivos atualizados:**

2. **`schema/contracts/INDEX.md`**:
   - "Próxima PR autorizada" → PR33 — PR-DOCS — Arquitetura do Obsidian Brain.
   - PR31 e PR32 marcadas como concluídas.

3. **`schema/status/ENAVIA_STATUS_ATUAL.md`**:
   - PR32 registrada como última tarefa.
   - Causa raiz do chat engessado resumida com referências de arquivo:linha.
   - Próxima PR: PR33.

4. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo):
   - Handoff atualizado de PR32 para PR33.

5. **`schema/execution/ENAVIA_EXECUTION_LOG.md`**:
   - Bloco PR32 adicionado no topo.

**Arquivos NÃO alterados:**
- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`
- Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Nenhum teste criado ou modificado.
- Nenhum secret, binding ou KV alterado.
- Nenhum endpoint criado.
- Nenhum prompt do runtime modificado.
- Nenhum brain/Intent Engine/Skill Router implementado.

## Causa raiz identificada (evidência completa em PR32_CHAT_ENGESSADO_DIAGNOSTICO.md)

A Enavia responde como bot porque (a) o painel sempre coloca o sistema em "MODO OPERACIONAL ATIVO read_only" via target default (`panel/src/chat/useTargetState.js:35-49`); (b) o prompt traduz `read_only` como regra de tom em vez de bloqueio de execução (`nv-enavia.js:4097-4099`, `schema/enavia-cognitive-runtime.js:239-241`); (c) não existe LLM Core / Intent Engine / Skill Router / Brain conectado ao runtime (`grep -i "skill\|jarvis\|intent.engine\|skill.router" nv-enavia.js` = 0 resultados); (d) dois sanitizadores pós-LLM podem substituir respostas vivas por frases robóticas fixas (`nv-enavia.js:3530-3583, 4177, 4397-4401`); (e) o contrato JSON `{reply, use_planner}` força respostas curtas estruturadas (`schema/enavia-cognitive-runtime.js:319-326`).

## Contrato ativo

`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` — **Ativo 🟢**

## Próxima ação autorizada

**PR33 — PR-DOCS — Arquitetura do Obsidian Brain**

### O que a PR33 deve criar (seções 5–6 do contrato, linhas 105-111 e 246-262)

- `schema/brain/INDEX.md`
- `schema/brain/GRAPH.md`
- `schema/brain/MEMORY_RULES.md`
- `schema/brain/RETRIEVAL_POLICY.md`
- `schema/brain/UPDATE_POLICY.md`
- `schema/brain/SYSTEM_AWARENESS.md`
- Pastas: `maps/`, `decisions/`, `contracts/`, `memories/`, `incidents/`, `learnings/`, `open-questions/`, `self-model/`

### Recomendações **não bloqueantes** da PR32 para a equipe da PR33

(Para conhecimento — não alteram o escopo da PR33 definido no contrato)

1. `SYSTEM_AWARENESS.md` deve cobrir 4 dimensões reais: contratos, estado, sistema, skills — cada uma com fonte explícita.
2. `MEMORY_RULES.md` deve diferenciar regra operacional ↔ personalidade ↔ checklist (causa raiz #2 surgiu por falta dessa separação).
3. `RETRIEVAL_POLICY.md` deve antecipar PR42 (Intent Engine): o que carregar para `conversation` vs `planning` vs `pr_review` vs `system_question`.
4. `self-model/how-to-answer.md` deve registrar explicitamente que `read_only` é bloqueio de execução, NÃO regra de tom.
5. `incidents/chat-engessado-readonly.md` é o incidente real diagnosticado nesta PR32 — referenciar para que PR40 (LLM Core) e PR49 (Self-Audit) possam recuperar a evidência.

### Entrega esperada da PR33

Estrutura completa de `schema/brain/` criada, conforme contrato. Tipo: PR-DOCS, sem alteração de runtime.

## Bloqueios

- nenhum


## O que foi feito nesta sessão

### PR31 — PR-DOCS — Ativar contrato Jarvis Brain v1

**Tipo:** `PR-DOCS`
**Branch:** `copilot/claude-pr31-docs-ativar-contrato-jarvis-brain`

**Arquivos criados:**

1. **`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`** (NOVO):
   - Contrato macro da nova fase ENAVIA JARVIS BRAIN v1.
   - 11 seções: status, objetivo macro, filosofia, arquitetura alvo (7 camadas), regras de segurança, escopo PR31–PR60 (12 frentes, 30 PRs), detalhamento completo de cada PR, Obsidian Brain estrutura alvo, critérios de sucesso, riscos, regras de bloqueio, estado inicial.
   - Frase central: "A Enavia pensa livremente, lembra com estrutura, sugere com inteligência e executa somente com governança."
   - Princípio: "A Enavia é LLM-first. Contratos, skills, mapas, workers e executores são ferramentas da inteligência, não a personalidade dela."

2. **`schema/reports/PR31_ATIVACAO_CONTRATO_JARVIS_BRAIN.md`** (NOVO):
   - Relatório curto de ativação do contrato.

**Arquivos atualizados:**

3. **`schema/contracts/INDEX.md`**:
   - Seção "Contrato ativo" atualizada para `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`.
   - "Próxima PR autorizada" → PR32.

4. **`schema/status/ENAVIA_STATUS_ATUAL.md`**:
   - Novo contrato ativo registrado.
   - Próxima PR: PR32.

5. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo):
   - Handoff atualizado de PR31 para PR32.

6. **`schema/execution/ENAVIA_EXECUTION_LOG.md`**:
   - Bloco PR31 adicionado no topo.

**Arquivos NÃO alterados:**
- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`
- Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Nenhum teste criado ou modificado.
- Nenhum secret, binding ou KV alterado.

## Contrato ativo

`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` — **Ativo 🟢**

## Próxima ação autorizada

**PR32 — PR-DIAG — Diagnóstico do chat atual, memória atual, prompts, modos e causa da resposta engessada**

### O que a PR32 deve investigar

- Prompts do chat: system prompt, prompt de segurança, prompt de memória, prompt de planner
- Parâmetros `read_only`, `target`, `env`, `mode` e como afetam a resposta
- Origem da resposta: qual função gera o texto final ao usuário
- Memória aplicada: o que é injetado no contexto da conversa
- Skills não usadas: por que as 4 skills documentais não são consultadas no chat
- Fallback genérico: de onde vem a resposta padrão
- Response formatter: como o texto é formatado antes de retornar
- System prompt: conteúdo atual e limitações
- Separação entre conversar / diagnosticar / planejar / executar

### Entrega esperada da PR32

`schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`

## Bloqueios

- nenhum


## O que foi feito nesta sessão

### PR30 — PR-DOCS/PR-PROVA — Fechamento formal do contrato PR17–PR30

**Tipo:** `PR-DOCS/PR-PROVA`
**Branch:** `copilot/claude-pr30-fechamento-contrato-loop-skills-system`

**Arquivos criados:**

1. **`schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md`** (NOVO):
   - Relatório final completo do contrato PR17–PR30.
   - 11 seções: objetivo, resultado executivo, tabela de PRs, loop consolidado, mapas, skills, o que está consolidado, o que é documental (não runtime), riscos restantes, recomendações para próximo contrato, handoff final.
   - Explicita que skills são documentais, sem executor automático, sem `/skills/run`, sem UI.

2. **`schema/handoffs/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_FINAL_HANDOFF.md`** (NOVO):
   - Handoff final de fechamento do contrato.
   - Seções: contrato encerrado, resumo das três frentes, o que NÃO foi alterado, skills são documentais, relatório final, próximos contratos possíveis, estado final do sistema, próxima ação esperada do operador humano.

**Arquivos atualizados:**

3. **`schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`**:
   - Banner de encerramento adicionado no topo (status, data, PRs concluídas, relatório final, handoff final, próxima etapa).
   - Seção 17 adicionada ao final: checklist completo de encerramento + resultado final + próxima etapa.
   - Histórico preservado integralmente.

4. **`schema/contracts/INDEX.md`**:
   - Seção "Contrato ativo" atualizada para "Nenhum contrato ativo".
   - Seção "Contratos encerrados" inclui `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` com data 2026-04-30.
   - "Próxima PR autorizada" indica: nenhuma — aguardar operador humano.

5. **`schema/status/ENAVIA_STATUS_ATUAL.md`**:
   - Registra contrato encerrado.
   - Lista entregas do contrato por frente.
   - Explicita que skills são documentais.
   - Estado atual: aguardando próximo contrato.

6. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo):
   - Handoff final transformado.

7. **`schema/execution/ENAVIA_EXECUTION_LOG.md`**:
   - Bloco PR30 adicionado no topo.

**Arquivos NÃO alterados:**
- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`
- Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- Nenhum teste criado ou modificado.
- Nenhum secret, binding ou KV alterado.

## Critérios de aceite — atendidos

| Critério | Status |
|----------|--------|
| Relatório final criado | ✅ |
| Contrato marcado como encerrado | ✅ |
| Governança final atualizada | ✅ |
| Handoff final criado | ✅ |
| Nenhum runtime alterado | ✅ |
| Nenhum endpoint criado | ✅ |
| Nenhum teste runtime criado | ✅ |
| Nenhum contrato novo iniciado | ✅ |
| Próximo passo depende de decisão humana | ✅ |
| Skills documentais explicitadas como documentais | ✅ |
| PR30 fecha formalmente o contrato PR17–PR30 | ✅ |

## Contrato encerrado

`schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — **Encerrado ✅**

## Próxima ação autorizada

**Nenhuma dentro do contrato encerrado.**

A próxima ação deve ser:
1. Operador humano revisa este handoff e o relatório final.
2. Operador humano define o próximo contrato (ou valida sugestões em Seção 10 do relatório).
3. Novo contrato criado em `schema/contracts/active/` com escopo e PRs definidas.
4. Agente retoma ciclo a partir do CLAUDE.md com novo contrato ativo.

Próximos contratos possíveis (sugestões — não aprovar sem decisão humana):
- Contrato de Runtime de Skills
- Contrato de Auditoria automática de PR
- Contrato de Infra Health / Bindings Validator
- Contrato de UI de Skills no painel
- Contrato de integração Enavia como mini-orquestradora

## Bloqueios

- nenhum

