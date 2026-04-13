# ENAVIA — Contrato do Braço GitHub/PR v1.0 (P24)

> Contrato canônico do braço GitHub/PR da Enavia.
> Versão: v1.0
> Data: 2026-04-13
> Status: ATIVO — com enforcement em runtime
> Implementação: `schema/github-pr-arm-contract.js`
> Testes: `tests/github-pr-arm-contract.smoke.test.js` (153 casos, 38 cenários)
> Fonte soberana: `schema/CONSTITUIÇÃO`
> Contrato superior: `schema/autonomy-contract.js` (P23)

---

## 1. Hierarquia de Fontes

| Nível | Arquivo | Papel |
|-------|---------|-------|
| **SOBERANA** | `schema/CONSTITUIÇÃO` | Princípios macro, ordem obrigatória |
| **INTERMEDIÁRIA** | `schema/autonomy-contract.js` | Contrato de autonomia P23 — base de governança |
| **SUBORDINADA** | `schema/github-pr-arm-contract.js` | Contrato do braço GitHub/PR — ESTE ARQUIVO |

Em caso de ambiguidade: CONSTITUIÇÃO > P23 > P24.

---

## 2. Divisão Operacional

| Domínio | Responsável |
|---------|-------------|
| Workers / Cloudflare / service binding / runtime / deploy worker | **Executor nativo** (separado) |
| Branch / PR / repo / review / correção / parecer / approval merge | **Braço GitHub/PR** (P24) |

Estas responsabilidades **não se misturam**.

---

## 3. Ações Permitidas Antes do Merge

| Ação | Descrição |
|------|-----------|
| `open_branch` | Abrir branch |
| `open_pr` | Abrir PR |
| `update_pr` | Atualizar PR |
| `comment_pr` | Comentar em PR |
| `review_diff` | Revisar diff |
| `audit_pr` | Auditar PR |
| `request_correction` | Pedir ajuste/correção |
| `self_correct_pr` | Corrigir a própria PR quando necessário para manter o objetivo |
| `organize_repo_within_scope` | Organizar o que já estiver aberto no repo dentro do escopo aprovado |

Todas são **autônomas** dentro do escopo aprovado. Nenhuma exige OK humano adicional.

---

## 4. Ações que Exigem Approval Formal

| Ação | Descrição |
|------|-----------|
| `merge_to_main` | Merge em main — **sempre** exige approval formal |

---

## 5. Condições Obrigatórias Antes de Marcar "Apto para Merge"

| Gate | Descrição |
|------|-----------|
| `contract_rechecked` | Reconferir o contrato |
| `phase_validated` | Validar fase/microfase |
| `no_regression` | Validar ausência de regressão |
| `diff_reviewed` | Revisar diff |
| `summary_reviewed` | Revisar resumo |
| `summary_for_merge_present` | Resumo do que foi feito (string não-vazia) |
| `reason_merge_ok_present` | Explicação curta do porquê está ok (string não-vazia) |

**Todas** devem passar. Se qualquer uma falhar, a PR **não pode** ser marcada como apta.

---

## 6. Ações Proibidas Incondicionalmente

| Ação | Descrição |
|------|-----------|
| `regress_contract` | Retroceder contrato |
| `regress_plan` | Retroceder plano |
| `regress_task` | Retroceder tarefa |
| `regress_pr` | Retroceder PR |
| `ignore_diff` | Deixar diff passar despercebido |
| `ignore_summary` | Deixar resumo passar despercebido |
| `generate_drift` | Gerar drift |
| `act_outside_scope` | Agir fora do escopo |
| `deviate_contract_without_escalation` | Desviar contrato sem escalar ao usuário |
| `mix_cloudflare_executor_with_github_arm` | Misturar executor Cloudflare com braço GitHub |
| `create_new_repo` | Criar repo novo nesta fase |
| `merge_without_summary` | Merge sem resumo |
| `merge_without_reason` | Merge sem explicação |
| `merge_without_approval` | Merge sem approval formal |
| `silent_merge` | Merge silencioso |

---

## 7. Enforcement em Runtime

### Ponto único: `enforceGitHubPrArm()`

`enforceGitHubPrArm()` é chamado antes de qualquer ação sensível do braço GitHub/PR.
Combina classificação + escopo + drift + regressão + P23 compliance + merge gate numa chamada só.

**Resultado sempre auditável:**
```
{ allowed, blocked, arm_id, action, level, reason, classification, p23_compliance, merge_gate }
```

### O que valida

| Verificação | Descrição |
|-------------|-----------|
| Pertencimento | Se a ação pertence ao braço GitHub/PR |
| Escopo | Escopo aprovado |
| Drift | Ausência de drift |
| Regressão | Ausência de regressão |
| P23 | Conformidade com contrato de autonomia (gates obrigatórios) |
| Merge readiness | Reconferência contratual + resumo + explicação antes de merge |
| Approval | Approval formal antes de merge em main |

### Se violar

- Bloqueia
- Explica o motivo (reason auditável)
- Não age

---

## 8. Gate Formal para Merge em Main

### Estado de merge: `MERGE_STATUS`

| Estado | Descrição |
|--------|-----------|
| `not_ready` | Condições de merge não satisfeitas |
| `awaiting_formal_approval` | Tudo ok, aguardando approval formal |
| `approved_for_merge` | Approval formal recebido — pode mergear |
| `merged` | Merge realizado |
| `blocked` | Merge bloqueado (ex: approval rejeitado) |

### Fluxo

1. Braço executa ações pré-merge (autônomas)
2. Quando pronto, chama `evaluateMergeReadiness()` com todas as condições
3. Se readiness ok, estado → `awaiting_formal_approval`
4. `buildMergeGateState()` combina readiness + approval
5. Approval formal (preferencial: botão no painel, fallback: chat)
6. Com approval → `approved_for_merge` → merge pode acontecer
7. Sem approval → bloqueado

### Exigências antes do merge

- `summary_for_merge` — resumo do que foi feito (obrigatório)
- `reason_merge_ok` — explicação curta do porquê está ok (obrigatório)
- Todas as 5 condições booleanas passaram
- Approval formal recebido

---

## 9. Funções Públicas

| Função | Descrição |
|--------|-----------|
| `classifyGitHubPrAction(action)` | Classifica ação no contexto do braço GitHub/PR |
| `evaluateMergeReadiness(context)` | Avalia todas as condições de merge readiness |
| `buildMergeGateState({...})` | Constrói o estado do gate de merge |
| **`enforceGitHubPrArm({...})`** | **Ponto único de enforcement em runtime do P24** |

---

## 10. Arquivo Canônico

- **Schema:** `schema/github-pr-arm-contract.js`
- **Testes:** `tests/github-pr-arm-contract.smoke.test.js` (153 casos, 38 cenários)
- **Docs:** `docs/ENAVIA_GITHUB_PR_ARM_CONTRACT_P24.md` (este arquivo)
- **Fonte soberana:** `schema/CONSTITUIÇÃO`
- **Contrato superior:** `schema/autonomy-contract.js` (P23)

---

## 11. O que NÃO está neste contrato

- Executor Cloudflare (Workers/runtime/deploy)
- Browser executor (P25)
- Deploy/test como braço (P26)
- LLM / embeddings
- Persistência / I/O direto
- Criação de repo novo
- UX final do botão de approval (base de runtime/gate existe)

---

## 12. Prova de Não-Regressão

Todos os testes existentes passaram após a adição do P24:

| Arquivo de teste | Resultado |
|-----------------|-----------|
| `github-pr-arm-contract.smoke.test.js` | 153 passed, 0 failed |
| `autonomy-contract.smoke.test.js` | 119 passed, 0 failed |
| `contracts-smoke.test.js` | 1187 passed, 0 failed |
| `contract-adherence-gate-integration.smoke.test.js` | 40 passed, 0 failed |
| `contract-adherence-gate.smoke.test.js` | 68 passed, 0 failed |
| `contract-final-audit.smoke.test.js` | 146 passed, 0 failed |
| `decision-history.smoke.test.js` | 63 passed, 0 failed |
| `exec-event.smoke.test.js` | 57 passed, 0 failed |
| `execution-audit.smoke.test.js` | 142 passed, 0 failed |
| `execution-trail.smoke.test.js` | 51 passed, 0 failed |
| `pipeline-end-to-end.integration.test.js` | 52 passed, 0 failed |
| ... (todos os demais) | 0 failed |
