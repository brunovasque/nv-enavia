# ENAVIA — Latest Handoff

**Data:** 2026-04-30
**De:** PR27 — PR-DOCS — Criar `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md`
**Para:** PR28 — PR-DOCS — Criar skill: System Mapper

## O que foi feito nesta sessão

### PR27 — PR-DOCS — Deploy Governance Operator (segunda skill oficial)

**Tipo:** `PR-DOCS`
**Branch:** `claude/pr27-docs-deploy-governance-operator-skill` (criada a partir de `origin/main` atualizada — commit base `2954fef`, contendo PR26 mergeada — PR #187)

**Arquivos criados/alterados:**

1. **`schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md`** (NOVO):
   - 23 seções obrigatórias.
   - Segunda skill oficial supervisionada da ENAVIA.
   - Frase obrigatória 1: "Deploy seguro não é deploy travado; é deploy com prova, rollback e aprovação clara."
   - Frase obrigatória 2: "Sem aprovação humana explícita, PROD é bloqueado."
   - Seção 3: Princípio de deploy seguro sem travamento — governa sem impedir evolução.
   - Seção 9: Matriz de decisão TEST vs PROD — 8 tipos de PR/ação mapeados (DOCS, PROVA, IMPL, workflow, binding, hotfix, rollback, promoção).
   - Seção 10: 12 gates obrigatórios antes de qualquer deploy (branch limpa, PR aprovada, CI verde, smoke suite, sem conflito, wrangler válido, secrets verificados, worker registrado, rollback documentado, aprovação humana para PROD, KV backup, deploy log).
   - Seção 11: Relação com Contract Loop Operator — ponto de integração `execute-next → DEPLOY_WORKER:/apply-test`.
   - Seção 12: Relação com Worker Registry (PR25) — fonte de verdade para workers, bindings, secrets, workflows.
   - Seção 13: Relação com Route Registry (PR23) — `known_external_routes` para deploy.
   - Seção 14: Relação com Operational Playbook (PR24) — rollback e smoke suite.
   - Seções 15–16: Procedimento passo a passo deploy TEST (8 passos) e promoção PROD (10 passos).
   - Seção 17: Rollback por tipo (DOCS, PROVA, IMPL Worker, workflow/config, KV/data, PROD) + quando NÃO fazer rollback + formato de log.
   - Seção 18: Tabela de diagnóstico de falhas (12 linhas: GitHub Actions, wrangler, secrets, bindings, KV, worker 500, smoke fail, rollback fail, etc.).
   - Seção 19: Critérios para sugerir nova skill (8 gatilhos + template).
   - Seção 20: 7 exemplos de uso concretos (PR-DOCS sem deploy, PR-IMPL para TEST, TEST→PROD, smoke fail, secret faltando, rollback, sugestão de skill).
   - Seção 21: Segurança e limites (nunca expor secrets, nunca alterar bindings/KV, nunca auto-promover PROD).
   - Seção 22: "Isso é opcional. Não mexa agora." (11 itens: executor automático de deploy, endpoint /deploy/trigger, webhook de CI, auto-rollback, etc.).
   - Seção 23: Checklist final (12 itens).

2. **`schema/skills/INDEX.md`** (ATUALIZADO):
   - Deploy Governance Operator movida de "previstas" para "ativas".
   - Agora 2 skills ativas (PR26, PR27), 2 previstas (PR28, PR29).

3. **Governança:**
   - `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR27 no topo.
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — este arquivo.
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
   - `schema/contracts/INDEX.md` — próxima PR autorizada = PR28.

**Arquivos NÃO alterados:**
- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`
- Nenhum teste criado ou modificado.

## Critérios de aceite — atendidos

| Critério | Status |
|----------|--------|
| `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` criado | ✅ |
| `schema/skills/INDEX.md` atualizado com a nova skill ativa | ✅ |
| 23 seções obrigatórias presentes | ✅ |
| "Deploy seguro não é deploy travado..." presente | ✅ (2 ocorrências) |
| "Sem aprovação humana explícita, PROD é bloqueado." presente | ✅ |
| CONTRACT_LOOP_OPERATOR referenciado | ✅ |
| ENAVIA_WORKER_REGISTRY referenciado | ✅ (10 ocorrências) |
| ENAVIA_ROUTE_REGISTRY referenciado | ✅ (5 ocorrências) |
| ENAVIA_OPERATIONAL_PLAYBOOK referenciado | ✅ (3 ocorrências) |
| Rollback documentado por tipo | ✅ (seção 17) |
| Gates de deploy documentados | ✅ (seção 10, 12 gates) |
| Promoção PROD supervisionada documentada | ✅ (seção 16) |
| "Isso é opcional. Não mexa agora." presente | ✅ (seção 22) |
| Nenhum runtime alterado | ✅ |
| Governança atualizada | ✅ |
| `schema/contracts/INDEX.md` aponta PR28 como próxima | ✅ |

## Contrato ativo

`schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`

## Próxima ação autorizada

**PR28** — `PR-DOCS` — Criar skill: System Mapper

Criar `schema/skills/SYSTEM_MAPPER.md` — skill supervisionada que governa manutenção e atualização dos documentos de sistema (System Map, Route Registry, Worker Registry). Deve cobrir:
- Quando atualizar cada documento de sistema
- Triggers de atualização (nova rota, novo worker, novo binding, novo contrato)
- Procedimento de atualização supervisionada
- Relação com Deploy Governance Operator (PR27) — informação de infraestrutura
- Relação com Contract Loop Operator (PR26) — quando loop aciona mudança de sistema
- Relação com Contract Auditor (PR29) — validação de aderência
- Atualizar `schema/skills/INDEX.md` com a nova skill ativa

**Pré-requisito:** PR27 concluída (esta PR) ✅

## Bloqueios

- nenhum
