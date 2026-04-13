// ============================================================================
// 🧪 Smoke Tests — ENAVIA Autonomy Contract v1.2 (P23)
//
// Run: node tests/autonomy-contract.smoke.test.js
//
// Tests:
//   S1.  classifyAction — allowed action (pre-execution)
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
//   S14. evaluateEnvironmentAutonomy — TEST + post-start action in scope → autonomous
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
//   S27. start_plan_execution requires human OK in TEST (BLOCKER 1 fix)
//   S28. start_contract_execution requires human OK in TEST (BLOCKER 1 fix)
//   S29. start_task_execution requires human OK in TEST (BLOCKER 1 fix)
//   S30. start_plan_execution requires human OK in PROD
//   S31. PRE_EXECUTION_ACTIONS are all autonomous without start
//   S32. POST_START_AUTONOMOUS_ACTIONS are autonomous in TEST after start
//   S33. PRE_EXECUTION_ACTIONS and POST_START_AUTONOMOUS_ACTIONS are disjoint
//   S34. HUMAN_OK_REQUIRED_ACTIONS includes all start_* actions
//   S35. evaluateEnvironmentAutonomy — TEST + act_on_undefined_external_service → requires human
//   S36. evaluateEnvironmentAutonomy — TEST + pre-execution read → autonomous
//   S37. enforceConstitution — allowed execution in TEST within scope
//   S38. enforceConstitution — blocked: prohibited action (exit_scope)
//   S39. enforceConstitution — blocked: gates fail (scope not defined)
//   S40. enforceConstitution — blocked: start_plan_execution requires human OK in TEST
//   S41. enforceConstitution — blocked: promote_to_prod in PROD requires human OK
//   S42. enforceConstitution — blocked: out of scope
//   S43. enforceConstitution — allowed: pre-execution read in PROD (no gates issue)
//   S44. enforceConstitution — auditable reason always present
//   S45. enforceConstitution — throws on invalid params
//   S46. enforceConstitution — blocked: start_task_execution in PROD
// ============================================================================

import {
  ENVIRONMENT,
  AUTONOMY_LEVEL,
  PRE_EXECUTION_ACTIONS,
  POST_START_AUTONOMOUS_ACTIONS,
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
  enforceConstitution,
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

// ── S14. evaluateEnvironmentAutonomy — TEST + post-start in scope ────────────
console.log("S14. evaluateEnvironmentAutonomy — TEST + post-start action in scope → autonomous");
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

// ── S27. start_plan_execution requires human OK in TEST (BLOCKER 1 fix) ─────
console.log("S27. start_plan_execution requires human OK in TEST (BLOCKER 1 fix)");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.TEST,
    action: "start_plan_execution",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "TEST + start_plan_execution → requires_human");
  assert(r.can_proceed === false, "can_proceed = false (even in TEST)");
}

// ── S28. start_contract_execution requires human OK in TEST ─────────────────
console.log("S28. start_contract_execution requires human OK in TEST (BLOCKER 1 fix)");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.TEST,
    action: "start_contract_execution",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "TEST + start_contract_execution → requires_human");
  assert(r.can_proceed === false, "can_proceed = false (even in TEST)");
}

// ── S29. start_task_execution requires human OK in TEST ─────────────────────
console.log("S29. start_task_execution requires human OK in TEST (BLOCKER 1 fix)");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.TEST,
    action: "start_task_execution",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "TEST + start_task_execution → requires_human");
  assert(r.can_proceed === false, "can_proceed = false (even in TEST)");
}

// ── S30. start_plan_execution requires human OK in PROD ─────────────────────
console.log("S30. start_plan_execution requires human OK in PROD");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.PROD,
    action: "start_plan_execution",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "PROD + start_plan_execution → requires_human");
  assert(r.can_proceed === false, "can_proceed = false");
}

// ── S31. PRE_EXECUTION_ACTIONS are all autonomous without start ─────────────
console.log("S31. PRE_EXECUTION_ACTIONS are all autonomous (no start needed)");
{
  let allAutonomous = true;
  for (const action of PRE_EXECUTION_ACTIONS) {
    const r = classifyAction(action);
    if (r.autonomy_level !== AUTONOMY_LEVEL.AUTONOMOUS) {
      allAutonomous = false;
      break;
    }
  }
  assert(allAutonomous, "all PRE_EXECUTION_ACTIONS classify as autonomous");
  assert(PRE_EXECUTION_ACTIONS.length >= 8, "at least 8 pre-execution actions defined");
}

// ── S32. POST_START_AUTONOMOUS_ACTIONS are autonomous in TEST ────────────────
console.log("S32. POST_START_AUTONOMOUS_ACTIONS are autonomous in TEST after start");
{
  let allAutonomous = true;
  for (const action of POST_START_AUTONOMOUS_ACTIONS) {
    const r = evaluateEnvironmentAutonomy({
      environment: ENVIRONMENT.TEST,
      action,
      scope_approved: true,
    });
    if (r.autonomy_level !== AUTONOMY_LEVEL.AUTONOMOUS) {
      allAutonomous = false;
      break;
    }
  }
  assert(allAutonomous, "all POST_START_AUTONOMOUS_ACTIONS are autonomous in TEST");
  assert(POST_START_AUTONOMOUS_ACTIONS.length >= 4, "at least 4 post-start actions defined");
}

// ── S33. PRE_EXECUTION and POST_START are disjoint ──────────────────────────
console.log("S33. PRE_EXECUTION_ACTIONS and POST_START_AUTONOMOUS_ACTIONS are disjoint");
{
  const overlap = PRE_EXECUTION_ACTIONS.filter(a => POST_START_AUTONOMOUS_ACTIONS.includes(a));
  assert(overlap.length === 0, "no overlap between PRE_EXECUTION and POST_START");
}

// ── S34. HUMAN_OK_REQUIRED_ACTIONS includes all start_* actions ─────────────
console.log("S34. HUMAN_OK_REQUIRED_ACTIONS includes all start_* actions");
{
  assert(HUMAN_OK_REQUIRED_ACTIONS.includes("start_plan_execution"), "start_plan_execution in HUMAN_OK");
  assert(HUMAN_OK_REQUIRED_ACTIONS.includes("start_contract_execution"), "start_contract_execution in HUMAN_OK");
  assert(HUMAN_OK_REQUIRED_ACTIONS.includes("start_task_execution"), "start_task_execution in HUMAN_OK");
}

// ── S35. TEST + act_on_undefined_external_service → requires human ──────────
console.log("S35. evaluateEnvironmentAutonomy — TEST + act_on_undefined_external_service → requires human");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.TEST,
    action: "act_on_undefined_external_service",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "TEST + undefined service → requires_human");
  assert(r.can_proceed === false, "can_proceed = false");
}

// ── S36. TEST + pre-execution read → autonomous ─────────────────────────────
console.log("S36. evaluateEnvironmentAutonomy — TEST + pre-execution read → autonomous");
{
  const r = evaluateEnvironmentAutonomy({
    environment: ENVIRONMENT.TEST,
    action: "read_only_diagnostic",
    scope_approved: true,
  });
  assert(r.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "TEST + read_only_diagnostic → autonomous");
  assert(r.can_proceed === true, "can_proceed = true");
}

// ── S37. enforceConstitution — allowed execution in TEST within scope ────────
console.log("S37. enforceConstitution — allowed execution in TEST within scope");
{
  const r = enforceConstitution({
    action: "execute_in_test_within_scope",
    environment: ENVIRONMENT.TEST,
    scope_approved: true,
    gates_context: {
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.allowed === true, "allowed = true");
  assert(r.blocked === false, "blocked = false");
  assert(typeof r.reason === "string" && r.reason.length > 0, "reason is auditable string");
  assert(r.classification !== null, "classification present");
  assert(r.gates !== null, "gates present");
  assert(r.environment_check !== null, "environment_check present");
}

// ── S38. enforceConstitution — blocked: prohibited action ───────────────────
console.log("S38. enforceConstitution — blocked: prohibited action (exit_scope)");
{
  const r = enforceConstitution({
    action: "exit_scope",
    environment: ENVIRONMENT.TEST,
    scope_approved: true,
    gates_context: {
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.allowed === false, "allowed = false (prohibited action)");
  assert(r.blocked === true, "blocked = true");
  assert(r.level === AUTONOMY_LEVEL.PROHIBITED, "level = prohibited");
  assert(r.reason.includes("proibida"), "reason mentions prohibition");
  assert(r.gates === null, "gates null (blocked before gates check)");
}

// ── S39. enforceConstitution — blocked: gates fail ──────────────────────────
console.log("S39. enforceConstitution — blocked: gates fail (scope not defined)");
{
  const r = enforceConstitution({
    action: "execute_in_test_within_scope",
    environment: ENVIRONMENT.TEST,
    scope_approved: true,
    gates_context: {
      scope_defined: false,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.allowed === false, "allowed = false (gate failed)");
  assert(r.blocked === true, "blocked = true");
  assert(r.level === "blocked_by_gates", "level = blocked_by_gates");
  assert(r.gates !== null, "gates result present");
  assert(r.gates.failed_gates.includes("scope_defined"), "scope_defined in failed gates");
}

// ── S40. enforceConstitution — blocked: start_plan_execution in TEST ────────
console.log("S40. enforceConstitution — blocked: start_plan_execution requires human OK in TEST");
{
  const r = enforceConstitution({
    action: "start_plan_execution",
    environment: ENVIRONMENT.TEST,
    scope_approved: true,
    gates_context: {
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.allowed === false, "allowed = false (start requires human OK)");
  assert(r.blocked === true, "blocked = true");
  assert(r.level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "level = requires_human_ok");
  assert(typeof r.reason === "string" && r.reason.length > 0, "reason is auditable");
}

// ── S41. enforceConstitution — blocked: promote_to_prod in PROD ─────────────
console.log("S41. enforceConstitution — blocked: promote_to_prod in PROD requires human OK");
{
  const r = enforceConstitution({
    action: "promote_to_prod",
    environment: ENVIRONMENT.PROD,
    scope_approved: true,
    gates_context: {
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.allowed === false, "allowed = false (promote requires human OK)");
  assert(r.blocked === true, "blocked = true");
  assert(typeof r.reason === "string" && r.reason.length > 0, "reason is auditable");
}

// ── S42. enforceConstitution — blocked: out of scope ────────────────────────
console.log("S42. enforceConstitution — blocked: out of scope");
{
  const r = enforceConstitution({
    action: "execute_in_test_within_scope",
    environment: ENVIRONMENT.TEST,
    scope_approved: false,
    gates_context: {
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.allowed === false, "allowed = false (out of scope)");
  assert(r.blocked === true, "blocked = true");
  assert(r.reason.includes("escopo"), "reason mentions scope");
}

// ── S43. enforceConstitution — allowed: pre-execution read in PROD ──────────
console.log("S43. enforceConstitution — allowed: pre-execution read in PROD");
{
  const r = enforceConstitution({
    action: "read",
    environment: ENVIRONMENT.PROD,
    scope_approved: true,
    gates_context: {
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.allowed === true, "allowed = true (read is safe in PROD)");
  assert(r.blocked === false, "blocked = false");
}

// ── S44. enforceConstitution — auditable reason always present ──────────────
console.log("S44. enforceConstitution — auditable reason always present");
{
  // Allowed case
  const r1 = enforceConstitution({
    action: "read",
    environment: ENVIRONMENT.TEST,
    scope_approved: true,
    gates_context: {
      scope_defined: true, environment_defined: true, risk_assessed: true,
      authorization_present_when_required: true, observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(typeof r1.reason === "string" && r1.reason.length > 5, "allowed: reason is non-trivial string");

  // Blocked case
  const r2 = enforceConstitution({
    action: "exit_scope",
    environment: ENVIRONMENT.TEST,
    scope_approved: true,
    gates_context: {
      scope_defined: true, environment_defined: true, risk_assessed: true,
      authorization_present_when_required: true, observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(typeof r2.reason === "string" && r2.reason.length > 5, "blocked: reason is non-trivial string");
}

// ── S45. enforceConstitution — throws on invalid params ─────────────────────
console.log("S45. enforceConstitution — throws on invalid params");
assertThrows(() => enforceConstitution({}), "missing action throws");
assertThrows(() => enforceConstitution({ action: "read" }), "missing environment throws");
assertThrows(() => enforceConstitution({ action: "read", environment: "TEST" }), "missing scope_approved throws");
assertThrows(() => enforceConstitution({ action: "read", environment: "TEST", scope_approved: true }), "missing gates_context throws");

// ── S46. enforceConstitution — blocked: start_task_execution in PROD ────────
console.log("S46. enforceConstitution — blocked: start_task_execution in PROD");
{
  const r = enforceConstitution({
    action: "start_task_execution",
    environment: ENVIRONMENT.PROD,
    scope_approved: true,
    gates_context: {
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true,
    },
  });
  assert(r.allowed === false, "allowed = false (start_task in PROD requires human OK)");
  assert(r.blocked === true, "blocked = true");
  assert(r.level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "level = requires_human_ok");
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
