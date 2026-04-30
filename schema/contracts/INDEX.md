# ENAVIA — Índice de Contratos

Registro centralizado de todos os contratos do repo `nv-enavia`.
Atualizar sempre que um contrato for criado, encerrado ou substituído.

---

## Contrato ativo

| Campo | Valor |
|-------|-------|
| **Arquivo** | `active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` |
| **Estado** | Ativo 🟢 |
| **PRs** | PR31–PR64 (ampliado de PR31-PR60 pela PR33) |
| **Data de início** | 2026-04-30 |
| **Objetivo** | Transformar a Enavia em IA operacional viva — LLM Core, Memory Brain, Skill Router, Intent Engine, Self-Audit |

---

## Contratos encerrados

| Arquivo | PRs | Estado | Data de encerramento |
|---------|-----|--------|----------------------|
| `active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` | PR0, PR17–PR30 | Encerrado ✅ | 2026-04-30 |
| `active/CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` | PR8–PR16 (+ fixes) | Encerrado ✅ | 2026-04-29 |
| `active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` | PR1–PR7 | Encerrado ✅ | 2026-04-27 |

> **Nota:** PR14–PR16 foram fixes operacionais executados após o encerramento formal do
> contrato PR8–PR13, dentro do mesmo escopo Worker-only. São considerados parte do
> ciclo operacional anterior.

---

## Regra de uso

1. Sempre consultar este índice no início de cada sessão.
2. O contrato ativo é aquele marcado como **Ativo** 🟢.
3. Contratos históricos não devem ser editados — apenas lidos como referência.
4. Ao encerrar um contrato, mover seu estado para "Encerrado ✅" e registrar a data.
5. Ao criar um novo contrato, adicionar na seção "Contrato ativo" e mover o anterior para histórico.

---

## Próxima PR autorizada

**PR34 — PR-DIAG — Diagnóstico específico de read_only, target default e sanitizers**

Contrato ativo: `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`

### PRs do contrato Jarvis Brain já concluídas

- **PR31** ✅ (PR-DOCS) — Ativação do contrato Jarvis Brain v1. Governança religada. Nenhum runtime alterado.
- **PR32** ✅ (PR-DIAG) — Diagnóstico do chat engessado. Causa raiz identificada (target default + read_only como tom + ausência de LLM Core/Intent/Skill Router/Brain + sanitizers pós-LLM + envelope JSON). Relatório: `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`. Nenhum runtime alterado.
- **PR33** ✅ (PR-DOCS) — Ajuste do contrato após diagnóstico PR32. Nova Frente 2 corretiva inserida (PR33-PR36). Regras R1-R4 adicionadas. Obsidian Brain deslocado para PR37+. Contrato ampliado para PR31-PR64. Nenhum runtime alterado.

### Histórico do contrato encerrado (PR17–PR30)

- **PR0** ✅ (PR-DOCS) — Loop obrigatório de execução por PR em `CLAUDE.md` + `schema/contracts/INDEX.md` criado.
- **PR17** ✅ (PR-DIAG) — Diagnóstico READ-ONLY de `phase_complete` e `advance-phase`.
- **PR18** ✅ (PR-IMPL) — `POST /contracts/advance-phase` criado em `nv-enavia.js`.
- **PR19** ✅ (PR-PROVA) — Smoke E2E completo: `execute-next → complete-task → advance-phase` (52/52 ✅).
- **PR20** ✅ (PR-IMPL) — `loop-status` expõe `complete-task` em `in_progress`.
- **PR21** ✅ (PR-PROVA) — Matriz de estados do `loop-status` (53/53 ✅).
- **PR22** ✅ (PR-DOCS, mergeada — PR #183, commit merge `fc7a4ec`) — `schema/system/ENAVIA_SYSTEM_MAP.md` criado (14 seções).
- **PR23** ✅ (PR-DOCS, mergeada — PR #184, commit merge `beb3dfa`) — `schema/system/ENAVIA_ROUTE_REGISTRY.json` criado (68 rotas, 0 violações).
- **PR24** ✅ (PR-DOCS, mergeada — PR #185, commit merge `b54e74c`) — `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` criado (18 seções + Apêndice A).
- **PR25** ✅ (PR-DOCS, mergeada — PR #186, commit merge `fb8e640`) — `schema/system/ENAVIA_WORKER_REGISTRY.md` criado (18 seções, inventário de infraestrutura).
- **PR26** ✅ (PR-DOCS, mergeada — PR #187, commit merge `2954fef`) — `schema/skills/CONTRACT_LOOP_OPERATOR.md` criado (20 seções, primeira skill oficial) + `schema/skills/INDEX.md`.
- **PR27** ✅ (PR-DOCS, mergeada — PR #188, commit merge `0f43c29`) — `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` criado (23 seções, segunda skill oficial) + `schema/skills/INDEX.md` atualizado.
- **PR28** ✅ (PR-DOCS, mergeada — PR #189, commit merge `daefe36`) — `schema/skills/SYSTEM_MAPPER.md` criado (23 seções, terceira skill oficial) + `schema/skills/INDEX.md` atualizado.
- **PR29** ✅ (PR-DOCS) — `schema/skills/CONTRACT_AUDITOR.md` criado (24 seções, quarta skill oficial supervisionada) + `schema/skills/INDEX.md` atualizado.
- **PR30** ✅ (PR-DOCS/PR-PROVA) — Fechamento, hardening e handoff final. Contrato encerrado.
