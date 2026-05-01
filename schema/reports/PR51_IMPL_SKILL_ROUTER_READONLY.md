# PR51 — Skill Router read-only

**Tipo:** PR-IMPL (Worker-only, cirúrgica)
**Branch:** `copilot/claudepr51-impl-skill-router-readonly`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR50 ✅ (PR-PROVA — 821/821)

---

## 1. Objetivo

Implementar o Skill Router read-only da Enavia (v1), ligando o Classificador de Intenção
às skills documentais existentes. O router recebe uma mensagem/intenção e retorna qual
skill documental deve ser usada como referência, sem executar nada, sem criar endpoint,
sem criar `/skills/run` e sem acionar ferramenta runtime.

---

## 2. Diagnóstico usado

- PR49 ✅ — Classificador de Intenção v1 criado e validado.
- PR50 ✅ — Prova do Classificador de Intenção v1 (824/821 total).
- Skills documentais em `schema/skills/` (4 skills: CONTRACT_LOOP_OPERATOR,
  DEPLOY_GOVERNANCE_OPERATOR, SYSTEM_MAPPER, CONTRACT_AUDITOR).
- `classifyEnaviaIntent()` exporta 15 intenções canônicas, incluindo `SKILL_REQUEST`,
  `PR_REVIEW`, `DEPLOY_REQUEST`, `NEXT_PR_REQUEST`, `CONTRACT_REQUEST`,
  `SYSTEM_STATE_QUESTION`.
- Integração em `nv-enavia.js`: `_intentClassification` já rodado antes da resposta LLM.

---

## 3. Arquitetura implementada

```
routeEnaviaSkill(input)
  ├── Tentativa 1: roteamento por conteúdo (triggers determinísticos)
  │   ├── _isPRUrl(message) → CONTRACT_AUDITOR
  │   └── _matchSkill(normalized, skill) para cada skill no catálogo
  └── Tentativa 2: roteamento por intenção classificada
      ├── pr_review → CONTRACT_AUDITOR
      ├── deploy_request → DEPLOY_GOVERNANCE_OPERATOR
      ├── system_state_question + sinal técnico → SYSTEM_MAPPER
      ├── next_pr_request | contract_request → CONTRACT_LOOP_OPERATOR
      └── skill_request → tenta por conteúdo, se falhar → null
```

**Princípios de segurança:**
- Pure function. Determinístico.
- Sem LLM externo. Sem KV. Sem rede. Sem filesystem runtime.
- Sem side effects. Read-only.
- Testável isoladamente.
- Conservador — na dúvida, retorna `matched=false`.
- Warning sempre presente e sempre menciona `/skills/run inexistente`.

---

## 4. Skills documentais mapeadas

| Skill ID | Nome | Fonte | Usos |
|----------|------|-------|------|
| `CONTRACT_LOOP_OPERATOR` | Contract Loop Operator | `schema/skills/CONTRACT_LOOP_OPERATOR.md` | Loop contratual, próxima PR, sequência de contrato |
| `DEPLOY_GOVERNANCE_OPERATOR` | Deploy Governance Operator | `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` | Deploy, rollback, promoção, gate, aprovação, prod/test |
| `SYSTEM_MAPPER` | System Mapper | `schema/skills/SYSTEM_MAPPER.md` | Mapas, rotas, workers, registry, estado técnico do sistema |
| `CONTRACT_AUDITOR` | Contract Auditor | `schema/skills/CONTRACT_AUDITOR.md` | Revisão de PR, auditoria, critérios de aceite, regressões |

---

## 5. Regras de roteamento

### CONTRACT_LOOP_OPERATOR
- Nome canônico: "contract loop operator", "contract loop", "loop operator"
- Termos: "mande a próxima pr", "próxima pr", "volta ao contrato", "loop do contrato",
  "sequência de prs", "qual a próxima etapa do contrato", "contrato ativo", etc.
- Por intenção: `next_pr_request`, `contract_request`

### CONTRACT_AUDITOR
- Nome canônico: "contract auditor", "contract audit"
- Termos: "revise a pr", "audite essa pr", "critérios de aceite", "regressões",
  "veja se quebrou", "github.com/", "/pull/", etc.
- URL de PR GitHub detectada automaticamente via regex.
- Por intenção: `pr_review`

### DEPLOY_GOVERNANCE_OPERATOR
- Nome canônico: "deploy governance operator", "deploy governance"
- Termos: "deploy", "deploya", "rollback", "promover", "gate de deploy",
  "aprovação de produção", etc.
- Por intenção: `deploy_request`

### SYSTEM_MAPPER
- Nome canônico: "system mapper"
- Termos: "rotas", "route registry", "worker registry", "system map", "mapa do sistema",
  "quais workers", "estado técnico do sistema", "bindings", etc.
- Por intenção: `system_state_question` + sinal técnico presente

### Sem match
- `matched=false`, `skill_id=null`, `mode="read_only"`, warning padrão de no-match.

---

## 6. Integração com Intent Classifier

O `routeEnaviaSkill()` aceita `intentClassification` como parâmetro opcional.
Se fornecido, usa como fallback quando o roteamento por conteúdo não encontrar match.

No handler `/chat/run` de `nv-enavia.js`, o `_intentClassification` (gerado por `classifyEnaviaIntent`)
é passado para `routeEnaviaSkill` via `intentClassification: _intentClassification`.

Assim, para mensagens como "faça o deploy", a cadeia é:
1. `classifyEnaviaIntent` → `deploy_request`
2. `routeEnaviaSkill` → conteúdo casa em "deploy" → DEPLOY_GOVERNANCE_OPERATOR
3. Response inclui `skill_routing.skill_id = "DEPLOY_GOVERNANCE_OPERATOR"`

---

## 7. Integração com /chat/run

Campo aditivo `skill_routing` adicionado ao response do `/chat/run`:

```json
"skill_routing": {
  "matched": true,
  "skill_id": "CONTRACT_AUDITOR",
  "skill_name": "Contract Auditor",
  "mode": "read_only",
  "confidence": "high",
  "reason": "...",
  "sources": ["schema/skills/CONTRACT_AUDITOR.md"],
  "warning": "Skill Router é read-only. Skills são documentais..."
}
```

**Condições de segurança respeitadas:**
- Campo aditivo — não quebra consumidor atual.
- Não executa nada. Não expõe conteúdo sensível.
- Não inclui markdown completo da skill no response.
- Não chama LLM externo. Não cria endpoint.
- Falha silenciosa (try/catch) — `_skillRouting = null` se router falhar.

---

## 8. O que foi alterado

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `schema/enavia-skill-router.js` | Novo | Skill Router read-only v1 |
| `tests/pr51-skill-router-readonly.smoke.test.js` | Novo | Smoke test PR51 (168 asserts, 10 cenários A–J) |
| `schema/reports/PR51_IMPL_SKILL_ROUTER_READONLY.md` | Novo | Este relatório |
| `nv-enavia.js` | Modificado | Import de `routeEnaviaSkill` + chamada aditiva + campo `skill_routing` no response |
| `schema/contracts/INDEX.md` | Modificado | Próxima PR: PR52 |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Modificado | PR51 concluída |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Modificado | Handoff PR51 → PR52 |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Modificado | Log PR51 |

---

## 9. O que NÃO foi alterado

- **Skill Executor não foi implementado.** Nenhuma skill é executada.
- **/skills/run não existe.** Nenhum endpoint foi criado.
- **Não há execução de skill.** O router é read-only.
- **Não há endpoint novo.** Apenas campo aditivo no response existente.
- **Panel não foi alterado.**
- **Executor não foi alterado.**
- **Deploy Worker não foi alterado.**
- **Workflows não foram alterados.**
- **`wrangler.toml` não foi alterado.**
- **`wrangler.executor.template.toml` não foi alterado.**
- **KV/bindings/secrets não foram alterados.**
- **Sanitizers não foram alterados.**
- **Brain Loader não foi alterado.**
- **LLM Core não foi removido nem alterado.**
- **Intent Classifier não foi removido nem alterado.**
- **Nenhuma escrita de memória.**
- **Nenhuma alteração em deploy/gates.**

---

## 10. Testes executados

### Smoke PR51
```
node tests/pr51-skill-router-readonly.smoke.test.js
168/168 ✅
```

Cenários:
- A — Router básico (shape canônico, mode=read_only) ✅
- B — Contract Loop Operator (7 mensagens) ✅
- C — Contract Auditor (5 mensagens) ✅
- D — Deploy Governance Operator (6 mensagens) ✅
- E — System Mapper (6 mensagens) ✅
- F — Skill request explícito (rode/use a skill X) ✅
- G — Pergunta sobre skill (/skills/run inexistente) ✅
- H — Sem match (oi, como vai?) ✅
- I — Integração com Classificador de Intenção ✅
- J — Segurança (read-only, sem execução, sem markdown) ✅

---

## 11. Regressões

| Teste | Resultado |
|-------|-----------|
| `node --check schema/enavia-skill-router.js` | OK ✅ |
| `node --check tests/pr51-skill-router-readonly.smoke.test.js` | OK ✅ |
| `node --check nv-enavia.js` | OK ✅ |
| `tests/pr51-skill-router-readonly.smoke.test.js` | **168/168** ✅ |
| `tests/pr50-intent-runtime.prova.test.js` | **124/124** ✅ |
| `tests/pr49-intent-classifier.smoke.test.js` | **96/96** ✅ |
| `tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` | **20/20** ✅ |
| `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` | **79/79** ✅ |
| `tests/pr46-llm-core-v1.smoke.test.js` | **43/43** ✅ |
| `tests/pr44-brain-loader-chat-runtime.prova.test.js` | **38/38** ✅ |
| `tests/pr43-brain-loader-readonly.smoke.test.js` | **32/32** ✅ |
| `tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | **56/56** ✅ |
| `tests/pr36-chat-runtime-anti-bot.smoke.test.js` | **26/26** ✅ |
| `tests/pr21-loop-status-states.smoke.test.js` | **53/53** ✅ |
| `tests/pr20-loop-status-in-progress.smoke.test.js` | **27/27** ✅ |
| `tests/pr19-advance-phase-e2e.smoke.test.js` | **52/52** ✅ |
| `tests/pr14-executor-deploy-real-loop.smoke.test.js` | **183/183** ✅ |
| `tests/pr13-hardening-operacional.smoke.test.js` | **91/91** ✅ |
| **Total geral** | **1.088/1.088** ✅ |

---

## 12. Riscos restantes

1. **R1 (baixo):** Roteamento baseado em string matching pode não cobrir todas as variações
   de linguagem. Cenários não previstos recebem `matched=false` (comportamento conservador correto).

2. **R2 (baixo):** O campo `skill_routing` no response do `/chat/run` é novo. Consumidores
   que fazem `JSON.parse` e depois acesso por chaves novas podem ter comportamento inesperado
   se não tratarem campos desconhecidos — risco mínimo pois campo aditivo é padrão REST.

3. **R3 (baixo):** A Skill Router v1 não orienta o prompt do LLM sobre qual skill usar.
   O LLM ainda pode mencionar skills livremente sem saber qual foi selecionada pelo router.
   Isso pode ser endereçado em PR futura (injeção de skill selecionada no prompt).

---

## 13. Próxima PR recomendada

**PR52 — PR-PROVA — Teste de roteamento de skills**

Todos os testes passaram (1.088/1.088). A próxima PR deve provar formalmente o Skill
Router v1, validando cenários de roteamento, integração com o classificador, segurança
e regressões completas.

Pré-requisito: PR51 ✅ (concluída — 1.088/1.088 testes passando)
