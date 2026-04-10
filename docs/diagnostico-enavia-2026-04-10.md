# ENAVIA — Diagnóstico Geral (Worker-only / Governança / Operação)
**Data:** 2026-04-10  
**Autor:** Copilot (READ-ONLY — nenhum código foi alterado)  
**Branch:** `copilot/diagnostico-enavia-worker-only`  
**Escopo:** Worker principal, executor, deploy worker, auth interna, audit/propose/engineer, browser, memória/brain, workflow de deploy, ambientes TEST e PROD.

---

## WORKFLOW_ACK: ok

---

## Summary

A ENAVIA está estruturalmente funcional como Worker Cloudflare. A separação TEST/PROD é real e correta no `wrangler.toml`. As rotas principais (`/`, `/engineer`, `/audit`, `/propose`, `/__internal__/*`) existem e possuem contratos bem definidos. O fluxo de deploy é manual e seguro (sem trigger automático). Os pontos falhos identificados são, em sua maioria, débito técnico e configurações de runtime pendentes — nenhum é bloqueador crítico de operação em TEST.

---

## 1. Estado Atual Real

### Worker principal (`nv-enavia.js`)
- Arquivo único de ~4.555 linhas de JavaScript
- Entry point: `export default { async fetch(request, env, ctx) }` (linha ~2957)
- Roteamento interno por `request.method` + `url.pathname`
- Versão: `ENAVIA_BUILD.id = "ENAVIA_TEST_PATCH_2025-01"` (hardcoded — ver ponto falho)

**Rotas mapeadas e funcionais:**

| Método | Rota | Status |
|--------|------|--------|
| `GET` | `/` | ✅ health check + listagem de rotas |
| `POST` | `/` | ✅ chat NV-FIRST (handleChatRequest) |
| `POST` | `/engineer` | ✅ relay para EXECUTOR via Service Binding |
| `GET` | `/engineer` | ✅ smoke test de conectividade |
| `POST` | `/audit` | ✅ auditoria canônica com bridge executor |
| `GET` | `/audit` | ✅ schema/contrato (smoke test sem body) |
| `POST` | `/propose` | ✅ read-only, não carimba Deploy Worker |
| `POST` | `/reload` | ✅ limpa caches e recarrega nv_index.json |
| `GET` | `/debug-brain` | ✅ status interno (index, system prompt, módulos) |
| `GET` | `/brain/read` | ✅ system prompt + index |
| `GET` | `/brain/index` | ✅ index completo |
| `POST` | `/debug-load` | ✅ carregamento manual de módulos via fila |
| `POST` | `/brain-query` | ✅ busca semântica no index |
| `POST` | `/brain/get-module` | ✅ leitura de módulo individual |
| `POST` | `/brain/director-query` | ⚠️ auth fraca (ver ponto falho) |
| `POST` | `/director/cognitive` | ✅ proxy CSP-safe |
| `POST` | `/vercel/patch` | ✅ relay Vercel executor |
| `POST` | `/enavia/observe` | ✅ observer read-only |
| `GET` | `/__internal__/build` | ✅ prova de deploy (Bearer auth) |
| `GET` | `/__internal__/describe` | ✅ handshake interno (Bearer auth) |
| `GET` | `/__internal__/routes` | ✅ descoberta de rotas (Bearer auth) |
| `GET` | `/__internal__/capabilities` | ✅ capabilities (Bearer auth) |
| `POST` | `/__internal__/deploy-apply` | ✅ passivo (recebe, não executa) |
| `POST` | `/__internal__/deploy-rollback` | ✅ passivo (recebe, não executa) |

### Executor
- Acesso via **Service Binding** `env.EXECUTOR` (zero-latência, sem HTTP externo)
- PROD: `enavia-executor` | TEST: `enavia-executor-test`
- `/engineer` usa `env.EXECUTOR.fetch("https://executor", {...})` diretamente
- Fila de carregamento de módulos: máximo 3 simultâneos implementada

### Deploy Worker
- Binding `env.DEPLOY_WORKER` declarado no `wrangler.toml`
- PROD: `deploy-worker` | TEST: `deploy-worker-test`
- **`/__internal__/deploy-apply`** e **`/__internal__/deploy-rollback`** estão em modo passivo (não executam nada no worker atual — recebem e confirmam)
- Carimbo real de auditoria via DEPLOY_WORKER está referenciado no fluxo do `/audit` mas a execução do carimbo depende do executor retornar contexto válido

### Auth Interna
- Função `isInternalAuthorized(req, env)`: verifica `Authorization: Bearer ${INTERNAL_TOKEN}`
- Protege todos os `/__internal__/*` endpoints
- `INTERNAL_TOKEN` é secret (não exposto no `wrangler.toml`) — correto
- Retorna `401 Unauthorized` em texto simples se não autorizado

### Audit (`POST /audit`)
- Contrato v4 completo: `execution_id`, `mode: "enavia_audit"`, `source`, `target`, `patch`, `constraints`
- Pipeline: validação de schema → `analyzePatchText` (local) → bridge com EXECUTOR → verificação de `context_used` → carimbo no DEPLOY_WORKER
- **Bloqueia automaticamente** se executor falhar (`AUDIT_EXECUTOR_FAILED`) ou sem prova de contexto (`AUDIT_NO_CONTEXT_PROOF`)
- Smoke test: `GET /audit` retorna schema completo com exemplo — testável sem body

### Propose (`POST /propose`)
- Read-only, sem carimbo no Deploy Worker
- Chama executor com `executor_action: "propose"`
- Retorna sugestões + `next_actions` apontando para `/audit`
- `GET /audit` → schema/contrato disponível para smoke test de conectividade

### Engineer (`POST /engineer`)
- Suporta 3 modos: action direta, proxy 1:1, patch normalizado
- `normalizePatchForExecutor()` trata patch embrulhado
- `GET /engineer` confirma rota ativa (smoke test)
- Depende do Service Binding `env.EXECUTOR` estar operacional

### Browser
- `BROWSER_EXECUTOR_URL` configurado em PROD: `https://run.nv-imoveis.com/browser/run`
- Em TEST: **string vazia** (`""`) — sem browser executor em TEST (deliberado)
- Worker tem rota `/vercel/patch` que usa `VERCEL_EXECUTOR_URL`

### Memória / Brain
- Boot carrega: `nv_index.json` (Supabase Storage), `SYSTEM_PROMPT` (KV ENAVIA_BRAIN), memórias de `brain:index`, módulo `M12-AUTOPATCHENGINE-V1`
- Memory V2: scoring de relevância por tokens (stopwords PT-BR incluídas)
- Memory V3: clusterização por tema + consolidação automática
- Memory V4: auto-curadoria (remove memórias com score ≤ 0)
- Memory V5: auto-refinamento via modelo após treinamento (pós-save)
- `buildBrain()` com flag `NV_BRAIN_READY` evita re-inicialização

### Workflow de Deploy (`.github/workflows/deploy.yml`)
- Trigger: **manual apenas** (`workflow_dispatch`) — sem trigger automático
- Inputs: `target_env` (test | prod) + `confirm_reason`
- Validações: sem placeholders em `wrangler.toml`, secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` presentes
- Deploy TEST: `wrangler deploy --env test` → worker `enavia-worker-teste`
- Deploy PROD: `wrangler deploy` (sem `--env`) → worker `nv-enavia`

### Ambientes TEST e PROD

| Recurso | PROD | TEST |
|---------|------|------|
| Worker name | `nv-enavia` | `enavia-worker-teste` |
| SUPABASE_BUCKET | `enavia-brain` | `enavia-brain-test` |
| ENAVIA_BRAIN KV | `722835b730dd44c79f6ff1f0cdc314a9` | `235fd25ad3b44217975f6ce0d77615d0` |
| ENAVIA_GIT KV | `c944c6f694f34056bd1eceaed851bb47` | `77196944095542b3bb7c80121950bcab` |
| EXECUTOR service | `enavia-executor` | `enavia-executor-test` |
| DEPLOY_WORKER service | `deploy-worker` | `deploy-worker-test` |
| BROWSER_EXECUTOR_URL | `https://run.nv-imoveis.com/browser/run` | `""` (vazio) |

---

## 2. Pontos Positivos

1. **Separação TEST/PROD real e correta**: KV namespaces, Supabase buckets e service bindings são completamente separados. Não há risco de contaminação entre ambientes.
2. **Deploy manual seguro**: sem trigger automático. Nenhum push acidental dispara deploy em PROD.
3. **Auth interna funcional**: `/__internal__/*` protegidos por Bearer token via `INTERNAL_TOKEN` secret.
4. **`/__internal__/build` operacional**: detecta ambiente corretamente via `SUPABASE_BUCKET` e retorna JSON estruturado com prova de deploy.
5. **`GET /audit` como smoke test**: testável sem body, retorna schema completo com exemplo — conectividade verificável em <1s.
6. **`GET /engineer` como smoke test**: confirma rota ativa sem precisar de executor real.
7. **Auditoria com bloqueio real**: `/audit` bloqueia explicitamente quando executor falha ou quando não há prova de contexto — governança de segurança ativa.
8. **`/propose` não carimba**: separação limpa entre sugestão (propose) e auditoria (audit).
9. **Service Binding para EXECUTOR**: comunicação interna zero-latência, sem HTTP externo, sem CORS.
10. **Fila de módulos com limite de 3 simultâneos**: evita burst de subrequests.
11. **CORS configurado**: `Access-Control-Allow-Origin: *` com preflight OPTIONS tratado corretamente.
12. **Modo passivo em `deploy-apply`/`deploy-rollback`**: recebe handshakes sem executar nada — safe por padrão.
13. **`ENAVIA_MODE` como var de governança**: lógica de modo supervisioned/read-only presente.
14. **Memory V4 auto-curadoria**: evita acúmulo de memórias de baixa qualidade no KV.

---

## 3. Pontos Falhos

### 🔴 Crítico para operação real

**P1 — `ENAVIA_BUILD.deployed_at` hardcoded**
```js
const ENAVIA_BUILD = {
  id: "ENAVIA_TEST_PATCH_2025-01",
  deployed_at: "2025-01-21T00:00:00Z",  // HARDCODED
  source: "deploy-worker",
};
```
`/__internal__/build` retorna `deployed_at` fixo independente de quando o worker foi realmente deployado. A "prova de deploy" está corrompida. Para que o timestamp seja real, precisaria ser injetado em build-time pelo `deploy-worker` (que hoje é passivo) ou via variável de ambiente.

**P2 — `/brain/director-query` sem auth real**
```js
if (body.role !== "director") {
  return 403;
}
```
Qualquer cliente que envie `{ "role": "director" }` tem acesso ao brain do Director. Sem token, sem IP allowlist, sem INTERNAL_TOKEN. Risco de vazamento do brain estratégico.

### 🟡 Risco técnico / operacional

**P3 — `ENAVIA_GIT` KV binding declarado mas nunca usado**  
Declarado em `wrangler.toml` (PROD e TEST) mas sem nenhuma referência em `nv-enavia.js`. Consumindo um slot de binding e gerando confusão. Pode ser legacy de versão anterior.

**P4 — `/propose` chama `env.EXECUTOR.fetch("https://executor.invalid/audit")`**  
URL de placeholder `https://executor.invalid/audit`. Service Binding ignora o host real e roteia internamente, mas a URL é confusa e pode quebrar se o executor não tratar a rota `/audit` para chamadas de propose.

**P5 — Memory double-load de `brain:index`**  
`buildBrain()` lê `brain:index` do KV em dois momentos distintos (PASSO 1: Boot Memory Loader + "Memory Integration V1"). Dois KV reads para o mesmo dado a cada boot — desperdício que aumenta latência e custo.

**P6 — `consolidateAfterSave` definida mas nunca chamada**  
Função `consolidateAfterSave(env, savedKey)` está definida dentro do bloco do handler de brain, mas nunca é invocada. A consolidação de Memory V3 não está sendo acionada após saves.

**P7 — `analyzeWorkerSnapshot` usa match de string literal**  
```js
const hasFetchExport = workerText.includes("export default {") && 
                       workerText.includes("async fetch(");
```
Se o snapshot tiver whitespace diferente ou usar outra sintaxe válida de export, a detecção falha silenciosamente — reporta como "padrão não detectado" mas continua rodando.

### 🟢 Débito técnico (não bloqueio)

**P8 — Worker monolítico de 4.555 linhas**  
Todo o código em um único arquivo. Sem módulos ES (`import`/`export`) entre arquivos. Dificulta revisão e manutenção, mas não bloqueia operação.

**P9 — Memory Classifier (`NV_MEMORY`) re-executado a cada `buildBrain()`**  
`buildBrain()` tem `NV_BRAIN_READY` guard, mas o classificador de memória (`NV_MEMORY`) é definido dentro do `buildBrain()` e re-executado em cada instância nova de Worker (cold start). Comportamento esperado em Workers, mas cria estado local não compartilhado entre instâncias.

**P10 — `BROWSER_EXECUTOR_URL` vazio em TEST**  
Proposital, mas sem fallback ou log claro de "browser não disponível em TEST". Se o fluxo de chat tentar usar browser em TEST, falha silenciosamente.

**P11 — `ENAVIA_BUILD.id` ainda referencia "TEST_PATCH_2025-01"**  
Nome residual que pode gerar confusão ao verificar prova de deploy em PROD.

**P12 — CORS `*` em todas as respostas**  
Adequado para uso via painel interno, mas potencialmente permissivo para endpoints sensíveis como `/audit` e `/__internal__/*`. Os `/__internal__/*` já têm Bearer auth, então o risco é baixo — mas é débito de postura de segurança.

---

## 4. Fluxo de Deploy Correto TEST → PROD

```
Branch feature → PR → merge → workflow_dispatch (test) → TEST deploy
                           → validação em TEST
                           → workflow_dispatch (prod) → PROD deploy
```

**Detalhamento:**

1. **Desenvolvimento**: alterações feitas em branch dedicado (ex: `copilot/fix-*`)
2. **PR aberto**: revisão e merge para `main` (ou branch de governança)
3. **Deploy TEST**: disparo manual em `Actions → Deploy nv-enavia → Run workflow` com `target_env: test`
   - Executa: `wrangler deploy --env test`
   - Deploya para worker `enavia-worker-teste`
   - Usa KV preview, bucket `enavia-brain-test`, executor `enavia-executor-test`
4. **Validação em TEST**: smoke tests manuais (`GET /audit`, `GET /engineer`, `GET /__internal__/build`)
5. **Deploy PROD**: disparo manual com `target_env: prod`
   - Executa: `wrangler deploy` (sem `--env`)
   - Deploya para worker `nv-enavia`
   - Usa KV produção, bucket `enavia-brain`, executor `enavia-executor`

**NÃO existe trigger automático.** Push em qualquer branch não dispara deploy. O workflow é estritamente `workflow_dispatch`.

**O fluxo `branch → TEST → merge → PROD` está correto e é o fluxo real do repo.**

---

## 5. O Que Ainda Falta Para Funcionar "Real"

### Infraestrutura
- [ ] Confirmar que `enavia-executor-test` existe e está operacional no Cloudflare
- [ ] Confirmar que `deploy-worker-test` existe e está operacional no Cloudflare
- [ ] Confirmar que bucket Supabase `enavia-brain-test` existe com o `nv_index.json` correto
- [ ] `ENAVIA_GIT` KV: verificar se tem uso planejado ou remover o binding

### Governança
- [ ] Proteger `/brain/director-query` com `isInternalAuthorized()` ou token dedicado
- [ ] Documentar quando (se) `/__internal__/deploy-apply` vai sair do modo passivo
- [ ] Definir política de rotação do `INTERNAL_TOKEN`

### Segurança
- [ ] `/brain/director-query`: auth real (Bearer ou `brain_write` token)
- [ ] Avaliar CORS `*` em endpoints sensíveis (baixo risco, mas postura)
- [ ] `ENAVIA_BUILD.deployed_at` hardcoded: considerar injeção via `deploy-worker` ou env var dinâmica

### Operação
- [ ] Resolver double-load de `brain:index` em `buildBrain()` (2 KV reads desnecessários)
- [ ] Ativar/conectar `consolidateAfterSave` se Memory V3 deve funcionar
- [ ] Definir alertas ou logs de saúde em PROD (Workers Tail / Logpush)
- [ ] Smoke test automatizado pós-deploy (simples curl para `GET /audit` + `GET /__internal__/build`)

### Débito técnico (não bloqueio)
- [ ] Remover binding `ENAVIA_GIT` se não tiver uso planejado
- [ ] Corrigir URL `https://executor.invalid/audit` em `/propose` para algo mais descritivo
- [ ] Atualizar `ENAVIA_BUILD.id` para refletir versão real
- [ ] Considerar split do arquivo em módulos menores no futuro (não agora)

---

## 6. Checklist em Ordem de Execução

### 🔴 Obrigatório agora (bloqueio de operação segura)

- [ ] **Verificar `enavia-executor-test` e `deploy-worker-test`** — sem eles, `/audit` em TEST falha com `AUDIT_EXECUTOR_FAILED` e nada de engenharia funciona
- [ ] **Verificar bucket `enavia-brain-test`** — sem ele, `buildBrain()` falha no boot, worker TEST inoperante
- [ ] **Configurar `INTERNAL_TOKEN` como secret no Cloudflare** (PROD e TEST) — sem ele, todos `/__internal__/*` retornam 401, incluindo `/__internal__/build` (prova de deploy impossível)
- [ ] **Configurar `OPENAI_API_KEY` como secret** — sem ele, qualquer rota que chama o modelo (`POST /`, `/engineer`, Memory V5) lança erro 500

### 🟡 Recomendado em seguida

- [ ] **Proteger `/brain/director-query` com auth real** (Bearer INTERNAL_TOKEN ou token dedicado) — risco de exposição do brain estratégico
- [ ] **Corrigir double-load de `brain:index`** — remover um dos dois blocos em `buildBrain()` (reduz latência de cold start)
- [ ] **Ativar `consolidateAfterSave`** se Memory V3 deve funcionar — atualmente a função existe mas não é chamada
- [ ] **Smoke test automatizado pós-deploy** — curl para `GET /audit` e `GET /__internal__/build` no CI/CD após cada deploy

### 🟢 Opcional / não mexer agora

- [ ] Corrigir `ENAVIA_BUILD.deployed_at` hardcoded (informativo, não operacional)
- [ ] Remover `ENAVIA_GIT` binding se não houver uso planejado
- [ ] Corrigir URL placeholder em `/propose` (`https://executor.invalid/audit`)
- [ ] Avaliar CORS `*` em endpoints sensíveis
- [ ] Refatorar arquivo monolítico em módulos menores (débito técnico de longo prazo)

---

## Riscos

| Risco | Severidade | Probabilidade | Mitigação |
|-------|-----------|--------------|-----------|
| `enavia-executor-test` inexistente | 🔴 Alta | Média | Verificar no CF Dashboard antes de testar |
| `INTERNAL_TOKEN` não configurado | 🔴 Alta | Média | Configurar como secret no CF |
| `OPENAI_API_KEY` não configurado | 🔴 Alta | Baixa | Configurar como secret no CF |
| `/brain/director-query` sem auth | 🟡 Média | Baixa | Adicionar `isInternalAuthorized()` |
| `ENAVIA_BUILD.deployed_at` hardcoded | 🟡 Média | Alta | Prova de deploy enganosa — não crítico para operação |
| Double-load KV no boot | 🟢 Baixa | Alta | Latência extra, não falha |
| `consolidateAfterSave` unreachable | 🟢 Baixa | Alta | Memory V3 inativa — sem impacto operacional imediato |
| CORS `*` em endpoints internos | 🟢 Baixa | Baixa | Bearer auth protege os sensíveis |

---

## Provas

```
git remote -v
origin  https://github.com/brunovasque/nv-enavia (fetch)
origin  https://github.com/brunovasque/nv-enavia (push)

git rev-parse --abbrev-ref HEAD
copilot/diagnostico-enavia-worker-only

git rev-parse HEAD
ff620cc388b316f39e1de6f19881e34f9644a035
```

**Push realizado no mesmo branch/PR:** `copilot/diagnostico-enavia-worker-only`  
**Link do commit anterior:** https://github.com/brunovasque/nv-enavia/commit/ff620cc388b316f39e1de6f19881e34f9644a035
