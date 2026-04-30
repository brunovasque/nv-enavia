# Brain — Contrato Ativo (resumo navegável)

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Fonte de verdade:** `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
+ `schema/contracts/INDEX.md`

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| Arquivo | `active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` |
| Estado | Ativo 🟢 |
| PRs | PR31–PR64 (ampliado da janela original PR31–PR60 pela PR33) |
| Início | 2026-04-30 |

---

## 2. Objetivo macro

Transformar a Enavia de sistema governado/documental em uma **IA operacional viva** —
LLM Core, Memory Brain, Skill Router, Intent Engine e Self-Audit — sem perder
governança nem regredir runtime.

**Frase-síntese do contrato:**

> "A Enavia pensa livremente, lembra com estrutura, sugere com inteligência
> e executa somente com governança."

---

## 3. Estado atual (após PR40)

- **Última PR mergeada:** PR40 — PR-DOCS — Self Model da Enavia.
- **PR em andamento:** PR41 — PR-DOCS — Popular Obsidian Brain.
- **Frente anti-bot (PR32–PR38):** **Encerrada ✅.** Anti-bot 56/56 verde. Causa
  raiz do chat engessado em 7 camadas corrigida; `read_only` redefinido como
  gate de execução, não tom; sanitizers cirúrgicos; `isOperationalMessage`
  depende de termos compostos.
- **Frente Obsidian Brain (PR39 → ...):** Em andamento.
  - PR39 — arquitetura do brain criada;
  - PR40 — self-model criado;
  - PR41 — populando o brain (esta PR);
  - próximas — diagnóstico e conexão posterior do brain ao runtime.
- **Runtime:** Estável. Nenhum runtime alterado desde PR38.

---

## 4. Próximas PRs

| Próxima | Tipo | Objetivo |
|---------|------|----------|
| **PR41 (atual)** | PR-DOCS | Popular Obsidian Brain com conhecimento real consolidado |
| **PR42** | PR-DIAG | Diagnóstico da memória atual no runtime (KV ENAVIA_BRAIN, key shapes, leitura/escrita) |

> PR42 é a próxima autorizada. Não avançar para PRs além de PR42 sem antes
> ler o contrato completo na fonte de verdade.

---

## 5. Regras centrais do contrato (resumo)

### R1 — `read_only` é gate de execução, não tom
Já implementado em PR36/PR38. Documentado em `schema/policies/MODE_POLICY.md`.

### R2 — Sanitizers preservam prosa natural
Implementado em PR36; refinado em PR38. Apenas snapshots JSON-like do planner
continuam bloqueados.

### R3 — `isOperationalMessage` usa termos compostos
Termos isolados como "sistema" ou "contrato" não ativam contexto operacional —
geravam falsos positivos. Termos compostos ("estado do contrato", "contrato ativo",
"runtime", "gate", verbos imperativos como "revise", "verifique") sim.

### R4 — Brain é construído sobre base anti-bot corrigida
A Frente 2 corretiva (PR33–PR38) precisava encerrar antes de avançar para o brain.
Isso foi cumprido. PR39+ trabalham sobre runtime estável.

---

## 6. Frentes do contrato

| Frente | PRs | Estado |
|--------|-----|--------|
| Frente 1 — Ativação Jarvis Brain | PR31 | ✅ Concluída |
| Frente 2 — Corretiva chat engessado / anti-bot | PR32–PR38 | ✅ Encerrada |
| Frente 3 — Obsidian Brain documental | PR39, PR40, PR41 | 🔵 Em andamento |
| Frente 4 — Diagnóstico de memória runtime | PR42+ | ⏳ Próxima |
| Frente 5 — LLM Core, Intent Engine, Skill Router | PR futuras (dentro de PR31–PR64) | ⏳ Não iniciada |

---

## 7. Como a Enavia deve usar este resumo

1. **Não substitui o contrato original.** Para escopo exato de cada PR, abrir
   `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`.
2. **A próxima PR autorizada é a única que pode ser executada.** Não pular
   PRs, não consolidar várias na mesma branch.
3. **Mudanças de escopo** (ex: ampliar contrato, inserir nova frente) exigem
   PR-DOCS dedicada e atualização da seção correspondente.
4. **Em caso de conflito** entre este resumo e o contrato original, o
   contrato original prevalece e este resumo deve ser corrigido em nova PR.

---

## 8. Backlinks

- → schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
- → schema/contracts/INDEX.md
- → schema/policies/MODE_POLICY.md
- → schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md
- → schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md
- → schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md
- → schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md
- → schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md
- → schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md
- → schema/reports/PR39_OBSIDIAN_BRAIN_ARCHITECTURE_REPORT.md
- → schema/reports/PR40_SELF_MODEL_ENAVIA_REPORT.md
- → brain/contracts/closed.md
- → brain/contracts/next-candidates.md
