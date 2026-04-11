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
  isValidPhaseValue,
  advanceContractPhase,
  TASK_DONE_STATUSES,
  SPECIAL_PHASES,
  VALID_TASK_STATUSES,
  VALID_MICRO_PR_STATUSES,
  startTask,
  completeTask,
  blockTask,
  startMicroPrCandidate,
  completeMicroPrCandidate,
  blockMicroPrCandidate,
  discardMicroPrCandidate,
  resolveNextAction,
  NEXT_ACTION_TYPES,
  buildExecutionHandoff,
  HANDOFF_ACTIONABLE_TYPES,
  bindAcceptanceCriteria,
  ACCEPTANCE_CRITERIA_SCOPES,
  ACCEPTANCE_CRITERIA_STATUSES,
  recordError,
  evaluateErrorLoop,
  buildErrorEntry,
  MAX_RETRY_ATTEMPTS,
  ERROR_CLASSIFICATIONS,
  ERROR_LOOP_STATUSES,
  NON_RETRYABLE_CLASSIFICATIONS,
  buildContractSummary,
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
    assert(result.body.tasks_total === 3, "tasks_total is 3");
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

  // ============================================================================
  // HARDENING TESTS — v1 Drift Prevention + Phase Gate Enforcement
  // ============================================================================

  // ---- Test 21: isValidPhaseValue — accepts known decomposition phases ----
  console.log("\nTest 21: isValidPhaseValue validates against decomposition phases");
  {
    const state = buildInitialState(VALID_PAYLOAD);
    const decomposition = generateDecomposition(state);
    assert(isValidPhaseValue("phase_01", decomposition) === true, "phase_01 is valid");
    assert(isValidPhaseValue("phase_02", decomposition) === true, "phase_02 is valid");
    assert(isValidPhaseValue("phase_03", decomposition) === true, "phase_03 is valid");
    assert(isValidPhaseValue("decomposition_complete", decomposition) === true, "decomposition_complete is valid (special phase)");
    assert(isValidPhaseValue("all_phases_complete", decomposition) === true, "all_phases_complete is valid (special phase)");
    assert(isValidPhaseValue("ingestion_blocked", decomposition) === true, "ingestion_blocked is valid (special phase)");
    assert(isValidPhaseValue("stale_memory_phase", decomposition) === false, "arbitrary phase is rejected");
    assert(isValidPhaseValue("phase_99", decomposition) === false, "non-existent phase is rejected");
    assert(isValidPhaseValue("", decomposition) === false, "empty string is rejected");
  }

  // ---- Test 22: SPECIAL_PHASES constant is exported and complete ----
  console.log("\nTest 22: SPECIAL_PHASES constant exported correctly");
  {
    assert(Array.isArray(SPECIAL_PHASES), "SPECIAL_PHASES is an array");
    assert(SPECIAL_PHASES.includes("decomposition_complete"), "includes decomposition_complete");
    assert(SPECIAL_PHASES.includes("ingestion_blocked"), "includes ingestion_blocked");
    assert(SPECIAL_PHASES.includes("all_phases_complete"), "includes all_phases_complete");
  }

  // ---- Test 23: advanceContractPhase clears blocked status after successful advance ----
  console.log("\nTest 23: advanceContractPhase clears blocked status on successful advance (drift fix)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    // First, call advance with pending tasks to mark as blocked
    const blockedResult = await advanceContractPhase(env, "ctr_test_001");
    assert(blockedResult.ok === false, "first advance blocked as expected");
    assert(blockedResult.state.status_global === "blocked", "status_global is blocked");

    // Now complete all tasks in phase_01
    const { decomposition } = await rehydrateContract(env, "ctr_test_001");
    const phase01 = decomposition.phases.find((p) => p.id === "phase_01");
    const updatedTasks = decomposition.tasks.map((t) =>
      phase01.tasks.includes(t.id) ? { ...t, status: "done" } : t
    );
    await kv.put("contract:ctr_test_001:decomposition", JSON.stringify({ ...decomposition, tasks: updatedTasks }));

    // Advance again — should succeed AND clear blocked status
    const advanceResult = await advanceContractPhase(env, "ctr_test_001");
    assert(advanceResult.ok === true, "second advance succeeds");
    assert(advanceResult.state.status_global !== "blocked", "status_global is no longer blocked after successful advance");
    assert(advanceResult.state.status_global === "in_progress", "status_global is in_progress after advancing to next phase");
    assert(advanceResult.state.blockers.length === 0, "blockers array is cleared on successful advance");

    // Verify via KV rehydration (Rule 1)
    const { state: rehydrated } = await rehydrateContract(env, "ctr_test_001");
    assert(rehydrated.status_global === "in_progress", "rehydrated status confirms in_progress was persisted");
    assert(rehydrated.blockers.length === 0, "rehydrated blockers confirms cleared");
  }

  // ---- Test 24: Full multi-phase lifecycle — advance through all phases ----
  console.log("\nTest 24: Full lifecycle: advance through all phases until completion");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    // Complete and advance phase_01
    let { decomposition } = await rehydrateContract(env, "ctr_test_001");
    const phase01 = decomposition.phases.find((p) => p.id === "phase_01");
    let updatedTasks = decomposition.tasks.map((t) =>
      phase01.tasks.includes(t.id) ? { ...t, status: "done" } : t
    );
    await kv.put("contract:ctr_test_001:decomposition", JSON.stringify({ ...decomposition, tasks: updatedTasks }));

    let result = await advanceContractPhase(env, "ctr_test_001");
    assert(result.ok === true, "phase_01 advance succeeds");
    assert(result.state.current_phase === "phase_02", "current_phase is now phase_02");

    // Complete and advance phase_02
    ({ decomposition } = await rehydrateContract(env, "ctr_test_001"));
    const phase02 = decomposition.phases.find((p) => p.id === "phase_02");
    updatedTasks = decomposition.tasks.map((t) =>
      phase02.tasks.includes(t.id) ? { ...t, status: "done" } : t
    );
    await kv.put("contract:ctr_test_001:decomposition", JSON.stringify({ ...decomposition, tasks: updatedTasks }));

    result = await advanceContractPhase(env, "ctr_test_001");
    assert(result.ok === true, "phase_02 advance succeeds");
    assert(result.state.current_phase === "phase_03", "current_phase is now phase_03");

    // Complete and advance phase_03 (final)
    ({ decomposition } = await rehydrateContract(env, "ctr_test_001"));
    const phase03 = decomposition.phases.find((p) => p.id === "phase_03");
    updatedTasks = decomposition.tasks.map((t) =>
      phase03.tasks.includes(t.id) ? { ...t, status: "done" } : t
    );
    await kv.put("contract:ctr_test_001:decomposition", JSON.stringify({ ...decomposition, tasks: updatedTasks }));

    result = await advanceContractPhase(env, "ctr_test_001");
    assert(result.ok === true, "phase_03 advance succeeds");
    assert(result.state.current_phase === "all_phases_complete", "current_phase is all_phases_complete");
    assert(result.state.status_global === "completed", "status_global is completed");

    // Verify final state via KV (Rule 1)
    const { state: finalState } = await rehydrateContract(env, "ctr_test_001");
    assert(finalState.current_phase === "all_phases_complete", "rehydrated final phase is all_phases_complete");
    assert(finalState.status_global === "completed", "rehydrated final status is completed");
  }

  // ---- Test 25: advanceContractPhase uses TASK_DONE_STATUSES for all valid done states ----
  console.log("\nTest 25: Phase gate recognizes all TASK_DONE_STATUSES");
  {
    const state = buildInitialState(VALID_PAYLOAD);
    const decomposition = generateDecomposition(state);
    const activePhaseId = decomposition.phases.find((p) => p.status !== "done").id;
    const tasksInPhase = decomposition.phases.find((p) => p.id === activePhaseId).tasks;

    // Test each done status variant
    for (const doneStatus of TASK_DONE_STATUSES) {
      const modifiedTasks = decomposition.tasks.map((t) =>
        tasksInPhase.includes(t.id) ? { ...t, status: doneStatus } : t
      );
      const gate = checkPhaseGate(state, { ...decomposition, tasks: modifiedTasks });
      assert(gate.canAdvance === true, `gate passes when task status is "${doneStatus}"`);
    }
  }

  // ============================================================================
  // STATUS TRACKING TESTS — Task + Micro-PR Candidate State Management
  // ============================================================================

  // ---- Test 26: VALID_TASK_STATUSES and VALID_MICRO_PR_STATUSES exported ----
  console.log("\nTest 26: Status constants exported correctly");
  {
    assert(Array.isArray(VALID_TASK_STATUSES), "VALID_TASK_STATUSES is an array");
    assert(VALID_TASK_STATUSES.includes("queued"), "includes queued");
    assert(VALID_TASK_STATUSES.includes("in_progress"), "includes in_progress");
    assert(VALID_TASK_STATUSES.includes("completed"), "includes completed");
    assert(VALID_TASK_STATUSES.includes("blocked"), "includes blocked");
    assert(Array.isArray(VALID_MICRO_PR_STATUSES), "VALID_MICRO_PR_STATUSES is an array");
    assert(VALID_MICRO_PR_STATUSES.includes("queued"), "micro_pr includes queued");
    assert(VALID_MICRO_PR_STATUSES.includes("in_progress"), "micro_pr includes in_progress");
    assert(VALID_MICRO_PR_STATUSES.includes("completed"), "micro_pr includes completed");
    assert(VALID_MICRO_PR_STATUSES.includes("blocked"), "micro_pr includes blocked");
    assert(VALID_MICRO_PR_STATUSES.includes("discarded"), "micro_pr includes discarded");
  }

  // ---- Test 27: Tasks default to "queued" status ----
  console.log("\nTest 27: Tasks and micro_pr_candidates default to 'queued' status");
  {
    const state = buildInitialState(VALID_PAYLOAD);
    const decomp = generateDecomposition(state);
    for (const t of decomp.tasks) {
      assert(t.status === "queued", `task ${t.id} starts as queued`);
    }
    for (const m of decomp.micro_pr_candidates) {
      assert(m.status === "queued", `micro_pr ${m.id} starts as queued`);
    }
  }

  // ---- Test 28: startTask — success ----
  console.log("\nTest 28: startTask transitions task to in_progress");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await startTask(env, "ctr_test_001", "task_001");
    assert(result.ok === true, "startTask returns ok=true");
    assert(result.task.status === "in_progress", "task status is in_progress");
    assert(result.state.current_task === "task_001", "current_task updated to task_001");

    // Verify KV persistence
    const { decomposition } = await rehydrateContract(env, "ctr_test_001");
    const task = decomposition.tasks.find((t) => t.id === "task_001");
    assert(task.status === "in_progress", "persisted task status is in_progress");
  }

  // ---- Test 29: startTask — invalid transition ----
  console.log("\nTest 29: startTask rejects non-queued task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");
    // Try starting again (already in_progress)
    const result = await startTask(env, "ctr_test_001", "task_001");
    assert(result.ok === false, "startTask returns ok=false for in_progress task");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");
  }

  // ---- Test 30: startTask — contract not found ----
  console.log("\nTest 30: startTask returns error for missing contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await startTask(env, "no_contract", "task_001");
    assert(result.ok === false, "returns ok=false");
    assert(result.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 31: startTask — task not found ----
  console.log("\nTest 31: startTask returns error for missing task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await startTask(env, "ctr_test_001", "task_999");
    assert(result.ok === false, "returns ok=false");
    assert(result.error === "TASK_NOT_FOUND", "error is TASK_NOT_FOUND");
  }

  // ---- Test 32: completeTask — success ----
  console.log("\nTest 32: completeTask transitions task to completed");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");
    const result = await completeTask(env, "ctr_test_001", "task_001");
    assert(result.ok === true, "completeTask returns ok=true");
    assert(result.task.status === "completed", "task status is completed");

    // current_task should advance to next queued task
    assert(result.state.current_task === "task_002", "current_task advanced to task_002");

    // Verify KV persistence
    const { decomposition } = await rehydrateContract(env, "ctr_test_001");
    const task = decomposition.tasks.find((t) => t.id === "task_001");
    assert(task.status === "completed", "persisted task status is completed");
  }

  // ---- Test 33: completeTask — invalid transition ----
  console.log("\nTest 33: completeTask rejects non-in_progress task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    // task_001 is queued, not in_progress
    const result = await completeTask(env, "ctr_test_001", "task_001");
    assert(result.ok === false, "completeTask returns ok=false for queued task");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");
  }

  // ---- Test 34: blockTask — success from queued ----
  console.log("\nTest 34: blockTask transitions queued task to blocked");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await blockTask(env, "ctr_test_001", "task_002", "Dependency missing");
    assert(result.ok === true, "blockTask returns ok=true");
    assert(result.task.status === "blocked", "task status is blocked");
    assert(result.task.block_reason === "Dependency missing", "block_reason set");

    const { decomposition } = await rehydrateContract(env, "ctr_test_001");
    const task = decomposition.tasks.find((t) => t.id === "task_002");
    assert(task.status === "blocked", "persisted task status is blocked");
  }

  // ---- Test 35: blockTask — success from in_progress ----
  console.log("\nTest 35: blockTask transitions in_progress task to blocked");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");
    const result = await blockTask(env, "ctr_test_001", "task_001", "CI failed");
    assert(result.ok === true, "blockTask returns ok=true");
    assert(result.task.status === "blocked", "task status is blocked");
    // current_task should move to next queued task
    assert(result.state.current_task === "task_002", "current_task advanced after blocking");
  }

  // ---- Test 36: blockTask — invalid transition from completed ----
  console.log("\nTest 36: blockTask rejects completed task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");
    await completeTask(env, "ctr_test_001", "task_001");
    const result = await blockTask(env, "ctr_test_001", "task_001", "Too late");
    assert(result.ok === false, "blockTask returns ok=false for completed task");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");
  }

  // ---- Test 37: startMicroPrCandidate — success ----
  console.log("\nTest 37: startMicroPrCandidate transitions to in_progress");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    assert(result.ok === true, "startMicroPrCandidate returns ok=true");
    assert(result.micro_pr_candidate.status === "in_progress", "micro_pr status is in_progress");

    const { decomposition } = await rehydrateContract(env, "ctr_test_001");
    const mpr = decomposition.micro_pr_candidates.find((m) => m.id === "micro_pr_001");
    assert(mpr.status === "in_progress", "persisted micro_pr status is in_progress");
  }

  // ---- Test 38: startMicroPrCandidate — invalid transition ----
  console.log("\nTest 38: startMicroPrCandidate rejects non-queued");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    const result = await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    assert(result.ok === false, "startMicroPrCandidate returns ok=false");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");
  }

  // ---- Test 39: startMicroPrCandidate — not found ----
  console.log("\nTest 39: startMicroPrCandidate returns error for missing micro_pr");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_999");
    assert(result.ok === false, "returns ok=false");
    assert(result.error === "MICRO_PR_NOT_FOUND", "error is MICRO_PR_NOT_FOUND");
  }

  // ---- Test 40: completeMicroPrCandidate — success ----
  console.log("\nTest 40: completeMicroPrCandidate transitions to completed");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    const result = await completeMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    assert(result.ok === true, "completeMicroPrCandidate returns ok=true");
    assert(result.micro_pr_candidate.status === "completed", "micro_pr status is completed");

    const { decomposition } = await rehydrateContract(env, "ctr_test_001");
    const mpr = decomposition.micro_pr_candidates.find((m) => m.id === "micro_pr_001");
    assert(mpr.status === "completed", "persisted micro_pr status is completed");
  }

  // ---- Test 41: completeMicroPrCandidate — invalid transition ----
  console.log("\nTest 41: completeMicroPrCandidate rejects non-in_progress");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await completeMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    assert(result.ok === false, "completeMicroPrCandidate returns ok=false for queued");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");
  }

  // ---- Test 42: blockMicroPrCandidate — success from queued ----
  console.log("\nTest 42: blockMicroPrCandidate transitions queued to blocked");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await blockMicroPrCandidate(env, "ctr_test_001", "micro_pr_002", "Blocked by dependency");
    assert(result.ok === true, "blockMicroPrCandidate returns ok=true");
    assert(result.micro_pr_candidate.status === "blocked", "micro_pr status is blocked");
    assert(result.micro_pr_candidate.block_reason === "Blocked by dependency", "block_reason set");
  }

  // ---- Test 43: blockMicroPrCandidate — success from in_progress ----
  console.log("\nTest 43: blockMicroPrCandidate transitions in_progress to blocked");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    const result = await blockMicroPrCandidate(env, "ctr_test_001", "micro_pr_001", "Review failed");
    assert(result.ok === true, "blockMicroPrCandidate returns ok=true");
    assert(result.micro_pr_candidate.status === "blocked", "micro_pr status is blocked");
  }

  // ---- Test 44: blockMicroPrCandidate — invalid transition from completed ----
  console.log("\nTest 44: blockMicroPrCandidate rejects completed micro_pr");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    await completeMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    const result = await blockMicroPrCandidate(env, "ctr_test_001", "micro_pr_001", "Too late");
    assert(result.ok === false, "blockMicroPrCandidate returns ok=false for completed");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");
  }

  // ---- Test 45: discardMicroPrCandidate — success from queued ----
  console.log("\nTest 45: discardMicroPrCandidate transitions queued to discarded");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await discardMicroPrCandidate(env, "ctr_test_001", "micro_pr_002", "No longer needed");
    assert(result.ok === true, "discardMicroPrCandidate returns ok=true");
    assert(result.micro_pr_candidate.status === "discarded", "micro_pr status is discarded");
    assert(result.micro_pr_candidate.discard_reason === "No longer needed", "discard_reason set");
  }

  // ---- Test 46: discardMicroPrCandidate — success from in_progress ----
  console.log("\nTest 46: discardMicroPrCandidate transitions in_progress to discarded");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    const result = await discardMicroPrCandidate(env, "ctr_test_001", "micro_pr_001", "Approach changed");
    assert(result.ok === true, "discardMicroPrCandidate returns ok=true");
    assert(result.micro_pr_candidate.status === "discarded", "micro_pr status is discarded");
  }

  // ---- Test 47: discardMicroPrCandidate — success from blocked ----
  console.log("\nTest 47: discardMicroPrCandidate transitions blocked to discarded");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await blockMicroPrCandidate(env, "ctr_test_001", "micro_pr_001", "Blocked");
    const result = await discardMicroPrCandidate(env, "ctr_test_001", "micro_pr_001", "Giving up");
    assert(result.ok === true, "discardMicroPrCandidate returns ok=true from blocked");
    assert(result.micro_pr_candidate.status === "discarded", "micro_pr status is discarded");
  }

  // ---- Test 48: discardMicroPrCandidate — rejects completed ----
  console.log("\nTest 48: discardMicroPrCandidate rejects completed micro_pr");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    await completeMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    const result = await discardMicroPrCandidate(env, "ctr_test_001", "micro_pr_001", "Nope");
    assert(result.ok === false, "discardMicroPrCandidate returns ok=false for completed");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");
  }

  // ---- Test 49: discardMicroPrCandidate — rejects already discarded ----
  console.log("\nTest 49: discardMicroPrCandidate rejects already discarded");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await discardMicroPrCandidate(env, "ctr_test_001", "micro_pr_001", "First discard");
    const result = await discardMicroPrCandidate(env, "ctr_test_001", "micro_pr_001", "Second discard");
    assert(result.ok === false, "discardMicroPrCandidate returns ok=false for already discarded");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");
  }

  // ---- Test 50: current_task tracks correctly through lifecycle ----
  console.log("\nTest 50: current_task tracks correctly through task lifecycle");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    // Initially current_task is null
    let { state } = await rehydrateContract(env, "ctr_test_001");
    assert(state.current_task === null, "current_task starts as null");

    // Start task_001 → current_task = task_001
    await startTask(env, "ctr_test_001", "task_001");
    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    assert(state.current_task === "task_001", "current_task is task_001 after start");

    // Complete task_001 → current_task should advance to task_002 (next queued)
    await completeTask(env, "ctr_test_001", "task_001");
    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    assert(state.current_task === "task_002", "current_task advanced to task_002");

    // Start task_002
    await startTask(env, "ctr_test_001", "task_002");
    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    assert(state.current_task === "task_002", "current_task is task_002 after start");

    // Block task_002 → current_task should advance to task_003
    await blockTask(env, "ctr_test_001", "task_002", "Blocked!");
    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    assert(state.current_task === "task_003", "current_task advanced to task_003 after block");

    // Start and complete task_003 → current_task should be null (no more queued)
    await startTask(env, "ctr_test_001", "task_003");
    await completeTask(env, "ctr_test_001", "task_003");
    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    assert(state.current_task === null, "current_task is null when no more queued tasks");
  }

  // ---- Test 51: buildContractSummary reflects real progress ----
  console.log("\nTest 51: buildContractSummary reflects real task and micro-PR progress");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    // Initial summary — all queued
    let { state, decomposition } = await rehydrateContract(env, "ctr_test_001");
    let summary = buildContractSummary(state, decomposition);
    assert(summary.tasks_total === 3, "tasks_total is 3");
    assert(summary.tasks_queued === 3, "tasks_queued is 3 initially");
    assert(summary.tasks_completed === 0, "tasks_completed is 0 initially");
    assert(summary.tasks_blocked === 0, "tasks_blocked is 0 initially");
    assert(summary.tasks_in_progress === 0, "tasks_in_progress is 0 initially");
    assert(summary.micro_pr_candidates_total === 4, "micro_pr_candidates_total is 4");
    assert(summary.micro_pr_candidates_queued === 4, "micro_pr_candidates_queued is 4 initially");

    // Start task_001 and micro_pr_001
    await startTask(env, "ctr_test_001", "task_001");
    await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    ({ state, decomposition } = await rehydrateContract(env, "ctr_test_001"));
    summary = buildContractSummary(state, decomposition);
    assert(summary.tasks_in_progress === 1, "tasks_in_progress is 1 after starting task");
    assert(summary.tasks_queued === 2, "tasks_queued is 2 after starting one task");
    assert(summary.micro_pr_candidates_in_progress === 1, "micro_pr in_progress is 1");
    assert(summary.current_task === "task_001", "summary current_task is task_001");

    // Complete task_001 and micro_pr_001
    await completeTask(env, "ctr_test_001", "task_001");
    await completeMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    ({ state, decomposition } = await rehydrateContract(env, "ctr_test_001"));
    summary = buildContractSummary(state, decomposition);
    assert(summary.tasks_completed === 1, "tasks_completed is 1");
    assert(summary.tasks_in_progress === 0, "tasks_in_progress is 0 after completion");
    assert(summary.micro_pr_candidates_completed === 1, "micro_pr_candidates_completed is 1");

    // Block task_002 and discard micro_pr_002
    await blockTask(env, "ctr_test_001", "task_002", "Blocked");
    await discardMicroPrCandidate(env, "ctr_test_001", "micro_pr_002", "Discarded");
    ({ state, decomposition } = await rehydrateContract(env, "ctr_test_001"));
    summary = buildContractSummary(state, decomposition);
    assert(summary.tasks_blocked === 1, "tasks_blocked is 1");
    assert(summary.micro_pr_candidates_discarded === 1, "micro_pr_candidates_discarded is 1");
  }

  // ---- Test 52: handleGetContractSummary reflects enhanced progress ----
  console.log("\nTest 52: handleGetContractSummary includes enhanced progress fields");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");
    await startMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");
    await completeMicroPrCandidate(env, "ctr_test_001", "micro_pr_001");

    const result = await handleGetContractSummary(env, "ctr_test_001");
    assert(result.status === 200, "status 200");
    assert(result.body.ok === true, "ok is true");
    assert(result.body.current_task === "task_001", "current_task in summary");
    assert(result.body.tasks_total === 3, "tasks_total in summary");
    assert(result.body.tasks_in_progress === 1, "tasks_in_progress in summary");
    assert(result.body.micro_pr_candidates_completed === 1, "micro_pr_candidates_completed in summary");
    assert(result.body.micro_pr_candidates_total === 4, "micro_pr_candidates_total in summary");
    assert(typeof result.body.next_action === "string", "next_action present in summary");
  }

  // ---- Test 53: Old routes still work (regression check) ----
  console.log("\nTest 53: Old routes still work (regression check)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // Create
    const createResult = await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    assert(createResult.status === 201, "create still returns 201");
    assert(createResult.body.ok === true, "create still returns ok");
    // Read
    const readResult = await handleGetContract(env, "ctr_test_001");
    assert(readResult.status === 200, "read still returns 200");
    assert(readResult.body.contract.contract_id === "ctr_test_001", "read still has contract_id");
    // Summary
    const summaryResult = await handleGetContractSummary(env, "ctr_test_001");
    assert(summaryResult.status === 200, "summary still returns 200");
    assert(summaryResult.body.contract_id === "ctr_test_001", "summary still has contract_id");
    // Advance
    const advanceResult = await advanceContractPhase(env, "ctr_test_001");
    assert(advanceResult.ok === false, "advance still works (blocked, tasks queued)");
    // Not found
    const notFound = await handleGetContract(env, "nope");
    assert(notFound.status === 404, "not found still returns 404");
  }

  // ============================================================================
  // 🎯 NEXT ACTION ENGINE TESTS
  // ============================================================================

  // ---- Test 54: resolveNextAction — task ready (first task, no dependencies) ----
  console.log("\nTest 54: resolveNextAction — task ready to start");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_test_001");

    const action = resolveNextAction(state, decomposition);
    assert(action.type === "start_task", "type is start_task");
    assert(action.task_id === "task_001", "task_id is task_001 (first task)");
    assert(action.phase_id !== null, "phase_id is set");
    assert(action.status === "ready", "status is ready");
    assert(typeof action.reason === "string" && action.reason.length > 0, "reason is non-empty string");
    assert(action.micro_pr_candidate_id === "micro_pr_001", "micro_pr_candidate_id matches task");
  }

  // ---- Test 55: resolveNextAction — task blocked (dependency not satisfied) ----
  console.log("\nTest 55: resolveNextAction — dependency not satisfied");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // Create a contract where task_002 depends on task_001
    // Start task_001 (makes it in_progress, not done) — task_002 should not be startable
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");
    const { state, decomposition } = await rehydrateContract(env, "ctr_test_001");

    // Manually check: task_002 is in phase_02 and depends on task_001 (in_progress)
    // The active phase is phase_01 which has task_001
    // task_001 is in_progress, so the engine should return "no_action" (waiting)
    const action = resolveNextAction(state, decomposition);
    assert(action.type === "no_action", "type is no_action (task in progress)");
    assert(action.task_id === "task_001", "references the in-progress task");
    assert(action.status === "in_progress", "status is in_progress");
  }

  // ---- Test 56: resolveNextAction — task explicitly blocked ----
  console.log("\nTest 56: resolveNextAction — all phase tasks blocked");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    // Block task_001 (the only task in phase_01)
    await blockTask(env, "ctr_test_001", "task_001", "Manual block for test");
    const { state, decomposition } = await rehydrateContract(env, "ctr_test_001");

    const action = resolveNextAction(state, decomposition);
    assert(action.type === "contract_blocked", "type is contract_blocked");
    assert(action.status === "blocked", "status is blocked");
    assert(action.reason.includes("blocked"), "reason mentions blocked");
    assert(action.phase_id !== null, "phase_id is set");
  }

  // ---- Test 57: resolveNextAction — micro-PR ready (linked task completed) ----
  console.log("\nTest 57: resolveNextAction — micro-PR ready after task completion");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    // Complete task_001 (start then complete)
    await startTask(env, "ctr_test_001", "task_001");
    await completeTask(env, "ctr_test_001", "task_001");
    // Now micro_pr_001 (linked to task_001) should be ready, 
    // but first let's check if the engine sees the task completion leads to phase_complete
    // or if it picks up the next task or micro-PR
    const { state, decomposition } = await rehydrateContract(env, "ctr_test_001");

    const action = resolveNextAction(state, decomposition);
    // Phase_01 only has task_001 which is now complete → phase_complete
    assert(action.type === "phase_complete", "type is phase_complete (only task in phase done)");
    assert(action.status === "ready", "status is ready");
    assert(action.phase_id !== null, "phase_id is set");
  }

  // ---- Test 58: resolveNextAction — micro-PR ready in multi-task phase ----
  console.log("\nTest 58: resolveNextAction — micro-PR ready after advancing to phase with task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // Use a 3-dod contract: tasks go to phase_02 (task_002) and phase_03 (task_003)
    const payload3 = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_mpr_ready",
      definition_of_done: ["Step A", "Step B", "Step C"],
    };
    await handleCreateContract(mockRequest(payload3), env);

    // Complete task_001 and advance through phase_01 → phase_02
    await startTask(env, "ctr_mpr_ready", "task_001");
    await completeTask(env, "ctr_mpr_ready", "task_001");
    await advanceContractPhase(env, "ctr_mpr_ready");

    let { state, decomposition } = await rehydrateContract(env, "ctr_mpr_ready");

    // Now in phase_02 — task_002 depends on task_001 (completed) and is in phase_02
    const action = resolveNextAction(state, decomposition);
    assert(action.type === "start_task", "type is start_task for task_002");
    assert(action.task_id === "task_002", "task_id is task_002");
    assert(action.status === "ready", "status is ready");
  }

  // ---- Test 59: resolveNextAction — stand-alone micro-PR ready ----
  console.log("\nTest 59: resolveNextAction — stand-alone micro-PR ready (linked task complete)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload1 = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_mpr_standalone",
      definition_of_done: ["Only step"],
    };
    await handleCreateContract(mockRequest(payload1), env);

    // Complete the only task
    await startTask(env, "ctr_mpr_standalone", "task_001");
    await completeTask(env, "ctr_mpr_standalone", "task_001");

    // Phase_01 has task_001 → now complete → phase_complete
    // Advance phase
    await advanceContractPhase(env, "ctr_mpr_standalone");

    let { state, decomposition } = await rehydrateContract(env, "ctr_mpr_standalone");
    // Now we should be in phase_02 or later
    // micro_pr_001 is queued, linked to task_001 (completed) — should be start_micro_pr
    // But if the phase has no tasks, the engine checks micro-PRs
    const action = resolveNextAction(state, decomposition);
    // The current phase may have no incomplete tasks (phase_02 may have 0 tasks since only 1 dod)
    // With 1 dod: task_001 goes to phase_03 (last dod goes to phase_03)
    // Actually, with 1 dod item, the sole task goes to phase_03
    // After advancing past phase_01 we're in phase_02 with no tasks → phase_complete
    assert(
      action.type === "phase_complete" || action.type === "start_micro_pr",
      "type is phase_complete or start_micro_pr"
    );
  }

  // ---- Test 60: resolveNextAction — phase complete ----
  console.log("\nTest 60: resolveNextAction — phase complete (all tasks in phase done)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    // Complete task_001 (only task in phase_01)
    await startTask(env, "ctr_test_001", "task_001");
    await completeTask(env, "ctr_test_001", "task_001");

    const { state, decomposition } = await rehydrateContract(env, "ctr_test_001");
    const action = resolveNextAction(state, decomposition);
    assert(action.type === "phase_complete", "type is phase_complete");
    assert(action.phase_id !== null, "phase_id is set");
    assert(action.reason.includes("complete"), "reason mentions complete");
    assert(action.status === "ready", "status is ready");
  }

  // ---- Test 61: resolveNextAction — contract complete ----
  console.log("\nTest 61: resolveNextAction — contract complete");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    // Manually set state to completed
    let { state, decomposition } = await rehydrateContract(env, "ctr_test_001");
    state.status_global = "completed";
    state.current_phase = "all_phases_complete";
    await env.ENAVIA_BRAIN.put("contract:ctr_test_001:state", JSON.stringify(state));

    ({ state, decomposition } = await rehydrateContract(env, "ctr_test_001"));
    const action = resolveNextAction(state, decomposition);
    assert(action.type === "contract_complete", "type is contract_complete");
    assert(action.status === "completed", "status is completed");
    assert(action.task_id === null, "task_id is null");
    assert(action.micro_pr_candidate_id === null, "micro_pr_candidate_id is null");
  }

  // ---- Test 62: resolveNextAction — contract blocked at ingestion ----
  console.log("\nTest 62: resolveNextAction — contract blocked at ingestion");
  {
    const state = {
      contract_id: "ctr_blocked",
      status_global: "blocked",
      current_phase: "ingestion_blocked",
      blockers: ["scope.environments is empty"],
      constraints: {},
    };
    const decomposition = { phases: [], tasks: [], micro_pr_candidates: [] };
    const action = resolveNextAction(state, decomposition);
    assert(action.type === "contract_blocked", "type is contract_blocked");
    assert(action.status === "blocked", "status is blocked");
    assert(action.reason.includes("Ingestion blocked"), "reason mentions ingestion blocked");
  }

  // ---- Test 63: resolveNextAction — missing state/decomposition ----
  console.log("\nTest 63: resolveNextAction — missing state returns no_action");
  {
    const action1 = resolveNextAction(null, null);
    assert(action1.type === "no_action", "null state → no_action");
    assert(action1.status === "error", "status is error");

    const action2 = resolveNextAction({}, null);
    assert(action2.type === "no_action", "null decomposition → no_action");
  }

  // ---- Test 64: resolveNextAction — awaiting human approval ----
  console.log("\nTest 64: resolveNextAction — awaiting human approval (all phases done, not completed)");
  {
    const state = {
      contract_id: "ctr_approval",
      status_global: "in_progress",
      current_phase: "phase_03",
      blockers: [],
      constraints: { require_human_approval_per_pr: true },
    };
    const decomposition = {
      phases: [
        { id: "phase_01", status: "done", tasks: ["task_001"] },
        { id: "phase_02", status: "done", tasks: [] },
        { id: "phase_03", status: "done", tasks: [] },
      ],
      tasks: [{ id: "task_001", status: "completed", depends_on: [] }],
      micro_pr_candidates: [],
    };
    const action = resolveNextAction(state, decomposition);
    assert(action.type === "awaiting_human_approval", "type is awaiting_human_approval");
    assert(action.status === "awaiting_approval", "status is awaiting_approval");
    assert(action.reason.includes("sign-off"), "reason mentions sign-off");
  }

  // ---- Test 65: resolveNextAction shape always has required fields ----
  console.log("\nTest 65: resolveNextAction — shape always has all required fields");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_test_001");

    const action = resolveNextAction(state, decomposition);
    assert("type" in action, "has type field");
    assert("phase_id" in action, "has phase_id field");
    assert("task_id" in action, "has task_id field");
    assert("micro_pr_candidate_id" in action, "has micro_pr_candidate_id field");
    assert("reason" in action, "has reason field");
    assert("status" in action, "has status field");
    assert(Object.keys(action).length === 6, "exactly 6 fields in NextAction shape");
  }

  // ---- Test 66: resolveNextAction — NEXT_ACTION_TYPES enum exported ----
  console.log("\nTest 66: NEXT_ACTION_TYPES exported and valid");
  {
    assert(Array.isArray(NEXT_ACTION_TYPES), "NEXT_ACTION_TYPES is array");
    assert(NEXT_ACTION_TYPES.includes("start_task"), "includes start_task");
    assert(NEXT_ACTION_TYPES.includes("start_micro_pr"), "includes start_micro_pr");
    assert(NEXT_ACTION_TYPES.includes("phase_complete"), "includes phase_complete");
    assert(NEXT_ACTION_TYPES.includes("contract_complete"), "includes contract_complete");
    assert(NEXT_ACTION_TYPES.includes("contract_blocked"), "includes contract_blocked");
    assert(NEXT_ACTION_TYPES.includes("awaiting_human_approval"), "includes awaiting_human_approval");
    assert(NEXT_ACTION_TYPES.includes("no_action"), "includes no_action");
  }

  // ---- Test 67: buildContractSummary includes next_action_resolved ----
  console.log("\nTest 67: buildContractSummary includes next_action_resolved");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_test_001");

    const summary = buildContractSummary(state, decomposition);
    assert(summary.next_action_resolved !== undefined, "next_action_resolved is present");
    assert(typeof summary.next_action_resolved === "object", "next_action_resolved is object");
    assert(summary.next_action_resolved.type === "start_task", "resolved type is start_task");
    assert(summary.next_action_resolved.task_id === "task_001", "resolved task_id is task_001");
    assert(typeof summary.next_action === "string", "legacy next_action still present as string");
  }

  // ---- Test 68: handleGetContractSummary exposes next_action_resolved ----
  console.log("\nTest 68: handleGetContractSummary exposes next_action_resolved");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    const result = await handleGetContractSummary(env, "ctr_test_001");
    assert(result.status === 200, "status 200");
    assert(result.body.next_action_resolved !== undefined, "next_action_resolved in response");
    assert(result.body.next_action_resolved.type === "start_task", "resolved type is start_task in API");
  }

  // ---- Test 69: resolveNextAction — dependency chain with blocked intermediate task ----
  console.log("\nTest 69: resolveNextAction — queued task with unmet dependency (in_progress dep)");
  {
    // Simulate: 3 tasks, task_002 depends on task_001 (in_progress), task_003 depends on task_002
    // Only phase_01 tasks matter for the active phase
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload3 = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_dep_chain",
      definition_of_done: ["A", "B", "C"],
    };
    await handleCreateContract(mockRequest(payload3), env);
    // Start task_001 but don't complete it
    await startTask(env, "ctr_dep_chain", "task_001");
    const { state, decomposition } = await rehydrateContract(env, "ctr_dep_chain");

    // Phase_01 only has task_001 (in_progress) — engine should show in_progress/waiting
    const action = resolveNextAction(state, decomposition);
    assert(action.type === "no_action", "type is no_action (task in progress)");
    assert(action.status === "in_progress", "status is in_progress");
    assert(action.reason.includes("in progress"), "reason mentions in progress");
  }

  // ---- Test 70: resolveNextAction — next task available after completing first ----
  console.log("\nTest 70: resolveNextAction — second task becomes available after first completes");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload3 = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_chain_advance",
      definition_of_done: ["A", "B", "C"],
    };
    await handleCreateContract(mockRequest(payload3), env);

    // Complete task_001 and advance phase
    await startTask(env, "ctr_chain_advance", "task_001");
    await completeTask(env, "ctr_chain_advance", "task_001");
    await advanceContractPhase(env, "ctr_chain_advance");

    const { state, decomposition } = await rehydrateContract(env, "ctr_chain_advance");
    // Now in phase_02 with task_002 (depends on task_001 which is completed)
    const action = resolveNextAction(state, decomposition);
    assert(action.type === "start_task", "type is start_task for task_002");
    assert(action.task_id === "task_002", "task_id is task_002");
    assert(action.status === "ready", "status is ready");
  }

  // ---- Test 71: resolveNextAction — full lifecycle from start to contract_complete ----
  console.log("\nTest 71: resolveNextAction — full lifecycle: start → complete");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payloadFull = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_full_lifecycle",
      definition_of_done: ["Only criterion"],
    };
    await handleCreateContract(mockRequest(payloadFull), env);

    // Step 1: initial — should be start_task
    let { state, decomposition } = await rehydrateContract(env, "ctr_full_lifecycle");
    let action = resolveNextAction(state, decomposition);
    assert(action.type === "start_task", "lifecycle step 1: start_task");

    // Step 2: start task_001 → in_progress → no_action
    await startTask(env, "ctr_full_lifecycle", "task_001");
    ({ state, decomposition } = await rehydrateContract(env, "ctr_full_lifecycle"));
    action = resolveNextAction(state, decomposition);
    assert(action.type === "no_action", "lifecycle step 2: no_action (in_progress)");

    // Step 3: complete task_001 → phase_complete
    await completeTask(env, "ctr_full_lifecycle", "task_001");
    ({ state, decomposition } = await rehydrateContract(env, "ctr_full_lifecycle"));
    action = resolveNextAction(state, decomposition);
    // With 1 dod: task_001 goes to phase_03. phase_01 has [task_001].
    // After task_001 complete, phase_01 all done → phase_complete
    assert(action.type === "phase_complete", "lifecycle step 3: phase_complete");

    // Step 4: advance phases until all_phases_complete
    await advanceContractPhase(env, "ctr_full_lifecycle"); // phase_01 → phase_02
    await advanceContractPhase(env, "ctr_full_lifecycle"); // phase_02 → phase_03 (0 tasks in phase_02)
    // phase_03 has task_001 but it's already completed
    await advanceContractPhase(env, "ctr_full_lifecycle"); // phase_03 → all_phases_complete

    ({ state, decomposition } = await rehydrateContract(env, "ctr_full_lifecycle"));
    action = resolveNextAction(state, decomposition);
    assert(action.type === "contract_complete", "lifecycle step 4: contract_complete");
    assert(action.status === "completed", "lifecycle step 4: status is completed");
  }

  // ==========================================================================
  // B3 — Execution Handoff Builder Smoke Tests
  // ==========================================================================

  // ---- Test 72: buildExecutionHandoff — valid handoff from fresh contract ----
  console.log("\nTest 72: buildExecutionHandoff — valid handoff from fresh contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_handoff_001",
    };
    await handleCreateContract(mockRequest(payload), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_handoff_001");
    const handoff = buildExecutionHandoff(state, decomposition);

    assert(handoff !== null, "handoff is not null for actionable contract");
    assert(typeof handoff.objective === "string" && handoff.objective.length > 0, "handoff has objective");
    assert(typeof handoff.scope === "object" && handoff.scope !== null, "handoff has scope object");
    assert(Array.isArray(handoff.target_files) && handoff.target_files.length > 0, "handoff has target_files");
    assert(Array.isArray(handoff.do_not_touch) && handoff.do_not_touch.length > 0, "handoff has do_not_touch");
    assert(Array.isArray(handoff.smoke_tests) && handoff.smoke_tests.length > 0, "handoff has smoke_tests");
    assert(typeof handoff.rollback === "string" && handoff.rollback.length > 0, "handoff has rollback");
    assert(Array.isArray(handoff.acceptance_criteria) && handoff.acceptance_criteria.length > 0, "handoff has acceptance_criteria");
    assert(typeof handoff.generated_at === "string", "handoff has generated_at timestamp");
    assert(handoff.source_phase !== null, "handoff has source_phase");
    assert(handoff.source_task !== null, "handoff has source_task");
  }

  // ---- Test 73: buildExecutionHandoff — handoff persisted and rehydrated via summary ----
  console.log("\nTest 73: buildExecutionHandoff — handoff persisted and rehydrated via summary");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_handoff_002",
    };
    await handleCreateContract(mockRequest(payload), env);

    // Read summary which includes execution_handoff
    const summaryResult = await handleGetContractSummary(env, "ctr_handoff_002");
    assert(summaryResult.status === 200, "summary status 200");
    assert(summaryResult.body.execution_handoff !== undefined, "execution_handoff present in summary");
    assert(summaryResult.body.execution_handoff !== null, "execution_handoff is not null");
    assert(summaryResult.body.execution_handoff.objective !== undefined, "execution_handoff has objective in summary");

    // Verify the handoff fields match a standalone call
    const { state, decomposition } = await rehydrateContract(env, "ctr_handoff_002");
    const directHandoff = buildExecutionHandoff(state, decomposition);
    assert(
      summaryResult.body.execution_handoff.objective === directHandoff.objective,
      "summary handoff objective matches direct handoff"
    );
    assert(
      summaryResult.body.execution_handoff.source_task === directHandoff.source_task,
      "summary handoff source_task matches direct handoff"
    );
  }

  // ---- Test 74: buildExecutionHandoff — null when contract is completed ----
  console.log("\nTest 74: buildExecutionHandoff — null when contract is completed");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_handoff_done",
      definition_of_done: ["Only criterion"],
    };
    await handleCreateContract(mockRequest(payload), env);

    // Complete the contract fully
    await startTask(env, "ctr_handoff_done", "task_001");
    await completeTask(env, "ctr_handoff_done", "task_001");
    await advanceContractPhase(env, "ctr_handoff_done"); // phase_01 done
    await advanceContractPhase(env, "ctr_handoff_done"); // phase_02 done (no tasks)
    await advanceContractPhase(env, "ctr_handoff_done"); // phase_03 → all_phases_complete

    const { state, decomposition } = await rehydrateContract(env, "ctr_handoff_done");
    const handoff = buildExecutionHandoff(state, decomposition);
    assert(handoff === null, "handoff is null for completed contract");
  }

  // ---- Test 75: buildExecutionHandoff — null when contract is blocked ----
  console.log("\nTest 75: buildExecutionHandoff — null when contract is blocked at ingestion");
  {
    const state = buildInitialState({
      ...VALID_PAYLOAD,
      contract_id: "ctr_handoff_blocked",
    });
    state.current_phase = "ingestion_blocked";
    state.status_global = "blocked";
    state.blockers = ["missing environments"];

    const decomposition = generateDecomposition(state);
    const handoff = buildExecutionHandoff(state, decomposition);
    assert(handoff === null, "handoff is null for blocked contract");
  }

  // ---- Test 76: buildExecutionHandoff — null with missing state/decomposition ----
  console.log("\nTest 76: buildExecutionHandoff — null with missing state/decomposition");
  {
    assert(buildExecutionHandoff(null, null) === null, "null state + null decomp → null");
    assert(buildExecutionHandoff(null, { phases: [] }) === null, "null state → null");
    assert(buildExecutionHandoff({}, null) === null, "null decomp → null");
  }

  // ---- Test 77: buildExecutionHandoff — not generated when task is in_progress ----
  console.log("\nTest 77: buildExecutionHandoff — null when current task is in_progress");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_handoff_inprog",
    };
    await handleCreateContract(mockRequest(payload), env);
    await startTask(env, "ctr_handoff_inprog", "task_001");

    const { state, decomposition } = await rehydrateContract(env, "ctr_handoff_inprog");
    // next action is no_action (in_progress), so no handoff
    const handoff = buildExecutionHandoff(state, decomposition);
    assert(handoff === null, "handoff is null when task is in_progress (no_action)");
  }

  // ---- Test 78: buildExecutionHandoff — respects phase/task ordering ----
  console.log("\nTest 78: buildExecutionHandoff — respects phase/task ordering");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_handoff_order",
      definition_of_done: ["First criterion", "Second criterion", "Third criterion"],
    };
    await handleCreateContract(mockRequest(payload), env);

    // Before any work, handoff should point to task_001 in phase_01
    let { state, decomposition } = await rehydrateContract(env, "ctr_handoff_order");
    let handoff = buildExecutionHandoff(state, decomposition);
    assert(handoff !== null, "handoff exists for first task");
    assert(handoff.source_task === "task_001", "handoff targets task_001 first");
    assert(handoff.source_phase === "phase_01", "handoff in phase_01");

    // Complete task_001 and advance phase
    await startTask(env, "ctr_handoff_order", "task_001");
    await completeTask(env, "ctr_handoff_order", "task_001");
    await advanceContractPhase(env, "ctr_handoff_order");

    // Now handoff should point to task_002 in phase_02
    ({ state, decomposition } = await rehydrateContract(env, "ctr_handoff_order"));
    handoff = buildExecutionHandoff(state, decomposition);
    assert(handoff !== null, "handoff exists for second task");
    assert(handoff.source_task === "task_002", "handoff targets task_002 after task_001 complete");
  }

  // ---- Test 79: buildExecutionHandoff — no execution triggered ----
  console.log("\nTest 79: buildExecutionHandoff — no execution triggered (pure function)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_handoff_pure",
    };
    await handleCreateContract(mockRequest(payload), env);
    const { state: stateBefore, decomposition: decompBefore } = await rehydrateContract(env, "ctr_handoff_pure");

    // Call buildExecutionHandoff
    buildExecutionHandoff(stateBefore, decompBefore);

    // State must not have changed
    const { state: stateAfter, decomposition: decompAfter } = await rehydrateContract(env, "ctr_handoff_pure");
    assert(stateAfter.status_global === stateBefore.status_global, "status_global unchanged after handoff build");
    assert(stateAfter.current_phase === stateBefore.current_phase, "current_phase unchanged after handoff build");
    assert(stateAfter.current_task === stateBefore.current_task, "current_task unchanged after handoff build");
    assert(
      JSON.stringify(decompAfter.tasks.map(t => t.status)) === JSON.stringify(decompBefore.tasks.map(t => t.status)),
      "all task statuses unchanged after handoff build"
    );
  }

  // ---- Test 80: HANDOFF_ACTIONABLE_TYPES export is correct ----
  console.log("\nTest 80: HANDOFF_ACTIONABLE_TYPES export");
  {
    assert(Array.isArray(HANDOFF_ACTIONABLE_TYPES), "HANDOFF_ACTIONABLE_TYPES is array");
    assert(HANDOFF_ACTIONABLE_TYPES.includes("start_task"), "includes start_task");
    assert(HANDOFF_ACTIONABLE_TYPES.includes("start_micro_pr"), "includes start_micro_pr");
    assert(!HANDOFF_ACTIONABLE_TYPES.includes("no_action"), "does not include no_action");
    assert(!HANDOFF_ACTIONABLE_TYPES.includes("contract_complete"), "does not include contract_complete");
  }

  // ---- Test 81: buildExecutionHandoff — all 7 mandatory fields present ----
  console.log("\nTest 81: buildExecutionHandoff — all 7 mandatory handoff fields present");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_handoff_fields",
    };
    await handleCreateContract(mockRequest(payload), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_handoff_fields");
    const handoff = buildExecutionHandoff(state, decomposition);

    const requiredFields = ["objective", "scope", "target_files", "do_not_touch", "smoke_tests", "rollback", "acceptance_criteria"];
    for (const field of requiredFields) {
      assert(handoff[field] !== undefined && handoff[field] !== null, `mandatory field "${field}" is present`);
    }
  }

  // ==========================================================================
  // B4 — Acceptance Criteria Binder Smoke Tests
  // ==========================================================================

  // ---- Test 82: bindAcceptanceCriteria — valid binding from fresh contract ----
  console.log("\nTest 82: bindAcceptanceCriteria — valid binding from fresh contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_001",
    };
    await handleCreateContract(mockRequest(payload), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_ac_001");
    const binding = bindAcceptanceCriteria(state, decomposition);

    assert(binding !== null, "binding is not null for valid contract");
    assert(Array.isArray(binding.phase_acceptance), "has phase_acceptance array");
    assert(Array.isArray(binding.task_acceptance), "has task_acceptance array");
    assert(Array.isArray(binding.handoff_acceptance), "has handoff_acceptance array");
    assert(typeof binding.generated_at === "string", "has generated_at timestamp");
    assert(binding.current_phase !== null, "has current_phase");
    assert(binding.phase_acceptance.length > 0, "phase_acceptance has criteria for active phase");
  }

  // ---- Test 83: bindAcceptanceCriteria — criterion structure is canonical ----
  console.log("\nTest 83: bindAcceptanceCriteria — criterion structure is canonical");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_struct",
    };
    await handleCreateContract(mockRequest(payload), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_ac_struct");
    const binding = bindAcceptanceCriteria(state, decomposition);

    // Check first phase criterion
    const criterion = binding.phase_acceptance[0];
    assert(typeof criterion.id === "string", "criterion has id");
    assert(ACCEPTANCE_CRITERIA_SCOPES.includes(criterion.scope), "criterion scope is valid");
    assert(typeof criterion.description === "string" && criterion.description.length > 0, "criterion has description");
    assert(ACCEPTANCE_CRITERIA_STATUSES.includes(criterion.status), "criterion status is valid");
    assert(criterion.status === "pending", "criterion status defaults to pending");
    assert(criterion.evidence_required === true, "criterion has evidence_required");
    assert(typeof criterion.blocking === "boolean", "criterion has blocking boolean");
  }

  // ---- Test 84: bindAcceptanceCriteria — persisted and rehydrated via state ----
  console.log("\nTest 84: bindAcceptanceCriteria — persisted and rehydrated via state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_persist",
    };
    await handleCreateContract(mockRequest(payload), env);

    // Rehydrate and check the binding was persisted as part of state
    const { state } = await rehydrateContract(env, "ctr_ac_persist");
    assert(state.acceptance_criteria_binding !== undefined, "binding persisted in state");
    assert(state.acceptance_criteria_binding !== null, "binding is not null in persisted state");
    assert(
      Array.isArray(state.acceptance_criteria_binding.phase_acceptance),
      "persisted binding has phase_acceptance"
    );
    assert(
      typeof state.acceptance_criteria_binding.generated_at === "string",
      "persisted binding has generated_at"
    );
  }

  // ---- Test 85: bindAcceptanceCriteria — rehydration consistency ----
  console.log("\nTest 85: bindAcceptanceCriteria — rehydration maintains consistency");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_rehydrate",
    };
    await handleCreateContract(mockRequest(payload), env);

    // Rehydrate twice — should be consistent
    const { state: s1 } = await rehydrateContract(env, "ctr_ac_rehydrate");
    const { state: s2 } = await rehydrateContract(env, "ctr_ac_rehydrate");

    assert(
      s1.acceptance_criteria_binding.phase_acceptance.length ===
        s2.acceptance_criteria_binding.phase_acceptance.length,
      "phase_acceptance length consistent across rehydrations"
    );
    assert(
      s1.acceptance_criteria_binding.current_phase ===
        s2.acceptance_criteria_binding.current_phase,
      "current_phase consistent across rehydrations"
    );
    assert(
      s1.acceptance_criteria_binding.phase_acceptance[0].id ===
        s2.acceptance_criteria_binding.phase_acceptance[0].id,
      "criterion ids consistent across rehydrations"
    );
  }

  // ---- Test 86: bindAcceptanceCriteria — exposed in summary/API ----
  console.log("\nTest 86: bindAcceptanceCriteria — exposed in summary/API");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_summary",
    };
    await handleCreateContract(mockRequest(payload), env);

    const summaryResult = await handleGetContractSummary(env, "ctr_ac_summary");
    assert(summaryResult.status === 200, "summary status 200");
    assert(
      summaryResult.body.acceptance_criteria_binding !== undefined,
      "acceptance_criteria_binding present in summary"
    );
    assert(
      summaryResult.body.acceptance_criteria_binding !== null,
      "acceptance_criteria_binding is not null in summary"
    );
    assert(
      Array.isArray(summaryResult.body.acceptance_criteria_binding.phase_acceptance),
      "summary binding has phase_acceptance"
    );
    assert(
      Array.isArray(summaryResult.body.acceptance_criteria_binding.handoff_acceptance),
      "summary binding has handoff_acceptance"
    );
  }

  // ---- Test 87: bindAcceptanceCriteria — exposed in GET contract ----
  console.log("\nTest 87: bindAcceptanceCriteria — exposed in GET contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_get",
    };
    await handleCreateContract(mockRequest(payload), env);

    const getResult = await handleGetContract(env, "ctr_ac_get");
    assert(getResult.status === 200, "GET contract status 200");
    assert(
      getResult.body.contract.acceptance_criteria_binding !== undefined,
      "acceptance_criteria_binding present in GET response"
    );
    assert(
      getResult.body.contract.acceptance_criteria_binding !== null,
      "acceptance_criteria_binding is not null in GET response"
    );
  }

  // ---- Test 88: bindAcceptanceCriteria — null with missing state/decomposition ----
  console.log("\nTest 88: bindAcceptanceCriteria — null with missing state/decomposition");
  {
    assert(bindAcceptanceCriteria(null, null) === null, "null state + null decomp → null");
    assert(bindAcceptanceCriteria(null, { phases: [] }) === null, "null state → null");
    assert(bindAcceptanceCriteria({}, null) === null, "null decomp → null");
  }

  // ---- Test 89: bindAcceptanceCriteria — controlled state with missing minimal data ----
  console.log("\nTest 89: bindAcceptanceCriteria — controlled empty binding with no phases/tasks");
  {
    const state = buildInitialState({
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_empty",
    });
    const decomposition = {
      contract_id: "ctr_ac_empty",
      phases: [],
      tasks: [],
      micro_pr_candidates: [],
      generated_at: new Date().toISOString(),
    };

    const binding = bindAcceptanceCriteria(state, decomposition);
    assert(binding !== null, "binding is not null even with empty decomposition");
    assert(binding.phase_acceptance.length === 0, "no phase acceptance for no phases");
    assert(binding.task_acceptance.length === 0, "no task acceptance for no current task");
    assert(binding.handoff_acceptance.length === 0, "no handoff acceptance without handoff");
    assert(binding.has_handoff === false, "has_handoff is false");
  }

  // ---- Test 89b: bindAcceptanceCriteria — evidence_required can be false for structural criteria ----
  console.log("\nTest 89b: bindAcceptanceCriteria — evidence_required false for structural phase criterion");
  {
    const state = buildInitialState({
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_evid_false",
      definition_of_done: ["Only criterion"],
    });
    // Build decomposition with a phase that has no tasks assigned
    const decomposition = generateDecomposition(state);

    // Complete task and advance so we hit phase_02 which has no tasks
    // (single DoD → task goes to phase_01 only, phase_02 is empty)
    // Instead, directly create a phase with no tasks
    const decompCustom = {
      contract_id: "ctr_ac_evid_false",
      phases: [
        { id: "phase_empty", name: "Empty phase", status: "pending", tasks: [] },
      ],
      tasks: [],
      micro_pr_candidates: [],
      generated_at: new Date().toISOString(),
    };
    state.current_phase = "phase_empty";

    const binding = bindAcceptanceCriteria(state, decompCustom);
    assert(binding !== null, "binding exists for empty-phase contract");
    assert(binding.phase_acceptance.length === 1, "one structural criterion for empty phase");
    assert(
      binding.phase_acceptance[0].evidence_required === false,
      "structural phase criterion has evidence_required = false"
    );
    assert(
      binding.phase_acceptance[0].blocking === false,
      "structural phase criterion is non-blocking"
    );
  }

  // ---- Test 90: bindAcceptanceCriteria — task acceptance when task is in_progress ----
  console.log("\nTest 90: bindAcceptanceCriteria — task acceptance when task is in_progress");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_inprog",
    };
    await handleCreateContract(mockRequest(payload), env);
    await startTask(env, "ctr_ac_inprog", "task_001");

    const { state, decomposition } = await rehydrateContract(env, "ctr_ac_inprog");
    const binding = bindAcceptanceCriteria(state, decomposition);

    assert(binding !== null, "binding exists when task is in progress");
    assert(binding.current_task === "task_001", "binding reflects current task");
    assert(binding.task_acceptance.length > 0, "task_acceptance has criteria for in-progress task");
    assert(
      binding.task_acceptance[0].description.length > 0,
      "task criterion has description"
    );
    // No-regression criterion should be present
    const noRegression = binding.task_acceptance.find(c => c.id === "task_ac_no_regression");
    assert(noRegression !== undefined, "no-regression criterion present for in-progress task");
  }

  // ---- Test 91: bindAcceptanceCriteria — handoff criteria linked when handoff exists ----
  console.log("\nTest 91: bindAcceptanceCriteria — handoff acceptance when handoff exists");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_handoff",
    };
    await handleCreateContract(mockRequest(payload), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_ac_handoff");
    const binding = bindAcceptanceCriteria(state, decomposition);

    // Fresh contract with queued task → handoff should exist
    assert(binding.has_handoff === true, "has_handoff is true when handoff available");
    assert(binding.handoff_acceptance.length > 0, "handoff_acceptance has criteria");
    assert(binding.handoff_acceptance[0].scope === "handoff", "handoff criterion has scope 'handoff'");
  }

  // ---- Test 92: bindAcceptanceCriteria — no handoff criteria when contract completed ----
  console.log("\nTest 92: bindAcceptanceCriteria — no handoff criteria when contract completed");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_done",
      definition_of_done: ["Only criterion"],
    };
    await handleCreateContract(mockRequest(payload), env);

    await startTask(env, "ctr_ac_done", "task_001");
    await completeTask(env, "ctr_ac_done", "task_001");
    await advanceContractPhase(env, "ctr_ac_done");
    await advanceContractPhase(env, "ctr_ac_done");
    await advanceContractPhase(env, "ctr_ac_done");

    const { state, decomposition } = await rehydrateContract(env, "ctr_ac_done");
    const binding = bindAcceptanceCriteria(state, decomposition);

    assert(binding !== null, "binding exists even for completed contract");
    assert(binding.has_handoff === false, "has_handoff false for completed contract");
    assert(binding.handoff_acceptance.length === 0, "no handoff criteria for completed contract");
  }

  // ---- Test 93: bindAcceptanceCriteria — blocked contract gives controlled binding ----
  console.log("\nTest 93: bindAcceptanceCriteria — blocked contract gives controlled binding");
  {
    const state = buildInitialState({
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_blocked",
    });
    state.current_phase = "ingestion_blocked";
    state.status_global = "blocked";
    state.blockers = ["missing environments"];

    const decomposition = generateDecomposition(state);
    const binding = bindAcceptanceCriteria(state, decomposition);

    assert(binding !== null, "binding exists for blocked contract");
    assert(binding.has_handoff === false, "no handoff for blocked contract");
    assert(binding.handoff_acceptance.length === 0, "no handoff criteria for blocked contract");
  }

  // ---- Test 94: bindAcceptanceCriteria — all criteria start as 'pending' ----
  console.log("\nTest 94: bindAcceptanceCriteria — all criteria start as 'pending'");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_pending",
    };
    await handleCreateContract(mockRequest(payload), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_ac_pending");
    const binding = bindAcceptanceCriteria(state, decomposition);

    const allCriteria = [
      ...binding.phase_acceptance,
      ...binding.task_acceptance,
      ...binding.handoff_acceptance,
    ];
    assert(allCriteria.length > 0, "has at least one criterion");
    const allPending = allCriteria.every(c => c.status === "pending");
    assert(allPending, "all criteria start as pending (no passed without evidence)");
  }

  // ---- Test 95: bindAcceptanceCriteria — no phase advance triggered ----
  console.log("\nTest 95: bindAcceptanceCriteria — no phase advance triggered (pure function)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_pure",
    };
    await handleCreateContract(mockRequest(payload), env);
    const { state: stateBefore, decomposition: decompBefore } = await rehydrateContract(env, "ctr_ac_pure");

    // Call binder
    bindAcceptanceCriteria(stateBefore, decompBefore);

    // State must not have changed
    const { state: stateAfter, decomposition: decompAfter } = await rehydrateContract(env, "ctr_ac_pure");
    assert(stateAfter.status_global === stateBefore.status_global, "status_global unchanged");
    assert(stateAfter.current_phase === stateBefore.current_phase, "current_phase unchanged");
    assert(stateAfter.current_task === stateBefore.current_task, "current_task unchanged");
    assert(
      JSON.stringify(decompAfter.tasks.map(t => t.status)) === JSON.stringify(decompBefore.tasks.map(t => t.status)),
      "task statuses unchanged after binder call"
    );
    assert(
      JSON.stringify(decompAfter.phases.map(p => p.status)) === JSON.stringify(decompBefore.phases.map(p => p.status)),
      "phase statuses unchanged after binder call"
    );
  }

  // ---- Test 96: bindAcceptanceCriteria — no execution triggered ----
  console.log("\nTest 96: bindAcceptanceCriteria — no micro-PR execution triggered");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_no_exec",
    };
    await handleCreateContract(mockRequest(payload), env);
    const { state, decomposition } = await rehydrateContract(env, "ctr_ac_no_exec");

    bindAcceptanceCriteria(state, decomposition);

    // Verify no task or mpr status changed
    const { decomposition: decompAfter } = await rehydrateContract(env, "ctr_ac_no_exec");
    const allTasksQueued = decompAfter.tasks.every(t => t.status === "queued");
    assert(allTasksQueued, "all tasks still queued — no execution triggered");
    const allMprsQueued = decompAfter.micro_pr_candidates.every(m => m.status === "queued");
    assert(allMprsQueued, "all micro-PR candidates still queued — no execution triggered");
  }

  // ---- Test 97: bindAcceptanceCriteria — phase criteria track active phase correctly ----
  console.log("\nTest 97: bindAcceptanceCriteria — phase criteria track active phase after advance");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_advance",
      definition_of_done: ["First", "Second", "Third"],
    };
    await handleCreateContract(mockRequest(payload), env);

    // Binding before advance — should target phase_01
    let { state, decomposition } = await rehydrateContract(env, "ctr_ac_advance");
    let binding = bindAcceptanceCriteria(state, decomposition);
    assert(binding.current_phase === "phase_01", "binding targets phase_01 initially");

    // Complete task_001 and advance
    await startTask(env, "ctr_ac_advance", "task_001");
    await completeTask(env, "ctr_ac_advance", "task_001");
    await advanceContractPhase(env, "ctr_ac_advance");

    // Binding after advance — should target phase_02
    ({ state, decomposition } = await rehydrateContract(env, "ctr_ac_advance"));
    binding = bindAcceptanceCriteria(state, decomposition);
    assert(
      binding.current_phase === "phase_02",
      "binding targets phase_02 after advance"
    );
    assert(
      binding.phase_acceptance.length > 0,
      "phase_acceptance has criteria for phase_02"
    );
  }

  // ---- Test 98: ACCEPTANCE_CRITERIA_SCOPES and ACCEPTANCE_CRITERIA_STATUSES exports ----
  console.log("\nTest 98: ACCEPTANCE_CRITERIA_SCOPES and ACCEPTANCE_CRITERIA_STATUSES exports");
  {
    assert(Array.isArray(ACCEPTANCE_CRITERIA_SCOPES), "ACCEPTANCE_CRITERIA_SCOPES is array");
    assert(ACCEPTANCE_CRITERIA_SCOPES.includes("phase"), "includes phase");
    assert(ACCEPTANCE_CRITERIA_SCOPES.includes("task"), "includes task");
    assert(ACCEPTANCE_CRITERIA_SCOPES.includes("handoff"), "includes handoff");
    assert(Array.isArray(ACCEPTANCE_CRITERIA_STATUSES), "ACCEPTANCE_CRITERIA_STATUSES is array");
    assert(ACCEPTANCE_CRITERIA_STATUSES.includes("pending"), "includes pending");
    assert(ACCEPTANCE_CRITERIA_STATUSES.includes("passed"), "includes passed");
    assert(ACCEPTANCE_CRITERIA_STATUSES.includes("failed"), "includes failed");
    assert(ACCEPTANCE_CRITERIA_STATUSES.includes("waived"), "includes waived");
  }

  // ---- Test 99: bindAcceptanceCriteria — summary determinism ----
  console.log("\nTest 99: bindAcceptanceCriteria — summary returns deterministic binding");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = {
      ...VALID_PAYLOAD,
      contract_id: "ctr_ac_determ",
    };
    await handleCreateContract(mockRequest(payload), env);

    const summary1 = await handleGetContractSummary(env, "ctr_ac_determ");
    const summary2 = await handleGetContractSummary(env, "ctr_ac_determ");

    const b1 = summary1.body.acceptance_criteria_binding;
    const b2 = summary2.body.acceptance_criteria_binding;
    assert(
      b1.phase_acceptance.length === b2.phase_acceptance.length,
      "phase_acceptance length is deterministic across calls"
    );
    assert(
      b1.handoff_acceptance.length === b2.handoff_acceptance.length,
      "handoff_acceptance length is deterministic across calls"
    );
    assert(
      b1.current_phase === b2.current_phase,
      "current_phase is deterministic across calls"
    );
  }

  // ==========================================================================
  // B5 — Controlled Error Loop Smoke Tests
  // ==========================================================================

  // ---- Test 100: B5 constants exported correctly ----
  console.log("\nTest 100: B5 constants exported correctly");
  {
    assert(typeof MAX_RETRY_ATTEMPTS === "number", "MAX_RETRY_ATTEMPTS is number");
    assert(MAX_RETRY_ATTEMPTS === 3, "MAX_RETRY_ATTEMPTS is 3");
    assert(Array.isArray(ERROR_CLASSIFICATIONS), "ERROR_CLASSIFICATIONS is array");
    assert(ERROR_CLASSIFICATIONS.includes("in_scope"), "includes in_scope");
    assert(ERROR_CLASSIFICATIONS.includes("infra"), "includes infra");
    assert(ERROR_CLASSIFICATIONS.includes("external"), "includes external");
    assert(ERROR_CLASSIFICATIONS.includes("unknown"), "includes unknown");
    assert(Array.isArray(ERROR_LOOP_STATUSES), "ERROR_LOOP_STATUSES is array");
    assert(ERROR_LOOP_STATUSES.includes("clear"), "includes clear");
    assert(ERROR_LOOP_STATUSES.includes("retrying"), "includes retrying");
    assert(ERROR_LOOP_STATUSES.includes("blocked"), "includes blocked");
    assert(ERROR_LOOP_STATUSES.includes("awaiting_human"), "includes awaiting_human");
    assert(Array.isArray(NON_RETRYABLE_CLASSIFICATIONS), "NON_RETRYABLE_CLASSIFICATIONS is array");
    assert(NON_RETRYABLE_CLASSIFICATIONS.includes("infra"), "non-retryable includes infra");
    assert(NON_RETRYABLE_CLASSIFICATIONS.includes("external"), "non-retryable includes external");
    assert(NON_RETRYABLE_CLASSIFICATIONS.includes("unknown"), "non-retryable includes unknown");
    assert(!NON_RETRYABLE_CLASSIFICATIONS.includes("in_scope"), "non-retryable does NOT include in_scope");
  }

  // ---- Test 101: buildErrorEntry — canonical shape ----
  console.log("\nTest 101: buildErrorEntry — canonical error entry shape");
  {
    const entry = buildErrorEntry({
      code: "TEST_FAIL",
      scope: "task",
      message: "Test failure",
      retryable: true,
      reason: "assertion mismatch",
      attempt: 1,
      max_attempts: 3,
      classification: "in_scope",
    });
    assert(entry.code === "TEST_FAIL", "entry has code");
    assert(entry.scope === "task", "entry has scope");
    assert(entry.message === "Test failure", "entry has message");
    assert(entry.retryable === true, "entry has retryable");
    assert(entry.reason === "assertion mismatch", "entry has reason");
    assert(entry.attempt === 1, "entry has attempt");
    assert(entry.max_attempts === 3, "entry has max_attempts");
    assert(entry.resolution_state === "unresolved", "entry defaults to unresolved");
    assert(entry.classification === "in_scope", "entry has classification");
    assert(typeof entry.recorded_at === "string", "entry has recorded_at");
  }

  // ---- Test 102: buildErrorEntry — defaults for missing params ----
  console.log("\nTest 102: buildErrorEntry — defaults for missing params");
  {
    const entry = buildErrorEntry();
    assert(entry.code === "UNKNOWN_ERROR", "default code");
    assert(entry.scope === "task", "default scope");
    assert(entry.message === "No message provided.", "default message");
    assert(entry.retryable === false, "default retryable is false");
    assert(entry.reason === null, "default reason is null");
    assert(entry.attempt === 1, "default attempt is 1");
    assert(entry.max_attempts === MAX_RETRY_ATTEMPTS, "default max_attempts");
    assert(entry.classification === "unknown", "default classification is unknown");
  }

  // ---- Test 103: evaluateErrorLoop — clear when no errors ----
  console.log("\nTest 103: evaluateErrorLoop — clear when no errors");
  {
    const result = evaluateErrorLoop(null, "task_001");
    assert(result.loop_status === "clear", "null error_loop → clear");
    assert(result.retry_allowed === false, "no retry allowed on clear");
    assert(result.retry_count === 0, "retry count is 0");
    assert(result.last_error === null, "last_error is null");
    assert(result.escalation_reason === null, "no escalation reason");

    const result2 = evaluateErrorLoop({}, "task_001");
    assert(result2.loop_status === "clear", "empty error_loop → clear");

    const result3 = evaluateErrorLoop({ task_001: { errors: [] } }, "task_001");
    assert(result3.loop_status === "clear", "empty errors array → clear");
  }

  // ---- Test 104: recordError — retryable in_scope error increments attempt ----
  console.log("\nTest 104: recordError — retryable in_scope error increments attempt");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "BUILD_FAIL",
      scope: "task",
      message: "Build failed in scope",
      retryable: true,
      reason: "syntax error in file",
      classification: "in_scope",
    });

    assert(result.ok === true, "recordError returns ok=true");
    assert(result.evaluation.loop_status === "retrying", "loop_status is retrying");
    assert(result.evaluation.retry_allowed === true, "retry_allowed is true");
    assert(result.evaluation.retry_count === 1, "retry_count is 1");
    assert(result.evaluation.last_error.code === "BUILD_FAIL", "last_error has correct code");
    assert(result.evaluation.escalation_reason === null, "no escalation yet");

    // Second error
    const result2 = await recordError(env, "ctr_test_001", "task_001", {
      code: "BUILD_FAIL",
      scope: "task",
      message: "Build failed again",
      retryable: true,
      reason: "second syntax error",
      classification: "in_scope",
    });
    assert(result2.ok === true, "second recordError ok");
    assert(result2.evaluation.retry_count === 2, "retry_count is 2");
    assert(result2.evaluation.retry_allowed === true, "retry still allowed at count 2");
    assert(result2.evaluation.loop_status === "retrying", "still retrying at count 2");
  }

  // ---- Test 105: recordError — third attempt hits limit and escalates to blocked ----
  console.log("\nTest 105: recordError — third attempt hits limit → blocked");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    // Record 3 retryable errors
    for (let i = 0; i < 3; i++) {
      await recordError(env, "ctr_test_001", "task_001", {
        code: "BUILD_FAIL",
        scope: "task",
        message: `Build failed attempt ${i + 1}`,
        retryable: true,
        reason: "repeating error",
        classification: "in_scope",
      });
    }

    // Evaluate the loop
    const { state } = await rehydrateContract(env, "ctr_test_001");
    const evaluation = evaluateErrorLoop(state.error_loop, "task_001");
    assert(evaluation.loop_status === "blocked", "loop_status is blocked after 3 attempts");
    assert(evaluation.retry_allowed === false, "retry_allowed is false after limit");
    assert(evaluation.retry_count === 3, "retry_count is 3");
    assert(evaluation.escalation_reason !== null, "escalation_reason is set");
    assert(evaluation.escalation_reason.includes("Retry limit"), "escalation mentions retry limit");
  }

  // ---- Test 106: recordError — non-retryable error escalates immediately ----
  console.log("\nTest 106: recordError — non-retryable error escalates immediately");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "EXTERNAL_DEP_FAIL",
      scope: "task",
      message: "External API not available",
      retryable: false,
      reason: "third-party dependency down",
      classification: "external",
    });

    assert(result.ok === true, "recordError ok");
    assert(result.evaluation.loop_status === "awaiting_human", "loop_status is awaiting_human");
    assert(result.evaluation.retry_allowed === false, "retry not allowed for external error");
    assert(result.evaluation.retry_count === 1, "retry_count is 1");
    assert(result.evaluation.escalation_reason !== null, "escalation_reason set");
    assert(result.evaluation.escalation_reason.includes("External dependency"), "reason mentions external dependency");
  }

  // ---- Test 107: recordError — infra error escalates immediately ----
  console.log("\nTest 107: recordError — infra/secret/binding error escalates immediately");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "MISSING_SECRET",
      scope: "task",
      message: "KV binding not found",
      retryable: false,
      reason: "ENAVIA_BRAIN binding missing",
      classification: "infra",
    });

    assert(result.ok === true, "recordError ok");
    assert(result.evaluation.loop_status === "awaiting_human", "loop_status is awaiting_human for infra");
    assert(result.evaluation.retry_allowed === false, "no retry for infra");
    assert(result.evaluation.escalation_reason.includes("Infrastructure"), "reason mentions infrastructure");
  }

  // ---- Test 108: recordError — unknown error escalates immediately ----
  console.log("\nTest 108: recordError — unknown classification escalates immediately");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "UNEXPECTED",
      scope: "task",
      message: "Something unknown happened",
      retryable: false,
      classification: "unknown",
    });

    assert(result.ok === true, "recordError ok");
    assert(result.evaluation.loop_status === "awaiting_human", "loop_status is awaiting_human for unknown");
    assert(result.evaluation.retry_allowed === false, "no retry for unknown");
    assert(result.evaluation.escalation_reason.includes("Unknown error"), "reason mentions unknown");
  }

  // ---- Test 109: recordError — persists in KV and survives rehydration ----
  console.log("\nTest 109: recordError — error loop persisted and survives rehydration");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    await recordError(env, "ctr_test_001", "task_001", {
      code: "BUILD_FAIL",
      message: "Rehydration test error",
      retryable: true,
      classification: "in_scope",
    });

    // Rehydrate from KV
    const { state: rehydrated } = await rehydrateContract(env, "ctr_test_001");
    assert(rehydrated.error_loop !== undefined, "error_loop exists after rehydration");
    assert(rehydrated.error_loop !== null, "error_loop is not null after rehydration");
    assert(rehydrated.error_loop.task_001 !== undefined, "task_001 entry exists in error_loop");
    assert(rehydrated.error_loop.task_001.errors.length === 1, "1 error persisted");
    assert(rehydrated.error_loop.task_001.loop_status === "retrying", "loop_status persisted as retrying");
    assert(rehydrated.error_loop.task_001.retry_count === 1, "retry_count persisted as 1");
    assert(rehydrated.error_loop.task_001.retry_allowed === true, "retry_allowed persisted as true");
    assert(rehydrated.error_loop.task_001.last_error.code === "BUILD_FAIL", "last_error.code persisted");

    // Rehydrate again — must be identical
    const { state: rehydrated2 } = await rehydrateContract(env, "ctr_test_001");
    assert(
      rehydrated2.error_loop.task_001.errors.length === rehydrated.error_loop.task_001.errors.length,
      "error count consistent across rehydrations"
    );
    assert(
      rehydrated2.error_loop.task_001.loop_status === rehydrated.error_loop.task_001.loop_status,
      "loop_status consistent across rehydrations"
    );
  }

  // ---- Test 110: recordError — exposed in summary/API ----
  console.log("\nTest 110: recordError — error_loop exposed in summary/API");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    await recordError(env, "ctr_test_001", "task_001", {
      code: "BUILD_FAIL",
      message: "Summary exposure test",
      retryable: true,
      classification: "in_scope",
    });

    const summaryResult = await handleGetContractSummary(env, "ctr_test_001");
    assert(summaryResult.status === 200, "summary status 200");
    assert(summaryResult.body.error_loop !== undefined, "error_loop present in summary");
    assert(summaryResult.body.error_loop !== null, "error_loop not null in summary");
    assert(summaryResult.body.error_loop.task_001 !== undefined, "task_001 error loop in summary");
    assert(summaryResult.body.error_loop.task_001.loop_status === "retrying", "loop_status in summary");
  }

  // ---- Test 111: recordError — guard: contract not found ----
  console.log("\nTest 111: recordError — guard: contract not found");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await recordError(env, "no_contract", "task_001", {
      code: "TEST",
      message: "test",
    });
    assert(result.ok === false, "returns ok=false");
    assert(result.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 112: recordError — guard: task not found ----
  console.log("\nTest 112: recordError — guard: task not found");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    const result = await recordError(env, "ctr_test_001", "task_999", {
      code: "TEST",
      message: "test",
    });
    assert(result.ok === false, "returns ok=false");
    assert(result.error === "TASK_NOT_FOUND", "error is TASK_NOT_FOUND");
  }

  // ---- Test 113: recordError — guard: cannot record error on completed task ----
  console.log("\nTest 113: recordError — guard: cannot record error on completed task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");
    await completeTask(env, "ctr_test_001", "task_001");

    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "LATE_ERROR",
      message: "Too late",
      classification: "in_scope",
    });
    assert(result.ok === false, "returns ok=false for completed task");
    assert(result.error === "INVALID_ERROR_RECORD", "error is INVALID_ERROR_RECORD");
  }

  // ---- Test 114: recordError — guard: cannot record error on blocked task ----
  console.log("\nTest 114: recordError — allowed on blocked task (still active)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await blockTask(env, "ctr_test_001", "task_001", "Manual block");

    // blocked is NOT in TASK_DONE_STATUSES, so recording should work
    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "RETRY_ON_BLOCKED",
      message: "Error on blocked task",
      retryable: true,
      classification: "in_scope",
    });
    assert(result.ok === true, "recordError ok on blocked task");
    assert(result.evaluation.loop_status === "retrying", "loop_status is retrying");
  }

  // ---- Test 115: recordError — does NOT advance phase or task ----
  console.log("\nTest 115: recordError — does NOT advance phase or task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    const { state: stateBefore, decomposition: decompBefore } = await rehydrateContract(env, "ctr_test_001");

    await recordError(env, "ctr_test_001", "task_001", {
      code: "BUILD_FAIL",
      message: "No phase advance test",
      retryable: true,
      classification: "in_scope",
    });

    const { state: stateAfter, decomposition: decompAfter } = await rehydrateContract(env, "ctr_test_001");

    assert(stateAfter.current_phase === stateBefore.current_phase, "current_phase unchanged after error");
    assert(stateAfter.current_task === stateBefore.current_task, "current_task unchanged after error");
    assert(stateAfter.status_global === stateBefore.status_global, "status_global unchanged after error");
    assert(
      JSON.stringify(decompAfter.tasks.map(t => t.status)) === JSON.stringify(decompBefore.tasks.map(t => t.status)),
      "task statuses unchanged after error"
    );
    assert(
      JSON.stringify(decompAfter.phases.map(p => p.status)) === JSON.stringify(decompBefore.phases.map(p => p.status)),
      "phase statuses unchanged after error"
    );
  }

  // ---- Test 116: recordError — does NOT trigger real execution ----
  console.log("\nTest 116: recordError — does NOT trigger real execution");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    await recordError(env, "ctr_test_001", "task_001", {
      code: "EXEC_CHECK",
      message: "Execution guard test",
      retryable: true,
      classification: "in_scope",
    });

    const { decomposition } = await rehydrateContract(env, "ctr_test_001");
    // No micro-PR should have changed status
    const allMprsQueued = decomposition.micro_pr_candidates.every(m => m.status === "queued");
    assert(allMprsQueued, "all micro-PR candidates still queued — no execution triggered");
  }

  // ---- Test 117: recordError — error_loop exposed in GET contract ----
  console.log("\nTest 117: recordError — error_loop exposed in GET contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");
    await recordError(env, "ctr_test_001", "task_001", {
      code: "GET_TEST",
      message: "GET contract exposure test",
      retryable: true,
      classification: "in_scope",
    });

    const getResult = await handleGetContract(env, "ctr_test_001");
    assert(getResult.status === 200, "GET contract status 200");
    assert(getResult.body.contract.error_loop !== undefined, "error_loop present in GET response");
    assert(getResult.body.contract.error_loop.task_001 !== undefined, "task_001 error loop in GET response");
  }

  // ---- Test 118: evaluateErrorLoop — mixed: retryable then non-retryable ----
  console.log("\nTest 118: evaluateErrorLoop — mixed classification: last error determines state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    // First: retryable
    await recordError(env, "ctr_test_001", "task_001", {
      code: "BUILD_FAIL",
      message: "First attempt",
      retryable: true,
      classification: "in_scope",
    });

    let { state } = await rehydrateContract(env, "ctr_test_001");
    let eval1 = evaluateErrorLoop(state.error_loop, "task_001");
    assert(eval1.loop_status === "retrying", "still retrying after first in_scope error");

    // Second: infra (non-retryable) → should escalate
    await recordError(env, "ctr_test_001", "task_001", {
      code: "INFRA_FAIL",
      message: "Infra error",
      retryable: false,
      classification: "infra",
    });

    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    let eval2 = evaluateErrorLoop(state.error_loop, "task_001");
    assert(eval2.loop_status === "awaiting_human", "escalated to awaiting_human after infra error");
    assert(eval2.retry_allowed === false, "no retry after infra error");
  }

  // ---- Test 119: recordError — error on queued task works ----
  console.log("\nTest 119: recordError — error on queued task works");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "PRE_START_ERR",
      message: "Error before task start",
      retryable: true,
      classification: "in_scope",
    });

    assert(result.ok === true, "recordError ok on queued task");
    assert(result.evaluation.loop_status === "retrying", "loop_status is retrying");
  }

  // ---- Test 120: summary without errors shows null error_loop ----
  console.log("\nTest 120: summary without errors shows null error_loop");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);

    const summaryResult = await handleGetContractSummary(env, "ctr_test_001");
    assert(summaryResult.status === 200, "summary status 200");
    // error_loop should be null when no errors recorded
    assert(summaryResult.body.error_loop === null || summaryResult.body.error_loop === undefined,
      "error_loop is null/undefined when no errors");
  }

  // ---- Test 121: recordError — multiple tasks have independent loops ----
  console.log("\nTest 121: recordError — multiple tasks have independent error loops");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    await recordError(env, "ctr_test_001", "task_001", {
      code: "ERR_TASK1",
      message: "Error on task 1",
      retryable: true,
      classification: "in_scope",
    });

    await recordError(env, "ctr_test_001", "task_002", {
      code: "ERR_TASK2",
      message: "Error on task 2",
      retryable: false,
      classification: "infra",
    });

    const { state } = await rehydrateContract(env, "ctr_test_001");
    assert(state.error_loop.task_001.loop_status === "retrying", "task_001 loop is retrying");
    assert(state.error_loop.task_002.loop_status === "awaiting_human", "task_002 loop is awaiting_human");
    assert(state.error_loop.task_001.errors.length === 1, "task_001 has 1 error");
    assert(state.error_loop.task_002.errors.length === 1, "task_002 has 1 error");
  }

  // ---- Test 122: recordError — does NOT close contract ----
  console.log("\nTest 122: recordError — does NOT close contract even at max errors");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    for (let i = 0; i < 5; i++) {
      await recordError(env, "ctr_test_001", "task_001", {
        code: "REPEATED_FAIL",
        message: `Attempt ${i + 1}`,
        retryable: true,
        classification: "in_scope",
      });
    }

    const { state } = await rehydrateContract(env, "ctr_test_001");
    assert(state.status_global !== "completed", "status_global is NOT completed after many errors");
    assert(state.current_phase !== "all_phases_complete", "current_phase is NOT all_phases_complete");
  }

  // ---- Test 123: buildErrorEntry — invalid classification defaults to unknown ----
  console.log("\nTest 123: buildErrorEntry — invalid classification defaults to unknown");
  {
    const entry = buildErrorEntry({ classification: "made_up_category" });
    assert(entry.classification === "unknown", "invalid classification defaults to unknown");
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
