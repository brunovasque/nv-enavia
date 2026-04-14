// ============================================================================
// 🧪 Smoke Tests — ENAVIA Security Supervisor v1.0 (P26-PR1)
//
// Run: node tests/security-supervisor.smoke.test.js
//
// Tests:
//   S1. Caso permitido → decision=allow
//   S2. Caso fora de escopo → decision=block ou needs_human_review
//   S3. Caso exigindo aprovação humana → decision=needs_human_review
//   S4. Caso com evidência insuficiente → decision=block
//   S5. Caso risco alto → decision=block
//   S6. Ação proibida → decision=block
//   S7. Gates falhando → decision=block
//   S8. Braço bloqueou → decision=block
//   S9. Ambiente PROD → decision=needs_human_review ou block
//   S10. Retorno estruturado tem todos os campos obrigatórios
//   S11. Throws em contexto inválido
//   S12. Escopo inválido com risco alto → block (não needs_human_review)
//   S13. DECISION/RISK_LEVEL/REASON_CODE exportados corretamente
// ============================================================================

import {
  evaluateSensitiveAction,
  DECISION,
  RISK_LEVEL,
  REASON_CODE,
} from "../schema/security-supervisor.js";

// ---------------------------------------------------------------------------
// Test harness (same pattern as other smoke tests in this repo)
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    failed++;
    console.error(`  ❌ ${label} — expected throw, got none`);
  } catch {
    passed++;
    console.log(`  ✅ ${label}`);
  }
}

console.log("\n=== ENAVIA Security Supervisor — Smoke Tests (P26-PR1) ===\n");

// ---------------------------------------------------------------------------
// Helper: build a valid gates_context where all gates pass
// ---------------------------------------------------------------------------
const ALL_GATES_PASS = {
  scope_defined: true,
  environment_defined: true,
  risk_assessed: true,
  authorization_present_when_required: true,
  observability_preserved: true,
  evidence_available_when_required: true,
};

// ---------------------------------------------------------------------------
// S1. Caso permitido → decision=allow
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "read",
    environment: "TEST",
    scope_approved: true,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: true,
  });

  assert(result.allowed === true, "S1a. allowed === true");
  assert(result.decision === DECISION.ALLOW, "S1b. decision === 'allow'");
  assert(result.reason_code === REASON_CODE.ACTION_ALLOWED, "S1c. reason_code === ACTION_ALLOWED");
  assert(result.risk_level === RISK_LEVEL.LOW, "S1d. risk_level === 'low'");
  assert(result.requires_human_approval === false, "S1e. requires_human_approval === false");
  assert(result.scope_valid === true, "S1f. scope_valid === true");
  assert(result.autonomy_valid === true, "S1g. autonomy_valid === true");
  assert(result.evidence_sufficient === true, "S1h. evidence_sufficient === true");
}

// ---------------------------------------------------------------------------
// S2. Caso fora de escopo → block ou needs_human_review
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "read",
    environment: "TEST",
    scope_approved: false,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: true,
  });

  assert(result.allowed === false, "S2a. allowed === false");
  assert(
    result.decision === DECISION.BLOCK || result.decision === DECISION.NEEDS_HUMAN_REVIEW,
    "S2b. decision is block or needs_human_review"
  );
  assert(result.reason_code === REASON_CODE.SCOPE_VIOLATION, "S2c. reason_code === SCOPE_VIOLATION");
  assert(result.scope_valid === false, "S2d. scope_valid === false");
}

// ---------------------------------------------------------------------------
// S3. Caso exigindo aprovação humana → decision=needs_human_review
//     Usar ação que requer OK humano: start_plan_execution
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "start_plan_execution",
    environment: "TEST",
    scope_approved: true,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: true,
  });

  assert(result.allowed === false, "S3a. allowed === false");
  assert(result.decision === DECISION.NEEDS_HUMAN_REVIEW, "S3b. decision === 'needs_human_review'");
  assert(result.reason_code === REASON_CODE.HUMAN_APPROVAL_REQUIRED, "S3c. reason_code === HUMAN_APPROVAL_REQUIRED");
  assert(result.requires_human_approval === true, "S3d. requires_human_approval === true");
}

// ---------------------------------------------------------------------------
// S4. Caso com evidência insuficiente → block
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "execute_in_test_within_scope",
    environment: "TEST",
    scope_approved: true,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: false,
  });

  assert(result.allowed === false, "S4a. allowed === false");
  assert(result.decision === DECISION.BLOCK, "S4b. decision === 'block'");
  assert(result.reason_code === REASON_CODE.INSUFFICIENT_EVIDENCE, "S4c. reason_code === INSUFFICIENT_EVIDENCE");
  assert(result.evidence_sufficient === false, "S4d. evidence_sufficient === false");
}

// ---------------------------------------------------------------------------
// S5. Caso risco alto → block
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "execute_in_test_within_scope",
    environment: "TEST",
    scope_approved: true,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: true,
    is_high_risk: true,
  });

  assert(result.allowed === false, "S5a. allowed === false");
  assert(result.decision === DECISION.BLOCK, "S5b. decision === 'block'");
  assert(result.reason_code === REASON_CODE.HIGH_RISK_DETECTED, "S5c. reason_code === HIGH_RISK_DETECTED");
  assert(result.risk_level === RISK_LEVEL.HIGH, "S5d. risk_level === 'high'");
}

// ---------------------------------------------------------------------------
// S6. Ação proibida → decision=block
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "exit_scope",
    environment: "TEST",
    scope_approved: true,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: true,
  });

  assert(result.allowed === false, "S6a. allowed === false");
  assert(result.decision === DECISION.BLOCK, "S6b. decision === 'block'");
  assert(result.reason_code === REASON_CODE.ACTION_PROHIBITED, "S6c. reason_code === ACTION_PROHIBITED");
  assert(result.risk_level === RISK_LEVEL.HIGH, "S6d. risk_level === 'high'");
}

// ---------------------------------------------------------------------------
// S7. Gates falhando → decision=block
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "execute_in_test_within_scope",
    environment: "TEST",
    scope_approved: true,
    gates_context: {
      scope_defined: false,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
    evidence_sufficient: true,
  });

  assert(result.allowed === false, "S7a. allowed === false");
  assert(result.decision === DECISION.BLOCK, "S7b. decision === 'block'");
  assert(
    result.reason_code === REASON_CODE.GATES_FAILED || result.reason_code === REASON_CODE.AUTONOMY_BLOCKED,
    "S7c. reason_code === GATES_FAILED or AUTONOMY_BLOCKED"
  );
}

// ---------------------------------------------------------------------------
// S8. Braço bloqueou → decision=block
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "read",
    environment: "TEST",
    scope_approved: true,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: true,
    arm_check_result: {
      allowed: false,
      reason: "Braço GitHub bloqueou a ação.",
      arm_id: "p24_github_pr_arm",
    },
  });

  assert(result.allowed === false, "S8a. allowed === false");
  assert(result.decision === DECISION.BLOCK, "S8b. decision === 'block'");
  assert(result.reason_code === REASON_CODE.ARM_ENFORCEMENT_BLOCKED, "S8c. reason_code === ARM_ENFORCEMENT_BLOCKED");
}

// ---------------------------------------------------------------------------
// S9. Ambiente PROD → needs_human_review (even for allowed action)
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "read",
    environment: "PROD",
    scope_approved: true,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: true,
  });

  assert(result.allowed === false, "S9a. allowed === false (PROD always needs review)");
  assert(
    result.decision === DECISION.NEEDS_HUMAN_REVIEW || result.decision === DECISION.BLOCK,
    "S9b. decision is needs_human_review or block (PROD)"
  );
  assert(result.requires_human_approval === true, "S9c. requires_human_approval === true");
}

// ---------------------------------------------------------------------------
// S10. Retorno estruturado tem todos os campos obrigatórios
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "read",
    environment: "TEST",
    scope_approved: true,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: true,
  });

  const requiredFields = [
    "allowed",
    "decision",
    "reason_code",
    "reason_text",
    "risk_level",
    "requires_human_approval",
    "scope_valid",
    "autonomy_valid",
    "evidence_sufficient",
    "timestamp",
    "supervisor_version",
    "_delegation",
  ];

  for (const field of requiredFields) {
    assert(field in result, `S10. Campo '${field}' presente no retorno`);
  }

  assert(typeof result.allowed === "boolean", "S10. 'allowed' é boolean");
  assert(typeof result.decision === "string", "S10. 'decision' é string");
  assert(typeof result.reason_code === "string", "S10. 'reason_code' é string");
  assert(typeof result.reason_text === "string", "S10. 'reason_text' é string");
  assert(typeof result.risk_level === "string", "S10. 'risk_level' é string");
  assert(typeof result.requires_human_approval === "boolean", "S10. 'requires_human_approval' é boolean");
  assert(typeof result.scope_valid === "boolean", "S10. 'scope_valid' é boolean");
  assert(typeof result.autonomy_valid === "boolean", "S10. 'autonomy_valid' é boolean");
  assert(typeof result.evidence_sufficient === "boolean", "S10. 'evidence_sufficient' é boolean");
  assert(typeof result.timestamp === "string", "S10. 'timestamp' é string ISO");
  assert(typeof result.supervisor_version === "string", "S10. 'supervisor_version' é string");
}

// ---------------------------------------------------------------------------
// S11. Throws em contexto inválido
// ---------------------------------------------------------------------------
{
  assertThrows(
    () => evaluateSensitiveAction(null),
    "S11a. throws on null context"
  );
  assertThrows(
    () => evaluateSensitiveAction({}),
    "S11b. throws on empty context (missing action)"
  );
  assertThrows(
    () => evaluateSensitiveAction({ action: "read" }),
    "S11c. throws on missing environment"
  );
  assertThrows(
    () => evaluateSensitiveAction({ action: "read", environment: "TEST" }),
    "S11d. throws on missing scope_approved"
  );
  assertThrows(
    () => evaluateSensitiveAction({ action: "read", environment: "TEST", scope_approved: true }),
    "S11e. throws on missing gates_context"
  );
  assertThrows(
    () => evaluateSensitiveAction({ action: "", environment: "TEST", scope_approved: true, gates_context: {} }),
    "S11f. throws on empty action string"
  );
  assertThrows(
    () => evaluateSensitiveAction({ action: "read", environment: "INVALID", scope_approved: true, gates_context: {} }),
    "S11g. throws on invalid environment"
  );
}

// ---------------------------------------------------------------------------
// S12. Escopo inválido com risco alto → block (não needs_human_review)
// ---------------------------------------------------------------------------
{
  const result = evaluateSensitiveAction({
    action: "exit_scope",
    environment: "PROD",
    scope_approved: false,
    gates_context: ALL_GATES_PASS,
    evidence_sufficient: true,
  });

  assert(result.allowed === false, "S12a. allowed === false");
  assert(result.decision === DECISION.BLOCK, "S12b. decision === 'block' (high risk + scope violation)");
  assert(result.scope_valid === false, "S12c. scope_valid === false");
}

// ---------------------------------------------------------------------------
// S13. DECISION/RISK_LEVEL/REASON_CODE exportados corretamente
// ---------------------------------------------------------------------------
{
  assert(DECISION.ALLOW === "allow", "S13a. DECISION.ALLOW === 'allow'");
  assert(DECISION.BLOCK === "block", "S13b. DECISION.BLOCK === 'block'");
  assert(DECISION.NEEDS_HUMAN_REVIEW === "needs_human_review", "S13c. DECISION.NEEDS_HUMAN_REVIEW === 'needs_human_review'");
  assert(RISK_LEVEL.LOW === "low", "S13d. RISK_LEVEL.LOW === 'low'");
  assert(RISK_LEVEL.MEDIUM === "medium", "S13e. RISK_LEVEL.MEDIUM === 'medium'");
  assert(RISK_LEVEL.HIGH === "high", "S13f. RISK_LEVEL.HIGH === 'high'");
  assert(typeof REASON_CODE === "object", "S13g. REASON_CODE is an object");
  assert(Object.keys(REASON_CODE).length > 0, "S13h. REASON_CODE has entries");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  console.error("❌ Some smoke tests failed.");
  process.exit(1);
}

console.log("✅ All smoke tests passed.\n");
