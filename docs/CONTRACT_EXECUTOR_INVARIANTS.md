# ENAVIA — Contract Executor Invariants

> Versão: v1.1 (hardened)
> Escopo: worker (`contract-executor.js`)
> Status: ATIVO

Estas três regras são invariantes do executor. Nenhum código de executor pode violá-las.

---

## 1. Source of Truth Rule

**A memória do modelo NÃO é fonte da verdade.**

Toda decisão de execução usa exclusivamente o estado persistido no KV:

- `contract:<id>:state`
- `contract:<id>:decomposition`

Qualquer valor que exista apenas no contexto/memória do modelo é considerado obsoleto.
O executor nunca age sobre valores não confirmados pelo KV.

**Implementação:** `rehydrateContract(env, contractId)` é a função canônica de leitura.
Ela retorna `{ state, decomposition }` lidos diretamente do KV.

---

## 2. Mandatory Phase Gate

**`current_phase` não avança sem que os critérios de aceite da fase atual sejam satisfeitos.**

Antes de avançar para a próxima fase, o executor verifica via `checkPhaseGate(state, decomposition)` se todas as tarefas da fase ativa estão em um status de conclusão (`done`, `merged`, `completed`, `skipped`).

- Se o gate **passar** → a fase é marcada como `done`, `current_phase` avança, `status_global` se torna `"in_progress"` (ou `"completed"` se todas as fases terminaram), e `blockers` é limpo.
- Se o gate **falhar** → `status_global` é definido como `blocked`, o motivo é registrado em `blockers`, e nenhuma fase é avançada.

O humano deve resolver os bloqueios antes de qualquer nova tentativa de avanço.

**Implementação:** `advanceContractPhase(env, contractId)` — única função autorizada a avançar `current_phase`.

---

## 3. Single Advance Path + Rehydration Before Action

**Antes de qualquer ação futura do executor, reler o estado do KV.**

O fluxo obrigatório antes de cada ação é:

```
rehydrateContract(env, contractId)
  → lê contract:<id>:state
  → lê contract:<id>:decomposition
  → retorna { state, decomposition } frescos do KV
```

Não é permitido reutilizar um `state` ou `decomposition` obtidos em uma chamada anterior sem reler do KV.

**`current_phase` só pode ser alterado por `advanceContractPhase`.**
Nenhum outro ponto do código pode modificar `current_phase` diretamente.
A função `advanceContractPhase`:
1. Reidrata do KV (`rehydrateContract`)
2. Roda o gate (`checkPhaseGate`)
3. Valida que a fase destino é conhecida (`isValidPhaseValue`)
4. Avança ou bloqueia
5. Persiste o novo estado no KV

**Implementação:** `rehydrateContract` usa `Promise.all` para ler ambos os valores em paralelo,
garantindo consistência e eficiência.

---

## Phase Transition Validation

`isValidPhaseValue(phaseValue, decomposition)` valida que um valor de `current_phase` é:
- Um dos `SPECIAL_PHASES` (`decomposition_complete`, `ingestion_blocked`, `all_phases_complete`), ou
- Um phase ID que existe na decomposição do contrato (`phase_01`, `phase_02`, etc.)

Isso impede drift para valores arbitrários ou de memória stale.

---

## Drift Prevention: Blocked → In Progress

Quando `advanceContractPhase` consegue avançar após um bloqueio anterior:
- `status_global` muda de `"blocked"` para `"in_progress"` (não permanece `"blocked"`)
- `blockers` é limpo (array vazio)
- Isso impede o "ghost blocked" state onde o contrato avançou mas ainda está marcado como bloqueado

---

## Fluxo Combinado

```
advanceContractPhase(env, contractId)
  │
  ├─ rehydrateContract(env, contractId)        ← Rule 1 + Rule 3
  │     reads state + decomposition from KV
  │
  ├─ checkPhaseGate(state, decomposition)      ← Rule 2
  │     canAdvance? yes / no
  │
  ├─ [NO]  → status_global = "blocked"
  │           blockers updated
  │           persisted to KV
  │
  └─ [YES] → isValidPhaseValue(nextPhase)     ← Rule 3 (validation)
              active phase marked "done"
              current_phase advanced
              status_global = "in_progress" (or "completed")
              blockers cleared
              persisted to KV
```

---

## Exported API

| Símbolo | Tipo | Regra |
|---------|------|-------|
| `rehydrateContract(env, contractId)` | `async function` | 1 + 3 |
| `checkPhaseGate(state, decomposition)` | `function` | 2 |
| `isValidPhaseValue(phaseValue, decomposition)` | `function` | 3 |
| `advanceContractPhase(env, contractId)` | `async function` | 1 + 2 + 3 |
| `TASK_DONE_STATUSES` | `string[]` | 2 |
| `SPECIAL_PHASES` | `string[]` | 3 |
