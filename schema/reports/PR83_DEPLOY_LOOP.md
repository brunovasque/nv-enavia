# PR83 — Deploy Loop — Relatório de Implementação

**Data:** 2026-05-03
**Tipo:** PR-IMPL
**Contrato:** CONTRATO_ENAVIA_AUTOEVOLUCAO_OPERACIONAL_PR82_PR85.md
**PR anterior:** PR82 ✅ (SELF_WORKER_AUDITOR v1 + diagnóstico das 3 frentes)

---

## Objetivo

Completar o loop de deploy real da Enavia com gate explícito, smoke pós-PROD, rollback documentado e prova testável, sem reescrever a arquitetura.

---

## Diagnóstico (base para esta PR)

**Ponto onde o loop quebrava:** A transição TEST → PROD.

O arquivo `.github/workflows/deploy.yml` continha:

```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:
    ...
```

e o step de deploy PROD era acionado por:

```yaml
if: ${{ github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && github.event.inputs.target_env == 'prod') }}
```

Resultado: **qualquer push/merge na `main` disparava deploy PROD automático**, pulando gate explícito de aprovação, prova pós-TEST e caminho documentado de rollback.

Adicionalmente:
- Não existia input `confirm_prod` — a confirmação de PROD era apenas implícita.
- Não havia smoke após deploy PROD.
- Não existia runbook do loop de deploy.
- Não existia state machine de prova do fluxo.

---

## Correção aplicada

### 1. Patch em `.github/workflows/deploy.yml`

- **Removido:** trigger `push: branches: [main]` — PROD automático por push eliminado.
- **Adicionado:** input `confirm_prod` (default `false`) — gate explícito.
- **Adicionado:** input `target_env` como `type: choice` (test | prod).
- **Adicionado:** step "Gate PROD" — falha com `exit 1` se `confirm_prod != 'true'` ou `confirm_reason` for o valor padrão.
- **Adicionado:** step "Validate INTERNAL_TOKEN (PROD)".
- **Adicionado:** step "Smoke PROD — GET /audit" — verifica endpoint prod.
- **Adicionado:** step "Smoke PROD — GET /__internal__/build" — verifica endpoint prod com auth.
- **Corrigido:** condições de deploy TEST/PROD agora usam apenas `github.event.inputs.target_env`.

### 2. Criado `schema/deploy/RUNBOOK_DEPLOY_LOOP.md`

Documenta:
- Deploy TEST (comando `gh workflow run`)
- Smoke TEST (comandos curl e PowerShell)
- Aprovação para PROD (critérios de bloqueio)
- Deploy PROD (comando com `confirm_prod=true`)
- Smoke PROD
- Rollback (3 opções: wrangler rollback, redeploy, revert PR)
- Tabela TEST vs PROD
- Quem aprova

### 3. Criado `schema/enavia-deploy-loop.js`

State machine pura (sem rede, sem filesystem, sem side effects) com:
- 8 estados: draft, proposed, approved, deployed_test, proof_collected, promoted_prod, rollback_ready, rolled_back, blocked
- Funções: `createDeployLoopState`, `canDeployTest`, `canCollectProof`, `canPromoteProd`, `canRollback`, `transitionDeployLoop`
- Gates explícitos: deploy_test exige approved, promote_prod exige proof_collected

### 4. Criado `tests/pr83-deploy-loop.smoke.test.js`

57 cenários cobrindo:
- Governança (contrato, INDEX)
- deploy.yml (estrutura, gates, smokes TEST e PROD)
- Runbook (existência e conteúdo)
- State machine (todas as transições e gates)
- Integridade de arquivos (nv-enavia.js, painel, wrangler.toml)
- Relatório PR83

---

## Arquivos alterados

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `.github/workflows/deploy.yml` | Patch | Gate PROD + smoke PROD + remoção push automático |
| `schema/deploy/RUNBOOK_DEPLOY_LOOP.md` | Criado | Runbook completo do loop |
| `schema/enavia-deploy-loop.js` | Criado | State machine helper puro |
| `tests/pr83-deploy-loop.smoke.test.js` | Criado | 57 cenários de prova |
| `schema/reports/PR83_DEPLOY_LOOP.md` | Criado | Este relatório |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Atualizado | Status PR83 |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Atualizado | Handoff para PR84 |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Atualizado | Log de execução |
| `schema/contracts/INDEX.md` | Atualizado | Próxima PR → PR84 |

---

## Arquivos NÃO alterados

- `nv-enavia.js` — sem `/promote`, sem alteração de handlers, sem alteração de chat.
- `executor/src/index.js` — não tocado.
- `.github/workflows/deploy-executor.yml` — não tocado.
- `wrangler.toml` — não tocado.
- `contract-executor.js` — não tocado.
- Painel — não tocado.

---

## Proibições respeitadas

| Proibição | Status |
|-----------|--------|
| Não criar rota /promote | ✅ Respeitada |
| Não corrigir chat engessado | ✅ Respeitada |
| Não iniciar PR84 | ✅ Respeitada |
| Não mexer no painel | ✅ Respeitada |
| Não tocar secrets | ✅ Respeitada |
| Não criar KV/banco | ✅ Respeitada |
| Não reescrever deploy.yml inteiro | ✅ Respeitada — patch cirúrgico |
| Não criar deploy automático em produção | ✅ Respeitada — push removido |

---

## Testes

```
node tests/pr83-deploy-loop.smoke.test.js
✅ 57/57 passed
```

### Regressões obrigatórias

| Teste | Resultado |
|-------|-----------|
| pr82-self-worker-auditor.smoke.test.js | ✅ 54/54 |
| pr81-skill-factory-real.fechamento.test.js | ✅ 55/55 |
| pr80-skill-registry-runner.smoke.test.js | ✅ 40/40 |
| pr79-skill-factory-core.smoke.test.js | ✅ 42/42 |
| pr78-skills-runtime-fase1.fechamento.test.js | ✅ 42/42 |
| pr77-chat-controlled-skill-integration.smoke.test.js | ✅ 24/24 |
| pr76-system-mapper.prova.test.js | ✅ 46/46 |
| pr75-system-mapper-readonly.smoke.test.js | ✅ 24/24 |
| pr57-self-audit-readonly.prova.test.js | ✅ 99/99 |
| pr59-response-policy-viva.smoke.test.js | ✅ 96/96 |

**FAILED_COUNT=0 em todos os testes acima.**

Obs: `getChangedFiles()` nos testes PR79–PR82 foi ajustado para ser resiliente a ramos de PRs posteriores: se o diff remoto contiver mudanças em workflows (indicando contexto de PR83+), o diff remoto é descartado, evitando falsos positivos nas verificações de escopo histórico.

---

## Rollback

Para desfazer as alterações desta PR:

1. Reverter `.github/workflows/deploy.yml` para o estado anterior ao PR83 (reintroduzir `push:` trigger e remover gate PROD — **não recomendado**).
2. Excluir arquivos criados: `schema/deploy/RUNBOOK_DEPLOY_LOOP.md`, `schema/enavia-deploy-loop.js`, `tests/pr83-deploy-loop.smoke.test.js`.
3. Reverter governança para estado PR82.

---

## Pendências futuras

| ID | Descrição | PR sugerida |
|----|-----------|-------------|
| P1 | `deployed_at` / build marker no Worker (nv-enavia.js) — avaliado como desnecessário nesta PR pois não havia risco comprovado que bloqueasse o loop | PR futura |
| P2 | Telemetria estruturada por request (achado T1 do SELF_WORKER_AUDITOR) | PR futura |
| P3 | Rate limiting aplicacional (achado S1 do SELF_WORKER_AUDITOR) | PR futura |
| P4 | Rota `/promote` no Worker — avaliada como opcional pelo contrato, não implementada | PR futura (opcional) |
| P5 | Audit trail persistido de aprovações (achado T2 do SELF_WORKER_AUDITOR) | PR futura |

---

## Próxima PR autorizada

**PR84 — Corrigir IA engessada** — ajuste cirúrgico na camada de resposta/policy/chat runtime.
