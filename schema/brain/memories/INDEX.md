# brain/memories — Índice

**Pasta:** `schema/brain/memories/`
**Versão:** 1.0
**Data:** 2026-04-30

---

## Finalidade

Esta pasta contém memórias operacionais da Enavia: preferências declaradas do operador,
padrões recorrentes de operação, regras de estilo de resposta e comportamentos
que devem ser mantidos de forma consistente.

---

## Tipo de arquivo que mora aqui

- Preferências explícitas do operador
- Padrões de operação recorrentes
- Regras de estilo de resposta e comunicação
- Comportamentos que o operador aprovou repetidamente
- Contexto do operador (quem é, como opera, o que valoriza)

---

## Quando consultar

- Ao responder mensagem de conversa geral
- Ao ajustar tom ou estilo de resposta
- Ao identificar como o operador prefere receber informações
- Quando a intenção detectada é `conversation` ou `conversation/frustration`

---

## Quando criar novo arquivo

- Quando o operador declarar explicitamente uma preferência em PR, issue ou handoff
- Quando um padrão de operação se repetir com aprovação documentada
- Nunca quando for apenas uma inferência sem declaração explícita

---

## Estrutura sugerida de arquivo de memória

```markdown
# Memória: [título]

**Tipo:** preferência | padrão | regra de estilo
**Fonte:** PR-N | issue #N | handoff de YYYY-MM-DD
**Estado:** Ativa | Obsoleta

## Conteúdo
## Evidência
## Quando aplicar
```

---

## Exemplos de preferências documentadas

- Responder sempre em português
- Patch cirúrgico — não refatorar por estética
- Diagnóstico antes de implementar
- Não avançar PR sem evidência real da anterior
- Resposta direta, sem checklist robótico desnecessário

> Estas preferências derivam de `CLAUDE.md` e contratos. São listadas aqui como
> referência rápida de memória operacional.

---

## Distinção importante

| Tipo | Fonte | Onde registrar |
|------|-------|----------------|
| Regra operacional dura | `CLAUDE.md`, contratos | `brain/decisions/` ou `schema/policies/` |
| Preferência do operador | Declaração explícita | **Esta pasta** |
| Inferência não confirmada | Comportamento observado | NÃO registrar como memória |

---

## Limites

- Preferência não declarada não é memória — é inferência.
- Não confundir preferência com regra de segurança.
- Memória de preferência pode ser atualizada se o operador declarar mudança.
- Não usar memória de tom como justificativa para ativar contexto operacional.

---

## Estado desta pasta na PR39

Pasta criada como esqueleto. Nenhuma memória foi populada nesta PR.
As memórias serão adicionadas em PRs futuras conforme o brain for populado.
