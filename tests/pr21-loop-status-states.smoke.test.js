// ============================================================================
// 🧪 Smoke Test — PR21 — Matriz de estados do GET /contracts/loop-status
//
// Run: node tests/pr21-loop-status-states.smoke.test.js
//
// Prova formal e cruzada do comportamento de loop-status em todos os
// estados operacionais relevantes:
//
//   1. queued / start_task   → POST /contracts/execute-next
//   2. in_progress           → POST /contracts/complete-task   (PR20)
//   3. phase_complete        → POST /contracts/advance-phase   (PR18)
//   4. blocked / cancelled / contract_complete → vazio ou seguro
//
// Reaproveita padrão de fixtures/mocks dos testes PR19 e PR20.
// PR21 NÃO altera runtime — é prova complementar da PR20.
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
  if (body !== undefined) opts.body = typeof body === "string" ? body : JSON.stringify(body);
  const res  = await worker.fetch(new Request(url, opts), env, {});
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ── Fixture builder ─────────────────────────────────────────────────────────
function baseState(contractId, currentPhase = "phase_01", overrides = {}) {
  return {
    contract_id:    contractId,
    contract_name:  "PR21 fixture",
    status_global:  "executing",
    current_phase:  currentPhase,
    current_task:   null,
    phases:         [],
    blockers:       [],
    plan_rejection: null,
    scope:          { workers: ["nv-enavia"] },
    updated_at:     "2026-04-29T00:00:00.000Z",
    ...overrides,
  };
}

function envWith(contractId, decomposition, stateOverrides = {}) {
  const state = baseState(contractId, stateOverrides.current_phase || "phase_01", stateOverrides);
  const kv = makeKV({
    "contract:index":                          JSON.stringify([contractId]),
    [`contract:${contractId}:state`]:          JSON.stringify(state),
    [`contract:${contractId}:decomposition`]:  JSON.stringify(decomposition),
  });
  return { ...BASE_ENV, ENAVIA_BRAIN: kv };
}

// ── Decomposições por estado ────────────────────────────────────────────────

// Estado QUEUED → resolveNextAction Rule 5 → start_task
const DECOMP_QUEUED = {
  phases: [{ id: "phase_01", status: "active", tasks: ["task_001"] }],
  tasks:  [{ id: "task_001", phase_id: "phase_01", status: "queued", depends_on: [], description: "x" }],
  micro_pr_candidates: [
    { id: "mpr-1", task_id: "task_001", status: "queued", environment: "TEST",
      target_workers: ["nv-enavia"], target_routes: ["/contracts/execute-next"] },
  ],
};

// Estado IN_PROGRESS → resolveNextAction Rule 9 → no_action + status:"in_progress"
const DECOMP_IN_PROGRESS = {
  phases: [{ id: "phase_01", status: "active", tasks: ["task_001"] }],
  tasks:  [{ id: "task_001", phase_id: "phase_01", status: "in_progress", depends_on: [], description: "x" }],
  micro_pr_candidates: [],
};

// Estado PHASE_COMPLETE → resolveNextAction Rule 4 → phase_complete
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

// Estado CONTRACT_COMPLETE / awaiting human sign-off (Rule 1)
const DECOMP_ALL_DONE = {
  phases: [{ id: "phase_01", status: "done", tasks: ["task_001"] }],
  tasks:  [{ id: "task_001", phase_id: "phase_01", status: "done", depends_on: [], description: "x" }],
  micro_pr_candidates: [],
};

// ── Test runner ─────────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n=== PR21 — Matriz de estados do loop-status — Smoke Tests ===\n");

  let passed = 0, failed = 0;
  function ok(condition, label) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else            { console.log(`  ❌ ${label}`); failed++; }
  }

  // ── 1. Estado queued / start_task ─────────────────────────────────────
  console.log("1. Estado queued → start_task → execute-next");

  {
    const env = envWith("ct-pr21-queued", DECOMP_QUEUED);
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr21-queued", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    ok(r.status === 200,                                   "  status 200");
    ok(r.data?.nextAction?.type === "start_task",          "  nextAction.type === 'start_task'");
    ok(r.data?.nextAction?.task_id === "task_001",         "  nextAction.task_id === 'task_001'");
    ok(av.includes("POST /contracts/execute-next"),        "  availableActions inclui execute-next");
    ok(!av.includes("POST /contracts/complete-task"),      "  NÃO inclui complete-task");
    ok(!av.includes("POST /contracts/advance-phase"),      "  NÃO inclui advance-phase");
    ok(r.data?.loop?.canProceed === true,                  "  canProceed:true");
    ok(r.data?.loop?.blocked === false,                    "  blocked:false");
    ok(r.data?.operationalAction?.type === "execute_next", "  operationalAction.type === 'execute_next'");
    ok(r.data?.operationalAction?.can_execute === true,    "  operationalAction.can_execute === true");
    console.log("");
  }

  // ── 2. Estado in_progress → complete-task (PR20) ──────────────────────
  console.log("2. Estado in_progress → complete-task (PR20)");

  {
    const env = envWith("ct-pr21-inprog", DECOMP_IN_PROGRESS);
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr21-inprog", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    const guidance = r.data?.loop?.guidance || "";
    ok(r.status === 200,                                   "  status 200");
    ok(r.data?.nextAction?.status === "in_progress",       "  nextAction.status === 'in_progress'");
    ok(r.data?.nextAction?.task_id === "task_001",         "  nextAction.task_id === 'task_001'");
    ok(av.includes("POST /contracts/complete-task"),       "  availableActions inclui complete-task");
    ok(!av.includes("POST /contracts/execute-next"),       "  NÃO inclui execute-next");
    ok(!av.includes("POST /contracts/advance-phase"),      "  NÃO inclui advance-phase");
    ok(/contract_id/i.test(guidance),                      "  guidance menciona 'contract_id'");
    ok(/task_id/i.test(guidance),                          "  guidance menciona 'task_id'");
    ok(/resultado/i.test(guidance),                        "  guidance menciona 'resultado'");
    ok(r.data?.loop?.canProceed === true,                  "  canProceed:true (PR20)");
    // operationalAction permanece seguro (não libera execute-next)
    ok(r.data?.operationalAction?.type === "block",        "  operationalAction.type === 'block' (não libera execução errada)");
    ok(r.data?.operationalAction?.can_execute === false,   "  operationalAction.can_execute === false");
    console.log("");
  }

  // ── 3. Estado phase_complete → advance-phase (PR18) ───────────────────
  console.log("3. Estado phase_complete → advance-phase (PR18)");

  {
    const env = envWith("ct-pr21-pc", DECOMP_PHASE_COMPLETE, { definition_of_done: ["x"] });
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr21-pc", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    const guidance = r.data?.loop?.guidance || "";
    ok(r.status === 200,                                                     "  status 200");
    ok(r.data?.nextAction?.type === "phase_complete",                        "  nextAction.type === 'phase_complete'");
    ok(r.data?.nextAction?.phase_id === "phase_01",                          "  nextAction.phase_id === 'phase_01'");
    ok(av.includes("POST /contracts/advance-phase"),                         "  availableActions inclui advance-phase");
    ok(!av.includes("POST /contracts/complete-task"),                        "  NÃO inclui complete-task");
    ok(!av.includes("POST /contracts/execute-next"),                         "  NÃO inclui execute-next");
    ok(/advance-phase/i.test(guidance),                                      "  guidance menciona 'advance-phase'");
    ok(r.data?.operationalAction?.type === "advance_phase",                  "  operationalAction.type === 'advance_phase'");
    ok(r.data?.operationalAction?.can_execute === true,                      "  operationalAction.can_execute === true");
    ok(r.data?.operationalAction?.requires_human_approval === false,         "  requires_human_approval === false");
    console.log("");
  }

  // ── 4a. Estado plan_rejected → resolveNextAction Rule de plan-rejection ──
  // Nota: status_global="blocked" sozinho NÃO faz resolveNextAction esconder
  // ações — o sistema só bloqueia via plan_rejection / cancellation
  // (campos específicos do state), não via status_global. Comportamento existente.
  console.log("4a. Estado plan_rejected → ações conflitantes não expostas");

  {
    const env = envWith(
      "ct-pr21-rejected",
      DECOMP_QUEUED,
      {
        status_global: "blocked",
        plan_rejection: { plan_rejected: true, reason: "rejected by reviewer", at: "2026-04-29T00:00:00.000Z" },
      },
    );
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr21-rejected", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    ok(r.status === 200,                                   "  status 200");
    ok(!av.includes("POST /contracts/execute-next"),       "  NÃO inclui execute-next");
    ok(!av.includes("POST /contracts/complete-task"),      "  NÃO inclui complete-task");
    ok(!av.includes("POST /contracts/advance-phase"),      "  NÃO inclui advance-phase");
    console.log("");
  }

  // ── 4b. Estado contract cancelled ─────────────────────────────────────
  console.log("4b. Estado cancelled → ações vazias/seguras");

  {
    const env = envWith(
      "ct-pr21-cancelled",
      DECOMP_QUEUED,
      { status_global: "cancelled" },
    );
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr21-cancelled", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    ok(r.status === 200,                                   "  status 200");
    ok(!av.includes("POST /contracts/execute-next"),       "  NÃO inclui execute-next");
    ok(!av.includes("POST /contracts/complete-task"),      "  NÃO inclui complete-task");
    ok(!av.includes("POST /contracts/advance-phase"),      "  NÃO inclui advance-phase");
    console.log("");
  }

  // ── 4c. Estado contract complete (todas as fases done) ────────────────
  console.log("4c. Estado contract_complete (todas fases done) → close-final ou vazio");

  {
    const env = envWith(
      "ct-pr21-complete",
      DECOMP_ALL_DONE,
      { current_phase: "all_phases_complete" },
    );
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr21-complete", undefined, env);
    const av = r.data?.loop?.availableActions || [];
    // contract_complete ou awaiting_human_approval → não deve liberar execute-next/complete-task/advance-phase
    ok(r.status === 200,                                   "  status 200");
    ok(!av.includes("POST /contracts/execute-next"),       "  NÃO inclui execute-next");
    ok(!av.includes("POST /contracts/complete-task"),      "  NÃO inclui complete-task");
    ok(!av.includes("POST /contracts/advance-phase"),      "  NÃO inclui advance-phase");
    console.log("");
  }

  // ── 5. Consistência cruzada (matriz de unicidade) ─────────────────────
  console.log("5. Consistência cruzada — cada estado expõe apenas a ação correta");

  {
    // Matriz dos 3 estados ativos: cada um expõe exatamente 1 ação operacional
    const envs = [
      { label: "queued",         env: envWith("ct-pr21-mx-queued", DECOMP_QUEUED),                                          expected: "POST /contracts/execute-next",   forbidden: ["POST /contracts/complete-task", "POST /contracts/advance-phase"] },
      { label: "in_progress",    env: envWith("ct-pr21-mx-inprog", DECOMP_IN_PROGRESS),                                     expected: "POST /contracts/complete-task",  forbidden: ["POST /contracts/execute-next",  "POST /contracts/advance-phase"] },
      { label: "phase_complete", env: envWith("ct-pr21-mx-pc",     DECOMP_PHASE_COMPLETE, { definition_of_done: ["x"] }),   expected: "POST /contracts/advance-phase",  forbidden: ["POST /contracts/execute-next",  "POST /contracts/complete-task"] },
    ];

    for (const { label, env, expected, forbidden } of envs) {
      const r = await callWorker("GET", `/contracts/loop-status?id=${label === "queued" ? "ct-pr21-mx-queued" : label === "in_progress" ? "ct-pr21-mx-inprog" : "ct-pr21-mx-pc"}`, undefined, env);
      const av = r.data?.loop?.availableActions || [];
      ok(av.includes(expected),                              `  [${label}] expõe ${expected}`);
      for (const f of forbidden) {
        ok(!av.includes(f),                                  `  [${label}] NÃO expõe ${f}`);
      }
    }
    console.log("");
  }

  // ── Resumo ────────────────────────────────────────────────────────────
  console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
