// ============================================================================
// 🧪 P25-PR4 — getBrowserArmState expanded shape smoke tests
//
// Run: node tests/p25-pr4-browser-arm-state.smoke.test.js
//
// Proves that getBrowserArmState() returns the expanded shape with:
//   - suggestions array (always present, empty by default)
//   - target_url and result_summary in last_execution
//   - block state when enforcement blocks an action
//   - status = "disabled" when blocked
// ============================================================================

import {
  executeBrowserArmAction,
  getBrowserArmState,
  resetBrowserArmState,
} from "../contract-executor.js";

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

// Standard P23 gates context (all pass)
const ALL_GATES_OK = {
  scope_defined: true,
  environment_defined: true,
  risk_assessed: true,
  authorization_present_when_required: true,
  observability_preserved: true,
  evidence_available_when_required: true,
};

console.log("\n🧪 P25-PR4 — getBrowserArmState expanded shape\n");

// ── T1: Initial state has suggestions array ────────────────────────────────
resetBrowserArmState();
const initial = getBrowserArmState();
assert(initial.ok === true, "T1: getBrowserArmState returns ok=true");
assert(Array.isArray(initial.suggestions), "T1: suggestions is array");
assert(initial.suggestions.length === 0, "T1: suggestions empty by default");
assert(initial.status === "idle", "T1: initial status is idle");

// ── T2: After allowed action (no executor URL) — enforcement-only ─────────
resetBrowserArmState();
const r2 = await executeBrowserArmAction({
  action: "navigate",
  scope_approved: true,
  gates_context: ALL_GATES_OK,
});
assert(r2.ok === true, "T2: allowed action returns ok=true");

const s2 = getBrowserArmState();
assert(s2.status === "active", "T2: status is active after allowed action");
assert(s2.last_execution != null, "T2: last_execution is set");
assert(s2.last_execution.execution_status === "executed", "T2: execution_status is 'executed'");
assert("target_url" in s2.last_execution, "T2: target_url field exists in last_execution");
assert("result_summary" in s2.last_execution, "T2: result_summary field exists in last_execution");
assert(s2.last_execution.target_url === null, "T2: target_url is null (no executor URL)");
assert(s2.last_execution.result_summary === null, "T2: result_summary is null (no executor URL)");
assert(Array.isArray(s2.suggestions), "T2: suggestions array present");
assert(s2.block === undefined || s2.block === null || !s2.block, "T2: no block state after allowed action");

// ── T3: After blocked action (scope not approved) ─────────────────────────
resetBrowserArmState();
const r3 = await executeBrowserArmAction({
  action: "navigate",
  scope_approved: false,
  gates_context: ALL_GATES_OK,
});
assert(r3.ok === false, "T3: blocked action returns ok=false");

const s3 = getBrowserArmState();
assert(s3.status === "disabled", "T3: status is 'disabled' after blocked action");
assert(s3.last_execution != null, "T3: last_execution is set after block");
assert(s3.last_execution.execution_status === "blocked", "T3: execution_status is 'blocked'");
assert(s3.block != null, "T3: block object present");
assert(s3.block.blocked === true, "T3: block.blocked is true");
assert(typeof s3.block.reason === "string" && s3.block.reason.length > 0, "T3: block.reason is non-empty string");
assert(s3.block.suggestion_required === true, "T3: block.suggestion_required is true for out-of-scope");
assert(s3.block.level === "blocked_out_of_scope", "T3: block.level is 'blocked_out_of_scope'");

// ── T4: After prohibited action ───────────────────────────────────────────
resetBrowserArmState();
const r4 = await executeBrowserArmAction({
  action: "exit_scope",
  scope_approved: true,
  gates_context: ALL_GATES_OK,
});
assert(r4.ok === false, "T4: prohibited action returns ok=false");

const s4 = getBrowserArmState();
assert(s4.status === "disabled", "T4: status is 'disabled' after prohibited action");
assert(s4.block != null, "T4: block object present for prohibited");
assert(s4.block.blocked === true, "T4: block.blocked is true for prohibited");
assert(s4.block.suggestion_required === false, "T4: suggestion_required is false for prohibited");

// ── T5: Reset clears everything ───────────────────────────────────────────
resetBrowserArmState();
const s5 = getBrowserArmState();
assert(s5.status === "idle", "T5: reset restores idle status");
assert(s5.last_execution === undefined || s5.last_execution === null || !s5.last_execution, "T5: reset clears last_execution");
assert(Array.isArray(s5.suggestions), "T5: suggestions array present after reset");
assert(s5.suggestions.length === 0, "T5: suggestions empty after reset");

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n📊 P25-PR4 Backend: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
