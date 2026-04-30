# brain/decisions — Índice

**Pasta:** `schema/brain/decisions/`
**Versão:** 1.0
**Data:** 2026-04-30

---

## Finalidade

Esta pasta contém decisões arquiteturais, técnicas, comerciais e de governança
já tomadas e registradas. São decisões que orientam PRs futuras e não podem ser
revertidas silenciosamente — qualquer reversão exige nova PR e novo registro.

---

## Tipo de arquivo que mora aqui

- Decisões de arquitetura de sistema
- Decisões de design de API ou protocolo
- Decisões de governança contratual
- Decisões de comportamento da Enavia (tom, modo, resposta)
- Decisões de tecnologia (stack, ferramentas, paradigmas)

---

## Quando consultar

- Ao planejar uma mudança que pode conflitar com decisão anterior
- Ao fazer diagnóstico que envolve comportamento definido por decisão
- Ao criar contrato ou policy que depende de decisões base
- Ao revisar PR que altera algo previamente decidido

---

## Quando criar novo arquivo

- Quando uma escolha técnica ou arquitetural foi feita em uma PR
- Quando uma abordagem foi descartada em favor de outra, com justificativa
- Quando uma regra foi estabelecida que orienta PRs futuras

---

## Estrutura obrigatória de cada arquivo de decisão

```markdown
# Decisão: [título]

**Data:** YYYY-MM-DD
**PR de referência:** PR-N
**Estado:** Ativa | Revisada | Arquivada

## Contexto
## Alternativas consideradas
## Decisão tomada
## Justificativa
## Impacto em PRs futuras
```

---

## Exemplos de decisões a documentar

- `read_only-como-gate-nao-tom.md` — PR35/PR36: separação de gate de execução de regra de tom
- `sanitizers-preservam-prosa-natural.md` — PR36: sanitizers menos destrutivos
- `isOperationalMessage-termos-compostos.md` — PR38: remoção de termos isolados, uso de compostos
- `contrato-ampliado-pr60-para-pr64.md` — PR33: ampliação do contrato Jarvis Brain

---

## Limites

- Não criar "decisão" sobre algo que ainda está em aberto (usar `open-questions/`).
- Decisão registrada tem precedência sobre suposição.
- Não apagar decisões — arquivar com status "Arquivada" se for superada.

---

## Decisões registradas (PR41)

| Arquivo | Decisão | PR de origem |
|---------|---------|-------------|
| `2026-04-30-read-only-gate-nao-tom.md` | `read_only` é gate de execução, **não** regra de tom | PR35 (definição) + PR36/PR38 (implementação) |
| `2026-04-30-jarvis-brain-llm-first.md` | A Enavia é LLM-first: inteligência primeiro, ferramentas depois | PR31 + PR33 + PR40/PR41 |
| `2026-04-30-skills-documentais-antes-de-runtime.md` | Skills nascem documentais; runtime de skills é candidato futuro | PR26–PR29 |
| `2026-04-30-pr36-pr38-anti-bot-before-brain.md` | Frente Brain só após corrigir e provar runtime do chat (anti-bot 56/56) | PR33 + PR36/PR37/PR38 |

> Cada decisão segue a estrutura: contexto, problema, decisão, alternativas,
> consequência, fonte, como usar futuramente, backlinks.

## Estado desta pasta na PR41

Pasta populada com 4 decisões arquiteturais reais derivadas das PRs
PR26–PR40. Toda decisão tem PR de origem identificada e fontes verificáveis
em `schema/reports/`, `schema/contracts/`, `schema/policies/` e
`schema/brain/`.
