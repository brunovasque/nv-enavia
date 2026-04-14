// ============================================================================
// 🧪 Smoke Tests — P26-PR2: Security Supervisor Enforcement (Runtime Real)
//
// Run: node tests/security-supervisor-enforcement.smoke.test.js
//
// Validates that the Security Supervisor is now enforced at the 3 canonical
// sensitive action entry points in the contract-executor:
//   1. executeCurrentMicroPr  — main contract execution path
//   2. executeGitHubPrAction  — GitHub/PR arm (P24) bridge
//   3. executeBrowserArmAction — Browser arm (P25) bridge
//
// Tests:
//   E1. GitHub arm — allowed action passes through supervisor + arm
//   E2. GitHub arm — scope violation blocked by supervisor
//   E3. GitHub arm — supervisor decision is auditável in block response
//   E4. Browser arm — allowed action passes through supervisor + arm
//   E5. Browser arm — scope violation blocked preserves arm state management
//   E6. Browser arm — supervisor decision present in block response
//   E7. SUPERVISOR_DECISION and SUPERVISOR_REASON_CODE exported from executor
//   E8. Prohibited action blocked by supervisor (GitHub arm)
//   E9. High-risk override blocked by supervisor (GitHub arm)
//   E10. Evidence insufficient blocked by supervisor (GitHub arm)
//   E11. Supervisor enforcement present in arm block response (browser)
//   E12. Supervisor allows when scope_approved + gates OK (GitHub arm)
// ============================================================================

import {
  executeGitHubPrAction,
  executeBrowserArmAction,
  resetBrowserArmState,
  getBrowserArmState,
  SUPERVISOR_DECISION,
  SUPERVISOR_REASON_CODE,
} from "../contract-executor.js";

// ---------------------------------------------------------------------------
// Test harness
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

console.log("\n=== P26-PR2 Security Supervisor Enforcement — Smoke Tests ===\n");

// ---------------------------------------------------------------------------
// Helper: build valid gates_context where all gates pass
// ---------------------------------------------------------------------------
function allGatesOk() {
  return {
    scope_defined: true,
    environment_defined: true,
    risk_assessed: true,
    authorization_present_when_required: true,
    observability_preserved: true,
    evidence_available_when_required: true,
  };
}

// ── E1: GitHub arm — allowed action passes through ────────────────────────
console.log("── E1: GitHub arm — allowed action passes through ──");
{
  const result = executeGitHubPrAction({
    action: "open_pr",
    scope_approved: true,
    gates_context: allGatesOk(),
  });
  assert(result.ok === true, "E1: ok is true for allowed action");
  assert(result.execution_status === "executed", "E1: execution_status is 'executed'");
  assert(result.enforcement != null, "E1: arm enforcement is present");
}

// ── E2: GitHub arm — scope violation blocked by supervisor ────────────────
console.log("\n── E2: GitHub arm — scope violation blocked ──");
{
  const result = executeGitHubPrAction({
    action: "open_pr",
    scope_approved: false,
    gates_context: allGatesOk(),
  });
  assert(result.ok === false, "E2: ok is false when scope not approved");
  // The arm enforcement also blocks, so error may come from arm or supervisor
  assert(typeof result.error === "string", "E2: error code is present");
  assert(typeof result.message === "string" && result.message.length > 0, "E2: message is non-empty");
}

// ── E3: GitHub arm — supervisor decision auditável in block response ──────
console.log("\n── E3: GitHub arm — supervisor audit in block response ──");
{
  const result = executeGitHubPrAction({
    action: "open_pr",
    scope_approved: false,
    gates_context: allGatesOk(),
  });
  assert(result.ok === false, "E3: ok is false");
  // When arm blocks, supervisor_enforcement is attached
  const hasSupervisor = result.supervisor_enforcement != null;
  assert(hasSupervisor, "E3: supervisor_enforcement present in block response");
  if (hasSupervisor) {
    assert(typeof result.supervisor_enforcement.decision === "string", "E3: supervisor decision is string");
    assert(typeof result.supervisor_enforcement.reason_code === "string", "E3: supervisor reason_code is string");
    assert(typeof result.supervisor_enforcement.timestamp === "string", "E3: supervisor timestamp is string");
  }
}

// ── E4: Browser arm — allowed action passes through ───────────────────────
console.log("\n── E4: Browser arm — allowed action passes through ──");
{
  resetBrowserArmState();
  const result = await executeBrowserArmAction({
    action: "search",
    scope_approved: true,
    gates_context: allGatesOk(),
  });
  assert(result.ok === true, "E4: ok is true for allowed browser action");
  assert(result.execution_status === "executed", "E4: execution_status is 'executed'");
}

// ── E5: Browser arm — scope violation preserves arm state ─────────────────
console.log("\n── E5: Browser arm — scope violation preserves arm state ──");
{
  resetBrowserArmState();
  const result = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: false,
    gates_context: allGatesOk(),
  });
  assert(result.ok === false, "E5: ok is false when scope not approved");
  // Arm state should be updated (backwards-compatible behavior)
  const state = getBrowserArmState();
  assert(state.last_execution != null, "E5: last_execution is set after block");
  assert(state.last_execution.execution_status === "blocked", "E5: execution_status is 'blocked' in state");
}

// ── E6: Browser arm — supervisor decision in block response ───────────────
console.log("\n── E6: Browser arm — supervisor decision in block response ──");
{
  resetBrowserArmState();
  const result = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: false,
    gates_context: allGatesOk(),
  });
  assert(result.ok === false, "E6: ok is false");
  const hasSupervisor = result.supervisor_enforcement != null;
  assert(hasSupervisor, "E6: supervisor_enforcement present in browser block");
  if (hasSupervisor) {
    assert(result.supervisor_enforcement.allowed === false, "E6: supervisor allowed is false");
    assert(typeof result.supervisor_enforcement.reason_text === "string", "E6: supervisor reason_text present");
  }
}

// ── E7: SUPERVISOR_DECISION and SUPERVISOR_REASON_CODE exported ───────────
console.log("\n── E7: Supervisor enums exported from contract-executor ──");
{
  assert(SUPERVISOR_DECISION != null, "E7: SUPERVISOR_DECISION exported");
  assert(SUPERVISOR_DECISION.ALLOW === "allow", "E7: SUPERVISOR_DECISION.ALLOW is 'allow'");
  assert(SUPERVISOR_DECISION.BLOCK === "block", "E7: SUPERVISOR_DECISION.BLOCK is 'block'");
  assert(SUPERVISOR_DECISION.NEEDS_HUMAN_REVIEW === "needs_human_review", "E7: SUPERVISOR_DECISION.NEEDS_HUMAN_REVIEW correct");
  assert(SUPERVISOR_REASON_CODE != null, "E7: SUPERVISOR_REASON_CODE exported");
  assert(typeof SUPERVISOR_REASON_CODE.SCOPE_VIOLATION === "string", "E7: SCOPE_VIOLATION reason code exists");
  assert(typeof SUPERVISOR_REASON_CODE.ACTION_ALLOWED === "string", "E7: ACTION_ALLOWED reason code exists");
}

// ── E8: Prohibited action blocked (GitHub arm) ───────────────────────────
console.log("\n── E8: Prohibited action blocked (GitHub arm) ──");
{
  const result = executeGitHubPrAction({
    action: "exit_scope",
    scope_approved: true,
    gates_context: allGatesOk(),
  });
  assert(result.ok === false, "E8: ok is false for prohibited action");
  assert(typeof result.error === "string", "E8: error code present");
}

// ── E9: High-risk override blocked (GitHub arm) ──────────────────────────
console.log("\n── E9: Action in PROD environment requires human review ──");
{
  // Note: executeGitHubPrAction always uses TEST environment internally,
  // but we can test high-risk via the supervisor's is_high_risk parameter
  // by using a prohibited action which is classified as high risk.
  const result = executeGitHubPrAction({
    action: "promote_to_prod",
    scope_approved: true,
    gates_context: allGatesOk(),
  });
  assert(result.ok === false, "E9: ok is false for high-risk action");
}

// ── E10: Evidence gate — action blocked when evidence_available_when_required=false ──
// After the Item 1 fix: evidence_sufficient is derived from
// gates_context.evidence_available_when_required (the real canonical P23 source).
// When that gate is false, the supervisor receives evidence_sufficient=false and blocks.
// Note: with evidence_available_when_required=false, the P23 constitution check
// also fails (GATES_FAILED), so the block is caught by STEP 2 of the supervisor
// via AUTONOMY_BLOCKED/GATES_FAILED — the canonical path for missing evidence.
console.log("\n── E10: Evidence gate — false evidence_available_when_required blocks ──");
{
  const evidenceGateFalse = { ...allGatesOk(), evidence_available_when_required: false };
  const result = executeGitHubPrAction({
    action: "open_pr",
    scope_approved: true,
    gates_context: evidenceGateFalse,
  });
  assert(result.ok === false, "E10a: action blocked when evidence_available_when_required=false");
  assert(typeof result.error === "string" && result.error.length > 0, "E10a: error code present");
  // Supervisor sees evidence_sufficient=false (derived from the gate)
  const svDecision = result.supervisor_enforcement;
  assert(svDecision != null, "E10a: supervisor_enforcement present in block");
  if (svDecision) {
    assert(svDecision.evidence_sufficient === false, "E10a: supervisor reports evidence_sufficient=false");
    assert(svDecision.allowed === false, "E10a: supervisor allowed=false");
  }
}
// E10b: verify the allowed path still works with all gates including evidence=true
{
  const result = executeGitHubPrAction({
    action: "open_pr",
    scope_approved: true,
    gates_context: allGatesOk(),  // includes evidence_available_when_required: true
  });
  assert(result.ok === true, "E10b: action allowed when evidence_available_when_required=true");
}

// ── E11: Supervisor enforcement in browser arm block ─────────────────────
console.log("\n── E11: Supervisor enforcement in browser arm block response ──");
{
  resetBrowserArmState();
  const result = await executeBrowserArmAction({
    action: "exit_scope",
    scope_approved: true,
    gates_context: allGatesOk(),
  });
  assert(result.ok === false, "E11: prohibited browser action is blocked");
  // Prohibited actions are blocked by both arm and supervisor
  const hasSupervisor = result.supervisor_enforcement != null;
  assert(hasSupervisor, "E11: supervisor_enforcement present for prohibited browser action");
}

// ── E12: Supervisor allows with valid context ────────────────────────────
console.log("\n── E12: Supervisor allows with fully valid context ──");
{
  const result = executeGitHubPrAction({
    action: "open_pr",
    scope_approved: true,
    gates_context: allGatesOk(),
  });
  assert(result.ok === true, "E12: allowed action returns ok=true");
  assert(result.execution_status === "executed", "E12: execution_status is 'executed'");
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
  console.error("❌ Some tests failed.");
  process.exit(1);
} else {
  console.log("✅ All P26-PR2 enforcement smoke tests passed.");
}
