# PR39 — Arquitetura do Obsidian Brain — Relatório

**Data:** 2026-04-30
**Tipo:** PR-DOCS
**Branch:** `copilot/claude-pr39-docs-arquitetura-obsidian-brain`
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR38 ✅ (PR-IMPL — 56/56 anti-bot passando, frente 2 corretiva encerrada)

---

## 1. Objetivo

Criar a estrutura documental completa do Obsidian Brain da Enavia, conforme contrato
Jarvis Brain (PR39 do contrato PR31-PR64).

Esta PR retoma o fluxo principal do contrato após a conclusão da Frente 2 corretiva
(PR32-PR38). Não implementa runtime. Cria o esqueleto e as regras do brain para que
as próximas PRs o populem e depois o conectem ao runtime.

---

## 2. Contexto

Após a PR38 (correção cirúrgica dos 5 achados da PR37 anti-bot, resultado 56/56 ✅),
a Frente 2 corretiva do contrato Jarvis Brain foi encerrada.

A PR39 inicia a Frente 3: construção do Obsidian Brain como sistema de memória
estruturada e navegável da Enavia.

---

## 3. Escopo

**Tipo:** PR-DOCS — documentação apenas, sem alteração de runtime.

**Permitido:** Criar arquivos em `schema/brain/`, atualizar governança.

**Proibido:** Alterar `nv-enavia.js`, `schema/enavia-cognitive-runtime.js`, Panel, Executor,
Deploy Worker, workflows, wrangler, endpoints, secrets, bindings ou KV.

---

## 4. Arquivos Criados

### Arquivos principais do brain

| Arquivo | Descrição |
|---------|-----------|
| `schema/brain/INDEX.md` | Porta de entrada do brain — o que é, estrutura, quando consultar |
| `schema/brain/ARCHITECTURE.md` | Arquitetura em 7 camadas, fluxo futuro, limites |
| `schema/brain/GRAPH.md` | Grafo de relações entre arquivos do brain |
| `schema/brain/MEMORY_RULES.md` | Regras do que conta como memória válida |
| `schema/brain/RETRIEVAL_POLICY.md` | Política de recuperação por intenção (11 intenções mapeadas) |
| `schema/brain/UPDATE_POLICY.md` | Quando criar, atualizar ou arquivar memória |
| `schema/brain/SYSTEM_AWARENESS.md` | 4 dimensões de consciência situacional com fontes de verdade |

### INDEX das subpastas

| Arquivo | Descrição |
|---------|-----------|
| `schema/brain/maps/INDEX.md` | Mapas de arquitetura e topologia |
| `schema/brain/decisions/INDEX.md` | Decisões arquiteturais e técnicas |
| `schema/brain/contracts/INDEX.md` | Resumos navegáveis de contratos |
| `schema/brain/memories/INDEX.md` | Preferências do operador e padrões de operação |
| `schema/brain/incidents/INDEX.md` | Incidentes técnicos e cognitivos documentados |
| `schema/brain/learnings/INDEX.md` | Aprendizados derivados de experiência |
| `schema/brain/open-questions/INDEX.md` | Questões abertas e lacunas pendentes |
| `schema/brain/self-model/INDEX.md` | Identidade, capacidades e limites da Enavia |

### Incidente documentado

| Arquivo | Descrição |
|---------|-----------|
| `schema/brain/incidents/chat-engessado-readonly.md` | Incidente completo: problema, 7 camadas de causa, PRs PR32-PR38, estado atual, como evitar regressão |

### Este relatório

| Arquivo | Descrição |
|---------|-----------|
| `schema/reports/PR39_OBSIDIAN_BRAIN_ARCHITECTURE_REPORT.md` | Este arquivo |

---

## 5. Destaques do Brain

### 5.1 Arquitetura em 7 Camadas

1. Memória Declarativa — o que o sistema é (rotas, workers, contratos)
2. Memória Operacional — como o operador quer que a Enavia opere
3. Memória de Decisão — decisões arquiteturais registradas
4. Memória de Incidentes — falhas e comportamentos indesejados documentados
5. Memória de Aprendizado — inferências derivadas de experiências reais
6. Self-Model — identidade, capacidades, limites, forma de resposta
7. System Awareness — consciência situacional sobre o próprio sistema

### 5.2 Retrieval Policy — 11 Intenções Mapeadas

| Intenção | Fontes primárias |
|----------|-----------------|
| `conversation` | memories + self-model |
| `diagnosis` | incidents + learnings + system maps |
| `planning` | contracts + open-questions + decisions |
| `contract_creation` | contracts + decisions + open-questions |
| `pr_review` | contracts + execution log + skills/contract_auditor |
| `deploy_decision` | skills/deploy_governance + incidents + decisions |
| `memory_question` | brain inteiro + MEMORY_RULES |
| `system_question` | maps + system + SYSTEM_AWARENESS |
| `skill_request` | skills/INDEX + self-model |
| `execution_request` | MODE_POLICY + SYSTEM_AWARENESS + contracts |
| `conversation/frustration` | memories + incidents + self-model |

### 5.3 Distinção Crítica Registrada

`read_only` é gate de execução — **não** regra de tom. Esta distinção foi formalizada
na Mode Policy (PR35) e corrigida no runtime (PR36-PR38). O brain registra essa distinção
em `MEMORY_RULES.md` e no incidente `chat-engessado-readonly.md`.

---

## 6. O que o Brain NÃO é nesta PR

- Não é runtime.
- Não executa nada.
- Não está conectado ao LLM Core, Intent Engine ou Skill Router.
- Não tem memória de curto prazo ou retrieval automático.
- Não grava memória automaticamente.
- É 100% documental — lido por agentes e operadores.

---

## 7. Verificações

```
git diff --name-only
```

**Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` foi alterado.**

Todos os arquivos criados são `.md` em `schema/brain/` e `schema/reports/`,
e atualizações em `schema/status/`, `schema/handoffs/`, `schema/execution/` e `schema/contracts/INDEX.md`.

---

## 8. Próxima PR Autorizada

**PR40 — PR-DOCS — Self Model da Enavia**

Objetivo: Criar os arquivos de self-model em `schema/brain/self-model/`:
- `identity.md`
- `capabilities.md`
- `limits.md`
- `how-to-answer.md`
- `modes.md`

---

## 9. Rollback

Esta PR é PR-DOCS. Nenhum runtime foi alterado. Para reverter:
- Deletar a pasta `schema/brain/`
- Deletar `schema/reports/PR39_OBSIDIAN_BRAIN_ARCHITECTURE_REPORT.md`
- Reverter as atualizações de governança para o estado da PR38
