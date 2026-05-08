# Templates de entrada — HANDOFF e INDEX

> 2 templates curtos para uso obrigatório ao final de cada PR.
> Garantem que `schema/handoffs/` e `schema/contracts/INDEX.md` nunca fiquem defasados.

---

## TEMPLATE 1 — Entrada nova em `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`

> Adicionar **no topo** do arquivo (entradas mais recentes primeiro).
> Salvar em `schema/templates/HANDOFF_ENTRY_TEMPLATE.md` no repo.

```markdown
## Atualização PR{N} — <TÍTULO CURTO> — AAAA-MM-DD

- **Branch:** `<branch>`
- **PR GitHub:** #<numero> — <link ou "aguarda merge">
- **Tipo:** <PR-DIAG | PR-IMPL | PR-PROVA | PR-DOCS | PR-RECONCILIAÇÃO>
- **Contrato:** `docs/contratos/CONTRATO_PR{N}_<NOME>.md`
- **PR anterior:** PR{N-1} <status>

### O que foi feito

<2-4 frases. Foco: o que mudou, qual problema resolveu.>

### Commits

| # | Hash | Arquivo | Resumo |
|---|------|---------|--------|
| 1 | `<hash>` | `<arquivo>` | <resumo curto> |
| 2 | `<hash>` | `<arquivo>` | <resumo curto> |

### Deploy / Verificação

**Versão deployada:** `<version-id>` (ou "não deployada — apenas merge")
**Resultado E2E:** <PASS / FAIL / não aplicável> — <detalhe curto>

### Critérios de conclusão: X/Y ✅

<se < Y, listar quais ficaram pendentes e por quê>

### Veredito

<APROVADO PARA MERGE | MERGEADA | REPROVADA | PENDENTE>

### Próximo passo

<O que vem depois? PR{N+1}? Deploy? Configuração manual?>

---
```

---

## TEMPLATE 2 — Entrada nova em `schema/contracts/INDEX.md`

> Adicionar/atualizar a seção apropriada do INDEX (Ativo / Encerrado / Histórico).
> Salvar em `schema/templates/INDEX_ENTRY_TEMPLATE.md` no repo.

### Quando a PR está em execução (atualiza seção "Contrato ativo"):

```markdown
## Contrato ativo

🟢 **`docs/contratos/CONTRATO_PR{N}_<NOME>.md`** — Ativo (criado em AAAA-MM-DD).

Estado atual da frente:
- PR{N} (<TIPO>): 🔄 Em execução — branch `<branch>`
  - <Resumo de 1-2 linhas do escopo>
  - <Estado atual: implementação em andamento / aguardando review / aguardando merge>

**Próxima etapa: <descrever o que falta>**
```

### Quando a PR é mergeada (move para "Contrato anterior encerrado"):

```markdown
## Contrato anterior (encerrado ✅ — AAAA-MM-DD)

🔴 **`docs/contratos/CONTRATO_PR{N}_<NOME>.md`** — Encerrado ✅ (AAAA-MM-DD).

- PR{N} (<TIPO>): ✅ Mergeada — PR #<numero> em main (`<commit-hash>`)
  - <Resumo de 1-2 linhas do que foi entregue>
  - <Métricas se aplicável: testes passando, defeitos corrigidos, etc.>

[Adicionar próximo contrato como ATIVO em "Contrato ativo" acima]
```

### Atualização da tabela "Contratos encerrados" (final do INDEX):

```markdown
| `docs/contratos/CONTRATO_PR{N}_<NOME>.md` | PR{N} | Encerrado ✅ | AAAA-MM-DD |
```

---

## TEMPLATE 3 — Entrada nova em `schema/status/ENAVIA_STATUS_ATUAL.md`

> Adicionar **no topo** do arquivo (entradas mais recentes primeiro).
> Salvar em `schema/templates/STATUS_ENTRY_TEMPLATE.md` no repo.

```markdown
## Atualização PR{N} — <TÍTULO CURTO> — AAAA-MM-DD

- Branch: `<branch>`
- PR GitHub: <link ou "aguarda push + abertura">
- Tipo: <PR-DIAG | PR-IMPL | PR-PROVA | PR-DOCS | PR-RECONCILIAÇÃO>
- Contrato: `docs/contratos/CONTRATO_PR{N}_<NOME>.md` ✅
- PR anterior: PR{N-1} <status>

### Commits executados

| # | Hash | Arquivo | Entrega |
|---|------|---------|---------|
| 1 | `<hash>` | `<arquivo>` | <descrição> |

### Deploy

**Versão:** `<version-id>` ou "não deployada"
**Resultado:** ✅/❌ <detalhe>

### Critérios de conclusão: X/Y ✅

**Veredito:** <APROVADO PARA MERGE | MERGEADA | REPROVADA | PENDENTE> — <razão curta>

---
```

---

## TEMPLATE 4 — Entrada nova em GOVERNANÇA do `docs/canonico/PLANO_MACRO_ENAVIA.md`

> Substituir os campos correspondentes da seção GOVERNANÇA.

```markdown
**Última atualização:** AAAA-MM-DD (PR{N} fechada)
**Última fase concluída:** <fase ou "em andamento">
**Fase atual:** <fase>
**Próxima fase:** <fase>
**Última PR mergeada:** PR{N} (commit `<hash>`) — <título>
**PR em execução agora:** <PR{N+1} ou "nenhuma">
**Próxima PR planejada:** PR{N+1} — <título>
**Bloqueios ativos:** <lista ou "nenhum">
```

---

## TEMPLATE 5 — Entrada nova em SEÇÃO 5 (HANDOFF) do `docs/canonico/PLANO_MACRO_ENAVIA.md`

> Adicionar **no topo** da Seção 5 (entradas mais recentes primeiro).

```markdown
### AAAA-MM-DD — PR{N} — <TÍTULO>
- **Contrato:** `docs/contratos/CONTRATO_PR{N}_<NOME>.md`
- **Branch:** `<branch>`
- **Commits:** <lista de hashes>
- **Review:** `docs/PR{N}_REVIEW.md`
- **E2E:** <resultado real, com prova ou link pro output>
- **Status:** EM REVIEW | MERGEADA | DESCARTADA
- **Por que:** <1-2 linhas relacionando ao contrato e à fase>
- **Próximo passo:** PR{N+1} | <ajuste necessário>

```

---

## CHECKLIST FINAL DE FECHAMENTO DE PR

Marcar cada item antes de dizer "PR pronta para merge":

- [ ] Código implementado conforme contrato (sem desvios não autorizados)
- [ ] `docs/PR{N}_REVIEW.md` gerado conforme template
- [ ] **E2E em produção executado** e documentado no PR_REVIEW (output real)
- [ ] `schema/contracts/INDEX.md` atualizado (template 2)
- [ ] `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` atualizado (template 1)
- [ ] `schema/status/ENAVIA_STATUS_ATUAL.md` atualizado (template 3)
- [ ] `schema/brain/SYSTEM_AWARENESS.md` atualizado (apenas se mudança de capacidade)
- [ ] `docs/canonico/PLANO_MACRO_ENAVIA.md` GOVERNANÇA atualizada (template 4)
- [ ] `docs/canonico/PLANO_MACRO_ENAVIA.md` Seção 5 HANDOFF atualizada (template 5)
- [ ] PR aberta no GitHub com link para review e contrato
- [ ] Bruno notificado para aprovação

**Sem TODOS os itens acima, a PR não está pronta. Reportar como "em andamento", não como "concluída".**

---

**Versão:** 1.0
**Data:** 2026-05-08
**Mantido por:** Bruno + Claude (chat web)
**Local no repo:** `schema/templates/` (cada template em arquivo separado)
