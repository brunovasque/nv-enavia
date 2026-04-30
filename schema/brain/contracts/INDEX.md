# brain/contracts — Índice

**Pasta:** `schema/brain/contracts/`
**Versão:** 1.0
**Data:** 2026-04-30

---

## Finalidade

Esta pasta contém resumos navegáveis dos contratos ativos, encerrados e candidatos
futuros. Não substitui os contratos originais em `schema/contracts/active/` —
é uma camada de navegação mais rápida para o brain.

---

## Tipo de arquivo que mora aqui

- Resumos de contratos ativos (foco em PR autorizada e escopo atual)
- Resumos de contratos encerrados (foco em legado e aprendizados)
- Candidatos a contrato (esboços de próximos ciclos)

---

## Quando consultar

- Ao verificar qual PR está autorizada sem abrir o contrato completo
- Ao entender o contexto de decisões vinculadas a um contrato específico
- Ao planejar o próximo contrato ou revisar o atual

---

## Quando criar novo arquivo

- Quando um novo contrato for ativado
- Quando um contrato for encerrado e um resumo for útil para navegação
- Quando um esboço de contrato futuro for criado para planejamento

---

## Fonte primária dos contratos

| Arquivo | Conteúdo |
|---------|----------|
| `schema/contracts/INDEX.md` | Índice centralizado de todos os contratos |
| `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` | Contrato ativo atual |
| `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` | Contrato encerrado |
| `schema/contracts/active/CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` | Contrato encerrado |
| `schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` | Contrato encerrado |

> Para a fonte de verdade, sempre consultar `schema/contracts/INDEX.md`.

---

## Exemplos de nomes de arquivos

```
jarvis-brain-pr31-pr64-resumo.md
loop-skills-pr17-pr30-legado.md
operacional-pr8-pr13-legado.md
```

---

## Contrato ativo (referência rápida)

| Campo | Valor |
|-------|-------|
| **Arquivo** | `active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` |
| **Estado** | Ativo 🟢 |
| **PRs** | PR31–PR64 (ampliado) |
| **Próxima PR** | PR40 — PR-DOCS — Self Model da Enavia |

---

## Limites

- Resumos não substituem o contrato original.
- Se houver conflito entre resumo e contrato original, o original prevalece.
- Não criar "candidatos a contrato" que impliquem escopo não aprovado pelo operador.

---

## Arquivos populados (PR41)

| Arquivo | Conteúdo | Quando consultar |
|---------|----------|------------------|
| `active.md` | Resumo do contrato ativo Jarvis Brain (PR31–PR64): objetivo macro, frase-síntese, estado atual pós-PR40, próximas PRs (PR41/PR42), regras centrais, frentes | Para verificar próxima PR autorizada; para entender escopo atual sem abrir o contrato completo |
| `closed.md` | Resumo dos 3 contratos encerrados (PR1–PR7, PR8–PR16, PR17–PR30) com entregas e lições aprendidas | Para entender legado; para evitar repetir erros |
| `next-candidates.md` | 7 candidatos a contrato futuro (Runtime de Skills, Skill Executor, UI de Skills, Auditoria automática de PR, Infra Health, Self-Audit, Memory Update Supervision) — todos marcados "opcional, não mexa agora" | Para responder "o que vem depois?"; para evitar escopo creep |

## Estado desta pasta na PR41

Pasta populada com 3 resumos navegáveis. Fonte de verdade continua em
`schema/contracts/INDEX.md` e nos contratos completos em
`schema/contracts/active/`. Em conflito, o original prevalece e o resumo
deve ser corrigido em nova PR.
