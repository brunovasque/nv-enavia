// ============================================================================
// 🧪 Smoke Tests — ENAVIA Browser Arm Contract v1.0 (P25)
//
// Run: node tests/browser-arm-contract.smoke.test.js
//
// Tests:
//   S1.  classifyBrowserArmAction — allowed action (open_page) is autonomous
//   S2.  classifyBrowserArmAction — allowed action (navigate) is autonomous
//   S3.  classifyBrowserArmAction — allowed action (search) is autonomous
//   S4.  classifyBrowserArmAction — allowed action (read_visual_result)
//   S5.  classifyBrowserArmAction — conditional action (upload) is autonomous w/ condition
//   S6.  classifyBrowserArmAction — conditional action (expand_scope) requires human
//   S7.  classifyBrowserArmAction — conditional action (delete) needs justification
//   S8.  classifyBrowserArmAction — prohibited action (exit_scope) → prohibited
//   S9.  classifyBrowserArmAction — prohibited action (mix_github_arm_with_browser_arm)
//   S10. classifyBrowserArmAction — unknown action → not browser arm, requires human
//   S11. classifyBrowserArmAction — throws on empty string
//   S12. validateSuggestion — valid suggestion passes
//   S13. validateSuggestion — missing fields fails
//   S14. validateSuggestion — invalid type fails
//   S15. validateSuggestion — null/undefined fails
//   S16. validateConditionalAction — expand_scope without permission blocked
//   S17. validateConditionalAction — expand_scope with permission allowed
//   S18. validateConditionalAction — delete without justification blocked
//   S19. validateConditionalAction — delete with justification allowed
//   S20. validateConditionalAction — upload always allowed (objective)
//   S21. validateConditionalAction — publish always allowed (objective)
//   S22. validateConditionalAction — non-conditional action passes
//   S23. enforceBrowserArm — allowed action within scope (navigate)
//   S24. enforceBrowserArm — blocked: prohibited action (generate_drift)
//   S25. enforceBrowserArm — blocked: action outside browser arm
//   S26. enforceBrowserArm — blocked: out of scope
//   S27. enforceBrowserArm — blocked: drift detected
//   S28. enforceBrowserArm — blocked: regression detected
//   S29. enforceBrowserArm — blocked: P23 gates fail
//   S30. enforceBrowserArm — blocked: conditional not met (expand_scope)
//   S31. enforceBrowserArm — allowed: conditional met (expand_scope + permission)
//   S32. enforceBrowserArm — suggestion_required for out_of_scope
//   S33. enforceBrowserArm — throws on invalid params
//   S34. catalogues — allowed and prohibited are disjoint
//   S35. BROWSER_ARM_ID is canonical string
//   S36. BROWSER_EXTERNAL_BASE — host is run.nv-imoveis.com
//   S37. BROWSER_EXTERNAL_BASE — pattern is run.nv-imoveis.com/*
//   S38. BROWSER_ARM_ROLE — has correct purpose array
//   S39. BROWSER_ARM_STATE_SHAPE — initial state has correct arm_id
//   S40. SUGGESTION_SHAPE — has all required fields
//   S41. RESEARCH_ROUTINE_SHAPE — has valid frequencies
//   S42. classifyBrowserArmAction — all 9 allowed actions are autonomous
//   S43. classifyBrowserArmAction — all 13 prohibited actions are prohibited
//   S44. BROWSER_ARM_OBLIGATIONS — contains key obligations
//   S45. enforceBrowserArm — all 9 allowed actions pass within scope
//   S46. enforceBrowserArm — blocked: conditional delete without justification
//   S47. enforceBrowserArm — allowed: conditional delete with justification
//   S48. validateSuggestion — all valid types accepted
// ============================================================================

import {
  BROWSER_ARM_ID,
  BROWSER_EXTERNAL_BASE,
  BROWSER_ARM_ROLE,
  BROWSER_ALLOWED_ACTIONS,
  BROWSER_CONDITIONAL_ACTIONS,
  CONDITIONAL_ACTION_RULES,
  PROHIBITED_ACTIONS_P25,
  BROWSER_ARM_OBLIGATIONS,
  SUGGESTION_SHAPE,
  validateSuggestion,
  RESEARCH_ROUTINE_SHAPE,
  BROWSER_ARM_STATE_SHAPE,
  classifyBrowserArmAction,
  validateConditionalAction,
  enforceBrowserArm,
} from "../schema/browser-arm-contract.js";

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
    console.log(`  ✅ ${label}`);
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
console.log("P25 Browser Arm Contract — Smoke Tests");
console.log("============================================================\n");

// ── S1–S4: Allowed actions ──
console.log("S1–S4. classifyBrowserArmAction — allowed actions");
{
  const r1 = classifyBrowserArmAction("open_page");
  assert(r1.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "open_page is autonomous");
  assert(r1.belongs_to_browser_arm === true, "open_page belongs to browser arm");

  const r2 = classifyBrowserArmAction("navigate");
  assert(r2.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "navigate is autonomous");

  const r3 = classifyBrowserArmAction("search");
  assert(r3.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "search is autonomous");

  const r4 = classifyBrowserArmAction("read_visual_result");
  assert(r4.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, "read_visual_result is autonomous");
  assert(r4.arm_id === BROWSER_ARM_ID, "arm_id is correct");
}

// ── S5–S7: Conditional actions ──
console.log("S5–S7. classifyBrowserArmAction — conditional actions");
{
  const r5 = classifyBrowserArmAction("upload");
  assert(r5.belongs_to_browser_arm === true, "upload belongs to browser arm");
  assert(r5.condition !== null, "upload has condition");

  const r6 = classifyBrowserArmAction("expand_scope");
  assert(r6.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "expand_scope requires human");
  assert(r6.condition.requires_user_permission === true, "expand_scope requires user permission");

  const r7 = classifyBrowserArmAction("delete");
  assert(r7.belongs_to_browser_arm === true, "delete belongs to browser arm");
  assert(r7.condition.requires_justification === true, "delete requires justification");
}

// ── S8–S9: Prohibited actions ──
console.log("S8–S9. classifyBrowserArmAction — prohibited actions");
{
  const r8 = classifyBrowserArmAction("exit_scope");
  assert(r8.autonomy_level === AUTONOMY_LEVEL.PROHIBITED, "exit_scope is prohibited");

  const r9 = classifyBrowserArmAction("mix_github_arm_with_browser_arm");
  assert(r9.autonomy_level === AUTONOMY_LEVEL.PROHIBITED, "mix_github_arm_with_browser_arm is prohibited");
}

// ── S10: Unknown action ──
console.log("S10. classifyBrowserArmAction — unknown action");
{
  const r10 = classifyBrowserArmAction("deploy_worker");
  assert(r10.belongs_to_browser_arm === false, "deploy_worker not in browser arm");
  assert(r10.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN, "unknown action requires human");
}

// ── S11: Throws on empty ──
console.log("S11. classifyBrowserArmAction — throws on empty");
assertThrows(() => classifyBrowserArmAction(""), "throws on empty string");
assertThrows(() => classifyBrowserArmAction(null), "throws on null");

// ── S12–S15: validateSuggestion ──
console.log("S12–S15. validateSuggestion");
{
  const validSuggestion = {
    type: "tool",
    discovery: "Playwright MCP server para automação de browser",
    benefit: "Permite navegação headless controlada pela Enavia",
    missing_requirement: "Instalar pacote playwright-mcp-server",
    expected_impact: "Browser Arm ganha capacidade de automação real",
    permission_needed: true,
  };
  const s12 = validateSuggestion(validSuggestion);
  assert(s12.valid === true, "valid suggestion passes");

  const s13 = validateSuggestion({ type: "tool" });
  assert(s13.valid === false, "missing fields fails");
  assert(s13.missing_fields.length > 0, "lists missing fields");

  const s14 = validateSuggestion({ ...validSuggestion, type: "invalid_type" });
  assert(s14.valid === false, "invalid type fails");

  const s15a = validateSuggestion(null);
  assert(s15a.valid === false, "null fails");
  const s15b = validateSuggestion(undefined);
  assert(s15b.valid === false, "undefined fails");
}

// ── S16–S22: validateConditionalAction ──
console.log("S16–S22. validateConditionalAction");
{
  const s16 = validateConditionalAction({ action: "expand_scope" });
  assert(s16.allowed === false, "expand_scope without permission blocked");

  const s17 = validateConditionalAction({ action: "expand_scope", user_permission: true });
  assert(s17.allowed === true, "expand_scope with permission allowed");

  const s18 = validateConditionalAction({ action: "delete" });
  assert(s18.allowed === false, "delete without justification blocked");

  const s19 = validateConditionalAction({ action: "delete", justification: "Necessário para limpar arquivo de teste do objetivo" });
  assert(s19.allowed === true, "delete with justification allowed");

  const s20 = validateConditionalAction({ action: "upload" });
  assert(s20.allowed === true, "upload allowed (objective context)");

  const s21 = validateConditionalAction({ action: "publish" });
  assert(s21.allowed === true, "publish allowed (objective context)");

  const s22 = validateConditionalAction({ action: "open_page" });
  assert(s22.allowed === true, "non-conditional action passes");
}

// ── S23–S33: enforceBrowserArm ──
console.log("S23. enforceBrowserArm — allowed action within scope");
{
  const r = enforceBrowserArm({ action: "navigate", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.allowed === true, "navigate allowed");
  assert(r.blocked === false, "not blocked");
  assert(r.arm_id === BROWSER_ARM_ID, "arm_id correct");
}

console.log("S24. enforceBrowserArm — blocked: prohibited action");
{
  const r = enforceBrowserArm({ action: "generate_drift", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.allowed === false, "prohibited not allowed");
  assert(r.blocked === true, "prohibited is blocked");
  assert(r.level === AUTONOMY_LEVEL.PROHIBITED, "level is prohibited");
}

console.log("S25. enforceBrowserArm — blocked: action outside browser arm");
{
  const r = enforceBrowserArm({ action: "deploy_worker", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.allowed === false, "outside arm not allowed");
  assert(r.suggestion_required === true, "suggestion_required for outside arm");
}

console.log("S26. enforceBrowserArm — blocked: out of scope");
{
  const r = enforceBrowserArm({ action: "navigate", scope_approved: false, gates_context: ALL_GATES_OK });
  assert(r.allowed === false, "out of scope not allowed");
  assert(r.suggestion_required === true, "suggestion_required for out of scope");
}

console.log("S27. enforceBrowserArm — blocked: drift detected");
{
  const r = enforceBrowserArm({ action: "navigate", scope_approved: true, gates_context: ALL_GATES_OK, drift_detected: true });
  assert(r.allowed === false, "drift blocks action");
  assert(r.level === "blocked_drift_detected", "level is drift");
}

console.log("S28. enforceBrowserArm — blocked: regression detected");
{
  const r = enforceBrowserArm({ action: "navigate", scope_approved: true, gates_context: ALL_GATES_OK, regression_detected: true });
  assert(r.allowed === false, "regression blocks action");
  assert(r.level === "blocked_regression_detected", "level is regression");
}

console.log("S29. enforceBrowserArm — blocked: P23 gates fail");
{
  const r = enforceBrowserArm({ action: "navigate", scope_approved: true, gates_context: GATES_FAIL });
  assert(r.allowed === false, "P23 gates fail blocks");
  assert(r.level === "blocked_p23_noncompliant", "level is p23 noncompliant");
}

console.log("S30. enforceBrowserArm — blocked: conditional not met (expand_scope)");
{
  const r = enforceBrowserArm({ action: "expand_scope", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.allowed === false, "expand_scope without permission blocked");
  assert(r.level === "blocked_conditional_not_met", "level is conditional");
  assert(r.suggestion_required === true, "suggestion_required for expand_scope");
}

console.log("S31. enforceBrowserArm — allowed: conditional met (expand_scope + permission)");
{
  const r = enforceBrowserArm({ action: "expand_scope", scope_approved: true, gates_context: ALL_GATES_OK, user_permission: true });
  assert(r.allowed === true, "expand_scope with permission allowed");
  assert(r.conditional_check !== null, "conditional_check present");
}

console.log("S32. enforceBrowserArm — suggestion_required for out_of_scope");
{
  const r = enforceBrowserArm({ action: "search", scope_approved: false, gates_context: ALL_GATES_OK });
  assert(r.suggestion_required === true, "suggestion_required true for out of scope");
}

console.log("S33. enforceBrowserArm — throws on invalid params");
{
  assertThrows(() => enforceBrowserArm({}), "throws on missing action");
  assertThrows(() => enforceBrowserArm({ action: "navigate" }), "throws on missing scope_approved");
  assertThrows(() => enforceBrowserArm({ action: "navigate", scope_approved: true }), "throws on missing gates_context");
}

// ── S34: Catalogues disjoint ──
console.log("S34. catalogues — allowed and prohibited are disjoint");
{
  const overlap = BROWSER_ALLOWED_ACTIONS.filter(a => PROHIBITED_ACTIONS_P25.includes(a));
  assert(overlap.length === 0, "no overlap between allowed and prohibited");
  const condOverlap = BROWSER_CONDITIONAL_ACTIONS.filter(a => PROHIBITED_ACTIONS_P25.includes(a));
  assert(condOverlap.length === 0, "no overlap between conditional and prohibited");
}

// ── S35: ARM_ID ──
console.log("S35. BROWSER_ARM_ID is canonical string");
assert(BROWSER_ARM_ID === "p25_browser_arm", "BROWSER_ARM_ID = p25_browser_arm");

// ── S36–S37: External base ──
console.log("S36–S37. BROWSER_EXTERNAL_BASE");
assert(BROWSER_EXTERNAL_BASE.host === "run.nv-imoveis.com", "host is run.nv-imoveis.com");
assert(BROWSER_EXTERNAL_BASE.pattern === "run.nv-imoveis.com/*", "pattern is run.nv-imoveis.com/*");
assert(BROWSER_EXTERNAL_BASE.base_url === "https://run.nv-imoveis.com", "base_url correct");

// ── S38: Role ──
console.log("S38. BROWSER_ARM_ROLE");
assert(BROWSER_ARM_ROLE.purpose.length >= 6, "role has at least 6 purposes");
assert(BROWSER_ARM_ROLE.purpose.includes("olhos externos da Enavia"), "purpose includes olhos externos");
assert(BROWSER_ARM_ROLE.external_base === BROWSER_EXTERNAL_BASE, "role references external base");

// ── S39: State shape ──
console.log("S39. BROWSER_ARM_STATE_SHAPE");
assert(BROWSER_ARM_STATE_SHAPE.initial_state.arm_id === BROWSER_ARM_ID, "initial state arm_id correct");
assert(BROWSER_ARM_STATE_SHAPE.initial_state.status === "idle", "initial state status is idle");
assert(BROWSER_ARM_STATE_SHAPE.initial_state.external_base === BROWSER_EXTERNAL_BASE, "initial state external_base correct");

// ── S40: Suggestion shape ──
console.log("S40. SUGGESTION_SHAPE");
assert(SUGGESTION_SHAPE.required_fields.length === 6, "suggestion shape has 6 required fields");
assert(SUGGESTION_SHAPE.required_fields.includes("permission_needed"), "includes permission_needed");

// ── S41: Research routine ──
console.log("S41. RESEARCH_ROUTINE_SHAPE");
assert(RESEARCH_ROUTINE_SHAPE.valid_frequencies.includes("on_demand"), "includes on_demand frequency");
assert(RESEARCH_ROUTINE_SHAPE.defaults.active === false, "default active is false");

// ── S42: All 9 allowed actions are autonomous ──
console.log("S42. classifyBrowserArmAction — all 9 allowed actions are autonomous");
{
  let allAutonomous = true;
  for (const a of BROWSER_ALLOWED_ACTIONS) {
    const r = classifyBrowserArmAction(a);
    if (r.autonomy_level !== AUTONOMY_LEVEL.AUTONOMOUS) allAutonomous = false;
    assert(r.autonomy_level === AUTONOMY_LEVEL.AUTONOMOUS, `${a} is autonomous`);
    assert(r.belongs_to_browser_arm === true, `${a} belongs to browser arm`);
  }
  assert(allAutonomous, "all 9 allowed actions are autonomous");
  assert(BROWSER_ALLOWED_ACTIONS.length === 9, "exactly 9 allowed actions");
}

// ── S43: All 13 prohibited actions are prohibited ──
console.log("S43. classifyBrowserArmAction — all prohibited actions are prohibited");
{
  let allProhibited = true;
  for (const a of PROHIBITED_ACTIONS_P25) {
    const r = classifyBrowserArmAction(a);
    if (r.autonomy_level !== AUTONOMY_LEVEL.PROHIBITED) allProhibited = false;
    assert(r.autonomy_level === AUTONOMY_LEVEL.PROHIBITED, `${a} is prohibited`);
  }
  assert(allProhibited, "all prohibited actions are prohibited");
  assert(PROHIBITED_ACTIONS_P25.length === 13, "exactly 13 prohibited actions");
}

// ── S44: Obligations ──
console.log("S44. BROWSER_ARM_OBLIGATIONS");
assert(BROWSER_ARM_OBLIGATIONS.includes("never_exit_scope_without_escalation"), "includes never_exit_scope");
assert(BROWSER_ARM_OBLIGATIONS.includes("always_request_permission_for_out_of_scope_opportunity"), "includes always_request_permission");
assert(BROWSER_ARM_OBLIGATIONS.includes("always_suggest_improvements_and_tools"), "includes always_suggest");
assert(BROWSER_ARM_OBLIGATIONS.includes("respect_cost_limits_for_recurring_routines"), "includes respect_cost_limits");

// ── S45: All 9 allowed actions pass enforcement ──
console.log("S45. enforceBrowserArm — all 9 allowed actions pass within scope");
{
  let allPass = true;
  for (const a of BROWSER_ALLOWED_ACTIONS) {
    const r = enforceBrowserArm({ action: a, scope_approved: true, gates_context: ALL_GATES_OK });
    if (!r.allowed) allPass = false;
    assert(r.allowed === true, `${a} passes enforcement`);
    assert(r.arm_id === BROWSER_ARM_ID, `${a} correct arm_id`);
  }
  assert(allPass, "all 9 allowed actions pass enforcement");
}

// ── S46: Conditional delete without justification ──
console.log("S46. enforceBrowserArm — blocked: conditional delete without justification");
{
  const r = enforceBrowserArm({ action: "delete", scope_approved: true, gates_context: ALL_GATES_OK });
  assert(r.allowed === false, "delete without justification blocked");
  assert(r.level === "blocked_conditional_not_met", "level is conditional_not_met");
}

// ── S47: Conditional delete with justification ──
console.log("S47. enforceBrowserArm — allowed: conditional delete with justification");
{
  const r = enforceBrowserArm({ action: "delete", scope_approved: true, gates_context: ALL_GATES_OK, justification: "Cleanup de cache temporário do objetivo vigente" });
  assert(r.allowed === true, "delete with justification allowed");
  assert(r.conditional_check.allowed === true, "conditional_check allowed");
}

// ── S48: All valid suggestion types accepted ──
console.log("S48. validateSuggestion — all valid types accepted");
{
  for (const t of SUGGESTION_SHAPE.valid_types) {
    const s = validateSuggestion({
      type: t,
      discovery: "test",
      benefit: "test",
      missing_requirement: "test",
      expected_impact: "test",
      permission_needed: false,
    });
    assert(s.valid === true, `type '${t}' accepted`);
  }
}

// ============================================================
// Summary
// ============================================================
console.log("\n============================================================");
console.log(`P25 Browser Arm Contract — Smoke Tests`);
console.log(`Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
console.log("============================================================\n");

if (failed > 0) {
  console.error(`❌ ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log(`✅ All ${passed} tests passed`);
}
