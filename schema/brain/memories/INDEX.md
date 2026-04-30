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

## Arquivos populados (PR41)

| Arquivo | Conteúdo | Quando consultar |
|---------|----------|------------------|
| `operator-preferences.md` | Preferências confirmadas do operador (comunicação, tom, estilo técnico, loop contratual, decisões de modelo, operação real Enova) — todas com fonte | Antes de ajustar tom; antes de propor processo novo; quando dúvida sobre como Vasques gosta de receber |
| `operating-style.md` | Como a Enavia deve operar com Vasques + ciclo padrão de sessão "Como usar o sistema" passo-a-passo (13 etapas) | No início de cada sessão; quando dúvida sobre próximo passo procedural |
| `project-principles.md` | 10 princípios canônicos do projeto Enavia/Enova (LLM-first, governança protege execução, contratos são trilhos, etc.) | Antes de tomar decisão arquitetural; quando algo "parece estranho" e precisa checar princípio |
| `hard-rules.md` | Regras duras de escopo, honestidade, execução, comunicação, governança e runtime já corrigido (não regredir) | Sempre que houver risco de violar regra básica; antes de PR-IMPL/PR-PROVA |
| `recurring-patterns.md` | 7 padrões recorrentes do projeto (excesso documental, repo bonito sem produto, necessidade de PR-PROVA, target/read_only, skills documentais, divergência docs/runtime, equilíbrio governança/tração) | Para reconhecer padrão antes que vire problema |

## Estado desta pasta na PR41

Pasta populada com 5 memórias operacionais consolidadas. Toda preferência
listada tem fonte verificável em `CLAUDE.md`, contratos, relatórios ou
incidentes. Inferências sem fonte foram **excluídas** (não são memória).
