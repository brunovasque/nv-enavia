# ENAVIA — Go/No-Go Checklist: Runtime de Skills

**Versão:** 1.0
**Data:** 2026-05-02 (PR67)
**Estado:** Documental — checklist obrigatório antes de qualquer PR-IMPL futura de runtime

---

## 1. Uso obrigatório

Este checklist deve ser satisfeito **antes de iniciar qualquer PR-IMPL que implemente runtime de skills**.

**Como usar:**
1. Copiar este checklist no corpo da PR-IMPL proposta.
2. Preencher cada item com evidência (arquivo + seção).
3. Se qualquer item estiver ❌, a PR não pode avançar.
4. Operador humano deve validar o checklist antes de aprovar o início da implementação.

---

## 2. Checklist de contrato e governança

| # | Critério | Estado | Evidência |
|---|----------|--------|-----------|
| C1 | Contrato ativo aponta esta PR como autorizada? | ☐ | `schema/contracts/INDEX.md` — seção "Próxima PR autorizada" |
| C2 | PR anterior obrigatória está concluída e mergeada? | ☐ | `schema/execution/ENAVIA_EXECUTION_LOG.md` |
| C3 | Tipo da PR declarado (PR-IMPL / PR-DIAG / PR-PROVA / PR-DOCS)? | ☐ | Corpo da PR |
| C4 | Escopo é único (sem mistura de Worker, Panel, Executor, Docs)? | ☐ | Corpo da PR |
| C5 | Se PR-IMPL: existe PR-DIAG anterior da mesma frente? | ☐ | `schema/reports/PR66_DIAG_RUNTIME_SKILLS.md` |
| C6 | Se PR-IMPL de endpoint: endpoint autorizado no contrato? | ☐ | Contrato ativo — seção da frente |
| C7 | Se fechamento de frente: existe PR-PROVA prevista? | ☐ | Contrato ativo — sequência de PRs |

---

## 3. Checklist de segurança

| # | Critério | Estado | Evidência |
|---|----------|--------|-----------|
| S1 | Há bloqueio para secret? (Self-Audit `secret_exposure` blocking) | ☐ | `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 6 |
| S2 | Há bloqueio para produção sem gate humano? | ☐ | `schema/hardening/BLAST_RADIUS.md` nível 4 |
| S3 | Allowlist de skills está definida para esta fase? | ☐ | `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 3 |
| S4 | Deny-by-default está documentado e será implementado? | ☐ | `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 2 |
| S5 | `/skills/run` não será criado antes de `/skills/propose`? | ☐ | `schema/skills-runtime/ROLLOUT_PLAN.md` seção 9 |
| S6 | Nenhuma execução ocorrerá sem aprovação humana? | ☐ | `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 5 |
| S7 | Nenhuma escrita de KV sem contrato? | ☐ | `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 7 |
| S8 | Nenhum secret em logs/responses? | ☐ | `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 6 |
| S9 | Self-Audit será executado antes de retornar resultado? | ☐ | `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 8 |
| S10 | Evidência mínima de execução declarada? | ☐ | `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 10 |

---

## 4. Checklist de custo e limites

| # | Critério | Estado | Evidência |
|---|----------|--------|-----------|
| L1 | Há limite de custo por request? | ☐ | `schema/hardening/COST_LIMITS.md` seção 3 |
| L2 | Limite de `max_skill_proposals_per_request` definido? | ☐ | `schema/hardening/COST_LIMITS.md` seção 3.1 |
| L3 | Limite de `max_retries` definido? | ☐ | `schema/hardening/COST_LIMITS.md` seção 3.1 |
| L4 | Limite de `max_payload_size_chars` definido? | ☐ | `schema/hardening/COST_LIMITS.md` seção 3.1 |
| L5 | Nenhum LLM extra dentro do Skill Executor na fase inicial? | ☐ | `schema/hardening/COST_LIMITS.md` seção 3.3 |
| L6 | Nenhuma chamada externa na fase proposal-only? | ☐ | `schema/hardening/COST_LIMITS.md` seção 3.3 |
| L7 | Nenhuma persistência obrigatória na fase proposal-only? | ☐ | `schema/hardening/COST_LIMITS.md` seção 3.4 |

---

## 5. Checklist de blast radius e rollback

| # | Critério | Estado | Evidência |
|---|----------|--------|-----------|
| BR1 | Nível de blast radius declarado no corpo da PR? | ☐ | `schema/hardening/BLAST_RADIUS.md` |
| BR2 | Gates mínimos para o nível declarado serão implementados? | ☐ | `schema/hardening/BLAST_RADIUS.md` seção 2 |
| BR3 | Rollback definido antes de executar? | ☐ | `schema/hardening/ROLLBACK_POLICY.md` |
| BR4 | Se nível 3+: rollback testado ou documentado com passos? | ☐ | `schema/hardening/ROLLBACK_POLICY.md` seção 2 |
| BR5 | PR-PROVA que falhar não corrigirá dentro dela? | ☐ | `schema/hardening/ROLLBACK_POLICY.md` seção 3 |

---

## 6. Checklist de teste e prova

| # | Critério | Estado | Evidência |
|---|----------|--------|-----------|
| T1 | Há PR-PROVA prevista para validar esta PR-IMPL? | ☐ | Contrato ativo — sequência de PRs |
| T2 | Critério claro de sucesso/falha definido? | ☐ | Corpo da PR — seção "Critério de conclusão" |
| T3 | Smoke tests para os cenários principais definidos? | ☐ | Arquivo de teste previsto na PR |
| T4 | Cenários de bloqueio (secret_exposure, unauthorized_action) incluídos nos testes? | ☐ | Plano de testes da PR |
| T5 | Regressões dos módulos existentes serão executadas? | ☐ | Plano de testes da PR |

---

## 7. Critério de aceite do checklist

**Go (pode avançar):**
- Todos os itens marcados ✅
- Evidência válida para cada item
- Operador humano validou antes do início

**No-Go (não pode avançar):**
- Qualquer item ❌
- Evidência ausente ou inválida
- Operador não validou

**No-Go parcial (pode avançar com restrição):**
- Item marcado como `N/A` apenas se a PR declara explicitamente por quê não se aplica
- Exemplo: C6 (endpoint) é N/A para PR-IMPL de módulo interno sem endpoint

---

## 8. Histórico de uso

| PR | Data | Resultado | Observação |
|----|------|-----------|------------|
| PR67 (hardening) | 2026-05-02 | Checklist criado | Este documento é o checklist — não há PR-IMPL de runtime a validar ainda |

---

## Backlinks

- `schema/hardening/INDEX.md`
- `schema/hardening/SKILLS_RUNTIME_HARDENING.md`
- `schema/hardening/COST_LIMITS.md`
- `schema/hardening/BLAST_RADIUS.md`
- `schema/hardening/ROLLBACK_POLICY.md`
- `schema/reports/PR67_HARDENING_SEGURANCA_CUSTO_LIMITES.md`
