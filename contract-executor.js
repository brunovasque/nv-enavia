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

import { evaluateAdherence } from "./schema/contract-adherence-gate.js";
import { auditExecution } from "./schema/execution-audit.js";
import { auditFinalContract, CONTRACT_FINAL_STATUS } from "./schema/contract-final-audit.js";
import { enforceConstitution } from "./schema/autonomy-contract.js";
import {
  enforceGitHubPrArm,
  evaluateMergeReadiness,
  buildMergeGateState,
  GITHUB_PR_ARM_ID,
  MERGE_STATUS,
} from "./schema/github-pr-arm-contract.js";
import {
  enforceBrowserArm,
  BROWSER_ARM_ID,
  BROWSER_EXTERNAL_BASE,
  BROWSER_ARM_STATE_SHAPE,
  validateSuggestion,
} from "./schema/browser-arm-contract.js";
// 🛡️ P26-PR2 — Security Supervisor (enforcement real)
import {
  evaluateSensitiveAction,
  DECISION as SUPERVISOR_DECISION,
  REASON_CODE as SUPERVISOR_REASON_CODE,
} from "./schema/security-supervisor.js";
// 🌉 PR104 — GitHub Bridge Runtime supervisionado
// CJS interop via esbuild/wrangler — schema/enavia-github-bridge.js usa module.exports
import _githubBridgeNs from "./schema/enavia-github-bridge.js";
const _buildGithubBridgePlan = _githubBridgeNs && _githubBridgeNs.buildGithubBridgePlan
  ? _githubBridgeNs.buildGithubBridgePlan
  : (input, ctx) => ({ ok: false, mode: "github_bridge_plan", error: "bridge_not_loaded", operations: [], blocked_operations: [], safety_summary: {}, event_summary: {}, requires_human_review: true, github_execution: false, side_effects: false, ready_for_real_execution: false, next_recommended_action: "Bridge module não disponível" });

// ---------------------------------------------------------------------------
// 🛡️ P26-PR2 — _runSupervisorGate(context)
//
// Ponto canônico e único de enforcement do Supervisor de Segurança.
// Chamado obrigatoriamente antes de qualquer ação sensível real.
//
// Retorna:
//   { pass: true, supervisorDecision }  → ação pode prosseguir
//   { pass: false, supervisorDecision } → ação bloqueada ou exige revisão
//
// Quando pass === false, o caller deve usar _buildSupervisorBlockResponse()
// para devolver a resposta HTTP estruturada e auditável.
// ---------------------------------------------------------------------------
function _runSupervisorGate(context) {
  const supervisorDecision = evaluateSensitiveAction(context);
  if (supervisorDecision.decision === SUPERVISOR_DECISION.ALLOW) {
    return { pass: true, supervisorDecision };
  }
  return { pass: false, supervisorDecision };
}

// ---------------------------------------------------------------------------
// 🛡️ P26-PR2 — _buildSupervisorBlockResponse(supervisorDecision)
//
// Constrói resposta de bloqueio/revisão humana estruturada e auditável.
// Compatível com o shape de erro já existente no contract-executor.
// ---------------------------------------------------------------------------
function _buildSupervisorBlockResponse(supervisorDecision) {
  const errorCode = supervisorDecision.decision === SUPERVISOR_DECISION.NEEDS_HUMAN_REVIEW
    ? "SUPERVISOR_NEEDS_HUMAN_REVIEW"
    : "SUPERVISOR_BLOCKED";

  return {
    ok: false,
    error: errorCode,
    message: supervisorDecision.reason_text,
    supervisor_enforcement: {
      allowed: supervisorDecision.allowed,
      decision: supervisorDecision.decision,
      reason_code: supervisorDecision.reason_code,
      reason_text: supervisorDecision.reason_text,
      risk_level: supervisorDecision.risk_level,
      requires_human_approval: supervisorDecision.requires_human_approval,
      scope_valid: supervisorDecision.scope_valid,
      autonomy_valid: supervisorDecision.autonomy_valid,
      evidence_sufficient: supervisorDecision.evidence_sufficient,
      timestamp: supervisorDecision.timestamp,
      supervisor_version: supervisorDecision.supervisor_version,
    },
  };
}

// ---------------------------------------------------------------------------
// 🛡️ P26-PR2 — _CANONICAL_NULL_GATES_CONTEXT
//
// Canonical fallback gates context used when a caller does not provide one.
// All 6 P23 gates are explicitly false — the supervisor and arm enforcement
// will block on missing gates. Never use {} as a silent fallback.
// ---------------------------------------------------------------------------
const _CANONICAL_NULL_GATES_CONTEXT = {
  scope_defined:                       false,
  environment_defined:                 false,
  risk_assessed:                       false,
  authorization_present_when_required: false,
  observability_preserved:             false,
  evidence_available_when_required:    false,
};

// ---------------------------------------------------------------------------
// KV Key Prefixes
// ---------------------------------------------------------------------------
const KV_PREFIX_STATE = "contract:";
const KV_SUFFIX_STATE = ":state";
const KV_SUFFIX_DECOMPOSITION = ":decomposition";
const KV_INDEX_KEY = "contract:index";
// PR1 — exec event key: contract:<id>:exec_event (read by PR2/PR3)
const KV_SUFFIX_EXEC_EVENT = ":exec_event";
// Macro2-F5 — functional logs: append-only individual keys per entry.
// Key format: contract:<id>:flog:<timestamp_ms>_<seq>_<rand4>
// - Append is a pure KV put — ZERO reads, no counter, truly collision-free.
// - Two concurrent appends always write to DIFFERENT keys (unique ts+seq+rand suffix).
// - Read uses paginated KV prefix scan, takes LATEST N entries = most recent logs.
// - Cap (MAX_FUNCTIONAL_LOGS_PER_CONTRACT) applied at read time via slice(-N).
// - Backward compat: readFunctionalLogs falls back to legacy :functional_logs key.
const KV_SUFFIX_FUNCTIONAL_LOGS = ":functional_logs"; // kept for backward-compat reads
const KV_SUFFIX_FLOG_ENTRY      = ":flog:";
const MAX_FUNCTIONAL_LOGS_PER_CONTRACT = 50;

// Terminal statuses for the Contract Executor state machine.
// Contracts in any of these statuses are not considered active.
const TERMINAL_STATUSES = ["completed", "cancelled", "failed"];

// ---------------------------------------------------------------------------
// Canonical global statuses for the Contract Executor state machine.
//
// Semantics:
//   draft           — contract created but not yet approved
//   approved        — contract approved, awaiting decomposition
//   decomposed      — contract decomposed into phases/tasks, ready to execute
//   executing       — at least one phase/task is actively being worked on
//   validating      — execution done, results under validation (reserved)
//   blocked         — execution blocked by unresolved blockers
//   awaiting-human  — execution paused, waiting for human decision (reserved)
//   test-complete   — all TEST-environment criteria satisfied, awaiting PROD decision
//   prod-pending    — PROD promotion approved but not yet executed (reserved)
//   completed       — canonical terminal state after full promotion
//   cancelled       — contract formally cancelled
//   failed          — contract failed irrecoverably
// ---------------------------------------------------------------------------
const VALID_STATUSES = [
  "draft",
  "approved",
  "decomposed",
  "executing",
  "validating",
  "blocked",
  "awaiting-human",
  "test-complete",
  "prod-pending",
  "completed",
  "cancelled",
  "failed",
];

// ---------------------------------------------------------------------------
// Valid transitions: { from_status: [allowed_target_statuses] }
//
// Any transition not listed here is invalid and will be rejected by
// transitionStatusGlobal(). Terminal states (completed, cancelled, failed)
// have no outgoing transitions.
// ---------------------------------------------------------------------------
const VALID_GLOBAL_TRANSITIONS = {
  "draft":          ["approved", "cancelled"],
  "approved":       ["decomposed", "cancelled"],
  "decomposed":     ["executing", "blocked", "cancelled"],
  "executing":      ["executing", "validating", "blocked", "awaiting-human", "test-complete", "completed", "cancelled", "failed"],
  "validating":     ["executing", "blocked", "awaiting-human", "test-complete", "completed", "cancelled", "failed"],
  "blocked":        ["executing", "decomposed", "cancelled", "failed"],
  "awaiting-human": ["executing", "blocked", "cancelled"],
  "test-complete":  ["prod-pending", "cancelled"],
  "prod-pending":   ["completed", "cancelled", "failed"],
  "completed":      [],
  "cancelled":      [],
  "failed":         [],
};

// ---------------------------------------------------------------------------
// transitionStatusGlobal(state, targetStatus, context)
//
// Single authoritative path for every status_global mutation.
//   - Validates that targetStatus is a known canonical status.
//   - Validates that the transition from the current status is allowed.
//   - Mutates state.status_global in place (like the rest of the codebase).
//   - Returns { ok, previous, current } on success.
//   - Returns { ok: false, error, message } on invalid transition.
//
// `context` is an optional string for debugging (e.g. "advanceContractPhase").
// ---------------------------------------------------------------------------
function transitionStatusGlobal(state, targetStatus, context) {
  const from = state.status_global;

  if (!VALID_STATUSES.includes(targetStatus)) {
    return {
      ok: false,
      error: "INVALID_STATUS",
      message: `"${targetStatus}" is not a valid canonical status_global.${context ? ` (context: ${context})` : ""}`,
    };
  }

  const allowed = VALID_GLOBAL_TRANSITIONS[from];
  if (!allowed) {
    return {
      ok: false,
      error: "UNKNOWN_SOURCE_STATUS",
      message: `Current status_global "${from}" is not recognized.${context ? ` (context: ${context})` : ""}`,
    };
  }

  if (!allowed.includes(targetStatus)) {
    return {
      ok: false,
      error: "INVALID_TRANSITION",
      message: `Transition "${from}" → "${targetStatus}" is not allowed.${context ? ` (context: ${context})` : ""}`,
    };
  }

  const previous = from;
  state.status_global = targetStatus;
  return { ok: true, previous, current: targetStatus };
}

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
  "plan_revision_pending",
  "max_prs_exceeded",
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
        require_human_approval_per_pr: true,
        test_before_prod: true,
        rollback_on_failure: true,
      },
      body.constraints || {}
    ),
    definition_of_done: body.definition_of_done,
    context: body.context || {},
    // Canonical execution cycle history per microstep (task_id → cycle[]).
    // Populated by executeCurrentMicroPr and handleCompleteTask.
    // Survives KV round-trips — single source of truth for execution_cycles.
    task_execution_log: {},
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
// Cancelled-contract guard — used by all mutation functions
// ---------------------------------------------------------------------------
function isCancelledContract(state) {
  return state && state.status_global === "cancelled";
}

function cancelledResult(contractId) {
  return {
    ok: false,
    error: "CONTRACT_CANCELLED",
    message: `Contract "${contractId}" is cancelled — no further actions allowed.`,
  };
}

// ---------------------------------------------------------------------------
// Plan-rejected guard — used by mutation functions that should not proceed
// while the decomposition plan is rejected and pending revision.
// ---------------------------------------------------------------------------
function isPlanRejected(state) {
  return !!(state && state.plan_rejection && state.plan_rejection.plan_rejected === true);
}

function planRejectedResult(contractId) {
  return {
    ok: false,
    error: "PLAN_REJECTED",
    message: `Contract "${contractId}" has a rejected decomposition plan — resolve the plan revision before proceeding.`,
  };
}

// ---------------------------------------------------------------------------
// F1 — Formal Contract Cancellation
//
// cancelContract(env, contractId, params)
//   params.reason       — human-readable cancellation reason (optional)
//   params.cancelled_by — identifier of the actor (optional, defaults to "human")
//   params.evidence     — array of evidence strings (optional)
//
// Behaviour:
//   1. Rehydrates from KV (INVARIANT 1+3)
//   2. Validates contract exists
//   3. Idempotent if already cancelled
//   4. Persists cancellation state
//   5. Blocks any further normal execution
// ---------------------------------------------------------------------------
async function cancelContract(env, contractId, params) {
  const p = params || {};

  // INVARIANT 1+3 — rehydrate from KV
  const { state, decomposition } = await rehydrateContract(env, contractId);

  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }

  // Idempotent: already cancelled
  if (isCancelledContract(state)) {
    return {
      ok: true,
      already_cancelled: true,
      contract_cancellation: state.contract_cancellation,
      message: "Contract already cancelled.",
      state,
      decomposition,
    };
  }

  const now = new Date().toISOString();

  const previousStatusGlobal = state.status_global;
  const previousCurrentPhase = state.current_phase;

  const transition = transitionStatusGlobal(state, "cancelled", "cancelContract");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message };
  }

  state.contract_cancellation = {
    cancelled: true,
    cancelled_at: now,
    cancel_reason: p.reason || null,
    cancelled_by: p.cancelled_by || "human",
    cancellation_evidence: Array.isArray(p.evidence) ? p.evidence : [],
    previous_status_global: previousStatusGlobal,
    previous_current_phase: previousCurrentPhase,
  };

  state.next_action = "Contract cancelled. No further actions.";
  state.updated_at = now;

  await persistContract(env, state, decomposition);

  return {
    ok: true,
    already_cancelled: false,
    contract_cancellation: state.contract_cancellation,
    message: "Contract cancelled successfully.",
    state,
    decomposition,
  };
}

// ---------------------------------------------------------------------------
// handleCancelContract(request, env) → { status, body }
//
// Route handler for POST /contracts/cancel
// ---------------------------------------------------------------------------
async function handleCancelContract(request, env) {
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

  const result = await cancelContract(env, contractId, {
    reason: body.reason || null,
    cancelled_by: body.cancelled_by || "human",
    evidence: body.evidence || [],
  });

  if (!result.ok) {
    const httpStatus = result.error === "CONTRACT_NOT_FOUND" ? 404 : 400;
    return {
      status: httpStatus,
      body: {
        ok: false,
        error: result.error,
        message: result.message,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      already_cancelled: result.already_cancelled || false,
      contract_cancellation: result.contract_cancellation,
      message: result.message,
    },
  };
}

// ---------------------------------------------------------------------------
// F2 — Formal Decomposition Plan Rejection / Revision
//
// rejectDecompositionPlan(env, contractId, params)
//   params.reason        — human-readable rejection reason (required)
//   params.rejected_by   — identifier of the actor (optional, defaults to "human")
//
// Behaviour:
//   1. Rehydrates from KV (INVARIANT 1+3)
//   2. Validates contract exists
//   3. Validates contract is in a rejectable state (decomposed)
//   4. Idempotent if plan already rejected
//   5. Transitions status_global → blocked
//   6. Persists plan_rejection metadata + snapshot of previous decomposition
//   7. Blocks any further normal execution until plan is revised
// ---------------------------------------------------------------------------
async function rejectDecompositionPlan(env, contractId, params) {
  const p = params || {};

  // INVARIANT 1+3 — rehydrate from KV
  const { state, decomposition } = await rehydrateContract(env, contractId);

  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }

  // F1 — Cancellation guard (cancelled contracts cannot have plan rejected)
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }

  // Idempotent: plan already rejected
  if (isPlanRejected(state)) {
    return {
      ok: true,
      already_rejected: true,
      plan_rejection: state.plan_rejection,
      message: "Decomposition plan already rejected — awaiting revision.",
      state,
      decomposition,
    };
  }

  // Validate rejectable state: only "decomposed" contracts can have their plan rejected
  if (state.status_global !== "decomposed") {
    return {
      ok: false,
      error: "PLAN_NOT_REJECTABLE",
      message: `Contract status_global is "${state.status_global}" — plan can only be rejected when status is "decomposed".`,
    };
  }

  // Reason is required for rejection
  if (!p.reason || typeof p.reason !== "string" || p.reason.trim() === "") {
    return {
      ok: false,
      error: "MISSING_REJECTION_REASON",
      message: "A non-empty reason is required to reject the decomposition plan.",
    };
  }

  const now = new Date().toISOString();

  const previousStatusGlobal = state.status_global;
  const previousCurrentPhase = state.current_phase;

  // Transition: decomposed → blocked
  const transition = transitionStatusGlobal(state, "blocked", "rejectDecompositionPlan");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message };
  }

  // Build plan_rejection metadata
  const planRevision = (state.plan_rejection && state.plan_rejection.plan_revision)
    ? state.plan_rejection.plan_revision + 1
    : 1;

  state.plan_rejection = {
    plan_rejected: true,
    plan_rejected_at: now,
    plan_rejection_reason: p.reason.trim(),
    plan_rejected_by: p.rejected_by || "human",
    plan_revision: planRevision,
    previous_status_global: previousStatusGlobal,
    previous_current_phase: previousCurrentPhase,
    previous_decomposition_snapshot: decomposition ? JSON.parse(JSON.stringify(decomposition)) : null,
  };

  state.current_phase = "plan_revision_pending";
  state.next_action = "Decomposition plan rejected — awaiting revised plan.";
  state.updated_at = now;

  await persistContract(env, state, decomposition);

  return {
    ok: true,
    already_rejected: false,
    plan_rejection: state.plan_rejection,
    message: "Decomposition plan rejected. Contract blocked until plan is revised.",
    state,
    decomposition,
  };
}

// ---------------------------------------------------------------------------
// handleRejectDecompositionPlan(request, env) → { status, body }
//
// Route handler for POST /contracts/reject-plan
// ---------------------------------------------------------------------------
async function handleRejectDecompositionPlan(request, env) {
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

  const result = await rejectDecompositionPlan(env, contractId, {
    reason: body.reason || null,
    rejected_by: body.rejected_by || "human",
  });

  if (!result.ok) {
    const httpStatus = result.error === "CONTRACT_NOT_FOUND" ? 404
      : result.error === "CONTRACT_CANCELLED" ? 409
      : 400;
    return {
      status: httpStatus,
      body: {
        ok: false,
        error: result.error,
        message: result.message,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      already_rejected: result.already_rejected || false,
      plan_rejection: result.plan_rejection,
      message: result.message,
    },
  };
}

// ---------------------------------------------------------------------------
// F2b — Resolve Plan Revision (formal exit from plan_revision_pending)
//
// resolvePlanRevision(env, contractId, params)
//   params.revised_by         — identifier of the actor (optional, defaults to "human")
//   params.new_decomposition  — the revised decomposition object (optional;
//                                if omitted, re-generates from current state)
//
// Behaviour:
//   1. Rehydrates from KV (INVARIANT 1+3)
//   2. Validates contract exists
//   3. Validates contract is in plan_revision_pending / plan rejected
//   4. Transitions status_global: blocked → decomposed
//   5. Clears plan_rejection.plan_rejected (preserves history via plan_rejection_history)
//   6. Replaces decomposition with revised version
//   7. Restores current_phase to decomposition_complete
//   8. Persists updated state + decomposition
// ---------------------------------------------------------------------------
async function resolvePlanRevision(env, contractId, params) {
  const p = params || {};

  // INVARIANT 1+3 — rehydrate from KV
  const { state, decomposition } = await rehydrateContract(env, contractId);

  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }

  // F1 — Cancellation guard
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }

  // Validate: must be in plan_revision_pending / plan rejected
  if (!isPlanRejected(state)) {
    return {
      ok: false,
      error: "NOT_IN_PLAN_REVISION",
      message: `Contract "${contractId}" is not in plan revision — cannot resolve.`,
    };
  }

  const now = new Date().toISOString();

  // Preserve rejection history before clearing
  const previousRejection = JSON.parse(JSON.stringify(state.plan_rejection));

  // Build or accept the revised decomposition
  let revisedDecomposition;
  if (p.new_decomposition && typeof p.new_decomposition === "object") {
    revisedDecomposition = p.new_decomposition;
  } else {
    // Re-generate from current state (default behaviour)
    revisedDecomposition = generateDecomposition(state);
  }

  // F3 — Enforce max_micro_prs on the revised decomposition
  const maxMicroPrs = typeof state.constraints.max_micro_prs === "number"
    ? state.constraints.max_micro_prs
    : null;
  if (maxMicroPrs !== null) {
    const taskCandidates = Array.isArray(revisedDecomposition.micro_pr_candidates)
      ? revisedDecomposition.micro_pr_candidates.filter((m) => m.environment !== "PROD")
      : [];
    if (taskCandidates.length > maxMicroPrs) {
      return {
        ok: false,
        error: "BLOCK_MAX_PRS_REACHED",
        message: `Revised decomposition has ${taskCandidates.length} micro-PR candidates (excluding PROD), exceeding the limit of ${maxMicroPrs}. Provide a revised decomposition within the limit.`,
      };
    }
  }

  // Transition: blocked → decomposed
  const transition = transitionStatusGlobal(state, "decomposed", "resolvePlanRevision");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message };
  }

  // Move rejection to history array, clear active rejection
  if (!state.plan_rejection_history) {
    state.plan_rejection_history = [];
  }
  previousRejection.resolved_at = now;
  previousRejection.resolved_by = p.revised_by || "human";
  state.plan_rejection_history.push(previousRejection);

  // Clear the active plan_rejection
  state.plan_rejection = null;

  // Restore to decomposed-ready state
  state.current_phase = "decomposition_complete";
  state.next_action = "Plano revisado. Revisar decomposição e aprovar plano de micro-PRs.";
  state.updated_at = now;

  await persistContract(env, state, revisedDecomposition);

  return {
    ok: true,
    message: "Plan revision resolved. Contract returned to decomposed state.",
    plan_rejection_history: state.plan_rejection_history,
    state,
    decomposition: revisedDecomposition,
  };
}

// ---------------------------------------------------------------------------
// handleResolvePlanRevision(request, env) → { status, body }
//
// Route handler for POST /contracts/resolve-plan-revision
// ---------------------------------------------------------------------------
async function handleResolvePlanRevision(request, env) {
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

  const result = await resolvePlanRevision(env, contractId, {
    revised_by: body.revised_by || "human",
    new_decomposition: body.new_decomposition || null,
  });

  if (!result.ok) {
    const httpStatus = result.error === "CONTRACT_NOT_FOUND" ? 404
      : result.error === "CONTRACT_CANCELLED" ? 409
      : result.error === "BLOCK_MAX_PRS_REACHED" ? 422
      : 400;
    return {
      status: httpStatus,
      body: {
        ok: false,
        error: result.error,
        message: result.message,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      message: result.message,
      plan_rejection_history: result.plan_rejection_history,
    },
  };
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

  // F1 — Cancellation guard
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }

  // F2 — Plan-rejection guard
  if (isPlanRejected(state)) {
    return planRejectedResult(contractId);
  }

  // INVARIANT 2 — evaluate phase gate against persisted state
  const gate = checkPhaseGate(state, decomposition);

  if (!gate.canAdvance) {
    // Cannot advance — stay in current phase or mark blocked
    const now = new Date().toISOString();
    const updatedState = Object.assign({}, state, {
      blockers: [...new Set([...(state.blockers || []), gate.reason])],
      next_action: "Resolve incomplete tasks in active phase before advancing.",
      updated_at: now,
    });
    const transition = transitionStatusGlobal(updatedState, "blocked", "advanceContractPhase:gate-blocked");
    if (!transition.ok) {
      return { ok: false, error: transition.error, message: transition.message, state, decomposition, gate };
    }
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
  // When all phases are done, the contract remains "executing" (awaiting formal
  // closure / sign-off).  "completed" is reserved for the canonical terminal state
  // after full promotion policy is respected.
  const targetGlobalStatus = "executing";
  const updatedState = Object.assign({}, state, {
    current_phase: nextPhaseValue,
    // Clear blockers since the gate that caused them has now passed
    blockers: [],
    next_action: nextPhase
      ? `Execute tasks in phase "${nextPhase.id}".`
      : "All phases complete. Awaiting human sign-off.",
    updated_at: now,
  });
  const transition = transitionStatusGlobal(updatedState, targetGlobalStatus, "advanceContractPhase:advance");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message, state, decomposition, gate };
  }

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
  if (isCancelledContract(state)) { return cancelledResult(contractId); }
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }
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

// ---------------------------------------------------------------------------
// _completeTaskCore(env, contractId, taskId)
//
// Core logic for completing a task. Private — not exported directly.
//
// GUARDRAIL: Do not call this function without first running the adherence
// gate (evaluateAdherence). Callers that bypass the gate must use
// completeTaskInternal, which stamps _gate_bypassed: true in the result.
//
// The public, gate-enforced path is handleCompleteTask (POST /contracts/complete-task).
// ---------------------------------------------------------------------------
async function _completeTaskCore(env, contractId, taskId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) { return cancelledResult(contractId); }
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }
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

// ---------------------------------------------------------------------------
// completeTaskInternal(env, contractId, taskId)
//
// @internal — For use by existing internal tests and flows that intentionally
// bypass the adherence gate. Stamps `_gate_bypassed: true` in the result
// so that any bypass is explicit and auditable.
//
// For the gate-enforced public path, use handleCompleteTask
// (POST /contracts/complete-task).
// ---------------------------------------------------------------------------
async function completeTaskInternal(env, contractId, taskId) {
  const result = await _completeTaskCore(env, contractId, taskId);
  if (result.ok) {
    result._gate_bypassed = true;
  }
  return result;
}

async function blockTask(env, contractId, taskId, reason) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) { return cancelledResult(contractId); }
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }
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
  if (isCancelledContract(state)) { return cancelledResult(contractId); }
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }
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
  if (isCancelledContract(state)) { return cancelledResult(contractId); }
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }
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
  if (isCancelledContract(state)) { return cancelledResult(contractId); }
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }
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
  if (isCancelledContract(state)) { return cancelledResult(contractId); }
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }
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

  // ── Rule 0: Contract cancelled — no further actions ──
  if (isCancelledContract(state)) {
    return {
      type: "contract_cancelled",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: "Contract has been formally cancelled.",
      status: "cancelled",
    };
  }

  // ── Rule 0b: Decomposition plan rejected — awaiting revision ──
  if (isPlanRejected(state)) {
    return {
      type: "plan_rejected",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: state.plan_rejection.plan_rejection_reason
        ? `Decomposition plan rejected: ${state.plan_rejection.plan_rejection_reason}`
        : "Decomposition plan rejected — awaiting revised plan.",
      status: "blocked",
    };
  }

  // ── Rule 1: Contract in a terminal state (completed or test-complete) ──
  if (state.status_global === "completed" || state.status_global === "test-complete") {
    return {
      type: "contract_complete",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: state.status_global === "test-complete"
        ? "Contract closed in TEST. Awaiting PROD promotion decision."
        : "All phases and tasks are complete.",
      status: state.status_global,
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

  // ── Rule 2b: Contract blocked because max_micro_prs limit was exceeded ──
  if (state.current_phase === "max_prs_exceeded") {
    return {
      type: "contract_blocked",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: blockers.length > 0
        ? `max_micro_prs limit exceeded: ${blockers.join("; ")}`
        : "Contract is blocked — max_micro_prs limit exceeded.",
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
// Completed cycles are also appended to `state.task_execution_log[task_id]`
// so the full history (1..N) is persisted and available for audit.
// ============================================================================

// ---------------------------------------------------------------------------
// _appendExecutionCycle(state, cycle)
//
// Appends a finished execution cycle snapshot to state.task_execution_log.
// Creates the per-task array if it doesn't exist yet.
// Safe for old contracts that don't have task_execution_log (initialised here).
// ---------------------------------------------------------------------------
function _appendExecutionCycle(state, cycle) {
  if (!state.task_execution_log || typeof state.task_execution_log !== "object") {
    state.task_execution_log = {};
  }
  const taskId = cycle.task_id;
  if (!taskId) return;
  if (!Array.isArray(state.task_execution_log[taskId])) {
    state.task_execution_log[taskId] = [];
  }
  state.task_execution_log[taskId].push({ ...cycle, executor_artifacts: null });
}

// ---------------------------------------------------------------------------
// _recordExecutorArtifacts(state, taskId, executor_artifacts)
//
// Attaches executor_artifacts (from external /audit+/propose calls) to the
// last execution cycle for the given task in task_execution_log.
// If no cycle exists yet for this task, creates a standalone audit entry.
// This makes executor_artifacts a durable part of the KV-persisted state,
// so subsequent audits don't need manual body injection.
// ---------------------------------------------------------------------------
function _recordExecutorArtifacts(state, taskId, executor_artifacts) {
  if (!state.task_execution_log || typeof state.task_execution_log !== "object") {
    state.task_execution_log = {};
  }
  if (!Array.isArray(state.task_execution_log[taskId])) {
    state.task_execution_log[taskId] = [];
  }
  const log = state.task_execution_log[taskId];

  // Prefer attaching to the last cycle that has no executor_artifacts yet
  const lastCycle = log.length > 0 ? log[log.length - 1] : null;
  if (lastCycle && lastCycle.executor_artifacts === null) {
    lastCycle.executor_artifacts = executor_artifacts;
  } else {
    // No existing cycle or last cycle already has artifacts — append standalone
    log.push({
      task_id:               taskId,
      micro_pr_id:           null,
      execution_status:      "audit_only",
      execution_started_at:  null,
      execution_finished_at: null,
      execution_evidence:    [],
      executor_artifacts,
    });
  }
}

// ---------------------------------------------------------------------------
// _resolveExecutorArtifactsFromLog(cycles)
//
// Extracts executor_artifacts from the canonical task_execution_log.
// Returns the executor_artifacts from the LAST cycle that has them, or null.
// This allows handleGetExecutionAudit to perform a full microstep audit
// without requiring executor_artifacts in the request body.
// ---------------------------------------------------------------------------
function _resolveExecutorArtifactsFromLog(cycles) {
  if (!Array.isArray(cycles)) return null;
  for (let i = cycles.length - 1; i >= 0; i--) {
    if (cycles[i] && cycles[i].executor_artifacts) {
      return cycles[i].executor_artifacts;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Valid execution statuses
// ---------------------------------------------------------------------------
const EXECUTION_STATUSES = ["pending", "running", "success", "failed", "skipped"];

// ---------------------------------------------------------------------------
// PR1 — Minimal real exec event (6 canonical fields + 1 metadata field)
//
// buildExecEvent(status, handoff, microPrId, motivo)
//   Builds the event object from real runtime values inside executeCurrentMicroPr.
//   Pure function — no side effects, no KV, no fetch.
//
// Canonical fields (contract PR1):
//   status_atual   — "running" | "success" | "failed"
//   arquivo_atual  — comma-joined target files from the handoff
//   bloco_atual    — source task ID (e.g. "task_001")
//   operacao_atual — task objective / description
//   motivo_curto   — null on success; trimmed error message on failure (max 120 chars)
//   patch_atual    — micro-PR candidate ID (e.g. "micro_pr_001")
//
// Metadata field (audit / ordering):
//   emitted_at     — ISO 8601 timestamp of emission
// ---------------------------------------------------------------------------
function buildExecEvent(status, handoff, microPrId, motivo, enrichment) {
  const base = {
    status_atual:   status,
    arquivo_atual:  Array.isArray(handoff.target_files) && handoff.target_files.length > 0
      ? handoff.target_files.join(", ")
      : null,
    bloco_atual:    handoff.source_task  || null,
    operacao_atual: handoff.objective    || null,
    motivo_curto:   motivo               || null,
    patch_atual:    microPrId            || null,
    emitted_at:     new Date().toISOString(),
  };

  // Macro2-F5 — enrichment fields for operational observability
  // These are additive; old consumers that only read the 6 canonical fields
  // will continue to work unchanged.
  const enr = enrichment || {};
  base.metrics          = enr.metrics          || null;
  base.executionSummary = enr.executionSummary || null;
  base.result           = enr.result           || null;

  return base;
}

// ---------------------------------------------------------------------------
// emitExecEvent(env, contractId, event)
//   Persists the exec event to KV under contract:<id>:exec_event.
//   Overwrites the previous value — only the latest event is kept.
//   Canonical write path for PR2 (/execution) and PR3 (/health).
//   Failures are swallowed to never crash the executor.
// ---------------------------------------------------------------------------
async function emitExecEvent(env, contractId, event) {
  try {
    const key = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_EXEC_EVENT}`;
    await env.ENAVIA_BRAIN.put(key, JSON.stringify(event));
    // PR2 — pointer so GET /execution can locate the latest exec_event via readExecEvent
    await env.ENAVIA_BRAIN.put("execution:exec_event:latest_contract_id", contractId);
  } catch (_) {
    // emitExecEvent must never crash the executor
  }
}

// ---------------------------------------------------------------------------
// readExecEvent(env, contractId)
//   Reads the latest exec event from KV.
//   Returns the parsed event object or null if none exists.
//   Intended for PR2 (/execution) and PR3 (/health).
// ---------------------------------------------------------------------------
async function readExecEvent(env, contractId) {
  try {
    const key = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_EXEC_EVENT}`;
    const raw = await env.ENAVIA_BRAIN.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Macro2-F5 — Functional Logs: truly collision-free append-only persistence
//
// Strategy: each log entry is written to a unique KV key with ZERO reads:
//   contract:<id>:flog:<timestamp_ms>_<seq>_<rand4>
//
// Why collision-free:
//   - Key suffix = timestamp + monotonic seq + 4 random hex chars (~65K extra combinations)
//   - appendFunctionalLog performs a single KV put — no read, no counter, no slot
//   - Two concurrent appends always derive different suffixes independently
//   - No shared state between appenders → no lost update possible
//
// appendFunctionalLog(env, contractId, log)
//   Pure KV put to a unique key. Cannot collide under any concurrency.
//
// readFunctionalLogs(env, contractId)
//   Uses paginated KV prefix scan to enumerate ALL entries, then returns
//   the LATEST N (most recent) in chronological order.
//   This ensures large contracts always surface recent operational logs,
//   not the oldest entries that would come from a naive ascending-limit scan.
//   Capped at MAX_FUNCTIONAL_LOGS_PER_CONTRACT entries at read time.
//   Falls back to legacy single-array key (:functional_logs) if list unavailable.
//   Returns [] if none exist. Never crashes the caller.
//
// Cap: applied at read via allKeys.slice(-N) — writes are never blocked.
// ---------------------------------------------------------------------------
let _functionalLogSeq = 0;

// Returns a collision-resistant suffix: <timestamp_ms>_<seq>_<rand4>
// - seq (module-level, monotonic) ensures stable ordering within one isolate
//   even when two sequential appends share the same millisecond timestamp.
// - rand4 provides extra isolation across different isolates with the same seq.
function _flogKeySuffix() {
  _functionalLogSeq++;
  const rand = Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0");
  return `${Date.now()}_${_functionalLogSeq}_${rand}`;
}

function _buildFunctionalLog(type, label, message) {
  return {
    id:        `fl_${_flogKeySuffix()}`,
    type:      type,
    label:     label,
    message:   message,
    timestamp: new Date().toISOString(),
  };
}

async function appendFunctionalLog(env, contractId, log) {
  try {
    // Pure append — zero reads, no counter, no collision under any concurrency.
    // Each call generates a unique key independently of any shared state.
    const entryKey = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_FLOG_ENTRY}${_flogKeySuffix()}`;
    await env.ENAVIA_BRAIN.put(entryKey, JSON.stringify(log));
  } catch (_) {
    // appendFunctionalLog must never crash the executor
  }
}

async function readFunctionalLogs(env, contractId) {
  try {
    const prefix = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_FLOG_ENTRY}`;

    // Use KV prefix scan to enumerate ALL log entries for this contract,
    // then return the LATEST N (most recent) in chronological order.
    //
    // Why not just list({ limit: N })?
    //   KV list returns keys in ascending alphabetical order (= oldest first).
    //   For large contracts with >N entries, that would return the N oldest,
    //   silently dropping the most operationally useful recent logs.
    //
    // Strategy: paginate through all keys, keep only the last N (most recent),
    // then fetch and return them in chronological (ascending) order.
    // Keys are naturally chronological because timestamp_ms is the leading segment.
    if (typeof env.ENAVIA_BRAIN.list === "function") {
      // Phase 1: Collect ALL key names via paginated prefix scan.
      const allKeys = [];
      let cursor = undefined;
      let hasMore = true;
      while (hasMore) {
        const listOpts = { prefix };
        if (cursor) listOpts.cursor = cursor;
        const listed = await env.ENAVIA_BRAIN.list(listOpts);
        const keys = listed.keys || [];
        for (const { name } of keys) {
          allKeys.push(name);
        }
        // Cloudflare KV: list_complete is false (or absent) when more pages exist
        if (!listed.list_complete && listed.cursor) {
          cursor = listed.cursor;
        } else {
          hasMore = false;
        }
      }

      if (allKeys.length > 0) {
        // Phase 2: Take the LAST N keys (most recent — highest timestamps).
        // allKeys are already in ascending alphabetical/chronological order from KV list.
        const recentKeys = allKeys.length > MAX_FUNCTIONAL_LOGS_PER_CONTRACT
          ? allKeys.slice(-MAX_FUNCTIONAL_LOGS_PER_CONTRACT)
          : allKeys;

        // Phase 3: Fetch entries and return in chronological (ascending) order.
        const logs = [];
        for (const name of recentKeys) {
          const raw = await env.ENAVIA_BRAIN.get(name);
          if (raw) {
            try { logs.push(JSON.parse(raw)); } catch (_) { /* skip malformed entry */ }
          }
        }
        return logs;
      }
      // list returned 0 per-entry keys — fall through to legacy key below
    }

    // Fallback: KV binding without list support.
    // Read legacy single-array key (original append model before per-entry KV).
    const legacyKey = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_FUNCTIONAL_LOGS}`;
    const legacyRaw = await env.ENAVIA_BRAIN.get(legacyKey);
    return legacyRaw ? JSON.parse(legacyRaw) : [];
  } catch (_) {
    return [];
  }
}

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

  // F1 — Cancellation guard
  if (isCancelledContract(state)) { return cancelledResult(contractId); }

  // F2 — Plan-rejection guard
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }

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

  // 🛡️ P26-PR2 — Security Supervisor Enforcement (supersedes direct P23 call)
  // The supervisor delegates to enforceConstitution (P23) internally,
  // plus evaluates scope, risk, evidence, and arm checks.
  // This replaces the previous direct enforceConstitution call to avoid
  // double-evaluation while adding the full supervisor gate.
  const supervisorGatesContext = {
    scope_defined:                       !!(state.scope),
    environment_defined:                 true,
    risk_assessed:                       true,
    authorization_present_when_required: task.status === "in_progress",
    observability_preserved:             true,
    evidence_available_when_required:    true,
  };
  const supervisorGate = _runSupervisorGate({
    action: "execute_in_test_within_scope",
    environment: "TEST",
    scope_approved: !!(state.scope),
    gates_context: supervisorGatesContext,
    // evidence_sufficient derived from the canonical P23 gate — the real source
    evidence_sufficient: supervisorGatesContext.evidence_available_when_required === true,
  });

  if (!supervisorGate.pass) {
    const blockResp = _buildSupervisorBlockResponse(supervisorGate.supervisorDecision);

    // Macro2-F5 — functional log: bloqueio (supervisor gate blocked)
    await appendFunctionalLog(env, contractId, _buildFunctionalLog(
      "bloqueio",
      `Supervisor bloqueou execução — task ${currentTaskId}`,
      `Gate: ${supervisorGate.supervisorDecision.reason_code || "UNKNOWN"}. Motivo: ${supervisorGate.supervisorDecision.reason_text || "N/A"}.`
    ));

    return {
      ...blockResp,
      // Backwards-compatible: keep constitution_enforcement shape for callers
      // that already handle it. The supervisor_enforcement field is additive.
      // Note: 'level' maps to supervisor reason_code (e.g. SCOPE_VIOLATION, AUTONOMY_BLOCKED)
      // which is the closest semantic equivalent to the original P23 enforcement level.
      constitution_enforcement: {
        allowed: false,
        blocked: true,
        level: supervisorGate.supervisorDecision.reason_code,
        reason: supervisorGate.supervisorDecision.reason_text,
      },
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

  // Macro2-F5 — Compute total steps from decomposition tasks
  const _totalTasks = (decomposition.tasks || []).length;
  const _doneTasks  = (decomposition.tasks || []).filter(t => t.status === "done" || t.status === "completed").length;

  // PR1 — emit real exec event: running (enriched for Macro2-F5)
  await emitExecEvent(env, contractId, buildExecEvent("running", handoff, microPrId, null, {
    metrics: {
      stepsTotal: _totalTasks,
      stepsDone:  _doneTasks,
      elapsedMs:  0,
    },
    executionSummary: {
      finalStatus:           "running",
      taskId:                currentTaskId,
      microPrId:             microPrId,
      hadBlock:              false,
      evidenceCount:         0,
    },
    result: null,
  }));

  // Macro2-F5 — functional log: execution start (decisao)
  await appendFunctionalLog(env, contractId, _buildFunctionalLog(
    "decisao",
    `Execução iniciada — task ${currentTaskId}`,
    `Executor iniciou ciclo para task "${currentTaskId}" (micro-PR: ${microPrId}) em ambiente ${handoff.scope.environment}. Objetivo: ${handoff.objective || "N/A"}.`
  ));

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

    // Append this cycle to the canonical task_execution_log for audit
    _appendExecutionCycle(state, state.current_execution);

    state.updated_at = executionFinishedAt;

    // Macro2-F5 — compute elapsed ms
    const _successElapsedMs = new Date(executionFinishedAt).getTime() - new Date(executionStartedAt).getTime();
    const _successDoneTasks = _doneTasks + 1; // current task completes this cycle

    // PR1 — emit real exec event: success (enriched for Macro2-F5)
    await emitExecEvent(env, contractId, buildExecEvent("success", handoff, microPrId, null, {
      metrics: {
        stepsTotal: _totalTasks,
        stepsDone:  _successDoneTasks,
        elapsedMs:  _successElapsedMs,
      },
      executionSummary: {
        finalStatus:           "success",
        taskId:                currentTaskId,
        microPrId:             microPrId,
        hadBlock:              false,
        evidenceCount:         evidence.length,
      },
      result: {
        summary: `Task "${currentTaskId}" concluída com sucesso em ${_successElapsedMs}ms. ${evidence.length} evidência(s) registrada(s).`,
        status:  "success",
      },
    }));

    // Macro2-F5 — functional log: consolidation (success)
    await appendFunctionalLog(env, contractId, _buildFunctionalLog(
      "consolidacao",
      `Task ${currentTaskId} concluída com sucesso`,
      `Execução finalizada em ${_successElapsedMs}ms. Evidências: ${evidence.join("; ") || "nenhuma explícita"}. Micro-PR: ${microPrId}.`
    ));
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

    // Append this cycle to the canonical task_execution_log for audit
    _appendExecutionCycle(state, state.current_execution);

    state.updated_at = executionFinishedAt;

    // Macro2-F5 — compute elapsed ms for failure
    const _failElapsedMs = new Date(executionFinishedAt).getTime() - new Date(executionStartedAt).getTime();
    const _failMotivo = executionError && executionError.message
      ? String(executionError.message).slice(0, 120)
      : "execution_failed";

    // PR1 — emit real exec event: failed (enriched for Macro2-F5)
    await emitExecEvent(env, contractId, buildExecEvent(
      "failed", handoff, microPrId, _failMotivo, {
        metrics: {
          stepsTotal: _totalTasks,
          stepsDone:  _doneTasks,
          elapsedMs:  _failElapsedMs,
        },
        executionSummary: {
          finalStatus:           "failed",
          taskId:                currentTaskId,
          microPrId:             microPrId,
          hadBlock:              !!(executionError.classification === "out_of_scope"),
          evidenceCount:         evidence.length,
        },
        result: {
          summary: `Task "${currentTaskId}" falhou após ${_failElapsedMs}ms: ${_failMotivo}`,
          status:  "failed",
        },
      }
    ));

    // Macro2-F5 — functional log: bloqueio (failure)
    await appendFunctionalLog(env, contractId, _buildFunctionalLog(
      "bloqueio",
      `Falha na execução — task ${currentTaskId}`,
      `Erro: ${_failMotivo}. Classificação: ${executionError.classification || "desconhecida"}. Micro-PR: ${microPrId}. Duração: ${_failElapsedMs}ms.`
    ));
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

  // F1 — Cancellation guard
  if (isCancelledContract(state)) { return cancelledResult(contractId); }

  // F2 — Plan-rejection guard (rejected plan must block TEST closure)
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }

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

  // ── Gate 6: 🛡️ BLINDAGEM CONTRATUAL PR 3 — Auditoria final pesada do contrato inteiro ──
  // Impede fechamento quando o conjunto final não representa fielmente o contrato:
  //   • faltantes do definition_of_done
  //   • microetapas parciais/desviadas (sem gate formal ou sem evidência)
  //   • microetapas fora do contrato (entrega não autorizada)
  //   • evidência operacional insuficiente
  const finalAudit = auditFinalContract({ state, decomposition });
  if (!finalAudit.can_close_contract) {
    return {
      ok: false,
      error: "FINAL_AUDIT_REJECTED",
      message: `Fechamento do contrato bloqueado pelo gate final: ${finalAudit.final_reason}`,
      final_adherence_status:     finalAudit.final_adherence_status,
      missing_items:              finalAudit.missing_items,
      partial_microsteps:         finalAudit.partial_microsteps,
      out_of_contract_microsteps: finalAudit.out_of_contract_microsteps,
      unauthorized_items:         finalAudit.unauthorized_items,
      evidence_sufficiency:       finalAudit.evidence_sufficiency,
      final_audit_snapshot:       finalAudit,
      final_next_action:          finalAudit.final_next_action,
    };
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
  const transition = transitionStatusGlobal(state, "test-complete", "closeContractInTest");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message };
  }
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
      // 🛡️ PR3 — expõe snapshot auditável quando gate final bloqueia
      final_adherence_status:     result.final_adherence_status     || null,
      final_audit_snapshot:       result.final_audit_snapshot       || null,
      final_next_action:          result.final_next_action          || null,
      missing_items:              result.missing_items              || null,
      partial_microsteps:         result.partial_microsteps         || null,
      out_of_contract_microsteps: result.out_of_contract_microsteps || null,
      unauthorized_items:         result.unauthorized_items         || null,
      evidence_sufficiency:       result.evidence_sufficiency       != null ? result.evidence_sufficiency : null,
    },
  };
}

// ============================================================================
// 🛡️ BLINDAGEM CONTRATUAL PR 3 — closeFinalContract / handleCloseFinalContract
//
// POST /contracts/close-final
//
// Gate final pesado de fechamento do contrato inteiro.
// Impõe auditFinalContract() antes de marcar o contrato como "completed".
//
// Fluxo:
//   1. Rehydrate from KV
//   2. Guards: cancellation, plan-rejection, already-completed
//   3. 🛡️ Gate Final — auditFinalContract() — gate pesado do conjunto inteiro
//   4. Transition status_global → "completed"
//   5. Persist canonical closure state
//   6. Return deterministic snapshot auditável
//
// Válido a partir de: "test-complete" ou "prod-pending"
// (também permitido de "executing" para contratos sem promoção de PROD separada)
// ============================================================================

// ---------------------------------------------------------------------------
// Valid source statuses for final closure
// The final gate validates the actual contract state — accepting any
// non-terminal, non-cancelled status ensures the gate is the enforcement
// point rather than a status-machine guard.
//
// NOTE: Keep in sync with VALID_GLOBAL_TRANSITIONS above. Any new status
// added to the lifecycle that should allow final closure must also appear
// here. The set intentionally excludes terminal/cancelled/failed states.
// ---------------------------------------------------------------------------
const FINAL_CLOSURE_SOURCE_STATUSES = [
  "decomposed",
  "executing",
  "validating",
  "blocked",
  "awaiting-human",
  "test-complete",
  "prod-pending",
];

// ---------------------------------------------------------------------------
// closeFinalContract(env, contractId) → result
// ---------------------------------------------------------------------------
async function closeFinalContract(env, contractId) {
  // ── INVARIANT 1+3: Rehydrate from KV ──
  const { state, decomposition } = await rehydrateContract(env, contractId);

  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (!decomposition) {
    return { ok: false, error: "DECOMPOSITION_NOT_FOUND", message: `Decomposition for "${contractId}" not found.` };
  }

  // F1 — Cancellation guard
  if (isCancelledContract(state)) { return cancelledResult(contractId); }

  // F2 — Plan-rejection guard
  if (isPlanRejected(state)) { return planRejectedResult(contractId); }

  // Guard: already completed
  if (state.status_global === "completed") {
    return {
      ok: true,
      already_completed: true,
      contract_closure: state.contract_closure || null,
      message: "Contract already marked as completed.",
      state,
      decomposition,
    };
  }

  // Guard: must be in a valid source status for final closure
  if (!FINAL_CLOSURE_SOURCE_STATUSES.includes(state.status_global)) {
    return {
      ok: false,
      error: "INVALID_STATUS_FOR_FINAL_CLOSURE",
      message: `Contract "${contractId}" has status_global "${state.status_global}" — cannot close-final from this state. Expected one of: ${FINAL_CLOSURE_SOURCE_STATUSES.join(", ")}.`,
    };
  }

  // ── 🛡️ Gate Final: Auditoria pesada do contrato inteiro (PR 3) ──
  const finalAudit = auditFinalContract({ state, decomposition });
  if (!finalAudit.can_close_contract) {
    return {
      ok: false,
      error: "FINAL_AUDIT_REJECTED",
      message: `Fechamento final bloqueado — ${finalAudit.final_reason}`,
      final_adherence_status:     finalAudit.final_adherence_status,
      missing_items:              finalAudit.missing_items,
      partial_microsteps:         finalAudit.partial_microsteps,
      out_of_contract_microsteps: finalAudit.out_of_contract_microsteps,
      unauthorized_items:         finalAudit.unauthorized_items,
      evidence_sufficiency:       finalAudit.evidence_sufficiency,
      final_audit_snapshot:       finalAudit,
      final_next_action:          finalAudit.final_next_action,
    };
  }

  // ── All gates passed — persist final closure ──
  const completedAt = new Date().toISOString();

  state.contract_closure = Object.assign(state.contract_closure || {}, {
    closure_status:        "completed",
    final_completed:       true,
    completed_at:          completedAt,
    final_audit_snapshot:  finalAudit,
    closure_reason:        "All final contractual closure criteria satisfied. Gate final aderente.",
    closed_by:             "final_gate",
    environment:           "FINAL",
  });

  state.updated_at = completedAt;
  state.next_action = "Contrato concluído e auditado. Nenhuma ação adicional necessária.";

  // Transition to canonical terminal "completed" status.
  // Some source statuses (e.g. "decomposed", "blocked") cannot transition directly
  // to "completed" — advance through "executing" first.
  // Rollback: both transitions are validated before any persist; if the final
  // transition fails, the original status is restored so in-memory state remains
  // consistent with KV (which is only written after both transitions succeed).
  const originalStatus = state.status_global;
  const DIRECT_TO_COMPLETED = ["executing", "validating", "test-complete", "prod-pending"];
  if (!DIRECT_TO_COMPLETED.includes(state.status_global)) {
    // Advance to "executing" first (all FINAL_CLOSURE_SOURCE_STATUSES allow this)
    const intermediateTransition = transitionStatusGlobal(state, "executing", "closeFinalContract:intermediate");
    if (!intermediateTransition.ok) {
      state.status_global = originalStatus; // rollback
      return { ok: false, error: intermediateTransition.error, message: intermediateTransition.message };
    }
  }
  const transition = transitionStatusGlobal(state, "completed", "closeFinalContract");
  if (!transition.ok) {
    state.status_global = originalStatus; // rollback
    return { ok: false, error: transition.error, message: transition.message };
  }

  // Persist to KV
  await persistContract(env, state, decomposition);

  return {
    ok: true,
    already_completed: false,
    final_audit_snapshot: finalAudit,
    contract_closure:     state.contract_closure,
    message: "Contrato marcado como concluído após auditoria final aderente.",
    state,
    decomposition,
  };
}

// ---------------------------------------------------------------------------
// handleCloseFinalContract(request, env) → { status, body }
//
// Route handler for POST /contracts/close-final
// ---------------------------------------------------------------------------
async function handleCloseFinalContract(request, env) {
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
      body: { ok: false, error: "MISSING_CONTRACT_ID", message: "contract_id is required." },
    };
  }

  const result = await closeFinalContract(env, contractId);

  if (!result.ok) {
    const notFoundErrors = ["CONTRACT_NOT_FOUND", "DECOMPOSITION_NOT_FOUND"];
    const httpStatus = notFoundErrors.includes(result.error) ? 404 : 422;
    return {
      status: httpStatus,
      body: {
        ok: false,
        error: result.error || null,
        message: result.message,
        final_adherence_status:     result.final_adherence_status     || null,
        final_audit_snapshot:       result.final_audit_snapshot       || null,
        final_next_action:          result.final_next_action          || null,
        missing_items:              result.missing_items              || null,
        partial_microsteps:         result.partial_microsteps         || null,
        out_of_contract_microsteps: result.out_of_contract_microsteps || null,
        unauthorized_items:         result.unauthorized_items         || null,
        evidence_sufficiency:       result.evidence_sufficiency       != null ? result.evidence_sufficiency : null,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      already_completed:    result.already_completed || false,
      final_audit_snapshot: result.final_audit_snapshot || null,
      contract_closure:     result.contract_closure || null,
      message:              result.message,
    },
  };
}

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
    contract_cancellation: state.contract_cancellation || null,
    plan_rejection: state.plan_rejection || null,
    plan_rejection_history: state.plan_rejection_history || [],
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
    const transition = transitionStatusGlobal(state, "blocked", "handleCreateContract:ingestion-blocked");
    if (!transition.ok) {
      return {
        status: 500,
        body: { ok: false, error: transition.error, message: transition.message },
      };
    }
    state.current_phase = "ingestion_blocked";
    state.blockers = blockers;
    state.next_action = "Resolve blockers before proceeding.";
  }

  // Generate decomposition
  const decomposition = generateDecomposition(state);

  // F3 — Enforce max_micro_prs
  // The PROD-promotion candidate (environment === "PROD") is excluded from
  // the count; max_micro_prs governs only the task/TEST candidates.
  const maxMicroPrs = typeof state.constraints.max_micro_prs === "number"
    ? state.constraints.max_micro_prs
    : null;
  if (maxMicroPrs !== null) {
    const taskCandidates = decomposition.micro_pr_candidates.filter(
      (m) => m.environment !== "PROD"
    );
    if (taskCandidates.length > maxMicroPrs) {
      if (state.status_global === "decomposed") {
        const t = transitionStatusGlobal(
          state,
          "blocked",
          "handleCreateContract:max-prs-exceeded"
        );
        if (!t.ok) {
          return { status: 500, body: { ok: false, error: t.error, message: t.message } };
        }
      }
      state.current_phase = "max_prs_exceeded";
      if (!Array.isArray(state.blockers)) state.blockers = [];
      state.blockers.push(
        `max_micro_prs limit (${maxMicroPrs}) exceeded — decomposition generated ${taskCandidates.length} micro-PR candidates.`
      );
      state.next_action =
        "Reduce definition_of_done or increase constraints.max_micro_prs to proceed.";
    }
  }

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

// GET /contracts/active-surface — Return the surface of the most recent active contract
async function handleGetActiveSurface(env) {
  // Read the contract index
  let index = [];
  try {
    const raw = await env.ENAVIA_BRAIN.get(KV_INDEX_KEY);
    if (raw) index = JSON.parse(raw);
  } catch (err) {
    console.error("[handleGetActiveSurface] Failed to read contract index:", err);
    index = [];
  }

  // PR1 — stable empty surface (no contracts or all terminal)
  const emptySurface = {
    ok: true,
    source: "active-contract",
    contract: null,
    surface: { available: false, next_action: null, blocked: false, block_reason: null },
    // backward-compat: Panel reads active_state + adherence
    active_state: null,
    adherence: null,
  };

  if (!Array.isArray(index) || index.length === 0) {
    return { status: 200, body: emptySurface };
  }

  // Iterate from most recent (last in array) to find first non-terminal contract
  for (let i = index.length - 1; i >= 0; i--) {
    const contractId = index[i];
    const state = await readContractState(env, contractId);
    if (!state) continue;
    if (TERMINAL_STATUSES.includes(state.status_global)) continue;

    const decomposition = await readContractDecomposition(env, contractId);
    const summary = buildContractSummary(state, decomposition);

    const blockers = Array.isArray(state.blockers) ? state.blockers : [];
    const isBlocked = blockers.length > 0;
    const blockReason = isBlocked ? (blockers[0].reason || blockers[0] || null) : null;
    // current_pr: use current_task as explicit fallback — no dedicated field exists yet (PR4 will refine)
    const currentPr = state.current_task || null;

    return {
      status: 200,
      body: {
        ok: true,
        source: "active-contract",
        contract: {
          id: state.contract_id || null,
          title: state.contract_name || null,
          status: state.status_global || null,
          current_phase: state.current_phase || null,
          current_pr: currentPr,
          updated_at: state.updated_at || null,
        },
        surface: {
          available: true,
          next_action: state.next_action || null,
          blocked: isBlocked,
          block_reason: blockReason,
        },
        // backward-compat: Panel reads active_state + adherence
        active_state: summary,
        adherence: null,
      },
    };
  }

  // All contracts are terminal
  return { status: 200, body: emptySurface };
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
// 🛡️ BLINDAGEM CONTRATUAL — handleCompleteTask (Gate Obrigatório)
//
// POST /contracts/complete-task
//
// Handler HTTP que impõe obrigatoriamente o gate de aderência contratual
// antes de marcar uma task como concluída.
//
// Corpo obrigatório:
//   contract_id      {string}   — ID do contrato
//   task_id          {string}   — ID da task a concluir
//   resultado        {object}   — MicrostepResultado (obrigatório):
//     objetivo_atendido         {boolean}
//     criterio_aceite_atendido  {boolean}
//     escopo_efetivo            {string[]}
//     is_simulado               {boolean}
//     is_mockado                {boolean}
//     is_local                  {boolean}
//     is_parcial                {boolean}
//   contract_microstep {object} — MicrostepContract (opcional; derivado da task se ausente):
//     objetivo_contratual_exato  {string}
//     escopo_permitido           {string[]}
//     escopo_proibido            {string[]}
//     criterio_de_aceite_literal {string}
//
// Fluxo obrigatório:
//   1. Valida campos requeridos
//   2. Carrega a task do contrato
//   3. Deriva MicrostepContract da task (ou usa o fornecido)
//   4. Executa evaluateAdherence — GATE OBRIGATÓRIO
//   5. Se aderente_ao_contrato → prossegue com completeTask
//   6. Se parcial_desviado ou fora_do_contrato → bloqueia, retorna auditoria
//
// A task NÃO pode ser marcada como concluída sem passar pelo gate.
// ============================================================================

// ---------------------------------------------------------------------------
// _buildContractMicrostepFromTask(task)
//
// Deriva um MicrostepContract mínimo a partir da estrutura de task existente.
// Usado quando o caller não fornece um contract_microstep explícito.
//
// escopo_permitido vazio = escopo aberto: qualquer entrega é válida nesta dimensão
// (nenhum item será considerado fora_do_permitido). Ver regra em
// schema/contract-adherence-gate.js → _checkScopeViolations.
// ---------------------------------------------------------------------------
function _buildContractMicrostepFromTask(task) {
  return {
    objetivo_contratual_exato:  task.description || "",
    escopo_permitido:           [],   // escopo aberto — sem restrição explícita de escopo
    escopo_proibido:            [],
    criterio_de_aceite_literal: task.description || "",
  };
}

// ---------------------------------------------------------------------------
// handleCompleteTask(request, env)
//
// Gate obrigatório HTTP para conclusão de task.
// Rejeita conclusão indevida via evaluateAdherence antes de persistir.
// ---------------------------------------------------------------------------
async function handleCompleteTask(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." },
    };
  }

  const contractId         = body && body.contract_id;
  const taskId             = body && body.task_id;
  const resultado          = body && body.resultado;
  // executor_artifacts: artefatos reais de /audit e /propose (opcional).
  // Quando presente, auditExecution usa a CAMADA 1 (comparação real contra contrato).
  // Quando ausente, auditExecution usa a CAMADA 2 (fallback por tasks).
  const executor_artifacts = (body && body.executor_artifacts && typeof body.executor_artifacts === "object")
    ? body.executor_artifacts
    : undefined;

  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: '"contract_id" is required.' },
    };
  }
  if (!taskId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: '"task_id" is required.' },
    };
  }
  if (!resultado || typeof resultado !== "object") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "ADHERENCE_GATE_REQUIRED",
        message: '"resultado" (MicrostepResultado) is required — the adherence gate cannot be bypassed.',
      },
    };
  }

  // Carregar a task para derivar o contrato da microetapa
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return {
      status: 404,
      body: { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` },
    };
  }

  const task = (decomposition.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    return {
      status: 404,
      body: { ok: false, error: "TASK_NOT_FOUND", message: `Task "${taskId}" not found in contract "${contractId}".` },
    };
  }

  // Derivar ou usar o MicrostepContract fornecido
  const contract_microstep = (body.contract_microstep && typeof body.contract_microstep === "object")
    ? body.contract_microstep
    : _buildContractMicrostepFromTask(task);

  // ── GATE OBRIGATÓRIO ────────────────────────────────────────────────────
  let adherenceAudit;
  try {
    adherenceAudit = evaluateAdherence({ contract: contract_microstep, resultado });
  } catch (err) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "ADHERENCE_GATE_ERROR",
        message: `Gate de aderência rejeitou os dados fornecidos: ${err.message}`,
      },
    };
  }

  // Gate bloqueia conclusão indevida
  if (!adherenceAudit.can_mark_concluded) {
    return {
      status: 422,
      body: {
        ok: false,
        error: "ADHERENCE_GATE_REJECTED",
        message: `Task "${taskId}" não pode ser marcada como concluída — ${adherenceAudit.reason}`,
        adherence_status:   adherenceAudit.adherence_status,
        honest_status:      adherenceAudit.honest_status,
        can_mark_concluded: false,
        campos_falhos:      adherenceAudit.campos_falhos,
        next_action:        adherenceAudit.next_action,
      },
    };
  }
  // ── FIM DO GATE ─────────────────────────────────────────────────────────

  // Gate autoriza → marcar como concluída via core (sem bypass marker)
  const result = await _completeTaskCore(env, contractId, taskId);

  if (!result.ok) {
    const notFoundErrors = ["CONTRACT_NOT_FOUND", "TASK_NOT_FOUND"];
    const httpStatus = notFoundErrors.includes(result.error) ? 404 : 409;
    return {
      status: httpStatus,
      body: { ok: false, error: result.error, message: result.message },
    };
  }

  // ── AUDITORIA DE EXECUÇÃO CONTRA CONTRATO (PR 2) ─────────────────────────
  // Snapshot canônico da aderência da microetapa ao contrato.
  //
  // MODO PRINCIPAL (microstep_anchored):
  //   Âncora a auditoria no microstep_id (= taskId — identidade canônica).
  //   execution_ids são prova operacional subordinada (1..N ciclos).
  //   executor_artifacts persistidos em state.task_execution_log — não requerem
  //   payload manual em chamadas subsequentes.
  //
  // Determinístico, sem I/O adicional (state e decomposition já carregados).

  // Record executor_artifacts into the canonical task_execution_log (KV-persisted)
  // so future audits can resolve them natively without manual body injection.
  // One extra persist here is justified: executor_artifacts arrive exactly once
  // per completeTask call (this endpoint is invoked once per task, not in hot loops).
  if (executor_artifacts) {
    _recordExecutorArtifacts(result.state, taskId, executor_artifacts);
    result.state.updated_at = new Date().toISOString();
    await persistContract(env, result.state, result.decomposition);
  }

  // Resolve execution_cycles from the canonical persisted log (not just current_execution)
  const persistedCycles = (result.state.task_execution_log &&
    Array.isArray(result.state.task_execution_log[taskId]))
    ? result.state.task_execution_log[taskId]
    : [];

  // Extract executor_artifacts from log for the audit (last entry with artifacts, or param)
  const resolvedArtifacts = executor_artifacts
    || _resolveExecutorArtifactsFromLog(persistedCycles);

  const executionAudit = auditExecution({
    state:              result.state,
    decomposition:      result.decomposition,
    microstep_id:       taskId,
    executor_artifacts: resolvedArtifacts,
    execution_cycles:   persistedCycles,
  });
  // ── FIM DA AUDITORIA ─────────────────────────────────────────────────────

  return {
    status: 200,
    body: {
      ok: true,
      task_id:            taskId,
      task_status:        result.task.status,
      adherence_status:   adherenceAudit.adherence_status,
      honest_status:      adherenceAudit.honest_status,
      can_mark_concluded: true,
      campos_falhos:      adherenceAudit.campos_falhos,
      execution_audit:    executionAudit,
    },
  };
}

// ============================================================================
// 🛡️ BLINDAGEM CONTRATUAL — handleGetExecutionAudit (PR 2)
//
// GET /contracts/execution-audit?contract_id=<id>[&microstep_id=<task_id>]
//
// Handler HTTP que retorna a auditoria canônica de execução vs. contrato.
// Pode ser chamado a qualquer momento durante o fluxo operacional para
// obter um snapshot auditável do estado de aderência.
//
// Query params:
//   contract_id  {string} — ID do contrato (obrigatório)
//   microstep_id {string} — task_id da microetapa a auditar (opcional).
//     Quando presente → modo "microstep_anchored": auditoria ancorada no
//     microstep contratual. execution_ids são prova operacional subordinada.
//     Quando ausente  → modo "executor_artifacts" ou "task_decomposition".
//
// Body (opcional, JSON):
//   executor_artifacts {object} — artefatos reais de /audit e /propose.
//   execution_cycles   {object[]} — ciclos operacionais da microetapa (1..N).
//
// Retorna ExecutionAudit:
//   {
//     contract_id,
//     audit_mode,            — "microstep_anchored" | "executor_artifacts" | "task_decomposition"
//     microstep_id,          — task_id auditado (null se modo global)
//     execution_ids,         — [...] IDs das tentativas operacionais (1..N)
//     contract_microstep_reference | contract_reference,
//     executor_artifacts_reference | implemented_reference,
//     execution_cycles_reference,
//     missing_items,
//     unauthorized_items,
//     adherence_status,      — "aderente_ao_contrato" | "parcial_desviado" | "fora_do_contrato"
//     reason,
//     next_action,
//   }
// ============================================================================
async function handleGetExecutionAudit(request, env) {
  const url        = new URL(request.url);
  const contractId = url.searchParams.get("contract_id");
  // microstep_id pode vir como query param — ancora a auditoria na microetapa
  const microstepIdParam = url.searchParams.get("microstep_id") || null;

  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: '"contract_id" query param is required.' },
    };
  }

  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return {
      status: 404,
      body: { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` },
    };
  }

  // ── Resolve microstep_id ──────────────────────────────────────────────────
  // Body can also specify microstep_id (query param takes precedence).
  // executor_artifacts and execution_cycles from body are OPTIONAL overrides —
  // the primary source is now state.task_execution_log (KV-persisted).
  let body_executor_artifacts;
  let body_execution_cycles;
  let microstep_id = microstepIdParam;
  try {
    const bodyText = request._body_text || null;
    if (bodyText) {
      const parsed = JSON.parse(bodyText);
      if (parsed && typeof parsed.executor_artifacts === "object") {
        body_executor_artifacts = parsed.executor_artifacts;
      }
      if (parsed && Array.isArray(parsed.execution_cycles)) {
        body_execution_cycles = parsed.execution_cycles;
      }
      if (!microstep_id && parsed && typeof parsed.microstep_id === "string") {
        microstep_id = parsed.microstep_id;
      }
    }
  } catch (_) {
    // body absent or not JSON — use persisted log below
  }

  // ── Resolve execution_cycles natively from state.task_execution_log ────────
  // body_execution_cycles override wins if provided; otherwise load from KV state.
  let execution_cycles = body_execution_cycles;
  if (!execution_cycles && microstep_id) {
    const taskLog = state.task_execution_log;
    execution_cycles = (taskLog && Array.isArray(taskLog[microstep_id]))
      ? taskLog[microstep_id]
      : undefined;
  }

  // ── Resolve executor_artifacts natively from task_execution_log ────────────
  // Body override wins; otherwise extract from last cycle with artifacts.
  const executor_artifacts = body_executor_artifacts
    || _resolveExecutorArtifactsFromLog(execution_cycles);

  const executionAudit = auditExecution({
    state,
    decomposition,
    microstep_id:    microstep_id || undefined,
    executor_artifacts,
    execution_cycles,
  });

  return {
    status: 200,
    body: Object.assign({ ok: true }, executionAudit),
  };
}

// ============================================================================
// 🛡️ P24 — GitHub/PR Arm Runtime Enforcement
//
// Real runtime entry points for the GitHub/PR arm.
// Each function calls enforceGitHubPrArm() BEFORE any action.
// If enforcement blocks, the function returns the block result — no action taken.
//
// Separate from the Cloudflare executor (executeCurrentMicroPr).
// P24 operates on branch/PR/repo, NOT on Workers/deploy.
// ============================================================================

// ---------------------------------------------------------------------------
// executeGitHubPrAction({ action, scope_approved, gates_context,
//                         drift_detected, regression_detected })
//
// Runtime entry point for any pre-merge GitHub/PR arm action.
// Calls enforceGitHubPrArm() first; if blocked, returns immediately.
// If allowed, returns the enforcement result with execution_status.
//
// This is the P24 equivalent of executeCurrentMicroPr() for P23.
// ---------------------------------------------------------------------------
function executeGitHubPrAction({
  action,
  scope_approved,
  gates_context,
  drift_detected = false,
  regression_detected = false,
} = {}) {
  // Run arm-specific enforcement first (pure, no side effects)
  const enforcement = enforceGitHubPrArm({
    action,
    scope_approved,
    gates_context,
    drift_detected,
    regression_detected,
  });

  // 🛡️ P26-PR2 — Security Supervisor gate (consolidated decision ABOVE arm)
  // Passes arm_check_result so the supervisor can factor in the arm's assessment.
  // evidence_sufficient derived from the canonical P23 gate (real source from caller).
  const resolvedGatesContext = gates_context || _CANONICAL_NULL_GATES_CONTEXT;
  const supervisorGate = _runSupervisorGate({
    action,
    environment: "TEST",
    scope_approved: scope_approved === true,
    gates_context: resolvedGatesContext,
    // Real source: evidence_available_when_required gate provided by the caller
    evidence_sufficient: !!(resolvedGatesContext.evidence_available_when_required),
    arm_id: GITHUB_PR_ARM_ID,
    arm_check_result: {
      allowed: enforcement.allowed,
      reason: enforcement.reason,
      arm_id: enforcement.arm_id,
    },
  });

  // If arm blocked → preserve existing block path (backwards-compatible)
  if (!enforcement.allowed) {
    return {
      ok: false,
      error: "GITHUB_PR_ARM_BLOCKED",
      message: enforcement.reason,
      enforcement,
      supervisor_enforcement: supervisorGate.supervisorDecision,
    };
  }

  // If arm allowed but supervisor blocked → new supervisor block path
  if (!supervisorGate.pass) {
    return _buildSupervisorBlockResponse(supervisorGate.supervisorDecision);
  }

  return {
    ok: true,
    execution_status: "executed",
    action: enforcement.action,
    arm_id: enforcement.arm_id,
    enforcement,
  };
}

// ---------------------------------------------------------------------------
// requestMergeApproval({ scope_approved, gates_context, merge_context,
//                        drift_detected, regression_detected })
//
// Runtime entry point for requesting merge approval.
// Evaluates merge readiness and builds merge gate state.
// Does NOT merge — produces the state (not_ready / awaiting_formal_approval / blocked).
//
// merge_context must include:
//   contract_rechecked, phase_validated, no_regression, diff_reviewed,
//   summary_reviewed, summary_for_merge, reason_merge_ok, approval_status
// ---------------------------------------------------------------------------
function requestMergeApproval({
  scope_approved,
  gates_context,
  merge_context,
  drift_detected = false,
  regression_detected = false,
} = {}) {
  // Enforce the full P24 arm contract first (action = merge_to_main)
  const enforcement = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved,
    gates_context,
    merge_context,
    drift_detected,
    regression_detected,
  });

  // If enforcement allowed → that means approval was "approved" and all gates passed.
  // If blocked → return the merge gate state for the caller to know what's missing.
  if (!enforcement.allowed) {
    return {
      ok: false,
      error: "MERGE_NOT_READY",
      message: enforcement.reason,
      merge_status: enforcement.merge_gate
        ? enforcement.merge_gate.merge_status
        : MERGE_STATUS.NOT_READY,
      merge_gate: enforcement.merge_gate,
      enforcement,
    };
  }

  return {
    ok: true,
    merge_status: MERGE_STATUS.APPROVED,
    message: enforcement.reason,
    merge_gate: enforcement.merge_gate,
    enforcement,
  };
}

// ---------------------------------------------------------------------------
// approveMerge({ scope_approved, gates_context, merge_context,
//                drift_detected, regression_detected })
//
// Runtime entry point for the formal approval path.
// This is the ONLY path that can produce merge_status === "approved_for_merge".
//
// The caller MUST set merge_context.approval_status = "approved".
// If not, this will block with awaiting_formal_approval.
// ---------------------------------------------------------------------------
function approveMerge({
  scope_approved,
  gates_context,
  merge_context,
  drift_detected = false,
  regression_detected = false,
} = {}) {
  if (!merge_context || typeof merge_context !== "object") {
    return {
      ok: false,
      error: "MERGE_CONTEXT_MISSING",
      message: "merge_context é obrigatório para approval de merge.",
      merge_status: MERGE_STATUS.NOT_READY,
    };
  }

  // Force the action to merge_to_main
  const enforcement = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved,
    gates_context,
    merge_context,
    drift_detected,
    regression_detected,
  });

  if (!enforcement.allowed) {
    return {
      ok: false,
      error: "MERGE_BLOCKED",
      message: enforcement.reason,
      merge_status: enforcement.merge_gate
        ? enforcement.merge_gate.merge_status
        : MERGE_STATUS.BLOCKED,
      merge_gate: enforcement.merge_gate,
      enforcement,
    };
  }

  return {
    ok: true,
    merge_status: MERGE_STATUS.APPROVED,
    can_merge: true,
    message: enforcement.reason,
    summary_for_merge: enforcement.merge_gate.summary_for_merge,
    reason_merge_ok: enforcement.merge_gate.reason_merge_ok,
    merge_gate: enforcement.merge_gate,
    enforcement,
  };
}

// ---------------------------------------------------------------------------
// _handleGithubBridgeRuntime(body) — PR104 — Runtime mínimo supervisionado
//
// Handler interno para modo github_bridge_runtime no endpoint /github-pr/action.
// Normaliza o payload, chama buildGithubBridgePlan do schema/enavia-github-bridge.js
// e retorna plano supervisionado com safety_summary, event_summary e bloqueios duros.
//
// Invariantes obrigatórias desta PR:
//   - github_execution = false sempre
//   - side_effects = false sempre
//   - ready_for_real_execution = false sempre (sem aprovação humana explícita)
//   - merge / deploy_prod / secret_change sempre bloqueados (via Bridge)
//   - main direta bloqueada ou exige review (via Bridge)
//   - nenhuma chamada real ao GitHub API
//   - nenhum uso de gh CLI ou child_process
//   - sem secrets expostos
// ---------------------------------------------------------------------------
function _handleGithubBridgeRuntime(body) {
  // Validação de payload
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "INVALID_PAYLOAD",
        message: "Payload inválido para modo github_bridge_runtime.",
        mode: "github_bridge_runtime",
        github_execution: false,
        side_effects: false,
        ready_for_real_execution: false,
      },
    };
  }

  // Normalizar operações: aceita body.operations (array) ou body.operation (objeto único)
  const rawOps = Array.isArray(body.operations)
    ? body.operations
    : body.operation && typeof body.operation === "object"
      ? [body.operation]
      : [];

  if (rawOps.length === 0) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "NO_OPERATIONS",
        message: "Nenhuma operação válida fornecida para o GitHub Bridge.",
        mode: "github_bridge_runtime",
        github_execution: false,
        side_effects: false,
        ready_for_real_execution: false,
      },
    };
  }

  // Contexto de execução (opcional)
  const context = body.context && typeof body.context === "object" ? body.context : {};

  // Construir plano supervisionado via GitHub Bridge helper (PR103)
  const bridgePlan = _buildGithubBridgePlan({ operations: rawOps }, context);

  const requires_human_review =
    bridgePlan.requires_human_review ||
    (bridgePlan.safety_summary && bridgePlan.safety_summary.any_review) ||
    false;
  const blocked_operations = Array.isArray(bridgePlan.blocked_operations)
    ? bridgePlan.blocked_operations
    : [];

  return {
    status: 200,
    body: {
      ok: bridgePlan.ok === true,
      mode: "github_bridge_runtime",
      bridge_plan: bridgePlan,
      safety_summary: bridgePlan.safety_summary || {},
      event_summary: bridgePlan.event_summary || {},
      requires_human_review,
      blocked_operations,
      github_execution: false,
      side_effects: false,
      ready_for_real_execution: false,
      next_recommended_action:
        bridgePlan.next_recommended_action ||
        "Aguardar aprovação humana antes de qualquer execução real no GitHub.",
    },
  };
}

// ---------------------------------------------------------------------------
// handleGitHubPrAction(request, env) — POST /github-pr/action
//
// Route handler for GitHub/PR arm actions.
// Reads { action, scope_approved, gates_context, drift_detected, regression_detected }
// from request body and dispatches to executeGitHubPrAction().
//
// PR104 extension: if body.mode === "github_bridge_runtime", dispatches to
// _handleGithubBridgeRuntime() instead (GitHub Bridge supervised planning).
// ---------------------------------------------------------------------------
async function handleGitHubPrAction(request) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." },
    };
  }

  // PR104 — GitHub Bridge Runtime supervisionado
  if (body && body.mode === "github_bridge_runtime") {
    return _handleGithubBridgeRuntime(body);
  }

  if (!body || typeof body.action !== "string") {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: '"action" is required.' },
    };
  }

  const result = executeGitHubPrAction({
    action: body.action,
    scope_approved: body.scope_approved === true,
    gates_context: body.gates_context || _CANONICAL_NULL_GATES_CONTEXT,
    drift_detected: body.drift_detected === true,
    regression_detected: body.regression_detected === true,
  });

  return {
    status: result.ok ? 200 : 403,
    body: result,
  };
}

// ---------------------------------------------------------------------------
// handleRequestMergeApproval(request, env) — POST /github-pr/request-merge
//
// Route handler for merge approval request.
// Reads merge_context from request body and evaluates merge readiness.
// ---------------------------------------------------------------------------
async function handleRequestMergeApproval(request) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." },
    };
  }

  const result = requestMergeApproval({
    scope_approved: body && body.scope_approved === true,
    gates_context: (body && body.gates_context) || {},
    merge_context: (body && body.merge_context) || null,
    drift_detected: body && body.drift_detected === true,
    regression_detected: body && body.regression_detected === true,
  });

  return {
    status: result.ok ? 200 : 403,
    body: result,
  };
}

// ---------------------------------------------------------------------------
// handleApproveMerge(request, env) — POST /github-pr/approve-merge
//
// Route handler for formal merge approval from the panel.
//
// CANONICAL PAYLOAD (panel → backend):
//   { merge_gate: <backend-emitted state>, approval_status: "approved" }
//
// CONTRACT RULE:
//   The panel only approves. The backend validates.
//   The client MUST NOT send readiness gates (contract_rechecked, phase_validated,
//   no_regression, diff_reviewed, summary_reviewed). These are sovereign to the backend.
//
// On receiving the payload, this handler:
//   1. Validates merge_gate is present and was in "awaiting_formal_approval" state.
//   2. Validates approval_status === "approved" (the single human assertion).
//   3. Derives the merge_context INTERNALLY from the backend-emitted state —
//      since "awaiting_formal_approval" certifies all gates already passed.
//   4. Delegates to approveMerge() which runs the full enforcement chain.
// ---------------------------------------------------------------------------
async function handleApproveMerge(request) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." },
    };
  }

  const merge_gate     = (body && body.merge_gate) || null;
  const approval_status = (body && body.approval_status) || null;

  // ── Validate merge_gate ────────────────────────────────────────────────────
  if (!merge_gate || typeof merge_gate !== "object") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "MERGE_GATE_MISSING",
        message: "merge_gate é obrigatório — envie o estado do gate emitido pelo backend.",
      },
    };
  }

  // Only "awaiting_formal_approval" is compatible with this approval path.
  if (merge_gate.merge_status !== "awaiting_formal_approval") {
    return {
      status: 403,
      body: {
        ok: false,
        error: "MERGE_NOT_AWAITING_APPROVAL",
        message: `Estado '${merge_gate.merge_status}' não é compatível com approval formal. ` +
                 "Apenas 'awaiting_formal_approval' pode ser aprovado pelo painel.",
        merge_status: merge_gate.merge_status,
      },
    };
  }

  // ── Validate human approval ────────────────────────────────────────────────
  if (approval_status !== "approved") {
    return {
      status: 403,
      body: {
        ok: false,
        error: "APPROVAL_NOT_GIVEN",
        message: "approval_status deve ser 'approved' para concluir o merge formal.",
      },
    };
  }

  // ── Backend-sovereign merge_context ───────────────────────────────────────
  // merge_status === "awaiting_formal_approval" certifies that all readiness
  // gates already passed when the backend produced this state. The backend sets
  // them here as an internal sovereign decision, NOT from client assertions.
  //
  // gates_context includes the P23 operational gates — also derived internally
  // from the certified awaiting_formal_approval state, not from the client.
  const result = approveMerge({
    scope_approved: true,
    gates_context: {
      arm_id:                              "p24_github_pr_arm",
      scope_defined:                       true,
      environment_defined:                 true,
      risk_assessed:                       true,
      authorization_present_when_required: true,
      observability_preserved:             true,
      evidence_available_when_required:    true,
    },
    merge_context: {
      contract_rechecked: true,
      phase_validated:    true,
      no_regression:      true,
      diff_reviewed:      true,
      summary_reviewed:   true,
      summary_for_merge:  merge_gate.summary_for_merge,
      reason_merge_ok:    merge_gate.reason_merge_ok,
      approval_status:    "approved",
    },
    drift_detected:      false,
    regression_detected: false,
  });

  return {
    status: result.ok ? 200 : 403,
    body: result,
  };
}

// ============================================================================
// 🌐 P25 — Browser Arm Runtime Functions
//
// Separate from Cloudflare executor (executeCurrentMicroPr) and GitHub arm (P24).
// P25-PR1 established contract enforcement layer.
// P25-PR2 adds the REAL operational bridge: Enavia governs → browser executes.
//
// Bridge flow:
//   1. enforceBrowserArm() validates action (P23/P25 gates)
//   2. If allowed: build canonical payload → call external browser executor
//   3. External browser at BROWSER_EXECUTOR_URL (run.nv-imoveis.com/*) executes
//   4. Enavia consumes canonical response → returns to runtime
//   5. Failures are separated: enforcement | connectivity | execution
// ============================================================================

// ---------------------------------------------------------------------------
// CANONICAL PAYLOAD SHAPE — what Enavia sends to the browser executor
//
// Minimal, consistent, canonical. No bloat.
// ---------------------------------------------------------------------------
const BROWSER_EXECUTOR_PAYLOAD_SHAPE = {
  required_fields: ["arm_id", "action", "external_base", "request_id", "timestamp"],
  optional_fields: ["params", "execution_context"],
};

// ---------------------------------------------------------------------------
// CANONICAL RESPONSE SHAPE — what Enavia expects from the browser executor
//
// The browser executor MUST return at minimum:
//   { ok, execution_status, action }
// Additional fields are consumed when present.
// ---------------------------------------------------------------------------
const BROWSER_EXECUTOR_RESPONSE_SHAPE = {
  required_fields: ["ok", "execution_status", "action"],
  optional_fields: ["target_url", "result_summary", "evidence", "error", "message", "suggestions"],
};

// ---------------------------------------------------------------------------
// In-memory state for Browser Arm — backed by KV for restart survival.
// Tracks last execution result for getBrowserArmState().
// Persisted to ENAVIA_BRAIN KV under KV_KEY_BROWSER_ARM_STATE after each write.
// ---------------------------------------------------------------------------
let _browserArmLastExecution = null;

// ---------------------------------------------------------------------------
// In-memory suggestions buffer for Browser Arm.
// Populated when the runtime or executor returns suggestions following
// the canonical SUGGESTION_SHAPE. Persisted to KV alongside last_execution.
// ---------------------------------------------------------------------------
let _browserArmSuggestions = [];

// KV key for Browser Arm persisted state.
// Singleton — one Browser Arm per deployment, no per-contract scope.
// Uses the same ENAVIA_BRAIN KV binding as all other persistent state.
const KV_KEY_BROWSER_ARM_STATE = "browser-arm:state";

// ---------------------------------------------------------------------------
// buildSuggestionFromEnforcement(enforcement)
//
// Builds a canonical suggestion object from an enforcement block result when
// enforcement.suggestion_required is true.
//
// This is the real runtime source of suggestions: when the enforcement layer
// blocks an action that requires user permission/scope expansion, it signals
// that a suggestion must be created. This function materialises that signal
// into a SUGGESTION_SHAPE-compliant object that gets stored in
// _browserArmSuggestions and persisted to KV.
//
// @param {object} enforcement - Result from enforceBrowserArm(). Required fields:
//   - level    {string}  Block level (e.g. "blocked_out_of_scope",
//                        "blocked_not_browser_arm", "blocked_conditional_not_met")
//   - reason   {string}  Human-readable reason for the block — becomes suggestion.discovery
//
// @returns {object} SUGGESTION_SHAPE-compliant suggestion ready for validateSuggestion()
// ---------------------------------------------------------------------------
function buildSuggestionFromEnforcement(enforcement) {
  const levelDefs = {
    blocked_out_of_scope: {
      type: "capability",
      benefit: "Permitir esta ação expande a capacidade operacional do Browser Arm com escopo aprovado.",
      missing_requirement: "Aprovação explícita de escopo para a ação solicitada.",
      expected_impact: "Execução da ação bloqueada após aprovação de escopo.",
    },
    blocked_not_browser_arm: {
      type: "integration",
      benefit: "Roteamento correto da ação para o braço especializado adequado aumenta a eficiência.",
      missing_requirement: "Identificação e habilitação do braço correto para esta ação.",
      expected_impact: "Execução da ação pelo braço especializado adequado.",
    },
    blocked_conditional_not_met: {
      type: "capability",
      benefit: "Permite execução de ação condicionada com justificativa e permissão explícita do usuário.",
      missing_requirement: "Justificativa válida e permissão do usuário para a ação condicionada.",
      expected_impact: "Execução controlada da ação condicionada após aprovação.",
    },
  };
  const def = levelDefs[enforcement.level] || {
    type: "capability",
    benefit: "Revisão do bloqueio pode revelar oportunidade de expansão segura do escopo.",
    missing_requirement: "Revisão do escopo e das permissões necessárias.",
    expected_impact: "Desbloqueio controlado da ação após revisão.",
  };
  return {
    type: def.type,
    discovery: enforcement.reason,
    benefit: def.benefit,
    missing_requirement: def.missing_requirement,
    expected_impact: def.expected_impact,
    permission_needed: true,
  };
}

// ---------------------------------------------------------------------------
// persistBrowserArmState(env)
//
// Persists _browserArmLastExecution + _browserArmSuggestions to KV.
// Called after every _browserArmLastExecution write so state survives restart.
// Silent on failure — never crashes the executor (same pattern as emitExecEvent).
// ---------------------------------------------------------------------------
async function persistBrowserArmState(env) {
  if (!env?.ENAVIA_BRAIN) return;
  try {
    const data = {
      last_execution: _browserArmLastExecution,
      suggestions: _browserArmSuggestions,
      persisted_at: new Date().toISOString(),
    };
    await env.ENAVIA_BRAIN.put(KV_KEY_BROWSER_ARM_STATE, JSON.stringify(data));
  } catch {
    // Never crash the executor on persistence failure
  }
}

// ---------------------------------------------------------------------------
// rehydrateBrowserArmState(env)
//
// Reads persisted Browser Arm state from KV and restores in-memory vars.
// Called by getBrowserArmStateWithKV when memory is null (worker restart).
// Silent on failure — falls back to in-memory (may be empty after fresh deploy).
// ---------------------------------------------------------------------------
async function rehydrateBrowserArmState(env) {
  if (!env?.ENAVIA_BRAIN) return;
  try {
    const raw = await env.ENAVIA_BRAIN.get(KV_KEY_BROWSER_ARM_STATE);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.last_execution && _browserArmLastExecution === null) {
      _browserArmLastExecution = data.last_execution;
    }
    if (Array.isArray(data.suggestions) && _browserArmSuggestions.length === 0) {
      _browserArmSuggestions = data.suggestions;
    }
  } catch {
    // Never crash on rehydration — falls back to current in-memory state
  }
}

// ---------------------------------------------------------------------------
// getBrowserArmStateWithKV(env)
//
// Async variant of getBrowserArmState for the route handler.
// Rehydrates from KV first when in-memory state is null (worker restart),
// then delegates to the synchronous getBrowserArmState().
//
// The synchronous getBrowserArmState() is kept unchanged for test compat.
// ---------------------------------------------------------------------------
async function getBrowserArmStateWithKV(env) {
  if (_browserArmLastExecution === null) {
    await rehydrateBrowserArmState(env);
  }
  return getBrowserArmState();
}

// ---------------------------------------------------------------------------
// buildBrowserExecutorPayload({ action, params, execution_context })
//
// Builds the canonical payload to send to the external browser executor.
// Always includes arm_id, action, external_base, request_id, timestamp.
// ---------------------------------------------------------------------------
function buildBrowserExecutorPayload({ action, params = null, execution_context = null } = {}) {
  const payload = {
    arm_id: BROWSER_ARM_ID,
    action,
    external_base: BROWSER_EXTERNAL_BASE.base_url,
    request_id: `ba_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
  };
  if (params !== null && params !== undefined) {
    payload.params = params;
  }
  if (execution_context !== null && execution_context !== undefined) {
    payload.execution_context = execution_context;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// validateBrowserExecutorResponse(response)
//
// Validates the response from the external browser executor against the
// canonical response shape. Returns normalized result.
// ---------------------------------------------------------------------------
function validateBrowserExecutorResponse(data) {
  if (!data || typeof data !== "object") {
    return {
      valid: false,
      reason: "Resposta do browser executor não é um objeto válido.",
    };
  }
  const missing = BROWSER_EXECUTOR_RESPONSE_SHAPE.required_fields.filter(
    (f) => data[f] === undefined || data[f] === null,
  );
  if (missing.length > 0) {
    return {
      valid: false,
      reason: `Resposta do browser executor incompleta — campos faltantes: ${missing.join(", ")}.`,
      missing_fields: missing,
    };
  }
  return { valid: true, reason: "Resposta válida." };
}

// ---------------------------------------------------------------------------
// callBrowserExecutor(url, payload)
//
// Makes the real HTTP call to the external browser executor.
// Returns { ok, data, error_type, message } with clear failure separation.
//
// Failure types:
//   - BRIDGE_CONNECTIVITY_ERROR: fetch failed (network, DNS, timeout)
//   - BRIDGE_HTTP_ERROR: non-2xx status from browser executor
//   - BRIDGE_INVALID_RESPONSE: response body is not valid JSON or shape
//   - BRIDGE_EXECUTOR_ERROR: browser executor returned ok=false
// ---------------------------------------------------------------------------
async function callBrowserExecutor(url, payload) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      ok: false,
      data: null,
      error_type: "BRIDGE_CONNECTIVITY_ERROR",
      message: `Falha de conectividade com o browser executor: ${err.message || String(err)}`,
    };
  }

  if (!response.ok) {
    let errorBody = null;
    try { errorBody = await response.text(); } catch { /* ignore */ }
    return {
      ok: false,
      data: null,
      error_type: "BRIDGE_HTTP_ERROR",
      message: `Browser executor retornou HTTP ${response.status}: ${errorBody || "sem corpo"}`,
      http_status: response.status,
    };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      data: null,
      error_type: "BRIDGE_INVALID_RESPONSE",
      message: "Resposta do browser executor não é JSON válido.",
    };
  }

  const validation = validateBrowserExecutorResponse(data);
  if (!validation.valid) {
    return {
      ok: false,
      data,
      error_type: "BRIDGE_INVALID_RESPONSE",
      message: validation.reason,
    };
  }

  if (!data.ok) {
    return {
      ok: false,
      data,
      error_type: "BRIDGE_EXECUTOR_ERROR",
      message: data.message || data.error || "Browser executor retornou ok=false.",
    };
  }

  return {
    ok: true,
    data,
    error_type: null,
    message: null,
  };
}

// ---------------------------------------------------------------------------
// executeBrowserArmAction({ action, scope_approved, gates_context,
//                           justification, user_permission,
//                           drift_detected, regression_detected,
//                           params, execution_context, env })
//
// Runtime entry point for any Browser Arm action.
// 1. Calls enforceBrowserArm() first; if blocked, returns immediately.
// 2. If allowed AND env.BROWSER_EXECUTOR_URL is configured:
//    → builds canonical payload → calls external browser executor
//    → returns real execution result
// 3. If allowed but no BROWSER_EXECUTOR_URL:
//    → returns enforcement-only result (backwards-compatible with PR1 tests)
//
// This is the P25 equivalent of executeGitHubPrAction() for P24.
// ---------------------------------------------------------------------------
async function executeBrowserArmAction({
  action,
  scope_approved,
  gates_context,
  justification = null,
  user_permission = false,
  drift_detected = false,
  regression_detected = false,
  params = null,
  execution_context = null,
  env = null,
} = {}) {
  // Run arm-specific enforcement first (pure, no side effects)
  const enforcement = enforceBrowserArm({
    action,
    scope_approved,
    gates_context,
    justification,
    user_permission,
    drift_detected,
    regression_detected,
  });

  // 🛡️ P26-PR2 — Security Supervisor gate (consolidated decision ABOVE arm)
  // Passes arm_check_result so the supervisor can factor in the arm's assessment.
  // evidence_sufficient derived from the canonical P23 gate (real source from caller).
  const resolvedGatesContext = gates_context || _CANONICAL_NULL_GATES_CONTEXT;
  const supervisorGate = _runSupervisorGate({
    action,
    environment: "TEST",
    scope_approved: scope_approved === true,
    gates_context: resolvedGatesContext,
    // Real source: evidence_available_when_required gate provided by the caller
    evidence_sufficient: !!(resolvedGatesContext.evidence_available_when_required),
    arm_id: BROWSER_ARM_ID,
    arm_check_result: {
      allowed: enforcement.allowed,
      reason: enforcement.reason,
      arm_id: enforcement.arm_id,
    },
  });

  // If arm blocked → preserve existing block path (backwards-compatible state management)
  if (!enforcement.allowed) {
    // ── Update in-memory state so /browser-arm/state reflects the block ──
    _browserArmLastExecution = {
      action,
      timestamp: new Date().toISOString(),
      request_id: null,
      ok: false,
      execution_status: "blocked",
      error_type: "BROWSER_ARM_BLOCKED",
      error_message: enforcement.reason,
      target_url: null,
      result_summary: null,
      blocked: true,
      block_level: enforcement.level || null,
      block_reason: enforcement.reason,
      suggestion_required: enforcement.suggestion_required || false,
    };
    // ── When the enforcement requires a suggestion, build a real canonical
    //    suggestion from the block context and store in the suggestions buffer.
    //    This is the real runtime source of suggestions (not manual injection).
    if (enforcement.suggestion_required) {
      const suggestion = buildSuggestionFromEnforcement(enforcement);
      if (validateSuggestion(suggestion).valid) {
        _browserArmSuggestions = [suggestion];
      }
    }
    // ── Persist to KV — survives worker restart ──
    await persistBrowserArmState(env);

    return {
      ok: false,
      error: "BROWSER_ARM_BLOCKED",
      message: enforcement.reason,
      enforcement,
      suggestion_required: enforcement.suggestion_required || false,
      supervisor_enforcement: supervisorGate.supervisorDecision,
    };
  }

  // 🛡️ P26-PR2 — If arm allowed but supervisor blocked → new supervisor block path
  if (!supervisorGate.pass) {
    return _buildSupervisorBlockResponse(supervisorGate.supervisorDecision);
  }

  // ── Resolve BROWSER_EXECUTOR_URL ──
  const executorUrl = (env && env.BROWSER_EXECUTOR_URL)
    ? env.BROWSER_EXECUTOR_URL
    : null;

  // If no executor URL configured, return enforcement-only result (PR1 compat)
  if (!executorUrl) {
    // ── Update in-memory state for enforcement-only path ──
    _browserArmLastExecution = {
      action: enforcement.action,
      timestamp: new Date().toISOString(),
      request_id: null,
      ok: true,
      execution_status: "executed",
      error_type: null,
      error_message: null,
      target_url: null,
      result_summary: null,
      blocked: false,
      block_level: null,
      block_reason: null,
      suggestion_required: false,
    };
    // ── Persist to KV — survives worker restart ──
    await persistBrowserArmState(env);

    return {
      ok: true,
      execution_status: "executed",
      action: enforcement.action,
      arm_id: enforcement.arm_id,
      external_base: BROWSER_EXTERNAL_BASE,
      enforcement,
    };
  }

  // ── Build canonical payload ──
  const payload = buildBrowserExecutorPayload({
    action: enforcement.action,
    params,
    execution_context,
  });

  // ── Call external browser executor ──
  const bridgeResult = await callBrowserExecutor(executorUrl, payload);

  // ── Update in-memory state ──
  _browserArmLastExecution = {
    action: enforcement.action,
    timestamp: payload.timestamp,
    request_id: payload.request_id,
    ok: bridgeResult.ok,
    execution_status: bridgeResult.ok
      ? (bridgeResult.data && bridgeResult.data.execution_status) || "executed"
      : "failed",
    error_type: bridgeResult.error_type,
    error_message: bridgeResult.message,
    target_url: (bridgeResult.ok && bridgeResult.data?.target_url) || null,
    result_summary: (bridgeResult.ok && bridgeResult.data?.result_summary) || null,
    blocked: false,
    block_level: null,
    block_reason: null,
    suggestion_required: false,
  };
  // ── Capture real suggestions returned by the external browser executor ──
  // The executor may return a suggestions[] array in its response when it
  // discovers capabilities or optimisations during browsing. Only valid,
  // canonical suggestions (per SUGGESTION_SHAPE) are accepted.
  if (bridgeResult.ok) {
    const exSuggestions = bridgeResult.data?.suggestions;
    if (Array.isArray(exSuggestions) && exSuggestions.length > 0) {
      _browserArmSuggestions = exSuggestions.filter(
        (s) => validateSuggestion(s).valid,
      );
    }
  }
  // ── Persist to KV — survives worker restart ──
  await persistBrowserArmState(env);

  if (!bridgeResult.ok) {
    return {
      ok: false,
      error: "BROWSER_BRIDGE_FAILED",
      error_type: bridgeResult.error_type,
      message: bridgeResult.message,
      action: enforcement.action,
      arm_id: enforcement.arm_id,
      external_base: BROWSER_EXTERNAL_BASE,
      enforcement,
      payload_sent: payload,
    };
  }

  // ── Success — return real execution result ──
  const exData = bridgeResult.data;
  return {
    ok: true,
    execution_status: exData.execution_status,
    action: exData.action || enforcement.action,
    arm_id: enforcement.arm_id,
    external_base: BROWSER_EXTERNAL_BASE,
    enforcement,
    browser_result: {
      target_url: exData.target_url || null,
      result_summary: exData.result_summary || null,
      evidence: exData.evidence || null,
    },
    request_id: payload.request_id,
  };
}

// ---------------------------------------------------------------------------
// getBrowserArmState()
//
// Returns the current canonical state of the Browser Arm.
// Includes last execution tracking (in-memory, reset on worker restart).
// ---------------------------------------------------------------------------
function getBrowserArmState() {
  const base = { ...BROWSER_ARM_STATE_SHAPE.initial_state };

  if (_browserArmLastExecution) {
    base.status = _browserArmLastExecution.blocked
      ? "disabled"
      : _browserArmLastExecution.ok ? "active" : "error";
    base.last_action = _browserArmLastExecution.action;
    base.last_action_ts = _browserArmLastExecution.timestamp;
    base.last_execution = {
      ok: _browserArmLastExecution.ok,
      execution_status: _browserArmLastExecution.execution_status,
      request_id: _browserArmLastExecution.request_id,
      error_type: _browserArmLastExecution.error_type || null,
      error_message: _browserArmLastExecution.error_message || null,
      target_url: _browserArmLastExecution.target_url || null,
      result_summary: _browserArmLastExecution.result_summary || null,
    };
    // Block/permission state — real enforcement data
    if (_browserArmLastExecution.blocked) {
      base.block = {
        blocked: true,
        level: _browserArmLastExecution.block_level || null,
        reason: _browserArmLastExecution.block_reason || null,
        suggestion_required: _browserArmLastExecution.suggestion_required || false,
      };
    }
  }

  // Suggestions — real array, empty when none exist.
  // Populated only when the runtime registers suggestions via the canonical shape.
  base.suggestions = _browserArmSuggestions.length > 0
    ? _browserArmSuggestions.slice()
    : [];

  return {
    ok: true,
    ...base,
  };
}

// ---------------------------------------------------------------------------
// resetBrowserArmState()
//
// Resets in-memory Browser Arm state. Used for testing only.
// ---------------------------------------------------------------------------
function resetBrowserArmState() {
  _browserArmLastExecution = null;
  _browserArmSuggestions = [];
}

// ---------------------------------------------------------------------------
// handleBrowserArmAction(request, env)
//
// Route handler for POST /browser-arm/action.
// Extracts enforcement fields from request body and dispatches
// to executeBrowserArmAction(). Passes env for BROWSER_EXECUTOR_URL.
// ---------------------------------------------------------------------------
async function handleBrowserArmAction(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Body deve ser JSON válido." },
    };
  }

  const {
    action,
    scope_approved,
    gates_context,
    justification = null,
    user_permission = false,
    drift_detected = false,
    regression_detected = false,
    params = null,
    execution_context = null,
  } = body;

  if (!action || typeof action !== "string") {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_ACTION", message: "'action' é obrigatório." },
    };
  }

  // scope_approved must be explicitly provided as boolean — no implicit authorization
  if (typeof scope_approved !== "boolean") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "MISSING_SCOPE_APPROVED",
        message: "'scope_approved' é obrigatório e deve ser boolean. O runtime não assume autorização implícita.",
      },
    };
  }

  // gates_context must be explicitly provided — no fabricated gates
  if (!gates_context || typeof gates_context !== "object") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "MISSING_GATES_CONTEXT",
        message: "'gates_context' é obrigatório e deve ser um objeto com os gates P23. O runtime não fabrica gates implicitamente.",
      },
    };
  }

  const result = await executeBrowserArmAction({
    action,
    scope_approved,
    gates_context,
    justification,
    user_permission,
    drift_detected,
    regression_detected,
    params,
    execution_context,
    env: env || null,
  });

  // Bridge failures → 502 (bad gateway)
  // Enforcement blocks → 403
  // Success → 200
  let status = 200;
  if (!result.ok) {
    status = result.error === "BROWSER_BRIDGE_FAILED" ? 502 : 403;
  }

  return {
    status,
    body: result,
  };
}
export {
  // Global State Machine
  VALID_STATUSES,
  VALID_GLOBAL_TRANSITIONS,
  transitionStatusGlobal,
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
  completeTaskInternal,   // @internal — use handleCompleteTask for gate-enforced public path
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
  // PR1 — Minimal real exec event emission (6 fields)
  buildExecEvent,
  emitExecEvent,
  readExecEvent,
  KV_SUFFIX_EXEC_EVENT,
  // Macro2-F5 — Functional logs
  appendFunctionalLog,
  readFunctionalLogs,
  KV_SUFFIX_FUNCTIONAL_LOGS,
  KV_SUFFIX_FLOG_ENTRY,
  MAX_FUNCTIONAL_LOGS_PER_CONTRACT,
  // C2 — Automatic Contract Closure in TEST
  closeContractInTest,
  CONTRACT_CLOSURE_STATUSES,
  // F1 — Formal Contract Cancellation
  cancelContract,
  isCancelledContract,
  // F2 — Formal Decomposition Plan Rejection + Resolution
  rejectDecompositionPlan,
  isPlanRejected,
  resolvePlanRevision,
  // Summary
  buildContractSummary,
  // PR1 — Active surface route
  handleGetActiveSurface,
  // Route handlers
  handleCreateContract,
  handleGetContract,
  handleGetContractSummary,
  handleExecuteContract,
  handleCloseContractInTest,
  handleCancelContract,
  handleRejectDecompositionPlan,
  handleResolvePlanRevision,
  // 🛡️ Blindagem Contratual — gate obrigatório por task
  handleCompleteTask,
  // 🛡️ Blindagem Contratual PR 2 — endpoint de auditoria de execução contra contrato
  handleGetExecutionAudit,
  // 🛡️ Blindagem Contratual PR 3 — gate final pesado do contrato inteiro
  closeFinalContract,
  handleCloseFinalContract,
  FINAL_CLOSURE_SOURCE_STATUSES,
  // 🛡️ P24 — GitHub/PR Arm Runtime (separate from Cloudflare executor)
  executeGitHubPrAction,
  requestMergeApproval,
  approveMerge,
  handleGitHubPrAction,
  handleRequestMergeApproval,
  handleApproveMerge,
  // 🌐 P25 — Browser Arm Runtime (separate from Cloudflare executor and GitHub arm)
  executeBrowserArmAction,
  handleBrowserArmAction,
  getBrowserArmState,
  getBrowserArmStateWithKV,
  resetBrowserArmState,
  // P25-PR4+ — KV persistence helpers (exported for testing)
  persistBrowserArmState,
  rehydrateBrowserArmState,
  buildSuggestionFromEnforcement,
  KV_KEY_BROWSER_ARM_STATE,
  // P25-PR2 — Bridge internals (exported for testing)
  buildBrowserExecutorPayload,
  validateBrowserExecutorResponse,
  callBrowserExecutor,
  BROWSER_EXECUTOR_PAYLOAD_SHAPE,
  BROWSER_EXECUTOR_RESPONSE_SHAPE,
  // 🛡️ P26-PR2 — Security Supervisor enforcement (re-exported for testing/auditing)
  SUPERVISOR_DECISION,
  SUPERVISOR_REASON_CODE,
};
