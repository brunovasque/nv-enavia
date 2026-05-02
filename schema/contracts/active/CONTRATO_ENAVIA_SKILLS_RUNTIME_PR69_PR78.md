# CONTRATO ENAVIA — Skills Runtime PR69–PR78

Status: Ativo
Tipo: contrato de execução por microfases
Base: handoff pós-Jarvis Brain v1
Objetivo macro: transformar a base cognitiva/governada da Enavia em começo de execução real, sem voltar para ciclo pesado de documentação.

---

## 1. Diagnóstico de partida

A Enavia já possui base cognitiva e governança: LLM Core, Brain documental, Brain Loader read-only, Intent Classifier, Skill Router read-only, Intent Retrieval, Self-Audit read-only e Response Policy.

O problema atual é objetivo: ainda não existe Runtime de Skills operacional.

Ainda não existe:

- `schema/enavia-skill-executor.js`
- `/skills/propose`
- `/skills/run`
- approval gate técnico
- execução real de skills
- escrita automática/supervisionada de memória
- ações reais via chat

Regra de foco deste contrato:

> Blueprint já existe. Agora a prioridade é código pequeno, prova pequena e avanço funcional.

---

## 2. Regra-mãe

Contrato grande orienta.
Microfase executa.

Cada PR deve entregar uma unidade funcional ou uma prova objetiva.

É proibido transformar este contrato em novo ciclo longo de documentação.

Documentação só é permitida quando for necessária para registrar decisão, prova, rollback ou handoff da PR.

---

## 3. Sequência obrigatória

A ordem abaixo é mandatória, salvo bloqueio técnico comprovado.

Não pular endpoint antes do módulo.
Não criar `/skills/run` antes de `/skills/propose` validado.
Não executar side effect antes de approval gate técnico.
Não criar escrita de memória antes de existir skill que gere proposta validável.

---

# PR69 — Skill Execution Proposal read-only

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Criar o primeiro módulo real de proposta de execução de skill, sem endpoint e sem side effect.

## Arquivos permitidos

- `schema/enavia-skill-executor.js`
- `nv-enavia.js`
- teste smoke específico em `tests/`
- relatório curto em `schema/reports/`, se necessário

## Arquivos proibidos

- `wrangler.toml`
- `contract-executor.js`
- painel
- workflows
- secrets/bindings/env
- qualquer endpoint novo

## Requisitos

Criar `buildSkillExecutionProposal(input)`.

Entrada mínima esperada:

- `skillRouting`
- `intentClassification`
- `selfAudit`
- `responsePolicy`
- contexto básico do chat quando disponível

Saída aditiva esperada:

- `skill_execution.mode = "proposal"`
- `skill_execution.status = proposed | not_applicable | blocked`
- `skill_execution.skill_id`
- `skill_execution.reason`
- `skill_execution.requires_approval = true` quando proposto
- `skill_execution.side_effects = false`

Allowlist inicial:

- `CONTRACT_LOOP_OPERATOR`
- `CONTRACT_AUDITOR`
- `DEPLOY_GOVERNANCE_OPERATOR`
- `SYSTEM_MAPPER`

Deny-by-default para skill desconhecida.

Bloquear quando Self-Audit indicar risco blocking ou secret exposure.

## Proibido

- não executar skill
- não chamar fetch
- não usar KV
- não usar filesystem runtime
- não chamar LLM externo
- não criar endpoint
- não alterar reply/use_planner

## Critério de aceite

`skill_execution` aparece como campo aditivo no response do `/chat/run`, sem alterar `reply`, `use_planner` ou fluxo existente.

## Testes obrigatórios

- teste unit/smoke do módulo proposal-only
- teste de integração leve no `/chat/run` validando campo aditivo
- regressões de self-audit, response-policy e skill-router relevantes

## Rollback

Reverter commit da PR69.

---

# PR70 — Prova formal do Skill Execution Proposal

Tipo: PR-PROVA
Escopo: Tests-only

## Objetivo

Provar que a PR69 não executa skill e não gera side effects.

## Requisitos de teste

Cenários obrigatórios:

- skill conhecida gera proposta
- skill desconhecida fica blocked/not_applicable
- self_audit blocking bloqueia proposta
- secret_exposure bloqueia proposta
- conversa comum não gera proposta pesada
- `reply` permanece igual ao fluxo anterior
- `use_planner` permanece igual ao fluxo anterior
- nenhum endpoint novo existe

## Proibido

- não alterar runtime
- não criar endpoint
- não corrigir bug junto com prova, salvo se a prova revelar falha e a PR for convertida formalmente em correção separada

## Critério de aceite

Teste passa e prova que `skill_execution` é read-only/proposal-only.

## Rollback

Reverter commit da PR70.

---

# PR71 — Endpoint `/skills/propose`

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Criar endpoint read-only `/skills/propose` usando o módulo validado na PR69/PR70.

## Requisitos

- método permitido: POST
- entrada validada e pequena
- saída no mesmo contrato de `skill_execution`
- CORS correto se o padrão do Worker exigir
- sem KV
- sem execução real
- sem side effect
- sem `/skills/run`

## Proibido

- não criar approval gate ainda
- não criar execução real
- não mexer no painel
- não mexer em deploy-worker
- não mexer em workflows

## Critério de aceite

Endpoint retorna proposta read-only para skill conhecida e bloqueia/nega skill desconhecida.

## Testes obrigatórios

- smoke endpoint sucesso
- smoke endpoint skill desconhecida
- smoke endpoint risco blocking/secret
- regressões principais do chat

## Rollback

Reverter commit da PR71.

---

# PR72 — Prova formal do `/skills/propose`

Tipo: PR-PROVA
Escopo: Tests-only

## Objetivo

Provar que `/skills/propose` é seguro, read-only e não executa nada.

## Cenários obrigatórios

- contrato de entrada inválido retorna erro controlado
- proposta válida retorna `mode=proposal`
- skill desconhecida é negada
- risco blocking é negado
- endpoint não usa KV
- endpoint não chama rede externa
- `/skills/run` continua inexistente

## Critério de aceite

Prova completa sem alteração de runtime.

## Rollback

Reverter commit da PR72.

---

# PR73 — Approval Gate técnico proposal-only

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Criar estrutura de aprovação técnica para propostas, ainda sem execução real.

## Requisitos

- gerar `proposal_id`
- status: proposed | approved | rejected | expired | blocked
- aprovar/rejeitar de forma explícita
- persistência somente se já houver binding seguro e aprovado no repo
- se persistência não estiver clara, manter em modo sem persistência e documentar bloqueio

## Proibido

- não executar skill
- não criar `/skills/run`
- não mexer em produção
- não criar binding novo sem PR própria
- não criar tabela/coluna

## Critério de aceite

Existe gate técnico para aprovar/rejeitar proposta, sem execução real.

## Testes obrigatórios

- proposal criada
- approval permitido para proposal válida
- reject permitido
- proposal inexistente bloqueia
- proposal expirada/bloqueada não aprova

## Rollback

Reverter commit da PR73.

---

# PR74 — Prova do Approval Gate

Tipo: PR-PROVA
Escopo: Tests-only

## Objetivo

Provar que o gate impede execução sem aprovação e preserva deny-by-default.

## Critério de aceite

Nenhuma ação com side effect ocorre sem status approved.

## Rollback

Reverter commit da PR74.

---

# PR75 — Skill read-only limitada: SYSTEM_MAPPER

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Criar primeira skill read-only limitada, sem side effect, usando `SYSTEM_MAPPER`.

## Requisitos

- só mapear capacidades/estado já disponíveis no runtime
- não usar filesystem dinâmico
- não usar rede externa
- não usar KV se não estiver no gate aprovado
- retornar resultado estruturado pequeno
- exigir proposal aprovada quando aplicável

## Proibido

- não mexer no painel
- não criar deploy real
- não alterar contrato-executor
- não executar comandos externos

## Critério de aceite

Skill `SYSTEM_MAPPER` retorna mapa read-only limitado e auditável.

## Rollback

Reverter commit da PR75.

---

# PR76 — Prova da Skill SYSTEM_MAPPER

Tipo: PR-PROVA
Escopo: Tests-only

## Objetivo

Provar que `SYSTEM_MAPPER` é read-only, limitado e não vaza segredo.

## Critério de aceite

Skill funciona apenas dentro da allowlist e não faz side effect.

## Rollback

Reverter commit da PR76.

---

# PR77 — Integração controlada com chat

Tipo: PR-IMPL
Escopo: Worker-only

## Objetivo

Permitir que o chat mostre proposta/estado de skill de forma controlada, sem executar automaticamente.

## Requisitos

- resposta deve deixar claro quando é proposta, não execução
- manter Self-Audit e Response Policy como guardrails
- não alterar o tom geral do chat para modo robótico
- não executar skill automaticamente

## Proibido

- não criar side effect automático
- não alterar planner de forma invasiva
- não mexer no painel

## Critério de aceite

Usuário consegue pedir capacidade/ação e a Enavia responde com proposta governada, não promessa falsa.

## Rollback

Reverter commit da PR77.

---

# PR78 — Fechamento funcional da Fase 1 do Runtime de Skills

Tipo: PR-PROVA
Escopo: Tests-only + Docs-only mínimo

## Objetivo

Validar ponta a ponta proposal-only → endpoint propose → approval gate → skill read-only limitada → chat controlado.

## Critério de aceite

A Enavia ainda não é Jarvis total, mas passa a ter o primeiro ciclo real governado de skill read-only/proposal-gated.

## Proibido

- não criar `/skills/run` com side effect nesta fase
- não abrir nova frente documental
- não iniciar memória escrita

## Rollback

Reverter a última PR funcional quebrada e manter a fase anterior validada.

---

## 4. Regras duras do contrato

1. Uma PR por microfase.
2. Se PR-PROVA falhar, a próxima PR deve ser correção cirúrgica ou bloqueio formal.
3. Não avançar com endpoint se módulo não estiver provado.
4. Não avançar com execução se approval gate não estiver provado.
5. Não criar `/skills/run` neste contrato, salvo novo contrato explícito.
6. Não criar escrita de memória neste contrato.
7. Não misturar Worker, Panel, Deploy-worker, Executor, Workflows e Docs.
8. Toda PR deve ter teste objetivo.
9. Toda PR deve ter rollback claro.
10. Toda PR deve preservar comportamento existente do chat, salvo alteração explicitamente autorizada.

---

## 5. Prompt canônico para Codex local

Usar este bloco no Codex local para cada microfase:

```text
Leia e siga estritamente:
1. CLAUDE.md
2. schema/CODEX_WORKFLOW.md
3. schema/LOCAL_CODEX_EXECUTION_CONTRACT.md
4. schema/MICROPHASES.md
5. schema/contracts/active/CONTRATO_ENAVIA_SKILLS_RUNTIME_PR69_PR78.md

Modo da sessão: LOCAL-PR

Execute somente a PR indicada: PR<NUMERO>

Antes de alterar:
- faça diagnóstico read-only
- confirme objetivo
- confirme escopo permitido
- confirme escopo proibido
- liste arquivos prováveis

Depois:
- aplique patch cirúrgico
- rode os testes obrigatórios
- mostre diff resumido
- faça commit no branch da microfase
- faça push apenas no branch autorizado
- pare

Proibido:
- avançar para a próxima PR
- misturar escopos
- alterar produção
- mexer em secrets/bindings/env/banco sem contrato próprio
- criar endpoint fora da PR autorizada
- criar side effect antes do gate aprovado
```

---

## 6. Estado esperado ao final do contrato

Ao final da PR78, a Enavia deve ter:

- proposal engine real
- `/skills/propose` read-only
- approval gate técnico inicial
- uma skill read-only limitada validada
- chat capaz de expor proposta governada sem promessa falsa

E ainda não deve ter:

- execução com side effect livre
- `/skills/run` irrestrito
- escrita automática de memória
- deploy automático de skills
- autonomia sem aprovação
