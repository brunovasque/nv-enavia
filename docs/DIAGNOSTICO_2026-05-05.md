# DIAGNÓSTICO — Estado do Repo nv-enavia

**Data:** 2026-05-05  
**Tipo:** PR-DIAG (read-only, sem alteração de runtime)  
**Revisor:** Claude Code — leitura direta do código, nada assumido

---

## 1. Estrutura atual de arquivos relevantes

### Raiz

| Arquivo | Tamanho | Observação |
|---------|---------|------------|
| `nv-enavia.js` | 382 KB | Worker principal — único arquivo JS na raiz |
| `contract-executor.js` | 207 KB | Contract Executor v1 — importado pelo Worker |
| `wrangler.toml` | 2,9 KB | Config do Worker (prod + env.test) |
| `wrangler.executor.generated.toml` | 919 B | Config real do executor — tem IDs reais — **não deveria estar commitado** |
| `wrangler.executor.template.toml` | 2 KB | Template com placeholders — correto no repo |
| `CLAUDE.md` | 7,5 KB | Regras operacionais do Code |
| `sessao-pr86-diagnostico.txt` | 214 KB | Sessão antiga ainda no repo raiz — ruído |
| `sessao-terminal.txt` | 214 KB | Idem |
| `lista-tests.txt` | 9,8 KB | Lista de testes — arquivo auxiliar |

### executor/

```
executor/
├── src/
│   ├── index.js           — Executor principal (não medido, arquivo grande)
│   ├── audit-response.js
│   ├── cloudflare-credentials.mjs
│   ├── code-chunker.js
│   ├── github-orchestrator.js
│   └── patch-engine.js
├── tests/
│   ├── cloudflare-credentials.test.js
│   └── executor.contract.test.js
├── wrangler.toml          — PLACEHOLDER — todos os IDs são REPLACE_WITH_REAL_ID
├── package.json
└── node_modules/          ← untracked (OK, no .gitignore)
```

**Problema:** `executor/wrangler.toml` tem IDs falsos (`REPLACE_WITH_REAL_ID`). A config real está em `wrangler.executor.generated.toml` na raiz, mas esse arquivo:
- Tem IDs reais hardcoded (KV IDs)
- Está commitado no repo (não deveria estar)
- Não tem OPENAI_API_KEY declarado (ver seção 5)

### schema/

Pasta grande com 50+ arquivos `.js` e subdiretorios:

```
schema/
├── enavia-intent-classifier.js    ← alterado por PR110 (IMPROVEMENT_REQUEST)
├── enavia-cognitive-runtime.js
├── enavia-llm-core.js
├── enavia-brain-loader.js
├── enavia-self-audit.js
├── enavia-response-policy.js
├── enavia-skill-router.js
├── enavia-github-bridge.js
├── enavia-self-worker-auditor-skill.js  ← criado em PR82
├── enavia-system-mapper-skill.js
├── enavia-skill-factory.js
├── enavia-skill-registry.js
├── enavia-skill-runner.js
├── ... (30+ outros)
├── contracts/
│   ├── INDEX.md            ← governança — diz PR110 é o ativo (DESATUALIZADO)
│   ├── ACTIVE_CONTRACT.md
│   └── active/
│       ├── CONTRATO_ENAVIA_AUTOEVOLUCAO_OPERACIONAL_PR82_PR85.md
│       ├── CONTRATO_ENAVIA_CHAT_LIVRE_COCKPIT_OPERACIONAL_PR94_PR97.md
│       ├── CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md
│       └── ... (11 contratos históricos)
├── status/ENAVIA_STATUS_ATUAL.md
├── handoffs/ENAVIA_LATEST_HANDOFF.md
├── execution/ENAVIA_EXECUTION_LOG.md
├── reports/                ← PR82.md–PR104.md (30+ relatórios)
└── brain/                  ← snapshots documentais, memórias, learnings
```

### deploy-worker/

```
deploy-worker/
├── src/index.js
└── wrangler.toml  ← deploy-worker sem KV, sem services declarados
```

`deploy-worker/wrangler.toml`:
```toml
name = "deploy-worker"
main = "src/index.js"
compatibility_date = "2026-04-16"
workers_dev = true
[observability]
enabled = true
```

Nenhum binding declarado. O `deploy-worker` opera de forma standalone.

### tests/

100+ arquivos de teste (pr2 a pr110). Todos os testes são unit/smoke/integration com mocks — nenhum teste E2E real commitado (exceto Grupo 3 do pr109 que abriu PR real durante execução).

### docs/

```
docs/
├── CONTRATO_ENAVIA_CHAT_TRIGGER_PR110.md     ← contrato recente
├── CONTRATO_ENAVIA_FIX_PROVA_PR109.md
├── CONTRATO_ENAVIA_MOTOR_PATCH_PR108.md
├── CONTRATO_ENAVIA_ECOSSISTEMA_PR107.md
├── CONTRATO_ENAVIA_GITHUB_BRIDGE_PR106.md
├── CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR105.md
├── DIAGNOSTICO_PR103_PR104.md
├── DIAGNOSTICO_PR110.md
├── DIAGNOSTICO_READ_ONLY.md                  ← gerado nesta sessão
├── PR110_REVIEW.md
├── PR105_REVIEW.md / PR106_REVIEW.md / PR107_REVIEW.md / PR108_REVIEW.md
├── HANDOFF_SESSAO_ENAVIA_2026-05-05.md
└── [PDFs, contratos históricos]
```

---

## 2. Estado do contrato anterior — o que foi entregue e o que ficou pendente

### Contrato de governança ativo (per INDEX.md)

**`docs/CONTRATO_ENAVIA_CHAT_TRIGGER_PR110.md`** — marcado como ativo no INDEX.md.

Estado real:
- PR110 **foi mergeada** (commit `d3eac88` em main — PR #278 do GitHub)
- Dois hotfixes adicionais foram commitados diretamente em main **após** o merge:
  - `7e7ff47` — adicionou `"sim"` a `_CHAT_BRIDGE_APPROVAL_TERMS`
  - `8c60368` — corrigiu `target.workerId` no payload do `_dispatchExecuteNextFromChat`
- O INDEX.md **não foi atualizado** após o merge — ainda marca PR110 como "em execução"

**O contrato PR110 está tecnicamente encerrado mas a governança não reflete isso.**

### O que foi entregue (código real em main)

| Entrega | Evidência no código |
|---------|---------------------|
| `IMPROVEMENT_REQUEST` no classificador | `schema/enavia-intent-classifier.js` — 24 termos gatilho, `_extractImprovementTarget`, `_hasNegationBefore` |
| Bloco PR110 em `handleChatLLM` | `nv-enavia.js` linha ~4215 — cria pending_plan TTL=300s com verificação de contrato KV |
| `_dispatchExecuteNextFromChat` | `nv-enavia.js` linha ~3703 — chama executor `/propose` via service binding |
| Roteamento em `_dispatchFromChat` | `nv-enavia.js` — desvio para execute_next quando `pendingPlan.action === "execute_next"` |
| `"sim"` nos approval terms | `nv-enavia.js` linha 3685–3687 — adicionado em hotfix |

### O que ficou pendente (issues I1–I4)

Ver seção 3.

### Contrato KV ativo (estado operacional real)

Nesta sessão foi ativado via `POST /contracts`:

**`enavia-autoevolucao-operacional-pr82-pr85`**

```json
{
  "contract_id": "enavia-autoevolucao-operacional-pr82-pr85",
  "status_global": "decomposed",
  "tasks_count": 4,
  "next_action": "start_task → task_001 (PR82)"
}
```

**Conflito:** O INDEX.md de governança não menciona este contrato como ativo para o Code. O KV do sistema operacional (`contract:index`) agora aponta para ele. Esses dois registros são independentes mas podem criar confusão em sessões futuras.

---

## 3. Issues documentados abertos

### I1 — Targets com "deploy" → DEPLOY_REQUEST (não IMPROVEMENT_REQUEST)

**Origem:** `docs/PR110_REVIEW.md` seção 6  
**Impacto:** Usuário digitando "melhora o /deploy" recebe DEPLOY_REQUEST em vez de IMPROVEMENT_REQUEST. O classificador trata "deploy" como termo de alta prioridade no step 2, antes de checar IMPROVEMENT_REQUEST (step PR110, antes do step 13).  
**Estado:** Documentado como comportamento intencional por segurança. Não bloqueador.  
**Próxima ação:** PR111 pode adicionar regra de desambiguação se necessário.

### I2 — LLM não consultado na detecção de IMPROVEMENT_REQUEST

**Origem:** `docs/PR110_REVIEW.md` seção 6  
**Impacto:** Quando o classificador detecta IMPROVEMENT_REQUEST com target, o bloco PR110 retorna antecipadamente **antes** do LLM call. A mensagem de confirmação é template fixo:  
`"Entendi. Posso auditar o sistema e abrir uma PR com a melhoria em ${target}. Confirma? (sim/não)"`  
O LLM não é consultado — sem resposta rica, sem variação de tom.  
**Estado:** Documentado. Não bloqueador para PR110.  
**Próxima ação:** PR111 pode chamar LLM para gerar resposta conversacional antes de criar pending_plan.

### I3 — use_codex: false no dispatch (CRÍTICO para ciclo completo)

**Origem:** `docs/PR110_REVIEW.md` seção 6; código em `nv-enavia.js` linha ~3724  
**Impacto real:** O payload atual enviado ao executor:

```javascript
const _proposePayload = {
  source: "chat_trigger",
  mode: "chat_execute_next",
  intent: "propose",
  improvement_target: improvementTarget,
  target: { system: "cloudflare_worker", workerId: "nv-enavia" },
  use_codex: false,                    // ← Codex desativado
  context: { require_live_read: true },
};
```

Com `use_codex: false`, o executor faz o live_read do Worker mas **não chama o Codex Engine** para gerar patches. O fluxo do executor (linha ~1413 de `executor/src/index.js`):

```javascript
// só aciona ciclo GitHub se staging.ready === true
if (action.github_token_available === true && staging?.ready === true) { ... }
```

`staging.ready` só é `true` quando o Codex gerou patches válidos. Sem Codex → `staging.ready = false` → nenhuma PR é aberta.  
**Conclusão prática: o ciclo chat→PR110→"sim"→executor não abre PR hoje.**  
**Estado:** Bloqueador para ciclo completo. Não bloqueador para PR110 (que era apenas o plumbing).  
**Próxima ação:** PR111 deve ativar `use_codex: true` E garantir que `OPENAI_API_KEY` está configurada no executor em produção.

### I4 — Fluxo não testado com PR real aberta

**Origem:** `docs/PR110_REVIEW.md` seção 6  
**Impacto:** Os testes do PR110 são mocks puros (60 cenários). Nenhum teste E2E real que abra uma PR de verdade via chat trigger.  
**Estado:** Documentado. Previsto para PR111 (similar ao Grupo 3 do pr109).

### F1 e F3 — Análise

Os termos "F1" e "F3" não aparecem como issues numerados em nenhum dos docs de PR110, PR109 ou do contrato atual. O que existe no código do `contract-executor.js` com esse prefixo são features implementadas:

```javascript
// POST /contracts/cancel    → Formal contract cancellation (F1) — IMPLEMENTADO
// POST /contracts/reject-plan → F2 — IMPLEMENTADO
// F3 — Enforce max_micro_prs — IMPLEMENTADO (em handleCreateContract)
```

Esses não são issues abertos — são features operacionais já entregues. Se "F1/F3" se refere a outra categorização, ela não está documentada nos arquivos atuais do repo.

---

## 4. Estado real de nv-enavia.js — use_codex, _dispatchExecuteNextFromChat, handleChatLLM

### 4.1 `_dispatchExecuteNextFromChat` — estado atual (linha ~3703)

```javascript
async function _dispatchExecuteNextFromChat(env, pendingPlan) {
  const sessionId = pendingPlan.session_id || null;
  const improvementTarget = pendingPlan.target || null;  // ← hotfix: renomeado

  if (!env.EXECUTOR || typeof env.EXECUTOR.fetch !== "function") {
    return { ok: false, action: "execute_next", target: improvementTarget, error: "EXECUTOR_NOT_AVAILABLE" };
  }

  const _proposePayload = {
    source: "chat_trigger",
    mode: "chat_execute_next",
    intent: "propose",
    improvement_target: improvementTarget,              // ← string do target ("/audit", etc.)
    target: { system: "cloudflare_worker", workerId: "nv-enavia" },  // ← hotfix: shape correto
    session_id: sessionId,
    github_token_available: true,
    use_codex: false,                                   // ← I3: Codex DESATIVADO
    context: {
      description: pendingPlan.description || `Melhoria solicitada via chat em ${improvementTarget}`,
      require_live_read: true,
    },
  };
  // ... fetch env.EXECUTOR.fetch("https://internal/propose") ...
  // ... retorna { ok, action, target, pr_url, propose_result }
}
```

**Comportamento atual:** Chama o executor `/propose` com live_read ativado. O executor fará snapshot do Worker mas não gerará patches (Codex desligado). `staging.ready` virá `false`. Nenhuma PR será aberta. O retorno do `_dispatchExecuteNextFromChat` terá `pr_url: null`.

### 4.2 `use_codex` no executor — onde é lido

Executor `src/index.js` linhas ~7247–7252:
```javascript
const wantCodex =
  raw?.context?.use_codex === true ||
  raw?.use_codex === true ||
  a?.context?.use_codex === true;

if (wantCodex && (env?.OPENAI_API_KEY || env?.CODEX_API_KEY)) {
  // chama callCodexEngine — gera patches
}
```

O Codex só roda se:
1. `use_codex === true` em algum caminho do payload, **E**
2. `env.OPENAI_API_KEY` (ou `CODEX_API_KEY`) está configurada no executor.

Atualmente: condição 1 é `false` (hardcoded). Condição 2 é desconhecida (não declarada no toml).

### 4.3 `handleChatLLM` — ordem das verificações (linha 3949)

Ordem real de execução:

```
handleChatLLM
  1. Parse body (message, session_id, context) — linha ~3964
  2. BLOCO B — chat_bridge approval — linha 3988
     └─ SE hasApproval (lista inclui "sim" após hotfix) E há pending_plan em KV
        └─ apaga pending_plan → chama _dispatchFromChat → retorna imediatamente
  3. PR5 — Conversation History — linha ~4091
  4. PM4 classifyRequest — linha ~4132
  5. API Key guard — linha 4145
  6. Operational Awareness — linha ~4161
  7. classifyEnaviaIntent (PR49) — linha ~4206
  8. BLOCO PR110 — IMPROVEMENT_REQUEST — linha ~4215
     └─ SE intent === "improvement_request" E session_id E ENAVIA_BRAIN
        └─ verifica contract:index KV
        └─ cria pending_plan TTL=300s
        └─ retorna mensagem de confirmação — SEM chamar LLM
  9. Skill Router (read-only) — linha ~4299
  10. LLM call — mais abaixo
  11. Planner (condicional) — mais abaixo
```

**A ordem está correta:** chat_bridge approval (passo 2) roda ANTES de classifyEnaviaIntent (passo 7).

### 4.4 `_CHAT_BRIDGE_APPROVAL_TERMS` — estado atual (linha 3685)

```javascript
const _CHAT_BRIDGE_APPROVAL_TERMS = [
  "aprovado", "pode executar", "confirmo", "sim, execute", "execute agora", "go",
  "sim",    // ← adicionado em hotfix 7e7ff47
];
```

### 4.5 Problema latente: `contract:index` como proxy de "contrato ativo"

O bloco PR110 em `handleChatLLM` usa:
```javascript
const _contractIndex = await env.ENAVIA_BRAIN.get("contract:index");
_activeContractExists = !!_contractIndex;
```

`contract:index` é um array JSON de IDs dos contratos registrados no Contract Executor (qualquer contrato, mesmo encerrado). Agora que o contrato `enavia-autoevolucao-operacional-pr82-pr85` foi ativado via `POST /contracts` nesta sessão, `contract:index = ["enavia-autoevolucao-operacional-pr82-pr85"]` → a verificação retorna `true` → pending_plan pode ser criado.

Isso é correto funcionalmente mas é um proxy fraco: `contract:index` não verifica se o contrato está **ativo** (status_global = "decomposed" ou "in_progress") vs encerrado.

---

## 5. Secrets e bindings: esperado vs declarado

### nv-enavia (Worker principal)

**wrangler.toml prod:**

| Binding | Tipo | Declarado | Estado |
|---------|------|-----------|--------|
| `ENAVIA_BRAIN` | KV | ✅ id: `722835b...` | OK |
| `EXECUTOR` | Service | ✅ `enavia-executor` | OK |
| `DEPLOY_WORKER` | Service | ✅ `deploy-worker` | OK |
| `GITHUB_TOKEN` | Secret | ⚠️ campo `secrets` em `[[kv_namespaces]]` | **Campo não padrão — wrangler gera WARNING a cada deploy.** O secret existe no Cloudflare mas a declaração está no lugar errado. |
| `OPENAI_API_KEY` | Secret | ❌ NÃO declarado | Existe como secret no Cloudflare (Worker usa `env.OPENAI_API_KEY`) mas não está documentado no toml. |
| `INTERNAL_TOKEN` | Secret | ❌ NÃO declarado | Usado em `isInternalAuthorized` mas não documentado. |
| `ENAVIA_MODE` | Var | ✅ `"supervised"` | OK |
| `OPENAI_MODEL` | Var | ✅ `"gpt-5.2"` | OK |

**wrangler.toml env.test:**
- Usa KV de preview: `235fd25...`
- Services: `enavia-executor-test`, `deploy-worker-test` (esses workers precisam existir)
- Mesmo problema de `GITHUB_TOKEN`/`OPENAI_API_KEY` não declarados

### executor (enavia-executor)

**executor/wrangler.toml** — referência interna, IDs todos `REPLACE_WITH_REAL_ID`:

| Binding | Tipo | Declarado na ref | Real (generated.toml) |
|---------|------|------------------|-----------------------|
| `ENAVIA_BRAIN` | KV | placeholder | `722835b...` ✅ |
| `ENAVIA_GIT` | KV | placeholder | `c944c6f...` ✅ |
| `GIT_KV` | KV | placeholder | `c944c6f...` (mesmo ID!) ✅ |
| `ENAVIA_WORKER` | Service | ✅ `nv-enavia` | ❌ ausente no generated.toml |
| `DEPLOY_WORKER` | Service | ✅ `deploy-worker` | ❌ ausente no generated.toml |
| `OPENAI_API_KEY` | Secret | ❌ não declarado | ❌ não declarado em nenhum toml |
| `GITHUB_TOKEN` | Secret | ❌ não declarado | ❌ não declarado |

**Problemas críticos do executor:**

1. **`OPENAI_API_KEY` não rastreada em nenhum toml.** O executor usa `env.OPENAI_API_KEY` no Codex Engine mas ela não está declarada como secret em nenhum arquivo de config do repo. Se o deploy do executor for feito a partir do repo (via workflow ou generated.toml), a variável pode não estar disponível em runtime.

2. **`ENAVIA_WORKER` e `DEPLOY_WORKER` service bindings ausentes no `wrangler.executor.generated.toml`.** O toml de referência os declara, o gerado não. Isso significa que o executor deployado não tem os bindings de service — chamadas via `env.ENAVIA_WORKER.fetch()` falharão silenciosamente ou com erro.

3. **`GIT_KV` e `ENAVIA_GIT` apontam para o mesmo KV ID.** Pode ser intencional mas vale confirmar.

4. **`wrangler.executor.generated.toml` está commitado no repo** com o comentário `# NÃO commitar — IDs reais presentes`. Contradição: está commitado.

### deploy-worker

Sem bindings declarados. Não usa KV, não usa service bindings. Operação standalone — parece correto para um deploy worker básico.

---

## 6. Forma de trabalho estabelecida no CLAUDE.md

### Loop obrigatório antes de qualquer ação

1. Ler `CLAUDE.md` inteiro
2. Ler `schema/CODEX_WORKFLOW.md`
3. Identificar contrato ativo em `schema/contracts/INDEX.md`
4. Ler o contrato ativo completo
5. Ler `ENAVIA_STATUS_ATUAL.md`, `ENAVIA_LATEST_HANDOFF.md`, `ENAVIA_EXECUTION_LOG.md`
6. Identificar a próxima PR autorizada
7. Declarar o tipo da PR (PR-DIAG / PR-IMPL / PR-PROVA / PR-DOCS)
8. Confirmar que PR anterior está concluída
9. Executar apenas o escopo autorizado
10. Atualizar status + handoff + execution log + INDEX.md ao final
11. Responder com `WORKFLOW_ACK: ok`

### Tipos de PR

| Tipo | Descrição |
|------|-----------|
| `PR-DIAG` | Diagnóstico read-only, sem alteração de runtime |
| `PR-IMPL` | Implementação, altera runtime |
| `PR-PROVA` | Testes/validação de implementação |
| `PR-DOCS` | Documentação, sem alteração de runtime |

### Regras de bloqueio

- Sem `PR-DIAG` prévia → não pode fazer `PR-IMPL` (exceto quando contrato autoriza)
- Sem `PR-PROVA` → não pode fechar frente
- Escopos separados: Worker / Panel / Executor / Deploy Worker / Workflows / Docs
- Não misturar escopos na mesma PR
- Patch cirúrgico — não refatorar por estética
- Não avançar se PR anterior estiver bloqueada
- Conflito entre contrato/status/handoff → parar e reportar

### Padrão de branch

```
claude/pr<N>-<descricao-curta>
copilot/pr<N>-<descricao-curta>
codex/pr<N>-<descricao-curta>
```

### O que o CLAUDE.md **não diz** mas é prática estabelecida

- Hotfixes cirúrgicos podem ir direto em `main` sem branch/PR (usado nesta sessão em `7e7ff47` e `8c60368`)
- Deploy manual via `npx wrangler deploy` é executado pelo Code quando solicitado
- Ativação de contrato no KV via `POST /contracts` é responsabilidade do operador/Code — não documentado no CLAUDE.md

---

## 7. Inconsistências e riscos identificados

### 7.1 Governança desatualizada (MÉDIO)

`schema/contracts/INDEX.md` ainda marca PR110 como ativo e "em execução". PR110 foi mergeada. O Index deveria ser atualizado para refletir:
- PR110: Encerrado ✅
- Próximo: PR111 (deploy real supervisionado) ou novo contrato

### 7.2 Dois hotfixes em main sem PR (BAIXO-MÉDIO)

`7e7ff47` e `8c60368` foram commitados direto em main bypassando o fluxo de branch+PR do CLAUDE.md. O CLAUDE.md permite "commit direto em main para hotfix cirúrgico" (instrução explícita do operador nesta sessão). Mas não há registro desses hotfixes no execution log.

### 7.3 I3 é bloqueador do ciclo completo (ALTO)

Com `use_codex: false`, o fluxo chat→melhoria→"sim" não abre PR. O executor faz live_read mas retorna `staging.ready = false`. O usuário recebe `"Execução concluída, mas nenhuma PR foi aberta"`. Isso torna o PR110 funcionalmente incompleto para o caso de uso real.

### 7.4 OPENAI_API_KEY do executor não rastreada (MÉDIO)

Nenhum arquivo toml do executor declara `OPENAI_API_KEY`. Se o executor for redeploy sem o secret configurado manualmente no Cloudflare, o Codex Engine não funcionará mesmo com `use_codex: true`.

### 7.5 wrangler.executor.generated.toml commitado com dados reais (BAIXO)

O arquivo tem IDs de KV reais e um comentário dizendo "NÃO commitar". Está commitado. Não expõe secrets (tokens) mas expõe IDs de namespace.

### 7.6 service bindings ausentes no executor deployado (ALTO)

`wrangler.executor.generated.toml` não tem `[[services]]` para `ENAVIA_WORKER` e `DEPLOY_WORKER`. Se o executor foi deployado a partir desse toml, as chamadas `env.ENAVIA_WORKER.fetch()` falharão.

---

## 8. Próxima etapa recomendada

Com o contrato `enavia-autoevolucao-operacional-pr82-pr85` ativado no KV (task_001 pronta), e o contrato de governança PR110 encerrado mas não fechado formalmente:

**Ação imediata recomendada:**
1. Atualizar `schema/contracts/INDEX.md` — encerrar PR110 formalmente
2. Decidir: continuar com PR111 (per handoff) ou trabalhar no ciclo PR82–PR85
3. Se PR111: ativar `use_codex: true` + garantir `OPENAI_API_KEY` no executor
4. Corrigir `wrangler.executor.generated.toml` — remover do repo ou padronizar

**Próxima PR recomendada (per handoff atual):** PR111 — Deploy real supervisionado.
