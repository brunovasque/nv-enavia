// ============================================================================
// 🧪 Smoke Tests — ENAVIA Autonomy Contract v1 (P23)
//
// Run: node tests/autonomy-contract.smoke.test.js
//
// Tests:
//   S1.  classifyAction — allowed action
//   S2.  classifyAction — requires_human_ok action
//   S3.  classifyAction — prohibited action
//   S4.  classifyAction — unknown action (defaults to requires_human)
//   S5.  classifyAction — throws on empty
//   S6.  evaluateGates — all gates pass
//   S7.  evaluateGates — some gates fail
//   S8.  evaluateGates — all gates fail
//   S9.  evaluateGates — throws on missing context
//   S10. evaluateFailurePolicy — within retries
//   S11. evaluateFailurePolicy — max retries exceeded → escalate
//   S12. evaluateFailurePolicy — high risk → escalate
//   S13. evaluateFailurePolicy — insufficient evidence → escalate
//   S14. evaluateEnvironmentAutonomy — TEST + in scope → autonomous
//   S15. evaluateEnvironmentAutonomy — TEST + out of scope → prohibited
//   S16. evaluateEnvironmentAutonomy — PROD + promote → requires human
//   S17. evaluateEnvironmentAutonomy — PROD + read → autonomous
//   S18. evaluateEnvironmentAutonomy — PROD + unknown action → requires human
//   S19. evaluateEnvironmentAutonomy — TEST + promote_to_prod → requires human (even in TEST)
//   S20. validateSpecialistArmCompliance — compliant arm
//   S21. validateSpecialistArmCompliance — prohibited action → blocked
//   S22. validateSpecialistArmCompliance — gates fail → blocked
//   S23. catalogues are consistent (no overlap between allowed/prohibited)
//   S24. evaluateEnvironmentAutonomy — prohibited action in TEST → still prohibited
//   S25. evaluateFailurePolicy — attempt 1 with no issues → can continue
//   S26. SPECIALIST_ARM_POLICY references P24/P25/P26
// ============================================================================

import {
  ENVIRONMENT,
  AUTONOMY_LEVEL,
  ALLOWED_ACTIONS,
  HUMAN_OK_REQUIRED_ACTIONS,
  PROHIBITED_ACTIONS,
  REQUIRED_GATES,
  FAILURE_POLICY,
  SPECIALIST_ARM_POLICY,
  classifyAction,
  evaluateGates,
  evaluateFailurePolicy,
  evaluateEnvironmentAutonomy,
  validateSpecialistArmCompliance,
} from "../schema/autonomy-contract.js";

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

console.log("\n=== ENAVIA Autonomy Contract — Smoke Tests (P23) ===\n");

// ── S1. classifyAction — allowed action ──────────────────────────────────────
console.log("S1. classifyAction — allowed action");
{
  const r = classifyAction("read");
  assert(r.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "read → autonomous");
  assert(r.action === "read", "action echoed");
  assert(typeof r.reason === "string" && r.reason.length > 0, "reason present");
}

// ── S2. classifyAction — requires_human_ok action ───────────────────────────
console.log("S2. classifyAction — requires_human_ok action");
{
  const r = classifyAction("promote_to_prod");
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "promote_to_prod → requires_human_ok");
}

// ── S3. classifyAction — prohibited action ──────────────────────────────────
console.log("S3. classifyAction — prohibited action");
{
  const r = classifyAction("exit_scope");
  assert(r.autonomy_level === AUTONOMY_LEVEL.PROHIBITED, "exit_scope → prohibited");
}

// ── S4. classifyAction — unknown action ─────────────────────────────────────
console.log("S4. classifyAction — unknown action (defaults to requires_human)");
{
  const r = classifyAction("some_unknown_action_xyz");
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "unknown → requires_human_ok (cautela)");
  assert(r.reason.includes("não catalogada"), "reason mentions not catalogued");
}

// ── S5. classifyAction — throws on empty ────────────────────────────────────
console.log("S5. classifyAction — throws on empty");
assertThrows(() => classifyAction(""), "empty string throws");
assertThrows(() => classifyAction(null), "null throws");
assertThrows(() => classifyAction(123), "number throws");

// ── S6. evaluateGates — all gates pass ──────────────────────────────────────
console.log("S6. evaluateGates — all gates pass");
{
  const ctx = {
    scope_defined: true,
    environment_defined: true,
    risk_assessed: true,
    authorization_present_when_required: true,
    observability_preserved: true,
    evidence_available_when_required: true,
  };
  const r = evaluateGates(ctx);
  assert(r.all_gates_passed === true, "all_gates_passed = true");
  assert(r.can_proceed === true, "can_proceed = true");
  assert(r.failed_gates.length === 0, "no failed gates");
}

// ── S7. evaluateGates — some gates fail ─────────────────────────────────────
console.log("S7. evaluateGates — some gates fail");
{
  const ctx = {
    scope_defined: true,
    environment_defined: false,
    risk_assessed: true,
    authorization_present_when_required: false,
    observability_preserved: true,
    evidence_available_when_required: true,
  };
  const r = evaluateGates(ctx);
  assert(r.all_gates_passed === false, "all_gates_passed = false");
  assert(r.can_proceed === false, "can_proceed = false");
  assert(r.failed_gates.length === 2, "2 gates failed");
  assert(r.failed_gates.includes("environment_defined"), "environment_defined failed");
  assert(r.failed_gates.includes("authorization_present_when_required"), "authorization failed");
}

// ── S8. evaluateGates — all gates fail ──────────────────────────────────────
console.log("S8. evaluateGates — all gates fail");
{
  const r = evaluateGates({});
  assert(r.all_gates_passed === false, "all_gates_passed = false");
  assert(r.failed_gates.length === REQUIRED_GATES.length, "all gates failed");
}

// ── S9. evaluateGates — throws on missing context ───────────────────────────
console.log("S9. evaluateGates — throws on missing context");
assertThrows(() => evaluateGates(null), "null throws");
assertThrows(() => evaluateGates("string"), "string throws");

// ── S10. evaluateFailurePolicy — within retries ─────────────────────────────
console.log("S10. evaluateFailurePolicy — within retries");
{
  const r = evaluateFailurePolicy({ attempt: 2, is_high_risk: false, has_sufficient_evidence: true });
  assert(r.can_continue === true, "can_continue = true on attempt 2");
  assert(r.must_escalate === false, "must_escalate = false");
  assert(r.escalation_type === "none", "escalation_type = none");
}

// ── S11. evaluateFailurePolicy — max retries exceeded ───────────────────────
console.log("S11. evaluateFailurePolicy — max retries exceeded → escalate");
{
  const r = evaluateFailurePolicy({ attempt: 4, is_high_risk: false, has_sufficient_evidence: true });
  assert(r.can_continue === false, "can_continue = false on attempt 4");
  assert(r.must_escalate === true, "must_escalate = true");
  assert(r.escalation_type === "max_retries", "escalation_type = max_retries");
}

// ── S12. evaluateFailurePolicy — high risk ──────────────────────────────────
console.log("S12. evaluateFailurePolicy — high risk → escalate");
{
  const r = evaluateFailurePolicy({ attempt: 1, is_high_risk: true, has_sufficient_evidence: true });
  assert(r.can_continue === false, "can_continue = false (high risk)");
  assert(r.must_escalate === true, "must_escalate = true");
  assert(r.escalation_type === "high_risk", "escalation_type = high_risk");
}

// ── S13. evaluateFailurePolicy — insufficient evidence ──────────────────────
console.log("S13. evaluateFailurePolicy — insufficient evidence → escalate");
{
  const r = evaluateFailurePolicy({ attempt: 1, is_high_risk: false, has_sufficient_evidence: false });
  assert(r.can_continue === false, "can_continue = false (insufficient evidence)");
  assert(r.must_escalate === true, "must_escalate = true");
  assert(r.escalation_type === "insufficient_evidence", "escalation_type = insufficient_evidence");
}

// ── S14. evaluateEnvironmentAutonomy — TEST + in scope ──────────────────────
console.log("S14. evaluateEnvironmentAutonomy — TEST + in scope → autonomous");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.TEST,
    action: "execute_in_test_within_scope",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "TEST + in scope → autonomous");
  assert(r.can_proceed === true, "can_proceed = true");
}

// ── S15. evaluateEnvironmentAutonomy — TEST + out of scope ──────────────────
console.log("S15. evaluateEnvironmentAutonomy — TEST + out of scope → prohibited");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.TEST,
    action: "execute_in_test_within_scope",
    scope_approved: false,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.PROHIBITED, "TEST + out of scope → prohibited");
  assert(r.can_proceed === false, "can_proceed = false");
}

// ── S16. evaluateEnvironmentAutonomy — PROD + promote ───────────────────────
console.log("S16. evaluateEnvironmentAutonomy — PROD + promote → requires human");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.PROD,
    action: "promote_to_prod",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "PROD promote → requires_human");
  assert(r.can_proceed === false, "can_proceed = false");
}

// ── S17. evaluateEnvironmentAutonomy — PROD + read → autonomous ─────────────
console.log("S17. evaluateEnvironmentAutonomy — PROD + read → autonomous");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.PROD,
    action: "read",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "PROD + read → autonomous");
  assert(r.can_proceed === true, "can_proceed = true");
}

// ── S18. evaluateEnvironmentAutonomy — PROD + unknown → requires human ──────
console.log("S18. evaluateEnvironmentAutonomy — PROD + unknown → requires human");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.PROD,
    action: "some_unknown_action",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "PROD + unknown → requires_human");
  assert(r.can_proceed === false, "can_proceed = false");
}

// ── S19. evaluateEnvironmentAutonomy — TEST + promote_to_prod ───────────────
console.log("S19. evaluateEnvironmentAutonomy — TEST + promote_to_prod → requires human (governance)");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.TEST,
    action: "promote_to_prod",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "TEST + promote_to_prod → requires_human");
  assert(r.can_proceed === false, "can_proceed = false (even in TEST)");
}

// ── S20. validateSpecialistArmCompliance — compliant arm ────────────────────
console.log("S20. validateSpecialistArmCompliance — compliant arm");
{
  const r = validateSpecialistArmCompliance({
    arm_id: "p24_github_arm",
    action: "read",
    gates_context: {
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.is_compliant === true, "compliant arm");
  assert(r.arm_id === "p24_github_arm", "arm_id echoed");
}

// ── S21. validateSpecialistArmCompliance — prohibited action → blocked ──────
console.log("S21. validateSpecialistArmCompliance — prohibited action → blocked");
{
  const r = validateSpecialistArmCompliance({
    arm_id: "p25_browser_arm",
    action: "exit_scope",
    gates_context: {
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.is_compliant === false, "prohibited action → not compliant");
}

// ── S22. validateSpecialistArmCompliance — gates fail → blocked ─────────────
console.log("S22. validateSpecialistArmCompliance — gates fail → blocked");
{
  const r = validateSpecialistArmCompliance({
    arm_id: "p26_deploy_test",
    action: "start_plan_execution",
    gates_context: {
      scope_defined: false,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.is_compliant === false, "gates fail → not compliant");
  assert(r.gates_evaluation.failed_gates.includes("scope_defined"), "scope_defined is the failed gate");
}

// ── S23. Catalogues consistency (no overlap) ────────────────────────────────
console.log("S23. Catalogues are consistent (no overlap between allowed/prohibited)");
{
  const overlapAP = ALLOWED_ACTIONS.filter(a => PROHIBITED_ACTIONS.includes(a));
  assert(overlapAP.length === 0, "no overlap between ALLOWED and PROHIBITED");

  const overlapAH = ALLOWED_ACTIONS.filter(a => HUMAN_OK_REQUIRED_ACTIONS.includes(a));
  assert(overlapAH.length === 0, "no overlap between ALLOWED and HUMAN_OK_REQUIRED");

  const overlapHP = HUMAN_OK_REQUIRED_ACTIONS.filter(a => PROHIBITED_ACTIONS.includes(a));
  assert(overlapHP.length === 0, "no overlap between HUMAN_OK_REQUIRED and PROHIBITED");
}

// ── S24. evaluateEnvironmentAutonomy — prohibited action in TEST ────────────
console.log("S24. evaluateEnvironmentAutonomy — prohibited action in TEST → still prohibited");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.TEST,
    action: "exit_scope",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.PROHIBITED, "prohibited action still prohibited in TEST");
  assert(r.can_proceed === false, "can_proceed = false");
}

// ── S25. evaluateFailurePolicy — attempt 1 healthy ──────────────────────────
console.log("S25. evaluateFailurePolicy — attempt 1 with no issues → can continue");
{
  const r = evaluateFailurePolicy({ attempt: 1, is_high_risk: false, has_sufficient_evidence: true });
  assert(r.can_continue === true, "can_continue = true on attempt 1");
  assert(r.escalation_type === "none", "escalation_type = none");
}

// ── S26. SPECIALIST_ARM_POLICY references P24/P25/P26 ──────────────────────
console.log("S26. SPECIALIST_ARM_POLICY references P24/P25/P26");
{
  assert(typeof SPECIALIST_ARM_POLICY.p24_github_arm === "string", "P24 reference exists");
  assert(typeof SPECIALIST_ARM_POLICY.p25_browser_arm === "string", "P25 reference exists");
  assert(typeof SPECIALIST_ARM_POLICY.p26_deploy_test === "string", "P26 reference exists");
  assert(SPECIALIST_ARM_POLICY.general_rule.includes("no_arm_can_override"), "general rule present");
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
