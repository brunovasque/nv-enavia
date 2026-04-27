# ENAVIA — Execution Log

Histórico cronológico de execuções de tarefas/PRs sob o contrato ativo.

---

## 2026-04-26 — Setup de governança

- **Branch:** `claude/setup-governance-files`
- **Escopo:** criar estrutura mínima de governança exigida por `CLAUDE.md`.
- **Ações:**
  - Validado `CLAUDE.md` na raiz.
  - Confirmado contrato ativo `schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md`.
  - Criadas pastas: `schema/status/`, `schema/handoffs/`, `schema/execution/`.
  - Criados arquivos:
    - `schema/status/ENAVIA_STATUS_ATUAL.md`
    - `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
    - `schema/execution/ENAVIA_EXECUTION_LOG.md` (este arquivo)
- **Smoke tests:** `git status` + verificação de existência dos arquivos.
- **Alterações em código de produção:** nenhuma.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR1 — active surface em branch separada.

---

## 2026-04-26 — PR1 — Worker-only — `GET /contracts/active-surface`

- **Branch:** `claude/pr1-active-surface`
- **Escopo:** Worker-only. Sem tocar Panel, sem tocar lógica de execução.
- **Diagnóstico:**
  - Rota `GET /contracts/active-surface` já existia em `nv-enavia.js` linha 6937.
  - Handler: `handleGetActiveSurface` em `contract-executor.js` linha 3597.
  - CORS: aplicado via `jsonResponse → withCORS` (ok).
  - Shape anterior: `{ ok, active_state, adherence }` — Panel lê `active_state` e `adherence`.
  - Shape exigido por PR1: adicionar `source`, `contract`, `surface`.
- **Ações:**
  - Patch cirúrgico em `contract-executor.js` função `handleGetActiveSurface`:
    - Adicionados: `source: "active-contract"`, `contract: { id, title, status, current_phase, current_pr, updated_at }`, `surface: { available, next_action, blocked, block_reason }`.
    - Mantidos: `active_state` e `adherence` (backward-compat com Panel).
    - `current_pr` usa `state.current_task` como fallback explícito (campo dedicado inexistente — documentado).
- **Smoke tests:**
  - `git diff contract-executor.js` — revisado manualmente, apenas `handleGetActiveSurface` alterada.
  - Estrutura de resposta verificada contra shape do contrato.
- **Alterações em código de produção:** `contract-executor.js` — 1 função, additive only.
- **Bloqueios:** nenhum.
- **Status:** mergeada na main.
- **Próxima etapa segura:** PR2 — Executor-only.

---

## 2026-04-26 — PR2 — Executor-only — espelho governado do `enavia-executor`

- **Branch:** `claude/pr2-executor-governado`
- **Escopo:** Executor-only. Sem alterar Worker, Panel, deploy externo, Service Binding.
- **Diagnóstico:**
  - `enavia-executor` é Cloudflare Worker separado em repo privado `brunovasque/enavia-executor`.
  - Nenhuma pasta `executor/` existia no repo `nv-enavia`.
  - Código-fonte acessado via GitHub API com autenticação `gh`.
  - `src/index.js` do executor: 247.531 bytes, rotas confirmadas: `/health`, `/audit`, `/propose`, `/engineer`, `/engineer-core`, `/boundary`, `/status`.
  - Bug documentado: linha 5722 de `nv-enavia.js` usa `https://executor.invalid/audit` — URL inválida, a ser corrigida em PR4.
- **Ações:**
  - Criada pasta `executor/` com 5 arquivos:
    - `executor/src/index.js` — cópia fiel do repo externo (245.762 chars)
    - `executor/wrangler.toml` — referência sanitizada (sem IDs/secrets reais)
    - `executor/README.md` — explica espelho governado, Service Binding, deploy externo
    - `executor/CONTRACT.md` — contrato canônico: entradas, saídas, rotas, compatibilidade
    - `executor/tests/executor.contract.test.js` — smoke test estático
- **Smoke tests:**
  - `node executor/tests/executor.contract.test.js` → 23 passed, 0 failed
  - `git status` → apenas `executor/` como novo, sem alterações em Worker/Panel
- **Alterações em código de produção:** nenhuma (apenas arquivos novos em `executor/`)
- **Bloqueios:** nenhum.
- **Status:** mergeada na main.
- **Próxima etapa segura:** PR3 — Panel-only — ligar painel no backend real.

---

## 2026-04-26 — PR3 — Panel-only — ligar painel no backend real

- **Branch:** `claude/pr3-panel-backend-real`
- **Escopo:** Panel-only. Sem alterar Worker, Executor, deploy externo, Service Binding ou componentes React.
- **Diagnóstico:**
  - `panel/vercel.json` tinha `VITE_API_MODE: "mock"` hardcoded — forçava mock em produção.
  - `panel/src/api/config.js` já tinha lógica correta: se `VITE_NV_ENAVIA_URL` estiver definido, o default é `real`.
  - O `VITE_API_MODE: "mock"` explícito sobrescrevia esse default.
  - ContractPage, HealthPage e ExecutionPage já estavam preparados para modo real — faltava apenas a configuração de deploy.
- **Ações:**
  - Patch cirúrgico em `panel/vercel.json`:
    - Adicionado `VITE_NV_ENAVIA_URL: "https://nv-enavia.brunovasque.workers.dev"`.
    - Alterado `VITE_API_MODE: "mock"` para `VITE_API_MODE: "real"`.
- **Smoke tests:**
  - Simulação de `config.js` com novos valores → `baseUrl: https://nv-enavia.brunovasque.workers.dev`, `mode: real`.
  - `curl GET /contracts/active-surface` → 200, `{ ok: true, source: "active-contract" }`.
  - `curl GET /health` → 200, `{ ok: true, health: {...} }`.
  - `curl GET /execution` → 200, `{ ok: true, execution: {...} }`.
- **Alterações em código de produção:** `panel/vercel.json` — 1 linha adicionada, 1 linha alterada.
- **Worker/Executor:** nenhuma alteração.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR4 — Worker-only — fixes cirúrgicos de confiabilidade.
