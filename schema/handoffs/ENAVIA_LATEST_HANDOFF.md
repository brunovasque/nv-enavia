# ENAVIA — Latest Handoff

**Data:** 2026-04-29
**De:** PR24 — PR-DOCS — Criar `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md`
**Para:** PR25 — PR-DOCS — Registry de workers, bindings, KV e secrets esperados

## O que foi feito nesta sessão

### PR24 — PR-DOCS — Playbook Operacional

**Tipo:** `PR-DOCS`
**Branch:** `claude/pr24-docs-enavia-operational-playbook` (criada a partir de `origin/main` atualizada — commit base `beb3dfa`, contendo PR23 mergeada — PR #184)

**Arquivo criado:**

1. **`schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md`** (NOVO):
   - 18 seções obrigatórias + Apêndice A.
   - Fontes: `ENAVIA_SYSTEM_MAP.md` (PR22), `ENAVIA_ROUTE_REGISTRY.json` (PR23), contrato ativo, testes PR13–PR21.
   - Seção 1: Objetivo do playbook.
   - Seção 2: Regras absolutas (9 passos obrigatórios + regras invioláveis).
   - Seção 3: Tipos de PR (tabela PR-DIAG/IMPL/PROVA/DOCS).
   - Seção 4: Como identificar a próxima PR autorizada (checklist 6 passos).
   - Seção 5: Fluxo operacional com estados, endpoints e provas anotadas.
   - Seção 6: Matriz de ações por estado + observação PR21 (`status_global:"blocked"` sozinho NÃO bloqueia).
   - Seção 7: Checklist PR-DIAG.
   - Seção 8: Checklist PR-IMPL + comandos de regressão obrigatórios.
   - Seção 9: Checklist PR-PROVA + suite de regressão completa (451 total).
   - Seção 10: Checklist PR-DOCS + validação JSON.
   - Seção 11: Bloqueios comuns (12 linhas: sintoma → causa → onde verificar → próxima ação segura).
   - Seção 12: Rollback (4 tipos: DOCS, PROVA, IMPL, KV + quando NÃO fazer rollback).
   - Seção 13: Smoke tests oficiais por frente (tabela com 6 frentes + counts).
   - Seção 14: Como usar System Map e Route Registry (com exemplos Node.js).
   - Seção 15: Procedimento de handoff (seções 15.1–15.5 com templates).
   - Seção 16: Regras de segurança (autonomia, produção, transparência, secrets, registry).
   - Seção 17: Itens opcionais — "Isso é opcional. Não mexa agora." (9 itens).
   - Seção 18: Checklist final (12 itens).
   - Apêndice A: Quick reference (arquivos de governança, endpoints de loop, padrão de branch, formato de resposta).

2. **Governança:**
   - `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR24 no topo.
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — este arquivo.
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
   - `schema/contracts/INDEX.md` — próxima PR autorizada = PR25.

**Arquivos NÃO alterados (proibido pelo escopo):**
- `nv-enavia.js`, `contract-executor.js`
- `panel/`, `executor/`, deploy worker, `.github/workflows/`, `wrangler.toml`
- Nenhum teste criado ou modificado.

## Critérios de aceite — atendidos

| Critério | Status |
|----------|--------|
| `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` criado | ✅ |
| 18 seções obrigatórias presentes | ✅ |
| Referências cruzadas ao System Map (PR22) | ✅ (5 ocorrências) |
| Referências cruzadas ao Route Registry (PR23) | ✅ (10 ocorrências) |
| Seção 17 com "Isso é opcional. Não mexa agora." | ✅ |
| Seção 6 com observação PR21 sobre `status_global:"blocked"` | ✅ |
| Smoke tests documentados (451 total) | ✅ |
| Nenhum runtime alterado | ✅ |
| Governança atualizada | ✅ |
| `schema/contracts/INDEX.md` aponta PR25 como próxima | ✅ |

## Verificações executadas

| Comando | Resultado |
|---------|-----------|
| `grep -c "^## " ENAVIA_OPERATIONAL_PLAYBOOK.md` | `27` (18 principais + subsections de templates) ✅ |
| Seções numeradas 1–18 presentes | ✅ |
| `grep -c "ENAVIA_SYSTEM_MAP"` | `5` ✅ |
| `grep -c "ENAVIA_ROUTE_REGISTRY"` | `10` ✅ |
| `git diff --name-only HEAD` | `(vazio)` ✅ |

## Contrato ativo

`schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`

## Próxima ação autorizada

**PR25** — `PR-DOCS` — Registry de workers, bindings, KV e secrets esperados

Criar `schema/system/ENAVIA_WORKER_REGISTRY.md` (ou equivalente) documentando:
- Workers do sistema: `nv-enavia`, `enavia-executor`, `deploy-worker`, `deploy-worker-test`
- Bindings de serviço: EXECUTOR, DEPLOY_WORKER (PROD e TEST)
- KV namespaces: ENAVIA_BRAIN (PROD e TEST), KV IDs e key shapes
- Secrets esperados: INTERNAL_TOKEN, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET, BROWSER_EXECUTOR_URL, ENAVIA_EXECUTOR_URL, DIRECTOR_COGNITIVE_URL, VERCEL_EXECUTOR_URL, ADMIN_API_KEY
- Environment vars: ENAVIA_MODE, OPENAI_MODEL
- Fontes: `wrangler.toml` (PROD), `executor/wrangler.toml`, `.github/workflows/deploy.yml` e `deploy-executor.yml`

**Pré-requisito:** PR24 concluída (esta PR) ✅

## Bloqueios

- nenhum
