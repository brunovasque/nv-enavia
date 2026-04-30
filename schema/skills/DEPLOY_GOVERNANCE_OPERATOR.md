# ENAVIA Skill — Deploy Governance Operator

**Versão:** PR27 — 2026-04-30
**Tipo:** Skill supervisionada
**Status:** Ativa — documental
**Contrato de origem:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
**Documentos relacionados:**
- `schema/skills/CONTRACT_LOOP_OPERATOR.md` — skill anterior (PR26)
- `schema/system/ENAVIA_WORKER_REGISTRY.md` — inventário de infraestrutura (PR25)
- `schema/system/ENAVIA_ROUTE_REGISTRY.json` — registry de 68 rotas HTTP (PR23)
- `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` — playbook operacional (PR24)
- `schema/system/ENAVIA_SYSTEM_MAP.md` — mapa macro do sistema (PR22)

---

## 1. Identidade da skill

| Atributo | Valor |
|----------|-------|
| **Nome** | Deploy Governance Operator |
| **Tipo** | Skill supervisionada |
| **Escopo** | Governança de deploy, rollback e promoção TEST/PROD |
| **Status** | Ativa — documental (PR27) |
| **Primeira versão** | PR27 — 2026-04-30 |
| **Contrato de origem** | `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` |
| **Frente** | Skills (PR26–PR29) |
| **Dependências documentais** | PR22, PR23, PR24, PR25, PR26 |

Esta skill é a **segunda skill oficial supervisionada** da ENAVIA. Ela governa decisões de deploy, rollback e promoção, mas não executa nada de forma autônoma nem altera nenhum runtime, secret, binding ou configuração.

---

## 2. Objetivo

A skill **Deploy Governance Operator** orienta e audita decisões de deploy no sistema ENAVIA:

- **Quando deploy em TEST é permitido** — após PR-IMPL com smoke tests definidos.
- **Quando PROD é proibido** — sem aprovação humana, sem smoke aprovado, sem rollback claro.
- **Quando PROD pode ser considerado** — após TEST aprovado, smoke passado, rollback documentado e aprovação explícita do operador.
- **Quais provas são obrigatórias** antes de promover de TEST para PROD.
- **Como orientar rollback** — por tipo (DOCS, PROVA, IMPL, workflow, KV, PROD).
- **Como diagnosticar falha de deploy** — GitHub Actions, wrangler, secrets, bindings, KV.
- **Como se relacionar** com Deploy Worker, GitHub Actions, Worker Registry e Contract Loop Operator.

A skill **orienta** — não deploya, não promove, não reverte automaticamente. Toda ação real exige aprovação explícita do operador humano.

---

## 3. Princípio de segurança sem travar evolução

> **"Deploy seguro não é deploy travado; é deploy com prova, rollback e aprovação clara."**

Esta skill opera sob os seguintes princípios:

**O que a skill NUNCA faz:**
- Não executa deploy automaticamente.
- Não promove PROD sem aprovação humana explícita no chat.
- Não altera `wrangler.toml`, `deploy.yml`, `deploy-executor.yml` ou qualquer config.
- Não altera secrets, bindings ou KV.
- Não mascara falha de smoke ou CI.
- Não recomenda merge se smoke falhou.
- Não cria workflow de deploy.

**O que a skill PODE fazer:**
- Recomendar deploy em TEST quando condições estiverem atendidas.
- Recomendar promoção PROD quando provas estiverem completas e operador aprovar.
- Diagnosticar causas de falha de deploy com base nas fontes documentais.
- Recomendar rollback com o comando `git revert <commit>` quando aplicável.
- Sugerir novas skills ou melhorias de pipeline quando detectar risco ou repetição.
- Orientar quais smoke tests rodar antes de cada deploy.

**Regras para evolução:**
- Toda sugestão de melhoria de pipeline deve virar PR própria com escopo definido.
- Toda implementação de automação de deploy deve passar por PR-DIAG + PR-IMPL + PR-PROVA + aprovação humana.
- A skill pode sugerir, mas não pode criar nem executar sem PR autorizada.

---

## 4. Quando ativar esta skill

Ativar a **Deploy Governance Operator** quando:

1. Operador pede deploy de qualquer componente do sistema.
2. PR-IMPL foi finalizada e precisa ir para TEST.
3. Smoke tests passaram em TEST e o operador quer avaliar promoção para PROD.
4. GitHub Actions falhou em `deploy.yml` ou `deploy-executor.yml`.
5. Deploy Worker (`deploy-worker` ou `deploy-worker-test`) não responde ou retorna erro.
6. Falha de binding, secret ou KV impede deploy ou smoke.
7. Rollback é necessário após deploy com problema.
8. Divergência de comportamento entre TEST e PROD após deploy.
9. `execute-next` acionou fluxo que envolve Deploy Worker (`POST /apply-test` ou `/audit`).
10. Contrato exige prova de deploy como critério de aceite de uma PR-PROVA.

---

## 5. Quando NÃO ativar esta skill

**NÃO ativar** a Deploy Governance Operator quando a operação envolver:

| Situação | Skill/frente mais adequada |
|----------|---------------------------|
| Operação puramente documental sem nenhum deploy | Não requer skill de deploy |
| Diagnóstico de loop contratual sem envolver deploy | Contract Loop Operator (PR26) |
| Criação de nova skill | PR-DOCS própria, após sugestão aprovada |
| Mudança de painel sem deploy associado | Fora do escopo desta skill |
| Alteração de rota sem deploy planejado | PR-IMPL com PR-DIAG anterior |
| Decisão de produto/comercial | Fora do escopo do sistema |
| Manutenção de documentação técnica | System Mapper (PR28) |
| Auditoria de aderência contratual | Contract Auditor (PR29) |
| Próxima PR autorizada é puramente documental | Não acionar — deploy não está no escopo |

Nesses casos, a skill deve indicar claramente qual frente ou skill é mais adequada.

---

## 6. Pré-condições obrigatórias

Antes de qualquer orientação sobre deploy, a skill deve confirmar:

- [ ] `CLAUDE.md` lido integralmente.
- [ ] `schema/CODEX_WORKFLOW.md` lido.
- [ ] Contrato ativo identificado via `schema/contracts/INDEX.md`.
- [ ] Contrato ativo lido integralmente.
- [ ] `schema/status/ENAVIA_STATUS_ATUAL.md` lido.
- [ ] `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` lido.
- [ ] `schema/execution/ENAVIA_EXECUTION_LOG.md` lido.
- [ ] `ENAVIA_WORKER_REGISTRY.md` consultado — workers, bindings, secrets, workflows.
- [ ] `ENAVIA_ROUTE_REGISTRY.json` consultado se houver endpoint envolvido no deploy.
- [ ] `ENAVIA_OPERATIONAL_PLAYBOOK.md` consultado para procedimentos e rollback.
- [ ] PR/branch/commit da operação identificados.
- [ ] **Ambiente alvo definido:** TEST ou PROD.
- [ ] **Tipo de alteração definido:** docs / prova / runtime / config / workflow / KV.
- [ ] Smoke tests exigidos para este tipo de PR conhecidos.
- [ ] Rollback possível documentado antes de iniciar.
- [ ] **Aprovação humana confirmada para qualquer operação em PROD.**

Se qualquer item estiver ausente, a skill deve **parar e solicitar a informação antes de prosseguir**.

---

## 7. Entradas esperadas

| Entrada | Tipo | Descrição |
|---------|------|-----------|
| Link da PR | string | URL da PR no GitHub |
| Branch | string | Nome da branch (`claude/pr<N>-...`) |
| Commit | string | Hash do commit alvo |
| Ambiente alvo | string | `test` ou `prod` |
| Tipo de PR | string | PR-DOCS / PR-PROVA / PR-IMPL / PR-DIAG |
| Arquivos alterados | array | Lista de arquivos modificados pela PR |
| Smoke tests definidos | array | Lista de testes a executar |
| Resultado de GitHub Actions | texto/JSON | Status do CI (sucesso/falha/logs) |
| Resposta de Deploy Worker | JSON | Resultado de `/audit`, `/apply-test`, `/propose` |
| Logs de erro | texto | Output de wrangler, Actions, worker |
| Rollback proposto | string | Commit ou PR a reverter |
| Decisão humana | string | Aprovação explícita do operador no chat |
| Contrato ativo | texto | Nome e estado do contrato |

---

## 8. Saídas esperadas

| Saída | Descrição |
|-------|-----------|
| Decisão recomendada | `deploy TEST` / `não deployar` / `promover PROD` / `bloquear` / `rollback` / `pedir diagnóstico` |
| Justificativa | Por que esta decisão com base nas pré-condições |
| Riscos | O que pode dar errado nesta operação |
| Provas exigidas | Lista de smoke tests / evidências que devem existir antes |
| Workflow recomendado | Qual workflow usar, se documentado em Worker Registry |
| Plano de rollback | Comando `git revert <commit>` + impacto + smoke após rollback |
| Checklist de segurança | Lista de itens a conferir antes de executar |
| Handoff para próxima PR | O que registrar em governança após a operação |
| Sugestão de melhoria/skill | Template da Seção 19, quando aplicável |

---

## 9. Matriz de decisão TEST vs PROD

| Tipo de alteração | Deploy TEST? | Deploy PROD? | Decisão |
|-------------------|-------------|-------------|---------|
| PR-DOCS (apenas documentação) | ❌ Não necessário | ❌ Não necessário | Nenhum deploy runtime exigido |
| PR-PROVA (apenas testes) | ✅ Sim, se smoke exige worker real | ❌ Não ainda | Deployar TEST se smoke depende de worker; aguardar aprovação PROD |
| PR-IMPL Worker-only | ✅ Sim, obrigatório | ⏸ Somente após TEST aprovado + aprovação humana | Deploy TEST via `deploy.yml --env test` |
| PR-IMPL Executor-only | ✅ Sim, via `deploy-executor.yml --env test` | ⏸ Somente após TEST aprovado + aprovação humana | Workflow dedicado para executor |
| PR-IMPL Panel-only | ✅ Sim, se panel tem deploy separado | ⏸ Somente após aprovação | Verificar se panel tem deploy pipeline |
| Alteração de `deploy.yml` / `deploy-executor.yml` | ⚠️ Diagnóstico extra | 🚫 Bloqueado até teste de workflow | Mudança de workflow requer PR-DIAG + validação |
| Alteração de binding / secret / KV | ⚠️ Não alterar via skill | 🚫 Não alterar via skill | Requer PR-IMPL específica com diagnóstico |
| Hotfix de produção | ✅ Testar em TEST primeiro | ⏸ Somente após TEST + urgência declarada + aprovação | Mesmo hotfix: TEST antes de PROD |
| Rollback | ✅ `git revert` em TEST | ⏸ PROD somente com aprovação | Confirmar commit, impacto, smoke após |
| Promoção após testes | — | ✅ Somente: TEST passou + smoke passou + rollback claro + aprovação | Nenhum atalho para PROD |

**Regras mínimas:**
1. PR-DOCS normalmente **não exige deploy runtime**, salvo se publicação depender de pipeline específico.
2. PR-IMPL deve ir para **TEST antes de PROD** — sem exceção.
3. **PROD exige aprovação humana explícita** no chat — sem exceção.
4. Mudança em `workflow`, `binding` ou `secret` exige **diagnóstico extra** antes de deploy.
5. **Se smoke falhar, não promover** — investigar causa primeiro.
6. **Se rollback não estiver claro, não promover** — documentar rollback antes.

---

## 10. Gates obrigatórios antes de deploy

Verificar todos os itens antes de recomendar qualquer deploy:

- [ ] Branch criada a partir de `origin/main` atualizada (sem conflito).
- [ ] PR correspondente aberta com body padrão (objetivo, escopo, tipo, smoke, rollback).
- [ ] Escopo da PR respeitado — nenhum arquivo fora do escopo alterado.
- [ ] Arquivos alterados são coerentes com o tipo de PR declarado.
- [ ] Smoke tests para este tipo de PR estão definidos e documentados.
- [ ] Smoke tests executados e **passaram** (sem exceção).
- [ ] Regressões relevantes executadas quando tipo é PR-IMPL.
- [ ] Nenhum secret exposto em código, commit message, log ou documento.
- [ ] Rollback documentado: commit a reverter + impacto + smoke pós-rollback.
- [ ] Ambiente alvo correto: TEST (antes) → PROD (depois, com aprovação).
- [ ] **Aprovação humana explícita no chat para qualquer operação em PROD.**
- [ ] Governança atualizada: status, handoff, execution log.

---

## 11. Relação com Contract Loop Operator

A **Contract Loop Operator** (PR26) e a **Deploy Governance Operator** (esta skill) são complementares:

| Aspecto | Contract Loop Operator | Deploy Governance Operator |
|---------|----------------------|--------------------------|
| **Foco** | Loop contratual (execute-next → complete-task → advance-phase) | Deploy, rollback e promoção TEST/PROD |
| **Quando atua** | Operações de estado do contrato | Operações que envolvem deploy de código/config |
| **Endpoints** | /loop-status, /execute-next, /complete-task, /advance-phase | Workflows GitHub, Deploy Worker (/apply-test, /audit) |
| **Aprovação exigida** | Para ações sensíveis do loop | Para qualquer operação em PROD |

**Ponto de integração:** quando `POST /contracts/execute-next` aciona uma ação que envolve o **Deploy Worker** (via binding `DEPLOY_WORKER` → `POST /apply-test`), ambas as skills se tocam:

1. **Contract Loop Operator** decide: "a próxima ação do contrato é execute-next e envolve deploy".
2. **Deploy Governance Operator** valida: "este deploy está seguro para TEST/PROD? Smoke está definido? Rollback está claro?"

Nenhuma das duas executa produção sozinha. A decisão final é sempre do operador humano.

---

## 12. Relação com Worker Registry

O `ENAVIA_WORKER_REGISTRY.md` (PR25) é a **fonte de verdade para infraestrutura de deploy**:

- **Workers confirmados:** `nv-enavia`, `enavia-worker-teste`, `enavia-executor`, `enavia-executor-test`, `deploy-worker`, `deploy-worker-test`.
- **Bindings confirmados:** `EXECUTOR` (→ executor PROD/TEST) e `DEPLOY_WORKER` (→ deploy-worker PROD/TEST).
- **Secrets confirmados:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_TOKEN` (GitHub Actions); `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `OPENAI_API_KEY`/`CODEX_API_KEY` (executor).
- **Workflows:** `deploy.yml` (nv-enavia) e `deploy-executor.yml` (executor).

**Regras:**
- Antes de diagnosticar qualquer falha de deploy, **consultar o Worker Registry**.
- Se binding, secret ou workflow estiver ausente ou divergente do Registry, **parar e documentar**.
- **Não alterar** bindings, secrets ou KV — essa é proibição absoluta desta skill.
- Se algo no Worker Registry estiver marcado como `[A VERIFICAR]`, tratar como dado incerto e não assumir comportamento.

---

## 13. Relação com Route Registry

O `ENAVIA_ROUTE_REGISTRY.json` (PR23) documenta os 68 endpoints de `nv-enavia`:

- **Rotas relevantes para deploy:** as relacionadas ao grupo `audit_propose` e `bridge` (usadas quando executor/deploy-worker são chamados via binding).
- **known_external_routes:** `EXECUTOR binding (/audit, /propose)`, `DEPLOY_WORKER binding (/audit, /apply-test)`.

**Regras:**
- Usar o Route Registry para confirmar endpoints antes de referenciar em diagnóstico.
- Se rota não existir no registry com `confidence: "high"`, não assumir que existe — marcar como `[A VERIFICAR]`.
- Se rota existe no registry mas falha em runtime, o problema é de infraestrutura/runtime — diagnóstico separado da skill.

---

## 14. Relação com Operational Playbook

O `ENAVIA_OPERATIONAL_PLAYBOOK.md` (PR24) define os procedimentos operacionais gerais:

- **Seção 12 (Rollback):** 4 tipos de rollback (DOCS, PROVA, IMPL, KV) + quando NÃO fazer rollback automático.
- **Seção 13 (Smoke tests):** 451 testes oficiais distribuídos por frente (PR13–PR21).
- **Seção 8 (PR-IMPL checklist):** regressões obrigatórias após implementação.

**Integração com esta skill:**
- Deploy Governance aplica especificamente a parte de **deploy/rollback/provas** do Playbook.
- Se houver conflito entre o Playbook e o contrato ativo, **o contrato ativo vence** — documentar o conflito no execution log.
- O Playbook descreve **o que fazer**; esta skill governa **se é seguro fazer** no contexto de deploy.

---

## 15. Procedimento para deploy em TEST

Passo a passo para orientar deploy seguro em TEST:

```
Passo 1 — Confirmar tipo de PR
  PR-IMPL ou PR-PROVA que exige worker real.
  Se PR-DOCS: deploy TEST não é necessário → parar.

Passo 2 — Confirmar escopo
  Verificar arquivos alterados vs escopo declarado.
  Se arquivos fora do escopo → parar e reportar.

Passo 3 — Confirmar que runtime ou config foi alterado
  PR-IMPL: verificar diff (nv-enavia.js / executor/src/index.js / workflow).
  Se apenas docs/testes: verificar se smoke exige worker deployado.

Passo 4 — Confirmar ambiente alvo = TEST
  Worker: deploy via deploy.yml → workflow_dispatch → target_env = test
  Executor: deploy via deploy-executor.yml → workflow_dispatch → target_env = test

Passo 5 — Confirmar workflow correto (conforme Worker Registry)
  Worker principal (nv-enavia): deploy.yml
  Executor: deploy-executor.yml (gera wrangler.executor.generated.toml dinamicamente)

Passo 6 — Confirmar smoke tests definidos
  Worker: GET /audit (HTTP 200) + GET /__internal__/build (Bearer INTERNAL_TOKEN)
  Executor: POST /audit live-read + POST /apply-patch (bootstrap snapshot)
  Se smoke não definido → parar e exigir definição.

Passo 7 — Aguardar resultado do deploy/CI
  Verificar GitHub Actions: passou ou falhou.
  Se falhou: ir para Seção 18 (diagnóstico de falhas).

Passo 8 — Verificar smoke tests
  Ler output do CI.
  Se smoke falhou: não avançar → parar e recomendar correção.

Passo 9 — Registrar evidências
  Anotar: workflow executado, commit deployado, resultado de smoke.
  Atualizar execution log com o resultado.

Passo 10 — Preparar recomendação
  Se TEST aprovado: preparar recomendação de PR-PROVA ou avaliação de promoção.
  Se falhou: preparar diagnóstico e plano de correção/rollback.
```

**Nota:** esta skill documenta o procedimento — não executa os comandos. O operador humano executa o workflow e traz os resultados para avaliação.

---

## 16. Procedimento para promoção PROD

> **"Sem aprovação humana explícita, PROD é bloqueado."**

Passo a passo para orientar promoção segura para PROD:

```
Passo 1 — Confirmar TEST aprovado
  Deploy em TEST foi executado.
  Smoke de TEST passou (HTTP 200 em /audit e /__internal__/build).
  Nenhuma regressão detectada.

Passo 2 — Confirmar smoke/regressões
  Suite de regressão relevante executada para o tipo de PR.
  Resultado: todos passaram (sem exceção).
  Se algum falhou → PARAR. Não promover.

Passo 3 — Confirmar rollback
  Commit a reverter identificado.
  Impacto do rollback documentado.
  Smoke pós-rollback definido.
  Se rollback não estiver claro → PARAR. Não promover.

Passo 4 — Confirmar risco
  Qual é o pior caso de falha em PROD?
  Há dependência de secret/binding/KV que pode falhar?
  Há endpoint externo que pode não estar disponível?
  Se risco alto e mitigação não documentada → PARAR.

Passo 5 — Confirmar aprovação humana explícita
  Operador deve dizer explicitamente no chat: "pode promover para PROD".
  Nenhuma aprovação implícita, nenhum "já que TEST passou, vai".
  Se aprovação não veio do operador no chat → PARAR.

Passo 6 — Confirmar que secrets/bindings não foram alterados sem validação
  Verificar Worker Registry: algum binding/secret mudou nesta PR?
  Se sim: exigir validação adicional antes de PROD.

Passo 7 — Confirmar estratégia de promoção
  Worker nv-enavia: deploy.yml → push para main (automático) ou workflow_dispatch → prod.
  Executor: deploy-executor.yml → workflow_dispatch → prod.
  Confirmar qual workflow será usado.

Passo 8 — Promover conforme workflow documentado
  Operador executa o workflow correto com as credenciais corretas.
  Skill orienta — operador executa.

Passo 9 — Verificar smoke em PROD
  Smoke pós-deploy PROD: GET /audit, validações de binding.
  Se smoke falhar em PROD → acionar rollback imediatamente.

Passo 10 — Registrar evidências
  Commit deployado, workflow executado, smoke result.
  Atualizar execution log e handoff.
```

---

## 17. Procedimento para rollback

### Por tipo de alteração:

**Rollback de PR-DOCS:**
```bash
git revert <commit-hash>
# Criar nova PR-DOCS com o revert
# Nenhum smoke de runtime exigido (sem deploy envolvido)
```

**Rollback de PR-PROVA:**
```bash
git revert <commit-hash>
# Criar nova PR com o revert
# Smoke: confirmar que suite anterior ainda passa
```

**Rollback de PR-IMPL Worker (nv-enavia):**
```bash
git revert <commit-hash>
# Criar PR com o revert
# Deploy em TEST do revert
# Smoke TEST: GET /audit + /__internal__/build
# Se TEST passou: promover com aprovação humana
# Registrar no execution log
```

**Rollback de workflow / configuração:**
```bash
git revert <commit-hash>
# Atenção: se workflow foi alterado, o revert só afeta próximos runs de CI
# Validar que PR anterior ainda aplica corretamente
# Não alterar secrets/bindings pelo revert — apenas o arquivo .yml
```

**Rollback de KV / dados:**
```
ATENÇÃO: dados em KV não são revertidos por git revert.
Diagnosticar via Worker Registry quais keys foram afetadas.
Acionar Contract Auditor (PR29) para auditoria de estado de contrato.
Não alterar KV manualmente sem diagnóstico específico.
```

**Rollback de PROD:**
```bash
git revert <commit-hash>
# Criar PR de rollback (PR-IMPL escopo Worker-only)
# Deploy TEST do rollback
# Smoke TEST
# Aprovação humana explícita para PROD
# Deploy PROD do rollback
# Smoke PROD
```

### Quando NÃO fazer rollback automático:

- Se a falha é de secret/binding ausente (não é problema de código — resolver via config).
- Se a falha é de KV namespace (não é problema de código — diagnosticar infra).
- Se o commit a reverter não está isolado (pode levar junto outra mudança não relacionada).
- Se o rollback exige alteração de runtime de outro componente além do que foi modificado.
- Qualquer caso de dado persistido em KV — diagnóstico específico primeiro.

### Formato de registro no execution log após rollback:

```
ROLLBACK — <data> — <tipo> — <descrição>
- Commit revertido: <hash>
- Motivo: <razão objetiva>
- Smoke após rollback: <resultado>
- Impacto: <o que foi afetado>
- Aprovação humana: <quem aprovou, se PROD>
```

---

## 18. Diagnóstico de falhas comuns de deploy

| Sintoma | Causa provável | Onde verificar | Ação segura |
|---------|---------------|---------------|-------------|
| GitHub Actions falhou na etapa de deploy | Secret ausente (`CLOUDFLARE_API_TOKEN` ou `CLOUDFLARE_ACCOUNT_ID`) | GitHub → Settings → Secrets; `deploy.yml` linhas 34-38 | Verificar se secrets estão configurados; não expor valores |
| `wrangler deploy` falhou com erro de auth | Token expirado ou permissão insuficiente | Cloudflare Dashboard → API Tokens | Renovar token (operador humano) |
| `wrangler deploy` falhou com "placeholder not replaced" | `wrangler.toml` contém `REPLACE_WITH_` | `deploy.yml` etapa "Validate wrangler placeholders" | Substituir placeholder pelo valor real antes do deploy |
| KV namespace não encontrado no deploy do executor | Título do KV diferente do esperado (case-sensitive) | `deploy-executor.yml` linhas 100-106; CF Dashboard → Workers & Pages → KV | Verificar títulos: `enavia-brain`, `enavia-brain-test`, `ENAVIA_GIT`, `ENAVIA_GIT_TEST` |
| Worker deployado mas endpoint retorna 500 | Binding ausente, secret ausente ou erro em runtime | CF Dashboard → Worker → Bindings; logs do worker | Verificar bindings no CF Dashboard; não alterar via esta skill |
| Smoke `GET /audit` retorna 401 | `ADMIN_API_KEY` ou auth ausente (rota não exige auth por padrão segundo Route Registry) | `ENAVIA_ROUTE_REGISTRY.json` rota `/audit`; CF Dashboard | Verificar se rota requer auth no registry |
| Smoke `GET /__internal__/build` retorna 401 | `INTERNAL_TOKEN` ausente ou incorreto no worker | CF Dashboard → Worker secrets; `deploy.yml` linhas 46-50 | Reconfigurar `INTERNAL_TOKEN` como secret no CF (operador humano) |
| Deploy Worker (`deploy-worker`) indisponível | Binding `DEPLOY_WORKER` aponta para worker não deployado | `ENAVIA_WORKER_REGISTRY.md` Seção 5; CF Dashboard | Verificar se `deploy-worker` está deployado no ambiente correto |
| Executor indisponível (`enavia-executor`) | Binding `EXECUTOR` aponta para worker não deployado | `ENAVIA_WORKER_REGISTRY.md` Seção 5; CF Dashboard | Verificar se `enavia-executor` está deployado; acionar deploy-executor.yml se necessário |
| TEST passa mas PROD falha | Env vars diferentes entre ambientes | `ENAVIA_WORKER_REGISTRY.md` Seção 8.1 vs 8.2 | Comparar vars PROD vs TEST; verificar `BROWSER_EXECUTOR_URL` (vazio em TEST) |
| CORS falha após deploy | Algum header de origin foi alterado ou behavior do worker mudou | `ENAVIA_ROUTE_REGISTRY.json` campo `cors.expected` por rota | Verificar route específica no registry; comparar diff do PR |
| Smoke falhou após deploy | Código deployado tem bug, ou smoke aponta ambiente errado | Logs de CI; diff da PR | Não promover; corrigir e re-testar |
| Rollback falhou | Commit de rollback não isola a mudança; ou há dependência de dado em KV | `git log` para verificar isolamento; `ENAVIA_WORKER_REGISTRY.md` Seção 6.3 (key shapes) | Diagnosticar manualmente; não forçar rollback de KV sem diagnóstico |

---

## 19. Critérios para sugerir nova skill

A Deploy Governance Operator **pode e deve sugerir** novas skills quando detectar:

| Gatilho | Exemplo de skill sugerida |
|---------|--------------------------|
| Problemas recorrentes de deploy em Cloudflare | Cloudflare Release Operator |
| Falhas repetidas de workflow/CI | CI Health Monitor |
| Necessidade de gestão de secrets/bindings | Secrets & Bindings Governance Operator |
| Necessidade de gestão de releases Vercel | Vercel Release Operator |
| Rollback frequente de KV | KV State Recovery Operator |
| Incident response com PROD down | Incident Response Operator |
| Necessidade de release manager completo | Release Manager Skill |
| Divergências recorrentes TEST/PROD | Environment Parity Checker |

Para cada sugestão, usar o template a seguir (mesmo formato da Contract Loop Operator — Seção 14):

```
---
SUGESTÃO DE NOVA SKILL

Nome:
Problema que resolve:
Por que agora:
Quando ativar:
Quando não ativar:
Entradas:
Saídas:
Arquivos de referência:
Riscos:
Escopo permitido:
Tipo de PR recomendado:
Dependências:
Prioridade:
Próxima ação segura:
---
```

**Regra:** a skill sugere, mas não cria nem implementa sem PR autorizada pelo operador ou pelo contrato.

---

## 20. Exemplos de uso

### Exemplo 1 — PR-DOCS pronta: nenhum deploy necessário

```
Operador: "PR24 (Operational Playbook) foi criada. Precisa de deploy?"

Skill:
  Tipo: PR-DOCS
  Verificação: apenas markdown e governança alterados.
  Decisão: NÃO. PR-DOCS não altera runtime.
  Recomendação: abrir PR, revisar, mergear. Nenhum deploy envolvido.
```

### Exemplo 2 — PR-IMPL Worker-only pronta para TEST

```
Operador: "PR18 (advance-phase endpoint) foi implementada. Pode ir para TEST?"

Skill:
  Tipo: PR-IMPL Worker-only
  Verificação:
    - Arquivo alterado: nv-enavia.js ✅ (escopo Worker-only)
    - Smoke TEST definido: GET /audit + /__internal__/build ✅
    - Rollback: git revert <commit-hash> ✅
  Decisão: SIM — deploy TEST via deploy.yml → workflow_dispatch → target_env = test.
  Recomendação: operador executa workflow_dispatch; skill aguarda resultado do CI.
  Se smoke passar: preparar PR-PROVA.
```

### Exemplo 3 — TEST passou, avaliar PROD

```
Operador: "PR18 deployou em TEST. Smoke passou. Pode ir para PROD?"

Skill:
  Verificação:
    - TEST aprovado: ✅
    - Smoke TEST: GET /audit HTTP 200 ✅, /__internal__/build HTTP 200 ✅
    - Rollback: commit <hash> documentado ✅
    - Risco: endpoint novo, não altera existente ✅
  Gate final: "Operador, confirma explicitamente a promoção para PROD?"
  → Aguardar resposta afirmativa no chat.
  Decisão: SIM para PROD — somente após aprovação explícita do operador.
  Workflow: push para main OU workflow_dispatch → target_env = prod.
```

### Exemplo 4 — Smoke falhou, bloquear promoção

```
Operador: "CI rodou mas smoke GET /audit retornou 500. Pode promover mesmo assim?"

Skill:
  Decisão: NÃO. Smoke falhou. PROD bloqueado.
  Ação recomendada:
    1. Investigar causa do 500 via logs do CF Dashboard.
    2. Verificar Worker Registry (binding EXECUTOR ativo? Secret configurado?).
    3. Corrigir o problema em nova PR-IMPL ou hotfix.
    4. Re-deplorar TEST e re-rodar smoke.
    5. Somente após smoke passar: retornar a este fluxo.
  Frase: "Deploy seguro não é deploy travado; é deploy com prova, rollback e aprovação clara."
```

### Exemplo 5 — Secret ausente no CI

```
Contexto: GitHub Actions falhou com "Missing CLOUDFLARE_API_TOKEN".

Skill:
  Diagnóstico: secret CLOUDFLARE_API_TOKEN ausente nos GitHub Secrets do repo.
  Fonte: deploy.yml linhas 34-38; ENAVIA_WORKER_REGISTRY.md Seção 7.2.
  Ação recomendada:
    1. Acessar GitHub → repo → Settings → Secrets and variables → Actions.
    2. Adicionar secret CLOUDFLARE_API_TOKEN com o token da Cloudflare.
    3. Re-executar o workflow.
  Nota: operador humano deve configurar o secret — skill não acessa nem expõe valores.
```

### Exemplo 6 — Rollback necessário

```
Operador: "PR20 deployou em TEST mas loop-status não expõe complete-task. Preciso reverter."

Skill:
  Tipo de rollback: PR-IMPL Worker (nv-enavia.js alterado)
  Passo a passo:
    1. git revert <commit-da-pr20>
    2. Criar PR de rollback (PR-IMPL Worker-only, escopo fechado).
    3. Deploy TEST do revert.
    4. Smoke: GET /audit + /__internal__/build.
    5. Se TEST passou: mergear e NÃO promover PROD até investigar causa raiz.
    6. Registrar no execution log: ROLLBACK — PR20 — complete-task ausente em TEST.
  Nota: não fazer rollback de KV junto — diagnosticar separadamente.
```

### Exemplo 7 — Sugestão de nova skill

```
Contexto: operador precisou diagnosticar falha de KV três vezes em sessões diferentes.
          Processo manual e repetitivo.

Skill detecta recorrência e sugere:

---
SUGESTÃO DE NOVA SKILL

Nome: KV State Recovery Operator
Problema que resolve: Diagnóstico e recuperação manual de estado de KV após
  deploy, rollback ou incidente de runtime.
Por que agora: Observado 3× nas últimas sessões — mesmo processo manual e repetitivo.
Quando ativar: após falha de KV detectada; após rollback que pode afetar dados;
  após migração de KV namespace.
Quando não ativar: operações puramente documentais; loop contratual sem falha de KV.
Entradas: contract_id, key shape afetada, ambiente (PROD/TEST), sintoma.
Saídas: diagnóstico do estado do KV, ação recomendada, risco de perda de dados.
Arquivos de referência: ENAVIA_WORKER_REGISTRY.md (Seção 6.3), contract-executor.js.
Riscos: alteração manual de KV pode corromper estado do contrato.
Escopo permitido: PR-DIAG (diagnóstico read-only); PR-IMPL apenas se necessário.
Tipo de PR recomendado: PR-DOCS (skill documental) → PR-DIAG → PR-IMPL se necessário.
Dependências: ENAVIA_WORKER_REGISTRY.md (PR25), Contract Auditor (PR29).
Prioridade: média
Próxima ação segura: apresentar ao operador para aprovação e abertura de PR-DOCS dedicada.
---
```

---

## 21. Segurança e limites

A skill nunca:

- **Expõe secrets**: não imprime valores de `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTERNAL_TOKEN`, `CF_API_TOKEN`, `CF_ACCOUNT_ID` ou qualquer outro secret.
- **Altera secrets**: configuração de secrets é operação do operador humano via CF Dashboard ou GitHub Settings.
- **Altera bindings**: mudanças em `[[services]]` do `wrangler.toml` requerem PR-IMPL com diagnóstico.
- **Altera KV**: dados em KV não são gerenciados por esta skill — diagnóstico específico.
- **Promove PROD sem aprovação**: sem "pode promover para PROD" explícito do operador no chat, PROD está bloqueado.
- **Executa deploy automaticamente**: a skill orienta — o operador executa o workflow.
- **Mascara falha**: se smoke falhou, a skill reporta a falha. Nunca "passar por cima" de CI falho.
- **Recomenda merge com smoke falho**: smoke falho bloqueia merge e promoção.
- **Cria workflow**: nenhuma alteração em `.github/workflows/` via esta skill.
- **Altera runtime**: nenhuma alteração em `nv-enavia.js`, `contract-executor.js`, `executor/src/index.js` ou equivalente.

---

## 22. Itens opcionais — não mexer agora

> **Isso é opcional. Não mexa agora.**

1. Executor automático de deploy — skill que aciona workflow sem intervenção humana.
2. Endpoint `/deploy/run` no worker `nv-enavia` para disparo programático.
3. UI de release no painel com status de ambientes TEST/PROD.
4. Validação automática de secrets em runtime (health check no startup do worker).
5. Dashboard de deploy com histórico de deploys e status por ambiente.
6. Auto rollback — rollback automático em caso de falha de smoke pós-deploy.
7. Promoção automática PROD após smoke TEST aprovado (sem aprovação humana intermediária).
8. Integração com Cloudflare API para deploy programático além do Wrangler CLI.
9. Integração com Vercel API para deploy coordenado nv-enavia + Vercel.
10. Criação de skill específica para Cloudflare (Cloudflare Release Operator).
11. Criação de skill específica para Vercel (Vercel Release Operator).

---

## 23. Checklist final da skill

Antes de encerrar qualquer uso da Deploy Governance Operator:

- [ ] Ambiente alvo identificado (TEST ou PROD).
- [ ] Tipo de PR identificado (DOCS/PROVA/IMPL/DIAG).
- [ ] Escopo validado — nenhum arquivo fora do escopo alterado.
- [ ] Riscos listados e comunicados ao operador.
- [ ] Provas exigidas (smoke tests) listadas.
- [ ] Rollback documentado antes de qualquer deploy.
- [ ] **Aprovação humana explícita confirmada se operação envolve PROD.**
- [ ] Próxima ação recomendada está clara (deploy TEST / aguardar smoke / promover PROD / rollback / bloquear).
- [ ] Se smoke falhou: não recomendou promoção.
- [ ] Se sugeriu nova skill: deixou como sugestão com template preenchido, não como implementação.
- [ ] Governança indicada: quais arquivos atualizar após a operação.
- [ ] Nenhuma instrução de ferramenta/resultado foi executada sem confirmação do operador.
