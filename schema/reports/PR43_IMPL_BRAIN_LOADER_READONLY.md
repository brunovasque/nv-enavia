# PR43 — Brain Loader read-only Worker-only

**Data:** 2026-04-30
**Tipo:** PR-IMPL (Worker-only, cirúrgica)
**Branch:** `copilot/claudepr43-impl-brain-loader-readonly-worker`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR42 — PR-DIAG — mergeada (relatório: `schema/reports/PR42_MEMORY_RUNTIME_DIAGNOSTICO.md`).

---

## 1. Objetivo

Implementar o primeiro Brain Loader read-only da Enavia no Worker principal,
conectando uma allowlist pequena do Obsidian Brain ao contexto do chat
(`buildChatSystemPrompt`) — sem escrita, sem painel, sem endpoint novo,
sem alteração de infraestrutura, KV, bindings ou secrets.

Esta é a primeira ponte real entre o Brain documental (`schema/brain/`)
e a experiência conversacional do `/chat/run`.

---

## 2. Diagnóstico usado

PR42 confirmou (`schema/reports/PR42_MEMORY_RUNTIME_DIAGNOSTICO.md`):

- `ENAVIA_BRAIN` existe (IDs reais em `wrangler.toml` PROD/TEST).
- O Obsidian Brain documental (`schema/brain/`) **não está conectado**
  ao runtime — nenhum arquivo é carregado automaticamente.
- Workers Cloudflare **não leem filesystem** do repo em produção.
- Recomendação para PR43: **bundle estático** com allowlist pequena,
  injetado em `buildChatSystemPrompt`. Sem nova infra. Sem painel.
  Sem endpoint. Sem escrita. Limite ~4.000 caracteres.

PR43 segue a Opção 1 (bundle estático) recomendada na PR42, com a allowlist
de 6 arquivos definida lá (self-model + SYSTEM_AWARENESS).

---

## 3. Arquitetura escolhida

**Snapshot estático embutido no bundle.**

- Novo módulo `schema/enavia-brain-loader.js` mantém o snapshot como
  array de objetos `{source, title, body}` — resumo manual fiel e
  rastreável dos arquivos da allowlist (não cópia de markdown extenso).
- Função pura `getEnaviaBrainContext(options)` retorna texto compacto,
  determinístico, sem rede, sem FS, sem KV, sem clock.
- Cabeçalho fixo deixa claro: **READ-ONLY**, documental, **não autoriza
  execução**, **não é estado runtime**.
- Integração feita por uma única importação adicional em
  `schema/enavia-cognitive-runtime.js` e uma seção nova `7c` no
  `buildChatSystemPrompt`.
- Flag interna `include_brain_context` (default `true`) permite desligar
  em testes — **nenhuma env var nova foi criada**.

Por que esta opção:
- Sem infra extra, sem latência KV, sem CI/CD adicional, sem risco
  de divergência runtime/snapshot.
- Sem dependência de filesystem em runtime (Workers não suportam).
- Allowlist hard-coded é auditável e impede vazamento de outros arquivos.

---

## 4. Arquivos alterados

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `schema/enavia-brain-loader.js` | NOVO | Snapshot estático + `getEnaviaBrainContext` + `getEnaviaBrainAllowlist` + constantes de limite |
| `schema/enavia-cognitive-runtime.js` | EDIT | Importa loader e injeta seção `7c` no `buildChatSystemPrompt` (antes do envelope JSON) |
| `tests/pr43-brain-loader-readonly.smoke.test.js` | NOVO | Smoke test PR43 (cenários A-E, 32 asserts) |
| `schema/reports/PR43_IMPL_BRAIN_LOADER_READONLY.md` | NOVO | Este relatório |
| `schema/contracts/INDEX.md` | EDIT | Próxima PR autorizada e PR43 marcada |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | EDIT | Estado pós-PR43 |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | EDIT | Handoff PR43→PR44 |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | EDIT | Entrada PR43 |

**NÃO alterados:** `nv-enavia.js` (a integração ficou contida em
`schema/enavia-cognitive-runtime.js`, ponto onde `buildChatSystemPrompt`
é definido), `wrangler.toml`, `wrangler.executor.template.toml`, painel,
executor, deploy worker, workflows, secrets, bindings, KVs.

---

## 5. Allowlist carregada

Arquivos **fonte** resumidos no snapshot estático (ordem do snapshot):

1. `schema/brain/self-model/identity.md` — Identidade
2. `schema/brain/self-model/capabilities.md` — Capacidades atuais
3. `schema/brain/self-model/limitations.md` — Limites operacionais
4. `schema/brain/self-model/current-state.md` — Estado atual (referência documental)
5. `schema/brain/self-model/how-to-answer.md` — Como responder
6. `schema/brain/SYSTEM_AWARENESS.md` — System awareness (como usar o sistema)
7. `schema/brain/memories/INDEX.md` — Excerto pequeno de preferências operacionais

> **Nota sobre `schema/brain/memories/`:** os arquivos `operator-preferences.md`,
> `operating-style.md`, `project-principles.md`, `hard-rules.md` e
> `recurring-patterns.md` mencionados no enunciado da PR ainda **não existem**
> no repo. A pasta `schema/brain/memories/` contém apenas o `INDEX.md` (PR39).
> O snapshot incluiu um excerto pequeno e rastreável desse INDEX. Quando
> esses arquivos forem populados em PRs futuras, podem ser adicionados ao
> snapshot dentro do mesmo limite total.

A allowlist é hard-coded no array `BRAIN_SNAPSHOT_BLOCKS` do loader.
Nenhum arquivo fora dessa lista entra no contexto.

---

## 6. Como o Brain Context é injetado

Em `schema/enavia-cognitive-runtime.js`, função `buildChatSystemPrompt`:

- Importa `getEnaviaBrainContext` de `./enavia-brain-loader.js`.
- Aceita opção `include_brain_context` (default `true`).
- Adiciona seção `7c` entre a seção `7b` (uso/criação de memória) e a
  seção `8` (envelope JSON), com cabeçalho:
  ```
  CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY
  [Fonte documental do Obsidian Brain. Não é estado runtime e não autoriza execução.
   Para estado atual do sistema, use o awareness operacional e o target da sessão.
   Para executar, é exigido contrato ativo, escopo e aprovação.]
  ```

Garantias de integração:
- Não altera nenhum sanitizer.
- Não altera o envelope JSON `{reply, use_planner}`.
- Não substitui `MODO OPERACIONAL ATIVO` (este continua sendo injetado
  apenas quando `is_operational_context=true`).
- Não substitui `Operational Awareness`, target informativo nem nota
  factual de `read_only`.
- Brain Context coexiste com bloco operacional sem interferência.

---

## 7. Limites de contexto

Constantes exportadas (chars):

| Constante | Valor | Função |
|-----------|-------|--------|
| `BRAIN_CONTEXT_TOTAL_LIMIT` | `4000` | Limite total do contexto Brain |
| `BRAIN_CONTEXT_PER_BLOCK_LIMIT` | `1500` | Limite por bloco do snapshot |
| `BRAIN_CONTEXT_TRUNCATION_MARK` | `[brain-context-truncated]` | Marca segura de truncamento |

Comportamento de truncamento:
- Cada bloco é renderizado e truncado a `BRAIN_CONTEXT_PER_BLOCK_LIMIT`
  com a marca ao final, se necessário.
- O loop principal pula blocos que estourariam o `totalLimit` e tenta
  encaixar uma versão truncada do próximo bloco; se não couber espaço
  útil (>80 chars), interrompe com a marca de truncamento.
- O loader é **determinístico**: duas chamadas sucessivas com os mesmos
  parâmetros retornam o mesmo texto (validado por teste).

---

## 8. O que ainda NÃO é runtime

A PR43 NÃO implementa nada disso (e o Brain Context indica explicitamente):

- ❌ Não há **escrita de memória** (read-only puro).
- ❌ Não há **endpoint `/brain/*`**.
- ❌ Não há **endpoint `/skills/run`**.
- ❌ Não há **Skill Router em runtime**.
- ❌ Não há **Intent Engine completo** (apenas o helper `isOperationalMessage` da PR36/PR38).
- ❌ Não há **Self-Audit**.
- ❌ Não há **Update Policy supervisionada** ativa.
- ❌ Painel **não foi alterado** (nenhuma UI de Brain).
- ❌ Brain Loader é **apenas um snapshot estático** (não busca, não roteia).
- ✅ Brain Context é **read-only**, documental, e **não autoriza execução**.

---

## 9. Testes executados

### `node --check` (sintaxe)

| Arquivo | Resultado |
|---------|-----------|
| `nv-enavia.js` | ✅ |
| `schema/enavia-cognitive-runtime.js` | ✅ |
| `schema/enavia-brain-loader.js` | ✅ |
| `tests/pr43-brain-loader-readonly.smoke.test.js` | ✅ |

### Smoke PR43

```
node tests/pr43-brain-loader-readonly.smoke.test.js
Results: 32 passed, 0 failed
```

Cenários cobertos:
- A) Loader básico — string, "Enavia", "LLM-first", read_only como gate, read-only/documental, allowlist completa.
- B) Limite — total ≤ 4000, truncamento custom 600, marca de truncamento presente, determinismo.
- C) Prompt — Brain entra em conversa simples, desliga com `include_brain_context:false`, coexiste com `MODO OPERACIONAL ATIVO`, posicionado antes do envelope JSON.
- D) Não cria capacidade falsa — menciona `/skills/run`, Skill Router, Intent Engine, read-only/documental e exigência de contrato/aprovação.
- E) Anti-bot preservado — target só (sem intenção operacional) NÃO ativa bloco operacional pesado; target informativo e nota factual `read_only` permanecem.

### Regressões

| Teste | Resultado |
|-------|-----------|
| `tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | ✅ 56/56 |
| `tests/pr36-chat-runtime-anti-bot.smoke.test.js` | ✅ 26/26 |
| `tests/pr21-loop-status-states.smoke.test.js` | ✅ 53/53 |
| `tests/pr20-loop-status-in-progress.smoke.test.js` | ✅ 27/27 |
| `tests/pr19-advance-phase-e2e.smoke.test.js` | ✅ 52/52 |
| `tests/pr14-executor-deploy-real-loop.smoke.test.js` | ✅ 183/183 |
| `tests/pr13-hardening-operacional.smoke.test.js` | ✅ 91/91 |

Total agregado: **520/520 verdes**.

---

## 10. Riscos restantes

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Snapshot do Brain divergir do conteúdo documental real | Média (sem CI de sync) | Médio | Cabeçalho marca como documental; PRs futuras podem regenerar |
| LLM tratar Brain como autorização de execução | Baixa | Alto | Cabeçalho explícito + texto interno reforça read-only e exigência de contrato |
| Aumento de tokens consumidos por chat | Baixa-média | Baixo | Limite total 4000 chars (~1k tokens) — aceitável; bloco é compacto |
| Truncamento esconder linha-chave | Baixa | Baixo | Ordem do snapshot prioriza identidade, capacidades, limites; marca de truncamento sinaliza |
| Brain Context conflitar com memórias recuperadas (PM3) | Baixa | Baixo | Brain entra em seção 7c, separada das memórias recuperadas (bloco PM3 fica entre system prompt e history) |
| Painel ou outro cliente esperar campo extra na resposta | Nenhuma | — | Nenhuma mudança no envelope, sanitizers ou rotas |

---

## 11. Próxima PR recomendada

**Se todos os testes passarem:** ✅ (situação atual)

**PR44 — PR-PROVA — Provar Brain Loader read-only no chat runtime**

Validar em runtime real (TEST quando aplicável) que o Brain Context está
de fato influenciando tom/autoentendimento sem ativar tom operacional
indevido, sem quebrar anti-bot, sem expor conteúdo interno e sem inflar
contexto além do limite.

**Se algum teste falhar:** PR44 — PR-IMPL — Corrigir falhas do Brain Loader
read-only.

---

## Rollback

Reverter os arquivos:

- `schema/enavia-brain-loader.js` (deletar)
- `schema/enavia-cognitive-runtime.js` (remover import e seção `7c`)
- `tests/pr43-brain-loader-readonly.smoke.test.js` (deletar)

Nenhum dado, KV, bindings, secret ou painel foi alterado — rollback é
isolado a estes três arquivos de runtime/teste, mais a governança.
