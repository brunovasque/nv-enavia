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

## Arquivos planejados para PRs futuras

| Arquivo | Conteúdo | PR planejada |
|---------|----------|--------------|
| `identity.md` | Quem é a Enavia, propósito, valores | PR40 |
| `capabilities.md` | O que a Enavia pode fazer agora vs. futuro | PR40 |
| `limits.md` | O que a Enavia não pode ou não deve fazer | PR40 |
| `how-to-answer.md` | Forma de resposta, tom, nível de confiança | PR40 |
| `modes.md` | Como se comportar em cada modo (conversation/diagnosis/execution) | PR40 |

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

## Estado desta pasta na PR39

Pasta criada como esqueleto. Os arquivos de self-model serão criados na PR40
(próxima PR autorizada: PR40 — PR-DOCS — Self Model da Enavia).
