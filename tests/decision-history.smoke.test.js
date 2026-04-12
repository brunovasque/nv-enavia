// ============================================================================
// 🧪 Smoke Tests — P14 Decision History (Histórico de Decisões por Execução)
//
// Run: node tests/decision-history.smoke.test.js
//
// Verifica o shape canônico do registro de decisão (approved/rejected)
// vinculado a uma execução (bridge_id), persistido no KV pelos handlers
// handlePostDecision e handleGetDecisions.
//
// NÃO testa KV real (runtime Cloudflare) — testa o contrato do shape.
//
// Tests:
//   Group 1: Decision record shape — campos obrigatórios em aprovação
//   Group 2: Decision record shape — campos obrigatórios em rejeição
//   Group 3: Decision invariantes — tipos, bridge_id rastreável, serialização
//   Group 4: GET /execution/decisions response shape canônico
//   Group 5: Isolamento P13/P14 — decision NÃO contém campos de trail
//   Group 6: Vínculo bridge_id — decisão ↔ execução correta
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
// Fixtures — shapes canônicos da decisão
// ---------------------------------------------------------------------------

function buildApprovalDecision({ bridgeId, decidedBy, context }) {
  return {
    decision_id: `decision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    decision: "approved",
    bridge_id: bridgeId,
    decided_at: new Date().toISOString(),
    decided_by: decidedBy || "human",
    context: context || null,
  };
}

function buildRejectionDecision({ bridgeId, decidedBy, context }) {
  return {
    decision_id: `decision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    decision: "rejected",
    bridge_id: bridgeId || null,
    decided_at: new Date().toISOString(),
    decided_by: decidedBy || "human",
    context: context || null,
  };
}

function buildDecisionsResponse(decisions) {
  return {
    ok: true,
    decisions: decisions,
  };
}

function buildDecisionsResponseByBridge(bridgeId, decisions) {
  return {
    ok: true,
    bridge_id: bridgeId,
    decisions: decisions,
  };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

function runTests() {
  // ---- Group 1: Decision shape — aprovação ----
  console.log("\nGroup 1: Decision record shape — aprovação");

  const approval = buildApprovalDecision({
    bridgeId: "bridge-abc123",
    decidedBy: "Vasques",
    context: "Plano validado manualmente",
  });

  assert("decision_id" in approval, "G1: campo decision_id presente");
  assert("decision"    in approval, "G1: campo decision presente");
  assert("bridge_id"   in approval, "G1: campo bridge_id presente");
  assert("decided_at"  in approval, "G1: campo decided_at presente");
  assert("decided_by"  in approval, "G1: campo decided_by presente");
  assert("context"     in approval, "G1: campo context presente");

  assert(approval.decision    === "approved",      "G1: decision = approved");
  assert(approval.bridge_id   === "bridge-abc123", "G1: bridge_id correto");
  assert(approval.decided_by  === "Vasques",       "G1: decided_by correto");
  assert(approval.context     === "Plano validado manualmente", "G1: context correto");

  // ---- Group 2: Decision shape — rejeição ----
  console.log("\nGroup 2: Decision record shape — rejeição");

  const rejection = buildRejectionDecision({
    bridgeId: "bridge-def456",
    decidedBy: "Vasques",
    context: "Risco detectado — requer revisão",
  });

  assert("decision_id" in rejection, "G2: campo decision_id presente");
  assert("decision"    in rejection, "G2: campo decision presente");
  assert("bridge_id"   in rejection, "G2: campo bridge_id presente");
  assert("decided_at"  in rejection, "G2: campo decided_at presente");
  assert("decided_by"  in rejection, "G2: campo decided_by presente");
  assert("context"     in rejection, "G2: campo context presente");

  assert(rejection.decision   === "rejected",      "G2: decision = rejected");
  assert(rejection.bridge_id  === "bridge-def456", "G2: bridge_id correto na rejeição");
  assert(rejection.context    === "Risco detectado — requer revisão", "G2: context de rejeição correto");

  // Rejeição sem bridge_id (gate bloqueado antes do envio)
  const rejectionNoBridge = buildRejectionDecision({
    bridgeId: null,
    decidedBy: "human",
    context: null,
  });
  assert(rejectionNoBridge.bridge_id === null, "G2: bridge_id null aceito para rejeição (sem bridge enviado)");
  assert(rejectionNoBridge.context   === null, "G2: context null aceito para rejeição");

  // ---- Group 3: Decision invariantes ----
  console.log("\nGroup 3: Decision invariantes — tipos, rastreabilidade, serialização");

  assert(typeof approval.decision_id === "string" && approval.decision_id.length > 0, "G3: decision_id é string não-vazia");
  assert(typeof approval.decided_at  === "string" && approval.decided_at.length > 0,  "G3: decided_at é string ISO não-vazia");
  assert(typeof approval.decision    === "string",                                       "G3: decision é string");
  assert(typeof approval.decided_by  === "string" && approval.decided_by.length > 0,   "G3: decided_by é string não-vazia");

  // decided_at deve ser data ISO-8601 parseável
  const parsed = new Date(approval.decided_at);
  assert(!isNaN(parsed.getTime()), "G3: decided_at é data ISO válida");

  // decision só aceita approved ou rejected
  assert(["approved", "rejected"].includes(approval.decision),  "G3: decision é approved ou rejected (approval)");
  assert(["approved", "rejected"].includes(rejection.decision), "G3: decision é approved ou rejected (rejection)");

  // Serialização — sobrevive JSON round-trip
  let serializable = true;
  let roundTripped;
  try {
    roundTripped = JSON.parse(JSON.stringify(approval));
  } catch (_) {
    serializable = false;
  }
  assert(serializable,                                           "G3: decision sobrevive JSON round-trip (compatível com KV)");
  assert(roundTripped.decision_id === approval.decision_id,      "G3: decision_id preservado no round-trip");
  assert(roundTripped.bridge_id   === approval.bridge_id,        "G3: bridge_id preservado no round-trip");
  assert(roundTripped.decision    === approval.decision,         "G3: decision preservado no round-trip");
  assert(roundTripped.decided_at  === approval.decided_at,       "G3: decided_at preservado no round-trip");

  // ---- Group 4: GET /execution/decisions response shape ----
  console.log("\nGroup 4: GET /execution/decisions response shape canônico");

  // Com decisões
  const responseWithDecisions = buildDecisionsResponse([approval, rejection]);
  assert("ok"        in responseWithDecisions,            "G4: campo ok presente");
  assert("decisions" in responseWithDecisions,            "G4: campo decisions presente");
  assert(responseWithDecisions.ok === true,               "G4: ok = true");
  assert(Array.isArray(responseWithDecisions.decisions),  "G4: decisions é array");
  assert(responseWithDecisions.decisions.length === 2,    "G4: decisions contém 2 registros");

  // Sem decisões
  const responseEmpty = buildDecisionsResponse([]);
  assert(responseEmpty.ok === true,              "G4: ok = true (resposta vazia)");
  assert(responseEmpty.decisions.length === 0,   "G4: decisions vazio quando sem registros");

  // Por bridge_id
  const responseByBridge = buildDecisionsResponseByBridge("bridge-abc123", [approval]);
  assert("bridge_id" in responseByBridge,                        "G4: bridge_id presente na resposta filtrada");
  assert(responseByBridge.bridge_id === "bridge-abc123",         "G4: bridge_id correto na resposta filtrada");
  assert(responseByBridge.decisions.length === 1,                "G4: decisions filtrado por bridge_id");
  assert(responseByBridge.decisions[0].decision === "approved",  "G4: decisão filtrada é aprovação");

  // ---- Group 5: Isolamento P13/P14 ----
  console.log("\nGroup 5: Isolamento P13/P14 — decision NÃO contém campos de trail");

  // P14 decision NÃO deve conter campos de P13 trail
  assert(!("executor_ok"     in approval), "G5: decision não contém executor_ok (P13)");
  assert(!("executor_status" in approval), "G5: decision não contém executor_status (P13)");
  assert(!("executor_error"  in approval), "G5: decision não contém executor_error (P13)");
  assert(!("dispatched_at"   in approval), "G5: decision não contém dispatched_at (P13)");
  assert(!("steps_count"     in approval), "G5: decision não contém steps_count (P13)");
  assert(!("source"          in approval), "G5: decision não contém source (P13)");
  assert(!("session_id"      in approval), "G5: decision não contém session_id (P13)");

  // P14 decision SIM deve conter campos próprios
  assert("decision_id" in approval, "G5: decision contém decision_id (P14 — rastreabilidade)");
  assert("decision"    in approval, "G5: decision contém decision (P14 — tipo)");
  assert("decided_at"  in approval, "G5: decision contém decided_at (P14 — timestamp)");
  assert("bridge_id"   in approval, "G5: decision contém bridge_id (P14 — vínculo com execução)");

  // ---- Group 6: Vínculo bridge_id — decisão ↔ execução ----
  console.log("\nGroup 6: Vínculo bridge_id — decisão vinculada à execução correta");

  // Aprovação e trail devem compartilhar o mesmo bridge_id
  const trailBridgeId = "bridge-abc123";
  assert(approval.bridge_id === trailBridgeId, "G6: bridge_id da decisão = bridge_id do trail");

  // Múltiplas decisões para o mesmo bridge_id (ex: rejeitar e depois aprovar)
  const reject1 = buildRejectionDecision({ bridgeId: "bridge-multi-001", decidedBy: "Vasques" });
  const approve2 = buildApprovalDecision({ bridgeId: "bridge-multi-001", decidedBy: "Vasques" });
  const multiResponse = buildDecisionsResponseByBridge("bridge-multi-001", [reject1, approve2]);
  assert(multiResponse.decisions.length === 2,               "G6: múltiplas decisões para mesmo bridge_id");
  assert(multiResponse.decisions[0].decision === "rejected", "G6: primeira decisão = rejected");
  assert(multiResponse.decisions[1].decision === "approved", "G6: segunda decisão = approved");
  assert(multiResponse.decisions[0].bridge_id === multiResponse.decisions[1].bridge_id, "G6: ambas vinculadas ao mesmo bridge_id");

  // Decision IDs são únicos
  assert(reject1.decision_id !== approve2.decision_id, "G6: decision_ids são únicos entre decisões");

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
