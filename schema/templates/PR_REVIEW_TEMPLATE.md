# PR{N} REVIEW — <TÍTULO>

> Review canônico da PR{N}. Análise critério-a-critério do contrato + prova E2E em produção.
> Salvar em `docs/PR{N}_REVIEW.md`.

---

## METADADOS

- **PR:** PR{N}
- **GitHub PR #:** <número ou "pendente">
- **Branch:** `<branch>`
- **Tipo:** <PR-DIAG | PR-IMPL | PR-PROVA | PR-DOCS | PR-RECONCILIAÇÃO>
- **Contrato:** `docs/contratos/CONTRATO_PR{N}_<NOME>.md`
- **Data do review:** AAAA-MM-DD
- **Reviewer:** Claude Code (executor) → Claude (chat web — cérebro) → Bruno (aprovador final)

---

## RESUMO EXECUTIVO

<3-5 frases respondendo: o que foi feito, se atingiu o objetivo do contrato, qual o veredito final.>

---

## COMMITS REALIZADOS

| # | Hash | Arquivo(s) | Resumo |
|---|------|------------|--------|
| 1 | `<hash>` | `<arquivo>` | <resumo curto> |
| 2 | `<hash>` | `<arquivo>` | <resumo curto> |
| ... | | | |

---

## ANÁLISE CRITÉRIO-A-CRITÉRIO

Para cada critério de aceite do contrato, registrar com evidência.

### Critério 1: <texto do critério do contrato>

**Status:** ✅ PASS | ⚠️ PENDENTE | ❌ FAIL

**Verificação:**
<como foi verificado — comando rodado, arquivo lido, output observado>

**Evidência:**
```
<output do comando, ou trecho do código, ou descrição da prova>
```

**Observações:** <se houver>

---

### Critério 2: ...

(repetir)

---

## PROVA E2E EM PRODUÇÃO (CRÍTICA — sem ela, PR não pode ser mergeada)

### Comandos executados
```powershell
<comandos exatos rodados em produção real>
```

### Output completo
```
<output bruto dos comandos, sem edição>
```

### Análise do output
<o que o output prova? Qual estado esperado foi atingido?>

### Comparação com estado anterior
<o que mudou em relação ao estado pré-PR? Métrica antes vs depois.>

---

## TABELA RESUMO DE CRITÉRIOS

| # | Critério | Status | Evidência |
|---|----------|--------|-----------|
| 1 | <texto curto> | ✅ | <link/comando> |
| 2 | <texto curto> | ✅ | <link/comando> |
| ... | | | |

**Total:** X/Y critérios PASS

---

## INVARIANTES VERIFICADOS

| Invariante | Status |
|-----------|--------|
| `merge_allowed = false` ainda ativo | ✅/❌ |
| Nenhum deploy automático em PROD sem gate humano | ✅/❌ |
| GITHUB_TOKEN não sai do Worker | ✅/❌ |
| Safety Guard ativo em operação GitHub | ✅/❌ |
| <outros invariantes do contrato> | ✅/❌ |

---

## ARQUIVOS ALTERADOS (DIFF RESUMIDO)

| Arquivo | Linhas adicionadas | Linhas removidas | Resumo |
|---------|--------------------|--------------------|--------|
| `<arquivo>` | +X | -Y | <resumo> |

---

## ATUALIZAÇÕES OBRIGATÓRIAS DE GOVERNANÇA

Confirmar que TODOS foram atualizados nesta PR:

- [ ] `schema/contracts/INDEX.md` — entrada nova
- [ ] `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — entrada nova
- [ ] `schema/status/ENAVIA_STATUS_ATUAL.md` — entrada nova
- [ ] `schema/brain/SYSTEM_AWARENESS.md` — apenas se mudança de capacidade real
- [ ] `docs/canonico/PLANO_MACRO_ENAVIA.md` Seção 5 (HANDOFF) — entrada nova
- [ ] `docs/canonico/PLANO_MACRO_ENAVIA.md` GOVERNANÇA — status atualizado

**Sem todos os 5 (ou 6 se houver mudança de capacidade), a PR não pode ser mergeada.**

---

## BLOQUEIOS RESTANTES PÓS-MERGE

<O que ainda fica em aberto depois desta PR? Próxima PR já planejada? Issues conhecidos não resolvidos?>

---

## VEREDITO FINAL

**Status:** APROVADO PARA MERGE | REPROVADO | PENDENTE DE CORREÇÃO

**Justificativa:**
<1-3 frases. Se reprovado, listar exatamente o que precisa ser corrigido.>

**Próximo passo:**
<o que Bruno deve fazer agora — mergear, pedir correção, etc.>

---

**Reviewer:** Claude Code
**Data do review:** AAAA-MM-DD
**Aprovação Bruno:** <pendente | data e veredito>
