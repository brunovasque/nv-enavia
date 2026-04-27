# CLAUDE.md — Regras operacionais do repo nv-enavia

## 1. Regra obrigatória inicial

Antes de qualquer ação, leia este arquivo inteiro.

Se não conseguir acessar ou ler este arquivo, pare e avise.

Responda sempre em português.

PRÉ-REQUISITO OBRIGATÓRIO ANTES DO PATCH:
Atualize a branch com `origin/main` antes de qualquer edição. Se houver conflito, resolva primeiro. A tarefa só pode continuar depois que a branch estiver sem conflito contra `main`.

---

## 2. Estrutura de governança obrigatória

Este repo deve manter uma estrutura mínima de governança em:

schema/contracts/active/
schema/status/
schema/handoffs/
schema/execution/

Se alguma dessas pastas não existir, crie antes de iniciar a primeira tarefa contratual.

---

## 3. Arquivos de governança mínimos

Antes de executar qualquer PR/tarefa contratual, garanta que existam:

schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md
schema/status/ENAVIA_STATUS_ATUAL.md
schema/handoffs/ENAVIA_LATEST_HANDOFF.md
schema/execution/ENAVIA_EXECUTION_LOG.md

Se ENAVIA_STATUS_ATUAL.md, ENAVIA_LATEST_HANDOFF.md ou ENAVIA_EXECUTION_LOG.md não existirem, crie com conteúdo inicial simples e atualizado conforme a tarefa.

---

## 4. Leitura obrigatória por sessão

No início de cada sessão/tarefa, leia nesta ordem:

1. CLAUDE.md
2. schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md
3. schema/status/ENAVIA_STATUS_ATUAL.md
4. schema/handoffs/ENAVIA_LATEST_HANDOFF.md
5. schema/execution/ENAVIA_EXECUTION_LOG.md

Se algum arquivo não existir, crie somente os arquivos mínimos necessários e registre isso no log.

---

## 5. Atualização obrigatória ao final de cada tarefa

Ao final de cada PR/tarefa, atualize:

- schema/status/ENAVIA_STATUS_ATUAL.md
- schema/handoffs/ENAVIA_LATEST_HANDOFF.md
- schema/execution/ENAVIA_EXECUTION_LOG.md

Esses arquivos devem refletir:

- o que foi feito;
- branch usada;
- PR aberta;
- commit;
- testes executados;
- bloqueios encontrados;
- próxima etapa segura.

---

## 6. Regras de execução

- Siga o contrato ativo sem desviar.
- Não misture Worker, Panel e Executor na mesma PR.
- Não refatore por estética.
- Não altere o que já funciona sem necessidade comprovada.
- Faça diagnóstico antes de alterar.
- Faça patch cirúrgico.
- Não feche etapa sem evidência real.
- Não avance para a próxima PR se a anterior estiver incompleta ou bloqueada.
- Se encontrar conflito entre arquivos, o contrato ativo tem prioridade.
- Se houver risco de quebrar produção, pare e avise.

---

## 7. Branches

Use branches separadas por PR/tarefa.

Padrão sugerido:

claude/pr1-active-surface
claude/pr2-executor-governado
claude/pr3-panel-backend-real
claude/pr4-worker-confiabilidade
claude/pr5-observabilidade-real
claude/pr6-loop-supervisionado
claude/pr7-schemas-orquestracao

---

## 8. Formato obrigatório de resposta

Ao finalizar uma tarefa, responda em português com:

WORKFLOW_ACK: ok

PR executada:
Branch:
Commit:
Link da PR:

Resumo:
- ...

Arquivos alterados:
- ...

Smoke tests:
- Comando:
- Resultado:

Governança atualizada:
- status:
- handoff:
- execution log:

Rollback:
- ...

Bloqueios:
- nenhum

Se houver bloqueio:

WORKFLOW_ACK: bloqueado

Etapa:
Bloqueio:
Causa provável:
Evidência:
Próxima ação segura:
