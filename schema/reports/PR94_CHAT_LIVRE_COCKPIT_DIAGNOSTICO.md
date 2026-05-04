# PR94 — Diagnóstico Chat Livre + Cockpit

**Data:** 2026-05-04  
**Branch:** `copilot/pr94-diagnostico-chat-livre-cockpit`  
**Tipo:** PR-DIAG (READ-ONLY)  
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_CHAT_LIVRE_COCKPIT_OPERACIONAL_PR94_PR97.md`  

---

## 1. Onde o chat está engessando?

### 1.1 Engessamento por código real (runtime)

| Arquivo | Mecanismo | Impacto |
|---------|-----------|---------|
| `schema/enavia-cognitive-runtime.js` linha 350–355 | Contrato de envelope JSON: força `{"reply":"...","use_planner":...}` em TODA resposta | O LLM é obrigado a empacotar TODA fala em JSON — inclusive conversa casual. Não enriquece o conteúdo, mas cria barreira de formatação que pode induzir o LLM a ser mais mecânico. |
| `schema/enavia-cognitive-runtime.js` linhas 219–250 | Bloco `MODO OPERACIONAL ATIVO` com lista de 7 passos numerados | Quando `is_operational_context=true`, injeta 15+ linhas de regras rígidas. Se o classificador errar (falso positivo), conversa casual recebe o bloco operacional pesado. |
| `schema/enavia-cognitive-runtime.js` linhas 212–214 | `• Modo atual: read_only.` injetado sempre que há target | Aparece em TODA conversa com target ativo, incluindo conversa casual. Correto como fato, mas pode induzir tom de "modo restrito" mesmo em troca casual. |
| `schema/enavia-cognitive-runtime.js` linhas 263–276 | Proibição explícita de Fase/Etapa/Passo/headers no `reply` | Esta regra é boa — preserva conversa natural. Mas sua presença como lista de proibições contribui para o "tom de checklist" do system prompt. |
| `nv-enavia.js` (buildSystemPrompt interno) linhas ~730–760 | SYSTEM_PROMPT do KV como fonte primária, com fallback de engenharia mecânica | Fallback contém tom de "engenheira técnica especializada" com lista de regras 1/2/3. Esse fallback aparece quando KV não tem SYSTEM_PROMPT — cria engessamento se KV estiver vazio. |

### 1.2 Engessamento por prompt/runtime (system prompt)

| Origem | Mecanismo | Impacto |
|--------|-----------|---------|
| `schema/enavia-llm-core.js` | LLM Core v1 com ~25 linhas de regras (bullet points) de identidade + papel + tom + capacidades + guardrails | Conteúdo necessário e bem estruturado, mas a densidade de bullet points pode induzir o LLM a responder também em bullet points. Não é proibido, mas é um risco de mimetismo. |
| `schema/enavia-brain-loader.js` | Brain Snapshot com 7 blocos de texto documental (~4000 chars) | Grande volume de texto no system prompt. Custo cognitivo alto. Blocos de limitações ("Não executar sem contrato...") podem induzir tom de "modo bloqueado". |
| Contrato JSON `{"reply":"...","use_planner":...}` | Sempre presente, mesmo em conversa casual | O LLM sabe que está respondendo dentro de um JSON. Isso pode reduzir a naturalidade da fala. É um engessamento estrutural por envelope. |

### 1.3 Engessamento por response policy

| Arquivo | Mecanismo | Impacto |
|---------|-----------|---------|
| `schema/enavia-response-policy.js` | 11 regras de policy específicas por intenção/self_audit | As regras de policy são cirúrgicas e bem direcionadas. O engessamento ocorre quando `technical_diagnosis` ou `system_state_question` ativa `OPERATIONAL` como response_style em conversa que o usuário queria casual. |
| `schema/enavia-response-policy.js` linhas ~424–428 | Caso limpo para `technical_diagnosis` → `response_style=OPERATIONAL` | Uma pergunta técnica casual como "onde está o arquivo X?" ativa estilo OPERACIONAL desnecessariamente. |

### 1.4 Engessamento pelo painel

| Arquivo | Mecanismo | Impacto |
|---------|-----------|---------|
| `panel/src/chat/useTargetState.js` linhas 47, 72–77 | `ALLOWED_MODES = ["read_only"]` — modo write/patch/deploy bloqueado e permanentemente fixado | O modo `read_only` é fixado na UI — o usuário não pode alterá-lo. Isso é correto para segurança, mas é comunicado ao LLM via `target.mode=read_only` em TODAS as mensagens. |
| `panel/src/chat/TargetPanel.jsx` linha 66 | Campo `mode` exibe "read_only (fixo)" — não editável | Visual claramente restritivo. Ajuda segurança mas sinaliza "modo restrito" visualmente. |
| `panel/src/chat/QuickActions.jsx` | 5 botões fixos: Validar sistema, Gerar plano, Aprovar execução, Salvar na memória, Anexar contexto | Todos os quick actions são operacionais. Não há ação de "conversa livre" ou "modo casual". O painel induz que toda interação é operacional. |
| `panel/src/chat/useChatState.js` linhas 186–209 | Sempre monta `planner_brief` com `trigger_message + operator_intent` para qualquer mensagem | Todo envio inclui contexto de planner, mesmo para "oi" ou conversa casual. Comunica ao LLM que há sempre intenção operacional. |

### 1.5 Engessamento por testes

| Arquivo | Mecanismo |
|---------|-----------|
| `tests/pr84-chat-vivo.smoke.test.js` | Testa que `read_only` não aparece como "Modo read-only ativo" no reply — correto, mas não testa conversa realmente livre |
| `tests/pr59-response-policy-viva.smoke.test.js` | Testa policy por intenção — não testa ausência de policy em conversa limpa casual |

### 1.6 Engessamento por documentação

| Arquivo | Mecanismo |
|---------|-----------|
| Contratos históricos em `schema/contracts/active/` | Definem obrigatoriamente PR-DIAG antes de qualquer PR-IMPL — correto para governança, mas pode criar percepção de "sistema sempre em diagnóstico". |

---

## 2. Onde o painel ajuda?

| Componente | Ajuda |
|------------|-------|
| `TargetPanel.jsx` | Exibe target (worker, repo, branch, environment, mode) — contexto técnico real disponível ao LLM |
| `useTargetState.js` `ALLOWED_MODES=["read_only"]` | Garante que modo write/patch/deploy nunca vai parar no contexto do LLM sem aprovação |
| `QuickActions.jsx` "Aprovar execução" | Exibe gate explícito de aprovação humana antes de execução |
| `MessageBubble.jsx` badges `🎯 alvo ativo` e `🧠 memória aplicada` | Feedback visual ao operador de que o contexto operacional e memória estão sendo usados |
| `useChatState.js` `conversation_history` | Passa histórico de conversa ao LLM — permite continuidade real sem repetição |
| `useChatState.js` `planner_brief` | Passa intenção resumida ao backend — facilita PR Orchestrator quando ativo |

---

## 3. Onde o painel atrapalha?

| Componente | Problema |
|------------|----------|
| `useTargetState.js` `mode: "read_only"` fixo | Envia `mode=read_only` em TODA mensagem, incluindo conversa casual. O LLM sempre recebe sinal de "modo restrito" mesmo quando só quer conversar. |
| `QuickActions.jsx` — apenas ações operacionais | Sem botão de "conversa livre" ou indicador de modo casual. O painel visual induz que toda interação é operacional. |
| `useChatState.js` `planner_brief` sempre montado | Todo envio inclui contexto de planner — mesmo "oi, tudo bem?" vira payload com `trigger_message + operator_intent`. Sinaliza intenção operacional implícita para o LLM. |
| `TargetPanel.jsx` campo `mode: "read_only (fixo)"` | A tag "fixo" comunica restrição ao usuário, mas também reforça visualmente que o sistema está em modo restrito permanente. |

---

## 4. Quais arquivos comandam o comportamento real?

**Arquivos vivos (afetam runtime do chat):**

1. `nv-enavia.js` — Worker principal, roteamento de endpoints, chamada LLM, buildSystemPrompt interno (fallback)
2. `schema/enavia-cognitive-runtime.js` — `buildChatSystemPrompt()` — montagem do system prompt principal
3. `schema/enavia-llm-core.js` — `buildLLMCoreBlock()` — identidade + papel + tom + capacidades + guardrails
4. `schema/enavia-brain-loader.js` — `getEnaviaBrainContext()` — snapshot documental do Brain (~4000 chars)
5. `schema/enavia-response-policy.js` — `buildEnaviaResponsePolicy()` — política de resposta por intenção/self_audit
6. `schema/enavia-intent-classifier.js` — `classifyEnaviaIntent()` — classificação determinística de intenção
7. `schema/enavia-self-audit.js` — `runEnaviaSelfAudit()` — auditoria de riscos (fake execution, scope violation etc.)
8. `schema/enavia-intent-retrieval.js` — `buildIntentRetrievalContext()` — contexto documental por intenção
9. `schema/enavia-chat-skill-surface.js` — `buildChatSkillSurface()` — expõe proposta de skill no chat
10. `schema/enavia-capabilities.js` — `getEnaviaCapabilities()` — lista de capacidades reais/limitações
11. `panel/src/chat/useChatState.js` — estado do chat, envio de mensagens, `planner_brief`, histórico
12. `panel/src/chat/useTargetState.js` — gerencia target operacional, modo read_only fixo
13. `panel/src/chat/QuickActions.jsx` — ações rápidas operacionais
14. `panel/src/chat/TargetPanel.jsx` — painel de target operacional
15. `panel/src/chat/ChatComposer.jsx` — input de mensagem
16. `panel/src/chat/MessageBubble.jsx` — renderização de mensagens com badges
17. `contract-executor.js` — executor de contratos (todas as rotas operacionais)

---

## 5. Quais arquivos são só documentais?

**Arquivos docs-only (não afetam runtime):**

- `schema/contracts/active/*.md` — contratos históricos e ativo
- `schema/contracts/INDEX.md` — índice de contratos
- `schema/contracts/ACTIVE_CONTRACT.md` — ponteiro de contrato ativo
- `schema/reports/*.md` — relatórios de PRs anteriores
- `schema/status/ENAVIA_STATUS_ATUAL.md` — status de governança
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — handoff entre PRs
- `schema/execution/ENAVIA_EXECUTION_LOG.md` — log de execução
- `schema/brain/*.md` — memórias documentais do brain (snapshot estático, não lidas em runtime FS)
- `schema/hardening/*.md` — documentação de hardening
- `schema/skills-runtime/*.md` — blueprint do runtime de skills
- `CLAUDE.md` — regras operacionais do repo
- `schema/CODEX_WORKFLOW.md` — workflow do Codex
- `schema/LOCAL_CODEX_EXECUTION_CONTRACT.md` — contrato local
- `schema/MICROPHASES.md` — template de microfases

---

## 6. O que NÃO deve ser refatorado?

| Sistema | Motivo |
|---------|--------|
| PR Orchestrator PR90–PR93 (`schema/enavia-pr-planner.js`, `schema/enavia-pr-executor-supervised.js`, `schema/enavia-pr-readiness.js`) | Testado e funcional. Pipeline lógico completo PR91→PR92→PR93 provado com 178 asserts. |
| Deploy loop PR86–PR89 (`schema/enavia-deploy-loop.js`) | Loop interno Worker→Executor provado. Não tocar. |
| Skill Factory/Runner (`schema/enavia-skill-factory.js`, `schema/enavia-skill-runner.js`, `schema/enavia-skill-registry.js`) | Skills reais aprovadas. Não refatorar. |
| SELF_WORKER_AUDITOR (`schema/enavia-self-worker-auditor-skill.js`) | Auditoria do próprio worker em produção. Crítico. Não tocar. |
| Self-Audit (`schema/enavia-self-audit.js`) | 10 categorias de risco testadas com 99/99 asserts. Preservar. |
| Guardrails de segurança (`awaiting_human_approval=true`, `merge_allowed=false`, `prod_deploy_allowed=false`) | São freios de segurança. NUNCA remover. |
| Bloqueios de PROD/merge/secrets | Críticos. Não tocar. |
| Skill Approval Gate (`schema/enavia-skill-approval-gate.js`) | Gate de aprovação de skills. Não remover. |
| Response Policy Regras 1–6 (secret exposure, fake execution, false capability, runtime confusion, unauthorized action, scope drift) | São guardrails de integridade. Preservar. |

---

## 7. Menor patch recomendado para PR95 (Chat Livre Seguro)

**Conclusão: Opção E — Combinação mínima (response_policy + llm_core).**  
Máximo 5 mudanças. Foco: chat livre sem alterar painel.

| # | Arquivo | Mudança | Justificativa |
|---|---------|---------|---------------|
| 1 | `schema/enavia-response-policy.js` | Para `technical_diagnosis` e `system_state_question`, retornar `response_style=CONVERSATIONAL` em vez de `OPERATIONAL` quando não há self_audit bloqueante | Elimina o principal falso positivo que força tom operacional em perguntas técnicas casuais |
| 2 | `schema/enavia-llm-core.js` | Reduzir densidade do bloco de regras de tom — consolidar as 8 linhas de "TOM AO BLOQUEAR" em no máximo 3 linhas mais diretas | Reduz risco de mimetismo de bullet points pelo LLM sem perder as regras críticas |
| 3 | `schema/enavia-cognitive-runtime.js` | Tornar a injeção de `MODO OPERACIONAL ATIVO` (bloco de 15+ linhas) mais cirúrgica — ativar apenas quando `is_operational_context=true` E intenção for `execution_request` ou `deploy_request` (não `technical_diagnosis`) | Evita bloco operacional pesado para diagnóstico técnico casual |
| 4 | `schema/enavia-cognitive-runtime.js` | Remover a linha `• Modo atual: read_only...` do target informativo quando a mensagem for apenas conversa (intenção = `conversation` ou `identity`) | Evita sinalização de "modo restrito" em conversa casual mesmo com target ativo |
| 5 | `schema/enavia-response-policy.js` | Adicionar caso limpo explícito para `memory_request`, `skill_request` e `contract_request` com `response_style=CONVERSATIONAL` quando não há self_audit bloqueante | Evita que pedidos de info sobre skills/contratos recebam estilo OPERACIONAL desnecessariamente |

**Nota:** O envelope JSON (`{"reply":"...","use_planner":...}`) NÃO deve ser removido — é estrutural para o runtime. O LLM pode e deve usar isso de forma transparente.

---

## 8. Menor patch recomendado para PR96 (Cockpit Passivo)

Máximo 5 mudanças. Foco: cockpit passivo, sem alterar tom da IA.

| # | Arquivo | Mudança | Justificativa |
|---|---------|---------|---------------|
| 1 | `panel/src/chat/QuickActions.jsx` | Adicionar botão "💬 Conversa livre" que limpa target temporariamente do contexto (sem alterar sessionStorage) | Oferece ao operador um modo explícito de conversa casual sem contexto operacional |
| 2 | `panel/src/chat/useTargetState.js` | Adicionar campo `is_casual_mode` no target state — quando true, não envia target para o backend | Cockpit passivo: painel observa mas não força contexto operacional em modo casual |
| 3 | `panel/src/chat/TargetPanel.jsx` | Substituir "read_only (fixo)" por badge de intenção detectada (ex: "💬 casual" ou "⚙️ operacional") | Painel exibe intenção em vez de modo restrito — cockpit informativo |
| 4 | `panel/src/chat/useChatState.js` | Tornar `planner_brief` opcional — não montar quando `is_casual_mode=true` ou mensagem curta sem sinais operacionais | Elimina envio de contexto de planner em conversa casual |
| 5 | `panel/src/chat/MessageBubble.jsx` | Adicionar badge de intenção detectada na resposta da Enavia (ex: "💬 conversa" vs "⚙️ operacional") | Cockpit passivo: operador vê qual modo foi detectado sem que isso afete o LLM |

---

## 9. Riscos

| Risco | Classificação | Detalhe |
|-------|--------------|---------|
| PR95 quebra Response Policy sem perceber | Médio | Se a mudança na policy remover regras de segurança junto com regras de tom, guardrails podem cair. Mitigação: PR-PROVA antes de PR96. |
| PR96 "modo casual" contorna target de segurança | Médio | Se `is_casual_mode=true` for usado para evitar read_only gate em pedido operacional disfarçado de conversa. Mitigação: `is_casual_mode` só afeta tom/contexto, nunca afeta guardrails de execução. |
| LLM Core reduzido perde instrução crítica | Baixo | Se redução do bloco de tom remover instrução essencial de anti-bot. Mitigação: testes regressivos com PR84/PR59. |
| Envelope JSON removido quebra parser | Alto | Se alguém remover o contrato JSON, o parser do runtime quebra. Preservar obrigatoriamente. |
| Classificador com falso positivo (intent=technical_diagnosis para "oi") | Baixo | Já está bem calibrado. Não alterar na PR95 sem evidência. |

---

## 10. Conclusão: O que PR95 deve ser?

**Resposta: Opção E — Combinação mínima (response_policy + llm_core).**

Detalhamento:
- **A (response policy):** Parcialmente sim — mudança no caso `technical_diagnosis` e adição de caso limpo para mais intenções é de baixo risco e alto impacto.
- **B (llm core / prompt):** Parcialmente sim — redução da densidade de bullet points no bloco de tom reduz risco de mimetismo.
- **C (brain loader):** Não — o Brain Loader é documental e bem limitado (~4000 chars). Não é o gargalo.
- **D (painel):** Não na PR95 — o painel fica para PR96.
- **E (combinação mínima):** Sim — response_policy (A) + llm_core (B) com máximo 5 mudanças combinadas.

**Arquivos alvo da PR95:**
1. `schema/enavia-response-policy.js` — 2 mudanças
2. `schema/enavia-llm-core.js` — 1 mudança
3. `schema/enavia-cognitive-runtime.js` — 2 mudanças

**Total: 5 mudanças cirúrgicas.**

---

## Preservações confirmadas nesta PR (read-only)

- `nv-enavia.js` — **NÃO ALTERADO** ✅
- `executor/src/index.js` — **NÃO ALTERADO** ✅
- `contract-executor.js` — **NÃO ALTERADO** ✅
- `.github/workflows/deploy.yml` — **NÃO ALTERADO** ✅
- `wrangler.toml` — **NÃO ALTERADO** ✅
- `schema/enavia-response-policy.js` — **NÃO ALTERADO** ✅
- `schema/enavia-llm-core.js` — **NÃO ALTERADO** ✅
- Painel (`panel/**`) — **NÃO ALTERADO** ✅
- PR Orchestrator PR90–PR93 — **PRESERVADO** ✅
- Deploy loop PR86–PR89 — **PRESERVADO** ✅
- Skill Factory/Runner — **PRESERVADO** ✅
- SELF_WORKER_AUDITOR — **PRESERVADO** ✅

---

## Próxima PR autorizada

**PR95 — Chat Livre Seguro**  
Escopo: `schema/enavia-response-policy.js` (2 mudanças) + `schema/enavia-llm-core.js` (1 mudança) + `schema/enavia-cognitive-runtime.js` (2 mudanças).  
Tipo: PR-IMPL  
Requer: PR-DIAG (este relatório) como diagnóstico anterior confirmado.
