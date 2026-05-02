# PR78 — Fechamento Skills Runtime Fase 1

Data: 2026-05-02
Tipo: PR-PROVA
Escopo: Tests-only + Docs-only minimo
Contrato: CONTRATO_ENAVIA_SKILLS_RUNTIME_PR69_PR78.md

## Objetivo
Validar ponta a ponta da Fase 1 do Runtime de Skills:
proposal-only -> /skills/propose -> approval gate -> SYSTEM_MAPPER read-only limitada -> chat controlado.

## O que existe
- `buildSkillExecutionProposal()` ativo e proposal-only.
- `POST /skills/propose` ativo e retornando `skill_execution` + `proposal_id` + `proposal_status`.
- `POST /skills/approve` ativo (proposal gating sem execucao real).
- `POST /skills/reject` ativo (proposal gating sem execucao real).
- `buildSystemMapperResult()` ativo em `mode=read_only`, com `executed=false` e `executed_readonly=true` quando permitido.
- `SYSTEM_MAPPER` com bloqueio quando `require_approved_proposal=true` sem `approved`.
- `chat_skill_surface` aditivo somente para `skill_execution.status=proposed`.
- `/chat/run` preserva `reply` e `use_planner`; `skill_execution` e `chat_skill_surface` seguem aditivos.
- Self-Audit e Response Policy permanecem no fluxo.

## O que ainda NAO existe
- Rota `/skills/run` (continua inexistente nesta fase).
- Execucao automatica de skill com side effect.
- Uso de KV para runtime de skills desta fase.
- Binding novo para runtime de skills desta fase.
- Escrita automatica de memoria por skill runtime.
- Endpoint novo fora de `/skills/propose`, `/skills/approve` e `/skills/reject`.

## Resultado do fechamento
- Fase 1 validada funcionalmente com governanca proposal-gated e skill read-only limitada.
- Estado mantido: proposal primeiro, execucao real fora do escopo desta fase.
