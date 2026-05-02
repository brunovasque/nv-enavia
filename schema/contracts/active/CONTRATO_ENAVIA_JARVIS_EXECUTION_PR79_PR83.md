# CONTRATO ENAVIA — Jarvis Execution PR79–PR83

Status: Ativo
Tipo: contrato otimizado de execução real governada
Base: Fase 1 do Runtime de Skills concluída na PR78
Objetivo macro: sair de proposta/approval apenas e entregar execução real governada, auditável e acionável no chat, com poucas PRs e qualidade alta.

---

## 1. Estado de partida

A Fase 1 entregou:

- `buildSkillExecutionProposal()` proposal-only
- `POST /skills/propose`
- `POST /skills/approve`
- `POST /skills/reject`
- approval gate proposal-only
- `SYSTEM_MAPPER` read-only como módulo puro
- `chat_skill_surface` no `/chat/run`
- `/skills/run` ainda inexistente
- nenhuma execução com side effect

A partir deste contrato, a Enavia deve começar a executar de verdade, mas com governança.

---

## 2. Regra-mãe deste contrato

Menos PRs. Mais entrega funcional.

Cada PR precisa entregar código real ou validação final indispensável.

É proibido criar PR só para documentação intermediária.
É proibido repetir prova pequena se a própria PR já tiver teste forte e regressão completa.
É proibido criar mais de uma PR para a mesma transição se uma PR bem testada resolver.

---

## 3. Objetivo final do contrato

Ao final da PR83, a Enavia deve conseguir:

1. receber intenção no chat;
2. propor skill;
3. gerar `proposal_id`;
4. aprovar proposta;
5. executar skill aprovada via `/skills/run`;
6. retornar resultado real da skill;
7. registrar evidência mínima/audit log da execução;
8. expor no chat que uma execução real governada aconteceu;
9. bloquear qualquer execução não aprovada, desconhecida ou fora da allowlist.

Isto é o primeiro comportamento tipo Jarvis real: ação executada com contrato, aprovação, prova e resposta.

---

## 4. Sequência otimizada

Este contrato tem 5 PRs.

- PR79 — `/skills/run` read-only para `SYSTEM_MAPPER`
- PR80 — Audit log mínimo e evidência de execução
- PR81 — Chat aciona fluxo governado de execução já aprovada, sem automatismo perigoso
- PR82 — Hardening final: idempotência, replay, erros e limites
- PR83 — Fechamento ponta a ponta Jarvis Execution v1

Não criar PRs extras sem bloqueio real.

---

# PR79 — `/skills/run` read-only para SYSTEM_MAPPER

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Criar o primeiro endpoint real de execução governada: `POST /skills/run`, limitado exclusivamente à skill `SYSTEM_MAPPER` e somente após approval válido.

## Resultado esperado

A Enavia deve conseguir executar `SYSTEM_MAPPER` com resultado real read-only, sem side effects perigosos.

## Implementação permitida

- alterar `nv-enavia.js`
- criar módulo runner, preferencialmente `schema/enavia-skill-runner.js`
- reutilizar `buildSystemMapperResult()`
- reutilizar approval gate existente
- criar teste forte específico em `tests/pr79-skills-run-system-mapper.smoke.test.js`
- atualizar status/handoff/execution log

## Contrato do endpoint

Endpoint:

- `POST /skills/run`

Entrada mínima:

- `proposal_id`
- `skill_id`

Regras:

- só aceita `SYSTEM_MAPPER`
- só executa se proposal estiver `approved`
- se proposal desconhecida, bloquear
- se proposal proposed/rejected/expired/blocked, bloquear
- se skill_id diferente de `SYSTEM_MAPPER`, bloquear
- se payload inválido, erro controlado
- método diferente de POST, `METHOD_NOT_ALLOWED`
- resposta deve incluir `executed=true` apenas quando rodou a skill read-only
- resposta deve incluir `executed_readonly=true` para sucesso
- `side_effects=false` sempre nesta PR
- não pode chamar fetch, KV, filesystem runtime, comando externo ou LLM externo

## Proibido

- não executar skill com side effect
- não criar persistência nova ainda
- não criar binding/KV/tabela/coluna
- não alterar wrangler.toml
- não alterar contract-executor.js
- não mexer em painel/deploy-worker/executor/workflows
- não executar nenhuma skill além de `SYSTEM_MAPPER`
- não executar automaticamente pelo chat ainda

## Testes obrigatórios

- sucesso: approve -> run `SYSTEM_MAPPER`
- bloqueio: sem approval
- bloqueio: proposal desconhecida
- bloqueio: proposal rejected
- bloqueio: proposal blocked
- bloqueio: skill fora da allowlist de execução
- erro: JSON inválido
- erro: método errado
- garantia: sem fetch/KV/FS/LLM/comando externo
- regressões PR69–PR78 relevantes

## Critério de aceite

`/skills/run` existe, mas é seguro, limitado e read-only.

---

# PR80 — Audit log mínimo e evidência de execução

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Registrar evidência mínima de execução para cada `/skills/run` bem-sucedido e bloqueado, sem criar dependência de banco.

## Resultado esperado

Toda execução deve retornar e registrar uma evidência auditável mínima: `run_id`, `proposal_id`, `skill_id`, status, timestamp, mode e motivo.

## Implementação permitida

- criar `schema/enavia-skill-run-audit.js`
- usar storage em memória por instância ou log estruturado em resposta
- criar endpoint read-only `GET /skills/runs/:run_id` somente se simples e seguro; se for muito invasivo, não criar endpoint e retornar evidência no próprio `/skills/run`
- atualizar `/skills/run` para incluir `run_evidence`
- criar teste forte `tests/pr80-skill-run-audit.smoke.test.js`
- atualizar status/handoff/execution log

## Regras

- não criar KV/binding/tabela nesta PR
- evidência pode ser in-memory/test-only, mas deve ficar claro
- toda resposta de run deve ter `run_id` ou `blocked_run_id`
- blocked também gera evidência de tentativa bloqueada
- não expor segredo
- não guardar payload bruto sensível

## Proibido

- não mexer em wrangler.toml
- não mexer em banco
- não chamar serviço externo
- não criar memória permanente ainda
- não ampliar skills além de `SYSTEM_MAPPER`

## Critério de aceite

Execução e bloqueios ficam auditáveis na resposta, com `run_id` e estrutura mínima.

---

# PR81 — Chat com execução governada já aprovada

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Permitir que o chat mostre claramente quando existe execução governada possível e quando uma execução read-only foi concluída, sem executar automaticamente no escuro.

## Resultado esperado

O chat deve diferenciar:

- proposta pendente
- proposta aprovada
- execução concluída
- execução bloqueada

## Implementação permitida

- alterar `nv-enavia.js` de forma pontual
- criar/expandir helper `schema/enavia-chat-skill-surface.js`
- permitir metadado aditivo `skill_run_surface`
- opcional: se o input do chat trouxer explicitamente `approved_proposal_id` + `run_skill=true`, executar `SYSTEM_MAPPER` via runner
- criar teste forte `tests/pr81-chat-governed-skill-run.smoke.test.js`
- atualizar status/handoff/execution log

## Regras

- não executar por interpretação solta de texto
- execução via chat só pode ocorrer com sinal explícito estruturado no payload
- nunca executar skill por simples frase livre
- manter `reply` natural e não robótico
- manter `use_planner`
- manter `skill_execution`, `chat_skill_surface` e novo `skill_run_surface` como campos aditivos

## Proibido

- não executar side effects
- não executar skill sem approval
- não chamar LLM externo novo
- não usar KV/banco
- não mexer em painel/workflows/deploy-worker/executor

## Critério de aceite

Chat consegue expor estado e resultado de execução governada, mas não dispara execução por acidente.

---

# PR82 — Hardening final do runner

Tipo: PR-IMPL
Escopo: Worker-only + Tests

## Objetivo

Blindar o runner contra repetição indevida, replay simples, payload grande, status inválido e erro parcial.

## Resultado esperado

`/skills/run` deve ficar robusto o suficiente para uso inicial real.

## Regras obrigatórias

- limitar tamanho de payload
- validar JSON e campos obrigatórios
- bloquear run repetido do mesmo proposal se já executado na instância
- bloquear skill fora da allowlist de execução
- garantir resposta padronizada para erro
- garantir que erros não vazem stack/secret
- manter `/skills/run` limitado a `SYSTEM_MAPPER`
- manter `side_effects=false`

## Proibido

- não ampliar para deploy/browser/file write
- não criar persistência externa
- não mexer em wrangler.toml
- não mudar contrato de endpoints antigos sem necessidade

## Critério de aceite

Runner resiste a casos ruins e continua passando regressões completas.

---

# PR83 — Fechamento Jarvis Execution v1

Tipo: PR-PROVA
Escopo: Tests-only + Docs-only mínimo

## Objetivo

Provar ponta a ponta que a Enavia executa como Jarvis v1 governado para `SYSTEM_MAPPER`:

propor -> aprovar -> executar -> evidenciar -> expor no chat.

## Implementação permitida

- criar teste final `tests/pr83-jarvis-execution-v1.fechamento.test.js`
- criar relatório `schema/reports/PR83_JARVIS_EXECUTION_V1.md`
- atualizar status/handoff/execution log
- atualizar ACTIVE_CONTRACT como concluído

## Teste final obrigatório

Cenário ponta a ponta:

1. chat ou endpoint gera proposta para `SYSTEM_MAPPER`
2. `/skills/propose` retorna `proposal_id`
3. `/skills/approve` aprova
4. `/skills/run` executa read-only
5. resultado contém mapa do sistema
6. run evidence existe
7. chat expõe execução governada/concluída via metadado
8. tentativa sem approval bloqueia
9. tentativa de skill desconhecida bloqueia
10. replay indevido bloqueia
11. `/skills/run` não executa side effect
12. regressões PR69–PR82 passam

## Critério de aceite final

Ao final da PR83, a Enavia está autorizada a ser chamada de Jarvis Execution v1 para execução read-only governada de `SYSTEM_MAPPER`.

Ainda NÃO estará autorizada a:

- escrever memória automaticamente
- alterar arquivos
- abrir PR sozinha
- fazer deploy
- acionar browser executor
- executar skill com side effect

Essas capacidades exigem contrato próprio, mas agora a espinha dorsal de execução real estará pronta.

---

## 5. Prompt padrão para Codex

Usar por PR:

```text
Leia e siga estritamente:
1. CLAUDE.md
2. schema/CODEX_WORKFLOW.md
3. schema/LOCAL_CODEX_EXECUTION_CONTRACT.md
4. schema/MICROPHASES.md
5. schema/contracts/ACTIVE_CONTRACT.md
6. schema/contracts/active/CONTRATO_ENAVIA_JARVIS_EXECUTION_PR79_PR83.md

Modo da sessão: LOCAL-PR
Execute somente a PRXX indicada.
Não avance para a próxima PR.
Menos documentação, mais entrega funcional testada.
```

---

## 6. Regra de eficiência

Cada PR deve vir com:

- patch funcional;
- teste da própria PR;
- regressão essencial;
- rollback;
- atualização mínima de status/handoff/log.

Não criar PR separada só para provar algo que já pode ser provado no teste forte da mesma PR.

---

## 7. Resultado esperado ao final

Ao final da PR83, a Enavia terá:

- `/skills/run` real;
- execução read-only de `SYSTEM_MAPPER`;
- approval obrigatório;
- evidência de execução;
- chat consciente da execução;
- bloqueio de execução insegura;
- base real para próximas skills com side effect supervisionado.
