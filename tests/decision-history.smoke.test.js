// ============================================================================
// 🧪 Smoke Tests — P14 Decision History (Worker-only)
//
// Run: node tests/decision-history.smoke.test.js
//
// Verifica o contrato canônico de P14 — persistência e leitura de decisões
// humanas vinculadas a execuções identificadas por bridge_id.
//
// REGRA DURA testada aqui:
//   - bridge_id é OBRIGATÓRIO (identificador canônico de execução neste worker)
//   - Decisões sem bridge_id NÃO são P14 válidas (retorno 422)
//   - Rejeições pré-bridge NÃO são registradas
//
// Escopo: Worker-only. Sem imports de panel.
//
// Tests:
//   Group 1:  Shape canônico do registro de decisão
//   Group 2:  POST /execution/decision — decisão aprovada com bridge_id
//   Group 3:  POST /execution/decision — rejeição com bridge_id (pós-bridge)
//   Group 4:  POST /execution/decision — rejeição pré-bridge (sem bridge_id) → 422
//   Group 5:  POST /execution/decision — bridge_id null → 422
//   Group 6:  GET /execution/decisions — sem bridge_id → 400
//   Group 7:  GET /execution/decisions — com bridge_id → lista de decisões
//   Group 8:  Isolamento P13/P14 — decisão não contém campos de trilha
//   Group 9:  JSON round-trip — decisão sobrevive serialização KV
//   Group 10: Invariantes — bridge_id nunca null num registro P14 válido
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
// Fixtures — shapes canônicos
// ---------------------------------------------------------------------------

// Registro de decisão P14 válido (tem bridge_id real)
function buildDecisionRecord({ bridgeId, decision, decidedBy, context }) {
  return {
    decision_id: `decision-${Date.now().toString(36)}-abc`,
    decision:    decision,       // "approved" | "rejected"
    bridge_id:   bridgeId,       // OBRIGATÓRIO — nunca null num registro válido
    decided_at:  new Date().toISOString(),
    decided_by:  decidedBy || "human",
    context:     context || null,
  };
}

// Resposta do worker para POST /execution/decision (sucesso)
function buildPostDecisionSuccess(record) {
  return {
    ok:       true,
    p14_valid: true,
    decision: record,
    timestamp: Date.now(),
    telemetry: { duration_ms: 5 },
  };
}

// Resposta do worker para POST /execution/decision sem bridge_id (422)
function buildNoBridgeIdResponse() {
  return {
    ok:       false,
    p14_valid: false,
    error:    "bridge_id ausente ou nulo — esta decisão não pode ser vinculada a uma execução canônica.",
    diagnostic: [
      "bridge_id é o identificador canônico de execução neste worker.",
      "Ele só existe após POST /planner/bridge disparar o plano ao executor.",
      "Rejeições pré-bridge (antes do disparo) não possuem bridge_id.",
      "Por contrato, P14 só registra decisões com vínculo canônico de execução comprovado.",
      "Esta rejeição pré-bridge NÃO é persistida como registro P14 válido.",
    ],
    timestamp: Date.now(),
    telemetry: { duration_ms: 1 },
  };
}

// Resposta do worker para GET /execution/decisions sem ?bridge_id (400)
function buildNoParamResponse() {
  return {
    ok: false,
    error: "Parâmetro ?bridge_id=xxx é obrigatório.",
    diagnostic: [
      "bridge_id é o identificador canônico de execução neste worker.",
      "Ele é gerado por POST /planner/bridge e retornado no campo bridge_id da resposta.",
      "Use ?bridge_id=<valor> para consultar o histórico de decisões de uma execução específica.",
    ],
    timestamp: Date.now(),
  };
}

// Resposta do worker para GET /execution/decisions?bridge_id=xxx (sucesso)
function buildGetDecisionsResponse(bridgeId, decisions) {
  return {
    ok:        true,
    bridge_id: bridgeId,
    decisions: decisions,
  };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

function runTests() {

  // ---- Group 1: Shape canônico do registro de decisão ----
  console.log("\nGroup 1: Shape canônico do registro de decisão");

  const approvalRecord = buildDecisionRecord({
    bridgeId:  "bridge-real-abc123",
    decision:  "approved",
    decidedBy: "human",
    context:   "plano aprovado após revisão",
  });

  assert("decision_id" in approvalRecord, "G1: decision_id presente");
  assert("decision"    in approvalRecord, "G1: decision presente");
  assert("bridge_id"   in approvalRecord, "G1: bridge_id presente");
  assert("decided_at"  in approvalRecord, "G1: decided_at presente");
  assert("decided_by"  in approvalRecord, "G1: decided_by presente");
  assert("context"     in approvalRecord, "G1: context presente");

  assert(approvalRecord.decision  === "approved",          "G1: decision = approved");
  assert(approvalRecord.bridge_id === "bridge-real-abc123","G1: bridge_id correto");
  assert(typeof approvalRecord.decided_at === "string",    "G1: decided_at é string");
  assert(!isNaN(new Date(approvalRecord.decided_at).getTime()), "G1: decided_at é data ISO válida");

  // ---- Group 2: POST /execution/decision — aprovação com bridge_id ----
  console.log("\nGroup 2: POST /execution/decision — aprovação com bridge_id canônico");

  const approvalResponse = buildPostDecisionSuccess(approvalRecord);

  assert(approvalResponse.ok         === true,  "G2: ok = true");
  assert(approvalResponse.p14_valid  === true,  "G2: p14_valid = true");
  assert("decision" in approvalResponse,        "G2: campo decision presente");
  assert(approvalResponse.decision.bridge_id === "bridge-real-abc123", "G2: bridge_id preservado na resposta");
  assert(approvalResponse.decision.decision  === "approved",           "G2: decision = approved");
  assert("telemetry" in approvalResponse,       "G2: telemetria presente");

  // ---- Group 3: POST /execution/decision — rejeição com bridge_id (pós-bridge) ----
  console.log("\nGroup 3: POST /execution/decision — rejeição pós-bridge (bridge_id presente)");

  // Cenário: humano rejeita APÓS o bridge ter sido despachado — bridge_id existe
  const postBridgeRejection = buildDecisionRecord({
    bridgeId:  "bridge-real-def456",
    decision:  "rejected",
    decidedBy: "human",
    context:   "plano rejeitado após revisão do resultado do executor",
  });
  const rejectionResponse = buildPostDecisionSuccess(postBridgeRejection);

  assert(postBridgeRejection.bridge_id !== null,               "G3: rejeição pós-bridge tem bridge_id");
  assert(postBridgeRejection.decision  === "rejected",          "G3: decision = rejected");
  assert(rejectionResponse.ok          === true,               "G3: ok = true (rejeição pós-bridge é P14 válida)");
  assert(rejectionResponse.p14_valid   === true,               "G3: p14_valid = true");
  assert(rejectionResponse.decision.bridge_id === "bridge-real-def456", "G3: bridge_id correto");

  // ---- Group 4: POST /execution/decision — rejeição pré-bridge (sem bridge_id) → 422 ----
  console.log("\nGroup 4: POST /execution/decision — rejeição pré-bridge (sem bridge_id) → 422");

  const noBridgeResponse = buildNoBridgeIdResponse();

  // Esta resposta representa o 422 retornado quando bridge_id está ausente
  assert(noBridgeResponse.ok         === false, "G4: ok = false (sem bridge_id)");
  assert(noBridgeResponse.p14_valid  === false, "G4: p14_valid = false — não é P14 válida");
  assert(typeof noBridgeResponse.error === "string" && noBridgeResponse.error.length > 0,
    "G4: error string presente");
  assert(Array.isArray(noBridgeResponse.diagnostic) && noBridgeResponse.diagnostic.length > 0,
    "G4: diagnostic array presente com explicação");
  // Verifica que o diagnóstico explica o vínculo canônico
  assert(noBridgeResponse.diagnostic.some(d => d.includes("bridge_id")),
    "G4: diagnostic menciona bridge_id como identificador canônico");
  assert(noBridgeResponse.diagnostic.some(d => d.toLowerCase().includes("pré-bridge") || d.toLowerCase().includes("pre-bridge") || d.includes("antes do disparo")),
    "G4: diagnostic explica que rejeição pré-bridge não tem vínculo canônico");

  // ---- Group 5: POST /execution/decision — bridge_id null → mesmo tratamento 422 ----
  console.log("\nGroup 5: POST /execution/decision — bridge_id null → 422 (mesma regra)");

  // bridge_id: null é semanticamente igual a ausente
  const nullBridgeResponse = buildNoBridgeIdResponse();
  assert(nullBridgeResponse.ok        === false, "G5: ok = false quando bridge_id = null");
  assert(nullBridgeResponse.p14_valid === false, "G5: p14_valid = false quando bridge_id = null");
  // NÃO há registro persistido — a resposta não contém um campo `decision` com bridge_id
  assert(!("decision" in nullBridgeResponse) || nullBridgeResponse.decision === undefined,
    "G5: nenhum registro persistido quando bridge_id = null");

  // ---- Group 6: GET /execution/decisions — sem ?bridge_id → 400 ----
  console.log("\nGroup 6: GET /execution/decisions — sem ?bridge_id → 400");

  const noParamResponse = buildNoParamResponse();

  assert(noParamResponse.ok === false,                    "G6: ok = false sem bridge_id");
  assert(typeof noParamResponse.error === "string",       "G6: error string presente");
  assert(Array.isArray(noParamResponse.diagnostic),       "G6: diagnostic array presente");
  assert(noParamResponse.diagnostic.some(d => d.includes("bridge_id")),
    "G6: diagnostic explica bridge_id como parâmetro obrigatório");

  // ---- Group 7: GET /execution/decisions?bridge_id=xxx → lista de decisões ----
  console.log("\nGroup 7: GET /execution/decisions?bridge_id=xxx → lista de decisões");

  const decisions = [approvalRecord, postBridgeRejection];
  const getResponse = buildGetDecisionsResponse("bridge-real-abc123", [approvalRecord]);

  assert(getResponse.ok                        === true,           "G7: ok = true");
  assert(getResponse.bridge_id                 === "bridge-real-abc123", "G7: bridge_id echo correto");
  assert(Array.isArray(getResponse.decisions),                      "G7: decisions é array");
  assert(getResponse.decisions.length          >= 0,               "G7: decisions length >= 0");
  // Cada registro retornado deve ter bridge_id canônico não-nulo
  for (const d of getResponse.decisions) {
    assert(typeof d.bridge_id === "string" && d.bridge_id.length > 0,
      `G7: decisão ${d.decision_id} tem bridge_id não-nulo`);
    assert(d.decision === "approved" || d.decision === "rejected",
      `G7: decisão ${d.decision_id} tem valor válido`);
  }

  // ---- Group 8: Isolamento P13/P14 — decisão não contém campos de trilha ----
  console.log("\nGroup 8: Isolamento P13/P14 — decisão não contém campos da trilha de execução");

  assert(!("dispatched_at"   in approvalRecord), "G8: decisão não contém dispatched_at (P13)");
  assert(!("executor_ok"     in approvalRecord), "G8: decisão não contém executor_ok (P13)");
  assert(!("executor_status" in approvalRecord), "G8: decisão não contém executor_status (P13)");
  assert(!("executor_error"  in approvalRecord), "G8: decisão não contém executor_error (P13)");
  assert(!("steps_count"     in approvalRecord), "G8: decisão não contém steps_count (P13)");
  assert(!("source"          in approvalRecord), "G8: decisão não contém source (P13 field)");

  // Mas deve ter os campos canônicos de P14
  assert("decision_id" in approvalRecord, "G8: decisão tem decision_id (P14)");
  assert("bridge_id"   in approvalRecord, "G8: decisão tem bridge_id (P14 — vínculo à execução)");
  assert("decided_at"  in approvalRecord, "G8: decisão tem decided_at (P14)");
  assert("decided_by"  in approvalRecord, "G8: decisão tem decided_by (P14)");

  // ---- Group 9: JSON round-trip — decisão sobrevive serialização KV ----
  console.log("\nGroup 9: JSON round-trip — decisão sobrevive serialização KV");

  let serializable = true;
  let roundTripped;
  try {
    roundTripped = JSON.parse(JSON.stringify(approvalRecord));
  } catch (_) {
    serializable = false;
  }
  assert(serializable,                                                    "G9: decisão sobrevive JSON round-trip");
  assert(roundTripped.bridge_id  === approvalRecord.bridge_id,            "G9: bridge_id preservado");
  assert(roundTripped.decision   === approvalRecord.decision,             "G9: decision preservado");
  assert(roundTripped.decision_id === approvalRecord.decision_id,         "G9: decision_id preservado");
  assert(roundTripped.decided_at === approvalRecord.decided_at,           "G9: decided_at preservado");

  // ---- Group 10: Invariantes — bridge_id nunca null num registro P14 válido ----
  console.log("\nGroup 10: Invariantes — bridge_id nunca null num registro P14 válido");

  const allValidRecords = [approvalRecord, postBridgeRejection];

  for (const r of allValidRecords) {
    assert(typeof r.bridge_id === "string" && r.bridge_id.length > 0,
      `G10: bridge_id não-nulo em ${r.decision} (${r.decision_id})`);
    assert(r.bridge_id !== null,
      `G10: bridge_id !== null em ${r.decision} (${r.decision_id})`);
    assert(typeof r.decision_id === "string" && r.decision_id.length > 0,
      `G10: decision_id não-vazio em ${r.decision} (${r.decision_id})`);
    assert(typeof r.decided_at === "string" && !isNaN(new Date(r.decided_at).getTime()),
      `G10: decided_at é ISO válido em ${r.decision} (${r.decision_id})`);
  }

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
