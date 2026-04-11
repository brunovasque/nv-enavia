// ============================================================================
// 📜 ENAVIA — Contract Executor v1 (Fase A)
//
// Responsabilidades da Fase A:
//   1. Ingestão e validação de contrato canônico
//   2. Persistência de estado mínimo em KV (ENAVIA_BRAIN)
//   3. Decomposição inicial (heurística determinística)
//   4. Leitura de estado e resumo do contrato
//
// NÃO faz (Fase A):
//   - Executar micro-PRs
//   - Promover para PROD
//   - Loop de erro
//   - Painel/front
// ============================================================================

// ---------------------------------------------------------------------------
// KV Key Prefixes
// ---------------------------------------------------------------------------
const KV_PREFIX_STATE = "contract:";
const KV_SUFFIX_STATE = ":state";
const KV_SUFFIX_DECOMPOSITION = ":decomposition";
const KV_INDEX_KEY = "contract:index";

// ---------------------------------------------------------------------------
// Valid statuses for Phase A
// ---------------------------------------------------------------------------
const VALID_STATUSES = ["draft", "approved", "decomposed", "blocked", "failed", "in_progress", "completed"];

// ---------------------------------------------------------------------------
// Valid statuses for Tasks
// ---------------------------------------------------------------------------
const VALID_TASK_STATUSES = ["queued", "in_progress", "completed", "blocked"];

// ---------------------------------------------------------------------------
// Valid statuses for Micro-PR Candidates
// ---------------------------------------------------------------------------
const VALID_MICRO_PR_STATUSES = ["queued", "in_progress", "completed", "blocked", "discarded"];

// ---------------------------------------------------------------------------
// Special (non-decomposition) values for current_phase
// ---------------------------------------------------------------------------
const SPECIAL_PHASES = [
  "decomposition_complete",
  "ingestion_blocked",
  "all_phases_complete",
];

// ---------------------------------------------------------------------------
// Required fields for a minimal contract payload
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS = [
  "contract_id",
  "version",
  "operator",
  "goal",
  "definition_of_done",
];

// ---------------------------------------------------------------------------
// Validate contract payload — returns { valid, errors }
// ---------------------------------------------------------------------------
function validateContractPayload(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Payload must be a JSON object."] };
  }

  for (const field of REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      errors.push(`Missing required field: "${field}".`);
    }
  }

  // contract_id must be a non-empty string
  if (body.contract_id && typeof body.contract_id !== "string") {
    errors.push('"contract_id" must be a string.');
  }

  // version must be "v1"
  if (body.version && body.version !== "v1") {
    errors.push('"version" must be "v1".');
  }

  // definition_of_done must be a non-empty array
  if (body.definition_of_done !== undefined) {
    if (!Array.isArray(body.definition_of_done) || body.definition_of_done.length === 0) {
      errors.push('"definition_of_done" must be a non-empty array.');
    }
  }

  // scope.environments must exist and be a non-empty array
  if (!body.scope || !Array.isArray(body.scope.environments) || body.scope.environments.length === 0) {
    errors.push('"scope.environments" must be a non-empty array (e.g. ["TEST","PROD"]).');
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Build initial state from validated payload
// ---------------------------------------------------------------------------
function buildInitialState(body) {
  const now = new Date().toISOString();
  return {
    contract_id: body.contract_id,
    contract_name: body.goal,
    contract_version: body.version,
    objective_final: body.goal,
    status_global: "decomposed",
    current_phase: "decomposition_complete",
    current_task: null,
    pending_items: [],
    blockers: [],
    next_action: "Revisar decomposição e aprovar plano de micro-PRs.",
    prod_promotion_required: true,
    operator: body.operator,
    scope: body.scope || {},
    constraints: Object.assign(
      {
        max_micro_prs: 10,
        require_human_approval_per_pr: true,
        test_before_prod: true,
        rollback_on_failure: true,
      },
      body.constraints || {}
    ),
    definition_of_done: body.definition_of_done,
    context: body.context || {},
    created_at: body.created_at || now,
    updated_at: now,
  };
}

// ---------------------------------------------------------------------------
// Generate initial decomposition (heuristic / deterministic)
// ---------------------------------------------------------------------------
function generateDecomposition(state) {
  const dod = state.definition_of_done || [];
  const scope = state.scope || {};
  const workers = scope.workers || ["nv-enavia"];
  const routes = scope.routes || [];

  // Phase 1 — always present: preparation
  const phases = [
    {
      id: "phase_01",
      name: "Preparação e análise",
      status: "pending",
      tasks: [],
    },
    {
      id: "phase_02",
      name: "Implementação em TEST",
      status: "pending",
      tasks: [],
    },
    {
      id: "phase_03",
      name: "Validação e promoção para PROD",
      status: "pending",
      tasks: [],
    },
  ];

  const tasks = [];
  const microPrCandidates = [];

  // Generate one task per definition_of_done item
  dod.forEach((criterion, idx) => {
    const taskId = `task_${String(idx + 1).padStart(3, "0")}`;
    const task = {
      id: taskId,
      description: criterion,
      status: "queued",
      phase: idx < dod.length - 1 ? "phase_02" : "phase_03",
      depends_on: idx > 0 ? [`task_${String(idx).padStart(3, "0")}`] : [],
    };
    tasks.push(task);

    // Each task is a micro-PR candidate
    microPrCandidates.push({
      id: `micro_pr_${String(idx + 1).padStart(3, "0")}`,
      task_id: taskId,
      title: `${state.contract_id} — ${criterion.slice(0, 80)}`,
      status: "queued",
      target_workers: workers,
      target_routes: routes,
      environment: "TEST",
    });
  });

  // Add a final PROD promotion micro-PR candidate
  microPrCandidates.push({
    id: `micro_pr_${String(dod.length + 1).padStart(3, "0")}`,
    task_id: null,
    title: `${state.contract_id} — Promoção para PROD`,
    status: "queued",
    target_workers: workers,
    target_routes: routes,
    environment: "PROD",
  });

  // Assign tasks to phases
  tasks.forEach((t) => {
    if (t.phase === "phase_02" && t.id !== "task_001") {
      phases[1].tasks.push(t.id);
    }
    if (t.phase === "phase_03") {
      phases[2].tasks.push(t.id);
    }
  });
  // First task always goes to phase 1
  if (tasks.length > 0) {
    phases[0].tasks = [tasks[0].id];
  }

  return {
    contract_id: state.contract_id,
    phases,
    tasks,
    micro_pr_candidates: microPrCandidates,
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Persist state + decomposition to KV
// ---------------------------------------------------------------------------
async function persistContract(env, state, decomposition) {
  const id = state.contract_id;
  const stateKey = `${KV_PREFIX_STATE}${id}${KV_SUFFIX_STATE}`;
  const decompKey = `${KV_PREFIX_STATE}${id}${KV_SUFFIX_DECOMPOSITION}`;

  await env.ENAVIA_BRAIN.put(stateKey, JSON.stringify(state));
  await env.ENAVIA_BRAIN.put(decompKey, JSON.stringify(decomposition));

  // Update index (list of contract ids)
  let index = [];
  try {
    const raw = await env.ENAVIA_BRAIN.get(KV_INDEX_KEY);
    if (raw) index = JSON.parse(raw);
  } catch (_) {
    index = [];
  }
  if (!index.includes(id)) {
    index.push(id);
    await env.ENAVIA_BRAIN.put(KV_INDEX_KEY, JSON.stringify(index));
  }
}

// ---------------------------------------------------------------------------
// Read state from KV
// ---------------------------------------------------------------------------
async function readContractState(env, contractId) {
  const key = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_STATE}`;
  const raw = await env.ENAVIA_BRAIN.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Read decomposition from KV
// ---------------------------------------------------------------------------
async function readContractDecomposition(env, contractId) {
  const key = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_DECOMPOSITION}`;
  const raw = await env.ENAVIA_BRAIN.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// INVARIANT 1 — Source of Truth Rule
// INVARIANT 3 — Rehydration Before Action
//
// rehydrateContract must be called before ANY executor action that depends
// on the contract state. Model memory / in-scope variables are never the
// source of truth; only the values returned here are authoritative.
// ---------------------------------------------------------------------------
async function rehydrateContract(env, contractId) {
  const [state, decomposition] = await Promise.all([
    readContractState(env, contractId),
    readContractDecomposition(env, contractId),
  ]);
  return { state, decomposition };
}

// ---------------------------------------------------------------------------
// INVARIANT 2 — Mandatory Phase Gate
//
// Returns { canAdvance, activePhaseId, reason }.
//   canAdvance = true  → all tasks in the active decomposition phase are done;
//                        current_phase may be advanced.
//   canAdvance = false → active phase still has incomplete tasks;
//                        current_phase must stay or become "blocked".
//
// "Done" means task.status is one of TASK_DONE_STATUSES.
// ---------------------------------------------------------------------------
const TASK_DONE_STATUSES = ["done", "merged", "completed", "skipped"];

function checkPhaseGate(state, decomposition) {
  if (!state || !decomposition) {
    return { canAdvance: false, activePhaseId: null, reason: "Missing state or decomposition — cannot evaluate phase gate." };
  }

  const phases = decomposition.phases || [];
  const tasks = decomposition.tasks || [];

  // Find the first phase that is not yet done (active phase)
  const activePhase = phases.find((p) => p.status !== "done");

  if (!activePhase) {
    // All phases are done — no further advancement needed
    return { canAdvance: true, activePhaseId: null, reason: "All phases are complete." };
  }

  const phaseTasks = tasks.filter((t) => activePhase.tasks.includes(t.id));
  const incompleteTasks = phaseTasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status));

  if (incompleteTasks.length > 0) {
    const taskIds = incompleteTasks.map((t) => t.id).join(", ");
    return {
      canAdvance: false,
      activePhaseId: activePhase.id,
      reason: `Phase "${activePhase.id}" has ${incompleteTasks.length} incomplete task(s): ${taskIds}.`,
    };
  }

  return { canAdvance: true, activePhaseId: activePhase.id, reason: `Phase "${activePhase.id}" acceptance criteria met.` };
}

// ---------------------------------------------------------------------------
// INVARIANT 3 — Single Advance Path: Phase Transition Validation
//
// Validates that a proposed current_phase value is a known phase from the
// contract's decomposition or one of the special lifecycle phases.
// Prevents drift to arbitrary/stale phase values.
// ---------------------------------------------------------------------------
function isValidPhaseValue(phaseValue, decomposition) {
  if (SPECIAL_PHASES.includes(phaseValue)) return true;
  if (!decomposition || !Array.isArray(decomposition.phases)) return false;
  return decomposition.phases.some((p) => p.id === phaseValue);
}

// ---------------------------------------------------------------------------
// Advance contract phase — enforces all 3 invariants:
//   1. Source of Truth: state always rehydrated from KV before action
//   2. Phase Gate: advancement only happens when acceptance criteria are met
//   3. Rehydration: explicit KV read before any decision
//
// Returns { ok, state, decomposition, gate, error? }
// ---------------------------------------------------------------------------
async function advanceContractPhase(env, contractId) {
  // INVARIANT 1 + 3 — always read from KV, never from memory
  const { state, decomposition } = await rehydrateContract(env, contractId);

  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found in KV.` };
  }

  // INVARIANT 2 — evaluate phase gate against persisted state
  const gate = checkPhaseGate(state, decomposition);

  if (!gate.canAdvance) {
    // Cannot advance — stay in current phase or mark blocked
    const now = new Date().toISOString();
    const updatedState = Object.assign({}, state, {
      status_global: "blocked",
      blockers: [...new Set([...(state.blockers || []), gate.reason])],
      next_action: "Resolve incomplete tasks in active phase before advancing.",
      updated_at: now,
    });
    await env.ENAVIA_BRAIN.put(
      `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_STATE}`,
      JSON.stringify(updatedState)
    );
    return { ok: false, state: updatedState, decomposition, gate };
  }

  // Gate passed — mark active phase as done and advance to next pending phase
  const now = new Date().toISOString();
  const updatedPhases = (decomposition.phases || []).map((p) =>
    p.id === gate.activePhaseId ? Object.assign({}, p, { status: "done" }) : p
  );
  const nextPhase = updatedPhases.find((p) => p.status !== "done");
  const nextPhaseValue = nextPhase ? nextPhase.id : "all_phases_complete";

  // Validate that the target phase is a known value (prevents drift)
  if (!isValidPhaseValue(nextPhaseValue, decomposition)) {
    return {
      ok: false,
      error: "INVALID_PHASE_TRANSITION",
      message: `Phase "${nextPhaseValue}" is not a valid phase for contract "${contractId}".`,
      state,
      decomposition,
      gate,
    };
  }

  const updatedDecomposition = Object.assign({}, decomposition, { phases: updatedPhases });
  const updatedState = Object.assign({}, state, {
    current_phase: nextPhaseValue,
    // Clear blocked status — gate passed, contract is progressing
    status_global: nextPhase ? "in_progress" : "completed",
    // Clear blockers since the gate that caused them has now passed
    blockers: [],
    next_action: nextPhase
      ? `Execute tasks in phase "${nextPhase.id}".`
      : "All phases complete. Awaiting human sign-off.",
    updated_at: now,
  });

  await Promise.all([
    env.ENAVIA_BRAIN.put(
      `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_STATE}`,
      JSON.stringify(updatedState)
    ),
    env.ENAVIA_BRAIN.put(
      `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_DECOMPOSITION}`,
      JSON.stringify(updatedDecomposition)
    ),
  ]);

  return { ok: true, state: updatedState, decomposition: updatedDecomposition, gate };
}

// ============================================================================
// 📌 Canonical Status Change Functions — Single Path
//
// These are the ONLY functions allowed to mutate task and micro_pr_candidate
// statuses. All status changes MUST go through these functions.
// Each function:
//   1. Rehydrates from KV (Invariant 1 + 3)
//   2. Validates the transition
//   3. Updates the status
//   4. Updates current_task on state
//   5. Persists to KV (Invariant 5)
// ============================================================================

// ---------------------------------------------------------------------------
// TASK STATUS FUNCTIONS
// ---------------------------------------------------------------------------

async function startTask(env, contractId, taskId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  const task = (decomposition.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: "TASK_NOT_FOUND", message: `Task "${taskId}" not found in contract "${contractId}".` };
  }
  if (task.status !== "queued") {
    return { ok: false, error: "INVALID_TRANSITION", message: `Task "${taskId}" cannot start from status "${task.status}". Must be "queued".` };
  }

  task.status = "in_progress";
  const now = new Date().toISOString();
  state.current_task = taskId;
  state.updated_at = now;

  await persistContract(env, state, decomposition);
  return { ok: true, state, decomposition, task };
}

async function completeTask(env, contractId, taskId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  const task = (decomposition.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: "TASK_NOT_FOUND", message: `Task "${taskId}" not found in contract "${contractId}".` };
  }
  if (task.status !== "in_progress") {
    return { ok: false, error: "INVALID_TRANSITION", message: `Task "${taskId}" cannot complete from status "${task.status}". Must be "in_progress".` };
  }

  task.status = "completed";
  const now = new Date().toISOString();
  // If this was the current task, advance to next queued task or clear
  if (state.current_task === taskId) {
    const nextTask = (decomposition.tasks || []).find((t) => t.status === "queued");
    state.current_task = nextTask ? nextTask.id : null;
  }
  state.updated_at = now;

  await persistContract(env, state, decomposition);
  return { ok: true, state, decomposition, task };
}

async function blockTask(env, contractId, taskId, reason) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  const task = (decomposition.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: "TASK_NOT_FOUND", message: `Task "${taskId}" not found in contract "${contractId}".` };
  }
  if (task.status !== "queued" && task.status !== "in_progress") {
    return { ok: false, error: "INVALID_TRANSITION", message: `Task "${taskId}" cannot be blocked from status "${task.status}". Must be "queued" or "in_progress".` };
  }

  task.status = "blocked";
  task.block_reason = reason || "No reason provided.";
  const now = new Date().toISOString();
  // If this was the current task, advance to next queued task or clear
  if (state.current_task === taskId) {
    const nextTask = (decomposition.tasks || []).find((t) => t.status === "queued");
    state.current_task = nextTask ? nextTask.id : null;
  }
  state.updated_at = now;

  await persistContract(env, state, decomposition);
  return { ok: true, state, decomposition, task };
}

// ---------------------------------------------------------------------------
// MICRO-PR CANDIDATE STATUS FUNCTIONS
// ---------------------------------------------------------------------------

async function startMicroPrCandidate(env, contractId, microPrId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  const mpr = (decomposition.micro_pr_candidates || []).find((m) => m.id === microPrId);
  if (!mpr) {
    return { ok: false, error: "MICRO_PR_NOT_FOUND", message: `Micro-PR "${microPrId}" not found in contract "${contractId}".` };
  }
  if (mpr.status !== "queued") {
    return { ok: false, error: "INVALID_TRANSITION", message: `Micro-PR "${microPrId}" cannot start from status "${mpr.status}". Must be "queued".` };
  }

  mpr.status = "in_progress";
  state.updated_at = new Date().toISOString();

  await persistContract(env, state, decomposition);
  return { ok: true, state, decomposition, micro_pr_candidate: mpr };
}

async function completeMicroPrCandidate(env, contractId, microPrId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  const mpr = (decomposition.micro_pr_candidates || []).find((m) => m.id === microPrId);
  if (!mpr) {
    return { ok: false, error: "MICRO_PR_NOT_FOUND", message: `Micro-PR "${microPrId}" not found in contract "${contractId}".` };
  }
  if (mpr.status !== "in_progress") {
    return { ok: false, error: "INVALID_TRANSITION", message: `Micro-PR "${microPrId}" cannot complete from status "${mpr.status}". Must be "in_progress".` };
  }

  mpr.status = "completed";
  state.updated_at = new Date().toISOString();

  await persistContract(env, state, decomposition);
  return { ok: true, state, decomposition, micro_pr_candidate: mpr };
}

async function blockMicroPrCandidate(env, contractId, microPrId, reason) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  const mpr = (decomposition.micro_pr_candidates || []).find((m) => m.id === microPrId);
  if (!mpr) {
    return { ok: false, error: "MICRO_PR_NOT_FOUND", message: `Micro-PR "${microPrId}" not found in contract "${contractId}".` };
  }
  if (mpr.status !== "queued" && mpr.status !== "in_progress") {
    return { ok: false, error: "INVALID_TRANSITION", message: `Micro-PR "${microPrId}" cannot be blocked from status "${mpr.status}". Must be "queued" or "in_progress".` };
  }

  mpr.status = "blocked";
  mpr.block_reason = reason || "No reason provided.";
  state.updated_at = new Date().toISOString();

  await persistContract(env, state, decomposition);
  return { ok: true, state, decomposition, micro_pr_candidate: mpr };
}

async function discardMicroPrCandidate(env, contractId, microPrId, reason) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  const mpr = (decomposition.micro_pr_candidates || []).find((m) => m.id === microPrId);
  if (!mpr) {
    return { ok: false, error: "MICRO_PR_NOT_FOUND", message: `Micro-PR "${microPrId}" not found in contract "${contractId}".` };
  }
  if (mpr.status === "completed" || mpr.status === "discarded") {
    return { ok: false, error: "INVALID_TRANSITION", message: `Micro-PR "${microPrId}" cannot be discarded from status "${mpr.status}".` };
  }

  mpr.status = "discarded";
  mpr.discard_reason = reason || "No reason provided.";
  state.updated_at = new Date().toISOString();

  await persistContract(env, state, decomposition);
  return { ok: true, state, decomposition, micro_pr_candidate: mpr };
}

// ============================================================================
// 🎯 Next Action Engine — Deterministic Executable Queue
//
// Canonical function to resolve the next executable action for a contract.
// Considers: current phase, task statuses, task dependencies, micro-PR
// candidate statuses, and blockers.
//
// Returns a structured NextAction object — never a loose string.
// ============================================================================

// ---------------------------------------------------------------------------
// Next Action Types (exhaustive enum)
// ---------------------------------------------------------------------------
const NEXT_ACTION_TYPES = [
  "start_task",
  "start_micro_pr",
  "phase_complete",
  "contract_complete",
  "contract_blocked",
  "awaiting_human_approval",
  "no_action",
];

// ---------------------------------------------------------------------------
// resolveNextAction(state, decomposition) → NextAction
//
// Pure function. Does NOT mutate state or decomposition.
// Returns:
//   { type, phase_id, task_id, micro_pr_candidate_id, reason, status }
// ---------------------------------------------------------------------------
function resolveNextAction(state, decomposition) {
  // Guard: missing data
  if (!state || !decomposition) {
    return {
      type: "no_action",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: "Missing state or decomposition — cannot resolve next action.",
      status: "error",
    };
  }

  const phases = decomposition.phases || [];
  const tasks = decomposition.tasks || [];
  const mprs = decomposition.micro_pr_candidates || [];
  const blockers = state.blockers || [];

  // ── Rule 1: Contract already completed ──
  if (state.status_global === "completed" || state.current_phase === "all_phases_complete") {
    return {
      type: "contract_complete",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: "All phases and tasks are complete.",
      status: "completed",
    };
  }

  // ── Rule 2: Contract blocked at ingestion level ──
  if (state.current_phase === "ingestion_blocked") {
    return {
      type: "contract_blocked",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: blockers.length > 0
        ? `Ingestion blocked: ${blockers.join("; ")}`
        : "Contract is blocked at ingestion.",
      status: "blocked",
    };
  }

  // ── Rule 3: All phases done but contract not yet completed ──
  // This covers the case where human approval is needed for final sign-off.
  // (See awaiting_human_approval return below after active phase check.)

  // ── Determine active phase ──
  const activePhase = phases.find((p) => p.status !== "done");

  if (!activePhase) {
    // All phases done but status_global not yet "completed" — waiting for sign-off
    return {
      type: "awaiting_human_approval",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: "All phases are done. Awaiting final human sign-off.",
      status: "awaiting_approval",
    };
  }

  // ── Gather tasks for the active phase ──
  const phaseTasks = tasks.filter((t) => activePhase.tasks.includes(t.id));

  // ── Rule 4: Check if ALL phase tasks are complete → phase_complete ──
  const incompleteInPhase = phaseTasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status));
  if (incompleteInPhase.length === 0 && phaseTasks.length > 0) {
    return {
      type: "phase_complete",
      phase_id: activePhase.id,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: `All tasks in phase "${activePhase.id}" are complete. Ready to advance.`,
      status: "ready",
    };
  }

  // ── Rule 5: Find the next executable task ──
  // A task is executable if:
  //   - it is in the active phase
  //   - its status is "queued"
  //   - all its dependencies are satisfied (status in TASK_DONE_STATUSES)
  for (const task of phaseTasks) {
    if (task.status !== "queued") continue;

    const deps = task.depends_on || [];
    const allDepsSatisfied = deps.every((depId) => {
      const depTask = tasks.find((t) => t.id === depId);
      return depTask && TASK_DONE_STATUSES.includes(depTask.status);
    });

    if (allDepsSatisfied) {
      // Found an executable task — now check if it has a corresponding micro-PR
      const correspondingMpr = mprs.find((m) => m.task_id === task.id && m.status === "queued");
      return {
        type: "start_task",
        phase_id: activePhase.id,
        task_id: task.id,
        micro_pr_candidate_id: correspondingMpr ? correspondingMpr.id : null,
        reason: `Task "${task.id}" is ready to start (all dependencies satisfied).`,
        status: "ready",
      };
    }
  }

  // ── Rule 6: Check for executable micro-PR candidates ──
  // A micro-PR is executable if:
  //   - its linked task is completed (or it has no linked task)
  //   - its status is "queued"
  for (const mpr of mprs) {
    if (mpr.status !== "queued") continue;

    if (mpr.task_id) {
      const linkedTask = tasks.find((t) => t.id === mpr.task_id);
      if (linkedTask && TASK_DONE_STATUSES.includes(linkedTask.status)) {
        return {
          type: "start_micro_pr",
          phase_id: activePhase.id,
          task_id: mpr.task_id,
          micro_pr_candidate_id: mpr.id,
          reason: `Micro-PR "${mpr.id}" is ready (linked task "${mpr.task_id}" is complete).`,
          status: "ready",
        };
      }
    } else {
      // Micro-PR without a linked task (e.g., PROD promotion)
      // Only ready if all tasks are done
      const allTasksDone = tasks.every((t) => TASK_DONE_STATUSES.includes(t.status));
      if (allTasksDone) {
        return {
          type: "start_micro_pr",
          phase_id: activePhase.id,
          task_id: null,
          micro_pr_candidate_id: mpr.id,
          reason: `Micro-PR "${mpr.id}" is ready (no linked task; all tasks complete).`,
          status: "ready",
        };
      }
    }
  }

  // ── Rule 7: Check if all remaining tasks are blocked → contract_blocked ──
  const remainingTasks = phaseTasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status));
  const allBlocked = remainingTasks.length > 0 && remainingTasks.every((t) => t.status === "blocked");
  if (allBlocked) {
    const blockedIds = remainingTasks.map((t) => t.id).join(", ");
    return {
      type: "contract_blocked",
      phase_id: activePhase.id,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: `All remaining tasks in phase "${activePhase.id}" are blocked: ${blockedIds}.`,
      status: "blocked",
    };
  }

  // ── Rule 8: Tasks exist but none are executable (dependency not satisfied) ──
  const queuedTasks = phaseTasks.filter((t) => t.status === "queued");
  if (queuedTasks.length > 0) {
    // There are queued tasks, but their dependencies aren't met
    const waitingOn = [];
    for (const task of queuedTasks) {
      for (const depId of (task.depends_on || [])) {
        const depTask = tasks.find((t) => t.id === depId);
        if (depTask && !TASK_DONE_STATUSES.includes(depTask.status)) {
          waitingOn.push(`"${task.id}" waits on "${depId}" (${depTask.status})`);
        }
      }
    }
    return {
      type: "contract_blocked",
      phase_id: activePhase.id,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: `No executable tasks — unmet dependencies: ${waitingOn.join("; ")}.`,
      status: "blocked",
    };
  }

  // ── Rule 9: Tasks in progress — just wait ──
  const inProgressTasks = phaseTasks.filter((t) => t.status === "in_progress");
  if (inProgressTasks.length > 0) {
    return {
      type: "no_action",
      phase_id: activePhase.id,
      task_id: inProgressTasks[0].id,
      micro_pr_candidate_id: null,
      reason: `Task "${inProgressTasks[0].id}" is currently in progress. Waiting for completion.`,
      status: "in_progress",
    };
  }

  // ── Fallback: no action determinable ──
  return {
    type: "no_action",
    phase_id: activePhase ? activePhase.id : null,
    task_id: null,
    micro_pr_candidate_id: null,
    reason: "No executable action found.",
    status: "idle",
  };
}

// ============================================================================
// 📦 B3 — Execution Handoff Builder
//
// Pure function. Does NOT mutate state or decomposition.
// Reads the resolved next action and builds a canonical execution handoff
// ready for the next micro-PR execution step.
//
// Returns null when there is no actionable next step (contract complete,
// blocked, awaiting human, no_action, etc.).
//
// Returns { objective, scope, target_files, do_not_touch, smoke_tests,
//           rollback, acceptance_criteria, source_phase, source_task,
//           source_micro_pr, generated_at }
// ============================================================================

// Actionable next-action types that warrant a handoff
const HANDOFF_ACTIONABLE_TYPES = ["start_task", "start_micro_pr"];

function buildExecutionHandoff(state, decomposition) {
  // ── Guard: missing data → controlled null ──
  if (!state || !decomposition) {
    return null;
  }

  const nextAction = resolveNextAction(state, decomposition);

  // Only build handoff for actionable types
  if (!nextAction || !HANDOFF_ACTIONABLE_TYPES.includes(nextAction.type)) {
    return null;
  }

  const tasks = decomposition.tasks || [];
  const mprs = decomposition.micro_pr_candidates || [];
  const phases = decomposition.phases || [];

  // Locate the target task and micro-PR
  const targetTask = nextAction.task_id
    ? tasks.find((t) => t.id === nextAction.task_id)
    : null;
  const targetMpr = nextAction.micro_pr_candidate_id
    ? mprs.find((m) => m.id === nextAction.micro_pr_candidate_id)
    : null;
  const targetPhase = nextAction.phase_id
    ? phases.find((p) => p.id === nextAction.phase_id)
    : null;

  // ── Objective — derived from task description or micro-PR title ──
  const objective = targetTask
    ? targetTask.description
    : targetMpr
      ? targetMpr.title
      : nextAction.reason;

  // If we cannot derive a meaningful objective, refuse to produce handoff
  if (!objective) {
    return null;
  }

  // ── Scope — from contract scope + micro-PR targets ──
  const scopeWorkers = targetMpr
    ? (targetMpr.target_workers || [])
    : (state.scope && state.scope.workers) || [];
  const scopeRoutes = targetMpr
    ? (targetMpr.target_routes || [])
    : (state.scope && state.scope.routes) || [];
  const scope = {
    environment: targetMpr ? targetMpr.environment : "TEST",
    workers: scopeWorkers,
    routes: scopeRoutes,
    phase: targetPhase ? targetPhase.name : (nextAction.phase_id || null),
  };

  // ── Target files — deterministic from scope workers ──
  const targetFiles = [];
  for (const worker of scope.workers) {
    if (worker === "nv-enavia") {
      targetFiles.push("nv-enavia.js", "contract-executor.js", "wrangler.toml");
    } else {
      targetFiles.push(`${worker}.js`);
    }
  }
  if (scope.routes.length > 0) {
    targetFiles.push("tests/contracts-smoke.test.js");
  }

  // ── Do not touch — hard boundaries from contract governance ──
  const doNotTouch = [
    "PROD environment (unless handoff environment is PROD and human-approved)",
    "Unrelated workers or routes outside contract scope",
    "KV bindings not listed in contract scope",
    "Existing tests unrelated to this task",
  ];

  // ── Smoke tests — derived from the task's definition_of_done linkage ──
  const smokeTests = [];
  if (targetTask) {
    smokeTests.push(`Verify: ${targetTask.description}`);
  }
  if (targetMpr && targetMpr.environment === "TEST") {
    smokeTests.push("Deploy to TEST and validate endpoint behavior");
    smokeTests.push("Confirm no regression on existing routes");
  }
  if (targetMpr && targetMpr.environment === "PROD") {
    smokeTests.push("Human-approved promotion to PROD");
    smokeTests.push("Post-deploy smoke test in PROD");
  }
  if (smokeTests.length === 0) {
    smokeTests.push("Verify task completion criteria");
  }

  // ── Rollback — deterministic per environment ──
  const rollback = targetMpr && targetMpr.environment === "PROD"
    ? "Immediate rollback via wrangler rollback; notify operator."
    : "Revert branch changes; redeploy previous TEST version.";

  // ── Acceptance criteria — from definition_of_done + task-specific ──
  const acceptanceCriteria = [];
  if (targetTask) {
    acceptanceCriteria.push(targetTask.description);
  }
  if (targetMpr && targetMpr.environment === "TEST") {
    acceptanceCriteria.push("Smoke test in TEST passes");
  }
  if (targetMpr && targetMpr.environment === "PROD") {
    acceptanceCriteria.push("Human approval received for PROD promotion");
    acceptanceCriteria.push("Smoke test in PROD passes");
  }
  acceptanceCriteria.push("No new blockers introduced");

  return {
    objective,
    scope,
    target_files: targetFiles,
    do_not_touch: doNotTouch,
    smoke_tests: smokeTests,
    rollback,
    acceptance_criteria: acceptanceCriteria,
    source_phase: nextAction.phase_id,
    source_task: nextAction.task_id,
    source_micro_pr: nextAction.micro_pr_candidate_id,
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Build enhanced contract summary with real progress
// ---------------------------------------------------------------------------
function buildContractSummary(state, decomposition) {
  const tasks = (decomposition && decomposition.tasks) || [];
  const mprs = (decomposition && decomposition.micro_pr_candidates) || [];

  const tasksCompleted = tasks.filter((t) => TASK_DONE_STATUSES.includes(t.status)).length;
  const tasksBlocked = tasks.filter((t) => t.status === "blocked").length;
  const tasksInProgress = tasks.filter((t) => t.status === "in_progress").length;
  const tasksQueued = tasks.filter((t) => t.status === "queued").length;

  const mprsCompleted = mprs.filter((m) => m.status === "completed").length;
  const mprsBlocked = mprs.filter((m) => m.status === "blocked").length;
  const mprsInProgress = mprs.filter((m) => m.status === "in_progress").length;
  const mprsQueued = mprs.filter((m) => m.status === "queued").length;
  const mprsDiscarded = mprs.filter((m) => m.status === "discarded").length;

  // Resolve the structured next action
  const nextActionResolved = resolveNextAction(state, decomposition);

  // B3 — Build execution handoff from resolved next action
  const executionHandoff = buildExecutionHandoff(state, decomposition);

  return {
    contract_id: state.contract_id,
    contract_name: state.contract_name,
    status_global: state.status_global,
    current_phase: state.current_phase,
    current_task: state.current_task,
    blockers: state.blockers,
    next_action: state.next_action,
    next_action_resolved: nextActionResolved,
    execution_handoff: executionHandoff,
    tasks_total: tasks.length,
    tasks_completed: tasksCompleted,
    tasks_blocked: tasksBlocked,
    tasks_in_progress: tasksInProgress,
    tasks_queued: tasksQueued,
    micro_pr_candidates_total: mprs.length,
    micro_pr_candidates_completed: mprsCompleted,
    micro_pr_candidates_blocked: mprsBlocked,
    micro_pr_candidates_in_progress: mprsInProgress,
    micro_pr_candidates_queued: mprsQueued,
    micro_pr_candidates_discarded: mprsDiscarded,
    phases_count: decomposition ? decomposition.phases.length : 0,
    created_at: state.created_at,
    updated_at: state.updated_at,
  };
}

// ============================================================================
// 🌐 Route Handlers
// ============================================================================

// POST /contracts — Create a new contract
async function handleCreateContract(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }

  // Validate
  const validation = validateContractPayload(body);
  if (!validation.valid) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Contract payload is invalid.",
        details: validation.errors,
      },
    };
  }

  // Check for duplicate
  const existing = await readContractState(env, body.contract_id);
  if (existing) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "CONTRACT_ALREADY_EXISTS",
        message: `Contract "${body.contract_id}" already exists.`,
        contract_id: body.contract_id,
        status_global: existing.status_global,
      },
    };
  }

  // Build state
  const state = buildInitialState(body);

  // Check for structural blockers
  const blockers = [];
  if (!state.scope.environments || state.scope.environments.length === 0) {
    blockers.push("scope.environments is empty — cannot determine target environments.");
  }
  if (!state.definition_of_done || state.definition_of_done.length === 0) {
    blockers.push("definition_of_done is empty — cannot decompose contract.");
  }

  if (blockers.length > 0) {
    state.status_global = "blocked";
    state.current_phase = "ingestion_blocked";
    state.blockers = blockers;
    state.next_action = "Resolve blockers before proceeding.";
  }

  // Generate decomposition
  const decomposition = generateDecomposition(state);

  // Persist
  await persistContract(env, state, decomposition);

  return {
    status: 201,
    body: {
      ok: true,
      contract_id: state.contract_id,
      status_global: state.status_global,
      phases_count: decomposition.phases.length,
      tasks_count: decomposition.tasks.length,
      micro_pr_candidates_count: decomposition.micro_pr_candidates.length,
      next_action: state.next_action,
      created_at: state.created_at,
    },
  };
}

// GET /contracts?id=<id> — Read full contract state + decomposition
async function handleGetContract(env, contractId) {
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: 'Query parameter "id" is required.' },
    };
  }

  const state = await readContractState(env, contractId);
  if (!state) {
    return {
      status: 404,
      body: { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` },
    };
  }

  const decomposition = await readContractDecomposition(env, contractId);

  return {
    status: 200,
    body: {
      ok: true,
      contract: state,
      decomposition: decomposition || null,
    },
  };
}

// GET /contracts/summary?id=<id> — Read contract summary
async function handleGetContractSummary(env, contractId) {
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: 'Query parameter "id" is required.' },
    };
  }

  const state = await readContractState(env, contractId);
  if (!state) {
    return {
      status: 404,
      body: { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` },
    };
  }

  const decomposition = await readContractDecomposition(env, contractId);

  return {
    status: 200,
    body: Object.assign({ ok: true }, buildContractSummary(state, decomposition)),
  };
}

// ============================================================================
// Exports
// ============================================================================
export {
  validateContractPayload,
  buildInitialState,
  generateDecomposition,
  persistContract,
  readContractState,
  readContractDecomposition,
  // Invariants (Rules 1, 2, 3)
  rehydrateContract,
  checkPhaseGate,
  isValidPhaseValue,
  advanceContractPhase,
  TASK_DONE_STATUSES,
  SPECIAL_PHASES,
  VALID_TASK_STATUSES,
  VALID_MICRO_PR_STATUSES,
  // Canonical status change functions — single path
  startTask,
  completeTask,
  blockTask,
  startMicroPrCandidate,
  completeMicroPrCandidate,
  blockMicroPrCandidate,
  discardMicroPrCandidate,
  // Next Action Engine
  resolveNextAction,
  NEXT_ACTION_TYPES,
  // B3 — Execution Handoff Builder
  buildExecutionHandoff,
  HANDOFF_ACTIONABLE_TYPES,
  // Summary
  buildContractSummary,
  // Route handlers
  handleCreateContract,
  handleGetContract,
  handleGetContractSummary,
};
