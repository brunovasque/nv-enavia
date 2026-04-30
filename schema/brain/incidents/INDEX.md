# brain/incidents — Índice

**Pasta:** `schema/brain/incidents/`
**Versão:** 1.0
**Data:** 2026-04-30

---

## Finalidade

Esta pasta contém incidentes técnicos e cognitivos documentados da Enavia.
Cada incidente registra o problema observado, a causa, as PRs relacionadas,
o estado atual e como evitar regressão.

---

## Tipo de arquivo que mora aqui

- Bugs de runtime diagnosticados e resolvidos (ou em aberto)
- Comportamentos indesejados da Enavia (respostas robóticas, falsos positivos, etc.)
- Regressões detectadas em testes
- Problemas cognitivos (alucinação, resposta fora de escopo, etc.)
- Falhas de governança (PR fora de escopo, estado inconsistente, etc.)

---

## Quando consultar

- Ao diagnosticar comportamento indesejado que pode ter precedente
- Ao planejar uma PR que pode regredir algo já corrigido
- Ao responder pergunta sobre histórico de problemas
- Quando a intenção detectada é `diagnosis`

---

## Quando criar novo arquivo

- Quando um bug ou comportamento indesejado foi documentado em relatório de PR
- Quando um teste falhou de forma significativa e a causa foi identificada
- Quando uma regressão foi detectada
- Nunca quando for apenas suspeita sem evidência

---

## Estrutura obrigatória de cada arquivo de incidente

```markdown
# Incidente: [título]

**Data de abertura:** YYYY-MM-DD
**Estado:** Resolvido ✅ | Em aberto ⚠️ | Monitorado 🔍
**PRs relacionadas:** PR-N, PR-N+1...

## Problema observado
## Causa diagnosticada
## Correção aplicada (se resolvido)
## Estado atual
## Como evitar regressão
## Backlinks
```

---

## Incidentes documentados nesta PR

| Arquivo | Descrição | Estado |
|---------|-----------|--------|
| `chat-engessado-readonly.md` | Chat respondendo de forma robótica por confusão entre gate de execução e regra de tom | Resolvido ✅ (PR38) |

---

## Exemplos de nomes de arquivos

```
chat-engessado-readonly.md
sanitizer-falso-positivo-prosa-util.md
advance-phase-missing-endpoint.md
loop-status-stuck-in-progress.md
```

---

## Relação com relatórios

Todo incidente deve ter backlink para o(s) relatório(s) de PR em `schema/reports/`
que documentam a investigação e a correção.

---

## Limites

- Incidente exige evidência — não criar para especulação.
- Incidente resolvido não é apagado — é arquivado com estado "Resolvido ✅".
- Se um incidente se repetir, atualizar o arquivo existente em vez de criar novo.
- Incidente resolvido alimenta `brain/learnings/` e `brain/decisions/`.
