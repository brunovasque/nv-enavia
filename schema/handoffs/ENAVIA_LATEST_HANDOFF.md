# ENAVIA — Latest Handoff

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



## O que foi feito nesta sessão

### PR39 — PR-DOCS — Arquitetura do Obsidian Brain

**Tipo:** `PR-DOCS` (Docs-only, nenhum runtime alterado)
**Branch:** `copilot/claude-pr39-docs-arquitetura-obsidian-brain`

**Objetivo:**
Criar a estrutura documental completa do Obsidian Brain da Enavia, conforme contrato
Jarvis Brain. Esta PR retoma o fluxo principal do contrato após a conclusão da Frente 2
corretiva (PR32-PR38). Não implementa runtime. Cria o esqueleto e as regras do brain.

**Arquivos criados:**

1. **`schema/brain/INDEX.md`**: Porta de entrada do brain. Explica o que é, o que não é,
   como se relaciona com contratos/skills/mapas/LLM Core, estrutura de pastas e quando
   consultar cada área.

2. **`schema/brain/ARCHITECTURE.md`**: Arquitetura em 7 camadas (declarativa, operacional,
   decisão, incidentes, aprendizado, self-model, system awareness). Fluxo futuro documentado.
   Limites definidos.

3. **`schema/brain/GRAPH.md`**: Grafo de relações entre arquivos do brain. Padrão de backlink
   textual. Exemplo completo do incidente chat-engessado. Relações entre camadas e o resto do sistema.

4. **`schema/brain/MEMORY_RULES.md`**: Regras do que conta como memória válida. 6 tipos
   de memória definidos. Distinção crítica: `read_only` é gate de execução, não regra de tom.
   Hierarquia de confiabilidade. O que nunca conta como memória.

5. **`schema/brain/RETRIEVAL_POLICY.md`**: Política de recuperação por intenção. 11 intenções
   mapeadas com fontes primárias: `conversation`, `diagnosis`, `planning`, `contract_creation`,
   `pr_review`, `deploy_decision`, `memory_question`, `system_question`, `skill_request`,
   `execution_request`, `conversation/frustration`.

6. **`schema/brain/UPDATE_POLICY.md`**: Quando criar nova memória, quando atualizar, quando
   criar incidente, decisão, aprendizado, open question. Aprovação antes de gravar. Runtime
   de update supervisionado previsto para PRs futuras.

7. **`schema/brain/SYSTEM_AWARENESS.md`**: 4 dimensões (contratos, estado, sistema, skills)
   com fontes de verdade, o que afirmar com confiança, o que marcar como incerto, como evitar
   alucinação. Estado atual documentado pós-PR39.

8. **`schema/brain/maps/INDEX.md`** — finalidade, tipos, fontes primárias, limites.
9. **`schema/brain/decisions/INDEX.md`** — finalidade, estrutura obrigatória, exemplos.
10. **`schema/brain/contracts/INDEX.md`** — finalidade, referência rápida do contrato ativo.
11. **`schema/brain/memories/INDEX.md`** — finalidade, distinção preferência/inferência.
12. **`schema/brain/incidents/INDEX.md`** — finalidade, estrutura obrigatória, incidente listado.
13. **`schema/brain/learnings/INDEX.md`** — finalidade, diferença de incidente e decisão.
14. **`schema/brain/open-questions/INDEX.md`** — finalidade, questões abertas identificadas.
15. **`schema/brain/self-model/INDEX.md`** — finalidade, arquivos planejados para PR40, regra crítica.
16. **`schema/brain/incidents/chat-engessado-readonly.md`** — incidente completo: problema,
    7 camadas de causa, PRs PR32-PR38, correções aplicadas, estado atual (56/56 ✅), como evitar regressão.
17. **`schema/reports/PR39_OBSIDIAN_BRAIN_ARCHITECTURE_REPORT.md`** — relatório completo da PR39.

**Arquivos de governança atualizados:**

18. **`schema/contracts/INDEX.md`**: PR39 ✅ adicionada, próxima PR → PR40.
19. **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR39 registrada. Próxima PR: PR40.
20. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo): handoff atualizado para PR40.
21. **`schema/execution/ENAVIA_EXECUTION_LOG.md`**: bloco PR39 adicionado.

## Arquivos NÃO alterados

- `nv-enavia.js` (não tocado)
- `schema/enavia-cognitive-runtime.js` (não tocado)
- `panel/` (nenhum arquivo tocado)
- `contract-executor.js`, `executor/`
- `.github/workflows/`, `wrangler.toml`
- secrets, bindings, KV config
- contratos encerrados

## Próxima PR autorizada

**PR40 — PR-DOCS — Self Model da Enavia**

Objetivo: Criar os arquivos de self-model em `schema/brain/self-model/`:
- `identity.md` — quem é a Enavia, propósito, valores
- `capabilities.md` — o que a Enavia pode fazer agora vs. futuro
- `limits.md` — o que a Enavia não pode ou não deve fazer
- `how-to-answer.md` — forma de resposta, tom, nível de confiança
- `modes.md` — como se comportar em cada modo (conversation/diagnosis/execution)

Referências obrigatórias: `schema/policies/MODE_POLICY.md`, `schema/skills/INDEX.md`,
`brain/SYSTEM_AWARENESS.md` (criado nesta PR39).


## O que foi feito nesta sessão

### PR38 — PR-IMPL — Correção cirúrgica dos achados PR37 anti-bot

**Tipo:** `PR-IMPL` (worker-only, patch cirúrgico, runtime alterado em 2 arquivos)
**Branch:** `copilot/claudepr38-impl-corrigir-achados-pr37-anti-bot`

**Arquivos alterados (runtime):**

1. **`schema/enavia-cognitive-runtime.js`** (MODIFICADO): seção 5c separada em dois
   blocos independentes. Target informativo (`[ALVO OPERACIONAL ATIVO]` + campos +
   nota read_only factual) exibido sempre que `hasActiveTarget=true`. Bloco
   comportamental pesado (`MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:` +
   instruções detalhadas) exibido apenas quando `is_operational_context=true`.

2. **`nv-enavia.js`** (MODIFICADO): `_CHAT_OPERATIONAL_INTENT_TERMS` refinado.
   Removidos `"sistema"` e `"contrato"` como termos isolados (causavam falso positivo).
   Adicionados: `"estado do contrato"`, `"contrato ativo"` (termos compostos),
   `"revise"`, `"verifique"`, `"cheque"`, `"inspecione"` (verbos imperativos),
   `"runtime"`, `"gate"`, `"gates"` (termos técnicos de infraestrutura).

**Arquivos criados (relatório + governança):**

3. **`schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md`** (NOVO): 10 seções.
4. **`schema/contracts/INDEX.md`**: PR37 atualizada de ⚠️ para ✅, PR38 ✅ adicionada, próxima PR → PR39.
5. **`schema/status/ENAVIA_STATUS_ATUAL.md`**: PR38 registrada. Próxima PR: PR39.
6. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** (este arquivo): handoff atualizado para PR39.
7. **`schema/execution/ENAVIA_EXECUTION_LOG.md`**: bloco PR38 adicionado.

## Achados PR37 corrigidos

| Achado | Correção | Resultado |
|--------|----------|-----------|
| A2/B2 — `MODO OPERACIONAL ATIVO` com `hasActiveTarget=true` | Separação target/bloco operacional no `buildChatSystemPrompt` | ✅ |
| C1 — falso positivo `"sistema"` | Removido da lista | ✅ |
| D1 — falso negativo `"Revise"` / `"runtime"` / `"gate"` | Termos adicionados | ✅ |
| G5 — falso positivo `"contrato"` | Substituído por `"estado do contrato"` e `"contrato ativo"` | ✅ |

## Resultado dos testes

- `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js`: **56/56 ✅** (era 51/56)
- `node tests/pr36-chat-runtime-anti-bot.smoke.test.js`: **26/26 ✅**
- `node tests/pr21-loop-status-states.smoke.test.js`: **53/53 ✅**
- `node tests/pr20-loop-status-in-progress.smoke.test.js`: **27/27 ✅**
- `node tests/pr19-advance-phase-e2e.smoke.test.js`: **52/52 ✅**
- `node tests/pr14-executor-deploy-real-loop.smoke.test.js`: **183/183 ✅**
- `node tests/pr13-hardening-operacional.smoke.test.js`: **91/91 ✅**

## Próxima PR autorizada

**PR39 — PR-DOCS — Arquitetura do Obsidian Brain**

A Frente 2 corretiva do contrato Jarvis Brain está encerrada com evidência real.
PR39 retoma o fluxo principal: documentação da arquitetura do Obsidian Brain,
que é o primeiro pilar da Frente 3 (Brain, Intent Engine, Skill Router, LLM Core).

## Arquivos NÃO alterados

- `panel/` (nenhum arquivo tocado)
- `contract-executor.js`, `executor/`
- `.github/workflows/`, `wrangler.toml`
- secrets, bindings, KV config
- contratos encerrados

