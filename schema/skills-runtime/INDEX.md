# ENAVIA — Runtime de Skills: Blueprint Documental

**Versão:** 0.1 — Blueprint
**Data:** 2026-05-02 (PR65)
**Estado:** Documental — nenhum runtime implementado
**Tipo:** PR-DOCS — sem alteração de runtime

---

## 1. O que é o Runtime de Skills

O **Runtime de Skills** é o conjunto de componentes de software que permitirá à Enavia executar skills de forma controlada, auditada e com aprovação humana.

**Status atual:** NÃO EXISTE. Esta pasta documenta o que o Runtime de Skills deverá ser futuramente.

---

## 2. Estado atual das skills

Todas as 4 skills documentadas continuam **documentais e read-only**:

| Skill | Estado atual | Execução possível? |
|-------|-------------|-------------------|
| `CONTRACT_LOOP_OPERATOR` | Documental 📄 | ❌ Não — sem runtime |
| `DEPLOY_GOVERNANCE_OPERATOR` | Documental 📄 | ❌ Não — sem runtime |
| `SYSTEM_MAPPER` | Documental 📄 | ❌ Não — sem runtime |
| `CONTRACT_AUDITOR` | Documental 📄 | ❌ Não — sem runtime |

---

## 3. O que NÃO existe ainda

| Item | Estado |
|------|--------|
| `/skills/run` | ❌ Endpoint não criado |
| `/skills/propose` | ❌ Endpoint não criado |
| `/skills/approve` | ❌ Endpoint não criado |
| `/skills/status` | ❌ Endpoint não criado |
| Skill Executor | ❌ Módulo não implementado |
| Execução de skill | ❌ Nenhuma skill executa |
| Runtime de Skills | ❌ Não existe |

---

## 4. Relação com módulos existentes

| Módulo existente | Localização | Papel no futuro Runtime |
|-----------------|-------------|------------------------|
| Intent Classifier | `schema/enavia-intent-classifier.js` | Detecta intenção — porta de entrada do fluxo |
| Skill Router | `schema/enavia-skill-router.js` | Roteia para a skill correta (já faz isso — read-only) |
| Intent Retrieval | `schema/enavia-intent-retrieval.js` | Fornece contexto da skill por intenção |
| Self-Audit | `schema/enavia-self-audit.js` | Auditará a execução (já detecta riscos — read-only) |
| Response Policy | `schema/enavia-response-policy.js` | Governará a resposta pós-execução |
| Governança humana | Contrato + INDEX.md + handoff | Gate de aprovação antes de qualquer execução |

---

## 5. Arquivos deste blueprint

| Arquivo | Conteúdo |
|---------|----------|
| `INDEX.md` | Este arquivo — visão geral e estado |
| `ARCHITECTURE.md` | Arquitetura alvo do Runtime de Skills |
| `EXECUTION_CONTRACT.md` | Contrato de execução (formato JSON + regras) |
| `APPROVAL_GATES.md` | Gates de aprovação humana |
| `SKILL_CAPABILITY_MATRIX.md` | Matriz de capacidades das 4 skills |
| `SECURITY_MODEL.md` | Modelo de segurança |
| `ROLLOUT_PLAN.md` | Fases de rollout futuro |
| `OPEN_QUESTIONS.md` | Perguntas abertas para PR66 diagnosticar |

---

## 6. Próximos passos

1. **PR65** (esta PR) — Blueprint documental ← ATUAL
2. **PR66** — PR-DIAG — Diagnóstico técnico (onde vive o runtime, bindings necessários, riscos)
3. **PR67+** — PR-IMPL — Implementação das primeiras fases do runtime

---

## 7. Aviso importante

> Este blueprint documenta intenção arquitetural futura.
> Nenhum dos endpoints ou módulos descritos aqui existe no código.
> Nenhuma skill executa automaticamente.
> Toda implementação futura exige PR-DIAG + PR-IMPL + PR-PROVA aprovadas pelo operador humano.
