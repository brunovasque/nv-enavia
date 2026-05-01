# PR52 — Prova de Roteamento de Skills

**Tipo:** PR-PROVA (Worker-only, prova pura)
**Branch:** `copilot/claude-pr52-prova-roteamento-skills`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR51 ✅ (PR-IMPL — Skill Router read-only — 168/168)
**Data:** 2026-05-01

---

## 1. Objetivo

Provar que o Skill Router read-only implementado na PR51 roteia corretamente pedidos de skill
no fluxo real do chat/prompt, sem executar nenhuma skill, sem criar endpoint, sem criar
`/skills/run`, sem falsa capacidade e sem quebrar Intent Classifier, LLM Core, Brain Context
ou gates.

Esta PR é prova pura. Nenhum runtime foi alterado.

---

## 2. PR51 validada

| Campo | Valor |
|-------|-------|
| Tipo | PR-IMPL |
| Branch | `copilot/claudepr51-impl-skill-router-readonly` |
| Arquivo criado | `schema/enavia-skill-router.js` |
| Smoke PR51 | 168/168 ✅ |
| Total com regressões | 1.088/1.088 ✅ |
| Relatório | `schema/reports/PR51_IMPL_SKILL_ROUTER_READONLY.md` |

A PR51 implementou `routeEnaviaSkill()` como pure function determinística, sem I/O,
sem side-effects, roteando 4 skills documentais e integrando com o Classificador de
Intenção v1. Campo aditivo `skill_routing` no response do `/chat/run`.

---

## 3. Cenários testados

| Cenário | Descrição | Asserts |
|---------|-----------|---------|
| A | Skill Router presente e read-only | 16 |
| B | Contract Loop Operator | 18 |
| C | Contract Auditor | 14 |
| D | Deploy Governance Operator | 14 |
| E | System Mapper | 16 |
| F | Pedido explícito de skill | 18 |
| G | Pergunta sobre skill | 9 |
| H | Sem match | 13 |
| I | Integração com Classificador de Intenção | 16 |
| J | Shape canônico de /chat/run | 30 |
| K | Segurança | 25 |
| L | Regressões de falsa capacidade | 13 |
| **Total** | | **202/202** |

---

## 4. Resultado por cenário

| Cenário | Resultado |
|---------|-----------|
| A — Skill Router presente e read-only | ✅ 16/16 |
| B — Contract Loop Operator | ✅ 18/18 |
| C — Contract Auditor | ✅ 14/14 |
| D — Deploy Governance Operator | ✅ 14/14 |
| E — System Mapper | ✅ 16/16 |
| F — Pedido explícito de skill | ✅ 18/18 |
| G — Pergunta sobre skill | ✅ 9/9 |
| H — Sem match | ✅ 13/13 |
| I — Integração com Classificador de Intenção | ✅ 16/16 |
| J — Shape canônico de /chat/run | ✅ 30/30 |
| K — Segurança | ✅ 25/25 |
| L — Regressões de falsa capacidade | ✅ 13/13 |

**Total: 202/202 ✅**

---

## 5. Contract Loop Operator

Mensagens testadas:
- `"mande a próxima PR"` → ✅ matched=true, skill_id=CONTRACT_LOOP_OPERATOR, mode=read_only
- `"volte ao contrato"` → ✅ matched=true, skill_id=CONTRACT_LOOP_OPERATOR, mode=read_only
- `"qual a próxima etapa do contrato?"` → ✅ matched=true, skill_id=CONTRACT_LOOP_OPERATOR, mode=read_only

Validações:
- ✅ skill_routing.matched=true para todas as mensagens
- ✅ skill_id="CONTRACT_LOOP_OPERATOR"
- ✅ mode="read_only"
- ✅ skill_name="Contract Loop Operator"
- ✅ reason presente e não vazio
- ✅ Não injeta falsa execução (warning não menciona "executando", "executei")
- ✅ Intent classifier: `next_pr_request` / `contract_request` roteiam para esta skill

---

## 6. Contract Auditor

Mensagens testadas:
- `"revise a PR 212"` → ✅ matched=true, skill_id=CONTRACT_AUDITOR
- `"veja se essa PR quebrou algum critério"` → ✅ matched=true, skill_id=CONTRACT_AUDITOR
- `"https://github.com/brunovasque/nv-enavia/pull/212"` → ✅ matched=true, skill_id=CONTRACT_AUDITOR

Validações:
- ✅ intent `pr_review` detectado pelo classifyEnaviaIntent
- ✅ skill_id="CONTRACT_AUDITOR"
- ✅ is_operational=true para revisão de PR
- ✅ Roteamento documental: sources aponta para .md
- ✅ Não executa auditoria real automaticamente (warning não contém "auditei", "analisei a pr")
- ✅ mode=read_only

---

## 7. Deploy Governance Operator

Mensagens testadas:
- `"deploya em test"` → ✅ matched=true, skill_id=DEPLOY_GOVERNANCE_OPERATOR
- `"faça rollback"` → ✅ matched=true, skill_id=DEPLOY_GOVERNANCE_OPERATOR
- `"promover para produção"` → ✅ matched=true, skill_id=DEPLOY_GOVERNANCE_OPERATOR

Validações:
- ✅ intent `deploy_request` detectado pelo classifyEnaviaIntent
- ✅ skill_id="DEPLOY_GOVERNANCE_OPERATOR"
- ✅ is_operational=true para deploy
- ✅ Warning read-only presente
- ✅ Gates/aprovação continuam exigidos (mode=read_only)
- ✅ Warning não indica deploy iniciado nem produção atualizada

---

## 8. System Mapper

Mensagens testadas:
- `"quais workers existem?"` → ✅ matched=true, skill_id=SYSTEM_MAPPER
- `"verifique o route registry"` → ✅ matched=true, skill_id=SYSTEM_MAPPER
- `"mapa do sistema"` → ✅ matched=true, skill_id=SYSTEM_MAPPER

Validações:
- ✅ skill_id="SYSTEM_MAPPER"
- ✅ Roteamento documental: sources aponta para .md
- ✅ Não inventa workers/rotas (warning não contém "worker encontrado", "rota encontrada")
- ✅ Não chama filesystem/rede/KV (retorno < 100ms, pure function)
- ✅ mode=read_only

---

## 9. Pedido explícito de skill

Mensagens testadas:
- `"rode a skill Contract Auditor"` → ✅ skill_id=CONTRACT_AUDITOR, warning menciona /skills/run e runtime
- `"use a skill System Mapper"` → ✅ skill_id=SYSTEM_MAPPER, warning menciona /skills/run
- `"acione a skill Deploy Governance Operator"` → ✅ skill_id=DEPLOY_GOVERNANCE_OPERATOR

Validações:
- ✅ Skill correta para cada pedido explícito
- ✅ Warning informa read-only
- ✅ Warning informa que runtime de execução não existe
- ✅ Warning informa que /skills/run não existe
- ✅ Warning não indica "executando a skill" nem "skill executada"
- ✅ mode=read_only para todos

---

## 10. Pergunta sobre skill

Mensagens testadas:
- `"qual skill devo usar?"` → ✅ mode=read_only, warning menciona read-only
- `"você já tem /skills/run?"` → ✅ mode=read_only, warning menciona /skills/run
- `"as skills já executam?"` → ✅ mode=read_only, warning avisa sobre não-execução

Validações:
- ✅ Não finge runtime em nenhum dos casos
- ✅ Se há skill sugerida, é apenas documental (skill_id é null ou string canônica)
- ✅ Pergunta sobre /skills/run não cria endpoint falso
- ✅ mode=read_only garantido

---

## 11. Sem match

Mensagens testadas:
- `"oi"` → ✅ matched=false, skill_id=null
- `"qual o melhor caminho?"` → ✅ matched=false, skill_id=null
- `"isso vale a pena agora?"` → ✅ matched=false, skill_id=null

Validações:
- ✅ matched=false para mensagens sem sinal técnico explícito
- ✅ skill_id=null — não inventa skill
- ✅ mode=read_only para todos
- ✅ "qual o melhor caminho?" não ativa intent de deploy/execução
- ✅ skill_id é null ou canônico (nunca fabricado)

---

## 12. Integração com Intent Classifier

Casos testados:

| Mensagem | classifyEnaviaIntent | routeEnaviaSkill | skill_id |
|----------|---------------------|------------------|----------|
| "rode a skill Contract Loop" | skill_request ✅ | matched=true ✅ | CONTRACT_LOOP_OPERATOR ✅ |
| "revise a PR 212" | pr_review ✅ | matched=true ✅ | CONTRACT_AUDITOR ✅ |
| "faça o deploy em produção" | deploy_request ✅ | matched=true ✅ | DEPLOY_GOVERNANCE_OPERATOR ✅ |
| "quais workers existem no sistema?" | system_state_question | matched=true ✅ | SYSTEM_MAPPER ✅ |
| "mande a próxima PR" | next_pr_request / contract_request ✅ | matched=true ✅ | CONTRACT_LOOP_OPERATOR ✅ |
| "oi, tudo bem?" | conversation ✅ | matched=false ✅ | null ✅ |

Integração confirmada: `classifyEnaviaIntent` + `routeEnaviaSkill` funcionam em cadeia.
Conversa simples não ativa modo operacional. Intenções técnicas roteiam corretamente.

---

## 13. Campo `skill_routing`

O shape canônico retornado pelo router (e usado como campo aditivo em `/chat/run`) foi
validado via inspeção de código + testes unitários.

**Shape completo validado:**
```json
{
  "matched": true,
  "skill_id": "CONTRACT_AUDITOR",
  "skill_name": "Contract Auditor",
  "mode": "read_only",
  "confidence": "high",
  "reason": "Termos de roteamento detectados para Contract Auditor: revise a pr",
  "sources": ["schema/skills/CONTRACT_AUDITOR.md"],
  "warning": "Skill Router é read-only. Skills são documentais — apenas referência, sem execução runtime. /skills/run ainda não existe. Nenhuma ação foi executada."
}
```

**Campos verificados:** matched, skill_id, skill_name, mode, confidence, reason, sources, warning.

**Limitação documentada (Cenário J):** O harness real de `/chat/run` requer LLM externo
(Cloudflare AI Workers AI). A validação foi feita por:
1. Inspeção de código (`nv-enavia.js:4078–4089` — chamada do router; `nv-enavia.js:4621–4629` —
   campo `skill_routing` no response).
2. Testes unitários do shape retornado pelo router (cenários J1–J7, 29 asserts).
3. Autorizado pelo enunciado da PR52.

---

## 14. Segurança e falsa capacidade

| Verificação | Resultado |
|------------|-----------|
| Nenhum endpoint `/skills/run` criado | ✅ |
| Nenhum endpoint `/skills` novo criado | ✅ |
| Router não chama rede/KV/filesystem | ✅ (retorno < 100ms, pure function) |
| Router não retorna conteúdo inteiro dos markdowns | ✅ (sources < 200 chars, warning < 1000 chars) |
| Router não executa função de skill | ✅ (modo sempre read_only) |
| Router não retorna campo 'result' / 'output' de execução | ✅ |
| Router não altera input (message, context) | ✅ |
| Router é determinístico | ✅ (mesma entrada → mesma saída confirmada) |
| Warning sempre presente e menciona /skills/run | ✅ |
| Warning não inclui markdown completo (##, ---) | ✅ |
| Warning não contém token longo (possível segredo) | ✅ |
| skill_id é sempre null ou um dos 4 IDs canônicos | ✅ |
| Falsa capacidade bloqueada | ✅ ("execute a skill agora", "rode /skills/run", "a skill já pode aplicar patch?" → warning read-only) |
| Skill Executor não existe | ✅ (confirmado por ausência de campo 'result'/'output') |
| gates/aprovação continuam exigidos | ✅ (mode=read_only, warning para deploy) |

---

## 15. Regressões executadas

| Teste | Asserts | Resultado |
|-------|---------|-----------|
| `node --check schema/enavia-skill-router.js` | — | ✅ OK |
| `node --check tests/pr52-skill-routing-runtime.prova.test.js` | — | ✅ OK |
| `node tests/pr52-skill-routing-runtime.prova.test.js` | 202 | ✅ 202/202 |
| `node tests/pr51-skill-router-readonly.smoke.test.js` | 168 | ✅ 168/168 |
| `node tests/pr50-intent-runtime.prova.test.js` | 124 | ✅ 124/124 |
| `node tests/pr49-intent-classifier.smoke.test.js` | 96 | ✅ 96/96 |
| `node tests/pr48-correcao-cirurgica-llm-core-v1.smoke.test.js` | 20 | ✅ 20/20 |
| `node tests/pr47-resposta-viva-llm-core-v1.prova.test.js` | 79 | ✅ 79/79 |
| `node tests/pr46-llm-core-v1.smoke.test.js` | 43 | ✅ 43/43 |
| `node tests/pr44-brain-loader-chat-runtime.prova.test.js` | 38 | ✅ 38/38 |
| `node tests/pr43-brain-loader-readonly.smoke.test.js` | 32 | ✅ 32/32 |
| `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | 56 | ✅ 56/56 |
| `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` | 26 | ✅ 26/26 |
| `node tests/pr21-loop-status-states.smoke.test.js` | 53 | ✅ 53/53 |
| `node tests/pr20-loop-status-in-progress.smoke.test.js` | 27 | ✅ 27/27 |
| `node tests/pr19-advance-phase-e2e.smoke.test.js` | 52 | ✅ 52/52 |
| `node tests/pr14-executor-deploy-real-loop.smoke.test.js` | 183 | ✅ 183/183 |
| `node tests/pr13-hardening-operacional.smoke.test.js` | 91 | ✅ 91/91 |
| **Total geral** | **1.290** | ✅ **1.290/1.290** |

---

## 16. Riscos restantes

1. **R1 (baixo, herdado de PR51):** Roteamento baseado em string matching pode não cobrir todas as variações
   de linguagem. Casos não previstos recebem `matched=false` (comportamento conservador correto).

2. **R2 (baixo, herdado de PR51):** O campo `skill_routing` no response do `/chat/run` não orienta
   o prompt do LLM sobre qual skill usar. O LLM ainda pode mencionar skills livremente sem saber
   qual foi selecionada pelo router. Será endereçado em PR futura (Retrieval por intenção, PR53).

3. **R3 (limitação técnica documentada):** O harness real de `/chat/run` requer LLM externo.
   Validação do campo `skill_routing` no response real foi feita via inspeção de código e
   unitários do shape. Autorizado pelo enunciado da PR52.

---

## 17. Resultado final

**✅ PASSOU — 202/202 asserts. Total com regressões: 1.290/1.290.**

- Skill Router read-only validado formalmente.
- 4 skills documentais roteadas corretamente (CONTRACT_LOOP_OPERATOR, CONTRACT_AUDITOR,
  DEPLOY_GOVERNANCE_OPERATOR, SYSTEM_MAPPER).
- Campo `skill_routing` validado (shape canônico e limitação documentada).
- Skill Router permanece read-only em todos os cenários.
- `/skills/run` continua inexistente.
- Nenhuma skill foi executada.
- Nenhum endpoint criado.
- Nenhum painel, executor, deploy worker, workflow, wrangler, KV/binding/secret alterado.
- Falsa capacidade bloqueada (warning read-only em todos os casos relevantes).
- Regressões verdes (1.088/1.088 anteriores + 202 novos = 1.290/1.290 total).

---

## 18. Próxima PR recomendada

Todos os testes passaram (1.290/1.290). O Skill Router read-only está formalmente validado.

**PR53 — PR-IMPL — Retrieval por intenção**

Próxima PR autorizada conforme contrato `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`:
implementar o Retrieval por intenção — conectar o Skill Router ao LLM Core para que a
skill selecionada seja injetada no prompt, orientando a resposta da Enavia.

**Pré-requisito:** PR52 ✅ (concluída — 1.290/1.290 testes passando)
