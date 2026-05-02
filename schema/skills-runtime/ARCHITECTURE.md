# ENAVIA — Runtime de Skills: Arquitetura

**Versão:** 0.1 — Blueprint
**Data:** 2026-05-02 (PR65)
**Estado:** Documental — nenhum runtime implementado

---

## 1. Princípio fundamental

> O Runtime de Skills não é autonomia cega. Toda skill com efeito externo exige aprovação humana. Skills read-only podem ter regras mais leves, mas ainda precisam de evidência. Nada executa sem contrato.

---

## 2. Fluxo alvo

```
mensagem do usuário
        │
        ▼
[1] Classificação de Intenção
        │  (enavia-intent-classifier.js — já existe)
        ▼
[2] Roteamento de Skill
        │  (enavia-skill-router.js — já existe, read-only)
        ▼
[3] Recuperação de Contexto
        │  (enavia-intent-retrieval.js — já existe)
        ▼
[4] Proposta de Execução
        │  (Skill Executor — NÃO existe ainda)
        ▼
[5] Gate de Aprovação Humana
        │  (mecanismo de aprovação — NÃO existe ainda)
        ▼
[6] Execução Controlada
        │  (Skill Executor com modo aprovado — NÃO existe ainda)
        ▼
[7] Coleta de Evidência
        │  (log + resultado — NÃO existe ainda)
        ▼
[8] Auditoria
        │  (enavia-self-audit.js — já existe, read-only)
        ▼
[9] Response Policy
        │  (enavia-response-policy.js — já existe)
        ▼
[10] Resposta final ao usuário
        │
        ▼
[11] Registro/Log obrigatório
        │  (execution log — parcialmente existe em schema)
        ▼
[12] (futuro) Proposta de memória
        │  (memória supervisionada — on-hold, G3)
```

---

## 3. Camadas do Runtime

### Camada 1 — Classificação de Intenção

**Módulo:** `schema/enavia-intent-classifier.js`
**Estado:** ✅ Existe e está ativo
**Papel:** Detectar se a mensagem é operacional ou conversacional, identificar a intenção (15 intenções canônicas)
**O que precisa evoluir:** Finding I1 (variantes com advérbio) — PR futura dedicada

---

### Camada 2 — Roteamento de Skill

**Módulo:** `schema/enavia-skill-router.js`
**Estado:** ✅ Existe e está ativo (read-only)
**Papel:** Mapear intenção → skill correta (4 skills documentais)
**O que precisa evoluir:** Conectar ao Skill Executor quando runtime existir

---

### Camada 3 — Proposta de Execução

**Módulo:** `schema/enavia-skill-executor.js` ← **NÃO EXISTE**
**Estado:** ❌ Não implementado
**Papel futuro:**
- Receber skill_id + inputs
- Validar que skill_id está no allowlist
- Construir proposta de execução (sem executar ainda)
- Verificar se aprovação humana é necessária
- Retornar `SkillExecutionProposal`

---

### Camada 4 — Gate de Aprovação Humana

**Mecanismo:** A definir em PR66 (onde viverá, como funcionará)
**Estado:** ❌ Não implementado
**Papel futuro:**
- Receber `SkillExecutionProposal`
- Classificar risco (low / medium / high / blocking)
- Se risco > low: reter e aguardar aprovação humana explícita
- Se risco = low: pode avançar para execução com registro
- Nunca aprovar automaticamente ação irreversível

---

### Camada 5 — Execução Controlada

**Módulo:** Parte do `schema/enavia-skill-executor.js` ← **NÃO EXISTE**
**Estado:** ❌ Não implementado
**Papel futuro:**
- Executar apenas se `approval.status === 'approved'` ou risco `low` permitido
- Execução restrita ao escopo da skill
- Timeout obrigatório
- Sem acesso a recursos não declarados no contrato de execução

---

### Camada 6 — Coleta de Evidência

**Estado:** ❌ Não implementado
**Papel futuro:**
- Registrar: skill_id, inputs, outputs, timestamp, duração
- Registrar: quem aprovou (human|auto), quando aprovou
- Armazenar em log imutável
- Evidência mínima obrigatória antes de prosseguir

---

### Camada 7 — Auditoria

**Módulo:** `schema/enavia-self-audit.js`
**Estado:** ✅ Existe e está ativo (read-only)
**Papel:** Detectar riscos pós-execução (secret_exposure, false_capability, etc.)
**O que precisa evoluir:** Integrar evidência de execução como input do audit

---

### Camada 8 — Response Policy

**Módulo:** `schema/enavia-response-policy.js`
**Estado:** ✅ Existe e está ativo
**Papel:** Garantir que a resposta ao usuário é honesta, segura e dentro do escopo

---

### Camada 9 — Resposta Final

**Módulo:** `nv-enavia.js` — já existe
**O que precisa evoluir:** Incluir campo `skill_execution` no response quando runtime existir

---

### Camada 10 — Registro/Log

**Estado:** Parcialmente existe (schema documental)
**O que precisa evoluir:** Log persistente de execuções de skills (storage a definir em PR66)

---

### Camada 11 (futuro) — Proposta de Memória

**Estado:** on-hold (G3)
**Papel futuro:** Skills que geram conteúdo relevante podem propor atualização de memória
**Restrição:** Só faz sentido após Runtime de Skills existir e skills estarem executando

---

## 4. Diagrama de módulos

```
Existente (ativo)          Existente (documental)     Não existe
─────────────────          ──────────────────────     ──────────
intent-classifier.js  ──►  skills/INDEX.md        ──► skill-executor.js
skill-router.js       ──►  skills/CONTRACT_*.md   ──► /skills/propose
intent-retrieval.js        skills/DEPLOY_*.md         /skills/run
self-audit.js              skills/SYSTEM_*.md          /skills/approve
response-policy.js         skills/CONTRACT_A*.md       approval-gate
brain-loader.js            skills-runtime/*.md         execution-log
llm-core.js                                            memory-write
```

---

## 5. Princípios arquiteturais

| Princípio | Descrição |
|-----------|-----------|
| Propose, don't execute | Primeiro proposta, depois execução (após aprovação) |
| Human in the loop | Todo efeito externo exige humano no gate |
| Evidence first | Sem evidência, sem avançar |
| Deny by default | Se skill_id desconhecida: nega |
| Least privilege | Skill só acessa o que declarou precisar |
| Audit trail | Toda execução deve ser auditável |
| Rollback mandatory | Toda ação com efeito externo deve ter rollback definido |

---

## 6. O que este blueprint NÃO implementa

- Não cria `schema/enavia-skill-executor.js`
- Não cria `/skills/run`
- Não cria `/skills/propose`
- Não cria `/skills/approve`
- Não cria `/skills/status`
- Não altera nenhum módulo de runtime
- Não altera nenhum endpoint existente
