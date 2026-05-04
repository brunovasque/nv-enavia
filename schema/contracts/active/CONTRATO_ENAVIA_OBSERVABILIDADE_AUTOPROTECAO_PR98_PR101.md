# CONTRATO ENAVIA — OBSERVABILIDADE + AUTOPROTEÇÃO PR98–PR101

**Data de criação:** 2026-05-04  
**Estado:** 🔴 Encerrado ✅ em 2026-05-04  
**PR98:** ✅ Concluída (2026-05-04)  
**PR99:** ✅ Concluída (2026-05-04)  
**PR100:** ✅ Concluída (2026-05-04)  
**PR101:** ✅ Concluída (2026-05-04) — Prova Final — 90/90 cenários  
**Contrato anterior encerrado:** `CONTRATO_ENAVIA_CHAT_LIVRE_COCKPIT_OPERACIONAL_PR94_PR97.md` — Encerrado ✅ em 2026-05-04

---

## Objetivo macro

Dar visão e freios para a Enavia antes de ampliar autonomia real, permitindo que ela monitore estado, erros, riscos, evidências e rollback hints sem se autodestruir.

A Enavia só pode evoluir com autonomia se tiver observabilidade, rollback hints, safety guards e trilha de auditoria.

---

## Contexto

A Enavia já possui:
- Skill Factory / Skill Runner (PR79–PR81)
- Self Worker Auditor (PR82)
- PR Orchestrator lógico (PR90–PR93)
- Deploy loop interno até finalize (PR86–PR89)
- Chat Livre + Cockpit Operacional (PR94–PR97)

Antes de dar GitHub Bridge real e braços externos, precisamos garantir visão e freios.

---

## Regra central

A Enavia só pode evoluir com autonomia se tiver:
1. Observabilidade (logs estruturados, health snapshot, event log)
2. Rollback hints explícitos por operação
3. Safety guards contra loops destrutivos e operações fora de escopo
4. Trilha de auditoria consolidada

---

## Divisão de PRs

### PR98 — Diagnóstico READ-ONLY de Observabilidade + Autoproteção

**Tipo:** PR-DIAG  
**Escopo:** Docs-only + Tests (sem runtime)

**Objetivo:**  
Mapear o que já existe para logs, health, status, execution, evidências, rollback, safety guards e detecção de risco.

**Entregáveis:**
- `schema/contracts/active/CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md` (este arquivo)
- `schema/contracts/ACTIVE_CONTRACT.md` (atualizado)
- `schema/contracts/INDEX.md` (atualizado)
- `schema/reports/PR98_OBSERVABILIDADE_AUTOPROTECAO_DIAGNOSTICO.md`
- `tests/pr98-observabilidade-autoprotecao-diagnostico.prova.test.js`
- Governança mínima (status, handoff, execution log)

**Proibido:**
- Alterar nv-enavia.js
- Alterar executor/src/index.js
- Alterar contract-executor.js
- Alterar deploy.yml ou wrangler.toml
- Criar endpoint novo
- Fazer deploy
- Tocar secrets
- Implementar observabilidade ou safety guard ainda

---

### PR99 — Event Log + Health Snapshot Unificado

**Tipo:** PR-IMPL  
**Escopo:** schema/helper puro (sem runtime vivo, sem endpoint)

**Objetivo:**  
Criar modelo/helper puro para consolidar eventos, estado de saúde e snapshot operacional, sem depender de rede real.

**Dependência:** PR98 ✅

**Escopo máximo (5 mudanças):**
1. `schema/enavia-event-log.js` — helper puro: appendEvent, getEvents, buildEventLogSnapshot
2. `schema/enavia-health-snapshot.js` — helper puro: buildHealthSnapshot(env, opts) consolidando todos os subsistemas
3. `tests/pr99-event-log-health-snapshot.prova.test.js` — prova formal
4. `schema/reports/PR99_EVENT_LOG_HEALTH_SNAPSHOT.md` — relatório
5. Governança mínima (status, handoff, execution log, INDEX)

**Restrições:**
- Modo: schema/helper puro (Opção A do diagnóstico)
- Sem binding novo
- Sem endpoint novo
- Sem alteração em nv-enavia.js, executor, contract-executor
- Sem painel

---

### PR100 — Safety Guard / Anti-autodestruição

**Tipo:** PR-IMPL  
**Escopo:** schema/helper puro (sem runtime vivo, sem endpoint)

**Objetivo:**  
Criar guardas para bloquear operações perigosas, loops destrutivos, alterações fora de escopo e ações sem rollback.

**Dependência:** PR99 ✅ (Event Log + Health Snapshot disponível)

**Escopo máximo (5 mudanças):**
1. `schema/enavia-safety-guard.js` — helper puro: evaluateSafetyGuard(action, context), isSafeToExecute, buildSafetyReport
2. `schema/enavia-anti-loop.js` — helper puro: detectDestructiveLoop, getLoopSafetyStatus
3. `tests/pr100-safety-guard-antiautodestruction.prova.test.js` — prova formal
4. `schema/reports/PR100_SAFETY_GUARD_ANTI_AUTODESTRUICAO.md` — relatório
5. Governança mínima (status, handoff, execution log, INDEX)

**Restrições:**
- Sem binding novo
- Sem endpoint novo
- Sem alteração em nv-enavia.js, executor, contract-executor
- Safety guard não deve bloquear operações existentes que já funcionam
- Deve ser aditivo, não substitutivo

---

### PR101 — Prova Final

**Tipo:** PR-PROVA  
**Escopo:** Tests + Docs/governança (sem runtime)

**Objetivo:**  
Provar observabilidade + autoproteção + rollback hints + gates funcionando sem quebrar PR Orchestrator, deploy loop, Skill Factory e Chat Livre.

**Dependência:** PR100 ✅

**Entregáveis:**
- `tests/pr101-observabilidade-autoprotecao-final.prova.test.js` (40+ cenários)
- `schema/reports/PR101_OBSERVABILIDADE_AUTOPROTECAO_FINAL.md`
- Encerramento do contrato PR98–PR101
- Governança mínima (status, handoff, execution log, INDEX)

---

## Preservação obrigatória

As seguintes frentes **NÃO devem ser refatoradas** por nenhuma PR deste contrato:

- PR Orchestrator PR90–PR93: `enavia-pr-planner.js`, `enavia-pr-executor-supervised.js`, `enavia-pr-readiness.js`
- Chat Livre + Cockpit PR94–PR97: `enavia-response-policy.js`, `enavia-llm-core.js`, `enavia-cognitive-runtime.js`, painel
- Deploy loop PR86–PR89: `enavia-deploy-loop.js`
- Skill Factory/Runner: `enavia-skill-factory.js`, `enavia-skill-runner.js`, `enavia-skill-executor.js`
- SELF_WORKER_AUDITOR: `enavia-self-worker-auditor-skill.js`
- Security Supervisor: `security-supervisor.js`
- Autonomy Contract: `autonomy-contract.js`
- Gates humanos: `planner-approval-gate.js`, `enavia-skill-approval-gate.js`
- Bloqueios de PROD/merge/secrets: deploy.yml, wrangler.toml

---

## Critérios de encerramento

O contrato PR98–PR101 está encerrado quando:

1. PR98 (PR-DIAG) concluída: diagnóstico completo de observabilidade e autoproteção
2. PR99 (PR-IMPL) concluída: Event Log + Health Snapshot helper puro funcionando
3. PR100 (PR-IMPL) concluída: Safety Guard / Anti-autodestruição helper puro funcionando
4. PR101 (PR-PROVA) concluída: 40+ cenários provando tudo sem quebrar nada existente
5. Nenhuma PR anterior (PR89, PR93, PR97) quebrada
6. GitHub Bridge e braços externos prontos para ser adicionados com segurança

---

## Estado atual

| PR | Tipo | Estado |
|----|------|--------|
| PR98 | PR-DIAG | ✅ Concluída |
| PR99 | PR-IMPL | ✅ Concluída |
| PR100 | PR-IMPL | ✅ Concluída |
| PR101 | PR-PROVA | ✅ Concluída — 90/90 cenários |

---

_Contrato criado em 2026-05-04 | Encerrado em 2026-05-04 após PR101 — Prova Final_
