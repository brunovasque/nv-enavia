# CONTRATO ENAVIA — PR ORCHESTRATOR SUPERVISIONADO PR90–PR93

Status: Ativo
Tipo: contrato de governança operacional supervisionada (docs-only nesta ativação)
Base: sequência PR86–PR89 concluída com prova do loop interno até `finalize` (sem deploy real)

---

## 1. Objetivo macro

Permitir que a Enavia prepare tarefas internas como um Copilot supervisionado:

`pedido → diagnóstico → proposta → branch/PR-ready → testes → provas → ready_for_merge → aprovação humana → deploy TEST/PROD supervisionado`

A Enavia prepara tudo até ficar mergeável/deployável.
Merge e deploy PROD continuam sob aprovação humana.

---

## 2. Regra principal

- A Enavia pode preparar todo o pacote técnico até estado `ready_for_merge` e `deploy_test_ready`.
- Aprovação humana é obrigatória para merge em `main`.
- Aprovação humana é obrigatória para deploy em PROD.

---

## 3. Escopo desta frente

- Escopo exclusivo: `nv-enavia`, sistema interno da Enavia.
- Esta frente não cobre integração multi-repo para projetos externos.
- Integração multi-repo/GitHub para outros projetos fica para contrato futuro.

---

## 4. Proibido nesta frente

- merge automático em `main`
- deploy PROD automático
- alteração de secrets
- rollback PROD automático sem aprovação
- operar outros repositórios
- browser action
- refatorar fluxos vivos sem diagnóstico
- mexer em Enova

---

## 5. Sequência de PRs

## PR90 — Diagnóstico READ-ONLY do PR Orchestrator

Tipo: PR-DIAG (read-only)

Objetivo:
Mapear o que já existe para GitHub/branch/PR/deploy/test/status/logs:

- GitHub bridge
- contract-executor
- deploy-worker
- workflow `deploy.yml`
- executor
- permissões/tokens esperados
- status/logs
- possíveis rotas internas

Resultado esperado:
Mapa do que existe, o que falta, e menor patch viável para PR91.

---

## PR91 — PR Planner

Tipo: PR-IMPL (escopo interno supervisionado)

Objetivo:
Criar modelo interno supervisionado para pacote PR-ready com:

- `branch_name`
- `files_to_change`
- `patch_plan`
- `tests_to_run`
- `rollback_plan`
- `acceptance_criteria`
- `pr_title`
- `pr_body`
- `risk_level`
- `ready_for_human_review`

---

## PR92 — PR Executor supervisionado

Tipo: PR-IMPL (escopo interno supervisionado)

Objetivo:
Permitir aplicar pacote em branch segura e abrir/atualizar PR, sem merge.

Regras obrigatórias:

- sem merge automático
- sem PROD
- sem alteração de secrets
- se GitHub real ainda não estiver integrado, usar mock/adapter testável e documentar ponto de integração

---

## PR93 — Ready for Merge + Deploy TEST

Tipo: PR-PROVA/PR-HARDENING

Objetivo:
Rodar testes/provas, anexar evidências e marcar:

- `ready_for_merge: true`
- `awaiting_human_approval: true`
- `deploy_test_ready: true`
- `prod_blocked_until_human_approval: true`

---

## 6. Critério final de saída da frente

Ao fim da PR93, a Enavia deve conseguir preparar uma mudança interna até o ponto de:

- PR pronta
- testes definidos/rodados
- provas registradas
- rollback claro
- aguardando merge humano
- aguardando aprovação PROD humana

---

## 7. Regra operacional desta ativação

- Esta mudança ativa somente o contrato.
- PR90–PR93 não devem ser implementadas nesta ativação.
- Próxima PR autorizada após este contrato: **PR90 — Diagnóstico READ-ONLY do PR Orchestrator**.
