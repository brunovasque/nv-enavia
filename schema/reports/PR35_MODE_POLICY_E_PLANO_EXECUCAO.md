# PR35 — Mode Policy e Plano de Execução Real

**Tipo:** PR-DOCS  
**Data:** 2026-04-30  
**Branch:** `copilot/claudepr35-docs-mode-policy-e-ajuste-para-execucao`  
**Contrato:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (Ativo 🟢)  
**PR anterior:** PR34 ✅ (PR-DIAG — diagnóstico de read_only, target e sanitizers)

---

## 1. Objetivo desta PR

Criar a política de modos da Enavia (`schema/policies/MODE_POLICY.md`) e ajustar o contrato para que a **próxima PR seja implementação real**, não mais documentação.

Esta PR existe para impedir que o contrato Jarvis Brain vire apenas documentação bonita sem produto.

O diagnóstico suficiente já existe:
- PR32 identificou a causa raiz do chat engessado.
- PR34 refinou a causa em 7 camadas técnicas com evidência de arquivo:linha.
- PR33 ajustou o contrato e registrou as Regras R1-R4.

Agora a PR35 fecha a política e força o contrato a virar produto na PR36.

---

## 2. O que foi feito

### 2.1 — `schema/policies/MODE_POLICY.md` (NOVO)

Documento de política em 9 seções:

1. **Objetivo** — separar intenção da mensagem, permissão de execução e tom da resposta.
2. **Regra central** — `read_only` é gate de execução, não regra de tom.
3. **Modos canônicos** — `conversation`, `diagnosis`, `execution` com comportamento esperado detalhado.
4. **Regra de target** — target default do painel não decide tom.
5. **Regra de tom** — Enavia responde primeiro como IA estratégica.
6. **Regra de planner** — planner é ferramenta, não personalidade.
7. **Regra de sanitizers** — sanitizers bloqueiam vazamento, não destroem resposta útil.
8. **Comportamento esperado** — 4 exemplos concretos (crítica de comportamento, capacidade, revisão de PR, deploy).
9. **Como essa política vira runtime** — roadmap da PR36 com 5 frentes de patch cirúrgico.

### 2.2 — Contrato ajustado (PR36 → PR-IMPL)

`CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` foi atualizado:

- **Antes:** PR36 = PR-DOCS (Especificação da Response Policy viva e anti-bot).
- **Depois:** PR36 = PR-IMPL (Correção inicial do chat runtime: read_only como gate, target sem tom forçado e sanitizers não destrutivos).

A seção da PR36 no contrato agora contém escopo técnico detalhado, arquivos esperados, critérios de aceite e smoke tests reais.

### 2.3 — Frente 2 atualizada no contrato

Tabela da Frente 2 (Correção conceitual do Chat Runtime) foi atualizada:

| PR | Tipo | Objetivo |
|----|------|----------|
| PR33 | PR-DOCS | Ajuste do contrato após diagnóstico PR32 ✅ |
| PR34 | PR-DIAG | Diagnóstico específico de read_only, target default e sanitizers ✅ |
| PR35 | PR-DOCS | Mode Policy: separar intenção, permissão de execução e tom ✅ (esta PR) |
| PR36 | **PR-IMPL** | **Correção inicial do chat runtime** ← próxima |

---

## 3. Diagnóstico que fundamenta a policy

### 3.1 — Por que `read_only` vira tom

No runtime atual, `read_only` é injetado em dois lugares como instrução textual de comportamento:

- `nv-enavia.js:4097-4099`: instrução explícita de tom ("não sugira", "foque exclusivamente em validação e leitura").
- `schema/enavia-cognitive-runtime.js:239-241`: instrução de tom derivada de `read_only`.

Resultado: a Enavia em `read_only` responde como se tivesse proibição de pensar livremente — quando na verdade só tem proibição de executar ações.

### 3.2 — Por que `target` default força tom operacional em toda conversa

No runtime atual:

1. `DEFAULT_TARGET.mode = "read_only"` no painel → toda mensagem tem `target`.
2. `buildContext()` sempre inclui `target` → `hasTarget = true`.
3. `hasTarget = true` → `isOperationalContext = true`.
4. `isOperationalContext = true` → ativa seção 5c do prompt + `_operationalContextBlock` de alta recência + `operationalDefaultsUsed`.

Resultado: toda conversa, mesmo "como você funciona?", ativa o bloco operacional do prompt.

### 3.3 — Por que sanitizers destroem respostas vivas

Cinco sanitizers/fallbacks atuam silenciosamente:

- **F1** `_sanitizeChatReply`: ≥3 termos de planner → substitui por `"Entendido. Estou com isso — pode continuar."`.
- **F2** `_isManualPlanReply` + `_MANUAL_PLAN_FALLBACK`: ≥2 padrões estruturais E `shouldActivatePlanner` → substitui por fallback fixo.
- **F3** plain-text fallback: reply não parseia como JSON → `"Instrução recebida."`.
- **F4** display fallback do painel: `"Instrução recebida. Processando."`.
- **F5** bridge bloqueada: não há bridge entre chat e executor na Frente 2.

Resultado: o LLM pode gerar boa resposta, mas ela é silenciosamente substituída antes de chegar ao operador.

---

## 4. Riscos reconhecidos

### 4.1 — Risco de excesso documental

**Reconhecido explicitamente nesta PR.**

O contrato Jarvis Brain começou com PR31 (DOCS) → PR32 (DIAG) → PR33 (DOCS) → PR34 (DIAG) → PR35 (DOCS). Cinco PRs sem alterar runtime. Esse padrão é necessário para diagnóstico correto, mas não pode se perpetuar indefinidamente.

**Decisão:** PR36 é implementação real. Não haverá mais PR-DOCS antes da execução nesta frente.

### 4.2 — Risco de regressão nos sanitizers

Reduzir sanitizers sem cuidado pode expor JSON interno ao operador. A PR36 deve manter os blocos de segurança (anti-JSON-leak) e apenas tornar os fallbacks menos destrutivos para respostas legítimas.

### 4.3 — Risco de acoplamento Worker/Panel

Se o desacoplamento de `isOperationalContext` exigir mudança tanto no Worker quanto no Panel, a PR36 deve avaliar separar em duas PRs menores para evitar mistura de escopo.

---

## 5. Próxima PR autorizada

**PR36 — PR-IMPL — Correção inicial do chat runtime**

**Escopo mínimo e cirúrgico:**

1. Remover instrução de tom associada a `read_only` nos prompts.
2. Adicionar gate determinístico de execução para `read_only`.
3. Desacoplar `isOperationalContext` de `hasTarget`.
4. Reduzir sanitizers destrutivos (F1, F2) sem remover proteção anti-JSON.
5. Adicionar log visível de fallback/sanitização.

**Prioridade:** Worker-only. Panel somente se inevitável, e aí avaliar PR separada.

**Não entra na PR36:**
- Intent Engine completo.
- LLM Core completo.
- Obsidian Brain.
- Novos endpoints.
- Testes E2E completos.

---

## 6. Critérios de aceite desta PR35

- [x] `schema/policies/MODE_POLICY.md` criado com 9 seções.
- [x] Política separa intenção, permissão de execução e tom.
- [x] `read_only` definido como gate de execução, não regra de tom.
- [x] Target default não decide tom.
- [x] Planner não substitui conversa.
- [x] Sanitizers não devem destruir resposta viva legítima.
- [x] Contrato ajustado: PR36 = PR-IMPL.
- [x] INDEX aponta PR36 como PR-IMPL.
- [x] Status, handoff e execution log atualizados.
- [x] Nenhum runtime alterado.
- [x] Nenhum `.js`/`.ts`/`.jsx`/`.tsx`/`.toml`/`.yml` alterado.
- [x] Nenhum endpoint criado.
- [x] Nenhum teste criado.

---

## 7. Verificações obrigatórias

```
git diff --name-only
# Resultado esperado: apenas arquivos .md em schema/
# Nenhum arquivo .js, .ts, .jsx, .tsx, .toml, .yml deve aparecer
```

**Confirmações:**
- `schema/policies/MODE_POLICY.md` existe ✅
- `MODE_POLICY.md` contém: "read_only é bloqueio de execução, escrita, deploy e mutação de estado." ✅
- `schema/contracts/INDEX.md` aponta PR36 ✅
- PR36 descrita como PR-IMPL ✅
- Governança atualizada ✅

---

## Referências

- `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`
- `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`
- `schema/reports/PR33_AJUSTE_CONTRATO_JARVIS_POS_DIAGNOSTICO.md`
- `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
- `schema/policies/MODE_POLICY.md`
