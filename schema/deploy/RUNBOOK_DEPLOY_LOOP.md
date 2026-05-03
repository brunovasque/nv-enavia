# RUNBOOK — Deploy Loop Enavia

**Versão:** 1.0.0 (2026-05-03)
**Contrato:** CONTRATO_ENAVIA_AUTOEVOLUCAO_OPERACIONAL_PR82_PR85
**Workflow principal:** `.github/workflows/deploy.yml`

---

## Fluxo esperado

```
pedido/plano → aprovação → deploy TEST → smoke TEST → aprovação PROD → deploy PROD → smoke PROD → rollback ready
```

---

## 1. Deploy TEST

### Pré-requisitos
- Branch mergeada na `main` (ou PR aprovada, dependendo da convenção).
- Secret `CLOUDFLARE_API_TOKEN` configurado no repo.
- Secret `CLOUDFLARE_ACCOUNT_ID` configurado no repo.
- Secret `INTERNAL_TOKEN` configurado no repo.

### Comando (GitHub CLI)
```bash
gh workflow run deploy.yml \
  -f target_env=test \
  -f confirm_reason="deploy test — PR83"
```

### O que acontece
1. Valida placeholders no `wrangler.toml`.
2. Valida secrets obrigatórios.
3. Faz deploy `--env test` via Wrangler.
4. Executa Smoke TEST — GET `/audit` no endpoint `enavia-worker-teste.brunovasque.workers.dev`.
5. Executa Smoke TEST — GET `/__internal__/build` (com `Authorization: Bearer $INTERNAL_TOKEN`).

### Critério de sucesso
- HTTP 200 em ambos os smokes.

---

## 2. Smoke TEST

Os smokes são executados automaticamente pelo workflow após o deploy TEST.

### Smoke manual (PowerShell)
```powershell
# GET /audit
$r = Invoke-WebRequest -Uri "https://enavia-worker-teste.brunovasque.workers.dev/audit"
$r.StatusCode  # deve ser 200

# GET /__internal__/build
$token = $env:INTERNAL_TOKEN
$headers = @{ "Authorization" = "Bearer $token" }
$r = Invoke-WebRequest -Uri "https://enavia-worker-teste.brunovasque.workers.dev/__internal__/build" -Headers $headers
$r.StatusCode  # deve ser 200
```

### Smoke manual (bash/curl)
```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://enavia-worker-teste.brunovasque.workers.dev/audit

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $INTERNAL_TOKEN" \
  https://enavia-worker-teste.brunovasque.workers.dev/__internal__/build
```

### Critério de bloqueio
Se qualquer smoke retornar diferente de 200, **não avançar para PROD**. Investigar causa e abrir PR de correção.

---

## 3. Aprovação para PROD

Antes de fazer deploy PROD, o operador deve:

1. Confirmar que os smokes TEST passaram (evidência no log do workflow).
2. Decidir que o código está pronto para produção.
3. Ter em mãos uma razão descritiva para o deploy (ex: "PR83 — gate de deploy corrigido").

**Critérios de bloqueio para PROD:**
- Smoke TEST com falha.
- Nenhuma prova de validação em TEST.
- `confirm_prod` diferente de `'true'`.
- `confirm_reason` vazio ou igual ao valor padrão `"bootstrap governance"`.

---

## 4. Deploy PROD

### Comando (GitHub CLI)
```bash
gh workflow run deploy.yml \
  -f target_env=prod \
  -f confirm_prod=true \
  -f confirm_reason="PR83 — gate de deploy corrigido, smoke TEST passou"
```

### O que acontece
1. Valida secrets obrigatórios.
2. **Gate PROD:** verifica `confirm_prod=true` e `confirm_reason` descritivo — falha se não satisfeito.
3. Valida `INTERNAL_TOKEN`.
4. Faz deploy padrão (sem `--env`) via Wrangler.
5. Executa Smoke PROD — GET `/audit` no endpoint `enavia-worker.brunovasque.workers.dev`.
6. Executa Smoke PROD — GET `/__internal__/build` (com `Authorization: Bearer $INTERNAL_TOKEN`).

### Critério de sucesso
- Gate PROD passou.
- HTTP 200 em ambos os smokes PROD.

---

## 5. Smoke PROD

Os smokes são executados automaticamente pelo workflow após o deploy PROD.

### Smoke manual (bash/curl)
```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://enavia-worker.brunovasque.workers.dev/audit

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $INTERNAL_TOKEN" \
  https://enavia-worker.brunovasque.workers.dev/__internal__/build
```

### Critério de bloqueio
Se qualquer smoke PROD falhar, execute rollback imediatamente (seção 6).

---

## 6. Rollback

### Quando usar
- Smoke PROD falhou.
- Comportamento inesperado detectado em produção após o deploy.
- Monitoramento indica aumento de erros.

### Procedimento de rollback

**Opção A — Reverter deploy via Wrangler (mais rápido)**

Identifique o deployment ID anterior via Cloudflare Dashboard ou:
```bash
npx wrangler deployments list
```

Faça rollback para o deployment anterior:
```bash
npx wrangler rollback <deployment-id>
```

**Opção B — Redeployar versão anterior via workflow**

1. Identifique o commit anterior estável: `git log --oneline main`.
2. Crie branch de hotfix a partir do commit estável.
3. Force-push ou abra PR de reverção.
4. Rode `gh workflow run deploy.yml -f target_env=prod -f confirm_prod=true -f confirm_reason="rollback — reverter para versão estável anterior"`.

**Opção C — Reverter PR no GitHub**

1. Abra a PR no GitHub.
2. Clique em "Revert" para criar PR de reversão automaticamente.
3. Mergear PR de reversão na `main`.
4. Executar deploy PROD com gate.

### Validação pós-rollback
```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://enavia-worker.brunovasque.workers.dev/audit
# deve retornar 200
```

---

## 7. Quem aprova

| Ação | Aprovação necessária |
|------|---------------------|
| Deploy TEST | Qualquer mantenedor do repo |
| Deploy PROD | Mantenedor sênior (Bruno Vasques ou delegado explícito) |
| Rollback PROD | Mantenedor sênior — ação urgente, pode ser imediata |

---

## 8. Separação TEST / PROD

| Aspecto | TEST | PROD |
|---------|------|------|
| Endpoint Worker | `enavia-worker-teste.brunovasque.workers.dev` | `enavia-worker.brunovasque.workers.dev` |
| Wrangler env | `--env test` | sem `--env` (default) |
| Gate de confirmação | Não exigido | `confirm_prod=true` obrigatório |
| Deploy automático por push | **Não** (removido PR83) | **Não** (removido PR83) |

---

## 9. Critérios de bloqueio resumidos

- Push na `main` **não** dispara deploy PROD (removido em PR83).
- Deploy PROD sem `confirm_prod=true` → workflow falha com exit 1.
- Deploy PROD com `confirm_reason` padrão → workflow falha.
- Smoke falha → workflow falha com exit 1 — não avançar.
- Sem prova de TEST → não promover para PROD.
