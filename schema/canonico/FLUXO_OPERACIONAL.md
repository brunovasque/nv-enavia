# FLUXO_OPERACIONAL — Como Bruno, Claude (chat web) e Claude Code trabalham juntos

> Documento canônico vinculante.
> Define os 3 papéis e o ciclo completo de execução de qualquer PR no projeto Enavia.
> Toda PR daqui em diante segue este fluxo.

**Versão:** 1.0
**Data:** 2026-05-08
**Local no repo:** `schema/canonico/FLUXO_OPERACIONAL.md`
**Aprovado por:** Bruno Vasques

---

## SEÇÃO 1 — OS 3 PAPÉIS

O projeto Enavia opera com **3 atores complementares**. Cada um tem responsabilidade exclusiva. Ninguém faz o trabalho do outro.

### 1.1 Bruno Vasques — Aprovador

**Papel:** dono do projeto, decide direção estratégica, aprova contratos, revisa entregas, mergeia PRs.

**Faz:**
- Define objetivos de alto nível ("preciso resolver X", "quero capacidade Y")
- Aprova contratos canônicos antes da execução
- Salva contratos no repo (`docs/contratos/CONTRATO_PR{N}_*.md`)
- Cola prompts no terminal do Claude Code
- Revisa PRs (lê o `PR_REVIEW.md` gerado pelo Code)
- Aprova merge OU pede correção
- Mergeia no GitHub
- Faz `git pull` em todas as máquinas/abas após merge

**Não faz:**
- Não escreve código de runtime (delegado ao Claude Code)
- Não escreve contratos (delegado a Claude chat web)
- Não revisa contratos sozinho (Claude chat web revisa o PR_REVIEW antes)

### 1.2 Claude (chat web) — Cérebro Estratégico

**Papel:** pensa, diagnostica, planeja, escreve contratos, revisa entregas, orienta estratégia.

**Faz:**
- Lê diagnósticos e estado do repo
- Monta contratos canônicos como **artifact baixável** (`.md` pronto pra Bruno salvar)
- Decide prioridade de PRs (alinhado ao roadmap do plano cabresto)
- Revisa o `PR_REVIEW.md` do Code contra o contrato
- Aprova entrega para merge OU pede correção específica
- Calibra próximos passos com base no estado vivo do projeto
- Mantém visão estratégica do projeto

**Não faz:**
- **Não tem acesso filesystem direto** ao repo (limitação técnica). Trabalha via conversa com Bruno e arquivos colados no chat
- Não executa código diretamente
- Não abre PRs diretamente — sempre via Code
- **Não tem memória entre sessões.** Cada aba começa do zero. Toda informação de estado deve estar em arquivos versionados no repo

**Limitação crítica conhecida:** se Bruno trocar de aba, máquina ou IA, o novo Claude começa **sem nenhum contexto**. Por isso o repo precisa estar sempre atualizado com o estado vivo (ver `schema/canonico/CONTEXTO_NOVA_ABA.md`).

### 1.3 Claude Code (terminal local) — Executor

**Papel:** lê código real, implementa, testa, abre PRs, gera reviews.

**Faz:**
- Lê `CLAUDE.md` automaticamente ao iniciar sessão
- Segue ritual obrigatório do `BOOTSTRAP_SESSAO.md` (Seção B)
- Cria branches conforme contrato
- Implementa commits atômicos cirurgicamente
- Abre PRs no GitHub
- Gera `docs/PR{N}_REVIEW.md` analisando critério-a-critério contra o contrato
- **Executa E2E em produção** quando o contrato exige
- **Atualiza os 8 arquivos canônicos** do `schema/` antes de fechar a tarefa (ver Seção 4 deste documento)
- Reporta a Bruno aguardando aprovação

**Não faz:**
- Não desvia do contrato sem adendo formal aprovado por Bruno
- Não declara tarefa concluída sem cumprir os 6 critérios de "feito" (ver Seção 4.5 do plano cabresto)
- Não decide arquitetura — se descobrir conflito ou necessidade de mudança fora do escopo, **PARA e reporta**

---

## SEÇÃO 2 — CICLO COMPLETO DE UMA PR

Toda PR (PR130 em diante) segue exatamente esta sequência. Sem improviso, sem atalho.

```
┌─────────────────────────────────────────────────────────────┐
│ PASSO 1 — Bruno descreve objetivo a Claude (chat web)       │
│   "Preciso de X" / "Quero resolver Y"                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 2 — Claude (chat web) monta contrato                  │
│   Lê estado vivo do repo (8 arquivos canônicos)             │
│   Verifica alinhamento com roadmap                          │
│   Escreve contrato como ARTIFACT BAIXÁVEL (.md)             │
│   Indica caminho exato: docs/contratos/CONTRATO_PR{N}_*.md  │
│   Entrega prompt pronto pra colar no Code                   │
│   Lista pontos de atenção pra Bruno monitorar               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 3 — Bruno salva e aprova contrato                     │
│   Baixa o artifact                                          │
│   Salva em docs/contratos/CONTRATO_PR{N}_*.md               │
│   git add + commit + push (em branch da PR)                 │
│   Lê o contrato — se concordar, segue; se não, ajusta       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 4 — Bruno cola prompt fixo no Claude Code             │
│   Usa template em schema/templates/PROMPT_CODE_TEMPLATE.md  │
│   Prompt curto: "Leia CLAUDE.md. Execute PR{N} conforme     │
│   contrato em docs/contratos/CONTRATO_PR{N}_*.md.           │
│   Responda WORKFLOW_ACK antes de qualquer ação."            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 5 — Claude Code executa o ritual                      │
│   5.1 Lê CLAUDE.md (automático)                             │
│   5.2 Lê BOOTSTRAP_SESSAO.md → 8 arquivos canônicos         │
│   5.3 Lê contrato da PR específica                          │
│   5.4 Responde WORKFLOW_ACK listando estado lido            │
│   5.5 Atualiza GOVERNANÇA do plano (PR em execução agora)   │
│   5.6 Aguarda OK explícito de Bruno antes de codar          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 6 — Bruno valida WORKFLOW_ACK                         │
│   Se ack está completo e correto → "OK, prossiga"           │
│   Se ack está incompleto/errado → recusa e pede ack correto │
│   ⚠️ NUNCA aceitar resposta sem ack válido                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 7 — Claude Code implementa                            │
│   Cria branch conforme contrato                             │
│   Commits atômicos cirúrgicos                               │
│   Não desvia do contrato sem reportar a Bruno               │
│   Executa E2E em produção quando contrato exige             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 8 — Claude Code atualiza schema/ (OBRIGATÓRIO)        │
│   schema/contracts/INDEX.md ← entrada nova                  │
│   schema/handoffs/ENAVIA_LATEST_HANDOFF.md ← entrada nova   │
│   schema/status/ENAVIA_STATUS_ATUAL.md ← entrada nova       │
│   schema/brain/SYSTEM_AWARENESS.md ← se mudou capacidade    │
│   schema/canonico/PLANO_MACRO_ENAVIA.md HANDOFF ← entrada   │
│                                                              │
│   Usa templates em schema/templates/                        │
│   Roda checklist em schema/templates/CHECKLIST_FIM_DE_PR.md │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 9 — Claude Code abre PR e gera PR_REVIEW.md           │
│   Abre PR no GitHub com título e descrição claros           │
│   Gera docs/PR{N}_REVIEW.md (template em schema/templates)  │
│   Documenta E2E em produção com prova real                  │
│   Reporta a Bruno: "PR pronta para review"                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 10 — Bruno traz PR_REVIEW.md para Claude (chat web)   │
│   Cola conteúdo do PR_REVIEW.md no chat                     │
│   Eventualmente cola diff de arquivos críticos              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 11 — Claude (chat web) revisa contra contrato         │
│   Verifica critério a critério                              │
│   Confere E2E em produção                                   │
│   Verifica que schema/ foi atualizado                       │
│   Veredito: APROVADO PARA MERGE / PEDE CORREÇÃO             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌────────────────────┐              ┌──────────────────────┐
│ PASSO 12a — APROVA │              │ PASSO 12b — CORREÇÃO │
│ Bruno mergeia      │              │ Claude (chat) escreve│
│ no GitHub          │              │ adendo ao contrato   │
│ git pull main      │              │ Volta ao Passo 4     │
│ Sincroniza local   │              │ com contrato corrig. │
└──────────┬─────────┘              └──────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 13 — Atualização final pós-merge                      │
│   Claude Code (próxima sessão) ou Bruno:                    │
│     git pull origin main                                    │
│     Atualiza HANDOFF status: MERGEADA + commit              │
│     Atualiza GOVERNANÇA: última PR mergeada                 │
└─────────────────────────────────────────────────────────────┘
```

---

## SEÇÃO 3 — REGRAS DE COMUNICAÇÃO

### 3.1 Claude (chat web) → Bruno

**Sempre que entregar contrato:**
- Como **artifact baixável** (`.md`), nunca como bloco de texto no chat
- Indicar caminho exato de salvamento
- Incluir prompt fechado pra colar no Code (em bloco de código separado)
- Listar **pontos de atenção** específicos que Bruno deve monitorar no review
- Tom direto, sem floreio

**Padrão visual da entrega:**

```markdown
[breve resumo do que o contrato cobre]

Salva em `docs/contratos/CONTRATO_PR{N}_<NOME>.md` e cola este prompt no Claude Code:

```
Leia o CLAUDE.md.
Execute a PR{N} conforme o contrato em docs/contratos/CONTRATO_PR{N}_<NOME>.md.
Responda WORKFLOW_ACK antes de qualquer ação.
```

Pontos de atenção pra você ficar de olho no review:

1. [item específico 1]
2. [item específico 2]
3. [item específico 3]

[ARTIFACT do contrato como arquivo baixável aqui]
```

### 3.2 Bruno → Claude Code

**Sempre que cola prompt:**
- Usa o **template fixo** em `schema/templates/PROMPT_CODE_TEMPLATE.md`
- Não improvisa cada vez
- Curto e fechado — `CLAUDE.md` força o resto

### 3.3 Claude Code → Bruno

**Primeiro turno de qualquer sessão:**
- Responde com `WORKFLOW_ACK: ok` listando estado lido (formato em `BOOTSTRAP_SESSAO.md` Seção B.1)
- **NÃO** começa a codar antes do OK explícito de Bruno

**Ao final de qualquer tarefa:**
- Reporta no formato em `schema/templates/RESPOSTA_CODE_TEMPLATE.md`
- Confirma que rodou o `CHECKLIST_FIM_DE_PR.md`
- Aguarda revisão sem auto-declarar "concluída"

### 3.4 Bruno → Claude (chat web)

**Ao trazer review:**
- Cola conteúdo de `docs/PR{N}_REVIEW.md`
- Se houver dúvida específica, descreve em 1-2 linhas
- Não precisa colar todo o diff — Claude pede partes específicas se precisar

---

## SEÇÃO 4 — REGRA DE ATUALIZAÇÃO DOS 8 ARQUIVOS CANÔNICOS

> **CRÍTICA E NÃO-NEGOCIÁVEL.** Este é o mecanismo que mantém o cabresto vivo entre sessões.

Ao final de **toda** PR, antes de marcá-la como "pronta para review", o Claude Code deve atualizar os arquivos canônicos relevantes:

### Sempre atualiza (em toda PR):

1. **`schema/contracts/INDEX.md`** — adiciona entrada da PR (template em `schema/templates/HANDOFF_INDEX_STATUS_TEMPLATES.md`)
2. **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** — adiciona entrada nova no topo
3. **`schema/status/ENAVIA_STATUS_ATUAL.md`** — atualiza com PR atual
4. **`schema/canonico/PLANO_MACRO_ENAVIA.md`** seção HANDOFF (Seção 5) — adiciona entrada cronológica
5. **`schema/canonico/PLANO_MACRO_ENAVIA.md`** seção GOVERNANÇA (topo) — atualiza "PR em execução / próxima PR / última mergeada"

### Atualiza condicionalmente:

6. **`schema/contracts/ACTIVE_CONTRACT.md`** — se a PR fecha um contrato macro ou inicia um novo
7. **`schema/brain/SYSTEM_AWARENESS.md`** — se a PR introduz, remove ou modifica capacidade do sistema
8. **`schema/brain/self-model/current-state.md`** + **`capabilities.md`** — se há mudança significativa de capacidade real

### Fail-loud:

Se o Claude Code não consegue atualizar algum desses arquivos (conflito, schema diferente, dúvida sobre semântica), **PARA e reporta a Bruno**. Não improvisa, não pula. PR não pode ser declarada pronta sem atualização.

---

## SEÇÃO 5 — REGRAS DE EXCEÇÃO

### 5.1 PRs de governança pura

Algumas PRs (como a do cabresto v2 — PR #298) não têm contrato anterior porque **são** o que estabelece o ritual. Nessas:

- Justifica explicitamente na descrição da PR
- Cumpre os outros critérios na medida do possível
- Mergeada por decisão direta de Bruno

Essa exceção é **rara e justificada**. Não vira regra.

### 5.2 PRs de emergência (hotfix)

Se houver bug crítico em produção que exige fix imediato:

- Bruno autoriza desvio do ritual explicitamente
- Claude Code abre PR mínima resolvendo só o bug
- Após merge, **PR-DEBITO** é aberta logo em seguida cobrindo o que foi pulado (PR_REVIEW completo, atualização de schema/, etc.)

Nunca deixar dívida acumular silenciosamente.

### 5.3 Adendos a contratos em execução

Se durante execução o Code descobre que o contrato precisa ajuste:

- Para a execução
- Reporta a Bruno via Claude Code: "Contrato exige ajuste em [item], razão: [motivo]"
- Bruno traz pra Claude (chat web)
- Claude (chat web) escreve **adendo formal** ao contrato (não reescrita) como artifact baixável
- Bruno salva o adendo em `docs/contratos/CONTRATO_PR{N}_ADENDO_001.md`
- Code retoma execução com o adendo

---

## SEÇÃO 6 — VALIDAÇÕES PERIÓDICAS

### 6.1 A cada 5 PRs mergeadas

Bruno verifica (manualmente ou pedindo a Claude chat web):

- Os 8 arquivos canônicos estão atualizados?
- O `INDEX.md` reflete o estado real?
- O `SYSTEM_AWARENESS.md` cita capacidades que existem de fato?

Se sim → ritual está saudável.
Se não → bug de governança detectado, abrir PR-RECONCILIAÇÃO imediata.

### 6.2 Início de cada fase do roadmap

Bruno e Claude (chat web) revisam:

- A fase anterior foi entregue conforme critério de "feito" da fase?
- Há débito acumulado em `schema/`?
- O roadmap precisa de adendo (recalibração)?

---

## SEÇÃO 7 — ANTI-FRAGILIDADE ENTRE ABAS

Esta seção responde diretamente à preocupação de Bruno:
*"Mesmo que inicie nova aba sem você saber de absolutamente nada, quando eu trouxer os docs mínimos pra você, você já entende todo o contexto."*

### 7.1 O contrato

**Sempre que Bruno abre uma aba nova de Claude (chat web):**

1. Bruno roda o comando em `schema/canonico/CONTEXTO_NOVA_ABA.md` (gera `BOOTSTRAP_LEITURA.txt`)
2. Bruno cola o conteúdo no início da conversa
3. Claude (nova aba) lê tudo e confirma `WORKFLOW_ACK` listando o estado lido
4. Claude (nova aba) opera com contexto completo

### 7.2 O que garante que isso funcione

A garantia está em **3 camadas**:

1. **Os 8 arquivos canônicos sempre atualizados** (regra da Seção 4 deste documento)
2. **O `CONTEXTO_NOVA_ABA.md` documenta o procedimento** literalmente
3. **O Claude Code é responsável** por atualizar os arquivos ao fim de cada PR (regra obrigatória)

Se qualquer uma das 3 camadas falhar, a anti-fragilidade quebra. Por isso a Seção 4 é não-negociável.

---

## SEÇÃO 8 — REVISÃO DESTE DOCUMENTO

Este documento é **vivo**. Pode evoluir conforme o projeto amadureça. Mudanças seguem o ritual:

- Adendo formal aprovado por Bruno
- Versão incrementada (1.0 → 1.1 → 2.0 conforme magnitude)
- Entrada em HANDOFF do plano cabresto

Não pode ser editado silenciosamente. Toda mudança é PR.

---

**Fim do FLUXO_OPERACIONAL.md v1.0.**
