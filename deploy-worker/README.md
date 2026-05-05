# deploy-worker

Worker Cloudflare responsável pelo deploy real de scripts no Cloudflare Workers.

**Source of truth:** Este diretório (`deploy-worker/`) dentro de `brunovasque/nv-enavia` é o source of truth canônico. O repo original `brunovasque/deploy-worker` pode ser arquivado.

---

## Responsabilidades

- Receber candidatos de patch do Executor (`enavia-executor`)
- Aplicar deploy real via Cloudflare API
- Fazer rollback quando solicitado
- **Nunca executar deploy sem candidato versionado no KV**

## O que NÃO faz

- Não gera patches (responsabilidade do Executor via Codex Engine)
- Não gerencia GitHub (responsabilidade do Worker `nv-enavia`)
- Não valida safety de operações GitHub (responsabilidade do Safety Guard no Worker)

---

## Endpoints expostos

| Endpoint | Método | Chamado por |
|---|---|---|
| `/worker-deploy` | POST | Executor (`delegateToDeployWorker`) |
| `/apply-test` | POST | Worker (`callDeployBridge`) |
| `/__internal__/audit` | POST | Worker (`callDeployBridge`) |

---

## Credenciais necessárias

| Credencial | Tipo | Obrigatório para |
|---|---|---|
| `CF_ACCOUNT_ID` | var ou secret | Deploy via Cloudflare API |
| `CF_API_TOKEN` | secret | Autenticação Cloudflare API |
| `INTERNAL_TOKEN` | secret | Validar chamadas inter-worker autenticadas |

Configure via `wrangler secret put <NOME>`.

---

## Como é chamado

### Pelo Executor (`enavia-executor`)

HTTP direto via `DEPLOY_WORKER_URL`:
```
POST https://deploy-worker.brunovasque.workers.dev/worker-deploy
```

### Pelo Worker (`nv-enavia`)

Service binding como primário + HTTP como fallback:
```javascript
// Primário: env.DEPLOY_WORKER.fetch(...)
// Fallback: fetch(env.ENAVIA_DEPLOY_WORKER_URL + path, { headers: { 'x-internal-token': ... } })
```

---

## Dev local

Para rodar localmente:
```bash
cd deploy-worker
wrangler dev
```

Necessário ter `CF_ACCOUNT_ID` e `CF_API_TOKEN` configurados como secrets no ambiente de dev.

---

## Sha do código original copiado

- Repo: `brunovasque/deploy-worker`
- Sha: `48916b6029de4e05ad8da6db939b49914da58ea5`
- Copiado em: 2026-05-04
