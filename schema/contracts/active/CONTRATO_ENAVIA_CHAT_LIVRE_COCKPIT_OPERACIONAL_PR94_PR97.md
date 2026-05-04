# CONTRATO ENAVIA — CHAT LIVRE + COCKPIT OPERACIONAL PR94–PR97

**Data de criação:** 2026-05-04  
**Estado:** 🟢 Ativo  
**Contrato anterior encerrado:** `CONTRATO_ENAVIA_PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93.md` (encerrado em 2026-05-04)

---

## Objetivo macro

Soltar a conversa da Enavia sem perder segurança operacional, transformando o painel em cockpit passivo/inteligente.

A Enavia já comprovou dentro do próprio chat que:
- consegue corrigir tom comportamental dentro da conversa;
- mas não consegue corrigir causa raiz se o sistema/painel/runtime obriga JSON, checklist, read-only, headings ou formato mecânico;
- o painel ajuda na segurança, mas pode engessar a conversa se controlar o tom da IA;
- o ideal é conversa livre por padrão e governança pesada só quando houver intenção operacional real.

---

## Regra central

- **Conversa livre por padrão.**
- **Governança pesada só quando houver intenção operacional real.**
- Painel observa/sugere/exibe estado — não prende o tom da IA.
- Execução real continua exigindo aprovação humana.
- Merge/PROD/secrets continuam bloqueados.

---

## Divisão de PRs

### PR94 — Diagnóstico READ-ONLY do Chat Livre + Cockpit

**Tipo:** PR-DIAG  
**Estado:** ✅ DONE — 2026-05-04  

**Objetivo:**  
Mapear onde o painel/chat força JSON, checklist, read-only, headings, passos, tom de relatório ou governança em conversa comum.

**Entregáveis:**
- `schema/contracts/active/CONTRATO_ENAVIA_CHAT_LIVRE_COCKPIT_OPERACIONAL_PR94_PR97.md` (este arquivo)
- `schema/contracts/ACTIVE_CONTRACT.md` (atualizado)
- `schema/contracts/INDEX.md` (atualizado)
- `schema/reports/PR94_CHAT_LIVRE_COCKPIT_DIAGNOSTICO.md`
- `tests/pr94-chat-livre-cockpit-diagnostico.prova.test.js`
- Governança mínima (status, handoff, execution log)

**Proibido na PR94:**
- Não alterar comportamento do chat
- Não alterar prompt/system message
- Não alterar response policy
- Não alterar painel
- Não alterar nv-enavia.js
- Não alterar executor/src/index.js
- Não alterar contract-executor.js
- Não alterar deploy.yml
- Não alterar wrangler.toml
- Não criar endpoint novo

---

### PR95 — Chat Livre Seguro

**Tipo:** PR-IMPL  
**Estado:** ✅ DONE — 2026-05-04  

**Objetivo:**  
Ajustar Response Policy / LLM Core / Brain Loader, se necessário, para conversa natural por padrão, mantendo bloqueios de ação real.

**Princípios:**
- Ajuste mínimo — máximo 5 mudanças.
- Preservar guardrails de segurança.
- Preservar gates de execução.
- Foco: chat livre seguro, sem alterar painel ainda.

**Requer:**
- PR94 concluída com diagnóstico que justifique qual camada ajustar (A, B, C ou D conforme PR94).
- PR-PROVA não obrigatória antes de PR95, mas obrigatória antes do fechamento da frente (PR97).

---

### PR96 — Cockpit Passivo

**Tipo:** PR-IMPL  
**Estado:** 🟢 AUTORIZADA — próxima PR  

**Objetivo:**  
Ajustar painel para exibir intenção, modo sugerido, risco, próxima ação e approval gates sem controlar o tom da conversa.

**Princípios:**
- Painel como cockpit passivo/inteligente.
- Exibe estado sem impor comportamento ao LLM.
- Máximo 5 mudanças.
- Foco: cockpit passivo, sem alterar tom da IA.

**Requer:**
- PR95 concluída.

---

### PR97 — Prova Final

**Tipo:** PR-PROVA  
**Estado:** ⏳ Aguardando PR95 + PR96  

**Objetivo:**  
Testar conversa casual, diagnóstico, pedido operacional, PR Orchestrator e bloqueios de segurança.

**Cenários de prova:**
1. Conversa casual (oi, como vai, pergunta simples) → resposta direta, sem tom operacional
2. Diagnóstico técnico → resposta objetiva
3. Pedido operacional (deploy, merge, patch) → approval gate ativo
4. PR Orchestrator (PR90–PR93) → preservado e funcional
5. Bloqueios de segurança → PROD/merge/secrets bloqueados

**Requer:**
- PR95 + PR96 concluídas.

---

## O que deve ser preservado ao longo de todo o contrato

- PR Orchestrator PR90–PR93 (schema/enavia-pr-planner.js, schema/enavia-pr-executor-supervised.js, schema/enavia-pr-readiness.js)
- Deploy loop PR86–PR89 (schema/enavia-deploy-loop.js)
- Skill Factory/Runner (schema/enavia-skill-factory.js, schema/enavia-skill-runner.js)
- SELF_WORKER_AUDITOR (schema/enavia-self-worker-auditor-skill.js)
- Gates humanos (approval gates, awaiting_human_approval)
- Bloqueios de PROD/merge/secrets

---

## Regras de bloqueio do contrato

1. Não avançar de PR94 para PR95 sem diagnóstico real documentado.
2. Não alterar runtime na PR94 — esta é a única PR puramente read-only.
3. PR95 e PR96 devem ser cirúrgicas — máximo 5 mudanças cada.
4. PR97 deve provar: conversa livre funciona + segurança operacional preservada.
5. Qualquer breaking change nos guardrails de segurança bloqueia o avanço.

---

## Próxima PR autorizada

**PR96** — Cockpit Passivo (PR-IMPL). PR95 concluída ✅.

---

## Histórico de execução

| PR | Tipo | Estado | Data | Observação |
|----|------|--------|------|------------|
| PR94 | PR-DIAG | ✅ DONE | 2026-05-04 | Diagnóstico read-only do chat livre + cockpit |
| PR95 | PR-IMPL | ✅ DONE | 2026-05-04 | Chat livre seguro — 4 mudanças cirúrgicas |
| PR96 | PR-IMPL | 🟢 AUTORIZADA | — | Cockpit passivo |
| PR97 | PR-PROVA | ⏳ PENDING | — | Prova final |
