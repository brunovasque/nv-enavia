// ============================================================================
// 🧪 Smoke Tests — Contract Adherence Engine (PR3)
//
// Motor de aderência contratual pré-ação.
// Valida ALLOW/BLOCK/WARN deterministicamente contra contrato ativo (PR2).
//
// Run: node tests/contract-adherence-engine.smoke.test.js
//
// Tests:
//   1.  Enums íntegros (DECISION, REASON_CODE)
//   2.  Ação aderente → ALLOW
//   3.  Violação de hard rule → BLOCK
//   4.  Caso ambíguo → WARN
//   5.  Aprovação humana exigida → BLOCK + requires_human_approval
//   6.  Contrato ativo inexistente → WARN (fail seguro)
//   7.  Fase/ordem incompatível → WARN ou BLOCK
//   8.  Blocking point violado → BLOCK
//   9.  Shape canônico completo do resultado
//   10. Determinismo: mesma entrada → mesma saída
//   11. runContractAdherenceGate com contrato real (integração PR2)
//   12. Scope A e scope B isolados
//   13. Contrato sem blocos → WARN honesto
//   14. Ação candidata ausente → WARN
// ============================================================================

import {
  evaluateContractAdherence,
  runContractAdherenceGate,
  DECISION,
  REASON_CODE,
} from "../schema/contract-adherence-engine.js";

import {
  activateIngestedContract,
  getActiveContractContext,
} from "../schema/contract-active-state.js";

import {
  ingestLongContract,
} from "../schema/contract-ingestion.js";

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
// Mock KV store (same pattern as PR2 tests)
// ---------------------------------------------------------------------------
function createMockKV() {
  const store = {};
  return {
    async get(key) { return store[key] || null; },
    async put(key, value) { store[key] = value; },
    async list(opts) {
      const prefix = (opts && opts.prefix) || "";
      const keys = Object.keys(store)
        .filter(k => k.startsWith(prefix))
        .map(k => ({ name: k }));
      return { keys };
    },
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Fixtures — Contract context simulating PR2 output
// ---------------------------------------------------------------------------

// A realistic contract context as returned by getActiveContractContext
const contractContextFull = {
  ok: true,
  contract_id: "ctr_pr3_test_001",
  active_state: {
    contract_id: "ctr_pr3_test_001",
    current_phase_hint: "implementation",
    relevant_block_ids: ["blk_0001", "blk_0002"],
  },
  summary: {
    macro_objective: "Implementar sistema de gestão de contratos com validação e auditoria",
    detected_phases: ["planning", "implementation", "testing", "deploy"],
    hard_rules_count: 3,
    hard_rules_top: [
      "é proibido modificar dados de produção sem aprovação",
      "vedado executar deploy automático sem validação prévia",
      "obrigatório manter log de auditoria para todas as ações",
    ],
    acceptance_criteria_count: 2,
    acceptance_criteria_top: [
      "critério de aceite: sistema valida contratos antes de persistir",
      "definition of done: testes unitários cobrindo 80% do módulo",
    ],
    approval_points_count: 2,
    approval_points_top: [
      "aprovação humana para deploy em produção",
      "sign-off do gestor antes de release",
    ],
    blocking_points_count: 1,
    blocking_points_top: [
      "bloqueio: não promover sem testes de integração completos",
    ],
    deadlines_count: 0,
    deadlines_top: [],
    sections_count: 5,
    blocks_count: 10,
    confidence: null,
  },
  resolution_ctx: {
    contract_id: "ctr_pr3_test_001",
    relevant_block_ids: ["blk_0001", "blk_0002"],
    strategy: "phase",
  },
  ready_for_pr3: true,
};

// Context with empty/minimal contract
const contractContextEmpty = {
  ok: true,
  contract_id: "ctr_empty_001",
  active_state: {
    contract_id: "ctr_empty_001",
    current_phase_hint: null,
    relevant_block_ids: [],
  },
  summary: {
    macro_objective: null,
    detected_phases: null,
    hard_rules_count: 0,
    hard_rules_top: [],
    acceptance_criteria_count: 0,
    acceptance_criteria_top: [],
    approval_points_count: 0,
    approval_points_top: [],
    blocking_points_count: 0,
    blocking_points_top: [],
    deadlines_count: 0,
    deadlines_top: [],
    sections_count: 0,
    blocks_count: 0,
    confidence: null,
  },
  resolution_ctx: null,
  ready_for_pr3: true,
};

// ---------------------------------------------------------------------------
// Test 1: Enums íntegros
// ---------------------------------------------------------------------------
console.log("\nTest 1: Enums íntegros");

assert(DECISION.ALLOW === "ALLOW", "DECISION.ALLOW = 'ALLOW'");
assert(DECISION.BLOCK === "BLOCK", "DECISION.BLOCK = 'BLOCK'");
assert(DECISION.WARN  === "WARN",  "DECISION.WARN = 'WARN'");

assert(typeof REASON_CODE.ALLOW_ADHERENT       === "string", "REASON_CODE.ALLOW_ADHERENT exists");
assert(typeof REASON_CODE.BLOCK_HARD_RULE       === "string", "REASON_CODE.BLOCK_HARD_RULE exists");
assert(typeof REASON_CODE.BLOCK_BLOCKING_POINT  === "string", "REASON_CODE.BLOCK_BLOCKING_POINT exists");
assert(typeof REASON_CODE.BLOCK_HUMAN_APPROVAL  === "string", "REASON_CODE.BLOCK_HUMAN_APPROVAL exists");
assert(typeof REASON_CODE.BLOCK_PHASE_ORDER     === "string", "REASON_CODE.BLOCK_PHASE_ORDER exists");
assert(typeof REASON_CODE.WARN_PARTIAL_EVIDENCE === "string", "REASON_CODE.WARN_PARTIAL_EVIDENCE exists");
assert(typeof REASON_CODE.ERROR_NO_CONTRACT     === "string", "REASON_CODE.ERROR_NO_CONTRACT exists");

// ---------------------------------------------------------------------------
// Test 2: Ação aderente → ALLOW
// ---------------------------------------------------------------------------
console.log("\nTest 2: Ação aderente → ALLOW");

const resultAllow = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "Implementar validação de schema para contratos",
    phase: "implementation",
    task_id: "task_001",
    action_type: "modify",
    target: "schema/contract-validation.js",
  },
});

assert(resultAllow.decision === DECISION.ALLOW, "T2: decision = ALLOW");
assert(resultAllow.ok === true,                  "T2: ok = true");
assert(resultAllow.reason_code === REASON_CODE.ALLOW_ADHERENT, "T2: reason_code = ALLOW_ADHERENT");
assert(typeof resultAllow.reason_text === "string", "T2: reason_text is string");
assert(resultAllow.requires_human_approval === false, "T2: requires_human_approval = false");
assert(Array.isArray(resultAllow.violations), "T2: violations is array");
assert(resultAllow.contract_id === "ctr_pr3_test_001", "T2: contract_id preserved");

// ---------------------------------------------------------------------------
// Test 3: Violação de hard rule → BLOCK
// ---------------------------------------------------------------------------
console.log("\nTest 3: Violação de hard rule → BLOCK");

const resultHardBlock = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "modificar dados de produção diretamente sem aprovação",
    phase: "implementation",
    action_type: "execute",
    target: "database/production",
  },
});

assert(resultHardBlock.decision === DECISION.BLOCK, "T3: decision = BLOCK");
assert(resultHardBlock.ok === false, "T3: ok = false");
assert(resultHardBlock.reason_code === REASON_CODE.BLOCK_HARD_RULE, "T3: reason_code = BLOCK_HARD_RULE");
assert(resultHardBlock.violations.length > 0, "T3: violations not empty");
assert(resultHardBlock.violations.some(v => v.type === "hard_rule"), "T3: has hard_rule violation");
assert(resultHardBlock.matched_rules.length > 0, "T3: matched_rules not empty");

// ---------------------------------------------------------------------------
// Test 4: Caso ambíguo → WARN
// ---------------------------------------------------------------------------
console.log("\nTest 4: Caso ambíguo → WARN (partial evidence)");

// Context where there's weak overlap but no strong violation
const resultWarn = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "refatorar módulo auxiliar sem impacto contratual direto",
    phase: "implementation",
    action_type: "modify",
    target: "utils/helpers.js",
  },
});

// This should be ALLOW or WARN — never BLOCK for a benign action
assert(resultWarn.decision === DECISION.ALLOW || resultWarn.decision === DECISION.WARN,
  "T4: decision is ALLOW or WARN (not BLOCK for benign action)");
assert(resultWarn.ok === true || resultWarn.decision === DECISION.WARN,
  "T4: ok = true or WARN");

// ---------------------------------------------------------------------------
// Test 5: Aprovação humana exigida → BLOCK + requires_human_approval
// ---------------------------------------------------------------------------
console.log("\nTest 5: Aprovação humana exigida → BLOCK + requires_human_approval");

const resultApproval = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "deploy para produção — release v2.0",
    phase: "deploy",
    action_type: "deploy",
    target: "production",
  },
});

assert(resultApproval.decision === DECISION.BLOCK, "T5: decision = BLOCK");
assert(resultApproval.requires_human_approval === true, "T5: requires_human_approval = true");
assert(resultApproval.reason_code === REASON_CODE.BLOCK_HUMAN_APPROVAL ||
       resultApproval.reason_code === REASON_CODE.BLOCK_HARD_RULE,
  "T5: reason_code indicates approval or hard_rule");
assert(resultApproval.violations.some(v => v.type === "human_approval_required"),
  "T5: violations include human_approval_required");

// ---------------------------------------------------------------------------
// Test 6: Contrato ativo inexistente → WARN (fail seguro)
// ---------------------------------------------------------------------------
console.log("\nTest 6: Contrato ativo inexistente → fail seguro");

const resultNoContract = evaluateContractAdherence({
  scope: "default",
  contractContext: null,
  candidateAction: {
    intent: "qualquer ação",
    action_type: "execute",
  },
});

assert(resultNoContract.ok === false, "T6: ok = false");
assert(resultNoContract.decision === DECISION.WARN, "T6: decision = WARN (not BLOCK — fail safe)");
assert(resultNoContract.reason_code === REASON_CODE.ERROR_NO_CONTRACT, "T6: reason_code = ERROR_NO_CONTRACT");

// Also test with context not ready
const resultNotReady = evaluateContractAdherence({
  scope: "default",
  contractContext: { ok: true, ready_for_pr3: false },
  candidateAction: { intent: "test" },
});

assert(resultNotReady.decision === DECISION.WARN, "T6b: not ready → WARN");

// ---------------------------------------------------------------------------
// Test 7: Fase/ordem incompatível → WARN
// ---------------------------------------------------------------------------
console.log("\nTest 7: Fase/ordem incompatível → WARN");

const resultPhase = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "executar ação em fase inexistente",
    phase: "fase_que_nao_existe",
    action_type: "execute",
  },
});

// Phase not found should produce a violation or note
assert(resultPhase.decision === DECISION.WARN || resultPhase.decision === DECISION.BLOCK,
  "T7: unknown phase → WARN or BLOCK");
assert(resultPhase.violations.some(v => v.type === "phase_order") ||
       resultPhase.notes.some(n => n.includes("phase")),
  "T7: phase violation or note present");

// ---------------------------------------------------------------------------
// Test 8: Blocking point violado → BLOCK
// ---------------------------------------------------------------------------
console.log("\nTest 8: Blocking point violado → BLOCK");

const resultBlockingPoint = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "promover release sem testes de integração completos executados",
    phase: "deploy",
    action_type: "promote",
    target: "release",
  },
});

assert(resultBlockingPoint.decision === DECISION.BLOCK, "T8: decision = BLOCK");
assert(resultBlockingPoint.ok === false, "T8: ok = false");
assert(resultBlockingPoint.violations.length > 0, "T8: violations not empty");

// ---------------------------------------------------------------------------
// Test 9: Shape canônico completo do resultado
// ---------------------------------------------------------------------------
console.log("\nTest 9: Shape canônico completo do resultado");

const resultShape = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: { intent: "test shape" },
});

assert("ok"                     in resultShape, "T9: shape has ok");
assert("decision"               in resultShape, "T9: shape has decision");
assert("reason_code"            in resultShape, "T9: shape has reason_code");
assert("reason_text"            in resultShape, "T9: shape has reason_text");
assert("matched_rules"          in resultShape, "T9: shape has matched_rules");
assert("violations"             in resultShape, "T9: shape has violations");
assert("requires_human_approval" in resultShape, "T9: shape has requires_human_approval");
assert("notes"                  in resultShape, "T9: shape has notes");
assert("contract_id"            in resultShape, "T9: shape has contract_id");
assert("scope"                  in resultShape, "T9: shape has scope");
assert("evaluated_at"           in resultShape, "T9: shape has evaluated_at");
assert(Array.isArray(resultShape.matched_rules), "T9: matched_rules is array");
assert(Array.isArray(resultShape.violations),     "T9: violations is array");
assert(Array.isArray(resultShape.notes),          "T9: notes is array");
assert(typeof resultShape.requires_human_approval === "boolean", "T9: requires_human_approval is boolean");

// Serializable
const serialized = JSON.stringify(resultShape);
assert(typeof serialized === "string" && serialized.length > 0, "T9: result is JSON-serializable");

// ---------------------------------------------------------------------------
// Test 10: Determinismo
// ---------------------------------------------------------------------------
console.log("\nTest 10: Determinismo — mesma entrada → mesma saída");

const det1 = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "modificar dados de produção diretamente sem aprovação",
    action_type: "execute",
  },
});

const det2 = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "modificar dados de produção diretamente sem aprovação",
    action_type: "execute",
  },
});

assert(det1.decision    === det2.decision,    "T10: decision deterministic");
assert(det1.reason_code === det2.reason_code, "T10: reason_code deterministic");
assert(det1.violations.length === det2.violations.length, "T10: violations count deterministic");
assert(det1.requires_human_approval === det2.requires_human_approval, "T10: requires_human_approval deterministic");

// ---------------------------------------------------------------------------
// Test 11: runContractAdherenceGate com contrato real (integração PR2)
// ---------------------------------------------------------------------------
console.log("\nTest 11: runContractAdherenceGate com contrato real (integração PR2)");

async function testIntegration() {
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  // Ingest a real contract (PR1)
  const contractText = `
# CONTRATO DE DESENVOLVIMENTO

## CLÁUSULA 1 — OBJETO
O objeto deste contrato é o desenvolvimento de um sistema de gestão.

## CLÁUSULA 2 — OBRIGAÇÕES
É proibido modificar dados de produção sem autorização prévia.
É obrigatório manter log de auditoria.

## CLÁUSULA 3 — PRAZO
Prazo de 30 dias para entrega da primeira fase.

## CLÁUSULA 4 — APROVAÇÃO
Aprovação humana para deploy em produção é obrigatória.
Sign-off do gestor antes de qualquer release.

## CLÁUSULA 5 — BLOQUEIO
Bloqueio: não promover sem testes de integração.
Antes de qualquer deploy, todos os testes devem passar.
  `.trim();

  // Ingest via PR1
  const ingestionResult = await ingestLongContract(env, "ctr_integration_001", contractText);
  assert(ingestionResult.ok === true, "T11: ingestion ok");

  // Activate via PR2
  const activateResult = await activateIngestedContract(env, "ctr_integration_001", {
    phase_hint: "implementation",
    operator: "test",
  });
  assert(activateResult.ok === true, "T11: activation ok");

  // Run the gate — adherent action
  const gateAllow = await runContractAdherenceGate(env, "default", {
    intent: "Implementar validação de contratos",
    phase: "implementation",
    action_type: "modify",
    target: "schema/validation.js",
  });

  assert(gateAllow.decision === DECISION.ALLOW || gateAllow.decision === DECISION.WARN,
    "T11: adherent action → ALLOW or WARN");
  assert(gateAllow.contract_id === "ctr_integration_001",
    "T11: contract_id from real contract");

  // Run the gate — deploy without approval → should flag human approval
  const gateDeploy = await runContractAdherenceGate(env, "default", {
    intent: "deploy para produção sem aprovação",
    phase: "deploy",
    action_type: "deploy",
    target: "production",
  });

  assert(gateDeploy.requires_human_approval === true,
    "T11: deploy → requires_human_approval = true");
  assert(gateDeploy.decision === DECISION.BLOCK,
    "T11: deploy without approval → BLOCK");

  // Run the gate — no active contract for a different scope
  const gateNoContract = await runContractAdherenceGate(env, "nonexistent_scope", {
    intent: "qualquer coisa",
  });

  assert(gateNoContract.decision === DECISION.WARN,
    "T11: no contract scope → WARN");
  assert(gateNoContract.reason_code === REASON_CODE.ERROR_NO_CONTRACT,
    "T11: reason = ERROR_NO_CONTRACT");
}

// ---------------------------------------------------------------------------
// Test 12: Scope A e scope B isolados
// ---------------------------------------------------------------------------
async function testScopeIsolation() {
  console.log("\nTest 12: Scope A e scope B isolados");

  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const contractText = `
# CONTRATO A
## Escopo
Proibido mexer em produção sem aprovação humana.
Aprovação do gestor obrigatória para release.
  `.trim();

  await ingestLongContract(env, "ctr_scope_A", contractText);
  await activateIngestedContract(env, "ctr_scope_A", {
    scope: "scopeA",
    phase_hint: "implementation",
    operator: "alice",
  });

  await ingestLongContract(env, "ctr_scope_B", "# CONTRATO B\nSimples contrato sem restrições.");
  await activateIngestedContract(env, "ctr_scope_B", {
    scope: "scopeB",
    phase_hint: "planning",
    operator: "bob",
  });

  // Scope A — has approval points, deploy should BLOCK
  const gateA = await runContractAdherenceGate(env, "scopeA", {
    intent: "deploy para produção",
    action_type: "deploy",
    target: "production",
  });

  // Scope B — minimal contract, should not block
  const gateB = await runContractAdherenceGate(env, "scopeB", {
    intent: "deploy para produção",
    action_type: "deploy",
    target: "production",
  });

  assert(gateA.contract_id === "ctr_scope_A", "T12: scopeA uses ctr_scope_A");
  assert(gateB.contract_id === "ctr_scope_B", "T12: scopeB uses ctr_scope_B");
  assert(gateA.contract_id !== gateB.contract_id, "T12: scopes are isolated");

  // Scope A has more restrictions
  assert(gateA.requires_human_approval === true || gateA.decision === DECISION.BLOCK,
    "T12: scopeA has restrictions (approval or block)");
}

// ---------------------------------------------------------------------------
// Test 13: Contrato sem blocos → WARN honesto
// ---------------------------------------------------------------------------
console.log("\nTest 13: Contrato sem blocos → WARN honesto");

const resultEmptyContract = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextEmpty,
  candidateAction: {
    intent: "executar alguma ação genérica",
    action_type: "execute",
  },
});

assert(resultEmptyContract.decision === DECISION.WARN || resultEmptyContract.decision === DECISION.ALLOW,
  "T13: empty contract → WARN or ALLOW (never BLOCK without evidence)");

// ---------------------------------------------------------------------------
// Test 14: Ação candidata ausente → WARN
// ---------------------------------------------------------------------------
console.log("\nTest 14: Ação candidata ausente → WARN");

const resultNoAction = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: null,
});

assert(resultNoAction.ok === false, "T14: ok = false");
assert(resultNoAction.decision === DECISION.WARN, "T14: decision = WARN");
assert(resultNoAction.reason_code === REASON_CODE.WARN_PARTIAL_EVIDENCE, "T14: reason = WARN_PARTIAL_EVIDENCE");

// ---------------------------------------------------------------------------
// Run async tests
// ---------------------------------------------------------------------------
async function runAllTests() {
  await testIntegration();
  await testScopeIsolation();

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
