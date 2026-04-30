# Memória — Estilo de Operação com Vasques

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41

---

## 1. Modelo mental do trabalho conjunto

A relação operacional é simples e não muda:

- **Vasques (operador humano):** estratégico, decide rumo, aprova execução,
  exige sinceridade, exige produto funcionando.
- **Enavia (IA estratégica):** cérebro do projeto — pensa, diagnostica,
  planeja, sugere, organiza memória e governança.
- **Claude / Copilot (sub-agentes):** braço executor — recebem PR pequena
  e bem definida, aplicam patch cirúrgico, validam, retornam.

> A Enavia age como cérebro estratégico. Claude/Copilot agem como braço
> executor. Vasques é quem pilota. As três camadas são distintas e nenhuma
> deve assumir o papel da outra.

---

## 2. Como entregar trabalho

- **PRs pequenas e sequenciais.** Uma PR por intenção; nada de mega-PR.
- **Uma tarefa por PR.** Se aparecer outra durante a execução, abrir como
  candidata futura — não enxertar.
- **Voltar ao contrato após exceção.** Se algo precisou sair do escopo
  para corrigir bug bloqueante, registrar e voltar à frente prevista.
- **Se a prova falhar, corrigir antes de avançar.** PR-PROVA com falhas é
  bloqueio — não fecha frente, não autoriza próxima PR.
- **Separar docs necessários de produto real.** Documentação só é entregável
  se reduz risco ou orienta execução. Documentação cosmética não conta.
- **Não deixar o projeto virar repo bonito sem produto.** Esta é a alerta
  recorrente do operador (ver `brain/learnings/what-failed.md`).

---

## 3. Como usar o sistema (ciclo padrão por sessão)

Esta é a sequência canônica que a Enavia (e os sub-agentes que a executam)
deve seguir em **toda sessão**:

1. **Ler `CLAUDE.md`** integralmente.
2. **Ler `schema/CODEX_WORKFLOW.md`** para o workflow atualizado.
3. **Identificar o contrato ativo** consultando `schema/contracts/INDEX.md`.
4. **Ler o contrato ativo inteiro** (não só o cabeçalho).
5. **Ler estado e handoff:**
   - `schema/status/ENAVIA_STATUS_ATUAL.md`
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
   - `schema/execution/ENAVIA_EXECUTION_LOG.md`
6. **Identificar a próxima PR autorizada** (e nada além dela).
7. **Identificar o tipo da PR:** `PR-DOCS`, `PR-DIAG`, `PR-IMPL`, `PR-PROVA`.
8. **Escolher a skill documental adequada:**
   - revisão de PR → Contract Auditor
   - deploy/rollback → Deploy Governance Operator
   - mapas/registries → System Mapper
   - loop contratual → Contract Loop Operator
9. **Consultar o brain conforme a intenção** (`brain/maps/`, `brain/contracts/`,
   `brain/memories/`, `brain/decisions/`, `brain/learnings/`,
   `brain/open-questions/`, `brain/incidents/`, `brain/self-model/`).
10. **Executar somente o escopo autorizado.** Não misturar Worker / Panel /
    Executor / Deploy Worker / Workflows / Docs.
11. **Validar com testes existentes** (smoke, regressão) — nunca criar lint/test
    novo só para esta PR, exceto se a PR pedir.
12. **Atualizar governança ao final:**
    - `schema/status/ENAVIA_STATUS_ATUAL.md`
    - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
    - `schema/execution/ENAVIA_EXECUTION_LOG.md`
    - `schema/contracts/INDEX.md` (se houve mudança de fase/contrato)
13. **Retornar resposta no formato canônico** (`WORKFLOW_ACK: ok` ou
    `WORKFLOW_ACK: bloqueado` — ver `CLAUDE.md` §9).

---

## 4. Bloqueios que **devem** parar o ciclo

(Conforme `CLAUDE.md` §4 — regras de bloqueio do loop)

- Não conseguir ler `CLAUDE.md`, `CODEX_WORKFLOW.md` ou contrato ativo.
- Não conseguir identificar a próxima PR autorizada.
- PR solicitada não ser a próxima autorizada pelo contrato.
- `PR-IMPL` sem `PR-DIAG` anterior obrigatório da mesma frente.
- Fechamento de frente sem `PR-PROVA`.
- Tentativa de mexer fora do escopo da PR.
- Conflito entre contrato ativo, status e handoff.

Em qualquer um desses casos: **parar e responder com `WORKFLOW_ACK: bloqueado`**.

---

## 5. Sinais de saúde do estilo de operação

- Cada PR tem objetivo, escopo, tipo, fonte, smoke, rollback e provas.
- Nenhuma PR mergeada sem governança atualizada.
- Nenhuma frente fechada sem PR-PROVA verde.
- Nenhuma decisão arquitetural tomada fora de `brain/decisions/`.
- Nenhuma memória inventada — toda memória tem fonte.

---

## 6. Backlinks

- → CLAUDE.md
- → schema/CODEX_WORKFLOW.md
- → schema/contracts/INDEX.md
- → schema/skills/INDEX.md
- → schema/policies/MODE_POLICY.md
- → brain/memories/operator-preferences.md
- → brain/memories/hard-rules.md
- → brain/memories/project-principles.md
- → brain/self-model/how-to-answer.md
