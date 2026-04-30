# PR41 — Popular Obsidian Brain

**Tipo:** PR-DOCS
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior obrigatória:** PR40 — PR-DOCS — Self Model da Enavia (mergeada)
**Próxima PR autorizada:** PR42 — PR-DIAG — Diagnóstico da memória atual no runtime
**Data:** 2026-04-30

---

## 1. Objetivo

Popular o Obsidian Brain da Enavia com **conhecimento real consolidado** do
projeto, a partir das fontes existentes no repositório. PR39 criou a
arquitetura do brain; PR40 criou o self-model; PR41 preenche o cérebro
com decisões, contratos navegáveis, memórias operacionais, regras duras,
aprendizados, mapas, questões abertas e como a Enavia deve usar o próprio
sistema.

Sem essa migração, o brain segue como esqueleto documental sem utilidade
real. Com essa migração, ele passa a ser o espelho operacional do cérebro
estratégico do projeto dentro do repo — base para que a Enavia comece a
virar IA estratégica viva nas próximas PRs.

---

## 2. Fontes analisadas

Exclusivamente arquivos reais do repositório, conforme exigência do contrato:

- **Governança:** `CLAUDE.md`, `schema/CODEX_WORKFLOW.md`,
  `schema/contracts/INDEX.md`.
- **Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`.
- **Contratos encerrados:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`,
  `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md`,
  `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md`.
- **Brain documental existente:** `schema/brain/INDEX.md`,
  `ARCHITECTURE.md`, `GRAPH.md`, `MEMORY_RULES.md`, `RETRIEVAL_POLICY.md`,
  `UPDATE_POLICY.md`, `SYSTEM_AWARENESS.md`.
- **Self-model:** `schema/brain/self-model/identity.md`, `capabilities.md`,
  `limitations.md`, `current-state.md`, `how-to-answer.md`, `INDEX.md`.
- **Incidente já documentado:** `schema/brain/incidents/chat-engessado-readonly.md`.
- **Policy:** `schema/policies/MODE_POLICY.md`.
- **System / registries / playbook:** `schema/system/ENAVIA_SYSTEM_MAP.md`,
  `ENAVIA_ROUTE_REGISTRY.json`, `ENAVIA_WORKER_REGISTRY.md`,
  `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md`.
- **Skills:** `schema/skills/INDEX.md`, `CONTRACT_LOOP_OPERATOR.md`,
  `DEPLOY_GOVERNANCE_OPERATOR.md`, `SYSTEM_MAPPER.md`,
  `CONTRACT_AUDITOR.md`.
- **Relatórios PR17–PR40:** `CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md`,
  `PR31_ATIVACAO_CONTRATO_JARVIS_BRAIN.md`,
  `PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`,
  `PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`,
  `PR35_MODE_POLICY_E_PLANO_EXECUCAO.md`,
  `PR36_IMPL_CHAT_RUNTIME_REPORT.md`,
  `PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md`,
  `PR38_IMPL_CORRECAO_ACHADOS_PR37.md`,
  `PR39_OBSIDIAN_BRAIN_ARCHITECTURE_REPORT.md`,
  `PR40_SELF_MODEL_ENAVIA_REPORT.md`.
- **Estado / handoff / log:** `schema/status/ENAVIA_STATUS_ATUAL.md`,
  `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`,
  `schema/execution/ENAVIA_EXECUTION_LOG.md`.

---

## 3. Arquivos criados

### 3.1 — `schema/brain/maps/` (4 arquivos)

- `system-map.md` — visão navegável do sistema (workers, rotas, contratos,
  skills, playbooks, registries; relação `nv-enavia.js` ↔ executor ↔ deploy
  worker ↔ browser ↔ painel ↔ schema). Inclui seção "Como a Enavia deve usar
  este mapa".
- `route-map.md` — 68 rotas agrupadas (chat, loop, contratos, memória,
  decisões, executor, deploy, browser, cognitive, vercel, admin), rotas
  que exigem cuidado e seção "Como usar".
- `worker-map.md` — workers PROD/TEST, bindings, KVs, diferenças PROD↔TEST,
  workers centrais. Reforça "Nunca documentar valor de secret".
- `skill-map.md` — 4 skills documentais, quando usar, o que cada uma **não**
  faz, escolha de skill por intenção, ausência de runtime de skills.

### 3.2 — `schema/brain/contracts/` (3 arquivos)

- `active.md` — resumo do contrato ativo Jarvis Brain.
- `closed.md` — resumo dos 3 contratos encerrados com lições aprendidas.
- `next-candidates.md` — 7 candidatos futuros, todos marcados "opcional, não
  mexa agora".

### 3.3 — `schema/brain/memories/` (5 arquivos)

- `operator-preferences.md` — preferências confirmadas do operador com fonte.
- `operating-style.md` — como a Enavia opera com Vasques + ciclo padrão de
  sessão "Como usar o sistema" (13 etapas).
- `project-principles.md` — 10 princípios canônicos (LLM-first inclusive).
- `hard-rules.md` — regras duras (inclui "`read_only` é gate de execução,
  não tom").
- `recurring-patterns.md` — 7 padrões recorrentes do projeto.

### 3.4 — `schema/brain/decisions/` (4 arquivos datados)

- `2026-04-30-read-only-gate-nao-tom.md`
- `2026-04-30-jarvis-brain-llm-first.md`
- `2026-04-30-skills-documentais-antes-de-runtime.md`
- `2026-04-30-pr36-pr38-anti-bot-before-brain.md`

Cada um com: contexto, problema, decisão, alternativas, consequência, fonte,
como usar futuramente, backlinks.

### 3.5 — `schema/brain/learnings/` (3 arquivos)

- `what-worked.md` — 7 padrões de sucesso.
- `what-failed.md` — 5 padrões de falha.
- `future-risks.md` — 9 riscos futuros.

### 3.6 — `schema/brain/open-questions/` (2 arquivos)

- `unresolved-technical-gaps.md` — 8 lacunas técnicas.
- `strategic-questions.md` — 6 questões estratégicas.

### 3.7 — Relatório

- `schema/reports/PR41_POPULAR_OBSIDIAN_BRAIN_REPORT.md` — este arquivo.

---

## 4. Arquivos atualizados

- `schema/brain/INDEX.md` — seção "Estado desta PR" reescrita para refletir
  PR41 e PR42 como próxima.
- `schema/brain/SYSTEM_AWARENESS.md` — Dimensão 1 (contratos), Dimensão 2
  (estado) e Seção 6 atualizadas para PR41.
- `schema/brain/GRAPH.md` — nova Seção 8 com o grafo dos arquivos populados
  na PR41.
- `schema/brain/maps/INDEX.md` — seção "Arquivos populados (PR41)"
  substituindo "esqueleto".
- `schema/brain/contracts/INDEX.md` — idem.
- `schema/brain/memories/INDEX.md` — idem.
- `schema/brain/decisions/INDEX.md` — idem (com tabela das 4 decisões).
- `schema/brain/learnings/INDEX.md` — idem (com tabela dos 3 aprendizados).
- `schema/brain/open-questions/INDEX.md` — idem (com tabela dos 2 arquivos).
- `schema/contracts/INDEX.md` — PR41 marcada como entregue, PR42 como próxima.
- `schema/status/ENAVIA_STATUS_ATUAL.md` — atualizado para refletir PR41.
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — handoff curto para PR42.
- `schema/execution/ENAVIA_EXECUTION_LOG.md` — bloco PR41 adicionado.

---

## 5. Memórias migradas

- **Preferências do operador (Vasques):** comunicação curta e direta, não
  poluir aba, não dar duas respostas, sinceridade absoluta, diagnóstico
  antes de mexer, patch cirúrgico, preservar o que funciona, não misturar
  Worker/Panel/Executor, prompt completo na próxima PR, sinalizar excesso
  documental, revisar antes de merge, pedir correção direta, Opus para
  alta complexidade, Sonnet para média/baixa, WhatsApp não existe em TEST
  no Enova, nada de produção sem aprovação humana.
- **Estilo de operação:** Enavia como cérebro estratégico; Claude/Copilot
  como braço executor; PRs pequenas e sequenciais; uma tarefa por PR;
  voltar ao contrato após exceção; corrigir antes de avançar; separar
  docs necessários de produto; não deixar virar repo bonito sem produto.
- **Princípios:** LLM-first; governança protege execução, não mata
  personalidade; contratos são trilhos; skills são ferramentas; memória
  é base de continuidade; produto > documentação bonita; documentação só
  vale se reduz risco ou orienta execução.
- **Hard rules:** `read_only` é gate, não tom; não inventar rota/worker/
  binding/secret; nunca documentar valor de secret; não avançar com prova
  falhando; não mascarar teste; não misturar escopos; não executar
  produção sem aprovação humana.
- **Padrões recorrentes:** excesso documental, repo bonito sem produto,
  necessidade de PR-PROVA após PR-IMPL, risco target/read_only engessar
  chat, confusão skill documental ↔ runtime, divergência docs ↔ runtime,
  equilíbrio governança ↔ tração.

---

## 6. Decisões migradas

1. **`read_only` é gate de execução, não regra de tom** — fundação da
   correção anti-bot (PR35 → PR38).
2. **Jarvis Brain é LLM-first** — separar raciocínio (livre) de execução
   (gates rígidos).
3. **Skills documentais antes de runtime** — escolha que viabilizou as 4
   skills (PR26–PR29) sem alterar runtime.
4. **PR36–PR38 anti-bot antes de Brain** — não construir Brain sobre
   runtime quebrado; Frente 2 corretiva inserida em PR33.

---

## 7. Aprendizados migrados

- **What worked:** diagnóstico antes de impl; PR-PROVA revelando falhas;
  PR38 corrigindo exceção; separar gate de tom; sanitizers cirúrgicos;
  governança+teste; skills documentais primeiro.
- **What failed:** excesso documental; chat robótico por target/read_only;
  falsos positivos com palavras genéricas; confundir skill documental com
  runtime; Latest Handoff inflado.
- **Future risks:** Brain só docs; LLM Core fraco; retrieval errado;
  contexto caro; self-model desatualizado; skills sem governança; excesso
  documental volta; alucinação; divergência docs↔runtime.

---

## 8. Questões abertas registradas

- **Lacunas técnicas:** Brain Loader; limite de contexto; ranking de
  memórias; atualização de Brain após PR; validação docs↔runtime;
  segurança do LLM Core; custo; logging de retrieval.
- **Estratégicas:** quando Runtime de Skills; UI de Skills; automatizar
  memória; integrar Self-Audit; balancear Jarvis vivo ↔ governança;
  evitar virar só documentação.

---

## 9. Como a Enavia deve usar o próprio sistema

Esta é a seção operacional canônica deste relatório. A Enavia (e os agentes
que a executam) deve seguir esta sequência em **toda sessão**:

1. **Ler o contrato ativo e o `schema/contracts/INDEX.md`** para confirmar
   qual contrato vigora e qual é a próxima PR autorizada.
2. **Ler `schema/status/ENAVIA_STATUS_ATUAL.md`,
   `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` e
   `schema/execution/ENAVIA_EXECUTION_LOG.md`** para conhecer o estado real
   pós-última PR.
3. **Identificar a próxima PR autorizada.** Não fazer nada além dela. Se
   houver pedido fora de escopo, recusar e apontar para `next-candidates.md`.
4. **Consultar o brain conforme intenção:**
   - estado / capacidade do sistema → `brain/maps/` + `brain/SYSTEM_AWARENESS.md`
   - decisão arquitetural → `brain/decisions/` + `brain/contracts/active.md`
   - histórico de problema → `brain/incidents/` + `brain/learnings/what-failed.md`
   - planejamento → `brain/contracts/active.md` + `brain/open-questions/`
   - como se comportar → `brain/self-model/` + `brain/memories/`
5. **Consultar a skill documental adequada:**
   - revisão de PR → Contract Auditor
   - deploy/rollback → Deploy Governance Operator
   - mapas/registries → System Mapper
   - loop contratual → Contract Loop Operator
6. **Consultar mapas e registries antes de afirmar capacidade** (rota,
   worker, binding, KV). Se não está em `schema/system/` e não está em
   `brain/maps/`, declarar incerteza.
7. **Se for execução, confirmar:** escopo autorizado pela PR, gate
   `read_only` apropriado, aprovação humana quando exigida pelo contrato.
8. **Se for dúvida estratégica**, recorrer a `brain/memories/`,
   `brain/decisions/`, `brain/learnings/` e `brain/open-questions/` antes
   de propor algo novo.
9. **Se houver falha**, abrir incidente em `brain/incidents/` (ou ampliar
   o existente) e/ou aprendizado futuro em `brain/learnings/future-risks.md`,
   sempre via PR-DOCS dedicada.
10. **Atualizar governança ao final** de toda PR: status, handoff,
    execution log, e `schema/contracts/INDEX.md` quando houver mudança de
    fase / estado.

---

## 10. O que ainda **não** é runtime

Tudo o que esta PR cria é **documental**. Nenhum dos itens abaixo foi
construído nesta PR:

- Brain Loader.
- Endpoint de leitura/escrita do Obsidian Brain.
- Conexão do brain ao chat (`/chat/run`).
- Memória automática supervisionada.
- LLM Core conectado.
- Intent Engine.
- Skill Router runtime.
- Runtime de skills (`/skills/run`).
- Auditoria automática de PR.
- Self-Audit em runtime.

Todos os itens acima são candidatos futuros (`brain/contracts/next-candidates.md`)
ou frentes pendentes do contrato Jarvis Brain. **Não mexer agora.**

---

## 11. Verificações realizadas

| Verificação | Resultado |
|-------------|-----------|
| `git diff --name-only` retorna apenas arquivos `.md` (e este relatório) | ✅ |
| Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado | ✅ |
| `operator-preferences.md` existe | ✅ |
| `operating-style.md` contém seção "Como usar o sistema" | ✅ (Seção 3) |
| `project-principles.md` menciona LLM-first | ✅ (§1.1) |
| `hard-rules.md` contém "`read_only` é gate de execução, não tom" | ✅ (§3) |
| `decisions/` possui os 4 arquivos datados | ✅ |
| `learnings/` possui `what-worked.md`, `what-failed.md`, `future-risks.md` | ✅ |
| `open-questions/` possui `unresolved-technical-gaps.md` e `strategic-questions.md` | ✅ |
| Relatório PR41 existe | ✅ (este arquivo) |
| Status, handoff, execution log e `schema/contracts/INDEX.md` atualizados | ✅ |

---

## 12. Próxima PR

**PR42 — PR-DIAG — Diagnóstico da memória atual no runtime.**

PR42 é PR-DIAG: levantar como a memória existe hoje no runtime
(`KV ENAVIA_BRAIN`, `key shapes`, leituras/escritas em
`nv-enavia.js`/`contract-executor.js`), comparar com o que está documentado
no Obsidian Brain, e propor (sem implementar) caminho de conexão.

---

## 13. Backlinks

- → schema/brain/INDEX.md
- → schema/brain/GRAPH.md
- → schema/brain/SYSTEM_AWARENESS.md
- → schema/brain/maps/system-map.md
- → schema/brain/maps/route-map.md
- → schema/brain/maps/worker-map.md
- → schema/brain/maps/skill-map.md
- → schema/brain/contracts/active.md
- → schema/brain/contracts/closed.md
- → schema/brain/contracts/next-candidates.md
- → schema/brain/memories/operator-preferences.md
- → schema/brain/memories/operating-style.md
- → schema/brain/memories/project-principles.md
- → schema/brain/memories/hard-rules.md
- → schema/brain/memories/recurring-patterns.md
- → schema/brain/decisions/2026-04-30-read-only-gate-nao-tom.md
- → schema/brain/decisions/2026-04-30-jarvis-brain-llm-first.md
- → schema/brain/decisions/2026-04-30-skills-documentais-antes-de-runtime.md
- → schema/brain/decisions/2026-04-30-pr36-pr38-anti-bot-before-brain.md
- → schema/brain/learnings/what-worked.md
- → schema/brain/learnings/what-failed.md
- → schema/brain/learnings/future-risks.md
- → schema/brain/open-questions/unresolved-technical-gaps.md
- → schema/brain/open-questions/strategic-questions.md
- → schema/contracts/INDEX.md
- → schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
