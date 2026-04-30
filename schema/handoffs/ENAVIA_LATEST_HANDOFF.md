# ENAVIA — Latest Handoff

**Data:** 2026-04-30
**De:** PR28 — PR-DOCS — Criar `schema/skills/SYSTEM_MAPPER.md`
**Para:** PR29 — PR-DOCS — Criar skill: Contract Auditor

## O que foi feito nesta sessão

### PR28 — PR-DOCS — System Mapper (terceira skill oficial)

**Tipo:** `PR-DOCS`
**Branch:** `claude/pr28-docs-system-mapper-skill` (atualizada contra `origin/main` — commit base `0f43c29`, contendo PR27 mergeada — PR #188)

**Arquivos criados/alterados:**

1. **`schema/skills/SYSTEM_MAPPER.md`** (NOVO):
   - 23 seções obrigatórias.
   - Terceira skill oficial supervisionada da ENAVIA.
   - Frase obrigatória: "Mapa bom não é mapa bonito; é mapa fiel ao sistema real."
   - Seção 3: Princípio de mapeamento fiel (mapa não é imaginação; registry não é desejo; documentação não pode inventar runtime; `A VERIFICAR` para incertezas).
   - Seção 4: Triggers de ativação (runtime, documental, operação).
   - Seção 5: Quando NÃO ativar — encaminha para Contract Loop Operator (loop), Deploy Governance Operator (deploy), Contract Auditor (aderência futura).
   - Seção 6: Pré-condições obrigatórias (10 itens).
   - Seção 7: Tabela de documentos sob responsabilidade (9 documentos).
   - Seções 8–12: Regras específicas para System Map, Route Registry, Worker Registry, Operational Playbook e Skills Index.
   - Seção 13: Matriz de impacto documental (11 cenários: nova rota, rota removida, novo worker, novo binding, novo secret, novo workflow, novo endpoint do loop, nova skill, novo contrato, mudança de fase, PR mergeada).
   - Seção 14: Procedimento supervisionado de mapeamento (10 passos).
   - Seção 15: Tabela de divergências (9 cenários com ação segura).
   - Seção 16: Relação com Contract Loop Operator (PR26).
   - Seção 17: Relação com Deploy Governance Operator (PR27).
   - Seção 18: Relação com futura Contract Auditor (PR29).
   - Seção 19: Critérios para sugerir nova skill (6 gatilhos + template).
   - Seção 20: 6 exemplos de uso (nova rota, novo binding, skill nova, playbook desatualizado, registry diverge, "o que existe hoje").
   - Seção 21: Segurança e limites.
   - Seção 22: "Isso é opcional. Não mexa agora." (9 itens: gerador automático de registry, scanner de workers, endpoint /system/map, UI de mapas, validação automática, auto-sync docs/runtime, bot de atualização, graph database, documentação visual interativa).
   - Seção 23: Checklist final (11 itens).

2. **`schema/skills/INDEX.md`** (ATUALIZADO):
   - System Mapper movida de "previstas" para "ativas".
   - Agora 3 skills ativas (PR26, PR27, PR28), 1 prevista (PR29).

3. **Governança:**
   - `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR28 no topo.
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — este arquivo.
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado.
   - `schema/contracts/INDEX.md` — próxima PR autorizada = PR29.

**Arquivos NÃO alterados:**
- `nv-enavia.js`, `contract-executor.js`, `panel/`, `executor/`, `.github/workflows/`, `wrangler.toml`, `wrangler.executor.template.toml`
- Nenhum teste criado ou modificado.
- Nenhum secret, binding ou KV alterado.

## Critérios de aceite — atendidos

| Critério | Status |
|----------|--------|
| `schema/skills/SYSTEM_MAPPER.md` criado | ✅ |
| `schema/skills/INDEX.md` atualizado com a nova skill ativa | ✅ |
| Skill governa System Map, Route Registry, Worker Registry, Playbook e Skills Index | ✅ (Seções 7–12) |
| Frase "Mapa bom não é mapa bonito; é mapa fiel ao sistema real." presente | ✅ (Seção 3) |
| Skill não autoriza atualização automática sem PR | ✅ (Seções 3, 21, 22) |
| Skill não autoriza inventar rota/worker/binding | ✅ (Seções 3, 9, 10, 21) |
| Referencia `CONTRACT_LOOP_OPERATOR.md` | ✅ (header + Seção 16) |
| Referencia `DEPLOY_GOVERNANCE_OPERATOR.md` | ✅ (header + Seção 17) |
| Referencia futura `CONTRACT_AUDITOR.md` | ✅ (Seção 18) |
| "Isso é opcional. Não mexa agora." presente | ✅ (Seção 22) |
| Nenhum runtime alterado | ✅ |
| Nenhum endpoint criado | ✅ |
| Nenhum teste criado | ✅ |
| Governança atualizada | ✅ |
| `schema/contracts/INDEX.md` aponta PR29 como próxima | ✅ |

## Contrato ativo

`schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`

## Próxima ação autorizada

**PR29** — `PR-DOCS` — Criar skill: Contract Auditor

Criar `schema/skills/CONTRACT_AUDITOR.md` — skill supervisionada que valida aderência ao contrato ativo. Deve cobrir:
- Validação de PR vs contrato (escopo declarado vs mudanças reais).
- Detecção de divergência entre contrato e implementação.
- Relação com Contract Loop Operator (PR26) — auditor não executa loop.
- Relação com Deploy Governance Operator (PR27) — auditor não promove deploy.
- Relação com System Mapper (PR28) — auditor pode pedir correção documental via PR-DOCS sob System Mapper.
- Critérios de bloqueio quando PR violar contrato.
- Atualizar `schema/skills/INDEX.md` movendo Contract Auditor para "ativas".

**Pré-requisito:** PR28 concluída (esta PR) ✅

## Bloqueios

- nenhum
