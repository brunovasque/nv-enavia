# Self-Model: Estado Atual da Enavia

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR40
**Última atualização:** pós-PR40 — Self Model documental criado

---

## Contrato ativo

| Campo | Valor |
|-------|-------|
| **Arquivo** | `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` |
| **Estado** | Ativo 🟢 |
| **Escopo** | PR31–PR64 (ampliado de PR31-PR60 pela PR33) |
| **Objetivo** | Transformar a Enavia em IA operacional viva — LLM Core, Memory Brain, Skill Router, Intent Engine, Self-Audit |

---

## Histórico recente (frentes encerradas)

### Frente 2 — Correção anti-bot (PR32–PR38) ✅ Concluída

| PR | Tipo | Resultado |
|----|------|-----------|
| PR32 | PR-DIAG | Causa raiz identificada: target default + read_only como tom + ausência de LLM Core/Brain/sanitizers pós-LLM |
| PR33 | PR-DOCS | Contrato ajustado. Frente 2 corretiva inserida. Contrato ampliado para PR31–PR64 |
| PR34 | PR-DIAG | Diagnóstico técnico refinado em 7 camadas: read_only, target, sanitizers |
| PR35 | PR-DOCS | Mode Policy criada. 3 modos: conversation/diagnosis/execution |
| PR36 | PR-IMPL | Correção inicial: read_only virou gate, isOperationalMessage criado, sanitizers refinados. 26/26 ✅ |
| PR37 | PR-PROVA | 51/56 — 5 achados identificados (A2/B2/C1/D1/G5) |
| PR38 | PR-IMPL | Correção dos 5 achados. PR37 passou 56/56 ✅ |

### Frente 3 — Obsidian Brain (PR39–...) Em andamento

| PR | Tipo | Resultado |
|----|------|-----------|
| PR39 | PR-DOCS | Estrutura documental do brain criada: 7 arquivos principais + 8 pastas + incidente documentado |
| PR40 | PR-DOCS | Self-model documental criado (esta PR) |

---

## Estado atual do sistema (pós-PR40)

### O que existe em runtime

- Worker `nv-enavia.js` com chat funcional, sem comportamento bot (PR36/PR38 aplicadas).
- Sanitizers preservam prosa natural útil.
- `isOperationalMessage` detecta intenção operacional por termos compostos (sem falso positivo de "sistema" ou "contrato" isolados).
- `MODO OPERACIONAL ATIVO` só injetado quando `is_operational_context=true`.
- Todos os testes passando: 56/56 (PR37), 26/26 (PR36), 53/53 (PR21), 52/52 (PR19), 27/27 (PR20), 183/183 (PR14), 91/91 (PR13).

### O que existe como documento (não runtime)

- `schema/brain/` — Obsidian Brain completo como estrutura documental.
- `schema/brain/self-model/` — Self-model documental (esta PR).
- `schema/policies/MODE_POLICY.md` — Mode Policy com 3 modos.
- `schema/skills/INDEX.md` — 4 skills documentais oficiais.
- `schema/system/ENAVIA_SYSTEM_MAP.md` — mapa da arquitetura.
- `schema/system/ENAVIA_ROUTE_REGISTRY.json` — 68 rotas.
- `schema/system/ENAVIA_WORKER_REGISTRY.md` — inventário de workers.

### O que ainda não existe

- Brain Loader (não implementado).
- Brain conectado ao runtime (não implementado).
- LLM Core vivo (não implementado).
- Intent Engine completo (não implementado — existe só o helper básico `isOperationalMessage`).
- Skill Router em runtime (não implementado).
- `/skills/run` endpoint (não implementado).
- Memória automática supervisionada (não implementada).
- Self-audit em runtime (não implementado).

---

## O que a Enavia pode dizer hoje sobre si mesma

> "Eu já tenho uma base documental de cérebro e identidade em construção, mas ainda não tenho o Brain conectado ao runtime. Posso usar esses documentos como referência por contrato/agente, mas ainda não consumo automaticamente essa memória no chat."

Essa resposta é honesta e completa. A Enavia não deve inflar nem minimizar seu estado.

---

## Próximas frentes do contrato Jarvis Brain

| Frente | Objetivo | Status |
|--------|----------|--------|
| Migrar conhecimento consolidado para Brain | PR41 — PR-DOCS | Próxima autorizada |
| Diagnosticar memória runtime | PR-DIAG futura | Planejada |
| Brain Loader | PR-IMPL futura | Planejada |
| LLM Core | PR-IMPL futura | Planejada |
| Intent Engine | PR-IMPL futura | Planejada |
| Skill Router | PR-IMPL futura | Planejada |

---

## Nota sobre este arquivo

Este arquivo deve ser atualizado a cada PR mergeada que altera o estado real do sistema.
Atualizar exige PR ou é parte obrigatória da governança de cada PR.
