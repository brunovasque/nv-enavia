# Brain — Contratos Encerrados (resumo navegável)

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Fonte de verdade:** `schema/contracts/INDEX.md` + arquivos em `schema/contracts/active/`

---

## 1. Visão geral

| Contrato | PRs | Encerrado em |
|----------|-----|--------------|
| `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` | PR1–PR7 | 2026-04-27 |
| `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` | PR8–PR16 (+ fixes) | 2026-04-29 |
| `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` | PR0, PR17–PR30 | 2026-04-30 |

---

## 2. `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`

**Foco:** dar à Enavia base operacional documental + loop contratual real.

### Entregas principais

- **Loop contratual supervisionado (PR17–PR21):**
  `queued → execute-next → in_progress → complete-task → phase_complete →
  advance-phase → próxima fase`. Smoke E2E PR19 (52/52 ✅), matriz de
  estados PR21 (53/53 ✅).
- **`POST /contracts/advance-phase`** (PR18) — endpoint criado em `nv-enavia.js`.
- **`GET /contracts/loop-status`** (PR20) — passa a expor `complete-task` em
  `in_progress`.
- **System Map (PR22)** — `schema/system/ENAVIA_SYSTEM_MAP.md`, 14 seções.
- **Route Registry (PR23)** — `schema/system/ENAVIA_ROUTE_REGISTRY.json`,
  68 rotas, 0 violações.
- **Operational Playbook (PR24)** — `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md`,
  18 seções + Apêndice A.
- **Worker Registry (PR25)** — `schema/system/ENAVIA_WORKER_REGISTRY.md`,
  18 seções de inventário de infraestrutura.
- **4 skills documentais (PR26–PR29):**
  Contract Loop Operator, Deploy Governance Operator, System Mapper, Contract Auditor.
- **Relatório final (PR30)** — `schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md`,
  hardening e handoff para o próximo contrato.

### Lições aprendidas (consolidadas)

1. **Loop sequencial pequeno funciona.** Cada PR pequena, com PR-DIAG → PR-IMPL → PR-PROVA,
   reduz risco de regressão e dá rastreabilidade contratual.
2. **System Map + Registries são pré-requisito de skills.** Sem `ENAVIA_SYSTEM_MAP.md`,
   `ENAVIA_ROUTE_REGISTRY.json` e `ENAVIA_WORKER_REGISTRY.md`, as 4 skills não teriam base.
3. **Skill começa documental.** Tentar criar runtime de skill antes do
   documento gera dependência mal definida; documental primeiro é mais barato e seguro.
4. **Governança que protege execução não pode matar personalidade.** Esta
   lição já apontava para o problema do chat engessado, que veio à tona no
   contrato seguinte (Jarvis Brain).
5. **Contract Auditor é checklist documental.** Revisão humana ainda é
   necessária; a skill orienta, não decide.

---

## 3. `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` (PR8–PR16 + fixes)

**Foco:** operacionalizar o painel + executores + base de governança.

### Entregas principais

- Operacionalização do painel sobre `nv-enavia` worker
- Integração com `enavia-executor` via service binding
- Estabilização do deploy worker
- PR14–PR16 — fixes operacionais pós-encerramento, mantidos no mesmo escopo
  Worker-only (registrado em `schema/contracts/INDEX.md`)

### Lições aprendidas

- Fix operacional após encerramento é aceitável **se não criar nova frente**.
- Service binding entre workers reduz latência e elimina exposição pública —
  padrão a manter.
- Estado de TEST precisa de isolamento explícito (lição parcialmente aberta:
  `DIRECTOR_COGNITIVE_URL` ainda compartilhada PROD/TEST).

---

## 4. `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md`

**Foco:** primeira versão funcional — painel + worker + executores.

### Entregas principais

- Estrutura inicial do painel ENAVIA (Vite/React)
- Worker `nv-enavia` rodando em PROD
- Primeira ligação com executor e deploy worker
- Bases mínimas de governança (status, handoff, execution log)

### Lições aprendidas

- Sem governança documental (`schema/`), o sistema vira caixa-preta — esta
  foi a motivação para criar `CLAUDE.md` e o loop obrigatório de execução
  por PR (PR0 do contrato seguinte).
- Painel + worker desacoplados via HTTP simples funcionam para começar; service
  binding entrou só depois.

---

## 5. Backlinks

- → schema/contracts/INDEX.md
- → schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md
- → schema/contracts/active/CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md
- → schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md
- → schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md
- → brain/contracts/active.md
- → brain/learnings/what-worked.md
