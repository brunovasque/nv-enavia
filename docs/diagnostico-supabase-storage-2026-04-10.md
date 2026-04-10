# ENAVIA — Diagnóstico Supabase Storage (Bucket Público / Listagem)
**Data:** 2026-04-10  
**Autor:** Copilot (READ-ONLY — nenhum código de runtime foi alterado)  
**Branch:** `copilot/handle-supabase-storage-permissions`  
**Escopo:** Supabase Storage exclusivo — bucket `enavia-brain` (PROD) e `enavia-brain-test` (TEST)

> **NOTA:** O arquivo `schema/CODEX_WORKFLOW.md` não existe neste repositório.
> Esta tarefa prosseguiu por **autorização explícita do usuário** para ignorar essa restrição apenas nesta PR.

---

## WORKFLOW_ACK: ok

---

## Summary

- O diagnóstico read-only foi concluído com sucesso.
- O worker **acessa o Supabase Storage exclusivamente por GET direto por path conhecido** — nenhuma listagem, nenhuma enumeração.
- A dependência de acesso público por path (`/storage/v1/object/public/...`) é real e deve ser preservada.
- O excesso de permissão (LIST pública aberta no bucket) **é um risco real e pode ser reduzido sem quebrar o runtime**.
- **NO-GO para patch de policy nesta PR**: o repositório não possui estrutura canônica para versionar migrations/policies Supabase. Criar essa estrutura aqui seria "inventar pasta" — fora do escopo autorizado.
- O que fazer: aplicar a mudança de policy diretamente no Supabase Dashboard e registrar neste documento o contrato esperado.

---

## DIAGNÓSTICO READ-ONLY

### 1. Dependências reais do bucket público

O worker depende de **dois tipos de arquivo** no bucket:

| Arquivo | Frequência | Rota de acesso |
|---------|------------|---------------|
| `nv_index.json` | Sempre — boot do worker | `buildStorageURL(env, "nv_index.json")` |
| `FINAL_NV/M12-AUTOPATCHENGINE-V1.txt` | Sempre — boot do worker | `buildStorageURL(env, "FINAL_NV/M12-AUTOPATCHENGINE-V1.txt")` |
| Módulos listados no `nv_index.json` | Lazy (sob demanda) | `buildStorageURL(env, path)` onde `path` vem do index |

#### URL gerada (função `buildStorageURL`, linha 230 de `nv-enavia.js`)
```
${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}?download=1
```
Exemplo real PROD:
```
https://jsqvhmnjsbmtfyyukwsr.supabase.co/storage/v1/object/public/enavia-brain/nv_index.json?download=1
```

### 2. Uso de GET por path — confirmado. Uso de listagem — AUSENTE.

O código realiza apenas:
```js
const res = await fetch(moduleURL);  // GET direto
```

**Não existe** nenhuma chamada a:
- `/storage/v1/object/list/` (API de listagem de objetos)
- `/storage/v1/bucket/` (API de buckets)
- Qualquer endpoint de enumeração ou scan

**Prova:** grep no arquivo `nv-enavia.js` por `/list`, `/enumerate`, `storage/v1/bucket` — zero ocorrências relevantes.

O worker **não precisa de LIST permission** para funcionar. Usa apenas `object/public/{bucket}/{path}`.

### 3. Local canônico de versionamento Supabase no repo

**Não existe.**

O repositório contém apenas:
```
nv-enavia.js          ← worker Cloudflare
wrangler.toml         ← config Cloudflare
.github/workflows/    ← CI/CD Cloudflare
docs/                 ← documentação
README.md
```

Não há:
- `supabase/` (pasta padrão de projetos com supabase CLI)
- `migrations/` ou `sql/`
- Scripts de policy
- Qualquer referência a `supabase link`, `supabase db push`, ou similar

Criar essas pastas seria inventar estrutura fora do padrão do repo — **fora do escopo autorizado**.

### 4. Recomendação segura

**Manter bucket público e remover LIST pública excessiva** (via Supabase Dashboard).

| Permissão | Situação atual | Necessária? | Ação |
|-----------|---------------|-------------|------|
| SELECT / GET por path | Aberta ao público | ✅ SIM — worker depende | Manter |
| LIST de objetos do bucket | Aberta ao público (alerta) | ❌ NÃO — worker nunca usa | Remover |
| INSERT / UPDATE / DELETE | Assumidamente fechada | ❌ NÃO | Confirmar fechado |

---

## GO / NO-GO

### ❌ NO-GO para patch de código/migration neste repositório

**Bloqueio exato:**
O ajuste necessário (remover LIST pública do bucket) é uma **mudança de policy no Supabase**, não uma mudança de código do worker. Para versioná-la, seria necessário:
- Uma pasta `supabase/` com migrations (padrão `supabase CLI`)
- OU um script SQL de policy dedicado

Este repositório não possui nenhum desses padrões. Criá-los seria inventar estrutura — o que a instrução proibiu explicitamente:
> "NÃO inventar migration folder se o repo não tiver padrão para isso"

### ✅ GO para aplicação manual no Supabase Dashboard

A mudança é simples, segura e reversível. Pode ser aplicada diretamente no Dashboard sem tocar em código.

---

## PATCH PLAN (aplicação manual — fora do repo)

### Objetivo
Remover o excesso de permissão de listagem pública no bucket `enavia-brain` (PROD) e `enavia-brain-test` (TEST), mantendo o acesso público por path intacto.

### Onde aplicar
Supabase Dashboard → projeto `jsqvhmnjsbmtfyyukwsr` → Storage → Policies

### Policy SQL equivalente (para registro e rollback)

#### Estado atual esperado (permissivo demais):
```sql
-- Bucket: enavia-brain
-- Policy: "Acesso público a todos os objetos" (provavelmente allow SELECT + LIST)
```

#### Policy alvo (mínima — só permite GET por path, não LIST):
```sql
-- Remover a policy de LIST pública
-- Manter apenas a policy de GET (object/public/{bucket}/{path})

-- Se a policy for gerenciada via Dashboard em vez de SQL:
-- Storage → Buckets → enavia-brain → Policies
-- Remover/desativar: "Allow public list" (ou equivalente)
-- Manter: "Allow public read" (permite /object/public/...)
```

#### Rollback exato:
```sql
-- Para reverter: reabilitar a policy de LIST pública no Dashboard
-- Storage → Buckets → enavia-brain → Policies → Add policy → Allow list for public
```

### Passos no Dashboard (ordem exata)
1. Acessar: https://supabase.com/dashboard/project/jsqvhmnjsbmtfyyukwsr/storage/buckets
2. Clicar em `enavia-brain` → aba "Policies"
3. Identificar a policy que permite `LIST` (ou `SELECT` com `storage.foldername` em branco)
4. Remover/desativar essa policy
5. Confirmar que a policy de `SELECT` por path (`storage.filename = 'nv_index.json'` ou equivalente) permanece ativa
6. Repetir para `enavia-brain-test`

---

## VALIDAÇÃO

### Prova 1 — runtime não quebrou (acesso por path continua)

```bash
# Executar de qualquer máquina com acesso à internet
# Resultado esperado: HTTP 200 + JSON válido com campo "modules"

curl -I "https://jsqvhmnjsbmtfyyukwsr.supabase.co/storage/v1/object/public/enavia-brain/nv_index.json?download=1"
# Critério de sucesso: HTTP/2 200
# Critério de falha: HTTP 400, 403, 404, ou 406
```

```bash
curl -I "https://jsqvhmnjsbmtfyyukwsr.supabase.co/storage/v1/object/public/enavia-brain/FINAL_NV/M12-AUTOPATCHENGINE-V1.txt?download=1"
# Critério de sucesso: HTTP/2 200
# Critério de falha: HTTP 400, 403, 404, ou 406
```

### Prova 2 — listagem pública foi removida

```bash
# Tentar listar objetos do bucket (deve falhar após a mudança)

curl -X POST "https://jsqvhmnjsbmtfyyukwsr.supabase.co/storage/v1/object/list/enavia-brain" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "offset": 0, "prefix": ""}' \
  -H "apikey: <anon_key_publica>"
# Critério de sucesso: HTTP 400 ou 403 (não autorizado a listar)
# Critério de falha: HTTP 200 com lista de objetos (listagem ainda aberta)
```

### Prova 3 — worker ENAVIA continua funcional após mudança

```bash
# Smoke test no worker PROD (requer INTERNAL_TOKEN)
curl -H "Authorization: Bearer ${INTERNAL_TOKEN}" \
  "https://nv-enavia.brunovasque.workers.dev/__internal__/build"
# Critério de sucesso: JSON com { "status": "ok", "env": "PROD" }
# Critério de falha: 500 ou ausência de nv_index_loaded: true

# Smoke test sem auth (health check)
curl "https://nv-enavia.brunovasque.workers.dev/"
# Critério de sucesso: HTTP 200 com lista de rotas
```

---

## CONTRATO FINAL ESPERADO DO BUCKET

Após aplicação da mudança, o contrato do bucket `enavia-brain` deve ser:

| Operação | Quem pode | Observação |
|----------|-----------|------------|
| GET `/object/public/{bucket}/{path}` | Qualquer um (público) | Worker depende disso |
| LIST `/object/list/{bucket}` | Ninguém (ou apenas service_role) | Nenhum código usa; excesso de permissão |
| INSERT / UPDATE / DELETE | service_role apenas | Gerenciado fora do worker |

Este é o contrato mínimo que preserva o runtime e reduz a exposição.

---

## PR / BRANCH / COMMIT / ROLLBACK

- **Branch:** `copilot/handle-supabase-storage-permissions`
- **PR:** [#10 — ENAVIA: Diagnóstico Supabase Storage](https://github.com/brunovasque/nv-enavia/pull/10)
- **Commit desta documentação:** ver abaixo
- **Rollback:** se a mudança no Dashboard afetar o runtime, reabilitar a policy de LIST (passos inversos acima) — a mudança no repo (este doc) pode permanecer sem impacto

---

## PROVAS

```
git remote -v
origin  https://github.com/brunovasque/nv-enavia (fetch)
origin  https://github.com/brunovasque/nv-enavia (push)
```

(Atualizado com HEAD após commit deste documento — ver seção de push abaixo)

---

## O QUE FICOU FORA

- Nenhuma mudança em `nv-enavia.js` (proibido pelo escopo)
- Nenhuma mudança em `wrangler.toml` (proibido pelo escopo)
- Nenhuma criação de pasta `supabase/` ou `migrations/` (sem padrão canônico)
- Nenhuma mudança de CORS, browser executor, deploy workflow
- A aplicação real da policy no Supabase Dashboard é **manual** — fora do escopo de automação deste repo
