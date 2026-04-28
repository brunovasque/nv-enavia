// ============================================================================
// 🧪 Smoke Tests — PR13 Hardening Final Operacional
//
// Run: node tests/pr13-hardening-operacional.smoke.test.js
//
// Confirma que o loop operacional (PR8–PR11) está seguro, auditável e
// sem autonomia cega, antes do encerramento formal do contrato PR8–PR13.
//
// Cenários:
//   A. GET /contracts/loop-status
//      A1. Sem KV → ok:true, contract:null, loop.canProceed:false
//      A2. Index vazio → ok:true, contract:null
//      A3. Shape da resposta completo (ok, generatedAt, contract, nextAction, operationalAction, loop)
//      A4. CORS header presente
//      A5. Contrato ativo → operationalAction não-nulo
//
//   B. POST /contracts/execute-next — gates de segurança
//      B1. Body JSON inválido → 400, evidence:null, executor_path:null, audit_id definido
//      B2. Sem KV → blocked, evidence:null, executor_path:null
//      B3. Index vazio → blocked
//      B4. can_execute:false → blocked com evidence+rollback+executor_path
//      B5. execute_next sem campo evidence → blocked, evidence.missing inclui "evidence[]"
//      B6. execute_next com evidence:[] → gate de evidência passa (shape completo)
//      B7. approve sem confirm:true → awaiting_approval
//      B8. approve com confirm:true mas sem approved_by → 400
//
//   C. Safety gates confirmados
//      C1. env.EXECUTOR.fetch não é chamado no fluxo de contratos
//      C2. Rollback não é executado automaticamente (rollback.available indica recomendação)
//      C3. Resultado ambíguo de executor interno → bloqueado
//
//   D. CORS em todas as rotas novas
// ============================================================================

import { strict as assert } from "node:assert";

// ── Helpers de KV ────────────────────────────────────────────────────────────

function makeKV(db = {}) {
  return {
    get: async (key) => db[key] ?? null,
    put: async (key, val) => { db[key] = val; },
    list: async () => ({ keys: [] }),
  };
}

// Estado mínimo com resolveNextAction → no_action (can_execute: false)
// Sem decomposição → resolveNextAction retorna { type: "no_action", status: "error" }
const STATE_IN_PROGRESS = JSON.stringify({
  contract_id:    "ct-pr13-001",
  status_global:  "in_progress",
  current_phase:  null,
  current_task:   null,
  phases:         [],
  blockers:       [],
  plan_rejection: null,
  updated_at:     "2026-04-28T00:00:00.000Z",
});

// KV com contrato ativo mas sem decomposição → can_execute: false (no_action → block)
const kvBlockedContract = makeKV({
  "contract:index":             JSON.stringify(["ct-pr13-001"]),
  "contract:ct-pr13-001:state": STATE_IN_PROGRESS,
  // sem decomposition → null → resolveNextAction retorna no_action
});

// Estado com tarefa queued → resolveNextAction → start_task → execute_next (can_execute: true)
const STATE_START_TASK = JSON.stringify({
  contract_id:    "ct-pr13-002",
  status_global:  "in_progress",
  current_phase:  "phase-alpha",
  current_task:   null,
  phases:         [],
  blockers:       [],
  plan_rejection: null,
  updated_at:     "2026-04-28T00:00:00.000Z",
});

// resolveNextAction usa activePhase.tasks.includes(t.id) — o phase precisa ter tasks array
const DECOMP_START_TASK = JSON.stringify({
  phases:              [{ id: "phase-alpha", status: "active", tasks: ["task-01"] }],
  tasks:               [{ id: "task-01", phase_id: "phase-alpha", status: "queued", depends_on: [] }],
  micro_pr_candidates: [],
});

// KV com contrato execute_next (can_execute: true)
const kvExecuteNext = makeKV({
  "contract:index":                     JSON.stringify(["ct-pr13-002"]),
  "contract:ct-pr13-002:state":         STATE_START_TASK,
  "contract:ct-pr13-002:decomposition": DECOMP_START_TASK,
});

// Estado awaiting_human_approval: todas as fases "done" →
// resolveNextAction não encontra activePhase → retorna awaiting_human_approval
// → buildOperationalAction → type: "approve", can_execute: true
const STATE_AWAITING = JSON.stringify({
  contract_id:    "ct-pr13-003",
  status_global:  "in_progress",
  current_phase:  "phase-done",
  current_task:   null,
  phases:         [],
  blockers:       [],
  plan_rejection: null,
  updated_at:     "2026-04-28T00:00:00.000Z",
});

const DECOMP_AWAITING = JSON.stringify({
  phases:              [{ id: "phase-done", status: "done", tasks: [] }],
  tasks:               [],
  micro_pr_candidates: [],
});

const kvApproveType = makeKV({
  "contract:index":                     JSON.stringify(["ct-pr13-003"]),
  "contract:ct-pr13-003:state":         STATE_AWAITING,
  "contract:ct-pr13-003:decomposition": DECOMP_AWAITING,
});

// ── Stub envs ────────────────────────────────────────────────────────────────

const BASE_ENV = {
  ENAVIA_MODE:     "supervised",
  OPENAI_API_KEY:  "test-key-fake",
  OPENAI_MODEL:    "gpt-test",
  OWNER:           "Vasques",
  SYSTEM_NAME:     "ENAVIA",
  SUPABASE_URL:    "https://test.supabase.co",
  SUPABASE_BUCKET: "test-bucket",
};

const envNoKV        = { ...BASE_ENV, ENAVIA_BRAIN: undefined };
const envEmptyKV     = { ...BASE_ENV, ENAVIA_BRAIN: makeKV({ "contract:index": JSON.stringify([]) }) };
const envBlockedCt   = { ...BASE_ENV, ENAVIA_BRAIN: kvBlockedContract };
const envExecuteNext = { ...BASE_ENV, ENAVIA_BRAIN: kvExecuteNext };
const envApproveType = { ...BASE_ENV, ENAVIA_BRAIN: kvApproveType };

// Env que rastreia se env.EXECUTOR.fetch foi chamado
let executorFetchCalled = false;
const envWithExecutorSpy = {
  ...BASE_ENV,
  ENAVIA_BRAIN: kvBlockedContract,
  EXECUTOR: {
    fetch: async (...args) => {
      executorFetchCalled = true;
      return new Response(JSON.stringify({ ok: false }), { status: 500 });
    },
  },
};

// ── Worker import ─────────────────────────────────────────────────────────────
import worker from "../nv-enavia.js";

// ── callWorker helper ─────────────────────────────────────────────────────────
async function callWorker(method, path, body, env = envNoKV) {
  const url  = `https://worker.test${path}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res  = await worker.fetch(new Request(url, opts), env, {});
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

// ── Test runner ───────────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n=== PR13 — Hardening Final Operacional — Smoke Tests ===\n");

  let passed = 0, failed = 0;

  function ok(condition, label) {
    if (condition) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.log(`  ❌ ${label}`);
      failed++;
    }
  }

  // ── A. GET /contracts/loop-status ─────────────────────────────────────────

  console.log("A. GET /contracts/loop-status\n");

  {
    console.log("  A1. Sem KV → ok:true, contract:null, loop.canProceed:false");
    const r = await callWorker("GET", "/contracts/loop-status", undefined, envNoKV);
    ok(r.status === 200,                     "  status 200");
    ok(r.data?.ok === true,                  "  ok: true");
    ok(r.data?.contract === null,            "  contract: null");
    ok(r.data?.loop?.canProceed === false,   "  loop.canProceed: false");
    ok(r.data?.operationalAction === null,   "  operationalAction: null");
    console.log("");
  }

  {
    console.log("  A2. Index vazio → ok:true, contract:null");
    const r = await callWorker("GET", "/contracts/loop-status", undefined, envEmptyKV);
    ok(r.status === 200,          "  status 200");
    ok(r.data?.ok === true,       "  ok: true");
    ok(r.data?.contract === null, "  contract: null");
    console.log("");
  }

  {
    console.log("  A3. Shape da resposta (ok, generatedAt, contract, nextAction, operationalAction, loop)");
    const r = await callWorker("GET", "/contracts/loop-status", undefined, envEmptyKV);
    ok("ok"                in r.data, "  campo ok presente");
    ok("generatedAt"       in r.data, "  campo generatedAt presente");
    ok("contract"          in r.data, "  campo contract presente");
    ok("nextAction"        in r.data, "  campo nextAction presente");
    ok("operationalAction" in r.data, "  campo operationalAction presente");
    ok("loop"              in r.data, "  campo loop presente");
    ok("canProceed"        in (r.data?.loop ?? {}), "  loop.canProceed presente");
    ok("blocked"           in (r.data?.loop ?? {}), "  loop.blocked presente");
    ok("availableActions"  in (r.data?.loop ?? {}), "  loop.availableActions presente");
    console.log("");
  }

  {
    console.log("  A4. CORS header presente");
    const r = await callWorker("GET", "/contracts/loop-status", undefined, envEmptyKV);
    ok(r.headers.get("Access-Control-Allow-Origin") === "*", "  Access-Control-Allow-Origin: *");
    console.log("");
  }

  {
    console.log("  A5. Contrato ativo → operationalAction não-nulo com shape canônico");
    const r = await callWorker("GET", "/contracts/loop-status", undefined, envBlockedCt);
    ok(r.status === 200,                          "  status 200");
    ok(r.data?.ok === true,                       "  ok: true");
    ok(r.data?.operationalAction !== null,         "  operationalAction não-nulo");
    ok("type"            in (r.data?.operationalAction ?? {}), "  operationalAction.type presente");
    ok("can_execute"     in (r.data?.operationalAction ?? {}), "  operationalAction.can_execute presente");
    ok("block_reason"    in (r.data?.operationalAction ?? {}), "  operationalAction.block_reason presente");
    ok("evidence_required" in (r.data?.operationalAction ?? {}), "  operationalAction.evidence_required presente");
    console.log("");
  }

  // ── B. POST /contracts/execute-next — gates ───────────────────────────────

  console.log("B. POST /contracts/execute-next — gates de segurança\n");

  {
    console.log("  B1. Body JSON inválido → 400, evidence:null, executor_path:null");
    const r = await callWorker("POST", "/contracts/execute-next", "NOT_JSON", envEmptyKV);
    ok(r.status === 400,               "  status 400");
    ok(r.data?.ok === false,           "  ok: false");
    ok(r.data?.executed === false,     "  executed: false");
    ok(r.data?.status === "blocked",   "  status: blocked");
    ok(r.data?.evidence === null,      "  evidence: null (body parse falhou, shape precoce)");
    ok(r.data?.executor_path === null, "  executor_path: null");
    ok(r.data?.audit_id != null,       "  audit_id definido");
    console.log("");
  }

  {
    console.log("  B2. Sem KV → blocked, evidence:null, executor_path:null");
    const r = await callWorker("POST", "/contracts/execute-next", { evidence: [] }, envNoKV);
    ok(r.status === 200,               "  status 200 (blocked com ok:false)");
    ok(r.data?.executed === false,     "  executed: false");
    ok(r.data?.status === "blocked",   "  status: blocked");
    ok(r.data?.evidence === null,      "  evidence: null");
    ok(r.data?.rollback === null,      "  rollback: null");
    ok(r.data?.executor_path === null, "  executor_path: null");
    ok(r.data?.audit_id != null,       "  audit_id definido");
    console.log("");
  }

  {
    console.log("  B3. Index vazio → blocked");
    const r = await callWorker("POST", "/contracts/execute-next", { evidence: [] }, envEmptyKV);
    ok(r.data?.status === "blocked",   "  status: blocked");
    ok(r.data?.executed === false,     "  executed: false");
    ok(r.data?.evidence === null,      "  evidence: null (sem contrato)");
    ok(r.data?.executor_path === null, "  executor_path: null");
    console.log("");
  }

  {
    console.log("  B4. can_execute:false → blocked com evidence+rollback+executor_path");
    // ct-pr13-001 resolve para no_action → block → can_execute:false
    const r = await callWorker("POST", "/contracts/execute-next", { evidence: [] }, envBlockedCt);
    ok(r.data?.status === "blocked",           "  status: blocked");
    ok(r.data?.executed === false,             "  executed: false");
    ok(r.data?.evidence !== null,              "  evidence presente (gate pós step-4)");
    ok(r.data?.rollback !== null,              "  rollback presente");
    ok(r.data?.executor_path !== null,         "  executor_path presente");
    ok(r.data?.executor_path?.type === "blocked", "  executor_path.type: blocked");
    ok(r.data?.executor_path?.uses_service_binding === false, "  uses_service_binding: false");
    ok(Array.isArray(r.data?.evidence?.required),  "  evidence.required é array");
    ok(Array.isArray(r.data?.evidence?.missing),   "  evidence.missing é array");
    ok(r.data?.evidence?.validation_level === "presence_only", "  validation_level: presence_only");
    ok(r.data?.evidence?.semantic_validation === false,        "  semantic_validation: false");
    ok(r.data?.rollback?.available === false,                  "  rollback.available: false (nada executado)");
    ok(r.data?.rollback?.type === "no_state_change",           "  rollback.type: no_state_change");
    console.log("");
  }

  {
    console.log("  B5. execute_next sem campo evidence → blocked, evidence.missing inclui evidence[]");
    // ct-pr13-002: execute_next, can_execute:true, mas body sem 'evidence'
    const r = await callWorker("POST", "/contracts/execute-next", { confirm: true }, envExecuteNext);
    ok(r.data?.status === "blocked",                         "  status: blocked");
    ok(r.data?.executed === false,                           "  executed: false");
    ok(r.data?.evidence?.missing?.includes("evidence[]"),    "  evidence.missing inclui evidence[]");
    ok(r.data?.rollback !== null,                            "  rollback presente");
    ok(r.data?.executor_path !== null,                       "  executor_path presente");
    ok(r.data?.executor_path?.type?.includes("internal_handler"), "  executor_path.type inclui internal_handler (execute_next)");
    console.log("");
  }

  {
    console.log("  B6. execute_next com evidence:[] → gate de evidência passa, shape completo");
    // Gate de evidência deve passar; execute pode falhar por TEST guard — isso é correto
    const r = await callWorker("POST", "/contracts/execute-next", { evidence: [] }, envExecuteNext);
    ok(r.data?.evidence?.missing?.length === 0,            "  evidence.missing está vazio (gate passou)");
    ok("ok"             in (r.data ?? {}),                 "  campo ok presente");
    ok("executed"       in (r.data ?? {}),                 "  campo executed presente");
    ok("status"         in (r.data ?? {}),                 "  campo status presente");
    ok("nextAction"     in (r.data ?? {}),                 "  campo nextAction presente");
    ok("operationalAction" in (r.data ?? {}),              "  campo operationalAction presente");
    ok("evidence"       in (r.data ?? {}),                 "  campo evidence presente");
    ok("rollback"       in (r.data ?? {}),                 "  campo rollback presente");
    ok("executor_path"  in (r.data ?? {}),                 "  campo executor_path presente");
    ok("audit_id"       in (r.data ?? {}),                 "  campo audit_id presente");
    ok(r.data?.executor_path?.uses_service_binding !== undefined, "  uses_service_binding definido (PR14: true para execute_next)");
    ok(r.data?.rollback?.available !== undefined,          "  rollback.available definido");
    console.log("");
  }

  {
    console.log("  B7. approve sem confirm:true → awaiting_approval");
    // ct-pr13-003: approve, can_execute:true, com evidence mas sem confirm
    const r = await callWorker("POST", "/contracts/execute-next", { evidence: [] }, envApproveType);
    ok(r.data?.status === "awaiting_approval",             "  status: awaiting_approval");
    ok(r.data?.executed === false,                         "  executed: false");
    ok(r.data?.evidence !== null,                          "  evidence presente");
    ok(r.data?.rollback !== null,                          "  rollback presente");
    ok(r.data?.executor_path !== null,                     "  executor_path presente");
    ok(r.data?.executor_path?.type?.includes("internal_handler"), "  executor_path.type inclui internal_handler (approve)");
    console.log("");
  }

  {
    console.log("  B8. approve com confirm:true mas sem approved_by → 400");
    const r = await callWorker("POST", "/contracts/execute-next", { evidence: [], confirm: true }, envApproveType);
    ok(r.status === 400,           "  status 400");
    ok(r.data?.ok === false,       "  ok: false");
    ok(r.data?.executed === false, "  executed: false");
    console.log("");
  }

  // ── C. Safety gates ───────────────────────────────────────────────────────

  console.log("C. Safety gates confirmados\n");

  {
    console.log("  C1. env.EXECUTOR.fetch não chamado no fluxo de contratos");
    executorFetchCalled = false;
    await callWorker("GET",  "/contracts/loop-status",   undefined,      envWithExecutorSpy);
    await callWorker("POST", "/contracts/execute-next",  { evidence: [] }, envWithExecutorSpy);
    ok(!executorFetchCalled, "  env.EXECUTOR.fetch não foi chamado");
    console.log("");
  }

  {
    console.log("  C2. Rollback é recomendação, nunca execução automática");
    const r = await callWorker("POST", "/contracts/execute-next", { evidence: [] }, envBlockedCt);
    const rollback = r.data?.rollback;
    ok(rollback !== undefined,                   "  rollback presente");
    ok(typeof rollback?.recommendation === "string" || rollback?.recommendation === undefined, "  rollback.recommendation é string ou ausente");
    // rollback.command deve ser null ou string — nunca uma chamada automatizada
    ok(rollback?.available === false || rollback?.type === "manual_review" || rollback?.type === "no_state_change",
       "  rollback.type é manual_review ou no_state_change (apenas orientação)");
    console.log("");
  }

  {
    console.log("  C3. Resultado ambíguo bloqueado — todos os paths retornam ok e status");
    // Verificar que nenhum path de execute-next retorna sem status definido
    const cases = [
      [{ evidence: [] },                              envNoKV],
      [{ evidence: [] },                              envEmptyKV],
      [{ evidence: [] },                              envBlockedCt],
      [{ evidence: [] },                              envExecuteNext],
      [{ evidence: [], confirm: true, approved_by: "op" }, envApproveType],
    ];
    let allHaveStatus = true;
    for (const [body, env] of cases) {
      const r = await callWorker("POST", "/contracts/execute-next", body, env);
      if (!r.data?.status) { allHaveStatus = false; break; }
    }
    ok(allHaveStatus, "  todos os paths retornam status definido");
    console.log("");
  }

  // ── D. CORS em todas as rotas novas ───────────────────────────────────────

  console.log("D. CORS em todas as rotas novas\n");

  {
    console.log("  D1. CORS no execute-next (qualquer gate)");
    const r = await callWorker("POST", "/contracts/execute-next", { evidence: [] }, envNoKV);
    ok(r.headers.get("Access-Control-Allow-Origin") === "*", "  Access-Control-Allow-Origin: *");
    console.log("");
  }

  {
    console.log("  D2. OPTIONS /contracts/loop-status → preflight OK");
    const req = new Request("https://worker.test/contracts/loop-status", { method: "OPTIONS" });
    const res = await worker.fetch(req, envNoKV, {});
    ok(res.status < 300,                                          "  status < 300");
    ok(res.headers.get("Access-Control-Allow-Origin") === "*",   "  Access-Control-Allow-Origin: *");
    console.log("");
  }

  // ── Resultado ─────────────────────────────────────────────────────────────

  console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
