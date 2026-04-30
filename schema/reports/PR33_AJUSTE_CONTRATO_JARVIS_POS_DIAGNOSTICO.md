# PR33 — Ajuste do Contrato Jarvis Brain após Diagnóstico PR32

**Data:** 2026-04-30
**Tipo:** PR-DOCS
**Branch:** `copilot/claudepr33-docs-ajuste-contrato-jarvis-pos-diagnos`
**Contrato ativo:** `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior:** PR32 — PR-DIAG — Diagnóstico do chat engessado (mergeada ✅)

---

## 1. Problema encontrado

A PR32 diagnosticou que a Enavia responde como bot de checklist por 5 causas compostas:

1. O painel envia `target.mode = "read_only"` por default para toda mensagem (`panel/src/chat/useTargetState.js:35-49`, `ALLOWED_MODES = ["read_only"]`).
2. O runtime interpreta `read_only` como **regra de tom** (ativa "MODO OPERACIONAL ATIVO") em vez de bloqueio de execução (`nv-enavia.js:4097-4099`, `schema/enavia-cognitive-runtime.js:239-241`).
3. Não existe LLM Core / Intent Engine / Skill Router / Brain — apenas prompt monolítico de governança (`schema/enavia-cognitive-runtime.js:93-329`).
4. Sanitizadores pós-LLM substituem respostas vivas por frases robóticas fixas (`nv-enavia.js:3530-3583, 4177, 4397-4401`).
5. Envelope JSON `{reply, use_planner}` força respostas curtas estruturadas (`schema/enavia-cognitive-runtime.js:319-326`).

---

## 2. Por que seguir direto para o Obsidian Brain seria arriscado

O contrato original previa Obsidian Brain na PR33 (estrutura `schema/brain/`). Porém, sem corrigir os fatores estruturais listados acima:

- O Brain seria construído sobre uma base que interpreta `read_only` como restrição de personalidade — o que contamina a identidade do self-model.
- O self-model seria criado sem saber que é a interpretação errada de `read_only` (e não ausência de Brain) que causa o comportamento robótico.
- Os sanitizadores continuariam destruindo respostas vivas mesmo após o LLM Core estar funcionando.
- O Intent Engine (PR46) seria implementado sem política de modos (quais tons aplicar em quais contextos) já especificada.
- O LLM Core (PR44) seria implementado sem uma Response Policy documental como referência.

Em resumo: construir Brain sobre uma causa raiz não resolvida conceitualmente gera retrabalho e risco de drift entre docs e runtime.

---

## 3. Mudanças feitas no contrato

### 3.1 Nova Frente 2 — Correção conceitual do Chat Runtime

Inserida entre Frente 1 (diagnóstico) e a antiga Frente 2 (Obsidian Brain):

| PR | Tipo | Objetivo |
|----|------|----------|
| PR33 | PR-DOCS | Ajuste do contrato após diagnóstico PR32 (esta PR) |
| PR34 | PR-DIAG | Diagnóstico específico de read_only, target default e sanitizers |
| PR35 | PR-DOCS | Política correta de modos: conversa vs diagnóstico vs execução |
| PR36 | PR-DOCS | Especificação da Response Policy viva e anti-bot |

### 3.2 Renumeração das frentes seguintes

- Antiga Frente 2 (Obsidian Brain) → **Frente 3** (PR37-PR39)
- Antigas Frentes 3–12 → **Frentes 4–13** (PRs 40–64)
- Contrato ampliado de PR31–PR60 para **PR31–PR64**

### 3.3 Regras R1-R4 adicionadas à seção 4 do contrato

**R1 — read_only é bloqueio de execução, não regra de tom:**
> O parâmetro `read_only` significa apenas que a Enavia não pode executar ações com efeito colateral. A Enavia continua livre para conversar, raciocinar, explicar, diagnosticar e planejar mesmo em read_only.

**R2 — Sanitizadores pós-LLM não destroem resposta viva legítima:**
> Sanitizadores existem para bloquear vazamento de JSON interno e output de debug. Não devem substituir resposta estratégica legítima por fallback robótico.

**R3 — Target operacional não transforma toda conversa em modo operacional:**
> O Intent Engine decide o tom ANTES de qualquer tom operacional ser aplicado. Mensagens de conversa são tratadas como conversa.

**R4 — O Brain nasce ciente do incidente chat-engessado-readonly:**
> O incidente `chat-engessado-readonly` deve ser registrado em `schema/brain/incidents/` para que PR44 e PR53 possam recuperar a evidência.

### 3.4 Notas derivadas do diagnóstico PR32 adicionadas em PRs relevantes

- PR37 (Obsidian Brain): MEMORY_RULES deve diferenciar regra operacional ↔ personalidade; incidents/chat-engessado-readonly.md deve ser criado; self-model/how-to-answer.md deve registrar Regra R1.
- PR38 (Self Model): how-to-answer.md deve ensinar resposta como IA estratégica; R1 explicitamente documentada.
- PR39 (Migração): incidente PR32 incluído nas fontes.
- PR44 (LLM Core): Regras R1-R3 obrigatórias na implementação.
- PR46 (Intent Engine): tom operacional limitado a `deploy_decision` e `execution_request`.

---

## 4. Nova próxima PR autorizada

**PR34 — PR-DIAG — Diagnóstico específico de read_only, target default e sanitizers**

Entrega: `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`

O que investigar:
- `useTargetState.js:35-49` — painel força `read_only` por default
- `nv-enavia.js:4097-4099` — `read_only` vira instrução de tom
- `schema/enavia-cognitive-runtime.js:239-241` — instrução de tom derivada de `read_only`
- `nv-enavia.js:3530-3583` — `_sanitizeChatReply`
- `nv-enavia.js:4177, 4397-4401` — outros sanitizadores
- `schema/enavia-cognitive-runtime.js:319-326` — envelope JSON

---

## 5. Critérios de aceite desta PR33

| Critério | Status |
|----------|--------|
| Contrato atualizado com descobertas da PR32 | ✅ |
| Nova Frente 2 corretiva inserida (PR33-PR36) | ✅ |
| read_only definido como bloqueio de execução (R1) | ✅ |
| Sanitizers pós-LLM registrados como risco (R2) | ✅ |
| Target operacional registrado como risco (R3) | ✅ |
| Brain ciente do incidente PR32 (R4) | ✅ |
| Obsidian Brain deslocado para PR37+ | ✅ |
| INDEX aponta PR34 como próxima PR | ✅ |
| Status, handoff e execution log atualizados | ✅ |
| Nenhum runtime alterado | ✅ |
| Nenhum `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` alterado | ✅ |

---

*Relatório criado em: 2026-04-30*
*Branch: `copilot/claudepr33-docs-ajuste-contrato-jarvis-pos-diagnos`*
