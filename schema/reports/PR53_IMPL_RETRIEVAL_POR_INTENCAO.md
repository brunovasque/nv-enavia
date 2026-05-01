# PR53 — Retrieval por Intenção

**Tipo:** PR-IMPL
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**Data:** 2026-05-01
**Branch:** `copilot/claudepr53-impl-retrieval-por-intencao`
**PR anterior:** PR52 — PR-PROVA — Skill Router read-only validado 202/202 ✅

---

## 1. Objetivo

Implementar o Retrieval por Intenção v1 da Enavia: um módulo determinístico, read-only e sem side effects que monta um bloco documental compacto orientado pela intenção detectada e pelo roteamento de skill, para ser injetado no system prompt do chat e orientar a resposta conforme a intenção.

Essa PR:
- Não executa skill.
- Não cria endpoint.
- Não cria `/skills/run`.
- Não lê filesystem em runtime.
- Não consulta KV/rede.
- Não retorna markdown inteiro.

---

## 2. Diagnóstico usado

- PR51: Skill Router read-only (`schema/enavia-skill-router.js`) — 4 skills documentais mapeadas, roteamento determinístico.
- PR52: Prova do Skill Router — 202/202 ✅, 1.290/1.290 total ✅.
- PR49: Intent Classifier v1 — 15 intenções canônicas.
- PR46: LLM Core v1 — `buildChatSystemPrompt` com suporte a seções modulares.
- PR43: Brain Loader read-only — padrão de snapshot estático compacto reutilizado.

---

## 3. Arquitetura implementada

```
classifyEnaviaIntent()      →  intentClassification
routeEnaviaSkill()          →  skillRouting
buildIntentRetrievalContext() →  intentRetrieval
  ↓
buildChatSystemPrompt({ intent_retrieval_context }) → system prompt com seção 7d
```

Fluxo:
1. `buildIntentRetrievalContext(input)` recebe mensagem + intentClassification + skillRouting.
2. Extrai `skill_id` do skillRouting (ou mapeia via `_INTENT_TO_SKILL` como fallback).
3. Busca bloco compacto no snapshot estático `_SKILL_CONTEXT_BLOCKS[skill_id]`.
4. Se não houver skill, tenta `_INTENT_CONTEXT_BLOCKS[intent]` para intenções sem skill.
5. Aplica limite `max_chars` (padrão 2.000) com truncamento seguro.
6. Retorna shape canônico com `applied`, `mode`, `intent`, `skill_id`, `sources`, `context_block`, `warnings`, `token_budget_hint`.

---

## 4. Fontes allowlist

Documentos representados como snapshot estático (sem leitura em runtime):

| Fonte original | Tipo |
|----------------|------|
| `schema/skills/CONTRACT_LOOP_OPERATOR.md` | Skill documental |
| `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` | Skill documental |
| `schema/skills/SYSTEM_MAPPER.md` | Skill documental |
| `schema/skills/CONTRACT_AUDITOR.md` | Skill documental |
| `schema/brain/RETRIEVAL_POLICY.md` | Política de retrieval |
| `schema/brain/maps/skill-map.md` | Mapa de skills |

Nenhum markdown é lido em runtime. Apenas resumos compactos embutidos no módulo.

---

## 5. Retrieval por skill

Quando `skillRouting.skill_id` está presente, o módulo injeta contexto compacto da skill correspondente:

### CONTRACT_LOOP_OPERATOR
- Seguir contrato ativo sem desviar
- Entregar próxima PR conforme contrato
- Manter loop PR a PR (diagnóstico → implementação → prova → governança)
- Para pedido de próxima PR: resposta curta + objetivo + prompt completo
- Exceção corretiva: corrigir, provar, retornar ao contrato
- Não abrir frente paralela

### CONTRACT_AUDITOR
- Revisar PR contra contrato ativo
- Checar escopo, arquivos alterados, regressões
- Checar alterações proibidas
- Não assumir sucesso sem evidência real
- Decidir merge/correção somente após inspeção factual
- Verificar governança atualizada

### DEPLOY_GOVERNANCE_OPERATOR
- Deploy exige gate/aprovação documentada
- Diferenciar test vs. prod
- Rollback documentado antes do deploy
- Não alterar produção sem autorização explícita
- Não criar deploy automático
- Gates de produção obrigatórios

### SYSTEM_MAPPER
- Consultar mapa/registries antes de afirmar capacidade
- Diferenciar sistema documentado vs. runtime real
- Não inventar worker, rota, binding ou endpoint
- `/skills/run` não existe — Skill Router é read-only
- Marcar incerteza quando sem fonte

---

## 6. Retrieval por intenção sem skill

Quando não há skill clara, mas há intenção relevante:

| Intent | Contexto |
|--------|---------|
| `frustration_or_trust_issue` | Sinceridade, execesso documental, execução concreta, "Isso é opcional. Não mexa agora." |
| `next_pr_request` | Resposta curta + prompt completo, não reabrir discussão |
| `capability_question` | Diferencia atual/futuro, não finge `/skills/run` ou Skill Executor |
| `system_state_question` | Diferencia documentado vs. runtime, não inventa workers/bindings |
| `strategy_question` | Resposta estratégica curta, custo/tempo/risco, opcionalidade |

---

## 7. Limites e truncamento

- `max_chars` padrão: 2.000 chars
- Truncamento com marcador: `[intent-retrieval-truncated]`
- `actual_chars <= max_chars` garantido em todos os casos
- Override interno `_max_chars` disponível para testes

---

## 8. Integração com prompt

Adicionada seção `7d` ao `buildChatSystemPrompt` em `schema/enavia-cognitive-runtime.js`:

```
CONTEXTO RECUPERADO POR INTENÇÃO — READ-ONLY
Este bloco orienta a resposta com base na intenção detectada.
Não autoriza execução de skill. Não ativa modo operacional sozinho.
<context_block>
```

Regras:
- Entra somente quando `applied=true`
- Aparece após Brain Context (seção 7c) e antes do envelope JSON (seção 8)
- Não sobrescreve LLM Core nem Brain Context
- Não ativa MODO OPERACIONAL ATIVO
- Omitido quando `applied=false`

---

## 9. Integração com chat/run

Em `nv-enavia.js`:
1. Importado `buildIntentRetrievalContext` de `schema/enavia-intent-retrieval.js`
2. Chamado após `routeEnaviaSkill()` com `message`, `intentClassification`, `skillRouting`, `context`
3. `_intentRetrieval` passado para `buildChatSystemPrompt` como `intent_retrieval_context`
4. Campo aditivo `intent_retrieval` adicionado ao response:
   ```json
   {
     "applied": boolean,
     "mode": "read_only",
     "intent": string|null,
     "skill_id": string|null,
     "sources": string[],
     "token_budget_hint": { ... },
     "warnings": string[]
   }
   ```
5. `context_block` NÃO exposto no response — apenas metadados
6. Campo aditivo, não-quebrante (fire-and-forget defensivo)

---

## 10. O que foi alterado

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `schema/enavia-intent-retrieval.js` | **Novo** | Módulo principal do Retrieval por Intenção v1 |
| `schema/enavia-cognitive-runtime.js` | **Modificado** | Adição do parâmetro `intent_retrieval_context` + seção 7d no prompt |
| `nv-enavia.js` | **Modificado** | Import + chamada a `buildIntentRetrievalContext` + campo aditivo no response |
| `tests/pr53-intent-retrieval.smoke.test.js` | **Novo** | 82 asserts (cenários A–L) |
| `schema/reports/PR53_IMPL_RETRIEVAL_POR_INTENCAO.md` | **Novo** | Este relatório |
| `schema/contracts/INDEX.md` | **Atualizado** | Próxima PR → PR54 |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | **Atualizado** | Status pós-PR53 |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | **Atualizado** | Handoff para PR54 |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | **Atualizado** | Log de execução |

---

## 11. O que NÃO foi alterado

- **Skill Executor** — não implementado. Não existe.
- **`/skills/run`** — não existe. Não foi criado.
- **Execução de skill** — não há execução de skill em nenhum ponto desta PR.
- **Endpoint novo** — nenhum endpoint criado.
- **Panel** — não alterado.
- **Executor** — não alterado.
- **Deploy Worker** — não alterado.
- **Workflows** — não alterados.
- **`wrangler.toml`** — não alterado.
- **KV/bindings/secrets** — não alterados.
- **Deploy/gates** — não alterados.
- **Sanitizers** — não alterados.
- **Brain Loader** — não alterado (apenas `buildChatSystemPrompt` aceitou novo parâmetro).
- **LLM Core** — não removido, não modificado.
- **Intent Classifier** — não removido, não modificado.
- **Skill Router** — não removido, não modificado.
- **Escrita de memória** — não implementada.
- **Self-Audit** — não implementado.
- **Produção** — não alterada.

---

## 12. Testes executados

| Teste | Resultado |
|-------|-----------|
| `node --check schema/enavia-intent-retrieval.js` | ✅ OK |
| `node --check tests/pr53-intent-retrieval.smoke.test.js` | ✅ OK |
| `node tests/pr53-intent-retrieval.smoke.test.js` | ✅ **82/82** |

---

## 13. Regressões

| Teste | Resultado |
|-------|-----------|
| `tests/pr52-skill-routing-runtime.prova.test.js` | ✅ 202/202 |
| `tests/pr51-skill-router-readonly.smoke.test.js` | ✅ 168/168 |
| `tests/pr50-intent-runtime.prova.test.js` | ✅ 124/124 |
| `tests/pr49-intent-classifier.smoke.test.js` | ✅ 96/96 |
| `tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` | ✅ 20/20 |
| `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` | ✅ 79/79 |
| `tests/pr46-llm-core-v1.smoke.test.js` | ✅ 43/43 |
| `tests/pr44-brain-loader-chat-runtime.prova.test.js` | ✅ 38/38 |
| `tests/pr43-brain-loader-readonly.smoke.test.js` | ✅ 32/32 |
| `tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | ✅ 56/56 |
| `tests/pr36-chat-runtime-anti-bot.smoke.test.js` | ✅ 26/26 |
| `tests/pr21-loop-status-states.smoke.test.js` | ✅ 53/53 |
| `tests/pr20-loop-status-in-progress.smoke.test.js` | ✅ 27/27 |
| `tests/pr19-advance-phase-e2e.smoke.test.js` | ✅ 52/52 |
| `tests/pr14-executor-deploy-real-loop.smoke.test.js` | ✅ 183/183 |
| `tests/pr13-hardening-operacional.smoke.test.js` | ✅ 91/91 |
| **Total** | ✅ **1.372/1.372** |

---

## 14. Riscos restantes

- **Sem teste de integração real com LLM**: a injeção do bloco no prompt foi validada por inspeção de código e testes unitários (`buildChatSystemPrompt`). O efeito real no comportamento do LLM (Llama/GPT) depende do prompt engineering e não pode ser testado sem LLM externo.
- **Mapeamento `_INTENT_TO_SKILL` incompleto**: intenções como `execution_request` e `skill_request` não têm mapeamento fixo — dependem do Skill Router para fazer a seleção. Se o router não casar, o intent retrieval cai em bloco por intenção ou sem match.
- **`capability_question` → `SYSTEM_MAPPER` via fallback**: quando o Skill Router não roteia diretamente, o mapa `_INTENT_TO_SKILL` usa SYSTEM_MAPPER. Isso pode não ser o mapeamento ideal para todos os casos de pergunta de capacidade.
- **Próxima etapa dependente**: PR54 (testes de memória contextual) pode revelar conflitos entre Intent Retrieval Block e Memory Retrieval Block (ambos são seções de sistema — possível ruído/duplicação).

---

## 15. Próxima PR recomendada

**PR54 — PR-PROVA — Testes de memória contextual**

Todos os 1.372 testes passaram (82 novos + 1.290 de regressão). Retrieval por intenção funcionando conforme contrato. Critérios de aceite atendidos integralmente.
