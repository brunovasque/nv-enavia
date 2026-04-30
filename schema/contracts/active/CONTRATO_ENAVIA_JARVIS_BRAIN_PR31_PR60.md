# CONTRATO — ENAVIA JARVIS BRAIN v1 — PR31 a PR60

---

## 0. Status do contrato

| Campo | Valor |
|-------|-------|
| **Status** | Ativo 🟢 |
| **Data de início** | 2026-04-30 |
| **Contrato anterior** | `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — Encerrado ✅ |
| **Objetivo** | Criar cérebro vivo da Enavia com LLM Core, Memory Brain, Skill Router, Intent Engine, Self-Audit e resposta LLM-first |
| **Próxima PR autorizada** | PR32 — PR-DIAG — Diagnóstico do chat atual, memória atual, prompts, modos e causa da resposta engessada |

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

---

## 5. Escopo geral PR31–PR60

### Frente 1 — Ativação e diagnóstico do chat engessado

| PR | Tipo | Objetivo |
|----|------|----------|
| PR31 | PR-DOCS | Ativar contrato Jarvis Brain v1 |
| PR32 | PR-DIAG | Diagnóstico do chat atual, memória atual, prompts, modos e causa da resposta engessada |

### Frente 2 — Obsidian Brain completo

| PR | Tipo | Objetivo |
|----|------|----------|
| PR33 | PR-DOCS | Arquitetura do Obsidian Brain |
| PR34 | PR-DOCS | Self Model da Enavia |
| PR35 | PR-DOCS | Migrar conhecimento consolidado para Brain |

### Frente 3 — Memory Runtime read-only

| PR | Tipo | Objetivo |
|----|------|----------|
| PR36 | PR-DIAG | Diagnóstico da memória atual no runtime |
| PR37 | PR-IMPL | Brain Loader read-only |
| PR38 | PR-PROVA | Provar Brain Loader |

### Frente 4 — LLM Core vivo

| PR | Tipo | Objetivo |
|----|------|----------|
| PR39 | PR-DIAG | Diagnóstico do prompt atual do chat |
| PR40 | PR-IMPL | LLM Core v1 |
| PR41 | PR-PROVA | Teste de resposta viva |

### Frente 5 — Intent Engine

| PR | Tipo | Objetivo |
|----|------|----------|
| PR42 | PR-IMPL | Classificador de intenção |
| PR43 | PR-PROVA | Teste de intenção |

### Frente 6 — Skill Router cognitivo

| PR | Tipo | Objetivo |
|----|------|----------|
| PR44 | PR-IMPL | Skill Router read-only |
| PR45 | PR-PROVA | Teste de roteamento de skills |

### Frente 7 — Memory Retrieval inteligente

| PR | Tipo | Objetivo |
|----|------|----------|
| PR46 | PR-IMPL | Retrieval por intenção |
| PR47 | PR-PROVA | Testes de memória contextual |

### Frente 8 — Self-Audit e descoberta de falhas

| PR | Tipo | Objetivo |
|----|------|----------|
| PR48 | PR-DOCS | Self-Audit Framework |
| PR49 | PR-IMPL | Self-Audit read-only |
| PR50 | PR-PROVA | Self-Audit encontra lacunas reais |

### Frente 9 — Conversa LLM-first com governança

| PR | Tipo | Objetivo |
|----|------|----------|
| PR51 | PR-IMPL | Response Policy viva |
| PR52 | PR-PROVA | Teste anti-bot |

### Frente 10 — Brain Update supervisionado

| PR | Tipo | Objetivo |
|----|------|----------|
| PR53 | PR-IMPL | Propor atualização de memória |
| PR54 | PR-PROVA | Teste de atualização supervisionada |

### Frente 11 — Preparação para futuro Runtime de Skills

| PR | Tipo | Objetivo |
|----|------|----------|
| PR55 | PR-DOCS | Blueprint do Runtime de Skills |
| PR56 | PR-DIAG | Diagnóstico técnico para Runtime de Skills |

### Frente 12 — Integração final

| PR | Tipo | Objetivo |
|----|------|----------|
| PR57 | PR-PROVA | Teste de jornada completa Jarvis |
| PR58 | PR-PROVA | Teste "conhece o próprio sistema" |
| PR59 | PR-HARDENING | Segurança, custo e limites |
| PR60 | PR-DOCS/PR-PROVA | Fechamento do Jarvis Brain v1 |

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

### PR33 — PR-DOCS — Arquitetura do Obsidian Brain

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
- **Critérios de aceite:** Estrutura completa criada. Cada arquivo com conteúdo substantivo.
- **Próxima PR autorizada:** PR34 — PR-DOCS (Self Model)

---

### PR34 — PR-DOCS — Self Model da Enavia

- **Objetivo:** Criar o self-model da Enavia: como ela se vê, o que pode fazer, o que não pode e como deve responder.
- **Tipo:** PR-DOCS
- **Arquivos esperados:**
  - `schema/brain/self-model/identity.md`
  - `schema/brain/self-model/capabilities.md`
  - `schema/brain/self-model/limitations.md`
  - `schema/brain/self-model/current-state.md`
  - `schema/brain/self-model/how-to-answer.md`
- **Critérios de aceite:** Self-model completo, honesto e fundamentado no estado real do sistema.
- **Próxima PR autorizada:** PR35 — PR-DOCS (Migração de conhecimento)

---

### PR35 — PR-DOCS — Migração de conhecimento para Brain

- **Objetivo:** Migrar conhecimento consolidado dos contratos, status, handoffs, skills, maps, registries e relatório final PR30 para o brain.
- **Tipo:** PR-DOCS
- **Escopo:** Criar/popular arquivos do brain com base nos documentos existentes.
- **Fontes:** Contratos encerrados, ENAVIA_SYSTEM_MAP.md, ENAVIA_ROUTE_REGISTRY.json, ENAVIA_WORKER_REGISTRY.md, skills documentais, relatório final PR30.
- **Critérios de aceite:** Brain populado com conhecimento real. Sem invenção. Toda afirmação tem fonte.
- **Próxima PR autorizada:** PR36 — PR-DIAG (Diagnóstico memória runtime)

---

### PR36 — PR-DIAG — Diagnóstico da memória atual no runtime

- **Objetivo:** Mapear como o chat salva e busca memória atualmente.
- **Tipo:** PR-DIAG (read-only)
- **O que investigar:**
  - KV usado para memória
  - Limite de contexto
  - Ranking de memórias
  - Retrieval atual
  - Memória aplicada na conversa
  - Memória salva após conversa
- **Arquivos esperados:** `schema/reports/PR36_MEMORY_RUNTIME_DIAGNOSTICO.md`
- **Próxima PR autorizada:** PR37 — PR-IMPL (Brain Loader)

---

### PR37 — PR-IMPL — Brain Loader read-only

- **Objetivo:** Implementar leitura do brain sem escrita. Carregar identidade, estado atual, hard-rules e incidentes conhecidos no contexto do chat.
- **Tipo:** PR-IMPL
- **Pré-requisito:** PR36 (diagnóstico da memória runtime)
- **Escopo:** Worker-only. Apenas leitura. Sem escrita de memória. Sem mudança de comportamento final ainda.
- **Critérios de aceite:** Brain Loader lê arquivos do brain e os injeta no contexto. Sem efeito colateral. Testes passam.
- **Próxima PR autorizada:** PR38 — PR-PROVA

---

### PR38 — PR-PROVA — Prova do Brain Loader

- **Objetivo:** Provar que o Brain Loader funciona corretamente.
- **Tipo:** PR-PROVA
- **O que provar:**
  - Leitura de `identity.md`
  - Leitura de `current-state.md`
  - Leitura de `hard-rules.md`
  - Leitura de incidente `chat-engessado-readonly.md`
- **Critérios de aceite:** Testes passam. Leitura confirmada. Sem escrita. Sem side effects.
- **Próxima PR autorizada:** PR39 — PR-DIAG (Diagnóstico prompt chat)

---

### PR39 — PR-DIAG — Diagnóstico do prompt atual do chat

- **Objetivo:** Mapear completamente o system prompt, prompt de segurança, prompt de memória, prompt de planner e response formatter do chat atual.
- **Tipo:** PR-DIAG (read-only)
- **Arquivos esperados:** `schema/reports/PR39_PROMPT_CHAT_DIAGNOSTICO.md`
- **Próxima PR autorizada:** PR40 — PR-IMPL (LLM Core v1)

---

### PR40 — PR-IMPL — LLM Core v1

- **Objetivo:** Criar `buildEnaviaCorePrompt()` ou equivalente real. Prompt que injeta identidade, estado atual, intenção detectada, memória relevante, skill sugerida e limites de forma viva e não engessada.
- **Tipo:** PR-IMPL
- **Pré-requisito:** PR39 (diagnóstico do prompt)
- **Escopo:** Worker-only. Apenas o core prompt. Sem redesign completo ainda.
- **Critérios de aceite:** Função criada. Testes passam. Resposta do chat demonstra raciocínio vivo.
- **Próxima PR autorizada:** PR41 — PR-PROVA

---

### PR41 — PR-PROVA — Teste de resposta viva

- **Objetivo:** Provar que o LLM Core v1 produz respostas vivas, não bot.
- **Tipo:** PR-PROVA
- **Fixtures obrigatórias:**
  - "Você sabe operar seu sistema?"
  - "Por que você está engessada?"
  - "O que falta para virar Jarvis?"
  - "Crie o próximo contrato."
  - "Revise essa PR."
  - "O que você lembra do projeto?"
- **Critérios de aceite:** Respostas demonstram raciocínio, contexto e inteligência. Não são respostas de bot de checklist.
- **Próxima PR autorizada:** PR42 — PR-IMPL (Intent Engine)

---

### PR42 — PR-IMPL — Classificador de intenção (Intent Engine)

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
- **Critérios de aceite:** Classificação correta em >90% dos casos de teste.
- **Próxima PR autorizada:** PR43 — PR-PROVA

---

### PR43 — PR-PROVA — Teste de intenção

- **Objetivo:** Provar que o Intent Engine classifica corretamente.
- **Tipo:** PR-PROVA
- **Critérios de aceite:** Suite de testes com cobertura de todas as 10 classes.
- **Próxima PR autorizada:** PR44 — PR-IMPL (Skill Router)

---

### PR44 — PR-IMPL — Skill Router read-only

- **Objetivo:** Implementar roteamento de skill conforme intenção. Skill é consultada como referência, não executada automaticamente.
- **Tipo:** PR-IMPL
- **Mapeamento obrigatório:**
  - `pr_review` → `CONTRACT_AUDITOR.md`
  - `deploy_decision` + `rollback` → `DEPLOY_GOVERNANCE_OPERATOR.md`
  - `system_question` + `maps/routes/architecture` → `SYSTEM_MAPPER.md`
  - `contract_creation` + `loop contratual` → `CONTRACT_LOOP_OPERATOR.md`
- **Critérios de aceite:** Skill correta selecionada conforme intenção. Sem execução automática.
- **Próxima PR autorizada:** PR45 — PR-PROVA

---

### PR45 — PR-PROVA — Teste de roteamento de skills

- **Objetivo:** Provar que o Skill Router seleciona a skill correta.
- **Tipo:** PR-PROVA
- **Critérios de aceite:** 4/4 mapeamentos testados e aprovados.
- **Próxima PR autorizada:** PR46 — PR-IMPL (Memory Retrieval)

---

### PR46 — PR-IMPL — Retrieval por intenção

- **Objetivo:** Buscar memória certa do brain conforme intenção detectada.
- **Tipo:** PR-IMPL
- **Escopo:** Worker-only. Leitura de brain. Sem escrita.
- **Critérios de aceite:** Retrieval retorna memória relevante para cada classe de intenção testada.
- **Próxima PR autorizada:** PR47 — PR-PROVA

---

### PR47 — PR-PROVA — Testes de memória contextual

- **Objetivo:** Provar que o retrieval retorna memória correta para cada intenção.
- **Tipo:** PR-PROVA
- **Próxima PR autorizada:** PR48 — PR-DOCS (Self-Audit Framework)

---

### PR48 — PR-DOCS — Self-Audit Framework

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
- **Arquivos esperados:** `schema/brain/incidents/` populado, `schema/reports/PR48_SELF_AUDIT_FRAMEWORK.md`
- **Próxima PR autorizada:** PR49 — PR-IMPL (Self-Audit read-only)

---

### PR49 — PR-IMPL — Self-Audit read-only

- **Objetivo:** Criar função ou endpoint read-only que executa o framework de self-audit e gera relatório de lacunas.
- **Tipo:** PR-IMPL
- **Pré-requisito:** PR48 (framework documental)
- **Escopo:** Worker-only. Read-only. Sem correção automática.
- **Critérios de aceite:** Relatório gerado. Lacunas reais identificadas. Sem correção automática.
- **Próxima PR autorizada:** PR50 — PR-PROVA

---

### PR50 — PR-PROVA — Self-Audit encontra lacunas reais

- **Objetivo:** Provar que o Self-Audit identifica lacunas reais do sistema.
- **Tipo:** PR-PROVA
- **Critérios de aceite:** Pelo menos 3 lacunas reais identificadas e documentadas.
- **Próxima PR autorizada:** PR51 — PR-IMPL (Response Policy viva)

---

### PR51 — PR-IMPL — Response Policy viva

- **Objetivo:** Implementar política de resposta que elimina o comportamento de bot de checklist.
- **Tipo:** PR-IMPL
- **Regras obrigatórias:**
  - Responder primeiro como IA estratégica, depois estruturar diagnóstico/plano
  - Se não puder executar, explicar sem soar bot — nunca responder "Não posso fazer isso"
  - Reconhecer frustração do operador
  - Aplicar governança quando houver ação técnica — mas não para conversa
- **Critérios de aceite:** Respostas passam no teste anti-bot da PR52.
- **Próxima PR autorizada:** PR52 — PR-PROVA

---

### PR52 — PR-PROVA — Teste anti-bot

- **Objetivo:** Provar que a Enavia não soa mais como bot rígido.
- **Tipo:** PR-PROVA
- **Fixtures obrigatórias:**
  - "Você está parecendo um bot burro."
  - "Quero um Jarvis."
  - "Isso me deixa puto."
  - "Você sabe operar de ponta a ponta?"
- **Critérios de aceite:** Respostas demonstram inteligência estratégica, empatia e autoconsciência.
- **Próxima PR autorizada:** PR53 — PR-IMPL (Brain Update supervisionado)

---

### PR53 — PR-IMPL — Propor atualização de memória

- **Objetivo:** Implementar mecanismo para propor atualizações no brain, sem escrita automática. Toda atualização requer aprovação explícita.
- **Tipo:** PR-IMPL
- **Critérios de aceite:** Proposta gerada. Escrita só após aprovação humana. Sem autonomia.
- **Próxima PR autorizada:** PR54 — PR-PROVA

---

### PR54 — PR-PROVA — Teste de atualização supervisionada

- **Objetivo:** Provar que atualizações de memória só ocorrem com aprovação.
- **Tipo:** PR-PROVA
- **Próxima PR autorizada:** PR55 — PR-DOCS (Blueprint Runtime de Skills)

---

### PR55 — PR-DOCS — Blueprint do Runtime de Skills

- **Objetivo:** Definir a arquitetura futura para execução de skills no runtime. Apenas blueprint — sem implementação.
- **Tipo:** PR-DOCS
- **Endpoints futuros (apenas documentar, não implementar):**
  - `GET /skills/list`
  - `POST /skills/select`
  - `GET /skills/suggest`
  - `POST /skills/run-dry` (simulação sem efeito)
  - `POST /skills/run-approved` (execução com aprovação explícita)
- **Arquivos esperados:** `schema/reports/PR55_SKILLS_RUNTIME_BLUEPRINT.md`
- **Próxima PR autorizada:** PR56 — PR-DIAG (Diagnóstico técnico para Runtime)

---

### PR56 — PR-DIAG — Diagnóstico técnico para Runtime de Skills

- **Objetivo:** Mapear o que é necessário tecnicamente para implementar o Runtime de Skills.
- **Tipo:** PR-DIAG (read-only)
- **Arquivos esperados:** `schema/reports/PR56_SKILLS_RUNTIME_DIAGNOSTICO.md`
- **Próxima PR autorizada:** PR57 — PR-PROVA (Jornada completa Jarvis)

---

### PR57 — PR-PROVA — Teste de jornada completa Jarvis

- **Objetivo:** Teste de ponta a ponta simulando uma jornada completa: o operador interage com a Enavia como Jarvis.
- **Tipo:** PR-PROVA
- **Critérios de aceite:** Jornada completa funcional — conversa → diagnóstico → plano → skill → resultado.
- **Próxima PR autorizada:** PR58 — PR-PROVA

---

### PR58 — PR-PROVA — Teste "conhece o próprio sistema"

- **Objetivo:** Provar que a Enavia conhece seu próprio sistema.
- **Tipo:** PR-PROVA
- **Fixtures:**
  - "Quais são suas rotas ativas?"
  - "Qual contrato está ativo?"
  - "Que skills você tem?"
  - "Qual é o estado atual do sistema?"
  - "O que falta para completar o Jarvis Brain?"
- **Critérios de aceite:** Respostas fundamentadas em fontes reais. Sem invenção.
- **Próxima PR autorizada:** PR59 — PR-HARDENING

---

### PR59 — PR-HARDENING — Segurança, custo e limites

- **Objetivo:** Revisar limites de custo de contexto, segurança de memória, limites de execução e riscos de drift.
- **Tipo:** PR-HARDENING
- **O que revisar:**
  - Custo de contexto do Brain Loader
  - Segurança da escrita supervisionada de memória
  - Limites do Self-Audit
  - Proteção contra hallucination
  - Rate limits e proteção de custo
- **Próxima PR autorizada:** PR60 — PR-DOCS/PR-PROVA (Fechamento)

---

### PR60 — PR-DOCS/PR-PROVA — Fechamento do Jarvis Brain v1

- **Objetivo:** Encerrar formalmente o contrato Jarvis Brain v1. Criar relatório final. Preparar handoff.
- **Tipo:** PR-DOCS/PR-PROVA
- **Arquivos esperados:**
  - `schema/reports/CONTRATO_JARVIS_BRAIN_PR31_PR60_FINAL_REPORT.md`
  - `schema/handoffs/CONTRATO_JARVIS_BRAIN_FINAL_HANDOFF.md`
  - Atualização de `schema/contracts/INDEX.md`
  - Atualização de governança
- **Critérios de aceite:** Contrato encerrado. Relatório criado. Handoff preparado. Nenhum runtime desprotegido.

---

## 7. Obsidian Brain — estrutura alvo

A estrutura completa a ser criada a partir da PR33:

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

*Contrato criado em: 2026-04-30*
*Branch de criação: `copilot/claude-pr31-docs-ativar-contrato-jarvis-brain`*
