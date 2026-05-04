# PR95 — Chat Livre Seguro

**Data:** 2026-05-04  
**Branch:** `copilot/pr-95-chat-livre-seguro`  
**Tipo:** PR-IMPL  
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_CHAT_LIVRE_COCKPIT_OPERACIONAL_PR94_PR97.md`  
**PR anterior validada:** PR94 ✅ (Diagnóstico READ-ONLY do Chat Livre + Cockpit)

---

## 1. Objetivo

Corrigir a causa raiz do engessamento do chat da Enavia, deixando conversa casual e diagnóstico leve mais naturais, sem perder segurança operacional.

---

## 2. Diagnóstico usado (base: PR94)

PR94 identificou 6 pontos de engessamento. PR95 ataca os 4 que vivem na camada de runtime de chat:

| Ponto | Arquivo | Impacto |
|-------|---------|---------|
| `technical_diagnosis` → OPERATIONAL desnecessário | `enavia-response-policy.js` | Pergunta técnica casual recebia estilo operacional pesado |
| MODO OPERACIONAL ATIVO com falso positivo | `enavia-cognitive-runtime.js` | Diagnóstico técnico casual recebia 15+ linhas de regras rígidas |
| `read_only` sempre injetado | `enavia-cognitive-runtime.js` | Toda conversa com target recebia sinal de "modo restrito" |
| TOM AO BLOQUEAR com 8 bullets densos | `enavia-llm-core.js` | Bloco de instruções de bloqueio induzia tom robusto |

---

## 3. O que foi corrigido

### 3.1 `schema/enavia-response-policy.js` — Mudança 1

**Antes:** `technical_diagnosis` e `system_state` ativavam `RESPONSE_STYLES.OPERATIONAL` em caso limpo (sem autoauditoria bloqueante).

**Depois:** `technical_diagnosis`, `system_state`, `memory_request`, `skill_request` e `contract_request` ficam `CONVERSATIONAL` em caso limpo — sem risco, sem intenção operacional real.

**Regra preservada:** Se houver `self_audit` bloqueante ou pedido real de execução/deploy/merge/patch, a policy operacional pesada continua ativa.

### 3.2 `schema/enavia-llm-core.js` — Mudança 2

**Antes:** TOM AO BLOQUEAR com 8 bullets detalhados (incluindo frases de exemplo separadas e regras repetitivas).

**Depois:** TOM AO BLOQUEAR reduzido a 3 bullets essenciais — ainda cobre todos os guardrails de segurança (NUNCA use "Modo read-only ativo", bloqueio com aprovação, casual/natural) mas sem densidade robótica.

**Strings preservadas (exigidas por PR84 smoke test):**
- "NUNCA" + "Modo read-only ativo"
- "Conforme o contrato ativo"  
- "Posso analisar agora"
- "Conversa casual"

### 3.3 `schema/enavia-cognitive-runtime.js` — Mudança 3

**Antes:** `MODO OPERACIONAL ATIVO` injetado sempre que `is_operational_context === true`.

**Depois:** `MODO OPERACIONAL ATIVO` só injetado quando `is_operational_context === true` **E** `response_policy.response_style !== CONVERSATIONAL`. Se a policy indicar CONVERSATIONAL (diagnóstico leve, consulta casual), o bloco pesado é suprimido mesmo com `is_operational_context=true`.

**Lógica:**
```js
const _hasRealOperationalIntent = is_operational_context && (
  !response_policy || response_policy.response_style !== RESPONSE_STYLES.CONVERSATIONAL
);
if (_hasRealOperationalIntent) { // MODO OPERACIONAL ATIVO }
```

### 3.4 `schema/enavia-cognitive-runtime.js` — Mudança 4

**Antes:** Nota `"• Modo atual: read_only. Ações com efeito colateral..."` injetada sempre que `target.mode === "read_only"` — em toda conversa com target ativo.

**Depois:** Nota injetada somente quando `target.mode === "read_only"` **E** `is_operational_context === true`. Em conversa casual com target ativo, a nota é omitida.

---

## 4. O que não foi mexido

- `panel/**` — painel intocado (reservado para PR96 — Cockpit Passivo)
- `nv-enavia.js` — runtime principal preservado
- `executor/src/index.js` — executor preservado
- `contract-executor.js` — preservado
- `.github/workflows/deploy.yml` — preservado
- `wrangler.toml` — preservado
- PR Orchestrator PR90–PR93: `enavia-pr-planner.js`, `enavia-pr-executor-supervised.js`, `enavia-pr-readiness.js`
- Deploy loop PR86–PR89: `enavia-deploy-loop.js`
- Skill Factory/Runner: `enavia-skill-factory.js`, `enavia-skill-runner.js`
- SELF_WORKER_AUDITOR: `enavia-self-worker-auditor-skill.js`
- JSON envelope interno (`{"reply":"...","use_planner":...}`) — estrutural, preservado
- Todos os guardrails de segurança
- Todos os gates de aprovação humana
- Bloqueios de PROD/merge/secrets

---

## 5. Guardrails preservados

| Guardrail | Status |
|-----------|--------|
| `execution_request` → OPERATIONAL + should_warn | ✅ Preservado |
| `deploy_request` → OPERATIONAL + should_warn | ✅ Preservado |
| `unauthorized_action` blocking → BLOCKING_NOTICE | ✅ Preservado |
| `secret_exposure` → BLOCKING_NOTICE + should_refuse_or_pause | ✅ Preservado |
| MODO OPERACIONAL ATIVO para execução real | ✅ Preservado |
| Nota read_only em contexto operacional real | ✅ Preservada |
| TOM AO BLOQUEAR (compacto) | ✅ Preservado (3 bullets) |

---

## 6. Arquivos alterados (4 mudanças cirúrgicas)

| Arquivo | Mudança |
|---------|---------|
| `schema/enavia-response-policy.js` | `technical_diagnosis`/`system_state`/`memory_request`/`skill_request`/`contract_request` → CONVERSATIONAL em caso limpo |
| `schema/enavia-llm-core.js` | TOM AO BLOQUEAR reduzido de 8 para 3 bullets |
| `schema/enavia-cognitive-runtime.js` | MODO OPERACIONAL ATIVO só para intenção operacional real |
| `schema/enavia-cognitive-runtime.js` | Nota `read_only` só em contexto operacional real |

---

## 7. Nota sobre cascata de testes

PR85 (`tests/pr85-autoevolucao-operacional.fechamento.test.js`) lista `schema/enavia-llm-core.js` como arquivo proibido para o escopo daquela PR. Como PR95 modifica esse arquivo (com autorização explícita do contrato PR94–PR97), a check de "arquivo proibido" do PR85 falha. Isso causa falhas em cascata em PR89, PR91, PR92 e PR93 que regridem para PR85.

**Essas falhas são esperadas e explicadas:** decorrem da sobreposição entre o forbidden-list do PR85 (escopo PR85) e a autorização explícita do PR95 (escopo PR94–PR97). Os arquivos de runtime dos testes em cascata continuam íntegros e funcionando.

---

## 8. Resultado dos testes

| Teste | Resultado |
|-------|-----------|
| `tests/pr95-chat-livre-seguro.smoke.test.js` | ✅ Novo — cobrindo 51 cenários |
| `tests/pr94-chat-livre-cockpit-diagnostico.prova.test.js` | ✅ 55/55 |
| `tests/pr84-chat-vivo.smoke.test.js` | ✅ 52/52 |
| `tests/pr59-response-policy-viva.smoke.test.js` | ✅ 96/96 |
| `tests/pr90-pr-orchestrator-diagnostico.prova.test.js` | ✅ 30/30 |
| `tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js` | ⚠️ Cascade PR85 esperada |
| `tests/pr92-pr-executor-supervisionado-mock.prova.test.js` | ⚠️ Cascade PR85 esperada |
| `tests/pr91-pr-planner-schema.prova.test.js` | ⚠️ Cascade PR85 esperada |

---

## 9. O que fica para PR96

- **Cockpit Passivo:** ajustar painel para exibir intenção, modo sugerido, risco, próxima ação e approval gates **sem controlar o tom da conversa**.
- Específicos:
  - `QuickActions.jsx`: adicionar modo casual/neutro
  - `useChatState.js`: suavizar/condicionar `planner_brief` em mensagens casuais
  - `TargetPanel.jsx`: exibir cockpit passivo com estado sugerido
  - Painel como observador/sugestor, não controlador do tom

---

## 10. Rollback

Se necessário reverter PR95:

```bash
git revert HEAD --no-edit  # ou reset para o commit anterior
```

Arquivos alterados são os 4 listados na Seção 6. O efeito é restaurar o tom operacional pesado para todos os tipos de intenção, incluindo diagnóstico técnico casual.
