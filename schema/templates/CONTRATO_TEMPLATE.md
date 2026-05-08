# CONTRATO PR{N} — <TÍTULO CURTO E DESCRITIVO>

> Template de contrato canônico para PRs do projeto nv-enavia.
> Preencher todos os campos. Não deletar seções — marcar "N/A" se não se aplicar.
> Salvar em `docs/contratos/CONTRATO_PR{N}_<NOME_CURTO>.md`.

---

## METADADOS

- **PR:** PR{N}
- **Tipo:** PR-DIAG | PR-IMPL | PR-PROVA | PR-DOCS | PR-RECONCILIAÇÃO
- **Escopo:** Worker-only | Executor-only | Deploy-worker-only | Panel-only | Docs-only | Multi
- **Branch:** `<tipo>/pr{N}-<nome-curto-kebab>`
- **Fase do roadmap:** <Pré-0 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>
- **Contrato pai (se houver):** <link ou "N/A">
- **PRs relacionadas:** <lista ou "nenhuma">
- **Data de criação:** AAAA-MM-DD
- **Aprovado por Bruno em:** <data ou "pendente">

---

## CONTEXTO

### Problema observado
<Descrever o problema em 1-3 frases. Qual sintoma motivou esta PR?>

### Diagnóstico (causa raiz identificada)
<O que causa o problema? Apontar para diagnóstico em `docs/` ou `schema/reports/` se houver.>

### Por que agora
<Por que esta PR deve acontecer neste ponto da sequência? Qual fase do roadmap habilita?>

---

## OBJETIVO

<Frase única e objetiva sobre o que esta PR resolve. Não vaga, não ambiciosa demais.>

**Esta PR NÃO faz:**
- <O que está fora do escopo, mesmo que pareça relacionado>
- <Outras coisas que ficam para PRs futuras>

---

## ESCOPO

### Arquivos que serão tocados
- `<caminho>/<arquivo>.<ext>` — <razão>
- `<caminho>/<arquivo>.<ext>` — <razão>

### Arquivos PROIBIDOS de tocar
- <listar explicitamente o que não pode ser tocado>

### Bindings, secrets, env vars afetados
- <listar ou "nenhum">

### Rotas/endpoints afetados
- <listar ou "nenhum">

### KV keys afetadas
- <listar ou "nenhum">

---

## MUDANÇAS CIRÚRGICAS

### Mudança 1 — <nome curto>

**Arquivo:** `<caminho>`

**ANTES:**
```<linguagem>
<código atual exato, com contexto suficiente para localizar — 2 a 4 linhas únicas>
```

**DEPOIS:**
```<linguagem>
<código novo exato>
```

**Razão:** <1-2 frases explicando por que esta mudança específica>

---

### Mudança 2 — <nome curto>

(repetir estrutura)

---

## CRITÉRIOS DE ACEITE

Lista numerada de critérios verificáveis. Cada um deve ter prova objetiva.

1. **<critério>** — <como verificar>
2. **<critério>** — <como verificar>
3. **<critério>** — <como verificar>
...

---

## TESTE OBRIGATÓRIO (E2E em produção)

### Comandos de validação
```powershell
<comandos PowerShell que validam que a mudança funciona em produção real>
```

### Resultado esperado
<output exato esperado, ou descrição do estado esperado>

### Se falhar
<o que fazer — rollback automático? alerta? PR de correção?>

---

## COMMITS ATÔMICOS

Sequência exata de commits a serem feitos:

1. **`<arquivo>: <mensagem-curta>`** — <descrição>
2. **`<arquivo>: <mensagem-curta>`** — <descrição>
3. **`docs/PR{N}_REVIEW.md`** — Review canônico

---

## INVARIANTES (NUNCA QUEBRAR)

- `merge_allowed = false` permanece (até Fase 3 da blindagem contratual)
- Nenhum deploy automático em PROD sem gate humano
- GITHUB_TOKEN nunca sai do Worker para fora
- Safety Guard ativo em toda operação GitHub real
- Confirmação humana antes de execute_next
- <invariantes específicas desta PR>

---

## RISCOS

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| <descrição> | Baixa/Média/Alta | Baixo/Médio/Alto | <como mitigar> |

---

## ROLLBACK

### Como reverter se algo der errado
```powershell
<comandos para reverter — git revert, redeploy de versão anterior, etc.>
```

### Estado esperado pós-rollback
<como o sistema deve ficar se a PR for revertida>

---

## ATUALIZAÇÃO OBRIGATÓRIA DE GOVERNANÇA

Esta PR, ao ser fechada, deve atualizar:

- [ ] `schema/contracts/INDEX.md` — entrada nova (template em `schema/templates/INDEX_ENTRY_TEMPLATE.md`)
- [ ] `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — entrada nova (template em `schema/templates/HANDOFF_ENTRY_TEMPLATE.md`)
- [ ] `schema/status/ENAVIA_STATUS_ATUAL.md` — entrada nova
- [ ] `schema/brain/SYSTEM_AWARENESS.md` — apenas se houver mudança de capacidade real
- [ ] `docs/canonico/PLANO_MACRO_ENAVIA.md` Seção 5 — entrada de HANDOFF
- [ ] `docs/canonico/PLANO_MACRO_ENAVIA.md` GOVERNANÇA — atualizar status

---

## PROMPT PARA O CLAUDE CODE

Cole no terminal local após salvar este contrato em `docs/contratos/`:

```
Leia BOOTSTRAP_SESSAO.md, CLAUDE.md, e docs/canonico/PLANO_MACRO_ENAVIA.md.
Leia o contrato em docs/contratos/CONTRATO_PR{N}_<NOME>.md.
Confirme leitura com WORKFLOW_ACK.

Execute conforme o contrato:
- Atualize GOVERNANÇA do Plano Macro com "PR em execução agora: PR{N}"
- Crie a branch <tipo>/pr{N}-<nome-curto-kebab>
- Implemente os commits atômicos na sequência definida
- Execute o teste E2E em produção e documente o resultado real
- Ao abrir a PR, gere docs/PR{N}_REVIEW.md (template em schema/templates/)
- Atualize os 4 documentos canônicos do schema/
- Atualize HANDOFF e GOVERNANÇA do Plano Macro
- Não feche a tarefa sem todos os 6 critérios de "feito" atendidos
```

---

**Fim do contrato.**

**Aprovação Bruno:** <pendente | data e nome>
