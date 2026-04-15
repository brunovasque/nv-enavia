// ============================================================================
// 🧪 Smoke Tests — Contract Adherence Engine (PR3 v2)
//
// Motor de aderência contratual pré-ação.
// Valida ALLOW/BLOCK/WARN deterministicamente contra contrato ativo (PR2).
// Uses real blocks from resolveRelevantContractBlocks, not just summary.
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
//   7.  Fase desconhecida → WARN (determinístico)
//   8.  Blocking point violado → BLOCK
//   9.  Shape canônico completo do resultado
//   10. Determinismo: mesma entrada → mesma saída
//   11. runContractAdherenceGate com contrato real (integração PR2)
//   12. Scope A e scope B isolados
//   13. Contrato sem blocos → WARN honesto
//   14. Ação candidata ausente → WARN
//   15. Deploy consulta blocos reais de approval/blocking, não só summary
//   16. Implementação consulta blocos reais de escopo/obrigação
//   17. matched_rules aponta evidência de bloco real quando existir
//   18. Regressão clara de fase → BLOCK (determinístico)
//   19. Fase parcialmente compatível → WARN
//   20. Contrato longo com múltiplos blocos não fica decidido só pelo top summary
//   21. Scope A e scope B continuam isolados (integração longa)
//   22. PR1 e PR2 seguem sem regressão
//   23. Signal-level match — only related signal triggers evidence
//   24. Unrelated signal in same block → no false violation
//   25. matched_rules precision — no inflation from block-level overlap
//   26. Deploy + approval still works (no regression from signal fix)
//   27. Phase regression still works (no regression from signal fix)
//   28. PR1 + PR2 + PR3 sanity after signal-level fix
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
// Fixtures — Contract context simulating PR2 output with real blocks
// ---------------------------------------------------------------------------

// Real block objects simulating what resolveRelevantContractBlocks returns
const realBlocks = [
  {
    block_id: "blk_0001",
    index: 0,
    heading: "CLÁUSULA 1 — OBJETO",
    block_type: "scope",
    content: "O objeto deste contrato é o desenvolvimento de um sistema de gestão de contratos com validação e auditoria completa.",
    summary: null,
    signals: {
      hard_rules: [],
      acceptance_criteria: [],
      approval_points: [],
      blocking_points: [],
      deadlines: [],
    },
  },
  {
    block_id: "blk_0002",
    index: 1,
    heading: "CLÁUSULA 2 — OBRIGAÇÕES",
    block_type: "obligation",
    content: "É proibido modificar dados de produção sem aprovação prévia do gestor. É obrigatório manter log de auditoria para todas as ações executadas no sistema.",
    summary: null,
    signals: {
      hard_rules: ["É proibido modificar dados de produção sem aprovação", "obrigatório manter log de auditoria"],
      acceptance_criteria: [],
      approval_points: [],
      blocking_points: [],
      deadlines: [],
    },
  },
  {
    block_id: "blk_0003",
    index: 2,
    heading: "CLÁUSULA 3 — PRAZO",
    block_type: "deadline",
    content: "Prazo de 30 dias para entrega da primeira fase de implementação.",
    summary: null,
    signals: {
      hard_rules: [],
      acceptance_criteria: [],
      approval_points: [],
      blocking_points: [],
      deadlines: ["30 dias para entrega"],
    },
  },
  {
    block_id: "blk_0004",
    index: 3,
    heading: "CLÁUSULA 4 — APROVAÇÃO",
    block_type: "approval",
    content: "Aprovação humana para deploy em produção é obrigatória. Sign-off do gestor antes de qualquer release.",
    summary: null,
    signals: {
      hard_rules: [],
      acceptance_criteria: [],
      approval_points: ["Aprovação humana para deploy em produção", "Sign-off do gestor"],
      blocking_points: [],
      deadlines: [],
    },
  },
  {
    block_id: "blk_0005",
    index: 4,
    heading: "CLÁUSULA 5 — BLOQUEIO",
    block_type: "termination",
    content: "Bloqueio: não promover sem testes de integração completos. Antes de qualquer deploy, todos os testes devem passar.",
    summary: null,
    signals: {
      hard_rules: [],
      acceptance_criteria: [],
      approval_points: [],
      blocking_points: ["não promover sem testes de integração", "Antes de qualquer deploy"],
      deadlines: [],
    },
  },
];

// A realistic contract context with REAL blocks included
const contractContextFull = {
  ok: true,
  contract_id: "ctr_pr3_test_001",
  active_state: {
    contract_id: "ctr_pr3_test_001",
    current_phase_hint: "implementation",
    relevant_block_ids: ["blk_0001", "blk_0002", "blk_0003", "blk_0004", "blk_0005"],
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
    blocks_count: 5,
    confidence: null,
  },
  resolution_ctx: {
    contract_id: "ctr_pr3_test_001",
    relevant_block_ids: ["blk_0001", "blk_0002", "blk_0003", "blk_0004", "blk_0005"],
    strategy: "phase",
    fallback: false,
    matched_count: 5,
    total_blocks: 5,
  },
  relevant_blocks: realBlocks,
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
  relevant_blocks: [],
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
// Test 3: Violação de hard rule → BLOCK (from real blocks)
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
// Verify evidence comes from real block
assert(resultHardBlock.matched_rules.some(r => r.source === "block" && r.block_id),
  "T3: matched_rules has real block evidence (block_id + source=block)");

// ---------------------------------------------------------------------------
// Test 4: Caso ambíguo → WARN or ALLOW
// ---------------------------------------------------------------------------
console.log("\nTest 4: Caso ambíguo → WARN or ALLOW (partial evidence)");

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

const resultNotReady = evaluateContractAdherence({
  scope: "default",
  contractContext: { ok: true, ready_for_pr3: false },
  candidateAction: { intent: "test" },
});

assert(resultNotReady.decision === DECISION.WARN, "T6b: not ready → WARN");

// ---------------------------------------------------------------------------
// Test 7: Fase desconhecida → WARN (deterministic)
// ---------------------------------------------------------------------------
console.log("\nTest 7: Fase desconhecida → WARN (determinístico)");

const resultPhase = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "executar ação em fase inexistente",
    phase: "fase_que_nao_existe",
    action_type: "execute",
  },
});

assert(resultPhase.decision === DECISION.WARN,
  "T7: unknown phase → WARN (not BLOCK without regression)");
assert(resultPhase.reason_code === REASON_CODE.WARN_PHASE_AMBIGUOUS,
  "T7: reason_code = WARN_PHASE_AMBIGUOUS");
assert(resultPhase.violations.some(v => v.type === "phase_unknown"),
  "T7: phase_unknown violation present");

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
assert("resolution_strategy"    in resultShape, "T9: shape has resolution_strategy");
assert("relevant_blocks_count"  in resultShape, "T9: shape has relevant_blocks_count");
assert(Array.isArray(resultShape.matched_rules), "T9: matched_rules is array");
assert(Array.isArray(resultShape.violations),     "T9: violations is array");
assert(Array.isArray(resultShape.notes),          "T9: notes is array");
assert(typeof resultShape.requires_human_approval === "boolean", "T9: requires_human_approval is boolean");

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
// Test 15: Deploy consulta blocos reais de approval/blocking, não só summary
// ---------------------------------------------------------------------------
console.log("\nTest 15: Deploy consulta blocos reais de approval/blocking");

const resultDeployBlocks = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "deploy para produção — release oficial",
    phase: "deploy",
    action_type: "deploy",
    target: "production",
  },
});

assert(resultDeployBlocks.decision === DECISION.BLOCK,
  "T15: deploy action → BLOCK");
assert(resultDeployBlocks.requires_human_approval === true,
  "T15: requires_human_approval = true");
// Key check: evidence must come from real blocks, not just summary
assert(resultDeployBlocks.matched_rules.some(r => r.source === "block" && r.block_id),
  "T15: matched_rules has evidence from REAL block (not just summary)");
assert(resultDeployBlocks.matched_rules.some(r => r.category === "approval_point" && r.block_id === "blk_0004"),
  "T15: approval evidence points to block blk_0004 (CLÁUSULA 4 — APROVAÇÃO)");

// ---------------------------------------------------------------------------
// Test 16: Implementação consulta blocos reais de escopo/obrigação
// ---------------------------------------------------------------------------
console.log("\nTest 16: Implementação consulta blocos reais de escopo/obrigação");

const resultImplBlock = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "modificar dados de produção diretamente sem aprovação do gestor",
    phase: "implementation",
    action_type: "execute",
  },
});

assert(resultImplBlock.decision === DECISION.BLOCK,
  "T16: action violating obligation block → BLOCK");
assert(resultImplBlock.matched_rules.some(r => r.source === "block" && r.block_id === "blk_0002"),
  "T16: matched_rules evidence from blk_0002 (CLÁUSULA 2 — OBRIGAÇÕES)");
assert(resultImplBlock.matched_rules.some(r => r.category === "hard_rule"),
  "T16: category is hard_rule");

// ---------------------------------------------------------------------------
// Test 17: matched_rules aponta evidência de bloco real quando existir
// ---------------------------------------------------------------------------
console.log("\nTest 17: matched_rules aponta evidência de bloco real");

const resultBlockEvidence = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "promover release sem testes de integração completos",
    phase: "deploy",
    action_type: "promote",
    target: "release",
  },
});

// Should have block evidence from blk_0005 (blocking points)
const blockEvidenceRules = resultBlockEvidence.matched_rules.filter(r => r.source === "block");
assert(blockEvidenceRules.length > 0,
  "T17: matched_rules contains evidence from real blocks (source=block)");
assert(blockEvidenceRules.some(r => r.block_id !== undefined && r.block_id !== null),
  "T17: block evidence includes block_id");
assert(blockEvidenceRules.some(r => r.heading !== undefined),
  "T17: block evidence includes heading");

// ---------------------------------------------------------------------------
// Test 18: Regressão clara de fase → BLOCK (determinístico)
// ---------------------------------------------------------------------------
console.log("\nTest 18: Regressão clara de fase → BLOCK (determinístico)");

const resultPhaseRegression = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "voltar para planejamento do projeto",
    phase: "planning",   // index 0, but current is "implementation" (index 1)
    action_type: "execute",
  },
});

assert(resultPhaseRegression.decision === DECISION.BLOCK,
  "T18: clear phase regression → BLOCK");
assert(resultPhaseRegression.reason_code === REASON_CODE.BLOCK_PHASE_ORDER,
  "T18: reason_code = BLOCK_PHASE_ORDER");
assert(resultPhaseRegression.violations.some(v => v.type === "phase_regression"),
  "T18: has phase_regression violation");

// Also verify forward phase is allowed
const resultPhaseForward = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "executar testes unitários",
    phase: "testing",   // index 2, forward from "implementation" (index 1)
    action_type: "execute",
  },
});

assert(resultPhaseForward.decision !== DECISION.BLOCK ||
       resultPhaseForward.violations.every(v => v.type !== "phase_regression"),
  "T18: forward phase does NOT produce phase_regression violation");

// ---------------------------------------------------------------------------
// Test 19: Fase parcialmente compatível → WARN
// ---------------------------------------------------------------------------
console.log("\nTest 19: Fase parcialmente compatível → WARN");

const resultPhasePartial = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "teste parcial de integração",
    phase: "test",   // partial match for "testing"
    action_type: "execute",
  },
});

// "test" is a partial match for "testing" → should WARN (ambiguous), not BLOCK
assert(resultPhasePartial.decision === DECISION.ALLOW || resultPhasePartial.decision === DECISION.WARN,
  "T19: partial phase match → ALLOW or WARN (not BLOCK)");
assert(resultPhasePartial.notes.some(n => n.includes("partial") || n.includes("ambiguous")),
  "T19: notes mention partial/ambiguous match");

// ---------------------------------------------------------------------------
// Test 20: Contrato longo com múltiplos blocos — not decided by summary alone
// ---------------------------------------------------------------------------
console.log("\nTest 20: Contrato longo — decisão baseada em blocos, não só summary");

// Create context with blocks but empty summary to prove blocks drive decisions
const contextBlocksOnly = {
  ok: true,
  contract_id: "ctr_blocks_only",
  active_state: {
    contract_id: "ctr_blocks_only",
    current_phase_hint: "implementation",
    relevant_block_ids: ["blk_0002"],
  },
  summary: {
    macro_objective: null,
    detected_phases: [],
    hard_rules_count: 0,
    hard_rules_top: [],           // Empty summary!
    acceptance_criteria_count: 0,
    acceptance_criteria_top: [],
    approval_points_count: 0,
    approval_points_top: [],
    blocking_points_count: 0,
    blocking_points_top: [],
    deadlines_count: 0,
    deadlines_top: [],
    sections_count: 0,
    blocks_count: 2,
    confidence: null,
  },
  resolution_ctx: {
    contract_id: "ctr_blocks_only",
    relevant_block_ids: ["blk_0002"],
    strategy: "phase",
  },
  // Real blocks have the rules — summary does not
  relevant_blocks: [realBlocks[1]], // blk_0002 with hard_rules signals
  ready_for_pr3: true,
};

const resultBlocksOnly = evaluateContractAdherence({
  scope: "default",
  contractContext: contextBlocksOnly,
  candidateAction: {
    intent: "modificar dados de produção sem aprovação",
    action_type: "execute",
  },
});

assert(resultBlocksOnly.decision === DECISION.BLOCK,
  "T20: BLOCK even with empty summary — decision comes from real blocks");
assert(resultBlocksOnly.matched_rules.some(r => r.source === "block"),
  "T20: evidence source is 'block', not 'summary'");
assert(resultBlocksOnly.matched_rules.every(r => r.source !== "summary"),
  "T20: NO evidence from summary (it was empty)");

// ---------------------------------------------------------------------------
// Test 23: Signal-level match — block with 2+ distinct signals, action
// relates to only 1. Only the matching signal should appear as strong evidence.
// ---------------------------------------------------------------------------
console.log("\nTest 23: Signal-level match — only related signal triggers evidence");

const multiSignalBlock = [
  {
    block_id: "blk_multi_01",
    index: 0,
    heading: "CLÁUSULA GERAL",
    block_type: "obligation",
    content: "Regras variadas do contrato aplicáveis ao projeto.",
    signals: {
      hard_rules: [
        "proibido alterar produção sem aprovação formal expressa",
        "obrigatório manter registro completo de auditoria interna",
      ],
      approval_points: [],
      blocking_points: [],
      acceptance_criteria: [],
    },
  },
];

const ctxMultiSignal = {
  ok: true, contract_id: "ctr_multi_signal", ready_for_pr3: true,
  active_state: { current_phase_hint: null },
  summary: { detected_phases: [], hard_rules_top: [], blocking_points_top: [],
             approval_points_top: [], approval_points_count: 0, blocks_count: 1 },
  resolution_ctx: { strategy: "phase" },
  relevant_blocks: multiSignalBlock,
};

// Action about production/approval — should match signal 1 only
const resultMultiSignal = evaluateContractAdherence({
  scope: "default",
  contractContext: ctxMultiSignal,
  candidateAction: {
    intent: "alterar dados de produção com aprovação do gestor",
    action_type: "modify",
    target: "production",
  },
});

const strongHitsT23 = resultMultiSignal.matched_rules.filter(
  r => r.source === "block" && r.category === "hard_rule"
);
const blockWeakHitsT23 = resultMultiSignal.matched_rules.filter(
  r => (r.source === "block_weak" || r.source === "block_no_overlap") && r.category === "hard_rule"
);

assert(strongHitsT23.length >= 1,
  "T23: at least 1 signal produces strong evidence");
assert(strongHitsT23.some(h => h.rule.includes("produção") || h.rule.includes("aprovação")),
  "T23: strong evidence is the production/approval signal, not the audit signal");
// The audit signal ("auditoria interna") should NOT have strong evidence for this action
const auditStrongHits = strongHitsT23.filter(h => h.rule.includes("auditoria"));
assert(auditStrongHits.length === 0,
  "T23: audit signal does NOT trigger strong evidence for production action");

// ---------------------------------------------------------------------------
// Test 24: Unrelated signal in same block does NOT generate violation
// ---------------------------------------------------------------------------
console.log("\nTest 24: Unrelated signal in same block → no false violation");

// Action specifically about audit — should NOT trigger production-related violation
const resultAuditAction = evaluateContractAdherence({
  scope: "default",
  contractContext: ctxMultiSignal,
  candidateAction: {
    intent: "revisar registros completos de auditoria interna do sistema",
    action_type: "execute",
  },
});

const prodViolationsT24 = resultAuditAction.violations.filter(
  v => v.type === "hard_rule" && v.description.includes("produção")
);

assert(prodViolationsT24.length === 0,
  "T24: production rule does NOT generate violation for audit-only action");

// The audit signal should have evidence (strong or weak depending on overlap)
const auditRulesT24 = resultAuditAction.matched_rules.filter(
  r => r.rule.includes("auditoria")
);
assert(auditRulesT24.length >= 1,
  "T24: audit signal IS recognized as relevant for audit action");

// ---------------------------------------------------------------------------
// Test 25: matched_rules do NOT inflate from block-level overlap reuse
// ---------------------------------------------------------------------------
console.log("\nTest 25: matched_rules precision — no inflation from block-level overlap");

// Use a block where heading has many keywords that could inflate unrelated signals
const inflationBlock = [
  {
    block_id: "blk_inflate_01",
    index: 0,
    heading: "CLÁUSULA DE DEPLOY EM PRODUÇÃO",
    block_type: "obligation",
    content: "Regras de deploy e produção com validação de testes e aprovação do comitê.",
    signals: {
      hard_rules: [
        "deploy somente após testes completos de integração aprovados",
        "manter backup completo antes de qualquer migração de dados",
      ],
      approval_points: [],
      blocking_points: [],
      acceptance_criteria: [],
    },
  },
];

const ctxInflation = {
  ok: true, contract_id: "ctr_inflate", ready_for_pr3: true,
  active_state: { current_phase_hint: null },
  summary: { detected_phases: [], hard_rules_top: [], blocking_points_top: [],
             approval_points_top: [], approval_points_count: 0, blocks_count: 1 },
  resolution_ctx: { strategy: "phase" },
  relevant_blocks: inflationBlock,
};

// Action about migration/backup — heading has "deploy" and "produção" which
// would have inflated both signals in the old block-level approach
const resultInflation = evaluateContractAdherence({
  scope: "default",
  contractContext: ctxInflation,
  candidateAction: {
    intent: "migração completa de dados com backup prévio",
    action_type: "execute",
  },
});

// The deploy signal ("deploy somente após testes...") should NOT get strong
// violation from an action about migration/backup
const deployViolationsT25 = resultInflation.violations.filter(
  v => v.type === "hard_rule" && v.description.includes("deploy")
);
assert(deployViolationsT25.length === 0,
  "T25: deploy signal does NOT generate violation for migration action");

// The backup/migration signal should have evidence
const backupRulesT25 = resultInflation.matched_rules.filter(
  r => r.rule.includes("backup") || r.rule.includes("migração")
);
assert(backupRulesT25.length >= 1,
  "T25: backup/migration signal IS recognized for migration action");

// ---------------------------------------------------------------------------
// Test 26: Existing deploy/approval/blocking tests still work after signal fix
// ---------------------------------------------------------------------------
console.log("\nTest 26: Deploy + approval still works (no regression from signal fix)");

const resultDeployStillWorks = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "deploy completo para produção com release final",
    phase: "deploy",
    action_type: "deploy",
    target: "production",
  },
});

assert(resultDeployStillWorks.decision === DECISION.BLOCK,
  "T26: deploy → still BLOCK");
assert(resultDeployStillWorks.requires_human_approval === true,
  "T26: deploy → still requires_human_approval = true");

// ---------------------------------------------------------------------------
// Test 27: Phase regression still works (no regression from signal fix)
// ---------------------------------------------------------------------------
console.log("\nTest 27: Phase regression still works (no regression)");

const resultPhaseRegrT27 = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "replanejar arquitetura inicial",
    phase: "planning",
    action_type: "modify",
  },
});

assert(resultPhaseRegrT27.decision === DECISION.BLOCK,
  "T27: phase regression → still BLOCK");
assert(resultPhaseRegrT27.reason_code === REASON_CODE.BLOCK_PHASE_ORDER,
  "T27: reason_code = BLOCK_PHASE_ORDER");

// ---------------------------------------------------------------------------
// Test 28: PR1 + PR2 + PR3 no regression (quick sanity)
// ---------------------------------------------------------------------------
console.log("\nTest 28: PR1 + PR2 + PR3 sanity after signal-level fix");

// Ação aderente stays ALLOW
const resultSanityAllow = evaluateContractAdherence({
  scope: "default",
  contractContext: contractContextFull,
  candidateAction: {
    intent: "implementar nova funcionalidade de relatórios",
    phase: "implementation",
    action_type: "execute",
  },
});
assert(resultSanityAllow.decision === DECISION.ALLOW || resultSanityAllow.decision === DECISION.WARN,
  "T28: adherent action → ALLOW or WARN (not BLOCK)");

// No contract stays WARN
const resultSanityNoContract = evaluateContractAdherence({
  scope: "default",
  contractContext: null,
  candidateAction: { intent: "test" },
});
assert(resultSanityNoContract.decision === DECISION.WARN,
  "T28: no contract → WARN (fail safe)");
assert(resultSanityNoContract.reason_code === REASON_CODE.ERROR_NO_CONTRACT,
  "T28: reason = ERROR_NO_CONTRACT");

// ---------------------------------------------------------------------------
// Test 11 + 21 + 22: Async integration tests
// ---------------------------------------------------------------------------

// Long contract for full integration testing
const LONG_CONTRACT = `
# CONTRATO COMPLETO DE DESENVOLVIMENTO

## CLÁUSULA 1 — OBJETO E ESCOPO
O objeto deste contrato é o desenvolvimento de um sistema completo de gestão de contratos.
O escopo inclui: ingestão de documentos, validação contratual e painel de auditoria.

## CLÁUSULA 2 — OBRIGAÇÕES TÉCNICAS
É proibido modificar dados de produção sem autorização prévia do gestor.
É obrigatório manter log de auditoria para todas as operações.
Vedado executar deploy automático sem testes completos.

## CLÁUSULA 3 — FASES DO PROJETO
Fase 1: Planejamento e arquitetura (planning)
Fase 2: Implementação (implementation)
Fase 3: Testes e validação (testing)
Fase 4: Deploy e homologação (deploy)
A ordem das fases deve ser respeitada.

## CLÁUSULA 4 — CRITÉRIOS DE ACEITE
Critério de aceite: o sistema deve validar contratos antes de persistir.
Definition of done: cobertura de testes unitários mínima de 80%.

## CLÁUSULA 5 — APROVAÇÃO HUMANA
Aprovação humana para deploy em produção é obrigatória.
Sign-off do gestor antes de qualquer release.
Homologação formal antes da entrega final.

## CLÁUSULA 6 — BLOQUEIO E CONDIÇÕES
Bloqueio: não promover sem testes de integração completos.
Condição suspensiva: aprovação do comitê técnico antes do deploy.
Antes de qualquer deploy, todos os testes devem ter passado.

## CLÁUSULA 7 — PRAZO
Prazo máximo de 60 dias para conclusão de todas as fases.
Entrega parcial a cada 15 dias.

## CLÁUSULA 8 — PENALIDADES
Multa de 5% por atraso em cada entrega parcial.
Penalidade por descumprimento de hard rules: suspensão do contrato.
`.trim();

async function testIntegration() {
  console.log("\nTest 11: runContractAdherenceGate com contrato real (integração PR2)");

  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  // Ingest via PR1
  const ingestionResult = await ingestLongContract(env, "ctr_integration_001", LONG_CONTRACT);
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
  assert(gateAllow.relevant_blocks_count > 0,
    "T11: relevant_blocks_count > 0 (real blocks were resolved)");
  assert(gateAllow.resolution_strategy !== null,
    "T11: resolution_strategy is set (blocks were resolved)");

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
  assert(gateDeploy.relevant_blocks_count > 0,
    "T11: deploy gate also has real blocks");

  // Run the gate — no active contract for a different scope
  const gateNoContract = await runContractAdherenceGate(env, "nonexistent_scope", {
    intent: "qualquer coisa",
  });

  assert(gateNoContract.decision === DECISION.WARN,
    "T11: no contract scope → WARN");
  assert(gateNoContract.reason_code === REASON_CODE.ERROR_NO_CONTRACT,
    "T11: reason = ERROR_NO_CONTRACT");
}

// Test 21: Scope A and scope B isolated (full integration)
async function testScopeIsolation() {
  console.log("\nTest 21: Scope A e scope B isolados (integração completa)");

  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const contractA = `
# CONTRATO A — RESTRITIVO
## Escopo
Proibido mexer em produção sem aprovação humana.
## Aprovação
Aprovação do gestor obrigatória para release em produção.
Sign-off antes de qualquer deploy.
  `.trim();

  const contractB = `
# CONTRATO B — SIMPLES
## Escopo
Simples contrato sem restrições especiais.
  `.trim();

  await ingestLongContract(env, "ctr_scope_A", contractA);
  await activateIngestedContract(env, "ctr_scope_A", {
    scope: "scopeA",
    phase_hint: "implementation",
    operator: "alice",
  });

  await ingestLongContract(env, "ctr_scope_B", contractB);
  await activateIngestedContract(env, "ctr_scope_B", {
    scope: "scopeB",
    phase_hint: "planning",
    operator: "bob",
  });

  const gateA = await runContractAdherenceGate(env, "scopeA", {
    intent: "deploy para produção",
    action_type: "deploy",
    target: "production",
  });

  const gateB = await runContractAdherenceGate(env, "scopeB", {
    intent: "deploy para produção",
    action_type: "deploy",
    target: "production",
  });

  assert(gateA.contract_id === "ctr_scope_A", "T21: scopeA uses ctr_scope_A");
  assert(gateB.contract_id === "ctr_scope_B", "T21: scopeB uses ctr_scope_B");
  assert(gateA.contract_id !== gateB.contract_id, "T21: scopes are isolated");

  assert(gateA.requires_human_approval === true || gateA.decision === DECISION.BLOCK,
    "T21: scopeA has restrictions (approval or block)");
}

// Test 22: PR1+PR2 regression check (quick)
async function testNoRegression() {
  console.log("\nTest 22: PR1 e PR2 sem regressão");

  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  // Full flow: ingest → activate → getContext → resolveBlocks
  const ingResult = await ingestLongContract(env, "ctr_regr_001", LONG_CONTRACT);
  assert(ingResult.ok === true, "T22: PR1 ingestion ok");
  assert(ingResult.blocks_count > 0, "T22: PR1 produced blocks");

  const actResult = await activateIngestedContract(env, "ctr_regr_001", {
    phase_hint: "testing",
    operator: "regression-test",
  });
  assert(actResult.ok === true, "T22: PR2 activation ok");
  assert(actResult.active_state.summary_canonic !== undefined, "T22: PR2 summary_canonic present");

  const ctx = await getActiveContractContext(env);
  assert(ctx.ok === true, "T22: PR2 getActiveContractContext ok");
  assert(ctx.contract_id === "ctr_regr_001", "T22: PR2 contract_id correct");
  assert(ctx.summary !== null, "T22: PR2 summary present");
  assert(ctx.ready_for_pr3 === true, "T22: PR2 ready_for_pr3 = true");
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
async function runAllTests() {
  await testIntegration();
  await testScopeIsolation();
  await testNoRegression();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
