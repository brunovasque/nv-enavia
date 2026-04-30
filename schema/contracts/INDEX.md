# ENAVIA — Índice de Contratos

Registro centralizado de todos os contratos do repo `nv-enavia`.
Atualizar sempre que um contrato for criado, encerrado ou substituído.

---

## Contrato ativo

| Arquivo | PRs | Estado | Data de início |
|---------|-----|--------|----------------|
| `active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` | PR0, PR17–PR30 | **Ativo** 🟢 | 2026-04-29 |

---

## Contratos históricos (encerrados)

| Arquivo | PRs | Estado | Data de encerramento |
|---------|-----|--------|----------------------|
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

**PR19** — PR-PROVA — Smoke real ponta a ponta: `execute-next → complete-task → phase_complete → advance-phase → próxima task/fase`.

Contexto: PR17 (diagnóstico) e PR18 (implementação do endpoint) concluídas. PR19 valida o ciclo completo via smoke test integrado, sem alterar runtime.

### Histórico recente

- **PR17** ✅ (PR-DIAG, mergeada — PR #178, commit merge `38582b4`) — diagnóstico do gap `phase_complete → advance-phase`.
- **PR18** (PR-IMPL, em revisão) — endpoint `POST /contracts/advance-phase` criado em `nv-enavia.js`.
