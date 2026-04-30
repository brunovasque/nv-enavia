# ENAVIA — Latest Handoff

**Data:** 2026-04-29
**De:** PR22 — PR-DOCS — Criar `schema/system/ENAVIA_SYSTEM_MAP.md`
**Para:** PR23 — PR-DOCS — Criar `schema/system/ENAVIA_ROUTE_REGISTRY.json`

## O que foi feito nesta sessão

### PR22 — PR-DOCS — System Map

**Tipo:** `PR-DOCS`
**Branch:** `claude/pr22-docs-enavia-system-map` (criada a partir de `origin/main` atualizada — commit base `3d29b7d`, contendo PR21 mergeada — PR #182)

**Arquivo criado:**

1. **`schema/system/ENAVIA_SYSTEM_MAP.md`** (NOVO):
   - 14 seções documentando todos os componentes do sistema ENAVIA.
   - Nenhum componente inventado — todas as informações extraídas do repo.
   - Seção 1: Objetivo do sistema.
   - Seção 2: Estado atual resumido (PR21 mergeada, 451/451 testes ✅).
   - Seção 3: Componentes principais (5 componentes: nv-enavia, enavia-executor, deploy-worker, contract-executor.js, panel).
   - Seção 4: Arquivos centrais (workers, módulos de schema, workflows).
   - Seção 5: Contratos e governança (estrutura schema/, histórico, taxonomia PR-DIAG/IMPL/PROVA/DOCS).
   - Seção 6: Loop contratual supervisionado (fluxo completo, funções, Rules 1–9 de resolveNextAction).
   - Seção 7: Estados operacionais (status_global, task, phase, ações por estado).
   - Seção 8: Workers, bindings, KV, secrets (PROD e TEST, shapes canônicos de state e decomposition).
   - Seção 9: Endpoints conhecidos (rotas de contratos, outras rotas do worker, executor, deploy worker).
   - Seção 10: Testes e provas (PR13–PR21 com contagens; outros testes por categoria).
   - Seção 11: O que está consolidado.
   - Seção 12: O que ainda falta (PR23–PR30).
   - Seção 13: Itens opcionais / fora do escopo.
   - Seção 14: Regras de manutenção.

2. **Governança:**
   - `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR22 no topo.
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — este arquivo.
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
   - `schema/contracts/INDEX.md` — próxima PR autorizada = PR23.

**Arquivos NÃO alterados (proibido pelo escopo):**
- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, deploy worker, `.github/workflows/`, `wrangler.toml`
- Nenhum teste pré-existente modificado.

## Critérios de aceite — atendidos

| Critério | Status |
|----------|--------|
| `schema/system/ENAVIA_SYSTEM_MAP.md` criado | ✅ |
| 14 seções obrigatórias presentes | ✅ |
| Nenhum componente inventado | ✅ |
| Bindings consistentes com wrangler.toml | ✅ |
| Rotas consistentes com nv-enavia.js | ✅ |
| Nenhum runtime alterado | ✅ |
| Governança atualizada | ✅ |

## Estado consolidado da frente System Map

Com PR22 concluída, inicia a documentação estruturada do sistema:

- **ENAVIA_SYSTEM_MAP.md** (PR22) ✅ — visão geral de componentes, estados, bindings, endpoints
- **ENAVIA_ROUTE_REGISTRY.json** (PR23) ⏳ — registry machine-readable de todas as rotas
- **ENAVIA_OPERATIONAL_PLAYBOOK.md** (PR24) ⏳ — playbook operacional
- **Registry workers/bindings/secrets** (PR25) ⏳ — inventário de deploy

## Contrato ativo

`schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`

## Próxima ação autorizada

**PR23** — `PR-DOCS` — Criar `schema/system/ENAVIA_ROUTE_REGISTRY.json`

Registry JSON de todas as rotas do worker `nv-enavia` com:
- método HTTP
- path
- handler
- autenticação obrigatória
- escopo (contratos / memória / planner / cognitivo / etc.)
- status (ativo / legado / interno)

**Pré-requisito:** PR22 concluída (esta PR) ✅

## Bloqueios

- nenhum
