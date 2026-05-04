# CONTRATO ENAVIA — GITHUB BRIDGE REAL PR102–PR105

**Data de criação:** 2026-05-04  
**Estado:** 🟢 Ativo  
**PR102:** ✅ Concluída (2026-05-04)  
**PR103:** ⏳ Próxima autorizada  
**PR104:** ⬜ Pendente  
**PR105:** ⬜ Pendente  
**Contrato anterior encerrado:** `CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md` — Encerrado ✅ em 2026-05-04

---

## Objetivo macro

Permitir que a Enavia interaja com GitHub de forma real e supervisionada, começando por branch/PR/comment/evidence, usando Safety Guard, Event Log e Health Snapshot como base obrigatória.

---

## Regra central

A Enavia pode preparar e operar PRs reais de forma supervisionada, mas:

- merge automático continua proibido;
- deploy PROD automático continua proibido;
- secrets continuam proibidos;
- qualquer ação real deve passar por Safety Guard;
- qualquer ação real deve gerar Event Log;
- qualquer operação perigosa exige aprovação humana.

---

## Divisão de PRs

### PR102 — Diagnóstico READ-ONLY do GitHub Bridge Real

**Tipo:** PR-DIAG  
**Escopo:** Docs-only + Tests (sem alteração de runtime)

**Objetivo:**  
Mapear o que já existe para GitHub/branch/PR/comment/review/evidence e definir menor caminho seguro para implementação.

**Entregáveis desta PR:**
- `schema/contracts/active/CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md`
- `schema/contracts/ACTIVE_CONTRACT.md`
- `schema/contracts/INDEX.md`
- `schema/reports/PR102_GITHUB_BRIDGE_REAL_DIAGNOSTICO.md`
- `tests/pr102-github-bridge-real-diagnostico.prova.test.js`
- Governança mínima (`schema/status/ENAVIA_STATUS_ATUAL.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, `schema/execution/ENAVIA_EXECUTION_LOG.md`)

**Proibido na PR102:**
- alterar `nv-enavia.js`, `executor/src/index.js`, `contract-executor.js`;
- alterar `.github/workflows/deploy.yml` ou `wrangler.toml`;
- criar endpoint novo, binding novo, chamada GitHub real, branch real, PR real, merge real, deploy real;
- tocar secrets;
- mexer em `panel/**`.

---

### PR103 — GitHub Bridge helper real supervisionado

**Tipo:** PR-IMPL  
**Escopo:** schema/helper puro (sem plugar no runtime se não for seguro)

**Objetivo:**  
Criar helper de GitHub Bridge com operações modeladas e guardadas:
- `plan_create_branch`
- `plan_open_pr`
- `plan_update_pr`
- `plan_comment_pr`
- `build_github_operation_event`
- `validate_github_operation`

**Regras:**
- se houver token/env disponível, apenas documentar;
- não usar token real na PR103;
- sem merge automático;
- sem deploy PROD automático.

---

### PR104 — Runtime mínimo supervisionado

**Tipo:** PR-IMPL  
**Escopo:** integração mínima controlada

**Objetivo:**  
Criar ponto de entrada controlado para usar GitHub Bridge real em ambiente permitido, com Safety Guard e Event Log obrigatórios.

**Regras:**
- sem merge automático;
- sem PROD automático;
- operações perigosas com aprovação humana.

---

### PR105 — Prova real supervisionada

**Tipo:** PR-PROVA

**Objetivo:**  
Provar operação real mínima em GitHub:
- criar ou atualizar PR/comentário em repo permitido;
- anexar evidência;
- Safety Guard validado;
- Event Log gerado;
- travar antes de merge/prod.

---

## Preservação obrigatória

Não refatorar nesta frente:

- PR Orchestrator PR90–PR93;
- Chat Livre + Cockpit PR94–PR97;
- Observabilidade + Autoproteção PR98–PR101;
- Deploy loop PR86–PR89;
- Skill Factory/Runner;
- SELF_WORKER_AUDITOR;
- gates humanos;
- bloqueios de PROD/merge/secrets.

---

## Estado atual

| PR | Tipo | Estado |
|----|------|--------|
| PR102 | PR-DIAG | ✅ Concluída |
| PR103 | PR-IMPL | ⏳ Próxima |
| PR104 | PR-IMPL | ⬜ Pendente |
| PR105 | PR-PROVA | ⬜ Pendente |

---

_Contrato criado em 2026-05-04._
