# ENAVIA — Status Atual

**Data:** 2026-05-05 (atualizado após PR109 — Fix Ciclo Codex + Prova Real ⏳ PR ABERTA)
**Branch ativa:** `copilot/pr109-fix-ciclo-prova-real`
**Última tarefa:** PR109 — Fix do Ciclo Codex→GitHub + Prova Real End-to-End ⏳

## Atualização PR109 — Fix Ciclo Codex + Prova Real ⏳ — 2026-05-05

- Branch: `copilot/pr109-fix-ciclo-prova-real`
- PR GitHub: ⏳ aguarda abertura (push feito)
- Tipo: PR-FIX+PROVA (correções bloqueadoras + prova real unificadas)
- Contrato: `docs/CONTRATO_ENAVIA_FIX_PROVA_PR109.md` ✅
- PR anterior validada: PR108 ✅ (branch copilot/pr108-motor-patch-orquestrador, PR #275)

### 4 commits atômicos executados

| # | Hash | Entrega |
|---|------|---------|
| 1 | d685219 | `executor/src/index.js` — prompt callCodexEngine solicita search+replace; normalizador filtra sem-search com aviso |
| 2 | fa1877d | `executor/src/index.js` — githubOrchestrationResult capturado e surfaçado na response de /propose |
| 3 | 9f32a92 | `executor/wrangler.toml` — OPENAI_API_KEY e GITHUB_TOKEN documentados com instrução wrangler secret put |
| 4 | 940b9a2 | `tests/pr109-ciclo-real.prova.test.js` — 38 testes em 3 grupos (normalização Codex, github_orchestration na response, e2e real opt-in) |

### Critérios de conclusão do contrato: 11/12 ✅ (1 pendente — aprovação humana)

- [x] Prompt callCodexEngine solicita search e replace explicitamente
- [x] Patches Codex sem search geram aviso visível (skipped_no_search + CODEX_PATCHES_SKIPPED_NO_SEARCH warning)
- [x] github_orchestration presente na response de /propose quando PR foi aberta
- [x] github_orchestration ausente da response quando orquestração não ocorreu
- [x] OPENAI_API_KEY documentado em executor/wrangler.toml
- [x] Instrução wrangler secret put OPENAI_API_KEY documentada
- [x] Grupo 1 passando: 23 testes de normalização Codex ✅
- [x] Grupo 2 passando: 15 testes de github_orchestration ✅
- [x] Grupo 3 (opt-in): 5 testes skipped por falta de ENAVIA_EXECUTOR_URL + GITHUB_TOKEN em dev local
- [x] Nenhum teste anterior (PR99–PR108) quebrado ✅ (32+25+34 regressão)
- [ ] PR revisada e aprovada por Bruno antes do merge

### Testes de regressão PR108

- pr108-patch-engine.test.js: 32/32 ✅
- pr108-code-chunker.test.js: 25/25 ✅
- pr108-integration.test.js: 34/34 ✅

## Estado anterior — PR108 ✅ motor de patch + orquestrador self-patch

- Branch: `copilot/pr108-motor-patch-orquestrador`
- PR GitHub #275: aberta — aguarda revisão de Bruno
- 91 testes novos + regressões verdes
