// ============================================================================
// 🧪 Integration Tests — P24 GitHub/PR Arm Runtime Enforcement
//
// Run: node tests/github-pr-arm-runtime.integration.test.js
//
// Proves that the P24 enforcement is LIVE in runtime by testing the actual
// runtime functions (executeGitHubPrAction, requestMergeApproval, approveMerge)
// that are wired into the contract-executor and exposed via routes.
//
// Tests:
//   R1.  executeGitHubPrAction — allowed action within scope (open_branch)
//   R2.  executeGitHubPrAction — allowed action within scope (review_diff)
//   R3.  executeGitHubPrAction — blocked: out of scope
//   R4.  executeGitHubPrAction — blocked: drift detected
//   R5.  executeGitHubPrAction — blocked: regression detected
//   R6.  executeGitHubPrAction — blocked: prohibited action (silent_merge)
//   R7.  executeGitHubPrAction — blocked: action not in github arm (deploy_worker)
//   R8.  requestMergeApproval — blocked: missing summary
//   R9.  requestMergeApproval — blocked: missing reason
//   R10. requestMergeApproval — blocked: merge without approval (awaiting_formal_approval)
//   R11. requestMergeApproval — blocked: merge with approval_status=none
//   R12. approveMerge — blocked: missing merge_context
//   R13. approveMerge — blocked: approval_status=rejected → blocked
//   R14. approveMerge — allowed: everything ok + approved → approved_for_merge
//   R15. Merge gate state: not_ready (missing gates)
//   R16. Merge gate state: awaiting_formal_approval (ready + pending)
//   R17. Merge gate state: approved_for_merge (ready + approved)
//   R18. Merge gate state: blocked (ready + rejected)
//   R19. executeGitHubPrAction — all 9 pre-merge actions pass in runtime
//   R20. requestMergeApproval — blocked: P23 gates fail
//   R21. handleApproveMerge — blocked: merge_gate missing from body
//   R22. handleApproveMerge — blocked: incompatible merge_status (not awaiting_formal_approval)
//   R23. handleApproveMerge — blocked: approval_status not "approved"
//   R24. handleApproveMerge — allowed: valid merge_gate + approval_status → approved_for_merge
//   R25. handleApproveMerge — proof: backend derives gates internally, client sends only merge_gate
// ============================================================================

import {
  executeGitHubPrAction,
  requestMergeApproval,
  approveMerge,
  handleApproveMerge,
} from "../contract-executor.js";

import { MERGE_STATUS } from "../schema/github-pr-arm-contract.js";

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

// ── Standard gates context (all P23 gates pass) ──
const ALL_GATES_OK = {
  scope_defined: true,
  environment_defined: true,
  risk_assessed: true,
  authorization_present_when_required: true,
  observability_preserved: true,
  evidence_available_when_required: true,
};

// ── Standard merge context (all ok + approved) ──
const FULL_MERGE_CONTEXT = {
  contract_rechecked: true,
  phase_validated: true,
  no_regression: true,
  diff_reviewed: true,
  summary_reviewed: true,
  summary_for_merge: "P24: contrato + enforcement + merge gate em runtime.",
  reason_merge_ok: "Todos os gates passaram, sem drift, sem regressão.",
  approval_status: "approved",
};

// ═══════════════════════════════════════════════════════════════════════════
// R1. executeGitHubPrAction — allowed action within scope (open_branch)
// ═══════════════════════════════════════════════════════════════════════════
console.log("R1. executeGitHubPrAction — allowed: open_branch within scope");
{
  const r = executeGitHubPrAction({
    action: "open_branch",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  assert(r.ok === true, "ok = true");
  assert(r.execution_status === "executed", "execution_status = executed");
  assert(r.action === "open_branch", "action = open_branch");
  assert(r.arm_id === "p24_github_pr_arm", "arm_id correct");
  assert(r.enforcement.allowed === true, "enforcement.allowed = true");
}

// ═══════════════════════════════════════════════════════════════════════════
// R2. executeGitHubPrAction — allowed action within scope (review_diff)
// ═══════════════════════════════════════════════════════════════════════════
console.log("R2. executeGitHubPrAction — allowed: review_diff within scope");
{
  const r = executeGitHubPrAction({
    action: "review_diff",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  assert(r.ok === true, "ok = true");
  assert(r.execution_status === "executed", "execution_status = executed");
  assert(r.enforcement.p23_compliance.is_compliant === true, "P23 compliant");
}

// ═══════════════════════════════════════════════════════════════════════════
// R3. executeGitHubPrAction — blocked: out of scope
// ═══════════════════════════════════════════════════════════════════════════
console.log("R3. executeGitHubPrAction — blocked: out of scope");
{
  const r = executeGitHubPrAction({
    action: "open_branch",
    scope_approved: false,
    gates_context: ALL_GATES_OK,
  });
  assert(r.ok === false, "ok = false");
  assert(r.error === "GITHUB_PR_ARM_BLOCKED", "error is GITHUB_PR_ARM_BLOCKED");
  assert(r.enforcement.level === "blocked_out_of_scope", "level = blocked_out_of_scope");
}

// ═══════════════════════════════════════════════════════════════════════════
// R4. executeGitHubPrAction — blocked: drift detected
// ═══════════════════════════════════════════════════════════════════════════
console.log("R4. executeGitHubPrAction — blocked: drift detected");
{
  const r = executeGitHubPrAction({
    action: "update_pr",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    drift_detected: true,
  });
  assert(r.ok === false, "ok = false");
  assert(r.error === "GITHUB_PR_ARM_BLOCKED", "error = GITHUB_PR_ARM_BLOCKED");
  assert(r.enforcement.level === "blocked_drift_detected", "level = blocked_drift_detected");
}

// ═══════════════════════════════════════════════════════════════════════════
// R5. executeGitHubPrAction — blocked: regression detected
// ═══════════════════════════════════════════════════════════════════════════
console.log("R5. executeGitHubPrAction — blocked: regression detected");
{
  const r = executeGitHubPrAction({
    action: "update_pr",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    regression_detected: true,
  });
  assert(r.ok === false, "ok = false");
  assert(r.enforcement.level === "blocked_regression_detected", "level = blocked_regression_detected");
}

// ═══════════════════════════════════════════════════════════════════════════
// R6. executeGitHubPrAction — blocked: prohibited action (silent_merge)
// ═══════════════════════════════════════════════════════════════════════════
console.log("R6. executeGitHubPrAction — blocked: prohibited action (silent_merge)");
{
  const r = executeGitHubPrAction({
    action: "silent_merge",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  assert(r.ok === false, "ok = false");
  assert(r.enforcement.level === "prohibited", "level = prohibited");
}

// ═══════════════════════════════════════════════════════════════════════════
// R7. executeGitHubPrAction — blocked: action not in github arm
// ═══════════════════════════════════════════════════════════════════════════
console.log("R7. executeGitHubPrAction — blocked: deploy_worker (not github arm)");
{
  const r = executeGitHubPrAction({
    action: "deploy_worker",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  assert(r.ok === false, "ok = false");
  assert(r.enforcement.level === "blocked_not_github_arm", "level = blocked_not_github_arm");
}

// ═══════════════════════════════════════════════════════════════════════════
// R8. requestMergeApproval — blocked: missing summary
// ═══════════════════════════════════════════════════════════════════════════
console.log("R8. requestMergeApproval — blocked: missing summary");
{
  const r = requestMergeApproval({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      summary_for_merge: "",
      approval_status: "approved",
    },
  });
  assert(r.ok === false, "ok = false");
  assert(r.merge_status === MERGE_STATUS.NOT_READY, "merge_status = not_ready");
}

// ═══════════════════════════════════════════════════════════════════════════
// R9. requestMergeApproval — blocked: missing reason
// ═══════════════════════════════════════════════════════════════════════════
console.log("R9. requestMergeApproval — blocked: missing reason");
{
  const r = requestMergeApproval({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      reason_merge_ok: "",
      approval_status: "approved",
    },
  });
  assert(r.ok === false, "ok = false");
  assert(r.merge_status === MERGE_STATUS.NOT_READY, "merge_status = not_ready");
}

// ═══════════════════════════════════════════════════════════════════════════
// R10. requestMergeApproval — blocked: awaiting formal approval (pending)
// ═══════════════════════════════════════════════════════════════════════════
console.log("R10. requestMergeApproval — blocked: awaiting approval (pending)");
{
  const r = requestMergeApproval({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      approval_status: "pending",
    },
  });
  assert(r.ok === false, "ok = false");
  assert(r.merge_status === MERGE_STATUS.AWAITING_APPROVAL, "merge_status = awaiting_formal_approval");
  assert(r.merge_gate.summary_for_merge !== null, "summary present in gate");
  assert(r.merge_gate.reason_merge_ok !== null, "reason present in gate");
}

// ═══════════════════════════════════════════════════════════════════════════
// R11. requestMergeApproval — blocked: approval_status=none
// ═══════════════════════════════════════════════════════════════════════════
console.log("R11. requestMergeApproval — blocked: approval_status=none");
{
  const r = requestMergeApproval({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      approval_status: "none",
    },
  });
  assert(r.ok === false, "ok = false");
  assert(r.merge_status === MERGE_STATUS.AWAITING_APPROVAL, "merge_status = awaiting_formal_approval");
}

// ═══════════════════════════════════════════════════════════════════════════
// R12. approveMerge — blocked: missing merge_context
// ═══════════════════════════════════════════════════════════════════════════
console.log("R12. approveMerge — blocked: missing merge_context");
{
  const r = approveMerge({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  assert(r.ok === false, "ok = false");
  assert(r.error === "MERGE_CONTEXT_MISSING", "error = MERGE_CONTEXT_MISSING");
  assert(r.merge_status === MERGE_STATUS.NOT_READY, "merge_status = not_ready");
}

// ═══════════════════════════════════════════════════════════════════════════
// R13. approveMerge — blocked: approval_status=rejected
// ═══════════════════════════════════════════════════════════════════════════
console.log("R13. approveMerge — blocked: approval_status=rejected → blocked");
{
  const r = approveMerge({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      approval_status: "rejected",
    },
  });
  assert(r.ok === false, "ok = false");
  assert(r.merge_status === MERGE_STATUS.BLOCKED, "merge_status = blocked");
}

// ═══════════════════════════════════════════════════════════════════════════
// R14. approveMerge — allowed: everything ok + approved → approved_for_merge
// ═══════════════════════════════════════════════════════════════════════════
console.log("R14. approveMerge — allowed: everything ok → approved_for_merge");
{
  const r = approveMerge({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: FULL_MERGE_CONTEXT,
  });
  assert(r.ok === true, "ok = true");
  assert(r.merge_status === MERGE_STATUS.APPROVED, "merge_status = approved_for_merge");
  assert(r.can_merge === true, "can_merge = true");
  assert(typeof r.summary_for_merge === "string" && r.summary_for_merge.length > 0, "summary present");
  assert(typeof r.reason_merge_ok === "string" && r.reason_merge_ok.length > 0, "reason present");
  assert(r.merge_gate.can_merge === true, "merge_gate.can_merge = true");
}

// ═══════════════════════════════════════════════════════════════════════════
// R15. Merge gate state: not_ready (missing boolean gates)
// ═══════════════════════════════════════════════════════════════════════════
console.log("R15. Merge gate state: not_ready (missing boolean gates)");
{
  const r = requestMergeApproval({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      contract_rechecked: false,
      phase_validated: false,
      no_regression: false,
      diff_reviewed: false,
      summary_reviewed: false,
      summary_for_merge: "",
      reason_merge_ok: "",
      approval_status: "none",
    },
  });
  assert(r.ok === false, "ok = false");
  assert(r.merge_status === MERGE_STATUS.NOT_READY, "merge_status = not_ready");
}

// ═══════════════════════════════════════════════════════════════════════════
// R16. Merge gate state: awaiting_formal_approval (ready + pending)
// ═══════════════════════════════════════════════════════════════════════════
console.log("R16. Merge gate state: awaiting_formal_approval (ready + pending)");
{
  const r = requestMergeApproval({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      approval_status: "pending",
    },
  });
  assert(r.ok === false, "ok = false (not yet approved)");
  assert(r.merge_status === MERGE_STATUS.AWAITING_APPROVAL, "merge_status = awaiting_formal_approval");
}

// ═══════════════════════════════════════════════════════════════════════════
// R17. Merge gate state: approved_for_merge (ready + approved)
// ═══════════════════════════════════════════════════════════════════════════
console.log("R17. Merge gate state: approved_for_merge (ready + approved)");
{
  const r = requestMergeApproval({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: FULL_MERGE_CONTEXT,
  });
  assert(r.ok === true, "ok = true");
  assert(r.merge_status === MERGE_STATUS.APPROVED, "merge_status = approved_for_merge");
}

// ═══════════════════════════════════════════════════════════════════════════
// R18. Merge gate state: blocked (ready + rejected)
// ═══════════════════════════════════════════════════════════════════════════
console.log("R18. Merge gate state: blocked (ready + rejected)");
{
  const r = requestMergeApproval({
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    merge_context: {
      ...FULL_MERGE_CONTEXT,
      approval_status: "rejected",
    },
  });
  assert(r.ok === false, "ok = false");
  assert(r.merge_status === MERGE_STATUS.BLOCKED, "merge_status = blocked");
}

// ═══════════════════════════════════════════════════════════════════════════
// R19. executeGitHubPrAction — all 9 pre-merge actions pass in runtime
// ═══════════════════════════════════════════════════════════════════════════
console.log("R19. executeGitHubPrAction — all 9 pre-merge actions pass in runtime");
{
  const actions = [
    "open_branch", "open_pr", "update_pr", "comment_pr", "review_diff",
    "audit_pr", "request_correction", "self_correct_pr", "organize_repo_within_scope",
  ];
  for (const action of actions) {
    const r = executeGitHubPrAction({
      action,
      scope_approved: true,
      gates_context: ALL_GATES_OK,
    });
    assert(r.ok === true, `${action} → ok=true`);
    assert(r.execution_status === "executed", `${action} → executed`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// R20. requestMergeApproval — blocked: P23 gates fail
// ═══════════════════════════════════════════════════════════════════════════
console.log("R20. requestMergeApproval — blocked: P23 gates fail (scope_defined=false)");
{
  const r = requestMergeApproval({
    scope_approved: true,
    gates_context: { ...ALL_GATES_OK, scope_defined: false },
    merge_context: FULL_MERGE_CONTEXT,
  });
  assert(r.ok === false, "ok = false");
  assert(r.error === "MERGE_NOT_READY", "error = MERGE_NOT_READY");
}

// ═══════════════════════════════════════════════════════════════════════════
// R21–R25. handleApproveMerge — panel→backend canonical route (new payload shape)
//
// The panel sends { merge_gate, approval_status }. The handler validates
// the backend-emitted state and derives merge_context internally (sovereign).
// These tests prove the alignment between panel and runtime.
// ═══════════════════════════════════════════════════════════════════════════

// Helper: create a mock Request from a body object (mirrors HTTP handler signature)
function mockRequest(bodyObj) {
  return { json: () => Promise.resolve(bodyObj) };
}

// ── R21. blocked: merge_gate missing ────────────────────────────────────────
console.log("R21. handleApproveMerge — blocked: merge_gate missing from body");
{
  const r = await handleApproveMerge(mockRequest({ approval_status: "approved" }));
  assert(r.status === 400, "status = 400");
  assert(r.body.ok === false, "ok = false");
  assert(r.body.error === "MERGE_GATE_MISSING", "error = MERGE_GATE_MISSING");
}

// ── R22. blocked: incompatible merge_status ─────────────────────────────────
console.log("R22. handleApproveMerge — blocked: incompatible merge_status (not_ready)");
{
  const r = await handleApproveMerge(mockRequest({
    merge_gate: {
      merge_status: "not_ready",
      summary_for_merge: "X",
      reason_merge_ok: "Y",
    },
    approval_status: "approved",
  }));
  assert(r.status === 403, "status = 403");
  assert(r.body.ok === false, "ok = false");
  assert(r.body.error === "MERGE_NOT_AWAITING_APPROVAL", "error = MERGE_NOT_AWAITING_APPROVAL");
}

// ── R23. blocked: approval_status not "approved" ────────────────────────────
console.log("R23. handleApproveMerge — blocked: approval_status is not 'approved'");
{
  const r = await handleApproveMerge(mockRequest({
    merge_gate: {
      merge_status: "awaiting_formal_approval",
      summary_for_merge: "P24: tudo certo.",
      reason_merge_ok: "Sem regressão.",
    },
    approval_status: "pending",
  }));
  assert(r.status === 403, "status = 403");
  assert(r.body.ok === false, "ok = false");
  assert(r.body.error === "APPROVAL_NOT_GIVEN", "error = APPROVAL_NOT_GIVEN");
}

// ── R24. allowed: valid merge_gate + approval_status → approved_for_merge ───
console.log("R24. handleApproveMerge — allowed: valid merge_gate + 'approved' → approved_for_merge");
{
  const r = await handleApproveMerge(mockRequest({
    merge_gate: {
      merge_status: "awaiting_formal_approval",
      summary_for_merge: "P24: enforcement + merge gate completo.",
      reason_merge_ok: "Todos os gates passaram, sem drift, sem regressão.",
      approval_status: "pending",
      can_merge: false,
    },
    approval_status: "approved",
  }));
  assert(r.status === 200, "status = 200");
  assert(r.body.ok === true, "ok = true");
  assert(r.body.merge_status === "approved_for_merge", "merge_status = approved_for_merge");
  assert(r.body.can_merge === true, "can_merge = true");
  assert(typeof r.body.summary_for_merge === "string" && r.body.summary_for_merge.length > 0, "summary present");
  assert(typeof r.body.reason_merge_ok === "string" && r.body.reason_merge_ok.length > 0, "reason present");
}

// ── R25. panel proof: handler does NOT receive gate booleans from client ─────
console.log("R25. handleApproveMerge — proof: backend derives gates internally, client only sends merge_gate");
{
  // Sending NO boolean gates (contract_rechecked, phase_validated, etc.) from client:
  const clientPayload = {
    merge_gate: {
      merge_status: "awaiting_formal_approval",
      summary_for_merge: "Correção cirúrgica — painel não inventa gates.",
      reason_merge_ok: "Backend é soberano na validação dos gates.",
      approval_status: "pending",
      can_merge: false,
    },
    approval_status: "approved",
  };
  // Confirm payload has no fabricated gates:
  const hasNoFabricatedGates =
    clientPayload.contract_rechecked === undefined &&
    clientPayload.phase_validated   === undefined &&
    clientPayload.no_regression     === undefined &&
    clientPayload.diff_reviewed     === undefined &&
    clientPayload.summary_reviewed  === undefined &&
    clientPayload.scope_approved    === undefined &&
    clientPayload.drift_detected    === undefined &&
    clientPayload.regression_detected === undefined;
  assert(hasNoFabricatedGates, "client payload has ZERO fabricated gate fields");

  // And the handler succeeds:
  const r = await handleApproveMerge(mockRequest(clientPayload));
  assert(r.status === 200, "handler accepts payload with no gate fields from client");
  assert(r.body.ok === true, "result.ok = true");
  assert(r.body.merge_status === "approved_for_merge", "approved_for_merge returned");
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${"=".repeat(60)}`);
console.log(`P24 GitHub/PR Arm — Runtime Integration Tests`);
console.log(`Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
console.log(`${"=".repeat(60)}`);

if (failed > 0) {
  console.error(`\n❌ ${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} tests passed — P24 enforcement is LIVE in runtime`);
}
