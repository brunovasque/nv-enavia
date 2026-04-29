# ENAVIA — Latest Handoff

**Data:** 2026-04-29
**De:** FIX — bootstrap do snapshot canônico do Executor no KV após deploy TEST
**Para:** Rodar `Deploy enavia-executor` em TEST e confirmar bootstrap + self-audit sem finding crítico de snapshot ausente

## O que foi feito nesta sessão

### Patch cirúrgico — `executor/src/index.js` + `.github/workflows/deploy-executor.yml`

O fluxo operacional do Worker `nv-enavia` continua chamando o Executor com live-read, mas o runtime governado por este repo agora também passa a nascer com snapshot bootstrapado no KV TEST logo após o deploy:

**Detalhes do patch:**
- `saveVersion(...)` em `executor/src/index.js` agora também grava `git:code:latest` junto do snapshot canônico (`git:latest` + `git:code:<id>`), preservando compatibilidade com lookup legado do self-audit.
- `.github/workflows/deploy-executor.yml` agora, em `target_env=test`:
  - faz o deploy do runtime `enavia-executor-test`;
  - monta um payload com `executor/src/index.js`;
  - chama `POST /apply-patch` no runtime recém-publicado com `auto_deploy:false`;
  - falha se o bootstrap não devolver `meta.id` e `code_length` válidos;
  - só depois roda o smoke `POST /audit` com `context.require_live_read:true`.

**Garantias do patch:**
- Escopo Executor-only + workflow do executor. `nv-enavia.js`, painel e Deploy Worker não foram alterados.
- Nenhum gate de `risk_level` foi relaxado.
- Nenhum valor de secret é retornado no workflow.
- O bootstrap reutiliza o caminho nativo `/apply-patch` do próprio Executor em vez de escrever KV “por fora”.
- O smoke pós-bootstrap cobre o mesmo ramo de live read que estava bloqueando por snapshot ausente.

**Validações locais:**
- `node --check executor/src/index.js` → OK ✅
- `node executor/tests/executor.contract.test.js` → **34 passed, 0 failed** ✅
- `node --test executor/tests/cloudflare-credentials.test.js` → **4 passed, 0 failed** ✅
- `python3 -c "yaml.safe_load(...deploy-executor.yml...)"` → **YAML válido** ✅

## Próxima ação segura

1. Rodar o workflow `Deploy enavia-executor` com `target_env=test`.
2. Confirmar no job:
   - `POST /apply-patch → HTTP 200`
   - `executor snapshot version_id: ...`
3. Confirmar no smoke que o `/audit` real devolve `snapshot_fingerprint` e não volta a emitir `Snapshot canônico do executor ausente no KV`.
4. Se o smoke ainda falhar, inspecionar apenas o retorno do bootstrap e o namespace `ENAVIA_GIT_TEST`, sem alterar Worker/Panel.

## Bloqueios

- nenhum

---

## O que foi feito nesta sessão (diagnóstico)

### Patch cirúrgico — `.github/workflows/deploy-executor.yml`

Na etapa `Validate KV namespace IDs against Cloudflare`, logo após validar que `wrangler kv namespace list` retornou um JSON array (e ANTES da validação dos 6 secrets `check_kv`), passamos a imprimir os títulos/nomes dos KV namespaces visíveis para o token/conta do GitHub Actions:

```bash
echo "KV namespaces visíveis nesta conta/token:"
jq -r '.[] | (.title // .name // empty)' /tmp/kv_namespaces.json \
  | sort -u \
  | sed 's/^/- /'
echo ""
```

**Garantias do patch:**
- Não imprime IDs (apenas `.title` ou, na falta dele, `.name`).
- Não imprime nenhum valor de secret.
- Não altera a validação dos 6 secrets que vem em seguida — ela continua intacta.
- Escopo workflow-only: apenas `.github/workflows/deploy-executor.yml`. Não toca em `nv-enavia.js`, executor runtime, painel ou KV runtime.

### Critério de diagnóstico para a próxima execução

1. Se `enavia-brain-test`, `ENAVIA_GIT_TEST` e `enavia-executor-test` **não** aparecerem na lista visível → o problema é `CLOUDFLARE_ACCOUNT_ID` / token / conta usada pelo GitHub Actions.
2. Se aparecerem → o problema é o valor salvo nos secrets `ENAVIA_BRAIN_TEST_KV_ID`, `ENAVIA_GIT_TEST_KV_ID`, `GIT_KV_TEST_ID`.

---

## Histórico (sessão anterior)

**De:** FIX — Robustez do diagnóstico de KV namespace IDs
**Para:** Reexecutar `Deploy enavia-executor` em TEST com parse confiável do retorno do Wrangler

## O que foi feito nesta sessão

### FIX cirúrgico — `deploy-executor.yml` — separar stdout/stderr do Wrangler e validar JSON antes do check de KV

**Problema:** o diagnóstico novo tinha um bug próprio. A etapa:
```bash
KV_LIST_JSON=$(npx wrangler kv namespace list 2>&1)
```
misturava stderr com stdout. Se o Wrangler emitisse warning/banner/erro parcial, o conteúdo deixava de ser JSON puro e todos os 6 checks podiam cair como `INVALID`, mesmo com IDs corretos.

**Correção aplicada (patch cirúrgico):**

```bash
npx wrangler kv namespace list > /tmp/kv_namespaces.json 2> /tmp/wrangler_kv_list.err
# se o comando falhar: imprime stderr e encerra
# se stdout não for JSON array válido: imprime stderr + preview do stdout e encerra
# check_kv() usa jq --arg id em /tmp/kv_namespaces.json sem imprimir o secret
```

**Output esperado no workflow:**
```
KV CHECK:
  ENAVIA_BRAIN_KV_ID: OK  (binding: ENAVIA_BRAIN)
  ENAVIA_BRAIN_TEST_KV_ID: OK  (binding: ENAVIA_BRAIN_TEST)
  ...
```

Se o problema for parse/JSON, a etapa agora falha com mensagem explícita de JSON inválido em vez de marcar todos os bindings como `INVALID`.

**Arquivo alterado:**
- `.github/workflows/deploy-executor.yml` — somente ajuste cirúrgico na etapa `Validate KV namespace IDs against Cloudflare`

**Não tocado:**
- `nv-enavia.js` — intacto
- `executor/src/index.js` — intacto
- `panel/` — intacto
- `wrangler.toml` / `wrangler.executor.template.toml` — intactos
- KV / bindings / secrets — intactos

**Evidência:**
- `node --check executor/src/index.js` → OK ✅
- `node executor/tests/executor.contract.test.js` → **33 passed, 0 failed** ✅
- Validação YAML → **YAML válido** ✅

## Próxima ação segura

1. Rodar workflow `Deploy enavia-executor` com `target_env=test`.
2. Observar a etapa `Validate KV namespace IDs against Cloudflare`.
3. Se o Wrangler devolver JSON válido, apenas o(s) binding(s) realmente incorreto(s) deve(m) aparecer como `INVALID`.
4. Se o Wrangler não devolver JSON válido, usar o stderr mostrado pelo workflow para corrigir autenticação/configuração antes de reexecutar.

## Bloqueios

- nenhum

---

## Histórico anterior: FIX — Validação falso-positivo no deploy-executor (comentários)

### FIX cirúrgico — `deploy-executor.yml` validação de comentários

**Problema:** Passo "Validate generated config (no placeholders remaining)" usava:
```bash
grep -q "REPLACE_WITH_REAL_" wrangler.executor.generated.toml
```
Esse grep capturava o texto `REPLACE_WITH_REAL_*` em **linhas de comentário** do arquivo gerado, mesmo com todos os IDs já substituídos. Falso positivo.

**Correção aplicada (patch cirúrgico):**
```bash
if grep -v '^[[:space:]]*#' wrangler.executor.generated.toml | grep -q "REPLACE_WITH_REAL_"; then
```
Filtra linhas comentadas antes de buscar placeholders.

**Arquivo alterado:**
- `.github/workflows/deploy-executor.yml` — somente o passo de validação

**Não tocado:**
- `nv-enavia.js` — intacto
- `executor/` — intacto
- `panel/` — intacto
- `wrangler.toml` / `wrangler.executor.template.toml` — intactos
- KV / bindings / secrets — intactos

**Evidência:**
- Grep antigo → "FALSO POSITIVO detectado" ✅ (confirma o bug)
- Grep novo → "OK: nenhum placeholder fora de comentários" ✅ (confirma a correção)
- Validação YAML → **YAML válido** ✅

---



**Diagnóstico confirmado:**
- O workflow `deploy.yml` / `wrangler.toml` publica apenas `nv-enavia`. O Executor (`enavia-executor`) não era deployado a partir deste repo.
- `executor/wrangler.toml` existia só como referência (com placeholders `REPLACE_WITH_REAL_ID` e aviso "não faça deploy daqui").
- `executor/src/index.js` importa `acorn` — necessário `package.json` com a dependência para o wrangler/esbuild resolver.

**Arquivos criados (infra-only):**

1. `wrangler.executor.toml` (raiz do repo)
   - `main = "executor/src/index.js"`
   - PROD: `name = "enavia-executor"`, PROD vars
   - TEST via `[env.test]`: `name = "enavia-executor-test"`, TEST vars
   - KV namespaces: ENAVIA_BRAIN, ENAVIA_GIT, GIT_KV com placeholders — devem ser preenchidos antes do deploy real

2. `executor/package.json`
   - Declara `acorn ^8.16.0` como dependência
   - O workflow faz `npm install --prefix executor` antes do deploy

3. `.github/workflows/deploy-executor.yml`
   - Trigger: `workflow_dispatch` com input `target_env: test | prod`
   - Valida secrets, verifica placeholders no `wrangler.executor.toml`, roda `node --check`, roda contrato tests
   - TEST: `wrangler deploy --config wrangler.executor.toml --env test`
   - PROD: `wrangler deploy --config wrangler.executor.toml`
   - Smoke TEST embutido: `POST /audit` valida `result.verdict` e `audit.verdict`

**Não tocado:**
- `nv-enavia.js` — intacto
- `wrangler.toml` — intacto
- `executor/src/index.js` / `executor/src/audit-response.js` — intactos
- `executor/wrangler.toml` (referência) — intacto
- `panel/` — intacto
- `contract-executor.js` — intacto
- KV / bindings / secrets — intactos

**Testes executados:**
- `node --check executor/src/index.js` → OK ✅
- `node executor/tests/executor.contract.test.js` → **33 passed, 0 failed** ✅
- Validação YAML: `python3 yaml.safe_load(...)` → **YAML válido** ✅

## Próxima ação segura

1. Preencher IDs reais de KV no `wrangler.executor.toml` (obter via Cloudflare Dashboard ou `wrangler kv:namespace list`).
2. Rodar workflow `Deploy enavia-executor` → `target_env=test`.
3. Verificar smoke: `POST https://enavia-executor-test.brunovasque.workers.dev/audit` → `result.verdict` + `audit.verdict` presentes.
4. Se TEST OK, rodar `target_env=prod` para publicar `enavia-executor`.

## Bloqueios

- KV namespace IDs reais não commitados (por segurança). Deploy real requer preenchimento manual no `wrangler.executor.toml` ou injeção via Cloudflare Dashboard.

---

## Histórico anterior: PR15 — EXECUTOR-ONLY: `/audit` agora emite `verdict` e `risk_level`

**Diagnóstico:**
- Smoke real em TEST mostrou que `POST /contracts/execute-next` no `nv-enavia` chamava o binding `EXECUTOR`, o `/audit` respondia HTTP 200 com JSON válido, e mesmo assim o Worker bloqueava com:
  `Audit sem verdict explícito. Resposta ambígua bloqueada por segurança.`
- Causa: `nv-enavia.js` em `callExecutorBridge` (linha 5179) lê `data?.result?.verdict || data?.audit?.verdict`. O Executor nunca emitia esses campos no envelope `/audit`.

**Patch cirúrgico em `executor/src/index.js` (handler `POST /audit`, único return final):**
- Regra endurecida: `verdict:"approve"` só ocorre com sucesso explícito (`execResult.ok === true` e `execResult.error !== true`).
- Em qualquer outro caso (`ok:false`, `ok` ausente, `error:true`, resultado vazio/estrutural), o `verdict` vira `"reject"`.
- `execResult.verdict` só é preservado quando já for exatamente `"approve"` (com sucesso explícito) ou `"reject"`; qualquer valor inválido (`"passed"`, etc.) é ignorado e recalculado de forma conservadora.
- `risk_level` foi extraído para helper com fallback seguro `"low"` e só preserva valores string válidos.
- O restante do envelope (`system`, `executor`, `route`, `received_action`, `evidence`, `pipeline`, `result.map` quando há `canonicalMap`) continua preservado.

**Novo helper puro do Executor:**
- `executor/src/audit-response.js`
  - `normalizeAuditVerdict(execResult)`
  - `normalizeAuditRiskLevel(execResult, riskReport)`
- Objetivo: isolar a regra do contrato `/audit` e permitir teste focado sem tocar no Worker nem no runtime do Worker.

**Documentação:**
- `executor/CONTRACT.md` — exemplo do `Response 200` de `/audit` atualizado com `result.verdict`, `result.risk_level` e bloco `audit`. Nota PR15 explicando o mapeamento.

**Não tocado (escopo travado):**
- `nv-enavia.js` (Worker) — intacto.
- `panel/` — intacto.
- `contract-executor.js` / Deploy Worker — intactos.
- KV / wrangler / bindings — intactos.

**Smoke tests:**
- `node executor/tests/executor.contract.test.js` → 33/33 ✅
- `node --check executor/src/index.js` → OK
- `node --check executor/src/audit-response.js` → OK
- `node --check executor/tests/executor.contract.test.js` → OK
- Casos obrigatórios cobertos no teste:
  - `ok:true` → `approve`
  - `ok:false` → `reject`
  - `{}` → `reject`
  - `{ error:true }` → `reject`
  - `verdict:"approve"` com `ok:true` → preserva
  - `verdict:"reject"` → preserva
  - `verdict:"passed"` → não preserva

## Próxima ação segura
- Deploy do Executor em TEST (`enavia-executor-test`) e re-rodar o smoke real:
  `POST /contracts → GET /contracts/loop-status → POST /contracts/execute-next`. Esperado: `executor_status: "passed"` ao invés de `"ambiguous"`.
- Se passar em TEST, considerar promoção do Executor para PROD em PR separada.

## O que foi feito nesta sessão

### PR14 — ajuste P1 na PR #162

**Patch cirúrgico em `nv-enavia.js`:**

1. `callExecutorBridge(env, route, payload)`:
   - Se `JSON.parse(rawText)` falha, retorna imediatamente:
     - `ok: false`
     - `status: "ambiguous"`
     - `reason: "Resposta do Executor não é JSON válido."`
     - `data: { raw: rawText.slice(0, 500) }`
   - Não segue para o fluxo normal e não pode retornar `passed` com body ilegível.

2. `callDeployBridge(env, action, payload)`:
   - Se `JSON.parse(rawText)` falha, retorna imediatamente:
     - `ok: false`
     - `status: "ambiguous"`
     - `reason: "Resposta do Deploy Worker não é JSON válido."`
     - `data: { raw: rawText.slice(0, 500) }`
   - Não segue para o fluxo normal e não pode retornar `passed` com body ilegível.

**Smoke tests ampliados em `tests/pr14-executor-deploy-real-loop.smoke.test.js`:**

- Executor `/propose` com HTTP 200 + body não-JSON → `status: "blocked"` no endpoint, `executor_status: "ambiguous"`, deploy não chamado e handler interno não executado.
- Deploy Worker com HTTP 200 + body não-JSON → `status: "blocked"` no endpoint, `deploy_status: "ambiguous"` e handler interno não executado.
- `makeKV()` agora registra `writes` para provar que o handler interno não roda nesses cenários.

**Resultados smoke tests desta sessão:**

- `node tests/pr14-executor-deploy-real-loop.smoke.test.js` → **111 passed, 0 failed** ✅
- `node tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed** ✅

**Contexto anterior preservado da PR14:**

1. `callExecutorBridge(env, route, payload)`:
   - Chama `env.EXECUTOR.fetch("https://enavia-executor.internal" + route, ...)`
   - Rotas suportadas: `/audit`, `/propose`
   - Gates: EXECUTOR ausente → blocked; HTTP não-ok → failed; JSON inválido → ambiguous; `ok:false` → blocked; `/audit` sem `verdict` → ambiguous; `verdict:reject` → blocked
   - Retorna `{ ok, route, status: "passed"|"blocked"|"failed"|"ambiguous", reason, data }`

2. `callDeployBridge(env, action, payload)`:
   - Chama `env.DEPLOY_WORKER.fetch("https://deploy-worker.internal/apply-test", ...)` somente em modo seguro
   - Força `target_env:"test"`, `deploy_action:"simulate"` no payload
   - Guards: ações prod (approve/promote/rollback/prod) → blocked imediato; `target_env:prod` → blocked; DEPLOY_WORKER ausente → `deploy_status:"blocked"`
   - Retorna `{ ok, action, status, reason, data }`

**`buildExecutorPathInfo` atualizado:**
- `execute_next`: `uses_service_binding:true`, `handler: "callExecutorBridge(/audit) → callExecutorBridge(/propose) → callDeployBridge(simulate) → handleExecuteContract"`, `deploy_binding_available` adicionado
- `approve`: `uses_service_binding:true`, `handler: "callExecutorBridge(/audit) → handleCloseFinalContract"`
- blocked: `deploy_binding_available` adicionado, `uses_service_binding:false`

**`handleExecuteNext` integrado:**
- `execute_next` (após gates existentes):
  1. `callExecutorBridge(env, "/audit", auditPayload)` — bloqueia se não passar
  2. `callExecutorBridge(env, "/propose", proposePayload)` — bloqueia se não passar
  3. `callDeployBridge(env, "simulate", deployPayload)` — bloqueia se não passar
  4. Delega a `handleExecuteContract` (handler interno KV) — somente depois de todos os bridges passarem
- `approve` (após gates confirm+approved_by):
  1. `callExecutorBridge(env, "/audit", auditPayloadApprove)` — bloqueia se não passar
  2. Delega a `handleCloseFinalContract` — somente depois do audit passar
  - Sem `/propose`, sem deploy para approve

**Response estendida com 9 campos novos** (presentes em todos os paths):
- `executor_audit`, `executor_propose`, `executor_status`, `executor_route`, `executor_block_reason`
- `deploy_result`, `deploy_status`, `deploy_route`, `deploy_block_reason`

**Arquivos alterados:**
- `nv-enavia.js` — helpers + integração em `handleExecuteNext`
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` — criado (93 testes)
- `tests/pr13-hardening-operacional.smoke.test.js` — 3 asserts atualizados para refletir mudança intencional de PR14
- Governança: status, handoff, execution log

**Arquivos NÃO alterados (por escopo):**
- `contract-executor.js` — sem alteração
- `executor/` — sem alteração
- `panel/` — sem alteração
- `wrangler.toml` — sem alteração (bindings EXECUTOR e DEPLOY_WORKER já existiam)

**Resultados smoke tests anteriores da PR14:**
- `tests/pr14-executor-deploy-real-loop.smoke.test.js` → **93 passed, 0 failed ✅** (antes do ajuste P1)
- `tests/pr13-hardening-operacional.smoke.test.js` → **91 passed, 0 failed ✅**

## Próxima ação segura

- Aguardar revisão/aprovação da PR #162 após o ajuste P1.

## Bloqueios

- nenhum
