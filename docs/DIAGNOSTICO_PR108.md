# DIAGNÓSTICO PR108 — Self-patch supervisionado

**Data:** 2026-05-05  
**Revisor:** Claude Code (leitura de código real)  
**Arquivos lidos:**
- `executor/src/index.js` (7827 linhas)
- `schema/enavia-github-adapter.js` (799 linhas)

---

## 1. O que `/propose` faz hoje

### Entrada real (nv-enavia.js:6187–6199)
O Worker envia:
```json
{
  "source": "nv-enavia",
  "mode": "contract_execute_next",
  "executor_action": "propose",
  "patch": { "type": "contract_action", "content": "<JSON de nextAction>" },
  "prompt": "Proposta supervisionada para ação contratual: <operationalAction.type>",
  "intent": "propose",
  "contract_id": "...",
  "nextAction": { ... },
  "operationalAction": { ... },
  "execution_id": "...",
  "evidence": [...],
  "approved_by": null,
  "audit_id": "...",
  "timestamp": "...",
  "github_token_available": true | false
}
```

### Processamento real (executor/src/index.js:1051–1410)

1. **Se `require_live_read=true`** (não está ativo no payload padrão do Worker): lê snapshot via `fetchCurrentWorkerSnapshot`, gera mapa canônico (rotas, env_keys, invariantes).
2. **Detecção do pipeline:** como `prompt` é uma string não-vazia, o Executor força `mode="engineer"`, `askSuggestions=true`, `generatePatch=true` (linha 1316–1321).
3. Chama `enaviaExecutorCore(env, action)`.
4. Dentro do core em modo `engineer`: executa heurísticas baseadas no snapshot (se disponível) para gerar patches de baixo risco pré-definidos (adicionar `/__internal__/routes`, helper de log `__nvLog`, extrair `execution_id`). São patches hardcoded, não gerados por IA.
5. **Se `use_codex=true` E `OPENAI_API_KEY` configurada** (nenhum dos dois está ativo no payload padrão): chama `callCodexEngine`.
6. Salva estado no KV via `updateFlowStateKV`.

### Saída real
```json
{
  "system": "enavia-executor",
  "executor": "core_v2",
  "route": "/propose",
  "result": {
    "ok": true,
    "mode": "engineer",
    "patch": {
      "mode": "patch_text",
      "patchText": [
        {
          "target": "cloudflare_worker",
          "workerId": "...",
          "title": "string",
          "anchor": { "match": "string" },
          "search": "linha exata para substituir",
          "replace": "novo conteúdo",
          "reason": "string"
        }
      ]
    },
    "staging": { "ready": true | false, "notes": "..." },
    "riskReport": { "level": "low" | "medium", "notes": [...] },
    "suggestions": [...]
  },
  "pipeline": { "execution_id": "...", "stage": "propose", "staging": { "ready": bool } }
}
```

**Problema real:** O `patch.patchText[].patch_text` é um texto livre descrevendo mudanças — não é código aplicável diretamente. O formato `{search, replace}` existe apenas nos patches hardcoded do modo engineer; patches do Codex vêm como `patch_text` string não estruturada.

---

## 2. O que `/audit` faz hoje

### Entrada real (nv-enavia.js:6158–6168)
O Worker envia:
```json
{
  "source": "nv-enavia",
  "mode": "contract_execute_next",
  "executor_action": "audit",
  "context": { "require_live_read": true },
  "contract_id": "...",
  "nextAction": { ... },
  "operationalAction": { ... },
  "execution_id": "...",
  "evidence": [...],
  "approved_by": null,
  "audit_id": "...",
  "timestamp": "...",
  "github_token_available": true | false
}
```

### Processamento real (executor/src/index.js:585–1046)

1. **Detecção `require_live_read=true`**: resolve `target.workerId` → scriptName, chama `fetchCurrentWorkerSnapshot` (CF API), gera mapa canônico.
2. Chama `enaviaExecutorCore` com `highLevelAction = "audit"` → chama `runAuditMode`.
3. **`runAuditMode`** (linha 4035):
   - Lê código do **próprio Executor** do KV (`git:code:latest` ou `git:code:<id>`) — não lê o Worker via CF API dentro do runAuditMode; o Worker é lido no step 1 acima.
   - Gera `findings[]` e `suggestions[]` (diagnóstico textual).
   - Se `generatePatch=true`: tenta gerar patches hardcoded (mesmo mecanismo do engineer mode).
   - Retorna resultado de diagnóstico, sem código pronto para commit.
4. Normaliza `verdict` e `risk_level` via `normalizeAuditVerdict`/`normalizeAuditRiskLevel`.
5. Salva estado no KV.

### Saída real
```json
{
  "system": "enavia-executor",
  "executor": "core_v2",
  "route": "/audit",
  "result": {
    "verdict": "approved" | "requires_review" | "blocked",
    "risk_level": "low" | "medium" | "high",
    "map": { "routes_count": N, "env_keys_count": N, ... }
  },
  "audit": { "verdict": "...", "risk_level": "..." },
  "evidence": {
    "target": { "system": "cloudflare_worker", "workerId": "..." },
    "snapshot": { "snapshot_fingerprint": "fnv1a32:...", "snapshot_chars": N, ... },
    "anchors": [...],
    "invariants": [...],
    "steps": [...]
  },
  "pipeline": { ... }
}
```

**O Worker (`callExecutorBridge`) aceita o resultado se `data.result.verdict` ou `data.audit.verdict` for presente e `ok !== false`.**

---

## 3. O que `/worker-patch-safe` faz

### Modo `stage` (executor/src/index.js:2379–2476)

**Entrada:** `{ mode: "stage", workerId, current: "<código atual>", candidate: "<código candidato>" }`

**Processamento:**
1. Chama internamente `POST /module-validate` com `{ content: candidate, expectModule: false }`.
2. Se validação falhar: retorna erro com `riskLevel`, `syntaxError`, `protectedHits` — NÃO grava no KV.
3. Se validação passar:
   - Grava backup: `ENAVIA_GIT.put("WORKER_BACKUP:${workerId}:${ts}", current)`
   - Grava candidato: `ENAVIA_GIT.put("WORKER_CANDIDATE:${workerId}:${ts}", candidate)`
   - Retorna `{ ok: true, stage: "staged", backupKey, candidateKey, riskLevel, requiresApproval }`

**Quem consome:** O Deploy Worker pode buscar `WORKER_CANDIDATE:*` do KV para fazer o deploy real.

### Modo `rollback-preview`
Lê `env.ENAVIA_GIT.get(backupKey)` e retorna o conteúdo. Não executa rollback — apenas preview.

---

## 4. `callCodexEngine` — como gera o patch

### Localização: executor/src/index.js:5583–5747

**Entrada:**
```javascript
callCodexEngine(env, {
  workerCode,       // truncado a 16.000 chars
  intentText,       // truncado a 4.000 chars
  contract,         // truncado a 8.000 chars
  targetWorkerId
})
```

**Processamento:**
- Requer `env.OPENAI_API_KEY` ou `env.CODEX_API_KEY` — se ausente, retorna `{ok:false, reason:"missing_api_key"}`.
- Modelo: `env.OPENAI_CODE_MODEL || env.OPENAI_MODEL || "gpt-4.1-mini"`.
- Chama `POST https://api.openai.com/v1/chat/completions` com `response_format: {type:"json_object"}`, `temperature: 0.15`.
- System prompt instrui o modelo a retornar **apenas JSON** no formato `{ok, patches:[{title, description, anchor:{match:string}|null, patch_text:string}], notes, tests}`.

**Saída normalizada:**
```json
{
  "ok": true,
  "patches": [
    {
      "title": "string",
      "description": "string",
      "anchor": { "match": "string" } | null,
      "patch_text": "string livre — sem formato obrigatório",
      "reason": "string"
    }
  ],
  "notes": ["string"],
  "raw": { ... }
}
```

**⚠️ Limitação crítica:** O worker code é truncado a **16.000 chars**. `nv-enavia.js` tem ~9.800 linhas e ~350KB. Apenas os primeiros ~450 linhas são enviados ao modelo. Qualquer patch gerado para a parte do arquivo além de linha ~450 será inventado — sem ancoragem real no código.

**⚠️ `callCodexEngine` só é chamado se `use_codex=true` E credencial OpenAI configurada.** O payload padrão do Worker NÃO inclui `use_codex:true`. Portanto, na prática, o Codex nunca é invocado pelo fluxo atual.

---

## 5. `fetchCurrentWorkerSnapshot` — como lê o código atual

### Localização: executor/src/index.js:5437–5470

```javascript
async function fetchCurrentWorkerSnapshot({ accountId, apiToken, scriptName }) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/javascript",
      "Cache-Control": "no-store",
    },
  });
  const code = await resp.text();
  return { code, etag, last_modified, fetched_at_ms };
}
```

**Usa as credenciais do Executor** (`env.CF_ACCOUNT_ID` + `env.CF_API_TOKEN`), não o `GITHUB_TOKEN` do Worker.

**`Accept: application/javascript`** — lê o script como texto JS puro. Para workers single-file, retorna o código completo. Para workers com upload multipart (wrangler bundle), pode retornar apenas o entry point.

**Saída:** `{ code: string, etag: string|null, last_modified: string|null, fetched_at_ms: number }`

**Usado em:** `/audit` (linha 694), `/propose` (linha 1145), `runAuditMode` (linha 4134), e modo engineer do core (linha 6816).

---

## 6. `github_token_available` — onde é consumido hoje

**Resposta direta: em lugar nenhum.**

```bash
grep -n "github_token_available" executor/src/index.js
# (0 resultados)
```

O campo é enviado pelo Worker em ambos os payloads (adicionado no Commit 6 do PR107), chega no JSON do request body do Executor, mas **nunca é lido ou utilizado** por nenhuma lógica no Executor.

Não existe nenhum `if (action.github_token_available)`, nenhum `raw.github_token_available`, nenhum desvio de fluxo condicionado a esse campo.

**Conclusão:** O sinal de capability foi implementado no lado emissor (Worker) mas o receptor (Executor) não tem código para consumi-lo. É dead code no estado atual.

---

## 7. Gap exato para o ciclo: audit → propose → branch → commit → PR

### O que já existe

| Componente | Estado |
|---|---|
| `fetchCurrentWorkerSnapshot` | ✅ Funciona — lê código real via CF API |
| `/audit` retorna verdict + snapshot proof | ✅ Funciona |
| `/propose` retorna patch text (patches hardcoded do engineer) | ✅ Funciona parcialmente |
| `callCodexEngine` pode gerar patches com IA | ✅ Funciona — mas nunca acionado pelo fluxo atual |
| `POST /github-bridge/proxy` no Executor | ✅ Existe — proxy para Worker via `env.ENAVIA_WORKER` |
| `create_branch` no adapter | ✅ Funciona |
| `create_commit` no adapter | ✅ Funciona — PUT GitHub API com base64 |
| `open_pr` no adapter | ✅ Funciona |
| `/worker-patch-safe` salva candidato no KV | ✅ Funciona |

### Gaps reais (em ordem de criticidade)

---

#### ❌ GAP G1 — Nenhum orquestrador liga propose → GitHub

**O maior gap.** Não existe nenhum código no Executor que, após `/propose` retornar um patch, automaticamente:
1. Pega o `patch.patchText` do resultado
2. Aplica o patch sobre o código atual para gerar o `candidate`
3. Chama `POST /github-bridge/proxy` com `create_branch`
4. Chama `POST /github-bridge/proxy` com `create_commit`
5. Chama `POST /github-bridge/proxy` com `open_pr`

O `/github-bridge/proxy` existe como endpoint mas **nada no Executor o chama** após `/propose`. A conexão entre os dois é zero.

---

#### ❌ GAP G2 — Nenhum motor de aplicação de patch

O `/propose` retorna `patch.patchText[].patch_text` — uma string livre (ou `{search, replace}` nos hardcoded). Não existe nenhuma função `applyPatch(originalCode, patchText) → newCode`.

Sem código aplicado, não há `candidate` para o `create_commit`.

O `/worker-patch-safe` espera `{current, candidate}` como strings de código completas. Nada transforma `patchText + current → candidate`.

---

#### ❌ GAP G3 — `github_token_available` nunca consumido

O Executor não lê `raw.github_token_available` em nenhum ponto. Mesmo que o Worker sinalize `github_token_available: true`, o Executor não muda seu comportamento para chamar `/github-bridge/proxy`.

Para o ciclo funcionar, o Executor precisaria de lógica do tipo:
```javascript
if (raw.github_token_available && patches.length > 0) {
  // aplicar patch → gerar candidate
  // chamar /github-bridge/proxy create_branch
  // chamar /github-bridge/proxy create_commit
  // chamar /github-bridge/proxy open_pr
}
```
Isso não existe.

---

#### ❌ GAP G4 — Truncamento de 16K chars inviabiliza patch real do Worker

`callCodexEngine` trunca o código do Worker a **16.000 chars** (linha 5597). `nv-enavia.js` tem ~350KB (~9.800 linhas). O modelo recebe apenas os primeiros ~450 linhas. Qualquer patch gerado para o restante do arquivo é inventado — sem âncora real.

Mesmo que G1, G2 e G3 fossem resolvidos, o patch gerado para arquivos grandes seria inválido.

**Solução necessária:** estratégia de chunking (extrair apenas a seção relevante do código, não truncar linearmente).

---

#### ❌ GAP G5 — `callCodexEngine` nunca acionado no fluxo atual

O payload do Worker para `/propose` não inclui `use_codex: true` nem `context.use_codex: true`. Portanto, a condição `if (wantCodex && (env?.OPENAI_API_KEY || env?.CODEX_API_KEY))` nunca é verdadeira para chamadas do Worker.

Mesmo que a OPENAI_API_KEY estivesse configurada no Executor, o Codex não seria chamado.

---

#### ❌ GAP G6 — Mismatch semântico no payload de `/propose`

O Worker envia em `patch`:
```json
{ "type": "contract_action", "content": "<JSON de nextAction>" }
```

Isso é uma **descrição de ação contratual** (o que o sistema deveria fazer operacionalmente), não um **pedido de patch de código**. O Executor recebe isso, ignora o campo `patch` (não o usa para nada) e entra no modo engineer porque `prompt` é uma string não-vazia.

O `prompt` que chega é: `"Proposta supervisionada para ação contratual: <tipo>"` — não especifica qual parte do código mudar, qual arquivo, qual função, qual âncora. O Executor não tem contexto suficiente para gerar um patch real.

---

#### ⚠️ GAP G7 — `/audit` como pré-requisito não agrega sinal para o ciclo GitHub

O Worker chama `/audit` antes de `/propose`, mas o resultado do audit (verdict, risk_level, findings) não é passado para o `/propose`. São duas chamadas independentes sem encadeamento.

Quando o Executor processa `/propose`, não sabe o que o audit encontrou, quais findings levaram ao verdict, nem qual parte do código é o alvo real da mudança.

---

#### ⚠️ GAP G8 — `require_live_read` não está no payload padrão de `/propose`

O Worker envia `context: { require_live_read: true }` apenas no `_auditPayload` (linha 6161). No `_proposePayload` (linha 6187–6199), **não há `context.require_live_read: true`**.

Isso significa que quando o Executor processa `/propose`, pula a etapa de leitura do snapshot via CF API (linha 1068: `const requireLiveRead = action?.context?.require_live_read === true` → false). O Executor propõe patches **sem ter lido o código atual do Worker**.

---

## Resumo dos gaps

| Gap | Descrição | Severidade |
|---|---|---|
| G1 | Nenhum orquestrador liga propose → GitHub (create_branch/commit/PR) | 🔴 Bloqueador |
| G2 | Nenhum motor de aplicação de patch (patchText → candidate) | 🔴 Bloqueador |
| G3 | `github_token_available` nunca consumido no Executor | 🔴 Bloqueador |
| G4 | 16K char truncation inviabiliza patch de arquivos grandes (nv-enavia.js = 350KB) | 🔴 Bloqueador |
| G5 | `callCodexEngine` nunca acionado (falta `use_codex:true` no payload) | 🟡 Sério |
| G6 | Mismatch semântico: Worker envia "ação contratual", Executor espera "intenção de patch de código" | 🟡 Sério |
| G7 | Resultado do `/audit` não encadeado no `/propose` | 🟡 Sério |
| G8 | `require_live_read: true` ausente no payload de `/propose` | 🟡 Sério |

---

## Conclusão para o contrato PR108

O ciclo `audit → propose → branch → commit → PR` **não existe** no estado atual. Existem os componentes isolados (adapter GitHub, proxy endpoint, propose endpoint, fetch snapshot), mas nenhum código os conecta em sequência automatizada.

Para o ciclo funcionar, PR108 precisará implementar pelo menos:

1. **Motor de aplicação de patch** — transforma `{search, replace}` ou `patchText` + código atual → novo código completo
2. **Orquestrador no Executor** — após gerar patch aprovado, chama sequencialmente: `/github-bridge/proxy create_branch` → `/github-bridge/proxy create_commit` → `/github-bridge/proxy open_pr`
3. **Consumo de `github_token_available`** — só aciona o orquestrador se o sinal for verdadeiro
4. **Estratégia de chunking para arquivos grandes** — não pode truncar linearmente em 16K chars
5. **Encadeamento audit→propose** — passar findings do audit como contexto real para o propose
6. **`require_live_read: true` no payload de `/propose`** — para que o Executor leia o código antes de propor mudanças
