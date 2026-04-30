# Obsidian Brain — Política de Recuperação (Retrieval Policy)

**Versão:** 1.0
**Data:** 2026-04-30
**Estado:** Documental. Nenhum sistema de retrieval automático existe nesta PR.
A política define o que deve ser consultado por intenção, para uso manual ou por agente.

---

## 1. Princípio

> Cada intenção detectada determina quais partes do brain devem ser consultadas.

Quando o Intent Engine existir, ele usará esta política para determinar o contexto
a injetar no LLM Core. Por enquanto, serve como guia manual de navegação do brain.

---

## 2. Intenções e Fontes de Recuperação

### 2.1 `conversation`

**Descrição:** Conversa geral, sem intenção operacional clara.

**Consultar (prioridade):**
1. `brain/memories/` — preferências do operador e padrões de resposta
2. `brain/self-model/` — identidade e forma de resposta
3. `brain/SYSTEM_AWARENESS.md` — estado geral para contextualização mínima

**Não consultar:** `brain/decisions/` (desnecessário para conversa), `brain/contracts/` (pesado)

**Observação:** Não ativar contexto operacional completo por conversa geral.
Ver `schema/policies/MODE_POLICY.md` e incidente `brain/incidents/chat-engessado-readonly.md`.

---

### 2.2 `diagnosis`

**Descrição:** Solicitação de diagnóstico técnico de um problema ou comportamento.

**Consultar (prioridade):**
1. `brain/incidents/` — incidentes similares já documentados
2. `brain/learnings/` — aprendizados relevantes
3. `schema/system/ENAVIA_SYSTEM_MAP.md` — topologia do sistema
4. `schema/system/ENAVIA_ROUTE_REGISTRY.json` — rotas e endpoints
5. `brain/decisions/` — decisões que podem ter causado o comportamento
6. `schema/reports/` — relatórios de PRs relacionadas

---

### 2.3 `planning`

**Descrição:** Planejamento de próximas ações, PRs ou arquitetura.

**Consultar (prioridade):**
1. `schema/contracts/active/` — contrato ativo e PRs autorizadas
2. `brain/open-questions/` — questões abertas que afetam o planejamento
3. `brain/decisions/` — decisões que restringem ou habilitam opções
4. `schema/status/ENAVIA_STATUS_ATUAL.md` — estado atual do sistema
5. `brain/learnings/` — o que funcionou e o que falhou antes

---

### 2.4 `contract_creation`

**Descrição:** Criação ou ajuste de contrato operacional.

**Consultar (prioridade):**
1. `brain/contracts/` — contratos existentes e encerrados
2. `brain/decisions/` — decisões de arquitetura que afetam o contrato
3. `brain/open-questions/` — questões abertas a endereçar no contrato
4. `schema/CODEX_WORKFLOW.md` — regras de loop contratual
5. `brain/learnings/` — aprendizados de contratos anteriores

---

### 2.5 `pr_review`

**Descrição:** Revisão de uma PR — validação de escopo, conformidade com contrato, cobertura de testes.

**Consultar (prioridade):**
1. `brain/contracts/` + `schema/contracts/active/` — contrato ativo e escopo autorizado
2. `schema/execution/ENAVIA_EXECUTION_LOG.md` — histórico de execuções
3. `schema/skills/CONTRACT_AUDITOR.md` — skill de auditoria de contratos
4. `schema/reports/` — relatórios de PRs recentes para contexto
5. `brain/decisions/` — decisões que a PR deve respeitar

---

### 2.6 `deploy_decision`

**Descrição:** Decisão sobre deploy de uma mudança para produção.

**Consultar (prioridade):**
1. `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` — skill de governança de deploy
2. `brain/incidents/` — incidentes anteriores de deploy
3. `schema/system/ENAVIA_WORKER_REGISTRY.md` — workers impactados
4. `brain/decisions/` — políticas de deploy registradas
5. `brain/SYSTEM_AWARENESS.md` — estado atual antes do deploy

---

### 2.7 `memory_question`

**Descrição:** Pergunta sobre o que a Enavia lembra, sabe ou registrou.

**Consultar (prioridade):**
1. `brain/INDEX.md` — visão geral do brain
2. `brain/memories/` — memórias explícitas registradas
3. `brain/decisions/` — decisões registradas
4. `brain/incidents/` — incidentes registrados
5. `brain/learnings/` — aprendizados registrados
6. `brain/MEMORY_RULES.md` — o que conta como memória válida

**Regra:** Se a informação não está em nenhuma fonte, a Enavia deve declarar que não
tem memória registrada sobre o assunto, em vez de inferir ou inventar.

---

### 2.8 `system_question`

**Descrição:** Pergunta sobre arquitetura, rotas, workers ou capacidades do sistema.

**Consultar (prioridade):**
1. `brain/maps/` + `schema/system/ENAVIA_SYSTEM_MAP.md` — topologia
2. `schema/system/ENAVIA_WORKER_REGISTRY.md` — workers disponíveis
3. `schema/system/ENAVIA_ROUTE_REGISTRY.json` — rotas mapeadas
4. `brain/SYSTEM_AWARENESS.md` — estado atual e limites do sistema
5. `brain/open-questions/` — questões abertas sobre o sistema

---

### 2.9 `skill_request`

**Descrição:** Solicitação de uso de uma skill específica.

**Consultar (prioridade):**
1. `schema/skills/INDEX.md` — lista de skills disponíveis
2. Arquivo específico da skill solicitada em `schema/skills/`
3. `brain/self-model/` — capacidades declaradas
4. `brain/SYSTEM_AWARENESS.md` — se a skill é documental ou executável

**Regra:** Skills são documentais até PR futura que as conecte ao runtime.
Não simular execução de skill que ainda não tem runtime.

---

### 2.10 `execution_request`

**Descrição:** Solicitação de execução de ação no sistema (deploy, PR, teste, etc.).

**Consultar (prioridade):**
1. `schema/policies/MODE_POLICY.md` — verificar modo atual (`read_only` bloqueia execução)
2. `brain/SYSTEM_AWARENESS.md` — estado atual do sistema
3. `schema/contracts/active/` — contrato autoriza a ação?
4. `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` ou skill relevante
5. `brain/decisions/` — há decisão que bloqueia ou habilita a ação?

**Regra:** Verificar `read_only` **antes** de qualquer execução. `read_only=true` é gate
duro — não depende de intenção ou contexto.

---

### 2.11 `conversation/frustration`

**Descrição:** Operador expressa frustração, crítica ou questionamento sobre o comportamento da Enavia.

**Consultar (prioridade):**
1. `brain/memories/` — preferências declaradas do operador
2. `brain/incidents/` — incidentes relacionados ao comportamento criticado
3. `brain/self-model/` — como a Enavia deve se comportar e responder
4. `brain/learnings/` — aprendizados sobre ajuste de comportamento

**Regra:** Responder com reconhecimento, não com defesa ou lista de justificativas.

---

## 3. Regras Gerais de Retrieval

1. Consultar apenas as fontes relevantes para a intenção detectada.
2. Não injetar contexto operacional completo em conversa geral.
3. Se a intenção é ambígua, perguntar antes de assumir.
4. Memória não encontrada = declarar ausência, não inventar.
5. Estado desatualizado (arquivo com data antiga) = marcar como histórico.
