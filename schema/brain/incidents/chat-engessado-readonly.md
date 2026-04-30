# Incidente: Chat Engessado — `read_only` como Regra de Tom

**Data de abertura:** 2026-04-30 (diagnosticado na PR32)
**Estado:** Resolvido ✅ (PR38 — 56/56 testes passando)
**PRs relacionadas:** PR32, PR34, PR35, PR36, PR37, PR38

---

## 1. Problema Observado

A Enavia respondia a mensagens de chat de conversa geral com comportamento robótico:
- Frases estereotipadas de alerta operacional
- Contexto de "MODO OPERACIONAL ATIVO" em toda resposta, mesmo em perguntas simples
- Respostas em bullet points quando não havia necessidade
- Aviso de `read_only` sendo repetido como instrução de comportamento
- Respostas substituídas por frases fixas pelos sanitizers pós-LLM
- Falta de naturalidade e proporcionalidade à intenção da mensagem

---

## 2. Causa Diagnosticada

A causa raiz foi identificada em 7 camadas (PR32 + PR34):

### Camada 1 — Origem no painel
`panel/src/chat/useTargetState.js:35-49` colocava o sistema em modo `read_only` com
um target default (`__global__`) para **toda** sessão de chat, sem distinção de intenção.

### Camada 2 — Leitura no Worker
`nv-enavia.js` lia `target` e `read_only` como gatilho para ativar contexto operacional.
Qualquer mensagem com target padrão ativava `isOperationalMessage` ou o bloco operacional.

### Camada 3 — Tradução semântica incorreta nos prompts
`schema/enavia-cognitive-runtime.js` traduzia `read_only=true` como instrução de tom:
```
"Este é um ambiente read_only... mantenha respostas precisas e sem executar ações"
```
Isso transformava um gate de execução em regra de comportamento/tom.

### Camada 4 — Ativação indevida do bloco operacional
`buildChatSystemPrompt` injetava o bloco `MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO`
sempre que `hasActiveTarget=true`, independentemente de `is_operational_context`.

### Camada 5 — Sanitizers pós-LLM muito destrutivos
Dois sanitizers em `nv-enavia.js` substituíam respostas de prosa natural por frases fixas
robóticas, mesmo quando a resposta LLM era contextualmente correta.

### Camada 6 — Envelope JSON constrangedor
O contrato de resposta `{reply, use_planner}` forçava respostas curtas e estruturadas,
eliminando naturalidade mesmo quando o LLM gerava resposta adequada.

### Camada 7 — Ausência de LLM Core / Intent Engine / Skill Router / Brain
Sem intent detection real, qualquer mensagem era tratada como operacional se houvesse
target ativo — sem capacidade de distinguir conversa de execução.

---

## 3. PRs de Correção

| PR | Tipo | Ação |
|----|------|------|
| **PR32** | PR-DIAG | Diagnóstico inicial. 5 causas raiz identificadas. Nenhum runtime alterado. |
| **PR34** | PR-DIAG | Refinamento técnico. 7 camadas de causa identificadas. Nenhum runtime alterado. |
| **PR35** | PR-DOCS | Mode Policy criada (`schema/policies/MODE_POLICY.md`). `read_only` definido como gate de execução. 3 modos canônicos definidos. |
| **PR36** | PR-IMPL | Correção inicial do chat runtime. `read_only` virou nota factual. Helper `isOperationalMessage` introduzido. Sanitizers menos destrutivos. 26/26 testes ✅. |
| **PR37** | PR-PROVA | Prova anti-bot real. 51/56 — 5 achados reais: `MODO OPERACIONAL ATIVO` ainda injetado com `hasActiveTarget=true`; falsos positivos em `"sistema"` e `"contrato"`; falso negativo para forma imperativa e termos técnicos. |
| **PR38** | PR-IMPL | Correção cirúrgica dos 5 achados. `buildChatSystemPrompt` separado: target informativo vs. bloco operacional pesado. `isOperationalMessage` refinado: termos compostos, verbos imperativos, termos técnicos. **56/56 ✅**. |

---

## 4. Correções Aplicadas (Estado Final após PR38)

### 4.1 `schema/enavia-cognitive-runtime.js` — seção `buildChatSystemPrompt`

Separação entre dois blocos independentes:
- **Target informativo** (exibido quando `hasActiveTarget=true`): mostra o alvo e a nota factual sobre `read_only` como gate de execução.
- **Bloco comportamental operacional** (exibido apenas quando `is_operational_context=true`): injeta `MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO` apenas quando há intenção operacional real.

### 4.2 `nv-enavia.js` — `_CHAT_OPERATIONAL_INTENT_TERMS`

Refinamento dos termos de detecção de intenção operacional:
- **Removidos** (causavam falsos positivos): `"sistema"`, `"contrato"` como termos isolados
- **Adicionados** (termos compostos): `"estado do contrato"`, `"contrato ativo"`
- **Adicionados** (verbos imperativos): `"revise"`, `"verifique"`, `"cheque"`, `"inspecione"`
- **Adicionados** (termos técnicos): `"runtime"`, `"gate"`, `"gates"`

---

## 5. Estado Atual

- ✅ PR38 mergeada
- ✅ `read_only` é gate de execução — não regra de tom
- ✅ Bloco operacional pesado ativado apenas com `is_operational_context=true`
- ✅ `isOperationalMessage` usa termos compostos e não palavras isoladas
- ✅ Sanitizers preservam prosa natural útil
- ✅ Testes anti-bot: **56/56 passando**
- ✅ Regressões verdes: PR36 (26/26), PR21 (53/53), PR20 (27/27), PR19 (52/52), PR14 (183/183), PR13 (91/91)

**Atenção:** O incidente foi resolvido para o estado atual do sistema. A causa estrutural
mais profunda (ausência de LLM Core, Intent Engine e Brain) ainda não foi endereçada.
As correções da PR36-PR38 são cirúrgicas e não dependem dos componentes futuros.

---

## 6. Como Evitar Regressão

1. **Nunca** traduzir `read_only=true` como instrução de tom ou comportamento.
2. `read_only` é verificado antes de executar ação — não antes de responder.
3. Bloco `MODO OPERACIONAL ATIVO` só deve ser injetado com `is_operational_context=true`.
4. Adicionar termos à lista `_CHAT_OPERATIONAL_INTENT_TERMS` apenas como **termos compostos** ou **verbos específicos** — nunca palavras isoladas genéricas.
5. Sanitizers só devem bloquear snapshots JSON do planner — nunca prosa natural.
6. Ao alterar `buildChatSystemPrompt` ou `isOperationalMessage`, rodar os testes:
   - `node tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` (meta: 56/56)
   - `node tests/pr36-chat-runtime-anti-bot.smoke.test.js` (meta: 26/26)

---

## 7. Backlinks

- → `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`
- → `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`
- → `schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md`
- → `schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md`
- → `schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md`
- → `schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md`
- → `schema/policies/MODE_POLICY.md`
- → `brain/decisions/INDEX.md`
- → `brain/learnings/INDEX.md`
- → `brain/self-model/INDEX.md`
