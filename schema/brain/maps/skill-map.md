# Brain Map — Skills documentais (visão navegável)

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Resumo navegável — fonte: `schema/skills/INDEX.md` + arquivos individuais

---

## 1. Estado das skills hoje

| Skill | Arquivo | Status | Origem |
|-------|---------|--------|--------|
| Contract Loop Operator | `schema/skills/CONTRACT_LOOP_OPERATOR.md` | Ativa — **documental** 🟢 | PR26 |
| Deploy Governance Operator | `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` | Ativa — **documental** 🟢 | PR27 |
| System Mapper | `schema/skills/SYSTEM_MAPPER.md` | Ativa — **documental** 🟢 | PR28 |
| Contract Auditor | `schema/skills/CONTRACT_AUDITOR.md` | Ativa — **documental** 🟢 | PR29 |

> **Documental ≠ runtime.** Toda skill é hoje um documento operacional que
> orienta a Enavia (e o operador humano via Claude/Copilot). **Não existe
> `/skills/run` nem runtime de skills nesta versão.** Conexão a runtime
> dependerá de contrato futuro aprovado pelo operador.

---

## 2. Quando usar cada skill

### 2.1 — Contract Loop Operator

- **Domínio:** loop contratual supervisionado (PR sequencial, tasks, fases).
- **Use quando:** for executar `execute-next → complete-task → advance-phase`,
  identificar a próxima PR autorizada, validar que a PR anterior foi mergeada,
  ou atualizar status / handoff / execution log.
- **Não faz:** não executa código de runtime, não decide arquitetura, não
  aprova deploy.

### 2.2 — Deploy Governance Operator

- **Domínio:** deploy, audit, apply-test, promoção PROD, rollback.
- **Use quando:** for tocar workers (`nv-enavia`, `enavia-executor`, `deploy-worker`)
  ou bindings/KV; antes de qualquer apply-test ou rollback; quando precisar
  passar pelo gate de execução.
- **Não faz:** não substitui a aprovação humana; não documenta valor de secret;
  não promove PROD sem aprovação explícita do operador.

### 2.3 — System Mapper

- **Domínio:** manutenção do System Map, Route Registry, Worker Registry,
  Operational Playbook e Skills Index.
- **Use quando:** for adicionar / mover / remover rota, worker, binding ou
  endpoint; quando documentação de sistema estiver inconsistente; antes de
  propor mudança que altere mapa de infraestrutura.
- **Não faz:** não executa deploy; não cria skill nova sozinho.

### 2.4 — Contract Auditor

- **Domínio:** auditoria de aderência contratual de PRs, tarefas e execuções.
- **Use quando:** for revisar PR (escopo, tipo `PR-DOCS / PR-DIAG / PR-IMPL / PR-PROVA`,
  PR anterior obrigatória, governança atualizada, runtime preservado); quando
  houver suspeita de PR fora de escopo; antes de fechar uma frente.
- **Não faz:** não aprova merge; não substitui revisor humano; não cria PR.

---

## 3. Como a Enavia deve escolher skill

| Intenção | Skill |
|----------|-------|
| Revisão de PR / aderência contratual / "essa PR está dentro do contrato?" | **Contract Auditor** |
| Deploy / rollback / apply-test / promoção PROD | **Deploy Governance Operator** |
| Mapas / registries / sistema / "essa rota existe?" / "esse worker faz isso?" | **System Mapper** |
| Loop contratual / próxima PR / advance-phase / loop-status | **Contract Loop Operator** |

> Se a intenção não cair em nenhuma das quatro, **a skill correta é "nenhuma"** —
> a Enavia raciocina diretamente, sem invocar skill, e registra como possível
> candidata futura em `brain/contracts/next-candidates.md`.

---

## 4. O que cada skill **não faz** (resumo defensivo)

- Nenhuma skill **executa runtime** sozinha.
- Nenhuma skill **substitui aprovação humana**.
- Nenhuma skill **inventa rota, worker, binding, secret ou contrato**.
- Nenhuma skill **escreve em produção** sem passar por Deploy Governance Operator + gate.
- Nenhuma skill **fecha PR** sem governança atualizada (status / handoff /
  execution log / INDEX).

---

## 5. O que ainda não existe

- **Runtime de skills.** Não há endpoint `/skills/run`, não há router automático,
  não há LLM Core que selecione skill por intenção. Tudo isso é candidato
  futuro (ver `brain/contracts/next-candidates.md`).
- **UI de skills no painel.** Não existe.
- **Skill Executor.** Não existe.
- **Auditoria automática de PR.** Hoje a Contract Auditor é checklist
  documental — não há automação que falhe um merge por skill.

---

## 6. Backlinks

- → schema/skills/INDEX.md
- → schema/skills/CONTRACT_LOOP_OPERATOR.md
- → schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md
- → schema/skills/SYSTEM_MAPPER.md
- → schema/skills/CONTRACT_AUDITOR.md
- → brain/contracts/next-candidates.md
- → brain/self-model/capabilities.md
- → brain/SYSTEM_AWARENESS.md
