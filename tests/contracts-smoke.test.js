// ============================================================================
// 🧪 Smoke Tests — ENAVIA Contract Executor v1 (Fase A)
//
// Run: node tests/contracts-smoke.test.js
//
// Tests:
//   1. Create valid contract
//   2. Reject invalid contract
//   3. Read existing contract
//   4. Read contract summary
//   5. Reject duplicate contract
//   6. Validation: pure function checks
// ============================================================================

import {
  validateContractPayload,
  buildInitialState,
  generateDecomposition,
  handleCreateContract,
  handleGetContract,
  handleGetContractSummary,
  rehydrateContract,
  checkPhaseGate,
  advanceContractPhase,
  TASK_DONE_STATUSES,
} from "../contract-executor.js";

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Mock KV store
// ---------------------------------------------------------------------------
function createMockKV() {
  const store = {};
  return {
    async get(key) {
      return store[key] || null;
    },
    async put(key, value) {
      store[key] = value;
    },
    _store: store,
  };
}

// Mock request helper
function mockRequest(body) {
  return {
    async json() {
      if (body === null) throw new Error("Invalid JSON");
      return body;
    },
  };
}

// ---------------------------------------------------------------------------
// Minimal valid contract payload
// ---------------------------------------------------------------------------
const VALID_PAYLOAD = {
  contract_id: "ctr_test_001",
  version: "v1",
  created_at: "2026-04-11T00:00:00Z",
  operator: "test-operator",
  goal: "Test contract for smoke tests",
  scope: {
    workers: ["nv-enavia"],
    routes: ["/test-route"],
    environments: ["TEST", "PROD"],
  },
  constraints: {
    max_micro_prs: 3,
    require_human_approval_per_pr: true,
    test_before_prod: true,
    rollback_on_failure: true,
  },
  definition_of_done: [
    "Criterion 1 passes",
    "Criterion 2 passes",
    "Smoke in TEST confirmed",
  ],
  context: {
    notes: "Smoke test contract",
  },
};

// ============================================================================
// TEST SUITE
// ============================================================================

async function runTests() {
  console.log("\n📜 ENAVIA Contract Executor v1 — Fase A Smoke Tests\n");

  // ---- Test 1: Validation — valid payload ----
  console.log("Test 1: Validate valid payload");
  {
    const result = validateContractPayload(VALID_PAYLOAD);
    assert(result.valid === true, "valid payload passes validation");
    assert(result.errors.length === 0, "no validation errors");
  }

  // ---- Test 2: Validation — missing fields ----
  console.log("\nTest 2: Reject invalid payload (missing fields)");
  {
    const result = validateContractPayload({});
    assert(result.valid === false, "empty object fails validation");
    assert(result.errors.length > 0, "has validation errors");
  }
  {
    const result = validateContractPayload({ contract_id: "x" });
    assert(result.valid === false, "partial payload fails validation");
  }
  {
    const result = validateContractPayload(null);
    assert(result.valid === false, "null payload fails validation");
  }
  {
    const result = validateContractPayload({
      ...VALID_PAYLOAD,
      version: "v2",
    });
    assert(result.valid === false, 'version != "v1" fails validation');
  }
  {
    const result = validateContractPayload({
      ...VALID_PAYLOAD,
      definition_of_done: [],
    });
    assert(result.valid === false, "empty definition_of_done fails validation");
  }
  {
    const result = validateContractPayload({
      ...VALID_PAYLOAD,
      scope: { environments: [] },
    });
    assert(result.valid === false, "empty scope.environments fails validation");
  }

  // ---- Test 3: Build initial state ----
  console.log("\nTest 3: Build initial state");
  {
    const state = buildInitialState(VALID_PAYLOAD);
    assert(state.contract_id === "ctr_test_001", "contract_id matches");
    assert(state.status_global === "decomposed", 'status_global is "decomposed"');
    assert(state.objective_final === VALID_PAYLOAD.goal, "objective_final matches goal");
    assert(state.operator === "test-operator", "operator matches");
    assert(state.prod_promotion_required === true, "prod_promotion_required is true");
    assert(state.next_action !== "", "next_action is set");
  }

  // ---- Test 4: Generate decomposition ----
  console.log("\nTest 4: Generate decomposition");
  {
    const state = buildInitialState(VALID_PAYLOAD);
    const decomp = generateDecomposition(state);
    assert(decomp.contract_id === "ctr_test_001", "decomposition has contract_id");
    assert(Array.isArray(decomp.phases), "phases is array");
    assert(decomp.phases.length === 3, "3 phases generated");
    assert(Array.isArray(decomp.tasks), "tasks is array");
    assert(decomp.tasks.length === 3, "3 tasks (one per definition_of_done)");
    assert(Array.isArray(decomp.micro_pr_candidates), "micro_pr_candidates is array");
    assert(decomp.micro_pr_candidates.length === 4, "4 micro_pr_candidates (3 + PROD promotion)");
    assert(decomp.generated_at !== undefined, "generated_at is set");
  }

  // ---- Test 5: handleCreateContract — success ----
  console.log("\nTest 5: Create valid contract via handler");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const req = mockRequest(VALID_PAYLOAD);
    const result = await handleCreateContract(req, env);
    assert(result.status === 201, "status 201");
    assert(result.body.ok === true, "ok is true");
    assert(result.body.contract_id === "ctr_test_001", "contract_id returned");
    assert(result.body.status_global === "decomposed", 'status_global is "decomposed"');
    assert(result.body.phases_count === 3, "phases_count is 3");
    assert(result.body.next_action !== "", "next_action is set");

    // Verify KV persistence
    const stateRaw = await kv.get("contract:ctr_test_001:state");
    assert(stateRaw !== null, "state persisted in KV");
    const decompRaw = await kv.get("contract:ctr_test_001:decomposition");
    assert(decompRaw !== null, "decomposition persisted in KV");
    const indexRaw = await kv.get("contract:index");
    assert(indexRaw !== null, "index updated in KV");
    const index = JSON.parse(indexRaw);
    assert(index.includes("ctr_test_001"), "contract_id in index");
  }

  // ---- Test 6: handleCreateContract — invalid JSON ----
  console.log("\nTest 6: Reject invalid JSON");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const req = mockRequest(null);
    const result = await handleCreateContract(req, env);
    assert(result.status === 400, "status 400 for invalid JSON");
    assert(result.body.ok === false, "ok is false");
    assert(result.body.error === "INVALID_JSON", "error is INVALID_JSON");
  }

  // ---- Test 7: handleCreateContract — validation error ----
  console.log("\nTest 7: Reject contract with missing required fields");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const req = mockRequest({ contract_id: "bad" });
    const result = await handleCreateContract(req, env);
    assert(result.status === 400, "status 400 for validation error");
    assert(result.body.error === "VALIDATION_ERROR", "error is VALIDATION_ERROR");
    assert(result.body.details.length > 0, "has details array with errors");
  }

  // ---- Test 8: handleCreateContract — duplicate ----
  console.log("\nTest 8: Reject duplicate contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // Create first
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    // Try duplicate
    const result = await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    assert(result.status === 409, "status 409 for duplicate");
    assert(result.body.error === "CONTRACT_ALREADY_EXISTS", "error is CONTRACT_ALREADY_EXISTS");
  }

  // ---- Test 9: handleGetContract — success ----
  console.log("\nTest 9: Read existing contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await handleGetContract(env, "ctr_test_001");
    assert(result.status === 200, "status 200");
    assert(result.body.ok === true, "ok is true");
    assert(result.body.contract !== null, "contract object present");
    assert(result.body.contract.contract_id === "ctr_test_001", "contract_id matches");
    assert(result.body.decomposition !== null, "decomposition present");
    assert(result.body.decomposition.phases.length === 3, "decomposition has 3 phases");
  }

  // ---- Test 10: handleGetContract — not found ----
  console.log("\nTest 10: Read non-existing contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await handleGetContract(env, "does_not_exist");
    assert(result.status === 404, "status 404");
    assert(result.body.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 11: handleGetContract — missing id ----
  console.log("\nTest 11: Read contract without id");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await handleGetContract(env, null);
    assert(result.status === 400, "status 400");
    assert(result.body.error === "MISSING_PARAM", "error is MISSING_PARAM");
  }

  // ---- Test 12: handleGetContractSummary — success ----
  console.log("\nTest 12: Read contract summary");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await handleGetContractSummary(env, "ctr_test_001");
    assert(result.status === 200, "status 200");
    assert(result.body.ok === true, "ok is true");
    assert(result.body.contract_id === "ctr_test_001", "contract_id matches");
    assert(result.body.status_global === "decomposed", "status_global is decomposed");
    assert(result.body.phases_count === 3, "phases_count is 3");
    assert(result.body.tasks_count === 3, "tasks_count is 3");
    assert(typeof result.body.next_action === "string", "next_action is string");
  }

  // ---- Test 13: handleGetContractSummary — not found ----
  console.log("\nTest 13: Read summary of non-existing contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await handleGetContractSummary(env, "nope");
    assert(result.status === 404, "status 404");
  }

  // ============================================================================
  // INVARIANT TESTS — Rules 1, 2, 3
  // ============================================================================

  // ---- Test 14: Rehydration Before Action (Rule 3 + Rule 1) ----
  console.log("\nTest 14: rehydrateContract always reads from KV (Rule 1 + Rule 3)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // Before contract exists — must return null, not stale memory
    const { state: stateMissing, decomposition: decompositionMissing } = await rehydrateContract(env, "does_not_exist");
    assert(stateMissing === null, "rehydrate returns null state for missing contract");
    assert(decompositionMissing === null, "rehydrate returns null decomposition for missing contract");

    // After contract is persisted — must return persisted values
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_test_001");
    assert(state !== null, "rehydrate returns state after creation");
    assert(state.contract_id === "ctr_test_001", "rehydrated state has correct contract_id");
    assert(decomposition !== null, "rehydrate returns decomposition after creation");
    assert(Array.isArray(decomposition.phases), "rehydrated decomposition has phases");

    // Simulated stale in-memory reference must not affect rehydrated result
    const staleState = { contract_id: "ctr_test_001", current_phase: "stale_memory", status_global: "stale" };
    // The real state in KV must differ from the stale in-memory copy
    assert(state.current_phase !== staleState.current_phase, "KV state differs from stale in-memory state");
    assert(state.status_global !== staleState.status_global, "KV status_global is authoritative, not stale memory");
  }

  // ---- Test 15: Phase Gate — blocks when tasks are incomplete (Rule 2) ----
  console.log("\nTest 15: checkPhaseGate blocks advancement when tasks are incomplete (Rule 2)");
  {
    const state = buildInitialState(VALID_PAYLOAD);
    const decomposition = generateDecomposition(state);
    // All tasks default to "pending" — gate must block
    const gate = checkPhaseGate(state, decomposition);
    assert(gate.canAdvance === false, "gate blocks advancement when tasks are pending");
    assert(typeof gate.reason === "string" && gate.reason.length > 0, "gate provides a reason");
    assert(gate.activePhaseId !== null, "gate identifies the active phase");
  }

  // ---- Test 16: Phase Gate — allows when all phase tasks are done (Rule 2) ----
  console.log("\nTest 16: checkPhaseGate allows advancement when all phase tasks are done (Rule 2)");
  {
    const state = buildInitialState(VALID_PAYLOAD);
    const decomposition = generateDecomposition(state);
    // Mark all tasks in the first phase as done
    const activePhaseId = decomposition.phases.find((p) => p.status !== "done").id;
    const tasksInPhase = decomposition.phases.find((p) => p.id === activePhaseId).tasks;
    decomposition.tasks = decomposition.tasks.map((t) =>
      tasksInPhase.includes(t.id) ? { ...t, status: "done" } : t
    );
    const gate = checkPhaseGate(state, decomposition);
    assert(gate.canAdvance === true, "gate allows advancement when all phase tasks are done");
    assert(gate.activePhaseId === activePhaseId, "gate reports correct active phase id");
  }

  // ---- Test 17: Phase Gate — handles missing state/decomposition (Rule 2) ----
  console.log("\nTest 17: checkPhaseGate handles null inputs safely (Rule 2)");
  {
    const gateNull = checkPhaseGate(null, null);
    assert(gateNull.canAdvance === false, "gate blocks when state is null");
    const gateNoDecomp = checkPhaseGate(buildInitialState(VALID_PAYLOAD), null);
    assert(gateNoDecomp.canAdvance === false, "gate blocks when decomposition is null");
  }

  // ---- Test 18: advanceContractPhase — blocked when tasks incomplete (Rules 1+2+3) ----
  console.log("\nTest 18: advanceContractPhase blocks and marks contract as blocked (Rules 1+2+3)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    // All tasks are pending — advancement must be blocked
    const result = await advanceContractPhase(env, "ctr_test_001");
    assert(result.ok === false, "advance returns ok=false when gate blocks");
    assert(result.state.status_global === "blocked", "state is set to blocked in KV");
    assert(result.state.blockers.length > 0, "blockers array is populated");
    assert(result.gate.canAdvance === false, "gate correctly reported canAdvance=false");

    // Verify KV was updated (rehydration confirms the write — Rule 1)
    const { state: rehydrated } = await rehydrateContract(env, "ctr_test_001");
    assert(rehydrated.status_global === "blocked", "rehydrated state confirms blocked status was persisted");
  }

  // ---- Test 19: advanceContractPhase — advances when tasks are done (Rules 1+2+3) ----
  console.log("\nTest 19: advanceContractPhase advances phase when gate passes (Rules 1+2+3)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    // Mark all tasks in phase_01 as done directly in KV
    const { decomposition } = await rehydrateContract(env, "ctr_test_001");
    const phase01 = decomposition.phases.find((p) => p.id === "phase_01");
    const updatedTasks = decomposition.tasks.map((t) =>
      phase01.tasks.includes(t.id) ? { ...t, status: "done" } : t
    );
    const updatedDecomp = { ...decomposition, tasks: updatedTasks };
    await kv.put("contract:ctr_test_001:decomposition", JSON.stringify(updatedDecomp));

    const result = await advanceContractPhase(env, "ctr_test_001");
    assert(result.ok === true, "advance returns ok=true when gate passes");
    assert(result.gate.canAdvance === true, "gate reported canAdvance=true");
    assert(result.state.current_phase !== "decomposition_complete", "current_phase was advanced");

    // Verify KV was updated (Rule 1 — state is source of truth)
    const { state: rehydrated } = await rehydrateContract(env, "ctr_test_001");
    assert(rehydrated.current_phase === result.state.current_phase, "rehydrated phase matches persisted phase");
  }

  // ---- Test 20: advanceContractPhase — not found (Rule 1) ----
  console.log("\nTest 20: advanceContractPhase returns error for missing contract (Rule 1)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await advanceContractPhase(env, "no_such_contract");
    assert(result.ok === false, "advance returns ok=false for missing contract");
    assert(result.error === "CONTRACT_NOT_FOUND", "error code is CONTRACT_NOT_FOUND");
  }

  // ---- Summary ----
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error in smoke tests:", err);
  process.exit(1);
});
