# ENAVIA — Índice de Skills

Registro centralizado de todas as skills supervisionadas da ENAVIA.
Atualizar sempre que uma skill for criada, encerrada ou substituída.

---

## Skills ativas

| Arquivo | Nome | PR | Status | Escopo |
|---------|------|----|--------|--------|
| `CONTRACT_LOOP_OPERATOR.md` | Contract Loop Operator | PR26 | **Ativa — documental** 🟢 | Operação do loop contratual supervisionado |

---

## Skills previstas (contrato PR17–PR30)

| Nome | PR prevista | Status | Escopo |
|------|------------|--------|--------|
| Deploy Governance Operator | PR27 | Pendente ⏳ | Governança de deploy, rollback e promoção PROD/TEST |
| System Mapper | PR28 | Pendente ⏳ | Manutenção de System Map, Route Registry e Worker Registry |
| Contract Auditor | PR29 | Pendente ⏳ | Validação de aderência contratual |

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
