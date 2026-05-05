# executor/ — Espelho Governado do enavia-executor

## O que é esta pasta

Esta pasta contém uma **cópia governada** do código-fonte do Worker `enavia-executor`,
que é o executor real do sistema ENAVIA.

O objetivo é trazer o executor para dentro do versionamento soberano do repo `nv-enavia`,
permitindo rastreabilidade, auditoria e contrato interno, sem alterar o deploy externo.

## Repo de origem

- **Repo externo (soberano para deploy):** `brunovasque/enavia-executor` (privado)
- **Fonte copiada em:** 2026-04-26
- **Arquivo principal:** `src/index.js` (~247KB, copiado fielmente)

## Como o Worker principal chama o executor

O Worker principal (`nv-enavia`) acessa o executor via **Service Binding** do Cloudflare Workers:

```js
// wrangler.toml do nv-enavia (PROD)
[[services]]
binding = "EXECUTOR"
service = "enavia-executor"

// wrangler.toml do nv-enavia (TEST)
[[services]]
binding = "EXECUTOR"
service = "enavia-executor-test"
```

No código do Worker (`nv-enavia.js`), as chamadas acontecem assim:

```js
// Execução de plano via /engineer
const response = await env.EXECUTOR.fetch("https://internal/engineer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

// Auditoria via /audit
const execRes = await env.EXECUTOR.fetch("https://enavia-executor.internal/audit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(execPayload),
});
```

> Com Service Binding, a URL passada para `env.EXECUTOR.fetch(...)` é simbólica —
> o Cloudflare roteia internamente para o worker `enavia-executor` sem passar pela rede pública.
> O domínio da URL não precisa ser real; o que importa é o `pathname`.

## O que esta PR não altera

- **Deploy:** o executor continua sendo deployado a partir de `brunovasque/enavia-executor`, com CI/CD próprio.
- **Service Binding:** sem alteração no `wrangler.toml` do nv-enavia.
- **Worker principal:** `nv-enavia.js` e `contract-executor.js` não foram alterados.
- **Panel:** sem alteração.
- **Infraestrutura:** nenhum binding, secret ou namespace foi modificado.

## Como atualizar esta cópia

Se o executor externo evoluir, para sincronizar esta pasta:

```bash
# Via GitHub CLI (requer acesso ao repo privado)
gh api repos/brunovasque/enavia-executor/contents/src/index.js --jq '.content' \
  | node -e "const c=[]; process.stdin.on('data',d=>c.push(d)); \
    process.stdin.on('end',()=>{ \
      require('fs').writeFileSync('executor/src/index.js', \
        Buffer.from(c.join('').replace(/\n/g,''),'base64').toString('utf8')); \
    });"
```

Após sincronizar, atualizar a data de origem neste README e commitar.

## Estrutura

```
executor/
  README.md          — este arquivo
  CONTRACT.md        — contrato canônico de entrada/saída
  wrangler.toml      — referência de config (sem IDs reais de produção)
  src/
    index.js         — cópia fiel do src/index.js do repo externo
  tests/
    executor.contract.test.js   — smoke test mínimo de contrato/health
```

## Configuração obrigatória de secrets (PR109)

Os dois secrets abaixo devem ser configurados no Cloudflare para o ciclo de autoevolução funcionar.
**Sem eles, o Codex e o GitHub são silenciosamente pulados sem erro visível.**

```bash
# Chave OpenAI — necessária para callCodexEngine gerar patches
wrangler secret put OPENAI_API_KEY

# Token GitHub — necessária para orchestrateGithubPR criar branches e PRs
wrangler secret put GITHUB_TOKEN
```

- `OPENAI_API_KEY`: Personal API Key da OpenAI. O modelo é configurável via `OPENAI_CODE_MODEL` em `wrangler.toml` (default: `gpt-5.2`).
- `GITHUB_TOKEN`: Personal Access Token com escopos `contents:write` e `pull-requests:write` no repo `brunovasque/nv-enavia`.

## Secrets e bindings necessários (para deploy a partir desta pasta)

> Não commite valores reais. Configure via Cloudflare Dashboard ou `wrangler secret put`.

| Item | Tipo | Descrição |
|------|------|-----------|
| `ENAVIA_BRAIN` | KV binding | KV namespace principal |
| `ENAVIA_GIT` | KV binding | KV de integração Git |
| `GIT_KV` | KV binding | KV auxiliar Git |
| `CF_API_TOKEN` | Secret | Token de API Cloudflare |
| `OPENAI_API_KEY` | Secret | Chave OpenAI — necessária para callCodexEngine |
| `GITHUB_TOKEN` | Secret | Token GitHub — necessário para orchestrateGithubPR |
| `DEPLOY_WORKER_URL` | Var | URL do deploy-worker |
| `CF_ACCOUNT_ID` | Var | ID da conta Cloudflare |
| `TARGET_WORKER_NAME` | Var | Nome do worker-alvo (`nv-enavia`) |
