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

**PR27** — PR-DOCS — Criar skill: Deploy Governance Operator.

Criar `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` — skill supervisionada que governa deploy, rollback e promoção PROD/TEST. Documentar: quando deplorar TEST vs PROD, gates de deploy, rollback seguro por tipo, promoção supervisionada, relação com Contract Loop Operator (PR26), Worker Registry (PR25) e Playbook (PR24).

Contexto: PR26 concluída — `schema/skills/CONTRACT_LOOP_OPERATOR.md` criado (20 seções, primeira skill oficial). Continua a frente de Skills (PR26–PR29). Todas as PRs desta frente são `PR-DOCS`, sem alteração de runtime.

### Histórico recente

- **PR22** ✅ (PR-DOCS, mergeada — PR #183, commit merge `fc7a4ec`) — `schema/system/ENAVIA_SYSTEM_MAP.md` criado (14 seções).
- **PR23** ✅ (PR-DOCS, mergeada — PR #184, commit merge `beb3dfa`) — `schema/system/ENAVIA_ROUTE_REGISTRY.json` criado (68 rotas, 0 violações).
- **PR24** ✅ (PR-DOCS, mergeada — PR #185, commit merge `b54e74c`) — `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` criado (18 seções + Apêndice A).
- **PR25** ✅ (PR-DOCS, mergeada — PR #186, commit merge `fb8e640`) — `schema/system/ENAVIA_WORKER_REGISTRY.md` criado (18 seções, inventário de infraestrutura).
- **PR26** ✅ (PR-DOCS, em revisão) — `schema/skills/CONTRACT_LOOP_OPERATOR.md` criado (20 seções, primeira skill oficial) + `schema/skills/INDEX.md`.
