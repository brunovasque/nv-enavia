# PR98 — Diagnóstico de Observabilidade + Autoproteção

**Data:** 2026-05-04  
**Branch:** `copilot/pr98-diagnostico-read-only`  
**Tipo:** PR-DIAG (READ-ONLY)  
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md`  
**PR anterior validada:** PR97 ✅ (Prova Final — Chat Livre + Cockpit)

---

## Objetivo

Mapear o que já existe na Enavia para:
- logs
- health checks
- status
- execution logs
- evidências
- erros
- rollback hints
- safety guards
- autoproteção
- detecção de operação perigosa
- limites para evitar autodestruição

---

## 1. O que já existe de observabilidade?

### 1.1 Logs

| Componente | O que existe | Classificação |
|-----------|-------------|---------------|
| `nv-enavia.js` | `logNV()` — wrapper de `console.log("[ENAVIA]", ...args)` — 172 chamadas | **código real** (não estruturado) |
| `executor/src/index.js` | `console.log()` direto — 15 chamadas | **código real** (não estruturado) |
| `contract-executor.js` | 1 chamada de `console.log` | **código real** (mínimo) |
| `schema/enavia-self-audit.js` | Campo `self_audit` aditivo no response — 10 categorias de risco auditadas por request | **código real** |
| `schema/memory-audit-log.js` | `listAuditEvents()` — eventos de auditoria de memória | **código real** |
| `schema/enavia-self-worker-auditor-skill.js` | Snapshot estático de achados (S1–S2, T1–T2, D1, C1, G1) | **código real** (diagnóstico estático) |

**Lacuna:** Logs não são estruturados (JSON). Não há campo `request_id`, `latency_ms`, `status_code`, `skill_id` por request. Não são consultáveis programaticamente.

### 1.2 Health Checks

| Componente | O que existe | Classificação |
|-----------|-------------|---------------|
| `nv-enavia.js` linha 7309 | `GET /health` — lê `exec_event` do KV e retorna estado: `healthy`, `degraded`, `unknown` | **código real** |
| `executor/src/index.js` linha 2765 | `GET /health` — handler próprio no executor | **código real** |
| `schema/operational-awareness.js` | `buildOperationalAwareness()` — snapshot: browser/executor/approval mode | **código real** |

**Lacuna:** Não há health snapshot unificado consolidando Worker + Executor + Chat + Skill Factory + PR Orchestrator. Cada componente tem seu próprio endpoint/estado isolado.

### 1.3 Status

| Componente | O que existe | Classificação |
|-----------|-------------|---------------|
| `executor/src/index.js` linha 2791 | `GET /status` — estado do executor | **código real** |
| `contract-executor.js` | `task_execution_log` — log de execução por task (KV-persisted) | **código real** |
| `nv-enavia.js` | `readExecEvent()` — lê estado canônico do contrato ativo | **código real** |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Documento de status operacional | **docs-only** |

**Lacuna:** Status distribuído em múltiplos endpoints, sem visão unificada.

### 1.4 Execution Logs

| Componente | O que existe | Classificação |
|-----------|-------------|---------------|
| `contract-executor.js` linha 2207+ | `task_execution_log` — appends cycles por task (audit-grade) | **código real** |
| `executor/src/index.js` linha 2276 | `GET /audit-log` — lista eventos de auditoria | **código real** |
| `nv-enavia.js` linha 2807 | `/audit-log` na allowlist de rotas internas | **código real** (referência) |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Log de execução por PR (governança) | **docs-only** |

**Lacuna:** Não há event log unificado consultável em tempo real que combine todos os componentes. O `task_execution_log` é por contrato/task, não por sessão ou operação de chat.

### 1.5 Evidências

| Componente | O que existe | Classificação |
|-----------|-------------|---------------|
| `executor/src/index.js` | `context_proof`, `snapshot_fingerprint`, `snapshot_chars`, `snapshot_lines` — evidência objetiva de audit/propose | **código real** |
| `schema/enavia-pr-planner.js` | Campo `evidence` no plano (validation_errors, reasoning) | **código real** (parcial) |
| `schema/enavia-pr-readiness.js` | Campo `evidence` no readiness (buildReadinessEvidence) | **código real** |
| `tests/pr*-*.test.js` | Smoke tests como prova de funcionamento | **código real** (testes) |

**Lacuna:** Evidência existe para operações do executor (audit/propose), mas não para operações de chat, skill execution ou PR orchestration.

---

## 2. O que já existe de autoproteção?

### 2.1 Guards e Bloqueios

| Componente | O que existe | Classificação |
|-----------|-------------|---------------|
| `contract-executor.js` linha 498+ | Cancellation guard (F1) — bloqueia mutações em contratos cancelados | **código real** |
| `contract-executor.js` linha 513+ | Plan-rejection guard (F2) — bloqueia avanço com plano rejeitado | **código real** |
| `schema/autonomy-contract.js` | `PROHIBITED_ACTIONS` (9 ações proibidas incondicionalmente) | **código real** |
| `schema/autonomy-contract.js` | `REQUIRED_GATES` (6 gates obrigatórios antes de ação sensível) | **código real** |
| `schema/autonomy-contract.js` | `FAILURE_POLICY` — max 3 retries, block_and_escalate após falha máxima | **código real** |
| `schema/security-supervisor.js` | `evaluateSensitiveAction()` — ALLOW/BLOCK/NEEDS_HUMAN_REVIEW | **código real** |
| `schema/enavia-constitution.js` | Guardrails runtime constitucionais | **código real** |
| `schema/enavia-self-audit.js` | `runEnaviaSelfAudit()` — 10 categorias de risco por request | **código real** |
| `schema/planner-approval-gate.js` | Gate de aprovação humana para planner | **código real** |
| `schema/enavia-skill-approval-gate.js` | Gate de aprovação para execução de skills | **código real** |

### 2.2 Proteção de PROD/Merge/Secrets

| Componente | O que existe | Classificação |
|-----------|-------------|---------------|
| `.github/workflows/deploy.yml` | `confirm_prod: false` obrigatório para PROD, validação de secrets obrigatória | **código real** |
| `schema/github-pr-arm-contract.js` | `evaluateMergeReadiness()` — gate de merge | **código real** |
| `schema/enavia-pr-readiness.js` | `prod_deploy_allowed=false`, `merge_allowed=false` sempre | **código real** |
| `schema/enavia-skill-factory.js` | `safety_notes` + `rollback_suggested` nos specs de skill | **código real** (parcial) |
| `nv-enavia.js` | `dangerous` terms detection — palavras que forçam planner independente do nível | **código real** |

### 2.3 Rate Limiting / Custo / Latência

| Componente | O que existe | Classificação |
|-----------|-------------|---------------|
| `nv-enavia.js` linha 4873 | Detecção de HTTP 429 (rate limit do OpenAI) + fallback model | **código real** (parcial) |
| `nv-enavia.js` | `telemetry` por request: stage, model, latência estimada | **código real** (não consolidado) |
| `schema/enavia-self-worker-auditor-skill.js` S1 | Finding de ausência de rate limiting explícito por IP/session | **docs/diagnóstico** |

**Lacuna crítica:** Não há rate limiting aplicacional. Não há controle de custo por sessão/request. Não há monitoramento de latência agregada.

---

## 3. Onde a Enavia ainda está cega?

### 3.1 Sem Health Snapshot Unificado
Cada componente tem estado isolado. Não há visão consolidada de:
- Worker vivo/degradado
- Executor vivo/degradado
- Skill Factory operacional
- PR Orchestrator operacional
- Chat runtime operacional
- KV ENAVIA_BRAIN acessível

### 3.2 Sem Event Log Unificado
Operações de chat, skill, planner, executor e deploy geram logs em lugares diferentes (console, KV, arquivo). Não há:
- Stream de eventos cronológico único
- Correlação por `session_id` ou `request_id`
- Busca retroativa

### 3.3 Sem Rollback Hints por Operação de Chat
O deploy loop tem `rollback_ready` e `rolled_back`. A skill factory tem `rollback_suggested`. Mas:
- Operações de chat não têm rollback hint
- PR Orchestrator não tem rollback automático
- Não há "como desfazer essa operação" para o chat

### 3.4 Sem Visão de Custo/Latência
- Não há contador de tokens por request/sessão
- Não há agregação de latência p50/p95
- Não há alerta de custo crescente
- `telemetry.stage` existe por request mas não é agregada

### 3.5 Sem Loop Guard / Anti-autodestruição
- Nenhum componente detecta se a Enavia está em loop (ex: retry infinito, PR que reabre, deploy que falha repetidamente)
- `FAILURE_POLICY` define max_retries=3 no contrato de autonomia, mas não há enforcement em runtime para chat
- Não há detecção de "ação que pode destruir estado acumulado"

### 3.6 Sem Trilha de Auditoria Consolidada
- `memory-audit-log.js` existe para memória
- `task_execution_log` existe para contratos
- Mas não há trilha única que combine chat + skill + PR + deploy em ordem cronológica

---

## 4. Arquivos vivos que comandam logs/status/audit

| Arquivo | Função |
|---------|--------|
| `nv-enavia.js` | Worker principal: logNV(), GET /health, telemetry por request, snapshotDebugState |
| `executor/src/index.js` | Executor: GET /health, GET /status, GET /audit-log, snapshot-read |
| `contract-executor.js` | task_execution_log, cancellation guard, plan-rejection guard |
| `schema/enavia-self-audit.js` | self_audit aditivo por request (10 categorias) |
| `schema/security-supervisor.js` | evaluateSensitiveAction: ALLOW/BLOCK/NEEDS_HUMAN_REVIEW |
| `schema/autonomy-contract.js` | PROHIBITED_ACTIONS, REQUIRED_GATES, FAILURE_POLICY |
| `schema/enavia-constitution.js` | Guardrails constitucionais runtime |
| `schema/operational-awareness.js` | buildOperationalAwareness: snapshot browser/executor/mode |
| `schema/memory-audit-log.js` | listAuditEvents: eventos de memória |
| `schema/enavia-deploy-loop.js` | Estado rollback_ready/rolled_back no deploy loop |
| `schema/enavia-pr-readiness.js` | evidence + prod_blocked + merge_blocked |
| `schema/enavia-self-worker-auditor-skill.js` | Snapshot estático de achados de segurança/telemetria |

---

## 5. Arquivos que são só documentais

| Arquivo | Tipo |
|---------|------|
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Status operacional por PR |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Handoff entre sessões |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Log de execução por PR |
| `schema/contracts/INDEX.md` | Índice de contratos |
| `schema/contracts/ACTIVE_CONTRACT.md` | Ponteiro de contrato ativo |
| `schema/contracts/active/*.md` | Contratos por fase |
| `schema/reports/PR*.md` | Relatórios por PR |
| `schema/brain/SYSTEM_AWARENESS.md` | Awareness do sistema |
| `schema/hardening/*.md` | Docs de hardening |
| `schema/skills-runtime/*.md` | Blueprint do runtime de skills |
| `schema/self-audit/*.md` | Framework de self-audit |
| `schema/playbooks/*.md` | Playbooks operacionais |

---

## 6. O que NÃO deve ser refatorado

| Frente | Arquivos | Motivo |
|--------|---------|--------|
| PR Orchestrator PR90–PR93 | `enavia-pr-planner.js`, `enavia-pr-executor-supervised.js`, `enavia-pr-readiness.js` | Funciona corretamente |
| Chat Livre + Cockpit PR94–PR97 | `enavia-response-policy.js`, `enavia-llm-core.js`, `enavia-cognitive-runtime.js`, `panel/**` | 60 cenários provados |
| Deploy loop PR86–PR89 | `enavia-deploy-loop.js` | Loop funcional comprovado |
| Skill Factory/Runner | `enavia-skill-factory.js`, `enavia-skill-runner.js`, `enavia-skill-executor.js` | Fase 1 encerrada |
| SELF_WORKER_AUDITOR | `enavia-self-worker-auditor-skill.js` | Diagnóstico estático correto |
| Security Supervisor | `security-supervisor.js` | Guards reais funcionando |
| Autonomy Contract | `autonomy-contract.js` | PROHIBITED_ACTIONS e GATES corretos |
| Gates humanos | `planner-approval-gate.js`, `enavia-skill-approval-gate.js` | Bloqueios de segurança corretos |
| PROD/Merge/Secrets | `deploy.yml`, `wrangler.toml` | Proteções de produção corretas |

---

## 7. Menor patch recomendado para PR99

**Modo: schema/helper puro (Opção A)**  
**Máximo 5 mudanças:**

1. **Criar** `schema/enavia-event-log.js`  
   Helper puro: `appendEvent(log, event)`, `getEvents(log, filter)`, `buildEventLogSnapshot(log)`.  
   Sem I/O, sem KV, sem fetch. Puramente funcional e testável.

2. **Criar** `schema/enavia-health-snapshot.js`  
   Helper puro: `buildHealthSnapshot(opts)` consolidando estado de todos os subsistemas.  
   Campos: worker, executor, chat_runtime, skill_factory, pr_orchestrator, deploy_loop.  
   Sem binding novo, sem endpoint novo.

3. **Criar** `tests/pr99-event-log-health-snapshot.prova.test.js`  
   Prova formal dos dois helpers.

4. **Criar** `schema/reports/PR99_EVENT_LOG_HEALTH_SNAPSHOT.md`  
   Relatório da PR99.

5. **Atualizar** governança mínima (status, handoff, execution log, INDEX)

**Decisão: Opção A — schema/helper puro**  
Motivo: Zero risco de quebrar runtime existente. Testável sem deploy. Base para PR100.

---

## 8. Menor patch recomendado para PR100

**Modo: schema/helper puro — Safety Guard / Anti-autodestruição**  
**Máximo 5 mudanças:**

1. **Criar** `schema/enavia-safety-guard.js`  
   Helper puro Safety Guard: `evaluateSafetyGuard(action, context)`, `isSafeToExecute(action)`, `buildSafetyReport(context)`.  
   Complementa (não substitui) `security-supervisor.js`.  
   Foco: loop detection, autodestruição, operação sem rollback hint.

2. **Criar** `schema/enavia-anti-loop.js`  
   Helper puro: `detectDestructiveLoop(history)`, `getLoopSafetyStatus(state)`.  
   Detecta padrões de retry excessivo e ações repetidas sem progresso.

3. **Criar** `tests/pr100-safety-guard-antiautodestruction.prova.test.js`  
   Prova formal dos dois helpers.

4. **Criar** `schema/reports/PR100_SAFETY_GUARD_ANTI_AUTODESTRUICAO.md`  
   Relatório da PR100.

5. **Atualizar** governança mínima (status, handoff, execution log, INDEX)

---

## 9. Riscos

| Risco | Nível | Descrição |
|-------|-------|-----------|
| Ausência de event log unificado | **Alto** | Impossível debugar problemas cross-componente em produção |
| Sem rate limiting aplicacional | **Alto** | Custo OpenAI pode crescer sem controle (S1 do SELF_WORKER_AUDITOR) |
| Sem loop guard em runtime | **Médio** | Loop de retry pode criar estado inconsistente |
| Logs não estruturados | **Médio** | Dificulta diagnóstico automatizado |
| Sem rollback hints para chat | **Médio** | Impossível reverter operação de chat errada |
| Health distribuído | **Baixo** | Complexidade de diagnóstico, mas cada endpoint funciona |
| Sem custo/latência agregado | **Baixo** | Visibilidade limitada, mas sem impacto imediato |

---

## 10. Conclusão

**Decisão para PR99:** Opção A — schema/helper puro

Motivo:
- Zero risco de quebrar runtime existente (nv-enavia.js, executor, contract-executor intocados)
- Testável sem deploy via `node tests/pr99-*.test.js`
- Base segura para PR100 construir em cima
- Consistente com padrão dos últimos contratos (PR90–PR97)
- Não requer binding novo nem endpoint novo

A Enavia precisa de visão antes de braços externos. Event Log + Health Snapshot como helpers puros entregam visão sem risco.

---

## Arquivos alterados nesta PR

| Arquivo | Tipo | Ação |
|---------|------|------|
| `schema/contracts/active/CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md` | Contrato | Criado |
| `schema/contracts/ACTIVE_CONTRACT.md` | Ponteiro | Atualizado |
| `schema/contracts/INDEX.md` | Índice | Atualizado |
| `schema/reports/PR98_OBSERVABILIDADE_AUTOPROTECAO_DIAGNOSTICO.md` | Relatório | Criado |
| `tests/pr98-observabilidade-autoprotecao-diagnostico.prova.test.js` | Teste | Criado |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Governança | Atualizado |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Governança | Atualizado |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Governança | Atualizado |

**Runtime não alterado:** nv-enavia.js, executor/src/index.js, contract-executor.js, deploy.yml, wrangler.toml, panel/**

---

## Próxima PR autorizada

**PR99 — Event Log + Health Snapshot Unificado**  
Tipo: PR-IMPL  
Modo: schema/helper puro (Opção A)  
Dependência: PR98 ✅
