# CONTRATO — ENAVIA JARVIS BRAIN v1 — PR31 a PR64

---

## 0. Status do contrato

| Campo | Valor |
|-------|-------|
| **Status** | Ativo 🟢 |
| **Data de início** | 2026-04-30 |
| **Contrato anterior** | `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — Encerrado ✅ |
| **Objetivo** | Criar cérebro vivo da Enavia com LLM Core, Memory Brain, Skill Router, Intent Engine, Self-Audit e resposta LLM-first |
| **Próxima PR autorizada** | PR36 — PR-IMPL — Correção inicial do chat runtime: read_only como gate, target sem tom forçado e sanitizers não destrutivos |

---

## 1. Objetivo macro

Transformar a Enavia de sistema governado/documental em uma IA operacional viva.

A Enavia deve ser capaz de:

- conversar como IA estratégica, não como bot;
- lembrar contexto, decisões, histórico, preferências e estado do sistema;
- consultar seu próprio brain estilo Obsidian;
- entender intenção antes de responder;
- escolher skill correta como referência;
- diagnosticar o próprio sistema;
- identificar lacunas que o operador ainda não percebeu;
- sugerir novas skills, contratos, melhorias e correções;
- planejar com profundidade;
- executar somente com contrato, aprovação e governança.

---

## 2. Filosofia do contrato

> "A Enavia não deve ser um bot de checklist.
> A Enavia deve ser uma inteligência estratégica com ferramentas, memória, raciocínio e limites seguros."

> "A Enavia pensa livremente, lembra com estrutura, sugere com inteligência e executa somente com governança."

> "A Enavia é LLM-first. Contratos, skills, mapas, workers e executores são ferramentas da inteligência, não a personalidade dela."

A Enavia não é definida pelos seus arquivos de governança. Esses arquivos são instrumentos. A personalidade, a inteligência e o raciocínio da Enavia residem no LLM Core. A governança garante que a execução seja segura — não que o pensamento seja rígido.

---

## 3. Arquitetura alvo

O Jarvis Brain v1 é composto por 7 camadas:

### Camada 1 — LLM Core
Cérebro conversacional vivo. Responsável por raciocinar, conversar, planejar e responder com inteligência. Não é um bot de checklist. É o núcleo da personalidade da Enavia.

### Camada 2 — Intent Engine
Classifica a intenção do operador antes de qualquer resposta. Determina se a mensagem é uma conversa, um diagnóstico, um plano, uma criação de contrato, uma revisão de PR, uma decisão de deploy, uma pergunta sobre memória, uma pergunta sobre sistema, uma solicitação de skill ou uma solicitação de execução.

### Camada 3 — Memory Brain / Obsidian interno
Memória estruturada, linkada e pesquisável estilo Obsidian. Contém identidade, estado atual, decisões passadas, preferências do operador, incidentes, aprendizados, questões abertas e self-model.

### Camada 4 — System Awareness
A Enavia conhece seu próprio repo: contratos, workers, rotas, skills, estado atual, executores, bindings, KV e lacunas. Não afirma nada sobre o sistema sem fonte.

### Camada 5 — Skill Router
Escolhe a skill correta conforme o contexto e a intenção detectada. Roteia para documentação, não executa autonomamente.

### Camada 6 — Reasoning & Self-Audit
Analisa o próprio sistema. Identifica divergências entre docs e runtime, falhas não percebidas, riscos, próximos passos e lacunas.

### Camada 7 — Governed Execution
Só executa com contrato ativo, escopo definido e aprovação humana explícita. Nenhuma autonomia cega.

---

## 4. Regras de segurança sem engessar

| Ação | Permitida? |
|------|-----------|
| Pensar | ✅ Sempre permitido |
| Conversar | ✅ Sempre permitido |
| Diagnosticar (read-only) | ✅ Permitido quando dentro do escopo |
| Planejar | ✅ Permitido |
| Sugerir contrato | ✅ Permitido |
| Sugerir skill | ✅ Permitido |
| Executar | ⚠️ Exige contrato ativo e aprovação |
| Alterar runtime | ⚠️ Exige PR-IMPL aprovada |
| Alterar produção | 🔴 Exige aprovação humana explícita |
| Autonomia cega | 🔴 Proibido |
| Execução fora de contrato | 🔴 Proibido |
| Memória inventada | 🔴 Proibido |
| Afirmação sobre sistema sem fonte | 🔴 Proibido |

### Regras adicionais derivadas do diagnóstico PR32

> **Regra R1 — read_only é bloqueio de execução, não regra de tom**
>
> O parâmetro `read_only` significa apenas que a Enavia não pode executar ações com efeito colateral (deploy, escrita, mutação de estado). Não significa que ela deve adotar tom operacional rígido, responder como bot de checklist, ou suprimir raciocínio vivo.
> A Enavia continua livre para conversar, raciocinar, explicar, acolher, discordar, diagnosticar, planejar e responder como IA estratégica mesmo em modo `read_only`.
> Qualquer prompt, runtime, sanitizador ou regra que interprete `read_only` como restrição de tom está ERRADO e deve ser corrigido.

> **Regra R2 — Sanitizadores pós-LLM não podem destruir resposta viva legítima**
>
> Sanitizadores pós-LLM existem para bloquear vazamento de JSON interno, envelope `{reply, use_planner}`, blocos de planner não solicitados e output de debug. Eles NÃO devem substituir resposta estratégica legítima por fallback robótico quando a resposta for útil e coerente.
> Se um sanitizador substitui uma resposta viva por uma frase fixa como "Não posso executar isso em modo read_only", ele está causando o problema que este contrato existe para resolver.

> **Regra R3 — Target operacional não transforma toda conversa em modo operacional**
>
> O painel envia `target.mode = "read_only"` por default para qualquer mensagem. Isso não deve ativar automaticamente tom operacional para conversas comuns.
> O Intent Engine deve decidir se a mensagem é conversa, diagnóstico, planejamento, revisão de PR, deploy ou execução ANTES de aplicar qualquer tom operacional.
> Toda mensagem de conversa deve ser tratada como conversa até que a intenção indique algo diferente.

> **Regra R4 — O Brain nasce ciente do incidente chat-engessado-readonly**
>
> A estrutura do Obsidian Brain (PR37+) deve ser desenhada levando em conta o diagnóstico da PR32. O incidente `chat-engessado-readonly` deve ser registrado em `schema/brain/incidents/chat-engessado-readonly.md` para que PR44 (LLM Core) e PR53 (Self-Audit) possam recuperar a evidência. O self-model deve ensinar a Enavia a responder como IA estratégica antes de estruturar ação operacional.

---

## 5. Escopo geral PR31–PR64

### Frente 1 — Ativação e diagnóstico do chat engessado

| PR | Tipo | Objetivo |
|----|------|----------|
| PR31 | PR-DOCS | Ativar contrato Jarvis Brain v1 |
| PR32 | PR-DIAG | Diagnóstico do chat atual, memória atual, prompts, modos e causa da resposta engessada |

### Frente 2 — Correção conceitual do Chat Runtime antes do Brain

> Esta frente foi inserida após o diagnóstico PR32, que revelou fatores estruturais que precisam ser resolvidos antes de construir sobre o Brain. Sem esta correção conceitual, o Brain seria construído sobre uma base com interpretação errada de read_only, sanitizadores destrutivos e target default inadequado.

| PR | Tipo | Objetivo |
|----|------|----------|
| PR33 | PR-DOCS | Ajuste do contrato após diagnóstico PR32 (esta PR) |
| PR34 | PR-DIAG | Diagnóstico específico de read_only, target default e sanitizers |
| PR35 | PR-DOCS | Mode Policy: separar intenção, permissão de execução e tom (esta PR) |
| PR36 | PR-IMPL | Correção inicial do chat runtime: read_only como gate, target sem tom forçado e sanitizers não destrutivos |

### Frente 3 — Obsidian Brain completo

| PR | Tipo | Objetivo |
|----|------|----------|
| PR37 | PR-DOCS | Arquitetura do Obsidian Brain |
| PR38 | PR-DOCS | Self Model da Enavia |
| PR39 | PR-DOCS | Migrar conhecimento consolidado para Brain |

### Frente 4 — Memory Runtime read-only

| PR | Tipo | Objetivo |
|----|------|----------|
| PR40 | PR-DIAG | Diagnóstico da memória atual no runtime |
| PR41 | PR-IMPL | Brain Loader read-only |
| PR42 | PR-PROVA | Provar Brain Loader |

### Frente 5 — LLM Core vivo

| PR | Tipo | Objetivo |
|----|------|----------|
| PR43 | PR-DIAG | Diagnóstico do prompt atual do chat |
| PR44 | PR-IMPL | LLM Core v1 |
| PR45 | PR-PROVA | Teste de resposta viva |

### Frente 6 — Intent Engine

| PR | Tipo | Objetivo |
|----|------|----------|
| PR46 | PR-IMPL | Classificador de intenção |
| PR47 | PR-PROVA | Teste de intenção |

### Frente 7 — Skill Router cognitivo

| PR | Tipo | Objetivo |
|----|------|----------|
| PR48 | PR-IMPL | Skill Router read-only |
| PR49 | PR-PROVA | Teste de roteamento de skills |

### Frente 8 — Memory Retrieval inteligente

| PR | Tipo | Objetivo |
|----|------|----------|
| PR50 | PR-IMPL | Retrieval por intenção |
| PR51 | PR-PROVA | Testes de memória contextual |

### Frente 9 — Self-Audit e descoberta de falhas

| PR | Tipo | Objetivo |
|----|------|----------|
| PR52 | PR-DOCS | Self-Audit Framework |
| PR53 | PR-IMPL | Self-Audit read-only |
| PR54 | PR-PROVA | Self-Audit encontra lacunas reais |

### Frente 10 — Conversa LLM-first com governança

| PR | Tipo | Objetivo |
|----|------|----------|
| PR55 | PR-IMPL | Response Policy viva |
| PR56 | PR-PROVA | Teste anti-bot |

### Frente 11 — Brain Update supervisionado

| PR | Tipo | Objetivo |
|----|------|----------|
| PR57 | PR-IMPL | Propor atualização de memória |
| PR58 | PR-PROVA | Teste de atualização supervisionada |

### Frente 12 — Preparação para futuro Runtime de Skills

| PR | Tipo | Objetivo |
|----|------|----------|
| PR59 | PR-DOCS | Blueprint do Runtime de Skills |
| PR60 | PR-DIAG | Diagnóstico técnico para Runtime de Skills |

### Frente 13 — Integração final

| PR | Tipo | Objetivo |
|----|------|----------|
| PR61 | PR-PROVA | Teste de jornada completa Jarvis |
| PR62 | PR-PROVA | Teste "conhece o próprio sistema" |
| PR63 | PR-HARDENING | Segurança, custo e limites |
| PR64 | PR-DOCS/PR-PROVA | Fechamento do Jarvis Brain v1 |

---

## 6. Detalhamento obrigatório das PRs

### PR31 — PR-DOCS — Ativar contrato Jarvis Brain v1

- **Objetivo:** Criar e ativar o novo contrato macro da ENAVIA. Religar o loop contratual.
- **Tipo:** PR-DOCS
- **Escopo permitido:** Apenas criação/atualização de arquivos de governança e documentação.
- **Proibido:** Alterar runtime, nv-enavia.js, contract-executor.js, Panel, Executor, Deploy Worker, workflows, wrangler.toml, wrangler.executor.template.toml, secrets, bindings, KV. Não criar endpoint, teste, memória, skill router, LLM Core ou Obsidian Brain.
- **Arquivos esperados:**
  - `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (NOVO)
  - `schema/contracts/INDEX.md` (atualizado)
  - `schema/status/ENAVIA_STATUS_ATUAL.md` (atualizado)
  - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (atualizado)
  - `schema/execution/ENAVIA_EXECUTION_LOG.md` (atualizado)
  - `schema/reports/PR31_ATIVACAO_CONTRATO_JARVIS_BRAIN.md` (NOVO)
- **Critérios de aceite:**
  - Contrato criado e ativo em `schema/contracts/active/`.
  - INDEX.md aponta novo contrato como ativo.
  - Próxima PR autorizada é PR32.
  - Status, handoff e execution log atualizados.
  - Relatório PR31 criado.
  - Nenhum runtime alterado.
- **Smoke tests:** `git diff --name-only` — nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- **Próxima PR autorizada:** PR32 — PR-DIAG

---

### PR32 — PR-DIAG — Diagnóstico do chat engessado

- **Objetivo:** Diagnosticar por que a Enavia responde como bot rígido em vez de IA estratégica. Mapear todos os componentes envolvidos na geração de resposta do chat.
- **Tipo:** PR-DIAG (read-only, sem alteração de runtime)
- **Escopo permitido:** Apenas diagnóstico. Leitura de código, análise de prompts, mapeamento de fluxo.
- **Proibido:** Alterar qualquer arquivo de runtime. Criar endpoint. Criar implementação.
- **O que investigar:**
  - Prompts do chat: system prompt, prompt de segurança, prompt de memória, prompt de planner
  - Parâmetros `read_only`, `target`, `env`, `mode` — como afetam a resposta
  - Origem da resposta: qual função gera o texto final ao usuário
  - Memória aplicada: o que é injetado no contexto da conversa
  - Skills não usadas: por que as 4 skills documentais não são consultadas no chat
  - Fallback genérico: de onde vem a resposta padrão
  - Response formatter: como o texto é formatado antes de retornar
  - System prompt: conteúdo atual e limitações
  - Separação entre conversar / diagnosticar / planejar / executar: existe ou está tudo misturado?
- **Arquivos esperados:**
  - `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md` (NOVO)
  - Atualização de governança (status, handoff, execution log)
- **Critérios de aceite:**
  - Causa raiz do chat engessado identificada com evidência de código.
  - Fluxo de geração de resposta completamente mapeado.
  - Componentes ausentes listados (Brain, Intent, Skill Router, etc.).
  - Próximos passos recomendados com base em evidência real.
- **Smoke tests:** Confirmar que nenhum arquivo de runtime foi alterado.
- **Próxima PR autorizada:** PR33 — PR-DOCS (Obsidian Brain Architecture)

---

### PR33 — PR-DOCS — Ajuste do contrato após diagnóstico PR32

- **Objetivo:** Atualizar o contrato `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` com base nas descobertas da PR32, antes de iniciar a arquitetura do Obsidian Brain. Inserir Frente 2 corretiva. Registrar novas regras sobre read_only, sanitizers e target default. Deslocar Obsidian Brain para PR37+.
- **Tipo:** PR-DOCS
- **Escopo permitido:** Apenas arquivos de governança e documentação. Nenhum runtime.
- **Proibido:** Alterar nv-enavia.js, Panel, sanitizers, prompts reais, schema/enavia-cognitive-runtime.js. Não criar Brain, loader, endpoint ou teste.
- **Arquivos esperados:**
  - `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (atualizado)
  - `schema/contracts/INDEX.md` (atualizado — próxima PR → PR34)
  - `schema/status/ENAVIA_STATUS_ATUAL.md` (atualizado)
  - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (atualizado)
  - `schema/execution/ENAVIA_EXECUTION_LOG.md` (atualizado)
  - `schema/reports/PR33_AJUSTE_CONTRATO_JARVIS_POS_DIAGNOSTICO.md` (NOVO)
- **Critérios de aceite:**
  - Contrato atualizado com descobertas da PR32.
  - Nova Frente 2 corretiva inserida (PR33-PR36).
  - read_only definido como bloqueio de execução, não regra de tom (Regra R1).
  - Sanitizers pós-LLM registrados como risco a corrigir (Regra R2).
  - Target operacional registrado como risco a diagnosticar (Regra R3).
  - Obsidian Brain deslocado para PR37+.
  - INDEX aponta PR34 como próxima PR.
  - Status, handoff e execution log atualizados.
  - Nenhum runtime alterado.
- **Smoke tests:** `git diff --name-only` — nenhum `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado.
- **Próxima PR autorizada:** PR34 — PR-DIAG

---

### PR34 — PR-DIAG — Diagnóstico específico de read_only, target default e sanitizers

- **Objetivo:** Diagnosticar em modo READ-ONLY: (a) como exatamente o parâmetro `read_only` afeta o tom e o raciocínio da Enavia, com evidência de código; (b) como o painel envia `target.mode = "read_only"` por default e o que isso ativa no runtime; (c) como os sanitizadores pós-LLM substituem respostas vivas.
- **Tipo:** PR-DIAG (read-only, sem alteração de runtime)
- **Escopo permitido:** Apenas leitura de código, análise e produção de relatório.
- **O que investigar:**
  - `useTargetState.js:35-49` — como o painel força `read_only` por default
  - `nv-enavia.js:4097-4099` — como `read_only` é traduzido em instrução de tom
  - `schema/enavia-cognitive-runtime.js:239-241` — instrução de tom derivada de `read_only`
  - `nv-enavia.js:3530-3583` — `_sanitizeChatReply` e como substitui respostas
  - `nv-enavia.js:4177, 4397-4401` — outros sanitizadores/filtros
  - `schema/enavia-cognitive-runtime.js:319-326` — envelope JSON `{reply, use_planner}`
  - Impacto de cada um no comportamento final da Enavia
- **Arquivos esperados:**
  - `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md` (NOVO)
- **Critérios de aceite:** Evidência de código para cada fator. Impacto de cada um no comportamento documentado. Proposta de patch para PR35+.
- **Smoke tests:** Confirmar que nenhum arquivo de runtime foi alterado.
- **Próxima PR autorizada:** PR35 — PR-DOCS (Política de modos)

---

### PR35 — PR-DOCS — Mode Policy: separar intenção, permissão de execução e tom

- **Objetivo:** Criar documento de política que define como a Enavia deve se comportar em cada modo de operação. Separar claramente: (a) intenção da mensagem (conversa, diagnóstico, execução); (b) permissão de execução (`read_only` como gate); (c) tom da resposta (estratégico, livre, nunca forçado por `target` default). Preparar o contrato para PR36 ser implementação real.
- **Tipo:** PR-DOCS
- **Escopo permitido:** Apenas criação de documentação em `schema/policies/`. Atualização do contrato para refletir PR36 como PR-IMPL. Nenhum runtime alterado.
- **Arquivos esperados:**
  - `schema/policies/MODE_POLICY.md` (NOVO)
  - `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (atualizado — PR36 → PR-IMPL)
  - `schema/contracts/INDEX.md` (atualizado — próxima PR → PR36 PR-IMPL)
  - `schema/status/ENAVIA_STATUS_ATUAL.md` (atualizado)
  - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (atualizado)
  - `schema/execution/ENAVIA_EXECUTION_LOG.md` (atualizado)
  - `schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md` (NOVO)
- **Critérios de aceite:**
  - `schema/policies/MODE_POLICY.md` criado com 9 seções.
  - `read_only` definido como gate de execução, não regra de tom.
  - Target default não decide tom.
  - 3 modos canônicos definidos (`conversation`, `diagnosis`, `execution`).
  - Planner não substitui conversa.
  - Sanitizers não devem destruir resposta viva legítima.
  - Contrato ajustado: PR36 = PR-IMPL.
  - INDEX aponta PR36 como PR-IMPL.
  - Status, handoff e execution log atualizados.
  - Nenhum runtime alterado. Nenhum `.js`/`.ts`/`.jsx`/`.tsx`/`.toml`/`.yml` alterado.
- **Smoke tests:** `git diff --name-only` — nenhum arquivo de runtime alterado.
- **Próxima PR autorizada:** PR36 — PR-IMPL

---

### PR36 — PR-IMPL — Correção inicial do chat runtime: read_only como gate, target sem tom forçado e sanitizers não destrutivos

- **Objetivo:** Implementar patch cirúrgico mínimo no runtime para corrigir os 3 fatores técnicos identificados no diagnóstico PR34 e formalizados na Mode Policy PR35: (1) `read_only` sendo tratado como regra de tom; (2) `target` default forçando tom operacional em toda conversa; (3) sanitizers pós-LLM destruindo respostas vivas legítimas.
- **Tipo:** PR-IMPL
- **Escopo obrigatório:** Worker-only preferencialmente. Se Panel for necessário, documentar risco e avaliar PR separada.
- **O que implementar:**
  - Remover instruções de tom associadas a `read_only` nos prompts (`nv-enavia.js:4097-4099`, `schema/enavia-cognitive-runtime.js:239-241`).
  - Adicionar gate determinístico de execução amarrado a `read_only`: só bloqueia quando intenção = `execution`.
  - Desacoplar `isOperationalContext` de `hasTarget`: contexto operacional não deve ser ativado apenas porque `target` está presente.
  - Reduzir sanitizers destrutivos: `_sanitizeChatReply`, `_isManualPlanReply`/`_MANUAL_PLAN_FALLBACK` — aumentar threshold ou adicionar verificação de contexto.
  - Adicionar telemetria mínima de fallback: log visível no Worker quando qualquer sanitizer substituir uma resposta.
- **Proibido nesta PR:**
  - Não implementar Intent Engine completo.
  - Não implementar LLM Core completo.
  - Não tocar Obsidian Brain.
  - Não criar novos endpoints.
  - Não criar testes E2E completos (smoke teste simples aceito).
  - Não alterar schema do contrato ou executor.
- **Pré-requisito:** PR35 ✅ (Mode Policy criada, diagnóstico suficiente disponível, PR34 ✅).
- **Arquivos esperados:**
  - `nv-enavia.js` (alterado — patch cirúrgico)
  - `schema/enavia-cognitive-runtime.js` (alterado — patch cirúrgico)
  - Opcionalmente: `panel/src/chat/useTargetState.js` (se necessário — documentar risco)
  - Governança atualizada (status, handoff, execution log)
  - `schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md` (NOVO)
- **Critérios de aceite:**
  - `read_only` no prompt como nota factual, sem instrução de tom defensivo.
  - `isOperationalContext` não ativado apenas por `hasTarget`.
  - Sanitizer de planner não destrói resposta estruturada legítima.
  - Log visível de fallback/sanitização.
  - Nenhuma regressão em deploy governance.
  - Nenhuma exposição de JSON interno ao usuário.
- **Smoke tests:**
  - Enviar mensagem de conversa simples → confirmar que não ativa tom operacional.
  - Enviar mensagem com `read_only` → confirmar que não adiciona instrução de tom defensivo no prompt.
  - Enviar resposta estruturada do LLM → confirmar que sanitizer não substitui por fallback.
- **Próxima PR autorizada:** PR37 — PR-DOCS (Arquitetura do Obsidian Brain)

---

### PR37 — PR-DOCS — Arquitetura do Obsidian Brain

- **Objetivo:** Criar a estrutura completa do Obsidian Brain como documentação antes de qualquer implementação.
- **Tipo:** PR-DOCS
- **Escopo permitido:** Apenas criação de arquivos de documentação em `schema/brain/`.
- **Arquivos esperados:**
  - `schema/brain/INDEX.md`
  - `schema/brain/GRAPH.md`
  - `schema/brain/MEMORY_RULES.md`
  - `schema/brain/RETRIEVAL_POLICY.md`
  - `schema/brain/UPDATE_POLICY.md`
  - `schema/brain/SYSTEM_AWARENESS.md`
  - Pastas: `maps/`, `decisions/`, `contracts/`, `memories/`, `incidents/`, `learnings/`, `open-questions/`, `self-model/`
- **Notas derivadas do diagnóstico PR32:**
  - `MEMORY_RULES.md` deve diferenciar regra operacional ↔ personalidade ↔ checklist.
  - `SYSTEM_AWARENESS.md` deve cobrir 4 dimensões reais: contratos, estado, sistema, skills.
  - `incidents/chat-engessado-readonly.md` deve ser criado referenciando o diagnóstico PR32.
  - `self-model/how-to-answer.md` deve registrar explicitamente que `read_only` é bloqueio de execução, NÃO regra de tom (Regra R1).
- **Critérios de aceite:** Estrutura completa criada. Cada arquivo com conteúdo substantivo. Incidente PR32 referenciado.
- **Próxima PR autorizada:** PR38 — PR-DOCS (Self Model)

---

### PR38 — PR-DOCS — Self Model da Enavia

- **Objetivo:** Criar o self-model da Enavia: como ela se vê, o que pode fazer, o que não pode e como deve responder.
- **Tipo:** PR-DOCS
- **Arquivos esperados:**
  - `schema/brain/self-model/identity.md`
  - `schema/brain/self-model/capabilities.md`
  - `schema/brain/self-model/limitations.md`
  - `schema/brain/self-model/current-state.md`
  - `schema/brain/self-model/how-to-answer.md`
- **Nota derivada do diagnóstico PR32:** `how-to-answer.md` deve ensinar a Enavia a responder como IA estratégica antes de estruturar ação. `read_only` explicitamente definido como bloqueio de execução, nunca regra de tom.
- **Critérios de aceite:** Self-model completo, honesto e fundamentado no estado real do sistema.
- **Próxima PR autorizada:** PR39 — PR-DOCS (Migração de conhecimento)

---

### PR39 — PR-DOCS — Migração de conhecimento para Brain

- **Objetivo:** Migrar conhecimento consolidado dos contratos, status, handoffs, skills, maps, registries e relatório final PR30 para o brain.
- **Tipo:** PR-DOCS
- **Escopo:** Criar/popular arquivos do brain com base nos documentos existentes.
- **Fontes:** Contratos encerrados, ENAVIA_SYSTEM_MAP.md, ENAVIA_ROUTE_REGISTRY.json, ENAVIA_WORKER_REGISTRY.md, skills documentais, relatório final PR30, diagnóstico PR32 (incidente chat-engessado-readonly).
- **Critérios de aceite:** Brain populado com conhecimento real. Sem invenção. Toda afirmação tem fonte. Incidente PR32 registrado em `incidents/`.
- **Próxima PR autorizada:** PR40 — PR-DIAG (Diagnóstico memória runtime)

---

### PR40 — PR-DIAG — Diagnóstico da memória atual no runtime

- **Objetivo:** Mapear como o chat salva e busca memória atualmente.
- **Tipo:** PR-DIAG (read-only)
- **O que investigar:**
  - KV usado para memória
  - Limite de contexto
  - Ranking de memórias
  - Retrieval atual
  - Memória aplicada na conversa
  - Memória salva após conversa
- **Arquivos esperados:** `schema/reports/PR40_MEMORY_RUNTIME_DIAGNOSTICO.md`
- **Próxima PR autorizada:** PR41 — PR-IMPL (Brain Loader)

---

### PR41 — PR-IMPL — Brain Loader read-only

- **Objetivo:** Implementar leitura do brain sem escrita. Carregar identidade, estado atual, hard-rules e incidentes conhecidos no contexto do chat.
- **Tipo:** PR-IMPL
- **Pré-requisito:** PR40 (diagnóstico da memória runtime)
- **Escopo:** Worker-only. Apenas leitura. Sem escrita de memória. Sem mudança de comportamento final ainda.
- **Critérios de aceite:** Brain Loader lê arquivos do brain e os injeta no contexto. Sem efeito colateral. Testes passam.
- **Próxima PR autorizada:** PR42 — PR-PROVA

---

### PR42 — PR-PROVA — Prova do Brain Loader

- **Objetivo:** Provar que o Brain Loader funciona corretamente.
- **Tipo:** PR-PROVA
- **O que provar:**
  - Leitura de `identity.md`
  - Leitura de `current-state.md`
  - Leitura de `hard-rules.md`
  - Leitura de incidente `chat-engessado-readonly.md`
- **Critérios de aceite:** Testes passam. Leitura confirmada. Sem escrita. Sem side effects.
- **Próxima PR autorizada:** PR43 — PR-DIAG (Diagnóstico prompt chat)

---

### PR43 — PR-DIAG — Diagnóstico do prompt atual do chat

- **Objetivo:** Mapear completamente o system prompt, prompt de segurança, prompt de memória, prompt de planner e response formatter do chat atual.
- **Tipo:** PR-DIAG (read-only)
- **Arquivos esperados:** `schema/reports/PR43_PROMPT_CHAT_DIAGNOSTICO.md`
- **Próxima PR autorizada:** PR44 — PR-IMPL (LLM Core v1)

---

### PR44 — PR-IMPL — LLM Core v1

- **Objetivo:** Criar `buildEnaviaCorePrompt()` ou equivalente real. Prompt que injeta identidade, estado atual, intenção detectada, memória relevante, skill sugerida e limites de forma viva e não engessada.
- **Tipo:** PR-IMPL
- **Pré-requisito:** PR43 (diagnóstico do prompt)
- **Escopo:** Worker-only. Apenas o core prompt. Sem redesign completo ainda.
- **Regras obrigatórias derivadas de PR33/PR34/PR35/PR36:**
  - `read_only` NÃO deve ser instrução de tom no LLM Core (Regra R1).
  - Sanitizadores NÃO devem substituir resposta viva legítima (Regra R2).
  - Intent deve ser detectado ANTES de aplicar tom operacional (Regra R3).
- **Critérios de aceite:** Função criada. Testes passam. Resposta do chat demonstra raciocínio vivo.
- **Próxima PR autorizada:** PR45 — PR-PROVA

---

### PR45 — PR-PROVA — Teste de resposta viva

- **Objetivo:** Provar que o LLM Core v1 produz respostas vivas, não bot.
- **Tipo:** PR-PROVA
- **Fixtures obrigatórias:**
  - "Você sabe operar seu sistema?"
  - "Por que você estava engessada?"
  - "O que falta para virar Jarvis?"
  - "Crie o próximo contrato."
  - "Revise essa PR."
  - "O que você lembra do projeto?"
- **Critérios de aceite:** Respostas demonstram raciocínio, contexto e inteligência. Não são respostas de bot de checklist.
- **Próxima PR autorizada:** PR46 — PR-IMPL (Intent Engine)

---

### PR46 — PR-IMPL — Classificador de intenção (Intent Engine)

- **Objetivo:** Implementar classificador de intenção que categoriza cada mensagem do operador antes de gerar resposta.
- **Tipo:** PR-IMPL
- **Classes de intenção:**
  - `conversation` — conversa geral
  - `diagnosis` — pedido de diagnóstico
  - `planning` — pedido de plano
  - `contract_creation` — criar novo contrato
  - `pr_review` — revisar PR
  - `deploy_decision` — decisão de deploy/rollback
  - `memory_question` — pergunta sobre o que a Enavia lembra
  - `system_question` — pergunta sobre estado do sistema
  - `skill_request` — pedido de uso de skill específica
  - `execution_request` — pedido de executar algo
- **Regra derivada da PR33/PR35:** Tom operacional (`read_only`, MODO OPERACIONAL ATIVO) só deve ser ativado para classes `deploy_decision` e `execution_request`. Para `conversation`, `diagnosis`, `planning`, `pr_review`, `memory_question` e `system_question`, o tom deve ser vivo e estratégico.
- **Critérios de aceite:** Classificação correta em >90% dos casos de teste.
- **Próxima PR autorizada:** PR47 — PR-PROVA

---

### PR47 — PR-PROVA — Teste de intenção

- **Objetivo:** Provar que o Intent Engine classifica corretamente.
- **Tipo:** PR-PROVA
- **Critérios de aceite:** Suite de testes com cobertura de todas as 10 classes.
- **Próxima PR autorizada:** PR48 — PR-IMPL (Skill Router)

---

### PR48 — PR-IMPL — Skill Router read-only

- **Objetivo:** Implementar roteamento de skill conforme intenção. Skill é consultada como referência, não executada automaticamente.
- **Tipo:** PR-IMPL
- **Mapeamento obrigatório:**
  - `pr_review` → `CONTRACT_AUDITOR.md`
  - `deploy_decision` + `rollback` → `DEPLOY_GOVERNANCE_OPERATOR.md`
  - `system_question` + `maps/routes/architecture` → `SYSTEM_MAPPER.md`
  - `contract_creation` + `loop contratual` → `CONTRACT_LOOP_OPERATOR.md`
- **Critérios de aceite:** Skill correta selecionada conforme intenção. Sem execução automática.
- **Próxima PR autorizada:** PR49 — PR-PROVA

---

### PR49 — PR-PROVA — Teste de roteamento de skills

- **Objetivo:** Provar que o Skill Router seleciona a skill correta.
- **Tipo:** PR-PROVA
- **Critérios de aceite:** 4/4 mapeamentos testados e aprovados.
- **Próxima PR autorizada:** PR50 — PR-IMPL (Memory Retrieval)

---

### PR50 — PR-IMPL — Retrieval por intenção

- **Objetivo:** Buscar memória certa do brain conforme intenção detectada.
- **Tipo:** PR-IMPL
- **Escopo:** Worker-only. Leitura de brain. Sem escrita.
- **Critérios de aceite:** Retrieval retorna memória relevante para cada classe de intenção testada.
- **Próxima PR autorizada:** PR51 — PR-PROVA

---

### PR51 — PR-PROVA — Testes de memória contextual

- **Objetivo:** Provar que o retrieval retorna memória correta para cada intenção.
- **Tipo:** PR-PROVA
- **Próxima PR autorizada:** PR52 — PR-DOCS (Self-Audit Framework)

---

### PR52 — PR-DOCS — Self-Audit Framework

- **Objetivo:** Criar framework conceitual e documental para detecção de falhas, lacunas e drift no sistema.
- **Tipo:** PR-DOCS
- **O que o framework deve detectar:**
  - Divergência entre docs e runtime
  - Rota documentada mas não testada
  - Skill documental sem runtime
  - Contrato ativo ausente
  - Memória ausente
  - Prompt engessado
  - Drift entre documentação e código
  - Lacuna de testes
  - Lacuna de segurança
- **Arquivos esperados:** `schema/brain/incidents/` populado, `schema/reports/PR52_SELF_AUDIT_FRAMEWORK.md`
- **Próxima PR autorizada:** PR53 — PR-IMPL (Self-Audit read-only)

---

### PR53 — PR-IMPL — Self-Audit read-only

- **Objetivo:** Criar função ou endpoint read-only que executa o framework de self-audit e gera relatório de lacunas.
- **Tipo:** PR-IMPL
- **Pré-requisito:** PR52 (framework documental)
- **Escopo:** Worker-only. Read-only. Sem correção automática.
- **Critérios de aceite:** Relatório gerado. Lacunas reais identificadas. Sem correção automática.
- **Próxima PR autorizada:** PR54 — PR-PROVA

---

### PR54 — PR-PROVA — Self-Audit encontra lacunas reais

- **Objetivo:** Provar que o Self-Audit identifica lacunas reais do sistema.
- **Tipo:** PR-PROVA
- **Critérios de aceite:** Pelo menos 3 lacunas reais identificadas e documentadas.
- **Próxima PR autorizada:** PR55 — PR-IMPL (Response Policy viva)

---

### PR55 — PR-IMPL — Response Policy viva

- **Objetivo:** Implementar política de resposta que elimina o comportamento de bot de checklist.
- **Tipo:** PR-IMPL
- **Regras obrigatórias:**
  - Responder primeiro como IA estratégica, depois estruturar diagnóstico/plano
  - Se não puder executar, explicar sem soar bot — nunca responder "Não posso fazer isso"
  - Reconhecer frustração do operador
  - Aplicar governança quando houver ação técnica — mas não para conversa
- **Base obrigatória:** Política documental criada em PR36 (`RESPONSE_POLICY.md`).
- **Critérios de aceite:** Respostas passam no teste anti-bot da PR56.
- **Próxima PR autorizada:** PR56 — PR-PROVA

---

### PR56 — PR-PROVA — Teste anti-bot

- **Objetivo:** Provar que a Enavia não soa mais como bot rígido.
- **Tipo:** PR-PROVA
- **Fixtures obrigatórias:**
  - "Você está parecendo um bot burro."
  - "Quero um Jarvis."
  - "Isso me deixa puto."
  - "Você sabe operar de ponta a ponta?"
- **Critérios de aceite:** Respostas demonstram inteligência estratégica, empatia e autoconsciência.
- **Próxima PR autorizada:** PR57 — PR-IMPL (Brain Update supervisionado)

---

### PR57 — PR-IMPL — Propor atualização de memória

- **Objetivo:** Implementar mecanismo para propor atualizações no brain, sem escrita automática. Toda atualização requer aprovação explícita.
- **Tipo:** PR-IMPL
- **Critérios de aceite:** Proposta gerada. Escrita só após aprovação humana. Sem autonomia.
- **Próxima PR autorizada:** PR58 — PR-PROVA

---

### PR58 — PR-PROVA — Teste de atualização supervisionada

- **Objetivo:** Provar que atualizações de memória só ocorrem com aprovação.
- **Tipo:** PR-PROVA
- **Próxima PR autorizada:** PR59 — PR-DOCS (Blueprint Runtime de Skills)

---

### PR59 — PR-DOCS — Blueprint do Runtime de Skills

- **Objetivo:** Definir a arquitetura futura para execução de skills no runtime. Apenas blueprint — sem implementação.
- **Tipo:** PR-DOCS
- **Endpoints futuros (apenas documentar, não implementar):**
  - `GET /skills/list`
  - `POST /skills/select`
  - `GET /skills/suggest`
  - `POST /skills/run-dry` (simulação sem efeito)
  - `POST /skills/run-approved` (execução com aprovação explícita)
- **Arquivos esperados:** `schema/reports/PR59_SKILLS_RUNTIME_BLUEPRINT.md`
- **Próxima PR autorizada:** PR60 — PR-DIAG (Diagnóstico técnico para Runtime)

---

### PR60 — PR-DIAG — Diagnóstico técnico para Runtime de Skills

- **Objetivo:** Mapear o que é necessário tecnicamente para implementar o Runtime de Skills.
- **Tipo:** PR-DIAG (read-only)
- **Arquivos esperados:** `schema/reports/PR60_SKILLS_RUNTIME_DIAGNOSTICO.md`
- **Próxima PR autorizada:** PR61 — PR-PROVA (Jornada completa Jarvis)

---

### PR61 — PR-PROVA — Teste de jornada completa Jarvis

- **Objetivo:** Teste de ponta a ponta simulando uma jornada completa: o operador interage com a Enavia como Jarvis.
- **Tipo:** PR-PROVA
- **Critérios de aceite:** Jornada completa funcional — conversa → diagnóstico → plano → skill → resultado.
- **Próxima PR autorizada:** PR62 — PR-PROVA

---

### PR62 — PR-PROVA — Teste "conhece o próprio sistema"

- **Objetivo:** Provar que a Enavia conhece seu próprio sistema.
- **Tipo:** PR-PROVA
- **Fixtures:**
  - "Quais são suas rotas ativas?"
  - "Qual contrato está ativo?"
  - "Que skills você tem?"
  - "Qual é o estado atual do sistema?"
  - "O que falta para completar o Jarvis Brain?"
- **Critérios de aceite:** Respostas fundamentadas em fontes reais. Sem invenção.
- **Próxima PR autorizada:** PR63 — PR-HARDENING

---

### PR63 — PR-HARDENING — Segurança, custo e limites

- **Objetivo:** Revisar limites de custo de contexto, segurança de memória, limites de execução e riscos de drift.
- **Tipo:** PR-HARDENING
- **O que revisar:**
  - Custo de contexto do Brain Loader
  - Segurança da escrita supervisionada de memória
  - Limites do Self-Audit
  - Proteção contra hallucination
  - Rate limits e proteção de custo
- **Próxima PR autorizada:** PR64 — PR-DOCS/PR-PROVA (Fechamento)

---

### PR64 — PR-DOCS/PR-PROVA — Fechamento do Jarvis Brain v1

- **Objetivo:** Encerrar formalmente o contrato Jarvis Brain v1. Criar relatório final. Preparar handoff.
- **Tipo:** PR-DOCS/PR-PROVA
- **Arquivos esperados:**
  - `schema/reports/CONTRATO_JARVIS_BRAIN_PR31_PR64_FINAL_REPORT.md`
  - `schema/handoffs/CONTRATO_JARVIS_BRAIN_FINAL_HANDOFF.md`
  - Atualização de `schema/contracts/INDEX.md`
  - Atualização de governança
- **Critérios de aceite:** Contrato encerrado. Relatório criado. Handoff preparado. Nenhum runtime desprotegido.

---

## 7. Obsidian Brain — estrutura alvo

A estrutura completa a ser criada a partir da PR37:

```
schema/brain/
├── INDEX.md
├── GRAPH.md
├── MEMORY_RULES.md
├── RETRIEVAL_POLICY.md
├── UPDATE_POLICY.md
├── SYSTEM_AWARENESS.md
├── maps/
│   ├── system-map.md
│   ├── architecture-map.md
│   ├── repo-map.md
│   ├── worker-map.md
│   ├── route-map.md
│   └── skill-map.md
├── decisions/
│   └── INDEX.md
├── contracts/
│   ├── active.md
│   ├── closed.md
│   └── next-candidates.md
├── memories/
│   ├── user-preferences.md
│   ├── operating-style.md
│   ├── project-principles.md
│   ├── hard-rules.md
│   └── recurring-patterns.md
├── incidents/
│   ├── INDEX.md
│   ├── chat-engessado-readonly.md
│   ├── contract-drift.md
│   └── skill-runtime-gap.md
├── learnings/
│   ├── INDEX.md
│   ├── what-worked.md
│   ├── what-failed.md
│   └── future-risks.md
├── open-questions/
│   ├── INDEX.md
│   ├── unresolved-technical-gaps.md
│   └── strategic-questions.md
└── self-model/
    ├── identity.md
    ├── capabilities.md
    ├── limitations.md
    ├── current-state.md
    └── how-to-answer.md
```

---

## 8. Critérios de sucesso do contrato

Ao final do contrato, a Enavia deve conseguir:

- ✅ Responder como IA estratégica, não bot
- ✅ Explicar seu estado real
- ✅ Lembrar o que o operador quer dela
- ✅ Consultar brain/memória
- ✅ Reconhecer o próprio sistema
- ✅ Escolher skill correta
- ✅ Identificar lacunas
- ✅ Sugerir próximo contrato
- ✅ Não executar sem aprovação
- ✅ Não inventar capacidades que não possui

**Exemplo de resposta alvo:**

> "Vasques, eu sei operar meu sistema em camadas. Hoje eu tenho memória estruturada, mapas, skills documentais, leitura do estado atual, intenção da conversa, roteamento de skill e diagnóstico read-only. Eu posso pensar, diagnosticar, planejar e sugerir. Para executar, preciso de contrato ativo e aprovação. Se algo estiver faltando, eu consigo apontar a lacuna e sugerir o próximo contrato."

---

## 9. Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Autonomia cega | Crítico | Governed Execution obrigatória |
| Memória bagunçada | Alto | UPDATE_POLICY com aprovação supervisionada |
| Hallucination sobre sistema | Alto | Toda afirmação exige fonte. Self-Audit detecta. |
| Custo de contexto | Médio | Brain Loader com compactação. PR59 hardening. |
| Drift entre docs e runtime | Alto | Self-Audit detecta e reporta. Não corrige autonomamente. |
| Skills virarem bot rígido | Médio | Skills são referência, não roteiro obrigatório. |
| LLM responder sem fonte | Alto | Response Policy exige fonte ou marca como incerto. |
| Execução fora de contrato | Crítico | Governed Execution. Regra inviolável. |

---

## 10. Regras de bloqueio

- Se tentar implementar antes de diagnóstico quando exigido → **PARAR**
- Se alterar runtime em PR-DOCS → **PARAR**
- Se criar endpoint fora da PR autorizada → **PARAR**
- Se memória for escrita sem aprovação → **PARAR**
- Se skill executar sem contrato/aprovação → **PARAR**
- Se resposta LLM afirmar algo sem fonte → **MARCAR COMO INCERTO**
- Se houver conflito entre docs e runtime → **DOCUMENTAR E PARAR**
- Se custo/contexto ficar alto → **REGISTRAR RISCO E PROPOR COMPACTAÇÃO**

---

## 11. Estado inicial do contrato

### Situação em 2026-04-30

| Item | Estado |
|------|--------|
| Contrato anterior | `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — Encerrado ✅ |
| Repo antes desta PR31 | Sem contrato ativo |
| Executor automático de skills | ❌ Não existe |
| Endpoint `/skills/run` | ❌ Não existe |
| UI de skills | ❌ Não existe |
| Runtime lendo skills automaticamente | ❌ Não existe |
| Obsidian Brain completo | ❌ Não existe |
| Intent Engine | ❌ Não existe |
| LLM Core vivo | ❌ Não existe |
| Skill Router cognitivo | ❌ Não existe |
| Memory Retrieval inteligente | ❌ Não existe |
| Self-Audit runtime | ❌ Não existe |
| Skills documentais (4) | ✅ Existem |
| System Map e Route Registry | ✅ Existem |
| Loop contratual supervisionado | ✅ Funcional |

### O que esta PR31 faz

- Ativa o novo contrato `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
- Atualiza `schema/contracts/INDEX.md` para apontar o novo contrato como ativo
- Atualiza governança (status, handoff, execution log)
- Cria relatório curto `schema/reports/PR31_ATIVACAO_CONTRATO_JARVIS_BRAIN.md`
- **NÃO altera nenhum runtime**
- **NÃO cria nenhum Brain, Brain Loader, LLM Core, Intent Engine ou Self-Audit**

### Próxima PR autorizada após PR31

**PR32 — PR-DIAG — Diagnóstico do chat atual, memória atual, prompts, modos e causa da resposta engessada**

---

### Atualização pós-PR33 (2026-04-30)

A PR33 inseriu a **Frente 2 — Correção conceitual do Chat Runtime** entre o diagnóstico inicial e o Obsidian Brain, com base nas descobertas da PR32. O contrato foi ampliado de PR31–PR60 para **PR31–PR64**. As regras R1, R2, R3 e R4 foram adicionadas à seção 4. O Obsidian Brain foi deslocado para PR37+.

---

*Contrato criado em: 2026-04-30*
*Branch de criação: `copilot/claude-pr31-docs-ativar-contrato-jarvis-brain`*
*Atualizado em: 2026-04-30 (PR33) — Branch: `copilot/claudepr33-docs-ajuste-contrato-jarvis-pos-diagnos`*
*Atualizado em: 2026-05-02 (PR62) — Reconciliação pós-execução real PR57–PR61 — Branch: `copilot/claudepr62-docs-reconciliar-contrato-jarvis-brain`*

---

## 12. Reconciliação pós-execução real PR57–PR61

> **Adicionado em PR62 — 2026-05-02**
>
> Esta seção documenta o desalinhamento entre a numeração original prevista no contrato e a sequência real executada nas PRs recentes. O objetivo não é apagar o histórico nem fingir que o plano original estava errado — é reconciliar honestamente o que foi planejado, o que foi executado e por quê.

---

### A. Plano original previsto (trecho final do contrato — PRs 55–64)

| PR original | Tipo | Objetivo planejado |
|-------------|------|--------------------|
| PR55 | PR-IMPL | Response Policy viva |
| PR56 | PR-PROVA | Teste anti-bot |
| PR57 | PR-IMPL | Propor atualização de memória (Brain Update supervisionado) |
| PR58 | PR-PROVA | Teste de atualização supervisionada |
| PR59 | PR-DOCS | Blueprint do Runtime de Skills |
| PR60 | PR-DIAG | Diagnóstico técnico para Runtime de Skills |
| PR61 | PR-PROVA | Teste de jornada completa Jarvis |
| PR62 | PR-PROVA | Teste "conhece o próprio sistema" |
| PR63 | PR-HARDENING | Segurança, custo e limites |
| PR64 | PR-DOCS/PR-PROVA | Fechamento do Jarvis Brain v1 |

---

### B. Execução real

| PR real | Tipo | Objetivo real executado | Motivo de alteração/deslocamento |
|---------|------|------------------------|----------------------------------|
| PR55 | PR-DOCS | Self-Audit Framework (estrutura documental) | Frentes 9-10 foram reorganizadas: Self-Audit (PR52-PR55 do plano original) foi implementado antes de Response Policy. O plano original das frentes 9 e 10 foi executado, mas com numeração deslocada pelas PRs corretivas inseridas anteriormente. |
| PR56 | PR-IMPL | Self-Audit read-only (`schema/enavia-self-audit.js`) | Implementação do Self-Audit — correspondente ao PR53 do plano original. |
| PR57 | PR-PROVA | Prova do Self-Audit read-only (96/99 — falha parcial, Cenário H) | Conforme protocolo: prova revelou falha real no Self-Audit. Não avançar sem corrigir. |
| PR58 | PR-IMPL (cirúrgica) | Correção cirúrgica do regex `\w+` → `[\w-]+` no `_detectMissingSource` | Correção obrigatória pós-prova com falha. Protocolo: prova falhou → correção cirúrgica → nova prova. |
| PR59 | PR-IMPL | Response Policy viva (`schema/enavia-response-policy.js`, 15 regras) | Retorno ao fluxo principal após ciclo corretivo PR57/PR58. Corresponde à frente 10 do plano (PR55 original). |
| PR60 | PR-PROVA | Prova anti-bot final — stack cognitiva completa (236/236 ✅) | Prova pós-Response Policy. Corresponde ao PR56 original. Passou integralmente. |
| PR61 | PR-DOCS/IMPL | Proposta documental de atualização de memória — consolidação do ciclo PR31–PR60 | Parcialmente corresponde ao PR57 original (Brain Update supervisionado), mas **apenas documentalmente** — sem implementação de escrita supervisionada real. |

---

### C. Tabela de equivalência

| Frente planejada | PR originalmente prevista | PR real executada | Status |
|-----------------|--------------------------|-------------------|--------|
| Self-Audit Framework | PR52 | PR55 | ✅ concluída |
| Self-Audit read-only | PR53 | PR56 | ✅ concluída |
| Prova Self-Audit | PR54 | PR57 | ✅ concluída (com falha parcial e correção) |
| Correção Self-Audit (cirúrgica) | — (inserida) | PR58 | ✅ concluída |
| Response Policy viva | PR55 | PR59 | ✅ concluída |
| Teste anti-bot | PR56 | PR60 | ✅ concluída (236/236) |
| Brain Update supervisionado (proposta documental) | PR57 | PR61 | ✅ concluída (documental) |
| Teste atualização supervisionada (escrita real) | PR58 | pendente/reavaliar | ⚠️ precisa decisão |
| Blueprint Runtime de Skills | PR59 | pendente | 🔲 próxima frente candidata (após decisão acima) |
| Diagnóstico Runtime de Skills | PR60 | pendente | 🔲 após blueprint |
| Hardening segurança/custo/limites | PR63 | pendente | 🔲 após diagnóstico |
| Fechamento Jarvis Brain v1 | PR64 | pendente | 🔲 final do ciclo |

---

### D. Regra de interpretação daqui para frente

**A partir desta reconciliação, as seguintes regras se aplicam:**

1. **A numeração original sofreu deslocamento por PRs corretivas legítimas.** Foram inseridas PRs de prova, correção cirúrgica e ciclos de correção conforme o protocolo obrigatório (prova falhou → correção → prova verde → retorno ao fluxo). Isso é comportamento correto — não é desvio.

2. **O contrato não deve ser seguido cegamente pela numeração antiga.** A numeração de PR no contrato (PR55, PR56, PR57...) foi planejada antes da execução. Durante a execução, PRs foram inseridas, o que deslocou todos os números seguintes.

3. **A partir desta reconciliação, seguir a FRENTE, não apenas o número.** O que importa é qual frente funcional está sendo endereçada, não qual número estava no plano original. Antes de abrir qualquer nova PR, verificar esta tabela de equivalência para identificar qual frente ainda está pendente.

4. **Antes de abrir a próxima PR:** consultar `schema/contracts/INDEX.md` (seção "Próxima PR autorizada") e esta seção 12 (tabela de equivalência). A tabela aqui é fonte de verdade do estado das frentes.

5. **Lacuna sobre atualização supervisionada de memória:** A PR61 propôs memória documentalmente mas não implementou escrita supervisionada real. Antes de avançar para Runtime de Skills, deve-se decidir se esta frente ainda é necessária, foi absorvida, ou deve ser formalmente cancelada.

---

### E. Próxima PR recomendada pós-reconciliação

**PR63 — PR-DIAG — Atualização supervisionada de memória: decidir se ainda é necessária**

**Justificativa:** A PR61 foi documental — propôs atualizações de memória mas não implementou escrita supervisionada real. A frente "Teste de atualização supervisionada" (originalmente PR58 no plano) ainda tem lacuna aberta. O operador orientou: não iniciar Runtime de Skills enquanto houver lacuna sobre atualização supervisionada de memória. Portanto, a próxima PR deve ser um diagnóstico honesto sobre essa frente — se foi concluída pela PR61, se foi absorvida, ou se precisa de implementação real ainda.

Somente após essa decisão (via PR63-DIAG) é que Blueprint do Runtime de Skills (PR64) pode ser aberto com segurança.
