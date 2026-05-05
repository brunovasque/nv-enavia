# PR107 — REVIEW CANÔNICO
**Branch:** `copilot/pr107-integracao-ecossistema`  
**PR GitHub:** [#274](https://github.com/brunovasque/nv-enavia/pull/274)  
**Contrato:** `docs/CONTRATO_ENAVIA_ECOSSISTEMA_PR107.md`  
**Data do review:** 2026-05-05  
**Revisor:** Claude Code (leitura de código real)

---

## 1. ARQUIVOS ALTERADOS

| Arquivo | Status | O que faz |
|---|---|---|
| `deploy-worker/src/index.js` | Novo (1929 linhas) | Cópia fiel do repo `brunovasque/deploy-worker` sha `48916b6`. SHA verificado: `cf26108df3214a37f368eda8583462ab7cd08b23` ≡ original. Código intacto. |
| `deploy-worker/wrangler.toml` | Novo | Configuração do Deploy Worker (name, main, compatibility_date, observability). |
| `deploy-worker/README.md` | Novo | Responsabilidades, endpoints expostos, credenciais, como é chamado, instrução wrangler. **Ver ACHADO F2 — desatualizado após Commit 4.** |
| `nv-enavia.js` | Modificado | `callExecutorBridge`: fallback HTTP via `ENAVIA_EXECUTOR_URL_FALLBACK` + INTERNAL_TOKEN. `callDeployWorkerJson`: fallback HTTP via `ENAVIA_DEPLOY_WORKER_URL` + INTERNAL_TOKEN. `callDeployBridge`: check combinado binding+fallback antes de bloquear. Rename `ENAVIA_EXECUTOR_URL` → `ENAVIA_EXECUTOR_URL_FALLBACK` em 3 locais. |
| `executor/src/index.js` | Modificado | `POST /github-bridge/proxy` adicionado (linha 3308-3368). `delegateToDeployWorker` refatorado para preferir `env.DEPLOY_WORKER` (binding) sobre HTTP. **Ver BLOQUEADOR B1 e ACHADO F1.** |
| `executor/wrangler.toml` | Modificado | Dois service bindings adicionados: `ENAVIA_WORKER → nv-enavia` e `DEPLOY_WORKER → deploy-worker`. |
| `wrangler.toml` | Modificado | `ENAVIA_EXECUTOR_URL` → `ENAVIA_EXECUTOR_URL_FALLBACK` (com comentário de intenção). `ENAVIA_DEPLOY_WORKER_URL` adicionado. Aplicado em `[vars]` (prod) e `[env.test.vars]`. |
| `docs/ARQUITETURA_ECOSSISTEMA.md` | Novo | Diagrama textual, tabela de comunicação, tabela de credenciais, tabela de responsabilidades, guia dev local, invariantes, fluxo PR108. |

---

## 2. CRITÉRIOS DO CONTRATO (Seção 5)

| Critério | Status | Evidência |
|---|---|---|
| `deploy-worker/src/index.js` existe (cópia fiel, sem alteração) | ✅ | SHA `cf26108` ≡ original GitHub. `git show 1759b89:deploy-worker/src/index.js \| sha1sum` = `cf26108`. |
| `deploy-worker/wrangler.toml` existe | ✅ | Arquivo em `deploy-worker/wrangler.toml` com conteúdo correto. |
| `deploy-worker/README.md` com credenciais | ✅ (com ressalva F2) | Credenciais: CF_ACCOUNT_ID, CF_API_TOKEN, INTERNAL_TOKEN documentados. |
| `callExecutorBridge` tem fallback HTTP funcional | ✅ | `nv-enavia.js:5573-5607`: verifica `useBinding`, senão usa `fallbackUrl + route` com `X-Internal-Token`. Sem token → blocked. |
| `callDeployBridge` tem fallback HTTP funcional | ✅ | `nv-enavia.js:5830-5839`: check `hasDeployBinding \|\| (hasFallbackUrl && hasFallbackToken)`. `callDeployWorkerJson:5733-5760`: binding ou HTTP com `X-Internal-Token`. |
| `POST /github-bridge/proxy` existe no Executor | ✅ (com ressalva B1) | `executor/src/index.js:3308-3368`: endpoint existe, usa `env.ENAVIA_WORKER.fetch`. |
| `ENAVIA_WORKER` binding em `executor/wrangler.toml` | ✅ | `executor/wrangler.toml:37-39`: `binding = "ENAVIA_WORKER"`, `service = "nv-enavia"`. |
| `DEPLOY_WORKER` binding em `executor/wrangler.toml` | ✅ | `executor/wrangler.toml:43-45`: `binding = "DEPLOY_WORKER"`, `service = "deploy-worker"`. |
| `ENAVIA_EXECUTOR_URL` renomeado/documentado | ✅ | `wrangler.toml:17`: `ENAVIA_EXECUTOR_URL_FALLBACK` com comentário explicativo. `nv-enavia.js:5575` atualizado. |
| `docs/ARQUITETURA_ECOSSISTEMA.md` criado | ✅ | Arquivo existe com diagrama, tabelas de comunicação/credenciais/responsabilidades e guia dev local. |
| Testes PR99–PR106 não quebrados | ✅ | `pr106-github-bridge-prova-real.prova.test.js`: 19/19 ✅. `pr105-cjs-esm-interop.test.js`: 32/32 ✅. Executados após cada commit. |
| PR revisada e aprovada por Bruno | ⬜ | Pendente (critério humano). |

---

## 3. INVARIANTES

| Invariante | Status | Evidência |
|---|---|---|
| Deploy Worker: código não alterado nesta PR | ✅ | SHA verificado: `cf26108` ≡ original. Sem diff no código do deploy-worker. |
| Safety Guard permanece ativo em toda operação GitHub | ✅ | `evaluateSafetyGuard` continua sendo chamado dentro de `executeGithubBridgeRequest` no adapter. O proxy `/github-bridge/proxy` chama `/github-bridge/execute` no Worker, que passa pelo pipeline completo incluindo Safety Guard. |
| GITHUB_TOKEN nunca persistido no Executor | ✅ | O proxy em `executor/src/index.js:3327-3334` apenas repassa o `body` sem inspecionar ou guardar token. O GITHUB_TOKEN fica no Worker via `env.GITHUB_TOKEN`. |
| GITHUB_TOKEN nunca logado em nenhum Event Log | ✅ | O campo não passa pelo Executor. No Worker, a proteção `filterSensitiveFields` (pré-existente do PR99) continua ativa. |
| `merge_allowed = false` sempre | ✅ | Invariante no adapter `schema/enavia-github-adapter.js` — `_executeOpenPr` sempre retorna `merge_allowed: false`. Não alterado por esta PR. |
| `deploy_prod` sem gate humano = bloqueado | ✅ | `callDeployBridge` ainda bloqueia `PROD_ACTIONS` e `target_env production/prod`. Não alterado. |
| Fallback HTTP nunca bypassa Safety Guard | ✅ | O fallback em `callExecutorBridge` e `callDeployWorkerJson` apenas muda o canal (HTTP vs binding). O Safety Guard opera no pipeline interno do Worker, antes de qualquer fetch real. |
| INTERNAL_TOKEN obrigatório em toda comunicação inter-worker HTTP | ⚠️ **PARCIAL** | **OUTGOING ✅:** Implementado em `callExecutorBridge` (L5592-5604) e `callDeployWorkerJson` (L5744-5756) — sem token = blocked. `delegateToDeployWorker` no executor (L313-317) — sem token, não envia header. **INCOMING ❌:** `POST /github-bridge/proxy` (L3308) não valida INTERNAL_TOKEN no request recebido — qualquer caller pode acionar o proxy sem autenticação. Ver ACHADO F1. |

---

## 4. COMMITS ATÔMICOS

**Sequência executada:**

| # | Hash | Mensagem | Escopo real | Correspondência contrato |
|---|------|----------|-------------|--------------------------|
| 1 | `1759b89` | `feat(pr107): trazer deploy-worker para o repo` | `deploy-worker/` | ✅ Exato |
| 2 | `a05b5d9` | `feat(pr107): fallback HTTP em callExecutorBridge e callDeployBridge` | `nv-enavia.js` | ✅ Exato |
| 3 | `89d411d` | `feat(pr107): proxy github-bridge no Executor + ENAVIA_WORKER binding` | `executor/src/index.js` + `executor/wrangler.toml` | ✅ Contrato diz `executor/src/index.js` — wrangler.toml foi incluído (aceitável, coeso) |
| 4 | `87c5e5a` | `feat(pr107): padronizar bindings Executor↔Deploy Worker` | `executor/src/index.js` + `executor/wrangler.toml` | ✅ Contrato diz `executor/wrangler.toml` — src/index.js incluído (delegateToDeployWorker, coeso) |
| 5 | `54c2c65` | `docs(pr107): arquitetura do ecossistema + ENAVIA_EXECUTOR_URL corrigido` | `docs/ARQUITETURA_ECOSSISTEMA.md` + `wrangler.toml` + `nv-enavia.js` | ✅ |
| +1 | `c084713` | `docs(pr107): governança — status, handoff, execution log, INDEX.md` | Governança | ✅ Extra (governança CLAUDE.md-obrigatória) |

**Ordem respeitada?**
- Commits 1 e 2 independentes: ✅ (1→2, ambos poderiam ser paralelos)
- Commit 3 depende do commit 2: ✅ (fallback HTTP do commit 2 já existia quando proxy foi criado)
- Commit 4 depende do commit 3: ✅ (DEPLOY_WORKER binding coexiste com ENAVIA_WORKER do commit 3)
- Commit 5 após commit 1: ✅

**Sequência CORRETA. ✅**

---

## 5. O QUE ESTÁ FALTANDO

### 🔴 BLOQUEADOR B1 — `github_token_available: true` NÃO implementado (Seção 2.3)

**Contrato (Seção 2.3):**
> "Quando Worker chama `callExecutorBridge` para `/propose` ou `/audit`, passar `github_token_available: true` no payload"

**Evidência:**
```bash
grep -n "github_token_available" nv-enavia.js
# Nenhum resultado
```

Confirmado: nenhuma ocorrência de `github_token_available` em nv-enavia.js.

Os payloads reais enviados ao Executor (linhas 6158–6167 para `/audit` e 6186–6197 para `/propose`) não incluem o campo:
```javascript
// _auditPayload (linha 6158):
const _auditPayload = {
  source: "nv-enavia", mode: "contract_execute_next", executor_action: "audit",
  ...buildExecutorTargetPayload(...),
  context: { require_live_read: true },
  contract_id, nextAction, operationalAction,
  execution_id: auditId, evidence, approved_by, audit_id, timestamp,
  // ← github_token_available: true  AUSENTE
};

// _proposePayload (linha 6186):
const _proposePayload = {
  source: "nv-enavia", mode: "contract_execute_next", executor_action: "propose",
  ...buildExecutorTargetPayload(...),
  patch, prompt, intent,
  contract_id, nextAction, operationalAction,
  execution_id: auditId, evidence, approved_by, audit_id, timestamp,
  // ← github_token_available: true  AUSENTE
};
```

**Impacto:** O Executor recebe requisições de `/propose` e `/audit` sem saber que o Worker tem capacidade de executar operações GitHub via o novo proxy. Quando o Executor gerar uma proposta de patch para PR108, não terá o sinal de que pode usar `/github-bridge/proxy`. A metade funcional de Seção 2.3 (o proxy em si) existe, mas a outra metade (o sinal de capability ao Executor) está ausente.

**Fix necessário:** Adicionar `github_token_available: !!env?.GITHUB_TOKEN` (ou `true` conforme o contrato) aos `_auditPayload` e `_proposePayload` em `nv-enavia.js`.

---

### ⚠️ ACHADO F1 — `POST /github-bridge/proxy` sem validação de INTERNAL_TOKEN no incoming request

**Evidência:**
```javascript
// executor/src/index.js:3308
if (METHOD === "POST" && pathname === "/github-bridge/proxy") {
  // Sem isInternalAuthorized(request, env) — endpoint público
  if (typeof env?.ENAVIA_WORKER?.fetch !== "function") { ... }
  // ...
}
```

O invariante diz "INTERNAL_TOKEN obrigatório em toda comunicação inter-worker HTTP". A implementação satisfaz o lado OUTGOING (Worker→Executor e Executor→Deploy Worker com `X-Internal-Token`) mas não valida o token no INCOMING para o novo endpoint.

**Mitigante:** O Safety Guard no Worker ainda protege as operações reais (ALWAYS_BLOCKED, PROTECTED_BRANCHES, merge_allowed=false). O `/github-bridge/execute` no Worker tampouco valida INTERNAL_TOKEN no incoming (comportamento pré-existente, `handleGithubBridgeExecute` não chama `isInternalAuthorized`). O endpoint do proxy segue o mesmo padrão do endpoint que ele chama.

**Classificação:** Não bloqueador para este PR (pré-existente e mitigado pelo Safety Guard). Deve ser endereçado com gate de autenticação em PR futura — qualquer caller HTTP pode acionar operações GitHub via executor.

---

### ⚠️ ACHADO F2 — README do deploy-worker desatualizado após Commit 4

**Evidência:** `deploy-worker/README.md:50` (criado no Commit 1):
```
### Pelo Executor (`enavia-executor`)
HTTP direto via `DEPLOY_WORKER_URL`:
POST https://deploy-worker.brunovasque.workers.dev/worker-deploy
```

Após o Commit 4, o Executor usa `env.DEPLOY_WORKER` (service binding) como primário, com HTTP como fallback. O README documenta apenas o comportamento antigo (HTTP direto).

A `docs/ARQUITETURA_ECOSSISTEMA.md` (Commit 5) documenta corretamente: "Executor → Deploy Worker: service binding (+ fallback HTTP)". Mas o README do deploy-worker contradiz.

**Classificação:** Não bloqueador (ARQUITETURA_ECOSSISTEMA.md é o documento canônico). Inconsistência interna de documentação.

---

### ⚠️ ACHADO F3 — Header `Authorization: Bearer` vs `X-Internal-Token` inconsistente no executor

**Evidência:**
```javascript
// executor/src/index.js (código pré-existente, ~linha 4999):
...(env?.INTERNAL_TOKEN ? { Authorization: `Bearer ${String(env.INTERNAL_TOKEN)}` } : {})

// delegateToDeployWorker (Commit 4, linha 315):
...(env.INTERNAL_TOKEN ? { "X-Internal-Token": String(env.INTERNAL_TOKEN) } : {})
```

O novo `delegateToDeployWorker` usa `X-Internal-Token` (consistente com o Worker). Mas código pré-existente no Executor ainda usa `Authorization: Bearer`. O Worker valida via `isInternalAuthorized` que lê `Authorization: Bearer` — não `X-Internal-Token`.

**Classificação:** Inconsistência pré-existente, não introduzida por esta PR. O `delegateToDeployWorker` novo usa o formato correto para o Deploy Worker. O código antigo (executor→CF API) usa Bearer para outros endpoints.

---

## 6. VEREDITO

```
BLOQUEADO ❌
```

**Motivo:** 1 bloqueador técnico real.

**Bloqueador B1:** `github_token_available: true` NÃO passado nos payloads de `/propose` e `/audit` conforme exigido pela Seção 2.3 do contrato. A metade funcional (proxy endpoint) foi implementada. A metade de sinalização (capability flag ao Executor) está ausente. Sem ela, o Executor não sabe que pode usar o GitHub Bridge proxy quando propõe patches — comprometendo diretamente a utilidade do PR108.

**Fix é cirúrgico e minimal:** adicionar `github_token_available: !!env?.GITHUB_TOKEN` aos dois payloads em `nv-enavia.js` (≈ 2 linhas). Recomendo um commit 6 na mesma branch:
```
fix(pr107): adicionar github_token_available nos payloads de /audit e /propose
```

**Após o fix:** Os 3 achados não-bloqueadores (F1, F2, F3) NÃO impedem o merge — são documentados aqui para rastreabilidade e podem ser endereçados em PRs futuras.

---

## Resumo executivo

| Item | Resultado |
|---|---|
| Deploy Worker internalizado (cópia fiel) | ✅ |
| Fallback HTTP Worker→Executor | ✅ |
| Fallback HTTP Worker→Deploy Worker | ✅ |
| POST /github-bridge/proxy | ✅ (funcional) |
| github_token_available: true nos payloads | ❌ AUSENTE |
| Bindings ENAVIA_WORKER + DEPLOY_WORKER no executor | ✅ |
| ENAVIA_EXECUTOR_URL renomeado | ✅ |
| docs/ARQUITETURA_ECOSSISTEMA.md | ✅ |
| Testes PR99–PR106 | ✅ 19/19 + 32/32 |
| Sequência de commits | ✅ |
| **Veredito** | **BLOQUEADO — 1 fix necessário** |
