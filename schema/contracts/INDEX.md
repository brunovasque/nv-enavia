# ENAVIA — Índice de Contratos

Registro centralizado de todos os contratos do repo `nv-enavia`.
Atualizar sempre que um contrato for criado, encerrado ou substituído.

---

## Contrato ativo

| Campo | Valor |
|-------|-------|
| **Arquivo** | `active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` |
| **Estado** | Ativo 🟢 |
| **PRs** | PR31–PR64 (ampliado de PR31-PR60 pela PR33) |
| **Data de início** | 2026-04-30 |
| **Objetivo** | Transformar a Enavia em IA operacional viva — LLM Core, Memory Brain, Skill Router, Intent Engine, Self-Audit |

---

## Contratos encerrados

| Arquivo | PRs | Estado | Data de encerramento |
|---------|-----|--------|----------------------|
| `active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` | PR0, PR17–PR30 | Encerrado ✅ | 2026-04-30 |
| `active/CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` | PR8–PR16 (+ fixes) | Encerrado ✅ | 2026-04-29 |
| `active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` | PR1–PR7 | Encerrado ✅ | 2026-04-27 |

> **Nota:** PR14–PR16 foram fixes operacionais executados após o encerramento formal do
> contrato PR8–PR13, dentro do mesmo escopo Worker-only. São considerados parte do
> ciclo operacional anterior.

---

## Regra de uso

1. Sempre consultar este índice no início de cada sessão.
2. O contrato ativo é aquele marcado como **Ativo** 🟢.
3. Contratos históricos não devem ser editados — apenas lidos como referência.
4. Ao encerrar um contrato, mover seu estado para "Encerrado ✅" e registrar a data.
5. Ao criar um novo contrato, adicionar na seção "Contrato ativo" e mover o anterior para histórico.

---

## Próxima PR autorizada

**PR43 — PR-IMPL — Brain Loader read-only Worker-only**

Contrato ativo: `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`

> ✅ PR42 diagnosticou a memória runtime. `ENAVIA_BRAIN` existe com IDs reais. Brain documental não está conectado. Brain Loader via bundle estático é viável.
> PR43 irá implementar Brain Loader com allowlist de 6 arquivos (self-model + SYSTEM_AWARENESS), bundled estático, injetado em `buildChatSystemPrompt`, read-only, sem endpoint, sem painel.

> **Nota sobre PR41**: PR41 (Migrar conhecimento para Brain) foi declarada mergeada pelo operador no problem statement da PR42, mas não foi encontrado relatório PR41 no repo. Ver `schema/reports/PR42_MEMORY_RUNTIME_DIAGNOSTICO.md` Seção 12.1.

### PRs do contrato Jarvis Brain já concluídas

- **PR31** ✅ (PR-DOCS) — Ativação do contrato Jarvis Brain v1. Governança religada. Nenhum runtime alterado.
- **PR32** ✅ (PR-DIAG) — Diagnóstico do chat engessado. Causa raiz identificada (target default + read_only como tom + ausência de LLM Core/Intent/Skill Router/Brain + sanitizers pós-LLM + envelope JSON). Relatório: `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`. Nenhum runtime alterado.
- **PR33** ✅ (PR-DOCS) — Ajuste do contrato após diagnóstico PR32. Nova Frente 2 corretiva inserida (PR33-PR36). Regras R1-R4 adicionadas. Obsidian Brain deslocado para PR37+. Contrato ampliado para PR31-PR64. Nenhum runtime alterado.
- **PR34** ✅ (PR-DIAG) — Diagnóstico profundo de `read_only`, `target` default e sanitizers/fallbacks. Causa técnica refinada em 7 camadas. Recomendações conceituais para PR35 (Mode Policy) e PR36 (Response Policy). Relatório: `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`. Nenhum runtime alterado.
- **PR35** ✅ (PR-DOCS) — Mode Policy criada. 3 modos canônicos definidos (conversation/diagnosis/execution). `read_only` definido como gate de execução, não regra de tom. Contrato ajustado para PR36 ser PR-IMPL real. Risco de excesso documental reconhecido — objetivo agora é produto funcionando. Relatório: `schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md`. Nenhum runtime alterado.
- **PR36** ✅ (PR-IMPL) — Correção inicial do chat runtime. Worker-only, patch cirúrgico. `read_only` virou nota factual de gate de execução (não tom). Helper `isOperationalMessage` introduzido — `target` default sozinho NÃO ativa mais contexto operacional. Sanitizers menos destrutivos: prosa natural útil é preservada, snapshot JSON-like do planner continua bloqueado. Telemetria `sanitization: {applied, layer, reason}` adicionada (campo aditivo na resposta `/chat/run`). Smoke test novo `tests/pr36-chat-runtime-anti-bot.smoke.test.js` (26/26 ✅). Regressões PR13/PR14/PR19/PR20/PR21 todas verdes. Nenhum painel/contrato/endpoint/policy/brain alterado ou criado. Relatório: `schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md`.
- **PR37** ✅ (PR-PROVA) — Prova anti-bot real do chat runtime. 51/56 passaram (5 achados reais). Cenários E (sanitizer preserva prosa útil) e F (bloqueio de vazamento interno) passaram completamente. Achados: (A2/B2) system prompt ainda injeta "MODO OPERACIONAL ATIVO" quando `hasActiveTarget=true` no cognitive runtime; (C1/G5) falsos positivos em `isOperationalMessage` com "sistema" e "contrato"; (D1) falso negativo para forma imperativa "Revise". Nenhum runtime alterado. Relatório: `schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md`.
- **PR38** ✅ (PR-IMPL) — Correção cirúrgica dos 5 achados da PR37. Worker-only, patch cirúrgico. `buildChatSystemPrompt` corrigido: target informativo separado do bloco comportamental operacional pesado — `MODO OPERACIONAL ATIVO` só injetado quando `is_operational_context=true`. `_CHAT_OPERATIONAL_INTENT_TERMS` refinado: `"sistema"` e `"contrato"` isolados removidos (falsos positivos), termos compostos `"estado do contrato"`/`"contrato ativo"` adicionados, verbos imperativos (`"revise"`, `"verifique"`, `"cheque"`, `"inspecione"`) e termos técnicos (`"runtime"`, `"gate"`, `"gates"`) adicionados. PR37 agora passa 56/56 ✅. Regressões PR36/PR13/PR14/PR19/PR20/PR21 verdes. Relatório: `schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md`.
- **PR41** ✅ (PR-DOCS) — Migrar conhecimento consolidado para Brain. Declarado mergeado pelo operador (sem relatório encontrado no repo — ver PR42 Seção 12.1).
- **PR42** ✅ (PR-DIAG) — Diagnóstico da Memória Atual no Runtime. `ENAVIA_BRAIN` confirmado. KVs mapeados. Fluxo de chat diagnosticado. Painel mapeado. Brain Loader via bundle estático recomendado para PR43. Relatório: `schema/reports/PR42_MEMORY_RUNTIME_DIAGNOSTICO.md`. Nenhum runtime alterado.

### Histórico do contrato encerrado (PR17–PR30)

- **PR0** ✅ (PR-DOCS) — Loop obrigatório de execução por PR em `CLAUDE.md` + `schema/contracts/INDEX.md` criado.
- **PR17** ✅ (PR-DIAG) — Diagnóstico READ-ONLY de `phase_complete` e `advance-phase`.
- **PR18** ✅ (PR-IMPL) — `POST /contracts/advance-phase` criado em `nv-enavia.js`.
- **PR19** ✅ (PR-PROVA) — Smoke E2E completo: `execute-next → complete-task → advance-phase` (52/52 ✅).
- **PR20** ✅ (PR-IMPL) — `loop-status` expõe `complete-task` em `in_progress`.
- **PR21** ✅ (PR-PROVA) — Matriz de estados do `loop-status` (53/53 ✅).
- **PR22** ✅ (PR-DOCS, mergeada — PR #183, commit merge `fc7a4ec`) — `schema/system/ENAVIA_SYSTEM_MAP.md` criado (14 seções).
- **PR23** ✅ (PR-DOCS, mergeada — PR #184, commit merge `beb3dfa`) — `schema/system/ENAVIA_ROUTE_REGISTRY.json` criado (68 rotas, 0 violações).
- **PR24** ✅ (PR-DOCS, mergeada — PR #185, commit merge `b54e74c`) — `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` criado (18 seções + Apêndice A).
- **PR25** ✅ (PR-DOCS, mergeada — PR #186, commit merge `fb8e640`) — `schema/system/ENAVIA_WORKER_REGISTRY.md` criado (18 seções, inventário de infraestrutura).
- **PR26** ✅ (PR-DOCS, mergeada — PR #187, commit merge `2954fef`) — `schema/skills/CONTRACT_LOOP_OPERATOR.md` criado (20 seções, primeira skill oficial) + `schema/skills/INDEX.md`.
- **PR27** ✅ (PR-DOCS, mergeada — PR #188, commit merge `0f43c29`) — `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` criado (23 seções, segunda skill oficial) + `schema/skills/INDEX.md` atualizado.
- **PR28** ✅ (PR-DOCS, mergeada — PR #189, commit merge `daefe36`) — `schema/skills/SYSTEM_MAPPER.md` criado (23 seções, terceira skill oficial) + `schema/skills/INDEX.md` atualizado.
- **PR29** ✅ (PR-DOCS) — `schema/skills/CONTRACT_AUDITOR.md` criado (24 seções, quarta skill oficial supervisionada) + `schema/skills/INDEX.md` atualizado.
- **PR30** ✅ (PR-DOCS/PR-PROVA) — Fechamento, hardening e handoff final. Contrato encerrado.
