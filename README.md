# nv-enavia

Repositório de governança do worker Cloudflare **existente** da ENAVIA.

## Regra deste repo

Este repo foi criado para **governar o worker atual**, sem recriar arquitetura e sem mexer no `nv-enavia.js` no escuro.

## Arquivo principal

- `nv-enavia.js` → worker atual, com rotas, bindings e comportamento vivo
- `wrangler.toml` → bootstrap de governança Cloudflare
- `.github/workflows/deploy.yml` → deploy manual, sem trigger automático

## Objetivo inicial

1. Colocar o worker atual sob governança de repo
2. Documentar bindings, vars e secrets
3. Preparar deploy manual seguro via GitHub Actions
4. Só depois fazer diagnóstico e mudanças cirúrgicas

## Bindings esperados no runtime

### KV
- `ENAVIA_BRAIN`

### Service Bindings
- `EXECUTOR`
- `DEPLOY_WORKER`

### Vars / Secrets usados pelo código

#### Vars
- `ENAVIA_MODE`
- `BROWSER_EXECUTOR_URL`
- `SUPABASE_URL`
- `SUPABASE_BUCKET`
- `OPENAI_MODEL` (opcional)
- `NV_OPENAI_MODEL` (opcional)

#### Secrets
- `OPENAI_API_KEY`
- `INTERNAL_TOKEN`

## Separação de ambientes Supabase Storage

O ambiente TEST usa um bucket Supabase **isolado** para evitar contaminação do PROD.

| Ambiente | `SUPABASE_BUCKET` |
|----------|-------------------|
| PROD (`[vars]`) | `enavia-brain` |
| TEST (`[env.test.vars]`) | `enavia-brain-test` |

O bucket `enavia-brain-test` deve existir no projeto Supabase antes do primeiro deploy em TEST.

## Separação de ambientes Browser Executor

O ambiente TEST usa um `BROWSER_EXECUTOR_URL` **isolado** para que execuções de browser em TEST não atinjam o executor real de PROD.

| Ambiente | `BROWSER_EXECUTOR_URL` |
|----------|-----------------------|
| PROD (`[vars]`) | `https://run.nv-imoveis.com/browser/run` |
| TEST (`[env.test.vars]`) | `https://run-test.nv-imoveis.com/browser/run` |

O worker lê `env.BROWSER_EXECUTOR_URL` diretamente — nenhuma lógica foi alterada.

## Antes do primeiro deploy

Preencher no `wrangler.toml`:
- `ENAVIA_BRAIN` namespace IDs
- nomes reais de `EXECUTOR` e `DEPLOY_WORKER`
- `SUPABASE_URL`
- `SUPABASE_BUCKET`

Configurar no Cloudflare:
- `OPENAI_API_KEY`
- `INTERNAL_TOKEN`

Configurar no GitHub Actions:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Importante

- Não existe refatoração aprovada neste bootstrap
- Não existe worker novo
- Não existe migração de rota
- O foco inicial é governança do worker já existente
