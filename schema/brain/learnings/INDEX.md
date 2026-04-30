# brain/learnings — Índice

**Pasta:** `schema/brain/learnings/`
**Versão:** 1.0
**Data:** 2026-04-30

---

## Finalidade

Esta pasta contém aprendizados reais da Enavia — inferências derivadas de experiências
documentadas. Cada aprendizado registra o que funcionou, o que falhou, riscos futuros
e como aplicar o aprendizado em próximas PRs.

---

## Tipo de arquivo que mora aqui

- Padrões de sucesso comprovados (o que funcionou bem e pode ser replicado)
- Padrões de falha (o que causou problema e deve ser evitado)
- Riscos identificados que podem se materializar em PRs futuras
- Lições de ciclos de diagnóstico-implementação-prova

---

## Quando consultar

- Ao planejar uma nova PR que toca área com histórico de problemas
- Ao fazer diagnóstico de problema que pode ter precedente
- Ao criar novo contrato (para não repetir erros)
- Quando a intenção detectada é `planning` ou `contract_creation`

---

## Quando criar novo arquivo

- Quando um incidente gerou uma lição que transcende aquele incidente
- Quando um padrão de sucesso se repetiu e pode ser generalizado
- Quando uma falha se repetiu e o padrão de prevenção é claro
- Após encerramento de frente ou contrato, como síntese

---

## Estrutura obrigatória de cada arquivo de aprendizado

```markdown
# Aprendizado: [título]

**Data:** YYYY-MM-DD
**Derivado de:** incidente X | PR-N | contrato Y
**Tipo:** sucesso | falha | risco

## Aprendizado (frase direta)
## Experiência base
## Como aplicar
## Riscos se ignorado
## Backlinks
```

---

## Exemplos de aprendizados a documentar

- `diagnostico-antes-de-impl-evita-regressao.md` — PR32-PR38: diagnóstico profundo antes da implementação identificou 7 camadas de causa raiz
- `termos-compostos-vs-palavras-isoladas.md` — PR38: palavras isoladas geram falsos positivos em detecção de intenção
- `sanitizer-destrutivo-vs-cirurgico.md` — PR36: sanitizer muito amplo remove prosa natural útil

---

## Diferença entre aprendizado, incidente e decisão

| Tipo | O que é |
|------|---------|
| **Incidente** | O que aconteceu de errado (fato) |
| **Aprendizado** | O que se aprendeu com o que aconteceu (inferência) |
| **Decisão** | O que foi escolhido como regra para o futuro (deliberação) |

---

## Limites

- Aprendizado é derivado de experiência documentada — não é opinião.
- Não criar aprendizado contraditório ao contrato ativo.
- Aprendizado não substitui decisão — orienta, mas não determina.
- Se um aprendizado se tornar regra oficial, criar um arquivo em `brain/decisions/`.

---

## Aprendizados registrados (PR41)

| Arquivo | Tipo | Conteúdo |
|---------|------|----------|
| `what-worked.md` | Sucesso | 7 padrões de sucesso (diagnóstico antes de impl, PR-PROVA revelando falhas, PR38 voltando ao contrato, separar `read_only` de tom, sanitizers cirúrgicos, governança+teste, skills documentais primeiro) |
| `what-failed.md` | Falha | 5 padrões de falha (excesso documental, chat robótico por target/read_only, falsos positivos com palavras genéricas, confundir skills documentais com runtime, Latest Handoff inflado) |
| `future-risks.md` | Risco | 9 riscos futuros (Brain só docs, LLM Core fraco, retrieval errado, contexto caro, self-model desatualizado, skills sem governança, excesso documental volta, alucinação, divergência docs↔runtime) |

## Quando consultar

| Intenção | Arquivo prioritário |
|----------|--------------------|
| Planejar próxima PR | `what-worked.md` + `future-risks.md` |
| Diagnosticar problema com precedente | `what-failed.md` |
| Revisar nova frente / contrato | os três |
| Antecipar risco antes de PR-IMPL | `future-risks.md` |

## Estado desta pasta na PR41

Pasta populada com 3 aprendizados consolidados derivados de PRs reais
(PR26–PR40). Todos com fonte e backlinks. Nenhuma opinião sem evidência
foi registrada.
