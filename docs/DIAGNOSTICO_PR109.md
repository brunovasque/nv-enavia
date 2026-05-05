# DIAGNÓSTICO PR109 — Prova Real do Ciclo End-to-End
**Data:** 2026-05-05  
**Base:** leitura do código real de executor/src/index.js, patch-engine.js, github-orchestrator.js  
**Objetivo:** mapear exatamente o que a prova real precisa fazer e onde vai travar

---

## 1. FORMATO EXATO DO PAYLOAD QUE /propose PRECISA RECEBER

### Quem chama /propose na prática

**Nunca o usuário diretamente.** O fluxo canônico é:

```
POST /contracts/execute-next  (Worker nv-enavia.js)
  → POST /audit   (Executor)
  → POST /propose (Executor)  ← aqui chega o payload que importa
```

O Worker monta o `_proposePayload` internamente em `nv-enavia.js:6188-6204`. O payload que o Executor recebe é:

```json
{
  "source": "nv-enavia",
  "mode": "contract_execute_next",
  "executor_action": "propose",
  "target": {
    "system": "cloudflare_worker",
    "workerId": "nv-enavia"
  },
  "patch": { "type": "contract_action", "content": "<nextAction JSON>" },
  "prompt": "Proposta supervisionada para ação contratual: <tipo>",
  "intent": "propose",
  "contract_id": "<id>",
  "nextAction": { ... },
  "operationalAction": { ... },
  "execution_id": "<auditId>",
  "evidence": [],
  "approved_by": null,
  "audit_id": "<auditId>",
  "timestamp": "2026-05-05T...",
  "github_token_available": true,
  "context": { "require_live_read": true },
  "use_codex": true,
  "audit_verdict": "<verdict do audit>",
  "audit_findings": { ... }
}
```

### O que o /propose handler faz com esse payload (linha a linha)

**index.js:1071** — `requireLiveRead = action?.context?.require_live_read === true`  
→ `true` porque o Worker colocou `context: { require_live_read: true }`

**index.js:1087** — `targetWorkerId = action?.target?.workerId`  
→ `"nv-enavia"` — sem isso, retorna 422 imediatamente

**index.js:1105** — `resolveScriptName("nv-enavia", env, { strict: false })`  
→ resolve para `"nv-enavia"` via FALLBACK_MAP (index.js:5622). Não precisa de CF API.

**index.js:1148** — `fetchCurrentWorkerSnapshot({ accountId, apiToken, scriptName: "nv-enavia" })`  
→ leitura real do código do Worker via CF API. **Depende de CF_ACCOUNT_ID + CF_API_TOKEN no Executor.**

**index.js:1200** — `if (action.use_codex === true && snap.code.length > 16000)`  
→ nv-enavia.js tem ~350KB → sempre verdadeiro → faz chunking antes de passar ao Codex

**index.js:1326-1337** — modo engineer é forçado quando `action.prompt` tem conteúdo  
→ `action.generatePatch = true` é setado internamente

**index.js:1347** — `enaviaExecutorCore(env, action)` → engineer mode

**index.js:1414** — `if (action.github_token_available === true && staging?.ready === true)`  
→ gate de entrada para o ciclo GitHub

---

## 2. CAMPOS OBRIGATÓRIOS PARA github_token_available=true FUNCIONAR

Para o ciclo GitHub ser acionado, TODOS estes devem ser verdadeiros:

| Condição | Onde verificada | O que falha se ausente |
|----------|----------------|----------------------|
| `action.github_token_available === true` | `index.js:1414` | Bloco GitHub ignorado completamente |
| `staging?.ready === true` | `index.js:1414` | Bloco GitHub ignorado |
| `action.context?.target_code_original` não nulo | `index.js:1415` | `originalCode = null` → bloco interno não executa |
| `execResult?.patch?.patchText` é array não vazio | `index.js:1416` | `patchList = null` → bloco interno não executa |
| `patchResult.applied.length > 0` | `index.js:1421` | `/worker-patch-safe` e `orchestrateGithubPR` não são chamados |
| `patchSafeData?.ok === true` | `index.js:1445` | `orchestrateGithubPR` não é chamado |
| `env.ENAVIA_WORKER.fetch` é função | `github-orchestrator.js:39` | `ENAVIA_WORKER_BINDING_ABSENT` |

### O que seta cada campo:

- `github_token_available=true` → vem do Worker (nv-enavia.js), que tem GITHUB_TOKEN como secret
- `staging.ready=true` → engineer mode seta quando `patches.length > 0` (`index.js:7277,7290`)
- `target_code_original` → setado pelo live read no handler `/propose` (`index.js:1198`)
- `patch.patchText` → retornado pelo engineer mode em `execResult.patch.patchText` (`index.js:7317`)
- `applied.length > 0` → depende de patches com campo `search` (ver Seção 4 Issue I1)
- `patchSafeData.ok` → depende do `/worker-patch-safe` aceitar o candidato
- `ENAVIA_WORKER.fetch` → depende do service binding estar configurado em `executor/wrangler.toml`

### Dependências de ambiente (secrets/vars) necessários no Executor:

| Secret/Var | Necessário para | Status em executor/wrangler.toml |
|-----------|----------------|----------------------------------|
| `CF_ACCOUNT_ID` | live read do Worker via CF API | Não declarado como var (provavelmente via secret) |
| `CF_API_TOKEN` | live read do Worker via CF API | Não declarado como var (provavelmente via secret) |
| `OPENAI_API_KEY` | Codex funcionar (`wantCodex` bloco) | **AUSENTE** — `OPENAI_CODE_MODEL` existe mas não a key |
| `ENAVIA_WORKER` | service binding para proxy GitHub | Declarado: `service = "nv-enavia"` (`executor/wrangler.toml:39`) |
| `GITHUB_REPO` | repo target no orchestrador | **AUSENTE** — default hardcoded `brunovasque/nv-enavia` |
| `GITHUB_FILE_PATH` | arquivo target no orchestrador | **AUSENTE** — default hardcoded `nv-enavia.js` |

### Dependências de ambiente no Worker (nv-enavia.js):

| Secret | Necessário para | Status |
|--------|----------------|--------|
| `GITHUB_TOKEN` | chamar GitHub API em `/github-bridge/execute` | Declarado: `secrets = ["GITHUB_TOKEN"]` em `wrangler.toml` |

O Worker usa GITHUB_TOKEN. O Executor só sabe se ele existe pelo flag `github_token_available` no payload — nunca acessa o token diretamente. **Isso é correto e intencional.**

---

## 3. O QUE /worker-patch-safe PRECISA RECEBER (workerId real)

### Endpoint (executor self-call)

`POST /worker-patch-safe` no próprio Executor. Implementado em `index.js:2407`.

### Body esperado (mode:stage):

```json
{
  "mode": "stage",
  "workerId": "nv-enavia",
  "current": "<código atual completo — snap.code>",
  "candidate": "<código candidato após applyPatch>"
}
```

### O que o endpoint faz internamente:

1. Chama `fetch(request.url.replace("/worker-patch-safe", "/module-validate"))` com `{ content: candidate, expectModule: false }`
2. Se `validateData.ok === false` → retorna `{ ok: false, stage: "validate", syntaxOk: false, ... }` — GitHub não acionado
3. Se `validateData.ok === true` → salva backup em KV (`WORKER_BACKUP:nv-enavia:<ts>`) e candidato (`WORKER_CANDIDATE:nv-enavia:<ts>`)
4. Retorna `{ ok: true, stage: "staged", ... }`

### workerId real do nv-enavia:

O `targetWorkerId` no bloco de orquestração (`index.js:1422`) é:
```javascript
action?.target?.workerId || action?.workerId || 'unknown'
```

O Worker envia `target: { system: "cloudflare_worker", workerId: "nv-enavia" }` → `targetWorkerId = "nv-enavia"`. ✅

O `/worker-patch-safe` recebe `workerId: "nv-enavia"` → salva com chaves:
- `WORKER_BACKUP:nv-enavia:<timestamp>`
- `WORKER_CANDIDATE:nv-enavia:<timestamp>`

### O self-call funciona em produção?

O `request.url` no handler `/propose` será algo como `https://enavia-executor.workers.dev/propose`.  
`new URL('/worker-patch-safe', request.url)` → `https://enavia-executor.workers.dev/worker-patch-safe`.  
O Executor faz `fetch()` externo para si mesmo. **Em Cloudflare Workers, self-calls externos funcionam mas consomem tempo e billing extra.** Não é ideal, mas é funcional.

---

## 4. ISSUES I1-I5 — IMPACTO REAL NA PROVA

### I1 — BLOQUEADOR FUNCIONAL DA PROVA: Codex patches inaplicáveis por applyPatch

**O problema:**

`callCodexEngine` retorna patches com formato:
```javascript
// index.js:7240-7253
{
  title: "...",
  anchor: { match: "..." } | null,
  patch_text: "...",   // ← Codex usa patch_text
  reason: "..."
}
```

`applyPatch` espera:
```javascript
// patch-engine.js:33-34
const search = typeof patch.search === 'string' ? patch.search : '';
const replace = typeof patch.replace === 'string' ? patch.replace : '';
// se !search → skipped com NO_SEARCH_TEXT
```

**Resultado:** Quando Codex gera patches, todos são skipados. `patchResult.applied = []`. O GitHub não é acionado.

**Patches que SIM têm search/replace (hardcoded, index.js):**

Apenas os patches do bloco discovery:
1. `/__internal__/routes` (se `wantsDiscovery=true` e `buildLine` existe no código alvo)
2. `/__internal__/capabilities` (mesma condição)
3. Extração de `execution_id` após `JSON.parse()` (se linha de JSON parse existe no código)

Para o patch 3 ser gerado, o código alvo precisa ter uma linha como:
```javascript
const data = await request.json();
```
E a âncora precisa ser única no arquivo. nv-enavia.js tem ~9000 linhas — pode ter múltiplas ocorrências → AMBIGUOUS_MATCH.

**Impacto na prova:**

Com `use_codex=true` e Codex funcionando (OPENAI_API_KEY no Executor), o ciclo GitHub **não é acionado** porque os patches Codex não têm `search/replace`. A prova falha silenciosamente: `staging.ready=true`, patches existem na resposta, mas `applied=[]` → nenhuma PR é aberta.

**Para a prova end-to-end funcionar hoje**, uma das opções:
- (a) O payload manual inclui patches com `search/replace` explícitos — bypassa Codex completamente
- (b) Adicionar conversão `patch_text → search/replace` antes de `applyPatch` (requer code change)
- (c) Usar o fluxo de discovery que gera patches hardcoded — frágil e limitado

---

### I2 — IMPACTO ALTO NA OBSERVABILIDADE: orchestratorResult não retornado na response

**O problema:**

```javascript
// index.js:1463-1467
if (execIdForPropose) {
  await updateFlowStateKV(env, execIdForPropose, {
    github_orchestration: orchestratorResult,
  });
}
```

O resultado da orquestração (inclui `pr_url`, `branch`, `pr_number`, `commit_sha`) é salvo em KV, mas **não aparece na response de `/propose`**.

A response retorna (index.js:1473-1482):
```json
{
  "system": "...",
  "route": "/propose",
  "result": { ...execResult },
  "pipeline": { ... }
}
```

Sem `github_orchestration` no body.

**Impacto na prova:**

1. O Worker chama `/propose`, recebe a response, **não consegue extrair `pr_url`**
2. O Worker não pode reportar ao usuário "PR aberta em https://..."
3. Para verificar se o ciclo funcionou, é necessário ler KV diretamente — não há endpoint para isso na resposta
4. A prova só pode verificar sucesso via:
   - Inspecionar KV manualmente no Cloudflare Dashboard
   - Verificar no GitHub se a branch/PR foi criada
   - Adicionar um endpoint de consulta de estado (não existe ainda)

**Para provar o ciclo end-to-end**, a prova precisa verificar no GitHub (não na API) que a PR foi aberta.

---

### I3 — IMPACTO BAIXO: Double-fetch do Worker

**O problema:**

`/propose` handler faz live read → `snap.code` → seta `action.context.target_code`.  
Engineer mode dentro de `enaviaExecutorCore` faz **outro** live read → `workerCode`.

Dois chamadas à CF API por request de `/propose`.

**Impacto na prova:**

Dobra o tempo de resposta do `/propose` (cada CF API call pode levar 500ms-2s).  
Não bloqueia o ciclo — apenas lento.

---

### I4 — IMPACTO BAIXO: GITHUB_REPO/GITHUB_FILE_PATH hardcoded

**O problema:**

```javascript
// index.js:1423-1424
const githubRepo = env?.GITHUB_REPO || 'brunovasque/nv-enavia';
const githubFilePath = env?.GITHUB_FILE_PATH || 'nv-enavia.js';
```

Para o repo correto (`brunovasque/nv-enavia`) e arquivo correto (`nv-enavia.js`), os defaults estão certos.

**Impacto na prova:** Nenhum — defaults corretos para este projeto.

---

### I5 — BLOQUEADOR DO CAMINHO CODEX: OPENAI_API_KEY ausente no executor/wrangler.toml

**O problema:**

```javascript
// index.js:7224
if (wantCodex && (env?.OPENAI_API_KEY || env?.CODEX_API_KEY)) {
```

`executor/wrangler.toml` declara `OPENAI_CODE_MODEL = "gpt-5.2"` mas não `OPENAI_API_KEY` como secret. Sem esse secret configurado no Executor em produção, o bloco Codex é silenciosamente pulado.

**Impacto na prova:**

Se `OPENAI_API_KEY` não estiver configurado no Executor no Cloudflare:
- `wantCodex = true` (payload diz `use_codex: true`)
- `env?.OPENAI_API_KEY = undefined`
- Bloco Codex pula completamente
- Só patches hardcoded são gerados
- Se patches hardcoded não aplicam → `applied=[]` → nenhuma PR

**Mesmo se OPENAI_API_KEY estiver configurado**, os patches Codex não passam pelo `applyPatch` (Issue I1). Então a presença ou ausência de OPENAI_API_KEY só afeta quais patches aparecem na *response*, não se o GitHub é acionado.

---

## 5. O QUE A PROVA REAL PRECISA FAZER PARA PROVAR O CICLO END-TO-END

### Cenário mínimo para a prova funcionar hoje (sem fixes adicionais)

**Condição:** I1 não foi corrigido → Codex patches não acionam GitHub

Para provar end-to-end COM o código atual de PR108, a prova precisa:

#### Opção A — Payload direto ao Executor com patches manuais em search/replace

Chamar `POST /propose` no Executor diretamente (não via Worker) com:

```json
{
  "source": "prova-pr109",
  "mode": "contract_execute_next",
  "executor_action": "propose",
  "target": {
    "system": "cloudflare_worker",
    "workerId": "nv-enavia"
  },
  "prompt": "adicionar header X-Enavia-Version na response de /__internal__/build",
  "intent": "propose",
  "github_token_available": true,
  "context": {
    "require_live_read": true
  },
  "use_codex": false,
  "generatePatch": true,
  "patches": [
    {
      "title": "adicionar X-Enavia-Version",
      "search": "return withCORS(jsonResponse({ build:",
      "replace": "return withCORS(jsonResponse({ 'X-Enavia-Version': '1.0', build:"
    }
  ]
}
```

**Problema:** o `/propose` handler não lê `action.patches` diretamente — os patches vêm de `execResult.patch.patchText` (saída do engineer mode). Não há campo de entrada para patches manuais.

#### Opção B — Testar o ciclo via /contracts/execute-next (caminho canônico) e aceitar que hoje o ciclo é parcial

O que funciona hoje:
1. `POST /contracts/execute-next` → Worker chama audit + propose
2. `/propose` lê o código do Worker, gera patches hardcoded (se condições certas)
3. Se algum hardcoded patch tem `search/replace` e é único no arquivo → `applied.length > 0`
4. `/worker-patch-safe` valida sintaxe
5. `orchestrateGithubPR` abre branch + commit + PR

**O que bloqueia:** o hardcoded patch de extração de `execution_id` requer linha específica de `.json()` que seja ÚNICA no arquivo. nv-enavia.js tem muitas linhas com `.json()` → AMBIGUOUS_MATCH provável.

**Prova parcial viável:** Mostrar que cada etapa funciona isoladamente:
- `applyPatch` aplicando patch hardcoded ✅ (testado em 32 cenários)
- `orchestrateGithubPR` abrindo branch + commit + PR ✅ (testado com mock, funciona com GITHUB_TOKEN real no Worker)
- `/worker-patch-safe` validando candidato ✅

#### Opção C — Fix I1 primeiro, depois provar (RECOMENDADO)

Para a prova realmente funcionar end-to-end com Codex:

1. Converter patches Codex de `patch_text` para `{search, replace}` no bloco de orquestração  
   (o próprio Codex deveria gerar `search` e `replace` — isso requer mudança no prompt do `callCodexEngine`)

2. OR: aceitar o formato `patch_text` como `replace` e pedir ao Codex para gerar o `search` também

Sem esse fix, a prova de PR109 não pode usar Codex para gerar o patch que vai para o GitHub.

---

### O que a prova end-to-end precisa provar (checklist mínimo)

```
[ ] 1. Worker recebe pedido em linguagem natural
[ ] 2. Worker chama /audit no Executor → verdict gerado
[ ] 3. Worker chama /propose com github_token_available=true
[ ] 4. Executor lê código real do nv-enavia via CF API (evidência: snapshot_fingerprint)
[ ] 5. Engineer mode gera pelo menos 1 patch com search/replace válido
[ ] 6. applyPatch aplica o patch — applied.length > 0
[ ] 7. /worker-patch-safe valida sintaxe — ok:true
[ ] 8. orchestrateGithubPR abre branch no GitHub — branch criada
[ ] 9. orchestrateGithubPR commita candidato — commit_sha retornado
[ ] 10. orchestrateGithubPR abre PR — pr_number e pr_url retornados
[ ] 11. PR aberta no GitHub com merge_allowed=false (gate humano)
[ ] 12. Bruno revisa PR e decide se aceita o patch
```

### Bloqueadores reais antes de PR109 poder ser executada:

| # | Bloqueador | Criticidade | Solução |
|---|-----------|-------------|---------|
| B-I1 | Codex patches não têm `search/replace` → `applied=[]` sempre quando Codex usado | **CRÍTICO** | Mudar prompt do Codex para retornar `{search, replace}` OU adicionar conversão no bloco de orquestração |
| B-I2 | `pr_url`/`branch` não retornados na response → prova não consegue mostrar URL da PR | **ALTO** | Incluir `github_orchestration` na response de `/propose` quando orquestração ocorre |
| B-I5 | `OPENAI_API_KEY` não configurado no Executor → Codex silenciosamente pulado | **MÉDIO** | Configurar secret no Cloudflare Executor OU aceitar fallback hardcoded |

**Caminho mínimo para PR109 hoje (sem corrigir I1):**

Usar patches hardcoded com `search/replace` explícitos fornecidos pelo usuário como parte do pedido em linguagem natural — o que quebra o conceito de "autoevolução" pois o humano está passando o patch pronto.

**Caminho correto para PR109:**

1. Corrigir I1: mudar `callCodexEngine` para solicitar `search`/`replace` além de `patch_text`
2. Corrigir I2: incluir `github_orchestration` na response
3. Configurar `OPENAI_API_KEY` no Executor
4. Executar prova real: Bruno descreve melhoria → Enavia abre PR sozinha
