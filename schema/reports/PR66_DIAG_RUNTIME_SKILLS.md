# PR66 — Diagnóstico Técnico para Runtime de Skills

**Tipo:** PR-DIAG (read-only — sem alteração de runtime)
**Branch:** `copilot/claudepr66-diag-runtime-skills`
**Data:** 2026-05-02
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR65 ✅ (PR-DOCS — Blueprint do Runtime de Skills)

---

## 1. Objetivo

Diagnosticar tecnicamente como implementar futuramente o Runtime de Skills da Enavia, respondendo com evidência do repositório as 12 perguntas abertas de `schema/skills-runtime/OPEN_QUESTIONS.md`.

Esta PR é **read-only**. Nenhum runtime foi alterado, nenhum endpoint foi criado, nenhum binding foi modificado.

---

## 2. Base Analisada

| Arquivo | Finalidade na análise |
|---------|----------------------|
| `schema/skills-runtime/OPEN_QUESTIONS.md` | 12 perguntas a responder |
| `schema/skills-runtime/ARCHITECTURE.md` | Arquitetura futura (11 camadas) |
| `schema/skills-runtime/EXECUTION_CONTRACT.md` | Formato JSON + 10 regras |
| `schema/skills-runtime/APPROVAL_GATES.md` | Gates de aprovação |
| `schema/skills-runtime/SECURITY_MODEL.md` | Modelo de segurança |
| `schema/skills-runtime/ROLLOUT_PLAN.md` | Fases 0–6 |
| `schema/skills-runtime/SKILL_CAPABILITY_MATRIX.md` | 4 skills documentais |
| `nv-enavia.js` | Worker principal (9.143 linhas) |
| `wrangler.toml` | Bindings existentes |
| `contract-executor.js` | Executor de contratos (5.223 linhas) |
| `schema/enavia-skill-router.js` | Skill Router read-only (501 linhas) |
| `schema/enavia-intent-classifier.js` | Classificador de intenção (559 linhas) |
| `schema/enavia-self-audit.js` | Self-Audit read-only (647 linhas) |
| `schema/enavia-response-policy.js` | Response Policy (484 linhas) |
| `schema/enavia-intent-retrieval.js` | Intent Retrieval (349 linhas) |
| `schema/system/ENAVIA_ROUTE_REGISTRY.json` | Registry de rotas (75 KB) |
| `schema/system/ENAVIA_WORKER_REGISTRY.md` | Registry de workers |
| `schema/reports/PR65_BLUEPRINT_RUNTIME_SKILLS.md` | Blueprint documental |
| `schema/brain/open-questions/unresolved-technical-gaps.md` | G1–G7 lacunas |
| `schema/brain/learnings/future-risks.md` | R1–R13 riscos |
| `schema/brain/SYSTEM_AWARENESS.md` | Consciência situacional do sistema |

---

## 3. Respostas às 12 Perguntas Abertas

### Q1 — Onde o runtime deve viver?

**Resposta curta:** Opção C — módulo interno sem endpoint inicialmente, dentro do `nv-enavia.js`, seguindo o mesmo padrão dos módulos existentes (`enavia-skill-router.js`, `enavia-self-audit.js`, etc.).

**Evidência no repo:**
- `nv-enavia.js` linhas 46–51: todos os módulos cognitivos são importados como pure functions (`classifyEnaviaIntent`, `routeEnaviaSkill`, `buildIntentRetrievalContext`, `runEnaviaSelfAudit`, `buildEnaviaResponsePolicy`) — padrão established.
- `wrangler.toml` linha 1: um único Worker principal `nv-enavia` gerencia todo o fluxo.
- `schema/system/ENAVIA_WORKER_REGISTRY.md` seção 3: 6 Workers confirmados — adicionar novo Worker de skills seria infraestrutura desnecessária na fase inicial.
- `schema/skills-runtime/ARCHITECTURE.md` seção 4: Skill Executor declarado como `schema/enavia-skill-executor.js` — mesmo padrão de nomenclatura dos módulos existentes.

**Trade-offs avaliados:**

| Opção | Vantagens | Riscos |
|-------|-----------|--------|
| **A — dentro de nv-enavia.js** | Zero nova infraestrutura; integração trivial | Aumenta complexidade de arquivo já com 9.143 linhas |
| **B — worker separado** | Isolamento total; deploy independente | Novo binding obrigatório; nova infraestrutura; overhead de PR-DIAG + PR-IMPL adicional |
| **C — módulo interno (recomendado)** | Padrão estabelecido; zero nova infra; testável isolado; evolui para endpoint depois | Nenhum na fase initial |

**Risco:** low

**Decisão recomendada:** Opção C — criar `schema/enavia-skill-executor.js` como pure function, sem endpoint, seguindo padrão de todos os módulos existentes. Integrar em `nv-enavia.js` defensivamente como campo aditivo. Endpoint só após módulo estar validado.

---

### Q2 — Primeiro endpoint: `/skills/propose` em vez de `/skills/run`?

**Resposta curta:** Sim. `/skills/propose` deve ser o primeiro endpoint. `/skills/run` não deve ser criado antes do gate de aprovação estar implementado e validado.

**Evidência no repo:**
- `schema/skills-runtime/ROLLOUT_PLAN.md` seção 9 (linhas 201–208): "`/skills/run` direto não deve ser o primeiro endpoint. O primeiro endpoint deve ser `/skills/propose` — que gera uma proposta sem executar."
- `schema/system/ENAVIA_ROUTE_REGISTRY.json`: grep por "skills" retorna **zero** resultados — não existe nenhuma rota `/skills/*` atualmente.
- `nv-enavia.js` linha 4684: comentário explícito `// /skills/run não existe. mode sempre "read_only"`.
- `schema/skills-runtime/SECURITY_MODEL.md` seção 4: `approval.status !== 'approved'` para `approved_execution` → BLOCKED. Criar `/skills/run` antes do gate viola este princípio.
- `schema/brain/learnings/future-risks.md` R2: "Falsa capacidade — sistema afirma que `/skills/run` existe" — evidência do risco.

**Risco:** low (confirma blueprint, sem nova decisão)

**Decisão recomendada:** Confirmar que o primeiro passo deve ser módulo interno `proposal-only`, depois endpoint `/skills/propose`. `/skills/run` só na Fase 5 (PR70+) após gate de aprovação implementado e validado.

---

### Q3 — Como aprovar execução?

**Resposta curta:** O mecanismo vigente é o fluxo manual via PR (agente propõe → operador aprova ao mergear). Para o runtime, o mecanismo mais simples e seguro para a fase inicial é manter esse padrão: proposta gerada no chat, aprovação via merge da PR gerada.

**Evidência no repo:**
- `schema/brain/UPDATE_POLICY.md` seção 8 (citado em `schema/brain/open-questions/unresolved-technical-gaps.md` G3): "fluxo manual via PR é o mecanismo vigente e funcional".
- `schema/skills-runtime/APPROVAL_GATES.md` seção 2: mecanismo futuro declarado como "A DEFINIR" — não existe ainda.
- `schema/skills-runtime/APPROVAL_GATES.md` linha 56: "O mecanismo de notificação e aprovação **não existe ainda**. Será definido em PR66 (diagnóstico)."
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`: "governança humana via Contrato + INDEX.md + handoff" é o gate de aprovação atual.

**Diagrama de fluxo proposto para fase inicial:**
```
skill_proposal gerada (modo proposal)
        │
        ▼
Agente retorna proposta ao operador via /chat/run
        │
        ▼
Operador decide manualmente (via PR, mensagem, ou outro canal)
        │
        ▼
PR67+ implementará mecanismo de flag em KV ou token simples
        │
        ▼
/skills/approve (Fase 3, PR68+)
```

**Risco:** medium — mecanismo de aprovação automática via endpoint precisa de PR-DIAG dedicada (PR68+)

**Decisão recomendada:** Fase inicial (PR67) — proposta sem gate técnico, aprovação manual via operador. Gate técnico (flag KV ou token) em PR69+.

---

### Q4 — Onde registrar execuções?

**Resposta curta:** Para a Fase 2 (proposal-only), não é necessário storage persistente. Log pode ser apenas em memória como campo aditivo no response. Para fases futuras, o KV `ENAVIA_BRAIN` existente é o candidato natural.

**Evidência no repo:**
- `wrangler.toml` linha 22–24: `ENAVIA_BRAIN` KV namespace já existe (`id: "722835b730dd44c79f6ff1f0cdc314a9"`). Disponível tanto em PROD quanto em TEST.
- `wrangler.toml`: não há D1, não há R2 configurados — adicionar exigiria nova infraestrutura.
- `contract-executor.js` linhas 113–126: padrão de KV keys estabelecido — `contract:<id>:state`, `contract:<id>:exec_event`, `contract:<id>:flog:<timestamp>`. O mesmo padrão pode ser usado para skills: `skill:<id>:proposal`, `skill:<id>:log`.
- `schema/skills-runtime/EXECUTION_CONTRACT.md` seção 4: ciclo de vida define [LOGGED] como último passo — mas apenas após [COMPLETED].

**Risco:** low para fase proposal-only (sem persistência); medium para fases com execução real

**Decisão recomendada:**
- **Fase 2 (PR67 — proposal-only):** sem persistência. Log apenas como campo aditivo `skill_execution` no response do `/chat/run`, seguindo padrão de `self_audit`, `skill_routing`, `intent_retrieval`.
- **Fase 3+ (PR68+):** usar `ENAVIA_BRAIN` KV com prefixo `skill:` — sem criar novo namespace.
- **Não criar D1, R2 ou novo KV namespace antes da necessidade estar comprovada.**

---

### Q5 — Quais bindings são necessários?

**Resposta curta:** Para Fase 2 (proposal-only), **zero bindings novos são necessários**. O `ENAVIA_BRAIN` KV existente é suficiente para fases futuras.

**Evidência no repo — bindings existentes (wrangler.toml):**

| Binding | Tipo | ID | Uso atual |
|---------|------|----|-----------|
| `ENAVIA_BRAIN` | KV namespace | `722835b730dd44c79f6ff1f0cdc314a9` | Memória principal do sistema |
| `EXECUTOR` | Service binding | `enavia-executor` | Executor de contratos |
| `DEPLOY_WORKER` | Service binding | `deploy-worker` | Deploy supervisionado |
| `OPENAI_API_KEY` | Secret (inferido) | — | API do LLM |
| `SUPABASE_URL` / `SUPABASE_BUCKET` | Var | — | Storage documental |

**Análise por fase:**

| Fase | Binding necessário | Novo? |
|------|--------------------|-------|
| Fase 2 — proposal-only | Nenhum (campo aditivo no response) | ❌ |
| Fase 3 — log persistente | `ENAVIA_BRAIN` (já existe) | ❌ |
| Fase 4 — aprovação via flag | `ENAVIA_BRAIN` (key `skill:<id>:approval`) | ❌ |
| Fase 5 — execução com evidência | `ENAVIA_BRAIN` (log) + possível R2 para artefatos | ⚠️ Avaliar |
| Fase 6 — side effects | `EXECUTOR` ou `DEPLOY_WORKER` (já existem) | ❌ |

**Risco:** low — primeira implementação não precisa de binding novo

**Decisão recomendada:** Iniciar sem nenhum binding novo. Usar `ENAVIA_BRAIN` KV quando persistência for necessária (Fase 3+). Avaliar R2 apenas para fases com artefatos de evidência grandes.

---

### Q6 — Como relacionar execução com Self-Audit?

**Resposta curta:** `runEnaviaSelfAudit()` já aceita `skillRouting` como campo de input — a integração é trivial. O Skill Executor deve chamar `runEnaviaSelfAudit()` antes de retornar qualquer resultado, passando o contexto completo da execução.

**Evidência no repo:**
- `schema/enavia-self-audit.js` linhas 551–565: assinatura atual de `runEnaviaSelfAudit(input)`:
  ```js
  input.message              — Mensagem do usuário
  input.context              — Contexto da conversa
  input.intentClassification — Resultado do classificador
  input.skillRouting         — Resultado do skill router (já existe)
  input.intentRetrieval      — Resultado do intent retrieval
  input.isOperationalContext — Flag operacional
  input.responseDraft        — Rascunho da resposta
  input.metadata             — Metadados adicionais (pr_type, files_changed, etc.)
  ```
- `nv-enavia.js` linha 49: `import { runEnaviaSelfAudit } from "./schema/enavia-self-audit.js"` — já importado e integrado.
- `schema/enavia-self-audit.js` linha 620: `should_block = risk_level === BLOCKING` — `secret_exposure` já é blocking por design.

**Contrato de integração proposto:**

```js
// No Skill Executor (futuro), antes de retornar resultado:
const auditInput = {
  message: input.message,
  context: input.context,
  intentClassification: input.intentClassification,
  skillRouting: { skill_id: skillId, mode: "proposal", matched: true },
  responseDraft: proposalOutput,
  metadata: {
    pr_type: "PR-IMPL",
    skill_execution_mode: "proposal",
    skill_id: skillId,
  }
};
const { self_audit } = runEnaviaSelfAudit(auditInput);
if (self_audit.should_block) {
  return { blocked: true, reason: self_audit.next_safe_action };
}
```

**O que precisará evoluir no Self-Audit:**
- Adicionar `skill_execution_mode` como campo de `metadata` reconhecido
- Adicionar detector de `false_capability` específico para skill proposal (já coberto parcialmente)
- Nenhuma mudança breaking — apenas extensão do `metadata`

**Risco:** low — integração é extensão de interface existente

**Decisão recomendada:** PR67 deve chamar `runEnaviaSelfAudit()` com contexto de execução antes de retornar proposta. Não alterar a assinatura atual — apenas usar `metadata` para passar contexto adicional.

---

### Q7 — Como evitar falsa capacidade?

**Resposta curta:** Self-Audit detecta `false_capability` via lista de termos (`schema/enavia-self-audit.js` linhas 82–93). O ponto de enforcement mecânico deve ser: **o Skill Executor retorna erro explícito se `execution.status !== 'proposal'` e `approval.status !== 'approved'`**.

**Evidência no repo:**
- `schema/enavia-self-audit.js` linhas 82–93: `_FALSE_CAPABILITY_TERMS` inclui `"/skills/run"`, `"skill executor"`, `"executor de skill"` — detecta se o sistema afirma que esses módulos existem.
- `schema/enavia-self-audit.js` linha 620: `should_block` só é `true` para `BLOCKING` — `false_capability` é `HIGH`, não blocking por padrão.
- `schema/skills-runtime/SECURITY_MODEL.md` seção 4: regra `false_capability → BLOCKED` — mas essa regra ainda não existe no runtime (é documental).
- `nv-enavia.js` linha 4684: `// /skills/run não existe. mode sempre "read_only"` — comentário de guarda.

**Proposta de enforcement mecânico no futuro Skill Executor:**

```js
// Regra R7 do EXECUTION_CONTRACT.md:
// Skills inexistentes retornam `blocked` com mensagem clara — sem simular execução
if (!SKILL_ALLOWLIST.includes(input.skill_id)) {
  return { execution: { status: "blocked", output: null },
           safety: { blocked_reason: "skill_id não está no allowlist" } };
}

// Regra R3:
if (input.mode === "approved_execution" && input.approval?.status !== "approved") {
  return { execution: { status: "blocked" },
           safety: { blocked_reason: "approved_execution requer approval.status=approved" } };
}
```

**Risco:** medium — enforcement mecânico só existe após PR67+. Até lá, Self-Audit detecta mas não bloqueia (exceto `secret_exposure`).

**Decisão recomendada:** PR67 deve implementar validação de `skill_id` contra allowlist como primeira linha de defesa. `false_capability` deve elevar para `BLOCKING` no contexto de Skill Executor.

---

### Q8 — Como proteger secrets no pipeline de execução?

**Resposta curta:** Três camadas já existem. A quarta (filtro de output) precisará ser adicionada no Skill Executor.

**Evidência no repo — camadas existentes:**

1. **Self-Audit** (`schema/enavia-self-audit.js` linhas 162–173): `_SECRET_PATTERNS` com 10 regex detectando padrões de API keys, tokens, GitHub tokens, Slack tokens — **blocking**.
2. **Response Policy** (`schema/enavia-response-policy.js` linhas 68–80): `_SA.SECRET_EXPOSURE` como categoria reconhecida — orienta resposta segura.
3. **wrangler.toml**: secrets nunca são definidos como `[vars]` — padrão correto já seguido.

**Pontos de risco identificados no pipeline futuro:**

| Ponto | Risco | Mitigação proposta |
|-------|-------|-------------------|
| Input do Skill Executor | Secret no contexto de execução | Self-Audit no input antes de processar |
| Output da proposta | Secret na proposta gerada | Self-Audit no `responseDraft` antes de retornar |
| Log de evidência | Secret no log | Filtrar `_SECRET_PATTERNS` antes de persistir no KV |
| DEPLOY_GOVERNANCE_OPERATOR | Acesso a wrangler context | Allowlist de campos permitidos no input |

**Risco:** high para `DEPLOY_GOVERNANCE_OPERATOR` em execução real; low para `proposal-only`

**Decisão recomendada:** PR67 (proposal-only) pode depender do Self-Audit existente. PR67+ deve adicionar filtro de secrets no output antes de persistir no KV. `DEPLOY_GOVERNANCE_OPERATOR` nunca deve receber contexto com valores de secrets — apenas nomes.

---

### Q9 — Como testar sem executar ação real?

**Resposta curta:** O padrão existente é pure unit tests com módulos importados diretamente. O Skill Executor deve ser 100% pure function (sem KV, sem rede) no modo `proposal` — testável com o mesmo padrão.

**Evidência no repo:**

- `tests/pr56-self-audit-readonly.smoke.test.js` linhas 1–27: padrão estabelecido — `import { runEnaviaSelfAudit }` + assert sobre output. Sem `fetch`, sem `env`, sem KV.
- `tests/pr51-skill-router-readonly.smoke.test.js`: `import { routeEnaviaSkill }` + assert — mesmo padrão.
- `schema/enavia-self-audit.js` linha 13: "Sem LLM externo. Sem KV. Sem rede. Sem filesystem. Sem side-effects." — princípio a replicar.
- Total de testes: ~41.231 linhas de testes, 60+ arquivos — todos pure unit tests.

**Estratégia de teste para PR-PROVA (PR68):**

```js
// Mock de skill executor — pure function, sem execução real
import { buildSkillExecutionProposal } from "../schema/enavia-skill-executor.js";

// Cenário A: proposta válida gerada
const result = buildSkillExecutionProposal({
  skill_id: "CONTRACT_AUDITOR",
  mode: "proposal",
  message: "revise a PR #123",
  intentClassification: { intent: "pr_review", confidence: "high" }
});
assert.equal(result.execution.status, "not_started");
assert.equal(result.approval.status, "not_requested");
assert.ok(result.execution.output.type === "proposal");

// Cenário B: skill_id inválida → bloqueada
const blocked = buildSkillExecutionProposal({ skill_id: "UNKNOWN_SKILL", mode: "proposal" });
assert.equal(blocked.execution.status, "blocked");
```

**Risco:** low — padrão de teste estabelecido é diretamente aplicável

**Decisão recomendada:** PR68 (PR-PROVA) deve usar `import` direto do módulo + assert sobre output, sem mocks complexos. Skills no modo `proposal` são pure functions por design.

---

### Q10 — O `contract-executor.js` deve ser reutilizado?

**Resposta curta:** Sim, parcialmente. Padrões de status machine, KV keys e Security Supervisor são reutilizáveis como referência. Mas o Skill Executor deve ser módulo separado — não uma extensão do `contract-executor.js`.

**Evidência no repo:**

`contract-executor.js` (5.223 linhas):

| Componente | Lógica relevante | Reutilizar? |
|-----------|-----------------|-------------|
| `transitionStatusGlobal()` (linhas 200–231) | State machine com VALID_STATUSES + VALID_TRANSITIONS | ✅ Padrão a copiar para skill status |
| KV prefixes (linhas 113–128) | `contract:` prefix, `exec_event`, `flog` | ✅ Usar padrão similar: `skill:` prefix |
| `_runSupervisorGate()` (linhas 55–61) | Security Supervisor enforcement | ✅ Adapter para Skill Executor |
| `_CANONICAL_NULL_GATES_CONTEXT` (linhas 100–108) | 6 gates canônicos | ✅ Modelo para skill gates |
| Lógica de contrato (fases, decomposição, tasks) | Específico de contratos Fase A | ❌ Não reutilizar — escopo diferente |
| KV direct writes (`env.ENAVIA_BRAIN.put`) | I/O direto | ❌ Skill Executor deve ser pure function primeiro |
| `handleGitHubPrAction`, etc. | Handlers HTTP | ❌ Skill Executor é módulo, não handler |

**Risco:** low

**Decisão recomendada:** Criar `schema/enavia-skill-executor.js` como módulo independente. Usar `contract-executor.js` como **referência de padrões** (status machine, KV prefixes, security gates), não como base de herança.

---

### Q11 — Risco de confusão entre Skill Executor e Contract Executor?

**Resposta curta:** Sim, há risco real de confusão se responsabilidades não forem explicitamente separadas. A diferença deve ser declarada em todo relatório.

**Evidência no repo:**
- `schema/brain/learnings/future-risks.md` R3: "Confusão runtime vs documental — módulo documental apresentado como operacional" — risco já documentado.
- `contract-executor.js` linha 1–15: scope explícito — "Ingestão e validação de contrato canônico", "Persistência de estado mínimo em KV", "Decomposição inicial", "Leitura de estado e resumo".
- `schema/enavia-skill-router.js` linhas 1–25: scope explícito — roteamento read-only, pure function, sem side effects.

**Separação proposta de responsabilidades:**

| Módulo | Domínio | Responsabilidade | Não faz |
|--------|---------|-----------------|---------|
| `contract-executor.js` | Contratos operacionais | Gerenciar ciclo de vida de contratos Fase A, decomposição, tasks, KV persistence | Não executa skills |
| `enavia-skill-executor.js` (futuro) | Skills | Construir proposta de execução de skill, validar allowlist, integrar Self-Audit | Não gerencia contratos, não escreve KV diretamente (na fase initial) |

**Risco:** medium — sem separação explícita, agentes futuros podem confundir os dois

**Decisão recomendada:** `schema/enavia-skill-executor.js` deve ter header explícito com declaração de scope (igual ao padrão dos outros módulos), declarando que NÃO é o Contract Executor e NÃO gerencia contratos operacionais.

---

### Q12 — Há conflitos de rota com o Route Registry?

**Resposta curta:** Não há conflitos. Nenhuma rota `/skills/*` existe no registry atual ou no `nv-enavia.js`.

**Evidência no repo:**

```bash
# grep "skills" schema/system/ENAVIA_ROUTE_REGISTRY.json → ZERO resultados
# grep "/skills" nv-enavia.js → APENAS comentário (linha 4684)
```

**Rotas verificadas no registry (amostra):**

```
/__internal__/build, /__internal__/describe, /__internal__/routes
/director/cognitive, /chat/run, /planner/run, /planner/bridge
/execution, /execution/decision, /health
/contracts/*, /github-pr/*, /browser-arm/*
/memory/manual, /memory/learning, /memory/audit
```

**Confirmação:**
- `/skills/propose` → ❌ não existe → **sem conflito**
- `/skills/run` → ❌ não existe → **sem conflito**
- `/skills/approve` → ❌ não existe → **sem conflito**
- `/skills/status` → ❌ não existe → **sem conflito**

**Risco de conflito futuro:** Verificar que nenhuma rota com `/skills` foi adicionada antes de criar endpoints. Registry deve ser atualizado quando endpoint for criado (PR futura).

**Risco:** low

**Decisão recomendada:** Nenhum conflito de rota. Quando `/skills/propose` for criado (Fase 2, PR67+), o `ENAVIA_ROUTE_REGISTRY.json` deve ser atualizado na mesma PR.

---

## 4. Onde o Runtime Deve Viver

### Decisão final: Opção C — Módulo interno

**Módulo futuro:** `schema/enavia-skill-executor.js`

**Justificativa técnica:**

1. **Padrão estabelecido:** Todos os módulos cognitivos existentes são pure functions em `schema/enavia-*.js`. O Skill Executor deve seguir o mesmo padrão antes de qualquer endpoint.

2. **Zero nova infraestrutura:** Módulo interno não exige novos workers, bindings, ou configurações de deploy.

3. **Testável isoladamente:** Pure function é testável com `import` direto, seguindo o padrão de 60+ testes existentes.

4. **Evolução segura:** Módulo interno pode evoluir para endpoint depois, seguindo a sequência: módulo → integração em `/chat/run` → endpoint dedicado `/skills/propose`.

5. **Evidência do padrão:**
   - `enavia-skill-router.js` (PR51): módulo → integrado em `nv-enavia.js` → provado em PR52
   - `enavia-self-audit.js` (PR56): módulo → integrado → provado em PR57/PR58
   - `enavia-response-policy.js` (PR59): módulo → integrado → provado em PR60

**Worker separado (Opção B) quando?** Avaliar apenas se o módulo interno atingir >2.000 linhas OU se precisar de bindings isolados não disponíveis no Worker principal. Não antes.

---

## 5. Primeiro Endpoint Futuro

### Decisão: `/skills/propose` — e não antes da Fase 2

**Sequência correta:**

```
PR67 — módulo interno proposal-only (sem endpoint)
    ↓
PR68 — PR-PROVA — validação do módulo
    ↓
PR69 — endpoint /skills/propose (Fase 2 completa)
    ↓
PR70 — PR-PROVA — validação do endpoint
    ↓
PR71+ — mecanismo de aprovação
    ↓
PR72+ — /skills/approve (Fase 3)
```

**Por que NÃO `/skills/run` primeiro:**
- Sem gate de aprovação → autonomia cega
- `schema/skills-runtime/ROLLOUT_PLAN.md` seção 9 é explícito
- `schema/skills-runtime/SECURITY_MODEL.md` seção 4: `approval.status !== 'approved'` → BLOCKED para `approved_execution`

**Por que `/skills/propose` primeiro:**
- Modo `proposal` não executa → risco mínimo
- Permite testar o pipeline completo sem side effects
- Aprovação humana continua sendo manual nesta fase

---

## 6. Bindings e Storage

### Estado atual (wrangler.toml)

| Binding | Tipo | Disponível | Para runtime de skills? |
|---------|------|-----------|------------------------|
| `ENAVIA_BRAIN` (KV) | KV namespace | ✅ PROD + TEST | ✅ Pronto para Fase 3+ |
| `EXECUTOR` | Service binding | ✅ | ❌ Não usar para skills na fase inicial |
| `DEPLOY_WORKER` | Service binding | ✅ | ❌ Apenas para DEPLOY_GOVERNANCE_OPERATOR em fases avançadas |
| D1 | — | ❌ Não configurado | ❌ Não criar |
| R2 | — | ❌ Não configurado | ❌ Não criar na fase inicial |

### Necessidade por fase

| Fase | Binding necessário | Ação requerida |
|------|--------------------|---------------|
| Fase 2 (PR67) — módulo internal | Nenhum | Nenhuma |
| Fase 2b (PR69) — endpoint `/skills/propose` | Nenhum (response é campo aditivo) | Nenhuma |
| Fase 3 (PR71+) — log persistente | `ENAVIA_BRAIN` KV (já existe) | Usar prefixo `skill:` |
| Fase 4 (PR72+) — approval flag | `ENAVIA_BRAIN` KV (já existe) | Key `skill:<id>:approval` |
| Fase 5+ — execução com evidência | `ENAVIA_BRAIN` KV + possível R2 | Avaliar na época |

**Decisão: fase inicial não requer nenhum binding novo.**

---

## 7. Rotas e Conflitos

### Rotas existentes relevantes

| Rota | Worker | Uso |
|------|--------|-----|
| `/chat/run` | nv-enavia | Chat principal — onde skill_routing já é campo aditivo |
| `/execution` | nv-enavia | Execution decisions — não relacionado a skills |
| `/contracts/*` | nv-enavia | Contratos operacionais — domínio diferente |

### Rotas futuras de skills

| Rota | Fase | Conflito atual? | Observação |
|------|------|----------------|------------|
| `/skills/propose` | Fase 2b (PR69+) | ❌ Nenhum | Adicionar ao ENAVIA_ROUTE_REGISTRY.json quando criar |
| `/skills/approve` | Fase 3 (PR71+) | ❌ Nenhum | — |
| `/skills/run` | Fase 5 (PR72+) | ❌ Nenhum | **Não criar antes do gate** |
| `/skills/status` | Futuro | ❌ Nenhum | — |

### Rotas proibidas nesta fase (PR67)

- `/skills/run` — **proibido** — violaria princípio de governed execution
- `/skills/propose` como endpoint — **proibido** nesta PR (PR-DIAG)
- Qualquer nova rota — **proibido** — escopo é módulo interno apenas

---

## 8. Reuso de Módulos Existentes

### Matriz de reuso

| Módulo | Pode reusar? | Como | O que NÃO acoplar |
|--------|-------------|------|------------------|
| `enavia-intent-classifier.js` | ✅ Sim | Input `intentClassification` → preenche `requested_action` do contrato | Não acoplar lógica de routing |
| `enavia-skill-router.js` | ✅ Sim | `skill_id` do roteamento → input do Skill Executor | Não criar dependência circular |
| `enavia-intent-retrieval.js` | ✅ Sim | `context_block` → `inputs.context` do contrato de execução | — |
| `enavia-self-audit.js` | ✅ Sim | Chamar antes de retornar qualquer proposta | Não passar secrets no input |
| `enavia-response-policy.js` | ✅ Sim | Usar para format final da resposta | — |
| `contract-executor.js` | ⚠️ Referência | Usar como referência de padrões (status machine, KV prefixes) | Não herdar — criar módulo separado |
| `enavia-brain-loader.js` | ✅ Sim | Contexto do brain já está no prompt via `buildChatSystemPrompt` | — |
| `enavia-llm-core.js` | ✅ Sim (indiretamente) | Já integrado no prompt — não chamar diretamente do executor | — |

### O que precisará de adapter futuro

- `enavia-self-audit.js`: adicionar reconhecimento de `metadata.skill_execution_mode` (extensão menor)
- `enavia-skill-router.js`: em fases avançadas, retornar status de execução além de roteamento documental

### `contract-executor.js` — Decisão final

**Não reutilizar diretamente** como base do Skill Executor. Razões:
1. `contract-executor.js` é monolítico (5.223 linhas), acoplado ao KV e ao Service Binding EXECUTOR.
2. Skill Executor deve começar como pure function (sem I/O).
3. Padrões podem ser copiados (status machine, KV prefixes), mas sem herança.

---

## 9. Contrato Técnico Futuro

### `buildSkillExecutionProposal(input)` — PR67

```js
// Assinatura proposta
buildSkillExecutionProposal({
  skill_id: "CONTRACT_AUDITOR",         // de routeEnaviaSkill()
  mode: "proposal",                     // sempre "proposal" na PR67
  message: string,                      // mensagem original do usuário
  intentClassification: object,         // de classifyEnaviaIntent()
  intentRetrieval: object,              // de buildIntentRetrievalContext()
  context: object,                      // contexto da conversa
})
// Retorna:
{
  skill_execution: {
    request_id: "uuid",
    skill_id: "CONTRACT_AUDITOR",
    mode: "proposal",
    requested_action: "revisão de PR baseada na intenção pr_review",
    inputs: { context: "...", parameters: {} },
    approval: { required: true, status: "not_requested", approved_by: null },
    execution: { status: "not_started", evidence: [{ source, action, timestamp }] },
    safety: { risk_level: "low", requires_human: true, blocked_reason: null },
    audit: { self_audit_result: {...}, audit_passed: true }
  }
}
```

### `validateSkillExecutionApproval(input)` — PR71+ (Fase 3)

```js
// Assinatura proposta (futura — não implementar em PR67)
validateSkillExecutionApproval({
  request_id: string,
  approval_token: string,   // token gerado quando proposta foi criada
  approved_by: "human",
})
// Retorna:
{
  valid: boolean,
  approval: { status: "approved" | "rejected", approved_by: "human", approved_at: ISO8601 }
}
```

### `executeApprovedSkill(input)` — PR72+ (Fase 5)

> **NÃO implementar em PR67.** Este contrato é apenas design documental para PR futura.

A PR67 deve implementar apenas `buildSkillExecutionProposal()` no modo `proposal`.

**Princípio:** Proposal first, approval after, execution last.

---

## 10. Sequência de Implementação Recomendada

Com base no diagnóstico, a sequência recomendada é:

| PR | Tipo | Descrição | Módulos/Endpoints |
|----|------|-----------|------------------|
| **PR67** | PR-IMPL | `schema/enavia-skill-executor.js` — `buildSkillExecutionProposal()` em modo `proposal` | Módulo interno — sem endpoint |
| **PR68** | PR-PROVA | Prova do Skill Executor proposal-only | Testes do módulo (padrão smoke) |
| **PR69** | PR-IMPL | Endpoint `/skills/propose` em `nv-enavia.js` | Endpoint + campo aditivo no response |
| **PR70** | PR-PROVA | Prova do endpoint `/skills/propose` | Testes HTTP do endpoint |
| **PR71** | PR-IMPL | Mecanismo de aprovação simples (flag KV) | `ENAVIA_BRAIN` KV — sem novo binding |
| **PR72** | PR-PROVA | Prova do ciclo proposta→aprovação | Testes de ciclo completo |
| **PR73+** | PR-IMPL | Execução limitada read-only (CONTRACT_AUDITOR, CONTRACT_LOOP_OPERATOR) | Fases 5–6 do ROLLOUT_PLAN |

**Condição de avanço entre fases:** Cada fase requer PR-PROVA aprovada antes de avançar. Sem prova → sem avanço.

**Nota sobre Finding I1:** A correção do Intent Classifier (G6 — variantes com advérbio) pode ser feita em paralelo como PR-IMPL cirúrgica dedicada, sem afetar a sequência do Runtime de Skills.

---

## 11. Riscos Técnicos

| Risco | Descrição | Probabilidade | Impacto | Mitigação |
|-------|-----------|--------------|---------|-----------|
| R1 — Docs over product | Mais PRs-DIAG antes de PR-IMPL real | Médio | Alto | PR67 deve ser PR-IMPL real |
| R2 — Falsa capacidade | Sistema afirmar que executa skill antes de existir runtime | Baixo (Self-Audit detecta) | Alto | Manter `_FALSE_CAPABILITY_TERMS` atualizado |
| R3 — Confusão Contract vs Skill Executor | Agente futuro misturar responsabilidades | Médio | Médio | Header explícito no módulo futuro |
| R10 — Skill Executor com side effects antes do gate | Criar `/skills/run` antes de aprovação | Baixo (contrato proíbe) | Crítico | Sequência de fases obriga `/skills/propose` primeiro |
| R11 — Secret exposure via DEPLOY_GOVERNANCE_OPERATOR | Contexto com credenciais em proposta | Baixo (proposta-only) | Alto | Self-Audit `secret_exposure` é blocking |
| R12 — Finding I1 afetar roteamento de skills | Classificação incorreta de intenção | Baixo impacto | Baixo | Sistema se comporta com segurança com `unknown` |
| R13 — Acoplamento KV prematuro | Skill Executor com KV antes de pure function estar validado | Médio | Médio | Regra: PR67 é pure function — sem KV |

---

## 12. Decisão Final

### Resumo de decisões

| Questão | Decisão |
|---------|---------|
| Onde vive o runtime? | Módulo interno `schema/enavia-skill-executor.js` — Opção C |
| Primeiro artefato? | `buildSkillExecutionProposal()` como pure function — PR67 |
| Primeiro endpoint? | `/skills/propose` — PR69 (após módulo validado) |
| `/skills/run`? | ❌ Não criar antes da Fase 5 (PR73+) |
| Bindings novos? | Nenhum na Fase 2 — `ENAVIA_BRAIN` KV existente para Fase 3+ |
| Rotas conflitantes? | Nenhuma — registry sem entradas `/skills/*` |
| `contract-executor.js` reutilizar? | Como referência de padrões — não como herança |
| Teste strategy? | Pure unit tests (mesmo padrão de 60+ testes existentes) |
| Aprovação humana? | Fase inicial: manual via operador. Gate técnico em PR71+ |
| Self-Audit? | Já integrado — chamar `runEnaviaSelfAudit()` com contexto de execução |
| Finding I1? | Separado — PR-IMPL cirúrgica dedicada |
| G3 (escrita de memória)? | Continua on-hold — não blocking |

**Diagnóstico:** ✅ Nenhum bloqueio técnico para iniciar PR67.

---

## 13. O que NÃO foi alterado nesta PR

Esta é uma PR-DIAG read-only. A lista abaixo confirma que o escopo foi respeitado:

| Item | Status |
|------|--------|
| `nv-enavia.js` | ❌ Não alterado |
| `contract-executor.js` | ❌ Não alterado |
| `wrangler.toml` | ❌ Não alterado |
| `schema/enavia-*.js` | ❌ Nenhum alterado |
| `schema/skills-runtime/*.md` | ❌ Nenhum alterado |
| Testes | ❌ Nenhum alterado |
| Panel | ❌ Não alterado |
| Executor | ❌ Não alterado |
| Deploy Worker | ❌ Não alterado |
| Workflows | ❌ Não alterados |
| KV / bindings / secrets | ❌ Não alterados |
| `/skills/run` | ❌ Não criado |
| `/skills/propose` | ❌ Não criado |
| Skill Executor | ❌ Não implementado |
| Nenhuma skill executa | ✅ Confirmado |
| Nenhuma execução real | ✅ Confirmado |

---

## 14. Próxima PR Recomendada

**PR67 — PR-IMPL — Skill Execution Proposal (read-only)**

**Tipo:** PR-IMPL
**Escopo:** Worker-only
**O que implementa:**
- `schema/enavia-skill-executor.js` — pure function
- `buildSkillExecutionProposal(input)` — modo `proposal` apenas
- Integração defensiva em `nv-enavia.js` como campo aditivo `skill_execution` (sem alterar lógica existente)
- Smoke tests: `tests/pr67-skill-executor-proposal.smoke.test.js`

**O que NÃO implementa:**
- `/skills/propose` (endpoint)
- `/skills/run`
- Execução de skill
- Escrita em KV
- Gate de aprovação técnico

**Pré-requisito:** PR66 ✅ (esta PR)

**Critério de conclusão:**
- `buildSkillExecutionProposal()` funciona para as 4 skills
- `should_block` é `true` para `secret_exposure`
- Campo `skill_execution` aparece no response do `/chat/run`
- Smoke tests passando
- PR-PROVA (PR68) pode ser criada

---

*Diagnóstico gerado na PR66 — 2026-05-02. Nenhum runtime foi alterado. Nenhum endpoint foi criado.*
