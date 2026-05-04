# DIAGNÓSTICO COMPLETO — nv-enavia

**Data:** 2026-05-04  
**Branch:** `codex/pr102-github-bridge-real-diagnostico`  
**Tipo:** PR-DIAG — read-only, sem alteração de runtime  
**Contrato ativo:** `CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md`

---

## 1. ESTRUTURA REAL DO REPO

### Arquivos de runtime (os que executam de verdade)

| Arquivo | Linhas | O que faz |
|---------|--------|-----------|
| `nv-enavia.js` | 9.663 | Worker Cloudflare principal — roteador HTTP, orquestrador de chat/planner/contratos/skills/memória |
| `contract-executor.js` | 5.223 | Máquina de estado de contratos — KV, fases, tasks, gates, braço GitHub (lógico), braço Browser |
| `executor/src/index.js` | 7.827 | Worker Cloudflare subordinado — audit, propose, patch, deploy real via Cloudflare API |
| `wrangler.toml` | ~60 | Bindings, KV namespaces, service bindings (EXECUTOR, DEPLOY_WORKER), variáveis de ambiente |
| `.github/workflows/deploy.yml` | ~80 | Deploy manual (workflow_dispatch) com gate obrigatório para PROD |
| `.github/workflows/deploy-executor.yml` | ~80 | Deploy do executor com resolução dinâmica de KV namespaces |

### Camada de schema (módulos puros — sem I/O direto)

27 arquivos `schema/enavia-*.js`. Todos determinísticos, sem fetch/KV/filesystem próprios.

**Plugados no runtime (importados direta ou indiretamente por `nv-enavia.js`):**
- `enavia-cognitive-runtime.js` — monta o system prompt do chat
- `enavia-brain-loader.js` — injeção de contexto do brain (snapshot estático, via cognitive-runtime)
- `enavia-llm-core.js` — bloco de identidade/capacidades do prompt (via cognitive-runtime)
- `enavia-response-policy.js` — policy de resposta conversacional/operacional (via cognitive-runtime + nv-enavia.js)
- `enavia-intent-classifier.js` — classifica intenção da mensagem do usuário
- `enavia-skill-router.js` — roteia para skill documental quando detectada
- `enavia-intent-retrieval.js` — contexto de retrieval por intenção no prompt
- `enavia-self-audit.js` — auditoria de segurança/comportamento (campo aditivo no response)
- `enavia-skill-executor.js` — gera proposta de execução de skill
- `enavia-chat-skill-surface.js` — metadado de skill no response do chat
- `enavia-skill-approval-gate.js` — registro/aprovação/rejeição de proposals de skill
- `enavia-skill-factory.js` — spec e criação de nova skill
- `enavia-skill-runner.js` — executa skill registrada (via `/skills/run`)
- `enavia-identity.js`, `enavia-capabilities.js`, `enavia-constitution.js` — blocos do prompt (via cognitive-runtime)
- Planner helpers: `planner-classifier.js`, `planner-canonical-plan.js`, `planner-approval-gate.js`, `planner-executor-bridge.js`, `planner-output-modes.js`
- Memory helpers: `memory-storage.js`, `memory-read.js`, `memory-schema.js`, `memory-retrieval.js`, `memory-consolidation.js`, `memory-audit-log.js`, `learning-candidates.js`

**Existem como módulos mas NÃO estão importados pelo runtime:**
- `enavia-safety-guard.js` — Safety Guard: helper puro de PR100, NÃO plugado
- `enavia-event-log.js` — Event Log: helper puro de PR99, NÃO plugado
- `enavia-health-snapshot.js` — Health Snapshot: helper puro de PR99, NÃO plugado
- `enavia-anti-loop.js` — Anti-loop: helper puro de PR100, NÃO plugado
- `enavia-pr-planner.js` — PR Planner de PR91, NÃO plugado
- `enavia-pr-executor-supervised.js` — PR Executor supervisionado de PR92, NÃO plugado
- `enavia-pr-readiness.js` — PR Readiness de PR93, NÃO plugado
- `enavia-deploy-loop.js` — Deploy loop state machine de PR83, NÃO plugado
- `enavia-self-worker-auditor-skill.js` — SELF_WORKER_AUDITOR de PR82, possivelmente chamado via skill runner

### Painel (React/Vite)

`panel/src/` — UI operacional. Subpastas: `api/`, `chat/`, `contract/`, `execution/`, `health/`, `memory/`, `plan/`, `store/`. Conecta ao worker via `VITE_NV_ENAVIA_URL`.

### Testes

113 arquivos em `tests/`. Categorias: `.smoke.test.js` (validação lógica/pura), `.integration.test.js` (fluxos E2E mockados), `.prova.test.js` (provas formais de segurança/comportamento). Nenhum faz chamada de rede real — todos usam mocks.

---

## 2. CAPACIDADES REAIS (o que está de fato plugado em runtime)

### O que o Worker executa hoje (com evidência)

**Chat (`POST /chat/run`):**
- Recebe mensagem, faz classificação de intenção (PM4 determinístico)
- Chama `buildChatSystemPrompt` → monta prompt com identidade, capacidades, brain context (snapshot estático), response policy, self_audit, intent_retrieval
- Faz `fetch("https://api.openai.com/v1/chat/completions")` com `OPENAI_API_KEY` — chamada de rede REAL
- Retorna reply com campos aditivos: `intent_classification`, `skill_routing`, `intent_retrieval`, `self_audit`, `response_policy`, `chat_skill_surface`
- **Não executa skills automaticamente** — propõe, aguarda aprovação humana

**Contratos (`/contracts/*`):**
- Loop supervisionado: `loop-status → execute-next → complete-task → advance-phase`
- Delega audit/propose ao `env.EXECUTOR.fetch()` (Service binding real)
- Delega deploy ao `env.DEPLOY_WORKER.fetch()` via `/apply-test` (apenas TEST)
- Estado persistido em `ENAVIA_BRAIN` KV (`contract:{id}:state`, `contract:{id}:decomposition`)
- Deploy PROD bloqueado — exige `confirm_prod=true` + `confirm_reason` explícito

**GitHub/PR (`/github-pr/*`):**
- Rotas existem: `POST /github-pr/action`, `POST /github-pr/request-merge`, `POST /github-pr/approve-merge`
- O handler `executeGitHubPrAction` valida e retorna `{ok: true, execution_status: "executed", action: "..."}`
- **Mas não executa nada de verdade no GitHub** — apenas enforcement lógico + retorno estruturado
- Não há chamada para `api.github.com`, `octokit`, ou uso de `GITHUB_TOKEN` em nenhum arquivo JS de runtime

**Skills (`/skills/*`):**
- `POST /skills/propose` — registra proposta com `proposal_id`, retorna `proposed`/`not_applicable`/`blocked`
- `POST /skills/approve` / `/skills/reject` — gate de aprovação (in-memory, não persistido em KV)
- `POST /skills/run` — executa skill registrada (`SELF_WORKER_AUDITOR`, `SYSTEM_MAPPER`, etc.)
- `POST /skills/factory/create` — cria nova skill via spec validada
- Skills são documentais/read-only: sem fetch, sem KV write autônomo, sem LLM externo próprio

**Memória (`/memory/*`):**
- Leitura e escrita real em `ENAVIA_BRAIN` KV
- `writeMemory`, `readMemoryById`, `updateMemory`, `blockMemory` — todos com persistência real
- `searchRelevantMemory` — busca contextual por embedding ou keyword no KV
- `listLearningCandidates`, `approveLearningCandidate` — pipeline de aprendizado com aprovação humana

**Executor (`executor/src/index.js`):**
- `/worker-patch-safe` — patcher com validação de sintaxe JS
- `/worker-deploy` — deploy real via `api.cloudflare.com` com `CF_ACCOUNT_ID` e `CF_API_TOKEN`
- `/module-save`, `/module-patch` — escrita real em KV de módulos
- `/audit`, `/propose` — análise e proposta de patch (sem I/O de rede externo aqui)

### O que está só como helper/lógica sem estar plugado

| Módulo | Estado | Impacto real de não estar plugado |
|--------|--------|----------------------------------|
| `enavia-safety-guard.js` | Módulo puro, não importado | Operações de risco não passam por Safety Guard em runtime |
| `enavia-event-log.js` | Módulo puro, não importado | Não há event log unificado estruturado sendo gerado |
| `enavia-health-snapshot.js` | Módulo puro, não importado | Health consolidado só disponível offline |
| `enavia-anti-loop.js` | Módulo puro, não importado | Loops destrutivos não são detectados automaticamente |
| `enavia-pr-planner.js` | Módulo puro, não importado | PR planning não acontece automaticamente via worker |
| `enavia-pr-executor-supervised.js` | Módulo puro, não importado | Execução supervisionada de PR não está no loop do worker |
| `enavia-pr-readiness.js` | Módulo puro, não importado | Readiness check de PR não está ativo |
| `enavia-deploy-loop.js` | Módulo puro, não importado | State machine de deploy não está integrada ao fluxo real |

### O que está documentado mas não existe no código

- `schema/enavia-github-bridge.js` — referenciado no contrato PR102–PR105 como entregável da PR103, **arquivo não existe ainda**
- Adapter `api.github.com` autenticado — não existe em nenhum arquivo JS do repo
- Token GitHub em runtime (`GITHUB_TOKEN`, `GITHUB_APP_PRIVATE_KEY`) — não declarado em `wrangler.toml`, não usado no código

---

## 3. GITHUB BRIDGE — ESTADO REAL

### O que existe em `schema/enavia-github-bridge.js`

**Não existe.** O arquivo não foi criado. É o entregável da PR103 (próxima autorizada).

### O que existe em `schema/github-pr-arm-contract.js`

Contrato P24 — enforcement lógico. Exporta:
- `classifyGitHubPrAction(action)` — classifica se ação é pré-merge/requer-aprovação/proibida
- `evaluateMergeReadiness(context)` — avalia se PR está pronta para merge
- `buildMergeGateState({merge_readiness, approval_status})` — constrói estado do gate
- `enforceGitHubPrArm({action, context, merge_context})` — enforcement principal

**Não faz chamada de rede.** É determinístico. Valida regras, não executa ações.

### O que está plugado em `contract-executor.js`

- `executeGitHubPrAction({action, scope_approved, gates_context})` — valida via P24, valida via Security Supervisor, retorna `{ok: true, execution_status: "executed", action: "open_branch"}` — **mas não abre branch de verdade**. O campo `execution_status: "executed"` é enganoso: significa "gate passou", não "ação GitHub executada"
- `handleGitHubPrAction(request)` — handler HTTP da rota
- `requestMergeApproval()` e `approveMerge()` — gate formal para merge (também só lógico)

### O que falta para executar uma ação GitHub real

Para `open_branch` real:
1. Token GitHub autenticado em runtime (`GITHUB_TOKEN` ou GitHub App com `private_key`, `app_id`, `installation_id`)
2. Declaração do token em `wrangler.toml` como secret
3. Função `plan_create_branch(params)` que gere o payload para a API
4. Chamada real: `fetch("https://api.github.com/repos/{owner}/{repo}/git/refs", {headers: {Authorization: "Bearer {token}"}, method: "POST", body: ...})`
5. Tratamento de erro e retry
6. Integração com Safety Guard + Event Log antes/depois da chamada

Para `open_pr` real:
- Mesmos requisitos de token
- `fetch("https://api.github.com/repos/{owner}/{repo}/pulls", {method: "POST", ...})`

Para `comment_pr` real:
- `fetch("https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments", ...)`

Para `commit` / `patch em arquivo real`:
- Chamada sequencial: get ref → get tree → create blob → create tree → create commit → update ref
- Ou via executor existente: o `executor/src/index.js` já faz self-patching via Cloudflare API — mas o equivalente para GitHub não existe

**Resumo do gap:** existe toda a camada de enforcement/gate P24, mas o "adapter" que transforma `action = "open_branch"` em uma chamada HTTP autenticada para `api.github.com` simplesmente não existe.

---

## 4. GAP PARA AUTOEVOLUÇÃO

### O que falta para criar branch real, abrir PR real, fazer commit real, aplicar patch em arquivo real

1. **Token GitHub autenticado** — nenhum secret de GitHub está declarado no `wrangler.toml` ou usado nos handlers
2. **`schema/enavia-github-bridge.js`** — o arquivo que vai implementar os planners de operações GitHub (PR103)
3. **Adapter HTTP** — funções que fazem `fetch("https://api.github.com/...")` com header `Authorization`
4. **Plugação no runtime** — integrar o bridge ao fluxo supervisionado (PR104)
5. **Commit real = sequência de chamadas GitHub API** (get ref → create blob → create tree → create commit → update ref)

### O que falta para a Enavia auditar e corrigir o próprio código

Hoje a Enavia já pode:
- Auditar o código via `SELF_WORKER_AUDITOR` (skill read-only, disponível via `/skills/run`)
- Gerar diagnóstico de 10 categorias com achados e ações prioritárias
- Propor patches via `executor/src/index.js` (`/propose`, `/worker-patch-safe`)
- Fazer deploy real do worker para TEST via `executor/src/index.js` `/worker-deploy`

**O que falta para fechar o ciclo:**
- O Worker não chama o Executor autonomamente para aplicar patches no próprio código (teria que chamar `env.EXECUTOR.fetch("/worker-deploy", {...})` com o novo código)
- Não há endpoint no Worker que receba um patch proposto e acione o deploy automaticamente
- O loop `auditar → propor → aplicar → verificar` existe no papel mas não está costurado end-to-end no runtime
- Safety Guard e Event Log não estão plugados no caminho desse loop

### O que falta para criar novos sistemas por conta própria

- Skill Factory existe (`/skills/factory/create`) e pode criar nova skill validada
- Mas criação de skill gera um artefato `{spec, code, name}` — não há mecanismo automático para persistir esse código como arquivo real no repositório
- Não há commit autônomo: uma nova skill criada via factory não vira arquivo `.js` no repo sem intervenção humana (PR manual)
- GitHub Bridge (PR103/PR104) é o pré-requisito: sem ele, nenhuma escrita autônoma no repositório é possível

---

## 5. RISCOS E BLOQUEIOS

### O que pode quebrar

| Risco | Severidade | Detalhe |
|-------|-----------|---------|
| `OPENAI_API_KEY` expirar/rate limit | Alto | Chat (/chat/run) para de funcionar imediatamente — sem fallback real |
| `ENAVIA_BRAIN` KV corrompido | Alto | Contratos, memória e estado de execução perdem consistência |
| Service binding `EXECUTOR` ou `DEPLOY_WORKER` indisponível | Alto | Execute-next bloqueia com `EXECUTOR_UNAVAILABLE` — loop de contrato trava |
| Token GitHub mal configurado em PR104 | Alto | Se plugado sem Safety Guard, pode vazar ou fazer merge não supervisionado |
| `executor/src/index.js` /worker-deploy com código inválido | Médio | Pode overwrite o worker com código quebrado — rollback por versão KV existe mas manual |

### O que está frágil

1. **Approval gate de skills em memória** (`enavia-skill-approval-gate.js`) — proposals não persistem em KV. Se o worker reiniciar (o que acontece em Cloudflare Workers), proposals em memória são perdidas. Uma skill aprovada entre requests pode perder o estado entre o `/approve` e o `/run`.

2. **`execution_status: "executed"` em `/github-pr/action`** — retorna `executed` para `open_branch`, `open_pr`, `comment_pr` sem fazer nada de verdade no GitHub. Se um agente futuro consumir esse campo como "ação confirmada", vai agir sobre uma falsa confirmação.

3. **Safety Guard, Event Log e Anti-loop não plugados** — os guardrails das PRs 99/100 existem como código validado, mas nenhuma operação real passa por eles. O runtime opera sem essas proteções ativas.

4. **Brain Loader com snapshot estático** — `getEnaviaBrainContext()` carrega de uma allowlist hard-coded de 7 arquivos do brain. Se o brain evoluir, o Brain Loader não atualiza automaticamente — precisa de PR cirúrgica para ampliar a allowlist.

5. **KV compartilhado entre TEST e PROD** — `ENAVIA_BRAIN` usa o mesmo namespace em alguns cenários. Uma escrita de teste pode contaminar dados de produção.

6. **`OPENAI_MODEL = "gpt-5.2"` no wrangler.toml** — declarado como variável, mas o fallback no código é `gpt-4.1-mini`. Se `gpt-5.2` não existir ou não tiver quota, o chat falha silenciosamente antes de cair no fallback (depende da lógica de erro da OpenAI).

### O que precisa de atenção antes de avançar

1. **PR103/PR104 (GitHub Bridge real):** antes de plugar qualquer token GitHub no runtime, Safety Guard (`enavia-safety-guard.js`) e Event Log (`enavia-event-log.js`) precisam ser importados e chamados em toda operação GitHub. Hoje não são.

2. **Corrigir o campo `execution_status: "executed"`** no retorno de `/github-pr/action` para algo que não engane: `enforcement_status: "passed"` seria mais honesto do que `execution_status: "executed"`.

3. **Persistência de proposals de skill** em KV (hoje in-memory).

---

## 6. PRÓXIMO PASSO REAL

### Menor ação concreta para executar uma ação GitHub real supervisionada

O caminho mínimo para que `plan_create_branch` vire uma branch real no GitHub:

**Passo 1 — PR103 (já autorizada pelo contrato):**
- Criar `schema/enavia-github-bridge.js` como helper puro com:
  - `plan_create_branch(params)` — gera payload de criação de branch
  - `plan_open_pr(params)` — gera payload de abertura de PR
  - `plan_comment_pr(params)` — gera payload de comentário
  - `validate_github_operation(op, context)` — deny-by-default com bloqueio de merge/prod/secrets
  - `build_github_operation_event(op, result)` — estrutura de evento para integrar Event Log
- Sem chamar `api.github.com` ainda — apenas helpers puros que produzem payloads validados
- Provar que `validate_github_operation` bloqueia merge automático e operações sem aprovação

**Passo 2 — PR104 (após PR103 provada):**
- Plugar `enavia-safety-guard.js` e `enavia-event-log.js` no runtime (importar em nv-enavia.js)
- Criar um endpoint controlado (ex: `POST /github-bridge/execute`) que:
  1. Recebe operação proposta
  2. Valida via `validate_github_operation`
  3. Passa por Safety Guard (`evaluateSafetyGuard`)
  4. Registra evento de tentativa no Event Log
  5. Executa chamada HTTP real para `api.github.com` com token configurado como secret
  6. Registra resultado no Event Log
  7. Retorna estado com evidência
- Sem merge automático, sem deploy PROD automático — gate humano explícito em toda operação de escrita

**Evidência de readiness:**
- `enavia-safety-guard.js` — 70/70 cenários provados (PR100)
- `enavia-event-log.js` — 88/88 cenários provados (PR99)
- P24 enforcement — provado em `tests/github-pr-arm-contract.smoke.test.js`
- Falta apenas: (1) o adapter HTTP + token, (2) a plugação dos guardrails no caminho real

---

## Resumo executivo

| Dimensão | Estado real |
|----------|-------------|
| Worker em produção | Sim — Cloudflare Worker rodando |
| Chat com LLM real | Sim — OpenAI API via `OPENAI_API_KEY` |
| Contratos e deploy TEST | Sim — loop funcional com gate humano |
| Deploy PROD | Manual, com gate explícito — funciona |
| GitHub Actions reais | Não — enforcement lógico existe, adapter HTTP não existe |
| Safety Guard em runtime | Não — módulo provado, não importado |
| Event Log em runtime | Não — módulo provado, não importado |
| Autoevolução (patch + deploy próprio) | Parcial — executor pode fazer deploy, mas ciclo autônomo não está costurado |
| Criar sistemas novos autonomamente | Não — Skill Factory existe, mas commit/PR no repo requer GitHub Bridge (PR103/104) |
| GitHub Bridge (`enavia-github-bridge.js`) | Não existe — é o entregável da PR103 |
