# CLAUDE.md — Regras operacionais do repo nv-enavia

## Permissões
Todas as operações são pré-aprovadas neste repo:
- Leitura e escrita de arquivos
- Execução de comandos bash/shell
- Operações git (commit, branch, push)
- Sem necessidade de confirmação para operações locais

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
schema/contracts/INDEX.md
schema/status/
schema/handoffs/
schema/execution/

Se alguma dessas pastas ou arquivos não existir, crie antes de iniciar a primeira tarefa contratual.

---

## 3. Arquivos de governança mínimos

Antes de executar qualquer PR/tarefa contratual, garanta que existam:

- `schema/contracts/INDEX.md` — índice de todos os contratos (histórico + ativo)
- `schema/contracts/active/` — pasta contendo o(s) contrato(s) ativo(s)
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`

**Contratos históricos (encerrados — manter como referência, não editar):**
- `schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` — PR1–PR7, encerrado ✅
- `schema/contracts/active/CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` — PR8–PR13, encerrado ✅

**Contrato ativo atual:**
- Identificar o contrato ativo mais recente em `schema/contracts/active/` consultando `schema/contracts/INDEX.md`.
- Se `INDEX.md` não existir, listar os arquivos em `schema/contracts/active/` e identificar o mais recente pelo nome/data.

Se `ENAVIA_STATUS_ATUAL.md`, `ENAVIA_LATEST_HANDOFF.md` ou `ENAVIA_EXECUTION_LOG.md` não existirem, crie com conteúdo inicial simples e registre no log.

---

## 4. Loop obrigatório de execução por PR

Toda sessão do Claude Code no repo `nv-enavia` deve seguir este ciclo antes de qualquer alteração:

1. Ler `CLAUDE.md`.
2. Ler `schema/CODEX_WORKFLOW.md`.
3. Identificar o contrato ativo mais recente em `schema/contracts/active/`.
4. Ler integralmente o contrato ativo.
5. Ler obrigatoriamente:
   - `schema/status/ENAVIA_STATUS_ATUAL.md`
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
   - `schema/execution/ENAVIA_EXECUTION_LOG.md`
6. Identificar qual é a próxima PR permitida pelo contrato ativo.
7. Ler no contrato ativo a seção específica dessa PR antes de iniciar.
8. Declarar o tipo da PR:
   - `PR-DIAG` — diagnóstico, read-only, sem alteração de runtime
   - `PR-IMPL` — implementação, altera runtime
   - `PR-PROVA` — prova/testes, valida implementação
   - `PR-DOCS` — documentação, sem alteração de runtime
9. Confirmar que a PR anterior exigida pelo contrato está concluída.
10. Se for `PR-IMPL`, confirmar que existe `PR-DIAG` anterior da mesma frente, salvo quando o contrato autorizar implementação direta.
11. Se for fechamento de frente/fase, confirmar que existe `PR-PROVA`.
12. Executar apenas o escopo da PR autorizada.
13. Nunca misturar escopos:
    - `Worker-only`
    - `Panel-only`
    - `Executor-only`
    - `Deploy-worker-only`
    - `Workflows-only`
    - `Docs-only`
14. Atualizar obrigatoriamente ao final:
    - `schema/status/ENAVIA_STATUS_ATUAL.md`
    - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
    - `schema/execution/ENAVIA_EXECUTION_LOG.md`
    - `schema/contracts/INDEX.md`, quando houver mudança de contrato, fase ou estado.
15. Atualizar ou criar a PR com body padrão contendo:
    - objetivo
    - escopo
    - tipo da PR
    - contrato ativo
    - PR anterior validada
    - arquivos alterados
    - smoke tests
    - rollback
    - provas
16. Fazer commit e push no mesmo branch/PR.
17. Responder com `WORKFLOW_ACK: ok` — resumo, branch, PR, commit, rollback, testes, provas e confirmação de push.

**Regras de bloqueio do loop:**
- Se não conseguir ler `CLAUDE.md`, parar.
- Se não conseguir ler `schema/CODEX_WORKFLOW.md`, parar.
- Se não conseguir identificar o contrato ativo, parar.
- Se não conseguir identificar a próxima PR autorizada, parar.
- Se a PR solicitada não for a próxima autorizada pelo contrato, parar.
- Se for `PR-IMPL` sem `PR-DIAG` anterior obrigatório da mesma frente, parar.
- Se for fechamento sem `PR-PROVA`, parar.
- Se tentar mexer fora do escopo da PR, parar.
- Se faltar atualização de status, handoff ou execution log, a tarefa está incompleta.
- Se houver conflito entre contrato, status e handoff, parar e reportar antes de alterar runtime.

---

## 5. Leitura obrigatória por sessão

No início de cada sessão/tarefa, leia nesta ordem:

1. `CLAUDE.md`
2. `schema/CODEX_WORKFLOW.md`
3. Contrato ativo mais recente em `schema/contracts/active/` (ver `schema/contracts/INDEX.md`)
4. `schema/status/ENAVIA_STATUS_ATUAL.md`
5. `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
6. `schema/execution/ENAVIA_EXECUTION_LOG.md`

Se algum arquivo não existir, crie somente os arquivos mínimos necessários e registre isso no log.

---

## 6. Atualização obrigatória ao final de cada tarefa

Ao final de cada PR/tarefa, atualize:

- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`
- `schema/contracts/INDEX.md` — quando houver mudança de contrato, fase ou estado

Esses arquivos devem refletir:

- o que foi feito;
- branch usada;
- PR aberta;
- commit;
- testes executados;
- bloqueios encontrados;
- próxima etapa segura.

---

## 7. Regras de execução

- Siga o contrato ativo sem desviar.
- Não misture Worker, Panel, Executor, Deploy Worker e Docs na mesma PR.
- Não refatore por estética.
- Não altere o que já funciona sem necessidade comprovada.
- Faça diagnóstico antes de alterar.
- Faça patch cirúrgico.
- Não feche etapa sem evidência real.
- Não avance para a próxima PR se a anterior estiver incompleta ou bloqueada.
- Se encontrar conflito entre arquivos, o contrato ativo tem prioridade.
- Se houver risco de quebrar produção, pare e avise.

---

## 8. Branches

Use branches separadas por PR/tarefa.

Padrão:

```
claude/pr<N>-<descricao-curta>
```

Exemplos históricos:
```
claude/pr1-active-surface
claude/pr8-operational-action-contract
claude/pr13-hardening-final-operacional
claude/pr14-executor-deploy-real-loop
claude/pr0-docs-loop-obrigatorio
```

---

## 9. Formato obrigatório de resposta

Ao finalizar uma tarefa, responda em português com:

```
WORKFLOW_ACK: ok

PR executada:
Branch:
Commit:
Link da PR:

Resumo:
- ...

Tipo da PR: PR-IMPL | PR-DIAG | PR-PROVA | PR-DOCS
Contrato ativo:
PR anterior validada:

Arquivos alterados:
- ...

Smoke tests:
- Comando:
- Resultado:

Governança atualizada:
- status:
- handoff:
- execution log:
- INDEX.md:

Rollback:
- ...

Bloqueios:
- nenhum
```

Se houver bloqueio:

```
WORKFLOW_ACK: bloqueado

Etapa:
Bloqueio:
Causa provável:
Evidência:
Próxima ação segura:
```
