# ENAVIA — Worker Registry

**Versão:** PR25 — 2026-04-29
**Tipo:** Inventário oficial de infraestrutura
**Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
**Documentos relacionados:**
- `ENAVIA_SYSTEM_MAP.md` — mapa macro do sistema (PR22)
- `ENAVIA_ROUTE_REGISTRY.json` — registry de 68 rotas HTTP (PR23)
- `ENAVIA_OPERATIONAL_PLAYBOOK.md` — playbook operacional (PR24)

---

## 1. Objetivo

Este documento é o **inventário oficial de infraestrutura da ENAVIA**.

Documenta de forma rastreável e baseada exclusivamente em fontes verificadas:

- Workers Cloudflare do sistema (nome, tipo, ambiente, função)
- Service bindings entre workers (`EXECUTOR`, `DEPLOY_WORKER`)
- KV namespaces utilizados (`ENAVIA_BRAIN`, `ENAVIA_GIT`, `GIT_KV`)
- Key shapes do KV conhecidos por evidência de código
- Secrets esperados (apenas nomes e usos — **nunca valores**)
- Variáveis de ambiente não secretas (vars documentáveis)
- Workflows GitHub Actions de deploy
- Relação Worker → Binding → Endpoint
- Ambientes PROD e TEST com suas diferenças
- Dependências externas por URL

**Regra absoluta:** este documento nunca registra valores de secrets. Se algo não estiver confirmado nas fontes, está marcado como **[A VERIFICAR]**.

---

## 2. Fontes consultadas

Todas as informações deste documento provêm exclusivamente das seguintes fontes reais:

| Fonte | Localização | Conteúdo relevante |
|-------|-------------|-------------------|
| `wrangler.toml` | raiz do repo | Worker principal nv-enavia, bindings, KV, vars PROD/TEST |
| `wrangler.executor.template.toml` | raiz do repo | Template de deploy do executor, KV namespaces, vars |
| `executor/wrangler.toml` | `executor/` | Referência de configuração do executor (não usado para deploy) |
| `.github/workflows/deploy.yml` | `.github/workflows/` | Deploy do worker principal, secrets GitHub |
| `.github/workflows/deploy-executor.yml` | `.github/workflows/` | Deploy do executor, resolução de KV por título |
| `nv-enavia.js` | raiz | Uso de env vars, secrets, KV keys, bindings |
| `contract-executor.js` | raiz | Uso de KV ENAVIA_BRAIN, key shapes de contrato |
| `ENAVIA_SYSTEM_MAP.md` | `schema/system/` | Descrição macro dos componentes |
| `ENAVIA_ROUTE_REGISTRY.json` | `schema/system/` | known_external_routes e bindings de rotas |
| `ENAVIA_OPERATIONAL_PLAYBOOK.md` | `schema/playbooks/` | Contexto operacional |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | `schema/status/` | Estado atual do sistema |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | `schema/handoffs/` | Handoff de PR24 |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | `schema/execution/` | Log de execução |

---

## 3. Ambientes conhecidos

| Ambiente | Worker principal | Finalidade | Estado |
|----------|-----------------|-----------|--------|
| **PROD** | `nv-enavia` | Ambiente de produção do sistema ENAVIA | Ativo ✅ |
| **TEST** | `enavia-worker-teste` | Ambiente de testes isolados | Ativo ✅ |
| **Executor PROD** | `enavia-executor` | Motor de execução de contratos (PROD) | Ativo via binding ✅ |
| **Executor TEST** | `enavia-executor-test` | Motor de execução de contratos (TEST) | Ativo via binding ✅ |
| **Deploy Worker PROD** | `deploy-worker` | Worker de deploy supervisionado (PROD) | Ativo via binding ✅ |
| **Deploy Worker TEST** | `deploy-worker-test` | Worker de deploy supervisionado (TEST) | Ativo via binding ✅ |
| **Browser Executor** | externo (URL) | Executor de automação de browser | URL configurada em PROD; vazia em TEST |
| **Director Cognitive** | externo (URL) | Director cognitivo do sistema | Mesma URL em PROD e TEST (ver Seção 16) |
| **Vercel Executor** | externo (URL) | Executor de patches Vercel | URL configurada em PROD e TEST |

**Nota sobre isolamento TEST/PROD:** O ambiente TEST utiliza a mesma `DIRECTOR_COGNITIVE_URL` que o ambiente PROD. Isolamento completo do director cognitive requereria endpoint dedicado (ex: `nv-director-cognitive-test`). Documentado como pendência em `wrangler.toml` (linha 52).

---

## 4. Workers do sistema

### 4.1 Workers confirmados (Cloudflare, gerenciados por este repo)

| Worker | Tipo | Fonte | Função | Ambiente | Estado |
|--------|------|-------|--------|----------|--------|
| `nv-enavia` | Cloudflare Worker | `wrangler.toml` | Worker principal: roteamento, loop contratual, memória, cognitive, bridge, planner | PROD | Ativo ✅ |
| `enavia-worker-teste` | Cloudflare Worker | `wrangler.toml` `[env.test]` | Instância TEST do nv-enavia | TEST | Ativo ✅ |
| `enavia-executor` | Cloudflare Worker | `wrangler.toml` `[[services]]` / `wrangler.executor.template.toml` | Motor de execução de contratos: audit, propose, apply-patch | PROD | Ativo via binding ✅ |
| `enavia-executor-test` | Cloudflare Worker | `wrangler.toml` `[env.test.services]` | Instância TEST do executor | TEST | Ativo via binding ✅ |
| `deploy-worker` | Cloudflare Worker | `wrangler.toml` `[[services]]` | Worker de deploy supervisionado: audit, apply-test | PROD | Ativo via binding ✅ |
| `deploy-worker-test` | Cloudflare Worker | `wrangler.toml` `[env.test.services]` | Instância TEST do deploy-worker | TEST | Ativo via binding ✅ |

### 4.2 Workers externos por URL (não gerenciados por este repo)

| Worker | URL (PROD) | URL (TEST) | Finalidade | Fonte |
|--------|-----------|-----------|-----------|-------|
| Browser Executor | `https://run.nv-imoveis.com/browser/run` | `""` (vazio — não configurado) | Automação de browser | `wrangler.toml` `BROWSER_EXECUTOR_URL` |
| Director Cognitive | `https://nv-director-cognitive.brunovasque.workers.dev/director/cognitive` | mesma URL (ver nota) | Director cognitivo | `wrangler.toml` `DIRECTOR_COGNITIVE_URL` |
| Vercel Executor | `https://nv-vercel-executor.brunovasque.workers.dev/vercel/patch` | mesma URL | Patches Vercel | `wrangler.toml` `VERCEL_EXECUTOR_URL` |
| Deploy Worker (URL direta) | `https://deploy-worker.brunovasque.workers.dev` | `https://deploy-worker-test.brunovasque.workers.dev` | Referência de URL do executor (não via service binding) | `wrangler.executor.template.toml` `DEPLOY_WORKER_URL` |
| ENAVIA Executor (URL direta) | `https://enavia-executor.brunovasque.workers.dev` | — | Referência de URL exposta via `ENAVIA_EXECUTOR_URL` | `wrangler.toml` |

### 4.3 Workers citados mas não confirmados neste repo

Nenhum worker adicional identificado nas fontes além dos acima.

---

## 5. Service bindings

Service bindings permitem comunicação direta Worker-to-Worker sem passar pela rede pública.

### 5.1 Worker principal nv-enavia — bindings PROD

| Binding | Aponta para | Ambiente | Fonte | Uso |
|---------|------------|----------|-------|-----|
| `EXECUTOR` | `enavia-executor` | PROD | `wrangler.toml` `[[services]]` | Chamadas de audit/propose ao executor de contratos |
| `DEPLOY_WORKER` | `deploy-worker` | PROD | `wrangler.toml` `[[services]]` | Chamadas de deploy supervisionado |

### 5.2 Worker principal nv-enavia — bindings TEST

| Binding | Aponta para | Ambiente | Fonte | Uso |
|---------|------------|----------|-------|-----|
| `EXECUTOR` | `enavia-executor-test` | TEST | `wrangler.toml` `[env.test.services]` | Instância TEST do executor |
| `DEPLOY_WORKER` | `deploy-worker-test` | TEST | `wrangler.toml` `[env.test.services]` | Instância TEST do deploy-worker |

### 5.3 Endpoints utilizados pelos bindings (confirmados)

| Origem | Binding | Destino | Endpoints usados | Fonte |
|--------|---------|---------|-----------------|-------|
| `nv-enavia` | `EXECUTOR` | `enavia-executor` | `POST /audit`, `POST /propose` | `ENAVIA_ROUTE_REGISTRY.json` `known_external_routes` |
| `nv-enavia` | `DEPLOY_WORKER` | `deploy-worker` | `POST /audit`, `POST /apply-test` | `ENAVIA_ROUTE_REGISTRY.json` `known_external_routes` |

---

## 6. KV namespaces

### 6.1 KV do worker principal nv-enavia

| Binding KV | Namespace title | ID (PROD) | ID (TEST/preview) | Ambiente | Uso | Fonte |
|-----------|----------------|-----------|-------------------|----------|-----|-------|
| `ENAVIA_BRAIN` | `enavia-brain` (PROD) / `enavia-brain-test` (TEST) | `722835b730dd44c79f6ff1f0cdc314a9` | `235fd25ad3b44217975f6ce0d77615d0` | PROD + TEST | Estado de contratos, memória, brain modules, decisões, trails de execução | `wrangler.toml` |

**Importante:** Os IDs acima são visíveis em `wrangler.toml` (não são secrets). O `preview_id` do ENAVIA_BRAIN aponta para o mesmo namespace TEST que o ambiente `env.test`.

### 6.2 KV do executor (enavia-executor)

| Binding KV | Namespace title (Cloudflare) | ID | Ambiente | Uso | Fonte |
|-----------|-----------------------------|----|----------|-----|-------|
| `ENAVIA_BRAIN` | `enavia-brain` | Resolvido dinamicamente no deploy | PROD | Estado de contratos lido/escrito pelo executor | `wrangler.executor.template.toml` |
| `ENAVIA_BRAIN` | `enavia-brain-test` | Resolvido dinamicamente no deploy | TEST | Idem, ambiente TEST | `wrangler.executor.template.toml` |
| `ENAVIA_GIT` | `ENAVIA_GIT` | Resolvido dinamicamente no deploy | PROD | Armazenamento de snapshots Git do worker | `wrangler.executor.template.toml` |
| `ENAVIA_GIT` | `ENAVIA_GIT_TEST` | Resolvido dinamicamente no deploy | TEST | Idem, ambiente TEST | `wrangler.executor.template.toml` |
| `GIT_KV` | `ENAVIA_GIT` (mesmo namespace físico) | Resolvido dinamicamente no deploy | PROD | Compatibilidade de binding lógico separado | `wrangler.executor.template.toml` |
| `GIT_KV` | `ENAVIA_GIT_TEST` (mesmo namespace físico) | Resolvido dinamicamente no deploy | TEST | Idem, ambiente TEST | `wrangler.executor.template.toml` |

**Nota:** O workflow `deploy-executor.yml` resolve os IDs de KV dinamicamente via `wrangler kv namespace list` + busca por título (case-sensitive) no momento do deploy, sem expô-los como GitHub Secrets.

### 6.3 Key shapes conhecidos — ENAVIA_BRAIN

Shapes confirmados por evidência direta em `nv-enavia.js` e `contract-executor.js`:

| Key shape | Tipo de valor | Uso | Fonte |
|-----------|--------------|-----|-------|
| `contract:index` | JSON array | Índice de todos os contratos | `contract-executor.js:116`, `nv-enavia.js:4963` |
| `contract:{id}:state` | JSON object | Estado do contrato (status_global, tasks, phases) | `contract-executor.js:114,441` |
| `contract:{id}:decomposition` | JSON object | Decomposição do contrato (fases, tasks) | `contract-executor.js:115,442` |
| `contract:{id}:exec_event` | JSON object | Último evento de execução do contrato | `contract-executor.js:118,2340` |
| `contract:{id}:flog:{ts}_{seq}_{rand4}` | JSON object | Entrada de functional log (formato novo) | `contract-executor.js:127,2417` |
| `contract:{id}:functional_logs` | JSON array | Log funcional legacy (backward-compat) | `contract-executor.js:126,2482` |
| `execution:trail:latest` | JSON object | Último trail de execução | `nv-enavia.js:3678` |
| `execution:trail:{reqId}` | JSON object | Trail de execução por request ID | `nv-enavia.js:3679` |
| `execution:exec_event:latest_contract_id` | string | ID do último contrato com evento de execução | `contract-executor.js:2343` |
| `decision:latest` | JSON object | Última decisão registrada | `nv-enavia.js:6409` |
| `decision:{decisionId}` | JSON object | Decisão específica por ID | `nv-enavia.js:6406` |
| `brain:index` | JSON array | Índice de módulos do brain | `nv-enavia.js:441,1373` |
| `brain:decision` (prefixo) | vários | Módulos de decisão do brain | `nv-enavia.js:472` |
| `brain:policy` (prefixo) | vários | Políticas do brain | `nv-enavia.js:473` |
| `brain:train:{key}` | text | Entradas de treinamento | `nv-enavia.js:1410` |
| `planner:latest:{session_id}` | JSON object | Último payload do planner por sessão | `nv-enavia.js:3469` |
| `memory:{memory_id}` | JSON object | Entrada de memória | `nv-enavia.js:3341` |
| `SYSTEM_PROMPT` | text | System prompt ativo | `nv-enavia.js:426,1632` |
| `enaviaindex` | JSON | Índice de módulos (legacy) | `nv-enavia.js:1287` |
| `browser-arm:state` | JSON object | Estado do browser arm | `contract-executor.js:4499,4572` |

---

## 7. Secrets esperados

> **REGRA ABSOLUTA:** Este documento nunca registra valores de secrets. A coluna "Valor" é sempre "NUNCA DOCUMENTAR".

### 7.1 Secrets do worker nv-enavia (Cloudflare Worker secrets)

| Secret | Tipo | Obrigatório? | Ambiente | Uso | Fonte |
|--------|------|-------------|----------|-----|-------|
| `OPENAI_API_KEY` | Cloudflare secret | Sim | PROD + TEST | Chamadas à API OpenAI (cognitive, planner, memória) | `nv-enavia.js:936` |
| `INTERNAL_TOKEN` | Cloudflare secret | Sim | PROD + TEST | Autenticação Bearer para rotas `/__internal__/*` | `nv-enavia.js:7919` |
| `SUPABASE_KEY` | Cloudflare secret | [A VERIFICAR] | PROD + TEST | Autenticação Supabase Storage (apikey) — não visível em `wrangler.toml` `[vars]`, provavelmente secret | `nv-enavia.js:281-282` (uso de SUPABASE_URL/BUCKET confirmado; KEY não explicitado) |

### 7.2 Secrets do GitHub Actions — deploy.yml

| Secret GitHub | Uso | Fonte |
|--------------|-----|-------|
| `CLOUDFLARE_API_TOKEN` | Deploy do worker nv-enavia via Wrangler | `deploy.yml:34` |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy do worker nv-enavia via Wrangler | `deploy.yml:35` |
| `INTERNAL_TOKEN` | Smoke test de `/__internal__/build` (TEST) | `deploy.yml:47,71` |

### 7.3 Secrets do GitHub Actions — deploy-executor.yml

| Secret GitHub | Uso | Fonte |
|--------------|-----|-------|
| `CLOUDFLARE_API_TOKEN` | Deploy do executor via Wrangler + resolução de KV | `deploy-executor.yml:27` |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy do executor via Wrangler + resolução de KV | `deploy-executor.yml:28` |

**Nota:** Os IDs dos KV namespaces do executor são resolvidos dinamicamente em runtime pelo workflow via `wrangler kv namespace list`, sem necessidade de secrets adicionais no GitHub além de `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

### 7.4 Secrets do executor enavia-executor (Cloudflare Worker secrets)

| Secret | Tipo | Obrigatório? | Uso | Fonte |
|--------|------|-------------|-----|-------|
| `CF_API_TOKEN` | Cloudflare secret | Sim | Chamadas à Cloudflare API (deploy, audit de código) | `executor/src/index.js:201-202,665` |
| `CF_ACCOUNT_ID` | Cloudflare secret | Sim | Cloudflare API (account context) | `executor/src/index.js:201` |
| `OPENAI_API_KEY` / `CODEX_API_KEY` | Cloudflare secret | Sim (um dos dois) | Chamadas OpenAI/Codex para análise de código | `executor/src/index.js:5506,6992` |

---

## 8. Variáveis de ambiente não secretas

### 8.1 nv-enavia — PROD (`wrangler.toml [vars]`)

| Variável | Valor documentável | Uso | Fonte |
|----------|--------------------|-----|-------|
| `ENAVIA_MODE` | `"supervised"` | Modo de operação do sistema | `wrangler.toml:9` |
| `BROWSER_EXECUTOR_URL` | `https://run.nv-imoveis.com/browser/run` | URL do browser executor externo | `wrangler.toml:10` |
| `SUPABASE_URL` | `https://jsqvhmnjsbmtfyyukwsr.supabase.co` | URL base do Supabase | `wrangler.toml:11` |
| `SUPABASE_BUCKET` | `enavia-brain` | Bucket de storage do Supabase | `wrangler.toml:12` |
| `OPENAI_MODEL` | `gpt-5.2` | Modelo padrão de OpenAI | `wrangler.toml:13` |
| `ENAVIA_EXECUTOR_URL` | `https://enavia-executor.brunovasque.workers.dev` | URL pública do executor | `wrangler.toml:14` |
| `DIRECTOR_COGNITIVE_URL` | `https://nv-director-cognitive.brunovasque.workers.dev/director/cognitive` | URL do director cognitive | `wrangler.toml:15` |
| `VERCEL_EXECUTOR_URL` | `https://nv-vercel-executor.brunovasque.workers.dev/vercel/patch` | URL do executor Vercel | `wrangler.toml:16` |
| `ENAVIA_VERSION` | `v2` | Versão do sistema | `wrangler.toml:17` |
| `OWNER` | `Vasques` | Owner do sistema | `wrangler.toml:18` |
| `SYSTEM_NAME` | `ENAVIA` | Nome do sistema | `wrangler.toml:19` |

### 8.2 nv-enavia — TEST (`wrangler.toml [env.test.vars]`)

| Variável | Valor (TEST) | Diferença em relação a PROD |
|----------|-----------|-----------------------------|
| `ENAVIA_MODE` | `"supervised"` | Igual a PROD |
| `BROWSER_EXECUTOR_URL` | `""` (vazio) | **Diferente:** browser executor não configurado em TEST |
| `SUPABASE_URL` | `https://jsqvhmnjsbmtfyyukwsr.supabase.co` | Igual a PROD |
| `SUPABASE_BUCKET` | `enavia-brain-test` | **Diferente:** bucket separado para TEST |
| `OPENAI_MODEL` | `gpt-5.2` | Igual a PROD |
| `ENAVIA_EXECUTOR_URL` | `https://enavia-executor.brunovasque.workers.dev` | Igual a PROD |
| `DIRECTOR_COGNITIVE_URL` | `https://nv-director-cognitive.brunovasque.workers.dev/director/cognitive` | **Mesma URL** — isolamento incompleto (ver Seção 16) |
| `VERCEL_EXECUTOR_URL` | `https://nv-vercel-executor.brunovasque.workers.dev/vercel/patch` | Igual a PROD |
| `ENAVIA_VERSION` | `v2` | Igual a PROD |
| `OWNER` | `Vasques` | Igual a PROD |
| `SYSTEM_NAME` | `ENAVIA` | Igual a PROD |

### 8.3 enavia-executor — PROD (`wrangler.executor.template.toml [vars]`)

| Variável | Valor documentável | Uso |
|----------|--------------------|-----|
| `CF_WORKER_NAME_NV_ENAVIA` | `nv-enavia` | Nome do worker alvo para deploy |
| `DEPLOY_WORKER_URL` | `https://deploy-worker.brunovasque.workers.dev` | URL do deploy worker para chamadas HTTP |
| `ENAVIA_ENV` | `production` | Identificador de ambiente |
| `OPENAI_CODE_MODEL` | `gpt-5.2` | Modelo OpenAI para análise de código |
| `TARGET_WORKER_NAME` | `nv-enavia` | Nome do worker alvo |

### 8.4 enavia-executor — TEST (`wrangler.executor.template.toml [env.test.vars]`)

| Variável | Valor (TEST) | Diferença em relação a PROD |
|----------|-----------|-----------------------------|
| `CF_WORKER_NAME_NV_ENAVIA` | `enavia-worker-teste` | **Diferente:** aponta para instância TEST |
| `DEPLOY_WORKER_URL` | `https://deploy-worker-test.brunovasque.workers.dev` | **Diferente:** URL do deploy worker TEST |
| `ENAVIA_ENV` | `test` | **Diferente:** marcador de ambiente |
| `OPENAI_CODE_MODEL` | `gpt-5.2` | Igual a PROD |
| `TARGET_WORKER_NAME` | `enavia-worker-teste` | **Diferente:** aponta para worker TEST |

---

## 9. Workflows GitHub

| Workflow | Trigger | Deploy alvo | Secrets usados | Observação |
|----------|---------|------------|---------------|-----------|
| `.github/workflows/deploy.yml` | `push` para `main` (PROD automático) OU `workflow_dispatch` (manual TEST ou PROD) | `nv-enavia` (PROD) ou `enavia-worker-teste` (TEST) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_TOKEN` (TEST smoke) | Deploy TEST: `wrangler deploy --env test`. Deploy PROD: `wrangler deploy`. Inclui validação de placeholders e smoke tests. |
| `.github/workflows/deploy-executor.yml` | `workflow_dispatch` apenas (escolha de `test` ou `prod`) | `enavia-executor` (PROD) ou `enavia-executor-test` (TEST) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Resolve KV IDs dinamicamente por título. Valida syntax do executor. Roda testes de contrato. Bootstrap de snapshot após deploy. |

### 9.1 Validações executadas pelo deploy.yml

1. Verifica se `wrangler.toml` não contém placeholders `REPLACE_WITH_`.
2. Verifica se `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` estão presentes.
3. Para TEST: verifica `INTERNAL_TOKEN`; faz smoke em `GET /audit` e `GET /__internal__/build`.
4. Deploy PROD: acionado automaticamente em push para `main`.

### 9.2 Validações executadas pelo deploy-executor.yml

1. Verifica `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
2. Resolve IDs de KV via `wrangler kv namespace list` + busca por título (case-sensitive).
3. Gera `wrangler.executor.generated.toml` substituindo placeholders.
4. Valida config gerado (zero placeholders restantes).
5. Instala dependências e valida sintaxe do executor.
6. Roda testes de contrato (`executor.contract.test.js`, `cloudflare-credentials.test.js`).
7. Faz bootstrap de snapshot no executor TEST via `POST /apply-patch`.
8. Smoke `POST /audit` no executor TEST.

---

## 10. Relação Worker → Binding → Endpoint

| Origem | Tipo de conexão | Binding / Env var | Destino | Endpoints usados (confirmados) | Fonte |
|--------|----------------|------------------|---------|-----------------------------|-------|
| `nv-enavia` | Service binding | `EXECUTOR` | `enavia-executor` (PROD) / `enavia-executor-test` (TEST) | `POST /audit`, `POST /propose` | `ENAVIA_ROUTE_REGISTRY.json` `known_external_routes` |
| `nv-enavia` | Service binding | `DEPLOY_WORKER` | `deploy-worker` (PROD) / `deploy-worker-test` (TEST) | `POST /audit`, `POST /apply-test` | `ENAVIA_ROUTE_REGISTRY.json` `known_external_routes` |
| `nv-enavia` | Fetch via env URL | `BROWSER_EXECUTOR_URL` | browser executor externo | `POST /browser/run` | `nv-enavia.js:6782,6881`, `ENAVIA_ROUTE_REGISTRY.json` |
| `nv-enavia` | Fetch via env URL | `DIRECTOR_COGNITIVE_URL` | director cognitive externo | `POST /director/cognitive` | `nv-enavia.js:8842`, `ENAVIA_ROUTE_REGISTRY.json` |
| `nv-enavia` | Fetch via env URL | `VERCEL_EXECUTOR_URL` | vercel executor externo | `POST /vercel/patch` | `nv-enavia.js:1515,1568`, `ENAVIA_ROUTE_REGISTRY.json` |
| `enavia-executor` | Fetch via env URL | `DEPLOY_WORKER_URL` | deploy-worker | Rotas de deploy [A VERIFICAR] | `wrangler.executor.template.toml` |
| `nv-enavia` | Fetch via env URL | `ENAVIA_EXECUTOR_URL` | enavia-executor (URL pública) | Diagnóstico/referência (`nv-enavia.js:2347`) | `wrangler.toml` |

---

## 11. Relação com Route Registry

O `ENAVIA_ROUTE_REGISTRY.json` (PR23) e este Worker Registry são **documentos complementares**:

- **Route Registry** (`ENAVIA_ROUTE_REGISTRY.json`): inventário das 68 rotas HTTP expostas por `nv-enavia`, com handler, scope, auth, input/output e evidência de código.
- **Worker Registry** (este documento): inventário da infraestrutura que suporta essas rotas — workers, bindings, KV namespaces, secrets e ambientes.

**Regra de manutenção:** se uma rota mudar de binding (ex: `EXECUTOR` passa a chamar rota diferente), ambos os documentos devem ser atualizados em conjunto na mesma PR-DOCS.

**Consulta conjunta:** para diagnosticar um problema de rota, consulte:
1. Route Registry → qual handler trata a rota e qual binding/URL usa.
2. Worker Registry (este) → se o binding existe, em qual ambiente, e quais secrets são necessários.

---

## 12. Relação com Operational Playbook

O `ENAVIA_OPERATIONAL_PLAYBOOK.md` (PR24) orienta **como operar** o sistema. Este Worker Registry orienta **quais dependências de infraestrutura devem existir** para a operação funcionar.

**Uso conjunto:**
- Antes de diagnosticar falha de binding → consultar Seção 5 deste documento.
- Antes de diagnosticar falha de KV → consultar Seção 6 deste documento.
- Antes de diagnosticar falha de secret → consultar Seção 7 deste documento.
- Antes de re-deploy → consultar Seção 9 deste documento (workflows e validações).
- Playbook (Seção 14) já referencia este Worker Registry para diagnóstico de infraestrutura.

---

## 13. Checklist de saúde de infraestrutura

Execute este checklist antes de qualquer diagnóstico ou deploy:

- [ ] Worker principal `nv-enavia` deployado em PROD?
- [ ] Worker `enavia-worker-teste` deployado em TEST?
- [ ] Service binding `EXECUTOR` aponta para `enavia-executor` (PROD) / `enavia-executor-test` (TEST)?
- [ ] Service binding `DEPLOY_WORKER` aponta para `deploy-worker` (PROD) / `deploy-worker-test` (TEST)?
- [ ] KV `ENAVIA_BRAIN` existe e está binding ao worker correto em cada ambiente?
- [ ] KV `ENAVIA_GIT` existe no executor (resolvido por título no deploy)?
- [ ] `INTERNAL_TOKEN` configurado como secret no worker?
- [ ] `OPENAI_API_KEY` configurado como secret no worker (nv-enavia)?
- [ ] `SUPABASE_KEY` configurado como secret no worker [A VERIFICAR]?
- [ ] Executor: `CF_ACCOUNT_ID` e `CF_API_TOKEN` configurados como secrets?
- [ ] Executor: `OPENAI_API_KEY` ou `CODEX_API_KEY` configurado?
- [ ] `BROWSER_EXECUTOR_URL` configurada em PROD (não vazia)?
- [ ] `DIRECTOR_COGNITIVE_URL` configurada em PROD e TEST?
- [ ] `VERCEL_EXECUTOR_URL` configurada em PROD e TEST?
- [ ] GitHub Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_TOKEN` configurados?
- [ ] Workflows apontam para workers corretos (nomes case-sensitive)?
- [ ] Ambientes TEST e PROD estão separados (KV, SUPABASE_BUCKET, worker names)?
- [ ] Nenhum secret foi exposto em documentação, logs ou commits?

---

## 14. Como diagnosticar falhas de infraestrutura

| Sintoma | Causa provável | Onde verificar | Próxima ação segura |
|---------|---------------|---------------|---------------------|
| `401` em rota `/__internal__/*` | `INTERNAL_TOKEN` ausente ou incorreto no worker | Cloudflare Dashboard → Worker secrets | Reconfiguraro secret `INTERNAL_TOKEN` (sem expor o valor) |
| `500` em rota que chama `EXECUTOR` | Binding `EXECUTOR` ausente ou executor não deployado | `wrangler.toml` bindings + CF Dashboard → Workers | Verificar se `enavia-executor` está deployado; validar binding no dashboard |
| `500` em rota que chama `DEPLOY_WORKER` | Binding `DEPLOY_WORKER` ausente ou deploy-worker não deployado | `wrangler.toml` bindings + CF Dashboard | Verificar se `deploy-worker` está deployado; validar binding |
| Erro `KV namespace not found` | KV não existe no ambiente correto | CF Dashboard → Workers & Pages → KV | Verificar se namespace com título correto existe; verificar ID em `wrangler.toml` |
| Erro `KV get/put failed` | KV binding incorreto ou KV ID errado | `wrangler.toml` `[[kv_namespaces]]` | Comparar ID no toml com ID no CF Dashboard |
| Erro OpenAI / `OPENAI_API_KEY não configurada` | Secret `OPENAI_API_KEY` ausente | CF Dashboard → Worker secrets | Configurar secret sem expor valor |
| Erro Supabase / falha de upload/download | `SUPABASE_KEY` ausente ou `SUPABASE_URL`/`SUPABASE_BUCKET` incorretos | `wrangler.toml` vars + CF secrets | Verificar vars em `wrangler.toml`; verificar secret `SUPABASE_KEY` |
| Browser Executor indisponível (`BROWSER_EXECUTOR_URL` vazia em TEST) | `BROWSER_EXECUTOR_URL` é `""` em TEST por design | `wrangler.toml` `[env.test.vars]` | Normal em TEST — browser routes não operacionais neste ambiente |
| Director Cognitive lento ou afetando PROD e TEST simultaneamente | Compartilhamento de `DIRECTOR_COGNITIVE_URL` entre PROD/TEST | `wrangler.toml` nota linha 52 | Criar endpoint dedicado `nv-director-cognitive-test` (melhoria futura, não fazer agora) |
| Deploy worker falhando no CI | Secrets do GitHub ausentes ou KV namespace com título errado | `.github/workflows/deploy-executor.yml` + CF Dashboard → KV titles | Verificar títulos de KV (case-sensitive): `enavia-brain`, `enavia-brain-test`, `ENAVIA_GIT`, `ENAVIA_GIT_TEST` |
| Workflow `deploy.yml` falha na validação de placeholders | `wrangler.toml` contém string `REPLACE_WITH_` | `wrangler.toml` grep por `REPLACE_WITH_` | Substituir placeholder pelo valor real antes do deploy |
| Divergência de comportamento TEST/PROD | Env vars ou KV diferem entre ambientes | Comparar Seção 8.1 vs 8.2 deste documento | Alinhar configuração de acordo com a diferença intencional documentada |

---

## 15. O que está confirmado

Fatos confirmados por evidência direta nas fontes:

1. Worker principal: `nv-enavia` (PROD), `enavia-worker-teste` (TEST) — confirmados em `wrangler.toml`.
2. Service bindings: `EXECUTOR` e `DEPLOY_WORKER` existem em PROD e TEST — confirmados em `wrangler.toml`.
3. KV `ENAVIA_BRAIN` com IDs visíveis em PROD (`722835b730dd44c79f6ff1f0cdc314a9`) e TEST (`235fd25ad3b44217975f6ce0d77615d0`) — confirmados em `wrangler.toml`.
4. Executor possui 3 KV bindings: `ENAVIA_BRAIN`, `ENAVIA_GIT`, `GIT_KV` — confirmados em `wrangler.executor.template.toml`.
5. `INTERNAL_TOKEN` usado como Bearer para `/__internal__/*` — confirmado em `nv-enavia.js:7919-7920`.
6. `OPENAI_API_KEY` obrigatório em nv-enavia — confirmado em `nv-enavia.js:936,3897`.
7. Executor requer `CF_ACCOUNT_ID` e `CF_API_TOKEN` — confirmado em `executor/src/index.js:201-202`.
8. `BROWSER_EXECUTOR_URL` vazia em TEST — documentado em `wrangler.toml:41`.
9. `DIRECTOR_COGNITIVE_URL` é a mesma em PROD e TEST — documentado com nota em `wrangler.toml:52-55`.
10. Workflows `deploy.yml` e `deploy-executor.yml` existem e são os únicos workflows do repo.
11. Deploy PROD de `nv-enavia` é acionado automaticamente por push em `main`.
12. Deploy do executor é sempre manual (`workflow_dispatch`).
13. Key shapes `contract:{id}:state`, `contract:{id}:decomposition`, `contract:index` — confirmados em `contract-executor.js:113-116`.
14. Key `browser-arm:state` — confirmada em `contract-executor.js:4499`.
15. 14 key shapes da Seção 6.3 confirmados por evidência direta de código.

---

## 16. O que está pendente / a verificar

| Item | Razão da incerteza | Onde verificar |
|------|-------------------|---------------|
| `SUPABASE_KEY` — existe como Cloudflare secret? | Não aparece em `[vars]` do `wrangler.toml`. Uso de Supabase Storage requer apikey, mas não foi encontrado no código de forma explícita por nome. | Cloudflare Dashboard → Worker secrets; código de autenticação Supabase em `nv-enavia.js` |
| Rotas exatas usadas por `enavia-executor` → `deploy-worker` | O `DEPLOY_WORKER_URL` do executor aponta para o deploy-worker, mas os endpoints chamados não foram confirmados nestas fontes | `executor/src/index.js` — não lido integralmente nesta PR |
| Isolamento completo TEST/PROD para `DIRECTOR_COGNITIVE_URL` | Documentado como incompleto em `wrangler.toml:52-55` | Criação de endpoint dedicado `nv-director-cognitive-test` |
| `ADMIN_API_KEY` — existe no sistema? | Referenciado em `ENAVIA_ROUTE_REGISTRY.json` como `auth.type: "admin_key"`, mas não localizado como env var em `wrangler.toml` | `nv-enavia.js` — busca por `ADMIN_API_KEY` nos headers de autenticação |
| KV namespaces adicionais do executor em PROD | `wrangler.executor.template.toml` usa resolução dinâmica; IDs reais não visíveis neste repo | Cloudflare Dashboard → Workers & Pages → KV |
| `CODEX_API_KEY` vs `OPENAI_API_KEY` no executor | Executor aceita qualquer um dos dois (`executor/src/index.js:5506`); qual está configurado em PROD é desconhecido | CF Dashboard → executor secrets |
| Deploy Worker — código e rotas expostas | Deploy worker (`deploy-worker` / `deploy-worker-test`) não tem código neste repo | Repo externo (se existir) |
| Browser executor — código e rotas internas | `run.nv-imoveis.com` é URL externa — código não disponível neste repo | Repo externo |

---

## 17. Itens opcionais — não mexer agora

> **Isso é opcional. Não mexa agora.**

1. Criar endpoint de health de infraestrutura (`GET /health/infra`) que valide bindings e secrets em runtime.
2. Criar validação automática de secrets no startup do worker.
3. Criar dashboard de status de bindings no painel.
4. Criar sync automático entre Route Registry e Worker Registry.
5. Criar endpoint dedicado `nv-director-cognitive-test` para isolar PROD/TEST.
6. Alterar workflows para adicionar validações adicionais.
7. Renomear bindings (`EXECUTOR` → `CONTRACT_EXECUTOR` etc.) para maior clareza.
8. Criar KV namespace dedicado para audit logs ou decisões.
9. Criar rotação automática de secrets com validação de policy.

---

## 18. Regras de manutenção

1. **Atualizar este documento** quando qualquer binding, secret, KV namespace, env var, worker name ou workflow mudar.
2. **Nunca registrar valores de secrets** — apenas nomes e usos. Se um valor aparecer em código/log, remover imediatamente e tratar como incidente de segurança.
3. **Manter sincronizado** com `ENAVIA_SYSTEM_MAP.md` (PR22), `ENAVIA_ROUTE_REGISTRY.json` (PR23) e `ENAVIA_OPERATIONAL_PLAYBOOK.md` (PR24).
4. **Se mudar runtime ou binding**: abrir PR-IMPL separada, com diagnóstico (PR-DIAG) antes. Nunca na mesma PR de documentação.
5. **Se apenas documentar**: manter como PR-DOCS, não alterar `wrangler.toml`, `nv-enavia.js`, `contract-executor.js`, `executor/`, `panel/` ou workflows.
6. **Marcar incertezas**: se algo não estiver confirmado nas fontes, usar `[A VERIFICAR]` com indicação de onde verificar.
7. **Base de evidência**: toda afirmação neste documento deve ter uma fonte na Seção 2. Não inventar binding, secret, worker ou KV.
8. **IDs de KV não são secrets**: os IDs visíveis em `wrangler.toml` são valores de configuração (não secrets). Podem ser documentados. Porém, IDs resolvidos dinamicamente pelo executor não são documentados aqui pois mudam por conta/ambiente.
