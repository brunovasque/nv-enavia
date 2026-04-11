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

// ============================================================================
// 📎 B4 — Acceptance Criteria Binder
//
// Pure function. Does NOT mutate state or decomposition.
// Resolves acceptance criteria for the current phase, task, and handoff,
// producing a canonical structure that can be persisted and rehydrated.
//
// Each criterion has:
//   id, scope, description, status, evidence_required, blocking
//
// Returns { phase_acceptance, task_acceptance, handoff_acceptance,
//           generated_at } or a controlled empty structure when data is
//           insufficient.
// ============================================================================

// Valid scopes for acceptance criteria
const ACCEPTANCE_CRITERIA_SCOPES = ["phase", "task", "handoff"];

// Valid statuses for acceptance criteria
const ACCEPTANCE_CRITERIA_STATUSES = ["pending", "passed", "failed", "waived"];

/**
 * Build a single canonical acceptance criterion object.
 */
function buildCriterion(id, scope, description, options) {
  const opts = options || {};
  return {
    id,
    scope,
    description,
    status: "pending",
    evidence_required: opts.evidence_required !== undefined ? opts.evidence_required : true,
    blocking: opts.blocking !== undefined ? opts.blocking : true,
  };
}

/**
 * bindAcceptanceCriteria(state, decomposition) → AcceptanceCriteriaBinding
 *
 * Pure, deterministic binder. Associates acceptance criteria to the current
 * phase, current task, and (when applicable) the current execution handoff.
 *
 * Returns null only when state or decomposition are missing entirely.
 * Returns a controlled empty binding when minimal data is absent.
 */
function bindAcceptanceCriteria(state, decomposition) {
  // ── Guard: missing data → null ──
  if (!state || !decomposition) {
    return null;
  }

  const phases = decomposition.phases || [];
  const tasks = decomposition.tasks || [];
  const dod = state.definition_of_done || [];

  // ── Resolve the active phase ──
  // First try to match current_phase from state to a decomposition phase.
  // Fallback: if current_phase is a special value (e.g. "decomposition_complete"),
  // find the first incomplete phase from the decomposition.
  const activePhase = phases.find((p) => p.id === state.current_phase)
    || phases.find((p) => p.status !== "done");

  // ── Phase acceptance criteria ──
  const phaseAcceptance = [];
  if (activePhase) {
    // One criterion per task in this phase: all must complete
    const phaseTasks = tasks.filter((t) => (activePhase.tasks || []).includes(t.id));
    phaseTasks.forEach((t, idx) => {
      phaseAcceptance.push(
        buildCriterion(
          `phase_ac_${String(idx + 1).padStart(3, "0")}`,
          "phase",
          `Task "${t.id}" in phase "${activePhase.id}" must be completed: ${t.description}`,
          { evidence_required: true, blocking: true }
        )
      );
    });

    // If the phase has no tasks, add a structural criterion
    if (phaseTasks.length === 0) {
      phaseAcceptance.push(
        buildCriterion(
          "phase_ac_001",
          "phase",
          `Phase "${activePhase.id}" has no tasks — structural pass required.`,
          { evidence_required: false, blocking: false }
        )
      );
    }
  }

  // ── Task acceptance criteria ──
  const taskAcceptance = [];
  const currentTaskId = state.current_task;
  const currentTask = currentTaskId
    ? tasks.find((t) => t.id === currentTaskId)
    : null;

  if (currentTask) {
    // Primary criterion: the task's own definition_of_done item
    taskAcceptance.push(
      buildCriterion(
        "task_ac_001",
        "task",
        currentTask.description,
        { evidence_required: true, blocking: true }
      )
    );

    // Dependency criteria: all deps must already be done
    const deps = currentTask.depends_on || [];
    deps.forEach((depId, idx) => {
      const depTask = tasks.find((t) => t.id === depId);
      const depDesc = depTask ? depTask.description : depId;
      taskAcceptance.push(
        buildCriterion(
          `task_ac_dep_${String(idx + 1).padStart(3, "0")}`,
          "task",
          `Dependency "${depId}" must be satisfied: ${depDesc}`,
          { evidence_required: true, blocking: true }
        )
      );
    });

    // No-regression criterion
    taskAcceptance.push(
      buildCriterion(
        "task_ac_no_regression",
        "task",
        "No new blockers introduced by this task.",
        { evidence_required: true, blocking: true }
      )
    );
  }

  // ── Handoff acceptance criteria ──
  const handoffAcceptance = [];
  const handoff = buildExecutionHandoff(state, decomposition);
  if (handoff) {
    // Mirror the handoff's own acceptance_criteria as structured objects
    const handoffCriteriaSource = handoff.acceptance_criteria || [];
    handoffCriteriaSource.forEach((desc, idx) => {
      handoffAcceptance.push(
        buildCriterion(
          `handoff_ac_${String(idx + 1).padStart(3, "0")}`,
          "handoff",
          desc,
          { evidence_required: true, blocking: true }
        )
      );
    });
  }

  return {
    phase_acceptance: phaseAcceptance,
    task_acceptance: taskAcceptance,
    handoff_acceptance: handoffAcceptance,
    current_phase: activePhase ? activePhase.id : state.current_phase,
    current_task: currentTaskId || null,
    has_handoff: handoff !== null,
    generated_at: new Date().toISOString(),
  };
}

// ============================================================================
// 🔁 B5 — Controlled Error Loop
//
// Deterministic, persistable error loop for micro-PR/task execution errors.
// Does NOT execute micro-PRs, advance phases, or close contracts.
// Only records errors, counts retries, and decides safe continuity state.
//
// The error loop is stored on the contract state as `error_loop` and survives
// KV rehydration. Each task/micro-PR has its own entry keyed by task_id.
//
// Error classification determines retry eligibility:
//   - "in_scope"   → retryable if within limits and cause is identified
//   - "infra"      → escalates immediately (missing secret/binding/dependency)
//   - "external"   → escalates immediately (out-of-contract dependency)
//   - "unknown"    → escalates immediately (cause not identified)
//
// Loop statuses:
//   - "retrying"        → retry allowed, within limits
//   - "blocked"         → retry exhausted or non-retryable error
//   - "awaiting_human"  → requires human intervention
//   - "clear"           → no errors recorded
// ============================================================================

// ---------------------------------------------------------------------------
// Error Loop Constants
// ---------------------------------------------------------------------------
const MAX_RETRY_ATTEMPTS = 3;

const ERROR_CLASSIFICATIONS = ["in_scope", "infra", "external", "unknown"];

const ERROR_LOOP_STATUSES = ["clear", "retrying", "blocked", "awaiting_human"];

// Classifications that are NOT eligible for automatic retry
const NON_RETRYABLE_CLASSIFICATIONS = ["infra", "external", "unknown"];

// ---------------------------------------------------------------------------
// buildErrorEntry(params) → canonical error entry
//
// Pure function. Builds a single error entry for the error loop history.
// ---------------------------------------------------------------------------
function buildErrorEntry(params) {
  const p = params || {};
  return {
    code: p.code || "UNKNOWN_ERROR",
    scope: p.scope || "task",
    message: p.message || "No message provided.",
    retryable: p.retryable !== undefined ? p.retryable : false,
    reason: p.reason || null,
    attempt: typeof p.attempt === "number" ? p.attempt : 1,
    max_attempts: typeof p.max_attempts === "number" ? p.max_attempts : MAX_RETRY_ATTEMPTS,
    resolution_state: p.resolution_state || "unresolved",
    classification: ERROR_CLASSIFICATIONS.includes(p.classification)
      ? p.classification
      : "unknown",
    recorded_at: p.recorded_at || new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// evaluateErrorLoop(errorLoop, taskId) → { loop_status, retry_allowed,
//   active_retry_count, retry_count, last_error, escalation_reason }
//
// Pure function. Evaluates the current error loop state for a given task.
// Does NOT mutate anything.
//
// `active_retry_count` is the counter for the current retry cycle — used for
// all retry/escalation decisions. `retry_count` is kept as total error history
// length for observability but is NOT used for decision-making.
// ---------------------------------------------------------------------------
function evaluateErrorLoop(errorLoop, taskId) {
  const defaultResult = {
    loop_status: "clear",
    retry_allowed: false,
    active_retry_count: 0,
    retry_count: 0,
    last_error: null,
    escalation_reason: null,
  };

  if (!errorLoop || !taskId) {
    return defaultResult;
  }

  const taskLoop = errorLoop[taskId];
  if (!taskLoop || !Array.isArray(taskLoop.errors) || taskLoop.errors.length === 0) {
    return defaultResult;
  }

  const errors = taskLoop.errors;
  const lastError = errors[errors.length - 1];
  const activeRetryCount = typeof taskLoop.active_retry_count === "number"
    ? taskLoop.active_retry_count
    : errors.length;
  const totalErrorCount = errors.length;
  const maxAttempts = MAX_RETRY_ATTEMPTS;

  // Non-retryable classification → immediate escalation
  if (NON_RETRYABLE_CLASSIFICATIONS.includes(lastError.classification)) {
    let escalationReason;
    if (lastError.classification === "infra") {
      escalationReason = "Infrastructure/secret/binding/dependency error — requires human intervention.";
    } else if (lastError.classification === "external") {
      escalationReason = "External dependency outside contract scope — requires human intervention.";
    } else {
      escalationReason = "Unknown error cause — cannot determine safe retry path.";
    }
    return {
      loop_status: "awaiting_human",
      retry_allowed: false,
      active_retry_count: activeRetryCount,
      retry_count: totalErrorCount,
      last_error: lastError,
      escalation_reason: escalationReason,
    };
  }

  // Retry limit reached — uses active_retry_count, not total history
  if (activeRetryCount >= maxAttempts) {
    return {
      loop_status: "blocked",
      retry_allowed: false,
      active_retry_count: activeRetryCount,
      retry_count: totalErrorCount,
      last_error: lastError,
      escalation_reason: `Retry limit reached (${activeRetryCount}/${maxAttempts}) for task "${taskId}".`,
    };
  }

  // Retryable and within limits
  if (lastError.retryable && lastError.classification === "in_scope") {
    return {
      loop_status: "retrying",
      retry_allowed: true,
      active_retry_count: activeRetryCount,
      retry_count: totalErrorCount,
      last_error: lastError,
      escalation_reason: null,
    };
  }

  // Fallback: not clearly retryable → escalate
  return {
    loop_status: "awaiting_human",
    retry_allowed: false,
    active_retry_count: activeRetryCount,
    retry_count: totalErrorCount,
    last_error: lastError,
    escalation_reason: `Error not eligible for retry: retryable=${lastError.retryable}, classification="${lastError.classification}".`,
  };
}

// ---------------------------------------------------------------------------
// recordError(env, contractId, taskId, errorParams) → { ok, state,
//   decomposition, error_loop, evaluation }
//
// Records a canonical error in the error loop for a given task.
// Rehydrates from KV, appends the error, evaluates the loop, and persists.
// Does NOT advance phases, complete tasks, or execute micro-PRs.
// ---------------------------------------------------------------------------
async function recordError(env, contractId, taskId, errorParams) {
  // INVARIANT 1+3 — rehydrate from KV
  const { state, decomposition } = await rehydrateContract(env, contractId);

  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (!decomposition) {
    return { ok: false, error: "DECOMPOSITION_NOT_FOUND", message: `Decomposition for "${contractId}" not found.` };
  }

  // Validate task exists
  const task = (decomposition.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: "TASK_NOT_FOUND", message: `Task "${taskId}" not found in contract "${contractId}".` };
  }

  // Guard: cannot record error on completed/discarded task
  if (TASK_DONE_STATUSES.includes(task.status)) {
    return {
      ok: false,
      error: "INVALID_ERROR_RECORD",
      message: `Task "${taskId}" has status "${task.status}" — cannot record error on completed/done task.`,
    };
  }

  // Guard: cannot record error on blocked task — blocked is a formal stop
  if (task.status === "blocked") {
    return {
      ok: false,
      error: "TASK_BLOCKED",
      message: `Task "${taskId}" is blocked — cannot record new error. Resolve the block first.`,
    };
  }

  // Guard: cannot record error when the error loop itself is already blocked —
  // prevents bypassing the retry limit by registering a new error with a larger
  // max_attempts after the canonical limit was already reached.
  if (state.error_loop && state.error_loop[taskId] && state.error_loop[taskId].loop_status === "blocked") {
    return {
      ok: false,
      error: "TASK_BLOCKED",
      message: `Task "${taskId}" error loop is blocked — cannot record new error. Resolve the block first.`,
    };
  }

  // Initialize error_loop on state if absent
  if (!state.error_loop) {
    state.error_loop = {};
  }

  // Initialize task error loop entry if absent
  if (!state.error_loop[taskId]) {
    state.error_loop[taskId] = {
      errors: [],
      active_retry_count: 0,
      loop_status: "clear",
      retry_count: 0,
      last_error: null,
      retry_allowed: false,
      escalation_reason: null,
    };
  }

  const taskLoop = state.error_loop[taskId];

  // Increment active retry count for the current cycle
  taskLoop.active_retry_count = (taskLoop.active_retry_count || 0) + 1;

  // Build and record the error entry — always use canonical MAX_RETRY_ATTEMPTS;
  // caller-supplied max_attempts is ignored to keep the limit immutable.
  const attempt = taskLoop.active_retry_count;
  const entry = buildErrorEntry(
    Object.assign({}, errorParams, { attempt, max_attempts: MAX_RETRY_ATTEMPTS })
  );
  taskLoop.errors.push(entry);

  // Evaluate the loop state after recording
  const evaluation = evaluateErrorLoop(state.error_loop, taskId);

  // Persist evaluation results back into the task loop
  taskLoop.loop_status = evaluation.loop_status;
  taskLoop.active_retry_count = evaluation.active_retry_count;
  taskLoop.retry_count = evaluation.retry_count;
  taskLoop.last_error = evaluation.last_error;
  taskLoop.retry_allowed = evaluation.retry_allowed;
  taskLoop.escalation_reason = evaluation.escalation_reason;

  // Update timestamp
  state.updated_at = new Date().toISOString();

  // Persist to KV (do NOT change task status, phase, or contract status)
  await env.ENAVIA_BRAIN.put(
    `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_STATE}`,
    JSON.stringify(state)
  );

  return {
    ok: true,
    state,
    decomposition,
    error_loop: state.error_loop,
    evaluation,
  };
}

// ============================================================================
// 🚀 C1 — Real Micro-PR Execution in TEST
//
// Canonical execution function for the current micro-PR in TEST environment.
// Requires a valid current_task and execution_handoff. Persists execution
// state on the contract and integrates with the error_loop on failure.
//
// Does NOT:
//   - Close the contract
//   - Promote to PROD
//   - Advance phases by itself
//   - Skip tasks or phases
//   - Invent success without evidence
//
// Execution state is stored in `state.current_execution` and survives KV
// rehydration. Each execution is deterministic and traceable.
// ============================================================================

// ---------------------------------------------------------------------------
// Valid execution statuses
// ---------------------------------------------------------------------------
const EXECUTION_STATUSES = ["pending", "running", "success", "failed", "skipped"];

// ---------------------------------------------------------------------------
// executeCurrentMicroPr(env, contractId, executionParams) → result
//
// executionParams (optional):
//   - evidence: string[]  — evidence lines from the execution
//   - simulate_failure: { code, message, classification } — for test harness
//
// Flow:
//   1. Rehydrate from KV (INVARIANT 1+3)
//   2. Validate current_task exists and is in_progress
//   3. Build execution_handoff and validate it
//   4. Ensure handoff targets TEST environment
//   5. Record execution start
//   6. Execute (or simulate for test harness)
//   7. On success → persist evidence, update micro-step
//   8. On failure → persist error, feed error_loop
//   9. Persist full state to KV
// ---------------------------------------------------------------------------
async function executeCurrentMicroPr(env, contractId, executionParams) {
  const params = executionParams || {};

  // ── INVARIANT 1+3: Rehydrate from KV ──
  const { state, decomposition } = await rehydrateContract(env, contractId);

  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (!decomposition) {
    return { ok: false, error: "DECOMPOSITION_NOT_FOUND", message: `Decomposition for "${contractId}" not found.` };
  }

  // ── Gate 1: current_task must exist and be valid ──
  const currentTaskId = state.current_task;
  if (!currentTaskId) {
    return { ok: false, error: "NO_CURRENT_TASK", message: "No current_task set on contract — cannot execute." };
  }

  const task = (decomposition.tasks || []).find((t) => t.id === currentTaskId);
  if (!task) {
    return { ok: false, error: "TASK_NOT_FOUND", message: `Current task "${currentTaskId}" not found in decomposition.` };
  }

  // ── Gate 2: task must be in_progress (already started via startTask) ──
  if (task.status !== "in_progress") {
    return {
      ok: false,
      error: "TASK_NOT_IN_PROGRESS",
      message: `Task "${currentTaskId}" has status "${task.status}" — must be "in_progress" to execute.`,
    };
  }

  // ── Gate 3: Build execution_handoff for the current in-progress task ──
  // NOTE: buildExecutionHandoff() uses resolveNextAction() which returns "no_action"
  // for tasks already in_progress. For C1, we build the handoff directly from the
  // current task and its micro-PR, since the task is already started.
  const phases = decomposition.phases || [];
  const tasks = decomposition.tasks || [];
  const mprs = decomposition.micro_pr_candidates || [];
  const activePhase = phases.find((p) => p.tasks && p.tasks.includes(currentTaskId))
    || phases.find((p) => p.status !== "done");
  // Select the TEST micro-PR explicitly: must match task, environment, and actionable status.
  // filter() + explicit pick avoids depending on array order.
  const testMprCandidates = mprs.filter(
    (m) => m.task_id === currentTaskId && m.environment === "TEST" && (m.status === "queued" || m.status === "in_progress")
  );
  const targetMpr = testMprCandidates.length > 0 ? testMprCandidates[0] : null;

  // Gate 3a: A real TEST micro-PR is mandatory for C1 execution
  if (!targetMpr) {
    return {
      ok: false,
      error: "NO_ACTIVE_TEST_MICRO_PR",
      message: `No active TEST micro-PR found for task "${currentTaskId}" — C1 requires a real micro-PR in TEST environment.`,
    };
  }

  const handoffObjective = task.description;
  if (!handoffObjective) {
    return {
      ok: false,
      error: "NO_VALID_HANDOFF",
      message: "Cannot build execution handoff — task has no description.",
    };
  }

  const scopeWorkers = targetMpr.target_workers || [];
  const scopeRoutes = targetMpr.target_routes || [];
  const handoffEnvironment = targetMpr.environment;
  const handoff = {
    objective: handoffObjective,
    scope: {
      environment: handoffEnvironment,
      workers: scopeWorkers,
      routes: scopeRoutes,
      phase: activePhase ? activePhase.name : null,
    },
    target_files: [],
    do_not_touch: [
      "PROD environment (unless handoff environment is PROD and human-approved)",
      "Unrelated workers or routes outside contract scope",
    ],
    smoke_tests: [`Verify: ${task.description}`, "Deploy to TEST and validate endpoint behavior"],
    rollback: "Revert branch changes; redeploy previous TEST version.",
    acceptance_criteria: [task.description, "Smoke test in TEST passes", "No new blockers introduced"],
    source_phase: activePhase ? activePhase.id : null,
    source_task: currentTaskId,
    source_micro_pr: targetMpr.id,
    generated_at: new Date().toISOString(),
  };
  // Build target files from scope workers
  for (const worker of scopeWorkers) {
    if (worker === "nv-enavia") {
      handoff.target_files.push("nv-enavia.js", "contract-executor.js", "wrangler.toml");
    } else {
      handoff.target_files.push(`${worker}.js`);
    }
  }

  // ── Gate 4: Execution must target TEST environment only ──
  if (handoff.scope.environment !== "TEST") {
    return {
      ok: false,
      error: "NOT_TEST_ENVIRONMENT",
      message: `Execution handoff targets "${handoff.scope ? handoff.scope.environment : "unknown"}" — only TEST is allowed in C1.`,
    };
  }

  // ── Record execution start ──
  const executionStartedAt = new Date().toISOString();
  const microPrId = targetMpr.id;

  state.current_execution = {
    contract_id: contractId,
    task_id: currentTaskId,
    micro_pr_id: microPrId,
    handoff_used: handoff,
    execution_status: "running",
    execution_started_at: executionStartedAt,
    execution_finished_at: null,
    execution_evidence: [],
    execution_error: null,
    test_execution: true,
    last_execution_result: null,
  };

  state.updated_at = executionStartedAt;

  // Persist running state immediately so it survives crashes
  await persistContract(env, state, decomposition);

  // ── Execute ──
  let executionSuccess = true;
  let executionError = null;
  let evidence = Array.isArray(params.evidence) ? params.evidence.slice() : [];

  // Simulated failure path (for test harness / controlled testing)
  if (params.simulate_failure) {
    executionSuccess = false;
    executionError = {
      code: params.simulate_failure.code || "EXECUTION_FAILED",
      message: params.simulate_failure.message || "Execution failed during TEST run.",
      classification: params.simulate_failure.classification || "in_scope",
    };
  }

  // ── Record execution result ──
  const executionFinishedAt = new Date().toISOString();

  if (executionSuccess) {
    // ── SUCCESS PATH ──
    // Add canonical evidence
    if (evidence.length === 0) {
      evidence.push(`Task "${currentTaskId}" executed successfully in TEST at ${executionFinishedAt}`);
    }

    state.current_execution.execution_status = "success";
    state.current_execution.execution_finished_at = executionFinishedAt;
    state.current_execution.execution_evidence = evidence;
    state.current_execution.last_execution_result = "success";

    // Update corresponding micro-PR candidate to in_progress if still queued
    if (targetMpr && targetMpr.status === "queued") {
      targetMpr.status = "in_progress";
    }

    // DO NOT complete the task — that is done via completeTask()
    // DO NOT advance phase — that is done via advanceContractPhase()
    // DO NOT close contract — governance rule

    state.updated_at = executionFinishedAt;
    await persistContract(env, state, decomposition);

    return {
      ok: true,
      execution_status: "success",
      task_id: currentTaskId,
      micro_pr_id: microPrId,
      evidence,
      handoff_used: handoff,
      execution_started_at: executionStartedAt,
      execution_finished_at: executionFinishedAt,
      state,
      decomposition,
    };
  } else {
    // ── FAILURE PATH ──
    state.current_execution.execution_status = "failed";
    state.current_execution.execution_finished_at = executionFinishedAt;
    state.current_execution.execution_error = executionError;
    state.current_execution.last_execution_result = "failed";
    state.current_execution.execution_evidence = evidence;

    state.updated_at = executionFinishedAt;
    await persistContract(env, state, decomposition);

    // Feed error_loop via canonical recordError
    const errorResult = await recordError(env, contractId, currentTaskId, {
      code: executionError.code,
      scope: "task",
      message: executionError.message,
      retryable: executionError.classification === "in_scope",
      classification: executionError.classification,
      reason: `Execution failed in TEST: ${executionError.message}`,
    });

    // Re-read state after recordError to get consistent error_loop
    const { state: freshState, decomposition: freshDecomp } = await rehydrateContract(env, contractId);

    return {
      ok: false,
      error: "EXECUTION_FAILED",
      execution_status: "failed",
      task_id: currentTaskId,
      micro_pr_id: microPrId,
      execution_error: executionError,
      evidence,
      handoff_used: handoff,
      execution_started_at: executionStartedAt,
      execution_finished_at: executionFinishedAt,
      error_loop: freshState ? freshState.error_loop : null,
      error_loop_evaluation: errorResult.evaluation || null,
      state: freshState || state,
      decomposition: freshDecomp || decomposition,
    };
  }
}

// ============================================================================
// 🔒 C2 — Automatic Contract Closure in TEST
//
// Canonical closure function for contracts that have completed all execution
// in TEST. Validates every prerequisite deterministically before closing.
//
// Does NOT:
//   - Promote to PROD
//   - Close if any blocker, error, or pending acceptance exists
//   - Close if execution was not successful in TEST
//   - Mask failure as success
//   - Skip rehydration
//
// Closure state is stored in `state.contract_closure` and survives KV
// rehydration. Each closure is deterministic and traceable.
// ============================================================================

// ---------------------------------------------------------------------------
// Valid closure statuses
// ---------------------------------------------------------------------------
const CONTRACT_CLOSURE_STATUSES = ["open", "closed_in_test", "closure_rejected"];

// ---------------------------------------------------------------------------
// closeContractInTest(env, contractId) → result
//
// Flow:
//   1. Rehydrate from KV (INVARIANT 1+3)
//   2. Validate current_execution exists and succeeded in TEST
//   3. Validate no active blockers
//   4. Validate error_loop is not blocked/awaiting_human for current task
//   5. Validate acceptance criteria are not pending/blocking
//   6. Validate all tasks in current phase are done or current task is complete
//   7. Persist canonical closure state
//   8. Return deterministic result
// ---------------------------------------------------------------------------
async function closeContractInTest(env, contractId) {
  // ── INVARIANT 1+3: Rehydrate from KV ──
  const { state, decomposition } = await rehydrateContract(env, contractId);

  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (!decomposition) {
    return { ok: false, error: "DECOMPOSITION_NOT_FOUND", message: `Decomposition for "${contractId}" not found.` };
  }

  // ── Guard: already closed ──
  if (state.contract_closure && state.contract_closure.closure_status === "closed_in_test") {
    return {
      ok: true,
      already_closed: true,
      contract_closure: state.contract_closure,
      message: "Contract already closed in TEST.",
      state,
      decomposition,
    };
  }

  // ── Gate 1: current_execution must exist and be successful in TEST ──
  const exec = state.current_execution;
  if (!exec) {
    return {
      ok: false,
      error: "NO_EXECUTION",
      message: "No execution recorded — cannot close contract without a successful TEST execution.",
    };
  }

  if (exec.execution_status !== "success") {
    return {
      ok: false,
      error: "EXECUTION_NOT_SUCCESSFUL",
      message: `Execution status is "${exec.execution_status}" — must be "success" to close.`,
    };
  }

  if (!exec.test_execution) {
    return {
      ok: false,
      error: "NOT_TEST_EXECUTION",
      message: "Last execution was not a TEST execution — cannot close in TEST without TEST execution.",
    };
  }

  // ── Gate 2: no active blockers on the contract ──
  const blockers = state.blockers || [];
  if (blockers.length > 0) {
    return {
      ok: false,
      error: "ACTIVE_BLOCKERS",
      message: `Contract has ${blockers.length} active blocker(s): ${blockers.join("; ")}`,
    };
  }

  // ── Gate 3: error_loop must not be blocked/awaiting_human for current task ──
  const currentTaskId = exec.task_id || state.current_task;
  if (currentTaskId && state.error_loop && state.error_loop[currentTaskId]) {
    const taskLoop = state.error_loop[currentTaskId];
    if (taskLoop.loop_status === "blocked" || taskLoop.loop_status === "awaiting_human") {
      return {
        ok: false,
        error: "ERROR_LOOP_BLOCKED",
        message: `Error loop for task "${currentTaskId}" is "${taskLoop.loop_status}" — cannot close with active error loop.`,
      };
    }
  }

  // ── Gate 4: acceptance criteria must not have unresolved blocking items ──
  const binding = bindAcceptanceCriteria(state, decomposition);
  if (binding) {
    const allCriteria = [
      ...(binding.phase_acceptance || []),
      ...(binding.task_acceptance || []),
      ...(binding.handoff_acceptance || []),
    ];
    const pendingBlocking = allCriteria.filter(
      (c) => c.status === "pending" && c.blocking === true
    );
    if (pendingBlocking.length > 0) {
      return {
        ok: false,
        error: "ACCEPTANCE_PENDING",
        message: `${pendingBlocking.length} blocking acceptance criteria still pending: ${pendingBlocking.map((c) => c.id).join(", ")}`,
      };
    }
  }

  // ── Gate 5: current task must be in a strictly final state ──
  // Successful execution alone is not enough — the task must have been formally
  // completed (status in TASK_DONE_STATUSES). "in_progress" is NOT sufficient.
  const tasks = decomposition.tasks || [];
  if (currentTaskId) {
    const task = tasks.find((t) => t.id === currentTaskId);
    if (task && !TASK_DONE_STATUSES.includes(task.status)) {
      return {
        ok: false,
        error: "TASK_NOT_CLOSEABLE",
        message: `Task "${currentTaskId}" has status "${task.status}" — must be in a final state (${TASK_DONE_STATUSES.join(", ")}) to close.`,
      };
    }
  }

  // ── All gates passed — persist closure ──
  const closedAt = new Date().toISOString();

  const closureEvidence = [
    `Execution succeeded in TEST at ${exec.execution_finished_at || closedAt}`,
    `Task "${currentTaskId || "unknown"}" execution_status=success`,
    `No active blockers at closure time`,
    `Error loop clear for current task`,
    ...(exec.execution_evidence || []),
  ];

  state.contract_closure = {
    closure_status: "closed_in_test",
    closed_in_test: true,
    closed_at: closedAt,
    closure_evidence: closureEvidence,
    closure_reason: "All canonical closure criteria satisfied in TEST.",
    closed_task_id: currentTaskId || null,
    closed_micro_pr_id: exec.micro_pr_id || null,
    closed_by: "automatic",
    environment: "TEST",
  };

  state.updated_at = closedAt;

  // ── Synchronize global contract state with closure ──
  // The contract's canonical status_global must reflect the TEST closure
  // so there is no divergence between contract_closure and the main state.
  // "test-complete" signals TEST-only closure — "completed" is reserved for
  // the canonical terminal state after full promotion policy is respected.
  state.status_global = "test-complete";
  state.next_action = "Contract closed in TEST. Awaiting PROD promotion decision.";

  // Persist to KV
  await persistContract(env, state, decomposition);

  return {
    ok: true,
    already_closed: false,
    contract_closure: state.contract_closure,
    message: "Contract closed automatically in TEST.",
    state,
    decomposition,
  };
}

// ---------------------------------------------------------------------------
// handleCloseContractInTest(request, env) → { status, body }
//
// Route handler for POST /contracts/close-test
// ---------------------------------------------------------------------------
async function handleCloseContractInTest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }

  const contractId = body.contract_id;
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_CONTRACT_ID", message: "contract_id is required." },
    };
  }

  const result = await closeContractInTest(env, contractId);

  return {
    status: result.ok ? 200 : 400,
    body: {
      ok: result.ok,
      already_closed: result.already_closed || false,
      contract_closure: result.contract_closure || null,
      error: result.error || null,
      message: result.message,
    },
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

  // B4 — Bind acceptance criteria for current phase/task/handoff
  const acceptanceCriteriaBinding = bindAcceptanceCriteria(state, decomposition);

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
    acceptance_criteria_binding: acceptanceCriteriaBinding,
    error_loop: state.error_loop || null,
    current_execution: state.current_execution || null,
    contract_closure: state.contract_closure || null,
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

  // B4 — Bind and persist initial acceptance criteria
  const binding = bindAcceptanceCriteria(state, decomposition);
  state.acceptance_criteria_binding = binding;

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

// POST /contracts/execute — Execute current micro-PR in TEST
async function handleExecuteContract(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }

  const contractId = body && body.contract_id;
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: '"contract_id" is required in the request body.' },
    };
  }

  const result = await executeCurrentMicroPr(env, contractId, {
    evidence: body.evidence || [],
    simulate_failure: body.simulate_failure || null,
  });

  if (result.ok) {
    return {
      status: 200,
      body: {
        ok: true,
        execution_status: result.execution_status,
        task_id: result.task_id,
        micro_pr_id: result.micro_pr_id,
        evidence: result.evidence,
        execution_started_at: result.execution_started_at,
        execution_finished_at: result.execution_finished_at,
      },
    };
  }

  // Determine appropriate HTTP status
  const clientErrors = [
    "NO_CURRENT_TASK", "TASK_NOT_IN_PROGRESS", "NO_VALID_HANDOFF",
    "NOT_TEST_ENVIRONMENT", "TASK_ORDER_MISMATCH", "NO_ACTIVE_TEST_MICRO_PR",
  ];
  const notFoundErrors = ["CONTRACT_NOT_FOUND", "DECOMPOSITION_NOT_FOUND", "TASK_NOT_FOUND"];
  let httpStatus = 500;
  if (clientErrors.includes(result.error)) httpStatus = 409;
  if (notFoundErrors.includes(result.error)) httpStatus = 404;
  if (result.error === "EXECUTION_FAILED") httpStatus = 200; // execution ran but failed

  return {
    status: httpStatus,
    body: {
      ok: false,
      error: result.error,
      message: result.message || "Execution failed.",
      execution_status: result.execution_status || null,
      task_id: result.task_id || null,
      micro_pr_id: result.micro_pr_id || null,
      execution_error: result.execution_error || null,
      error_loop_evaluation: result.error_loop_evaluation || null,
    },
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
  // B4 — Acceptance Criteria Binder
  bindAcceptanceCriteria,
  ACCEPTANCE_CRITERIA_SCOPES,
  ACCEPTANCE_CRITERIA_STATUSES,
  // B5 — Controlled Error Loop
  recordError,
  evaluateErrorLoop,
  buildErrorEntry,
  MAX_RETRY_ATTEMPTS,
  ERROR_CLASSIFICATIONS,
  ERROR_LOOP_STATUSES,
  NON_RETRYABLE_CLASSIFICATIONS,
  // C1 — Real Micro-PR Execution in TEST
  executeCurrentMicroPr,
  EXECUTION_STATUSES,
  // C2 — Automatic Contract Closure in TEST
  closeContractInTest,
  CONTRACT_CLOSURE_STATUSES,
  // Summary
  buildContractSummary,
  // Route handlers
  handleCreateContract,
  handleGetContract,
  handleGetContractSummary,
  handleExecuteContract,
  handleCloseContractInTest,
};
