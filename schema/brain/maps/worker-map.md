# Brain Map — Workers (visão navegável)

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Resumo navegável — fonte de verdade: `schema/system/ENAVIA_WORKER_REGISTRY.md`

> **Nunca documentar valor de secret.** Só nomes de bindings, IDs públicos
> visíveis em `wrangler.toml` e funções operacionais. Nenhum valor sensível.

---

## 1. Workers confirmados

### 1.1 — `nv-enavia` (worker principal)

- **Tipo:** Cloudflare Worker, gerenciado por `wrangler.toml`
- **Ambiente:** PROD
- **Função:** Roteamento HTTP, chat runtime, loop contratual, integração com KV / executor / deploy worker, planner, bridge, memória
- **Bindings:** `EXECUTOR`, `DEPLOY_WORKER`, `ENAVIA_BRAIN`
- **Ponto crítico:** todo o ciclo do chat (LLM + sanitizers + envelope) mora aqui

### 1.2 — `enavia-worker-teste`

- **Tipo:** Cloudflare Worker (instância TEST do `nv-enavia`)
- **Ambiente:** TEST (`[env.test]` em `wrangler.toml`)
- **Função:** Mesma do principal, mas isolada para testes
- **Diferença conhecida:** `BROWSER_EXECUTOR_URL` vazia (não há browser em TEST);
  `DIRECTOR_COGNITIVE_URL` aponta para o mesmo endpoint de PROD (isolamento
  pendente, documentado em `wrangler.toml`).

### 1.3 — `enavia-executor`

- **Tipo:** Cloudflare Worker, alcançado via service binding `EXECUTOR`
- **Ambiente:** PROD
- **Função:** Auditoria de patch / proposta / validação de módulos / análise de risco
- **Endpoints usados via binding:** `POST /audit`, `POST /propose`
- **KVs:** `ENAVIA_BRAIN`, `ENAVIA_GIT`, `GIT_KV`

### 1.4 — `enavia-executor-test`

- **Tipo:** Cloudflare Worker (instância TEST do executor)
- **Ambiente:** TEST
- **Diferença conhecida:** Aponta para namespaces TEST de KV (`enavia-brain-test`,
  `ENAVIA_GIT_TEST`).

### 1.5 — `deploy-worker`

- **Tipo:** Cloudflare Worker, alcançado via service binding `DEPLOY_WORKER`
- **Ambiente:** PROD
- **Função:** Recibo de audit, aplicação de patch em TEST, promoção a PROD, rollback
- **Endpoints usados via binding:** `POST /audit`, `POST /apply-test`

### 1.6 — `deploy-worker-test`

- **Tipo:** Cloudflare Worker (instância TEST do deploy-worker)
- **Ambiente:** TEST
- **Diferença conhecida:** Aplica em ambiente TEST somente; jamais promove PROD.

---

## 2. Workers externos por URL

| Worker | URL (PROD) | URL (TEST) | Observação |
|--------|-----------|-----------|------------|
| Browser Executor | `BROWSER_EXECUTOR_URL` | vazia | Não existe browser em TEST |
| Director Cognitive | `DIRECTOR_COGNITIVE_URL` | mesma URL de PROD | Isolamento pendente |
| Vercel Executor | `VERCEL_EXECUTOR_URL` | mesma URL | Patches Vercel |
| Deploy Worker (URL direta) | `DEPLOY_WORKER_URL` | URL TEST | Referência alternativa via URL (não via binding) |

> Para URLs específicas e shapes de bindings, consultar
> `schema/system/ENAVIA_WORKER_REGISTRY.md` seções 4 e 5.

---

## 3. Workers centrais para a Enavia

A Enavia depende criticamente de:

1. **`nv-enavia`** — sem ele, não há chat, loop, contratos.
2. **`enavia-executor`** — sem ele, não há audit nem propose.
3. **`deploy-worker`** — sem ele, não há aplicação de patch ou rollback.

Os demais (browser, vercel, director cognitive) são auxiliares e podem estar
ausentes em TEST sem inviabilizar o sistema.

---

## 4. Diferenças PROD vs. TEST conhecidas

| Item | PROD | TEST | Fonte |
|------|------|------|-------|
| Worker principal | `nv-enavia` | `enavia-worker-teste` | `wrangler.toml` |
| Executor | `enavia-executor` | `enavia-executor-test` | `wrangler.toml` |
| Deploy worker | `deploy-worker` | `deploy-worker-test` | `wrangler.toml` |
| KV ENAVIA_BRAIN | `enavia-brain` | `enavia-brain-test` | `wrangler.toml` |
| KV ENAVIA_GIT | `ENAVIA_GIT` | `ENAVIA_GIT_TEST` | `wrangler.executor.template.toml` |
| Browser Executor | URL configurada | URL vazia (não existe) | `wrangler.toml` |
| Director Cognitive | URL própria | mesma URL de PROD (pendência) | `wrangler.toml` |

> A Enavia deve sempre lembrar: **WhatsApp não existe em TEST no projeto Enova**
> (preferência declarada do operador). Nada equivalente a interação real com
> usuário externo deve ser disparado em TEST.

---

## 5. Bindings, KVs e nomes de variáveis (sem valores)

- **Bindings de service:** `EXECUTOR`, `DEPLOY_WORKER`
- **KV:** `ENAVIA_BRAIN`, `ENAVIA_GIT`, `GIT_KV`
- **Variáveis externas (apenas nomes):** `BROWSER_EXECUTOR_URL`,
  `DIRECTOR_COGNITIVE_URL`, `VERCEL_EXECUTOR_URL`, `DEPLOY_WORKER_URL`,
  `ENAVIA_EXECUTOR_URL`
- **Secrets esperados (apenas nomes — jamais valores):** documentados em
  `schema/system/ENAVIA_WORKER_REGISTRY.md`. Valor de secret nunca entra
  neste mapa nem em nenhum outro arquivo do brain ou do schema.

> **Regra absoluta:** se for citado um secret, mencionar somente o nome e o
> uso. Valor é proibido.

---

## 6. Como a Enavia deve usar este mapa

1. Antes de afirmar que um worker faz X, conferir aqui e na fonte de verdade.
2. Antes de propor mudança em deploy/binding/KV, abrir Deploy Governance Operator.
3. Nunca afirmar que um worker está "saudável em produção" sem evidência de log/teste.
4. Nunca documentar valor de secret. Nem em chat, nem em PR, nem em relatório.

---

## 7. Backlinks

- → schema/system/ENAVIA_WORKER_REGISTRY.md
- → schema/system/ENAVIA_SYSTEM_MAP.md
- → schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md
- → brain/maps/system-map.md
- → brain/maps/route-map.md
- → brain/memories/hard-rules.md
