# PROMPT_CODE_TEMPLATE — Template fixo do prompt para Claude Code

> Template canônico do prompt que Bruno cola no Claude Code ao iniciar uma PR.
> Usar este template **sem improvisar**. O `CLAUDE.md` v2 e o `BOOTSTRAP_SESSAO.md` forçam o resto.

**Versão:** 1.0
**Data:** 2026-05-08
**Local no repo:** `schema/templates/PROMPT_CODE_TEMPLATE.md`

---

## TEMPLATE PADRÃO — Início de PR nova

Bruno cola exatamente isto no terminal do Claude Code:

```
Leia o CLAUDE.md.
Execute a PR{N} conforme o contrato em docs/contratos/CONTRATO_PR{N}_{NOME_CURTO}.md.

Antes de qualquer ação, responda WORKFLOW_ACK conforme exigido pelo BOOTSTRAP_SESSAO.md (Seção B.1).
Aguarde meu OK antes de criar branch ou tocar em código.
```

**Substitui apenas:**
- `{N}` → número da PR (ex: `130`, `131`)
- `{NOME_CURTO}` → nome curto canônico do contrato (ex: `RECONCILIACAO_INDEX`, `TIPAGEM_ERROS_PATCH_SAFE`)

Tudo mais é fixo.

---

## VARIAÇÕES (usar apenas quando aplicável)

### Variação 1 — Continuação de PR já em andamento

Quando Bruno está retomando uma PR onde o Code já tinha começado (ex: nova sessão, mesma PR):

```
Leia o CLAUDE.md.
Continue a execução da PR{N} (branch {nome-da-branch}).
Contrato em docs/contratos/CONTRATO_PR{N}_{NOME_CURTO}.md.

Antes de continuar, responda WORKFLOW_ACK confirmando:
- Onde a execução parou (último commit da branch)
- Próximo passo do contrato a executar
- Se há bloqueios ou dúvidas
```

### Variação 2 — PR com adendo formal

Quando o contrato original foi estendido com adendo:

```
Leia o CLAUDE.md.
Execute a PR{N} conforme:
- Contrato base: docs/contratos/CONTRATO_PR{N}_{NOME_CURTO}.md
- Adendo: docs/contratos/CONTRATO_PR{N}_ADENDO_001.md

Antes de qualquer ação, responda WORKFLOW_ACK e confirme leitura do contrato + adendo.
```

### Variação 3 — PR de correção pós-review

Quando Claude (chat web) reprovou o PR_REVIEW e pediu correções específicas:

```
Leia o CLAUDE.md.
Aplique as correções na PR{N} (branch {nome-da-branch}) conforme docs/contratos/CONTRATO_PR{N}_CORRECOES_001.md.

Antes de qualquer alteração, responda WORKFLOW_ACK incluindo:
- Lista das correções pendentes
- Ordem de aplicação
- Estimativa de impacto em outros critérios do contrato original
```

### Variação 4 — Tarefa de diagnóstico read-only (não é PR de código)

Quando Bruno quer diagnóstico sem alterar código:

```
Leia o CLAUDE.md.
Tarefa de diagnóstico READ-ONLY conforme docs/contratos/DIAGNOSTICO_{NOME_CURTO}.md.

Não criar branch. Não modificar código. Não commitar.
Gerar arquivos de output em docs/diagnostico-{data}/.

Antes de qualquer ação, responda WORKFLOW_ACK e liste os arquivos que serão gerados.
```

---

## REGRAS DE OURO

### 1. Brevidade é proteção

O prompt é curto **de propósito**. Cada linha extra é oportunidade de improviso, esquecimento ou contradição com o `CLAUDE.md`. Toda regra de execução já está no `CLAUDE.md` v2 + `BOOTSTRAP_SESSAO.md` + `FLUXO_OPERACIONAL.md`. Repetir aqui é dívida.

### 2. WORKFLOW_ACK é checkpoint, não formalidade

Se o Code responder sem ack, ou com ack incompleto, **Bruno recusa** e pede ack válido antes de qualquer outra coisa. Isso é o que blinda contra "Code começa a codar sem ler o contrato".

### 3. "Aguarde meu OK" é literal

O Code não deve criar branch nem tocar em código antes de Bruno confirmar explicitamente que o ack está aceito.

### 4. Variar o template requer justificativa

Se Bruno achar que precisa adicionar instrução fora dos templates acima, isso é sinal de que algum documento canônico não está cumprindo seu papel. Em vez de inflar o prompt, atualizar o `CLAUDE.md` ou `FLUXO_OPERACIONAL.md` em PR específica.

---

## ANTI-PATTERN — NUNCA fazer isto

```
❌ Leia o CLAUDE.md, depois leia o PLANO_MACRO_ENAVIA.md, depois leia o INDEX.md,
   depois leia o ACTIVE_CONTRACT.md, depois leia o HANDOFF, depois leia o STATUS,
   depois leia o SYSTEM_AWARENESS, depois leia o contrato da PR130, e antes de
   qualquer ação responda WORKFLOW_ACK listando estado, e crie a branch
   pr130-reconciliacao-index, e implemente os commits atômicos, e gere o
   PR_REVIEW.md, e atualize o INDEX.md, e atualize o HANDOFF, e...
```

**Por quê é errado:**

- Se você precisa repetir todas as regras no prompt, é porque o `CLAUDE.md` não está sendo respeitado
- Cada repetição é fonte de contradição (você esquece um item, Code segue a versão sem o item)
- Quanto mais longo, mais o Code corta cantos
- O cabresto v2 existe pra evitar isso

---

## EXEMPLO REAL — PR130a (Reconciliação INDEX)

```
Leia o CLAUDE.md.
Execute a PR130a conforme o contrato em docs/contratos/CONTRATO_PR130a_RECONCILIACAO_INDEX.md.

Antes de qualquer ação, responda WORKFLOW_ACK conforme exigido pelo BOOTSTRAP_SESSAO.md (Seção B.1).
Aguarde meu OK antes de criar branch ou tocar em código.
```

São 4 linhas. Acabou. O `CLAUDE.md` faz o resto.

---

**Fim do PROMPT_CODE_TEMPLATE.md v1.0.**
