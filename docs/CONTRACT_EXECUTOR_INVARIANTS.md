# ENAVIA — Contract Executor Invariants

> Versão: v1
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

- Se o gate **passar** → a fase é marcada como `done`, `current_phase` avança.
- Se o gate **falhar** → `status_global` é definido como `blocked`, o motivo é registrado em `blockers`, e nenhuma fase é avançada.

O humano deve resolver os bloqueios antes de qualquer nova tentativa de avanço.

**Implementação:** `advanceContractPhase(env, contractId)` — única função autorizada a avançar `current_phase`.

---

## 3. Rehydration Before Action

**Antes de qualquer ação futura do executor, reler o estado do KV.**

O fluxo obrigatório antes de cada ação é:

```
rehydrateContract(env, contractId)
  → lê contract:<id>:state
  → lê contract:<id>:decomposition
  → retorna { state, decomposition } frescos do KV
```

Não é permitido reutilizar um `state` ou `decomposition` obtidos em uma chamada anterior sem reler do KV.

**Implementação:** `rehydrateContract` usa `Promise.all` para ler ambos os valores em paralelo,
garantindo consistência e eficiência.

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
  └─ [YES] → active phase marked "done"
              current_phase advanced
              persisted to KV
```

---

## Exported API

| Símbolo | Tipo | Regra |
|---------|------|-------|
| `rehydrateContract(env, contractId)` | `async function` | 1 + 3 |
| `checkPhaseGate(state, decomposition)` | `function` | 2 |
| `advanceContractPhase(env, contractId)` | `async function` | 1 + 2 + 3 |
| `TASK_DONE_STATUSES` | `string[]` | 2 |
