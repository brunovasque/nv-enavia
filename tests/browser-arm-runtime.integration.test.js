// ============================================================================
// 🧪 Integration Tests — P25 Browser Arm Runtime Enforcement
//
// Run: node tests/browser-arm-runtime.integration.test.js
//
// Proves that the P25 enforcement is LIVE in runtime by testing the actual
// runtime functions (executeBrowserArmAction, handleBrowserArmAction,
// getBrowserArmState) that are wired into the contract-executor and
// exposed via routes.
//
// Tests:
//   R1.  executeBrowserArmAction — allowed action within scope (navigate)
//   R2.  executeBrowserArmAction — allowed action within scope (search)
//   R3.  executeBrowserArmAction — blocked: out of scope
//   R4.  executeBrowserArmAction — blocked: drift detected
//   R5.  executeBrowserArmAction — blocked: regression detected
//   R6.  executeBrowserArmAction — blocked: prohibited action (exit_scope)
//   R7.  executeBrowserArmAction — blocked: action not in browser arm (merge_to_main)
//   R8.  executeBrowserArmAction — blocked: conditional expand_scope without permission
//   R9.  executeBrowserArmAction — allowed: conditional expand_scope with permission
//   R10. executeBrowserArmAction — blocked: conditional delete without justification
//   R11. executeBrowserArmAction — allowed: conditional delete with justification
//   R12. executeBrowserArmAction — suggestion_required for out of scope
//   R13. executeBrowserArmAction — external_base present when allowed
//   R14. executeBrowserArmAction — all 9 allowed actions pass in runtime
//   R15. getBrowserArmState — returns initial state
//   R16. getBrowserArmState — arm_id is canonical
//   R17. getBrowserArmState — external_base is canonical
//   R18. handleBrowserArmAction — allowed action via handler
//   R19. handleBrowserArmAction — blocked action via handler
//   R20. handleBrowserArmAction — missing action returns 400
//   R21. executeBrowserArmAction — blocked: P23 gates fail
//   R22. handleBrowserArmAction — missing scope_approved returns 400
//   R23. handleBrowserArmAction — missing gates_context returns 400
//   R24. handleBrowserArmAction — missing both scope_approved and gates_context
//   R25. handleBrowserArmAction — scope_approved=false blocks via enforcement
//   R26. handleBrowserArmAction — full correct payload still works after hardening
// ============================================================================

import {
  executeBrowserArmAction,
  handleBrowserArmAction,
  getBrowserArmState,
  resetBrowserArmState,
} from "../contract-executor.js";

import {
  BROWSER_ARM_ID,
  BROWSER_EXTERNAL_BASE,
  BROWSER_ALLOWED_ACTIONS,
} from "../schema/browser-arm-contract.js";

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

// ── Gates with one fail ──
const GATES_FAIL = { ...ALL_GATES_OK, scope_defined: false };

console.log("\n============================================================");
console.log("P25 Browser Arm — Runtime Integration Tests");
console.log("============================================================\n");

// ── R1: Allowed action within scope ──
console.log("R1. executeBrowserArmAction — allowed action (navigate)");
{
  const r = await executeBrowserArmAction({ action: "navigate", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.ok === true, "result ok");
  assert(r.execution_status === "executed", "execution_status = executed");
  assert(r.arm_id === BROWSER_ARM_ID, "arm_id is canonical");
}

// ── R2: Allowed action within scope (search) ──
console.log("R2. executeBrowserArmAction — allowed action (search)");
{
  const r = await executeBrowserArmAction({ action: "search", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.ok === true, "result ok");
  assert(r.action === "search", "action is search");
}

// ── R3: Blocked out of scope ──
console.log("R3. executeBrowserArmAction — blocked: out of scope");
{
  const r = await executeBrowserArmAction({ action: "navigate", scope_approved: false, gates_context: ALL_GATES_OK });
  assert(r.ok === false, "blocked");
  assert(r.error === "BROWSER_ARM_BLOCKED", "error code correct");
  assert(r.suggestion_required === true, "suggestion_required for out of scope");
}

// ── R4: Blocked drift ──
console.log("R4. executeBrowserArmAction — blocked: drift detected");
{
  const r = await executeBrowserArmAction({ action: "navigate", scope_approved: true, gates_context: ALL_GATES_OK, drift_detected: true });
  assert(r.ok === false, "blocked by drift");
}

// ── R5: Blocked regression ──
console.log("R5. executeBrowserArmAction — blocked: regression detected");
{
  const r = await executeBrowserArmAction({ action: "navigate", scope_approved: true, gates_context: ALL_GATES_OK, regression_detected: true });
  assert(r.ok === false, "blocked by regression");
}

// ── R6: Blocked prohibited ──
console.log("R6. executeBrowserArmAction — blocked: prohibited action (exit_scope)");
{
  const r = await executeBrowserArmAction({ action: "exit_scope", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.ok === false, "blocked");
  assert(r.error === "BROWSER_ARM_BLOCKED", "error code correct");
}

// ── R7: Not in browser arm ──
console.log("R7. executeBrowserArmAction — blocked: action not in browser arm (merge_to_main)");
{
  const r = await executeBrowserArmAction({ action: "merge_to_main", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.ok === false, "blocked");
  assert(r.suggestion_required === true, "suggestion_required for action outside arm");
}

// ── R8: Conditional expand_scope without permission ──
console.log("R8. executeBrowserArmAction — blocked: expand_scope without permission");
{
  const r = await executeBrowserArmAction({ action: "expand_scope", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.ok === false, "blocked without permission");
  assert(r.suggestion_required === true, "suggestion_required for expand_scope");
}

// ── R9: Conditional expand_scope with permission ──
console.log("R9. executeBrowserArmAction — allowed: expand_scope with permission");
{
  const r = await executeBrowserArmAction({ action: "expand_scope", scope_approved: true, gates_context: ALL_GATES_OK, user_permission: true });
  assert(r.ok === true, "allowed with permission");
  assert(r.execution_status === "executed", "executed");
}

// ── R10: Conditional delete without justification ──
console.log("R10. executeBrowserArmAction — blocked: delete without justification");
{
  const r = await executeBrowserArmAction({ action: "delete", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.ok === false, "blocked without justification");
}

// ── R11: Conditional delete with justification ──
console.log("R11. executeBrowserArmAction — allowed: delete with justification");
{
  const r = await executeBrowserArmAction({ action: "delete", scope_approved: true, gates_context: ALL_GATES_OK, justification: "Remover cache temporário" });
  assert(r.ok === true, "allowed with justification");
}

// ── R12: Suggestion required ──
console.log("R12. executeBrowserArmAction — suggestion_required for out of scope");
{
  const r = await executeBrowserArmAction({ action: "search", scope_approved: false, gates_context: ALL_GATES_OK });
  assert(r.suggestion_required === true, "suggestion_required = true");
}

// ── R13: External base present ──
console.log("R13. executeBrowserArmAction — external_base present when allowed");
{
  const r = await executeBrowserArmAction({ action: "open_page", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.ok === true, "allowed");
  assert(r.external_base === BROWSER_EXTERNAL_BASE, "external_base present");
  assert(r.external_base.host === "run.nv-imoveis.com", "external_base host correct");
  assert(r.external_base.pattern === "run.nv-imoveis.com/*", "external_base pattern correct");
}

// ── R14: All 9 allowed actions pass in runtime ──
console.log("R14. executeBrowserArmAction — all 9 allowed actions pass in runtime");
{
  let allPass = true;
  for (const a of BROWSER_ALLOWED_ACTIONS) {
    const r = await executeBrowserArmAction({ action: a, scope_approved: true, gates_context: ALL_GATES_OK });
    if (!r.ok) allPass = false;
    assert(r.ok === true, `${a} passes runtime`);
    assert(r.arm_id === BROWSER_ARM_ID, `${a} correct arm_id`);
  }
  assert(allPass, "all 9 allowed actions pass runtime");
}

// ── R15–R17: getBrowserArmState ──
console.log("R15–R17. getBrowserArmState");
{
  resetBrowserArmState(); // Reset to test initial state shape
  const state = getBrowserArmState();
  assert(state.ok === true, "state ok");
  assert(state.arm_id === BROWSER_ARM_ID, "arm_id is canonical");
  assert(state.status === "idle", "initial status is idle");
  assert(state.external_base.host === "run.nv-imoveis.com", "external_base host");
  assert(state.external_base.pattern === "run.nv-imoveis.com/*", "external_base pattern");
  assert(state.last_action === null, "no last action");
}

// ── R18: handleBrowserArmAction — allowed ──
console.log("R18. handleBrowserArmAction — allowed action via handler");
{
  const mockRequest = {
    json: async () => ({
      action: "navigate",
      scope_approved: true,
      gates_context: ALL_GATES_OK,
    }),
  };
  const r = await handleBrowserArmAction(mockRequest, {});
  assert(r.status === 200, "status 200");
  assert(r.body.ok === true, "body ok");
  assert(r.body.arm_id === BROWSER_ARM_ID, "arm_id correct");
}

// ── R19: handleBrowserArmAction — blocked ──
console.log("R19. handleBrowserArmAction — blocked action via handler");
{
  const mockRequest = {
    json: async () => ({
      action: "exit_scope",
      scope_approved: true,
      gates_context: ALL_GATES_OK,
    }),
  };
  const r = await handleBrowserArmAction(mockRequest, {});
  assert(r.status === 403, "status 403");
  assert(r.body.ok === false, "body not ok");
}

// ── R20: handleBrowserArmAction — missing action ──
console.log("R20. handleBrowserArmAction — missing action returns 400");
{
  const mockRequest = {
    json: async () => ({}),
  };
  const r = await handleBrowserArmAction(mockRequest, {});
  assert(r.status === 400, "status 400");
  assert(r.body.error === "MISSING_ACTION", "error is MISSING_ACTION");
}

// ── R21: P23 gates fail ──
console.log("R21. executeBrowserArmAction — blocked: P23 gates fail");
{
  const r = await executeBrowserArmAction({ action: "navigate", scope_approved: true, gates_context: GATES_FAIL });
  assert(r.ok === false, "blocked by P23 gates");
  assert(r.error === "BROWSER_ARM_BLOCKED", "error code correct");
}

// ── R22: handleBrowserArmAction — missing scope_approved returns 400 ──
console.log("R22. handleBrowserArmAction — missing scope_approved returns 400");
{
  const mockRequest = {
    json: async () => ({
      action: "navigate",
      gates_context: ALL_GATES_OK,
      // scope_approved deliberately omitted
    }),
  };
  const r = await handleBrowserArmAction(mockRequest, {});
  assert(r.status === 400, "status 400 without scope_approved");
  assert(r.body.error === "MISSING_SCOPE_APPROVED", "error is MISSING_SCOPE_APPROVED");
  assert(r.body.ok === false, "body ok = false");
}

// ── R23: handleBrowserArmAction — missing gates_context returns 400 ──
console.log("R23. handleBrowserArmAction — missing gates_context returns 400");
{
  const mockRequest = {
    json: async () => ({
      action: "navigate",
      scope_approved: true,
      // gates_context deliberately omitted
    }),
  };
  const r = await handleBrowserArmAction(mockRequest, {});
  assert(r.status === 400, "status 400 without gates_context");
  assert(r.body.error === "MISSING_GATES_CONTEXT", "error is MISSING_GATES_CONTEXT");
  assert(r.body.ok === false, "body ok = false");
}

// ── R24: handleBrowserArmAction — missing both scope_approved and gates_context ──
console.log("R24. handleBrowserArmAction — missing both scope_approved and gates_context");
{
  const mockRequest = {
    json: async () => ({
      action: "navigate",
      // both deliberately omitted
    }),
  };
  const r = await handleBrowserArmAction(mockRequest, {});
  assert(r.status === 400, "status 400 without both");
  assert(r.body.ok === false, "body ok = false");
  // scope_approved is checked first
  assert(r.body.error === "MISSING_SCOPE_APPROVED", "checks scope_approved first");
}

// ── R25: handleBrowserArmAction — scope_approved=false with gates blocks correctly ──
console.log("R25. handleBrowserArmAction — scope_approved=false blocks via enforcement");
{
  const mockRequest = {
    json: async () => ({
      action: "navigate",
      scope_approved: false,
      gates_context: ALL_GATES_OK,
    }),
  };
  const r = await handleBrowserArmAction(mockRequest, {});
  assert(r.status === 403, "status 403 — enforcement blocked");
  assert(r.body.ok === false, "body ok = false");
  assert(r.body.error === "BROWSER_ARM_BLOCKED", "blocked by enforcement, not 400");
}

// ── R26: handleBrowserArmAction — full correct payload still works ──
console.log("R26. handleBrowserArmAction — full correct payload still works after hardening");
{
  const mockRequest = {
    json: async () => ({
      action: "search",
      scope_approved: true,
      gates_context: ALL_GATES_OK,
    }),
  };
  const r = await handleBrowserArmAction(mockRequest, {});
  assert(r.status === 200, "status 200 with full payload");
  assert(r.body.ok === true, "body ok = true");
  assert(r.body.arm_id === BROWSER_ARM_ID, "arm_id correct");
  assert(r.body.external_base.host === "run.nv-imoveis.com", "external_base intact");
}

// ============================================================
// Summary
// ============================================================
console.log("\n============================================================");
console.log(`P25 Browser Arm — Runtime Integration Tests`);
console.log(`Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
console.log("============================================================\n");

if (failed > 0) {
  console.error(`❌ ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log(`✅ All ${passed} tests passed — P25 enforcement is LIVE in runtime`);
}
