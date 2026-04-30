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

## Estado desta pasta na PR39

Pasta criada como esqueleto. Nenhuma decisão foi populada nesta PR.
As decisões serão adicionadas em PRs futuras conforme o brain for populado.
