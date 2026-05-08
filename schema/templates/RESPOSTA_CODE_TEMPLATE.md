# RESPOSTA_CODE_TEMPLATE — Formato esperado das respostas do Claude Code

> Define o que Claude Code deve devolver em cada momento de uma PR.
> Bruno usa este documento para validar respostas do Code.
> Se a resposta não bate com este template, **Bruno recusa** e pede formato correto.

**Versão:** 1.0
**Data:** 2026-05-08
**Local no repo:** `schema/templates/RESPOSTA_CODE_TEMPLATE.md`

---

## MOMENTO 1 — Primeiro turno após Bruno colar o prompt

### Resposta esperada do Code:

```
WORKFLOW_ACK: ok

ARQUIVOS LIDOS (ordem do BOOTSTRAP_SESSAO.md Seção B.1):
1. CLAUDE.md ✅
2. BOOTSTRAP_SESSAO.md ✅
3. schema/canonico/PLANO_MACRO_ENAVIA.md ✅
4. schema/canonico/FLUXO_OPERACIONAL.md ✅
5. schema/contracts/INDEX.md ✅
6. schema/contracts/ACTIVE_CONTRACT.md ✅
7. schema/handoffs/ENAVIA_LATEST_HANDOFF.md ✅
8. schema/status/ENAVIA_STATUS_ATUAL.md ✅
9. schema/brain/SYSTEM_AWARENESS.md ✅
10. docs/contratos/CONTRATO_PR{N}_{NOME}.md ✅

ESTADO LIDO:
- Branch atual: {nome}
- Última PR mergeada: PR{X} ({hash do commit})
- Fase atual do roadmap: Fase {Y} — {nome da fase}
- Próxima PR planejada: PR{N} — {nome}
- Contrato ativo: {referência ou "nenhum macro ativo"}
- Bloqueios ativos detectados: {lista ou "nenhum"}
- Defasagem entre documentos canônicos: {sim/não — descrever se sim}

PR ALVO: PR{N} — {título do contrato}
CONTRATO LIDO: docs/contratos/CONTRATO_PR{N}_{NOME}.md

PLANO DE EXECUÇÃO (do contrato):
1. {commit/passo 1}
2. {commit/passo 2}
3. {commit/passo 3}
...

PERGUNTAS / DÚVIDAS / OBSERVAÇÕES:
- {nenhuma OU lista de pontos que precisam clareza antes de começar}

Aguardando OK explícito de Bruno antes de criar branch.
```

### O que Bruno valida:

✅ Tem a linha `WORKFLOW_ACK: ok`
✅ Lista os arquivos lidos com ✅ ou ❌
✅ Estado lido bate com a realidade do repo (Bruno pode confirmar via `git log`, `git status`)
✅ Identificou corretamente a PR alvo
✅ Plano de execução cita commits/passos do contrato
✅ Termina com "Aguardando OK explícito"

### Se algo está faltando:

Bruno responde:

```
ACK incompleto. Faltou: {item}.
Refaça antes de qualquer outra ação.
```

**NUNCA dar OK em ack incompleto.**

---

## MOMENTO 2 — Após Bruno dar "OK, prossiga"

### Resposta esperada do Code:

```
GOVERNANÇA ATUALIZADA:
- schema/canonico/PLANO_MACRO_ENAVIA.md seção GOVERNANÇA: "PR em execução agora: PR{N} — {título}"
- Commit dessa atualização: {hash}

BRANCH CRIADA: {nome-da-branch}

INICIANDO EXECUÇÃO conforme contrato.
```

A partir daí o Code executa cirurgicamente e reporta progresso conforme avança.

---

## MOMENTO 3 — Durante a execução (a cada commit relevante)

### Resposta esperada do Code (formato curto):

```
COMMIT {N} de {Total}: {tipo}({escopo}): {descrição}
HASH: {hash}
ARQUIVOS ALTERADOS:
- {arquivo1} (+X / -Y)
- {arquivo2} (+X / -Y)

CRITÉRIOS DO CONTRATO ATENDIDOS POR ESTE COMMIT:
- {critério 1}
- {critério 2}

PRÓXIMO PASSO: {commit/ação}
```

Não precisa ser verboso. Bruno só precisa de visibilidade sobre o que está acontecendo.

---

## MOMENTO 4 — Antes de declarar PR pronta para review

> ⚠️ Aqui é onde o Code **NÃO PODE pular etapas**. Cada item deste momento é obrigatório.

### Resposta esperada do Code:

```
EXECUÇÃO TÉCNICA CONCLUÍDA.

INICIANDO CHECKLIST_FIM_DE_PR (schema/templates/CHECKLIST_FIM_DE_PR.md):

[1] PR_REVIEW.md gerado: docs/PR{N}_REVIEW.md ✅
    - Análise critério-a-critério: COMPLETA
    - E2E em produção documentado: SIM com prova real
    - Tabela resumo de critérios: X/Y PASS

[2] schema/contracts/INDEX.md atualizado: ✅
    - Entrada nova adicionada usando template
    - Status da PR: Em review

[3] schema/handoffs/ENAVIA_LATEST_HANDOFF.md atualizado: ✅
    - Entrada nova adicionada no topo
    - Inclui commits, branch, review path, E2E result

[4] schema/status/ENAVIA_STATUS_ATUAL.md atualizado: ✅
    - Estado refletindo PR{N}

[5] schema/canonico/PLANO_MACRO_ENAVIA.md HANDOFF (Seção 5): ✅
    - Entrada cronológica adicionada

[6] schema/canonico/PLANO_MACRO_ENAVIA.md GOVERNANÇA (topo): ✅
    - "Última atualização: {data}"
    - "PR em execução agora: nenhuma"
    - "Próxima PR planejada: PR{N+1}"

[7] schema/contracts/ACTIVE_CONTRACT.md atualizado: {SIM/NÃO/NÃO_APLICÁVEL}
    {se aplicável: descrever mudança}

[8] schema/brain/SYSTEM_AWARENESS.md atualizado: {SIM/NÃO/NÃO_APLICÁVEL}
    {se aplicável: descrever capacidade alterada}

PR ABERTA NO GITHUB: #{numero} — {URL}

E2E EM PRODUÇÃO:
- Comandos executados: {lista}
- Output: {resumo + link pra docs/PR{N}_REVIEW.md seção E2E}
- Resultado: {PASS/FAIL com justificativa}

INVARIANTES VERIFICADOS:
- merge_allowed = false: ✅
- {outros invariantes do contrato}: ✅

PR PRONTA PARA REVIEW.
Aguardando análise de Claude (chat web) e aprovação de Bruno.
```

### O que Bruno valida:

✅ Os 8 itens do checklist têm marca clara (✅, NÃO_APLICÁVEL com justificativa, ou ❌)
✅ PR_REVIEW.md existe e está em `docs/PR{N}_REVIEW.md`
✅ E2E foi executado com prova real (não validação estática)
✅ Invariantes verificados
✅ Termina com "PR PRONTA PARA REVIEW"

### Se algum item está ❌ ou pulado:

Bruno responde:

```
PR não pronta. Item {X} pendente: {detalhe}.
Resolva antes de declarar pronta.
```

---

## MOMENTO 5 — Após Bruno mergear (próxima sessão ou imediato)

### Resposta esperada do Code (quando Bruno reabre Code para próxima PR):

```
WORKFLOW_ACK: ok

PR ANTERIOR (PR{N}):
- Status: MERGEADA
- Commit do merge: {hash}
- Branch local deletada: ✅
- main local sincronizada: ✅

GOVERNANÇA ATUALIZADA:
- "Última PR mergeada: PR{N}"
- "Fase atual: {fase, atualizada se PR fechou fase}"

[continua com WORKFLOW_ACK normal para a próxima PR]
```

---

## MOMENTO 6 — Reportando bloqueio durante execução

### Resposta esperada do Code:

```
🛑 BLOQUEIO DETECTADO.

CONTEXTO:
- PR atual: PR{N}
- Passo do contrato: {passo}
- Última ação executada: {ação}

PROBLEMA:
{descrição clara do bloqueio}

AVALIAÇÃO:
- Conflito com contrato: {sim/não}
- Necessidade de mudança fora do escopo: {sim/não}
- Bug crítico em produção descoberto: {sim/não}
- Dúvida de interpretação: {sim/não}

EXECUÇÃO PAUSADA. GOVERNANÇA ATUALIZADA:
- Bloqueios ativos: "{descrição curta}"

AGUARDANDO ORIENTAÇÃO DE BRUNO.
```

**Importante:** Code **NÃO** improvisa solução. Para, reporta, espera.

---

## MOMENTO 7 — Reportando conclusão de tarefa de diagnóstico (não é PR de código)

### Resposta esperada do Code:

```
DIAGNÓSTICO {nome} CONCLUÍDO.

ARQUIVOS GERADOS:
- {caminho/arquivo1.md}
- {caminho/arquivo2.md}
- ...

RESUMO EXECUTIVO:
{2-4 frases sobre o que foi descoberto}

PRINCIPAIS BANDEIRAS:
🔴 {item crítico se houver}
🟡 {item de atenção se houver}
🟢 {confirmação positiva se houver}

NENHUM CÓDIGO MODIFICADO. NENHUM COMMIT FEITO.

Aguardando análise de Claude (chat web) e Bruno.
```

---

## REGRAS UNIVERSAIS

### R1 — Code não auto-aprova

Em nenhum momento o Code declara "tarefa concluída e mergeada" por conta própria. Mesmo que tenha permissão técnica de fazer merge, o ritual é Bruno quem mergeia (ou Claude chat web aprovar e Bruno mergear).

### R2 — Code não pula checklist

O CHECKLIST_FIM_DE_PR é obrigatório. Se algum item não pode ser cumprido, marcar `❌` ou `NÃO_APLICÁVEL com justificativa`. **Nunca omitir.**

### R3 — Code reporta com honestidade

Se algo deu errado, reportar errado. Não maquiar. Não "deixar pra próxima". Honestidade > velocidade.

### R4 — Code não começa próxima PR sem fechar a anterior

Se PR{N} ainda está em review, não começar PR{N+1}. Cada PR é unidade fechada.

### R5 — Code não atualiza schema/ silenciosamente

Toda atualização de arquivo canônico tem que estar listada no checklist do MOMENTO 4. Se atualizou sem listar, é falha de governança.

---

## EXEMPLO DE RECUSA POR BRUNO

```
Code respondeu: "PR pronta para review."
[mas não listou o checklist completo]

Bruno responde:

PR não pronta. Faltou checklist completo do MOMENTO 4
(schema/templates/RESPOSTA_CODE_TEMPLATE.md).

Mostre os 8 itens do CHECKLIST_FIM_DE_PR antes de declarar pronta.
```

Isso protege o ritual.

---

**Fim do RESPOSTA_CODE_TEMPLATE.md v1.0.**
