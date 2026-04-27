# CONTRACT.md — enavia-executor

> Contrato canônico de entrada/saída do executor.
> Versão: PR2-governance-v1
> Data: 2026-04-26
> Fonte: diagnóstico de `brunovasque/enavia-executor/src/index.js`

---

## Identidade

| Campo | Valor |
|-------|-------|
| Worker name | `enavia-executor` (PROD) / `enavia-executor-test` (TEST) |
| Binding no nv-enavia | `env.EXECUTOR` |
| Runtime | Cloudflare Workers |
| Entry point | `src/index.js` |
| Boundary version | `PRC-canonical-v2` |

---

## Rotas principais

### GET /health

Retorna estado de saúde do executor.

**Response 200:**
```json
{
  "system": "enavia-executor",
  "status": "ok",
  "message": "Executor online.",
  "target_worker": "nv-enavia",
  "boundary": "PRC-canonical-v2",
  "deploy_worker_configured": true
}
```

---

### GET /boundary

Retorna contrato canônico executor × deploy-worker.

**Response 200:**
```json
{
  "system": "enavia-executor",
  "version": "PRC-canonical-v2",
  "executor_owns": ["audit", "propose", "module-validate", "engineer", ...],
  "deploy_worker_owns": ["apply-test", "approve", "promote", "rollback", ...],
  "delegation_note": "...",
  "deploy_worker_configured": true,
  "deploy_worker_url": "https://deploy-worker.brunovasque.workers.dev"
}
```

---

### POST /engineer (rota principal chamada pelo nv-enavia)

Chamada pelo Worker principal via `env.EXECUTOR.fetch("https://internal/engineer", ...)`.

**Request body:**
```json
{
  "action": "execute_plan",
  "source": "chat_bridge | planner_bridge",
  "bridge_id": "string",
  "session_id": "string",
  "executor_payload": { ... }
}
```

**Response 200 (ok):**
```json
{
  "ok": true,
  "result": { ... }
}
```

**Response 4xx/5xx (erro):**
```json
{
  "ok": false,
  "error": "string",
  "detail": "string (opcional)"
}
```

---

### POST /audit

Diagnóstico completo do worker-alvo (snapshot, hash, mapa canônico).

**Request body:**
```json
{
  "executor_action": "audit",
  "workerId": "nv-enavia",
  "constraints": { "read_only": true, "no_auto_apply": true },
  "context": { "execution_id": "string" }
}
```

**Response 200:**
```json
{
  "ok": true,
  "audit": {
    "verdict": "approve | reject",
    "risk_level": "low | medium | high | critical",
    "snapshot": "...",
    "hash": "...",
    "route_map": [ ... ]
  }
}
```

---

### POST /propose

Proposta de patch supervisionado.

**Request body:**
```json
{
  "executor_action": "propose",
  "workerId": "nv-enavia",
  "patch": { "type": "patch_text", "content": "string" },
  "prompt": "string",
  "intent": "propose"
}
```

---

### GET /status

Estado interno do executor (versões, índice, target worker).

---

## Compatibilidade com env.EXECUTOR.fetch(...)

O Worker principal chama o executor exclusivamente via Service Binding.
As URLs usadas são simbólicas — o pathname é o que importa:

| URL simbólica usada | Pathname real | Chamada em |
|---------------------|---------------|------------|
| `https://internal/engineer` | `/engineer` | `nv-enavia.js` linhas 2810, 3623, 4683 |
| `https://enavia-executor.internal/audit` | `/audit` | `nv-enavia.js` linha 5971 |
| `https://executor.invalid/audit` | `/audit` | `nv-enavia.js` linha 5722 — **URL inválida (bug a corrigir em PR4)** |

> **Nota PR4:** A URL `https://executor.invalid/audit` na linha 5722 de `nv-enavia.js`
> é reconhecidamente inválida. O executor responde ao pathname `/audit`, portanto a chamada
> pode funcionar via Service Binding (que ignora o host), mas é tecnicamente incorreta.
> Corrigir em PR4 — Worker-only — fixes cirúrgicos de confiabilidade.

---

## O que o executor NÃO faz (delegado ao deploy-worker)

- `apply-test` — aplicar patch em ambiente de teste
- `approve` — aprovar e executar deploy real
- `promote` — promover de TEST para PROD
- `rollback` — reverter para versão anterior
- `cancel` — cancelar ciclo de deploy

Quando `DEPLOY_WORKER_URL` está configurado, essas ações são delegadas ao
`deploy-worker`. Quando não está configurado, o executor retorna erro explícito
(`501 DEPLOY_WORKER_NOT_CONFIGURED`).

---

## Secrets necessários (não commitar valores reais)

| Secret | Descrição |
|--------|-----------|
| `CF_API_TOKEN` | Token Cloudflare para leitura de código do worker-alvo |
| `OPENAI_API_KEY` | Chave OpenAI para geração de patches cognitivos |

---

## Rollback desta PR

Esta PR é 100% additive — apenas cria arquivos novos em `executor/`.
Rollback: `git revert <commit>` ou simplesmente fechar a PR sem merge.
Nenhum impacto em produção.
