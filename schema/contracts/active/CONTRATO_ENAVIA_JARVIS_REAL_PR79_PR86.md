# CONTRATO ENAVIA — Jarvis Real v1 PR79–PR86

Status: Ativo
Tipo: contrato otimizado de execução real governada
Base: Fase 1 do Runtime de Skills concluída na PR78
Objetivo macro: fazer a Enavia sair de proposta/approval e chegar em execução real governada, com primeira escrita supervisionada e resposta operacional no chat.

---

## 1. Verdade de partida

A Fase 1 entregou uma fundação segura, mas ainda incompleta:

- `buildSkillExecutionProposal()` proposal-only
- `POST /skills/propose`
- `POST /skills/approve`
- `POST /skills/reject`
- approval gate proposal-only
- `SYSTEM_MAPPER` read-only como módulo puro
- `chat_skill_surface` no `/chat/run`
- `/skills/run` ainda inexistente
- nenhuma skill com side effect real
- nenhuma escrita supervisionada de memória/execução

Portanto, a Enavia ainda não é Jarvis operacional. Este contrato existe para corrigir isso sem abrir 30 PRs.

---

## 2. Regra-mãe deste contrato

Menos PRs. Mais entrega funcional.

Cada PR deve entregar código real ou fechamento indispensável.
Não criar PR só para diagnóstico/documentação.
Não criar PR separada para “prova da prova”.
A própria PR funcional deve trazer smoke forte e regressões essenciais.

---

## 3. Objetivo final real

Ao final da PR86, a Enavia deve conseguir:

1. receber intenção no chat;
2. propor skill;
3. gerar `proposal_id`;
4. aprovar proposta;
5. executar skill aprovada via `/skills/run`;
6. retornar resultado real;
7. registrar evidência mínima da execução;
8. executar uma primeira skill com side effect seguro e supervisionado;
9. registrar memória/execução supervisionada;
10. expor no chat que uma execução real governada aconteceu;
11. bloquear execução não aprovada, desconhecida, repetida ou fora da allowlist.

Isso é Jarvis Real v1: execução governada, limitada e auditável. Ainda não é deploy/browser/GitHub autônomo.

---

## 4. Sequência otimizada

Este contrato tem 8 PRs:

- PR79 — `/skills/run` real read-only para `SYSTEM_MAPPER`
- PR80 — Persistência leve/evidência real de runs
- PR81 — Skill `WRITE_EXECUTION_MEMORY` supervisionada
- PR82 — Chat executa skill aprovada com payload explícito
- PR83 — Runner hardening: replay, idempotência, limites e erros
- PR84 — Skill `CONTRACT_AUDITOR` read-only executável
- PR85 — Orquestração simples: propor → aprovar → executar → registrar → responder
- PR86 — Fechamento Jarvis Real v1

Não criar PRs extras sem bloqueio técnico comprovado.

---

# PR79 — `/skills/run` real read-only para SYSTEM_MAPPER

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Criar o primeiro endpoint real de execução governada: `POST /skills/run`, limitado exclusivamente à skill `SYSTEM_MAPPER` e somente após approval válido.

## Resultado esperado

A Enavia executa `SYSTEM_MAPPER` de verdade, retorna resultado real read-only e não causa side effects perigosos.

## Implementação permitida

- alterar `nv-enavia.js`
- criar `schema/enavia-skill-runner.js`
- reutilizar `buildSystemMapperResult()`
- reutilizar approval gate existente
- criar `tests/pr79-skills-run-system-mapper.smoke.test.js`
- atualizar status/handoff/execution log

## Regras obrigatórias

- endpoint: `POST /skills/run`
- entrada mínima: `proposal_id`, `skill_id`
- só aceita `SYSTEM_MAPPER`
- só executa se proposal estiver `approved`
- bloquear proposal desconhecida/proposed/rejected/expired/blocked
- bloquear skill diferente de `SYSTEM_MAPPER`
- erro controlado para JSON inválido e método errado
- sucesso deve retornar `executed=true`, `executed_readonly=true`, `side_effects=false`
- não chamar fetch, KV, filesystem runtime, comando externo ou LLM externo

## Proibido

- não executar skill com side effect
- não criar persistência externa
- não criar binding/KV/tabela/coluna
- não alterar `wrangler.toml`
- não alterar `contract-executor.js`
- não mexer em painel/deploy-worker/executor/workflows
- não executar automaticamente pelo chat ainda

## Critério de aceite

`/skills/run` existe, executa `SYSTEM_MAPPER` aprovada e bloqueia todo o resto.

---

# PR80 — Persistência leve/evidência real de runs

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Toda execução ou bloqueio de `/skills/run` deve gerar evidência mínima rastreável.

## Resultado esperado

Cada run retorna `run_id`, `proposal_id`, `skill_id`, `status`, `timestamp`, `mode`, `reason`, `executed`, `side_effects` e resumo seguro do resultado ou bloqueio.

## Implementação permitida

- criar `schema/enavia-skill-run-audit.js`
- usar store em memória por instância nesta fase, explicitamente marcado como não persistente entre deploys
- integrar evidência no `/skills/run`
- criar `tests/pr80-skill-run-audit.smoke.test.js`
- atualizar status/handoff/execution log

## Regras obrigatórias

- sucesso gera `run_id`
- bloqueio gera `blocked_run_id` ou `run_id` com status blocked
- não guardar payload bruto sensível
- não expor secret/env
- não criar KV/binding/tabela ainda

## Critério de aceite

Toda execução ou tentativa bloqueada tem evidência retornada e auditável na resposta.

---

# PR81 — Skill WRITE_EXECUTION_MEMORY supervisionada

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Criar a primeira skill com side effect seguro: escrita supervisionada de memória/execução, limitada a registrar resultado de run aprovado.

## Resultado esperado

A Enavia deixa de apenas executar e passa a registrar uma memória operacional supervisionada, sem escrever qualquer coisa livre.

## Implementação permitida

- criar skill `WRITE_EXECUTION_MEMORY`
- criar módulo `schema/enavia-write-execution-memory-skill.js`
- integrar no runner com allowlist separada de side effects seguros
- criar `tests/pr81-write-execution-memory.smoke.test.js`
- atualizar status/handoff/execution log

## Regras obrigatórias

- só roda se proposal approved
- só aceita payload estruturado de execução já concluída
- escreve apenas registro resumido: `run_id`, `skill_id`, `status`, `summary`, `timestamp`, `source="skill_run"`
- se não houver storage real seguro, usar store em memória/test-only e deixar isso explícito
- side effect permitido apenas para esta skill e apenas neste formato
- retorno deve incluir `side_effects=true`, `effect_type="supervised_memory_write"`, `executed=true`

## Proibido

- não escrever segredo
- não escrever payload bruto
- não criar tabela/coluna
- não alterar contrato de banco
- não abrir arquivo no filesystem runtime
- não chamar rede externa
- não ampliar para deploy/GitHub/browser

## Critério de aceite

A Enavia consegue registrar uma memória supervisionada de execução, com side effect seguro e comprovado.

---

# PR82 — Chat executa skill aprovada com payload explícito

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Permitir que `/chat/run` acione execução governada quando o payload trouxer sinal explícito e aprovado.

## Resultado esperado

O chat não só mostra proposta; ele consegue executar uma ação aprovada quando recebe payload estruturado.

## Implementação permitida

- alterar `nv-enavia.js` pontualmente
- expandir `schema/enavia-chat-skill-surface.js`
- adicionar `skill_run_surface` como campo aditivo
- se input do chat trouxer `run_skill=true`, `approved_proposal_id` e `skill_id`, chamar runner
- criar `tests/pr82-chat-governed-run.smoke.test.js`
- atualizar status/handoff/execution log

## Regras obrigatórias

- nunca executar por frase livre
- nunca executar sem `run_skill=true`
- nunca executar sem `approved_proposal_id`
- manter `reply` natural
- manter `use_planner`
- retorno deve diferenciar: proposta pendente, execução concluída, execução bloqueada

## Proibido

- não executar deploy/browser/GitHub
- não executar side effect fora de `WRITE_EXECUTION_MEMORY`
- não chamar LLM externo novo
- não usar KV/banco novo
- não mexer em painel/workflows/deploy-worker/executor

## Critério de aceite

Chat executa skill aprovada por payload explícito e retorna resultado/evidência sem disparo acidental.

---

# PR83 — Runner hardening

Tipo: PR-IMPL
Escopo: Worker-only + Tests

## Objetivo

Blindar `/skills/run` contra repetição indevida, replay simples, payload grande, status inválido e vazamento de erro.

## Regras obrigatórias

- limitar tamanho de payload
- validar campos obrigatórios
- bloquear run repetido do mesmo proposal na instância
- bloquear skill fora da allowlist de execução
- padronizar erro
- não vazar stack/secret
- manter allowlist clara: `SYSTEM_MAPPER` read-only e `WRITE_EXECUTION_MEMORY` supervisionada
- manter regressões completas

## Critério de aceite

Runner robusto para uso inicial real.

---

# PR84 — CONTRACT_AUDITOR read-only executável

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Adicionar uma segunda skill executável, read-only, mais útil para o projeto: `CONTRACT_AUDITOR`.

## Resultado esperado

A Enavia consegue auditar contrato ativo/estado de contrato de forma estruturada, sem mexer em arquivos nem executar comandos externos.

## Implementação permitida

- criar `schema/enavia-contract-auditor-skill.js`
- runner pode executar `CONTRACT_AUDITOR` somente approved
- leitura baseada apenas em dados já importáveis/estáticos seguros ou payload fornecido; se precisar filesystem runtime, bloquear e documentar
- criar `tests/pr84-contract-auditor-readonly.smoke.test.js`
- atualizar status/handoff/execution log

## Proibido

- não ler filesystem runtime dinâmico
- não alterar contratos
- não criar PR
- não chamar GitHub
- não chamar LLM externo

## Critério de aceite

`CONTRACT_AUDITOR` executa read-only e retorna diagnóstico estruturado do contrato/payload fornecido.

---

# PR85 — Orquestração simples ponta a ponta

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Criar um fluxo simples e integrado: propor → aprovar → executar → registrar → responder.

## Resultado esperado

Um único teste/fluxo consegue demonstrar comportamento Jarvis: a Enavia recebe intenção estruturada, propõe, aprova, executa e registra.

## Implementação permitida

- criar helper orquestrador limitado, preferencialmente `schema/enavia-jarvis-orchestrator.js`
- não substituir endpoints existentes
- não criar autonomia sem approval
- criar `tests/pr85-jarvis-simple-orchestration.smoke.test.js`
- atualizar status/handoff/execution log

## Regras obrigatórias

- orquestração só opera em modo supervisionado
- sempre exige approval antes de run
- só usa skills permitidas
- registra evidência
- retorna estado final claro

## Critério de aceite

Existe um fluxo integrado de execução governada sem depender de colar manualmente cada endpoint.

---

# PR86 — Fechamento Jarvis Real v1

Tipo: PR-PROVA
Escopo: Tests-only + Docs-only mínimo

## Objetivo

Provar que a Enavia funciona como Jarvis Real v1 dentro do escopo definido.

## Teste final obrigatório

1. gera proposta para `SYSTEM_MAPPER`
2. aprova
3. executa via `/skills/run`
4. retorna resultado real
5. gera run evidence
6. registra memória supervisionada com `WRITE_EXECUTION_MEMORY`
7. executa `CONTRACT_AUDITOR` read-only com approval
8. chat executa skill aprovada com payload explícito
9. orquestração simples completa o ciclo
10. tentativa sem approval bloqueia
11. tentativa de skill desconhecida bloqueia
12. replay indevido bloqueia
13. side effects fora da allowlist bloqueiam
14. regressões PR69–PR85 passam

## Relatório obrigatório

Criar `schema/reports/PR86_JARVIS_REAL_V1.md` com:

- o que existe
- o que ainda não existe
- limitações conhecidas
- próximos contratos recomendados

## Critério de aceite final

Ao final da PR86, a Enavia pode ser chamada de Jarvis Real v1 porque executa ações governadas, registra evidência, escreve memória supervisionada e responde no chat com resultado controlado.

Ainda NÃO está autorizada a:

- abrir PR sozinha
- alterar arquivo do repo
- fazer deploy
- acionar browser executor
- executar comandos externos
- executar side effects fora da allowlist

---

## 5. Prompt padrão para Codex

```text
Leia e siga estritamente:
1. CLAUDE.md
2. schema/CODEX_WORKFLOW.md
3. schema/LOCAL_CODEX_EXECUTION_CONTRACT.md
4. schema/MICROPHASES.md
5. schema/contracts/ACTIVE_CONTRACT.md
6. schema/contracts/active/CONTRATO_ENAVIA_JARVIS_REAL_PR79_PR86.md

Modo da sessão: LOCAL-PR
Execute somente a PRXX indicada.
Não avance para a próxima PR.
Menos documentação, mais entrega funcional testada.
```

---

## 6. Resultado esperado ao final

- `/skills/run` real
- execução read-only de `SYSTEM_MAPPER`
- evidência de execução
- primeira skill com side effect seguro: `WRITE_EXECUTION_MEMORY`
- chat capaz de executar skill aprovada por payload explícito
- runner endurecido contra replay/erro/payload ruim
- segunda skill read-only útil: `CONTRACT_AUDITOR`
- orquestração simples ponta a ponta
- fechamento formal Jarvis Real v1
