// ============================================================================
// 🧪 Smoke Tests — PR18 — Endpoint supervisionado de avanço de fase
//
// Run: node tests/pr18-advance-phase-endpoint.smoke.test.js
//
// Confirma que o novo endpoint POST /contracts/advance-phase:
//   - Reutiliza advanceContractPhase (sem duplicar lógica nem gate).
//   - Gate-bloqueia avanço quando há tasks incompletas na fase ativa.
//   - Avança quando todas as tasks da fase ativa estão done.
//   - Persiste estado e decomposição no KV (chaves canônicas).
//   - Retorna 400 sem contract_id, 400 com JSON inválido.
//   - GET /contracts/loop-status agora expõe POST /contracts/advance-phase
//     como availableActions quando nextAction.type === "phase_complete".
//   - buildOperationalAction retorna type "advance_phase" (não mais "block")
//     quando o contrato está em phase_complete.
// ============================================================================

import { strict as assert } from "node:assert";
import worker from "../nv-enavia.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// Estado: phase-alpha com task-01 DONE → phase_complete (ready) → advance permitido
function makeStatePhaseComplete(contractId, opts = {}) {
  const phases = opts.phases || [
    { id: "phase-alpha", status: "active", tasks: ["task-01"] },
    { id: "phase-beta",  status: "queued", tasks: ["task-02"] },
  ];
  const tasks = opts.tasks || [
    { id: "task-01", phase_id: "phase-alpha", status: "done",   depends_on: [] },
    { id: "task-02", phase_id: "phase-beta",  status: "queued", depends_on: [] },
  ];
  return {
    state: JSON.stringify({
      contract_id:   contractId,
      status_global: "executing",
      current_phase: "phase-alpha",
      current_task:  null,
      phases:        [],
      blockers:      [],
      plan_rejection: null,
      updated_at:    "2026-04-29T00:00:00.000Z",
    }),
    decomposition: JSON.stringify({ phases, tasks, micro_pr_candidates: [] }),
  };
}

// Estado: phase-alpha com task-01 QUEUED → gate bloqueia avanço
function makeStateGateBlocked(contractId) {
  return {
    state: JSON.stringify({
      contract_id:   contractId,
      status_global: "executing",
      current_phase: "phase-alpha",
      current_task:  null,
      phases:        [],
      blockers:      [],
      plan_rejection: null,
      updated_at:    "2026-04-29T00:00:00.000Z",
    }),
    decomposition: JSON.stringify({
      phases: [{ id: "phase-alpha", status: "active", tasks: ["task-01"] }],
      tasks:  [{ id: "task-01", phase_id: "phase-alpha", status: "queued", depends_on: [] }],
      micro_pr_candidates: [],
    }),
  };
}

function envFromKV(kv) {
  return { ...BASE_ENV, ENAVIA_BRAIN: kv };
}

// ── Test runner ──────────────────────────────────────────────────────────────

async function runTests() {
  console.log("\n=== PR18 — POST /contracts/advance-phase — Smoke Tests ===\n");

  let passed = 0, failed = 0;
  function ok(condition, label) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else            { console.log(`  ❌ ${label}`); failed++; }
  }

  // ── A. Validação de input ────────────────────────────────────────────────
  console.log("A. Validação de input");

  {
    console.log("  A1. JSON inválido → 400 blocked");
    const url = "https://worker.test/contracts/advance-phase";
    const res = await worker.fetch(
      new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not-json" }),
      envFromKV(makeKV()),
      {},
    );
    const data = await res.json();
    ok(res.status === 400,                  "  status 400");
    ok(data?.ok === false,                  "  ok:false");
    ok(data?.status === "blocked",          "  status:blocked");
    ok(/JSON/i.test(data?.reason || ""),    "  reason menciona JSON");
    console.log("");
  }

  {
    console.log("  A2. body sem contract_id → 400 blocked");
    const r = await callWorker("POST", "/contracts/advance-phase", {}, envFromKV(makeKV()));
    ok(r.status === 400,                                "  status 400");
    ok(r.data?.ok === false,                            "  ok:false");
    ok(r.data?.status === "blocked",                    "  status:blocked");
    ok(/contract_id/i.test(r.data?.reason || ""),       "  reason menciona contract_id");
    console.log("");
  }

  {
    console.log("  A3. aceita contractId (camelCase) como alias de contract_id");
    const { state, decomposition } = makeStatePhaseComplete("ct-pr18-camel");
    const kv = makeKV({
      "contract:index":                       JSON.stringify(["ct-pr18-camel"]),
      "contract:ct-pr18-camel:state":         state,
      "contract:ct-pr18-camel:decomposition": decomposition,
    });
    const r = await callWorker("POST", "/contracts/advance-phase", { contractId: "ct-pr18-camel" }, envFromKV(kv));
    ok(r.status === 200,                "  status 200");
    ok(r.data?.ok === true,             "  ok:true");
    ok(r.data?.status === "advanced",   "  status:advanced");
    console.log("");
  }

  // ── B. Avanço de fase (happy path) ───────────────────────────────────────
  console.log("B. Avanço de fase (happy path)");

  {
    console.log("  B1. phase_complete com gate ok → 200 advanced + KV atualizado");
    const { state, decomposition } = makeStatePhaseComplete("ct-pr18-001");
    const kv = makeKV({
      "contract:index":                     JSON.stringify(["ct-pr18-001"]),
      "contract:ct-pr18-001:state":         state,
      "contract:ct-pr18-001:decomposition": decomposition,
    });
    const r = await callWorker("POST", "/contracts/advance-phase", { contract_id: "ct-pr18-001" }, envFromKV(kv));
    ok(r.status === 200,                                       "  status 200");
    ok(r.data?.ok === true,                                    "  ok:true");
    ok(r.data?.status === "advanced",                          "  status:advanced");
    ok(r.data?.contract_id === "ct-pr18-001",                  "  contract_id retornado");
    ok(r.data?.result?.ok === true,                            "  result.ok:true");
    ok(r.data?.result?.gate?.canAdvance === true,              "  gate.canAdvance:true");

    const nextState = JSON.parse(kv.db["contract:ct-pr18-001:state"]);
    const nextDecomp = JSON.parse(kv.db["contract:ct-pr18-001:decomposition"]);
    ok(nextState.current_phase === "phase-beta",               "  current_phase avançou para phase-beta");
    const phaseAlphaDone = nextDecomp.phases.find((p) => p.id === "phase-alpha");
    ok(phaseAlphaDone?.status === "done",                      "  phase-alpha marcada como done");
    ok(kv.writes.some((w) => w.key === "contract:ct-pr18-001:state"),         "  KV state escrito");
    ok(kv.writes.some((w) => w.key === "contract:ct-pr18-001:decomposition"), "  KV decomposition escrito");
    console.log("");
  }

  {
    console.log("  B2. única fase com tasks done → current_phase = all_phases_complete");
    const { state, decomposition } = makeStatePhaseComplete("ct-pr18-final", {
      phases: [{ id: "phase-only", status: "active", tasks: ["task-x"] }],
      tasks:  [{ id: "task-x", phase_id: "phase-only", status: "done", depends_on: [] }],
    });
    const kv = makeKV({
      "contract:index":                       JSON.stringify(["ct-pr18-final"]),
      "contract:ct-pr18-final:state":         state.replace('"phase-alpha"', '"phase-only"'),
      "contract:ct-pr18-final:decomposition": decomposition,
    });
    const r = await callWorker("POST", "/contracts/advance-phase", { contract_id: "ct-pr18-final" }, envFromKV(kv));
    ok(r.status === 200,                                                 "  status 200");
    ok(r.data?.ok === true,                                              "  ok:true");
    const nextState = JSON.parse(kv.db["contract:ct-pr18-final:state"]);
    ok(nextState.current_phase === "all_phases_complete",                "  current_phase = all_phases_complete");
    console.log("");
  }

  // ── C. Gate de segurança ─────────────────────────────────────────────────
  console.log("C. Gate de segurança");

  {
    console.log("  C1. fase com task incompleta → 409 blocked, KV state atualizado com blocker");
    const { state, decomposition } = makeStateGateBlocked("ct-pr18-gate");
    const kv = makeKV({
      "contract:index":                      JSON.stringify(["ct-pr18-gate"]),
      "contract:ct-pr18-gate:state":         state,
      "contract:ct-pr18-gate:decomposition": decomposition,
    });
    const r = await callWorker("POST", "/contracts/advance-phase", { contract_id: "ct-pr18-gate" }, envFromKV(kv));
    ok(r.status === 409,                                    "  status 409");
    ok(r.data?.ok === false,                                "  ok:false");
    ok(r.data?.status === "blocked",                        "  status:blocked");
    ok(/incomplete|task/i.test(r.data?.reason || ""),       "  reason menciona task incompleta");
    ok(r.data?.result?.gate?.canAdvance === false,          "  gate.canAdvance:false");
    const nextState = JSON.parse(kv.db["contract:ct-pr18-gate:state"]);
    ok(Array.isArray(nextState.blockers) && nextState.blockers.length > 0, "  blockers persistidos");
    console.log("");
  }

  {
    console.log("  C2. contract_id inexistente → 409 blocked CONTRACT_NOT_FOUND");
    const kv = makeKV({ "contract:index": JSON.stringify([]) });
    const r = await callWorker("POST", "/contracts/advance-phase", { contract_id: "ct-pr18-missing" }, envFromKV(kv));
    ok(r.status === 409,                                    "  status 409");
    ok(r.data?.ok === false,                                "  ok:false");
    ok(/not.found|CONTRACT_NOT_FOUND/i.test(r.data?.reason || JSON.stringify(r.data?.result || {})), "  reason indica not found");
    console.log("");
  }

  // ── D. loop-status reflete o novo endpoint ───────────────────────────────
  console.log("D. loop-status reflete o novo endpoint");

  {
    console.log("  D1. loop-status com phase_complete → availableActions inclui POST /contracts/advance-phase");
    const { state, decomposition } = makeStatePhaseComplete("ct-pr18-loop");
    const kv = makeKV({
      "contract:index":                      JSON.stringify(["ct-pr18-loop"]),
      "contract:ct-pr18-loop:state":         state,
      "contract:ct-pr18-loop:decomposition": decomposition,
    });
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr18-loop", undefined, envFromKV(kv));
    ok(r.status === 200,                                                                   "  status 200");
    ok(r.data?.ok === true,                                                                "  ok:true");
    ok(r.data?.nextAction?.type === "phase_complete",                                      "  nextAction.type:phase_complete");
    ok(Array.isArray(r.data?.loop?.availableActions),                                      "  loop.availableActions é array");
    ok((r.data?.loop?.availableActions || []).includes("POST /contracts/advance-phase"),   "  contém POST /contracts/advance-phase");
    ok(typeof r.data?.loop?.guidance === "string" && /advance-phase/i.test(r.data?.loop?.guidance), "  guidance referencia advance-phase");
    ok(!/no phase-advance endpoint/i.test(r.data?.loop?.guidance || ""),                   "  guidance NÃO diz mais 'no phase-advance endpoint'");
    console.log("");
  }

  {
    console.log("  D2. loop-status retorna operationalAction.type === 'advance_phase' (não 'block')");
    const { state, decomposition } = makeStatePhaseComplete("ct-pr18-opaction");
    const kv = makeKV({
      "contract:index":                          JSON.stringify(["ct-pr18-opaction"]),
      "contract:ct-pr18-opaction:state":         state,
      "contract:ct-pr18-opaction:decomposition": decomposition,
    });
    const r = await callWorker("GET", "/contracts/loop-status?id=ct-pr18-opaction", undefined, envFromKV(kv));
    const op = r.data?.operationalAction;
    ok(op?.type === "advance_phase",          "  operational_action.type === 'advance_phase'");
    ok(op?.can_execute === true,              "  can_execute:true");
    ok(op?.requires_human_approval === false, "  requires_human_approval:false (supervisionado, não humano)");
    ok(Array.isArray(op?.evidence_required) && op.evidence_required.includes("contract_id"), "  evidence_required inclui contract_id");
    console.log("");
  }

  // ── E. Ordem de operações: advance-phase NÃO é chamado em execute-next ──
  console.log("E. Isolamento — execute-next NÃO chama advance-phase implicitamente");

  {
    console.log("  E1. execute-next em phase_complete não avança a fase");
    const { state, decomposition } = makeStatePhaseComplete("ct-pr18-exec");
    const kv = makeKV({
      "contract:index":                      JSON.stringify(["ct-pr18-exec"]),
      "contract:ct-pr18-exec:state":         state,
      "contract:ct-pr18-exec:decomposition": decomposition,
    });
    await callWorker("POST", "/contracts/execute-next", { confirm: true, approved_by: "tester", evidence: [] }, envFromKV(kv));
    const stateAfter = JSON.parse(kv.db["contract:ct-pr18-exec:state"]);
    ok(stateAfter.current_phase === "phase-alpha",
      "  current_phase NÃO mudou (avanço só via /contracts/advance-phase explícito)");
    console.log("");
  }

  // ── Resumo ───────────────────────────────────────────────────────────────
  console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
