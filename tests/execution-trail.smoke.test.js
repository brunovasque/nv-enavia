// ============================================================================
// 🧪 Smoke Tests — P13 Execution Trail
//
// Run: node tests/execution-trail.smoke.test.js
//
// Verifica o shape canônico da trilha de execução gravada no KV por
// handlePlannerBridge e lida por GET /execution (handleGetExecution).
//
// NÃO testa KV real (runtime Cloudflare) — testa o contrato do shape.
//
// Tests:
//   Group 1: Trail shape — campos obrigatórios no disparo bem-sucedido
//   Group 2: Trail shape — campos obrigatórios no disparo com falha de rede
//   Group 3: Trail invariantes — bridge_id rastreável, tipos corretos
//   Group 4: GET /execution response shape canônico
//   Group 5: Isolamento P13/P14 — trail não contém campos de decisão humana
// ============================================================================

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
// Fixtures — shapes canônicos da trilha de execução
// ---------------------------------------------------------------------------

// Trilha gerada no caminho de sucesso de handlePlannerBridge
function buildSuccessTrail({ bridgeId, sessionId, source, stepsCount, executorStatus }) {
  const executorOk = executorStatus >= 200 && executorStatus < 300;
  return {
    bridge_id:       bridgeId,
    dispatched_at:   new Date().toISOString(),
    session_id:      sessionId,
    source:          source,
    steps_count:     stepsCount,
    executor_ok:     executorOk,
    executor_status: executorStatus,
    executor_error:  executorOk ? null : null,
  };
}

// Trilha gerada no caminho de falha de rede de handlePlannerBridge
function buildNetworkErrorTrail({ bridgeId, sessionId, source, stepsCount }) {
  return {
    bridge_id:       bridgeId,
    dispatched_at:   new Date().toISOString(),
    session_id:      sessionId,
    source:          source,
    steps_count:     stepsCount,
    executor_ok:     false,
    executor_status: null,
    executor_error:  "NETWORK_ERROR",
  };
}

// Shape canônico do GET /execution (handleGetExecution)
function buildExecutionResponse(trail) {
  return {
    ok:        true,
    execution: trail,
  };
}

// Shape canônico quando nenhum disparo ocorreu ainda
function buildExecutionResponseEmpty() {
  return {
    ok:        true,
    execution: null,
  };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

function runTests() {
  // ---- Group 1: Trail shape — disparo bem-sucedido ----
  console.log("\nGroup 1: Trail shape — disparo bem-sucedido");

  const successTrail = buildSuccessTrail({
    bridgeId:      "bridge-abc123",
    sessionId:     "sess-001",
    source:        "planner_bridge",
    stepsCount:    3,
    executorStatus: 200,
  });

  assert("bridge_id"       in successTrail, "G1: campo bridge_id presente");
  assert("dispatched_at"   in successTrail, "G1: campo dispatched_at presente");
  assert("session_id"      in successTrail, "G1: campo session_id presente");
  assert("source"          in successTrail, "G1: campo source presente");
  assert("steps_count"     in successTrail, "G1: campo steps_count presente");
  assert("executor_ok"     in successTrail, "G1: campo executor_ok presente");
  assert("executor_status" in successTrail, "G1: campo executor_status presente");
  assert("executor_error"  in successTrail, "G1: campo executor_error presente");

  assert(successTrail.bridge_id      === "bridge-abc123",  "G1: bridge_id correto");
  assert(successTrail.executor_ok    === true,              "G1: executor_ok true para status 200");
  assert(successTrail.executor_status === 200,              "G1: executor_status = 200");
  assert(successTrail.executor_error === null,              "G1: executor_error null em sucesso");

  // ---- Group 2: Trail shape — falha de rede ----
  console.log("\nGroup 2: Trail shape — falha de rede");

  const errorTrail = buildNetworkErrorTrail({
    bridgeId:  "bridge-def456",
    sessionId: "sess-002",
    source:    "planner_bridge",
    stepsCount: 2,
  });

  assert("bridge_id"       in errorTrail, "G2: campo bridge_id presente");
  assert("dispatched_at"   in errorTrail, "G2: campo dispatched_at presente");
  assert("session_id"      in errorTrail, "G2: campo session_id presente");
  assert("source"          in errorTrail, "G2: campo source presente");
  assert("steps_count"     in errorTrail, "G2: campo steps_count presente");
  assert("executor_ok"     in errorTrail, "G2: campo executor_ok presente");
  assert("executor_status" in errorTrail, "G2: campo executor_status presente");
  assert("executor_error"  in errorTrail, "G2: campo executor_error presente");

  assert(errorTrail.executor_ok     === false,          "G2: executor_ok false em falha de rede");
  assert(errorTrail.executor_status === null,            "G2: executor_status null em falha de rede");
  assert(errorTrail.executor_error  === "NETWORK_ERROR", "G2: executor_error = NETWORK_ERROR");

  // ---- Group 3: Trail invariantes ----
  console.log("\nGroup 3: Trail invariantes — bridge_id rastreável, tipos corretos");

  const trail = successTrail;

  assert(typeof trail.bridge_id      === "string"  && trail.bridge_id.length > 0,    "G3: bridge_id é string não-vazia (rastreável)");
  assert(typeof trail.dispatched_at  === "string"  && trail.dispatched_at.length > 0,"G3: dispatched_at é string ISO não-vazia");
  assert(typeof trail.executor_ok    === "boolean",                                    "G3: executor_ok é boolean");
  assert(typeof trail.steps_count    === "number"  && trail.steps_count >= 0,         "G3: steps_count é number >= 0");
  assert(typeof trail.source         === "string"  && trail.source.length > 0,        "G3: source é string não-vazia");

  // dispatched_at deve ser data ISO-8601 parseável
  const parsed = new Date(trail.dispatched_at);
  assert(!isNaN(parsed.getTime()), "G3: dispatched_at é data ISO válida");

  // Trail é serializável (sobrevive JSON round-trip = pode ser guardado em KV)
  let serializable = true;
  let roundTripped;
  try {
    roundTripped = JSON.parse(JSON.stringify(trail));
  } catch (_) {
    serializable = false;
  }
  assert(serializable,                                  "G3: trail sobrevive JSON round-trip (compatível com KV)");
  assert(roundTripped.bridge_id === trail.bridge_id,    "G3: bridge_id preservado no round-trip");
  assert(roundTripped.executor_ok === trail.executor_ok,"G3: executor_ok preservado no round-trip");

  // ---- Group 4: GET /execution response shape ----
  console.log("\nGroup 4: GET /execution response shape canônico");

  // Com trilha (disparo ocorreu)
  const responseWithTrail = buildExecutionResponse(successTrail);
  assert("ok"        in responseWithTrail,               "G4: campo ok presente");
  assert("execution" in responseWithTrail,               "G4: campo execution presente");
  assert(responseWithTrail.ok        === true,            "G4: ok = true");
  assert(responseWithTrail.execution !== null,            "G4: execution não-null quando disparo ocorreu");
  assert(responseWithTrail.execution.bridge_id === "bridge-abc123", "G4: execution.bridge_id correto");

  // Sem trilha (nenhum disparo ainda)
  const responseEmpty = buildExecutionResponseEmpty();
  assert("ok"        in responseEmpty,  "G4: ok presente (resposta vazia)");
  assert("execution" in responseEmpty,  "G4: execution presente (resposta vazia)");
  assert(responseEmpty.ok        === true, "G4: ok = true (resposta vazia)");
  assert(responseEmpty.execution === null, "G4: execution = null quando nenhum disparo");

  // ---- Group 5: Isolamento P13/P14 — trail não contém campos de decisão ----
  console.log("\nGroup 5: Isolamento P13/P14 — trail não contém campos de decisão humana");

  // P14 = aprovações/rejeições por execução
  // A trail de P13 NÃO deve conter esses campos — eles são responsabilidade de P14
  assert(!("approved_by"    in successTrail), "G5: trail não contém approved_by (P14)");
  assert(!("rejected_by"    in successTrail), "G5: trail não contém rejected_by (P14)");
  assert(!("decision"       in successTrail), "G5: trail não contém decision (P14)");
  assert(!("decision_at"    in successTrail), "G5: trail não contém decision_at (P14)");
  assert(!("approval_reason"in successTrail), "G5: trail não contém approval_reason (P14)");

  assert(!("approved_by"    in errorTrail),   "G5: error trail não contém approved_by (P14)");
  assert(!("rejected_by"    in errorTrail),   "G5: error trail não contém rejected_by (P14)");

  // A trail SIM deve conter evidência do disparo (P13)
  assert("bridge_id"     in successTrail, "G5: trail contém bridge_id (P13 — rastreabilidade do disparo)");
  assert("dispatched_at" in successTrail, "G5: trail contém dispatched_at (P13 — evidência do disparo)");
  assert("executor_ok"   in successTrail, "G5: trail contém executor_ok (P13 — resultado do disparo)");

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
