# Memória: Ciclo Jarvis Brain PR31–PR60

**Tipo:** decisão de arquitetura + aprendizado consolidado de ciclo
**Fonte:** PR31–PR60 (`CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`) + relatórios individuais
**Data:** 2026-05-01
**Estado:** Ativa

---

## 1. Objetivo do ciclo

Transformar a Enavia de sistema governado/documental em uma IA operacional viva — com LLM Core, Memory Brain (Obsidian Brain), Intent Classifier, Skill Router, Intent Retrieval, Self-Audit e Response Policy.

Frase central do contrato:
> "A Enavia pensa livremente, lembra com estrutura, sugere com inteligência e executa somente com governança."

---

## 2. Módulos criados no ciclo

| Módulo | Arquivo | PR | Estado |
|--------|---------|-----|--------|
| Brain Loader read-only | `schema/enavia-brain-loader.js` | PR43 | Ativo |
| LLM Core v1 | `schema/enavia-llm-core.js` | PR46 | Ativo |
| Intent Classifier v1 | `schema/enavia-intent-classifier.js` | PR49 | Ativo |
| Skill Router read-only | `schema/enavia-skill-router.js` | PR51 | Ativo |
| Intent Retrieval v1 | `schema/enavia-intent-retrieval.js` | PR53 | Ativo |
| Self-Audit read-only | `schema/enavia-self-audit.js` | PR56+PR58 | Ativo |
| Response Policy viva | `schema/enavia-response-policy.js` | PR59 | Ativa |
| Self-Audit Framework | `schema/self-audit/` (8 arquivos) | PR55 | Documental |
| Obsidian Brain estrutura | `schema/brain/` (skeleton) | PR39–PR41 | Documental |

---

## 3. Sequência resumida das PRs

| PR | Tipo | Objetivo | Resultado |
|----|------|----------|-----------|
| PR31 | PR-DOCS | Ativação do contrato Jarvis Brain v1 | Governança religada |
| PR32 | PR-DIAG | Diagnóstico do chat engessado | Causa raiz identificada (7 camadas) |
| PR33 | PR-DOCS | Ajuste do contrato pós-PR32 | Nova frente corretiva inserida, contrato ampliado para PR64 |
| PR34 | PR-DIAG | Diagnóstico profundo read_only + target + sanitizers | 7 camadas técnicas refinadas |
| PR35 | PR-DOCS | Mode Policy criada | 3 modos canônicos, read_only como gate |
| PR36 | PR-IMPL | Correção inicial chat runtime | Anti-bot base, sanitizers cirúrgicos, isOperationalMessage |
| PR37 | PR-PROVA | Prova anti-bot PR36 | 51/56 (5 achados) |
| PR38 | PR-IMPL | Correção achados PR37 | 56/56 |
| PR39 | PR-DOCS | Arquitetura Obsidian Brain | Brain skeleton criado |
| PR40 | PR-DOCS | Self Model da Enavia | Identidade, capacidades, limites |
| PR41 | PR-DOCS | Popular Obsidian Brain | Brain populado com conhecimento consolidado |
| PR42 | PR-DIAG | Diagnóstico memória runtime | ENAVIA_BRAIN existe, brain não conectado |
| PR43 | PR-IMPL | Brain Loader read-only | brain-loader.js, snapshot estático, 4.000 chars |
| PR44 | PR-PROVA | Prova Brain Loader | 38/38 |
| PR45 | PR-DIAG | Diagnóstico prompt pós-Brain | Prompt medido, redundância identificada |
| PR46 | PR-IMPL | LLM Core v1 | llm-core.js, -449 chars/-112 tokens |
| PR47 | PR-PROVA | Prova LLM Core | 75/79 (4 achados: truncamento brain) |
| PR48 | PR-IMPL | Correção truncamento brain | PR47 passa 79/79 |
| PR49 | PR-IMPL | Intent Classifier v1 | 15 intenções canônicas |
| PR50 | PR-PROVA | Prova Classificador | 124/124 |
| PR51 | PR-IMPL | Skill Router read-only | 4 skills documentais, roteamento determinístico |
| PR52 | PR-PROVA | Prova Skill Router | 202/202 |
| PR53 | PR-IMPL | Intent Retrieval v1 | buildIntentRetrievalContext, 2.000 chars |
| PR54 | PR-PROVA | Prova Memória Contextual | 93/93 |
| PR55 | PR-DOCS | Self-Audit Framework | 8 arquivos, 10 camadas, 48 checklists |
| PR56 | PR-IMPL | Self-Audit read-only | enavia-self-audit.js, 10 categorias |
| PR57 | PR-PROVA | Prova Self-Audit | 96/99 (3 falhas Cenário H) |
| PR58 | PR-IMPL | Correção Self-Audit (missing_source) | Regex fix, PR57 passa 99/99 |
| PR59 | PR-IMPL | Response Policy viva | 15 regras, integrado como campo aditivo |
| PR60 | PR-PROVA | Prova anti-bot final | 236/236, stack completa validada |

---

## 4. Decisões arquiteturais

### D1 — read_only é gate de execução, não regra de tom
- Origem: PR32 (diagnóstico), PR35 (Mode Policy), PR36 (implementação)
- read_only=true bloqueia execuções. Não restringe tom ou pensamento.
- Violação desta regra causou o maior incidente documentado (chat engessado).

### D2 — Stack cognitiva como campos aditivos
- Todos os módulos cognitivos (LLM Core, Brain Context, Intent Classifier, Skill Router, Intent Retrieval, Self-Audit, Response Policy) retornam campos aditivos no response.
- Nenhum módulo altera `reply` automaticamente.
- Cada campo é opcional e defensivo — falha isolada não derruba o sistema.

### D3 — isOperationalMessage usa termos compostos
- Palavras isoladas como "sistema" e "contrato" geram falsos positivos.
- Termos compostos como "estado do contrato", "contrato ativo" são mais precisos.
- Verbos imperativos técnicos ("revise", "verifique") ativam modo operacional.

### D4 — Brain Loader estático com allowlist hard-coded
- 7 fontes definidas em allowlist fixa.
- Limite de 4.000 chars com truncamento seguro.
- Sem FS/KV/rede — determinístico e seguro.

### D5 — Skills são documentais
- 4 skills: CONTRACT_LOOP_OPERATOR, DEPLOY_GOVERNANCE_OPERATOR, SYSTEM_MAPPER, CONTRACT_AUDITOR.
- Nenhuma skill executa automaticamente.
- /skills/run não existe.

### D6 — Self-Audit é read-only
- Detecta 10 categorias de risco: secret_exposure, fake_execution, unauthorized_action, scope_violation, contract_drift, false_capability, runtime_vs_documentation_confusion, wrong_mode, missing_source, docs_over_product.
- Não bloqueia fluxo programaticamente (exceto secret_exposure em modo blocking).
- Campo `self_audit` aditivo no response.

### D7 — Response Policy é orientação, não reescrita
- 15 regras de resposta.
- Orienta o LLM sobre como responder, não reescreve o reply mecanicamente.
- Campo `response_policy` aditivo no response.

---

## 5. Garantias de segurança

- Nenhuma execução sem contrato ativo e aprovação humana.
- Nenhuma skill executada automaticamente.
- Nenhum endpoint criado no ciclo (além dos já existentes).
- Nenhum KV/binding/secret alterado.
- Nenhum painel/executor/deploy worker/workflow alterado.
- Self-Audit detecta mas não bloqueia (exceto secret_exposure).
- Response Policy orienta mas não reescreve automaticamente.
- Todos os módulos cognitivos são campos aditivos defensivos.
- Falha em qualquer módulo cognitivo não derruba o sistema.

---

## 6. O que ficou ativo no runtime

| Componente | Integração | Como |
|------------|------------|------|
| Brain Context | `buildChatSystemPrompt` seção 7c | Snapshot estático Brain Loader |
| LLM Core v1 | `buildChatSystemPrompt` seções 1-4 consolidadas | buildLLMCoreBlock() |
| Intent Classifier | `/chat/run` response | campo `intent_classification` |
| Skill Router | `/chat/run` response | campo `skill_routing` |
| Intent Retrieval | `buildChatSystemPrompt` seção 7d | buildIntentRetrievalContext() |
| Self-Audit | `/chat/run` response | campo `self_audit` |
| Response Policy | `buildChatSystemPrompt` seção 7e | buildResponsePolicyPromptBlock() |

---

## 7. O que continua documental

- Obsidian Brain (`schema/brain/`) — não conectado ao runtime via API.
- Skills (4 documentadas) — nenhuma executada automaticamente.
- Self-Audit Framework (`schema/self-audit/`) — documentação das 10 camadas.
- Memórias do brain — consultadas via Brain Loader estático (snapshot).

---

## 8. O que não existe ainda

- `/skills/run` — endpoint de execução de skill não existe.
- Skill Executor runtime — executor que executa skills não implementado.
- Escrita automática de memória — nenhum módulo escreve no brain automaticamente.
- Self-Audit blocking mecânico — audit detecta mas não bloqueia fluxo (exceto secret_exposure).
- Response Policy rewrite — policy não reescreve reply mecanicamente.
- Memória de longo prazo dinâmica — brain é snapshot estático.

---

## 9. Aprendizados anti-bot

- Conversa simples deve continuar leve. Intent `conversation` não ativa modo operacional pesado.
- Frustração do operador não é pedido operacional. Intent `frustration` pede sinceridade, não checklist.
- Próxima PR pedida pelo operador é intent `next_pr_request` — resposta curta + prompt completo, sem modo pesado.
- Revisão de PR é intent operacional — ativa CONTRACT_AUDITOR, mas sem falsa aprovação.
- Deploy exige gate — DEPLOY_GOVERNANCE_OPERATOR, unauthorized_action detectado, aprovação exigida.
- Estratégia deve continuar viva — não robótica, não lista de bullets genérica.
- read_only como gate, não tom — nota factual sem modo operacional pesado.

---

## 10. Aprendizados sobre falsa capacidade

- Enavia não simula execução de skill que não existe.
- `/skills/run` não existe — qualquer afirmação do contrário é falsa capacidade.
- `false_capability` é categoria de Self-Audit que detecta esse risco.
- Response Policy tem regra `false_capability` que orienta a não fingir runtime.
- Intent Classifier identifica `skill_request` para ativar roteamento correto (read-only).

---

## 11. Aprendizados sobre excesso documental

- Documentação bonita sem produto é risco real. (Chamado `docs_over_product` no Self-Audit.)
- PR-DOCS e PR-DIAG têm valor, mas não substituem PR-IMPL com teste.
- Brain Loader trunca em 4.000 chars — mais documentação não significa mais contexto útil.
- Prompt bloat foi medido na PR45: Brain Context = +4.002 chars/+1.000 tokens constantes.
- Economia com LLM Core: -449 chars/-112 tokens — consolidação vale.

---

## 12. Aprendizados sobre gates e contrato

- Contrato tem prioridade sobre intuição do agente.
- Diagnóstico antes de implementar evita regressão (PR32→PR36 vs. PR47→PR48).
- Prova antes de fechar frente — sem PR-PROVA, frente não está concluída.
- Mixing de escopos (Worker + Docs + Panel na mesma PR) é vetado e gera confusão.
- Finding documentado em PR-PROVA deve virar PR-IMPL corretiva separada (PR57→PR58).
- Nunca marcar PR como concluída sem evidência real de teste.

---

## 13. Próximos passos seguros

1. **PR61** (esta PR) — Proposta de atualização de memória. Documental/IMPL.
2. **PR62** — PR-DIAG — Planejamento da próxima fase pós-Jarvis Brain.
   - Ou PR-DOCS se a memória estiver incompleta.
3. **Finding I1** — Corrigir em PR futura separada quando contrato autorizar:
   - Adicionar "você já consegue" e variantes à `_CAPABILITY_TERMS` do classificador.
4. **Skill Executor** — Implementar apenas quando contrato nova fase autorizar.
5. **Escrita automática de memória** — Implementar apenas com PR-DIAG + PR-IMPL + PR-PROVA dedicadas.
