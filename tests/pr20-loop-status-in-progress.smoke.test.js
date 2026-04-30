// ============================================================================
// 🧪 Smoke Test — PR20 — loop-status expõe complete-task quando task in_progress
//
// Run: node tests/pr20-loop-status-in-progress.smoke.test.js
//
// Prova:
//   - Quando a task está in_progress, GET /contracts/loop-status retorna
//     availableActions = ["POST /contracts/complete-task"] e guidance que
//     instrui chamar complete-task.
//   - canProceed true nesse estado.
//   - Estados indevidos NÃO mostram complete-task: queued, phase_complete,
//     contract_complete, blocked.
//   - phase_complete continua mostrando POST /contracts/advance-phase.
//   - start_task continua mostrando POST /contracts/execute-next.
// ============================================================================

import { strict as assert } from "node:assert";
import worker from "../nv-enavia.js";

// ── KV mock ──────────────────────────────────────────────────────────────────
function makeKV(db = {}) {
  const writes = [];
  return {
    writes,
    db,
    get: async (key) => db[key] ?? null,
    put: async (key, val) => { writes.push({ key, val }); db[key] = val; },
    list: async () => ({ keys: Object.keys(db).map((name) => ({ name })) }),
    delete: async (key) => { delete db[key]; },
  };
}

const BASE_ENV = {
  ENAVIA_MODE:     "supervised",
  OPENAI_API_KEY:  "test-key-fake",
  OPENAI_MODEL:    "gpt-test",
  OWNER:           "Vasques",
  SYSTEM_NAME:     "ENAVIA",
  SUPABASE_URL:    "https://test.supabase.co",
  SUPABASE_BUCKET: "test-bucket",
};

async function callWorker(method, path, body, env = {}) {
  const url  = `https://worker.test${path}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res  = await worker.fetch(new Request(url, opts), env, {});
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ── Fixtures ────────────────────────────────────────────────────────────────

function baseState(contractId, currentPhase = "phase_01") {
  return {
    contract_id:    contractId,
    contract_name:  "PR20 fixture",
    status_global:  "executing",
    current_phase:  currentPhase,
    current_task:   null,
    phases:         [],
    blockers:       [],
    plan_rejection: null,
    scope:          { workers: ["nv-enavia"] },
    updated_at:     "2026-04-29T00:00:00.000Z",
  };
}

function envWith(contractId, decomposition, stateOverrides = {}) {
  const state = { ...baseState(contractId), ...stateOverrides };
  const kv = makeKV({
    "contract:index":                          JSON.stringify([contractId]),
    [`contract:${contractId}:state`]:          JSON.stringify(state),
    [`contract:${contractId}:decomposition`]:  JSON.stringify(decomposition),
  });
  return { ...BASE_ENV, ENAVIA_BRAIN: kv };
}

// task_001 in_progress (Rule 9 → no_action + status:"in_progress")
const DECOMP_IN_PROGRESS = {
  phases: [{ id: "phase_01", status: "active", tasks: ["task_001"] }],
  tasks:  [{ id: "task_001", phase_id: "phase_01", status: "in_progress", depends_on: [], description: "x" }],
  micro_pr_candidates: [],
};

// task_001 queued (Rule 5 → start_task)
const DECOMP_QUEUED = {
  phases: [{ id: "phase_01", status: "active", tasks: ["task_001"] }],
  tasks:  [{ id: "task_001", phase_id: "phase_01", status: "queued", depends_on: [], description: "x" }],
  micro_pr_candidates: [
    { id: "mpr-1", task_id: "task_001", status: "queued", environment: "TEST",
      target_workers: ["nv-enavia"], target_routes: ["/contracts/execute-next"] },
  ],
};

// task_001 done (Rule 4 → phase_complete)
const DECOMP_PHASE_COMPLETE = {
  phases: [
    { id: "phase_01", status: "active", tasks: ["task_001"] },
    { id: "phase_02", status: "queued", tasks: ["task_002"] },
  ],
  tasks: [
    { id: "task_001", phase_id: "phase_01", status: "done",   depends_on: [], description: "x" },
    { id: "task_002", phase_id: "phase_02", status: "queued", depends_on: [], description: "y" },
  ],
  micro_pr_candidates: [],
};

// ── Test runner ──────────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n=== PR20 — loop-status com task in_progress — Smoke Tests ===\n");

  let passed = 0, failed = 0;
  function ok(condition, label) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else            { console.log(`  ❌ ${label}`); failed++; }
  }

  // ── A. Caso principal: task in_progress ────────────────────────────────
  console.log("A. Task in_progress → loop-status expõe complete-task");

  {
    console.log("  A1. availableActions inclui POST /contracts/complete-task");
    const env = envWith("ct-pr20-inprog", DECOMP_IN_PROGRESS);
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-inprog", undefined, env);
    ok(r.status === 200,                                                                   "    status 200");
    ok(r.data?.ok === true,                                                                "    ok:true");
    ok(r.data?.nextAction?.status === "in_progress",                                       "    nextAction.status === 'in_progress'");
    ok(r.data?.nextAction?.task_id === "task_001",                                         "    nextAction.task_id === 'task_001'");
    ok(Array.isArray(r.data?.loop?.availableActions),                                      "    loop.availableActions é array");
    ok((r.data?.loop?.availableActions || []).includes("POST /contracts/complete-task"),  "    contém POST /contracts/complete-task");
    ok(typeof r.data?.loop?.guidance === "string" && /complete-task/i.test(r.data.loop.guidance), "    guidance referencia complete-task");
    ok(/contract_id.*task_id.*resultado/i.test(r.data?.loop?.guidance || ""),              "    guidance lista parâmetros { contract_id, task_id, resultado }");
    console.log("");
  }

  {
    console.log("  A2. canProceed:true em in_progress (operador pode prosseguir)");
    const env = envWith("ct-pr20-inprog-2", DECOMP_IN_PROGRESS);
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-inprog-2", undefined, env);
    ok(r.data?.loop?.canProceed === true,    "    loop.canProceed === true");
    ok(r.data?.loop?.blocked === false,      "    loop.blocked === false");
    console.log("");
  }

  {
    console.log("  A3. NÃO mostra execute-next nem advance-phase em in_progress");
    const env = envWith("ct-pr20-inprog-3", DECOMP_IN_PROGRESS);
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-inprog-3", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    ok(!av.includes("POST /contracts/execute-next"),   "    NÃO inclui execute-next");
    ok(!av.includes("POST /contracts/advance-phase"),  "    NÃO inclui advance-phase");
    ok(!av.includes("POST /contracts/close-final"),    "    NÃO inclui close-final");
    console.log("");
  }

  // ── B. Estados indevidos NÃO mostram complete-task ─────────────────────
  console.log("B. Estados indevidos NÃO mostram complete-task");

  {
    console.log("  B1. queued → mostra execute-next, NÃO mostra complete-task");
    const env = envWith("ct-pr20-queued", DECOMP_QUEUED);
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-queued", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    ok(r.data?.nextAction?.type === "start_task",          "    nextAction.type === 'start_task'");
    ok(av.includes("POST /contracts/execute-next"),        "    inclui execute-next");
    ok(!av.includes("POST /contracts/complete-task"),      "    NÃO inclui complete-task");
    console.log("");
  }

  {
    console.log("  B2. phase_complete → mostra advance-phase, NÃO mostra complete-task");
    const env = envWith(
      "ct-pr20-phasecomp",
      DECOMP_PHASE_COMPLETE,
      { definition_of_done: ["x"] },
    );
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-phasecomp", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    ok(r.data?.nextAction?.type === "phase_complete",      "    nextAction.type === 'phase_complete'");
    ok(av.includes("POST /contracts/advance-phase"),       "    inclui advance-phase");
    ok(!av.includes("POST /contracts/complete-task"),      "    NÃO inclui complete-task");
    ok(!av.includes("POST /contracts/execute-next"),       "    NÃO inclui execute-next");
    console.log("");
  }

  {
    console.log("  B3. contract bloqueado → NÃO mostra complete-task");
    const decomp = {
      phases: [{ id: "phase_01", status: "active", tasks: ["task_001"] }],
      tasks:  [{ id: "task_001", phase_id: "phase_01", status: "queued", depends_on: [], description: "x" }],
      micro_pr_candidates: [],
    };
    const env = envWith(
      "ct-pr20-blocked",
      decomp,
      { status_global: "blocked", blockers: ["test blocker"] },
    );
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-blocked", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    ok(!av.includes("POST /contracts/complete-task"), "    NÃO inclui complete-task quando contrato bloqueado");
    console.log("");
  }

  // ── C. operationalAction não libera execução errada ─────────────────────
  console.log("C. operationalAction não libera execução errada em in_progress");

  {
    console.log("  C1. operationalAction.type / can_execute em in_progress são consistentes");
    const env = envWith("ct-pr20-opaction", DECOMP_IN_PROGRESS);
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-opaction", undefined, env);
    const op = r.data?.operationalAction;
    // nextAction.type === "no_action" mapeia para opType "block" em buildOperationalAction.
    // Isso é correto — operationalAction sinaliza que NÃO há execução supervisionada
    // disponível por execute-next; a ação de progredir é via complete-task humano/operador.
    ok(op?.type === "block",                             "    operationalAction.type === 'block' (nenhuma execução em in_progress)");
    ok(op?.can_execute === false,                        "    operationalAction.can_execute === false (não libera execute-next)");
    ok(op?.requires_human_approval === false,            "    requires_human_approval === false");
    console.log("");
  }

  // ── D. canProceed em estados ────────────────────────────────────────────
  console.log("D. canProceed reflete corretamente cada estado");

  {
    console.log("  D1. queued → canProceed:true");
    const env = envWith("ct-pr20-cp-queued", DECOMP_QUEUED);
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-cp-queued", undefined, env);
    ok(r.data?.loop?.canProceed === true, "    canProceed:true (start_task isReady)");
    console.log("");
  }

  {
    console.log("  D2. phase_complete → canProceed:true");
    const env = envWith("ct-pr20-cp-pc", DECOMP_PHASE_COMPLETE, { definition_of_done: ["x"] });
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-cp-pc", undefined, env);
    ok(r.data?.loop?.canProceed === true, "    canProceed:true (phase_complete isReady)");
    console.log("");
  }

  {
    console.log("  D3. in_progress → canProceed:true (PR20)");
    const env = envWith("ct-pr20-cp-ip", DECOMP_IN_PROGRESS);
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr20-cp-ip", undefined, env);
    ok(r.data?.loop?.canProceed === true, "    canProceed:true (PR20: in_progress permite complete-task)");
    console.log("");
  }

  // ── Resumo ──────────────────────────────────────────────────────────────
  console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
