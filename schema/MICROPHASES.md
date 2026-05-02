# MICROPHASES — NV-ENAVIA

Template oficial para quebrar contratos grandes em microfases executáveis pelo Codex local, Enavia ou agentes externos.

Este arquivo define o formato mínimo. Contratos específicos podem criar listas próprias de microfases usando este modelo.

---

## Regras gerais

- Uma microfase deve ter objetivo único.
- Uma microfase deve declarar escopo permitido e escopo proibido.
- Uma microfase deve ter critério de aceite verificável.
- Uma microfase deve ter teste obrigatório.
- Uma microfase deve ter rollback.
- Nenhuma microfase pode misturar Worker, Panel, Executor, Deploy-worker, Workflows e Docs.
- A próxima microfase só começa depois da atual estar validada.

---

## Status permitidos

- PENDING
- IN_PROGRESS
- BLOCKED
- DONE
- CANCELLED

---

## Template canônico

### MICROFASE <ID> — <Nome curto>

Status: PENDING

Tipo:
- PR-DIAG | PR-IMPL | PR-PROVA | PR-DOCS

Escopo:
- Docs-only | Worker-only | Panel-only | Executor-only | Deploy-worker-only | Workflows-only | Tests-only

Objetivo:
- Descrever o objetivo único da microfase.

Por que agora:
- Explicar por que esta microfase deve acontecer neste ponto da sequência.

Escopo permitido:
- Informar arquivos, pastas ou comportamento que podem ser tocados.

Escopo proibido:
- Informar arquivos, pastas ou comportamento que não podem ser tocados.

Arquivos prováveis:
- caminho/arquivo-1
- caminho/arquivo-2

Diagnóstico obrigatório:
- O que precisa ser confirmado antes do patch.

Critério de aceite:
- Prova objetiva de que terminou certo.

Teste obrigatório:
- Comando: informar comando.
- Resultado esperado: informar resultado.

Rollback:
- Reverter o commit da microfase.
- Informar rollback específico se houver.

Risco:
- Baixo | Médio | Alto

Observações:
- Notas importantes.

---

## Exemplo seguro — Docs-only

### MICROFASE LC-001 — Criar governança local do Codex

Status: DONE

Tipo:
- PR-DOCS

Escopo:
- Docs-only

Objetivo:
- Criar contrato complementar para uso do Codex local com microfases e regras de parada.

Por que agora:
- Antes de usar Codex local como executor, o repo precisa ter regras explícitas para evitar execução em bloco grande.

Escopo permitido:
- schema/LOCAL_CODEX_EXECUTION_CONTRACT.md
- schema/MICROPHASES.md
- documentação de governança relacionada ao Codex local

Escopo proibido:
- Worker
- Painel
- Executor
- Deploy-worker
- Workflows
- Secrets
- Bindings
- Runtime

Arquivos prováveis:
- schema/LOCAL_CODEX_EXECUTION_CONTRACT.md
- schema/MICROPHASES.md

Diagnóstico obrigatório:
- Confirmar existência de CLAUDE.md e schema/CODEX_WORKFLOW.md.
- Confirmar que a mudança é complementar, não substitutiva.

Critério de aceite:
- Arquivos de governança criados sem alteração funcional.
- Regras de microfase, parada, teste e rollback explícitas.

Teste obrigatório:
- Comando: git diff --stat main...HEAD
- Resultado esperado: somente arquivos de documentação/governança alterados.

Rollback:
- Reverter o commit da microfase.

Risco:
- Baixo

Observações:
- Esta microfase não autoriza execução autônoma de contratos grandes.

---

## Checklist antes de executar uma microfase

- Li CLAUDE.md.
- Li schema/CODEX_WORKFLOW.md.
- Li schema/LOCAL_CODEX_EXECUTION_CONTRACT.md.
- Li a microfase inteira.
- Confirmei o escopo permitido.
- Confirmei o escopo proibido.
- Fiz diagnóstico read-only.
- Sei quais testes rodar.
- Sei como reverter.

---

## Checklist depois de executar uma microfase

- Patch ficou dentro do escopo.
- Teste obrigatório foi executado.
- Diff foi revisado.
- Commit local foi criado.
- Rollback está claro.
- Próxima microfase não foi iniciada sem aprovação.
