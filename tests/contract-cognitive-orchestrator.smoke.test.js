// ============================================================================
// 🧪 Smoke Tests — Contract Cognitive Orchestrator (PR6)
//
// Orquestração canônica: gate contratual (PR3) + camada cognitiva (PR5).
// Valida hierarquia obrigatória, tabela de decisão e saída auditável.
//
// Run: node tests/contract-cognitive-orchestrator.smoke.test.js
//
// Tests:
//   1.  Enums íntegros (FINAL_DECISION, EXECUTION_MODE)
//   2.  gate BLOCK + cognição favorável → BLOCK (nunca vira EXECUTE)
//   3.  gate ALLOW + cognição clara/forte → EXECUTE_READY
//   4.  gate ALLOW + cognição ambígua → HUMAN_CONFIRM
//   5.  gate WARN + cognição forte → CAUTION_READY
//   6.  gate WARN + cognição fraca → HUMAN_CONFIRM
//   7.  sem contrato ativo → NO_CONTRACT
//   8.  base fraca (low confidence) → não vira EXECUTE_READY
//   9.  scope A e scope B isolados
//   10. Shape canônico completo da saída
//   11. Determinismo: mesma entrada → mesma saída
//   12. BLOCK com cognição alta NÃO sobrepõe gate
//   13. ALLOW com confidence baixa → INSUFFICIENT_BASIS
//   14. WARN + cognição ambígua → HUMAN_CONFIRM
//   15. gate null/missing → NO_CONTRACT
//   16. Notes consolidam gate + cognição + orchestrator
//   17. Supporting evidence inclui gate_pr3 e cognitive_pr5
//   18. PR1/PR2/PR3/PR5 imports sem regressão
// ============================================================================

import {
  orchestrateContractAwareAction,
  FINAL_DECISION,
  EXECUTION_MODE,
} from "../schema/contract-cognitive-orchestrator.js";

// --- PR3 imports for regression check ---
import {
  evaluateContractAdherence,
  DECISION,
  REASON_CODE,
} from "../schema/contract-adherence-engine.js";

// --- PR5 imports for regression check ---
import {
  analyzeContractContextCognitively,
  AMBIGUITY_LEVEL,
  CONFIDENCE_THRESHOLDS,
} from "../schema/contract-cognitive-advisor.js";

// --- PR2 imports for regression check ---
import {
  getActiveContractContext,
  resolveRelevantContractBlocks,
  KV_ACTIVE_CONTRACT_KEY,
} from "../schema/contract-active-state.js";

// --- PR1 imports for regression check ---
import {
  evaluateAdherence,
  ADHERENCE_STATUS,
} from "../schema/contract-adherence-gate.js";

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
// Helpers: mock gate and cognitive results
// ---------------------------------------------------------------------------
function mockGateAllow(overrides) {
  return {
    ok: true,
    decision: DECISION.ALLOW,
    reason_code: REASON_CODE.ALLOW_ADHERENT,
    reason_text: "Action is adherent to the active contract.",
    matched_rules: [],
    violations: [],
    requires_human_approval: false,
    notes: ["Gate note: all clear"],
    contract_id: "contract-test-001",
    scope: "default",
    evaluated_at: new Date().toISOString(),
    resolution_strategy: null,
    relevant_blocks_count: 3,
    ...overrides,
  };
}

function mockGateBlock(overrides) {
  return {
    ok: false,
    decision: DECISION.BLOCK,
    reason_code: REASON_CODE.BLOCK_HARD_RULE,
    reason_text: "Action conflicts with hard rule in block.",
    matched_rules: [{ rule: "No deploy without approval", category: "hard_rule" }],
    violations: [{ type: "hard_rule", description: "Violation" }],
    requires_human_approval: false,
    notes: ["Gate note: blocked"],
    contract_id: "contract-test-001",
    scope: "default",
    evaluated_at: new Date().toISOString(),
    resolution_strategy: null,
    relevant_blocks_count: 2,
    ...overrides,
  };
}

function mockGateWarn(overrides) {
  return {
    ok: true,
    decision: DECISION.WARN,
    reason_code: REASON_CODE.WARN_PARTIAL_EVIDENCE,
    reason_text: "Partial evidence only — proceed with caution.",
    matched_rules: [],
    violations: [],
    requires_human_approval: false,
    notes: ["Gate note: warning"],
    contract_id: "contract-test-001",
    scope: "default",
    evaluated_at: new Date().toISOString(),
    resolution_strategy: null,
    relevant_blocks_count: 1,
    ...overrides,
  };
}

function mockGateNoContract() {
  return {
    ok: false,
    decision: DECISION.WARN,
    reason_code: REASON_CODE.ERROR_NO_CONTRACT,
    reason_text: "No active contract found.",
    matched_rules: [],
    violations: [],
    requires_human_approval: false,
    notes: ["No active contract"],
    contract_id: null,
    scope: "default",
    evaluated_at: new Date().toISOString(),
    resolution_strategy: null,
    relevant_blocks_count: 0,
  };
}

function mockCognitiveClear(overrides) {
  return {
    ok: true,
    interpretation_summary: "Contrato claro — ação alinhada.",
    likely_intent: "Executar tarefa contratual.",
    ambiguity_level: AMBIGUITY_LEVEL.LOW,
    confidence: 0.85,
    perceived_conflicts: [],
    suggested_action: "Prosseguir com execução.",
    suggested_next_step: "Executar ação conforme contrato.",
    requires_human_confirmation: false,
    contract_evidence: [{ type: "block", signal: "rule match" }],
    possible_readings: [],
    notes: ["Cognition note: clear"],
    ...overrides,
  };
}

function mockCognitiveAmbiguous(overrides) {
  return {
    ok: true,
    interpretation_summary: "Ambiguidade detectada — múltiplas leituras possíveis.",
    likely_intent: "Intenção parcialmente alinhada.",
    ambiguity_level: AMBIGUITY_LEVEL.MEDIUM,
    confidence: 0.55,
    perceived_conflicts: [{ type: "interpretation_conflict", description: "Multiple readings" }],
    suggested_action: "Revisar antes de prosseguir.",
    suggested_next_step: "Confirmar interpretação com humano.",
    requires_human_confirmation: true,
    contract_evidence: [],
    possible_readings: ["Reading A", "Reading B"],
    notes: ["Cognition note: ambiguous"],
    ...overrides,
  };
}

function mockCognitiveWeak(overrides) {
  return {
    ok: true,
    interpretation_summary: "Base fraca — pouca evidência contratual.",
    likely_intent: "Incerto.",
    ambiguity_level: AMBIGUITY_LEVEL.HIGH,
    confidence: 0.25,
    perceived_conflicts: [],
    suggested_action: "Não prosseguir sem revisão.",
    suggested_next_step: "Buscar mais evidência contratual.",
    requires_human_confirmation: true,
    contract_evidence: [],
    possible_readings: [],
    notes: ["Cognition note: weak basis"],
    ...overrides,
  };
}

const candidateAction = {
  intent: "Implement feature X",
  phase: "development",
  task_id: "task-001",
  action_type: "code_change",
  target: "module-abc",
};

// =========================================================================
// TEST 1: Enums íntegros
// =========================================================================
console.log("\n--- Test 1: Enums FINAL_DECISION e EXECUTION_MODE ---");
assert(FINAL_DECISION.BLOCK === "BLOCK", "FINAL_DECISION.BLOCK = BLOCK");
assert(FINAL_DECISION.EXECUTE_READY === "EXECUTE_READY", "FINAL_DECISION.EXECUTE_READY = EXECUTE_READY");
assert(FINAL_DECISION.HUMAN_CONFIRM === "HUMAN_CONFIRM", "FINAL_DECISION.HUMAN_CONFIRM = HUMAN_CONFIRM");
assert(FINAL_DECISION.CAUTION_READY === "CAUTION_READY", "FINAL_DECISION.CAUTION_READY = CAUTION_READY");
assert(FINAL_DECISION.NO_CONTRACT === "NO_CONTRACT", "FINAL_DECISION.NO_CONTRACT = NO_CONTRACT");
assert(FINAL_DECISION.INSUFFICIENT_BASIS === "INSUFFICIENT_BASIS", "FINAL_DECISION.INSUFFICIENT_BASIS = INSUFFICIENT_BASIS");
assert(EXECUTION_MODE.BLOCKED === "BLOCKED", "EXECUTION_MODE.BLOCKED = BLOCKED");
assert(EXECUTION_MODE.AUTO === "AUTO", "EXECUTION_MODE.AUTO = AUTO");
assert(EXECUTION_MODE.SUPERVISED === "SUPERVISED", "EXECUTION_MODE.SUPERVISED = SUPERVISED");
assert(EXECUTION_MODE.MANUAL === "MANUAL", "EXECUTION_MODE.MANUAL = MANUAL");
assert(EXECUTION_MODE.UNAVAILABLE === "UNAVAILABLE", "EXECUTION_MODE.UNAVAILABLE = UNAVAILABLE");

// =========================================================================
// TEST 2: gate BLOCK + cognição favorável → BLOCK (nunca vira EXECUTE)
// =========================================================================
console.log("\n--- Test 2: gate BLOCK + cognição favorável → BLOCK ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateBlock(),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.BLOCK, "final_decision = BLOCK");
  assert(result.final_decision !== FINAL_DECISION.EXECUTE_READY, "final_decision ≠ EXECUTE_READY");
  assert(result.ok === false, "ok = false when BLOCK");
  assert(result.execution_mode === EXECUTION_MODE.BLOCKED, "execution_mode = BLOCKED");
  assert(result.gate_decision === DECISION.BLOCK, "gate_decision = BLOCK");
}

// =========================================================================
// TEST 3: gate ALLOW + cognição clara/forte → EXECUTE_READY
// =========================================================================
console.log("\n--- Test 3: gate ALLOW + cognição clara/forte → EXECUTE_READY ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow(),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.EXECUTE_READY, "final_decision = EXECUTE_READY");
  assert(result.ok === true, "ok = true");
  assert(result.execution_mode === EXECUTION_MODE.AUTO, "execution_mode = AUTO");
  assert(result.requires_human_confirmation === false, "requires_human_confirmation = false");
  assert(result.gate_decision === DECISION.ALLOW, "gate_decision = ALLOW");
  assert(result.cognitive_confidence === 0.85, "cognitive_confidence = 0.85");
  assert(result.cognitive_ambiguity === AMBIGUITY_LEVEL.LOW, "cognitive_ambiguity = LOW");
}

// =========================================================================
// TEST 4: gate ALLOW + cognição ambígua → HUMAN_CONFIRM
// =========================================================================
console.log("\n--- Test 4: gate ALLOW + cognição ambígua → HUMAN_CONFIRM ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow(),
    cognitiveResult: mockCognitiveAmbiguous(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.HUMAN_CONFIRM, "final_decision = HUMAN_CONFIRM");
  assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
  assert(result.execution_mode === EXECUTION_MODE.SUPERVISED, "execution_mode = SUPERVISED");
}

// =========================================================================
// TEST 5: gate WARN + cognição forte → CAUTION_READY
// =========================================================================
console.log("\n--- Test 5: gate WARN + cognição forte → CAUTION_READY ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateWarn(),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.CAUTION_READY, "final_decision = CAUTION_READY");
  assert(result.ok === true, "ok = true (CAUTION_READY is not blocking)");
  assert(result.execution_mode === EXECUTION_MODE.SUPERVISED, "execution_mode = SUPERVISED");
}

// =========================================================================
// TEST 6: gate WARN + cognição fraca → HUMAN_CONFIRM
// =========================================================================
console.log("\n--- Test 6: gate WARN + cognição fraca → HUMAN_CONFIRM ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateWarn(),
    cognitiveResult: mockCognitiveWeak(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.HUMAN_CONFIRM, "final_decision = HUMAN_CONFIRM");
  assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
  assert(result.execution_mode === EXECUTION_MODE.MANUAL, "execution_mode = MANUAL");
}

// =========================================================================
// TEST 7: sem contrato ativo → NO_CONTRACT
// =========================================================================
console.log("\n--- Test 7: sem contrato ativo → NO_CONTRACT ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateNoContract(),
    cognitiveResult: mockCognitiveWeak(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.NO_CONTRACT, "final_decision = NO_CONTRACT");
  assert(result.ok === false, "ok = false when NO_CONTRACT");
  assert(result.execution_mode === EXECUTION_MODE.UNAVAILABLE, "execution_mode = UNAVAILABLE");
  assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
}

// =========================================================================
// TEST 8: base fraca (low confidence) → não vira EXECUTE_READY
// =========================================================================
console.log("\n--- Test 8: base fraca → não vira EXECUTE_READY ---");
{
  const weakCognition = mockCognitiveClear({ confidence: 0.3, ambiguity_level: AMBIGUITY_LEVEL.LOW });
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow(),
    cognitiveResult: weakCognition,
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision !== FINAL_DECISION.EXECUTE_READY, "final_decision ≠ EXECUTE_READY");
  assert(result.final_decision === FINAL_DECISION.INSUFFICIENT_BASIS, "final_decision = INSUFFICIENT_BASIS");
  assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
}

// =========================================================================
// TEST 9: scope A e scope B isolados
// =========================================================================
console.log("\n--- Test 9: scope A e B isolados ---");
{
  const resultA = orchestrateContractAwareAction({
    gateResult: mockGateAllow({ scope: "scope_a" }),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "scope_a",
  });
  const resultB = orchestrateContractAwareAction({
    gateResult: mockGateBlock({ scope: "scope_b" }),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "scope_b",
  });
  assert(resultA.final_decision === FINAL_DECISION.EXECUTE_READY, "scope_a → EXECUTE_READY");
  assert(resultB.final_decision === FINAL_DECISION.BLOCK, "scope_b → BLOCK");
  assert(resultA.final_decision !== resultB.final_decision, "scopes produce different decisions");
}

// =========================================================================
// TEST 10: Shape canônico completo da saída
// =========================================================================
console.log("\n--- Test 10: Shape canônico completo ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow(),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  const requiredKeys = [
    "ok", "final_decision", "final_reason_code", "final_reason_text",
    "execution_mode", "requires_human_confirmation", "gate_decision",
    "cognitive_confidence", "cognitive_ambiguity", "recommended_next_step",
    "supporting_evidence", "notes",
  ];
  for (const key of requiredKeys) {
    assert(key in result, `shape has '${key}'`);
  }
  assert(typeof result.ok === "boolean", "ok is boolean");
  assert(typeof result.final_decision === "string", "final_decision is string");
  assert(typeof result.final_reason_code === "string", "final_reason_code is string");
  assert(typeof result.final_reason_text === "string", "final_reason_text is string");
  assert(typeof result.execution_mode === "string", "execution_mode is string");
  assert(typeof result.requires_human_confirmation === "boolean", "requires_human_confirmation is boolean");
  assert(Array.isArray(result.supporting_evidence), "supporting_evidence is array");
  assert(Array.isArray(result.notes), "notes is array");
}

// =========================================================================
// TEST 11: Determinismo: mesma entrada → mesma saída
// =========================================================================
console.log("\n--- Test 11: Determinismo ---");
{
  const gate = mockGateAllow();
  const cog = mockCognitiveClear();
  const r1 = orchestrateContractAwareAction({ gateResult: gate, cognitiveResult: cog, candidateAction, scope: "default" });
  const r2 = orchestrateContractAwareAction({ gateResult: gate, cognitiveResult: cog, candidateAction, scope: "default" });
  assert(r1.final_decision === r2.final_decision, "same final_decision");
  assert(r1.final_reason_code === r2.final_reason_code, "same final_reason_code");
  assert(r1.execution_mode === r2.execution_mode, "same execution_mode");
  assert(r1.requires_human_confirmation === r2.requires_human_confirmation, "same requires_human_confirmation");
}

// =========================================================================
// TEST 12: BLOCK com cognição alta NÃO sobrepõe gate
// =========================================================================
console.log("\n--- Test 12: BLOCK com cognição alta → gate soberano ---");
{
  const strongCognition = mockCognitiveClear({ confidence: 0.99, ambiguity_level: AMBIGUITY_LEVEL.LOW });
  const result = orchestrateContractAwareAction({
    gateResult: mockGateBlock(),
    cognitiveResult: strongCognition,
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.BLOCK, "BLOCK even with 0.99 confidence");
  assert(result.execution_mode === EXECUTION_MODE.BLOCKED, "execution_mode = BLOCKED");
  assert(result.cognitive_confidence === 0.99, "cognitive_confidence preserved in output");
}

// =========================================================================
// TEST 13: ALLOW com confidence baixa → INSUFFICIENT_BASIS
// =========================================================================
console.log("\n--- Test 13: ALLOW + low confidence → INSUFFICIENT_BASIS ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow(),
    cognitiveResult: mockCognitiveWeak({ ambiguity_level: AMBIGUITY_LEVEL.LOW }),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.INSUFFICIENT_BASIS, "final_decision = INSUFFICIENT_BASIS");
  assert(result.ok === true, "ok = true (not BLOCK/NO_CONTRACT)");
}

// =========================================================================
// TEST 14: WARN + cognição ambígua → HUMAN_CONFIRM
// =========================================================================
console.log("\n--- Test 14: WARN + cognição ambígua → HUMAN_CONFIRM ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateWarn(),
    cognitiveResult: mockCognitiveAmbiguous(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.HUMAN_CONFIRM, "final_decision = HUMAN_CONFIRM");
  assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
}

// =========================================================================
// TEST 15: gate null/missing → NO_CONTRACT
// =========================================================================
console.log("\n--- Test 15: gate null → NO_CONTRACT ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: null,
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.NO_CONTRACT, "final_decision = NO_CONTRACT");
  assert(result.ok === false, "ok = false");
  assert(result.gate_decision === null, "gate_decision = null");
}

// =========================================================================
// TEST 16: Notes consolidam gate + cognição + orchestrator
// =========================================================================
console.log("\n--- Test 16: Notes consolidadas ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow(),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  const hasGateNote = result.notes.some(n => n.startsWith("[gate]"));
  const hasCogNote = result.notes.some(n => n.startsWith("[cognitive]"));
  const hasOrchNote = result.notes.some(n => n.startsWith("[orchestrator]"));
  assert(hasGateNote, "notes include [gate] prefix");
  assert(hasCogNote, "notes include [cognitive] prefix");
  assert(hasOrchNote, "notes include [orchestrator] prefix");
}

// =========================================================================
// TEST 17: Supporting evidence inclui gate_pr3 e cognitive_pr5
// =========================================================================
console.log("\n--- Test 17: Supporting evidence sources ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow(),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  const gateEvidence = result.supporting_evidence.find(e => e.source === "gate_pr3");
  const cogEvidence = result.supporting_evidence.find(e => e.source === "cognitive_pr5");
  assert(!!gateEvidence, "supporting_evidence has gate_pr3");
  assert(!!cogEvidence, "supporting_evidence has cognitive_pr5");
  assert(gateEvidence.decision === DECISION.ALLOW, "gate evidence decision = ALLOW");
  assert(cogEvidence.confidence === 0.85, "cognitive evidence confidence = 0.85");
}

// =========================================================================
// TEST 18: PR1/PR2/PR3/PR5 imports sem regressão
// =========================================================================
console.log("\n--- Test 18: PR1/PR2/PR3/PR5 sem regressão ---");
assert(typeof evaluateAdherence === "function", "PR1: evaluateAdherence importável");
assert(typeof ADHERENCE_STATUS === "object" && ADHERENCE_STATUS.ADERENTE, "PR1: ADHERENCE_STATUS OK");
assert(typeof getActiveContractContext === "function", "PR2: getActiveContractContext importável");
assert(typeof resolveRelevantContractBlocks === "function", "PR2: resolveRelevantContractBlocks importável");
assert(typeof KV_ACTIVE_CONTRACT_KEY === "string", "PR2: KV_ACTIVE_CONTRACT_KEY OK");
assert(typeof evaluateContractAdherence === "function", "PR3: evaluateContractAdherence importável");
assert(typeof DECISION === "object" && DECISION.BLOCK === "BLOCK", "PR3: DECISION enum OK");
assert(typeof REASON_CODE === "object" && REASON_CODE.BLOCK_HARD_RULE, "PR3: REASON_CODE enum OK");
assert(typeof analyzeContractContextCognitively === "function", "PR5: analyzeContractContextCognitively importável");
assert(typeof AMBIGUITY_LEVEL === "object" && AMBIGUITY_LEVEL.LOW === "low", "PR5: AMBIGUITY_LEVEL OK");
assert(typeof CONFIDENCE_THRESHOLDS === "object" && CONFIDENCE_THRESHOLDS.HIGH === 0.8, "PR5: CONFIDENCE_THRESHOLDS OK");

// =========================================================================
// TEST 19: gate ALLOW + requires_human_approval=true + cognição clara → NÃO vira EXECUTE_READY
// =========================================================================
console.log("\n--- Test 19: gate ALLOW + requires_human_approval=true → não EXECUTE_READY ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow({ requires_human_approval: true }),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision !== FINAL_DECISION.EXECUTE_READY, "final_decision ≠ EXECUTE_READY");
  assert(result.final_decision === FINAL_DECISION.HUMAN_CONFIRM, "final_decision = HUMAN_CONFIRM");
  assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
  assert(result.execution_mode !== EXECUTION_MODE.AUTO, "execution_mode ≠ AUTO");
  assert(result.final_reason_code === "GATE_REQUIRES_HUMAN_APPROVAL", "final_reason_code = GATE_REQUIRES_HUMAN_APPROVAL");
}

// =========================================================================
// TEST 20: gate ALLOW + requires_human_approval=true → execution_mode não é AUTO
// =========================================================================
console.log("\n--- Test 20: gate ALLOW + requires_human_approval=true → execution_mode seguro ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow({ requires_human_approval: true }),
    cognitiveResult: mockCognitiveClear({ confidence: 0.99, ambiguity_level: AMBIGUITY_LEVEL.LOW }),
    candidateAction,
    scope: "default",
  });
  assert(result.execution_mode !== EXECUTION_MODE.AUTO, "execution_mode ≠ AUTO even with high confidence");
  assert(result.execution_mode === EXECUTION_MODE.SUPERVISED, "execution_mode = SUPERVISED");
  assert(result.ok === true, "ok = true (not BLOCK/NO_CONTRACT)");
}

// =========================================================================
// TEST 21: gate WARN + requires_human_approval=true + cognição clara → exige humano
// =========================================================================
console.log("\n--- Test 21: gate WARN + requires_human_approval=true + cognição clara → HUMAN_CONFIRM ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateWarn({ requires_human_approval: true }),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.HUMAN_CONFIRM, "final_decision = HUMAN_CONFIRM");
  assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
  assert(result.final_reason_code === "GATE_REQUIRES_HUMAN_APPROVAL", "final_reason_code = GATE_REQUIRES_HUMAN_APPROVAL");
  assert(result.execution_mode !== EXECUTION_MODE.AUTO, "execution_mode ≠ AUTO");
}

// =========================================================================
// TEST 22: gate BLOCK continua soberano quando requires_human_approval=true
// =========================================================================
console.log("\n--- Test 22: gate BLOCK + requires_human_approval=true → BLOCK soberano ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateBlock({ requires_human_approval: true }),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.BLOCK, "BLOCK ainda soberano");
  assert(result.execution_mode === EXECUTION_MODE.BLOCKED, "execution_mode = BLOCKED");
}

// =========================================================================
// TEST 23: fluxo EXECUTE_READY continua funcionando quando gate NÃO exige humano
// =========================================================================
console.log("\n--- Test 23: fluxo EXECUTE_READY válido sem requires_human_approval ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow({ requires_human_approval: false }),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  assert(result.final_decision === FINAL_DECISION.EXECUTE_READY, "final_decision = EXECUTE_READY (gate allows + no human approval required)");
  assert(result.execution_mode === EXECUTION_MODE.AUTO, "execution_mode = AUTO");
  assert(result.requires_human_confirmation === false, "requires_human_confirmation = false");
}

// =========================================================================
// TEST 24: shape/notas/supporting_evidence sem regressão no novo caminho
// =========================================================================
console.log("\n--- Test 24: shape completo preservado no caminho requires_human_approval ---");
{
  const result = orchestrateContractAwareAction({
    gateResult: mockGateAllow({ requires_human_approval: true }),
    cognitiveResult: mockCognitiveClear(),
    candidateAction,
    scope: "default",
  });
  const requiredKeys = [
    "ok", "final_decision", "final_reason_code", "final_reason_text",
    "execution_mode", "requires_human_confirmation", "gate_decision",
    "cognitive_confidence", "cognitive_ambiguity", "recommended_next_step",
    "supporting_evidence", "notes",
  ];
  for (const key of requiredKeys) {
    assert(key in result, `shape has '${key}'`);
  }
  const hasOrchNote = result.notes.some(n => n.includes("gate_requires_human_approval_sovereign"));
  assert(hasOrchNote, "notes include rule_applied = gate_requires_human_approval_sovereign");
  const gateEvidence = result.supporting_evidence.find(e => e.source === "gate_pr3");
  assert(!!gateEvidence, "supporting_evidence has gate_pr3");
  assert(gateEvidence.requires_human_approval === true, "gate evidence reflects requires_human_approval=true");
}

// =========================================================================
// SUMMARY
// =========================================================================
console.log(`\n========================================`);
console.log(`Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
