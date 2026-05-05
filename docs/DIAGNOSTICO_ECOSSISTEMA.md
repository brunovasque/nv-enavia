# DIAGNÓSTICO_ECOSSISTEMA.md
**Data:** 2026-05-04  
**Branch:** claude/pr107-self-patch-diag  
**Escopo:** Leitura real de código — nv-enavia.js, executor/src/index.js, wrangler.toml (ambos), schema/enavia-github-adapter.js  
**Deploy Worker:** EXTERNO — sem código local no repo  

---

## 1. nv-enavia.js — Worker Principal

### Rotas existentes (mapeadas do código real)

**Comunicação interna (via bridge para outros sistemas):**
- `POST /audit` → `callExecutorBridge(env, "/audit", body)`
- `POST /propose` → `callExecutorBridge(env, "/propose", body)`
- `GET /audit` → `callExecutorBridge(env, "/audit", body)`
- `GET /engineer`, `POST /engineer` → `handleEngineerRequest()` → `env.EXECUTOR.fetch("https://executor")`
- `POST /planner/bridge` → `callExecutorBridge(env, "/propose", ...)`
- `/__internal__/build` → `callDeployBridge(env, "build", body)`

**Rotas autônomas (Worker faz sozinho):**
- `POST /github-bridge/execute` → handler local com `executeGithubBridgeRequest()` (usa `schema/enavia-github-adapter.js` + `env.GITHUB_TOKEN`)
- `GET /github-pr/action`, `POST /github-pr/action` → handler local
- `GET /github-pr/request-merge`, `POST /github-pr/request-merge` → handler local
- `POST /github-pr/approve-merge` → handler local
- `GET /memory`, `POST /memory/manual`, `POST /memory/learning`, `GET /memory/audit` → KV ENAVIA_BRAIN local
- `GET /contracts/*`, `POST /contracts/*` → KV ENAVIA_BRAIN + contratos locais
- `GET /skills/propose`, `POST /skills/approve`, `POST /skills/reject`, `GET /skills/factory/spec`, `POST /skills/factory/create` → lógica local
- `POST /chat/run`, `POST /planner/run`, `POST /execution`, `POST /execution/decision` → lógica local
- `POST /director/cognitive` → lógica local
- `POST /vercel/patch` → lógica local
- `GET /browser-arm/state`, `POST /browser-arm/action` → lógica local
- `GET /enavia/observe` → lógica local
- `GET /health`, `GET /` → resposta local

### Como o Worker chama os outros sistemas

**→ Executor (SERVICE BINDING ONLY):**
```javascript
// callExecutorBridge — linha ~5573
async function callExecutorBridge(env, route, payload) {
  const resp = await env.EXECUTOR.fetch(
    "https://enavia-executor.internal" + route,
    { method: "POST", body: JSON.stringify(payload), ... }
  );
}
```
- Sem fallback HTTP. Se `env.EXECUTOR` ausente → falha total.
- `ENAVIA_EXECUTOR_URL` (em wrangler.toml) é usado SOMENTE em output de debug (linha ~2382), nunca para chamadas reais.

**→ Deploy Worker (SERVICE BINDING ONLY):**
```javascript
// callDeployBridge — linha ~5769
async function callDeployBridge(env, action, payload) {
  const resp = await env.DEPLOY_WORKER.fetch(
    "https://deploy-worker.internal" + path,
    { method: "POST", ... }
  );
}
```
- PROD bloqueado no código (ações de produção rejeitadas na lógica do Worker).
- Sem fallback HTTP.

### O que o Worker faz sozinho vs depende dos outros

| Capacidade | Solo | Precisa Executor | Precisa Deploy Worker |
|---|---|---|---|
| GitHub Bridge (branch, commit, PR) | ✅ | ✗ | ✗ |
| Memória (ENAVIA_BRAIN KV) | ✅ | ✗ | ✗ |
| Contratos / Skills / Plans | ✅ | ✗ | ✗ |
| Chat/Planner/Director | ✅ | ✗ | ✗ |
| Audit (análise de código) | ✗ | ✅ | ✗ |
| Propose (patch via LLM) | ✗ | ✅ | ✗ |
| Engineer (engenharia guiada) | ✗ | ✅ | ✗ |
| Build / Deploy staging | ✗ | ✗ | ✅ |

---

## 2. executor/src/index.js — Executor

### Todos os endpoints reais

| Endpoint | Método | O que faz |
|---|---|---|
| `/` | GET | Status/health básico |
| `/health` | GET | Health check com diagnóstico de env |
| `/status` | GET | Estado do sistema com credenciais presentes |
| `/versions` | GET | Lista versões no KV |
| `/version` | GET | Versão atual |
| `/audit` | POST | Alias para executor core v2 — lê snapshot CF + Codex Engine |
| `/propose` | POST | Alias para executor core v2 — gera patch via Codex Engine |
| `/engineer` | GET/POST | Rota de engenharia guiada |
| `/engineer-core` | POST | Core de engenharia |
| `/module-get` | GET | Busca módulo no KV |
| `/module-list` | GET | Lista módulos no KV |
| `/module-save` | POST | Salva módulo no KV |
| `/module-patch` | POST | Patch cirúrgico em módulo |
| `/module-validate` | POST | Valida sintaxe de módulo |
| `/module-diff` | POST | Diff de módulo |
| `/worker-patch-safe` | POST | Staging de patch no KV (sem deploy real) |
| `/worker-deploy` | POST | **DELEGA ao Deploy Worker** via HTTP |
| `/apply-patch` | POST | Salva versão no KV (auto_deploy=STUB) |
| `/apply-exec` | POST | Salva intent de exec no KV (auto_deploy=STUB) |
| `/rollback` | POST | Rollback via KV (sem deploy real direto) |
| `/deploy` | POST | Delega ao Deploy Worker |
| `/validate-code` | POST | Validação de código |
| `/diff` | POST | Diff entre versões |
| `/audit-log` | GET | Últimos logs do KV |
| `/boundary` | GET | Info sobre limites do executor |
| `/browser-proof` | POST | Prova de browser |
| `/__internal__/deploy-apply` | POST | Deploy interno |
| `/__internal__/describe` | GET | Descrição do sistema |

### O que já tem de Cloudflare Bridge (CF API real)

```javascript
// fetchCurrentWorkerSnapshot — linha 5357
// Lê o código de um Worker via CF API
async function fetchCurrentWorkerSnapshot({ accountId, apiToken, scriptName }) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/javascript" }
  });
  return { code, etag, last_modified, fetched_at_ms };
}

// listCloudflareWorkerScripts — linha 5396
// Lista todos os scripts da conta
async function listCloudflareWorkerScripts(env) { ... }

// resolveScriptName — linha ~5450
// Resolve nome amigável para script real no CF
```

**Status:** FUNCIONAL — se CF_ACCOUNT_ID + CF_API_TOKEN presentes nos secrets.

### O que já tem de inter-worker

```javascript
// delegateToDeployWorker — linha 297
// HTTP direto para DEPLOY_WORKER_URL (não service binding)
async function delegateToDeployWorker(path, body) {
  const url = env.DEPLOY_WORKER_URL + path;
  const resp = await fetch(url, { method: "POST", body: JSON.stringify(body) });
}
```

### Credenciais necessárias no Executor

| Credencial | Onde | Obrigatório para |
|---|---|---|
| `CF_ACCOUNT_ID` | var (wrangler.toml template) | CF API — fetchWorkerSnapshot, listScripts |
| `CF_API_TOKEN` | secret (não no template) | CF API — idem |
| `OPENAI_API_KEY` | secret | callCodexEngine (LLM patch generation) |
| `OPENAI_CODE_MODEL` | var (`gpt-5.2` no template) | callCodexEngine (modelo LLM) |
| `DEPLOY_WORKER_URL` | var | delegateToDeployWorker (HTTP) |
| `ENAVIA_BRAIN` | KV binding | Memória compartilhada |
| `ENAVIA_GIT` | KV binding | Versionamento Git-like |
| `GIT_KV` | KV binding | KV Git auxiliar |

### O que está funcional vs stub

| Componente | Status | Observação |
|---|---|---|
| `fetchCurrentWorkerSnapshot` | ✅ FUNCIONAL | Lê código real via CF API |
| `listCloudflareWorkerScripts` | ✅ FUNCIONAL | Lista real via CF API |
| `callCodexEngine` | ✅ FUNCIONAL | OpenAI gpt-4.1-mini, 16k chars max de código |
| `/worker-patch-safe` (stage) | ✅ FUNCIONAL | Salva patch no KV, NÃO faz deploy |
| `/worker-deploy` | ✅ FUNCIONAL | Delega ao Deploy Worker via HTTP |
| `/apply-patch` com `auto_deploy=true` | ⚠️ STUB | `performDeploy()` sempre lança erro |
| `/apply-exec` com `auto_deploy=true` | ⚠️ STUB | Mesmo problema |
| `/rollback` com deploy real | ⚠️ STUB | Idem |
| GitHub Bridge | ❌ AUSENTE | Executor não tem GITHUB_TOKEN, nem adapter |
| self-patch completo (PR107) | ❌ AUSENTE | Falta integração Executor→GitHub |

---

## 3. Deploy Worker

**Localização no repo:** NENHUMA — não existe código no repositório.  
**URL externa:** `https://deploy-worker.brunovasque.workers.dev`  
**Referências no repo:**
- `executor/wrangler.toml`: `DEPLOY_WORKER_URL = "https://deploy-worker.brunovasque.workers.dev"`
- `wrangler.executor.template.toml`: idem
- `executor/src/index.js`: `delegateToDeployWorker()` via HTTP POST

**O que se sabe pelo código que chama:**
- Recebe `/worker-deploy` com `{ workerId, candidateKey, backupKey }`
- Recebe `/__internal__/audit` e `/apply-test` do Worker principal (via callDeployBridge)
- É responsabilidade exclusiva pelo deploy real no Cloudflare
- `performDeploy()` no Executor é STUB permanente — se Deploy Worker ausente ou sem URL, deploy falha com `DEPLOY_WORKER_NOT_CONFIGURED`

**O que NÃO é possível auditar:** Sem código local, não é possível verificar lógica interna, tratamento de erros, autenticação entre sistemas, ou estado real.

---

## 4. Mapa de Comunicação Atual

```
┌─────────────────────────────────────────────────────────────────┐
│                     nv-enavia (Worker)                          │
│                                                                 │
│  ENAVIA_BRAIN (KV) ← leitura/escrita direta                    │
│  enavia-github-adapter.js ← import local (CJS)                 │
│  GITHUB_TOKEN ← secret no Worker                               │
│                                                                 │
│  /github-bridge/execute ──────────────────────────[solo] ───▶ GitHub API │
│  /memory /contracts /skills /chat ─────────────── [solo]        │
│                                                                 │
│  /audit /propose /engineer ──── env.EXECUTOR.fetch() ──────▶ Executor    │
│                       (SERVICE BINDING — sem fallback HTTP)     │
│                                                                 │
│  /__internal__/build ─────────── env.DEPLOY_WORKER.fetch() ─▶ Deploy Worker │
│                       (SERVICE BINDING — sem fallback HTTP)     │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐    ┌────────────────────────────┐
│ enavia-executor     │    │ deploy-worker              │
│                     │    │ (EXTERNO — sem código aqui)│
│ CF API (HTTP real)  │    │                            │
│ → read worker code  │    │ Responsável pelo deploy    │
│ → list scripts      │    │ real no Cloudflare         │
│                     │    │                            │
│ OpenAI API (HTTP)   │    │ Chamado por:               │
│ → gerar patches LLM │    │ - Executor via HTTP        │
│                     │    │   (DEPLOY_WORKER_URL)      │
│ KV: ENAVIA_BRAIN    │    │ - Worker via binding       │
│     ENAVIA_GIT      │    │   (env.DEPLOY_WORKER)      │
│     GIT_KV          │    └────────────────────────────┘
│                     │
│ /worker-deploy ──── HTTP POST ──────────────────────▶ Deploy Worker
│  (DEPLOY_WORKER_URL — NÃO é service binding)
│                     │
│ GitHub: ❌ AUSENTE  │
└─────────────────────┘
```

### Gaps de integração identificados

| Gap | Impacto |
|---|---|
| Executor sem GITHUB_TOKEN | Executor não pode criar branches, commits, PRs — bloqueia PR107 |
| callExecutorBridge sem fallback HTTP | Falha total em dev local sem Miniflare/service binding configurado |
| callDeployBridge sem fallback HTTP | Idem para Deploy Worker em dev local |
| `performDeploy()` é STUB permanente | `auto_deploy=true` nunca funciona no Executor |
| Deploy Worker sem código local | Impossível auditar, testar ou debugar localmente |
| `ENAVIA_EXECUTOR_URL` definido mas nunca usado | Confunde — dá impressão de ser o endpoint real |
| Worker não passa GITHUB_TOKEN ao Executor | Se PR107 quiser usar o token do Worker, precisa encaminhar na request |
| Executor usa HTTP para Deploy Worker, Worker usa binding | Inconsistência: dois caminhos diferentes para o mesmo serviço |

### Duplicações

| Duplicação | Localização |
|---|---|
| `/audit` existe no Worker e no Executor | Worker delega ao Executor; ambos têm a rota |
| `/propose` existe no Worker e no Executor | Mesmo caso |
| `ENAVIA_BRAIN` KV nos dois | Compartilhado — pode haver colisão de chaves |

---

## 5. O que já existe de Cloudflare Bridge (funcional)

### No Executor

| Função | Status | Detalhes |
|---|---|---|
| `fetchCurrentWorkerSnapshot` | ✅ | GET worker code via CF API v4 |
| `listCloudflareWorkerScripts` | ✅ | LIST scripts da conta |
| `resolveScriptName` | ✅ | Resolve nome → script ID no CF |
| `callCodexEngine` | ✅ | OpenAI LLM para gerar patches (16k chars máx) |
| `/worker-patch-safe` (staging) | ✅ | Salva candidato no KV |
| `/worker-deploy` → Deploy Worker | ✅ | Delega deploy via HTTP |

### No Worker (nv-enavia.js)

| Componente | Status | Detalhes |
|---|---|---|
| `executeGithubBridgeRequest` | ✅ | GitHub Bridge completo: create_branch, create_commit, open_pr |
| `evaluateSafetyGuard` | ✅ | Guard de segurança antes de cada operação |
| Event Log (KV) | ✅ | Registra tentativas e resultados |
| ALWAYS_BLOCKED (`merge`, `deploy_prod`, `secret_change`) | ✅ | Nunca executados |
| PROTECTED_BRANCHES (`main`, `master`) | ✅ | Commits diretos bloqueados |
| `merge_allowed=false` invariant | ✅ | `open_pr` sempre retorna `merge_allowed=false` |

---

## 6. Gaps para Ecossistema Completo

### Gap crítico 1 — Executor sem GitHub Bridge
- Executor consegue gerar patches via LLM e ler código do CF.
- Executor NÃO consegue criar branches, commits ou PRs.
- Para fechar o ciclo `auditar → propor patch → criar branch → commitar → abrir PR`, o Executor precisaria ou:
  (a) receber GITHUB_TOKEN do Worker na request, ou
  (b) ter seu próprio GITHUB_TOKEN (secret no executor/wrangler.toml), ou
  (c) chamar o Worker via sua URL pública para executar `/github-bridge/execute` — mas Worker não tem URL pública do Executor para receber callback.

### Gap crítico 2 — Deploy real é opaco
- Deploy Worker é EXTERNO. Não há código, não há testes locais possíveis.
- Se o Deploy Worker falhar ou mudar sua API, o Executor falha silenciosamente.
- `performDeploy()` no Executor é STUB permanente por design — correto, mas significa que qualquer falha no caminho HTTP para Deploy Worker quebra o ciclo.

### Gap crítico 3 — Codex Engine com janela limitada
- `callCodexEngine` passa no máximo **16.000 caracteres** do código do Worker.
- `nv-enavia.js` tem **~9.785 linhas**. Cabe menos de 5% do código real.
- Patches gerados pelo LLM são baseados em um fragmento — não no código completo.
- Não há validação de sintaxe antes de commitar (identificado no PR107 diag).

### Gap crítico 4 — Sem ciclo de feedback pós-deploy
- Após deploy via Deploy Worker, nenhum sistema confirma que o novo código está funcionando.
- Não há smoke test automatizado pós-deploy no loop atual.
- Rollback também passa pelo Deploy Worker — sem código local para auditar.

### Gap crítico 5 — Dev local impossível sem mocks
- Worker usa service bindings `env.EXECUTOR` e `env.DEPLOY_WORKER` sem fallback.
- Sem Miniflare configurado com os bindings corretos, qualquer rota que usa callExecutorBridge ou callDeployBridge falha.
- Executor usa HTTP para Deploy Worker — mais fácil de simular localmente.

### Resumo de credenciais por sistema

| Credencial | Worker | Executor | Deploy Worker |
|---|---|---|---|
| GITHUB_TOKEN | ✅ (secret) | ❌ ausente | ❌ desconhecido |
| CF_ACCOUNT_ID | ❌ não precisa | ✅ (var template) | ❌ desconhecido |
| CF_API_TOKEN | ❌ não precisa | ✅ (secret) | ❌ desconhecido |
| OPENAI_API_KEY | ❌ não precisa | ✅ (secret) | ❌ desconhecido |
| ENAVIA_BRAIN (KV) | ✅ | ✅ | ❌ desconhecido |
| ENAVIA_GIT (KV) | ❌ não tem | ✅ | ❌ desconhecido |
| GIT_KV (KV) | ❌ não tem | ✅ | ❌ desconhecido |
| DEPLOY_WORKER_URL | ❌ usa binding | ✅ (var HTTP) | — |

---

## Conclusão

**O que funciona hoje, end-to-end:**
1. **GitHub Bridge** (Worker solo): create_branch → create_commit → open_pr, com Safety Guard + Event Log. PR106 provou com 24/24 ✅.
2. **Audit/Propose** (Worker→Executor→CF API + OpenAI): Lê código real do CF e gera patch via LLM. Funcionam se credenciais presentes.
3. **Staging de patch** (Executor): `/worker-patch-safe` salva candidato no KV.
4. **Deploy** (Executor→Deploy Worker): funciona se `DEPLOY_WORKER_URL` configurado e Deploy Worker online.

**O que NÃO fecha o ciclo ainda:**
- Self-patch completo (PR107): Executor gera o patch mas não consegue commitar no GitHub.
- Ciclo completo: `auditar → patch → branch → commit → PR → review → deploy` — os dois lados (LLM+CF e GitHub) estão em sistemas diferentes sem ponte direta.
- Deploy Worker é uma caixa preta no repo — impossível auditar ou garantir comportamento sem código local.
