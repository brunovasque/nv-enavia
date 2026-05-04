# PR102 — GitHub Bridge Real — Diagnóstico READ-ONLY

**Data:** 2026-05-04  
**Tipo:** PR-DIAG (read-only)  
**Contrato ativo:** `CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md`  
**Escopo:** contrato + diagnóstico + prova + governança mínima (sem runtime)

---

## Validações prévias obrigatórias

1. `schema/contracts/ACTIVE_CONTRACT.md` estava sem contrato ativo e aguardando próxima fase formal antes desta PR.  
2. PR98–PR101 estavam encerradas em `ACTIVE_CONTRACT.md`, `INDEX.md` e relatório PR101.  
3. PR90–PR93 estavam encerradas em `ACTIVE_CONTRACT.md`, `INDEX.md` e relatório PR93.  
4. Diagnóstico executado em modo read-only antes de criar contrato/relatório/prova desta PR.

---

## 1) O que já existe de GitHub Bridge?

### Classificação objetiva

| Item | Classificação | Evidência |
|---|---|---|
| Contrato do braço GitHub/PR (`schema/github-pr-arm-contract.js`) | código real (enforcement lógico) | Catálogo `open_branch/open_pr/update_pr/comment_pr/merge_to_main` + gates de merge/readiness |
| Runtime do braço GitHub em `contract-executor.js` | código real (lógico) | `executeGitHubPrAction`, `requestMergeApproval`, `approveMerge`, handlers HTTP |
| Rotas HTTP no worker (`nv-enavia.js`) | código real (superfície) | `POST /github-pr/action`, `POST /github-pr/request-merge`, `POST /github-pr/approve-merge` |
| Painel para approval de merge (`panel/src/execution/MergeGateCard.jsx`) | parcial | UI só para aprovação formal do merge gate; não cria branch/PR/comment |
| Testes P24 (`tests/github-pr-arm-contract.smoke.test.js`, `tests/github-pr-arm-runtime.integration.test.js`) | teste | Cobrem enforcement/gates, sem chamada GitHub real |
| Adapter real GitHub API (REST/App/Octokit) | ausente | Não há `api.github.com`, `octokit`, `GITHUB_TOKEN` em runtime desse fluxo |
| Event log de operação GitHub real | parcial | Helper PR99 existe, mas `github_bridge` ainda `unknown/future` por design |

---

## 2) O que já existe para branch/PR/comment/merge/deploy?

- `branch`: **parcial** — ação lógica `open_branch` no contrato P24 e runtime enforcement, sem API real.
- `open PR`: **parcial** — ação lógica `open_pr`, sem API real.
- `update PR`: **parcial** — ação lógica `update_pr`, sem API real.
- `comment PR`: **parcial** — ação lógica `comment_pr`, sem API real.
- `merge`: **supervisionado/proibido automático** — só via gate formal (`request-merge` + `approve-merge`), sem merge automático.
- `deploy TEST`: **código real** — deploy worker/workflows manuais supervisionados.
- `deploy PROD`: **supervisionado/proibido automático** — `workflow_dispatch` + `confirm_prod=true` + `confirm_reason`.

---

## 3) O que já existe de permissões/tokens?

### Mapeamento por nome esperado (sem expor segredo)

- **GitHub bridge real (ainda ausente no runtime):** não há uso ativo de `GITHUB_TOKEN`, `GITHUB_APP`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`.
- **Deploy/workflows atuais:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_TOKEN`.
- **Runtime worker/executor atual:** `INTERNAL_TOKEN`, `BROWSER_EXECUTOR_URL`, `ENAVIA_EXECUTOR_URL`, `DEPLOY_WORKER_URL`, `OPENAI_MODEL`, `SUPABASE_URL`.

---

## 4) Safety Guard aplicável ao GitHub

- PR100 (`schema/enavia-safety-guard.js`) já cobre decisões de risco para `merge`, `deploy_prod`, `secret_change`, `external_integration` e exige gate humano quando necessário.
- PR99 (`schema/enavia-event-log.js`) já permite registrar evento estruturado por subsistema (incluindo `github_bridge`).
- PR99 (`schema/enavia-health-snapshot.js`) já inclui `github_bridge` no snapshot (hoje como `unknown/future`).
- PR100 (`schema/enavia-anti-loop.js`) já permite detectar loops destrutivos se operações GitHub passarem a gerar eventos.

Conclusão de proteção: a base de guardrails existe; falta plugar as operações GitHub reais nessa base.

---

## 5) Lacuna exata

**“falta um adapter GitHub autenticado (branch/PR/comment) entre o pacote PR-ready atual e a ação GitHub real supervisionada.”**

---

## 6) Quais arquivos vivos comandam PR Orchestrator atual?

- `nv-enavia.js`
- `contract-executor.js`
- `executor/src/index.js`
- `schema/enavia-pr-planner.js`
- `schema/enavia-pr-executor-supervised.js`
- `schema/enavia-pr-readiness.js`
- `schema/github-pr-arm-contract.js`
- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-executor.yml`
- `wrangler.toml`

---

## 7) Quais arquivos são só documentais?

- `schema/contracts/ACTIVE_CONTRACT.md`
- `schema/contracts/INDEX.md`
- `schema/contracts/active/CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md`
- `schema/reports/PR102_GITHUB_BRIDGE_REAL_DIAGNOSTICO.md`
- `schema/reports/PR101_OBSERVABILIDADE_AUTOPROTECAO_FINAL.md`
- `schema/reports/PR100_SAFETY_GUARD_ANTI_AUTODESTRUICAO.md`
- `schema/reports/PR99_EVENT_LOG_HEALTH_SNAPSHOT.md`
- `schema/reports/PR93_READY_FOR_MERGE_DEPLOY_TEST.md`
- `schema/reports/PR90_PR_ORCHESTRATOR_DIAGNOSTICO.md`
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`

---

## 8) O que NÃO deve ser refatorado

Preservar sem refatorar nesta frente:

- PR Orchestrator PR90–PR93
- Chat Livre + Cockpit PR94–PR97
- Observabilidade + Autoproteção PR98–PR101
- Deploy loop PR86–PR89
- Skill Factory/Runner
- SELF_WORKER_AUDITOR
- gates humanos
- bloqueios de PROD/merge/secrets

---

## 9) Menor patch recomendado para PR103 (máx. 5 mudanças)

1. Criar `schema/enavia-github-bridge.js` (helper puro) com `plan_create_branch`, `plan_open_pr`, `plan_update_pr`, `plan_comment_pr`.  
2. Adicionar `validate_github_operation(op, context)` com deny-by-default e bloqueio de merge/prod/secrets.  
3. Adicionar `build_github_operation_event(op, result)` para integrar Event Log (sem runtime ainda).  
4. Criar `tests/pr103-github-bridge-helper-supervisionado.prova.test.js` cobrindo shape, bloqueios e ausência de side effects.  
5. Criar `schema/reports/PR103_GITHUB_BRIDGE_HELPER_SUPERVISIONADO.md` + governança mínima.

---

## 10) Menor patch recomendado para PR104 (máx. 5 mudanças)

1. Integrar helper PR103 ao runtime em um único ponto controlado (sem endpoint novo se possível, reaproveitando fluxo supervisionado existente).  
2. Envolver toda operação GitHub com `evaluateSafetyGuard` antes de executar.  
3. Gerar `createEnaviaEvent`/snapshot de operação GitHub em cada tentativa (sucesso/bloqueio/falha).  
4. Exigir aprovação humana para qualquer operação classificada como `require_human_review`/`block`, com travas explícitas para merge/prod.  
5. Criar prova PR104 de integração mínima supervisionada sem auto-merge e sem auto-deploy.

---

## 11) Riscos

- **Baixo:** regressão documental/governança (mitigado com provas).  
- **Médio:** plugar runtime sem quebrar fluxo atual de PR Orchestrator/deploy loop.  
- **Alto:** uso incorreto de token/app GitHub sem Safety Guard/event log/gate humano.

---

## 12) Conclusão

Recomendação para PR103: **E) combinação mínima**.

- **A + B** na PR103: helper/schema puro + adapter real isolado, ainda sem acoplamento forte no runtime.
- **D** fica para PR104: runtime mínimo supervisionado.
- **C** (endpoint novo) só se estritamente necessário após prova de que reaproveitar superfície atual não é suficiente.

---

## Evidências-chave usadas no diagnóstico

- `schema/github-pr-arm-contract.js` (catálogo e enforcement lógico P24)
- `contract-executor.js` (funções e handlers runtime do braço GitHub)
- `nv-enavia.js` (rotas `/github-pr/*`)
- `tests/github-pr-arm-contract.smoke.test.js`
- `tests/github-pr-arm-runtime.integration.test.js`
- `schema/enavia-event-log.js`
- `schema/enavia-health-snapshot.js`
- `schema/enavia-safety-guard.js`
- `schema/enavia-anti-loop.js`
- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-executor.yml`
- `wrangler.toml`

---

## Garantias desta PR

- Nenhuma chamada GitHub real executada.
- Nenhuma alteração de runtime.
- Nenhuma alteração de painel.
- Nenhum endpoint novo.
- Nenhum binding novo.
- Nenhum merge/deploy executado.

Próxima PR liberada: **PR103 — GitHub Bridge helper real supervisionado**.
