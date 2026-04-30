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

**PR30** — PR-DOCS/PR-PROVA — Fechamento, hardening e handoff final do contrato.

Encerramento formal do contrato `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`. Deve incluir: revisão da completude das frentes (System Map, Skills), hardening documental, atualização do handoff final, transição de estado do contrato para "Encerrado ✅" e, se aplicável, preparação para contrato seguinte.

Contexto: PR29 concluída — `schema/skills/CONTRACT_AUDITOR.md` criado (24 seções, quarta skill oficial supervisionada). Todas as skills previstas no contrato (PR26, PR27, PR28, PR29) estão ativas e documentais. Frente de Skills completa.

### Histórico recente

- **PR22** ✅ (PR-DOCS, mergeada — PR #183, commit merge `fc7a4ec`) — `schema/system/ENAVIA_SYSTEM_MAP.md` criado (14 seções).
- **PR23** ✅ (PR-DOCS, mergeada — PR #184, commit merge `beb3dfa`) — `schema/system/ENAVIA_ROUTE_REGISTRY.json` criado (68 rotas, 0 violações).
- **PR24** ✅ (PR-DOCS, mergeada — PR #185, commit merge `b54e74c`) — `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` criado (18 seções + Apêndice A).
- **PR25** ✅ (PR-DOCS, mergeada — PR #186, commit merge `fb8e640`) — `schema/system/ENAVIA_WORKER_REGISTRY.md` criado (18 seções, inventário de infraestrutura).
- **PR26** ✅ (PR-DOCS, mergeada — PR #187, commit merge `2954fef`) — `schema/skills/CONTRACT_LOOP_OPERATOR.md` criado (20 seções, primeira skill oficial) + `schema/skills/INDEX.md`.
- **PR27** ✅ (PR-DOCS, mergeada — PR #188, commit merge `0f43c29`) — `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` criado (23 seções, segunda skill oficial) + `schema/skills/INDEX.md` atualizado.
- **PR28** ✅ (PR-DOCS, mergeada — PR #189, commit merge `daefe36`) — `schema/skills/SYSTEM_MAPPER.md` criado (23 seções, terceira skill oficial) + `schema/skills/INDEX.md` atualizado.
- **PR29** ✅ (PR-DOCS, em revisão) — `schema/skills/CONTRACT_AUDITOR.md` criado (24 seções, quarta skill oficial supervisionada) + `schema/skills/INDEX.md` atualizado.
