# PR106 — PROVA REAL COMPLETA
# GitHub Bridge — Branch + Commit + PR Real Supervisionados

**Data:** 2026-05-04  
**Branch:** `copilot/pr106-github-bridge-branch-commit-pr`  
**PR GitHub:** #272  
**Repo testado:** `brunovasque/nv-enavia`  
**Token:** `GITHUB_TOKEN` (escopo `repo` — valor redactado)  
**Contrato:** `docs/CONTRATO_ENAVIA_GITHUB_BRIDGE_PR106.md`

---

## Resultado

```
✅ PR106 prova real: 24/24 testes passando
```

---

## Output completo da execução

```
============================================================
PR106 — Prova real supervisionada: Branch + Commit + PR
============================================================

[1] Invariantes de create_commit — bloqueios antes do fetch
  ✅ 1.1 create_commit em "main" retorna blocked=true
  ✅ 1.2 create_commit em "master" retorna blocked=true
  ✅ 1.3 create_commit com content vazio retorna erro antes do fetch
  ✅ 1.4 create_commit com branch ausente retorna erro
  ✅ 1.5 create_commit sem token retorna erro GITHUB_TOKEN
  ✅ 1.6 create_commit em feature branch não bloqueia antes do fetch (chega ao network)

[2] Invariantes de open_pr — campos obrigatórios
  ✅ 2.1 open_pr sem title retorna erro
  ✅ 2.2 open_pr sem head retorna erro
  ✅ 2.3 open_pr sem base retorna erro
  ✅ 2.4 open_pr sem token retorna erro GITHUB_TOKEN
  ✅ 2.5 token não aparece em nenhum campo da resposta de open_pr

[3] Constantes de invariante — SUPPORTED_OPERATIONS e ALWAYS_BLOCKED
  ✅ 3.1 ALWAYS_BLOCKED contém merge, deploy_prod, secret_change
  ✅ 3.2 SUPPORTED_OPERATIONS inclui as 4 operações PR106
  ✅ 3.3 merge bloqueado mesmo com token válido e operação válida
  ✅ 3.4 PROTECTED_BRANCHES implica bloqueio em create_commit — nenhum dos dois executa fetch

[4] Bloqueio de commit em main/master — ambas as camadas
  ✅ 4.1 executeGithubBridgeRequest bloqueia create_commit em main
  ✅ 4.2 attempt_event registrado mesmo para bloqueio em main
  ✅ 4.3 merge sempre bloqueado via executeGithubBridgeRequest
  ✅ 4.4 token não aparece em nenhum campo da resposta de bloqueio de commit/main

[5] Prova real com GITHUB_TOKEN — repo: brunovasque/nv-enavia
    Branch de teste: test/pr106-prova-1777946218829
    ATENÇÃO: executará operações reais no GitHub (branch + commit + PR)
  ✅ 5.1 create_branch real com SHA base dinâmico
  ✅ 5.2 create_commit real com base64 na branch de teste
         PR criada: #273 — https://github.com/brunovasque/nv-enavia/pull/273
  ✅ 5.3 open_pr real retorna número e URL da PR criada
         PR #273 state=open merged=false
  ✅ 5.4 merge_allowed=false na PR criada (gate humano confirmado)
         PR #273 fechada ✅
         Branch test/pr106-prova-1777946218829 deletada ✅
  ✅ 5.5 limpeza: fechar PR de teste e deletar branch após prova

============================================================
✅ PR106 prova real: 24/24 testes passando
```

---

## Regressão

| Suite | Resultado |
|-------|-----------|
| PR106 prova real (Grupos 1–5) | **24/24 ✅** |
| PR105 prova real | **16/16 ✅** |
| Interop CJS/ESM | **32/32 ✅** |

---

## Evidências do Grupo 5 (ciclo real)

| Etapa | Evidência |
|-------|-----------|
| Branch criada | `test/pr106-prova-1777946218829` (deletada após prova) |
| Commit criado | arquivo de evidência com base64 na branch de teste |
| PR aberta | [#273](https://github.com/brunovasque/nv-enavia/pull/273) |
| PR state | `open` (confirmado via GET /pulls/273) |
| `merge_allowed` | `false` — invariante respeitado |
| PR fechada | ✅ (limpeza automática) |
| Branch deletada | ✅ (limpeza automática) |

---

## Fix aplicado durante prova

**Causa da falha inicial (2 testes):** `_executeOpenPr` lia `operation.head`/`operation.base`, mas o
validator PR103 exige `head_branch`/`base_branch` para `open_pr`. O pipeline bloqueava antes de chegar
ao adapter.

**Fix (commit `f78b...`):** `_executeOpenPr` agora aceita ambas as nomenclaturas:
- `head_branch || head` (compatível com validator PR103 e alias direto)
- `base_branch || base` (compatível com validator PR103 e alias direto)

Teste 5.3 atualizado para enviar `head_branch`/`base_branch` (satisfaz o validator).

---

## Critérios do contrato — status final

| Critério | Status |
|----------|--------|
| `create_branch` com SHA base dinâmico | ✅ |
| `create_commit` com base64 e create+update | ✅ |
| `open_pr` retorna número e URL | ✅ |
| Bloqueio main/master duplo | ✅ |
| Safety Guard antes de toda operação | ✅ |
| Event Log tentativa + resultado | ✅ |
| `merge_allowed=false` sempre | ✅ |
| Token não exposto em nenhum campo | ✅ |
| Prova real completa: branch → commit → PR sem merge | ✅ |
| PR de teste criada, fechada e branch deletada | ✅ |
| Nenhum teste anterior quebrado | ✅ |
| PR revisada e aprovada por Bruno | ⏳ pendente |
