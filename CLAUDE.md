# CLAUDE.md — REPO nv-enavia (v2)

> Este arquivo é lido **automaticamente pelo Claude Code** ao iniciar qualquer sessão neste repositório.
> É o cabresto operacional. Toda ação derivada de qualquer prompt segue as regras abaixo.
>
> **Versão 2** — Integrado com a estrutura `schema/` (fonte primária canônica).

---

## REGRA Nº 1 — BOOTSTRAP DE SESSÃO (em qualquer máquina, qualquer aba)

**Antes de qualquer ação, executar:**

1. `git pull origin main` — sincronizar local com repo
2. Ler `BOOTSTRAP_SESSAO.md` na raiz do repo — primeira leitura obrigatória
3. Ler este arquivo (`CLAUDE.md`) inteiro
4. Ler **`docs/canonico/PLANO_MACRO_ENAVIA.md`** — visão estratégica e roadmap
5. Ler `schema/contracts/INDEX.md` — qual contrato está ativo
6. Ler `schema/contracts/ACTIVE_CONTRACT.md` — ponteiro curto
7. Ler `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — último estado
8. Ler `schema/status/ENAVIA_STATUS_ATUAL.md` — última PR
9. Ler `schema/brain/SYSTEM_AWARENESS.md` — capacidade atual

Se qualquer arquivo não existir ou não puder ser lido, **PARAR e reportar a Bruno**. Não improvisar.

Se houver **defasagem** entre os documentos (ex: INDEX parado em PRX, mas STATUS está em PRY > PRX), **PARAR e reportar**. Defasagem é bug.

---

## REGRA Nº 2 — VINCULAÇÃO AO PLANO MACRO + `schema/`

Nenhuma PR pode ser aberta, executada ou fechada sem:

1. **Constar no roadmap** (Seção 3 do Plano Macro) ou ter sido aprovada como adendo formal por Bruno
2. **Ter contrato canônico** em `docs/contratos/CONTRATO_PR{N}_*.md` aprovado por Bruno
3. **Atualizar GOVERNANÇA** do Plano Macro **antes** de iniciar
4. **Cumprir os 6 critérios de "feito"** (Seção 3.5 do Plano Macro):
   - Contrato canônico aprovado
   - Implementação cirúrgica conforme contrato
   - PR_REVIEW.md com análise critério-a-critério
   - **E2E em produção executado e documentado** (não só estático)
   - Aprovação Bruno baseada em prova comportamental
   - **`schema/` atualizado** (4 documentos: INDEX, HANDOFF, STATUS, brain/SYSTEM_AWARENESS se aplicável)

**Sem qualquer um dos 6, não mergeia.**

---

## REGRA Nº 3 — RITUAL DE EXECUÇÃO

### Antes de iniciar a tarefa:

1. Bootstrap (Regra Nº 1) — ler tudo
2. Ler o contrato específico da PR em `docs/contratos/CONTRATO_PR{N}_*.md`
3. Verificar GOVERNANÇA do Plano Macro:
   - PR alinhada com fase atual?
   - Há bloqueios ativos?
   - PR anterior concluída e mergeada?
4. **Atualizar GOVERNANÇA** do Plano Macro:
   - "PR em execução agora: PR{N} — título"
   - "Última atualização: data atual"
5. Aguardar OK explícito de Bruno antes de tocar em código

### Durante a execução:

1. Seguir contrato cirurgicamente — nenhum desvio sem adendo formal
2. Commits atômicos conforme sequência definida no contrato
3. Se descobrir que o contrato precisa ajuste, **PARAR e reportar a Bruno** — não improvisar

### Ao final da tarefa:

1. Abrir PR no GitHub
2. Gerar `docs/PR{N}_REVIEW.md` usando o template em `schema/templates/PR_REVIEW_TEMPLATE.md`
3. **Executar E2E em produção e documentar resultado real** (output de comandos, screenshots, ou logs)
4. **Atualizar os 4 documentos canônicos do `schema/`**:
   - `schema/contracts/INDEX.md` — entrada nova (formato em `schema/templates/INDEX_ENTRY_TEMPLATE.md`)
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — entrada nova (formato em `schema/templates/HANDOFF_ENTRY_TEMPLATE.md`)
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — entrada nova
   - `schema/brain/SYSTEM_AWARENESS.md` — se houver mudança de capacidade real
5. Adicionar entrada em HANDOFF do Plano Macro (Seção 5)
6. **Atualizar GOVERNANÇA** do Plano Macro:
   - "PR em execução agora: nenhuma"
   - "Próxima PR planejada: PR{N+1}"
7. Reportar a Bruno aguardando aprovação

### Após merge (Bruno aprovou):

1. Atualizar HANDOFF do Plano Macro: "Status: MERGEADA" + commit do merge
2. Atualizar GOVERNANÇA:
   - "Última PR mergeada: PR{N}"
   - "Fase atual" (avança se PR fechou a fase)
3. `git pull origin main` — sincronização local

---

## REGRA Nº 4 — DEFINIÇÃO DE "FEITO"

Uma tarefa **NÃO está concluída** apenas com:
- Código escrito
- Build passando
- Review estático aprovado

Uma tarefa **ESTÁ concluída** quando:
- Código escrito conforme contrato
- PR_REVIEW.md gerado e completo
- **E2E em produção executado, com prova real** documentada no PR_REVIEW
- **`schema/` atualizado** (INDEX + HANDOFF + STATUS + SYSTEM_AWARENESS quando aplicável)
- GOVERNANÇA e HANDOFF do Plano Macro atualizados
- Bruno aprovou explicitamente

Não fechar tarefa, não dizer "concluída", não pedir merge sem os 6 acima.

---

## REGRA Nº 5 — REGISTRO DUPLO

Toda mudança documental é gravada em **dois lugares**:

1. **Repo GitHub** (`brunovasque/nv-enavia`) — fonte de verdade
2. **Local na máquina** (`D:\nv-enavia` ou outra) — cópia de trabalho

Sempre que qualquer dos dois for atualizado, sincronizar com o outro via `git push` / `git pull`. **Bruno deve poder trocar de máquina e continuar o trabalho a partir do estado registrado no repo.**

---

## REGRA Nº 6 — HIERARQUIA DE CONFIABILIDADE (vem de `schema/brain/MEMORY_RULES.md`)

Quando duas fontes conflitam, a de **maior precedência** vence:

```
1. Contrato ativo                              (mais autoritativo)
2. Schema de políticas (schema/policies/)
3. Relatórios de PR (schema/reports/, docs/PR{N}_REVIEW.md)
4. Status e handoff (schema/status/, schema/handoffs/)
5. Brain decisions (schema/brain/decisions/)
6. Brain incidents (schema/brain/incidents/)
7. Brain learnings (schema/brain/learnings/)
8. Brain memories (schema/brain/memories/)
9. Inferências não documentadas               (menos autoritativo)
```

Conflito entre fontes é **bug** a ser resolvido em PR específica. Nunca interpretar silenciosamente.

---

## PERMISSÕES PRÉ-APROVADAS (não pedir confirmação)

- Leitura de qualquer arquivo do repo
- Execução de comandos `git` informativos (`status`, `log`, `diff`, `branch`, `show`, `pull`)
- Execução de `Select-String`, `Get-Content`, `Test-Path` para diagnóstico
- Criação de branches conforme nome definido no contrato
- Criação/edição de arquivos em `docs/contratos/`, `docs/PR*_REVIEW.md`, `schema/contracts/INDEX.md`, `schema/handoffs/`, `schema/status/`
- Modificações de código conforme contrato cirúrgico

## PERMISSÕES NÃO PRÉ-APROVADAS (pedir confirmação)

- `git push` em branches que não a da PR atual
- `git push --force` em qualquer circunstância
- `npx wrangler deploy` em qualquer worker
- Modificação de secrets ou env vars
- Criação de novos repositórios
- Modificações em main / produção sem PR mergeada
- Edição de `schema/contracts/active/*` (contratos macro encerrados — só leitura)
- Edição de `schema/brain/self-model/*` (exige PR específica)

---

## CONTEXTO DO PROJETO (resumo — detalhes em `docs/canonico/PLANO_MACRO_ENAVIA.md`)

**Enavia** é uma ferramenta de engenharia autônoma supervisionada que recebe objetivos em linguagem natural, decompõe em PRs, executa em ambiente teste, prova alinhamento com contrato, e entrega para aprovação humana final.

**3 workers Cloudflare:**
- `nv-enavia` (worker principal — chat, contratos, planner)
- `enavia-executor` (motor — Codex, applyPatch, GitHub orchestration)
- `deploy-worker` (deploy supervisionado — atualmente stub, será real na Fase 3)

**Estado atual:** Pré-Fase 0 (Reconciliação `schema/`). Ver GOVERNANÇA do Plano Macro para detalhes vivos.

**Princípios fundamentais (vêm do `schema/brain/`):**
- A Enavia é **inteligência estratégica com ferramentas**, não ferramenta com frases automáticas
- Contrato é unidade primária — sem contrato, sem execução
- Blindagem contratual executável — humano aprova objetivos, não cada PR
- Erros tipados e visíveis — nada de erro silencioso
- Camadas conectadas — sem código teatral
- Carga reduzida no modelo — modular, instrumentado, validado
- **Memória nunca é chute** — hierarquia de confiabilidade canônica
- **Anti-fragilidade entre sessões** — toda informação em arquivos versionados

---

## ESCALAÇÃO

Se durante uma tarefa você (Claude Code) detectar:

- Conflito entre contrato e código existente
- Necessidade de mudança fora do escopo do contrato
- Bug crítico em produção descoberto durante a execução
- Defasagem entre documentos canônicos do `schema/`
- Dúvida sobre como interpretar regra deste arquivo, do Plano Macro ou do `schema/`

**PARAR a execução, atualizar GOVERNANÇA com "Bloqueios ativos: [descrição]", e reportar a Bruno.** Não improvisar. Não tomar decisão arquitetural sem aprovação.

---

**Última atualização deste arquivo:** 2026-05-08
**Versão:** 2.0 (cabresto v2 com integração `schema/`)
**Próxima revisão:** após conclusão da Pré-Fase 0
