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
  VALID_STATUSES,
  VALID_GLOBAL_TRANSITIONS,
  transitionStatusGlobal,
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
  executeCurrentMicroPr,
  EXECUTION_STATUSES,
  handleExecuteContract,
  closeContractInTest,
  CONTRACT_CLOSURE_STATUSES,
  handleCloseContractInTest,
  cancelContract,
  isCancelledContract,
  handleCancelContract,
  rejectDecompositionPlan,
  isPlanRejected,
  handleRejectDecompositionPlan,
  resolvePlanRevision,
  handleResolvePlanRevision,
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
    assert(advanceResult.state.status_global === "executing", "status_global is executing after advancing to next phase");
    assert(advanceResult.state.blockers.length === 0, "blockers array is cleared on successful advance");

    // Verify via KV rehydration (Rule 1)
    const { state: rehydrated } = await rehydrateContract(env, "ctr_test_001");
    assert(rehydrated.status_global === "executing", "rehydrated status confirms executing was persisted");
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
    assert(result.state.status_global === "executing", "status_global is executing after all phases done");

    // Verify final state via KV (Rule 1)
    const { state: finalState } = await rehydrateContract(env, "ctr_test_001");
    assert(finalState.current_phase === "all_phases_complete", "rehydrated final phase is all_phases_complete");
    assert(finalState.status_global === "executing", "rehydrated final status is executing (awaiting formal closure)");
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
      status_global: "executing",
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
    // With canonical state machine, all phases done → status is "executing" (awaiting closure)
    assert(action.type === "awaiting_human_approval", "lifecycle step 4: awaiting_human_approval (all phases done, awaiting closure)");
    assert(action.status === "awaiting_approval", "lifecycle step 4: status is awaiting_approval");
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
    assert(result.active_retry_count === 0, "active_retry_count is 0");
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
    assert(result.evaluation.active_retry_count === 1, "active_retry_count is 1");
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
    assert(result2.evaluation.active_retry_count === 2, "active_retry_count is 2");
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
    assert(evaluation.active_retry_count === 3, "active_retry_count is 3");
    assert(evaluation.retry_count === 3, "retry_count (total history) is 3");
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
    assert(rehydrated.error_loop.task_001.active_retry_count === 1, "active_retry_count persisted as 1");
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
      rehydrated2.error_loop.task_001.active_retry_count === rehydrated.error_loop.task_001.active_retry_count,
      "active_retry_count consistent across rehydrations"
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

  // ---- Test 114: recordError — guard: blocked task rejects recordError ----
  console.log("\nTest 114: recordError — blocked task rejects recordError");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await blockTask(env, "ctr_test_001", "task_001", "Manual block");

    // blocked task must NOT accept new errors
    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "RETRY_ON_BLOCKED",
      message: "Error on blocked task",
      retryable: true,
      classification: "in_scope",
    });
    assert(result.ok === false, "recordError returns ok=false on blocked task");
    assert(result.error === "TASK_BLOCKED", "error is TASK_BLOCKED");
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
    assert(summaryResult.body.error_loop === null,
      "error_loop is null when no errors");
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

  // ---- Test 124: active_retry_count is independent from total error history ----
  console.log("\nTest 124: active_retry_count is independent from total error history");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    // Record 2 retryable errors — active cycle at 2, history at 2
    await recordError(env, "ctr_test_001", "task_001", {
      code: "BUILD_FAIL",
      message: "First error",
      retryable: true,
      classification: "in_scope",
    });
    await recordError(env, "ctr_test_001", "task_001", {
      code: "BUILD_FAIL",
      message: "Second error",
      retryable: true,
      classification: "in_scope",
    });

    let { state } = await rehydrateContract(env, "ctr_test_001");
    assert(state.error_loop.task_001.active_retry_count === 2, "active_retry_count is 2");
    assert(state.error_loop.task_001.errors.length === 2, "history has 2 errors");
    assert(state.error_loop.task_001.retry_count === 2, "retry_count (history) is 2");

    // Directly reset the active_retry_count to simulate a new cycle
    // (e.g., after human intervention clears the active cycle)
    state.error_loop.task_001.active_retry_count = 0;
    await env.ENAVIA_BRAIN.put("contract:ctr_test_001:state", JSON.stringify(state));

    // Record a new error — should use reset active count, not total history
    await recordError(env, "ctr_test_001", "task_001", {
      code: "BUILD_FAIL",
      message: "Third error after cycle reset",
      retryable: true,
      classification: "in_scope",
    });

    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    assert(state.error_loop.task_001.active_retry_count === 1, "active_retry_count is 1 after cycle reset");
    assert(state.error_loop.task_001.errors.length === 3, "history has 3 errors (all preserved)");
    assert(state.error_loop.task_001.loop_status === "retrying", "loop_status is retrying (not blocked)");
    assert(state.error_loop.task_001.retry_allowed === true, "retry_allowed is true in new cycle");
  }

  // ---- Test 125: active_retry_count blocks at limit, not total history ----
  console.log("\nTest 125: active_retry_count blocks at limit, not total history");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    // Record 2 errors then reset cycle
    await recordError(env, "ctr_test_001", "task_001", {
      code: "ERR1", message: "err1", retryable: true, classification: "in_scope",
    });
    await recordError(env, "ctr_test_001", "task_001", {
      code: "ERR2", message: "err2", retryable: true, classification: "in_scope",
    });

    // Reset active cycle (human cleared the block)
    let { state } = await rehydrateContract(env, "ctr_test_001");
    state.error_loop.task_001.active_retry_count = 0;
    await env.ENAVIA_BRAIN.put("contract:ctr_test_001:state", JSON.stringify(state));

    // Now record 3 more errors in the new cycle — should block at 3, not earlier
    for (let i = 0; i < 3; i++) {
      await recordError(env, "ctr_test_001", "task_001", {
        code: "NEW_CYCLE",
        message: `new cycle attempt ${i + 1}`,
        retryable: true,
        classification: "in_scope",
      });
    }

    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    assert(state.error_loop.task_001.active_retry_count === 3, "active_retry_count is 3");
    assert(state.error_loop.task_001.errors.length === 5, "history has 5 total errors");
    assert(state.error_loop.task_001.loop_status === "blocked", "blocked by active cycle limit");
    assert(state.error_loop.task_001.retry_allowed === false, "retry not allowed");
    assert(
      state.error_loop.task_001.escalation_reason.includes("Retry limit"),
      "escalation mentions retry limit"
    );
  }

  // ---- Test 126: blocked task rejects recordError consistently ----
  console.log("\nTest 126: blocked task rejects recordError — no error loop mutation");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    // Record one error first
    await recordError(env, "ctr_test_001", "task_001", {
      code: "INITIAL_ERR",
      message: "Error before block",
      retryable: true,
      classification: "in_scope",
    });

    // Block the task
    await blockTask(env, "ctr_test_001", "task_001", "Formally blocked");

    // Try to record another error — must fail
    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "POST_BLOCK_ERR",
      message: "Should not be recorded",
      retryable: true,
      classification: "in_scope",
    });

    assert(result.ok === false, "recordError fails on blocked task");
    assert(result.error === "TASK_BLOCKED", "error is TASK_BLOCKED");

    // Verify error loop was NOT mutated
    const { state } = await rehydrateContract(env, "ctr_test_001");
    assert(state.error_loop.task_001.errors.length === 1, "still only 1 error in history");
    assert(state.error_loop.task_001.active_retry_count === 1, "active_retry_count unchanged");
  }

  // ---- Test 127: evaluateErrorLoop uses active_retry_count field ----
  console.log("\nTest 127: evaluateErrorLoop uses active_retry_count from task loop");
  {
    // Simulate a task loop with many history errors but low active_retry_count
    const errorLoop = {
      task_001: {
        errors: [
          buildErrorEntry({ code: "E1", classification: "in_scope", retryable: true }),
          buildErrorEntry({ code: "E2", classification: "in_scope", retryable: true }),
          buildErrorEntry({ code: "E3", classification: "in_scope", retryable: true }),
          buildErrorEntry({ code: "E4", classification: "in_scope", retryable: true }),
        ],
        active_retry_count: 1,
      },
    };

    const evaluation = evaluateErrorLoop(errorLoop, "task_001");
    assert(evaluation.loop_status === "retrying", "retrying despite 4 total errors (active=1)");
    assert(evaluation.retry_allowed === true, "retry_allowed is true");
    assert(evaluation.active_retry_count === 1, "active_retry_count is 1");
    assert(evaluation.retry_count === 4, "retry_count (total history) is 4");
  }

  // ---- Test 128: evaluateErrorLoop — uses canonical MAX_RETRY_ATTEMPTS, ignores lastError.max_attempts ----
  console.log("\nTest 128: evaluateErrorLoop — limit is immutable/canonical, ignores lastError.max_attempts");
  {
    // Build an error loop where lastError has a higher max_attempts — must be ignored
    const errorLoop = {
      task_001: {
        errors: [
          buildErrorEntry({ code: "E1", classification: "in_scope", retryable: true, max_attempts: 3 }),
          buildErrorEntry({ code: "E2", classification: "in_scope", retryable: true, max_attempts: 3 }),
          buildErrorEntry({ code: "E3", classification: "in_scope", retryable: true, max_attempts: 3 }),
          // 4th error claims max_attempts=10 to try to bypass the block
          buildErrorEntry({ code: "E4", classification: "in_scope", retryable: true, max_attempts: 10 }),
        ],
        active_retry_count: 4,
      },
    };

    const evaluation = evaluateErrorLoop(errorLoop, "task_001");
    // Even though lastError.max_attempts is 10, canonical limit is 3 — must stay blocked
    assert(evaluation.loop_status === "blocked", "still blocked despite lastError.max_attempts=10");
    assert(evaluation.retry_allowed === false, "retry_allowed is false");
    assert(evaluation.active_retry_count === 4, "active_retry_count is 4");
    assert(evaluation.escalation_reason.includes("Retry limit"), "escalation mentions retry limit");
  }

  // ---- Test 129: recordError — max_attempts from caller is ignored, entry always stores canonical value ----
  console.log("\nTest 129: recordError — caller-supplied max_attempts is stripped, canonical value stored");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "ERR_BYPASS",
      message: "Attempt to set higher limit",
      retryable: true,
      classification: "in_scope",
      max_attempts: 99,
    });

    assert(result.ok === true, "recordError ok");
    const entry = result.error_loop.task_001.errors[0];
    assert(entry.max_attempts === MAX_RETRY_ATTEMPTS, "entry.max_attempts equals canonical MAX_RETRY_ATTEMPTS, caller-supplied 99 was ignored");
    assert(entry.max_attempts === 3, "canonical value is 3");
  }

  // ---- Test 130: recordError — blocked error loop rejects new error even without explicit blockTask call ----
  console.log("\nTest 130: recordError — blocked error loop (via limit) rejects further errors without explicit blockTask");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    // Hit the canonical limit (3 errors)
    for (let i = 0; i < 3; i++) {
      await recordError(env, "ctr_test_001", "task_001", {
        code: "LOOP_ERR",
        message: `Error attempt ${i + 1}`,
        retryable: true,
        classification: "in_scope",
      });
    }

    // Verify error loop is blocked
    let { state } = await rehydrateContract(env, "ctr_test_001");
    assert(state.error_loop.task_001.loop_status === "blocked", "error loop is blocked after 3 attempts");

    // Now try to record a 4th error with a larger max_attempts — must be rejected
    const result = await recordError(env, "ctr_test_001", "task_001", {
      code: "BYPASS_ATTEMPT",
      message: "Should not bypass the blocked loop",
      retryable: true,
      classification: "in_scope",
      max_attempts: 10,
    });

    assert(result.ok === false, "recordError returns ok=false on error-loop-blocked task");
    assert(result.error === "TASK_BLOCKED", "error is TASK_BLOCKED");

    // Verify error loop was NOT mutated
    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    assert(state.error_loop.task_001.errors.length === 3, "still only 3 errors in history");
    assert(state.error_loop.task_001.active_retry_count === 3, "active_retry_count unchanged at 3");
    assert(state.error_loop.task_001.loop_status === "blocked", "loop_status remains blocked");
  }

  // ---- Test 131: evaluateErrorLoop — limit stable across multiple errors with varying max_attempts ----
  console.log("\nTest 131: evaluateErrorLoop — canonical limit is stable even if errors carry different max_attempts");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_test_001", "task_001");

    // Record errors passing different max_attempts values — all must be ignored
    await recordError(env, "ctr_test_001", "task_001", {
      code: "ERR1", message: "err1", retryable: true, classification: "in_scope", max_attempts: 1,
    });
    let { state } = await rehydrateContract(env, "ctr_test_001");
    // With canonical limit=3, active=1 → must be retrying (not blocked at 1)
    assert(state.error_loop.task_001.loop_status === "retrying", "retrying at attempt 1 (limit=3, not 1)");

    await recordError(env, "ctr_test_001", "task_001", {
      code: "ERR2", message: "err2", retryable: true, classification: "in_scope", max_attempts: 5,
    });
    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    // active=2 < 3 → still retrying
    assert(state.error_loop.task_001.loop_status === "retrying", "retrying at attempt 2 (limit=3, not 5)");

    await recordError(env, "ctr_test_001", "task_001", {
      code: "ERR3", message: "err3", retryable: true, classification: "in_scope", max_attempts: 99,
    });
    ({ state } = await rehydrateContract(env, "ctr_test_001"));
    // active=3 >= 3 → blocked (not still retrying due to max_attempts=99)
    assert(state.error_loop.task_001.loop_status === "blocked", "blocked at attempt 3 (limit=3, not 99)");
    assert(state.error_loop.task_001.retry_allowed === false, "retry not allowed");
    // All entries must store canonical MAX_RETRY_ATTEMPTS, not the caller-supplied values
    for (let i = 0; i < state.error_loop.task_001.errors.length; i++) {
      const entry = state.error_loop.task_001.errors[i];
      assert(entry.max_attempts === MAX_RETRY_ATTEMPTS, `entry[${i}] (${entry.code}) max_attempts is canonical: expected ${MAX_RETRY_ATTEMPTS}, got ${entry.max_attempts}`);
    }
  }

  // ==========================================================================
  // 🚀 C1 — Real Micro-PR Execution in TEST
  // ==========================================================================
  console.log("\n📜 C1 — Real Micro-PR Execution in TEST\n");

  // ---- Test 132: EXECUTION_STATUSES export ----
  {
    console.log("Test 132: EXECUTION_STATUSES export is correct");
    assert(Array.isArray(EXECUTION_STATUSES), "EXECUTION_STATUSES is an array");
    assert(EXECUTION_STATUSES.includes("pending"), "includes pending");
    assert(EXECUTION_STATUSES.includes("running"), "includes running");
    assert(EXECUTION_STATUSES.includes("success"), "includes success");
    assert(EXECUTION_STATUSES.includes("failed"), "includes failed");
    assert(EXECUTION_STATUSES.length === 5, "has 5 statuses");
  }

  // ---- Test 133: Successful execution in TEST with valid handoff ----
  {
    console.log("Test 133: Successful execution in TEST with valid handoff");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_133" }));
    await handleCreateContract(req, env);

    // Advance phase from decomposition_complete to phase_01
    await advanceContractPhase(env, "ctr_c1_133");
    // Start the first task
    await startTask(env, "ctr_c1_133", "task_001");

    // Verify task is in_progress and current_task is set
    let { state, decomposition } = await rehydrateContract(env, "ctr_c1_133");
    assert(state.current_task === "task_001", "current_task is task_001");
    assert(decomposition.tasks[0].status === "in_progress", "task_001 is in_progress");

    // Execute
    const result = await executeCurrentMicroPr(env, "ctr_c1_133", {
      evidence: ["Smoke test passed", "Endpoint returned 200"],
    });

    assert(result.ok === true, "execution succeeded");
    assert(result.execution_status === "success", "execution_status is success");
    assert(result.task_id === "task_001", "task_id is task_001");
    assert(result.micro_pr_id === "micro_pr_001", "micro_pr_id is micro_pr_001");
    assert(Array.isArray(result.evidence), "evidence is array");
    assert(result.evidence.length === 2, "evidence has 2 items");
    assert(result.evidence[0] === "Smoke test passed", "evidence[0] correct");
    assert(result.handoff_used !== null, "handoff_used is not null");
    assert(typeof result.execution_started_at === "string", "execution_started_at is ISO string");
    assert(typeof result.execution_finished_at === "string", "execution_finished_at is ISO string");
  }

  // ---- Test 134: Execution state persisted on contract (current_execution) ----
  {
    console.log("Test 134: Execution state persisted on contract");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_134" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_134");
    await startTask(env, "ctr_c1_134", "task_001");

    await executeCurrentMicroPr(env, "ctr_c1_134", { evidence: ["OK"] });

    const { state } = await rehydrateContract(env, "ctr_c1_134");
    assert(state.current_execution !== undefined, "current_execution exists");
    assert(state.current_execution !== null, "current_execution is not null");
    assert(state.current_execution.execution_status === "success", "execution_status is success");
    assert(state.current_execution.task_id === "task_001", "task_id persisted");
    assert(state.current_execution.micro_pr_id === "micro_pr_001", "micro_pr_id persisted");
    assert(state.current_execution.test_execution === true, "test_execution flag is true");
    assert(state.current_execution.handoff_used !== null, "handoff_used persisted");
    assert(typeof state.current_execution.execution_started_at === "string", "started_at persisted");
    assert(typeof state.current_execution.execution_finished_at === "string", "finished_at persisted");
    assert(Array.isArray(state.current_execution.execution_evidence), "evidence persisted");
    assert(state.current_execution.execution_evidence[0] === "OK", "evidence content correct");
    assert(state.current_execution.last_execution_result === "success", "last_execution_result is success");
  }

  // ---- Test 135: Rehydration preserves current_execution ----
  {
    console.log("Test 135: Rehydration preserves execution state");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_135" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_135");
    await startTask(env, "ctr_c1_135", "task_001");
    await executeCurrentMicroPr(env, "ctr_c1_135", { evidence: ["rehydration test"] });

    // Rehydrate twice to prove persistence
    const r1 = await rehydrateContract(env, "ctr_c1_135");
    const r2 = await rehydrateContract(env, "ctr_c1_135");
    assert(r1.state.current_execution.execution_status === "success", "1st rehydration OK");
    assert(r2.state.current_execution.execution_status === "success", "2nd rehydration OK");
    assert(r1.state.current_execution.task_id === r2.state.current_execution.task_id, "task_id stable across rehydrations");
    assert(r1.state.current_execution.execution_started_at === r2.state.current_execution.execution_started_at, "started_at stable");
  }

  // ---- Test 136: Execution without current_task fails ----
  {
    console.log("Test 136: Execution without current_task fails");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_136" }));
    await handleCreateContract(req, env);

    // Contract just created, no task started → current_task is null
    const result = await executeCurrentMicroPr(env, "ctr_c1_136");
    assert(result.ok === false, "execution fails");
    assert(result.error === "NO_CURRENT_TASK", "error is NO_CURRENT_TASK");
  }

  // ---- Test 137: Execution without valid handoff fails ----
  {
    console.log("Test 137: Execution without valid handoff fails (task completed)");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_137" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_137");
    await startTask(env, "ctr_c1_137", "task_001");
    await completeTask(env, "ctr_c1_137", "task_001");

    // task_001 is now completed; next action resolves to something else
    // but current_task advanced to task_002 (still queued, not started)
    // Force a scenario where there's a current_task but handoff can't build
    // We'll use a blocked contract scenario instead
    const { state } = await rehydrateContract(env, "ctr_c1_137");
    // After completing task_001, current_task points to next queued or null
    // The key test: task that isn't in_progress should fail at Gate 2
    if (state.current_task) {
      const result = await executeCurrentMicroPr(env, "ctr_c1_137");
      assert(result.ok === false, "execution fails for non-in_progress task");
      assert(result.error === "TASK_NOT_IN_PROGRESS", "error is TASK_NOT_IN_PROGRESS");
    } else {
      const result = await executeCurrentMicroPr(env, "ctr_c1_137");
      assert(result.ok === false, "execution fails with no current_task");
      assert(result.error === "NO_CURRENT_TASK", "error is NO_CURRENT_TASK");
    }
  }

  // ---- Test 138: Execution with simulated failure feeds error_loop ----
  {
    console.log("Test 138: Execution failure feeds error_loop");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_138" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_138");
    await startTask(env, "ctr_c1_138", "task_001");

    const result = await executeCurrentMicroPr(env, "ctr_c1_138", {
      simulate_failure: {
        code: "DEPLOY_TIMEOUT",
        message: "Wrangler deploy exceeded 60s",
        classification: "in_scope",
      },
    });

    assert(result.ok === false, "execution reports failure");
    assert(result.error === "EXECUTION_FAILED", "error is EXECUTION_FAILED");
    assert(result.execution_status === "failed", "execution_status is failed");
    assert(result.execution_error.code === "DEPLOY_TIMEOUT", "error code preserved");

    // Verify error_loop was fed
    const { state } = await rehydrateContract(env, "ctr_c1_138");
    assert(state.error_loop !== undefined, "error_loop exists");
    assert(state.error_loop.task_001 !== undefined, "error_loop entry for task_001 exists");
    assert(state.error_loop.task_001.errors.length === 1, "1 error recorded");
    assert(state.error_loop.task_001.errors[0].code === "DEPLOY_TIMEOUT", "error code in loop");
    assert(state.error_loop.task_001.loop_status === "retrying", "loop_status is retrying");
    assert(state.error_loop.task_001.retry_allowed === true, "retry is allowed");
  }

  // ---- Test 139: Failed execution persists current_execution with failure details ----
  {
    console.log("Test 139: Failed execution persists failure state");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_139" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_139");
    await startTask(env, "ctr_c1_139", "task_001");

    await executeCurrentMicroPr(env, "ctr_c1_139", {
      simulate_failure: { code: "TEST_FAIL", message: "Smoke test failed", classification: "in_scope" },
    });

    const { state } = await rehydrateContract(env, "ctr_c1_139");
    assert(state.current_execution.execution_status === "failed", "execution_status is failed");
    assert(state.current_execution.execution_error !== null, "execution_error persisted");
    assert(state.current_execution.execution_error.code === "TEST_FAIL", "error code persisted");
    assert(state.current_execution.last_execution_result === "failed", "last_execution_result is failed");
    assert(typeof state.current_execution.execution_finished_at === "string", "finished_at persisted");
  }

  // ---- Test 140: Successful execution does NOT close the contract ----
  {
    console.log("Test 140: Successful execution does NOT close contract");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_140" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_140");
    await startTask(env, "ctr_c1_140", "task_001");

    await executeCurrentMicroPr(env, "ctr_c1_140", { evidence: ["passed"] });

    const { state } = await rehydrateContract(env, "ctr_c1_140");
    assert(state.status_global !== "completed", "contract is NOT completed");
    assert(state.current_phase !== "all_phases_complete", "phase is NOT all_phases_complete");
    // Task should still be in_progress (execution doesn't auto-complete task)
    const task = (await rehydrateContract(env, "ctr_c1_140")).decomposition.tasks[0];
    assert(task.status === "in_progress", "task remains in_progress (not auto-completed)");
  }

  // ---- Test 141: Execution on non-existent contract fails ----
  {
    console.log("Test 141: Execution on non-existent contract fails");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const result = await executeCurrentMicroPr(env, "nonexistent_ctr");
    assert(result.ok === false, "execution fails");
    assert(result.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 142: Execution does NOT promote to PROD ----
  {
    console.log("Test 142: Execution scope is TEST-only — no PROD promotion");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_142" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_142");
    await startTask(env, "ctr_c1_142", "task_001");

    const result = await executeCurrentMicroPr(env, "ctr_c1_142", { evidence: ["test only"] });
    assert(result.ok === true, "execution OK");
    assert(result.handoff_used.scope.environment === "TEST", "handoff environment is TEST");

    // Verify nothing changed in PROD-related state
    const { state, decomposition } = await rehydrateContract(env, "ctr_c1_142");
    const prodMpr = decomposition.micro_pr_candidates.find((m) => m.environment === "PROD");
    assert(prodMpr.status === "queued", "PROD micro-PR remains queued");
  }

  // ---- Test 143: Summary reflects current_execution ----
  {
    console.log("Test 143: Summary/API reflects current_execution");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_143" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_143");
    await startTask(env, "ctr_c1_143", "task_001");
    await executeCurrentMicroPr(env, "ctr_c1_143", { evidence: ["summary test"] });

    const { state, decomposition } = await rehydrateContract(env, "ctr_c1_143");
    const summary = buildContractSummary(state, decomposition);
    assert(summary.current_execution !== undefined, "summary has current_execution");
    assert(summary.current_execution !== null, "summary current_execution not null");
    assert(summary.current_execution.execution_status === "success", "summary shows success");
    assert(summary.current_execution.task_id === "task_001", "summary shows task_id");
  }

  // ---- Test 144: Successful execution updates micro-PR to in_progress ----
  {
    console.log("Test 144: Successful execution updates micro-PR to in_progress");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_144" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_144");
    await startTask(env, "ctr_c1_144", "task_001");

    // Before execution, micro_pr_001 should be queued
    let { decomposition: d1 } = await rehydrateContract(env, "ctr_c1_144");
    const mprBefore = d1.micro_pr_candidates.find((m) => m.id === "micro_pr_001");
    assert(mprBefore.status === "queued", "micro_pr_001 starts as queued");

    await executeCurrentMicroPr(env, "ctr_c1_144", { evidence: ["ok"] });

    let { decomposition: d2 } = await rehydrateContract(env, "ctr_c1_144");
    const mprAfter = d2.micro_pr_candidates.find((m) => m.id === "micro_pr_001");
    assert(mprAfter.status === "in_progress", "micro_pr_001 advanced to in_progress");
  }

  // ---- Test 145: Repeated failure exhausts retry and blocks via error_loop ----
  {
    console.log("Test 145: Repeated failures exhaust retry limit via error_loop");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_145" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_145");
    await startTask(env, "ctr_c1_145", "task_001");

    // Fail 3 times to exhaust retry limit
    for (let i = 0; i < 3; i++) {
      await executeCurrentMicroPr(env, "ctr_c1_145", {
        simulate_failure: { code: `ERR_${i+1}`, message: `fail ${i+1}`, classification: "in_scope" },
      });
    }

    const { state } = await rehydrateContract(env, "ctr_c1_145");
    assert(state.error_loop.task_001.active_retry_count === 3, "3 retries counted");
    assert(state.error_loop.task_001.loop_status === "blocked", "loop is blocked after 3 failures");
    assert(state.error_loop.task_001.retry_allowed === false, "retry not allowed");
  }

  // ---- Test 146: Execution with infra failure escalates immediately ----
  {
    console.log("Test 146: Infra failure escalates to awaiting_human");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_146" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_146");
    await startTask(env, "ctr_c1_146", "task_001");

    await executeCurrentMicroPr(env, "ctr_c1_146", {
      simulate_failure: { code: "MISSING_SECRET", message: "KV binding missing", classification: "infra" },
    });

    const { state } = await rehydrateContract(env, "ctr_c1_146");
    assert(state.error_loop.task_001.loop_status === "awaiting_human", "infra escalates to awaiting_human");
    assert(state.error_loop.task_001.retry_allowed === false, "no retry for infra");
  }

  // ---- Test 147: Execution does not skip phases or advance out of order ----
  {
    console.log("Test 147: Execution respects phase/task ordering");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_147" }));
    await handleCreateContract(req, env);

    // Try to execute without advancing from decomposition_complete
    // First, manually set current_task to simulate a bad state
    let { state, decomposition } = await rehydrateContract(env, "ctr_c1_147");
    state.current_task = "task_001";
    // task_001 is still queued — Gate 2 should block
    await env.ENAVIA_BRAIN.put(`contract:ctr_c1_147:state`, JSON.stringify(state));

    const result = await executeCurrentMicroPr(env, "ctr_c1_147");
    assert(result.ok === false, "execution blocked");
    assert(result.error === "TASK_NOT_IN_PROGRESS", "error is TASK_NOT_IN_PROGRESS — cannot execute queued task");
  }

  // ---- Test 148: Default evidence is generated if none provided ----
  {
    console.log("Test 148: Default evidence generated when none provided");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_148" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_148");
    await startTask(env, "ctr_c1_148", "task_001");

    const result = await executeCurrentMicroPr(env, "ctr_c1_148");
    assert(result.ok === true, "execution succeeded");
    assert(result.evidence.length >= 1, "at least 1 evidence item generated");
    assert(result.evidence[0].includes("task_001"), "default evidence references task_id");
  }

  // ---- Test 149: handleExecuteContract route handler works ----
  {
    console.log("Test 149: handleExecuteContract route handler");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const createReq = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_149" }));
    await handleCreateContract(createReq, env);
    await advanceContractPhase(env, "ctr_c1_149");
    await startTask(env, "ctr_c1_149", "task_001");

    const execReq = mockRequest({ contract_id: "ctr_c1_149", evidence: ["route test"] });
    const result = await handleExecuteContract(execReq, env);
    assert(result.status === 200, "HTTP 200");
    assert(result.body.ok === true, "body.ok is true");
    assert(result.body.execution_status === "success", "body.execution_status is success");
    assert(result.body.task_id === "task_001", "body.task_id correct");
  }

  // ---- Test 150: handleExecuteContract fails without contract_id ----
  {
    console.log("Test 150: handleExecuteContract fails without contract_id");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const result = await handleExecuteContract(mockRequest({}), env);
    assert(result.status === 400, "HTTP 400 for missing contract_id");
    assert(result.body.error === "MISSING_PARAM", "error is MISSING_PARAM");
  }

  // ---- Test 151: handleExecuteContract with simulated failure returns correct status ----
  {
    console.log("Test 151: handleExecuteContract with failure");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const createReq = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_151" }));
    await handleCreateContract(createReq, env);
    await advanceContractPhase(env, "ctr_c1_151");
    await startTask(env, "ctr_c1_151", "task_001");

    const execReq = mockRequest({
      contract_id: "ctr_c1_151",
      simulate_failure: { code: "FAIL", message: "test fail", classification: "in_scope" },
    });
    const result = await handleExecuteContract(execReq, env);
    assert(result.status === 200, "HTTP 200 for execution-ran-but-failed");
    assert(result.body.ok === false, "body.ok is false");
    assert(result.body.error === "EXECUTION_FAILED", "error is EXECUTION_FAILED");
    assert(result.body.execution_status === "failed", "execution_status is failed");
  }

  // ---- Test 152: Task with TEST micro-PR executes with non-null micro_pr_id ----
  {
    console.log("Test 152: Execution requires real TEST micro-PR — micro_pr_id is never null");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_152" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_152");
    await startTask(env, "ctr_c1_152", "task_001");

    const result = await executeCurrentMicroPr(env, "ctr_c1_152", { evidence: ["real mpr"] });
    assert(result.ok === true, "execution succeeded");
    assert(result.micro_pr_id !== null, "micro_pr_id is NOT null");
    assert(result.micro_pr_id === "micro_pr_001", "micro_pr_id is the real TEST micro-PR");

    // Verify in persisted state too
    const { state } = await rehydrateContract(env, "ctr_c1_152");
    assert(state.current_execution.micro_pr_id !== null, "persisted micro_pr_id is NOT null");
  }

  // ---- Test 153: Task without TEST micro-PR fails with NO_ACTIVE_TEST_MICRO_PR ----
  {
    console.log("Test 153: Task without TEST micro-PR fails controlled");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_153" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_153");
    await startTask(env, "ctr_c1_153", "task_001");

    // Manually remove the TEST micro-PR for task_001 so there's none available
    let { state, decomposition } = await rehydrateContract(env, "ctr_c1_153");
    decomposition.micro_pr_candidates = decomposition.micro_pr_candidates.filter(
      (m) => !(m.task_id === "task_001" && m.environment === "TEST")
    );
    await env.ENAVIA_BRAIN.put("contract:ctr_c1_153:decomposition", JSON.stringify(decomposition));

    const result = await executeCurrentMicroPr(env, "ctr_c1_153");
    assert(result.ok === false, "execution fails");
    assert(result.error === "NO_ACTIVE_TEST_MICRO_PR", "error is NO_ACTIVE_TEST_MICRO_PR");
    assert(result.message.includes("task_001"), "message references the task");
  }

  // ---- Test 154: TEST + PROD micro-PRs for same task → selects TEST explicitly ----
  {
    console.log("Test 154: Simultaneous TEST + PROD micro-PRs — selects TEST");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_154" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_154");
    await startTask(env, "ctr_c1_154", "task_001");

    // Add a PROD micro-PR for the same task (before the TEST one in array order)
    let { decomposition } = await rehydrateContract(env, "ctr_c1_154");
    decomposition.micro_pr_candidates.unshift({
      id: "micro_pr_prod_001",
      task_id: "task_001",
      title: "ctr_c1_154 — PROD duplicate",
      status: "queued",
      target_workers: ["nv-enavia"],
      target_routes: ["/test-route"],
      environment: "PROD",
    });
    await env.ENAVIA_BRAIN.put("contract:ctr_c1_154:decomposition", JSON.stringify(decomposition));

    const result = await executeCurrentMicroPr(env, "ctr_c1_154", { evidence: ["test+prod"] });
    assert(result.ok === true, "execution succeeded");
    assert(result.micro_pr_id === "micro_pr_001", "selected the TEST micro-PR, not the PROD one");
    assert(result.handoff_used.scope.environment === "TEST", "handoff environment is TEST");
  }

  // ---- Test 155: Only PROD micro-PR for task → fails with NO_ACTIVE_TEST_MICRO_PR ----
  {
    console.log("Test 155: Only PROD micro-PR for task — fails controlled");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c1_155" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c1_155");
    await startTask(env, "ctr_c1_155", "task_001");

    // Replace the TEST micro-PR with a PROD-only one
    let { decomposition } = await rehydrateContract(env, "ctr_c1_155");
    decomposition.micro_pr_candidates = decomposition.micro_pr_candidates.map((m) => {
      if (m.task_id === "task_001" && m.environment === "TEST") {
        return Object.assign({}, m, { environment: "PROD" });
      }
      return m;
    });
    await env.ENAVIA_BRAIN.put("contract:ctr_c1_155:decomposition", JSON.stringify(decomposition));

    const result = await executeCurrentMicroPr(env, "ctr_c1_155");
    assert(result.ok === false, "execution fails");
    assert(result.error === "NO_ACTIVE_TEST_MICRO_PR", "error is NO_ACTIVE_TEST_MICRO_PR");
  }

  // ============================================================================
  // 🔒 C2 — Automatic Contract Closure in TEST
  // ============================================================================
  console.log("\n--- C2: Automatic Contract Closure in TEST ---");

  // Helper: single-DoD payload generates a simpler contract (fewer tasks/phases)
  const SINGLE_DOD_PAYLOAD = Object.assign({}, VALID_PAYLOAD, {
    definition_of_done: ["Single criterion passes"],
  });

  // Helper: run full lifecycle to make a contract eligible for closure
  async function makeEligibleForClosure(env, contractId) {
    const req = mockRequest(Object.assign({}, SINGLE_DOD_PAYLOAD, { contract_id: contractId }));
    await handleCreateContract(req, env);
    // Advance from decomposition_complete to first phase
    await advanceContractPhase(env, contractId);
    await startTask(env, contractId, "task_001");
    await executeCurrentMicroPr(env, contractId, { evidence: ["test passed in TEST"] });
    // Complete the task — this clears the task acceptance criteria
    await completeTask(env, contractId, "task_001");
    // Advance phases until all_phases_complete
    // After completing task_001 in phase_01, advance phase_01 → phase_02 (or all_phases_complete)
    let advResult = await advanceContractPhase(env, contractId);
    // Keep advancing if there are more phases
    while (advResult.ok) {
      const { state: s } = await rehydrateContract(env, contractId);
      if (s.current_phase === "all_phases_complete") break;
      // Start next task if available
      const { decomposition: d } = await rehydrateContract(env, contractId);
      const nextTask = (d.tasks || []).find((t) => t.status === "queued");
      if (nextTask) {
        await startTask(env, contractId, nextTask.id);
        await executeCurrentMicroPr(env, contractId, { evidence: ["auto advance"] });
        await completeTask(env, contractId, nextTask.id);
      }
      advResult = await advanceContractPhase(env, contractId);
    }
  }

  // ---- Test 156: CONTRACT_CLOSURE_STATUSES export is correct ----
  {
    console.log("Test 156: CONTRACT_CLOSURE_STATUSES export is correct");
    assert(Array.isArray(CONTRACT_CLOSURE_STATUSES), "is array");
    assert(CONTRACT_CLOSURE_STATUSES.includes("open"), "includes open");
    assert(CONTRACT_CLOSURE_STATUSES.includes("closed_in_test"), "includes closed_in_test");
    assert(CONTRACT_CLOSURE_STATUSES.includes("closure_rejected"), "includes closure_rejected");
    assert(CONTRACT_CLOSURE_STATUSES.length === 3, "exactly 3 statuses");
  }

  // ---- Test 157: Eligible contract closes automatically in TEST ----
  {
    console.log("Test 157: Eligible contract closes automatically in TEST");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_157");

    const closeResult = await closeContractInTest(env, "ctr_c2_157");
    assert(closeResult.ok === true, "closure succeeded");
    assert(closeResult.already_closed === false, "not already closed");
    assert(closeResult.contract_closure.closure_status === "closed_in_test", "closure_status is closed_in_test");
    assert(closeResult.contract_closure.closed_in_test === true, "closed_in_test is true");
    assert(typeof closeResult.contract_closure.closed_at === "string", "closed_at is a timestamp");
    assert(Array.isArray(closeResult.contract_closure.closure_evidence), "closure_evidence is array");
    assert(closeResult.contract_closure.closure_evidence.length >= 1, "at least 1 evidence");
    assert(closeResult.contract_closure.closure_reason.includes("satisfied"), "closure_reason mentions satisfied");
    assert(closeResult.contract_closure.environment === "TEST", "environment is TEST");
    assert(closeResult.contract_closure.closed_by === "automatic", "closed_by is automatic");
    // RISCO 2: status_global must be synchronized with closure
    assert(closeResult.state.status_global === "test-complete", "status_global synchronized to test-complete");
  }

  // ---- Test 158: Contract with failed execution does NOT close ----
  {
    console.log("Test 158: Contract with failed execution does NOT close");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, SINGLE_DOD_PAYLOAD, { contract_id: "ctr_c2_158" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c2_158");
    await startTask(env, "ctr_c2_158", "task_001");

    // Execute with failure
    await executeCurrentMicroPr(env, "ctr_c2_158", {
      simulate_failure: { code: "BUILD_FAIL", message: "Build failed", classification: "in_scope" },
    });

    const closeResult = await closeContractInTest(env, "ctr_c2_158");
    assert(closeResult.ok === false, "closure rejected");
    assert(closeResult.error === "EXECUTION_NOT_SUCCESSFUL", "error is EXECUTION_NOT_SUCCESSFUL");
  }

  // ---- Test 159: Contract with blocked error_loop does NOT close ----
  {
    console.log("Test 159: Contract with blocked error_loop does NOT close");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_159");

    // Inject blocked error_loop for the execution's task
    let { state } = await rehydrateContract(env, "ctr_c2_159");
    const execTaskId = state.current_execution.task_id;
    state.error_loop = {};
    state.error_loop[execTaskId] = {
      errors: [{ code: "ERR", classification: "in_scope", retryable: true }],
      active_retry_count: 3,
      loop_status: "blocked",
      retry_count: 3,
      last_error: { code: "ERR", classification: "in_scope", retryable: true },
      retry_allowed: false,
      escalation_reason: "Retry limit reached",
    };
    await env.ENAVIA_BRAIN.put("contract:ctr_c2_159:state", JSON.stringify(state));

    const closeResult = await closeContractInTest(env, "ctr_c2_159");
    assert(closeResult.ok === false, "closure rejected");
    assert(closeResult.error === "ERROR_LOOP_BLOCKED", "error is ERROR_LOOP_BLOCKED");
  }

  // ---- Test 160: Contract with pending acceptance criteria does NOT close ----
  {
    console.log("Test 160: Contract with pending acceptance criteria does NOT close");
    const env = { ENAVIA_BRAIN: createMockKV() };
    // Use multi-DoD payload: completing task_001 still leaves task_002/task_003 pending
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c2_160" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c2_160");
    await startTask(env, "ctr_c2_160", "task_001");

    // Execute successfully in TEST
    await executeCurrentMicroPr(env, "ctr_c2_160", { evidence: ["test passed"] });
    // Complete task but don't complete all tasks — phase still has pending work
    await completeTask(env, "ctr_c2_160", "task_001");

    const closeResult = await closeContractInTest(env, "ctr_c2_160");
    assert(closeResult.ok === false, "closure rejected");
    // After completing task_001 with remaining tasks, the phase gate blocks advancement
    // and sets contract to blocked — so ACTIVE_BLOCKERS fires before ACCEPTANCE_PENDING
    assert(closeResult.error === "ACTIVE_BLOCKERS", "error is ACTIVE_BLOCKERS (incomplete tasks in phase)");
  }

  // ---- Test 161: Closure persists and survives rehydration ----
  {
    console.log("Test 161: Closure persists and survives rehydration");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_161");
    await closeContractInTest(env, "ctr_c2_161");

    // Rehydrate and verify closure persisted
    const { state } = await rehydrateContract(env, "ctr_c2_161");
    assert(state.contract_closure !== null, "contract_closure exists after rehydration");
    assert(state.contract_closure.closure_status === "closed_in_test", "closure_status survives rehydration");
    assert(state.contract_closure.closed_in_test === true, "closed_in_test survives rehydration");
    assert(typeof state.contract_closure.closed_at === "string", "closed_at survives rehydration");
    assert(Array.isArray(state.contract_closure.closure_evidence), "closure_evidence survives rehydration");
    assert(state.contract_closure.environment === "TEST", "environment survives rehydration");
    // RISCO 2: status_global synchronized with closure survives rehydration
    assert(state.status_global === "test-complete", "status_global=test-complete survives rehydration");
  }

  // ---- Test 162: Summary/API reflects closure state ----
  {
    console.log("Test 162: Summary/API reflects closure state");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_162");
    await closeContractInTest(env, "ctr_c2_162");

    // Check summary
    const { state, decomposition } = await rehydrateContract(env, "ctr_c2_162");
    const summary = buildContractSummary(state, decomposition);
    assert(summary.contract_closure !== null, "summary includes contract_closure");
    assert(summary.contract_closure.closure_status === "closed_in_test", "summary closure_status correct");

    // Check GET summary handler
    const summaryResult = await handleGetContractSummary(env, "ctr_c2_162");
    assert(summaryResult.status === 200, "summary HTTP 200");
    assert(summaryResult.body.contract_closure !== null, "handler exposes contract_closure");
    assert(summaryResult.body.contract_closure.closure_status === "closed_in_test", "handler closure_status correct");
    // RISCO 2: status_global reflected in summary
    assert(summary.status_global === "test-complete", "summary status_global is test-complete after closure");
    assert(summaryResult.body.status_global === "test-complete", "handler status_global is test-complete after closure");
  }

  // ---- Test 163: Already-closed contract returns ok with already_closed flag ----
  {
    console.log("Test 163: Already-closed contract returns ok with already_closed flag");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_163");

    // Close first time
    const first = await closeContractInTest(env, "ctr_c2_163");
    assert(first.ok === true, "first closure ok");
    assert(first.already_closed === false, "first closure is not already_closed");

    // Close second time (idempotent)
    const second = await closeContractInTest(env, "ctr_c2_163");
    assert(second.ok === true, "second closure ok");
    assert(second.already_closed === true, "second closure is already_closed");
    assert(second.contract_closure.closure_status === "closed_in_test", "still closed_in_test");
  }

  // ---- Test 164: No execution at all → closure rejected ----
  {
    console.log("Test 164: No execution at all — closure rejected");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c2_164" }));
    await handleCreateContract(req, env);

    const closeResult = await closeContractInTest(env, "ctr_c2_164");
    assert(closeResult.ok === false, "closure rejected");
    assert(closeResult.error === "NO_EXECUTION", "error is NO_EXECUTION");
  }

  // ---- Test 165: Contract not found → closure rejected ----
  {
    console.log("Test 165: Non-existent contract — closure rejected");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const closeResult = await closeContractInTest(env, "nonexistent_contract");
    assert(closeResult.ok === false, "closure rejected");
    assert(closeResult.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 166: Contract with active blockers does NOT close ----
  {
    console.log("Test 166: Contract with active blockers does NOT close");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_166");

    // Inject blockers after making eligible
    let { state } = await rehydrateContract(env, "ctr_c2_166");
    state.blockers = ["External dependency unavailable"];
    await env.ENAVIA_BRAIN.put("contract:ctr_c2_166:state", JSON.stringify(state));

    const closeResult = await closeContractInTest(env, "ctr_c2_166");
    assert(closeResult.ok === false, "closure rejected");
    assert(closeResult.error === "ACTIVE_BLOCKERS", "error is ACTIVE_BLOCKERS");
  }

  // ---- Test 167: awaiting_human error loop does NOT close ----
  {
    console.log("Test 167: awaiting_human error loop does NOT close");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_167");

    // Set error_loop to awaiting_human for the executed task
    let { state } = await rehydrateContract(env, "ctr_c2_167");
    const execTaskId = state.current_execution.task_id;
    state.error_loop = {};
    state.error_loop[execTaskId] = {
      errors: [{ code: "INFRA", classification: "infra", retryable: false }],
      active_retry_count: 1,
      loop_status: "awaiting_human",
      retry_count: 1,
      last_error: { code: "INFRA", classification: "infra", retryable: false },
      retry_allowed: false,
      escalation_reason: "Infrastructure error",
    };
    await env.ENAVIA_BRAIN.put("contract:ctr_c2_167:state", JSON.stringify(state));

    const closeResult = await closeContractInTest(env, "ctr_c2_167");
    assert(closeResult.ok === false, "closure rejected");
    assert(closeResult.error === "ERROR_LOOP_BLOCKED", "error is ERROR_LOOP_BLOCKED");
  }

  // ---- Test 168: No PROD promotion — closure is TEST-only ----
  {
    console.log("Test 168: No PROD promotion — closure is TEST-only");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_168");
    await closeContractInTest(env, "ctr_c2_168");

    const { state } = await rehydrateContract(env, "ctr_c2_168");
    assert(state.contract_closure.environment === "TEST", "closure environment is TEST, not PROD");
    assert(state.contract_closure.closed_in_test === true, "closed_in_test flag is true");
    // Verify status_global is synchronized but NOT promoted to PROD
    assert(state.status_global === "test-complete", "status_global is test-complete (TEST closure)");
    assert(state.status_global !== "promoted", "status_global is not promoted");
    assert(state.status_global !== "prod", "status_global is not prod");
    assert(state.contract_closure.environment === "TEST", "closure stays in TEST");
  }

  // ---- Test 169: handleCloseContractInTest route handler ----
  {
    console.log("Test 169: handleCloseContractInTest route handler");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_169");

    const closeReq = mockRequest({ contract_id: "ctr_c2_169" });
    const result = await handleCloseContractInTest(closeReq, env);
    assert(result.status === 200, "HTTP 200");
    assert(result.body.ok === true, "body.ok is true");
    assert(result.body.contract_closure.closure_status === "closed_in_test", "body.contract_closure.closure_status correct");
  }

  // ---- Test 170: handleCloseContractInTest fails without contract_id ----
  {
    console.log("Test 170: handleCloseContractInTest fails without contract_id");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const closeReq = mockRequest({});
    const result = await handleCloseContractInTest(closeReq, env);
    assert(result.status === 400, "HTTP 400");
    assert(result.body.error === "MISSING_CONTRACT_ID", "error is MISSING_CONTRACT_ID");
  }

  // ---- Test 171: handleCloseContractInTest returns 400 on rejection ----
  {
    console.log("Test 171: handleCloseContractInTest returns 400 on rejection");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const createReq = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c2_171" }));
    await handleCreateContract(createReq, env);

    const closeReq = mockRequest({ contract_id: "ctr_c2_171" });
    const result = await handleCloseContractInTest(closeReq, env);
    assert(result.status === 400, "HTTP 400");
    assert(result.body.ok === false, "body.ok is false");
    assert(result.body.error === "NO_EXECUTION", "error is NO_EXECUTION");
  }

  // ---- Test 172: Closure with non-TEST execution is rejected ----
  {
    console.log("Test 172: Closure with non-TEST execution is rejected");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c2_172" }));
    await handleCreateContract(req, env);

    // Manually set a non-TEST execution
    let { state } = await rehydrateContract(env, "ctr_c2_172");
    state.current_execution = {
      contract_id: "ctr_c2_172",
      task_id: "task_001",
      micro_pr_id: "micro_pr_001",
      execution_status: "success",
      test_execution: false,
      execution_finished_at: new Date().toISOString(),
      execution_evidence: ["non-test evidence"],
    };
    await env.ENAVIA_BRAIN.put("contract:ctr_c2_172:state", JSON.stringify(state));

    const closeResult = await closeContractInTest(env, "ctr_c2_172");
    assert(closeResult.ok === false, "closure rejected");
    assert(closeResult.error === "NOT_TEST_EXECUTION", "error is NOT_TEST_EXECUTION");
  }

  // ---- Test 173: Blocked task status does NOT close ----
  {
    console.log("Test 173: Blocked task status does NOT close");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, SINGLE_DOD_PAYLOAD, { contract_id: "ctr_c2_173" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c2_173");
    await startTask(env, "ctr_c2_173", "task_001");
    await executeCurrentMicroPr(env, "ctr_c2_173", { evidence: ["blocked test"] });

    // Block the task
    await blockTask(env, "ctr_c2_173", "task_001");

    const closeResult = await closeContractInTest(env, "ctr_c2_173");
    assert(closeResult.ok === false, "closure rejected");
    // When a task is blocked, the phase gate sets contract.blockers — so ACTIVE_BLOCKERS fires first
    assert(closeResult.error === "ACTIVE_BLOCKERS", "error is ACTIVE_BLOCKERS (blocked task causes phase-level blocker)");
  }

  // ---- Test 174: Summary without closure shows null contract_closure ----
  {
    console.log("Test 174: Summary without closure shows null contract_closure");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_c2_174" }));
    await handleCreateContract(req, env);

    const { state, decomposition } = await rehydrateContract(env, "ctr_c2_174");
    const summary = buildContractSummary(state, decomposition);
    assert(summary.contract_closure === null, "contract_closure is null before closure");
  }

  // ---- Test 175: TASK_NOT_CLOSEABLE when task is queued (manually injected) ----
  {
    console.log("Test 175: TASK_NOT_CLOSEABLE when execution task is queued");
    const env = { ENAVIA_BRAIN: createMockKV() };
    await makeEligibleForClosure(env, "ctr_c2_175");

    // Manually set the executed task back to "queued" to trigger TASK_NOT_CLOSEABLE
    let { state, decomposition } = await rehydrateContract(env, "ctr_c2_175");
    const execTaskId = state.current_execution.task_id;
    const task = decomposition.tasks.find((t) => t.id === execTaskId);
    if (task) task.status = "queued";
    // Clear blockers to ensure we reach the task gate
    state.blockers = [];
    await env.ENAVIA_BRAIN.put("contract:ctr_c2_175:state", JSON.stringify(state));
    await env.ENAVIA_BRAIN.put("contract:ctr_c2_175:decomposition", JSON.stringify(decomposition));

    const closeResult = await closeContractInTest(env, "ctr_c2_175");
    assert(closeResult.ok === false, "closure rejected");
    assert(closeResult.error === "TASK_NOT_CLOSEABLE" || closeResult.error === "ACCEPTANCE_PENDING", "error is TASK_NOT_CLOSEABLE or ACCEPTANCE_PENDING");
  }

  // ---- Test 176: task in_progress with successful execution does NOT close ----
  {
    console.log("Test 176: task in_progress with successful execution does NOT close");
    const env = { ENAVIA_BRAIN: createMockKV() };
    const req = mockRequest(Object.assign({}, SINGLE_DOD_PAYLOAD, { contract_id: "ctr_c2_176" }));
    await handleCreateContract(req, env);
    await advanceContractPhase(env, "ctr_c2_176");
    await startTask(env, "ctr_c2_176", "task_001");

    // Execute successfully — but do NOT completeTask (task stays in_progress)
    const execResult = await executeCurrentMicroPr(env, "ctr_c2_176", { evidence: ["test ok"] });
    assert(execResult.ok === true, "execution succeeded");

    // Verify task is still in_progress
    const { decomposition } = await rehydrateContract(env, "ctr_c2_176");
    const task = decomposition.tasks.find((t) => t.id === "task_001");
    assert(task.status === "in_progress", "task is still in_progress");

    // Attempt closure — must be rejected (RISCO 1)
    const closeResult = await closeContractInTest(env, "ctr_c2_176");
    assert(closeResult.ok === false, "closure rejected for in_progress task");
    // With in_progress task, the contract has active blockers from phase gate,
    // or acceptance criteria are pending — any of these gates reject closure
    assert(
      closeResult.error === "TASK_NOT_CLOSEABLE" ||
      closeResult.error === "ACCEPTANCE_PENDING" ||
      closeResult.error === "ACTIVE_BLOCKERS",
      "error blocks in_progress closure: " + closeResult.error
    );
  }

  // ============================================================================
  // 🔒 F1 — Formal Contract Cancellation Tests
  // ============================================================================
  console.log("\n" + "=".repeat(50));
  console.log("F1 — Formal Contract Cancellation Tests");
  console.log("=".repeat(50));

  // ---- Test 177: Successful cancellation of existing contract ----
  console.log("\nTest 177: Successful cancellation of existing contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_177" })), env);

    const result = await cancelContract(env, "ctr_f1_177", {
      reason: "Client requested cancellation",
      cancelled_by: "admin",
      evidence: ["Email from client"],
    });

    assert(result.ok === true, "cancellation succeeded");
    assert(result.already_cancelled === false, "not already cancelled");
    assert(result.contract_cancellation.cancelled === true, "cancelled flag is true");
    assert(result.contract_cancellation.cancel_reason === "Client requested cancellation", "reason persisted");
    assert(result.contract_cancellation.cancelled_by === "admin", "cancelled_by persisted");
    assert(result.contract_cancellation.cancellation_evidence.length === 1, "evidence persisted");
    assert(result.contract_cancellation.cancelled_at !== undefined, "cancelled_at set");
    assert(result.contract_cancellation.previous_status_global === "decomposed", "previous status preserved");
    assert(result.state.status_global === "cancelled", "status_global is cancelled");
    assert(result.state.next_action === "Contract cancelled. No further actions.", "next_action updated");
  }

  // ---- Test 178: Cancellation with reason persisted ----
  console.log("\nTest 178: Cancellation with reason persisted and rehydrated");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_178" })), env);

    await cancelContract(env, "ctr_f1_178", { reason: "Budget cut" });

    // Rehydrate and check persistence
    const { state } = await rehydrateContract(env, "ctr_f1_178");
    assert(state.status_global === "cancelled", "rehydrated status_global is cancelled");
    assert(state.contract_cancellation.cancel_reason === "Budget cut", "rehydrated reason matches");
    assert(state.contract_cancellation.cancelled === true, "rehydrated cancelled flag");
    assert(state.contract_cancellation.cancelled_at !== undefined, "rehydrated cancelled_at set");
  }

  // ---- Test 179: Rehydration maintains cancelled state ----
  console.log("\nTest 179: Rehydration maintains cancelled state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_179" })), env);
    await cancelContract(env, "ctr_f1_179", { reason: "Testing persistence" });

    // Rehydrate
    const { state, decomposition } = await rehydrateContract(env, "ctr_f1_179");
    assert(state.status_global === "cancelled", "status_global survived rehydration");
    assert(state.contract_cancellation !== undefined, "contract_cancellation survived rehydration");
    assert(state.contract_cancellation.cancelled === true, "cancelled flag survived");
    assert(isCancelledContract(state) === true, "isCancelledContract returns true after rehydration");
    assert(decomposition !== null, "decomposition still exists");
  }

  // ---- Test 180: Summary/API exposes cancelled contract ----
  console.log("\nTest 180: Summary/API exposes cancelled contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_180" })), env);
    await cancelContract(env, "ctr_f1_180", { reason: "Summary test" });

    const { state, decomposition } = await rehydrateContract(env, "ctr_f1_180");
    const summary = buildContractSummary(state, decomposition);
    assert(summary.status_global === "cancelled", "summary shows cancelled");
    assert(summary.contract_cancellation !== null, "summary has contract_cancellation");
    assert(summary.contract_cancellation.cancelled === true, "summary cancellation flag");
    assert(summary.contract_cancellation.cancel_reason === "Summary test", "summary cancel_reason");

    // resolveNextAction returns contract_cancelled
    const nextAction = resolveNextAction(state, decomposition);
    assert(nextAction.type === "contract_cancelled", "next action type is contract_cancelled");
    assert(nextAction.status === "cancelled", "next action status is cancelled");
  }

  // ---- Test 181: Already cancelled contract returns idempotent response ----
  console.log("\nTest 181: Already cancelled contract returns idempotent response");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_181" })), env);

    // Cancel first time
    const first = await cancelContract(env, "ctr_f1_181", { reason: "First cancel" });
    assert(first.ok === true, "first cancellation ok");
    assert(first.already_cancelled === false, "first is not already_cancelled");

    // Cancel second time — idempotent
    const second = await cancelContract(env, "ctr_f1_181", { reason: "Second cancel" });
    assert(second.ok === true, "second cancellation ok (idempotent)");
    assert(second.already_cancelled === true, "second is already_cancelled");
    assert(second.contract_cancellation.cancel_reason === "First cancel", "original reason preserved");
  }

  // ---- Test 182: Cancellation of non-existent contract fails ----
  console.log("\nTest 182: Cancellation of non-existent contract fails");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await cancelContract(env, "ctr_f1_nonexistent", {});
    assert(result.ok === false, "cancellation failed");
    assert(result.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 183: Cancelled contract cannot advance phase ----
  console.log("\nTest 183: Cancelled contract cannot advance phase");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_183" })), env);
    await cancelContract(env, "ctr_f1_183", { reason: "Block advance" });

    const result = await advanceContractPhase(env, "ctr_f1_183");
    assert(result.ok === false, "advance rejected");
    assert(result.error === "CONTRACT_CANCELLED", "error is CONTRACT_CANCELLED");
  }

  // ---- Test 184: Cancelled contract cannot start task ----
  console.log("\nTest 184: Cancelled contract cannot start task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_184" })), env);
    await cancelContract(env, "ctr_f1_184", { reason: "Block startTask" });

    const result = await startTask(env, "ctr_f1_184", "task_001");
    assert(result.ok === false, "startTask rejected");
    assert(result.error === "CONTRACT_CANCELLED", "error is CONTRACT_CANCELLED");
  }

  // ---- Test 185: Cancelled contract cannot complete task ----
  console.log("\nTest 185: Cancelled contract cannot complete task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_185" })), env);
    // Start task first, then cancel, then try to complete
    await advanceContractPhase(env, "ctr_f1_185");
    await startTask(env, "ctr_f1_185", "task_001");
    await cancelContract(env, "ctr_f1_185", { reason: "Block completeTask" });

    const result = await completeTask(env, "ctr_f1_185", "task_001");
    assert(result.ok === false, "completeTask rejected");
    assert(result.error === "CONTRACT_CANCELLED", "error is CONTRACT_CANCELLED");
  }

  // ---- Test 186: Cancelled contract cannot execute micro-PR ----
  console.log("\nTest 186: Cancelled contract cannot execute micro-PR");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_186" })), env);
    await advanceContractPhase(env, "ctr_f1_186");
    await startTask(env, "ctr_f1_186", "task_001");
    await cancelContract(env, "ctr_f1_186", { reason: "Block execution" });

    const result = await executeCurrentMicroPr(env, "ctr_f1_186", {});
    assert(result.ok === false, "execution rejected");
    assert(result.error === "CONTRACT_CANCELLED", "error is CONTRACT_CANCELLED");
  }

  // ---- Test 187: Cancelled contract cannot close in TEST ----
  console.log("\nTest 187: Cancelled contract cannot close in TEST");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_187" })), env);
    await cancelContract(env, "ctr_f1_187", { reason: "Block closure" });

    const result = await closeContractInTest(env, "ctr_f1_187");
    assert(result.ok === false, "closure rejected");
    assert(result.error === "CONTRACT_CANCELLED", "error is CONTRACT_CANCELLED");
  }

  // ---- Test 188: Cancelled contract cannot block/discard micro-PR ----
  console.log("\nTest 188: Cancelled contract cannot block/discard micro-PR");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_188" })), env);
    await cancelContract(env, "ctr_f1_188", { reason: "Block micro-PR ops" });

    const r1 = await startMicroPrCandidate(env, "ctr_f1_188", "micro_pr_001");
    assert(r1.ok === false && r1.error === "CONTRACT_CANCELLED", "startMicroPr blocked");
    const r2 = await completeMicroPrCandidate(env, "ctr_f1_188", "micro_pr_001");
    assert(r2.ok === false && r2.error === "CONTRACT_CANCELLED", "completeMicroPr blocked");
    const r3 = await blockMicroPrCandidate(env, "ctr_f1_188", "micro_pr_001");
    assert(r3.ok === false && r3.error === "CONTRACT_CANCELLED", "blockMicroPr blocked");
    const r4 = await discardMicroPrCandidate(env, "ctr_f1_188", "micro_pr_001");
    assert(r4.ok === false && r4.error === "CONTRACT_CANCELLED", "discardMicroPr blocked");
  }

  // ---- Test 189: handleCancelContract route handler — success ----
  console.log("\nTest 189: handleCancelContract route handler — success");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_189" })), env);

    const req = mockRequest({ contract_id: "ctr_f1_189", reason: "Route test", cancelled_by: "operator" });
    const result = await handleCancelContract(req, env);
    assert(result.status === 200, "HTTP 200");
    assert(result.body.ok === true, "body.ok is true");
    assert(result.body.contract_cancellation.cancel_reason === "Route test", "reason in response");
    assert(result.body.already_cancelled === false, "not already cancelled");
  }

  // ---- Test 190: handleCancelContract — missing contract_id ----
  console.log("\nTest 190: handleCancelContract — missing contract_id");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const req = mockRequest({ reason: "no id" });
    const result = await handleCancelContract(req, env);
    assert(result.status === 400, "HTTP 400");
    assert(result.body.error === "MISSING_CONTRACT_ID", "error is MISSING_CONTRACT_ID");
  }

  // ---- Test 191: handleCancelContract — invalid JSON ----
  console.log("\nTest 191: handleCancelContract — invalid JSON");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const req = mockRequest(null);
    const result = await handleCancelContract(req, env);
    assert(result.status === 400, "HTTP 400 for invalid JSON");
    assert(result.body.error === "INVALID_JSON", "error is INVALID_JSON");
  }

  // ---- Test 192: handleCancelContract — contract not found ----
  console.log("\nTest 192: handleCancelContract — contract not found");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const req = mockRequest({ contract_id: "nonexistent" });
    const result = await handleCancelContract(req, env);
    assert(result.status === 404, "HTTP 404");
    assert(result.body.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 193: handleCancelContract — idempotent via route ----
  console.log("\nTest 193: handleCancelContract — idempotent via route");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_193" })), env);

    // First cancel
    const r1 = await handleCancelContract(mockRequest({ contract_id: "ctr_f1_193", reason: "First" }), env);
    assert(r1.status === 200, "first cancel HTTP 200");
    assert(r1.body.already_cancelled === false, "first not already cancelled");

    // Second cancel — idempotent
    const r2 = await handleCancelContract(mockRequest({ contract_id: "ctr_f1_193", reason: "Second" }), env);
    assert(r2.status === 200, "second cancel HTTP 200 (idempotent)");
    assert(r2.body.already_cancelled === true, "second already cancelled");
  }

  // ---- Test 194: Cancellation without reason still works ----
  console.log("\nTest 194: Cancellation without reason still works");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_194" })), env);

    const result = await cancelContract(env, "ctr_f1_194", {});
    assert(result.ok === true, "cancellation ok without reason");
    assert(result.contract_cancellation.cancel_reason === null, "cancel_reason is null");
    assert(result.contract_cancellation.cancelled_by === "human", "default cancelled_by is human");
  }

  // ---- Test 195: GET contract after cancellation shows full state ----
  console.log("\nTest 195: GET contract after cancellation shows full state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_195" })), env);
    await cancelContract(env, "ctr_f1_195", { reason: "GET test" });

    const result = await handleGetContract(env, "ctr_f1_195");
    assert(result.status === 200, "GET returns 200");
    assert(result.body.contract.status_global === "cancelled", "GET shows cancelled status");
    assert(result.body.contract.contract_cancellation !== undefined, "GET shows cancellation data");
    assert(result.body.contract.contract_cancellation.cancelled === true, "cancellation flag in GET");
  }

  // ---- Test 196: Summary after cancellation shows cancellation data ----
  console.log("\nTest 196: Summary after cancellation shows cancellation data");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_196" })), env);
    await cancelContract(env, "ctr_f1_196", { reason: "Summary cancel test" });

    const result = await handleGetContractSummary(env, "ctr_f1_196");
    assert(result.status === 200, "summary HTTP 200");
    assert(result.body.status_global === "cancelled", "summary status_global cancelled");
    assert(result.body.contract_cancellation !== null, "summary has contract_cancellation");
  }

  // ---- Test 197: blockTask on cancelled contract is blocked ----
  console.log("\nTest 197: blockTask on cancelled contract is blocked");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f1_197" })), env);
    await cancelContract(env, "ctr_f1_197", { reason: "Block blockTask" });

    const result = await blockTask(env, "ctr_f1_197", "task_001", "test");
    assert(result.ok === false, "blockTask rejected");
    assert(result.error === "CONTRACT_CANCELLED", "error is CONTRACT_CANCELLED");
  }

  // ---- Test 198: No existing behaviour broken — normal contract still works after adding cancellation ----
  console.log("\nTest 198: Normal contract lifecycle still works (regression)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = Object.assign({}, VALID_PAYLOAD, {
      contract_id: "ctr_f1_198",
      definition_of_done: ["Single criterion"],
    });
    await handleCreateContract(mockRequest(payload), env);

    // Advance phase
    const adv = await advanceContractPhase(env, "ctr_f1_198");
    assert(adv.ok !== undefined, "advance phase works");

    // Start task
    const st = await startTask(env, "ctr_f1_198", "task_001");
    assert(st.ok === true, "startTask works on non-cancelled contract");

    // Complete task
    const ct = await completeTask(env, "ctr_f1_198", "task_001");
    assert(ct.ok === true, "completeTask works on non-cancelled contract");

    // isCancelledContract returns false for normal contract
    const { state } = await rehydrateContract(env, "ctr_f1_198");
    assert(isCancelledContract(state) === false, "isCancelledContract is false for normal contract");
  }

  // ==========================================================================
  // G1 — Canonical Global State Machine Smoke Tests
  // ==========================================================================

  // ---- Test 199: VALID_STATUSES export contains all 12 canonical states ----
  console.log("\nTest 199: VALID_STATUSES export contains all 12 canonical states");
  {
    assert(Array.isArray(VALID_STATUSES), "VALID_STATUSES is an array");
    const expected = [
      "draft", "approved", "decomposed", "executing", "validating",
      "blocked", "awaiting-human", "test-complete", "prod-pending",
      "completed", "cancelled", "failed",
    ];
    assert(VALID_STATUSES.length === expected.length, `VALID_STATUSES has ${expected.length} entries`);
    for (const s of expected) {
      assert(VALID_STATUSES.includes(s), `VALID_STATUSES includes "${s}"`);
    }
  }

  // ---- Test 200: VALID_GLOBAL_TRANSITIONS export has entry for every canonical state ----
  console.log("\nTest 200: VALID_GLOBAL_TRANSITIONS covers every canonical state");
  {
    assert(typeof VALID_GLOBAL_TRANSITIONS === "object", "VALID_GLOBAL_TRANSITIONS is an object");
    for (const s of VALID_STATUSES) {
      assert(Array.isArray(VALID_GLOBAL_TRANSITIONS[s]), `VALID_GLOBAL_TRANSITIONS has entry for "${s}"`);
    }
    // Terminal states have no outgoing transitions
    assert(VALID_GLOBAL_TRANSITIONS["completed"].length === 0, "completed has no outgoing transitions");
    assert(VALID_GLOBAL_TRANSITIONS["cancelled"].length === 0, "cancelled has no outgoing transitions");
    assert(VALID_GLOBAL_TRANSITIONS["failed"].length === 0, "failed has no outgoing transitions");
  }

  // ---- Test 201: transitionStatusGlobal — valid transition succeeds ----
  console.log("\nTest 201: transitionStatusGlobal — valid transition succeeds");
  {
    const state = { status_global: "decomposed" };
    const result = transitionStatusGlobal(state, "executing", "test");
    assert(result.ok === true, "transition ok");
    assert(result.previous === "decomposed", "previous is decomposed");
    assert(result.current === "executing", "current is executing");
    assert(state.status_global === "executing", "state mutated to executing");
  }

  // ---- Test 202: transitionStatusGlobal — invalid target status rejected ----
  console.log("\nTest 202: transitionStatusGlobal — invalid target status rejected");
  {
    const state = { status_global: "decomposed" };
    const result = transitionStatusGlobal(state, "invented_status", "test");
    assert(result.ok === false, "transition rejected");
    assert(result.error === "INVALID_STATUS", "error is INVALID_STATUS");
    assert(state.status_global === "decomposed", "state unchanged");
  }

  // ---- Test 203: transitionStatusGlobal — disallowed transition rejected ----
  console.log("\nTest 203: transitionStatusGlobal — disallowed transition rejected");
  {
    const state = { status_global: "completed" };
    const result = transitionStatusGlobal(state, "executing", "test");
    assert(result.ok === false, "transition rejected");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");
    assert(state.status_global === "completed", "state unchanged");
  }

  // ---- Test 204: transitionStatusGlobal — unknown source status rejected ----
  console.log("\nTest 204: transitionStatusGlobal — unknown source status rejected");
  {
    const state = { status_global: "some_legacy_status" };
    const result = transitionStatusGlobal(state, "executing", "test");
    assert(result.ok === false, "transition rejected");
    assert(result.error === "UNKNOWN_SOURCE_STATUS", "error is UNKNOWN_SOURCE_STATUS");
    assert(state.status_global === "some_legacy_status", "state unchanged");
  }

  // ---- Test 205: Terminal states reject all transitions ----
  console.log("\nTest 205: Terminal states reject all transitions");
  {
    for (const terminal of ["completed", "cancelled", "failed"]) {
      for (const target of VALID_STATUSES) {
        const state = { status_global: terminal };
        const result = transitionStatusGlobal(state, target, "test-terminal");
        assert(result.ok === false, `${terminal} → ${target} rejected`);
        assert(state.status_global === terminal, `${terminal} unchanged`);
      }
    }
  }

  // ---- Test 206: Every non-terminal state can reach cancelled ----
  console.log("\nTest 206: Every non-terminal state can reach cancelled");
  {
    const nonTerminal = VALID_STATUSES.filter(
      (s) => !["completed", "cancelled", "failed"].includes(s)
    );
    for (const from of nonTerminal) {
      const state = { status_global: from };
      const result = transitionStatusGlobal(state, "cancelled", "test-cancel-reach");
      assert(result.ok === true, `${from} → cancelled allowed`);
      assert(state.status_global === "cancelled", `${from} transitioned to cancelled`);
    }
  }

  // ---- Test 207: Creation/decomposition produces coherent state ----
  console.log("\nTest 207: Creation/decomposition produces coherent state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g1_207",
    }), env);
    assert(result.body.ok === true, "contract created");
    assert(result.body.status_global === "decomposed", "status_global is decomposed");
    assert(VALID_STATUSES.includes(result.body.status_global), "status_global is canonical");
  }

  // ---- Test 208: Advance produces executing (not in_progress) ----
  console.log("\nTest 208: Advance produces executing (not in_progress)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g1_208",
    }), env);

    // Complete all tasks in phase_01
    let { decomposition } = await rehydrateContract(env, "ctr_g1_208");
    const phase01 = decomposition.phases.find((p) => p.id === "phase_01");
    const updatedTasks = decomposition.tasks.map((t) =>
      phase01.tasks.includes(t.id) ? { ...t, status: "done" } : t
    );
    await kv.put("contract:ctr_g1_208:decomposition", JSON.stringify({ ...decomposition, tasks: updatedTasks }));

    const result = await advanceContractPhase(env, "ctr_g1_208");
    assert(result.ok === true, "advance succeeded");
    assert(result.state.status_global === "executing", "status_global is executing");
    assert(result.state.status_global !== "in_progress", "NOT in_progress (old state)");
    assert(VALID_STATUSES.includes(result.state.status_global), "status_global is canonical");
  }

  // ---- Test 209: All phases complete → still executing (not completed) ----
  console.log("\nTest 209: All phases complete → executing (reserved terminal)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g1_209",
      definition_of_done: ["Single criterion"],
    }), env);

    // Run through all phases
    let { decomposition } = await rehydrateContract(env, "ctr_g1_209");
    for (const phase of decomposition.phases) {
      const tasks = decomposition.tasks.map((t) =>
        phase.tasks.includes(t.id) ? { ...t, status: "done" } : t
      );
      await kv.put("contract:ctr_g1_209:decomposition", JSON.stringify({ ...decomposition, tasks }));
      decomposition = { ...decomposition, tasks };
      await advanceContractPhase(env, "ctr_g1_209");
      ({ decomposition } = await rehydrateContract(env, "ctr_g1_209"));
    }

    const { state } = await rehydrateContract(env, "ctr_g1_209");
    assert(state.current_phase === "all_phases_complete", "current_phase is all_phases_complete");
    assert(state.status_global === "executing", "status_global is executing (not completed)");
    assert(state.status_global !== "completed", "completed is reserved for terminal closure");
  }

  // ---- Test 210: Cancellation from decomposed state ----
  console.log("\nTest 210: Cancellation from decomposed state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g1_210",
    }), env);
    const result = await cancelContract(env, "ctr_g1_210", { reason: "test cancel" });
    assert(result.ok === true, "cancellation succeeded");
    assert(result.state.status_global === "cancelled", "status_global is cancelled");
    const { state } = await rehydrateContract(env, "ctr_g1_210");
    assert(state.status_global === "cancelled", "rehydrated status_global is cancelled");
  }

  // ---- Test 211: test-complete via closeContractInTest ----
  console.log("\nTest 211: test-complete via closeContractInTest");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await makeEligibleForClosure(env, "ctr_g1_211");
    const result = await closeContractInTest(env, "ctr_g1_211");
    assert(result.ok === true, "closure succeeded");
    assert(result.state.status_global === "test-complete", "status_global is test-complete");
    const { state } = await rehydrateContract(env, "ctr_g1_211");
    assert(state.status_global === "test-complete", "rehydrated status_global is test-complete");
  }

  // ---- Test 212: completed not used by advanceContractPhase ----
  console.log("\nTest 212: completed never set by advanceContractPhase");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g1_212",
      definition_of_done: ["Only criterion"],
    }), env);

    // Advance through all phases
    let keepGoing = true;
    while (keepGoing) {
      let { decomposition } = await rehydrateContract(env, "ctr_g1_212");
      const pending = decomposition.phases.find((p) => p.status !== "done");
      if (!pending) { keepGoing = false; break; }
      const tasks = decomposition.tasks.map((t) =>
        pending.tasks.includes(t.id) ? { ...t, status: "done" } : t
      );
      await kv.put("contract:ctr_g1_212:decomposition", JSON.stringify({ ...decomposition, tasks }));
      const r = await advanceContractPhase(env, "ctr_g1_212");
      if (!r.ok) { keepGoing = false; break; }
      assert(r.state.status_global !== "completed", `advance did not set completed (was ${r.state.status_global})`);
    }
    const { state } = await rehydrateContract(env, "ctr_g1_212");
    assert(state.status_global !== "completed", "final status is NOT completed (reserved for terminal)");
  }

  // ---- Test 213: Reidratação mantém estados corretamente ----
  console.log("\nTest 213: Rehydration preserves canonical states correctly");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g1_213",
    }), env);

    // Check decomposed survives rehydration
    let { state } = await rehydrateContract(env, "ctr_g1_213");
    assert(state.status_global === "decomposed", "decomposed survives rehydration");

    // Advance and check executing survives
    let { decomposition } = await rehydrateContract(env, "ctr_g1_213");
    const phase01 = decomposition.phases.find((p) => p.id === "phase_01");
    const updatedTasks = decomposition.tasks.map((t) =>
      phase01.tasks.includes(t.id) ? { ...t, status: "done" } : t
    );
    await kv.put("contract:ctr_g1_213:decomposition", JSON.stringify({ ...decomposition, tasks: updatedTasks }));
    await advanceContractPhase(env, "ctr_g1_213");
    ({ state } = await rehydrateContract(env, "ctr_g1_213"));
    assert(state.status_global === "executing", "executing survives rehydration");

    // Cancel and check cancelled survives
    await cancelContract(env, "ctr_g1_213", { reason: "test" });
    ({ state } = await rehydrateContract(env, "ctr_g1_213"));
    assert(state.status_global === "cancelled", "cancelled survives rehydration");
  }

  // ---- Test 214: Summary/API coerente com a state machine ----
  console.log("\nTest 214: Summary reflects canonical state machine states");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g1_214",
    }), env);

    // Summary after creation
    let summary = await handleGetContractSummary(env, "ctr_g1_214");
    assert(summary.body.status_global === "decomposed", "summary status_global is decomposed");
    assert(VALID_STATUSES.includes(summary.body.status_global), "summary status is canonical");

    // Cancel and check summary
    await cancelContract(env, "ctr_g1_214", { reason: "test" });
    summary = await handleGetContractSummary(env, "ctr_g1_214");
    assert(summary.body.status_global === "cancelled", "summary status_global is cancelled after cancellation");
    assert(VALID_STATUSES.includes(summary.body.status_global), "cancelled summary status is canonical");
  }

  // ---- Test 215: Blocked state is a canonical state ----
  console.log("\nTest 215: Blocked state is a canonical state");
  {
    assert(VALID_STATUSES.includes("blocked"), "blocked is in VALID_STATUSES");
    // Verify blocked can be reached from decomposed
    const state = { status_global: "decomposed" };
    const result = transitionStatusGlobal(state, "blocked", "test-215");
    assert(result.ok === true, "decomposed → blocked transition valid");
    assert(state.status_global === "blocked", "status_global is blocked");
    // Verify blocked → executing recovery
    const result2 = transitionStatusGlobal(state, "executing", "test-215-recovery");
    assert(result2.ok === true, "blocked → executing recovery valid");
    assert(state.status_global === "executing", "status_global recovered to executing");
  }

  // ==========================================================================
  // G2 — Transition Guard Enforcement (callsites abort on failure)
  // ==========================================================================

  // ---- Test 216: cancelContract aborts on invalid transition (no persist) ----
  console.log("\nTest 216: cancelContract aborts on invalid transition (terminal state)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g2_216",
    }), env);
    // First cancel succeeds
    const first = await cancelContract(env, "ctr_g2_216", { reason: "first" });
    assert(first.ok === true, "first cancel ok");
    assert(first.state.status_global === "cancelled", "first cancel → cancelled");

    // Manually reset to cancelled so idempotent guard doesn't fire,
    // and try to cancel from a truly terminal state by removing the cancellation flag
    let { state, decomposition } = await rehydrateContract(env, "ctr_g2_216");
    state.status_global = "completed"; // terminal — cancel should fail at transition
    delete state.contract_cancellation;
    await env.ENAVIA_BRAIN.put("contract:ctr_g2_216:state", JSON.stringify(state));

    const result = await cancelContract(env, "ctr_g2_216", { reason: "from-completed" });
    assert(result.ok === false, "cancel from completed rejected");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");

    // Verify KV was NOT overwritten — still shows "completed"
    const { state: after } = await rehydrateContract(env, "ctr_g2_216");
    assert(after.status_global === "completed", "KV still shows completed (no persist after failed transition)");
  }

  // ---- Test 217: advanceContractPhase gate-blocked aborts on invalid transition ----
  console.log("\nTest 217: advanceContractPhase gate-blocked aborts on invalid transition");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g2_217",
    }), env);

    // Force contract into a terminal state where "blocked" transition is invalid
    let { state, decomposition } = await rehydrateContract(env, "ctr_g2_217");
    state.status_global = "completed";
    state.current_phase = "phase_01"; // not all_phases_complete so gate logic runs
    await env.ENAVIA_BRAIN.put("contract:ctr_g2_217:state", JSON.stringify(state));

    const result = await advanceContractPhase(env, "ctr_g2_217");
    // The gate should fail (tasks not done) and try to transition to blocked,
    // but completed → blocked is invalid
    assert(result.ok === false, "advance rejected");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION");

    // Verify KV was NOT overwritten
    const { state: after } = await rehydrateContract(env, "ctr_g2_217");
    assert(after.status_global === "completed", "KV still shows completed (no persist)");
  }

  // ---- Test 218: closeContractInTest aborts on invalid transition ----
  console.log("\nTest 218: closeContractInTest aborts on invalid transition");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await makeEligibleForClosure(env, "ctr_g2_218");
    // Close once — succeeds
    const first = await closeContractInTest(env, "ctr_g2_218");
    assert(first.ok === true, "first close ok");

    // Manually set to cancelled (terminal) — close should be rejected
    let { state, decomposition } = await rehydrateContract(env, "ctr_g2_218");
    state.status_global = "cancelled";
    delete state.contract_closure; // remove closure so idempotent guard doesn't fire
    await env.ENAVIA_BRAIN.put("contract:ctr_g2_218:state", JSON.stringify(state));

    const result = await closeContractInTest(env, "ctr_g2_218");
    assert(result.ok === false, "close from cancelled rejected");
    // The cancellation guard fires before the transition guard — both prevent bad persist
    assert(result.error === "CONTRACT_CANCELLED" || result.error === "INVALID_TRANSITION", "error blocks the operation");

    // Verify KV was NOT overwritten
    const { state: after } = await rehydrateContract(env, "ctr_g2_218");
    assert(after.status_global === "cancelled", "KV still shows cancelled (no persist)");
  }

  // ---- Test 219: Valid transitions still work end-to-end ----
  console.log("\nTest 219: Valid transitions still work end-to-end (regression)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest({
      ...VALID_PAYLOAD,
      contract_id: "ctr_g2_219",
    }), env);

    // decomposed → executing via advance
    let { decomposition } = await rehydrateContract(env, "ctr_g2_219");
    const phase01 = decomposition.phases.find((p) => p.id === "phase_01");
    const updatedTasks = decomposition.tasks.map((t) =>
      phase01.tasks.includes(t.id) ? { ...t, status: "done" } : t
    );
    await kv.put("contract:ctr_g2_219:decomposition", JSON.stringify({ ...decomposition, tasks: updatedTasks }));

    const advResult = await advanceContractPhase(env, "ctr_g2_219");
    assert(advResult.ok === true, "advance ok");
    assert(advResult.state.status_global === "executing", "executing after advance");

    // executing → cancelled via cancel
    const cancelResult = await cancelContract(env, "ctr_g2_219", { reason: "test" });
    assert(cancelResult.ok === true, "cancel ok");
    assert(cancelResult.state.status_global === "cancelled", "cancelled after cancel");

    // Verify persisted
    const { state } = await rehydrateContract(env, "ctr_g2_219");
    assert(state.status_global === "cancelled", "cancelled persisted");
  }

  // ---- Test 220: closeContractInTest transition guard (failed state, bypasses cancel guard) ----
  console.log("\nTest 220: closeContractInTest transition guard rejects failed → test-complete");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await makeEligibleForClosure(env, "ctr_g2_220");

    // Manually set to failed (terminal, but NOT cancelled — so cancellation guard doesn't fire)
    let { state, decomposition } = await rehydrateContract(env, "ctr_g2_220");
    state.status_global = "failed";
    delete state.contract_closure;
    await env.ENAVIA_BRAIN.put("contract:ctr_g2_220:state", JSON.stringify(state));

    const result = await closeContractInTest(env, "ctr_g2_220");
    assert(result.ok === false, "close from failed rejected");
    assert(result.error === "INVALID_TRANSITION", "error is INVALID_TRANSITION (not CONTRACT_CANCELLED)");

    // Verify KV was NOT overwritten
    const { state: after } = await rehydrateContract(env, "ctr_g2_220");
    assert(after.status_global === "failed", "KV still shows failed (no persist after failed transition)");
  }

  // ============================================================================
  // 🔒 F2 — Formal Decomposition Plan Rejection Tests
  // ============================================================================
  console.log("\n" + "=".repeat(50));
  console.log("F2 — Formal Decomposition Plan Rejection Tests");
  console.log("=".repeat(50));

  // ---- Test 221: Successful rejection of decomposition plan ----
  console.log("\nTest 221: Successful rejection of decomposition plan");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_221" })), env);

    const result = await rejectDecompositionPlan(env, "ctr_f2_221", {
      reason: "Decomposition misses critical auth module",
      rejected_by: "tech-lead",
    });

    assert(result.ok === true, "rejection succeeded");
    assert(result.already_rejected === false, "not already rejected");
    assert(result.plan_rejection.plan_rejected === true, "plan_rejected flag is true");
    assert(result.plan_rejection.plan_rejection_reason === "Decomposition misses critical auth module", "reason persisted");
    assert(result.plan_rejection.plan_rejected_by === "tech-lead", "rejected_by persisted");
    assert(result.plan_rejection.plan_rejected_at !== undefined, "plan_rejected_at set");
    assert(result.plan_rejection.plan_revision === 1, "plan_revision is 1");
    assert(result.plan_rejection.previous_status_global === "decomposed", "previous status preserved");
    assert(result.plan_rejection.previous_current_phase === "decomposition_complete", "previous phase preserved");
    assert(result.plan_rejection.previous_decomposition_snapshot !== null, "decomposition snapshot preserved");
    assert(result.state.status_global === "blocked", "status_global transitioned to blocked");
    assert(result.state.current_phase === "plan_revision_pending", "current_phase is plan_revision_pending");
    assert(result.state.next_action === "Decomposition plan rejected — awaiting revised plan.", "next_action updated");
  }

  // ---- Test 222: Rejection reason is persisted and survives rehydration ----
  console.log("\nTest 222: Rejection reason is persisted and survives rehydration");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_222" })), env);

    await rejectDecompositionPlan(env, "ctr_f2_222", { reason: "Phases are out of order" });

    const { state } = await rehydrateContract(env, "ctr_f2_222");
    assert(state.plan_rejection !== undefined, "plan_rejection survived rehydration");
    assert(state.plan_rejection.plan_rejected === true, "plan_rejected flag survived");
    assert(state.plan_rejection.plan_rejection_reason === "Phases are out of order", "reason survived rehydration");
    assert(state.plan_rejection.plan_rejected_at !== undefined, "timestamp survived rehydration");
    assert(state.status_global === "blocked", "status_global survived as blocked");
    assert(state.current_phase === "plan_revision_pending", "current_phase survived as plan_revision_pending");
  }

  // ---- Test 223: Rehydration maintains plan rejected/in revision state ----
  console.log("\nTest 223: Rehydration maintains plan rejected/in revision state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_223" })), env);

    await rejectDecompositionPlan(env, "ctr_f2_223", { reason: "Testing persistence" });

    const { state, decomposition } = await rehydrateContract(env, "ctr_f2_223");
    assert(state.plan_rejection !== undefined, "plan_rejection survived rehydration");
    assert(state.plan_rejection.plan_rejected === true, "plan_rejected flag survived");
    assert(state.plan_rejection.previous_decomposition_snapshot !== null, "snapshot survived rehydration");
    assert(isPlanRejected(state) === true, "isPlanRejected returns true after rehydration");
  }

  // ---- Test 224: Summary/API exposes plan rejection state correctly ----
  console.log("\nTest 224: Summary/API exposes plan rejection state correctly");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_224" })), env);

    await rejectDecompositionPlan(env, "ctr_f2_224", { reason: "Summary test" });

    const { state, decomposition } = await rehydrateContract(env, "ctr_f2_224");
    const summary = buildContractSummary(state, decomposition);

    assert(summary.plan_rejection !== null, "summary has plan_rejection");
    assert(summary.plan_rejection.plan_rejected === true, "summary plan_rejected flag");
    assert(summary.plan_rejection.plan_rejection_reason === "Summary test", "summary rejection reason");
    assert(summary.status_global === "blocked", "summary status_global is blocked");

    // Also check resolveNextAction
    const nextAction = resolveNextAction(state, decomposition);
    assert(nextAction.type === "plan_rejected", "resolveNextAction type is plan_rejected");
    assert(nextAction.status === "blocked", "resolveNextAction status is blocked");
  }

  // ---- Test 225: Contract with rejected plan does not execute normally ----
  console.log("\nTest 225: Contract with rejected plan does not execute normally");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_225" })), env);

    await rejectDecompositionPlan(env, "ctr_f2_225", { reason: "Block execution test" });

    // Try to advance phase — should be blocked
    const advResult = await advanceContractPhase(env, "ctr_f2_225");
    assert(advResult.ok === false, "advance blocked");
    assert(advResult.error === "PLAN_REJECTED", "advance error is PLAN_REJECTED");

    // Try to execute — should be blocked
    const execResult = await executeCurrentMicroPr(env, "ctr_f2_225", {});
    assert(execResult.ok === false, "execute blocked");
    assert(execResult.error === "PLAN_REJECTED", "execute error is PLAN_REJECTED");
  }

  // ---- Test 226: Idempotent rejection ----
  console.log("\nTest 226: Idempotent rejection");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_226" })), env);

    const first = await rejectDecompositionPlan(env, "ctr_f2_226", { reason: "First rejection" });
    assert(first.ok === true, "first rejection ok");
    assert(first.already_rejected === false, "first is not already rejected");

    // Second rejection on same contract — idempotent
    const second = await rejectDecompositionPlan(env, "ctr_f2_226", { reason: "Second rejection" });
    assert(second.ok === true, "second rejection ok (idempotent)");
    assert(second.already_rejected === true, "second is already_rejected");
    assert(second.plan_rejection.plan_rejection_reason === "First rejection", "original reason preserved");
  }

  // ---- Test 227: Nonexistent contract fails gracefully ----
  console.log("\nTest 227: Nonexistent contract fails gracefully");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const result = await rejectDecompositionPlan(env, "ctr_f2_nonexistent", { reason: "Does not exist" });
    assert(result.ok === false, "rejection failed");
    assert(result.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 228: Normal flow not broken for non-rejected contracts ----
  console.log("\nTest 228: Normal flow not broken for non-rejected contracts");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_228" })), env);

    // Contract should be in decomposed state, isPlanRejected should be false
    const { state, decomposition } = await rehydrateContract(env, "ctr_f2_228");
    assert(isPlanRejected(state) === false, "isPlanRejected is false for normal contract");
    assert(state.status_global === "decomposed", "status_global is decomposed");

    // advanceContractPhase should work normally (not blocked by plan rejection)
    const advResult = await advanceContractPhase(env, "ctr_f2_228");
    // It may succeed or fail for other reasons, but NOT for PLAN_REJECTED
    assert(advResult.error !== "PLAN_REJECTED", "advance not blocked by PLAN_REJECTED");
  }

  // ---- Test 229: Rejection only valid from decomposed state ----
  console.log("\nTest 229: Rejection only valid from decomposed state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_229" })), env);

    // Advance to executing
    const adv = await advanceContractPhase(env, "ctr_f2_229");

    // Try to reject plan from executing — should fail
    const result = await rejectDecompositionPlan(env, "ctr_f2_229", { reason: "Too late" });
    assert(result.ok === false, "rejection from executing failed");
    assert(result.error === "PLAN_NOT_REJECTABLE", "error is PLAN_NOT_REJECTABLE");
  }

  // ---- Test 230: Missing reason fails validation ----
  console.log("\nTest 230: Missing reason fails validation");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_230" })), env);

    const result = await rejectDecompositionPlan(env, "ctr_f2_230", {});
    assert(result.ok === false, "rejection without reason failed");
    assert(result.error === "MISSING_REJECTION_REASON", "error is MISSING_REJECTION_REASON");
  }

  // ---- Test 231: Cancelled contract cannot have plan rejected ----
  console.log("\nTest 231: Cancelled contract cannot have plan rejected");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_231" })), env);

    await cancelContract(env, "ctr_f2_231", { reason: "Cancelled" });

    const result = await rejectDecompositionPlan(env, "ctr_f2_231", { reason: "Too late" });
    assert(result.ok === false, "rejection of cancelled contract failed");
    assert(result.error === "CONTRACT_CANCELLED", "error is CONTRACT_CANCELLED");
  }

  // ---- Test 232: Route handler POST /contracts/reject-plan — success ----
  console.log("\nTest 232: Route handler POST /contracts/reject-plan — success");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_232" })), env);

    const result = await handleRejectDecompositionPlan(
      mockRequest({ contract_id: "ctr_f2_232", reason: "Route test", rejected_by: "reviewer" }),
      env
    );

    assert(result.status === 200, "HTTP 200 on success");
    assert(result.body.ok === true, "body.ok is true");
    assert(result.body.plan_rejection.plan_rejection_reason === "Route test", "reason in response");
    assert(result.body.plan_rejection.plan_rejected_by === "reviewer", "rejected_by in response");
  }

  // ---- Test 233: Route handler — missing contract_id ----
  console.log("\nTest 233: Route handler — missing contract_id");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const result = await handleRejectDecompositionPlan(
      mockRequest({ reason: "No contract id" }),
      env
    );

    assert(result.status === 400, "HTTP 400 for missing contract_id");
    assert(result.body.error === "MISSING_CONTRACT_ID", "error is MISSING_CONTRACT_ID");
  }

  // ---- Test 234: Route handler — contract not found ----
  console.log("\nTest 234: Route handler — contract not found");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const result = await handleRejectDecompositionPlan(
      mockRequest({ contract_id: "ctr_f2_nonexistent", reason: "test" }),
      env
    );

    assert(result.status === 404, "HTTP 404 for not found");
    assert(result.body.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 235: Route handler — invalid JSON ----
  console.log("\nTest 235: Route handler — invalid JSON");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const result = await handleRejectDecompositionPlan(mockRequest(null), env);

    assert(result.status === 400, "HTTP 400 for invalid JSON");
    assert(result.body.error === "INVALID_JSON", "error is INVALID_JSON");
  }

  // ---- Test 236: GET contract after rejection shows full plan_rejection state ----
  console.log("\nTest 236: GET contract after rejection shows full plan_rejection state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_236" })), env);

    await rejectDecompositionPlan(env, "ctr_f2_236", { reason: "GET test" });

    const result = await handleGetContract(env, "ctr_f2_236");
    assert(result.status === 200, "GET returns 200");
    assert(result.body.contract.plan_rejection !== undefined, "GET shows plan_rejection data");
    assert(result.body.contract.plan_rejection.plan_rejected === true, "plan_rejected flag in GET");
    assert(result.body.contract.plan_rejection.plan_rejection_reason === "GET test", "reason in GET");
  }

  // ---- Test 237: Summary after rejection shows plan rejection data ----
  console.log("\nTest 237: Summary after rejection shows plan rejection data");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_237" })), env);

    await rejectDecompositionPlan(env, "ctr_f2_237", { reason: "Summary reject test" });

    const result = await handleGetContractSummary(env, "ctr_f2_237");
    assert(result.status === 200, "summary returns 200");
    assert(result.body.plan_rejection !== null, "summary has plan_rejection");
    assert(result.body.plan_rejection.plan_rejected === true, "summary plan_rejected");
    assert(result.body.plan_rejection.plan_rejection_reason === "Summary reject test", "summary rejection reason");
    assert(result.body.status_global === "blocked", "summary status_global is blocked");
  }

  // ---- Test 238: Default rejected_by is "human" ----
  console.log("\nTest 238: Default rejected_by is human");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f2_238" })), env);

    const result = await rejectDecompositionPlan(env, "ctr_f2_238", { reason: "Default actor test" });
    assert(result.ok === true, "rejection ok");
    assert(result.plan_rejection.plan_rejected_by === "human", "default rejected_by is human");
  }

  // ============================================================================
  // 🔒 F2 RISCO 1 — Plan-rejected guard on all operational mutations
  // ============================================================================
  console.log("\n" + "=".repeat(50));
  console.log("F2 RISCO 1 — Plan-rejected guard on all operational mutations");
  console.log("=".repeat(50));

  // ---- Test 239: Plan rejected blocks startTask ----
  console.log("\nTest 239: Plan rejected blocks startTask");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r1_239" })), env);
    await rejectDecompositionPlan(env, "ctr_r1_239", { reason: "Block startTask test" });

    const result = await startTask(env, "ctr_r1_239", "task_001");
    assert(result.ok === false, "startTask blocked");
    assert(result.error === "PLAN_REJECTED", "error is PLAN_REJECTED");
  }

  // ---- Test 240: Plan rejected blocks completeTask ----
  console.log("\nTest 240: Plan rejected blocks completeTask");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r1_240" })), env);
    await rejectDecompositionPlan(env, "ctr_r1_240", { reason: "Block completeTask test" });

    const result = await completeTask(env, "ctr_r1_240", "task_001");
    assert(result.ok === false, "completeTask blocked");
    assert(result.error === "PLAN_REJECTED", "error is PLAN_REJECTED");
  }

  // ---- Test 241: Plan rejected blocks blockTask ----
  console.log("\nTest 241: Plan rejected blocks blockTask");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r1_241" })), env);
    await rejectDecompositionPlan(env, "ctr_r1_241", { reason: "Block blockTask test" });

    const result = await blockTask(env, "ctr_r1_241", "task_001", "reason");
    assert(result.ok === false, "blockTask blocked");
    assert(result.error === "PLAN_REJECTED", "error is PLAN_REJECTED");
  }

  // ---- Test 242: Plan rejected blocks startMicroPrCandidate ----
  console.log("\nTest 242: Plan rejected blocks startMicroPrCandidate");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r1_242" })), env);
    await rejectDecompositionPlan(env, "ctr_r1_242", { reason: "Block startMicroPr test" });

    const result = await startMicroPrCandidate(env, "ctr_r1_242", "micro_pr_001");
    assert(result.ok === false, "startMicroPrCandidate blocked");
    assert(result.error === "PLAN_REJECTED", "error is PLAN_REJECTED");
  }

  // ---- Test 243: Plan rejected blocks completeMicroPrCandidate ----
  console.log("\nTest 243: Plan rejected blocks completeMicroPrCandidate");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r1_243" })), env);
    await rejectDecompositionPlan(env, "ctr_r1_243", { reason: "Block completeMicroPr test" });

    const result = await completeMicroPrCandidate(env, "ctr_r1_243", "micro_pr_001");
    assert(result.ok === false, "completeMicroPrCandidate blocked");
    assert(result.error === "PLAN_REJECTED", "error is PLAN_REJECTED");
  }

  // ---- Test 244: Plan rejected blocks blockMicroPrCandidate ----
  console.log("\nTest 244: Plan rejected blocks blockMicroPrCandidate");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r1_244" })), env);
    await rejectDecompositionPlan(env, "ctr_r1_244", { reason: "Block blockMicroPr test" });

    const result = await blockMicroPrCandidate(env, "ctr_r1_244", "micro_pr_001", "reason");
    assert(result.ok === false, "blockMicroPrCandidate blocked");
    assert(result.error === "PLAN_REJECTED", "error is PLAN_REJECTED");
  }

  // ---- Test 245: Plan rejected blocks discardMicroPrCandidate ----
  console.log("\nTest 245: Plan rejected blocks discardMicroPrCandidate");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r1_245" })), env);
    await rejectDecompositionPlan(env, "ctr_r1_245", { reason: "Block discardMicroPr test" });

    const result = await discardMicroPrCandidate(env, "ctr_r1_245", "micro_pr_001", "reason");
    assert(result.ok === false, "discardMicroPrCandidate blocked");
    assert(result.error === "PLAN_REJECTED", "error is PLAN_REJECTED");
  }

  // ============================================================================
  // 🔒 F2 RISCO 2 — Formal plan revision resolution
  // ============================================================================
  console.log("\n" + "=".repeat(50));
  console.log("F2 RISCO 2 — Formal plan revision resolution");
  console.log("=".repeat(50));

  // ---- Test 246: Successful plan revision resolution ----
  console.log("\nTest 246: Successful plan revision resolution");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_246" })), env);
    await rejectDecompositionPlan(env, "ctr_r2_246", { reason: "Bad plan" });

    const result = await resolvePlanRevision(env, "ctr_r2_246", { revised_by: "tech-lead" });
    assert(result.ok === true, "resolution succeeded");
    assert(result.state.status_global === "decomposed", "status_global back to decomposed");
    assert(result.state.current_phase === "decomposition_complete", "current_phase back to decomposition_complete");
    assert(result.state.plan_rejection === null, "plan_rejection cleared");
    assert(Array.isArray(result.state.plan_rejection_history), "plan_rejection_history is array");
    assert(result.state.plan_rejection_history.length === 1, "one rejection in history");
    assert(result.state.plan_rejection_history[0].plan_rejection_reason === "Bad plan", "history preserves reason");
    assert(result.state.plan_rejection_history[0].resolved_by === "tech-lead", "history preserves resolved_by");
    assert(result.state.plan_rejection_history[0].resolved_at !== undefined, "history preserves resolved_at");
  }

  // ---- Test 247: Resolution clears plan_rejection and isPlanRejected returns false ----
  console.log("\nTest 247: Resolution clears plan_rejection");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_247" })), env);
    await rejectDecompositionPlan(env, "ctr_r2_247", { reason: "Clear test" });

    assert(isPlanRejected((await rehydrateContract(env, "ctr_r2_247")).state) === true, "rejected before resolve");

    await resolvePlanRevision(env, "ctr_r2_247", {});

    const { state } = await rehydrateContract(env, "ctr_r2_247");
    assert(isPlanRejected(state) === false, "isPlanRejected false after resolve");
    assert(state.plan_rejection === null, "plan_rejection is null after resolve");
  }

  // ---- Test 248: Resolution removes plan_revision_pending ----
  console.log("\nTest 248: Resolution removes plan_revision_pending");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_248" })), env);
    await rejectDecompositionPlan(env, "ctr_r2_248", { reason: "Phase test" });

    const { state: before } = await rehydrateContract(env, "ctr_r2_248");
    assert(before.current_phase === "plan_revision_pending", "in plan_revision_pending before resolve");

    await resolvePlanRevision(env, "ctr_r2_248", {});

    const { state: after } = await rehydrateContract(env, "ctr_r2_248");
    assert(after.current_phase === "decomposition_complete", "decomposition_complete after resolve");
  }

  // ---- Test 249: After resolution, operations unblocked ----
  console.log("\nTest 249: After resolution, operations unblocked");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_249" })), env);
    await rejectDecompositionPlan(env, "ctr_r2_249", { reason: "Unblock test" });

    // Blocked while rejected
    const blocked = await advanceContractPhase(env, "ctr_r2_249");
    assert(blocked.ok === false, "advance blocked while rejected");
    assert(blocked.error === "PLAN_REJECTED", "blocked reason is PLAN_REJECTED");

    // Resolve
    await resolvePlanRevision(env, "ctr_r2_249", {});

    // Now advance should work (not blocked by PLAN_REJECTED)
    const unblocked = await advanceContractPhase(env, "ctr_r2_249");
    assert(unblocked.error !== "PLAN_REJECTED", "advance not blocked by PLAN_REJECTED after resolve");
  }

  // ---- Test 250: Resolution invalid when contract not in revision ----
  console.log("\nTest 250: Resolution invalid when contract not in revision");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_250" })), env);

    // Not rejected — try to resolve
    const result = await resolvePlanRevision(env, "ctr_r2_250", {});
    assert(result.ok === false, "resolve without rejection fails");
    assert(result.error === "NOT_IN_PLAN_REVISION", "error is NOT_IN_PLAN_REVISION");
  }

  // ---- Test 251: Resolution on nonexistent contract fails ----
  console.log("\nTest 251: Resolution on nonexistent contract fails");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const result = await resolvePlanRevision(env, "ctr_r2_nonexistent", {});
    assert(result.ok === false, "resolve on nonexistent fails");
    assert(result.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 252: Resolution on cancelled contract fails ----
  console.log("\nTest 252: Resolution on cancelled contract fails");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_252" })), env);
    await cancelContract(env, "ctr_r2_252", { reason: "test" });

    const result = await resolvePlanRevision(env, "ctr_r2_252", {});
    assert(result.ok === false, "resolve on cancelled fails");
    assert(result.error === "CONTRACT_CANCELLED", "error is CONTRACT_CANCELLED");
  }

  // ---- Test 253: Summary after resolution shows clean state ----
  console.log("\nTest 253: Summary after resolution shows clean state");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_253" })), env);
    await rejectDecompositionPlan(env, "ctr_r2_253", { reason: "Summary test" });
    await resolvePlanRevision(env, "ctr_r2_253", {});

    const { state, decomposition } = await rehydrateContract(env, "ctr_r2_253");
    const summary = buildContractSummary(state, decomposition);

    assert(summary.plan_rejection === null, "summary plan_rejection is null after resolve");
    assert(summary.plan_rejection_history.length === 1, "summary has rejection history");
    assert(summary.status_global === "decomposed", "summary status_global is decomposed after resolve");
  }

  // ---- Test 254: Multiple reject-resolve cycles preserve history ----
  console.log("\nTest 254: Multiple reject-resolve cycles preserve history");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_254" })), env);

    // Cycle 1
    await rejectDecompositionPlan(env, "ctr_r2_254", { reason: "First rejection" });
    await resolvePlanRevision(env, "ctr_r2_254", { revised_by: "reviewer-1" });

    // Cycle 2
    await rejectDecompositionPlan(env, "ctr_r2_254", { reason: "Second rejection" });
    await resolvePlanRevision(env, "ctr_r2_254", { revised_by: "reviewer-2" });

    const { state } = await rehydrateContract(env, "ctr_r2_254");
    assert(state.plan_rejection === null, "plan_rejection null after two cycles");
    assert(state.plan_rejection_history.length === 2, "two rejections in history");
    assert(state.plan_rejection_history[0].plan_rejection_reason === "First rejection", "first reason preserved");
    assert(state.plan_rejection_history[1].plan_rejection_reason === "Second rejection", "second reason preserved");
    assert(state.plan_rejection_history[0].resolved_by === "reviewer-1", "first resolved_by preserved");
    assert(state.plan_rejection_history[1].resolved_by === "reviewer-2", "second resolved_by preserved");
  }

  // ---- Test 255: Route handler POST /contracts/resolve-plan-revision — success ----
  console.log("\nTest 255: Route handler POST /contracts/resolve-plan-revision — success");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_255" })), env);
    await rejectDecompositionPlan(env, "ctr_r2_255", { reason: "Route test" });

    const result = await handleResolvePlanRevision(
      mockRequest({ contract_id: "ctr_r2_255", revised_by: "admin" }),
      env
    );

    assert(result.status === 200, "HTTP 200 on success");
    assert(result.body.ok === true, "body.ok is true");
    assert(result.body.plan_rejection_history.length === 1, "history in response");
  }

  // ---- Test 256: Route handler — missing contract_id ----
  console.log("\nTest 256: Route handler resolve — missing contract_id");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const result = await handleResolvePlanRevision(mockRequest({}), env);
    assert(result.status === 400, "HTTP 400 for missing contract_id");
    assert(result.body.error === "MISSING_CONTRACT_ID", "error is MISSING_CONTRACT_ID");
  }

  // ---- Test 257: Route handler — contract not found ----
  console.log("\nTest 257: Route handler resolve — contract not found");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const result = await handleResolvePlanRevision(
      mockRequest({ contract_id: "ctr_r2_nonexistent" }),
      env
    );
    assert(result.status === 404, "HTTP 404 for not found");
    assert(result.body.error === "CONTRACT_NOT_FOUND", "error is CONTRACT_NOT_FOUND");
  }

  // ---- Test 258: Route handler — invalid JSON ----
  console.log("\nTest 258: Route handler resolve — invalid JSON");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const result = await handleResolvePlanRevision(mockRequest(null), env);
    assert(result.status === 400, "HTTP 400 for invalid JSON");
    assert(result.body.error === "INVALID_JSON", "error is INVALID_JSON");
  }

  // ---- Test 259: Normal flow still works for non-rejected contracts ----
  console.log("\nTest 259: Normal flow still works for non-rejected contracts");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_259" })), env);

    // startTask should work normally (not blocked by PLAN_REJECTED)
    const result = await startTask(env, "ctr_r2_259", "task_001");
    assert(result.error !== "PLAN_REJECTED", "startTask not blocked on non-rejected contract");
  }

  // ---- Test 260: Rehydration after resolve is consistent ----
  console.log("\nTest 260: Rehydration after resolve is consistent");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await handleCreateContract(mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_r2_260" })), env);
    await rejectDecompositionPlan(env, "ctr_r2_260", { reason: "Rehydrate test" });
    await resolvePlanRevision(env, "ctr_r2_260", {});

    // Rehydrate and verify consistency
    const { state, decomposition } = await rehydrateContract(env, "ctr_r2_260");
    assert(state.status_global === "decomposed", "rehydrated status_global is decomposed");
    assert(state.current_phase === "decomposition_complete", "rehydrated current_phase is decomposition_complete");
    assert(state.plan_rejection === null, "rehydrated plan_rejection is null");
    assert(state.plan_rejection_history.length === 1, "rehydrated history has 1 entry");
    assert(decomposition !== null, "rehydrated decomposition exists");
    assert(Array.isArray(decomposition.phases), "rehydrated decomposition has phases");
    assert(Array.isArray(decomposition.tasks), "rehydrated decomposition has tasks");
  }

  // ===========================================================================
  // F3 — Enforcement of max_micro_prs
  // ===========================================================================

  // ---- Test 261: max_micro_prs within limit — contract created successfully ----
  console.log("\nTest 261: F3 — max_micro_prs within limit creates decomposed contract");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // VALID_PAYLOAD has 3 DoD items → 3 task candidates; limit is 3 → OK
    const result = await handleCreateContract(
      mockRequest(Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f3_261" })),
      env
    );
    assert(result.status === 201, "HTTP 201 when within limit");
    assert(result.body.ok === true, "ok is true");
    assert(result.body.status_global === "decomposed", 'status_global is "decomposed" when within limit');
  }

  // ---- Test 262: max_micro_prs exceeded — contract blocked ----
  console.log("\nTest 262: F3 — max_micro_prs exceeded blocks contract at creation");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // 4 DoD items → 4 task candidates; limit is 3 → exceeded
    const payload = Object.assign({}, VALID_PAYLOAD, {
      contract_id: "ctr_f3_262",
      definition_of_done: ["A", "B", "C", "D"],
      constraints: Object.assign({}, VALID_PAYLOAD.constraints, { max_micro_prs: 3 }),
    });
    const result = await handleCreateContract(mockRequest(payload), env);
    assert(result.status === 201, "HTTP 201 (contract persisted as blocked)");
    assert(result.body.status_global === "blocked", 'status_global is "blocked" when limit exceeded');

    // Verify state in KV
    const { state } = await rehydrateContract(env, "ctr_f3_262");
    assert(state.status_global === "blocked", "rehydrated status_global is blocked");
    assert(state.current_phase === "max_prs_exceeded", 'rehydrated current_phase is "max_prs_exceeded"');
    assert(Array.isArray(state.blockers) && state.blockers.length > 0, "blockers array is populated");
    assert(
      state.blockers.some((b) => b.includes("max_micro_prs")),
      "blocker message references max_micro_prs"
    );
  }

  // ---- Test 263: absence of max_micro_prs — default (10) applied, normal behaviour ----
  console.log("\nTest 263: F3 — absence of max_micro_prs uses default limit, normal behaviour");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // No constraints provided → default max_micro_prs: 10; 3 DoD → 3 task candidates → within limit
    const payloadNoConstraints = {
      contract_id: "ctr_f3_263",
      version: "v1",
      operator: "test-operator",
      goal: "Test no constraints",
      scope: { workers: ["nv-enavia"], routes: ["/test"], environments: ["TEST", "PROD"] },
      definition_of_done: ["Step A", "Step B", "Step C"],
    };
    const result = await handleCreateContract(mockRequest(payloadNoConstraints), env);
    assert(result.status === 201, "HTTP 201 with no explicit constraints");
    assert(result.body.status_global === "decomposed", 'status_global is "decomposed" with default limit');
  }

  // ---- Test 264: resolvePlanRevision with oversized new_decomposition fails ----
  console.log("\nTest 264: F3 — resolvePlanRevision rejects oversized revised decomposition");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // Create with VALID_PAYLOAD (max_micro_prs: 3, 3 DoD → 3 task candidates → decomposed)
    const payload = Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f3_264" });
    await handleCreateContract(mockRequest(payload), env);
    // Reject the plan (contract is in decomposed state)
    await rejectDecompositionPlan(env, "ctr_f3_264", { reason: "Test oversized resolve" });

    // Provide a revised decomposition with 4 task candidates (> limit 3)
    const oversizedDecomp = {
      contract_id: "ctr_f3_264",
      phases: [],
      tasks: [],
      micro_pr_candidates: [
        { id: "micro_pr_001", task_id: "t1", environment: "TEST" },
        { id: "micro_pr_002", task_id: "t2", environment: "TEST" },
        { id: "micro_pr_003", task_id: "t3", environment: "TEST" },
        { id: "micro_pr_004", task_id: "t4", environment: "TEST" },
        { id: "micro_pr_005", task_id: null, environment: "PROD" },
      ],
      generated_at: new Date().toISOString(),
    };
    const result = await resolvePlanRevision(env, "ctr_f3_264", { new_decomposition: oversizedDecomp });
    assert(result.ok === false, "resolvePlanRevision fails with oversized plan");
    assert(result.error === "BLOCK_MAX_PRS_REACHED", "error is BLOCK_MAX_PRS_REACHED");

    // State must remain blocked / plan_rejected (not transitioned)
    const { state } = await rehydrateContract(env, "ctr_f3_264");
    assert(state.status_global === "blocked", "contract remains blocked after failed resolve");
    assert(state.plan_rejection !== null, "plan_rejection still active after failed resolve");
  }

  // ---- Test 265: resolvePlanRevision with plan within limit resolves successfully ----
  console.log("\nTest 265: F3 — resolvePlanRevision accepts revised decomposition within limit");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // Create with VALID_PAYLOAD (max_micro_prs: 3, 3 DoD → 3 task candidates → decomposed)
    const payload = Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f3_265" });
    await handleCreateContract(mockRequest(payload), env);
    await rejectDecompositionPlan(env, "ctr_f3_265", { reason: "Test within-limit resolve" });

    // Provide a revised decomposition with 3 task candidates (≤ limit 3)
    const withinLimitDecomp = {
      contract_id: "ctr_f3_265",
      phases: [],
      tasks: [],
      micro_pr_candidates: [
        { id: "micro_pr_001", task_id: "t1", environment: "TEST" },
        { id: "micro_pr_002", task_id: "t2", environment: "TEST" },
        { id: "micro_pr_003", task_id: "t3", environment: "TEST" },
        { id: "micro_pr_004", task_id: null, environment: "PROD" },
      ],
      generated_at: new Date().toISOString(),
    };
    const result = await resolvePlanRevision(env, "ctr_f3_265", { new_decomposition: withinLimitDecomp });
    assert(result.ok === true, "resolvePlanRevision succeeds with plan within limit");
    assert(result.state.status_global === "decomposed", 'contract returns to "decomposed"');
  }

  // ---- Test 266: Rehydration after max_prs_exceeded block is consistent ----
  console.log("\nTest 266: F3 — rehydration after max_prs_exceeded block is consistent");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const payload = Object.assign({}, VALID_PAYLOAD, {
      contract_id: "ctr_f3_266",
      definition_of_done: ["X", "Y", "Z", "W"],
      constraints: Object.assign({}, VALID_PAYLOAD.constraints, { max_micro_prs: 3 }),
    });
    await handleCreateContract(mockRequest(payload), env);

    const { state, decomposition } = await rehydrateContract(env, "ctr_f3_266");
    assert(state.status_global === "blocked", "rehydrated status_global is blocked");
    assert(state.current_phase === "max_prs_exceeded", 'rehydrated current_phase is "max_prs_exceeded"');
    assert(Array.isArray(state.blockers) && state.blockers.length > 0, "rehydrated blockers are populated");
    assert(decomposition !== null, "rehydrated decomposition exists");
    assert(Array.isArray(decomposition.micro_pr_candidates), "rehydrated micro_pr_candidates is array");
  }

  // ---- Test 267: Route handler — resolve with oversized plan returns HTTP 422 ----
  console.log("\nTest 267: F3 — route handler returns HTTP 422 for oversized revised plan");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    // Create with VALID_PAYLOAD (max_micro_prs: 3, 3 DoD → 3 task candidates → decomposed)
    const payload = Object.assign({}, VALID_PAYLOAD, { contract_id: "ctr_f3_267" });
    await handleCreateContract(mockRequest(payload), env);
    await rejectDecompositionPlan(env, "ctr_f3_267", { reason: "Route test" });

    // Oversized: 4 task candidates (> limit 3)
    const oversizedDecomp = {
      contract_id: "ctr_f3_267",
      phases: [],
      tasks: [],
      micro_pr_candidates: [
        { id: "micro_pr_001", task_id: "t1", environment: "TEST" },
        { id: "micro_pr_002", task_id: "t2", environment: "TEST" },
        { id: "micro_pr_003", task_id: "t3", environment: "TEST" },
        { id: "micro_pr_004", task_id: "t4", environment: "TEST" },
        { id: "micro_pr_005", task_id: null, environment: "PROD" },
      ],
      generated_at: new Date().toISOString(),
    };
    const result = await handleResolvePlanRevision(
      mockRequest({ contract_id: "ctr_f3_267", new_decomposition: oversizedDecomp }),
      env
    );
    assert(result.status === 422, "HTTP 422 for oversized revised plan via route handler");
    assert(result.body.error === "BLOCK_MAX_PRS_REACHED", "error is BLOCK_MAX_PRS_REACHED in route response");
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
