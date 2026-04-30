# CONTRATO — ENAVIA LOOP SKILLS + SYSTEM MAP — PR17 a PR30

> **Status:** Encerrado ✅ — Data de encerramento: 2026-04-30
> **PRs concluídas:** PR0, PR17, PR18, PR19, PR20, PR21, PR22, PR23, PR24, PR25, PR26, PR27, PR28, PR29, PR30
> **Relatório final:** `schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md`
> **Handoff final:** `schema/handoffs/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_FINAL_HANDOFF.md`
> **Próxima etapa:** Aguardar novo contrato autorizado pelo operador humano.
>
> Este contrato está encerrado. Não deve ser editado — apenas lido como referência histórica.

---

## 0. Instrução obrigatória

Antes de qualquer ação, leia obrigatoriamente `CLAUDE.md` na raiz do repo e siga todas as regras dele, incluindo o **Loop obrigatório de execução por PR** (seção 4).

Se não conseguir acessar ou ler `CLAUDE.md`, pare e avise.

Depois leia integralmente este contrato e os arquivos:

- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`
- `schema/contracts/INDEX.md`

---

## 1. Contexto

### Contratos anteriores (histórico encerrado)

| Contrato | PRs | Estado |
|----------|-----|--------|
| `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` | PR1–PR7 | Encerrado ✅ |
| `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` | PR8–PR13 | Encerrado ✅ |

### PRs operacionais executadas após PR13 (fixes e hardening)

| PR | Descrição | Estado |
|----|-----------|--------|
| PR14 | Worker-only — Executor real + Deploy Worker no loop operacional | Concluída ✅ |
| PR15 | Worker-only — Fix target.workerId no _deployPayload | Concluída ✅ |
| PR16 | Worker-only — Fix startTask para task queued antes de delegar execução | Concluída ✅ |
| PR0  | Docs-only — Loop obrigatório de execução por PR em CLAUDE.md | Em andamento |

---

## 2. Objetivo macro

Com o loop operacional supervisionado estável (PR8–PR16), este contrato abre as seguintes frentes em ordem estrita de dependência:

1. **Loop contratual perfeito** — fechar o gap de `phase_complete`: o sistema deve saber avançar de fase supervisionadamente (`execute-next → complete-task → phase_complete → advance-phase → próxima fase/task`).
2. **System Map + Tool Registry** — documentar todos os componentes, rotas, workers, bindings, KV e secrets do sistema ENAVIA com visibilidade operacional.
3. **Loop de Skills** — somente após o loop contratual perfeito e o registry completo, formalizar skills supervisionadas (Contract Loop Operator, Deploy Governance Operator, System Mapper, Contract Auditor).
4. **Governança de loop formalizada** — garantir que o `CLAUDE.md` e o loop de execução estejam consolidados e sejam a lei do repo.

---

## 3. Regra de ouro

Não criar autonomia cega.

Toda execução deve passar por:

- diagnóstico (`PR-DIAG`);
- implementação supervisionada (`PR-IMPL`);
- prova (`PR-PROVA`);
- documentação (`PR-DOCS`).

Se faltar evidência ou diagnóstico, o sistema deve bloquear.

---

## 4. Ordem obrigatória das PRs

```
PR0  — PR-DOCS   — Loop obrigatório de execução por PR (CLAUDE.md + governança)
PR17 — PR-DIAG   — Diagnóstico READ-ONLY de phase_complete e avanço de fase
PR18 — PR-IMPL   — Worker-only — Endpoint supervisionado de avanço de fase
PR19 — PR-PROVA  — Smoke real: execute-next → complete-task → advance-phase → próxima task/fase
PR20 — PR-IMPL   — Worker-only — loop-status expõe ação correta quando task está in_progress
PR21 — PR-PROVA  — Smoke do loop-status com task in_progress e phase_complete
PR22 — PR-DOCS   — Criar schema/system/ENAVIA_SYSTEM_MAP.md
PR23 — PR-DOCS   — Criar schema/system/ENAVIA_ROUTE_REGISTRY.json
PR24 — PR-DOCS   — Criar schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md
PR25 — PR-DOCS   — Criar registry de workers, bindings, KV e secrets esperados
PR26 — PR-DOCS   — Criar skill: Contract Loop Operator
PR27 — PR-DOCS   — Criar skill: Deploy Governance Operator
PR28 — PR-DOCS   — Criar skill: System Mapper
PR29 — PR-DOCS   — Criar skill: Contract Auditor
PR30 — PR-DOCS/PR-PROVA — Fechamento, hardening e handoff final do contrato
```

Regras:
- Skills só entram depois do loop perfeito (PR17–PR21) e do System/Tool Registry (PR22–PR25).
- Não criar endpoint de skills antes de PR26.
- PR17 deve ser diagnóstico read-only.
- Não pule etapas.
- Não misture escopos na mesma PR.
- Confirme no loop obrigatório (CLAUDE.md seção 4) antes de cada PR.

---

## 5. PR0 — Docs-only — Loop obrigatório de execução por PR

### Objetivo

Formalizar o loop de execução como lei operacional do repo.

### Escopo permitido

- `CLAUDE.md` — adicionar seção "Loop obrigatório de execução por PR".
- `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — este arquivo.
- `schema/contracts/INDEX.md` — criar índice de contratos.
- `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizar.
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — atualizar.
- `schema/execution/ENAVIA_EXECUTION_LOG.md` — atualizar.

### Proibido

- Não alterar Worker, Panel, Executor, Deploy Worker.
- Não alterar workflows.
- Não alterar `wrangler.toml`.
- Não alterar arquivos JS/TS/JSX/TSX.
- Não mexer em runtime.

### Critérios de aceite

- `CLAUDE.md` contém a seção `## Loop obrigatório de execução por PR`.
- `CLAUDE.md` não fixa mais `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` como contrato ativo exclusivo.
- `CLAUDE.md` orienta o agente a identificar o contrato ativo mais recente em `schema/contracts/active/`.
- `schema/contracts/INDEX.md` criado.
- `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` criado.
- Governança atualizada (status, handoff, execution log).
- Nenhum arquivo de runtime alterado.

---

## 6. PR17 — PR-DIAG — Diagnóstico READ-ONLY de phase_complete e avanço de fase

### Objetivo

Diagnosticar o gap atual: o sistema chega em `phase_complete`, mas falta o mecanismo supervisionado de avanço de fase. Identificar o que existe e o que precisa ser criado.

### Escopo

- Worker-only — read-only. Nenhum arquivo de runtime alterado.
- Ler `nv-enavia.js` e `contract-executor.js` para mapear o fluxo atual de `phase_complete`.
- Identificar ausência ou presença de endpoint `POST /contracts/advance-phase` ou equivalente.
- Identificar ausência ou presença de endpoint `POST /contracts/complete-task`.
- Documentar o diagnóstico no execution log com evidências reais (trechos de código, endpoints existentes/ausentes).

### Critérios de aceite

- Diagnóstico documentado no execution log.
- Lista de endpoints existentes e ausentes para fechar o loop `phase_complete → advance-phase`.
- Governança atualizada.
- Nenhum arquivo de runtime alterado.

---

## 7. PR18 — PR-IMPL — Worker-only — Endpoint supervisionado de avanço de fase

### Objetivo

Criar endpoint supervisionado para avanço de fase, somente se o diagnóstico PR17 confirmar ausência.

### Pré-requisito obrigatório

- PR17 (`PR-DIAG`) concluída e diagnóstico documentando ausência do mecanismo.

### Escopo

- Alterar somente `nv-enavia.js` (e `contract-executor.js` se necessário).
- Criar `POST /contracts/advance-phase` (ou endpoint equivalente autorizado pelo diagnóstico).
- Reutilizar gates existentes (audit, evidence, deploy).
- Nunca avançar fase em produção automaticamente.

### Critérios de aceite

- Endpoint criado e documentado.
- Gates reutilizados.
- Smoke tests presentes (ou cobertos em PR19).

---

## 8. PR19 — PR-PROVA — Smoke real: execute-next → complete-task → advance-phase → próxima task/fase

### Objetivo

Validar que o ciclo completo funciona: `execute-next → complete-task → phase_complete → advance-phase → próxima task/fase`.

### Pré-requisito obrigatório

- PR18 (`PR-IMPL`) concluída.

### Escopo

- Criar `tests/pr19-advance-phase.smoke.test.js`.
- Cobrir o ciclo completo com contrato de smoke real.
- Não alterar runtime.

---

## 9. PR20 — PR-IMPL — Worker-only — loop-status expõe ação correta quando task está in_progress

### Objetivo

`GET /contracts/loop-status` deve retornar `POST /contracts/complete-task` como `availableActions` quando a task está em status `in_progress` — gap documentado como ausente no PR6 (ajuste Codex).

### Pré-requisito obrigatório

- PR19 (`PR-PROVA`) concluída.

### Escopo

- Alterar somente `nv-enavia.js`.
- `handleGetLoopStatus`: quando `status === "in_progress"`, `availableActions` deve incluir `POST /contracts/complete-task`.
- Nenhuma outra alteração.

---

## 10. PR21 — PR-PROVA — Smoke do loop-status com task in_progress e phase_complete

### Objetivo

Validar que `loop-status` retorna as ações corretas para os estados `in_progress` e `phase_complete`.

### Pré-requisito obrigatório

- PR20 (`PR-IMPL`) concluída.

### Escopo

- Criar `tests/pr21-loop-status-states.smoke.test.js`.
- Cobrir `in_progress → complete-task` e `phase_complete → advance-phase`.
- Não alterar runtime.

---

## 11. PR22–PR25 — PR-DOCS — System Map + Tool Registry

### PR22 — PR-DOCS — Criar schema/system/ENAVIA_SYSTEM_MAP.md

Mapear todos os componentes do sistema ENAVIA: workers, bindings, KV namespaces, rotas ativas, estados possíveis.

### PR23 — PR-DOCS — Criar schema/system/ENAVIA_ROUTE_REGISTRY.json

Registry JSON de todas as rotas do Worker com método, path, autenticação, escopo, status.

### PR24 — PR-DOCS — Criar schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md

Playbook operacional: como executar o loop, como diagnosticar, como fazer rollback, como avançar fase.

### PR25 — PR-DOCS — Registry de workers, bindings, KV e secrets esperados

Documentar todos os bindings obrigatórios, KV namespaces, secrets e workers esperados em produção e em test.

---

## 12. PR26–PR29 — PR-DOCS — Skills supervisionadas

Skills só entram após PR21 (loop contratual perfeito) e PR25 (System/Tool Registry completo).

- **PR26** — Criar skill `Contract Loop Operator` — opera o loop contratual supervisionado.
- **PR27** — Criar skill `Deploy Governance Operator` — governa deploys supervisionados.
- **PR28** — Criar skill `System Mapper` — mapeia e atualiza o sistema ENAVIA.
- **PR29** — Criar skill `Contract Auditor` — audita contratos e execuções.

### Regra obrigatória

Não criar endpoint de skills antes de PR26.
Não misturar definição de skill com implementação de endpoint.

---

## 13. PR30 — PR-DOCS/PR-PROVA — Fechamento, hardening e handoff final

### Objetivo

Encerrar formalmente o contrato com hardening, revisão e handoff.

### Pré-requisito obrigatório

- PR29 concluída.

### Escopo

- Revisar toda a governança do contrato.
- Atualizar `schema/contracts/INDEX.md` encerrando este contrato.
- Criar novo handoff formal.

---

## 14. O que é opcional (não mexer agora)

- Remover `consolidateAfterSave` — dead code.
- Integrar `contract-adherence-engine`.
- Criar autonomia completa.
- Criar deploy automático de produção.
- Refatorar schemas antigos.
- Mexer no executor externo diretamente.
- Criar endpoint `GET /system/map` no Worker (registry é docs, não endpoint).

---

## 15. Definição de pronto

Este contrato estará pronto quando:

1. O loop obrigatório estiver formalizado no `CLAUDE.md`.
2. O ciclo `execute-next → complete-task → phase_complete → advance-phase → próxima task/fase` funcionar via loop supervisionado.
3. `loop-status` retornar ação correta para todos os estados operacionais relevantes (`in_progress`, `phase_complete`).
4. System Map, Route Registry, Playbook e registry de workers/bindings estiverem documentados.
5. As quatro skills supervisionadas (PR26–PR29) estiverem definidas.
6. Contrato encerrado formalmente com `PR-PROVA` final (PR30).

---

## 16. Resposta obrigatória ao fim de cada PR

```
WORKFLOW_ACK: ok

PR executada:
Branch:
Commit:
Link da PR:

Resumo:
- ...

Tipo da PR: PR-IMPL | PR-DIAG | PR-PROVA | PR-DOCS
Contrato ativo: CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md
PR anterior validada:

Arquivos alterados:
- ...

Smoke tests:
- ...

Evidências:
- ...

Rollback:
- ...

Bloqueios:
- nenhum
```

---

## 17. Encerramento formal — PR30

**Data de encerramento:** 2026-04-30
**Status:** Encerrado ✅

### Checklist de encerramento

- [x] PR0 — PR-DOCS — Loop obrigatório de execução por PR (`CLAUDE.md` + `schema/contracts/INDEX.md`) — Concluída
- [x] PR17 — PR-DIAG — Diagnóstico de `phase_complete` e `advance-phase` — Concluída
- [x] PR18 — PR-IMPL — Endpoint `POST /contracts/advance-phase` — Concluída
- [x] PR19 — PR-PROVA — Smoke E2E do ciclo completo (52/52 ✅) — Concluída
- [x] PR20 — PR-IMPL — `loop-status` expõe `complete-task` em `in_progress` — Concluída
- [x] PR21 — PR-PROVA — Matriz de estados do `loop-status` (53/53 ✅) — Concluída
- [x] PR22 — PR-DOCS — `schema/system/ENAVIA_SYSTEM_MAP.md` (PR #183) — Concluída
- [x] PR23 — PR-DOCS — `schema/system/ENAVIA_ROUTE_REGISTRY.json` (PR #184) — Concluída
- [x] PR24 — PR-DOCS — `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` (PR #185) — Concluída
- [x] PR25 — PR-DOCS — `schema/system/ENAVIA_WORKER_REGISTRY.md` (PR #186) — Concluída
- [x] PR26 — PR-DOCS — `schema/skills/CONTRACT_LOOP_OPERATOR.md` (PR #187) — Concluída
- [x] PR27 — PR-DOCS — `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` (PR #188) — Concluída
- [x] PR28 — PR-DOCS — `schema/skills/SYSTEM_MAPPER.md` (PR #189) — Concluída
- [x] PR29 — PR-DOCS — `schema/skills/CONTRACT_AUDITOR.md` — Concluída
- [x] PR30 — PR-DOCS/PR-PROVA — Fechamento, hardening e handoff final — **Esta PR**

### Resultado final

| Item | Estado |
|------|--------|
| Loop contratual supervisionado | ✅ Consolidado e provado (PR17–PR21) |
| System Map + Route Registry + Playbook + Worker Registry | ✅ Criados (PR22–PR25) |
| 4 skills documentais ativas | ✅ Criadas (PR26–PR29) |
| Relatório final | ✅ `schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md` |
| Handoff final | ✅ `schema/handoffs/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_FINAL_HANDOFF.md` |
| Governança atualizada | ✅ INDEX.md, status, handoff, execution log |
| Runtime alterado nas frentes de docs/skills | ✅ Não — zero alterações de runtime em PR22–PR30 |

### Próxima etapa

Aguardar definição do próximo contrato pelo operador humano.

Não iniciar novo contrato sem aprovação explícita e sem criar novo arquivo em `schema/contracts/active/`.
