# ENAVIA — Latest Handoff

**Data:** 2026-04-30
**De:** PR42 — PR-DIAG — Diagnóstico da Memória Atual no Runtime
**Para:** PR43 — PR-IMPL — Brain Loader read-only Worker-only

## O que foi feito nesta sessão

### PR42 — PR-DIAG — Diagnóstico da Memória Atual no Runtime

**Tipo:** `PR-DIAG` (read-only, nenhum runtime alterado)
**Branch:** `copilot/claudepr42-diag-memoria-runtime-brain`

**Objetivo:**
Diagnosticar como a memória atual da Enavia funciona no runtime. Mapear bindings,
chaves KV, fluxo de memória no chat, participação do painel e relação com o
Obsidian Brain documental. Preparar base técnica para PR43.

**Principais descobertas:**

1. **`ENAVIA_BRAIN` EXISTE** — KV binding real em `wrangler.toml` com IDs
   `722835b730dd44c79f6ff1f0cdc314a9` (PROD) e `235fd25ad3b44217975f6ce0d77615d0` (TEST).

2. **`DEPLOY_KV` e `PROOF_KV` não existem** no repo.

3. **`ENAVIA_GIT` e `GIT_KV` existem apenas no executor template** — não usados
   pelo worker principal.

4. **KV é único e multipropósito**: o `ENAVIA_BRAIN` concentra todos os namespaces
   (memória estruturada PM2, memória de treinamento, contratos, execução, planner,
   decisões, browser-arm).

5. **Fluxo legado (POST /)**: `buildBrain` carrega `brain:index` e `brain:train:*`
   do KV no boot. Injeção via `buildSystemPrompt` com score de relevância por tokens.
   Director memory injetada como mensagem system adicional.

6. **Fluxo LLM-first (POST /chat/run)**: pipeline PM2-PM9. Retrieval por PM3.
   Plano salvo em `planner:latest:<session_id>`. Pending plan salvo em
   `chat:pending_plan:<session_id>` com TTL de 600s.

7. **Painel**: envia `context.target` com toda mensagem. Sem botão "Salvar na
   memória" no chat. Memória manual via `MemoryPage`. Anexos locais (max 32KB),
   não persistidos no KV.

8. **Brain documental NÃO está conectado ao runtime**. `schema/brain/` é puramente
   documental. Nenhum arquivo é carregado automaticamente.

9. **Brain Loader via bundle estático é viável** para PR43. Allowlist de 6 arquivos
   do self-model + SYSTEM_AWARENESS, injetados em `buildChatSystemPrompt`.

10. **PR41 mergeada e validada** (PR #202 — relatório: `schema/reports/PR41_POPULAR_OBSIDIAN_BRAIN_REPORT.md`)

**Arquivos criados:**

1. `schema/reports/PR42_MEMORY_RUNTIME_DIAGNOSTICO.md` — relatório completo
   de 13 seções

**Arquivos atualizados (governança):**

2. `schema/contracts/INDEX.md`
3. `schema/status/ENAVIA_STATUS_ATUAL.md`
4. `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (este arquivo)
5. `schema/execution/ENAVIA_EXECUTION_LOG.md`

## Arquivos NÃO alterados

- `nv-enavia.js` (não tocado)
- `schema/enavia-cognitive-runtime.js` (não tocado)
- `contract-executor.js` (não tocado)
- `panel/` (nenhum arquivo tocado)
- `executor/` (não tocado)
- `.github/workflows/` (não tocado)
- `wrangler.toml` (não tocado)
- `wrangler.executor.template.toml` (não tocado)
- secrets, bindings, KV config (não tocados)
- contratos encerrados (não tocados)

## Próxima PR autorizada

**PR43 — PR-IMPL — Brain Loader read-only Worker-only**

Objetivo: implementar o Brain Loader no worker principal.
- Allowlist: 6 arquivos do self-model + SYSTEM_AWARENESS
- Bundle estático (Opção 1) — sem nova infra
- Ponto de injeção: `buildChatSystemPrompt` em `schema/enavia-cognitive-runtime.js`
- Limite: 4.000 chars total, 1.500 por arquivo
- Sem escrita, sem endpoint novo, sem painel, sem wrangler, sem workflows
- Smoke test: verificar que `/chat/run` retorna resposta com identidade da Enavia
  quando perguntado "quem você é?"

Todos os pré-requisitos confirmados por esta PR42. Implementação viável.

**Data:** 2026-04-30
**De:** PR40 — PR-DOCS — Self Model da Enavia
**Para:** PR41 — PR-DOCS — Migrar conhecimento consolidado para Brain

## O que foi feito nesta sessão

### PR40 — PR-DOCS — Self Model da Enavia

**Tipo:** `PR-DOCS` (Docs-only, nenhum runtime alterado)
**Branch:** `copilot/claude-pr40-docs-self-model-enavia`

**Objetivo:**
Criar o self-model documental da Enavia dentro do Obsidian Brain. O self-model define
quem a Enavia é, qual é o papel dela no projeto, quais capacidades ela tem hoje, quais
ainda não existem, quais limites deve respeitar, qual é o estado atual, como deve
responder ao operador, e como evitar voltar a parecer bot/checklist. Docs-only, não
implementa runtime, não conecta self-model ao chat.

**Arquivos criados:**

1. **`schema/brain/self-model/identity.md`**: Identidade da Enavia — LLM-first, propósito,
   5 modos (pensar/diagnosticar/planejar/sugerir/executar), sinceridade técnica, frase
   canônica obrigatória: "A Enavia é uma inteligência estratégica com ferramentas; não
   uma ferramenta com frases automáticas."

2. **`schema/brain/self-model/capabilities.md`**: Capacidades atuais confirmadas vs.
   capacidades ainda não existentes. Explicitamente marcadas: Brain Loader (futuro),
   LLM Core vivo (futuro), Intent Engine completo (futuro), Skill Router runtime (futuro),
   memória automática supervisionada (futura).

3. **`schema/brain/self-model/limitations.md`**: Limites reais. Inclui seção obrigatória
   "Limite não é personalidade" — explica que limites operacionais não devem tornar a
   Enavia fria, travada ou robótica.

4. **`schema/brain/self-model/current-state.md`**: Estado atual pós-PR39. Documenta:
   frente 2 (PR32–PR38) encerrada com PR38 56/56 ✅, PR39 criou brain architecture,
   PR40 cria self-model. Inclui frase obrigatória sobre estado documental vs. runtime.

5. **`schema/brain/self-model/how-to-answer.md`**: 10 regras de resposta + 4 exemplos
   canônicos. O arquivo mais importante do self-model para comportamento observável.

**Arquivo atualizado:**

6. **`schema/brain/self-model/INDEX.md`**: Tabela de arquivos planejados substituída por
   tabela de arquivos criados. Seções adicionadas: relação com Mode Policy, relação com
   Obsidian Brain, nota de runtime (documental, não conectado ao chat), estado pós-PR40.

**Relatório criado:**

7. **`schema/reports/PR40_SELF_MODEL_ENAVIA_REPORT.md`**: Relatório completo da PR40
   com 9 seções + tabela de verificações.

**Governança atualizada:**

8. **`schema/contracts/INDEX.md`**: PR40 ✅ adicionada, próxima PR → PR41.
9. **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR40 registrada. Próxima PR: PR41.
10. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo): handoff atualizado para PR41.
11. **`schema/execution/ENAVIA_EXECUTION_LOG.md`**: bloco PR40 adicionado.

## Arquivos NÃO alterados

- `nv-enavia.js` (não tocado)
- `schema/enavia-cognitive-runtime.js` (não tocado)
- `panel/` (nenhum arquivo tocado)
- `contract-executor.js`, `executor/`
- `.github/workflows/`, `wrangler.toml`
- secrets, bindings, KV config
- contratos encerrados

## Próxima PR autorizada

**PR41 — PR-DOCS — Migrar conhecimento consolidado para Brain**

Objetivo: Consolidar o conhecimento operacional existente (skills, playbooks, mapas,
system map, route registry) dentro do Obsidian Brain, nos formatos e convenções
definidos em `schema/brain/` pela PR39.

Referências obrigatórias: `schema/brain/MEMORY_RULES.md`, `schema/brain/UPDATE_POLICY.md`,
`schema/brain/GRAPH.md` (para backlinks), `schema/brain/self-model/` (para contexto de
identidade e capacidades).
