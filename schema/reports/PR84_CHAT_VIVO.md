# PR84 — Chat Vivo — Relatório de Implementação

**Data:** 2026-05-03
**Tipo:** PR-IMPL
**Contrato:** CONTRATO_ENAVIA_AUTOEVOLUCAO_OPERACIONAL_PR82_PR85.md
**PR anterior:** PR83 ✅ (Corrigir loop de deploy)

---

## Objetivo

Reduzir o engessamento da IA no chat da Enavia — respostas mais vivas, curtas e operacionais — sem remover guardrails, sem falsa capacidade e sem quebrar segurança.

---

## Diagnóstico (base para esta PR)

**5 pontos de engessamento identificados:**

| ID | Arquivo | Problema |
|----|---------|---------|
| C1 | `schema/enavia-llm-core.js:90` | "FALSA CAPACIDADE BLOQUEADA" citava `/skills/run` e `Skill Router` como inexistentes — desatualizado desde PR51/PR80. LLM repete linguagem de bloqueio robótica. |
| C2 | `schema/enavia-brain-loader.js` — bloco `current-state.md` | Contrato antigo (`PR31_PR60`) ainda citado. Coisas implementadas listadas como "ainda NÃO existe em runtime". |
| C3 | `schema/enavia-capabilities.js` | Lista `can[]` era da PR1 — 5 itens básicos sem mencionar intent classifier, skill routing, self-audit, /skills/run. |
| C4 | `schema/enavia-llm-core.js` — COMPORTAMENTO OPERACIONAL | Sem instrução explícita de como bloquear de forma humana. LLM não tinha proibição clara de "Modo read-only ativo" / "Conforme o contrato ativo". |
| C5 | Ausência de instruções de tom no bloqueio | LLM Core não tinha seção dedicada a TOM AO BLOQUEAR — LLM tinha "liberdade" de usar linguagem robótica de auditoria. |

---

## Correções aplicadas (patch cirúrgico)

### 1. `schema/enavia-llm-core.js`

- **Atualizado** `FALSA CAPACIDADE BLOQUEADA`: removidos `/skills/run` e `Skill Router runtime ainda NÃO existe` (estavam errados). Adicionada lista do que JÁ EXISTE (`/skills/run`, `Skill Router v1`, `Self-Audit`, `SELF_WORKER_AUDITOR`, `deploy loop`, `Intent Classifier v1`, `Response Policy`).
- **Adicionado** bloco `TOM AO BLOQUEAR` — instrução explícita de como bloquear de forma humana:
  - Proibição de "Modo read-only ativo" e "Conforme o contrato ativo" como frase padrão.
  - Exemplo de bloqueio humano: "Posso analisar agora. Para executar uma mudança real, preciso de aprovação e escopo definido."
  - Instrução: conversa casual sem tom operacional pesado.
  - Instrução: pergunta técnica/estratégica → resposta útil, sem despejar regras.

### 2. `schema/enavia-brain-loader.js`

- **Atualizado** bloco `current-state.md`:
  - Contrato ativo agora é `CONTRATO_ENAVIA_AUTOEVOLUCAO_OPERACIONAL_PR82_PR85.md`.
  - Estado reflete PR82 ✅ e PR83 ✅.
  - "O que existe em runtime" lista corretamente: /skills/run, Skill Router v1, Self-Audit, SELF_WORKER_AUDITOR, deploy loop, Brain Loader.
  - "O que ainda NÃO existe" lista somente o verdadeiro: Intent Engine completo, escrita automática de memória, deploy autônomo.

### 3. `schema/enavia-capabilities.js`

- **Atualizada** lista `can[]` de 5 para 10 itens refletindo PR49–PR82:
  - Classificação de intenção (Intent Classifier v1).
  - Roteamento para skill documental (Skill Router v1, read-only).
  - Execução de skills aprovadas via /skills/run com gate de aprovação.
  - Auditoria com SELF_WORKER_AUDITOR (read-only).
  - Response Policy e Self-Audit como capacidades ativas.
- **Atualizada** lista `cannot_yet[]`:
  - Removido "Skill Router" e "/skills/run" (existem agora).
  - Mantidos os limites reais: Intent Engine completo, escrita automática de memória, deploy autônomo.

---

## Arquivos alterados

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `schema/enavia-llm-core.js` | Patch | FALSA CAPACIDADE BLOQUEADA atualizada + TOM AO BLOQUEAR adicionado |
| `schema/enavia-brain-loader.js` | Patch | current-state.md snapshot atualizado (contrato + estado PR82/PR83) |
| `schema/enavia-capabilities.js` | Patch | Lista can[] e cannot_yet[] atualizadas para PR82 estado atual |
| `tests/pr84-chat-vivo.smoke.test.js` | Criado | 52 cenários de prova |
| `schema/reports/PR84_CHAT_VIVO.md` | Criado | Este relatório |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Atualizado | Status PR84 |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Atualizado | Handoff para PR85 |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Atualizado | Log de execução |
| `schema/contracts/INDEX.md` | Atualizado | PR84 ✅, próxima PR → PR85 |

---

## Arquivos NÃO alterados

- `.github/workflows/deploy.yml` — não tocado (PR83 o corrigiu, não reabrir).
- `nv-enavia.js` — sem alteração de handlers, chat flow, sanitizers.
- `schema/enavia-cognitive-runtime.js` — sem alteração.
- `schema/enavia-response-policy.js` — sem alteração.
- `schema/enavia-self-audit.js` — sem alteração.
- `schema/enavia-skill-router.js` — sem alteração.
- `schema/enavia-intent-classifier.js` — sem alteração.
- `wrangler.toml`, `contract-executor.js`, painel, executor, deploy-worker — não tocados.

---

## Proibições respeitadas

| Proibição | Status |
|-----------|--------|
| Não mexer no deploy loop | ✅ Respeitada |
| Não mexer em .github/workflows/deploy.yml | ✅ Respeitada |
| Não mexer em wrangler.toml | ✅ Respeitada |
| Não mexer em contract-executor.js | ✅ Respeitada |
| Não mexer em painel/executor/deploy-worker | ✅ Respeitada |
| Não criar rota nova | ✅ Respeitada |
| Não remover Self-Audit / Response Policy / LLM Core | ✅ Respeitada |
| Não remover Brain Loader / Intent Classifier / Skill Router | ✅ Respeitada |
| Não transformar resposta em JSON para usuário | ✅ Respeitada |
| Não criar nova arquitetura de chat | ✅ Respeitada — patch cirúrgico em 3 módulos |

---

## Testes

```
node tests/pr84-chat-vivo.smoke.test.js
✅ 52/52 passed
```

### Regressões obrigatórias

| Teste | Resultado |
|-------|-----------|
| pr83-deploy-loop.smoke.test.js | ✅ 57/57 |
| pr82-self-worker-auditor.smoke.test.js | ✅ 54/54 |
| pr81-skill-factory-real.fechamento.test.js | ✅ 55/55 |
| pr80-skill-registry-runner.smoke.test.js | ✅ 40/40 |
| pr79-skill-factory-core.smoke.test.js | ✅ 42/42 |
| pr59-response-policy-viva.smoke.test.js | ✅ 96/96 |

---

## Rollback

Para desfazer as alterações desta PR:

1. Reverter `schema/enavia-llm-core.js` para estado anterior ao PR84 (remover bloco TOM AO BLOQUEAR, restaurar linha FALSA CAPACIDADE BLOQUEADA original).
2. Reverter `schema/enavia-brain-loader.js` — bloco current-state.md para snapshot anterior.
3. Reverter `schema/enavia-capabilities.js` — listas can[] e cannot_yet[] para versão PR1.
4. Excluir `tests/pr84-chat-vivo.smoke.test.js`.

Rodar após rollback: `node tests/pr82-self-worker-auditor.smoke.test.js` e `node tests/pr59-response-policy-viva.smoke.test.js`.

---

## O que foi corrigido

1. LLM não mais receberá instrução falsa de que /skills/run e Skill Router não existem.
2. LLM tem instrução explícita de como bloquear de forma humana — sem linguagem robótica.
3. Brain Loader não mais injeta contrato antigo (PR31_PR60) no contexto.
4. Capacidades refletem a realidade pós-PR82 — LLM pode se posicionar corretamente.
5. Instrução "conversa casual sem tom operacional pesado" adicionada ao LLM Core.

---

## O que ainda falta (pendências futuras)

| ID | Descrição | PR sugerida |
|----|-----------|-------------|
| P1 | Intent Engine completo — routing multi-step autônomo | PR futura |
| P2 | Memória automática entre sessões | PR futura |
| P3 | Telemetria estruturada por request (achado T1 do SELF_WORKER_AUDITOR) | PR futura |
| P4 | Rate limiting aplicacional (achado S1 do SELF_WORKER_AUDITOR) | PR futura |
| P5 | Audit trail persistido de aprovações (achado T2 do SELF_WORKER_AUDITOR) | PR futura |
| P6 | Reduzir prompt total — ainda há seções internas expostas ao LLM que poderiam ser removidas ou comprimidas para conversas casuais | PR futura |

---

## Próxima PR autorizada

**PR85 — Fechamento operacional ponta a ponta** — PR-PROVA que prova as 3 frentes juntas.
