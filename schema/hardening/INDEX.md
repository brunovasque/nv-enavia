# ENAVIA — Hardening: Runtime de Skills

**Versão:** 1.0
**Data:** 2026-05-02 (PR67)
**Estado:** Documental — hardening criado antes de qualquer implementação de runtime

---

## 1. O que é este pacote

Este pacote de hardening consolida os requisitos de segurança, custo, limites, blast radius, rollback e critérios de go/no-go que devem ser satisfeitos antes de qualquer implementação futura do Runtime de Skills.

**Este pacote NÃO implementa runtime.** É governança pré-implementação.

---

## 2. Contexto

| Item | Estado |
|------|--------|
| Blueprint do Runtime de Skills | ✅ Criado (PR65) — `schema/skills-runtime/` |
| Diagnóstico técnico | ✅ Criado (PR66) — `schema/reports/PR66_DIAG_RUNTIME_SKILLS.md` |
| Hardening de segurança/custo/limites | ✅ Este pacote (PR67) |
| Runtime de Skills | ❌ Não existe — aguarda PR-IMPL futura |
| `/skills/propose` | ❌ Não existe — aguarda PR-IMPL futura |
| `/skills/run` | ❌ Não existe — aguarda Fase 5 (PR73+) |
| Skill Executor | ❌ Não existe — aguarda PR-IMPL futura |

---

## 3. Arquivos deste pacote

| Arquivo | Conteúdo |
|---------|----------|
| `INDEX.md` | Este arquivo — visão geral e índice |
| `SKILLS_RUNTIME_HARDENING.md` | Segurança completa: deny-by-default, allowlist, gates |
| `COST_LIMITS.md` | Limites de custo, payload, LLM, KV, retries |
| `BLAST_RADIUS.md` | Níveis de impacto (0–4) e gates mínimos por nível |
| `ROLLBACK_POLICY.md` | Política de rollback por tipo de PR e artefato |
| `GO_NO_GO_CHECKLIST.md` | Checklist obrigatório antes de qualquer PR-IMPL futura |

---

## 4. Como usar este pacote

1. **Antes de qualquer PR-IMPL futura do Runtime de Skills**, o checklist de `GO_NO_GO_CHECKLIST.md` deve ser satisfeito.
2. Toda PR-IMPL de runtime deve referenciar este pacote em seu corpo.
3. Toda PR-PROVA deve incluir validação dos limites definidos em `COST_LIMITS.md`.
4. Toda PR que criar endpoint novo deve declarar o nível de `BLAST_RADIUS.md` correspondente.
5. Toda PR deve ter política de rollback definida conforme `ROLLBACK_POLICY.md`.

---

## 5. Relação com documentos existentes

| Documento | Relação |
|-----------|---------|
| `schema/skills-runtime/SECURITY_MODEL.md` | Reforçado por este pacote — deny-by-default aprofundado |
| `schema/skills-runtime/APPROVAL_GATES.md` | Gates integrados com blast radius |
| `schema/skills-runtime/ROLLOUT_PLAN.md` | Gate de hardening adicionado antes de Fase 2 |
| `schema/brain/learnings/future-risks.md` | Riscos R14–R17 adicionados (custo, loop, blast, over-automation) |
| `schema/brain/SYSTEM_AWARENESS.md` | Seção 10 adicionada (estado pós-PR67) |

---

## 6. Próxima PR após este pacote

Após validação deste hardening:

- **PR68 — PR-DOCS/PR-PROVA — Fechamento do Jarvis Brain v1**

Ou, se hardening estiver incompleto:

- **PR68 — PR-HARDENING — Completar segurança, custo e limites**

---

## Backlinks

- `schema/skills-runtime/INDEX.md`
- `schema/reports/PR67_HARDENING_SEGURANCA_CUSTO_LIMITES.md`
- `schema/brain/SYSTEM_AWARENESS.md`
