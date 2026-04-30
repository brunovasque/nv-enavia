# PR42 — Diagnóstico da Memória Atual no Runtime

**Data:** 2026-04-30
**Tipo:** PR-DIAG (read-only, nenhum runtime alterado)
**Branch:** `copilot/claudepr42-diag-memoria-runtime-brain`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior:** PR41 — PR-DOCS — mergeada (PR #202). Relatório: `schema/reports/PR41_POPULAR_OBSIDIAN_BRAIN_REPORT.md`

---

## 1. Objetivo

Diagnosticar, em modo READ-ONLY, como a memória atual da Enavia funciona no
runtime. Mapear bindings, chaves KV, fluxo de leitura/escrita, participação do
painel e relação com o Obsidian Brain documental. Preparar a base técnica para
PR43 (Brain Loader).

Fontes analisadas com evidência de código real — nenhuma afirmação inventada.

---

## 2. Fontes Analisadas

| Arquivo | Tipo | Analisado |
|---------|------|-----------|
| `wrangler.toml` | Config deploy PROD/TEST | ✅ |
| `wrangler.executor.template.toml` | Config deploy executor | ✅ |
| `nv-enavia.js` | Worker principal (8.980 linhas) | ✅ |
| `contract-executor.js` | Executor de contratos | ✅ |
| `schema/memory-storage.js` | Camada PM2 de persistência | ✅ |
| `schema/memory-read.js` | Camada PM3 de leitura | ✅ |
| `panel/src/pages/ChatPage.jsx` | Página de chat | ✅ |
| `panel/src/pages/MemoryPage.jsx` | Página de memória | ✅ |
| `panel/src/api/endpoints/chat.js` | API de chat do painel | ✅ |
| `panel/src/api/endpoints/memory.js` | API de memória do painel | ✅ |
| `panel/src/memory/ManualMemoryPanel.jsx` | Painel de memória manual | ✅ |
| `panel/src/chat/useAttachments.js` | Hook de anexos do chat | ✅ |
| `schema/brain/` (toda a estrutura) | Brain documental | ✅ |
| `schema/brain/MEMORY_RULES.md` | Regras do brain | ✅ |
| `schema/brain/RETRIEVAL_POLICY.md` | Política de retrieval | ✅ |
| `schema/brain/UPDATE_POLICY.md` | Política de atualização | ✅ |
| `schema/brain/open-questions/INDEX.md` | Questões abertas | ✅ |

---

## 3. Inventário de Bindings e KVs

### 3.1 KVs em `wrangler.toml` (Worker principal `nv-enavia`)

| Binding | ID PROD | ID TEST | Ambiente |
|---------|---------|---------|----------|
| `ENAVIA_BRAIN` | `722835b730dd44c79f6ff1f0cdc314a9` | `235fd25ad3b44217975f6ce0d77615d0` | PROD e TEST |

**`ENAVIA_BRAIN` EXISTE no repo.** Confirmado com IDs reais em `wrangler.toml`.

Outros bindings em `wrangler.toml`:
- `EXECUTOR` (service binding → `enavia-executor`)
- `DEPLOY_WORKER` (service binding → `deploy-worker`)

### 3.2 KVs em `wrangler.executor.template.toml` (Executor worker)

| Binding | Valor no template | Ambiente |
|---------|------------------|----------|
| `ENAVIA_BRAIN` | `REPLACE_WITH_REAL_ENAVIA_BRAIN_ID` | PROD |
| `ENAVIA_BRAIN` | `REPLACE_WITH_REAL_ENAVIA_BRAIN_TEST_ID` | TEST |
| `ENAVIA_GIT` | `REPLACE_WITH_REAL_ENAVIA_GIT_ID` | PROD |
| `ENAVIA_GIT` | `REPLACE_WITH_REAL_ENAVIA_GIT_TEST_ID` | TEST |
| `GIT_KV` | `REPLACE_WITH_REAL_GIT_KV_ID` | PROD |
| `GIT_KV` | `REPLACE_WITH_REAL_GIT_KV_TEST_ID` | TEST |

Os IDs reais são substituídos pelo workflow `deploy-executor.yml` via GitHub Secrets.

### 3.3 Mapeamento consolidado

| KV | Existe no repo? | Usado por | Finalidade |
|----|----------------|-----------|-----------|
| `ENAVIA_BRAIN` | ✅ SIM (ID real) | `nv-enavia.js` + `contract-executor.js` | Toda persistência: memória, contratos, execução, brain |
| `ENAVIA_GIT` | ✅ (apenas executor template) | `contract-executor.js` | Operações git do executor |
| `GIT_KV` | ✅ (apenas executor template) | `contract-executor.js` | Cache de operações git |
| `DEPLOY_KV` | ❌ não encontrado | — | Não existe no repo |
| `PROOF_KV` | ❌ não encontrado | — | Não existe no repo |

### 3.4 Problema de isolamento PROD/TEST identificado

`wrangler.toml` (linha 52-53) contém comentário explícito:

```
# NOTE (item 1 - isolamento): TEST usa o mesmo DIRECTOR_COGNITIVE_URL que PROD.
# Isolamento completo requer um endpoint dedicado de TEST (ex: nv-director-cognitive-test).
```

Tráfego de TEST pode chegar ao director cognitivo de PROD. Esta lacuna já está
documentada no próprio arquivo. Não é escopo desta PR corrigir.

### 3.5 Binding `ENAVIA_BRAIN` compartilhado entre PROD e TEST

O `ENAVIA_BRAIN` PROD e TEST usam KVs diferentes (IDs distintos). ✅ OK.
Porém, ambos os ambientes do executor acessam o mesmo `DIRECTOR_COGNITIVE_URL`
(ver item 3.4). Risco médio para experiência de produção.

---

## 4. Inventário de Chaves/Shapes de Memória

Mapeamento de todas as chaves usadas em `ENAVIA_BRAIN` por `nv-enavia.js`:

### 4.1 Chaves do sistema legado de boot (POST /)

| Chave KV | Operação | Shape | Finalidade |
|----------|----------|-------|-----------|
| `SYSTEM_PROMPT` | GET | texto livre | System prompt do chat. Se ausente, usa fallback hardcoded. |
| `brain:index` | GET + PUT | JSON array de strings | Índice de chaves de memórias de treinamento dinâmico |
| `brain:train:<id>:<timestamp>` | GET + PUT | texto livre | Memórias de treinamento salvas pelo painel (modo brain) |
| `brain:decision` | GET | texto livre | Memória estratégica: decisões (classificada como `strategic`) |
| `brain:policy` | GET | texto livre | Memória estratégica: políticas (classificada como `strategic`) |
| `director:memory*` | GET | texto livre | Memória do Director (classificada como `strategic`) |
| `director:index` | GET | texto multilinha com prefixos `KEY:` | Índice de módulos do Director |
| `enaviaindex` | GET | JSON `{write_permissions: boolean}` | Controle de permissão de escrita no modo brain |
| `enavia:<module_id>:<ts>` | PUT | texto livre | Módulos canônicos salvos quando write_permissions=true |
| `summary:<topic>` | PUT | texto consolidado | Resumos automáticos por tópico (Memory V3) |

### 4.2 Chaves do sistema PM2/PM3 (POST /chat/run e /memory/*)

| Chave KV | Operação | Shape | Finalidade |
|----------|----------|-------|-----------|
| `memory:index` | GET + PUT | JSON array de memory_id | Índice do sistema de memória estruturada (PM2) |
| `memory:<memory_id>` | GET + PUT | JSON objeto PM1 | Memória individual (tipo, conteúdo, status, flags, etc.) |
| `chat:pending_plan:<session_id>` | GET + PUT + DELETE | JSON pendingValue | Plano pendente de aprovação (TTL 600s) |
| `planner:latest:<session_id>` | GET + PUT | JSON plannerPayload | Último snapshot do planner por sessão (sem TTL no /planner/run) |

### 4.3 Chaves de execução e trilha

| Chave KV | Operação | Shape | Finalidade |
|----------|----------|-------|-----------|
| `execution:trail:latest` | PUT | JSON trail | Trail da execução mais recente |
| `execution:trail:<bridgeId>` | PUT | JSON trail | Trail por bridge ID |
| `execution:exec_event:latest_contract_id` | GET + PUT | string (contractId) | ID do contrato mais recente executado |
| `decision:<id>` | PUT | JSON decision record | Registro de decisão |
| `decision:latest` | GET + PUT | JSON decision record | Decisão mais recente |
| `browser-arm:state` | GET + PUT | JSON estado do Browser Arm | Estado do Browser Arm |

### 4.4 Chaves do executor (`contract-executor.js`)

| Chave KV | Operação | Shape | Finalidade |
|----------|----------|-------|-----------|
| `contract:index` | GET + PUT | JSON array | Índice de contratos (PM via executor) |
| `contract:<id>` | GET + PUT | JSON state + JSON decomposition | Estado e decomposição de contratos |
| Chaves de exec_event | PUT + GET | JSON log | Log de eventos de execução |
| `browser-arm:state` | GET + PUT | JSON estado | Estado do Browser Arm (compartilhado com worker) |

### 4.5 Shape do objeto de memória PM1 (memory:<id>)

O sistema PM2 (`schema/memory-schema.js`) define este objeto:
```json
{
  "memory_id": "string único",
  "entity_type": "SYSTEM | PROJECT | SESSION | ...",
  "entity_id": "string",
  "memory_type": "canonical_rules | project | live_context | user_profile | operational_history | MEMORIA_MANUAL",
  "title": "string",
  "content_structured": { "text": "string" },
  "status": "active | blocked | expired | archived | superseded",
  "confidence": "confirmed | high | medium | low",
  "priority": "critical | high | medium | low",
  "flags": [],
  "is_canonical": false,
  "source": "string",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### 4.6 TTLs identificados

| Chave | TTL | Fonte |
|-------|-----|-------|
| `chat:pending_plan:<session_id>` | 600s (10 min) | `_PENDING_PLAN_TTL_SECONDS` em nv-enavia.js |
| `planner:latest:<session_id>` | 600s (/chat/run) ou sem TTL (/planner/run) | variável conforme rota |
| Demais chaves | sem TTL | persistência indefinida |

### 4.7 Risco de colisão de namespaces

O KV `ENAVIA_BRAIN` concentra todos os namespaces sem particionamento:
- `memory:*` (PM2/PM3)
- `brain:train:*` (legado boot)
- `contract:*` (executor)
- `execution:*` (trilha)
- `decision:*`
- `planner:*`
- `director:*`
- `browser-arm:*`
- `summary:*`
- `SYSTEM_PROMPT`

**Risco real de colisão**: prefixo `memory:index` existe tanto no PM2 como potencialmente
no sistema de treinamento. Prefixo `brain:index` é o índice de treinamento legado,
`memory:index` é o índice PM2. São sistemas distintos num mesmo KV.

---

## 5. Fluxo Atual de Memória no Chat

### 5.1 Rota POST / (chat legado)

```
1. handleChatRequest(request, env)
2.   → buildBrain(env)
       a. carrega brain:index do KV
       b. para cada key em brain:index: carrega conteúdo do KV → NV_MODULE_CACHE
       c. carrega SYSTEM_PROMPT do KV
       d. Memory Classifier: separa strategic (director:memory, brain:decision,
          brain:policy) vs operational
   → buildMessages(brain, userMessage)
       a. buildSystemPrompt: usa SYSTEM_PROMPT (KV) ou fallback hardcoded
       b. filtra brain:train:* entries, score por relevância com userMessage
       c. injeta memórias relevantes como "## 🧠 MEMÓRIAS RELEVANTES DA ENAVIA ##"
   → getDirectorMemory(): injeta memórias strategic como mensagem system extra
   → detectDirectorMemoryIntent(): detecta intenção de nova memória (não grava sozinho)
   → callChatModel(env, messages)
```

**Memória é manual**: só existe se alguém salvou via modo `brain` ou via `/memory/manual`.
**Memória é lida na boot** (buildBrain), não por intenção.
**Nenhum Obsidian Brain documental (`schema/brain/`) é carregado aqui.**

### 5.2 Rota POST /chat/run (chat LLM-first — painel)

```
1. handleChatLLM(request, env)
2.   BLOCO B: verifica aprovação de pending_plan (chat:pending_plan:<session_id>)
       → se aprovado: dispatch ao executor, retorna imediatamente
3.   FLUXO LLM:
       a. buildChatSystemPrompt (schema/enavia-cognitive-runtime.js)
          - usa target.mode e is_operational_context para decidir tom
       b. buildCognitivePromptBlock: contexto de target
       c. buildOperationalAwareness: estado do sistema
       d. classifyRequest (PM4): classifica intenção da mensagem
       e. buildRetrievalContext (PM5): busca memórias relevantes via PM3
       f. buildRetrievalSummary: resume contexto de memória
       g. buildCanonicalPlan (PM6): plano canônico
       h. evaluateApprovalGate (PM7): gate de aprovação
       i. buildExecutorBridgePayload (PM8): payload para executor
       j. consolidateMemoryLearning (PM9): consolida aprendizado pós-ciclo
       k. Persistência: planner:latest:<session_id> no KV
       l. Se gate exige aprovação: chat:pending_plan:<session_id> (TTL 600s)
4.   memory_applied, memory_hits retornados na resposta
```

**Memória é injetada por PM5 (buildRetrievalContext)**, que usa PM3 (memory-read.js)
para buscar memórias PM2 relevantes da chave `memory:index`/`memory:<id>`.

### 5.3 O que é "memória aplicada" (memory_applied)

- `memory_applied: true` quando PM5 encontrou memórias com relevância e as injetou
- `memory_hits`: lista de memórias que participaram
- `memory_content_injected: true` quando conteúdo foi de fato colocado no prompt
- Esses campos aparecem na resposta da API E nos metadados do painel

### 5.4 Diferença entre memória persistente e contexto temporário

| Tipo | Onde fica | TTL | Fonte |
|------|-----------|-----|-------|
| Memória estruturada (PM2) | `memory:<id>` no KV | indefinida | `/memory/manual` ou ciclo PM9 |
| Memória de treinamento | `brain:train:*` no KV | indefinida | POST / com mode:brain |
| Pending plan | `chat:pending_plan:<session_id>` | 600s | /chat/run com gate |
| Planner snapshot | `planner:latest:<session_id>` | 600s ou indefinido | /chat/run ou /planner/run |
| Attachment (arquivo) | apenas na sessão do painel | sessão | useAttachments.js (local) |
| conversation_history | apenas no payload da requisição | requisição | useChatState.js (_PR5_MAX_HISTORY=20) |

---

## 6. Fluxo do Painel Relacionado à Memória

> Mapeamento read-only. Nenhum painel foi alterado.

### 6.1 Existe botão "Salvar na memória" no chat?

**NÃO** encontrado em `ChatPage.jsx`, `ChatComposer.jsx` ou componentes do chat.

O chat NÃO tem escrita direta de memória via UI de conversa. A escrita de memória
ocorre em páginas/painéis separados.

### 6.2 Existe funcionalidade de "Salvar na memória" em outro lugar?

**SIM** — `ManualMemoryPanel.jsx` (dentro de `MemoryPage.jsx`):
- Operador pode criar memória manual com título, conteúdo, prioridade, confiança e tags
- POST para `/memory/manual` → `createManualMemory`
- Memória criada como `MEMORIA_MANUAL` no sistema PM2
- Essa memória entra no retrieval de PM3 para chat futuro

### 6.3 Existe botão "Anexar contexto"?

**SIM** — `useAttachments.js`:
- Arquivos locais (`.txt`, `.md`, `.json`, `.js`, `.ts`, `.jsx`, etc.)
- Tamanho máximo: 32 KB por arquivo (truncado com aviso)
- `.pdf`, `.xlsx` são bloqueados
- O arquivo é lido como texto local e enviado como `context.attachments` no payload da API
- **O Worker NÃO persiste attachments no KV** — são usados apenas na requisição corrente

### 6.4 Existe memória aplicada mostrada na UI?

**SIM** — `MemoryInUseCard.jsx` mostra informações de memória em uso (dados vindos
da resposta da API via `memoryApplied`, `memoryHits`, `memoryContentInjected`).

### 6.5 O painel lê memória do backend?

**SIM** — `MemoryPage.jsx` chama `fetchMemory()` → GET `/memory`:
- Retorna memórias PM2 (canonical + operational)
- Painel mostra memória existente no KV

### 6.6 O painel envia contexto no payload?

**SIM** — `ChatPage.jsx` passa `context = { target }` com toda mensagem:
```js
const ctx = { target }; // { worker, branch, environment, mode }
reqBody.context = ctx;
```

Também `context.attachments` quando há arquivos anexados.

### 6.7 O Worker valida o payload do painel?

**Parcialmente**. O Worker lê `body.context.target` e usa os campos para
contexto de prompt (`buildChatSystemPrompt`). Não há validação de origem
nem sanitização de campos de target além de verificações de tipo básicas.

**Risco de injeção de contexto**: se o painel (ou um cliente malicioso com
acesso à API) enviar um `target.worker` ou `target.mode` manipulado, o Worker
pode injetar comportamento operacional indesejado no prompt.

### 6.8 Diferença entre sessão, target, memória e anexo

| Conceito | Onde vive | Persiste entre sessões? |
|----------|-----------|------------------------|
| `session_id` | cookie do painel (localStorage) | sim (até limpar) |
| `target` | estado do painel (useTargetState) | sim (localStorage) |
| Memória manual (PM2) | KV `memory:<id>` | sim |
| Memória de treinamento | KV `brain:train:*` | sim |
| Anexo (arquivo) | apenas no payload corrente | não |
| conversation_history | estado do painel (useChatState) | não (só na sessão ativa) |

### 6.9 Conclusão sobre painel e separação de escopos

O painel participa da memória de duas formas:
1. **Passiva**: envia `target` e `context.attachments` no payload do chat
2. **Ativa**: operador cria memórias manuais via MemoryPage

Qualquer mudança na experiência de memória no painel (visualizar brain documental,
editar memórias, gerenciar brain context) deve ser **PR separada Panel-only**.
Não misturar com Worker.

---

## 7. Relação com Obsidian Brain Documental

### 7.1 O Brain documental (`schema/brain/`) está conectado ao runtime?

**NÃO.** Confirmado por evidência de código.

Nenhum arquivo do diretório `schema/brain/` é carregado por `nv-enavia.js` ou
`contract-executor.js`. O Brain é puramente documental nesta PR42.

O runtime atual lê:
- Arquivos importados em `nv-enavia.js` (bundled no worker)
- Chaves do KV `ENAVIA_BRAIN` (runtime)

Arquivos em `schema/brain/` NÃO são bundled automaticamente e NÃO são lidos
em runtime.

### 7.2 O runtime consegue ler arquivos do repo?

**NÃO** em produção. Workers Cloudflare são executados como bundles isolados.
Não há acesso ao filesystem do repo em runtime.

Para usar arquivos do Brain, existem duas abordagens:
1. **Bundle estático**: importar os arquivos na build → ficam dentro do bundle JS
2. **KV snapshot**: gerar um snapshot em build time e salvar no KV

### 7.3 Quais arquivos do Brain seriam prioritários?

Baseado na `RETRIEVAL_POLICY.md` para intenção `conversation`:
1. `schema/brain/self-model/identity.md` (identidade)
2. `schema/brain/self-model/how-to-answer.md` (como responder)
3. `schema/brain/self-model/capabilities.md` (capacidades reais)
4. `schema/brain/self-model/limitations.md` (limites)
5. `schema/brain/self-model/current-state.md` (estado atual)
6. `schema/brain/SYSTEM_AWARENESS.md` (consciência situacional)
7. `schema/brain/memories/INDEX.md` (referência de memórias)

Arquivos a NÃO carregar inicialmente (muito pesados ou não essenciais):
- Todo o `schema/brain/decisions/`
- Todo o `schema/brain/incidents/`
- Todo o `schema/brain/learnings/`
- Todo o `schema/brain/contracts/`
- Os contratos originais em `schema/contracts/`
- Os `schema/reports/` (históricos longos)

### 7.4 O Brain documental precisa de loader/manifest?

**SIM**, uma das estratégias de loader. Cada opção tem trade-offs diferentes
(ver Seção 8).

---

## 8. Opções de Arquitetura para Brain Loader

### Opção 1 — Bundle estático (arquivos no repo incluídos no bundle)

**Como funciona**: importar os arquivos Markdown como strings no `nv-enavia.js`
durante a build usando bundler (esbuild/webpack).

```js
import identityMd from "./schema/brain/self-model/identity.md?raw";
```

| Critério | Avaliação |
|----------|-----------|
| Vantagens | Sem infra extra, sem latência KV, sem CI/CD adicional, sem risco de divergência |
| Riscos | Aumenta tamanho do bundle (Workers tem limite de ~1MB/3MB comprimido) |
| Custo | Zero (sem nova infra) |
| Complexidade | Baixa — apenas importar strings e injetar no prompt |
| Segurança | Alta — brain está no bundle, não exposto externamente |
| Recomendação | ✅ **RECOMENDADO para PR43** (allowlist pequena, risk mínimo) |

### Opção 2 — Brain snapshot em KV

**Como funciona**: CI/CD gera um JSON com os arquivos do Brain e salva em
`ENAVIA_BRAIN` chave `brain:obsidian:snapshot` na build.

| Critério | Avaliação |
|----------|-----------|
| Vantagens | Atualizável sem redeploy do worker, bundle menor |
| Riscos | Divergência docs/runtime se snapshot não for atualizado, custo de KV reads |
| Custo | Baixo (reads KV são baratos) |
| Complexidade | Média — precisa de step extra no CI/CD |
| Segurança | Média — snapshot visível no KV, pode ser sobrescrito se KV comprometido |
| Recomendação | ⚠️ Considerar para versão futura se allowlist crescer muito |

### Opção 3 — Brain index gerado em build

**Como funciona**: script de build gera um `brain-manifest.json` com metadados
e conteúdo dos arquivos allowlisted, incluído no bundle como JSON.

| Critério | Avaliação |
|----------|-----------|
| Vantagens | Estruturado, permite filtragem por intenção em runtime |
| Riscos | Mais complexidade, maior tamanho de bundle |
| Custo | Zero (sem nova infra) |
| Complexidade | Alta — precisa de script de build + lógica de seleção |
| Segurança | Alta |
| Recomendação | ⚠️ Prematura para PR43 — usar bundle direto primeiro |

### Opção 4 — Brain externo via GitHub raw

**Como funciona**: Worker faz fetch dos arquivos do repo via GitHub raw URLs
em runtime.

| Critério | Avaliação |
|----------|-----------|
| Vantagens | Sempre atualizado sem redeploy |
| Riscos | Latência adicional, pode falhar em CF (domínios potencialmente bloqueados), dependência externa |
| Custo | Baixo + latência |
| Complexidade | Baixa no código, alta em confiabilidade |
| Segurança | Baixa — dependência externa, possível vazamento de estrutura |
| Recomendação | ❌ NÃO recomendado para produção |

### Opção 5 — Híbrido: bundle + cache em KV

**Como funciona**: allowlist inicial bundled + possibilidade de override via KV
para updates sem redeploy.

| Critério | Avaliação |
|----------|-----------|
| Vantagens | Flexível, fallback seguro |
| Riscos | Complexidade maior, dois caminhos a manter |
| Custo | Baixo |
| Complexidade | Alta para PR43 |
| Segurança | Alta |
| Recomendação | ⚠️ Considerar depois da Opção 1 estar estável |

---

## 9. Lacunas Técnicas para PR43

### 9.1 Qual arquivo/função deve receber o Brain Loader?

**`nv-enavia.js` — função `buildChatSystemPrompt`** em
`schema/enavia-cognitive-runtime.js`.

Esta função já constrói o system prompt para `/chat/run`. É o ponto cirúrgico
para injetar o contexto documental do Brain sem quebrar o fluxo existente.

O loader deve ser adicionado como um bloco `## 🧠 CONTEXTO DOCUMENTAL DA ENAVIA ##`
separado do `## 🧠 MEMÓRIAS RELEVANTES DA ENAVIA ##` já existente.

### 9.2 O Brain Loader deve ser Worker-only?

**SIM.** Não deve tocar painel, executor, deploy worker nem workflows.

### 9.3 Quais arquivos do Brain carregar primeiro?

Allowlist inicial recomendada (5 arquivos do self-model + 1 SYSTEM_AWARENESS):

```
schema/brain/self-model/identity.md
schema/brain/self-model/how-to-answer.md
schema/brain/self-model/capabilities.md
schema/brain/self-model/limitations.md
schema/brain/self-model/current-state.md
schema/brain/SYSTEM_AWARENESS.md
```

### 9.4 Deve começar só com self-model + memories + SYSTEM_AWARENESS?

**SIM.** Esta allowlist é suficiente para PR43. `memories/` ainda está vazio
(apenas INDEX.md), portanto não precisa ser incluída na PR43.

### 9.5 Deve ter limite de caracteres?

**SIM.** Contexto LLM custa tokens. Limite sugerido:
- Por arquivo: 1.500 chars (truncado com aviso em log)
- Total do bloco documental: 4.000 chars
- Se ultrapassar: carregar apenas os primeiros N arquivos da allowlist

### 9.6 Deve ter allowlist de arquivos?

**SIM.** Array estático no código. Não deve carregar dinamicamente qualquer
arquivo do Brain sem validação.

### 9.7 Como evitar carregar todo o Brain e estourar contexto?

1. Allowlist fixa de arquivos (não dinâmica)
2. Truncamento por arquivo e por total
3. Não carregar pastas: `decisions/`, `incidents/`, `learnings/`, `contracts/`
4. Não carregar `schema/contracts/`, `schema/reports/` nem arquivos de governança

### 9.8 Como evitar alucinação por documento desatualizado?

1. O Brain documental deve incluir a data do arquivo no início
2. O loader deve injetar uma nota: `"[CONTEXTO DOCUMENTAL — NÃO É RUNTIME. Ler como referência comportamental, não como estado atual]"`
3. Estado atual do sistema deve vir de `schema/status/ENAVIA_STATUS_ATUAL.md` ou
   do próprio contexto operacional, não do Brain documental

### 9.9 Como sinalizar que Brain é fonte documental, não runtime executável?

Injetar no início do bloco Brain:
```
[BRAIN DOCUMENTAL — Fonte de identidade, comportamento e self-model.
 Não é estado atual do sistema. Não afirmar capacidades futuras como presentes.
 Para estado atual: usar context.target e operational_awareness.]
```

### 9.10 Pré-condições para PR43

| Pré-condição | Status |
|-------------|--------|
| ENAVIA_BRAIN binding existe | ✅ |
| buildChatSystemPrompt existe e é extensível | ✅ |
| Allowlist de arquivos definida | ✅ (nesta PR42) |
| Schema do bloco documental definido | ✅ (nesta PR42) |
| Arquivos do self-model existem | ✅ (PR40) |
| SYSTEM_AWARENESS.md existe | ✅ (PR39) |
| Tamanho atual dos arquivos conhecido | ✅ (todos < 5KB) |

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Contexto caro demais (tokens) | Alta sem limite | Alto | Limite de chars por arquivo e total |
| Brain com info desatualizada (current-state.md) | Média | Médio | Nota de sinalização documental |
| LLM afirmar capacidade futura como atual | Alta sem sinalização | Alto | Nota explícita no bloco + capabilities.md já lista "não existe ainda" |
| Brain virar prompt gigante | Alta sem allowlist | Alto | Allowlist fixa de 6 arquivos |
| Colisão de namespaces no KV | Já existe | Médio | Documentado — não há dois sistemas usando o mesmo prefixo exato |
| Injeção de contexto via payload do painel | Média | Médio | Worker confia no `target` do painel sem validação de origem |
| Divergência docs/runtime (brain diz X, runtime faz Y) | Alta | Médio | PR43 injeta apenas self-model — não estado de sistema |
| Brain virar justificativa para escrita automática | Baixa | Alto | Brain Loader é read-only; update_policy define que só PR aprovada grava memória |
| Painel e Worker misturados indevidamente | Baixa | Alto | Contrato proíbe — garantido pela governança |
| Escrita automática sem aprovação | Não existe ainda | N/A | Sistema PM9 propõe candidatos, não grava sem aprovação |
| Payload do painel com target manipulado | Baixa | Médio | Não há validação de origem no Worker — lacuna documentada |
| TEST compartilhando director cognitivo com PROD | Já existe | Médio | Documentado em wrangler.toml, aguarda endpoint dedicado |

---

## 11. Recomendação Objetiva para PR43

### PR43 — PR-IMPL — Brain Loader read-only Worker-only

**Tipo:** `PR-IMPL`
**Escopo:** `Worker-only`
**Não toca:** painel, executor, deploy worker, workflows, wrangler, secrets, KV config

**O que implementar:**

1. **Importar arquivos da allowlist como strings bundled no worker** (Opção 1):
   ```
   schema/brain/self-model/identity.md
   schema/brain/self-model/how-to-answer.md
   schema/brain/self-model/capabilities.md
   schema/brain/self-model/limitations.md
   schema/brain/self-model/current-state.md
   schema/brain/SYSTEM_AWARENESS.md
   ```

2. **Ponto de injeção:** `buildChatSystemPrompt` em `schema/enavia-cognitive-runtime.js`

3. **Bloco injetado:**
   ```
   [CONTEXTO DOCUMENTAL — identidade e self-model da Enavia.
    Fonte: schema/brain/. Não é estado atual de runtime.]
   
   ## 🧠 BRAIN DOCUMENTAL — SELF-MODEL ##
   [conteúdo dos arquivos allowlisted, truncado a 4000 chars total]
   ```

4. **Limite:** 4.000 chars total, 1.500 por arquivo (truncado com log)

5. **Sem escrita:** Brain Loader só lê — não grava nada no KV

6. **Sem endpoint novo:** nenhuma rota criada

7. **Smoke test:** verificar que `/chat/run` retorna reply que cita identidade
   da Enavia quando perguntado "quem você é?" — sem mencionar capacidades futuras
   como presentes

**Condição de viabilidade:** Todos os arquivos da allowlist existem no repo
(confirmado nesta PR42). PR43 pode ser implementada.

**Veredicto:** PR43 como PR-IMPL é viável. Não há bloqueio real.

---

## 12. O Que NÃO Foi Feito

Esta PR é diagnóstico puro. Os itens abaixo NÃO foram feitos:

- ❌ Nenhum runtime alterado (`nv-enavia.js`, `contract-executor.js`, `schema/*.js`)
- ❌ Nenhum painel alterado
- ❌ Nenhum endpoint criado
- ❌ Nenhum Brain Loader criado
- ❌ Nenhuma conexão do Brain ao chat
- ❌ Nenhum KV criado ou alterado
- ❌ Nenhum binding alterado
- ❌ Nenhum workflow alterado
- ❌ Nenhuma secret alterada
- ❌ Nenhum contrato novo criado

### 12.1 Estado pós-PR41

PR41 foi mergeada como PR #202 e validada. Relatório disponível em
`schema/reports/PR41_POPULAR_OBSIDIAN_BRAIN_REPORT.md`. Esta PR42 parte
do estado pós-PR41.

---

## 13. Próxima PR

### Condição: diagnóstico confirma viabilidade

**PR43 — PR-IMPL — Brain Loader read-only Worker-only**

- Tipo: `PR-IMPL`
- Escopo: `Worker-only`
- Objetivo: implementar Brain Loader com allowlist dos 6 arquivos do self-model
  e SYSTEM_AWARENESS, bundled estático, injetado em `buildChatSystemPrompt`,
  limite de 4.000 chars, read-only, sem endpoint, sem painel, com smoke test

Todos os pré-requisitos para PR43 estão satisfeitos. Implementação viável.
Não há bloqueio real identificado neste diagnóstico.
