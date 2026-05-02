# CONTRATO ENAVIA — Skill Factory Real PR79–PR81

Status: Ativo
Tipo: contrato de autoevolução prática por criação de skills
Base: Fase 1 do Runtime de Skills concluída na PR78
Objetivo macro: permitir que a Enavia crie novas skills sob autorização humana, abra a mudança via repo/PR e execute skills autorizadas depois de integradas.

---

## 1. Verdade central

A Enavia não deve ser apenas uma executora de skills prontas.

A Enavia deve ser uma criadora de capacidade nova:

pedido humano -> entendimento -> skill spec -> aprovação -> criação de arquivos -> teste -> registro -> PR -> merge/deploy -> execução.

Isso é o começo real de autoevolução.

---

## 2. O que significa “criar uma skill”

Criar uma skill não é só responder texto.

Criar uma skill significa gerar uma mudança rastreável no repo com:

1. spec/contrato da skill;
2. arquivo da skill;
3. teste da skill;
4. registro/registry/allowlist;
5. documentação mínima de uso;
6. PR pronta para revisão humana;
7. depois do merge/deploy, skill executável.

A Enavia pode criar a skill quando o operador humano autorizar. A revisão/merge continuam humanos nesta fase.

---

## 3. Regra-mãe deste contrato

Poucas PRs. Entrega real.

Não criar cadeia longa de diagnósticos.
Não criar prova separada desnecessária.
Cada PR deve implementar e testar o comportamento principal.

Este contrato tem 3 PRs:

- PR79 — Skill Factory Core
- PR80 — Runner/Registry para skills criadas
- PR81 — Fechamento ponta a ponta Skill Factory Real

---

# PR79 — Skill Factory Core

Tipo: PR-IMPL
Escopo: Worker-only + GitHub/Repo workflow se já existir integração segura

## Objetivo

Criar a capacidade base para a Enavia transformar um pedido humano em uma skill nova pronta para PR.

## Resultado esperado

Quando o operador pedir “crie uma skill para X”, a Enavia deve gerar uma `skill_spec` estruturada e, com autorização explícita, preparar a alteração de repo para criar a skill.

## Implementação permitida

- criar módulo `schema/enavia-skill-factory.js`
- criar contrato/spec de skill em formato validável
- criar endpoint ou fluxo controlado:
  - `POST /skills/factory/spec` para gerar spec
  - `POST /skills/factory/create` para preparar criação após autorização
- criar teste forte `tests/pr79-skill-factory-core.smoke.test.js`
- atualizar status/handoff/execution log

## Contrato da skill_spec

A `skill_spec` deve conter:

- `skill_id`
- `purpose`
- `inputs`
- `outputs`
- `mode`: `read_only` ou `supervised_side_effect`
- `risk_level`
- `allowed_effects`
- `forbidden_effects`
- `files_to_create`
- `tests_to_create`
- `registry_changes`
- `approval_required=true`
- `human_review_required=true`

## Regras obrigatórias

- sem autorização explícita, só gera spec
- com autorização explícita, pode preparar plano de arquivos/patch
- se houver integração GitHub segura já disponível no repo/ambiente, pode criar branch/PR; se não houver, deve retornar patch/spec pronto para Codex/GitHub Agent aplicar
- não fazer deploy
- não alterar produção
- não executar skill recém-criada antes de merge/deploy
- não criar skill com side effect perigoso sem contrato explícito

## Proibido

- não executar comandos externos pelo Worker
- não escrever diretamente em produção
- não criar deploy automático
- não criar browser action
- não mexer em secrets
- não criar tabela/coluna sem contrato próprio

## Critério de aceite

A Enavia consegue transformar pedido humano em `skill_spec` validável e pacote de criação de skill pronto para PR/Agent.

---

# PR80 — Runner/Registry para skills criadas

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Criar o caminho para uma skill criada e mergeada entrar no registry/allowlist e ser executável via `/skills/run`.

## Resultado esperado

Depois que uma skill criada pela factory for mergeada/deployada, ela pode ser descoberta, validada e executada pelo runtime governado.

## Implementação permitida

- criar/ajustar registry de skills, preferencialmente `schema/enavia-skill-registry.js`
- criar/ajustar runner `schema/enavia-skill-runner.js`
- criar endpoint `POST /skills/run` se ainda não existir
- integrar `SYSTEM_MAPPER` como skill executável inicial
- permitir que skills registradas entrem no runner com contrato validado
- criar teste forte `tests/pr80-skill-registry-runner.smoke.test.js`
- atualizar status/handoff/execution log

## Regras obrigatórias

- executar apenas skill registrada
- executar apenas se approval válido existir
- bloquear skill desconhecida
- bloquear skill sem contrato
- bloquear side effects fora da allowlist da skill
- retornar `run_id`, `executed`, `side_effects`, `result`, `evidence`
- `/skills/run` deve ter erro controlado

## Proibido

- não executar skill não mergeada
- não executar patch/spec diretamente
- não fazer deploy
- não chamar GitHub sem contrato explícito
- não executar comando externo

## Critério de aceite

Runtime reconhece registry e executa skill registrada com approval. `SYSTEM_MAPPER` deve ser o primeiro caso funcional.

---

# PR81 — Fechamento ponta a ponta Skill Factory Real

Tipo: PR-IMPL + PR-PROVA
Escopo: Worker-only + Tests + Docs mínimo

## Objetivo

Provar o ciclo completo de autoevolução controlada:

pedido -> skill_spec -> autorização -> pacote/PR de skill -> registry -> execução governada.

## Teste final obrigatório

1. operador pede uma skill nova simples;
2. Enavia gera `skill_spec` válida;
3. sistema bloqueia criação sem autorização;
4. com autorização, gera pacote de criação da skill;
5. pacote inclui arquivo da skill, teste e registry change;
6. skill já registrada (`SYSTEM_MAPPER`) executa via `/skills/run`;
7. skill desconhecida bloqueia;
8. side effect fora da allowlist bloqueia;
9. resposta inclui evidência;
10. chat consegue explicar que criou/preparou a skill ou executou uma skill existente;
11. relatório final declara o que existe e o que ainda não existe.

## Relatório obrigatório

Criar `schema/reports/PR81_SKILL_FACTORY_REAL.md` com:

- o que a Enavia já consegue criar;
- como autorizar criação;
- como a skill entra no repo;
- o que depende de merge/deploy;
- o que ainda não existe.

## Critério de aceite final

Ao final da PR81, a Enavia pode ser chamada de Skill Factory Real v1:

- cria spec de skill;
- prepara criação de skill sob autorização;
- gera pacote/PR-ready;
- registra/executa skills integradas;
- bloqueia criação/execução insegura.

Ainda NÃO está autorizada a:

- fazer merge sozinha;
- fazer deploy sozinha;
- editar produção diretamente;
- executar comandos externos;
- mexer em secrets;
- side effects fora da allowlist.

---

## 4. Prompt padrão para Codex

```text
Leia e siga estritamente:
1. CLAUDE.md
2. schema/CODEX_WORKFLOW.md
3. schema/LOCAL_CODEX_EXECUTION_CONTRACT.md
4. schema/MICROPHASES.md
5. schema/contracts/ACTIVE_CONTRACT.md
6. schema/contracts/active/CONTRATO_ENAVIA_SKILL_FACTORY_REAL_PR79_PR81.md

Modo da sessão: LOCAL-PR
Execute somente a PRXX indicada.
Não avance para a próxima PR.
Foco: autoevolução prática por criação de skill, com autorização humana e PR rastreável.
```

---

## 5. Resultado esperado ao final

A Enavia terá o primeiro ciclo real de autoevolução:

- entende pedido de nova capacidade;
- transforma em skill spec;
- exige autorização;
- prepara arquivos/patch/PR para criar a skill;
- registra skill integrada;
- executa skill registrada;
- responde com evidência.
