# Brain — Contratos Candidatos Futuros

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Estado:** Lista informativa — **nenhum destes está aprovado nem ativo**.

> **Importante:** este arquivo lista apenas candidatos. Ele **não autoriza
> nenhum trabalho**. Só o contrato ativo em `schema/contracts/active/` autoriza
> PRs. Cada item abaixo é uma frente *possível* — não obrigatória, não datada,
> não priorizada por aqui.

---

## 1. Candidatos identificados

### 1.1 — Runtime de Skills

- Adicionar capacidade de invocar skills via runtime (não só consultar documento).
- Pré-requisitos: Intent Engine, contexto controlado, governança de execução.
- **Isso é opcional. Não mexa agora.**

### 1.2 — Skill Executor

- Componente que executa o que uma skill propõe (após aprovação).
- Pré-requisito: Runtime de Skills + gate de execução robusto.
- **Isso é opcional. Não mexa agora.**

### 1.3 — UI de Skills no Painel

- Tela no painel para visualizar, escolher e disparar skills.
- Pré-requisito: Runtime de Skills.
- **Isso é opcional. Não mexa agora.**

### 1.4 — Auditoria automática de PR

- Tornar Contract Auditor um check executável (CI ou worker), não só um
  documento.
- Pré-requisito: pipeline de check ou worker dedicado.
- **Isso é opcional. Não mexa agora.**

### 1.5 — Infra Health / Bindings Validator

- Worker (ou rotina) que valida health de bindings, KVs e workers externos.
- Pré-requisito: definição de SLOs operacionais.
- **Isso é opcional. Não mexa agora.**

### 1.6 — Runtime de Self-Audit

- A Enavia revisando a própria coerência (self-model vs. capacidades reais
  vs. comportamento observado).
- Pré-requisito: telemetria suficiente + brain conectado ao runtime.
- **Isso é opcional. Não mexa agora.**

### 1.7 — Memory Update Supervision

- Pipeline supervisionado para atualizar memórias do brain a partir de
  eventos reais (PR mergeada, incidente fechado, decisão tomada).
- Pré-requisito: brain conectado ao runtime + governança de update
  documentada em `schema/brain/UPDATE_POLICY.md`.
- **Isso é opcional. Não mexa agora.**

---

## 2. Exceção à regra

A única forma de algum item acima sair da fila documental é:

1. O contrato ativo (`CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`) chegar a
   uma frente que cobre o item, **ou**
2. Um novo contrato ser ativado pelo operador humano com escopo explícito
   sobre o item, **ou**
3. O operador humano declarar exceção pontual e abrir uma PR-DOCS para
   alterar o contrato vigente.

Sem um desses três caminhos, **não mexer**.

---

## 3. Como a Enavia deve usar esta lista

- **Para responder "o que vem depois?"** — usar isto como referência, mas
  sempre lembrando que prioridade real está no contrato ativo.
- **Para sugerir nova PR técnica fora do contrato** — usar isto para
  identificar se a sugestão já foi parqueada como candidata e por quê.
- **Para evitar escopo creep** — se um pedido cair em um destes itens e
  não estiver no contrato ativo, recusar (educadamente) e apontar para
  esta lista.

---

## 4. Backlinks

- → schema/contracts/INDEX.md
- → schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
- → schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md
- → brain/contracts/active.md
- → brain/open-questions/strategic-questions.md
- → brain/memories/hard-rules.md
