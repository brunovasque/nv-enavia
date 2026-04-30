# Questões abertas — Estratégicas

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Estado:** Decisões estratégicas que ainda não foram tomadas. Não confundir
com lacuna técnica — aqui é direção do projeto.

---

## 1. Quando fazer Runtime de Skills

**Estado:** Aberta
**Impacto:** Alto — define se as skills viram capacidade real ou continuam
como documentação.

Runtime de Skills (`/skills/run`, router, executor) é candidato em
`brain/contracts/next-candidates.md` §1.1. A pergunta é **quando** justifica
construir:

- Antes do LLM Core conectado? (sem inteligência roteando, runtime de skill
  vira RPC manual.)
- Depois do Intent Engine? (mais coerente, mas depende de outra frente.)
- Só quando houver caso de uso real e repetido que justifique o custo.

**Próxima ação sugerida:** monitorar a frequência com que as skills
documentais são invocadas manualmente. Quando houver evidência de uso
recorrente, abrir PR-DOCS de proposta de runtime.

---

## 2. Quando criar UI de Skills no painel

**Estado:** Aberta
**Impacto:** Médio — UX para o operador, mas não bloqueia inteligência.

Depende inteiramente de Runtime de Skills existir. Antes disso, UI de skills
seria documental — provavelmente mais ruído que benefício.

**Próxima ação sugerida:** parquear até decisão sobre Runtime de Skills.

---

## 3. Quanto automatizar memória

**Estado:** Aberta
**Impacto:** Alto — define quanto a Enavia "aprende sozinha" vs. quanto
depende de PR-DOCS supervisionada.

Espectro:

- **Manual total:** toda memória vem de PR-DOCS aprovada (estado atual).
- **Manual + supervisionado:** agente propõe atualização, humano aprova.
- **Automático com gate:** runtime atualiza brain conforme eventos
  (PR mergeada, incidente fechado), com gate de revisão.
- **Automático puro:** sem gate. **Rejeitado por padrão** — risco alto.

**Próxima ação sugerida:** Memory Update Supervision (candidato §1.7) é a
proposta intermediária. Decisão depende de o brain estar populado e
estável (PR41+).

---

## 4. Quando integrar Self-Audit

**Estado:** Aberta
**Impacto:** Médio/Alto — maturidade da Enavia.

Runtime de Self-Audit (`brain/contracts/next-candidates.md` §1.6) é uma
camada onde a Enavia compara self-model declarado ↔ comportamento observado
↔ capacidades reais. Útil, mas exige telemetria abundante e estabilidade
das outras camadas.

**Próxima ação sugerida:** parquear até Brain conectado + LLM Core +
telemetria mínima existir.

---

## 5. Como balancear "Jarvis vivo" com "governança segura"

**Estado:** Aberta — eterna
**Impacto:** Alto — define cultura do projeto.

Tensão estratégica permanente:

- "Jarvis vivo" = personalidade forte, raciocínio livre, resposta
  contextual rica.
- "governança segura" = gates explícitos, aprovação humana, nenhum efeito
  colateral surpresa.

A solução escolhida (`brain/decisions/2026-04-30-jarvis-brain-llm-first.md`)
é **separar planos**: LLM-first no raciocínio, governança rígida na
execução. Mas a tensão volta a cada PR.

**Próxima ação sugerida:** monitorar qual lado está sendo sacrificado em
cada frente; quando perceber desequilíbrio, abrir PR-DOCS para
recalibrar.

---

## 6. Como evitar virar só documentação

**Estado:** Aberta — recorrente
**Impacto:** Alto — risco de morte do projeto por "repo bonito sem
produto".

Regra cultural: produto funcionando vale mais que documentação bonita
(`brain/memories/project-principles.md` §1.7).

Implementação prática:

- Limite máximo de PR-DOCS consecutivas? (não definido)
- KPI de PR-IMPL/mês? (não definido)
- Critério explícito para recusar criação de novo doc? (parcial — está em
  `project-principles.md` §1.8)

**Próxima ação sugerida:** quando aparecer próxima sequência de PR-DOCS
(ex: 3 ou mais consecutivas sem PR-IMPL), abrir explicitamente uma
PR-DIAG ou PR-IMPL para puxar tração.

---

## 7. Backlinks

- → schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
- → brain/contracts/next-candidates.md
- → brain/decisions/2026-04-30-jarvis-brain-llm-first.md
- → brain/decisions/2026-04-30-skills-documentais-antes-de-runtime.md
- → brain/memories/project-principles.md
- → brain/memories/recurring-patterns.md
- → brain/learnings/future-risks.md
- → brain/open-questions/unresolved-technical-gaps.md
