# PR65 — Blueprint do Runtime de Skills

**Data:** 2026-05-02
**Tipo:** PR-DOCS (documentação/governança — sem alteração de runtime)
**Branch:** `copilot/claudepr65-docs-blueprint-runtime-skills`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR64 ✅ (PR-DOCS — Encerrar frente de atualização supervisionada e liberar Blueprint Runtime de Skills)

---

## 1. Objetivo

Criar o blueprint documental do Runtime de Skills da Enavia.

Definir, com clareza, como o Runtime de Skills deve funcionar futuramente:
- arquitetura e fluxo de execução
- contrato de execução (formato JSON + regras)
- gates de aprovação humana
- matriz de capacidades das 4 skills existentes
- modelo de segurança
- plano de rollout por fases
- perguntas abertas para diagnóstico futuro (PR66)

Esta PR NÃO implementou nenhum runtime. NÃO criou nenhum endpoint. NÃO alterou nenhum módulo de runtime.

---

## 2. Base analisada

| Arquivo analisado | O que contribuiu |
|------------------|-----------------|
| `schema/enavia-intent-classifier.js` | Camada 1 do fluxo — classificação de intenção |
| `schema/enavia-skill-router.js` | Camada 2 — roteamento de skill |
| `schema/enavia-intent-retrieval.js` | Camada 3 — contexto da skill |
| `schema/enavia-self-audit.js` | Camada 7 — auditoria de execução |
| `schema/enavia-response-policy.js` | Camada 8 — política de resposta |
| `schema/skills/INDEX.md` | Estado atual das 4 skills documentais |
| `schema/skills/CONTRACT_LOOP_OPERATOR.md` | Skill 1 — capacidade documental |
| `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` | Skill 2 — capacidade documental |
| `schema/skills/SYSTEM_MAPPER.md` | Skill 3 — capacidade documental |
| `schema/skills/CONTRACT_AUDITOR.md` | Skill 4 — capacidade documental |
| `schema/brain/SYSTEM_AWARENESS.md` | Estado do sistema e módulos inexistentes |
| `schema/brain/open-questions/unresolved-technical-gaps.md` | G1 e G2 (Skill Executor + /skills/run) |
| `schema/brain/learnings/future-risks.md` | R1-R9 — riscos a mitigar |
| `schema/reports/PR64_ENCERRAR_MEMORIA_LIBERAR_SKILLS.md` | Decisão: liberar Blueprint Runtime de Skills |
| `schema/reports/PR63_DIAG_ATUALIZACAO_SUPERVISIONADA_MEMORIA.md` | Diagnóstico: G3 on-hold, não blocking |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Estado da frente: PR65 era a próxima autorizada |
| `schema/contracts/INDEX.md` | Contrato ativo e PR65 como próxima |

---

## 3. Arquivos criados

### Pasta nova: `schema/skills-runtime/`

| Arquivo | Conteúdo | Tamanho aproximado |
|---------|----------|-------------------|
| `schema/skills-runtime/INDEX.md` | Visão geral, estado atual, relação com módulos | ✅ |
| `schema/skills-runtime/ARCHITECTURE.md` | Fluxo alvo, 11 camadas, diagrama, princípios | ✅ |
| `schema/skills-runtime/EXECUTION_CONTRACT.md` | Formato JSON, modos, ciclo de vida, regras, integração | ✅ |
| `schema/skills-runtime/APPROVAL_GATES.md` | 3 categorias, matriz de aprovação, gate absoluto | ✅ |
| `schema/skills-runtime/SKILL_CAPABILITY_MATRIX.md` | Matriz das 4 skills — estado + capacidade futura | ✅ |
| `schema/skills-runtime/SECURITY_MODEL.md` | 7 categorias de risco, allowlist, deny-by-default | ✅ |
| `schema/skills-runtime/ROLLOUT_PLAN.md` | 7 fases (Fase 0 a 6), critérios de avanço | ✅ |
| `schema/skills-runtime/OPEN_QUESTIONS.md` | 12 perguntas para PR66 diagnosticar | ✅ |

### Relatório

| Arquivo | Conteúdo |
|---------|----------|
| `schema/reports/PR65_BLUEPRINT_RUNTIME_SKILLS.md` | Este arquivo — relatório completo da PR65 |

---

## 4. Arquitetura proposta

**Fluxo alvo:**

```
mensagem → [1] intent classification → [2] skill routing → [3] context retrieval
→ [4] execution proposal → [5] human approval gate → [6] controlled execution
→ [7] evidence collection → [8] self-audit → [9] response policy → [10] reply
→ [11] log → [12] (futuro) memory proposal
```

**Camadas existentes (✅ já implementadas):**
- Camada 1: `enavia-intent-classifier.js` — 15 intenções canônicas
- Camada 2: `enavia-skill-router.js` — roteamento read-only para 4 skills
- Camada 3: `enavia-intent-retrieval.js` — contexto da skill por intenção
- Camada 8: `enavia-self-audit.js` — auditoria de 10 categorias
- Camada 9: `enavia-response-policy.js` — 15 regras de resposta

**Camadas inexistentes (❌ a implementar em PRs futuras):**
- Camada 4: Skill Executor (proposal) — `enavia-skill-executor.js` não existe
- Camada 5: Approval Gate — mecanismo não existe
- Camada 6: Execução controlada — não existe
- Camada 7: Coleta de evidência — não existe
- Camada 10/11: Log + storage — parcialmente existe como documental

---

## 5. Contrato de execução

Definido em `schema/skills-runtime/EXECUTION_CONTRACT.md`.

**Modos de execução:**

| Modo | Descrição | Aprovação humana |
|------|-----------|-----------------|
| `read_only` | Acessa docs e contexto, sem efeito externo | Recomendada |
| `proposal` | Gera proposta, não executa | Obrigatória para executar |
| `approved_execution` | Executa com efeito externo | Obrigatória e explícita |

**Campos obrigatórios:**
- `request_id` (UUID único)
- `skill_id` (do allowlist)
- `mode` (declarado explicitamente)
- `execution.evidence` (ao menos 1 item)
- `audit.self_audit_result` (obrigatório antes de retornar)

---

## 6. Gates de aprovação

Definido em `schema/skills-runtime/APPROVAL_GATES.md`.

**Categoria A — Sempre exige aprovação humana:**
deploy, rollback, alteração de Worker, criação de endpoint, escrita de memória, alteração de contrato, merge/promoção, qualquer ação irreversível.

**Categoria B — Pode ser proposta sem executar:**
revisar PR, sugerir próxima PR, gerar prompt, mapear sistema, auditar contrato, planejar deploy.

**Categoria C — Read-only, mas com evidência:**
leitura de docs, análise de relatórios, inspeção de diff, diagnóstico sem alteração.

---

## 7. Matriz de capacidades

Definido em `schema/skills-runtime/SKILL_CAPABILITY_MATRIX.md`.

| Skill | Estado atual | Modo mais seguro | Prioridade |
|-------|-------------|-----------------|-----------|
| `CONTRACT_AUDITOR` | Documental 📄 | read_only | Alta |
| `CONTRACT_LOOP_OPERATOR` | Documental 📄 | read_only | Alta |
| `SYSTEM_MAPPER` | Documental 📄 | read_only | Média |
| `DEPLOY_GOVERNANCE_OPERATOR` | Documental 📄 | read_only (checklist) | Baixa (alto risco) |

---

## 8. Modelo de segurança

Definido em `schema/skills-runtime/SECURITY_MODEL.md`.

**7 categorias de risco:** `read_only`, `repo_write`, `deploy`, `external_side_effect`, `memory_write`, `secret_sensitive`, `irreversible_action`

**Regras:**
- Least privilege
- Deny by default (allowlist: 4 skills)
- Approval obrigatória para efeito externo
- Secrets nunca em output/log
- Self-Audit obrigatório antes de retornar
- Evidence obrigatória por execução

---

## 9. Rollout futuro

Definido em `schema/skills-runtime/ROLLOUT_PLAN.md`.

| Fase | PR prevista | Tipo | O que entrega |
|------|------------|------|---------------|
| Fase 0 — Blueprint | PR65 | PR-DOCS | Esta PR ✅ |
| Fase 1 — Diagnóstico | PR66 | PR-DIAG | Onde vive runtime, bindings, riscos |
| Fase 2 — Runtime proposal | PR67+ | PR-IMPL | `/skills/propose` — proposta sem execução |
| Fase 3 — Endpoint controlado | PR68+ | PR-IMPL | Mecanismo de aprovação humana |
| Fase 4 — Aprovação | PR69+ | PR-IMPL | Fluxo propose → approve → execute (limitado) |
| Fase 5 — Execução read-only | PR70+ | PR-IMPL | Skills sem side-effect |
| Fase 6 — Execução com side-effect | PR71+ | PR-IMPL | Deploy, escrita, ações externas |

> **Atenção:** `/skills/run` direto não deve ser o primeiro endpoint. O primeiro deve ser `/skills/propose`.

---

## 10. Open questions para PR66

Definido em `schema/skills-runtime/OPEN_QUESTIONS.md`.

12 perguntas identificadas:

1. Onde o runtime deve viver? (Worker principal ou separado?)
2. Primeiro endpoint: `/skills/propose` em vez de `/skills/run`?
3. Como aprovar execução?
4. Onde registrar execuções? (qual storage?)
5. Quais bindings são necessários?
6. Como relacionar execução com Self-Audit?
7. Como evitar falsa capacidade?
8. Como proteger secrets no pipeline de execução?
9. Como testar sem executar ação real?
10. O `contract-executor.js` deve ser reutilizado?
11. Risco de confusão entre Skill Executor e Contract Executor?
12. Há conflitos de rota com o Route Registry?

---

## 11. O que NÃO foi implementado

| Item | Estado |
|------|--------|
| Runtime de Skills | ❌ Não implementado — blueprint apenas |
| `/skills/run` | ❌ Não criado |
| `/skills/propose` | ❌ Não criado |
| `/skills/approve` | ❌ Não criado |
| `/skills/status` | ❌ Não criado |
| Skill Executor | ❌ Não implementado |
| Execução de skill | ❌ Nenhuma skill executa |
| Mecanismo de aprovação | ❌ Não implementado |
| Log de execução runtime | ❌ Não implementado |
| Storage de execuções | ❌ Não criado |
| `nv-enavia.js` | ✅ Não alterado |
| `schema/enavia-*.js` | ✅ Nenhum alterado |
| Panel | ✅ Não alterado |
| Executor | ✅ Não alterado |
| Deploy Worker | ✅ Não alterado |
| Workflows | ✅ Não alterados |
| wrangler.toml | ✅ Não alterado |
| KV/bindings/secrets | ✅ Não alterados |
| Finding I1 | ✅ Não corrigido (baixo impacto — PR futura dedicada) |

---

## 12. Próxima PR recomendada

### Se blueprint estiver completo (critérios de aceite satisfeitos):

**PR66 — PR-DIAG — Diagnóstico técnico para Runtime de Skills**

**Objetivo:**
Responder as 12 perguntas abertas do `schema/skills-runtime/OPEN_QUESTIONS.md` com evidência do repositório.

**Escopo:**
- Ler `nv-enavia.js`, `wrangler.toml`, `contract-executor.js`, `ENAVIA_ROUTE_REGISTRY.json`, `ENAVIA_WORKER_REGISTRY.md`
- Diagnosticar onde o runtime deve viver
- Identificar bindings necessários
- Propor decisão sobre primeiro endpoint (`/skills/propose`)
- Criar relatório `schema/reports/PR66_DIAG_RUNTIME_SKILLS.md`
- Não implementar nada — apenas diagnosticar

**Pré-requisito:** PR65 ✅ (esta PR)

---

## Verificações finais

| Verificação | Resultado |
|-------------|-----------|
| `schema/skills-runtime/` criada | ✅ |
| 8 arquivos obrigatórios criados | ✅ |
| Nenhum `.js` alterado | ✅ |
| Nenhum `.toml` alterado | ✅ |
| Nenhum `.yml` alterado | ✅ |
| Nenhum endpoint criado | ✅ |
| `/skills/run` não criado | ✅ |
| Governança atualizada | ✅ |
| PR66 definida | ✅ |
