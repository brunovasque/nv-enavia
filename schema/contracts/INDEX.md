# ENAVIA — Índice de Contratos

Registro centralizado de todos os contratos do repo `nv-enavia`.
Atualizar sempre que um contrato for criado, encerrado ou substituído.

---

## Contrato ativo

| Arquivo | PRs | Estado | Data de início |
|---------|-----|--------|----------------|
| `active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` | PR0, PR17–PR30 | **Ativo** 🟢 | 2026-04-29 |

---

## Contratos históricos (encerrados)

| Arquivo | PRs | Estado | Data de encerramento |
|---------|-----|--------|----------------------|
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

**PR24** — PR-DOCS — Criar `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` (playbook operacional: como executar o loop, como diagnosticar, como fazer rollback, como avançar fase).

Contexto: PR23 concluída — `schema/system/ENAVIA_ROUTE_REGISTRY.json` criado com 68 rotas verificadas em evidência real de `nv-enavia.js`. Continua a frente de System Map + Tool Registry (PR22–PR25). Todas as PRs desta frente são `PR-DOCS`, sem alteração de runtime.

### Histórico recente

- **PR17** ✅ (PR-DIAG, mergeada — PR #178, commit merge `38582b4`) — diagnóstico do gap `phase_complete → advance-phase`.
- **PR18** ✅ (PR-IMPL, mergeada — PR #179, commit merge `9b45395`) — endpoint `POST /contracts/advance-phase` criado em `nv-enavia.js`.
- **PR19** ✅ (PR-PROVA, mergeada — PR #180, commit merge `fbf8813`) — smoke E2E do ciclo completo (52/52 ✅).
- **PR20** ✅ (PR-IMPL, mergeada — PR #181, commit merge `028862d`) — `loop-status` expõe `complete-task` em `in_progress` (27/27 ✅).
- **PR21** ✅ (PR-PROVA, mergeada — PR #182, commit merge `3d29b7d`) — matriz de estados do `loop-status` (53/53 ✅).
- **PR22** ✅ (PR-DOCS, mergeada — PR #183, commit merge `fc7a4ec`) — `schema/system/ENAVIA_SYSTEM_MAP.md` criado (14 seções).
- **PR23** ✅ (PR-DOCS, em revisão) — `schema/system/ENAVIA_ROUTE_REGISTRY.json` criado (68 rotas, 0 violações).
