# ENAVIA — Operational Contract

> Documento canônico de operação do worker ENAVIA.
> Gerado a partir de leitura direta do código (`nv-enavia.js` + `wrangler.toml`).
> Última atualização: 2026-04-10

---

## 1. Purpose

A ENAVIA é um Worker Cloudflare que atua como **cérebro operacional** do ecossistema NV.
Suas responsabilidades são:
- Servir como chat inteligente (NV-FIRST)
- Rotear pedidos de engenharia para o Executor via Service Binding
- Auditar patches de código de forma read-only antes de deploy
- Operar o Browser Executor (DigitalOcean) via HTTP
- Proxy CSP-safe do Director Cognitive
- Gerenciar memória e módulos de conhecimento (brain)

---

## 2. Environments

| Recurso | PROD | TEST |
|---------|------|------|
| Worker name | `nv-enavia` | `enavia-worker-teste` |
| `SUPABASE_BUCKET` | `enavia-brain` | `enavia-brain-test` |
| `ENAVIA_BRAIN` KV | `722835b...` (prod) | `235fd25...` (preview) |
| `EXECUTOR` binding | `enavia-executor` | `enavia-executor-test` |
| `DEPLOY_WORKER` binding | `deploy-worker` | `deploy-worker-test` |
| `BROWSER_EXECUTOR_URL` | `https://run.nv-imoveis.com/browser/run` | `""` (vazio — sem browser em TEST) |
| `DIRECTOR_COGNITIVE_URL` | `nv-director-cognitive.brunovasque.workers.dev` | **mesmo de PROD** (sem isolamento) |
| Deploy trigger | `workflow_dispatch` manual | `workflow_dispatch` manual |

**Nota de isolamento:** TEST e PROD compartilham o mesmo `DIRECTOR_COGNITIVE_URL`. Chamadas cognitivas em TEST chegam ao director de produção.

---

## 3. Main Routes

### 3.1 Operational Routes (uso pelo operador/painel)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check — lista rotas disponíveis (texto) |
| `POST` | `/` | Chat NV-FIRST — conversa com a ENAVIA |
| `POST` | `/engineer` | Relay para Executor Core via Service Binding |
| `GET` | `/engineer` | Smoke test — confirma rota ativa |
| `POST` | `/audit` | Auditoria read-only de patch (contrato v4) |
| `GET` | `/audit` | Schema/contrato da rota POST /audit |
| `POST` | `/propose` | Sugestões read-only (sem carimbo) |
| `POST` | `/browser/run` | Executa plano de browser no Executor físico (DO) |
| `POST` | `/browser-test` | Smoke test do Browser Executor |
| `POST` | `/enavia/observe` | Observer read-only (telemetria) |
| `POST` | `/director/cognitive` | Proxy CSP-safe para Director Cognitive |
| `POST` | `/vercel/patch` | Relay para Vercel Executor |

### 3.2 Brain/Debug Routes (diagnóstico e memória)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/debug-brain` | Estado interno (index, system prompt, cache) |
| `GET` | `/brain/read` | System prompt + index |
| `GET` | `/brain/index` | Index completo do cérebro |
| `POST` | `/reload` | Limpa caches e recarrega nv_index.json |
| `POST` | `/debug-load` | Carrega módulos manualmente via fila |
| `POST` | `/brain-query` | Busca semântica no index (até 3 módulos) |
| `POST` | `/brain/get-module` | Leitura de módulo individual |
| `POST` | `/brain/director-query` | Cérebro do Director (auth: Bearer + role) |

### 3.3 Internal Routes (auth: Bearer INTERNAL_TOKEN)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/__internal__/build` | Prova de deploy (env, build marker) |
| `GET` | `/__internal__/describe` | Handshake interno |
| `GET` | `/__internal__/routes` | Descoberta de rotas |
| `GET` | `/__internal__/capabilities` | Capabilities do worker |
| `POST` | `/__internal__/deploy-apply` | Recebe handshake (modo passivo) |
| `POST` | `/__internal__/deploy-rollback` | Recebe rollback (modo passivo) |

---

## 4. When to Use Each Route

### `/audit` — Quando usar
- Antes de aplicar qualquer patch em um worker
- Sempre com `mode: "enavia_audit"`, `constraints: { read_only: true, no_auto_apply: true }`
- Requer `execution_id`, `source`, `target`, `patch`
- Resultado: veredito `approve` ou `reject` com risk level

### `/audit` — Quando NÃO usar
- Para executar/aplicar patches (audit é read-only)
- Sem `execution_id` — será rejeitado
- Sem `patch.content` — será rejeitado

### `/engineer` — Quando usar
- Para enviar ações diretas ao Executor: `{ action: "status" }`, `{ action: "describe" }` etc.
- Para enviar patches ao Executor: `{ patch: "código..." }`
- Para proxy 1:1 de qualquer payload ao Executor

### `/engineer` — Quando NÃO usar
- Para operações que precisam de auditoria formal (use `/audit`)
- Sem o Executor configurado (retorna 500)

### `/browser/run` — Quando usar
- Para executar um plano de navegação via Browser Executor (DigitalOcean)
- Payload: `{ plan: { version: "plan.v1", steps: [...] } }`
- Cada step: `{ type: "open", url: "..." }`, `{ type: "wait", ms: 5000 }`, etc.

### `/browser/run` — Quando NÃO usar
- Em TEST (BROWSER_EXECUTOR_URL é vazio — retorna 500)
- Sem `plan.steps` no payload (retorna 400)
- Se o Browser Executor físico (DO) estiver offline

### Rotas internas (`/__internal__/*`)
- Requerem header `Authorization: Bearer <INTERNAL_TOKEN>`
- Sem token válido → 401
- `deploy-apply` e `deploy-rollback` estão em **modo passivo** (recebem, não executam)

### Rotas de diagnóstico (`/debug-brain`, `/brain/*`, `/reload`)
- Sem auth (abertas)
- Não modificam dados persistentes (exceto `/reload` que limpa cache em memória)

---

## 5. Expected Inputs and Outputs

### POST `/audit`

**Input:**
```json
{
  "execution_id": "ex_001",
  "mode": "enavia_audit",
  "source": "operator",
  "target": { "system": "cloudflare_worker", "workerId": "enavia-worker-teste" },
  "patch": { "type": "patch_text", "content": "// código do patch" },
  "constraints": { "read_only": true, "no_auto_apply": true }
}
```

**Success (200):**
```json
{
  "ok": true,
  "execution_id": "ex_001",
  "audit": {
    "verdict": "approve",
    "risk_level": "low",
    "findings": [...],
    "impacted_areas": [...],
    "details": { "executor_bridge": { "used": true, "ok": true }, ... }
  },
  "next_actions": ["human_approve", "send_to_deploy_worker"]
}
```

**Failure — Executor down (502):**
```json
{ "ok": false, "error": "AUDIT_EXECUTOR_FAILED", "execution_id": "ex_001" }
```

**Failure — No context proof (422):**
```json
{ "ok": false, "error": "AUDIT_NO_CONTEXT_PROOF", "execution_id": "ex_001" }
```

**Failure — Schema invalid (400):**
```json
{ "ok": false, "error": "SCHEMA_VALIDATION_FAILED", "details": ["execution_id obrigatório (string)."] }
```

---

### POST `/engineer`

**Input — ação direta:**
```json
{ "action": "status" }
```

**Input — patch:**
```json
{ "patch": "// código do patch" }
```

**Input — proxy 1:1:**
```json
{ "qualquer": "payload", "enviado": "direto ao executor" }
```

**Success (200):**
```json
{ "ok": true, "executor": { ... }, "via": "ServiceBinding" }
```

**Failure — Executor down (500):**
```json
{ "ok": false, "error": "Executor retornou erro.", "code": 500, "detail": "..." }
```

**Failure — No binding (500):**
```json
{ "ok": false, "error": "Service Binding EXECUTOR não configurado no NV-FIRST." }
```

---

### POST `/browser/run`

**Input:**
```json
{
  "plan": {
    "version": "plan.v1",
    "steps": [
      { "type": "open", "url": "https://example.com" },
      { "type": "wait", "ms": 3000 }
    ]
  }
}
```

**Success (200):**
```json
{
  "ok": true,
  "execution_id": "browser-1712789985000",
  "result": { ... }
}
```

**Failure — No URL (500):**
```json
{ "ok": false, "error": "BROWSER_EXECUTOR_URL não configurado" }
```

**Failure — Invalid plan (400):**
```json
{ "ok": false, "error": "Plano inválido" }
```

**Failure — Loop detected (508):**
```json
{ "ok": false, "error": "Loop detectado: request já veio do próprio worker" }
```

---

## 6. Functional Smoke Tests

### Smoke `/audit` (TEST + PROD)

```bash
# 1. Schema check (sem body)
curl -s https://<WORKER_URL>/audit | jq .ok
# Esperado: true

# 2. Full audit smoke
curl -s -X POST https://<WORKER_URL>/audit \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "smoke-001",
    "mode": "enavia_audit",
    "source": "smoke-test",
    "target": { "system": "enavia", "workerId": "enavia-worker-teste" },
    "patch": { "type": "patch_text", "content": "// smoke test" },
    "constraints": { "read_only": true, "no_auto_apply": true }
  }' | jq '{ok, error, verdict: .audit.verdict}'
# Sucesso: ok=true, verdict="approve" ou "reject"
# Falha aceitável: ok=false, error="AUDIT_EXECUTOR_FAILED" (executor offline)
```

**Critério de sucesso:**
- `GET /audit` → `ok: true` (rota ativa)
- `POST /audit` → `ok: true` com `verdict` presente, OU `AUDIT_EXECUTOR_FAILED` (executor offline, não é bug do worker)

---

### Smoke `/engineer` (TEST + PROD)

```bash
# 1. Route alive check
curl -s https://<WORKER_URL>/engineer | jq .ok
# Esperado: true

# 2. Action smoke
curl -s -X POST https://<WORKER_URL>/engineer \
  -H "Content-Type: application/json" \
  -d '{ "action": "status" }' | jq '{ok}'
# Sucesso: ok=true com resposta do executor
# Falha aceitável: ok=false com "Service Binding EXECUTOR não configurado"
```

**Critério de sucesso:**
- `GET /engineer` → `ok: true`
- `POST /engineer` → `ok: true`, OU erro explícito de binding (não é bug do worker)

---

### Smoke `/browser/run` (PROD only — TEST não tem BROWSER_EXECUTOR_URL)

```bash
curl -s -X POST https://<WORKER_URL>/browser/run \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "version": "plan.v1",
      "steps": [
        { "type": "open", "url": "https://google.com" },
        { "type": "wait", "ms": 2000 }
      ]
    }
  }' | jq '{ok, execution_id}'
# Sucesso: ok=true com execution_id
# Falha aceitável: ok=false com erro do Browser Executor (infra DO)
```

**Em TEST:**
```bash
curl -s -X POST https://<WORKER_URL>/browser/run \
  -H "Content-Type: application/json" \
  -d '{ "plan": { "version": "plan.v1", "steps": [{ "type": "open", "url": "https://google.com" }] } }' | jq .error
# Esperado: "BROWSER_EXECUTOR_URL não configurado" (comportamento correto em TEST)
```

**Critério de sucesso:**
- PROD: `ok: true` ou erro explícito da infra DO
- TEST: `BROWSER_EXECUTOR_URL não configurado` (esperado)

---

### Smoke Health (TEST + PROD)

```bash
# Health check
curl -s https://<WORKER_URL>/ | head -1
# Esperado: "ENAVIA NV-FIRST ativa ✅"

# Build proof (requer INTERNAL_TOKEN)
curl -s -H "Authorization: Bearer <TOKEN>" https://<WORKER_URL>/__internal__/build | jq '{ok, env, worker}'
# Esperado: ok=true, env="TEST" ou "PROD", worker correto
```

---

## 7. Internal/Sensitive Routes

| Route | Auth | Sensitivity | Notes |
|-------|------|-------------|-------|
| `/__internal__/build` | Bearer INTERNAL_TOKEN | Alta | Prova de deploy |
| `/__internal__/describe` | Bearer INTERNAL_TOKEN | Média | Handshake |
| `/__internal__/routes` | Bearer INTERNAL_TOKEN | Média | Descoberta |
| `/__internal__/capabilities` | Bearer INTERNAL_TOKEN | Média | Capabilities |
| `/__internal__/deploy-apply` | Bearer INTERNAL_TOKEN | Alta | Modo passivo |
| `/__internal__/deploy-rollback` | Bearer INTERNAL_TOKEN | Alta | Modo passivo |
| `/brain/director-query` | Bearer INTERNAL_TOKEN + role=director | Alta | Brain do Director |
| `/director/cognitive` | Nenhuma | Média | Proxy CSP-safe (repassa ao Director Cognitive externo) |
| `/brain/read` | Nenhuma | Baixa | Leitura de system prompt |
| `/debug-brain` | Nenhuma | Baixa | Estado interno |

---

## 8. External Dependencies

| Dependency | Used by | URL (PROD) | Required |
|------------|---------|------------|----------|
| **OpenAI API** | `POST /` (chat), Memory V5 | via `OPENAI_API_KEY` secret | Sim (para chat e memória) |
| **Supabase Storage** | `buildBrain()`, boot | `jsqvhmnjsbmtfyyukwsr.supabase.co` | Sim (para carregar nv_index.json) |
| **Browser Executor (DO)** | `/browser/run`, `/browser-test` | `run.nv-imoveis.com/browser/run` | Apenas PROD |
| **Director Cognitive** | `/director/cognitive` | `nv-director-cognitive.brunovasque.workers.dev` | Apenas quando chamado |
| **Vercel Executor** | `/vercel/patch` | `nv-vercel-executor.brunovasque.workers.dev` | Apenas quando chamado |
| **Executor (Service Binding)** | `/engineer`, `/audit`, `/propose` | Binding interno CF | Sim (core) |
| **Deploy Worker (Service Binding)** | `/audit` (carimbo) | Binding interno CF | Sim (para carimbo) |
| **KV ENAVIA_BRAIN** | Boot, brain, memórias | Binding interno CF | Sim |

---

## 9. Known Residual Risks

| # | Risk | Severity | Status | Notes |
|---|------|----------|--------|-------|
| R1 | `ENAVIA_BUILD.deployed_at` hardcoded (`2025-01-21T00:00:00Z`) | 🟡 Low | Open | `/__internal__/build` retorna timestamp fixo. Não bloqueia operação mas compromete prova de deploy. |
| R2 | `DIRECTOR_COGNITIVE_URL` compartilhado TEST/PROD | 🟡 Medium | Open | Chamadas TEST chegam ao director de PROD. Isolamento requer endpoint dedicado. |
| R3 | `BROWSER_EXECUTOR_URL` vazio em TEST | 🟢 Info | By design | `/browser/run` retorna erro claro em TEST. Não é bug. |
| R4 | CORS `*` em todas as respostas | 🟢 Low | Open | Permissivo mas endpoints sensíveis têm Bearer auth. |
| R5 | `consolidateAfterSave` definida mas nunca chamada | 🟢 Low | Open | Memory V3 clustering inativa. Sem impacto operacional. |
| R6 | `/propose` usa URL `https://executor.invalid/audit` | 🟢 Low | Open | Service Binding ignora host, mas URL é confusa. |
| R7 | `deploy-apply` e `deploy-rollback` em modo passivo | 🟡 Info | By design | Recebem mas não executam. Deploy real é via `wrangler deploy`. |

> **Itens resolvidos desde o diagnóstico anterior (não mais riscos abertos):**
> - `ENAVIA_GIT` KV binding — **removido** do `wrangler.toml`. Binding eliminado, sem referência no código.
> - Double-load de `brain:index` — **corrigido**: `_brainIndexRaw` é lido uma única vez no PASSO 1 e reutilizado em Memory Integration V1 (sem segundo KV read).

---

## 10. Operator Runbook (short)

### Deploy flow

```
1. Merge PR → main
2. GitHub Actions → Run workflow (workflow_dispatch)
   - target_env: test → wrangler deploy --env test → enavia-worker-teste
   - target_env: prod → wrangler deploy → nv-enavia
3. Smoke test (ver seção 6)
4. Confirmar via /__internal__/build (com Bearer token)
```

### Post-deploy checklist

- [ ] `GET /` retorna "ENAVIA NV-FIRST ativa ✅"
- [ ] `GET /audit` retorna `ok: true`
- [ ] `GET /engineer` retorna `ok: true`
- [ ] `GET /__internal__/build` (com token) retorna env correto (TEST ou PROD)

### Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|---------------|------|
| `/engineer` retorna 500 "EXECUTOR não configurado" | Service Binding ausente | Verificar `wrangler.toml` e deploy do executor |
| `/audit` retorna 502 `AUDIT_EXECUTOR_FAILED` | Executor offline ou não responde | Verificar executor no CF Dashboard |
| `/audit` retorna 422 `AUDIT_NO_CONTEXT_PROOF` | Nem snapshot enviado, nem executor provou leitura | Enviar `context.source_snapshot` ou verificar executor |
| `/browser/run` retorna 500 "URL não configurado" | `BROWSER_EXECUTOR_URL` vazio (esperado em TEST) | Em PROD: verificar var. Em TEST: comportamento correto |
| `/__internal__/*` retorna 401 | `INTERNAL_TOKEN` não configurado como secret | Configurar no CF Dashboard |
| Boot lento / 500 no primeiro request | Supabase Storage indisponível ou bucket inexistente | Verificar bucket e `nv_index.json` |

### Secrets required

| Secret | Where | Purpose |
|--------|-------|---------|
| `OPENAI_API_KEY` | CF Dashboard (PROD + TEST) | Chat, Memory V5 |
| `INTERNAL_TOKEN` | CF Dashboard (PROD + TEST) | Auth `/__internal__/*` e `/brain/director-query` |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions | Deploy via wrangler |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions | Deploy via wrangler |

---

## System Limits

- Worker máx. arquivo único: ~4.600 linhas (monolítico)
- Módulos carregados sob demanda: máx. 3 simultâneos (fila)
- Memory scoring: stopwords PT-BR hardcoded
- Memory V4: auto-curadoria remove score ≤ 0
- CORS: `Access-Control-Allow-Origin: *` global
- Auth: Bearer token only (sem IP allowlist, sem mTLS)
- `deploy-apply`/`deploy-rollback`: modo passivo (não executam)
