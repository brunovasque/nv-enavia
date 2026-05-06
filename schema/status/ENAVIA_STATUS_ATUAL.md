# ENAVIA — Status Atual

**Data:** 2026-05-05 (atualizado após PR110 — Trigger em Linguagem Natural via Chat ✅ APROVADO)
**Branch ativa:** `copilot/pr110-trigger-linguagem-natural`
**Última tarefa:** PR110 — Trigger em Linguagem Natural via Chat ✅

## Atualização PR110 — Trigger em Linguagem Natural via Chat ✅ — 2026-05-05

- Branch: `copilot/pr110-trigger-linguagem-natural`
- PR GitHub: (a abrir)
- Tipo: PR-IMPL (bridge chat → ciclo de autoevolução)
- Contrato: `docs/CONTRATO_ENAVIA_CHAT_TRIGGER_PR110.md` ✅
- PR anterior: PR109 ✅ (copilot/pr109-fix-ciclo-prova-real, PR #276, aguarda merge)

### Commits executados

| # | Hash | Entrega |
|---|------|---------|
| 1 | 5096066 | `schema/enavia-intent-classifier.js` — IMPROVEMENT_REQUEST: intent, target, negações |
| 2 | 51e491f | `nv-enavia.js` — pending_plan execute_next + contrato check + confirmação |
| 3 | fe03264 | `nv-enavia.js` — _dispatchExecuteNextFromChat + pr_url na response |
| 4 | b4ff5df | `tests/pr110-chat-trigger.prova.test.js` — 60 cenários |

### Critérios de conclusão do contrato: 13/14 ✅ (1 pendente — aprovação humana)

- [x] IMPROVEMENT_REQUEST adicionado ao classificador com termos gatilho
- [x] Negações próximas ao gatilho resultam em intent diferente
- [x] Target extraído e retornado no resultado da classificação
- [x] handleChatLLM detecta IMPROVEMENT_REQUEST e cria pending_plan
- [x] pending_plan tem TTL de 5 minutos (300s)
- [x] Usuário recebe mensagem de confirmação com target identificado
- [x] confidence=low sem target → pede clarificação, não cria pending_plan
- [x] _dispatchFromChat suporta action === "execute_next"
- [x] Response do chat inclui pr_url quando PR foi aberta
- [x] Contrato ativo verificado antes de criar pending_plan
- [x] Testes: classificador com mínimo 15 cenários (60 total)
- [x] Testes: fluxo completo chat→confirmação→PR com mock do execute-next
- [x] Nenhum teste anterior (PR50, PR60) quebrado
- [ ] PR revisada e aprovada por Bruno ← PENDENTE

### Resultado geral: 60 testes passando, 0 falhas

**Veredito:** APROVADO PARA MERGE — aguarda revisão de Bruno.

## Status anterior PR109 — Fix Ciclo Codex + Prova Real ✅ APROVADO

- Branch: `copilot/pr109-fix-ciclo-prova-real`
- PR GitHub: #276 (aguarda merge por Bruno)
- Testes: 44/44 passando
- PR real de prova: #277 aberta e fechada ✅

## Próxima PR planejada: PR111

- Deploy real supervisionado (após merge de PR110 por Bruno)
- Enavia faz deploy da PR para ambiente TEST automaticamente
- Bruno valida em TEST e aprova PROD

## Status anterior PR108 — Motor de Patch + Orquestrador Self-Patch ✅ — mergeado via PR #275

- Branch: `copilot/pr108-motor-patch-orquestrador`
- PR GitHub: [#275](https://github.com/brunovasque/nv-enavia/pull/275) — mergeada em main ✅
- Tipo: PR-IMPL (fundação do ciclo de autoevolução)
- Contrato: `docs/CONTRATO_ENAVIA_MOTOR_PATCH_PR108.md` ✅
- PR anterior validada: PR107 ✅ (mergeada como PR #274)
