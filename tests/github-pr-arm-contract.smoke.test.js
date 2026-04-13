// ============================================================================
// 🧪 Smoke Tests — ENAVIA GitHub/PR Arm Contract v1.0 (P24)
//
// Run: node tests/github-pr-arm-contract.smoke.test.js
//
// Tests:
//   S1.  classifyGitHubPrAction — pre-merge allowed action (open_branch)
//   S2.  classifyGitHubPrAction — pre-merge allowed action (update_pr)
//   S3.  classifyGitHubPrAction — merge_to_main requires formal approval
//   S4.  classifyGitHubPrAction — prohibited action (generate_drift)
//   S5.  classifyGitHubPrAction — unknown action → not github arm, requires human
//   S6.  classifyGitHubPrAction — throws on empty
//   S7.  evaluateMergeReadiness — all gates pass
//   S8.  evaluateMergeReadiness — missing summary blocks
//   S9.  evaluateMergeReadiness — missing reason blocks
//   S10. evaluateMergeReadiness — missing boolean gate blocks
//   S11. evaluateMergeReadiness — throws on missing context
//   S12. buildMergeGateState — not ready
//   S13. buildMergeGateState — ready + awaiting approval
//   S14. buildMergeGateState — ready + approved → can merge
//   S15. buildMergeGateState — ready + rejected → blocked
//   S16. buildMergeGateState — throws on invalid approval_status
//   S17. enforceGitHubPrArm — allowed pre-merge action (review_diff)
//   S18. enforceGitHubPrArm — blocked: prohibited action (silent_merge)
//   S19. enforceGitHubPrArm — blocked: action outside github arm scope
//   S20. enforceGitHubPrArm — blocked: out of scope
//   S21. enforceGitHubPrArm — blocked: drift detected
//   S22. enforceGitHubPrArm — blocked: regression detected
//   S23. enforceGitHubPrArm — blocked: P23 gates fail
//   S24. enforceGitHubPrArm — blocked: merge without merge_context
//   S25. enforceGitHubPrArm — blocked: merge without summary
//   S26. enforceGitHubPrArm — blocked: merge without reason
//   S27. enforceGitHubPrArm — blocked: merge awaiting approval
//   S28. enforceGitHubPrArm — allowed: merge with everything ok + approved
//   S29. enforceGitHubPrArm — throws on invalid params
//   S30. catalogues — pre-merge and prohibited are disjoint
//   S31. catalogues — no overlap between P24 prohibited and P23 allowed
//   S32. GITHUB_PR_ARM_ID is canonical
//   S33. MERGE_STATUS enum is complete
//   S34. classifyGitHubPrAction — all pre-merge actions are autonomous
//   S35. classifyGitHubPrAction — all prohibited actions are prohibited
//   S36. enforceGitHubPrArm — blocked: merge rejected
//   S37. evaluateMergeReadiness — all boolean gates false
//   S38. enforceGitHubPrArm — all 9 pre-merge actions pass within scope
// ============================================================================

import {
  GITHUB_PR_ARM_ID,
  PRE_MERGE_ALLOWED_ACTIONS,
  FORMAL_APPROVAL_REQUIRED_ACTIONS,
  PROHIBITED_ACTIONS_P24,
  MERGE_READINESS_GATES,
  MERGE_STATUS,
  VALID_APPROVAL_STATUSES,
  classifyGitHubPrAction,
  evaluateMergeReadiness,
  buildMergeGateState,
  enforceGitHubPrArm,
} from "../schema/github-pr-arm-contract.js";

import {
  AUTONOMY_LEVEL,
  ALLOWED_ACTIONS,
} from "../schema/autonomy-contract.js";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}`);
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    failed++;
    console.error(`  ❌ FAIL (no throw): ${label}`);
  } catch {
    passed++;
    console.log(`  ✅ ${label} (threw as expected)`);
  }
}

// ── Helper: standard gates context (all pass) ──
const ALL_GATES_OK = {
  scope_defined: true,
  environment_defined: true,
  risk_assessed: true,
  authorization_present_when_required: true,
  observability_preserved: true,
  evidence_available_when_required: true,
};

// ── Helper: standard merge context (all ok) ──
const FULL_MERGE_CONTEXT = {
  contract_rechecked: true,
  phase_validated: true,
  no_regression: true,
  diff_reviewed: true,
  summary_reviewed: true,
  summary_for_merge: "P24 implementou o contrato do braço GitHub/PR com enforcement.",
  reason_merge_ok: "Todos os gates passaram, sem drift, sem regressão, P23 compliant.",
  approval_status: "approved",
};

// ── S1. classifyGitHubPrAction — pre-merge allowed action (open_branch) ──
console.log("S1. classifyGitHubPrAction — pre-merge allowed action (open_branch)");
{
  const r = classifyGitHubPrAction("open_branch");
  assert(r.action === "open_branch", "action is open_branch");
  assert(r.arm_id === GITHUB_PR_ARM_ID, "arm_id is p24");
  assert(r.belongs_to_github_arm === true, "belongs to github arm");
  assert(r.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "level is autonomous");
}

// ── S2. classifyGitHubPrAction — pre-merge allowed action (update_pr) ──
console.log("S2. classifyGitHubPrAction — pre-merge allowed action (update_pr)");
{
  const r = classifyGitHubPrAction("update_pr");
  assert(r.action === "update_pr", "action is update_pr");
  assert(r.belongs_to_github_arm === true, "belongs to github arm");
  assert(r.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "level is autonomous");
}

// ── S3. classifyGitHubPrAction — merge_to_main requires formal approval ──
console.log("S3. classifyGitHubPrAction — merge_to_main requires formal approval");
{
  const r = classifyGitHubPrAction("merge_to_main");
  assert(r.action === "merge_to_main", "action is merge_to_main");
  assert(r.belongs_to_github_arm === true, "belongs to github arm");
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "level is requires_human");
}

// ── S4. classifyGitHubPrAction — prohibited action (generate_drift) ──
console.log("S4. classifyGitHubPrAction — prohibited action (generate_drift)");
{
  const r = classifyGitHubPrAction("generate_drift");
  assert(r.action === "generate_drift", "action is generate_drift");
  assert(r.belongs_to_github_arm === true, "belongs to github arm");
  assert(r.autonomy_level === AUTONOMY_LEVEL.PROHIBITED, "level is prohibited");
}

// ── S5. classifyGitHubPrAction — unknown action ──
console.log("S5. classifyGitHubPrAction — unknown action → not github arm");
{
  const r = classifyGitHubPrAction("deploy_worker");
  assert(r.action === "deploy_worker", "action is deploy_worker");
  assert(r.belongs_to_github_arm === false, "does NOT belong to github arm");
  assert(r.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "requires human by caution");
}

// ── S6. classifyGitHubPrAction — throws on empty ──
console.log("S6. classifyGitHubPrAction — throws on empty");
assertThrows(() => classifyGitHubPrAction(""), "empty string throws");
assertThrows(() => classifyGitHubPrAction(), "undefined throws");

// ── S7. evaluateMergeReadiness — all gates pass ──
console.log("S7. evaluateMergeReadiness — all gates pass");
{
  const r = evaluateMergeReadiness({
    contract_rechecked: true,
    phase_validated: true,
    no_regression: true,
    diff_reviewed: true,
    summary_reviewed: true,
    summary_for_merge: "Tudo feito conforme contrato.",
    reason_merge_ok: "Sem regressão, P23 ok.",
  });
  assert(r.is_ready === true, "is_ready true");
  assert(r.failed_gates.length === 0, "no failed gates");
  assert(r.summary_for_merge !== null, "summary present");
  assert(r.reason_merge_ok !== null, "reason present");
}

// ── S8. evaluateMergeReadiness — missing summary blocks ──
console.log("S8. evaluateMergeReadiness — missing summary blocks");
{
  const r = evaluateMergeReadiness({
    contract_rechecked: true,
    phase_validated: true,
    no_regression: true,
    diff_reviewed: true,
    summary_reviewed: true,
    summary_for_merge: "",
    reason_merge_ok: "ok",
  });
  assert(r.is_ready === false, "not ready");
  assert(r.failed_gates.includes("summary_for_merge_present"), "summary gate failed");
}

// ── S9. evaluateMergeReadiness — missing reason blocks ──
console.log("S9. evaluateMergeReadiness — missing reason blocks");
{
  const r = evaluateMergeReadiness({
    contract_rechecked: true,
    phase_validated: true,
    no_regression: true,
    diff_reviewed: true,
    summary_reviewed: true,
    summary_for_merge: "ok",
    reason_merge_ok: "",
  });
  assert(r.is_ready === false, "not ready");
  assert(r.failed_gates.includes("reason_merge_ok_present"), "reason gate failed");
}

// ── S10. evaluateMergeReadiness — missing boolean gate blocks ──
console.log("S10. evaluateMergeReadiness — missing boolean gate (no_regression)");
{
  const r = evaluateMergeReadiness({
    contract_rechecked: true,
    phase_validated: true,
    no_regression: false,
    diff_reviewed: true,
    summary_reviewed: true,
    summary_for_merge: "ok",
    reason_merge_ok: "ok",
  });
  assert(r.is_ready === false, "not ready");
  assert(r.failed_gates.includes("no_regression"), "no_regression gate failed");
}

// ── S11. evaluateMergeReadiness — throws on missing context ──
console.log("S11. evaluateMergeReadiness — throws on missing context");
assertThrows(() => evaluateMergeReadiness(), "undefined throws");
assertThrows(() => evaluateMergeReadiness(null), "null throws");

// ── S12. buildMergeGateState — not ready ──
console.log("S12. buildMergeGateState — not ready");
{
  const readiness = evaluateMergeReadiness({ summary_for_merge: "", reason_merge_ok: "" });
  const r = buildMergeGateState({ merge_readiness: readiness, approval_status: "none" });
  assert(r.merge_status === MERGE_STATUS.NOT_READY, "status is not_ready");
  assert(r.can_merge === false, "cannot merge");
}

// ── S13. buildMergeGateState — ready + awaiting approval ──
console.log("S13. buildMergeGateState — ready + awaiting approval");
{
  const readiness = evaluateMergeReadiness({
    contract_rechecked: true, phase_validated: true, no_regression: true,
    diff_reviewed: true, summary_reviewed: true,
    summary_for_merge: "done", reason_merge_ok: "ok",
  });
  const r = buildMergeGateState({ merge_readiness: readiness, approval_status: "pending" });
  assert(r.merge_status === MERGE_STATUS.AWAITING_APPROVAL, "status is awaiting_approval");
  assert(r.can_merge === false, "cannot merge without approval");
}

// ── S14. buildMergeGateState — ready + approved → can merge ──
console.log("S14. buildMergeGateState — ready + approved → can merge");
{
  const readiness = evaluateMergeReadiness({
    contract_rechecked: true, phase_validated: true, no_regression: true,
    diff_reviewed: true, summary_reviewed: true,
    summary_for_merge: "done", reason_merge_ok: "ok",
  });
  const r = buildMergeGateState({ merge_readiness: readiness, approval_status: "approved" });
  assert(r.merge_status === MERGE_STATUS.APPROVED, "status is approved");
  assert(r.can_merge === true, "can merge");
}

// ── S15. buildMergeGateState — ready + rejected → blocked ──
console.log("S15. buildMergeGateState — ready + rejected → blocked");
{
  const readiness = evaluateMergeReadiness({
    contract_rechecked: true, phase_validated: true, no_regression: true,
    diff_reviewed: true, summary_reviewed: true,
    summary_for_merge: "done", reason_merge_ok: "ok",
  });
  const r = buildMergeGateState({ merge_readiness: readiness, approval_status: "rejected" });
  assert(r.merge_status === MERGE_STATUS.BLOCKED, "status is blocked");
  assert(r.can_merge === false, "cannot merge");
}

// ── S16. buildMergeGateState — throws on invalid approval_status ──
console.log("S16. buildMergeGateState — throws on invalid approval_status");
{
  const readiness = evaluateMergeReadiness({
    contract_rechecked: true, phase_validated: true, no_regression: true,
    diff_reviewed: true, summary_reviewed: true,
    summary_for_merge: "done", reason_merge_ok: "ok",
  });
  assertThrows(() => buildMergeGateState({ merge_readiness: readiness, approval_status: "invalid" }), "invalid status throws");
  assertThrows(() => buildMergeGateState({}), "missing merge_readiness throws");
}

// ── S17. enforceGitHubPrArm — allowed pre-merge action (review_diff) ──
console.log("S17. enforceGitHubPrArm — allowed pre-merge action (review_diff)");
{
  const r = enforceGitHubPrArm({
    action: "review_diff",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    drift_detected: false,
    regression_detected: false,
  });
  assert(r.allowed === true, "allowed");
  assert(r.blocked === false, "not blocked");
  assert(r.arm_id === GITHUB_PR_ARM_ID, "correct arm");
  assert(r.action === "review_diff", "correct action");
  assert(r.p23_compliance !== null, "p23 checked");
  assert(r.p23_compliance.is_compliant === true, "p23 compliant");
}

// ── S18. enforceGitHubPrArm — blocked: prohibited action (silent_merge) ──
console.log("S18. enforceGitHubPrArm — blocked: prohibited action (silent_merge)");
{
  const r = enforceGitHubPrArm({
    action: "silent_merge",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.level === AUTONOMY_LEVEL.PROHIBITED, "level is prohibited");
}

// ── S19. enforceGitHubPrArm — blocked: action outside github arm ──
console.log("S19. enforceGitHubPrArm — blocked: action outside github arm");
{
  const r = enforceGitHubPrArm({
    action: "deploy_worker",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.level === "blocked_not_github_arm", "correct level");
}

// ── S20. enforceGitHubPrArm — blocked: out of scope ──
console.log("S20. enforceGitHubPrArm — blocked: out of scope");
{
  const r = enforceGitHubPrArm({
    action: "open_branch",
    scope_approved: false,
    gates_context: ALL_GATES_OK,
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.level === "blocked_out_of_scope", "correct level");
}

// ── S21. enforceGitHubPrArm — blocked: drift detected ──
console.log("S21. enforceGitHubPrArm — blocked: drift detected");
{
  const r = enforceGitHubPrArm({
    action: "update_pr",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    drift_detected: true,
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.level === "blocked_drift_detected", "correct level");
}

// ── S22. enforceGitHubPrArm — blocked: regression detected ──
console.log("S22. enforceGitHubPrArm — blocked: regression detected");
{
  const r = enforceGitHubPrArm({
    action: "update_pr",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    regression_detected: true,
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.level === "blocked_regression_detected", "correct level");
}

// ── S23. enforceGitHubPrArm — blocked: P23 gates fail ──
console.log("S23. enforceGitHubPrArm — blocked: P23 gates fail");
{
  const r = enforceGitHubPrArm({
    action: "open_pr",
    scope_approved: true,
    gates_context: { ...ALL_GATES_OK, scope_defined: false },
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.level === "blocked_p23_noncompliant", "correct level");
}

// ── S24. enforceGitHubPrArm — blocked: merge without merge_context ──
console.log("S24. enforceGitHubPrArm — blocked: merge without merge_context");
{
  const r = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.level === "blocked_merge_context_missing", "correct level");
}

// ── S25. enforceGitHubPrArm — blocked: merge without summary ──
console.log("S25. enforceGitHubPrArm — blocked: merge without summary");
{
  const r = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      summary_for_merge: "",
      approval_status: "approved",
    },
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.merge_gate !== null, "merge_gate present");
  assert(r.merge_gate.merge_status === MERGE_STATUS.NOT_READY, "status not_ready");
}

// ── S26. enforceGitHubPrArm — blocked: merge without reason ──
console.log("S26. enforceGitHubPrArm — blocked: merge without reason");
{
  const r = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      reason_merge_ok: "",
      approval_status: "approved",
    },
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.merge_gate.merge_status === MERGE_STATUS.NOT_READY, "status not_ready");
}

// ── S27. enforceGitHubPrArm — blocked: merge awaiting approval ──
console.log("S27. enforceGitHubPrArm — blocked: merge awaiting approval (pending)");
{
  const r = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      approval_status: "pending",
    },
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.merge_gate.merge_status === MERGE_STATUS.AWAITING_APPROVAL, "awaiting approval");
  assert(r.merge_gate.summary_for_merge !== null, "summary present");
  assert(r.merge_gate.reason_merge_ok !== null, "reason present");
}

// ── S28. enforceGitHubPrArm — allowed: merge with everything ok + approved ──
console.log("S28. enforceGitHubPrArm — allowed: merge with everything ok + approved");
{
  const r = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: FULL_MERGE_CONTEXT,
  });
  assert(r.allowed === true, "allowed");
  assert(r.blocked === false, "not blocked");
  assert(r.merge_gate !== null, "merge_gate present");
  assert(r.merge_gate.merge_status === MERGE_STATUS.APPROVED, "status approved");
  assert(r.merge_gate.can_merge === true, "can merge");
  assert(r.merge_gate.summary_for_merge !== null, "summary present");
  assert(r.merge_gate.reason_merge_ok !== null, "reason present");
}

// ── S29. enforceGitHubPrArm — throws on invalid params ──
console.log("S29. enforceGitHubPrArm — throws on invalid params");
assertThrows(() => enforceGitHubPrArm({}), "missing action throws");
assertThrows(() => enforceGitHubPrArm({ action: "open_branch" }), "missing scope_approved throws");
assertThrows(() => enforceGitHubPrArm({ action: "open_branch", scope_approved: true }), "missing gates_context throws");

// ── S30. catalogues — pre-merge and prohibited are disjoint ──
console.log("S30. catalogues — pre-merge and prohibited are disjoint");
{
  const overlap = PRE_MERGE_ALLOWED_ACTIONS.filter(a => PROHIBITED_ACTIONS_P24.includes(a));
  assert(overlap.length === 0, "no overlap between pre-merge allowed and prohibited");
}

// ── S31. catalogues — no overlap between P24 prohibited and P23 allowed ──
console.log("S31. catalogues — no overlap between P24 prohibited and P23 allowed");
{
  const overlap = PROHIBITED_ACTIONS_P24.filter(a => ALLOWED_ACTIONS.includes(a));
  assert(overlap.length === 0, "no overlap between P24 prohibited and P23 allowed");
}

// ── S32. GITHUB_PR_ARM_ID is canonical ──
console.log("S32. GITHUB_PR_ARM_ID is canonical");
assert(GITHUB_PR_ARM_ID === "p24_github_pr_arm", "arm id is p24_github_pr_arm");

// ── S33. MERGE_STATUS enum is complete ──
console.log("S33. MERGE_STATUS enum is complete");
assert(MERGE_STATUS.NOT_READY === "not_ready", "NOT_READY present");
assert(MERGE_STATUS.AWAITING_APPROVAL === "awaiting_formal_approval", "AWAITING_APPROVAL present");
assert(MERGE_STATUS.APPROVED === "approved_for_merge", "APPROVED present");
assert(MERGE_STATUS.MERGED === "merged", "MERGED present");
assert(MERGE_STATUS.BLOCKED === "blocked", "BLOCKED present");

// ── S34. classifyGitHubPrAction — all pre-merge actions are autonomous ──
console.log("S34. all pre-merge actions classify as autonomous");
{
  for (const action of PRE_MERGE_ALLOWED_ACTIONS) {
    const r = classifyGitHubPrAction(action);
    assert(r.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, `${action} is autonomous`);
    assert(r.belongs_to_github_arm === true, `${action} belongs to github arm`);
  }
}

// ── S35. classifyGitHubPrAction — all prohibited actions are prohibited ──
console.log("S35. all prohibited actions classify as prohibited");
{
  for (const action of PROHIBITED_ACTIONS_P24) {
    const r = classifyGitHubPrAction(action);
    assert(r.autonomy_level === AUTONOMY_LEVEL.PROHIBITED, `${action} is prohibited`);
  }
}

// ── S36. enforceGitHubPrArm — blocked: merge rejected ──
console.log("S36. enforceGitHubPrArm — blocked: merge rejected");
{
  const r = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      approval_status: "rejected",
    },
  });
  assert(r.allowed === false, "not allowed");
  assert(r.blocked === true, "blocked");
  assert(r.merge_gate.merge_status === MERGE_STATUS.BLOCKED, "merge blocked");
}

// ── S37. evaluateMergeReadiness — all boolean gates false ──
console.log("S37. evaluateMergeReadiness — all boolean gates false");
{
  const r = evaluateMergeReadiness({
    contract_rechecked: false,
    phase_validated: false,
    no_regression: false,
    diff_reviewed: false,
    summary_reviewed: false,
    summary_for_merge: "",
    reason_merge_ok: "",
  });
  assert(r.is_ready === false, "not ready");
  assert(r.failed_gates.length === 7, "7 failed gates");
}

// ── S38. enforceGitHubPrArm — all 9 pre-merge actions pass within scope ──
console.log("S38. enforceGitHubPrArm — all 9 pre-merge actions pass within scope");
{
  for (const action of PRE_MERGE_ALLOWED_ACTIONS) {
    const r = enforceGitHubPrArm({
      action,
      scope_approved: true,
      gates_context: ALL_GATES_OK,
    });
    assert(r.allowed === true, `${action} allowed`);
    assert(r.arm_id === GITHUB_PR_ARM_ID, `${action} correct arm`);
  }
}

// ── SUMMARY ──
console.log(`\n${"=".repeat(60)}`);
console.log(`P24 GitHub/PR Arm Contract — Smoke Tests`);
console.log(`Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) {
  console.error(`\n❌ ${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} tests passed`);
}
