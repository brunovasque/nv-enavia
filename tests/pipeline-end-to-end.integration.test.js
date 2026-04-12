// ============================================================================
// 🧪 Teste de Integração End-to-End — Pipeline completo PM4 → PM9
//
// Run: node tests/pipeline-end-to-end.integration.test.js
//
// Prova que os shapes de PM4, PM5, PM6, PM7, PM8 e PM9 conversam entre si
// de verdade: saída real de uma etapa alimenta a próxima.
//
// Sequência testada:
//   classifyRequest        (PM4)
//   → selectOutputMode     (PM5)
//   → buildOutputEnvelope  (PM5)
//   → buildCanonicalPlan   (PM6)
//   → evaluateApprovalGate (PM7)
//   → buildExecutorBridgePayload    (PM8)
//   → consolidateMemoryLearning     (PM9)
//
// Cenários:
//   Cenário 1 — Simples/aprovado sem gate pesado (nível A)
//   Cenário 2 — Complexo com aprovação humana e bridge bloqueada (nível C)
//   Cenário 2b — Mesmo ciclo C após aprovação humana explícita (approvePlan)
// ============================================================================

import { classifyRequest }             from "../schema/planner-classifier.js";
import { selectOutputMode,
         buildOutputEnvelope }         from "../schema/planner-output-modes.js";
import { buildCanonicalPlan }          from "../schema/planner-canonical-plan.js";
import { evaluateApprovalGate,
         approvePlan }                 from "../schema/planner-approval-gate.js";
import { buildExecutorBridgePayload,
         BRIDGE_STATUS }               from "../schema/planner-executor-bridge.js";
import { consolidateMemoryLearning }   from "../schema/memory-consolidation.js";
import { GATE_STATUS }                 from "../schema/planner-approval-gate.js";

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

// ===========================================================================
// Cenário 1 — Pedido simples, nível A, aprovação automática, sem gate pesado
// ===========================================================================
function runScenario1() {
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("Cenário 1 — Simples / aprovado_automaticamente (nível A)");
  console.log("══════════════════════════════════════════════════════════");

  const input = { text: "Ver os logs do worker de produção." };

  // PM4 — Classify
  const classification = classifyRequest(input);
  console.log(`\n[PM4] complexity_level=${classification.complexity_level}, needs_human_approval=${classification.needs_human_approval}`);
  assert(typeof classification.complexity_level === "string", "PM4: complexity_level é string");
  assert(typeof classification.needs_human_approval === "boolean", "PM4: needs_human_approval é boolean");

  // PM5a — Select output mode
  const outputMode = selectOutputMode(classification);
  console.log(`[PM5a] output_mode=${outputMode}`);
  assert(typeof outputMode === "string" && outputMode.length > 0, "PM5a: output_mode é string não-vazia");

  // PM5b — Build envelope (usa saída real do PM4)
  const envelope = buildOutputEnvelope(classification, input);
  console.log(`[PM5b] envelope.output_mode=${envelope.output_mode}, level=${envelope.level}`);
  assert(envelope.output_mode === outputMode,          "PM5b→PM5a: envelope.output_mode coincide com selectOutputMode");
  assert(typeof envelope.objective === "string",       "PM5b: envelope.objective é string");

  // PM6 — Build canonical plan (usa saída real do PM4 + PM5)
  const plan = buildCanonicalPlan({ classification, envelope, input });
  console.log(`[PM6] plan_type=${plan.plan_type}, complexity_level=${plan.complexity_level}`);
  assert(plan.plan_type        === envelope.output_mode,         "PM6→PM5: plan_type espelha envelope.output_mode");
  assert(plan.complexity_level === classification.complexity_level, "PM6→PM4: complexity_level preservado");
  assert(Array.isArray(plan.steps)               && plan.steps.length > 0,               "PM6: steps array não-vazio");
  assert(Array.isArray(plan.risks)               && plan.risks.length > 0,               "PM6: risks array não-vazio");
  assert(Array.isArray(plan.acceptance_criteria) && plan.acceptance_criteria.length > 0, "PM6: acceptance_criteria array não-vazio");
  assert(typeof plan.needs_human_approval === "boolean",          "PM6: needs_human_approval é boolean");

  // PM7 — Evaluate gate (usa saída real do PM6)
  const gate = evaluateApprovalGate(plan);
  console.log(`[PM7] gate_status=${gate.gate_status}, can_proceed=${gate.can_proceed}`);
  assert(gate.gate_status === (plan.needs_human_approval
    ? GATE_STATUS.APPROVAL_REQUIRED
    : GATE_STATUS.APPROVED_NOT_REQUIRED),               "PM7→PM6: gate_status coerente com needs_human_approval");
  assert(typeof gate.can_proceed === "boolean",          "PM7: can_proceed é boolean");

  // PM8 — Bridge (usa saída real do PM6 + PM7)
  const bridge = buildExecutorBridgePayload({ plan, gate });
  console.log(`[PM8] bridge_status=${bridge.bridge_status}, can_execute=${bridge.can_execute}`);
  assert(bridge.can_execute === (gate.can_proceed === true), "PM8→PM7: can_execute coerente com gate.can_proceed");
  if (gate.can_proceed) {
    assert(bridge.bridge_status   === BRIDGE_STATUS.READY,    "PM8→PM7: bridge_status=ready quando gate permite");
    assert(bridge.executor_payload !== null,                   "PM8: executor_payload presente quando pronto");
    assert(bridge.executor_payload.complexity_level === plan.complexity_level, "PM8→PM6: complexity_level preservado no payload");
    assert(bridge.executor_payload.plan_type        === plan.plan_type,        "PM8→PM6: plan_type preservado no payload");
  } else {
    assert(bridge.bridge_status   === BRIDGE_STATUS.BLOCKED, "PM8: bridge_status=blocked quando gate bloqueia");
    assert(bridge.executor_payload === null,                  "PM8: executor_payload null quando bloqueado");
  }

  // PM9 — Consolidate memory (usa saída real do PM6 + PM7 + PM8)
  const consolidation = consolidateMemoryLearning({ plan, gate, bridge });
  console.log(`[PM9] should_consolidate=${consolidation.should_consolidate}, candidates=${consolidation.memory_candidates.length}`);
  assert(typeof consolidation.should_consolidate === "boolean",      "PM9: should_consolidate é boolean");
  assert(Array.isArray(consolidation.memory_candidates),             "PM9: memory_candidates é array");
  assert(typeof consolidation.reason === "string" && consolidation.reason.length > 0,      "PM9: reason é string não-vazia");
  assert(typeof consolidation.next_action === "string" && consolidation.next_action.length > 0, "PM9: next_action é string não-vazia");

  if (gate.can_proceed) {
    // Nível A aprovado: consolida operacional, mas NÃO gera canônica (nível A)
    assert(consolidation.should_consolidate === true, "PM9→PM7: should_consolidate=true quando aprovado");
    const hasOperational = consolidation.memory_candidates.some((c) => c.memory_type === "operational_history");
    assert(hasOperational, "PM9: candidato operational_history presente");
    // Nível A não qualifica canônica (somente B/C com bridge ready qualificam)
    const hasCanonical = consolidation.memory_candidates.some((c) => c.is_canonical === true);
    if (plan.complexity_level === "A") {
      assert(!hasCanonical, "PM9: nível A não gera candidato canônico");
    }
  } else {
    assert(consolidation.should_consolidate === false, "PM9: should_consolidate=false quando gate bloqueia");
    assert(consolidation.memory_candidates.length === 0, "PM9: memory_candidates vazio quando não consolida");
  }

  console.log("\n  ✔ Cenário 1 completo — shapes coerentes PM4→PM9");
}

// ===========================================================================
// Cenário 2 — Pedido complexo, nível C, aprovação humana requerida inicialmente
// ===========================================================================
function runScenario2() {
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("Cenário 2 — Complexo / approval_required / bridge bloqueada");
  console.log("══════════════════════════════════════════════════════════");

  // Input com sinais de risco, urgência, sistema, múltiplas etapas e PROD
  const input = {
    text: "Migrar a arquitetura do banco de dados para um novo cluster em produção, incluindo automação do pipeline de CI/CD, etapas de validação e rollback.",
    context: { mentions_prod: true },
  };

  // PM4
  const classification = classifyRequest(input);
  console.log(`\n[PM4] complexity_level=${classification.complexity_level}, needs_human_approval=${classification.needs_human_approval}`);
  assert(classification.needs_human_approval === true, "PM4: needs_human_approval=true para input de alto risco");

  // PM5
  const outputMode = selectOutputMode(classification);
  const envelope   = buildOutputEnvelope(classification, input);
  console.log(`[PM5] output_mode=${outputMode}`);
  assert(envelope.output_mode === outputMode, "PM5: envelope.output_mode coerente");

  // PM6
  const plan = buildCanonicalPlan({ classification, envelope, input });
  console.log(`[PM6] plan_type=${plan.plan_type}, needs_human_approval=${plan.needs_human_approval}`);
  assert(plan.needs_human_approval === true,          "PM6: needs_human_approval=true preservado");
  assert(Array.isArray(plan.acceptance_criteria) && plan.acceptance_criteria.length > 0,
    "PM6: acceptance_criteria presente no plano C");

  // PM7 — avaliação inicial: approval_required
  const gateInitial = evaluateApprovalGate(plan);
  console.log(`[PM7-inicial] gate_status=${gateInitial.gate_status}, can_proceed=${gateInitial.can_proceed}`);
  assert(gateInitial.gate_status === GATE_STATUS.APPROVAL_REQUIRED, "PM7: gate inicial = approval_required para nível C");
  assert(gateInitial.can_proceed === false,                          "PM7: can_proceed=false no estado inicial");

  // PM8 — bridge bloqueada (gate ainda não aprovado)
  const bridgeBlocked = buildExecutorBridgePayload({ plan, gate: gateInitial });
  console.log(`[PM8-bloqueada] bridge_status=${bridgeBlocked.bridge_status}, can_execute=${bridgeBlocked.can_execute}`);
  assert(bridgeBlocked.bridge_status   === BRIDGE_STATUS.BLOCKED, "PM8: bridge bloqueada quando gate=approval_required");
  assert(bridgeBlocked.can_execute     === false,                  "PM8: can_execute=false quando bloqueado");
  assert(bridgeBlocked.executor_action === null,                   "PM8: executor_action=null quando bloqueado");
  assert(bridgeBlocked.executor_payload === null,                  "PM8: executor_payload=null quando bloqueado");
  assert(bridgeBlocked.reason.toLowerCase().includes("aprovação"), "PM8: reason menciona aprovação");

  // PM9 — não consolida (estado transitório)
  const consolidationInitial = consolidateMemoryLearning({ plan, gate: gateInitial, bridge: bridgeBlocked });
  console.log(`[PM9-inicial] should_consolidate=${consolidationInitial.should_consolidate}`);
  assert(consolidationInitial.should_consolidate === false,         "PM9: não consolida enquanto approval_required");
  assert(consolidationInitial.memory_candidates.length === 0,       "PM9: nenhum candidato enquanto transitório");

  // ---- Sub-cenário 2b — após aprovação humana explícita ----
  console.log("\n  -- Sub-cenário 2b: após approvePlan() (decisão humana) --");

  // PM7 — transição para approved via approvePlan
  const gateApproved = approvePlan(plan);
  console.log(`[PM7-aprovado] gate_status=${gateApproved.gate_status}, can_proceed=${gateApproved.can_proceed}`);
  assert(gateApproved.gate_status === GATE_STATUS.APPROVED, "PM7: gate=approved após approvePlan");
  assert(gateApproved.can_proceed === true,                 "PM7: can_proceed=true após aprovação humana");

  // PM8 — bridge pronta após aprovação
  const bridgeReady = buildExecutorBridgePayload({ plan, gate: gateApproved });
  console.log(`[PM8-pronta] bridge_status=${bridgeReady.bridge_status}, can_execute=${bridgeReady.can_execute}`);
  assert(bridgeReady.bridge_status   === BRIDGE_STATUS.READY, "PM8: bridge pronta após aprovação humana");
  assert(bridgeReady.can_execute     === true,                 "PM8: can_execute=true");
  assert(bridgeReady.executor_action === "execute_plan",       "PM8: executor_action=execute_plan");
  assert(bridgeReady.executor_payload !== null,                "PM8: executor_payload presente");
  assert(bridgeReady.executor_payload.complexity_level === plan.complexity_level,
    "PM8→PM6: complexity_level preservado no payload");
  assert(Array.isArray(bridgeReady.executor_payload.acceptance_criteria),
    "PM8→PM6: acceptance_criteria presente no executor_payload");

  // PM9 — consolida após aprovação: operacional + canônica (nível C com bridge ready)
  const consolidationFinal = consolidateMemoryLearning({ plan, gate: gateApproved, bridge: bridgeReady });
  console.log(`[PM9-final] should_consolidate=${consolidationFinal.should_consolidate}, candidates=${consolidationFinal.memory_candidates.length}`);
  assert(consolidationFinal.should_consolidate === true,  "PM9: consolida após aprovação humana");
  assert(consolidationFinal.memory_candidates.length >= 2, "PM9: ao menos 2 candidatos (operacional + canônica)");

  const opCandidate  = consolidationFinal.memory_candidates.find((c) => c.memory_type === "operational_history");
  const canCandidate = consolidationFinal.memory_candidates.find((c) => c.memory_type === "canonical_rules");
  assert(opCandidate  !== undefined, "PM9: candidato operational_history presente");
  assert(canCandidate !== undefined, "PM9: candidato canonical_rules presente (nível C com acceptance_criteria)");
  assert(canCandidate.is_canonical  === true,       "PM9: candidato canônico tem is_canonical=true");
  assert(canCandidate.status        === "canonical", "PM9: candidato canônico tem status=canonical");
  assert(opCandidate.is_canonical   === false,       "PM9: candidato operacional tem is_canonical=false");

  // Coerência cruzada: gate_status e bridge_status registrados no candidato operacional
  assert(opCandidate.content_structured.gate_status   === gateApproved.gate_status,   "PM9→PM7: gate_status registrado no candidato operacional");
  assert(opCandidate.content_structured.bridge_status === bridgeReady.bridge_status,  "PM9→PM8: bridge_status registrado no candidato operacional");

  console.log("\n  ✔ Cenário 2 completo — shapes coerentes PM4→PM9, bloqueio e aprovação confirmados");
}

// ===========================================================================
// Runner
// ===========================================================================
async function runAll() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Teste de integração end-to-end — Pipeline PM4 → PM9    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  runScenario1();
  runScenario2();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error("Fatal error in integration tests:", err);
  process.exit(1);
});
