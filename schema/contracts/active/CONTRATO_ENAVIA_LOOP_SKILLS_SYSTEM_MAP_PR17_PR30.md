# CONTRATO — ENAVIA LOOP SKILLS + SYSTEM MAP — PR17 a PR30

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

Com o loop operacional supervisionado estável (PR8–PR16), este contrato abre a próxima frente:

1. **Loop de Skills** — permitir que o sistema ENAVIA execute skills reais via contrato supervisionado.
2. **System Map** — mapear e documentar todos os componentes do sistema ENAVIA com visibilidade operacional.
3. **Governança de loop formalizada** — garantir que o `CLAUDE.md` e o loop de execução estejam consolidados e sejam a lei do repo.

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
PR0  — Docs-only    — Loop obrigatório de execução por PR (CLAUDE.md + governança)
PR17 — PR-DIAG      — Diagnóstico do estado atual do loop de skills
PR18 — PR-IMPL      — Worker-only — Endpoint de skills no loop operacional
PR19 — PR-PROVA     — Smoke tests do loop de skills
PR20 — PR-DIAG      — Diagnóstico do System Map atual
PR21 — PR-IMPL      — Worker-only — Endpoint de system map
PR22 — PR-PROVA     — Smoke tests do system map
PR23 — PR-IMPL      — Panel-only — UI para loop de skills e system map
PR24 — PR-PROVA     — Testes de integração painel × worker
PR25 — PR-DOCS      — Documentação do sistema ENAVIA pós-PR24
PR26–PR30           — Reservadas para expansão e hardening final deste contrato
```

Não pule etapas.
Não misture escopos na mesma PR.
Confirme no loop obrigatório (CLAUDE.md seção 4) antes de cada PR.

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

## 6. PR17 — PR-DIAG — Diagnóstico do estado atual do loop de skills

### Objetivo

Diagnosticar o que existe hoje no sistema ENAVIA para execução de skills.

### Escopo

- Worker-only (diagnóstico read-only).
- Não alterar nenhum arquivo de runtime.
- Mapear endpoints existentes relacionados a skills.
- Identificar gaps entre o loop operacional atual e o que seria necessário para skills reais.
- Documentar o diagnóstico no execution log.

### Critérios de aceite

- Diagnóstico documentado.
- Lista de endpoints existentes e ausentes para skills.
- Governança atualizada.

---

## 7. PR18 — PR-IMPL — Worker-only — Endpoint de skills no loop operacional

### Objetivo

Criar endpoint supervisionado para execução de skills via loop operacional.

### Pré-requisito obrigatório

- PR17 (`PR-DIAG`) concluída.

### Escopo

- Alterar somente `nv-enavia.js`.
- Criar `POST /contracts/execute-skill` ou endpoint equivalente autorizado pelo diagnóstico.
- Reutilizar gates existentes (audit, evidence, deploy).
- Nunca executar skill em produção automaticamente.

### Critérios de aceite

- Endpoint criado e documentado.
- Gates reutilizados.
- Smoke tests presentes.

---

## 8. PR19 — PR-PROVA — Smoke tests do loop de skills

### Objetivo

Validar que o loop de skills funciona corretamente com todos os gates.

### Pré-requisito obrigatório

- PR18 (`PR-IMPL`) concluída.

### Escopo

- Criar `tests/pr19-loop-skills.smoke.test.js`.
- Cobrir todos os gates do PR18.
- Não alterar runtime.

---

## 9. PR20 — PR-DIAG — Diagnóstico do System Map atual

### Objetivo

Mapear todos os componentes do sistema ENAVIA com visibilidade operacional.

### Escopo

- Read-only.
- Documentar no execution log.
- Identificar componentes, bindings, rotas, estados.

---

## 10. PR21 — PR-IMPL — Worker-only — Endpoint de system map

### Objetivo

Criar endpoint `GET /system/map` ou equivalente que retorne o mapa atual do sistema.

### Pré-requisito obrigatório

- PR20 (`PR-DIAG`) concluída.

---

## 11. PR22–PR30

- PR22: Smoke tests do system map.
- PR23: Panel-only — UI para loop de skills e system map.
- PR24: Testes de integração painel × worker.
- PR25: Documentação pós-PR24.
- PR26–PR30: Reservadas para expansão e hardening final.

---

## 12. O que é opcional (não mexer agora)

- Remover `consolidateAfterSave` — dead code.
- Integrar `contract-adherence-engine`.
- Criar autonomia completa.
- Criar deploy automático de produção.
- Refatorar schemas antigos.
- Mexer no executor externo diretamente.

---

## 13. Definição de pronto

Este contrato estará pronto quando:

1. O loop obrigatório estiver formalizado no `CLAUDE.md`.
2. Skills puderem ser executadas via loop supervisionado.
3. System map estiver disponível via endpoint.
4. Painel puder operar skills e ver o mapa.
5. Toda execução tiver diagnóstico + prova.
6. Contrato encerrado formalmente com `PR-PROVA` final.

---

## 14. Resposta obrigatória ao fim de cada PR

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
