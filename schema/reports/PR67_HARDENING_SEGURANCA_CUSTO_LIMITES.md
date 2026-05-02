# PR67 — Hardening: Segurança, Custo e Limites

**Tipo:** PR-HARDENING (documental/governança)
**Data:** 2026-05-02
**Branch:** `copilot/claudepr67-hardening-seguranca-custo-limites`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR66 ✅ (PR-DIAG — Diagnóstico técnico do Runtime de Skills)

---

## 1. Objetivo

Executar a etapa contratual de hardening prevista após o Blueprint (PR65) e o Diagnóstico técnico (PR66) do Runtime de Skills.

Esta PR consolida:
- Segurança (deny-by-default, allowlist, gates)
- Custo e limites operacionais
- Blast radius por nível de impacto
- Rollback policy por tipo de artefato
- Go/No-Go checklist antes de qualquer implementação futura
- Atualização dos documentos existentes com referências ao hardening

**Esta PR NÃO implementa runtime. Nenhum endpoint criado. Nenhum código alterado.**

---

## 2. Base analisada

| Arquivo | Conteúdo relevante |
|---------|-------------------|
| `schema/skills-runtime/SECURITY_MODEL.md` | Modelo de segurança v0.1 (blueprint) |
| `schema/skills-runtime/APPROVAL_GATES.md` | Gates de aprovação humana |
| `schema/skills-runtime/ROLLOUT_PLAN.md` | Plano de rollout por fases |
| `schema/reports/PR65_BLUEPRINT_RUNTIME_SKILLS.md` | Blueprint completo do Runtime |
| `schema/reports/PR66_DIAG_RUNTIME_SKILLS.md` | 12 respostas técnicas com evidência |
| `schema/brain/learnings/future-risks.md` | Riscos R1–R13 identificados |
| `schema/brain/open-questions/unresolved-technical-gaps.md` | G1–G7 lacunas técnicas |
| `schema/brain/SYSTEM_AWARENESS.md` | Estado atual do sistema |

**Decisões relevantes do PR66 incorporadas:**
- Opção C: runtime vive em `schema/enavia-skill-executor.js` (módulo interno)
- Primeiro endpoint: `/skills/propose` (não `/skills/run`)
- Zero bindings novos na fase proposal-only
- `contract-executor.js` como referência, não herança
- `runEnaviaSelfAudit()` integrável sem breaking change

---

## 3. Pacote de hardening criado

### Arquivos criados em `schema/hardening/`

| Arquivo | Conteúdo |
|---------|----------|
| `INDEX.md` | Visão geral, contexto, índice e como usar o pacote |
| `SKILLS_RUNTIME_HARDENING.md` | Segurança completa: D1–D10 deny-by-default, allowlist, aprovação humana, proteção de secrets, escrita KV, Self-Audit, Response Policy, evidência |
| `COST_LIMITS.md` | Riscos C1–C5, limites por request/tempo/LLM/KV, recomendações para fase proposal-only, política anti-gasto-invisível |
| `BLAST_RADIUS.md` | Níveis 0–4 com exemplos, gates mínimos, matriz por skill, regras de contenção B1–B7 |
| `ROLLBACK_POLICY.md` | Rollback por tipo de artefato, regra de PR-PROVA com falha, quando parar, escalonamento |
| `GO_NO_GO_CHECKLIST.md` | Checklist completo: contrato (C1–C7), segurança (S1–S10), custo (L1–L7), blast radius (BR1–BR5), testes (T1–T5) |

---

## 4. Segurança

### 4.1 Deny-by-default

10 regras absolutas definidas (D1–D10):

| Regra | Condição bloqueante |
|-------|-------------------|
| D1 | `skill_id` não está no allowlist |
| D2 | `mode` inválido ou não declarado |
| D3 | `approval.status !== 'approved'` para `approved_execution` |
| D4 | `safety.risk_level === 'blocking'` |
| D5 | Self-Audit detecta `secret_exposure` |
| D6 | `execution.evidence` vazia |
| D7 | Runtime não reconhece tipo de execução |
| D8 | `/skills/run` chamado antes de `/skills/propose` existir |
| D9 | Endpoint novo sem PR-DIAG + PR-IMPL + PR-PROVA |
| D10 | Self-Audit bloqueante impede avanço em PR futura |

### 4.2 Allowlist de skills

```json
{
  "skill_allowlist": [
    "CONTRACT_LOOP_OPERATOR",
    "DEPLOY_GOVERNANCE_OPERATOR",
    "SYSTEM_MAPPER",
    "CONTRACT_AUDITOR"
  ]
}
```

### 4.3 Sequência obrigatória de endpoints

```
1. Nenhum endpoint existe agora
2. /skills/propose  ← primeiro (proposta sem execução)
3. /skills/approve  ← após gate implementado e validado
4. /skills/run      ← SOMENTE Fase 5 (PR73+)
```

### 4.4 Aprovação humana

Documentada para 13 tipos de ação. Sem aprovação automática. Sem auto-aprovação. Sem timeout como aprovação.

---

## 5. Custo e limites

### 5.1 Riscos de custo identificados

| Risco | Causa | Mitigação |
|-------|-------|-----------|
| C1 — Prompt bloat | Contexto de skills acumulado sem truncamento | Limite de payload + truncamento |
| C2 — Loops de execução | Recursão sem profundidade máxima | `max_retries = 0`, profundidade = 1 |
| C3 — LLM invisível | LLM extra não declarado dentro do executor | Sem LLM extra na fase proposal-only |
| C4 — Logs escalando | Evidência por request sem política de retenção | Sem persistência obrigatória na fase inicial |
| C5 — Gasto por request | Módulos implícitos não declarados | Todo módulo declarado no contrato |

### 5.2 Limites recomendados para fase proposal-only

| Limite | Valor |
|--------|-------|
| `max_skill_proposals_per_request` | **1** |
| `max_retries` | **0** |
| `max_execution_depth` | **1** |
| `max_payload_size_chars` | **4.000** |
| `max_context_per_skill_chars` | **2.000** |
| `max_proposal_generation_ms` | **3.000** |
| `max_total_execution_ms` | **5.000** |
| LLM extra no Skill Executor | **❌ Proibido** |
| Chamadas externas na proposta | **❌ Proibidas** |
| Escrita em KV na fase proposal | **❌ Proibida** |

---

## 6. Blast radius

### Níveis definidos

| Nível | Nome | Exemplos | Gate mínimo |
|-------|------|----------|-------------|
| 0 | Sem side effect | Gerar proposta, classificar intenção, Self-Audit | Allowlist + Self-Audit + Evidence |
| 1 | Leitura | Ler docs, ler status, ler registry | Allowlist + Self-Audit + Evidence + filtro de secrets |
| 2 | Escrita documental | Criar/alterar arquivos via PR, atualizar contrato | Aprovação humana (merge) + diff + rollback |
| 3 | Ação operacional | Deploy TEST, rollback TEST, acionar executor TEST | Gate completo: aprovação + checklist + smoke + health check + rollback testado |
| 4 | Produção/sensível | Deploy PROD, secrets, KV PROD, endpoints públicos | Gate completo nível 3 + janela manutenção + log retido + notificação antes e depois |

### Estado atual

**Nível máximo atual: 0.** Runtime completamente documental. Nenhuma skill executa.

### Regras de contenção (B1–B7)

Destacando as mais importantes:
- B4: Escalação de nível só com contrato explícito
- B6: Transição de nível 2 para 3 exige nova PR-DIAG
- B7: Fase proposal-only limitada a níveis 0 e 1

---

## 7. Rollback policy

### Políticas definidas por artefato

| Artefato | Rollback | Risco |
|----------|----------|-------|
| PR documental | `git revert <SHA>` | Baixo |
| Módulo proposal-only | `git revert <SHA>` + smoke tests | Baixo |
| Endpoint `/skills/propose` | `git revert <SHA>` + deploy | Médio |
| Gate de aprovação | `git revert <SHA>` + deploy | Médio |
| Execução read-only (Fase 5) | Feature flag ou revert + deploy | Médio-alto |
| Execução com side effect (Fase 6) | Emergência — parar imediatamente | Alto |

### Regra de PR-PROVA com falha

> PR-PROVA que falhar → documentar finding → abrir PR-IMPL cirúrgica separada.
> Nunca corrigir dentro da PR-PROVA.

**Exemplo histórico:** PR57 falhou → PR58 corrigiu cirurgicamente.

---

## 8. Go/No-Go checklist

Checklist criado em `schema/hardening/GO_NO_GO_CHECKLIST.md` com 5 categorias e 32 critérios:

| Categoria | Critérios |
|-----------|-----------|
| Contrato e governança | C1–C7 (7 itens) |
| Segurança | S1–S10 (10 itens) |
| Custo e limites | L1–L7 (7 itens) |
| Blast radius e rollback | BR1–BR5 (5 itens) |
| Teste e prova | T1–T5 (5 itens) |

**Uso obrigatório:** Antes de qualquer PR-IMPL futura de runtime, copiar e preencher este checklist no corpo da PR.

---

## 9. Atualizações em documentos existentes

### 9.1 `schema/skills-runtime/SECURITY_MODEL.md`

Adicionada seção 10 referenciando o pacote de hardening e reforçando:
- Deny-by-default com regras D1–D10
- `/skills/run` não permitido antes de `/skills/propose`
- Pacote `schema/hardening/` como fonte de verdade para hardening

### 9.2 `schema/skills-runtime/ROLLOUT_PLAN.md`

Adicionada seção de gate de hardening entre Fase 1 e Fase 2:
- PR67 hardening deve estar concluído antes de qualquer PR-IMPL de runtime
- Checklist de go/no-go obrigatório
- Limites de custo devem ser implementados junto com o módulo

### 9.3 `schema/brain/learnings/future-risks.md`

Adicionados riscos R14–R17:
- R14 — Custo invisível de runtime
- R15 — Loop de execução sem profundidade
- R16 — Blast radius subestimado
- R17 — Over-automation (automação antes de governança)

### 9.4 `schema/brain/SYSTEM_AWARENESS.md`

Adicionada seção 10 registrando estado pós-PR67:
- Hardening criado ✅
- Runtime de Skills ainda não existe ❌
- `/skills/propose` ainda não existe ❌
- `/skills/run` ainda não existe ❌
- Próxima PR: PR68

---

## 10. O que NÃO foi implementado

| Item | Estado |
|------|--------|
| Runtime de Skills | ❌ Não implementado |
| Skill Executor | ❌ Não criado — `schema/enavia-skill-executor.js` não existe |
| `/skills/propose` | ❌ Não criado — endpoint não existe |
| `/skills/run` | ❌ Não criado — endpoint não existe |
| Nenhum endpoint criado | ✅ Confirmado |
| Nenhum runtime alterado | ✅ Confirmado |
| `nv-enavia.js` | ✅ Não alterado |
| `contract-executor.js` | ✅ Não alterado |
| `wrangler.toml` | ✅ Não alterado |
| `schema/enavia-*.js` | ✅ Nenhum alterado |
| Bindings/secrets | ✅ Não alterados |
| KV | ✅ Não alterado |
| Testes | ✅ Não alterados |
| Panel | ✅ Não alterado |
| Executor | ✅ Não alterado |
| Deploy Worker | ✅ Não alterado |
| Workflows | ✅ Não alterados |
| Finding I1 | ✅ Não corrigido (conforme escopo) |
| Escrita de memória | ✅ Não implementada (G3 on-hold) |

---

## 11. Próxima PR recomendada

### Se hardening estiver completo (critério de aceite satisfeito)

**PR68 — PR-DOCS/PR-PROVA — Fechamento do Jarvis Brain v1**

Objetivo: formalizar o fechamento da fase Jarvis Brain com:
- Validação de que todos os artefatos do ciclo estão consistentes
- Documentação do estado final do sistema
- Memória consolidada do ciclo PR61–PR67
- Preparação para próximo contrato

### Se hardening estiver incompleto

**PR68 — PR-HARDENING — Completar segurança, custo e limites**

---

## Verificações

```
git diff --name-only HEAD~1
```

**Arquivos criados/alterados nesta PR:**
- `schema/hardening/INDEX.md` ✅
- `schema/hardening/SKILLS_RUNTIME_HARDENING.md` ✅
- `schema/hardening/COST_LIMITS.md` ✅
- `schema/hardening/BLAST_RADIUS.md` ✅
- `schema/hardening/ROLLBACK_POLICY.md` ✅
- `schema/hardening/GO_NO_GO_CHECKLIST.md` ✅
- `schema/reports/PR67_HARDENING_SEGURANCA_CUSTO_LIMITES.md` ✅ (este arquivo)
- `schema/skills-runtime/SECURITY_MODEL.md` ✅ (atualizado)
- `schema/skills-runtime/ROLLOUT_PLAN.md` ✅ (atualizado)
- `schema/brain/learnings/future-risks.md` ✅ (atualizado)
- `schema/brain/SYSTEM_AWARENESS.md` ✅ (atualizado)
- `schema/contracts/INDEX.md` ✅ (atualizado)
- `schema/status/ENAVIA_STATUS_ATUAL.md` ✅ (atualizado)
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` ✅ (atualizado)
- `schema/execution/ENAVIA_EXECUTION_LOG.md` ✅ (atualizado)

**Confirmação:** Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
