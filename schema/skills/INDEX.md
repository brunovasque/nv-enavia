# ENAVIA — Índice de Skills

Registro centralizado de todas as skills supervisionadas da ENAVIA.
Atualizar sempre que uma skill for criada, encerrada ou substituída.

---

## Skills ativas

| Arquivo | Nome | PR | Status | Escopo |
|---------|------|----|--------|--------|
| `CONTRACT_LOOP_OPERATOR.md` | Contract Loop Operator | PR26 | **Ativa — documental** 🟢 | Operação do loop contratual supervisionado |
| `DEPLOY_GOVERNANCE_OPERATOR.md` | Deploy Governance Operator | PR27 | **Ativa — documental** 🟢 | Governança de deploy, rollback e promoção PROD/TEST |
| `SYSTEM_MAPPER.md` | System Mapper | PR28 | **Ativa — documental** 🟢 | Manutenção de System Map, Route Registry, Worker Registry, Playbook e Skills Index |
| `CONTRACT_AUDITOR.md` | Contract Auditor | PR29 | **Ativa — documental** 🟢 | Auditoria de aderência contratual de PRs, tarefas e execuções |

---

## Skills previstas (contrato PR17–PR30)

Nenhuma skill prevista pendente neste contrato. ✅ Frente de Skills concluída na PR29.

**Próxima evolução de skills** depende de contrato futuro aprovado pelo operador humano. Ver recomendações em `schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md` (Seção 10).

---

## Skills sugeridas (não aprovadas)

Nenhuma sugestão pendente no momento.

---

## Regras de uso

1. Consultar este índice antes de ativar qualquer skill.
2. Skill ativa é aquela marcada como **Ativa** 🟢.
3. Skill prevista não existe ainda — não pode ser usada.
4. Ao criar nova skill (PR-DOCS aprovada), adicionar na seção "Skills ativas".
5. Sugestões de nova skill (Seção 13–14 da skill Contract Loop Operator) devem ser registradas aqui antes de virar PR.
6. Toda skill é documental até que um executor seja implementado via PR-IMPL supervisionada.

---

## Relação com documentos oficiais

| Documento | Localização | Relação |
|-----------|------------|---------|
| `ENAVIA_SYSTEM_MAP.md` | `schema/system/` | Visão macro — referenciado por todas as skills |
| `ENAVIA_ROUTE_REGISTRY.json` | `schema/system/` | Endpoints — obrigatório para skills de loop |
| `ENAVIA_OPERATIONAL_PLAYBOOK.md` | `schema/playbooks/` | Procedimentos operacionais |
| `ENAVIA_WORKER_REGISTRY.md` | `schema/system/` | Infraestrutura — obrigatório para skills de deploy |
| Contrato ativo | `schema/contracts/active/` | Define ordem e escopo de PRs de skills |

---

## Blueprint do Runtime de Skills

> **Adicionado em:** 2026-05-02 (PR65 — PR-DOCS)

O blueprint documental do Runtime de Skills foi criado na PR65.
Define a arquitetura futura, contrato de execução, gates de aprovação e rollout por fases.

**Estado:** Blueprint documental — Runtime de Skills não existe ainda.

| Documento | Localização | Conteúdo |
|-----------|------------|---------|
| `INDEX.md` | `schema/skills-runtime/` | Visão geral e estado atual |
| `ARCHITECTURE.md` | `schema/skills-runtime/` | Fluxo alvo e 11 camadas |
| `EXECUTION_CONTRACT.md` | `schema/skills-runtime/` | Contrato de execução futuro |
| `APPROVAL_GATES.md` | `schema/skills-runtime/` | Gates de aprovação humana |
| `SKILL_CAPABILITY_MATRIX.md` | `schema/skills-runtime/` | Matriz das 4 skills |
| `SECURITY_MODEL.md` | `schema/skills-runtime/` | Modelo de segurança |
| `ROLLOUT_PLAN.md` | `schema/skills-runtime/` | Fases 0–6 do rollout |
| `OPEN_QUESTIONS.md` | `schema/skills-runtime/` | 12 perguntas para PR66 |

**Próxima etapa:** PR66 — PR-DIAG — Diagnóstico técnico para Runtime de Skills
