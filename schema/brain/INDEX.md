# Obsidian Brain da Enavia — Índice

**Versão:** 1.0
**Data:** 2026-04-30
**Estado:** Documental — Não é runtime. Nenhuma memória é executada automaticamente nesta PR.

---

## O que é o Obsidian Brain

O Obsidian Brain é a memória estruturada e navegável da Enavia. É o conjunto de arquivos
Markdown que representam o que a Enavia sabe, o que decidiu, o que aprendeu, o que está
em aberto e como ela se entende enquanto sistema.

**Não é runtime.** Nenhum arquivo desta pasta é executado automaticamente. O brain é
lido por agentes, operadores e futuras integrações de contexto LLM quando existirem.

O brain se torna operacional em PRs futuras (conforme contrato Jarvis Brain PR31-PR64),
quando for conectado ao Intent Engine, ao LLM Core e ao Skill Router.

---

## O que não é o Obsidian Brain

- Não é um sistema de execução.
- Não é um banco de dados.
- Não é uma API.
- Não é um prompt de sistema.
- Não inventa memória sem fonte.
- Não toma decisões sozinho.
- Não sobrescreve o contrato ativo.

---

## Como o brain se relaciona com o resto do sistema

| Camada | Relação |
|--------|---------|
| **Contratos** (`schema/contracts/`) | O brain referencia contratos. Os contratos são a fonte de verdade operacional. |
| **Skills** (`schema/skills/`) | O brain descreve capacidades que as skills encapsulam. |
| **Mapas de sistema** (`schema/system/`) | O brain usa os mapas para system awareness. |
| **Mode Policy** (`schema/policies/MODE_POLICY.md`) | O brain documenta regras de comportamento derivadas da policy. |
| **LLM Core** (futuro) | O brain será o contexto injetado pelo LLM Core para geração de respostas contextualizadas. |
| **Intent Engine** (futuro) | O Intent Engine decidirá qual área do brain consultar por intenção. |
| **Skill Router** (futuro) | O Skill Router usará o brain para identificar a skill adequada à intenção detectada. |

---

## Estrutura de pastas

| Pasta | Conteúdo |
|-------|----------|
| `maps/` | Mapas de arquitetura, rotas, workers, skills e topologia do sistema. |
| `decisions/` | Decisões arquiteturais, técnicas, comerciais e de governança já tomadas. |
| `contracts/` | Resumos navegáveis dos contratos ativos e encerrados. |
| `memories/` | Preferências do operador, padrões recorrentes, regras de estilo e operação. |
| `incidents/` | Incidentes técnicos e cognitivos documentados, com causa e aprendizado. |
| `learnings/` | Aprendizados consolidados: o que funcionou, o que falhou, riscos futuros. |
| `open-questions/` | Lacunas técnicas, dúvidas estratégicas e questões abertas não resolvidas. |
| `self-model/` | Identidade, capacidades, limites, forma de resposta e auto-conhecimento da Enavia. |

---

## Quando consultar cada área

| Intenção | Áreas prioritárias |
|----------|-------------------|
| Entender o estado atual do sistema | `maps/` + `contracts/` + `schema/status/` |
| Tomar uma decisão de arquitetura | `decisions/` + `contracts/` + `open-questions/` |
| Responder sobre incidente passado | `incidents/` + `learnings/` + `schema/reports/` |
| Planejar próxima PR | `contracts/` + `open-questions/` + `schema/status/` |
| Entender como a Enavia deve se comportar | `self-model/` + `memories/` + `schema/policies/` |
| Checar capacidades do sistema | `maps/` + `schema/system/` + `schema/skills/` |

---

## Arquivos principais do brain

- `INDEX.md` — este arquivo: porta de entrada do brain.
- `ARCHITECTURE.md` — arquitetura geral do brain, camadas e fluxo futuro.
- `GRAPH.md` — grafo de relações entre os arquivos do brain.
- `MEMORY_RULES.md` — regras de o que conta como memória e o que não conta.
- `RETRIEVAL_POLICY.md` — política de busca por intenção.
- `UPDATE_POLICY.md` — quando criar, atualizar ou arquivar memória.
- `SYSTEM_AWARENESS.md` — fontes de verdade por dimensão do sistema.

---

## Estado desta pasta (atualizado após PR61)

| Arquivo / Pasta | Status |
|----------------|--------|
| `INDEX.md` | Atualizado PR61 |
| `ARCHITECTURE.md` | Criado PR39 |
| `GRAPH.md` | Criado PR39 |
| `MEMORY_RULES.md` | Criado PR39 |
| `RETRIEVAL_POLICY.md` | Criado PR39 |
| `UPDATE_POLICY.md` | Criado PR39 |
| `SYSTEM_AWARENESS.md` | Atualizado PR61 (seção 7: estado após PR60) |
| `maps/` | Criado PR39 |
| `decisions/` | Criado PR39 |
| `memories/INDEX.md` | Criado PR39 |
| `memories/JARVIS_BRAIN_PR31_PR60_MEMORY.md` | Criado PR61 — memória consolidada do ciclo |
| `memories/PROPOSED_MEMORY_UPDATES_PR61.md` | Criado PR61 — proposta de memória permanente |
| `learnings/INDEX.md` | Criado PR39 |
| `learnings/ANTI_BOT_FINAL_LEARNINGS.md` | Criado PR61 — aprendizados anti-bot validados |
| `learnings/future-risks.md` | Criado PR61 — riscos futuros identificados |
| `open-questions/INDEX.md` | Criado PR39 |
| `open-questions/unresolved-technical-gaps.md` | Criado PR61 — lacunas técnicas do ciclo PR31-PR60 |
| `incidents/` | Criado PR39 |
| `self-model/` | Criado PR40 |
| `contracts/` | Criado PR39 |

**Próxima PR autorizada:** PR62 — PR-DIAG — Planejamento da próxima fase pós-Jarvis Brain.
