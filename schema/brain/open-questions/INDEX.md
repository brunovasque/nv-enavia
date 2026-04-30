# brain/open-questions — Índice

**Pasta:** `schema/brain/open-questions/`
**Versão:** 1.0
**Data:** 2026-04-30

---

## Finalidade

Esta pasta contém lacunas, dúvidas técnicas e questões estratégicas pendentes
que a Enavia ou o operador ainda não responderam ou decidiram. Cada questão
aberta deve ter uma PR futura que a resolva ou a arquive.

---

## Tipo de arquivo que mora aqui

- Questões técnicas sem resposta clara
- Dúvidas de arquitetura que podem impactar PRs futuras
- Questões estratégicas sobre o rumo do sistema
- Lacunas identificadas em diagnósticos que não foram endereçadas
- Decisões adiadas por falta de informação

---

## Quando consultar

- Ao planejar próximas PRs
- Ao criar ou ajustar um contrato
- Ao verificar se uma questão importante foi deixada de lado
- Quando a intenção detectada é `planning` ou `contract_creation`

---

## Quando criar novo arquivo

- Quando uma decisão foi adiada por falta de informação
- Quando um diagnóstico expõe uma lacuna não endereçada
- Quando o contrato levanta uma questão não resolvida
- Quando um incidente aponta risco que ainda não foi mitigado estruturalmente

---

## Quando fechar (mover para outro local)

| Resultado | Onde registrar |
|-----------|----------------|
| Questão respondida → decisão | `brain/decisions/` |
| Questão respondida → aprendizado | `brain/learnings/` |
| Questão arquivada (won't fix) | Marcar como "Arquivada" no próprio arquivo |

---

## Estrutura obrigatória de cada arquivo de open question

```markdown
# Questão: [título]

**Data de abertura:** YYYY-MM-DD
**Estado:** Aberta | Em investigação | Arquivada
**PR de referência:** PR-N (onde foi identificada)

## Contexto
## Questão em aberto
## Por que está aberta
## Impacto se não resolvida
## Próxima ação sugerida
```

---

## Questões abertas identificadas até PR39

| Questão | Estado | Impacto |
|---------|--------|---------|
| Como o LLM Core vai priorizar fontes do brain? | Aberta | Alto — define design do Intent Engine |
| Quando o Skill Router vai usar o brain como contexto? | Aberta | Alto — conecta brain ao runtime |
| Como o brain vai distinguir memória de curto vs. longo prazo? | Aberta | Médio — design de retrieval |
| Como evitar que o brain cresça sem curadoria? | Aberta | Médio — sustentabilidade do brain |

> Estas questões serão formalizadas em arquivos individuais em PRs futuras.

---

## Limites

- Não criar open question sobre algo já decidido — linkar para a decisão.
- Open question não é "to-do" — é lacuna genuína sem resposta atual.
- Toda questão aberta deve ter impacto declarado e próxima ação sugerida.
- Questão arquivada não é apagada — mantém histórico.

---

## Estado desta pasta na PR39

Pasta criada como esqueleto. As questões identificadas acima serão formalizadas
em arquivos individuais em PRs futuras conforme o brain for populado.
