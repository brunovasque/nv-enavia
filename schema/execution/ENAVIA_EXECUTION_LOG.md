# ENAVIA — Execution Log

Histórico cronológico de execuções de tarefas/PRs sob o contrato ativo.

---

## 2026-04-26 — Setup de governança

- **Branch:** `claude/setup-governance-files`
- **Escopo:** criar estrutura mínima de governança exigida por `CLAUDE.md`.
- **Ações:** Criados `schema/status/`, `schema/handoffs/`, `schema/execution/`.
- **Alterações em código de produção:** nenhuma.
- **Bloqueios:** nenhum.

---

## 2026-04-26 — PR1 — Worker-only — `GET /contracts/active-surface`

- **Branch:** `claude/pr1-active-surface`
- **Patch:** `contract-executor.js` — `handleGetActiveSurface` — additive (adicionados `source`, `contract`, `surface`; mantidos `active_state`, `adherence`).
- **Smoke tests:** `git diff` revisado manualmente.
- **Alterações em código de produção:** `contract-executor.js` — 1 função, additive.
- **Bloqueios:** nenhum.

---

## 2026-04-26 — PR2 — Executor-only — espelho governado do `enavia-executor`

- **Branch:** `claude/pr2-executor-governado`
- **Patch:** criação de `executor/` com 5 arquivos (cópia fiel do repo externo + documentação + smoke test).
- **Smoke tests:** `node executor/tests/executor.contract.test.js` → 23 passed, 0 failed.
- **Alterações em código de produção:** nenhuma (apenas arquivos novos).
- **Bug documentado para PR4:** linha 5722 de `nv-enavia.js` usa `https://executor.invalid/audit`.
- **Bloqueios:** nenhum.

---

## 2026-04-26 — PR3 — Panel-only — ligar painel no backend real

- **Branch:** `claude/pr3-panel-backend-real`
- **Diagnóstico:**
  - `panel/vercel.json` tinha `VITE_API_MODE: "mock"` hardcoded — forçava mock em produção.
  - `config.js` já tinha lógica correta: se `VITE_NV_ENAVIA_URL` definido → default "real". Mas `VITE_API_MODE: "mock"` sobrescrevia.
  - ContractPage, HealthPage, ExecutionPage já prontos para real mode — só faltava config correta.
- **Patch:** `panel/vercel.json`:
  - Adicionado: `VITE_NV_ENAVIA_URL: "https://nv-enavia.brunovasque.workers.dev"`
  - Alterado: `VITE_API_MODE: "mock"` → `"real"`
- **Smoke tests:**
  - Simulação de `config.js` com novos valores → `baseUrl: https://..., mode: real` ✅
  - `curl GET /contracts/active-surface` → 200, `{ ok: true, source: "active-contract" }` ✅
  - `curl GET /health` → 200, `{ ok: true, health: {...} }` ✅
  - `curl GET /execution` → 200, `{ ok: true, execution: {...} }` ✅
- **Alterações em código de produção:** `panel/vercel.json` — 1 linha adicionada, 1 linha alterada.
- **Worker/Executor:** nenhuma alteração confirmada via `git diff --name-only`.
- **Bloqueios:** nenhum.
- **Próxima etapa segura:** PR4 — Worker-only — fixes cirúrgicos de confiabilidade.
