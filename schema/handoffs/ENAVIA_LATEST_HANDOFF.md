# ENAVIA — Latest Handoff

**Data:** 2026-04-26
**De:** PR4 — Worker-only — fixes cirúrgicos de confiabilidade
**Para:** PR5 — Worker-only — observabilidade real mínima consolidada

## O que foi feito nesta sessão

### Contexto preservado
- PR1 — `GET /contracts/active-surface` já foi concluída e mergeada.
- PR2 — espelho governado do `enavia-executor` já foi concluída e mergeada.
- PR3 — painel ligado ao backend real já foi concluída e mergeada.
- Esta PR4 avançou somente em escopo Worker-only.

### Item 1 — URL `executor.invalid` (linha 5722) — CORRIGIDO
- **Problema:** `env.EXECUTOR.fetch("https://executor.invalid/audit", ...)` — hostname inválido.
- **Contexto:** chamada dentro do handler `/propose`. O payload usa `executor_action: "propose"` com `mode: "enavia_propose"`, que é roteado para `/audit` do executor.
- **Padrão existente correto:** linha 5971 usa `https://enavia-executor.internal/audit`.
- **Patch:** `executor.invalid` → `enavia-executor.internal` (1 linha, 1 arquivo).
- **Verificação:** `grep -c "executor.invalid" nv-enavia.js` → 0 ocorrências restantes ✅

### Item 2 — `ENAVIA_BUILD.deployed_at` — ATUALIZADO + LIMITAÇÃO DOCUMENTADA
- **Problema:** `deployed_at: "2025-01-21T00:00:00Z"` — data stale de 2025.
- **Diagnóstico:** Cloudflare Workers não expõem API de runtime para timestamp de deploy. Nenhum env var `DEPLOYED_AT` no `wrangler.toml`. Não há forma automática sem CI/CD injection.
- **Patch:** data atualizada para `"2026-04-26T00:00:00Z"` + comentário explicando que é atualização manual.
- **Caminho correto futuro:** injetar `DEPLOYED_AT` via `wrangler.toml [vars]` ou CI/CD env em build time.

### Item 3 — `consolidateAfterSave()` — FORA DO ESCOPO (dead code confirmado)
- **Diagnóstico:** função definida na linha 1325 de `nv-enavia.js`. Grep por chamadas retornou apenas a definição — **nunca é chamada em nenhum fluxo**.
- **Decisão:** manter como dead code por ora. Integrar requereria adicionar uma chamada no fluxo live de salvar memória (brain save path), o que seria mudança de comportamento — fora do escopo de PR4.
- **Nota para PR6:** `consolidateAfterSave()` pode ser avaliada como parte do loop supervisionado se fizer sentido automatizar a consolidação de memória após saves.

## O que NÃO foi alterado por escopo
- `panel/` — sem alteração
- `contract-executor.js` — sem alteração
- `executor/` — sem alteração
- `wrangler.toml` — sem alteração
- Qualquer outro handler ou função do Worker além dos dois pontos acima

## Estado do repo
- Branch: `claude/pr4-worker-confiabilidade`
- Arquivo funcional alterado: `nv-enavia.js` — 2 patches pontuais (URL + BUILD marker)
- Arquivos de governança atualizados: `schema/execution/ENAVIA_EXECUTION_LOG.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, `schema/status/ENAVIA_STATUS_ATUAL.md`

## Próxima ação segura PR5
1. Após merge da PR4, criar branch `claude/pr5-observabilidade-real`.
2. Ler todos os arquivos de governança na ordem obrigatória.
3. PR5 é Worker-only — adicionar/consolidar em `/health` e `/execution`:
   - contadores reais mínimos
   - últimos erros reais
   - execuções bloqueadas reais
   - execuções concluídas reais
4. Sem alterar shape de forma a quebrar o painel (backward-compat ou fallback documentado).
5. Sem alterar Panel ou Executor.

## Bloqueios
- nenhum
