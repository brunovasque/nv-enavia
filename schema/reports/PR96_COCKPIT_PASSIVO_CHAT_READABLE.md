# PR96 — Cockpit Passivo + Chat Legível

**Data:** 2026-05-04  
**Branch:** `codex/pr96-cockpit-passivo-chat-readable`  
**Tipo:** PR-IMPL (Panel-only)  
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_CHAT_LIVRE_COCKPIT_OPERACIONAL_PR94_PR97.md`  
**PR anterior validada:** PR95 ✅

---

## Objetivo

Implementar cockpit passivo no painel e melhorar legibilidade do chat sem controlar tom da IA e sem alterar runtime cognitivo.

---

## O que foi corrigido

1. **Renderização legível no chat** (`panel/src/chat/MessageBubble.jsx`)
- Respostas passam a renderizar por blocos de parágrafo e listas simples.
- Markdown leve seguro (`**negrito**`, `` `code` ``) aplicado sem `dangerouslySetInnerHTML`.
- Conteúdo original é preservado; mudou apenas apresentação.

2. **`planner_brief` condicional** (`panel/src/chat/useChatState.js`)
- Helper local testável `shouldSendPlannerBrief()` adicionado.
- Conversa casual curta não envia `planner_brief` pesado.
- Pedidos operacionais/técnicos/PR/deploy/merge/patch/skill/contrato mantêm `planner_brief`.

3. **Copy de segurança suavizado** (`panel/src/chat/TargetPanel.jsx`)
- Badge visual de modo alterada para copy passiva: `Seguro` / `Protegido`.
- Informação crítica mantida: `Execução exige aprovação`.
- `read_only` continua forçado no estado e no payload.

4. **Cockpit passivo visual** (`panel/src/chat/TargetPanel.jsx` + `panel/src/pages/ChatPage.jsx`)
- Área discreta com metadata: intenção sugerida, modo sugerido, risco, próxima ação e aprovação necessária.
- Exibição é apenas informativa/passiva; não altera prompt nem backend.

5. **QuickActions com opção neutra** (`panel/src/chat/QuickActions.jsx` + `panel/src/pages/ChatPage.jsx`)
- Ação `💬 Conversa casual` adicionada.
- Botões operacionais preservados (`Validar sistema`, `Gerar plano`, `Aprovar execução`).
- Aprovação continua bloqueada quando não há plano pendente.

---

## O que não foi mexido

- `schema/enavia-response-policy.js`
- `schema/enavia-llm-core.js`
- `schema/enavia-cognitive-runtime.js`
- `nv-enavia.js`
- `executor/src/index.js`
- `contract-executor.js`
- `.github/workflows/deploy.yml`
- `wrangler.toml`
- PR Orchestrator PR90–PR93
- Deploy loop PR86–PR89
- Skill Factory/Runner
- SELF_WORKER_AUDITOR

---

## Testes

- Criado: `tests/pr96-cockpit-passivo-chat-readable.smoke.test.js` (50+ cenários)
- Regressão obrigatória executada: PR95, PR94, PR93, PR92, PR91, PR90, PR84, PR59

---

## O que fica para PR97

- Prova final integrada da frente PR94–PR97 com foco em:
  - conversa casual natural;
  - diagnóstico técnico legível;
  - pedido operacional com gate humano;
  - preservação completa dos guardrails;
  - validação final de contrato com avanço de fase.

---

## Rollback

```bash
git revert <commit-da-pr96>
```

Reverte apenas alterações de painel/chat UI e governança/testes da PR96.
