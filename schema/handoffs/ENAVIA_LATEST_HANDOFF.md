# ENAVIA — Latest Handoff

**Data:** 2026-05-05
**De:** PR110 — Trigger em Linguagem Natural via Chat ✅ (branch: copilot/pr110-trigger-linguagem-natural)
**Para:** PR111 — Deploy real supervisionado (após merge de PR110)

## Handoff atual — PR110 ✅ APROVADO PARA MERGE (aguarda revisão Bruno)

### O que foi feito

4 commits na branch `copilot/pr110-trigger-linguagem-natural`:

1. **feat(pr110): IMPROVEMENT_REQUEST no classificador de intent** — `schema/enavia-intent-classifier.js`:
   - Novo intent `IMPROVEMENT_REQUEST` com 24 termos gatilho
   - Extração de target: rotas /X, subsistemas (audit, chat, propose...), padrões de log/erro
   - Detecção de negação nos 40 chars anteriores ao gatilho
   - Confidence: high (2+ gatilhos + target), medium (1 gatilho + target), low (sem target)
   - Campo `target` retornado no resultado

2. **feat(pr110): pending_plan e confirmação em handleChatLLM** — `nv-enavia.js`:
   - Bloco PR110 após intent classification, antes do Skill Router
   - confidence=low ou sem target → pede clarificação (não cria pending_plan)
   - Com target → verifica contrato ativo em KV (`contract:index`)
   - Contrato ausente → explica ao usuário
   - Contrato presente → cria pending_plan com action: "execute_next", TTL=300s
   - Mensagem: "Entendi. Posso auditar e abrir uma PR em [target]. Confirma? (sim/não)"

3. **feat(pr110): _dispatchFromChat para execute_next** — `nv-enavia.js`:
   - Novo helper `_dispatchExecuteNextFromChat`: chama executor `/propose` via `env.EXECUTOR`
   - `_dispatchFromChat` desvia para o helper quando `pendingPlan.action === "execute_next"`
   - Response do chat_bridge inclui `pr_url` quando PR aberta
   - Reply: "PR aberta: [url] — revise e aprove o merge quando estiver pronto."

4. **test(pr110): classificador + fluxo chat→PR com mocks** — `tests/pr110-chat-trigger.prova.test.js`:
   - 60 cenários em 3 grupos (supera mínimo de 15 do contrato)
   - Grupo 1 (28): classificador — intent, target, negações, invariantes
   - Grupo 2 (22): pending_plan shape, TTL, mensagens
   - Grupo 3 (10): regressões PR49 inalteradas

### Estado atual

- Testes: 60/60 passando ✅
- Regressões: PR50 124/124 ✅, PR60 236/236 ✅
- PR GitHub: (ver link na PR aberta)
- Veredito: APROVADO PARA MERGE ✅

### O que PR111 pode usar (após merge da PR110)

1. `classifyEnaviaIntent` retorna `IMPROVEMENT_REQUEST` com `target`
2. pending_plan com `action: "execute_next"` funciona via chat_bridge
3. `_dispatchExecuteNextFromChat` chama executor `/propose` diretamente
4. Fluxo completo: "melhora o /audit" → confirmação → "sim" → PR aberta com `pr_url`

### Pendências antes de iniciar PR111

- Merge da PR110 aprovado por Bruno ← GATE OBRIGATÓRIO

### Próxima PR (PR111) — Deploy real supervisionado

- Objetivo: após PR aberta, deploy automático para ambiente TEST
- Bruno valida em TEST e aprova PROD
- Ciclo completo: chat → PR → deploy TEST → aprovação → PROD
