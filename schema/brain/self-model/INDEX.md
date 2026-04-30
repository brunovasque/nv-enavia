# brain/self-model — Índice

**Pasta:** `schema/brain/self-model/`
**Versão:** 1.0
**Data:** 2026-04-30

---

## Finalidade

Esta pasta define a identidade, capacidades, limites e forma de resposta da Enavia.
O self-model é o que a Enavia "sabe sobre si mesma" — não como aspiração, mas como
descrição precisa do que é e do que pode fazer agora.

O self-model é crucial para evitar dois problemas opostos:
1. **Sub-representação:** a Enavia responde como se fosse menos do que é.
2. **Super-representação (alucinação):** a Enavia afirma capacidades que não existem.

---

## Tipo de arquivo que mora aqui

- Identidade e propósito da Enavia
- Capacidades reais vs. capacidades futuras
- Limites conhecidos e declarados
- Forma preferida de resposta e comunicação
- O que a Enavia pode afirmar com confiança vs. o que deve marcar como incerto
- Como a Enavia deve se comportar em diferentes modos (conversation / diagnosis / execution)

---

## Quando consultar

- Ao responder pergunta sobre o que a Enavia é ou pode fazer
- Ao ajustar tom, estilo ou nível de confiança da resposta
- Ao verificar se uma capacidade afirmada está documentada
- Quando a intenção detectada é `conversation`, `memory_question` ou `skill_request`

---

## Quando criar ou atualizar arquivo

- Quando uma nova capacidade for confirmada (skill executável, runtime conectado)
- Quando um limite for identificado e documentado
- Quando o operador ajustar a identidade ou forma de resposta da Enavia
- Quando o self-model se tornar inconsistente com o estado real do sistema

---

## Estrutura sugerida de arquivos

```markdown
# Self-Model: [dimensão]

**Versão:** X.Y
**Data:** YYYY-MM-DD
**PR de referência:** PR-N

## Estado atual (o que é agora)
## Capacidades confirmadas
## Capacidades futuras (ainda não implementadas)
## Limites
## Como responder sobre esta dimensão
```

---

## Arquivos do self-model (criados na PR40)

| Arquivo | Conteúdo | Quando consultar |
|---------|----------|-----------------|
| `identity.md` | Quem é a Enavia, propósito, valores, frase canônica | Ao responder "o que você é?", ao ajustar tom |
| `capabilities.md` | Capacidades atuais vs. capacidades futuras | Ao responder "o que você pode fazer?", ao verificar se capacidade existe |
| `limitations.md` | Limites reais — o que não deve ou não pode fazer | Ao decidir se pode executar algo, ao sinalizar restrição |
| `current-state.md` | Estado real pós-PR39: o que existe, o que não existe | Ao responder sobre estado do sistema, ao planejar próximas PRs |
| `how-to-answer.md` | 10 regras + 4 exemplos de como responder | Sempre que a qualidade da resposta importar |

---

## Regra crítica do self-model

> O self-model descreve a Enavia como ela **é agora**, não como ela será.

Afirmar capacidade futura como presente é alucinação. Afirmar que algo não existe
quando existe é sub-representação. O self-model deve ser preciso e atualizado.

---

## Relação com outros arquivos

| Arquivo | Relação |
|---------|---------|
| `schema/policies/MODE_POLICY.md` | Define os modos — self-model deve internalizá-los |
| `schema/skills/INDEX.md` | Skills documentais que a Enavia conhece |
| `brain/SYSTEM_AWARENESS.md` | Estado real do sistema — base para self-model |
| `brain/memories/INDEX.md` | Preferências que alimentam forma de resposta |

---

## Limites

- Não declarar capacidade não confirmada como "disponível".
- Não minimizar capacidade confirmada como "não sei fazer".
- Auto-conhecimento é documentado, não inventado.
- Atualizar o self-model exige PR — não é feito silenciosamente.

---

## Relação com Mode Policy

O `how-to-answer.md` e o `limitations.md` se relacionam diretamente com `schema/policies/MODE_POLICY.md`:

- A Mode Policy define os 3 modos canônicos: `conversation`, `diagnosis`, `execution`.
- O `how-to-answer.md` define como se comportar em cada modo (Regra 4 e Regra 5).
- O `limitations.md` define que `read_only` é gate de execução, não regra de tom — alinhado com a Mode Policy.

---

## Relação com Obsidian Brain

O self-model faz parte do Obsidian Brain como a camada de **self-model** (camada 6 da arquitetura):

- `schema/brain/ARCHITECTURE.md` — descreve as 7 camadas, incluindo self-model.
- `schema/brain/SYSTEM_AWARENESS.md` — descreve o estado real do sistema, base para `current-state.md`.
- `schema/brain/MEMORY_RULES.md` — descreve o que conta como memória válida.
- `schema/brain/RETRIEVAL_POLICY.md` — mapeia quais arquivos consultar por intenção.

---

## O que este self-model ainda NÃO é (runtime)

Esta pasta é **documental**. O self-model:

- **Não está conectado ao runtime do chat** — o LLM não lê esses arquivos automaticamente.
- **Não é carregado pelo Brain Loader** — esse componente ainda não existe.
- **Não é consumido automaticamente** em nenhuma conversa.

O self-model será consumido automaticamente quando o Brain Loader for implementado
(frente futura do contrato Jarvis Brain, após PR41).

Por enquanto, é usado como referência por contrato/agente — lido manualmente no início de sessão.

---

## Estado desta pasta na PR40

Todos os 5 arquivos do self-model foram criados nesta PR:
- `identity.md` ✅
- `capabilities.md` ✅
- `limitations.md` ✅
- `current-state.md` ✅
- `how-to-answer.md` ✅

Próxima PR autorizada: **PR41 — PR-DOCS — Migrar conhecimento consolidado para Brain**.
