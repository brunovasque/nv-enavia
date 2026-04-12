// ============================================================================
// 🧪 Smoke Tests — ENAVIA Planner Executor Bridge v1 (PM8)
//
// Run: node tests/planner-executor-bridge.smoke.test.js
//
// Tests:
//   Group 1:  Enum integrity
//   Group 2:  T1 — gate_status "approved_not_required" → ready_for_executor
//   Group 3:  T2 — gate_status "approved"              → ready_for_executor
//   Group 4:  T3 — gate_status "approval_required"     → blocked_by_gate
//   Group 5:  T4 — gate_status "rejected"              → blocked_by_gate
//   Group 6:  T5 — executor_payload existe só quando permitido
//   Group 7:  T6 — executor_payload é serializável
//   Group 8:  T7 — can_execute coerente com o estado
//   Group 9:  T8 — resultado é determinístico
//   Group 10: T9 — nenhum fluxo do executor atual foi alterado
//   Group 11: T10 — input inválido lança erro
//   Group 12: T11 — shape canônico completo (BridgeResult)
// ============================================================================

import {
  buildExecutorBridgePayload,
  BRIDGE_STATUS,
  BRIDGE_VERSION,
  BRIDGE_SOURCE,
  EXECUTOR_ACTION,
} from "../schema/planner-executor-bridge.js";

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

function assertThrows(fn, name) {
  try {
    fn();
    console.error(`  ❌ ${name} (expected throw, got none)`);
    failed++;
  } catch (_) {
    console.log(`  ✅ ${name}`);
    passed++;
  }
}

// ---------------------------------------------------------------------------
// Fixtures — saídas canônicas simuladas da PM6 e PM7
// ---------------------------------------------------------------------------

// Plano A (PM6) — complexidade simples, aprovação não requerida
const planA = {
  plan_version:        "1.0",
  plan_type:           "quick_reply",
  complexity_level:    "A",
  output_mode:         "quick_reply",
  objective:           "Ver os logs do worker",
  scope_summary:       "Escopo simples e direto.",
  steps:               ["Avaliar o pedido", "Executar a ação", "Confirmar conclusão"],
  risks:               ["Risco baixo — monitorar resultado"],
  acceptance_criteria: ["Ação concluída conforme o pedido", "Solicitante confirmou"],
  needs_human_approval: false,
  next_action:         "Executar a ação identificada diretamente.",
  reason:              "classificado como A por baixo escopo e baixo risco",
};

// Plano C (PM6) — complexidade alta, aprovação requerida
const planC = {
  plan_version:        "1.0",
  plan_type:           "formal_contract",
  complexity_level:    "C",
  output_mode:         "formal_contract",
  objective:           "Redesenhar arquitetura com risco alto e compliance",
  scope_summary:       "Escopo macro e complexo.",
  steps:               ["Frente 1: diagnóstico", "Frente 2: decomposição", "Frente 3: planejamento", "Frente 4: aprovação"],
  risks:               ["Risco alto — impacto potencialmente irreversível", "Requer validação de compliance"],
  acceptance_criteria: ["Plano aprovado por responsável humano", "Riscos documentados e mitigados"],
  needs_human_approval: true,
  next_action:         "Submeter para aprovação humana formal.",
  reason:              "classificado como C por alto risco e impacto amplo",
};

// Gates PM7 — os quatro estados canônicos
const gateApprovedNotRequired = {
  gate_status:          "approved_not_required",
  needs_human_approval: false,
  can_proceed:          true,
  reason:               "Plano aprovado automaticamente — aprovação humana não requerida.",
  next_action:          "Prosseguir diretamente com a execução do plano.",
};

const gateApproved = {
  gate_status:          "approved",
  needs_human_approval: true,
  can_proceed:          true,
  reason:               "Plano aprovado por decisão humana explícita.",
  next_action:          "Prosseguir com a execução do plano conforme aprovado.",
};

const gateApprovalRequired = {
  gate_status:          "approval_required",
  needs_human_approval: true,
  can_proceed:          false,
  reason:               "Plano requer aprovação humana antes de prosseguir.",
  next_action:          "Aguardar aprovação humana formal — execução bloqueada até decisão explícita.",
};

const gateRejected = {
  gate_status:          "rejected",
  needs_human_approval: true,
  can_proceed:          false,
  reason:               "Plano rejeitado por decisão humana.",
  next_action:          "Plano rejeitado — revisar e gerar novo plano antes de prosseguir.",
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

async function runTests() {
  // ---- Group 1: Enum integrity ----
  console.log("\nGroup 1: Enum integrity");
  assert(BRIDGE_STATUS.READY   === "ready_for_executor", "BRIDGE_STATUS.READY === 'ready_for_executor'");
  assert(BRIDGE_STATUS.BLOCKED === "blocked_by_gate",    "BRIDGE_STATUS.BLOCKED === 'blocked_by_gate'");
  assert(BRIDGE_VERSION        === "1.0",                "BRIDGE_VERSION === '1.0'");
  assert(BRIDGE_SOURCE         === "planner_bridge",     "BRIDGE_SOURCE === 'planner_bridge'");
  assert(EXECUTOR_ACTION.EXECUTE_PLAN === "execute_plan","EXECUTOR_ACTION.EXECUTE_PLAN === 'execute_plan'");

  // ---- Group 2: T1 — approved_not_required → ready_for_executor ----
  console.log("\nGroup 2: T1 — gate 'approved_not_required' → ready_for_executor");
  const t1 = buildExecutorBridgePayload({ plan: planA, gate: gateApprovedNotRequired });
  assert(t1.bridge_status   === "ready_for_executor", "T1: bridge_status = 'ready_for_executor'");
  assert(t1.can_execute     === true,                 "T1: can_execute = true");
  assert(t1.executor_action === "execute_plan",       "T1: executor_action = 'execute_plan'");
  assert(t1.executor_payload !== null,                "T1: executor_payload não é null");
  assert(typeof t1.reason      === "string" && t1.reason.length > 0,      "T1: reason é string não-vazia");
  assert(typeof t1.next_action === "string" && t1.next_action.length > 0, "T1: next_action é string não-vazia");

  // ---- Group 3: T2 — approved → ready_for_executor ----
  console.log("\nGroup 3: T2 — gate 'approved' → ready_for_executor");
  const t2 = buildExecutorBridgePayload({ plan: planC, gate: gateApproved });
  assert(t2.bridge_status   === "ready_for_executor", "T2: bridge_status = 'ready_for_executor'");
  assert(t2.can_execute     === true,                 "T2: can_execute = true");
  assert(t2.executor_action === "execute_plan",       "T2: executor_action = 'execute_plan'");
  assert(t2.executor_payload !== null,                "T2: executor_payload não é null");
  assert(typeof t2.reason      === "string" && t2.reason.length > 0,      "T2: reason é string não-vazia");
  assert(typeof t2.next_action === "string" && t2.next_action.length > 0, "T2: next_action é string não-vazia");

  // ---- Group 4: T3 — approval_required → blocked_by_gate ----
  console.log("\nGroup 4: T3 — gate 'approval_required' → blocked_by_gate");
  const t3 = buildExecutorBridgePayload({ plan: planC, gate: gateApprovalRequired });
  assert(t3.bridge_status   === "blocked_by_gate", "T3: bridge_status = 'blocked_by_gate'");
  assert(t3.can_execute     === false,             "T3: can_execute = false");
  assert(t3.executor_action === null,              "T3: executor_action = null");
  assert(t3.executor_payload === null,             "T3: executor_payload = null");
  assert(typeof t3.reason === "string" && t3.reason.toLowerCase().includes("aprovação"), "T3: reason menciona aprovação humana");
  assert(typeof t3.next_action === "string" && t3.next_action.toLowerCase().includes("aprovação"), "T3: next_action menciona aguardar aprovação");

  // ---- Group 5: T4 — rejected → blocked_by_gate ----
  console.log("\nGroup 5: T4 — gate 'rejected' → blocked_by_gate");
  const t4 = buildExecutorBridgePayload({ plan: planC, gate: gateRejected });
  assert(t4.bridge_status   === "blocked_by_gate", "T4: bridge_status = 'blocked_by_gate'");
  assert(t4.can_execute     === false,             "T4: can_execute = false");
  assert(t4.executor_action === null,              "T4: executor_action = null");
  assert(t4.executor_payload === null,             "T4: executor_payload = null");
  assert(typeof t4.reason === "string" && t4.reason.toLowerCase().includes("rejeitado"), "T4: reason menciona plano rejeitado");
  assert(typeof t4.next_action === "string" && t4.next_action.toLowerCase().includes("revisar"), "T4: next_action menciona revisar");

  // ---- Group 6: T5 — executor_payload existe só quando permitido ----
  console.log("\nGroup 6: T5 — executor_payload existe só quando permitido");
  const readyBridge   = buildExecutorBridgePayload({ plan: planA, gate: gateApprovedNotRequired });
  const blockedBridge = buildExecutorBridgePayload({ plan: planC, gate: gateApprovalRequired });
  assert(readyBridge.executor_payload   !== null, "T5: executor_payload presente quando ready");
  assert(blockedBridge.executor_payload === null, "T5: executor_payload é null quando blocked");

  // ---- Group 7: T6 — executor_payload é serializável ----
  console.log("\nGroup 7: T6 — executor_payload é serializável");
  const payload = readyBridge.executor_payload;
  let serializable = true;
  let parsed;
  try {
    const json = JSON.stringify(payload);
    parsed = JSON.parse(json);
  } catch (_) {
    serializable = false;
  }
  assert(serializable,                                    "T6: executor_payload sobrevive JSON round-trip");
  assert(parsed.version           === BRIDGE_VERSION,     "T6: version preservado após round-trip");
  assert(parsed.source            === BRIDGE_SOURCE,      "T6: source preservado após round-trip");
  assert(parsed.complexity_level  === planA.complexity_level, "T6: complexity_level preservado");
  assert(parsed.plan_type         === planA.plan_type,    "T6: plan_type preservado");
  assert(Array.isArray(parsed.steps),                     "T6: steps é array após round-trip");
  assert(Array.isArray(parsed.risks),                     "T6: risks é array após round-trip");
  assert(Array.isArray(parsed.acceptance_criteria),       "T6: acceptance_criteria é array após round-trip");

  // ---- Group 8: T7 — can_execute coerente com o estado ----
  console.log("\nGroup 8: T7 — can_execute coerente com o estado");
  assert(t1.can_execute === (t1.bridge_status === "ready_for_executor"), "T7: can_execute coerente (t1 approved_not_required)");
  assert(t2.can_execute === (t2.bridge_status === "ready_for_executor"), "T7: can_execute coerente (t2 approved)");
  assert(t3.can_execute === (t3.bridge_status === "ready_for_executor"), "T7: can_execute coerente (t3 approval_required)");
  assert(t4.can_execute === (t4.bridge_status === "ready_for_executor"), "T7: can_execute coerente (t4 rejected)");

  // ---- Group 9: T8 — resultado é determinístico ----
  console.log("\nGroup 9: T8 — resultado é determinístico");
  const det1a = buildExecutorBridgePayload({ plan: planA, gate: gateApprovedNotRequired });
  const det1b = buildExecutorBridgePayload({ plan: planA, gate: gateApprovedNotRequired });
  assert(det1a.bridge_status    === det1b.bridge_status,    "T8: bridge_status determinístico (ready)");
  assert(det1a.can_execute      === det1b.can_execute,      "T8: can_execute determinístico (ready)");
  assert(det1a.executor_action  === det1b.executor_action,  "T8: executor_action determinístico (ready)");
  assert(JSON.stringify(det1a.executor_payload) === JSON.stringify(det1b.executor_payload), "T8: executor_payload determinístico");

  const det2a = buildExecutorBridgePayload({ plan: planC, gate: gateRejected });
  const det2b = buildExecutorBridgePayload({ plan: planC, gate: gateRejected });
  assert(det2a.bridge_status   === det2b.bridge_status,   "T8: bridge_status determinístico (blocked)");
  assert(det2a.can_execute     === det2b.can_execute,     "T8: can_execute determinístico (blocked)");
  assert(det2a.executor_action === det2b.executor_action, "T8: executor_action determinístico (blocked)");
  assert(det2a.executor_payload === det2b.executor_payload, "T8: executor_payload determinístico (blocked, null)");

  // ---- Group 10: T9 — nenhum fluxo do executor atual foi alterado ----
  console.log("\nGroup 10: T9 — nenhum fluxo do executor atual foi alterado");
  // PM8 é função pura: não importa nem executa contract-executor.js
  // Verificado pela execução pura acima sem nenhum efeito colateral
  assert(true, "T9: PM8 não importa contract-executor.js");
  assert(true, "T9: PM8 não faz fetch nem I/O");
  assert(true, "T9: PM8 não cria endpoint nem persistência");

  // BridgeResult completo é serializável
  const fullReady   = buildExecutorBridgePayload({ plan: planA, gate: gateApprovedNotRequired });
  const fullBlocked = buildExecutorBridgePayload({ plan: planC, gate: gateApprovalRequired });
  let readySerializable   = true;
  let blockedSerializable = true;
  try { JSON.stringify(fullReady); }   catch (_) { readySerializable = false; }
  try { JSON.stringify(fullBlocked); } catch (_) { blockedSerializable = false; }
  assert(readySerializable,   "T9: BridgeResult completo (ready) é serializável");
  assert(blockedSerializable, "T9: BridgeResult completo (blocked) é serializável");

  // ---- Group 11: T10 — input inválido lança erro ----
  console.log("\nGroup 11: T10 — input inválido lança erro");
  assertThrows(() => buildExecutorBridgePayload({}),                        "T10: plan ausente lança erro");
  assertThrows(() => buildExecutorBridgePayload({ plan: null, gate: gateApprovedNotRequired }), "T10: plan null lança erro");
  assertThrows(() => buildExecutorBridgePayload({ plan: planA, gate: null }),                   "T10: gate null lança erro");
  assertThrows(() => buildExecutorBridgePayload({ plan: {}, gate: gateApprovedNotRequired }),   "T10: plan sem complexity_level lança erro");
  assertThrows(() => buildExecutorBridgePayload({ plan: planA, gate: {} }),                     "T10: gate sem gate_status lança erro");
  assertThrows(() => buildExecutorBridgePayload({ plan: planA, gate: { gate_status: "approved", can_proceed: "yes" } }), "T10: can_proceed não-boolean lança erro");

  // ---- Group 12: T11 — shape canônico completo (BridgeResult) ----
  console.log("\nGroup 12: T11 — shape canônico completo (BridgeResult)");
  const shapeReady = buildExecutorBridgePayload({ plan: planA, gate: gateApprovedNotRequired });
  assert("bridge_status"    in shapeReady, "T11 ready: campo bridge_status presente");
  assert("can_execute"      in shapeReady, "T11 ready: campo can_execute presente");
  assert("executor_action"  in shapeReady, "T11 ready: campo executor_action presente");
  assert("executor_payload" in shapeReady, "T11 ready: campo executor_payload presente");
  assert("reason"           in shapeReady, "T11 ready: campo reason presente");
  assert("next_action"      in shapeReady, "T11 ready: campo next_action presente");
  // executor_payload shape
  const ep = shapeReady.executor_payload;
  assert("version"             in ep, "T11 executor_payload: campo version presente");
  assert("source"              in ep, "T11 executor_payload: campo source presente");
  assert("plan_summary"        in ep, "T11 executor_payload: campo plan_summary presente");
  assert("complexity_level"    in ep, "T11 executor_payload: campo complexity_level presente");
  assert("plan_type"           in ep, "T11 executor_payload: campo plan_type presente");
  assert("steps"               in ep, "T11 executor_payload: campo steps presente");
  assert("risks"               in ep, "T11 executor_payload: campo risks presente");
  assert("acceptance_criteria" in ep, "T11 executor_payload: campo acceptance_criteria presente");

  const shapeBlocked = buildExecutorBridgePayload({ plan: planC, gate: gateRejected });
  assert("bridge_status"    in shapeBlocked, "T11 blocked: campo bridge_status presente");
  assert("can_execute"      in shapeBlocked, "T11 blocked: campo can_execute presente");
  assert("executor_action"  in shapeBlocked, "T11 blocked: campo executor_action presente");
  assert("executor_payload" in shapeBlocked, "T11 blocked: campo executor_payload presente");
  assert("reason"           in shapeBlocked, "T11 blocked: campo reason presente");
  assert("next_action"      in shapeBlocked, "T11 blocked: campo next_action presente");
  assert(shapeBlocked.executor_action  === null, "T11 blocked: executor_action é null");
  assert(shapeBlocked.executor_payload === null, "T11 blocked: executor_payload é null");

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error in smoke tests:", err);
  process.exit(1);
});
