# CONTRATO ENAVIA — Autoevolução Operacional PR82–PR85

Status: Ativo
Tipo: contrato curto, funcional e orientado a entrega real
Base: Skill Factory Real v1 concluída na PR81
Objetivo macro: usar a Skill Factory para criar a primeira skill real de autoauditoria e atacar as duas dores operacionais principais: loop de deploy incompleto e IA engessada.

---

## 1. Diretriz executiva

Eficiência sem enrolação.

Este contrato existe para colocar a Enavia para trabalhar no próprio sistema de forma supervisionada, com foco em funcionamento real, não em documentação infinita.

Regras:

- diagnóstico só quando for necessário para corrigir;
- cada PR precisa entregar código/teste/resultado verificável;
- não criar PR apenas documental, salvo relatório final de fechamento;
- não misturar correção de deploy com correção do chat na mesma PR;
- preservar tudo que já funciona;
- patch cirúrgico;
- sempre com teste e rollback.

---

## 2. Frentes do contrato

Este contrato cobre 3 frentes práticas:

1. **Skill real de autoauditoria:** `SELF_WORKER_AUDITOR`.
2. **Loop de deploy:** diagnosticar e completar o fluxo que hoje está parcialmente configurado.
3. **IA engessada:** deixar o chat mais vivo, útil e operacional sem perder segurança.

---

## 3. Sequência otimizada

Este contrato tem 4 PRs:

- PR82 — `SELF_WORKER_AUDITOR` v1 + diagnóstico das 3 frentes
- PR83 — Corrigir loop de deploy
- PR84 — Corrigir IA engessada
- PR85 — Fechamento operacional ponta a ponta

Não criar PR extra sem bloqueio real comprovado.

---

# PR82 — SELF_WORKER_AUDITOR v1 + diagnóstico das 3 frentes

Tipo: PR-IMPL
Escopo: Worker-only + Tests + Docs mínimo

## Objetivo

Criar a primeira skill real de autoevolução: `SELF_WORKER_AUDITOR`.

Ela deve auditar o próprio Worker/repo em modo seguro e gerar diagnóstico objetivo sobre:

- riscos de segurança;
- falta de telemetria/debug;
- endpoints frágeis;
- rotas sem teste;
- pontos onde o chat fica engessado;
- estado do loop de deploy;
- próximos patches recomendados.

## Implementação permitida

- criar `schema/enavia-self-worker-auditor-skill.js`
- registrar a skill no registry existente
- permitir execução via `/skills/run` apenas com approval válido
- criar `tests/pr82-self-worker-auditor.smoke.test.js`
- criar relatório curto `schema/reports/PR82_SELF_WORKER_AUDITOR.md`
- atualizar status/handoff/execution log

## Regras obrigatórias

- read-only;
- sem filesystem runtime dinâmico no Worker;
- sem comando externo;
- sem fetch;
- sem KV/banco;
- sem LLM externo novo;
- usar snapshot/imports estáticos ou payload fornecido no teste;
- retornar diagnóstico estruturado e pequeno;
- classificar achados por severidade: `critical`, `high`, `medium`, `low`, `info`;
- separar achados em categorias: `security`, `telemetry`, `deploy_loop`, `chat_rigidity`, `tests`, `governance`;
- recomendar no máximo 5 ações prioritárias.

## Critério de aceite

A Enavia passa a ter uma skill real para auditar seu próprio sistema e indicar exatamente o que corrigir nas próximas duas PRs.

---

# PR83 — Corrigir loop de deploy

Tipo: PR-IMPL
Escopo: Worker/Deploy workflow conforme diagnóstico da PR82

## Objetivo

Diagnosticar e completar o loop de deploy real da Enavia.

Fluxo esperado:

pedido -> plano -> aprovação -> deploy/test -> prova -> promote/prod ou rollback

## Implementação permitida

- diagnóstico read-only curto antes do patch;
- corrigir apenas o que estiver comprovadamente incompleto;
- pode tocar Worker/deploy-worker/workflows somente se o diagnóstico apontar necessidade;
- criar teste/smoke próprio `tests/pr83-deploy-loop.smoke.test.js` ou equivalente já usado no repo;
- atualizar status/handoff/execution log;
- criar relatório curto `schema/reports/PR83_DEPLOY_LOOP.md`.

## Proibido

- não reescrever deploy inteiro;
- não trocar arquitetura sem prova;
- não mexer no chat nessa PR;
- não mexer no painel se não for necessário;
- não criar deploy automático para produção sem aprovação;
- não tocar secrets.

## Critério de aceite

O loop de deploy precisa ficar claro e operacionalmente testável, com prova do caminho test/prod/rollback conforme o que já existe no repo.

---

# PR84 — Corrigir IA engessada

Tipo: PR-IMPL
Escopo: Chat/Cognitive runtime

## Objetivo

Reduzir o engessamento da IA no chat sem quebrar segurança, governança ou gates.

## Sintomas-alvo

- resposta robótica;
- excesso de contrato aparecendo no chat;
- tom travado;
- resposta longa demais;
- fala como auditor quando deveria conversar;
- incapacidade de ser direta e útil;
- confusão entre responder, diagnosticar e executar.

## Implementação permitida

- ajustar camada de resposta/policy/chat runtime de forma cirúrgica;
- preservar Self-Audit, Response Policy, LLM Core, Brain Loader, Intent Classifier e Skill Router;
- criar teste `tests/pr84-chat-vivo.smoke.test.js` ou equivalente;
- atualizar status/handoff/execution log;
- criar relatório curto `schema/reports/PR84_CHAT_VIVO.md`.

## Proibido

- não remover guardrails;
- não desativar Self-Audit/Response Policy;
- não mexer em deploy nessa PR;
- não criar nova arquitetura de chat;
- não aumentar prompt sem necessidade;
- não transformar resposta em JSON para usuário.

## Critério de aceite

O chat deve responder de forma mais viva, curta, útil e operacional, mantendo bloqueio contra falsa capacidade e ações não autorizadas.

---

# PR85 — Fechamento operacional ponta a ponta

Tipo: PR-PROVA
Escopo: Tests + Docs mínimo

## Objetivo

Provar que as 3 frentes funcionam juntas:

1. `SELF_WORKER_AUDITOR` roda e gera diagnóstico;
2. loop de deploy tem caminho claro/testável;
3. chat está menos engessado e continua seguro.

## Implementação permitida

- criar `tests/pr85-autoevolucao-operacional.fechamento.test.js`
- criar `schema/reports/PR85_AUTOEVOLUCAO_OPERACIONAL.md`
- atualizar status/handoff/execution log
- encerrar contrato em `ACTIVE_CONTRACT.md` e `INDEX.md`

## Critério de aceite

Ao final da PR85, a Enavia deve estar apta a receber pedidos do tipo:

- “audite seu Worker”;
- “me diga o que está impedindo o deploy loop”;
- “proponha melhoria de segurança”;
- “me responda sem parecer robô”.

Ainda com aprovação humana para qualquer alteração real.

---

## 4. Prompt padrão para execução

```text
Leia e siga estritamente:
1. CLAUDE.md
2. schema/CODEX_WORKFLOW.md
3. schema/LOCAL_CODEX_EXECUTION_CONTRACT.md
4. schema/MICROPHASES.md
5. schema/contracts/ACTIVE_CONTRACT.md
6. schema/contracts/INDEX.md
7. schema/contracts/active/CONTRATO_ENAVIA_AUTOEVOLUCAO_OPERACIONAL_PR82_PR85.md

Modo da sessão: LOCAL-PR
Execute somente a PRXX indicada.
Não avance para a próxima PR.
Foco: funcionamento real, patch cirúrgico, teste e rollback.
```

---

## 5. Resultado esperado ao final

- Enavia com skill real de autoauditoria;
- diagnóstico objetivo de segurança/telemetria/deploy/chat;
- loop de deploy corrigido/completado;
- chat menos engessado;
- fechamento testado e documentado;
- base para pedir melhorias futuras diretamente para a Enavia.
