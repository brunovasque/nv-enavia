// ============================================================================
// 🧪 Smoke Test E2E — PR19 — Ciclo completo do loop contratual
//
// Run: node tests/pr19-advance-phase-e2e.smoke.test.js
//
// Prova ponta a ponta o ciclo:
//
//   loop-status (start_task)
//     → execute-next (queued → in_progress)
//       → complete-task (in_progress → completed) [gate aderência]
//         → loop-status (phase_complete)
//           → advance-phase (fase 1 → fase 2)
//             → loop-status (start_task na fase 2)
//
// Cobertura mínima exigida:
//   - Happy path completo com 2 fases reais e 2 tasks reais.
//   - Bloqueio: advance-phase ANTES de completar tasks da fase → 409.
//   - loop-status mostra POST /contracts/advance-phase apenas em phase_complete.
//   - Após advance-phase, loop-status sai de phase_complete e aponta próxima task.
//   - Avanço de fase NUNCA ocorre implicitamente em execute-next.
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

// ── Executor mock — audit + propose aprovam tudo ─────────────────────────────
const AUDIT_OK_BODY = {
  ok: true,
  route: "/audit",
  result: { verdict: "approve", risk_level: "low" },
};

const PROPOSE_OK_BODY = {
  ok: true,
  route: "/propose",
  result: { patch: "ok", verdict: "approve" },
};

function makeExecutorMock() {
  const calls = [];
  const responses = {
    "/audit":   { status: 200, body: AUDIT_OK_BODY },
    "/propose": { status: 200, body: PROPOSE_OK_BODY },
  };
  return {
    calls,
    binding: {
      fetch: async (url, opts) => {
        const pathname = new URL(url).pathname;
        calls.push({ pathname, body: opts?.body });
        const resp = responses[pathname] || { status: 500, body: { ok: false, error: "rota não mapeada" } };
        return new Response(JSON.stringify(resp.body), { status: resp.status });
      },
    },
  };
}

function makeDeployMock() {
  const calls = [];
  const responses = {
    "/__internal__/audit": { status: 200, body: { ok: true, status: "recorded" } },
    "/apply-test":         { status: 200, body: { ok: true, action: "simulate", status: "passed" } },
  };
  return {
    calls,
    binding: {
      fetch: async (url, opts) => {
        const pathname = new URL(url).pathname;
        calls.push({ pathname, body: opts?.body });
        const resp = responses[pathname] || { status: 500, body: { ok: false } };
        return new Response(JSON.stringify(resp.body), { status: resp.status });
      },
    },
  };
}

// ── BASE_ENV ─────────────────────────────────────────────────────────────────
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

// ── Fixture: contrato com 2 fases, 2 tasks, ambas queued ─────────────────────
function makeTwoPhaseFixture(contractId) {
  const state = {
    contract_id:    contractId,
    contract_name:  "PR19 E2E Contract",
    status_global:  "executing",
    current_phase:  "phase_01",
    current_task:   null,
    phases:         [],
    blockers:       [],
    plan_rejection: null,
    scope:          { workers: ["nv-enavia"] },
    // exigido por auditExecution (PR2 — execution audit) durante complete-task
    definition_of_done: ["E2E smoke: ciclo execute → complete → advance-phase"],
    updated_at:     "2026-04-29T00:00:00.000Z",
  };
  const decomposition = {
    phases: [
      { id: "phase_01", status: "active", tasks: ["task_001"] },
      { id: "phase_02", status: "queued", tasks: ["task_002"] },
    ],
    tasks: [
      {
        id: "task_001",
        phase_id: "phase_01",
        status: "queued",
        depends_on: [],
        description: "Tarefa de smoke E2E para fase 1",
      },
      {
        id: "task_002",
        phase_id: "phase_02",
        status: "queued",
        depends_on: [],
        description: "Tarefa de smoke E2E para fase 2",
      },
    ],
    micro_pr_candidates: [
      {
        id: "micro-pr-task-001",
        task_id: "task_001",
        status: "queued",
        environment: "TEST",
        target_workers: ["nv-enavia"],
        target_routes: ["/contracts/execute-next"],
      },
      {
        id: "micro-pr-task-002",
        task_id: "task_002",
        status: "queued",
        environment: "TEST",
        target_workers: ["nv-enavia"],
        target_routes: ["/contracts/execute-next"],
      },
    ],
  };
  return { state, decomposition };
}

function makeEnv(contractId) {
  const { state, decomposition } = makeTwoPhaseFixture(contractId);
  const kv = makeKV({
    "contract:index":                       JSON.stringify([contractId]),
    [`contract:${contractId}:state`]:         JSON.stringify(state),
    [`contract:${contractId}:decomposition`]: JSON.stringify(decomposition),
  });
  const exec   = makeExecutorMock();
  const deploy = makeDeployMock();
  return {
    env: {
      ...BASE_ENV,
      ENAVIA_BRAIN: kv,
      EXECUTOR:     exec.binding,
      DEPLOY_WORKER: deploy.binding,
    },
    kv,
    exec,
    deploy,
  };
}

// MicrostepResultado aderente — passa pelo gate evaluateAdherence
const RESULTADO_ADERENTE = {
  objetivo_atendido:        true,
  criterio_aceite_atendido: true,
  escopo_efetivo:           ["task concluída via smoke E2E"],
  is_simulado:              false,
  is_mockado:               false,
  is_local:                 false,
  is_parcial:               false,
};

// ── Test runner ──────────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n=== PR19 — E2E ciclo completo execute → complete → advance-phase ===\n");

  let passed = 0, failed = 0;
  function ok(condition, label) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else            { console.log(`  ❌ ${label}`); failed++; }
  }

  // ────────────────────────────────────────────────────────────────────────
  // CENÁRIO HAPPY PATH — ciclo completo de 2 fases
  // ────────────────────────────────────────────────────────────────────────
  console.log("HAPPY PATH — ciclo completo de 2 fases\n");

  const contractId = "ctr-pr19-e2e-001";
  const { env, kv } = makeEnv(contractId);

  // Step 1 — loop-status inicial: deve retornar start_task para task_001
  console.log("  Step 1. GET /contracts/loop-status (estado inicial)");
  {
    const r = await callWorker("GET", `/contracts/loop-status?id=${contractId}`, undefined, env);
    ok(r.status === 200,                                                   "    status 200");
    ok(r.data?.ok === true,                                                "    ok:true");
    ok(r.data?.nextAction?.type === "start_task",                          "    nextAction.type === 'start_task'");
    ok(r.data?.nextAction?.task_id === "task_001",                         "    nextAction.task_id === 'task_001'");
    ok((r.data?.loop?.availableActions || []).includes("POST /contracts/execute-next"), "    availableActions inclui execute-next");
    ok(r.data?.operationalAction?.type === "execute_next",                 "    operationalAction.type === 'execute_next'");
    ok(r.data?.operationalAction?.can_execute === true,                    "    can_execute:true");
    console.log("");
  }

  // Step 2 — execute-next: task_001 transiciona queued → in_progress
  console.log("  Step 2. POST /contracts/execute-next (task_001 queued → in_progress)");
  {
    const r = await callWorker(
      "POST",
      "/contracts/execute-next",
      { confirm: true, approved_by: "pr19-tester", evidence: ["e2e-test"] },
      env,
    );
    ok(r.status === 200 || r.status === 202,             "    status 200/202 (executou ou aceitou)");
    ok(r.data?.executed === true || r.data?.status !== "blocked", "    executed ou não-blocked");
    // Verifica persistência: task_001 saiu de "queued"
    const decompAfter = JSON.parse(kv.db[`contract:${contractId}:decomposition`]);
    const t1 = decompAfter.tasks.find((t) => t.id === "task_001");
    ok(t1.status !== "queued",                           `    task_001 saiu de queued (atual: ${t1.status})`);
    ok(["in_progress", "completed", "done"].includes(t1.status), `    task_001 em estado executável (${t1.status})`);
    console.log("");
  }

  // Step 3 — complete-task: aderente → task_001 = completed
  console.log("  Step 3. POST /contracts/complete-task (gate aderência aprova)");
  {
    const r = await callWorker(
      "POST",
      "/contracts/complete-task",
      {
        contract_id: contractId,
        task_id:     "task_001",
        resultado:   RESULTADO_ADERENTE,
      },
      env,
    );
    ok(r.status === 200,                                       "    status 200");
    ok(r.data?.ok === true,                                    "    ok:true");
    ok(r.data?.task_status === "completed",                    "    task_status === 'completed'");
    ok(r.data?.adherence_status === "aderente_ao_contrato",    "    adherence_status === 'aderente_ao_contrato'");
    ok(r.data?.can_mark_concluded === true,                    "    can_mark_concluded:true");
    const decompAfter = JSON.parse(kv.db[`contract:${contractId}:decomposition`]);
    const t1 = decompAfter.tasks.find((t) => t.id === "task_001");
    ok(t1.status === "completed",                              "    task_001 persistida como completed no KV");
    console.log("");
  }

  // Step 4 — loop-status agora retorna phase_complete + advance-phase disponível
  console.log("  Step 4. GET /contracts/loop-status (deve mostrar phase_complete + advance-phase)");
  {
    const r = await callWorker("GET", `/contracts/loop-status?id=${contractId}`, undefined, env);
    ok(r.status === 200,                                                                       "    status 200");
    ok(r.data?.nextAction?.type === "phase_complete",                                          "    nextAction.type === 'phase_complete'");
    ok(r.data?.nextAction?.phase_id === "phase_01",                                            "    nextAction.phase_id === 'phase_01'");
    ok((r.data?.loop?.availableActions || []).includes("POST /contracts/advance-phase"),       "    availableActions inclui POST /contracts/advance-phase");
    ok(r.data?.operationalAction?.type === "advance_phase",                                    "    operationalAction.type === 'advance_phase'");
    ok(r.data?.operationalAction?.can_execute === true,                                        "    operationalAction.can_execute === true");
    ok(typeof r.data?.loop?.guidance === "string" && /advance-phase/i.test(r.data.loop.guidance), "    guidance referencia advance-phase");
    ok(!/no phase-advance endpoint/i.test(r.data?.loop?.guidance || ""),                       "    guidance NÃO diz 'no phase-advance endpoint'");
    console.log("");
  }

  // Step 5 — advance-phase: phase_01 → phase_02
  console.log("  Step 5. POST /contracts/advance-phase (phase_01 → phase_02)");
  {
    const r = await callWorker(
      "POST",
      "/contracts/advance-phase",
      { contract_id: contractId },
      env,
    );
    ok(r.status === 200,                                          "    status 200");
    ok(r.data?.ok === true,                                       "    ok:true");
    ok(r.data?.status === "advanced",                             "    status === 'advanced'");
    ok(r.data?.contract_id === contractId,                        "    contract_id no response");
    ok(r.data?.result?.gate?.canAdvance === true,                 "    gate.canAdvance === true");
    const stateAfter  = JSON.parse(kv.db[`contract:${contractId}:state`]);
    const decompAfter = JSON.parse(kv.db[`contract:${contractId}:decomposition`]);
    ok(stateAfter.current_phase === "phase_02",                   "    state.current_phase === 'phase_02'");
    const phase01 = decompAfter.phases.find((p) => p.id === "phase_01");
    const phase02 = decompAfter.phases.find((p) => p.id === "phase_02");
    ok(phase01?.status === "done",                                "    phase_01 marcada como 'done' na decomposition");
    ok(phase02?.status !== "done",                                "    phase_02 ainda não está 'done'");
    console.log("");
  }

  // Step 6 — loop-status pós-advance: deve apontar para task_002 da phase_02
  console.log("  Step 6. GET /contracts/loop-status (próxima ação na phase_02)");
  {
    const r = await callWorker("GET", `/contracts/loop-status?id=${contractId}`, undefined, env);
    ok(r.status === 200,                                                  "    status 200");
    ok(r.data?.contract?.current_phase === "phase_02",                    "    contract.current_phase === 'phase_02'");
    ok(r.data?.nextAction?.type === "start_task",                         "    nextAction.type === 'start_task' (não phase_complete)");
    ok(r.data?.nextAction?.task_id === "task_002",                        "    nextAction.task_id === 'task_002'");
    ok(r.data?.nextAction?.type !== "phase_complete",                     "    saiu do estado phase_complete");
    ok((r.data?.loop?.availableActions || []).includes("POST /contracts/execute-next"), "    availableActions volta a execute-next");
    ok(!(r.data?.loop?.availableActions || []).includes("POST /contracts/advance-phase"),
      "    availableActions NÃO inclui advance-phase (não é phase_complete)");
    console.log("");
  }

  // ────────────────────────────────────────────────────────────────────────
  // CENÁRIO BLOQUEIO — advance-phase antes de completar tasks
  // ────────────────────────────────────────────────────────────────────────
  console.log("BLOQUEIO — advance-phase antes de completar tasks\n");

  console.log("  Step 7. POST /contracts/advance-phase com fase em andamento → 409 blocked");
  {
    const blockedContractId = "ctr-pr19-blocked";
    const { env: env2, kv: kv2 } = makeEnv(blockedContractId);
    // Fase 1 com task_001 ainda QUEUED (sem complete-task) — gate deve bloquear
    const r = await callWorker(
      "POST",
      "/contracts/advance-phase",
      { contract_id: blockedContractId },
      env2,
    );
    ok(r.status === 409,                                       "    status 409");
    ok(r.data?.ok === false,                                   "    ok:false");
    ok(r.data?.status === "blocked",                           "    status:blocked");
    ok(r.data?.result?.gate?.canAdvance === false,             "    gate.canAdvance === false");
    ok(/incomplete|task/i.test(r.data?.reason || ""),          "    reason menciona incomplete/task");
    const stateAfter = JSON.parse(kv2.db[`contract:${blockedContractId}:state`]);
    ok(stateAfter.current_phase === "phase_01",                "    current_phase NÃO mudou");
    ok(Array.isArray(stateAfter.blockers) && stateAfter.blockers.length > 0, "    blockers persistidos");
    console.log("");
  }

  // ────────────────────────────────────────────────────────────────────────
  // CENÁRIO ISOLAMENTO — execute-next NÃO avança fase
  // ────────────────────────────────────────────────────────────────────────
  console.log("ISOLAMENTO — execute-next em phase_complete não avança fase\n");

  console.log("  Step 8. execute-next em phase_complete → current_phase preservado");
  {
    const isoContractId = "ctr-pr19-iso";
    // Setup: fase 1 com task done, fase 2 queued — estado phase_complete pronto
    const { state: baseState, decomposition: baseDecomp } = makeTwoPhaseFixture(isoContractId);
    baseDecomp.tasks[0].status = "done";
    const kv3 = makeKV({
      "contract:index":                          JSON.stringify([isoContractId]),
      [`contract:${isoContractId}:state`]:         JSON.stringify(baseState),
      [`contract:${isoContractId}:decomposition`]: JSON.stringify(baseDecomp),
    });
    const env3 = {
      ...BASE_ENV,
      ENAVIA_BRAIN:  kv3,
      EXECUTOR:      makeExecutorMock().binding,
      DEPLOY_WORKER: makeDeployMock().binding,
    };
    await callWorker(
      "POST",
      "/contracts/execute-next",
      { confirm: true, approved_by: "iso-tester", evidence: [] },
      env3,
    );
    const stateAfter  = JSON.parse(kv3.db[`contract:${isoContractId}:state`]);
    const decompAfter = JSON.parse(kv3.db[`contract:${isoContractId}:decomposition`]);
    ok(stateAfter.current_phase === "phase_01",                  "    current_phase preservado em phase_01");
    const phase01 = decompAfter.phases.find((p) => p.id === "phase_01");
    ok(phase01?.status !== "done",                               "    phase_01 NÃO foi marcada como done por execute-next");
    console.log("");
  }

  // ────────────────────────────────────────────────────────────────────────
  // CENÁRIO LOOP-STATUS GUARD — advance-phase só em phase_complete
  // ────────────────────────────────────────────────────────────────────────
  console.log("LOOP-STATUS GUARD — advance-phase aparece SÓ em phase_complete\n");

  console.log("  Step 9. loop-status em estado start_task NÃO mostra advance-phase");
  {
    const guardContractId = "ctr-pr19-guard";
    const { env: env4 } = makeEnv(guardContractId);
    const r = await callWorker("GET", `/contracts/loop-status?id=${guardContractId}`, undefined, env4);
    ok(r.data?.nextAction?.type === "start_task",                                          "    nextAction.type === 'start_task'");
    ok(!(r.data?.loop?.availableActions || []).includes("POST /contracts/advance-phase"), "    availableActions NÃO inclui advance-phase");
    ok((r.data?.loop?.availableActions || []).includes("POST /contracts/execute-next"),   "    availableActions inclui execute-next");
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
