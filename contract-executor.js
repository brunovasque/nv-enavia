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
const VALID_STATUSES = ["draft", "approved", "decomposed", "blocked", "failed"];

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
      status: "pending",
      phase: idx < dod.length - 1 ? "phase_02" : "phase_03",
      depends_on: idx > 0 ? [`task_${String(idx).padStart(3, "0")}`] : [],
    };
    tasks.push(task);

    // Each task is a micro-PR candidate
    microPrCandidates.push({
      id: `micro_pr_${String(idx + 1).padStart(3, "0")}`,
      task_id: taskId,
      title: `${state.contract_id} — ${criterion.slice(0, 80)}`,
      status: "pending",
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
    status: "pending",
    target_workers: workers,
    target_routes: routes,
    environment: "PROD",
  });

  // Assign tasks to phases
  phases[0].tasks.push("task_001");
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
    body: {
      ok: true,
      contract_id: state.contract_id,
      contract_name: state.contract_name,
      status_global: state.status_global,
      current_phase: state.current_phase,
      current_task: state.current_task,
      blockers: state.blockers,
      next_action: state.next_action,
      phases_count: decomposition ? decomposition.phases.length : 0,
      tasks_count: decomposition ? decomposition.tasks.length : 0,
      micro_pr_candidates_count: decomposition ? decomposition.micro_pr_candidates.length : 0,
      created_at: state.created_at,
      updated_at: state.updated_at,
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
  handleCreateContract,
  handleGetContract,
  handleGetContractSummary,
};
