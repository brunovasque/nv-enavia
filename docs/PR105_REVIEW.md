# PR105 — Review Canônico
**Data:** 2026-05-04  
**Branch:** `copilot/pr105-github-bridge-real-unificado`  
**Contrato:** `docs/CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR105.md`  
**PR GitHub:** #271  
**Reviewer:** Claude Sonnet 4.6 (leitura direta do código real)

---

## 1. ARQUIVOS ALTERADOS

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `schema/enavia-github-adapter.js` (novo, 509 linhas) | Adapter HTTP real. Exporta `executeGithubOperation` (fetch bruto ao GitHub API, com bloqueios duros em ALWAYS_BLOCKED) e `executeGithubBridgeRequest` (pipeline de 5 etapas: validateGithubOperation → evaluateSafetyGuard → Event Log tentativa → executeGithubOperation → Event Log resultado). CJS (`module.exports`). Suporta `comment_pr` e `create_branch`. |
| 2 | `tests/pr105-cjs-esm-interop.test.js` (novo, 302 linhas) | Valida que todos os módulos CJS (bridge, adapter, safety-guard, event-log) carregam corretamente via `require()`, simulando o interop ESM do wrangler/esbuild. 32 testes em 5 grupos. |
| 3 | `nv-enavia.js` (modificado) | Adiciona import do adapter com fallback seguro (linhas 59–63), função `handleGithubBridgeExecute` (linhas 7227–7311) e rota `POST /github-bridge/execute` (linha 9254). Token lido de `env.GITHUB_TOKEN`. |
| 4 | `wrangler.toml` (modificado) | Adiciona bloco de comentários explicando que `GITHUB_TOKEN` é um secret Cloudflare, com instrução `wrangler secret put GITHUB_TOKEN`. O bloco `[secrets]` está **comentado** — não há declaração ativa. |
| 5 | `tests/pr105-github-bridge-prova-real.prova.test.js` (novo, 324 linhas) | Prova real supervisionada. Grupos 1–3 executam sem token (16 testes). Grupo 4 (prova real `comment_pr`) é OPT-IN: executado apenas se `GITHUB_TOKEN` estiver no env — caso contrário, é **pulado**. |
| 6 | `tests/pr102-github-bridge-real-diagnostico.prova.test.js` (modificado) | Assertiva 33 (`não chamou GitHub real`) atualizada: removeu `GITHUB_TOKEN` do regex de detecção, pois PR105 adicionou referência de env var em `nv-enavia.js`. A verificação de chamadas HTTP reais (`api.github.com`, `octokit`) permanece. |
| 7 | `tests/pr103-github-bridge-helper-supervisionado.prova.test.js` (modificado) | Duas assertivas da seção L ("Arquivos não alterados") atualizadas: a verificação de que `nv-enavia.js` não contém `github-bridge` foi substituída por uma verificação mais útil (invariante PR101: sem import direto de safety-guard ou event-log). A verificação de `contract-executor.js` atualizada para reconhecer extensão legítima da PR104. |
| 8 | `schema/status/ENAVIA_STATUS_ATUAL.md` | Status atualizado: PR105 ✅ concluída, contrato encerrado. |
| 9 | `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Handoff para PR106: Commit + Branch + PR real supervisionados. |
| 10 | `schema/execution/ENAVIA_EXECUTION_LOG.md` | Log de execução com os 5 commits atômicos, resultados de testes e invariantes. |
| 11 | `schema/contracts/INDEX.md` | PR105 marcada ✅, contrato PR102–PR105 encerrado. |

---

## 2. CRITÉRIOS DO CONTRATO

### 2.1 `schema/enavia-github-adapter.js` existe e exporta `executeGithubOperation`

**STATUS: ✅ ATENDIDO**

Evidência de código:
- Arquivo existe em `schema/enavia-github-adapter.js` (509 linhas)
- Linha 505: `executeGithubOperation,` no `module.exports`
- A função existe (linhas 294–340), faz `fetch('https://api.github.com/...')` em `_executeCommentPr` e `_executeCreateBranch`

---

### 2.2 `POST /github-bridge/execute` existe em `nv-enavia.js`

**STATUS: ✅ ATENDIDO**

Evidência:
- `nv-enavia.js` linha 9254: `if (method === "POST" && path === "/github-bridge/execute")`
- Handler `handleGithubBridgeExecute` definido nas linhas 7227–7311
- Handler recebe `(request, env)` e extrai `env.GITHUB_TOKEN`

---

### 2.3 Safety Guard é chamado antes de todo `executeGithubOperation`

**STATUS: ✅ ATENDIDO** *(com ressalva estrutural)*

Evidência:
- `executeGithubBridgeRequest` (linha 373): `evaluateSafetyGuard(safetyAction, {})` na etapa 2
- `executeGithubOperation` só é chamada na etapa 5 (linha 442): `await executeGithubOperation(safeOp, token)`
- O endpoint `nv-enavia.js` sempre chama `_executeGithubBridgeRequest` (nunca `executeGithubOperation` diretamente)

Ressalva: `executeGithubOperation` é exportada isoladamente via `module.exports`, sem Safety Guard embutido. Um chamador direto dessa função não passaria pelo Safety Guard. O endpoint atual não faz isso — mas a superfície de risco existe.

---

### 2.4 Event Log registra tentativa e resultado em toda operação

**STATUS: ⚠️ PARCIALMENTE ATENDIDO**

Evidência:
- **Tentativa sempre registrada**: `attemptEvent` criado em `executeGithubBridgeRequest` linha 391, independente de bloqueio
- **Resultado registrado para execução real**: `resultEvent` criado na linha 455 para operações não bloqueadas
- **Resultado NÃO registrado para operações bloqueadas**: linha 434: `result_event: null`

O contrato diz: "Event Log sempre registra tentativa + resultado". Para operações bloqueadas, o resultado (bloqueio) é capturado no próprio `attempt_event` (campo `status: 'blocked'`), mas `result_event` é literalmente `null`. Dependendo da interpretação, isso é "resultado registrado implicitamente na tentativa" ou "resultado não registrado". O código está internamente consistente, mas não é o que a letra do contrato diz.

---

### 2.5 `GITHUB_TOKEN` está em `wrangler.toml` como secret (não hardcoded)

**STATUS: ⚠️ ATENDIDO PARCIALMENTE (comentário, não declaração ativa)**

Evidência no `wrangler.toml` (linhas 27–33):
```toml
# PR105 — GitHub Bridge Real
# GITHUB_TOKEN é um secret Cloudflare (não vai em [vars] — nunca em texto claro).
# Configurar com escopo mínimo (repo: leitura/escrita de PRs e branches):
#   wrangler secret put GITHUB_TOKEN
# [secrets]
# GITHUB_TOKEN
```

O contrato diz: "GITHUB_TOKEN adicionado como secret no wrangler.toml (binding de env var)".

O que existe é um **comentário documentando** a configuração, não uma declaração ativa. Para wrangler v3, a declaração correta seria:
```toml
secrets = ["GITHUB_TOKEN"]
```
Essa linha está comentada (`# GITHUB_TOKEN`), não ativa. A instrução de configuração está correta e o token NÃO está em `[vars]` (não hardcoded), mas o binding declarativo está ausente.

O token nunca aparece em código (`nv-enavia.js` usa `env.GITHUB_TOKEN` como referência de env var, não como valor literal). ✅

---

### 2.6 Interop CJS/ESM validado e documentado

**STATUS: ✅ ATENDIDO**

Evidência:
- `tests/pr105-cjs-esm-interop.test.js` existe, 32/32 passando
- Grupo 1 (bridge), Grupo 2 (adapter), Grupo 3 (safety-guard), Grupo 4 (event-log), Grupo 5 (cadeia de dependências)
- Testa `require()` direto (equivale ao que esbuild/wrangler faz com CJS interop)

---

### 2.7 Teste de prova real passa com operação `comment_pr` real executada

**STATUS: ❌ NÃO ATENDIDO — BLOQUEADOR**

Evidência de código (`pr105-github-bridge-prova-real.prova.test.js`, linhas 224–229):
```js
async function runGroup4() {
  if (!GITHUB_TOKEN) {
    console.log('\n[4] Prova real com GITHUB_TOKEN — PULADO (GITHUB_TOKEN não configurado)');
    return;  // ← Grupo 4 retorna sem executar nenhum teste
  }
  ...
```

O Grupo 4 (`comment_pr real`) é **sempre pulado** quando `GITHUB_TOKEN` não está no env. O teste reporta `16/16 ✅` mas os únicos 16 testes que rodam são dos Grupos 1–3 (bloqueios sem fetch, Safety Guard/Event Log sem execução real, invariantes do adapter). Nenhuma chamada HTTP real ao GitHub foi feita.

O contrato exige (seção 2.5):
> "Executa comment_pr real em PR de teste controlada do repo brunovasque/nv-enavia"
> "Verifica: Safety Guard ativo, Event Log gerado, github_execution: true, evidência retornada"

E o critério 5:
> "Teste de prova real passa com operação comment_pr real executada"

**Nenhuma chamada real ao GitHub foi executada durante o desenvolvimento desta PR.**

**AGRAVANTE:** Mesmo que o `GITHUB_TOKEN` seja fornecido agora e o Grupo 4 seja executado, há um bug no teste:

```js
// test 4.3 — linha 272:
assert.ok(result.safety !== undefined, 'campo safety deve estar presente (Safety Guard executado)');
```

O `executeGithubBridgeRequest` retorna `safety_decision` (não `safety`). O campo `safety` não existe na resposta. `result.safety` seria `undefined`, portanto `result.safety !== undefined` seria `false` — **o teste 4.3 falharia** com um token real.

---

### 2.8 Bloqueio de `merge` e `deploy_prod` provado em teste

**STATUS: ✅ ATENDIDO**

Evidência:
- `1.1`: `executeGithubOperation({ type: 'merge' }, 'fake-token')` → `blocked: true`, sem fetch
- `1.2`: `executeGithubOperation({ type: 'deploy_prod' }, 'fake-token')` → `blocked: true`
- `2.1`: `executeGithubBridgeRequest({ type: 'merge' })` → `result_event: null`, `attempt_event.status: 'blocked'`
- Timing: bloqueio em < 500ms (verificado em 3.5)

---

### 2.9 Nenhum teste anterior (PR99–PR104) quebrado

**STATUS: ⚠️ ATENDIDO COM RESSALVA**

Evidência:
- PR99, PR100, PR101, PR104: passando ✅ sem alteração
- PR103: 70/70 ✅ — mas **2 assertivas foram alteradas** nos arquivos de teste:
  - Seção L, assertiva 57: `!nvContent.includes('github-bridge')` → removida, substituída por verificação do invariante PR101 (mais útil e mais correta)
  - Seção L, assertiva 59: `!contractExecContent.includes('enavia-github-bridge')` → removida, era pré-existentemente falsa desde PR104
- PR102: todos ✅ — mas **1 assertiva alterada**:
  - Assertiva 33: regex removeu `GITHUB_TOKEN` da verificação de "chamada GitHub real" (correto — `GITHUB_TOKEN` em env var não é chamada HTTP)

Todas as alterações em testes anteriores são defensáveis e corretas. Nenhuma funcionalidade de PR anterior foi removida ou quebrada. Mas **o contrato não prevê alteração de testes históricos** — o escopo de commits 1–5 não menciona modificação de PR102/PR103.

---

### 2.10 PR revisada e aprovada por Bruno antes do merge

**STATUS: ⏳ PENDENTE**

PR #271 está aberta. Aprovação humana não registrada.

---

## 3. INVARIANTES

| Invariante | Status | Evidência |
|------------|--------|-----------|
| `merge_allowed = false` | ✅ RESPEITADO | `ALWAYS_BLOCKED = ['merge', ...]` (linha 31). Checked em `executeGithubOperation` linha 299 e em `validateGithubOperation` via bridge |
| `deploy_prod_allowed = false` | ✅ RESPEITADO | `ALWAYS_BLOCKED = [..., 'deploy_prod', ...]` (linha 31) |
| `secret_change_allowed = false` | ✅ RESPEITADO | `ALWAYS_BLOCKED = [..., 'secret_change']` (linha 31) |
| `GITHUB_TOKEN nunca exposto em response` | ✅ RESPEITADO | Token nunca aparece em nenhum objeto de retorno. Verificado no código de `_executeCommentPr`, `_executeCreateBranch`, `executeGithubBridgeRequest`. Teste 2.4 verifica: `JSON.stringify(result)` não contém o token. |
| `GITHUB_TOKEN nunca logado em Event Log` | ✅ RESPEITADO | `createEnaviaEvent` chamado com `evidence` que contém `operation_type`, `repo`, `executed`, `response_status` — nunca o token. Comentário explícito na linha 474: `// token nunca incluído aqui` |
| `Safety Guard sempre antes de executeGithubOperation` | ✅ RESPEITADO | No path do endpoint: `_executeGithubBridgeRequest` → step 2 `evaluateSafetyGuard` → step 5 `executeGithubOperation`. Nenhuma chamada direta de `executeGithubOperation` no endpoint. |
| `Event Log sempre registra tentativa + resultado` | ⚠️ PARCIAL | Tentativa: sempre registrada. Resultado: registrado para execuções reais, `null` para bloqueios. |
| `Operação sem token = erro, não execução silenciosa` | ✅ RESPEITADO | `executeGithubOperation` linha 313: `if (!token \|\| typeof token !== 'string' \|\| !token.trim())` → retorna `{ ok: false, error: 'GITHUB_TOKEN ausente ou inválido — operação não executada' }`. `handleGithubBridgeExecute` linha 7279: verifica token antes de chamar o adapter. |

---

## 4. COMMITS ATÔMICOS

O contrato (seção 7) define 5 commits com escopo e regra de sequência:
> "Regra: commit 3 só pode existir após commit 1 e 2 validados. Commit 5 só pode existir após commit 4."

| # | Hash | Mensagem | Escopo contrato | Escopo real | Sequência |
|---|------|----------|-----------------|-------------|-----------|
| 1 | e8351ff | feat(pr105): adapter HTTP real GitHub | `schema/enavia-github-adapter.js` | Apenas o arquivo do adapter | ✅ |
| 2 | cbae6f2 | feat(pr105): validar interop CJS/ESM bundle wrangler | `schema/enavia-github-bridge.js` + doc | `tests/pr105-cjs-esm-interop.test.js` (escopo ligeiramente diferente, mas correto) | ✅ |
| 3 | f893c99 | feat(pr105): endpoint /github-bridge/execute com Safety Guard + Event Log | `nv-enavia.js` | `nv-enavia.js` + `tests/pr102-*` + `tests/pr103-*` | ⚠️ Escopo extrapolado |
| 4 | 4abac53 | feat(pr105): GITHUB_TOKEN secret binding | `wrangler.toml` | Apenas `wrangler.toml` | ✅ |
| 5 | a08e599 | test(pr105): prova real comment_pr + bloqueios | `tests/pr105-github-bridge-prova-real.prova.test.js` | Apenas o arquivo de teste | ✅ |

Commit 3 tocou dois arquivos de teste históricos (`pr102-*`, `pr103-*`) além do `nv-enavia.js`. As modificações eram necessárias para não quebrar testes anteriores, mas não estão no escopo declarado do commit.

A sequência 1→2→3→4→5 foi respeitada. ✅

---

## 5. O QUE ESTÁ FALTANDO — IMPEDE O MERGE

### 5.1 BUG NO TESTE 4.3 — campo `safety` vs `safety_decision`

**Arquivo:** `tests/pr105-github-bridge-prova-real.prova.test.js`, linha 272

**Código atual:**
```js
assert.ok(result.safety !== undefined, 'campo safety deve estar presente (Safety Guard executado)');
```

**Problema:** `executeGithubBridgeRequest` retorna o campo `safety_decision`, não `safety`. `result.safety` é sempre `undefined`. Se o Grupo 4 for executado com um token real, o teste 4.3 **falha**.

**Correção necessária:**
```js
assert.ok(result.safety_decision !== undefined, 'campo safety_decision deve estar presente (Safety Guard executado)');
```

---

### 5.2 PROVA REAL NÃO EXECUTADA — comment_pr com GitHub API

**Critério do contrato (seção 5):**
> "Teste de prova real passa com operação comment_pr real executada"

**Realidade:** O Grupo 4 do teste é pulado sempre que `GITHUB_TOKEN` não está no env. Os 16/16 testes que passam são todos de Grupos 1–3 (mock/local, sem fetch real). Nenhuma chamada HTTP ao GitHub foi feita.

**O que é necessário:**
1. Corrigir o bug do teste 4.3 (item 5.1 acima)
2. Configurar `GITHUB_TOKEN` com escopo `repo`
3. Executar `GITHUB_TOKEN=ghp_... node tests/pr105-github-bridge-prova-real.prova.test.js`
4. Confirmar que Grupo 4 (5 testes) passa: `github_execution: true`, `attempt_event`, `result_event`, evidência real, token não exposto

---

### 5.3 MENOR — wrangler.toml sem declaração ativa de secret

**Arquivo:** `wrangler.toml`, linhas 27–33

O bloco `[secrets]` está comentado. A declaração ativa seria:
```toml
secrets = ["GITHUB_TOKEN"]
```

Isso é documentação, não código de runtime — não impede o funcionamento. Mas para wrangler v3, a declaração ativa melhora a experiência de `wrangler dev` e CI. Este item é menor e não bloqueia o merge isoladamente.

---

### 5.4 MENOR — Grupo 4 executa múltiplos comment_pr reais (4 chamadas)

Os testes 4.1, 4.2, 4.3, 4.4 cada um cria um comentário real (operação separada). No total, 4 comentários serão criados na PR #270. Isso deixa "lixo" no repo (4 comentários de teste). O contrato menciona "Usar PR de teste dedicada e controlada — limpar após prova". Este comportamento está previsto, mas vale registrar para limpeza pós-prova.

---

## 6. VEREDITO

```
BLOQUEADO — 2 problemas concretos impedem o merge:

BLOQUEADOR 1 (código): Bug em test 4.3
  Arquivo: tests/pr105-github-bridge-prova-real.prova.test.js, linha 272
  Problema: assert.ok(result.safety !== undefined) mas o campo é safety_decision
  Impacto: test 4.3 falharia ao executar Grupo 4 com token real
  Correção: 1 linha — mudar 'safety' para 'safety_decision'

BLOQUEADOR 2 (critério de conclusão): Prova real não executada
  Critério contrato seção 5: "Teste de prova real passa com operação comment_pr real executada"
  Realidade: Grupo 4 sempre pulado sem GITHUB_TOKEN. 0 chamadas reais ao GitHub executadas.
  Para desbloquear: corrigir 5.1 + configurar GITHUB_TOKEN + rodar o teste + confirmar 21/21 ✅

O CÓDIGO ESTÁ CORRETO. O adapter, o endpoint, o Safety Guard, o Event Log, os bloqueios
duros — tudo implementado corretamente conforme o contrato. A implementação está pronta
para produção assim que a prova real for executada.

APROVADO PARA MERGE após:
  1. Corrigir linha 272 do pr105-github-bridge-prova-real.prova.test.js
  2. Executar com GITHUB_TOKEN real e confirmar Grupo 4 passando (5 testes adicionais)
  3. Commit do fix + evidência de output do teste com token real
```
