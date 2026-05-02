# ENAVIA — Runtime de Skills: Plano de Rollout

**Versão:** 0.1 — Blueprint
**Data:** 2026-05-02 (PR65)
**Estado:** Documental — nenhuma fase implementada além da Fase 0

---

## 1. Visão geral

O Runtime de Skills será implementado em fases incrementais, cada uma com diagnóstico, implementação e prova antes de avançar.

**Princípio:** Nunca pular fase. Nunca implementar em PR-DOCS. Nunca criar endpoint antes do diagnóstico.

---

## 2. Fase 0 — Blueprint Documental ← ATUAL

**PR:** PR65
**Tipo:** PR-DOCS
**Estado:** ✅ Em execução

### O que esta fase entrega

- Arquitetura futura documentada
- Contrato de execução documentado
- Gates de aprovação documentados
- Matriz de capacidades documentada
- Modelo de segurança documentado
- Open questions para diagnóstico
- Governança atualizada

### O que esta fase NÃO entrega

- Nenhum runtime implementado
- Nenhum endpoint criado
- Nenhuma skill executando

### Critério de conclusão

- 8 arquivos em `schema/skills-runtime/` criados ✅
- Relatório PR65 criado ✅
- Governança atualizada ✅
- Nenhum runtime alterado ✅

---

## 3. Fase 1 — Diagnóstico Técnico

**PR prevista:** PR66
**Tipo:** PR-DIAG (read-only — sem alteração de runtime)

### O que esta fase deve diagnosticar

- Onde o runtime deve viver? Worker principal (`nv-enavia.js`) ou worker separado?
- Quais bindings são necessários? (KV, D1, R2, outros?)
- Qual é o ponto de integração com o Skill Router existente?
- O primeiro endpoint deve ser `/skills/propose` em vez de `/skills/run`?
- Qual é o storage para log de execuções?
- Como o approval gate se comunica com o operador?
- Quais riscos técnicos existem na implementação?
- Há conflitos com rotas existentes em `ENAVIA_ROUTE_REGISTRY.json`?
- O `contract-executor.js` deve ser reutilizado ou o runtime é novo módulo?

### Entregáveis obrigatórios

- Relatório `schema/reports/PR66_DIAG_RUNTIME_SKILLS.md`
- Decisão: onde vive o runtime
- Decisão: primeiro endpoint (propose vs run)
- Lista de bindings necessários
- Riscos técnicos identificados

### Critério de avanço para Fase 2

- Todas as open questions de PR65 respondidas ou delegadas
- Decisão técnica documentada sem ambiguidade
- Nenhum runtime alterado

---

## 4. Fase 2 — Runtime Read-Only / Proposal

**PR prevista:** PR67+
**Tipo:** PR-IMPL (depende de diagnóstico da PR66)

### O que esta fase implementa

- Endpoint `/skills/propose` (não `/skills/run`)
- Skill Executor em modo `proposal` apenas
- Integração com Skill Router existente
- Integração com Self-Audit existente
- Log básico de propostas (sem execução)

### O que esta fase NÃO implementa

- Não implementa execução de skill
- Não implementa aprovação humana automática
- Não implementa `/skills/run`
- Não conecta a KV ou storage externo nesta fase

### Critério de conclusão

- PR-PROVA dedicada com todos os cenários passando
- `/skills/propose` retorna proposta corretamente
- Nenhuma execução ocorre sem aprovação
- Self-Audit integrado na resposta

---

## 5. Fase 3 — Endpoint Controlado

**PR prevista:** PR68+
**Tipo:** PR-IMPL (depende da Fase 2 estar validada)

### O que esta fase implementa

- Mecanismo de aprovação humana (canal a definir na PR66)
- Endpoint `/skills/approve` ou mecanismo equivalente
- Ciclo: proposta → notificação → aprovação → execução limitada

### Pré-requisito

- Fase 2 concluída e validada ✅
- PR-PROVA da Fase 2 passando ✅
- Mecanismo de aprovação diagnosticado (PR66)

---

## 6. Fase 4 — Aprovação Humana

**PR prevista:** PR69+
**Tipo:** PR-IMPL

### O que esta fase implementa

- Fluxo completo: propose → approve → execute (limitado)
- Log persistente de aprovações
- Rejeição com motivo registrado
- Timeout de aprovação (proposta expira)

### Critério de conclusão

- PR-PROVA com cenários de aprovação e rejeição
- Nenhuma execução sem aprovação documentada
- Log de auditoria completo

---

## 7. Fase 5 — Execução Limitada Read-Only

**PR prevista:** PR70+
**Tipo:** PR-IMPL

### O que esta fase implementa

- Execução real de skills sem side-effect (mode: `read_only`)
- Apenas skills de baixo risco (CONTRACT_AUDITOR, CONTRACT_LOOP_OPERATOR)
- Evidência obrigatória por execução
- Self-Audit integrado na execução

### Skills candidatas para Fase 5

1. `CONTRACT_AUDITOR` — revisar PR (read-only)
2. `CONTRACT_LOOP_OPERATOR` — orientar sobre próxima PR (read-only)

### O que esta fase NÃO implementa

- Não implementa deploy
- Não implementa escrita em KV
- Não implementa DEPLOY_GOVERNANCE_OPERATOR em modo executável

---

## 8. Fase 6 — Execução com Side-Effect

**PR prevista:** PR71+
**Tipo:** PR-IMPL (somente após Fase 5 validada)

### Pré-requisitos obrigatórios

- Fase 5 concluída e PR-PROVA passando ✅
- Gates de aprovação robustos e validados ✅
- Self-Audit integrado e testado ✅
- Rollback definido para cada ação ✅
- Operador humano confirmou disposição de avançar

### O que esta fase pode implementar (a definir por contrato)

- Skills com escrita em repositório (SYSTEM_MAPPER, CONTRACT_AUDITOR em modo repo_write)
- DEPLOY_GOVERNANCE_OPERATOR em modo proposal para deploy TEST

### O que esta fase NUNCA implementa sem gate explícito

- Deploy automático para PROD
- Merge automático de PR
- Escrita em KV sem aprovação humana
- Revogação de secret

---

## 9. Aviso sobre `/skills/run`

> `/skills/run` direto **não deve ser o primeiro endpoint**.
>
> O primeiro endpoint deve ser `/skills/propose` — que gera uma proposta sem executar.
> A execução deve ser habilitada apenas na Fase 5 ou posterior, após gate de aprovação implementado e validado.
>
> Criar `/skills/run` antes da aprovação humana estar implementada viola o princípio de governed execution e cria risco de autonomia cega.

---

## 10. O que este plano NÃO autoriza

- Não autoriza nenhuma implementação nesta PR
- Não cria nenhum endpoint
- Não altera nenhum módulo de runtime
- Cada fase depende de PR-DIAG + PR-IMPL + PR-PROVA aprovadas pelo operador
