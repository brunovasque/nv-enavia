# PLANO MACRO ENAVIA v2 — DOCUMENTO CABRESTO
# Diagnóstico Consolidado + Visão + Roadmap + Ritual de Execução Anti-Frágil

> ⚠️ **DOCUMENTO CANÔNICO VINCULANTE**
>
> Este documento é o cabresto do projeto Enavia. Ele **complementa** (não substitui) a estrutura `schema/` que é a fonte primária do sistema. Sua função é **estratégica**: visão, roadmap, ritual de execução. A fonte operacional do dia a dia continua sendo `schema/`.
>
> Toda execução, toda PR, toda decisão técnica deve estar alinhada com este plano e com a estrutura `schema/`. Nenhuma tarefa pode ser aberta, executada ou fechada sem cumprir os 6 critérios de "feito" universal (Seção 4.5).

**Versão:** 2.0 (cabresto v2 com integração ao `schema/`)
**Data inicial:** 2026-05-08
**Última atualização canônica:** 2026-05-08
**Autor:** Claude (cérebro estratégico) baseado em diagnóstico read-only completo do repositório
**Aprovado por:** Bruno Vasques em 2026-05-08
**Sucessor de:** Plano Cabresto v1 (descartado por desconhecimento da estrutura `schema/`)
**Local no repo:** `docs/canonico/PLANO_MACRO_ENAVIA.md`

---

## SEÇÃO 0 — RELAÇÃO COM A ESTRUTURA `schema/`

Este plano **não substitui nada** que já existe em `schema/`. Ele se posiciona assim:

| Camada | Documento | Papel |
|--------|-----------|-------|
| **Operacional do dia a dia** | `schema/contracts/INDEX.md`, `schema/contracts/ACTIVE_CONTRACT.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, `schema/status/ENAVIA_STATUS_ATUAL.md` | Fonte primária do estado vivo. **Sempre atualizada a cada PR.** |
| **Workflow de execução** | `schema/CODEX_WORKFLOW.md`, `schema/MICROPHASES.md` | Ritual de execução por PR. Já existe, será estendido (não reescrito). |
| **Auto-consciência** | `schema/brain/SYSTEM_AWARENESS.md`, `schema/brain/self-model/*` | Identidade, capacidades, limitações da Enavia. |
| **Topologia técnica** | `schema/system/ENAVIA_SYSTEM_MAP.md`, `schema/system/ENAVIA_WORKER_REGISTRY.md` | Arquitetura, bindings, rotas. |
| **Hardening e segurança** | `schema/hardening/*`, `schema/self-audit/*`, `schema/skills-runtime/*` | Políticas de risco, rollback, governança de runtime. |
| **VISÃO ESTRATÉGICA E ROADMAP** ← **este documento** | `docs/canonico/PLANO_MACRO_ENAVIA.md` | **NOVO**. Visão 2026, plano de fases, princípios anti-frágeis. |

**Princípio:** o `schema/` é o "como" (operacional). Este plano é o "para onde" (estratégico). Os dois se referenciam mutuamente, nunca se contradizem.

Toda regra que **conflitar** entre este plano e o `schema/` deve ser tratada como bug a ser corrigido em PR específica — nunca interpretada silenciosamente.

---

## GOVERNANÇA — STATUS DO PROJETO

> ⚠️ **Atualizar a cada início e fim de tarefa.** Esta seção é resumo executivo. Para detalhes operacionais, ver `schema/status/ENAVIA_STATUS_ATUAL.md` e `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`.

**Última atualização:** 2026-05-08 (criação do cabresto v2)
**Última fase concluída:** Diagnóstico Macro 2026-05-08 (read-only, 9 documentos em `docs/diagnostico-macro-2026-05-08/` + `schema/` lido integralmente)
**Fase atual:** Pré-Fase 0 — Reconciliação `schema/` (não iniciada)
**Próxima fase:** Fase 0 — Estabilizar Ciclo Atual
**Última PR mergeada:** PR128 (commit `2ff23aa`) — Priorizar GitHub como fonte de código no executor
**PR em execução agora:** nenhuma
**Próxima PR planejada:** PR130 — Reconciliação `schema/` (ver Seção 4 do roadmap)
**Bloqueios ativos:**
- PR129 aberta no GitHub (#297) precisa ser **descartada** e produção revertida pro código de main (decisão tomada em 2026-05-08, ver Seção 3.4)
- `schema/contracts/INDEX.md` está parado em PR111 (17 PRs de defasagem) — **PR130 resolve**
- `schema/contracts/ACTIVE_CONTRACT.md` está parado em PR104 (24 PRs de defasagem) — **PR130 resolve**
- `schema/brain/SYSTEM_AWARENESS.md` parado em PR68 — **PR130 resolve**

**Decisões estratégicas:** todas resolvidas em 2026-05-08 (ver Seção 3.4)

**Próximos passos imediatos (ordem rigorosa):**
1. Reverter deploy de produção pra código da main (descarte PR129)
2. Fechar PR129 no GitHub sem merge
3. Gravar este plano + CLAUDE.md v2 + templates + bootstrap no repo (PR `chore/cabresto-v2`)
4. Mergear PR `chore/cabresto-v2`
5. Executar PR130 — Reconciliação `schema/` (atualiza INDEX, ACTIVE_CONTRACT, SYSTEM_AWARENESS com estado real)
6. Iniciar Fase 0 (PR131 em diante)

---

## SEÇÃO 1 — DIAGNÓSTICO CONSOLIDADO

### 1.1 Estado real do sistema (não o que parece, o que é)

O sistema Enavia é composto por **3 Workers Cloudflare** (`nv-enavia` 382KB, `enavia-executor` 264KB, `deploy-worker` 60KB), **2 KV namespaces ativos** (`ENAVIA_BRAIN` cognitivo + `ENAVIA_GIT` técnico), **~90 rotas HTTP/internal**, **estrutura `schema/` extensa** com 14 sub-pastas e ~80 documentos canônicos versionados.

Após 25 PRs consecutivas focadas no ciclo `chat → patch → PR`, o sistema **opera o caminho básico mas não fecha confiavelmente**. A causa não é um bug — são **cinco problemas estruturais distintos** identificados no diagnóstico macro.

### 1.2 Os 5 problemas estruturais

**P1 (CRÍTICO) — Erros mascarados que sabotam a depuração**

Vários pontos do código capturam exceções e devolvem strings genéricas que escondem causas distintas:

- `worker_patch_safe_parse_error` cobre 3 causas diferentes (HTTP 500 do endpoint, body malformado, timeout) — todas viram a mesma string
- `MAX_ATTEMPTS_REACHED` não distingue se as 5 tentativas falharam pelo mesmo motivo ou por motivos diferentes
- `env.AI` ausente faz validação LLM aprovar por default (gate fantasma confirmado em diagnóstico)
- KV writes silenciosos (`pending_plan` falha ao salvar, fluxo continua, "sim" não dispara nada)
- 11+ pontos `catch` que engolem erros sem propagar ao usuário

**Sintoma observável:** ninguém — nem você, nem eu, nem o Claude Code — sabe o que está acontecendo em produção quando algo falha.

**P2 (ALTO) — Camadas desconectadas entre cognitivo e técnico**

O sistema tem duas camadas convivendo em paralelo, mas desconectadas:

- **Camada cognitiva (`schema/`)**: contratos, brain semântico, memória V1–V5, self-model, hardening, policies, skills-runtime — sofisticada, bem documentada
- **Camada técnica (PRs recentes)**: ciclo `chat → Codex → PR` — funcional mas pragmática

A camada cognitiva **existe em código mas não é exercitada** pelo loop principal:

- Contratos são apenas **pré-condição** (gate de bloqueio se ausente), não fonte de instrução pro Codex
- Memória V1–V5 não é lida no fluxo de auto-evolução
- Skills são **apenas documentação** — `/skills/run` não existe
- `SYSTEM_AWARENESS.md` parou em PR68 (Jarvis Brain v1)

**Sintoma observável:** ~50% do código construído não faz nada útil hoje. O que parece um sistema rico é casca em vários pontos.

**P3 (ALTO) — Carga estrutural empurrada para o modelo**

`nv-enavia.js` tem 9.214 linhas (382KB) num único arquivo. `executor/src/index.js` tem 7.332 linhas (264KB). Ambos crescem ~7KB/PR. O Codex é instruído a fazer patches search/replace cirúrgicos nesses monolitos. Quanto mais homogêneo o código, mais o Codex tem onde escolher errado.

12 PRs consecutivas (PR111–PR122) ajustaram o **prompt** do Codex tentando compensar via instrução o que devia ser resolvido via arquitetura.

**Sintoma observável:** o ciclo de auto-modificação degrada com o tempo.

**P4 (CRÍTICO — descoberto neste diagnóstico) — Governança quebra entre abas/sessões**

Padrão revelador identificado no diagnóstico:

| Documento | Status |
|-----------|--------|
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Atualizado até PR128 ✅ |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Atualizado até PR128 ✅ |
| `schema/contracts/INDEX.md` | Parado em PR111 ❌ |
| `schema/contracts/ACTIVE_CONTRACT.md` | Parado em PR104 ❌ |
| `schema/brain/SYSTEM_AWARENESS.md` | Parado em PR68 ❌ |
| `schema/brain/ARCHITECTURE.md` | Parado em PR39 ❌ |
| `schema/system/ENAVIA_SYSTEM_MAP.md` | Parado em PR22 ❌ |
| `schema/brain/self-model/current-state.md` | Parado em PR40 ❌ |
| `schema/brain/self-model/capabilities.md` | Parado em PR40 ❌ (Brain Loader marcado como "não existe", mas existe desde PR43) |

**Documentos atualizados a cada PR sobreviveram. Documentos atualizados "no fim do contrato macro" foram abandonados quando os contratos macro pararam de ser fechados formalmente (a partir da PR105).**

**Sintoma observável:** sistema com auto-imagem desatualizada. Cada nova sessão, em cada nova aba, em cada nova máquina, parte de informação parcial. O Claude Code que abre uma sessão hoje **lê documentos que afirmam capacidades que existem como reais** ("Brain Loader não existe") ou **ignora capacidades reais** (PR43-PR128).

**Causa raiz identificada por Bruno em 2026-05-08**: *"provavelmente quebrou entre mudança de abas... isso precisa ser corrigido obrigatoriamente para evitar que qualquer mudança de aba quebre o sistema"*.

**P5 (MÉDIO) — Capacidades para o objetivo final ausentes**

Pra Enavia receber "crie um SaaS de vendas" e executar, **3 capacidades fundamentais não existem**:

- **Plano de longo prazo persistente** — `pending_plan` tem TTL 300s. Não há estrutura para "30 PRs ao longo de dias".
- **Decomposição automática de objetivo em PRs** — `classifyRequest` classifica intenção mas não decompõe.
- **Multi-repo + provisionamento** — `GITHUB_REPO` hardcoded. Nenhum mecanismo para criar repo novo.

Adicionalmente: skills são doc sem execução, deploy-worker é stub, sem rate limiting na OpenAI, sem ambiente de teste real funcional.

### 1.3 O que o desenho original acertou (e deve ser preservado)

Apesar dos 5 problemas, partes substanciais do desenho original são **sólidas e devem ser base** para tudo daqui pra frente:

- **Estrutura `schema/`** com 14 sub-pastas — desenho coerente, será fonte primária do cabresto v2
- **Separação semântica de KVs** (`ENAVIA_BRAIN` cognitivo + `ENAVIA_GIT` técnico)
- **Boundary entre nv-enavia e executor** — respeitado, com `/__internal__/*` como contrato interno
- **Sistema de contratos** com 14 rotas (`/contracts/*`) — estrutura rica, mesmo que hoje subutilizada
- **Trail de execução persistido**
- **Pending_plan com TTL** — gate humano de curta duração funciona
- **`merge_allowed = false` como invariante atual** — a evoluir para "blindagem contratual executável"
- **Disciplina PR_REVIEW** (a partir de PR105)
- **`schema/CODEX_WORKFLOW.md` e `schema/MICROPHASES.md`** — workflow de execução já formalizado
- **`schema/brain/MEMORY_RULES.md`** — hierarquia de confiabilidade canônica (contrato → policies → reports → status → brain → inferências)
- **`schema/brain/self-model/*`** — identidade, capacidades, limitações já definidas em prosa madura

### 1.4 O que foi resolvido em decisões estratégicas (Seção 3.4)

Workers externos suspeitos, gates fantasmas, espelhamento KV, PR129 — todos resolvidos. Ver Seção 3.4.

---

## SEÇÃO 2 — VISÃO ENAVIA

### 2.1 O que Enavia é

Enavia é uma **ferramenta de engenharia autônoma supervisionada** que recebe objetivos de alto nível em linguagem natural, decompõe em sequência de mudanças executáveis, executa em ambiente isolado, prova alinhamento com o contrato, e entrega resultado verificado para aprovação humana final.

Ela **não é** um agente genérico de código. Ela **é** uma máquina de cumprir contratos com prova.

> Citação canônica de `schema/brain/self-model/identity.md`:
> *"A Enavia é uma inteligência estratégica com ferramentas; não uma ferramenta com frases automáticas."*

### 2.2 Princípios arquiteturais (consolidados com `schema/`)

**Princípio 1 — Contrato é unidade primária**

Toda execução autônoma nasce de um contrato em `schema/contracts/active/` ou `docs/contratos/`. Sem contrato, sem execução. O contrato é a única fonte de verdade que alimenta planejamento, execução e verificação.

**Princípio 2 — Blindagem contratual executável**

Aprovação humana é sobre **objetivos**, não sobre cada linha de código. Humano aprova o contrato. Enavia executa em ambiente teste. Verifica entrega contra contrato com critérios automatizados. Se passar, pode mergear/deployar em teste e prosseguir. Humano revisa entrega final em ambiente teste antes da promoção a produção.

**Princípio 3 — Erros são tipados e visíveis**

Nenhum erro silencioso. Toda exceção capturada vira tipo conhecido (não string genérica). Toda falha em ponto crítico é instrumentada e visível ao usuário.

**Princípio 4 — Camadas conectadas**

Contratos alimentam Codex. Memória alimenta planejamento. Skills executam de verdade. Deploy-worker faz deploy de verdade. Sem camadas teatrais.

**Princípio 5 — Carga reduzida no modelo**

Modelos LLM tratados como **dado externo não-confiável**. Validação estrutural antes de aceitar saída. Modularização do código-alvo. Adapter trocável de modelo.

**Princípio 6 — Capacidade durável > implementação atual**

O que Enavia É (contratos, blindagem, supervisão estruturada) deve sobreviver mesmo se o stack mudar. Lógica de domínio em arquivos próprios.

**Princípio 7 — Anti-fragilidade entre sessões (NOVO)**

Toda informação de estado do sistema vive em arquivos versionados no repo. Sessão nova = `git pull` + ler `schema/` + continuar. Não há dependência da memória da sessão anterior. **Mudança de aba, máquina ou IA não pode quebrar a continuidade do trabalho.**

**Princípio 8 — Memória nunca é chute (NOVO — vem do `MEMORY_RULES.md`)**

Hierarquia canônica de confiabilidade:
```
1. Contrato ativo
2. Schema de políticas (schema/policies/)
3. Relatórios de PR (schema/reports/, docs/PR{N}_REVIEW.md)
4. Status e handoff (schema/status/, schema/handoffs/)
5. Brain decisions, incidents, learnings, memories
6. Inferências não documentadas (menos autoritativo — marcar como incerto)
```

Quando duas fontes conflitam, a de maior precedência vence. Conflito é bug a ser corrigido em PR.

### 2.3 Fronteira do escopo

**Está dentro do escopo:**
- Auto-modificação supervisionada do próprio código
- Modificação supervisionada de outros repos com contrato
- Decomposição de contratos grandes em sequência de PRs
- Ambiente de teste isolado com prova de cumprimento
- Skills executáveis registradas e versionadas
- Provisionamento de repos/workers novos quando necessário

**Está fora do escopo:**
- Substituir o desenvolvedor humano em decisões de arquitetura macro
- Operar sem contrato (interação livre tipo ChatGPT)
- Auto-objetivos (Enavia define o que ela mesma vai fazer sem você)
- Generalização para clientes/multitenancy

### 2.4 Estado de chegada — definição de "feito"

A Enavia está pronta quando:

1. Você abre uma sessão de chat e descreve um objetivo
2. Ela responde com plano decomposto em N PRs ordenadas
3. Você aprova o plano (ou ajusta)
4. Ela executa cada PR: branch, código, teste em ambiente teste, prova de cumprimento contra contrato, merge em teste
5. Ao final da sequência, em ambiente teste, ela apresenta o resultado completo e a prova de cumprimento
6. Você revisa em ambiente teste, aprova, e ela faz merge/deploy em produção
7. Tudo sem você precisar revisar PR por PR — supervisão é sobre o contrato e a entrega final

---

## SEÇÃO 3 — ROADMAP MACRO

### 3.1 Visão geral das fases

| # | Fase | Duração estimada | Entregável visível ao final |
|---|------|------------------|------------------------------|
| **Pré-0** | **Reconciliação `schema/`** | 1-2 dias | `schema/contracts/INDEX.md`, `ACTIVE_CONTRACT.md`, `SYSTEM_AWARENESS.md` reconciliados com PR128. Governança vivendo de novo. |
| 0 | Estabilizar ciclo atual | 2-3 semanas | Ciclo `chat → 1 PR` 100% confiável, instrumentado, com erros tipados |
| 1 | Modularizar monolitos | 2-3 semanas | `nv-enavia.js` e `executor/index.js` divididos em módulos; ciclo continua funcionando |
| 2 | Conectar camadas | 2-3 semanas | Contratos alimentam Codex; memória entra no loop; skills documentais ligadas ao motor |
| 3 | Ambiente teste real + blindagem contratual | 3-4 semanas | Deploy-worker faz deploy real; verificação automatizada de entrega contra contrato; auto-merge condicional em teste |
| 4 | Multi-repo e plano de longo prazo | 3-4 semanas | Enavia opera em múltiplos repos com contratos; plano persistente de N PRs |
| 5 | Decomposição autônoma e ciclo multi-PR | 4-6 semanas | Enavia recebe objetivo macro, decompõe em PRs, executa série supervisionada por contrato |
| 6 | Provisionamento (opcional) | 3-4 semanas | Cria repos novos, configura Workers novos, inicializa estrutura |
| 7 | Skills executáveis (opcional) | indefinido | Motor de skills com registry persistente e self-install |

**Total Pré-0 + Fases 0-5 (núcleo)**: 16-23 semanas | **4 a 6 meses**

Fases 6-7 são opcionais conforme uso futuro.

### 3.2 Princípios do roadmap

**P-Roadmap-1 — Ordem rigorosa, sem paralelismo até Fase 3.**
Pré-0, 0, 1, 2 são sequenciais. Cada uma destrava a seguinte.

**P-Roadmap-2 — Cada fase entrega valor visível independentemente.**
Se o projeto parar na Fase 2, o que foi feito é útil.

**P-Roadmap-3 — Toda PR daqui pra frente exige E2E em produção antes do merge.**
Validação estática não basta. Não repetimos o erro do PR129.

**P-Roadmap-4 — Início de cada fase começa com contrato canônico.**
Nada de PR isolada sem contrato. Contrato é aprovado, depois PRs derivam dele.

**P-Roadmap-5 — Checkpoint humano ao fim de cada fase.**
Você revisa o entregável da fase, decide se prossegue, ajusta, ou descarta.

**P-Roadmap-6 (NOVO) — Toda PR atualiza `schema/` antes do merge.**
PR só é mergeada se atualizar `schema/contracts/INDEX.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, `schema/status/ENAVIA_STATUS_ATUAL.md`. PR130 vai voltar a essa disciplina.

---

### 3.3 Detalhamento das fases

#### PRÉ-FASE 0 — RECONCILIAÇÃO `schema/`

**Duração:** 1-2 dias
**Objetivo:** Atualizar documentos canônicos do `schema/` para refletir o estado real do sistema (PR105 → PR128).
**Pré-requisito:** Plano cabresto v2 aprovado e gravado no repo, PR129 descartada.

**PRs previstas:**

- **PR130 — Reconciliação `schema/contracts/INDEX.md` + `ACTIVE_CONTRACT.md`**
  Adicionar entradas para PR105–PR128 referenciando `docs/CONTRATO_PR{N}.md`. Marcar contratos individuais como "ciclo de fixes empilhados (defasagem documental reconhecida)". Atualizar `ACTIVE_CONTRACT.md` para refletir estado real (sem contrato macro ativo, em transição para Fase 0).

- **PR131 — Atualização `schema/brain/SYSTEM_AWARENESS.md`**
  Adicionar Seção 12+ documentando o estado pós-PR68 → PR128. Capacidades reais (Brain Loader existe desde PR43, GitHub Bridge real desde PR105, Codex dispatch ativo desde PR111, etc.). Lacunas pendentes (deploy-worker stub, skills-runtime sem execução, etc.).

- **PR132 — Atualização `schema/brain/self-model/current-state.md` + `capabilities.md`**
  Sincronizar com estado real. Brain Loader marcado como existente. Capabilities pós-PR128.

**Critério de "feito" da Pré-Fase 0:**
1. Os 6 documentos canônicos do `schema/` que estavam defasados refletem PR128
2. Próxima sessão do Claude Code, em qualquer máquina, lê `schema/` e tem auto-imagem coerente
3. Cada PR130-132 mergeada com prova de leitura cruzada (Bruno verifica que o documento bate com o estado real)

**Riscos:**
- Reconciliar 24 PRs de defasagem em INDEX é trabalho documental denso. Pode ser dividido em PR130a, 130b se ficar grande.

---

#### FASE 0 — ESTABILIZAR CICLO ATUAL

**Duração:** 2-3 semanas
**Objetivo:** o ciclo `chat → 1 PR` funciona reliably, com erros tipados e instrumentação visível.
**Pré-requisito:** Pré-Fase 0 concluída.

**Problemas atacados:** P1 (erros mascarados) parcialmente, e fechamento do ciclo atual.

**PRs previstas:**

- **PR133 — Tipagem de erros do `/worker-patch-safe`**
  Substitui o `.catch(() => ({ error: 'worker_patch_safe_parse_error' }))` por tratamento que distingue HTTP status, body real e timeout.

- **PR134 — Decisão sobre `env.AI`**
  Remove o bloco de validação fantasma (decisão estratégica 4). Validação real virá na Fase 3 com verificação contratual.

- **PR135 — Instrumentação visível ao usuário no `_dispatchExecuteNextFromChat`**
  Todos os 5 caminhos de erro (NO_PATCH, APPLY_ERROR, NO_VALID_CANDIDATE, PR_NOT_OPENED, AI_ERROR) com signature distinta. Early-stop cobre os 5.

- **PR136 — Validação pós-write em pontos críticos do KV**
  `pending_plan`, `execution:trail:latest`, `decision:*` — toda escrita seguida de leitura confirmatória.

- **PR137 — Definição canônica de termos perigosos (Redundância 4)**
  Unificar `_CHAT_BRIDGE_DANGEROUS_TERMS` em uma única função compartilhada.

**Critério de "feito" da Fase 0:**
1. 5 melhorias diferentes solicitadas via chat → 5 PRs abertas reliably (taxa de sucesso ≥ 90%)
2. Quando falha, usuário vê erro tipado claro
3. `env.AI` removido do código
4. Cada PR com prova E2E em produção
5. Cada PR atualizando `schema/` (governança viva)

---

#### FASE 1 — MODULARIZAR MONOLITOS

**Duração:** 2-3 semanas
**Objetivo:** `nv-enavia.js` e `executor/index.js` divididos em módulos.
**Pré-requisito:** Fase 0 estável.

**Problemas atacados:** P3 (carga estrutural no Codex).

**PRs previstas:**

- **PR138 — Extrair Memory V1–V5 para `nv-enavia/memory/`**
- **PR139 — Extrair handlers de contrato para `nv-enavia/contracts/`**
- **PR140 — Extrair `_dispatchExecuteNextFromChat` para `nv-enavia/dispatch/`**
- **PR141 — Extrair `enaviaExecutorCore` e `callCodexEngine` no executor**
- **PR142 — Helpers compartilhados entre executor e deploy-worker**
- **PR143 — Limpeza de código identificado como "morto" (decisões 1, 2, 5)**

**Critério de "feito":**
1. `nv-enavia.js` ≤ 250KB
2. `executor/src/index.js` ≤ 180KB
3. Ciclo continua funcionando
4. Taxa de `ANCHOR_NOT_FOUND` reduzida em ≥ 50%

---

#### FASE 2 — CONECTAR CAMADAS

**Duração:** 2-3 semanas
**Objetivo:** camada cognitiva (`schema/`) passa a alimentar o ciclo de auto-evolução.
**Pré-requisito:** Fase 1.

**Problemas atacados:** P2 (camadas desconectadas).

**PRs previstas:**

- **PR144 — Contratos alimentam o prompt do Codex**
- **PR145 — Memória entra no planner**
- **PR146 — Skill router conectado a executor real**
- **PR147 — Decision log alimenta classifyEnaviaIntent**
- **PR148 — Auditoria estruturada pós-PR**

---

#### FASE 3 — AMBIENTE TESTE REAL + BLINDAGEM CONTRATUAL

**Duração:** 3-4 semanas
**Objetivo:** deploy-worker sai de stub. Enavia opera em ambiente teste isolado com prova de cumprimento.
**Pré-requisito:** Fase 2.

**PRs previstas:**

- **PR149 — Deploy-worker funcional para ambiente teste**
- **PR150 — Verificação de entrega contra contrato**
- **PR151 — Auto-merge condicional em ambiente teste**
- **PR152 — Painel de revisão de entrega**
- **PR153 — Promoção teste → produção com gate humano**

---

#### FASE 4 — MULTI-REPO E PLANO DE LONGO PRAZO

**Duração:** 3-4 semanas
**PRs previstas:** PR154-159 (registry de repos, parametrização, multi-file, plano persistente, retomada, visão de progresso).

---

#### FASE 5 — DECOMPOSIÇÃO AUTÔNOMA E CICLO MULTI-PR

**Duração:** 4-6 semanas
**PRs previstas:** PR160-165 (decomposer, executor de plano sequencial, re-decomposição, estimativas, checkpoints obrigatórios, self-correction).

---

#### FASE 6 — PROVISIONAMENTO (OPCIONAL)
#### FASE 7 — SKILLS EXECUTÁVEIS (OPCIONAL)

---

### 3.4 Decisões estratégicas — RESOLVIDAS em 2026-05-08

Vinculantes daqui pra frente. Reabertura exige adendo formal.

| # | Item | Decisão | Justificativa |
|---|------|---------|---------------|
| 1 | `nv-director-cognitive` worker externo | **DESCARTAR** | Suspeita de resto, sem uso ativo confirmado |
| 2 | `nv-vercel-executor` worker externo | **DESCARTAR** | Vercel fora de escopo das Fases 0-5 |
| 3 | Ambientes test (`*-test` workers) | **ATIVAR** | Pilar central da Fase 3 |
| 4 | `env.AI` (Workers AI / Llama 3.1 8B) | **REMOVER do código** | Gate fantasma. Validação real virá na Fase 3 |
| 5 | Espelhamento `DEPLOY_KV ↔ ENAVIA_GIT` | **DESATIVAR até Fase 3** | Hoje é write fantasma |
| 6 | Schemas de skills documentais | **MANTER COMO REFERÊNCIA** | Vão alimentar Fase 2 (PR146) e Fase 7 |
| 7 | PR129 atual (#297, aberta) | **DESCARTAR** | Cobriu caminhos errados; PRs 133-135 da Fase 0 cobrem o mesmo escopo limpo |

### 3.5 Definição de "feito" universal para PRs (PR130 em diante)

Toda PR só é mergeada quando:

1. **Contrato canônico** existe em `docs/contratos/` ou `schema/contracts/active/` antes de qualquer código
2. **Implementação** segue contrato cirurgicamente
3. **PR_REVIEW.md** com análise critério-a-critério (template em `schema/templates/`)
4. **E2E em produção** executado e documentado no PR_REVIEW (não basta validação estática)
5. **Aprovação Bruno** baseada em prova comportamental
6. **`schema/` atualizado**: INDEX.md + LATEST_HANDOFF.md + STATUS_ATUAL.md (e brain/* se houver mudança de capacidade)

Sem qualquer um dos 6, **não mergeia**.

### 3.6 Métricas de saúde do sistema

- Taxa de sucesso do ciclo `chat → PR` (objetivo: ≥ 90% Fase 0; ≥ 95% Fase 2)
- Tempo médio do ciclo (objetivo: ≤ 60s Fase 0)
- Taxa de `ANCHOR_NOT_FOUND` (objetivo: queda ≥ 50% após Fase 1)
- Tamanho dos arquivos principais (objetivo: ≤ 250KB Fase 1)
- Cobertura de erros tipados (objetivo: 100% dos catches em ponto crítico)
- **Defasagem de governança** (NOVO): nenhum documento canônico do `schema/` deve estar > 1 PR atrás do estado real

---

## SEÇÃO 4 — RITUAL DE EXECUÇÃO ANTI-FRÁGIL (CABRESTO OPERACIONAL)

> Este ritual é vinculante e foi desenhado para sobreviver à mudança de aba, máquina, sessão ou IA. Toda PR daqui em diante segue exatamente esta sequência.

### 4.1 Início de qualquer sessão (em qualquer máquina, qualquer aba)

1. `git pull origin main` — sincroniza local com repo
2. Ler `BOOTSTRAP_SESSAO.md` (raiz do repo) — primeira leitura obrigatória
3. Ler `CLAUDE.md` (raiz do repo)
4. Ler `docs/canonico/PLANO_MACRO_ENAVIA.md` (este documento, especialmente seção GOVERNANÇA)
5. Ler `schema/contracts/INDEX.md` — qual contrato está ativo
6. Ler `schema/contracts/ACTIVE_CONTRACT.md` — ponteiro curto
7. Ler `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — último estado
8. Ler `schema/status/ENAVIA_STATUS_ATUAL.md` — última PR
9. Ler `schema/brain/SYSTEM_AWARENESS.md` — capacidade atual
10. Verificar se há defasagem entre os documentos. Se houver, **PARAR e reportar**.

### 4.2 Antes de iniciar uma tarefa específica

1. Ler o contrato canônico da PR específica em `docs/contratos/CONTRATO_PR{N}_*.md`
2. Verificar se a PR está alinhada com a fase atual do roadmap
3. Atualizar GOVERNANÇA do plano macro:
   - "PR em execução agora: PR{N} — título"
   - "Última atualização: data atual"
4. Aguardar OK explícito de Bruno

### 4.3 Durante a execução

1. Branch criada conforme contrato
2. Commits atômicos seguindo o contrato cirurgicamente
3. Nenhum desvio do contrato sem adendo formal aprovado por Bruno
4. Se descobrir que o contrato precisa ajuste, **PARAR e reportar a Bruno** — não improvisar

### 4.4 Ao final da tarefa

1. PR aberta no GitHub
2. `docs/PR{N}_REVIEW.md` gerado conforme template (`schema/templates/PR_REVIEW_TEMPLATE.md`)
3. **E2E em produção executado e documentado no PR_REVIEW** (não basta validação estática)
4. **Atualizar 4 documentos canônicos do `schema/`**:
   - `schema/contracts/INDEX.md` — entrada nova
   - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — entrada nova
   - `schema/status/ENAVIA_STATUS_ATUAL.md` — entrada nova
   - `schema/brain/SYSTEM_AWARENESS.md` — se houver mudança de capacidade
5. Adicionar entrada em HANDOFF do plano macro (Seção 5 deste documento)
6. Atualizar GOVERNANÇA do plano macro:
   - "PR em execução agora: nenhuma"
   - "Próxima PR planejada: PR{N+1}"
7. Reportar a Bruno aguardando aprovação

### 4.5 Após merge (Bruno aprovou)

1. Atualizar HANDOFF: "Status: MERGEADA" + commit do merge
2. Atualizar GOVERNANÇA do plano macro:
   - "Última PR mergeada: PR{N}"
   - "Fase atual" (avança se PR fechou a fase)
   - "Última fase concluída" (se aplicável)
3. `git push origin main` (depois do merge na main, sincronização)
4. Local: `git pull origin main` — sincronização completa

### 4.6 Definição de "feito" universal para PRs

Ver Seção 3.5. Os 6 critérios. Sem qualquer um deles, não mergeia.

---

## SEÇÃO 5 — HANDOFF — Histórico de Execuções

> Log cronológico vinculante. Cada PR deixa entrada aqui. Ordem **da mais recente pra mais antiga** (entradas novas no topo). Para detalhe operacional, sempre consultar `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`.

### 2026-05-08 — DECISÃO ESTRATÉGICA — Plano Cabresto v2 Aprovado
- **Tipo:** Decisão de governança (não é PR de código)
- **Aprovado por:** Bruno Vasques
- **Conteúdo:**
  - Plano Cabresto v2 aprovado, integrando `schema/` como fonte primária
  - 7 decisões estratégicas resolvidas (Seção 3.4)
  - PR129 marcada para descarte
  - Ritual de execução anti-frágil definido (Seção 4)
  - Princípio P-Roadmap-6 adicionado: toda PR atualiza `schema/`
  - BOOTSTRAP_SESSAO.md, CLAUDE.md v2, templates de contrato/PR_REVIEW/HANDOFF criados como artifacts
- **Próximo passo:** PR `chore/cabresto-v2` grava todos os artifacts no repo, depois Pré-Fase 0 (PR130 reconciliação)

### 2026-05-08 — DIAGNÓSTICO MACRO READ-ONLY (Pré-cabresto)
- **Tipo:** Diagnóstico (não é PR de código)
- **Conteúdo:** 9 arquivos em `docs/diagnostico-macro-2026-05-08/` mapeando workers, rotas, KV, secrets, fluxo de chat, redundâncias, gaps, PRs recentes, arquivos grandes. Leitura completa de `schema/` (5 blocos: contratos, awareness, system, self-model, memory rules)
- **Resultado:** identificação de 5 problemas estruturais (P1–P5), descoberta de defasagem de governança (P4) entre `schema/` e estado real, base do plano cabresto v2

---

(Daqui pra baixo, novas entradas conforme PRs forem executadas.)

---

**Fim do Plano Cabresto v2.**
