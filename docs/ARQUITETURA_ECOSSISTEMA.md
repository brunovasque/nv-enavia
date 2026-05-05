# ARQUITETURA_ECOSSISTEMA.md
**Versão:** PR107 — 2026-05-05  
**Status:** CANÔNICO — atualizar a cada mudança de arquitetura  

---

## Diagrama de Comunicação

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     nv-enavia (Worker principal)                         │
│                     workers.dev: nv-enavia.brunovasque.workers.dev       │
│                                                                          │
│  ENAVIA_BRAIN (KV) ←── leitura/escrita direta                           │
│  enavia-github-adapter.js ←── import local (CJS)                        │
│  GITHUB_TOKEN ←── secret (nunca logado, nunca no response)               │
│                                                                          │
│  Rotas autônomas (Worker faz sozinho):                                   │
│   /github-bridge/execute ────────────────────────────────▶ GitHub API    │
│   /github-pr/* /memory/* /contracts/* /chat/run                         │
│   /skills/* /planner/run /director/cognitive /execution/*                │
│                                                                          │
│  Rotas que dependem do Executor:                                         │
│   /audit /propose /engineer ──── env.EXECUTOR [PRIMARY]  ──▶ Executor   │
│                                   ENAVIA_EXECUTOR_URL_FALLBACK [FALLBACK]│
│                                   (INTERNAL_TOKEN obrigatório)           │
│                                                                          │
│  Rotas que dependem do Deploy Worker:                                    │
│   /__internal__/build ────────── env.DEPLOY_WORKER [PRIMARY] ▶ DeployWk │
│                                   ENAVIA_DEPLOY_WORKER_URL [FALLBACK]    │
│                                   (INTERNAL_TOKEN obrigatório)           │
└──────────────────────────────────────────────────────────────────────────┘
         │ service binding [PRIMARY]         │ service binding [PRIMARY]
         │ ENAVIA_EXECUTOR_URL_FALLBACK [FB] │ ENAVIA_DEPLOY_WORKER_URL [FB]
         ▼                                   ▼
┌─────────────────────────┐      ┌────────────────────────────────────────┐
│  enavia-executor        │      │  deploy-worker                         │
│  (Executor)             │      │  deploy-worker.brunovasque.workers.dev │
│                         │      │  Código em: deploy-worker/src/index.js │
│  Bindings:              │      │                                        │
│  • ENAVIA_BRAIN (KV)    │      │  Responsável pelo deploy real no CF    │
│  • ENAVIA_GIT (KV)      │      │                                        │
│  • GIT_KV (KV)          │      │  Chamado por:                          │
│  • ENAVIA_WORKER [svc]  │      │  • Executor (service binding PRIMARY)  │
│  • DEPLOY_WORKER [svc]  │      │  • Executor (HTTP DEPLOY_WORKER_URL FB)│
│                         │      │  • Worker (service binding PRIMARY)    │
│  Capacidades reais:     │      │  • Worker (HTTP ENAVIA_DEPLOY_WORKER_URL│
│  • Lê Worker via CF API │      │            FB — requer INTERNAL_TOKEN) │
│  • Gera patches via LLM │      └────────────────────────────────────────┘
│  • Salva versões no KV  │
│  • /github-bridge/proxy │──── env.ENAVIA_WORKER ─────────▶ Worker
│    (repassa op GitHub   │     (service binding — sem guardar token)
│     ao Worker que tem   │
│     o GITHUB_TOKEN)     │──── env.DEPLOY_WORKER ──────────▶ Deploy Worker
│                         │     ou DEPLOY_WORKER_URL (HTTP fallback)
│  Stubs (nunca executa): │
│  • performDeploy()      │
└─────────────────────────┘
```

---

## Tabela de Comunicação Inter-Worker

| De | Para | Canal primário | Canal fallback | Auth fallback |
|---|---|---|---|---|
| Worker | Executor | `env.EXECUTOR` (service binding) | `ENAVIA_EXECUTOR_URL_FALLBACK` (HTTP) | `X-Internal-Token: INTERNAL_TOKEN` |
| Worker | Deploy Worker | `env.DEPLOY_WORKER` (service binding) | `ENAVIA_DEPLOY_WORKER_URL` (HTTP) | `X-Internal-Token: INTERNAL_TOKEN` |
| Executor | Deploy Worker | `env.DEPLOY_WORKER` (service binding) | `DEPLOY_WORKER_URL` (HTTP) | `X-Internal-Token: INTERNAL_TOKEN` |
| Executor | Worker | `env.ENAVIA_WORKER` (service binding) | — (sem fallback HTTP) | — |
| Worker | GitHub API | `fetch` global + `env.GITHUB_TOKEN` | — | Bearer GITHUB_TOKEN |
| Executor | CF API | `fetch` global + `env.CF_API_TOKEN` | — | Bearer CF_API_TOKEN |
| Executor | OpenAI API | `fetch` global + `env.OPENAI_API_KEY` | — | Bearer OPENAI_API_KEY |

---

## Tabela de Credenciais por Sistema

| Credencial | Worker | Executor | Deploy Worker |
|---|---|---|---|
| `GITHUB_TOKEN` | ✅ secret | ❌ nunca | ❌ não precisa |
| `CF_ACCOUNT_ID` | ❌ | ✅ var | ❓ desconhecido |
| `CF_API_TOKEN` | ❌ | ✅ secret | ❓ desconhecido |
| `OPENAI_API_KEY` | ❌ | ✅ secret | ❌ |
| `INTERNAL_TOKEN` | ✅ secret | ✅ secret | ✅ secret |
| `ENAVIA_BRAIN` KV | ✅ | ✅ | ❌ |
| `ENAVIA_GIT` KV | ❌ | ✅ | ❌ |
| `GIT_KV` KV | ❌ | ✅ | ❌ |

---

## Tabela de Responsabilidades

| Responsabilidade | Worker | Executor | Deploy Worker |
|---|---|---|---|
| GitHub Bridge (branch/commit/PR) | ✅ SOBERANO | ❌ | ❌ |
| Safety Guard + Event Log | ✅ | ❌ | ❌ |
| Memória (ENAVIA_BRAIN) | ✅ lê/escreve | ✅ lê/escreve | ❌ |
| Contratos / Skills / Chat | ✅ SOBERANO | ❌ | ❌ |
| Leitura de código via CF API | ❌ | ✅ SOBERANO | ❌ |
| Geração de patches via LLM | ❌ | ✅ SOBERANO | ❌ |
| Versionamento de patches (KV) | ❌ | ✅ SOBERANO | ❌ |
| Deploy real no Cloudflare | ❌ | ❌ (STUB) | ✅ SOBERANO |

---

## Variáveis de Ambiente por Sistema

### Worker (`wrangler.toml`)

| Var/Secret | Tipo | Valor | Descrição |
|---|---|---|---|
| `ENAVIA_EXECUTOR_URL_FALLBACK` | var | `https://enavia-executor.brunovasque.workers.dev` | URL HTTP do Executor — usado apenas quando service binding EXECUTOR ausente |
| `ENAVIA_DEPLOY_WORKER_URL` | var | `https://deploy-worker.brunovasque.workers.dev` | URL HTTP do Deploy Worker — fallback quando binding DEPLOY_WORKER ausente |
| `GITHUB_TOKEN` | secret | (CF secret) | Token GitHub — nunca logado |
| `INTERNAL_TOKEN` | secret | (CF secret) | Token para chamadas inter-worker HTTP |
| `ENAVIA_BRAIN` | KV binding | ID real | Memória compartilhada |
| `EXECUTOR` | service binding | `enavia-executor` | Canal primário Worker→Executor |
| `DEPLOY_WORKER` | service binding | `deploy-worker` | Canal primário Worker→Deploy Worker |

### Executor (`executor/wrangler.toml`)

| Var/Secret | Tipo | Valor | Descrição |
|---|---|---|---|
| `DEPLOY_WORKER_URL` | var | `https://deploy-worker.brunovasque.workers.dev` | Fallback HTTP para Deploy Worker |
| `CF_ACCOUNT_ID` | var | (substituir) | Conta Cloudflare para CF API |
| `CF_API_TOKEN` | secret | (CF secret) | Token CF API para leitura de scripts |
| `OPENAI_API_KEY` | secret | (CF secret) | Token OpenAI para geração de patches |
| `INTERNAL_TOKEN` | secret | (CF secret) | Token inter-worker |
| `ENAVIA_WORKER` | service binding | `nv-enavia` | Canal Executor→Worker (para proxy GitHub Bridge) |
| `DEPLOY_WORKER` | service binding | `deploy-worker` | Canal Executor→Deploy Worker (primário) |
| `ENAVIA_BRAIN` | KV binding | (ID real) | Memória compartilhada |
| `ENAVIA_GIT` | KV binding | (ID real) | Versionamento Git-like |
| `GIT_KV` | KV binding | (ID real) | KV Git auxiliar |

### Deploy Worker (`deploy-worker/wrangler.toml`)

| Var/Secret | Tipo | Valor | Descrição |
|---|---|---|---|
| `CF_ACCOUNT_ID` | secret/var | — | Conta CF para deploy |
| `CF_API_TOKEN` | secret | — | Token CF para deploy real |
| `INTERNAL_TOKEN` | secret | — | Validar chamadas recebidas |

---

## Guia de Configuração para Dev Local

### 1. Worker (`nv-enavia`)

```bash
# Configurar secrets locais
wrangler secret put GITHUB_TOKEN
wrangler secret put INTERNAL_TOKEN

# Para testar sem service bindings (usa fallback HTTP):
# ENAVIA_EXECUTOR_URL_FALLBACK já está em wrangler.toml
# ENAVIA_DEPLOY_WORKER_URL já está em wrangler.toml

# Para testar com service bindings (requer Miniflare + workers em dev):
wrangler dev --local
```

### 2. Executor (`enavia-executor`)

```bash
cd executor
# Editar wrangler.toml: substituir REPLACE_WITH_REAL_ID nos KV namespaces
# Configurar secrets:
wrangler secret put CF_API_TOKEN
wrangler secret put OPENAI_API_KEY
wrangler secret put INTERNAL_TOKEN

wrangler dev
```

### 3. Deploy Worker

```bash
cd deploy-worker
wrangler secret put CF_API_TOKEN
wrangler secret put INTERNAL_TOKEN
wrangler dev
```

---

## Invariantes de Segurança

| Invariante | Garantido por |
|---|---|
| `merge_allowed = false` sempre | `_executeOpenPr` no adapter (PR106) |
| `merge`, `deploy_prod`, `secret_change` bloqueados | ALWAYS_BLOCKED no adapter (PR105) |
| `main`, `master` protegidos de commits diretos | PROTECTED_BRANCHES no adapter (PR106) |
| GITHUB_TOKEN nunca logado, nunca no response | Safety Guard + Event Log (PR99/PR100) |
| Fallback HTTP nunca bypassa Safety Guard | Safety Guard roda no Worker antes do fetch real |
| INTERNAL_TOKEN obrigatório em chamadas HTTP inter-worker | callExecutorBridge + callDeployWorkerJson + callDeployBridge |
| Executor nunca guarda GITHUB_TOKEN | Proxy `/github-bridge/proxy` apenas repassa — sem armazenar |
| performDeploy() no Executor é STUB permanente | Deploy real é soberania do Deploy Worker |

---

## Fluxo: Ciclo de Self-Patch (PR108 — futuro)

```
1. Trigger  → Worker /propose
2. Worker   → callExecutorBridge("/propose")  → Executor
3. Executor → fetchCurrentWorkerSnapshot (CF API) → lê código real
4. Executor → callCodexEngine (OpenAI) → gera patch JSON
5. Executor → /worker-patch-safe → salva candidato no KV
6. Executor → /github-bridge/proxy → Worker /github-bridge/execute
7. Worker   → createBranch + createCommit (GitHub API, GITHUB_TOKEN)
8. Worker   → openPr (merge_allowed=false SEMPRE)
9. Human gate: aprovação humana antes de merge
```

Este ciclo fecha graças à PR107:
- Step 2: fallback HTTP garante alcance mesmo sem binding em dev
- Step 6: `ENAVIA_WORKER` binding permite Executor→Worker sem GITHUB_TOKEN no Executor
- Step 7-8: Safety Guard ativo em toda execução GitHub
