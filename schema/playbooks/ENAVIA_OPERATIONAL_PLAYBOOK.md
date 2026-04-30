# ENAVIA — Operational Playbook

**Versão:** 1.0.0
**Data:** 2026-04-29
**PR:** PR24 — PR-DOCS
**Contrato ativo:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`

> Este playbook é o manual operacional oficial para Claude Code / agente / operador humano executar o loop
> contratual supervisionado da ENAVIA com segurança, diagnóstico, evidência, rollback e governança.
>
> **Fontes:** `ENAVIA_SYSTEM_MAP.md` (PR22), `ENAVIA_ROUTE_REGISTRY.json` (PR23), contrato ativo,
> testes PR13–PR21, `CLAUDE.md`, `schema/CODEX_WORKFLOW.md`.
>
> **Regra:** Não inventar procedimento que não esteja apoiado nas fontes acima.
> Se algo não estiver confirmado, está marcado como `[a verificar]` ou `[não confirmado]`.

---

## 1. Objetivo do playbook

Este playbook tem três leitores:

1. **Claude Code (agente)** — executando PRs contratuais de forma supervisionada no repo `nv-enavia`.
2. **Operador humano** — revisando, aprovando e acompanhando a execução.
3. **Sistema ENAVIA** — como referência de comportamento esperado em cada etapa.

O playbook cobre:

- Como iniciar qualquer sessão de forma segura.
- Como identificar a próxima ação autorizada.
- Como executar o loop contratual (execute-next → complete-task → advance-phase).
- Como diagnosticar bloqueios e erros.
- Como fazer rollback.
- Como documentar e fazer handoff.

**O que este playbook NÃO é:**

- Não substitui o contrato ativo.
- Não substitui o `CLAUDE.md`.
- Não autoriza autonomia sem supervisão.
- Não é definitivo — deve ser atualizado após cada PR que altere comportamento.

---

## 2. Regras absolutas antes de qualquer operação

Antes de qualquer ação — incluindo leitura, diagnóstico, implementação ou documentação — cumprir
**todas** as etapas abaixo, nesta ordem:

1. **Ler `CLAUDE.md`** — lei operacional do repo. Se não conseguir acessar, parar e avisar.
2. **Ler `schema/CODEX_WORKFLOW.md`** — confirmar `WORKFLOW_ACK: ok`.
3. **Ler o contrato ativo** — identificado em `schema/contracts/INDEX.md`.
4. **Ler `schema/status/ENAVIA_STATUS_ATUAL.md`** — estado operacional atual.
5. **Ler `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** — o que foi feito e o que vem a seguir.
6. **Ler `schema/execution/ENAVIA_EXECUTION_LOG.md`** — histórico de execuções.
7. **Confirmar a próxima PR autorizada em `schema/contracts/INDEX.md`**.
8. **Atualizar a branch a partir de `origin/main`** antes de qualquer edição.
9. **Criar nova branch** no padrão `claude/pr<N>-<descricao-curta>`.

**Regras inegociáveis:**

- Não misturar escopos na mesma PR (Worker-only, Panel-only, Executor-only, Docs-only, etc.).
- Não alterar runtime em PR-DOCS, PR-DIAG ou PR-PROVA.
- Não pular PR — se a PR anterior não estiver concluída, parar.
- Não executar PR-IMPL sem PR-DIAG anterior quando o contrato exigir.
- Não corrigir comportamento em PR-PROVA — apenas documentar.
- Não avançar sem atualizar governança ao final de cada PR.
- Se houver conflito entre contrato, status e handoff, parar e reportar antes de alterar runtime.

---

## 3. Tipos de PR e quando usar

| Tipo | Finalidade | Pode alterar runtime? | Exige prova subsequente? | Exemplo |
|------|-----------|----------------------|--------------------------|---------|
| `PR-DIAG` | Diagnóstico read-only — mapear gap, função, estado, handler | ❌ Nunca | ✅ Sim (PR-IMPL só após PR-DIAG) | PR17: diagnóstico do gap `phase_complete → advance-phase` |
| `PR-IMPL` | Implementação supervisionada — patch cirúrgico no runtime | ✅ Sim | ✅ Sim (exige PR-PROVA) | PR18: `POST /contracts/advance-phase`; PR20: `loop-status` expõe `complete-task` |
| `PR-PROVA` | Prova/testes — smoke tests que validam implementação | ❌ Nunca (apenas cria testes) | ❌ (é a prova) | PR19: E2E do ciclo completo; PR21: matriz de estados |
| `PR-DOCS` | Documentação — sem alteração de runtime | ❌ Nunca | ❌ | PR22: System Map; PR23: Route Registry; PR24: este playbook |

**Regra de sequência obrigatória para cada frente:**

```
PR-DIAG → PR-IMPL → PR-PROVA → (PR-DOCS se necessário)
```

Não é possível criar PR-IMPL sem PR-DIAG anterior quando o contrato exigir diagnóstico primeiro.
Não é possível fechar uma frente sem PR-PROVA.

---

## 4. Como identificar a próxima PR autorizada

Seguir este checklist exatamente:

1. Abrir `schema/contracts/INDEX.md` → seção **"Próxima PR autorizada"**.
2. Anotar: tipo (PR-DIAG/IMPL/PROVA/DOCS), número e objetivo.
3. Abrir o contrato ativo (listado em `schema/contracts/INDEX.md` → seção "Contrato ativo").
4. Localizar a seção do contrato correspondente à PR (ex: `## 11. PR22–PR25 — PR-DOCS`).
5. Ler os critérios de aceite e o escopo permitido dessa PR.
6. Conferir `schema/status/ENAVIA_STATUS_ATUAL.md` → confirmar que a PR anterior está concluída.
7. Conferir `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` → confirmar que aponta para a mesma próxima PR.
8. Se houver divergência entre INDEX.md, status e handoff → **parar e reportar antes de continuar**.

**Critério de bloqueio:** se INDEX.md diz PR24 mas handoff diz PR23, há inconsistência de governança.
Não prosseguir sem reconciliar e atualizar os arquivos.

---

## 5. Fluxo operacional do loop contratual supervisionado

O loop contratual supervisionado foi formalizado nas PRs PR17–PR21 e é o fluxo canônico para
executar tasks dentro de um contrato ENAVIA.

### 5.1 Fluxo completo (validado em PR19 — 52/52 asserts)

```
1. GET /contracts/loop-status?id=<contract_id>
        │
        ▼ nextAction.type = "start_task"
        │ availableActions = ["POST /contracts/execute-next"]

2. POST /contracts/execute-next
   body: { contract_id, evidence: [...] }
        │
        ├─ startTask(queued → in_progress) [KV write]
        ├─ callExecutorBridge /audit [EXECUTOR service binding]
        ├─ callExecutorBridge /propose [EXECUTOR service binding]
        ├─ callDeployBridge /audit [DEPLOY_WORKER service binding]
        └─ callDeployBridge /apply-test [DEPLOY_WORKER service binding]
        │
        ▼ task transiciona para in_progress

3. GET /contracts/loop-status?id=<contract_id>
        │
        ▼ nextAction.status = "in_progress"
        │ availableActions = ["POST /contracts/complete-task"]

4. POST /contracts/complete-task
   body: { contract_id, task_id, resultado: { objetivo_atendido, criterio_aceite_atendido,
           escopo_efetivo, is_simulado: false, is_mockado: false, is_local: false, is_parcial: false } }
        │
        ├─ gate de aderência (evaluateAdherence)
        └─ task transiciona para done/completed [KV write]
        │
        ▼ se a fase toda estiver completa:

5. GET /contracts/loop-status?id=<contract_id>
        │
        ▼ nextAction.type = "phase_complete"
        │ availableActions = ["POST /contracts/advance-phase"]

6. POST /contracts/advance-phase
   body: { contract_id }
        │
        ├─ checkPhaseGate (todas as tasks da fase devem estar done/merged/completed/skipped)
        ├─ atualiza current_phase e decomposition [KV write]
        └─ ativa próxima fase
        │
        ▼ próxima fase ativa → volta ao passo 1 com nova task/fase

7. (Quando todas as fases estiverem done)
   GET /contracts/loop-status → nextAction.type = "contract_complete"
   → POST /contracts/close-final com { contract_id, confirm: true, approved_by: "<nome>" }
```

### 5.2 Detalhes por etapa

| Etapa | Endpoint | State change | Teste que provou |
|-------|----------|-------------|-----------------|
| 1. Ler estado do loop | `GET /contracts/loop-status` | Nenhum (read-only) | PR21 (53/53) |
| 2. Executar próxima task | `POST /contracts/execute-next` | `queued → in_progress` | PR19 (52/52), PR14 (183/183) |
| 3. Confirmar in_progress | `GET /contracts/loop-status` | Nenhum (read-only) | PR20 (27/27) |
| 4. Concluir task | `POST /contracts/complete-task` | `in_progress → done` | PR19 (52/52) |
| 5. Confirmar phase_complete | `GET /contracts/loop-status` | Nenhum (read-only) | PR19 (52/52), PR21 (53/53) |
| 6. Avançar fase | `POST /contracts/advance-phase` | Atualiza current_phase, fases | PR18 (45/45), PR19 (52/52) |
| 7. Fechar contrato | `POST /contracts/close-final` | `executing → completed` | `[a verificar — sem smoke test dedicado]` |

---

## 6. Matriz de ações por estado

| Estado / `nextAction.type` | `availableActions` | Endpoint | Observação |
|----------------------------|--------------------|---------|------------|
| `start_task` (task queued) | `POST /contracts/execute-next` | `handleExecuteNext` | Rota principal do loop. Gate: `can_execute === true`. |
| `in_progress` (Rule 9) | `POST /contracts/complete-task` | `handleCompleteTask` | PR20. `operationalAction.type = block` (não libera execute-next por engano). |
| `phase_complete` (Rule 4) | `POST /contracts/advance-phase` | `handleAdvancePhase` | PR18. Gate: `checkPhaseGate` — todas as tasks done. |
| `awaiting_human_approval` | `[a verificar]` | `handleCloseFinalContract` ou outro | Registry não confirma ação específica para este estado. |
| `contract_complete` (Rule 1) | `POST /contracts/close-final` | `handleCloseFinalContract` | Fechamento final pesado com `confirm: true` e `approved_by`. |
| `plan_rejected` (Rule 2) | `[]` (vazio) | — | `isPlanRejected`: `state.plan_rejection.plan_rejected === true`. |
| `cancelled` (Rule 3) | `[]` (vazio) | — | `isCancelledContract`: `state.status_global === "cancelled"`. |
| `no_action` (Rule 9) | `[]` | — | Task in_progress mas sem nextAction operacional direto. |

> **Observação documentada em PR21:** `status_global: "blocked"` sozinho **não** faz
> `resolveNextAction` esconder ações operacionais. O sistema só bloqueia via:
> - `state.plan_rejection.plan_rejected === true` (campo `plan_rejection`, não `status_global`)
> - `state.status_global === "cancelled"`
>
> Comportamento existente preservado. Se for necessário bloquear via `status_global` no futuro,
> isso requer PR-IMPL separada com PR-DIAG precedente.

---

## 7. Como executar diagnóstico (PR-DIAG)

O diagnóstico é obrigatório antes de qualquer implementação que altere runtime, exceto quando o
contrato autorizar implementação direta.

**Checklist PR-DIAG:**

- [ ] Ler todos os arquivos obrigatórios da sessão (seção 2).
- [ ] Confirmar que o tipo da PR é `PR-DIAG` no contrato.
- [ ] **Não alterar nenhum arquivo de runtime** (`nv-enavia.js`, `contract-executor.js`, workers, workflows, TOML).
- [ ] Mapear a função/handler/estado relevante com evidência: arquivo + linha + padrão.
- [ ] Identificar o gap ou problema com base no código real (grep, leitura de blocos).
- [ ] Documentar causa provável com linguagem precisa.
- [ ] Propor patch mínimo para a próxima PR-IMPL (sem implementar).
- [ ] Registrar diagnóstico em `schema/execution/ENAVIA_EXECUTION_LOG.md`.
- [ ] Atualizar `schema/status/ENAVIA_STATUS_ATUAL.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` e `schema/contracts/INDEX.md`.
- [ ] Não implementar nada — parar após o diagnóstico.

**Exemplo:** PR17 diagnosticou que `advanceContractPhase` existia em `contract-executor.js:1027`
mas não estava importada nem exposta via HTTP em `nv-enavia.js`. O diagnóstico listou os 4 passos
do patch mínimo para PR18.

---

## 8. Como executar implementação (PR-IMPL)

**Checklist PR-IMPL:**

- [ ] Ler todos os arquivos obrigatórios da sessão (seção 2).
- [ ] Confirmar que existe PR-DIAG anterior da mesma frente (quando exigido pelo contrato).
- [ ] Alterar **apenas** o escopo autorizado pelo contrato (Worker-only, Panel-only, etc.).
- [ ] Patch cirúrgico — não refatorar por estética, não renomear sem necessidade comprovada.
- [ ] Não duplicar lógica existente — reutilizar funções já implementadas.
- [ ] Preservar todos os gates existentes (`evaluateAdherence`, `checkPhaseGate`, `isPlanRejected`, etc.).
- [ ] Criar ou atualizar testes **somente se o contrato autorizar** na mesma PR; caso contrário, apontar para PR-PROVA.
- [ ] Rodar `node --check <arquivo>` para validar sintaxe antes do commit.
- [ ] Rodar regressões dos smoke tests existentes antes do commit.
- [ ] Commit + push na branch da PR.
- [ ] Atualizar governança: status, handoff, execution log, INDEX.md.
- [ ] Apontar próxima PR-PROVA no handoff.

**Regressões obrigatórias após PR-IMPL (mínimo):**

```bash
node tests/pr13-hardening-operacional.smoke.test.js   # 91 asserts
node tests/pr14-executor-deploy-real-loop.smoke.test.js # 183 asserts
```

**Exemplo:** PR18 importou `advanceContractPhase`, criou `handleAdvancePhase`, adicionou rota
`POST /contracts/advance-phase` e atualizou `handleGetLoopStatus`. Patch em 4 pontos cirúrgicos.

---

## 9. Como executar prova (PR-PROVA)

**Checklist PR-PROVA:**

- [ ] Ler todos os arquivos obrigatórios da sessão (seção 2).
- [ ] Confirmar que existe PR-IMPL anterior que está sendo provada.
- [ ] **Não alterar nenhum arquivo de runtime.**
- [ ] Criar smoke test com asserts objetivos e verificáveis.
- [ ] Validar comportamento esperado conforme descrito no contrato e no diagnóstico.
- [ ] Se o teste falhar, **parar e documentar** — não corrigir o runtime na mesma PR.
- [ ] Se o teste revelar comportamento inesperado, documentar como observação (sem corrigir).
- [ ] Rodar regressões de testes anteriores (todos os smoke tests da frente).
- [ ] Registrar resultado com contagem de asserts (ex: `53/53 ✅`).
- [ ] Atualizar governança: status, handoff, execution log, INDEX.md.

**Regressões obrigatórias em PR-PROVA (conforme histórico):**

```bash
node tests/pr21-loop-status-states.smoke.test.js       # 53 asserts
node tests/pr20-loop-status-in-progress.smoke.test.js  # 27 asserts
node tests/pr19-advance-phase-e2e.smoke.test.js        # 52 asserts
node tests/pr18-advance-phase-endpoint.smoke.test.js   # 45 asserts
node tests/pr13-hardening-operacional.smoke.test.js    # 91 asserts
node tests/pr14-executor-deploy-real-loop.smoke.test.js # 183 asserts
# Total esperado: 451 asserts, 0 failed
```

**Exemplo:** PR21 criou `tests/pr21-loop-status-states.smoke.test.js` (53/53 ✅) sem alterar runtime.
Documentou observação sobre `status_global: "blocked"` sem corrigir comportamento.

---

## 10. Como executar documentação (PR-DOCS)

**Checklist PR-DOCS:**

- [ ] Ler todos os arquivos obrigatórios da sessão (seção 2).
- [ ] **Não alterar nenhum arquivo de runtime** (`.js`, `.ts`, `.toml`, `.yml`, etc.).
- [ ] Criar ou atualizar documentos baseados **exclusivamente em fontes confirmadas** do repo.
- [ ] Não inventar componentes, rotas, comportamentos ou procedimentos.
- [ ] Marcar incertezas com `[a verificar]` ou `[não confirmado]`.
- [ ] Verificar consistência com `ENAVIA_SYSTEM_MAP.md` e `ENAVIA_ROUTE_REGISTRY.json`.
- [ ] Confirmar com `git diff --name-only` que nenhum arquivo de runtime foi alterado.
- [ ] Atualizar: `ENAVIA_STATUS_ATUAL.md`, `ENAVIA_LATEST_HANDOFF.md`, `ENAVIA_EXECUTION_LOG.md`, `INDEX.md`.
- [ ] Para JSON: validar com `node -e "JSON.parse(require('fs').readFileSync(...))"`.

**Exemplo:** PR23 criou `ENAVIA_ROUTE_REGISTRY.json` com 68 rotas via grep de `nv-enavia.js`.
Validação: 0 violações de enum, 0 campos ausentes, 10/10 rotas obrigatórias presentes.

---

## 11. Como diagnosticar bloqueios comuns

### Tabela de bloqueios

| Sintoma | Causa provável | Onde verificar | Próxima ação segura |
|---------|---------------|----------------|---------------------|
| Contrato ativo não encontrado | `schema/contracts/INDEX.md` inexistente ou desatualizado | `schema/contracts/INDEX.md`, `schema/contracts/active/` | Criar INDEX.md ou atualizar com contrato correto |
| INDEX.md, status e handoff divergem na próxima PR | Atualização de governança incompleta em PR anterior | Comparar os três arquivos | Reconciliar manualmente antes de prosseguir |
| `loop-status` sem `availableActions` | Estado não mapeado em `handleGetLoopStatus` | `nv-enavia.js` — handler `handleGetLoopStatus` | PR-DIAG para mapear o gap; PR-IMPL para corrigir |
| `execute-next` bloqueado (`can_execute: false`) | `operationalAction.can_execute !== true` | `buildOperationalAction` em `nv-enavia.js:4805` | Verificar `nextAction.type` no loop-status |
| `complete-task` retorna 500 | `state.definition_of_done` ausente ou não é array | KV key `contract:{id}:state` | Verificar shape do state — adicionar `definition_of_done: [...]` |
| `advance-phase` retorna 409 | `checkPhaseGate` falhou — tasks incompletas | `contract-executor.js:975` | Verificar status das tasks da fase via `GET /contracts` |
| Endpoint ausente no registry | Rota existe no código mas não foi documentada | `ENAVIA_ROUTE_REGISTRY.json`, PR23 | Atualizar registry em PR-DOCS futura |
| Rota existe no registry mas 404 em runtime | Endpoint removido sem atualizar registry | `nv-enavia.js` — grep pelo path | PR-DIAG + PR-DOCS para atualizar registry |
| Erro de JSON/body inválido | Body malformado ou Content-Type ausente | Headers da request; handler específico | Enviar `Content-Type: application/json` e body JSON válido |
| Falha de KV (`db[key] not found`) | Contrato não existe no KV ou key incorreta | KV key `contract:index`, `contract:{id}:state` | Verificar se contrato foi criado via `POST /contracts` |
| Falta de binding/service | `env.EXECUTOR` ou `env.DEPLOY_WORKER` ausente | `wrangler.toml` — `[[services]]` | Verificar bindings locais; em smoke tests, usar mock |
| Erro no Executor (`callExecutorBridge` falha) | `EXECUTOR` service binding ausente ou /audit retornou erro | `nv-enavia.js` — `callExecutorBridge` | Mock o EXECUTOR no smoke test; em PROD, verificar deploy do `enavia-executor` |
| Erro no Deploy Worker (`callDeployBridge` falha) | `DEPLOY_WORKER` binding ausente ou /apply-test bloqueado | `nv-enavia.js` — `callDeployBridge` | Mock o DEPLOY_WORKER no smoke test; ações de prod são bloqueadas por design |

### Diagnóstico rápido de estado via `loop-status`

```bash
# Verificar estado atual de um contrato
curl -s "https://nv-enavia.brunovasque.workers.dev/contracts/loop-status?id=<contract_id>" | jq .

# Campos relevantes a verificar:
# .loop.availableActions  — ação disponível
# .loop.canProceed        — se pode avançar
# .loop.blocked           — se está bloqueado
# .loop.blockReason       — motivo do bloqueio
# .nextAction.type        — tipo da próxima ação
# .nextAction.status      — status atual
# .operationalAction.can_execute — se execute-next está liberado
```

### Diagnóstico rápido de estado via smoke tests locais

```bash
# Rodar todos os smoke tests (modo local com mocks)
node tests/pr21-loop-status-states.smoke.test.js    # Matriz de estados
node tests/pr19-advance-phase-e2e.smoke.test.js     # Ciclo E2E completo
node tests/pr18-advance-phase-endpoint.smoke.test.js # Endpoint advance-phase
node tests/pr20-loop-status-in-progress.smoke.test.js # Estado in_progress
```

---

## 12. Como fazer rollback

### 12.1 Rollback de PR-DOCS

```bash
git revert <commit_hash>
git push origin <branch>
# Criar nova PR com o revert
```

- Nenhum impacto em runtime.
- Documentar no execution log: motivo, commit revertido, data.
- Não apagar histórico de governança — apenas atualizar para refletir o revert.

### 12.2 Rollback de PR-PROVA

```bash
git revert <commit_hash>
git push origin <branch>
```

- Apenas remove arquivos de teste.
- Nenhum impacto em runtime.
- Documentar no execution log.

### 12.3 Rollback de PR-IMPL

```bash
git revert <commit_hash>
git push origin <branch>
# OU
git checkout <commit_anterior> -- nv-enavia.js
git commit -m "rollback: reverter <descricao>"
git push origin <branch>
```

- **Obrigatório:** rodar smoke tests após o revert para confirmar que não há regressão.
- **Obrigatório:** documentar no execution log: qual comportamento foi revertido, por quê, qual commit.
- **Atenção:** se o KV foi alterado pela PR-IMPL, o rollback de código não reverte o KV.

### 12.4 Rollback quando houve mudança de KV

O KV (ENAVIA_BRAIN) não tem rollback automático. Se uma PR-IMPL escreveu no KV:

1. Identificar as keys afetadas: `contract:{id}:state`, `contract:{id}:decomposition`, `contract:index`.
2. Reverter manualmente via `POST /contracts` ou endpoint correspondente, se disponível.
3. Se não houver endpoint de reverter KV, documentar o impacto e aguardar instrução humana.
4. **Nunca apagar dados de KV sem autorização explícita do operador humano.**

### 12.5 Quando rollback NÃO deve ser automático

- Se houve aprovação humana da PR-IMPL (merge confirmado).
- Se o KV foi alterado e o rollback pode causar inconsistência de estado.
- Se outras PRs dependem do comportamento introduzido.
- Em caso de dúvida: parar e reportar ao operador antes de reverter.

### 12.6 Registro de rollback

Sempre registrar em `schema/execution/ENAVIA_EXECUTION_LOG.md`:

```
## <data> — ROLLBACK — <descrição>
- Commit revertido: <hash>
- Motivo: <motivo>
- KV afetado: sim/não — <detalhe se sim>
- Smoke tests após revert: <resultado>
- Próxima ação: <o que fazer>
```

---

## 13. Smoke tests oficiais por frente

| Frente | Arquivo de teste | Asserts | O que prova |
|--------|-----------------|---------|------------|
| Hardening operacional (PR13) | `tests/pr13-hardening-operacional.smoke.test.js` | 91 | Gates do execute-next: JSON inválido, sem KV, sem contrato, can_execute:false, evidence gate, approve gates |
| Executor + Deploy bridge (PR14) | `tests/pr14-executor-deploy-real-loop.smoke.test.js` | 183 | Chain completo audit→propose→deploy/audit→apply-test; JSON inválido nos bridges; ordem das chamadas |
| Endpoint advance-phase (PR18) | `tests/pr18-advance-phase-endpoint.smoke.test.js` | 45 | Input inválido, happy path, gate bloqueado, integração com loop-status, isolamento de execute-next |
| E2E ciclo completo (PR19) | `tests/pr19-advance-phase-e2e.smoke.test.js` | 52 | Ciclo execute-next→complete-task→phase_complete→advance-phase→próxima task; bloqueio de gate; isolamento |
| loop-status in_progress (PR20) | `tests/pr20-loop-status-in-progress.smoke.test.js` | 27 | complete-task exposto em in_progress; estados indevidos não mostram complete-task; canProceed correto |
| Matriz de estados (PR21) | `tests/pr21-loop-status-states.smoke.test.js` | 53 | Matriz cruzada: queued→execute-next, in_progress→complete-task, phase_complete→advance-phase, plan_rejected/cancelled/contract_complete→vazio |
| **Total consolidado** | — | **451** | **0 regressões** |

**Comando para rodar todos:**

```bash
node tests/pr21-loop-status-states.smoke.test.js
node tests/pr20-loop-status-in-progress.smoke.test.js
node tests/pr19-advance-phase-e2e.smoke.test.js
node tests/pr18-advance-phase-endpoint.smoke.test.js
node tests/pr14-executor-deploy-real-loop.smoke.test.js
node tests/pr13-hardening-operacional.smoke.test.js
```

**Resultado esperado:** cada teste deve terminar com `N passed, 0 failed`.

---

## 14. Como usar o System Map e Route Registry

### ENAVIA_SYSTEM_MAP.md (PR22)

- **O que é:** visão macro do sistema — componentes, workers, bindings, KV, estados, loop, fontes de verdade.
- **Quando usar:** para entender a arquitetura geral, identificar onde um componente existe, entender transições de estado.
- **Localização:** `schema/system/ENAVIA_SYSTEM_MAP.md`

### ENAVIA_ROUTE_REGISTRY.json (PR23)

- **O que é:** registry machine-readable de 68 rotas HTTP reais do worker `nv-enavia`.
- **Quando usar:** para confirmar se um endpoint existe, qual handler chama, qual auth exige, qual input/output espera.
- **Localização:** `schema/system/ENAVIA_ROUTE_REGISTRY.json`
- **Como consultar:**

```bash
# Listar todas as rotas de contratos
node -e "
const reg = JSON.parse(require('fs').readFileSync('schema/system/ENAVIA_ROUTE_REGISTRY.json','utf8'));
reg.routes.filter(r => r.scope.startsWith('contracts')).forEach(r => console.log(r.method, r.path, '->', r.handler));
"

# Confirmar se um endpoint existe
node -e "
const reg = JSON.parse(require('fs').readFileSync('schema/system/ENAVIA_ROUTE_REGISTRY.json','utf8'));
const found = reg.routes.find(r => r.method === 'POST' && r.path === '/contracts/advance-phase');
console.log(found ? 'Existe: ' + found.handler : 'Não encontrada');
"
```

### ENAVIA_OPERATIONAL_PLAYBOOK.md (este documento — PR24)

- **O que é:** manual operacional — como executar, diagnosticar, fazer rollback e handoff.
- **Quando usar:** antes de qualquer operação no sistema ENAVIA.

### PR25 (pendente)

- **O que será:** registry de workers, bindings, KV e secrets esperados em PROD e TEST.
- **Não usar o System Map como substituto** — o System Map é visão macro; o registry de PR25 será o inventário de deploy.

### Regras de uso

- **Não usar o System Map para confirmar rotas** — usar o Route Registry (PR23).
- **Não usar o Route Registry para inventar comportamento** — apenas confirmar existência e shape.
- **Não assumir que um endpoint existe só porque está documentado** — confirmar via grep em `nv-enavia.js`.
- **Ao criar nova rota:** atualizar `ENAVIA_ROUTE_REGISTRY.json` em PR-DOCS subsequente.
- **Ao remover rota:** marcar como `"status": "legacy"` no registry antes de remover do código.

---

## 15. Procedimento padrão de handoff entre PRs

Ao final de cada PR — antes de fazer push e criar a PR no GitHub — executar este checklist de handoff:

### 15.1 Atualizar ENAVIA_STATUS_ATUAL.md

```markdown
**Data:** <data>
**Branch ativa:** `<branch>`
**Última tarefa:** <PR> — <tipo> — <descrição resumida do que foi feito>.
```

Incluir: branch base, commits relevantes, arquivos alterados, smoke tests executados.

### 15.2 Atualizar ENAVIA_LATEST_HANDOFF.md

Estrutura obrigatória:

```markdown
# ENAVIA — Latest Handoff
**De:** PR<N> — ...
**Para:** PR<N+1> — ...

## O que foi feito nesta sessão
[descrição detalhada]

## Critérios de aceite — atendidos
[tabela]

## Contrato ativo
[nome do arquivo]

## Próxima ação autorizada
PR<N+1> — ...
[pré-requisito e objetivo]

## Bloqueios
- nenhum (ou listar bloqueios)
```

### 15.3 Atualizar ENAVIA_EXECUTION_LOG.md

Inserir bloco **no topo** do arquivo (após o header):

```markdown
## <data> — PR<N> — <tipo> — <título>
- **Branch:** `<branch>`
- **Tipo:** `<PR-DOCS|PR-IMPL|PR-DIAG|PR-PROVA>`
- **Contrato ativo:** ...
- **PR anterior validada:** PR<N-1> ✅
- **Escopo:** <descrição>
### Objetivo
### Arquivos alterados
### Arquivos NÃO alterados
### Smoke tests
```

### 15.4 Atualizar schema/contracts/INDEX.md

Na seção "Próxima PR autorizada", substituir a PR atual pela próxima:

```markdown
## Próxima PR autorizada
**PR<N+1>** — <tipo> — <objetivo>
Contexto: <o que foi feito na PR<N> e por que PR<N+1> é a próxima>.
### Histórico recente
- **PR<N>** ✅ (tipo, commit, PR # e título)
```

### 15.5 Checklist final de handoff

- [ ] `ENAVIA_STATUS_ATUAL.md` atualizado com branch, data, PR concluída.
- [ ] `ENAVIA_LATEST_HANDOFF.md` aponta para a próxima PR autorizada.
- [ ] `ENAVIA_EXECUTION_LOG.md` tem bloco desta PR no topo.
- [ ] `schema/contracts/INDEX.md` aponta para próxima PR.
- [ ] Próxima PR registrada com objetivo claro.
- [ ] Bloqueios registrados (ou "nenhum").
- [ ] Rollback documentado.
- [ ] Smoke tests com resultado registrado.

---

## 16. Regras de segurança

### Autonomia

- **Nenhuma autonomia cega.** Toda execução deve passar por diagnóstico → implementação supervisionada → prova → documentação.
- **Nunca avançar sem evidência.** Se não há smoke test que prove, não há certeza.
- **Nunca fechar etapa sem prova real.** "Funcionou na minha cabeça" não é prova.

### Produção

- **Nenhuma produção sem autorização explícita.** Gates de produção (`approve`, `promote`) são bloqueados por design no Deploy Worker.
- **`callDeployBridge` só executa `apply-test` com `target_env: "test"`** — `target_env: "prod"` é bloqueado na camada de código.
- **Nunca relaxar gates.** Os gates (`evaluateAdherence`, `checkPhaseGate`, `buildEvidenceReport`) são camadas de segurança, não obstáculos.

### Transparência

- **Nunca esconder falha.** Se um teste falha, documentar e parar — não ajustar o teste para passar.
- **Nunca transformar PR-PROVA em PR-IMPL.** Se o smoke test revela um bug, criar nova PR-DIAG + PR-IMPL.
- **Nunca misturar Worker/Panel/Executor/Deploy/docs** na mesma PR.

### Secrets e dados sensíveis

- **Nunca expor secrets** (`INTERNAL_TOKEN`, `OPENAI_API_KEY`, `CLOUDFLARE_API_TOKEN`) em logs, respostas ou documentação.
- **Nunca imprimir valores secretos** em `console.log` ou retornar em responses HTTP.
- **Marcar como `[a verificar]`** qualquer incerteza sobre autenticação de rotas.

### Integridade do registry e documentação

- **Não registrar rota que não exista no código.** Usar grep como evidência.
- **Não documentar comportamento que não foi confirmado por teste.** Usar `[a verificar]`.
- **Manter `unknowns` documentados** em vez de inventar certeza.

---

## 17. Itens opcionais — não mexer agora

> **Isso é opcional. Não mexa agora.**

Os itens abaixo estão fora do escopo das PRs atuais e só devem ser abordados após PR30
(encerramento do contrato ativo) ou com abertura de novo contrato:

- **Remover dead code** — `consolidateAfterSave()` em `contract-executor.js` é dead code confirmado. Remoção requer PR-IMPL com PR-DIAG precedente.
- **Integrar engines desconectadas** — `contract-active-state.js`, `contract-ingestion.js`, `enavia-capabilities.js`, `enavia-constitution.js`, `enavia-identity.js` estão desconectadas por risco de estado duplicado. Não integrar sem refatoração prévia.
- **Criar autonomia completa** — skills supervisionadas só entram após PR25 (System/Tool Registry completo).
- **Criar endpoint novo de system map** — o System Map é documentação, não endpoint HTTP.
- **Refatorar schemas** — schemas existentes (`planner-*.js`, `memory-*.js`) funcionam. Não refatorar por estética.
- **Mexer no Executor externo** — `enavia-executor` tem seu próprio ciclo de deploy. Alterações requerem PR no repo do executor com governança própria.
- **Alterar runtime para refletir o playbook** — o playbook documenta o comportamento existente; não o contrário.
- **Isolamento completo de TEST/PROD** — `DIRECTOR_COGNITIVE_URL` é o mesmo em TEST e PROD. Isolamento total requer endpoint dedicado `nv-director-cognitive-test`. Registrado como limitação em `wrangler.toml`.
- **Timeout com cancelamento real** — `handleExecuteContract` não tem timeout seguro. Requer handler idempotente antes de implementar.

---

## 18. Checklist final antes de encerrar uma PR

Executar este checklist **antes do commit final e do push**:

- [ ] **Contrato ativo lido** — leitura completa, incluindo critérios de aceite da PR.
- [ ] **Próxima PR confirmada** — INDEX.md, status e handoff estão alinhados.
- [ ] **Escopo respeitado** — nenhum arquivo fora do escopo da PR foi alterado.
- [ ] **Arquivos alterados conferidos** — `git diff --name-only` confirma apenas arquivos permitidos.
- [ ] **Testes/verificações executados** — resultados registrados com contagem de asserts.
- [ ] **Regressões rodadas** — nenhum teste existente quebrado.
- [ ] **Governança atualizada** — status, handoff, execution log, INDEX.md.
- [ ] **Rollback documentado** — como reverter esta PR em caso de problema.
- [ ] **Branch confirmada** — `git log --oneline -3` mostra o commit correto na branch correta.
- [ ] **Commit feito** — com mensagem descritiva e `Co-Authored-By`.
- [ ] **Push confirmado** — `git push origin <branch>` sem erro.
- [ ] **PR criada no GitHub** — com body completo (objetivo, escopo, tipo, arquivos, smoke tests, rollback).

---

## Apêndice A — Referências rápidas

### Arquivos de governança

| Arquivo | Papel |
|---------|-------|
| `CLAUDE.md` | Lei operacional do repo |
| `schema/CODEX_WORKFLOW.md` | Workflow inicial |
| `schema/contracts/INDEX.md` | Próxima PR autorizada + histórico |
| `schema/contracts/active/*.md` | Contratos ativos e históricos |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Estado operacional atual |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Handoff entre sessões |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Log cronológico de execuções |
| `schema/system/ENAVIA_SYSTEM_MAP.md` | Mapa macro do sistema (PR22) |
| `schema/system/ENAVIA_ROUTE_REGISTRY.json` | Registry de rotas (PR23) |
| `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` | Este playbook (PR24) |

### Endpoints do loop contratual (extraídos do Route Registry)

| Método | Path | Handler | Escopo |
|--------|------|---------|--------|
| `GET` | `/contracts/loop-status` | `handleGetLoopStatus` | `contracts.loop` |
| `POST` | `/contracts/execute-next` | `handleExecuteNext` | `contracts.loop` |
| `POST` | `/contracts/complete-task` | `handleCompleteTask` | `contracts.loop` |
| `POST` | `/contracts/advance-phase` | `handleAdvancePhase` | `contracts.loop` |
| `POST` | `/contracts/close-final` | `handleCloseFinalContract` | `contracts` |

### Padrão de branch

```
claude/pr<N>-<descricao-curta>
```

Exemplos: `claude/pr18-impl-advance-phase`, `claude/pr21-prova-loop-status-states`,
`claude/pr24-docs-enavia-operational-playbook`.

### Formato de resposta final obrigatório

```
WORKFLOW_ACK: ok

PR executada: PR<N> — <tipo> — <título>
Branch: claude/pr<N>-...
Commit: <hash>
Link da PR: https://github.com/brunovasque/nv-enavia/pull/<N>

Tipo da PR: PR-DOCS|PR-IMPL|PR-DIAG|PR-PROVA
Contrato ativo: CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md
PR anterior validada: PR<N-1> ✅

Arquivos alterados:
- ...

Smoke tests:
- Comando: ...
- Resultado: ...

Governança atualizada:
- status: ✅
- handoff: ✅
- execution log: ✅
- INDEX.md: ✅

Rollback:
- ...

Bloqueios:
- nenhum
```
