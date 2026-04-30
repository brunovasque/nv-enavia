# Decisão: Skills documentais antes de runtime

**Data:** 2026-04-30
**PR de referência:** PR26–PR29 (criação) + PR41 (consolidação no brain)
**Estado:** Ativa

---

## Contexto

No contrato `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` foi proposta
uma frente de skills supervisionadas para a Enavia. Havia duas opções de
abordagem: (a) começar com runtime de skills (endpoint `/skills/run`,
executor), ou (b) começar pelo documento operacional de cada skill.

---

## Problema

Skill como runtime sem documento prévio:

- Sem critério claro do que cada skill faz / não faz.
- Difícil revisar, difícil auditar.
- Risco de skill executar fora do escopo intencional.
- Custo de implementação mais alto sem certeza do design.

Skill só como documento:

- Não executa nada — limita o ganho operacional imediato.
- Pode ser percebida como "documentação teatral".
- Requer disciplina para não ser ignorada.

---

## Decisão

Cada skill é criada **primeiro como documento operacional** (PR-DOCS),
detalhando:

- Domínio de atuação.
- O que a skill faz.
- O que a skill **não faz**.
- Quando usar / quando **não** usar.
- Pré-requisitos (PR anterior, contrato ativo, gate).
- Procedimentos passo a passo.
- Critérios de aceite e revisão.

Apenas depois — em contrato futuro aprovado pelo operador — será considerada
a implementação de runtime de skills (endpoint, router, executor).

---

## Alternativas consideradas

1. **Runtime primeiro.** Rejeitada — alto custo, alto risco, design provisório.
2. **Documental + runtime simultâneos.** Rejeitada — escopo de PR fica grande
   demais, viola "uma tarefa por PR".
3. **Documental primeiro (escolhida).** Quatro PRs sequenciais (PR26–PR29)
   criaram as 4 skills oficiais sem alterar runtime. PR-DOCS, sem regressão.

---

## Consequência

- 4 skills documentais em `schema/skills/`:
  - `CONTRACT_LOOP_OPERATOR.md` (PR26)
  - `DEPLOY_GOVERNANCE_OPERATOR.md` (PR27)
  - `SYSTEM_MAPPER.md` (PR28)
  - `CONTRACT_AUDITOR.md` (PR29)
- Contract Loop Operator e os outros são usados como referência por agentes
  e por humanos quando operam o sistema.
- Runtime de skills permanece como **candidato futuro**
  (`brain/contracts/next-candidates.md` §1.1).
- Não há `/skills/run`, não há router, não há executor de skills.

---

## Fonte

- `schema/skills/INDEX.md`
- `schema/skills/CONTRACT_LOOP_OPERATOR.md`
- `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md`
- `schema/skills/SYSTEM_MAPPER.md`
- `schema/skills/CONTRACT_AUDITOR.md`
- `schema/reports/CONTRATO_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30_FINAL_REPORT.md`

---

## Como usar futuramente

- Toda nova skill **começa documental**. Sem exceção sem aprovação
  contratual explícita.
- Antes de propor runtime de skill, reler esta decisão e
  `brain/contracts/next-candidates.md` §1.1.
- Quando alguém perguntar "essa skill executa X?", responder primeiro:
  "É documental. Não há runtime de skills. O que ela orienta é..."

---

## Backlinks

- → schema/skills/INDEX.md
- → schema/skills/CONTRACT_LOOP_OPERATOR.md
- → schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md
- → schema/skills/SYSTEM_MAPPER.md
- → schema/skills/CONTRACT_AUDITOR.md
- → brain/maps/skill-map.md
- → brain/contracts/next-candidates.md
- → brain/learnings/what-worked.md
