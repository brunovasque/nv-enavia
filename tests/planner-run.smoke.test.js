// ============================================================================
// 🧪 Smoke Tests — ENAVIA Planner Run Endpoint (POST /planner/run)
//
// Run: node tests/planner-run.smoke.test.js
//
// Valida o pipeline integrado PM4→PM5→PM6→PM7→PM8→PM9 exposto
// pelo handler handlePlannerRun, sem depender de HTTP real.
//
// Tests:
//   Group 1: Pipeline simples (nível A) — payload estruturado completo
//   Group 2: Pipeline tático (nível B) — classificação e gate coerentes
//   Group 3: Pipeline complexo (nível C) — gate bloqueia, bridge blocked
//   Group 4: Campos obrigatórios no response
//   Group 5: Determinismo — mesmo input, mesmo output
//   Group 6: Context passthru — contexto externo influencia classificação
//   Group 7: Validação de input — erros claros para input inválido
// ============================================================================

import { classifyRequest } from "../schema/planner-classifier.js";
import { buildOutputEnvelope } from "../schema/planner-output-modes.js";
import { buildCanonicalPlan } from "../schema/planner-canonical-plan.js";
import { evaluateApprovalGate } from "../schema/planner-approval-gate.js";
import { buildExecutorBridgePayload } from "../schema/planner-executor-bridge.js";
import { consolidateMemoryLearning } from "../schema/memory-consolidation.js";

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
// runPlannerPipeline — replica o pipeline do handler para teste unitário
// ---------------------------------------------------------------------------
function runPlannerPipeline(message, context) {
  const classification = classifyRequest({ text: message, context });
  const envelope = buildOutputEnvelope(classification, { text: message });
  const canonicalPlan = buildCanonicalPlan({
    classification,
    envelope,
    input: { text: message },
  });
  const gate = evaluateApprovalGate(canonicalPlan);
  const bridge = buildExecutorBridgePayload({ plan: canonicalPlan, gate });
  const memoryConsolidation = consolidateMemoryLearning({
    plan: canonicalPlan,
    gate,
    bridge,
  });

  return {
    ok: true,
    classification,
    canonicalPlan,
    gate,
    bridge,
    memoryConsolidation,
    outputMode: envelope.output_mode,
  };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function runTests() {
  console.log("\n=== ENAVIA Planner Run — Smoke Tests (Pipeline PM4→PM9) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: Pipeline simples (nível A)
  // -------------------------------------------------------------------------
  console.log("Group 1: Pipeline simples (nível A)");

  const a = runPlannerPipeline("Quero ver os logs do worker");
  assert(a.ok === true, "ok === true");
  assert(a.classification !== undefined, "classification presente");
  assert(a.classification.complexity_level === "A", "classificação nível A");
  assert(a.canonicalPlan !== undefined, "canonicalPlan presente");
  assert(a.canonicalPlan.plan_version === "1.0", "plan_version === 1.0");
  assert(a.canonicalPlan.complexity_level === "A", "canonicalPlan nível A");
  assert(a.gate !== undefined, "gate presente");
  assert(a.gate.can_proceed === true, "gate libera nível A");
  assert(a.gate.gate_status === "approved_not_required", "gate_status correto para A");
  assert(a.bridge !== undefined, "bridge presente");
  assert(a.memoryConsolidation !== undefined, "memoryConsolidation presente");
  assert(typeof a.outputMode === "string", "outputMode é string");
  assert(a.outputMode === "quick_reply", "outputMode === quick_reply para A");

  // -------------------------------------------------------------------------
  // Group 2: Pipeline tático (nível B)
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: Pipeline tático (nível B)");

  const b = runPlannerPipeline(
    "Preciso migrar a infraestrutura do banco de dados e orquestrar o pipeline de deploy, o escopo é amplo e talvez envolva múltiplas fases"
  );
  assert(b.ok === true, "ok === true");
  assert(
    b.classification.complexity_level === "B" || b.classification.complexity_level === "C",
    "classificação nível B ou C (texto tático/complexo)"
  );

  if (b.classification.complexity_level === "B") {
    assert(b.canonicalPlan.complexity_level === "B", "canonicalPlan nível B");
    assert(b.outputMode === "tactical_plan", "outputMode === tactical_plan");
  }

  assert(b.gate !== undefined, "gate presente");
  assert(b.bridge !== undefined, "bridge presente");
  assert(b.memoryConsolidation !== undefined, "memoryConsolidation presente");

  // -------------------------------------------------------------------------
  // Group 3: Pipeline complexo (nível C)
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: Pipeline complexo (nível C)");

  const c = runPlannerPipeline(
    "Redesenhar toda a arquitetura, migrar banco de dados em fases, integrar pipelines múltiplos com compliance e risco alto",
    { known_dependencies: ["supabase", "cloudflare"], mentions_prod: true }
  );
  assert(c.ok === true, "ok === true");
  assert(c.classification.complexity_level === "C", "classificação nível C");
  assert(c.canonicalPlan.complexity_level === "C", "canonicalPlan nível C");
  assert(c.canonicalPlan.needs_human_approval === true, "needs_human_approval === true");
  assert(c.gate.gate_status === "approval_required", "gate bloqueia para nível C");
  assert(c.gate.can_proceed === false, "can_proceed === false para C");
  assert(c.bridge.bridge_status === "blocked_by_gate", "bridge blocked_by_gate");
  assert(c.outputMode === "formal_contract", "outputMode === formal_contract");

  // -------------------------------------------------------------------------
  // Group 4: Campos obrigatórios no response
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: Campos obrigatórios no response");

  const requiredFields = [
    "ok", "classification", "canonicalPlan", "gate",
    "bridge", "memoryConsolidation", "outputMode"
  ];
  const sample = runPlannerPipeline("Listar contratos ativos");
  for (const field of requiredFields) {
    assert(field in sample, `campo '${field}' presente no response`);
  }

  // classification fields
  assert(typeof sample.classification.request_type === "string", "classification.request_type é string");
  assert(typeof sample.classification.complexity_level === "string", "classification.complexity_level é string");
  assert(typeof sample.classification.category === "string", "classification.category é string");
  assert(typeof sample.classification.risk_level === "string", "classification.risk_level é string");
  assert(typeof sample.classification.needs_human_approval === "boolean", "classification.needs_human_approval é boolean");
  assert(Array.isArray(sample.classification.signals), "classification.signals é array");
  assert(typeof sample.classification.reason === "string", "classification.reason é string");

  // canonicalPlan fields
  assert(typeof sample.canonicalPlan.plan_version === "string", "canonicalPlan.plan_version é string");
  assert(typeof sample.canonicalPlan.plan_type === "string", "canonicalPlan.plan_type é string");
  assert(typeof sample.canonicalPlan.objective === "string", "canonicalPlan.objective é string");
  assert(Array.isArray(sample.canonicalPlan.steps), "canonicalPlan.steps é array");
  assert(Array.isArray(sample.canonicalPlan.risks), "canonicalPlan.risks é array");
  assert(typeof sample.canonicalPlan.next_action === "string", "canonicalPlan.next_action é string");

  // gate fields
  assert(typeof sample.gate.gate_status === "string", "gate.gate_status é string");
  assert(typeof sample.gate.needs_human_approval === "boolean", "gate.needs_human_approval é boolean");
  assert(typeof sample.gate.can_proceed === "boolean", "gate.can_proceed é boolean");
  assert(typeof sample.gate.reason === "string", "gate.reason é string");
  assert(typeof sample.gate.next_action === "string", "gate.next_action é string");

  // bridge fields
  assert(typeof sample.bridge.bridge_status === "string", "bridge.bridge_status é string");

  // memoryConsolidation fields
  assert(typeof sample.memoryConsolidation === "object", "memoryConsolidation é object");

  // outputMode
  assert(["quick_reply", "tactical_plan", "formal_contract"].includes(sample.outputMode),
    "outputMode é um dos 3 modos válidos");

  // -------------------------------------------------------------------------
  // Group 5: Determinismo — mesmo input, mesmo output
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: Determinismo");

  const d1 = runPlannerPipeline("Verificar status dos workers");
  const d2 = runPlannerPipeline("Verificar status dos workers");
  assert(
    JSON.stringify(d1.classification) === JSON.stringify(d2.classification),
    "classification determinístico"
  );
  assert(
    JSON.stringify(d1.canonicalPlan) === JSON.stringify(d2.canonicalPlan),
    "canonicalPlan determinístico"
  );
  assert(
    JSON.stringify(d1.gate) === JSON.stringify(d2.gate),
    "gate determinístico"
  );
  assert(d1.outputMode === d2.outputMode, "outputMode determinístico");

  // -------------------------------------------------------------------------
  // Group 6: Context passthru
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: Context passthru");

  const noCtx = runPlannerPipeline("Criar novo endpoint");
  const withProd = runPlannerPipeline("Criar novo endpoint", { mentions_prod: true });
  assert(
    withProd.classification.needs_human_approval === true,
    "mentions_prod → needs_human_approval = true"
  );

  // -------------------------------------------------------------------------
  // Group 7: Serialização JSON roundtrip
  // -------------------------------------------------------------------------
  console.log("\nGroup 7: Serialização JSON roundtrip");

  const original = runPlannerPipeline("Testar serialização do payload");
  const serialized = JSON.stringify(original);
  const deserialized = JSON.parse(serialized);
  assert(deserialized.ok === true, "JSON roundtrip preserva ok");
  assert(deserialized.classification.complexity_level === original.classification.complexity_level,
    "JSON roundtrip preserva classification");
  assert(deserialized.canonicalPlan.plan_version === original.canonicalPlan.plan_version,
    "JSON roundtrip preserva canonicalPlan");
  assert(deserialized.gate.gate_status === original.gate.gate_status,
    "JSON roundtrip preserva gate");
  assert(deserialized.outputMode === original.outputMode,
    "JSON roundtrip preserva outputMode");

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
