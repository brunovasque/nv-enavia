// ============================================================================
// 🧪 Integration Tests — P25-PR2 Browser Arm Bridge (Real Operational Link)
//
// Run: node tests/browser-arm-bridge.integration.test.js
//
// Proves that the Browser Arm bridge is operational:
//   - Canonical payload shape is correct
//   - Response validation works
//   - Allowed action triggers real external call (mocked fetch)
//   - Blocked action does NOT call external browser
//   - Connectivity/execution failures return clear errors
//   - State tracking works after executions
//   - Handler returns correct HTTP status for bridge failures
//
// Tests:
//   B1.  buildBrowserExecutorPayload — has all required fields
//   B2.  buildBrowserExecutorPayload — request_id is unique
//   B3.  buildBrowserExecutorPayload — includes optional params when provided
//   B4.  buildBrowserExecutorPayload — omits params when null
//   B5.  validateBrowserExecutorResponse — valid response passes
//   B6.  validateBrowserExecutorResponse — missing required fields fails
//   B7.  validateBrowserExecutorResponse — null/non-object fails
//   B8.  executeBrowserArmAction — allowed action calls external browser (mock)
//   B9.  executeBrowserArmAction — blocked action does NOT call external browser
//   B10. executeBrowserArmAction — connectivity error returns clear BRIDGE_CONNECTIVITY_ERROR
//   B11. executeBrowserArmAction — HTTP error returns clear BRIDGE_HTTP_ERROR
//   B12. executeBrowserArmAction — invalid JSON response returns BRIDGE_INVALID_RESPONSE
//   B13. executeBrowserArmAction — executor ok=false returns BRIDGE_EXECUTOR_ERROR
//   B14. executeBrowserArmAction — payload_sent included on bridge failure
//   B15. executeBrowserArmAction — browser_result included on success
//   B16. getBrowserArmState — reflects last successful execution
//   B17. getBrowserArmState — reflects last failed execution
//   B18. getBrowserArmState — reset returns to idle
//   B19. handleBrowserArmAction — allowed action with executor returns 200
//   B20. handleBrowserArmAction — bridge failure returns 502
//   B21. handleBrowserArmAction — enforcement block still returns 403
//   B22. BROWSER_EXECUTOR_PAYLOAD_SHAPE — has correct required fields
//   B23. BROWSER_EXECUTOR_RESPONSE_SHAPE — has correct required fields
//   B24. executeBrowserArmAction — no env falls back to enforcement-only (PR1 compat)
//   B25. executeBrowserArmAction — empty BROWSER_EXECUTOR_URL falls back to enforcement-only
//   B26. executeBrowserArmAction — incomplete executor response returns BRIDGE_INVALID_RESPONSE
// ============================================================================

import {
  executeBrowserArmAction,
  handleBrowserArmAction,
  getBrowserArmState,
  resetBrowserArmState,
  buildBrowserExecutorPayload,
  validateBrowserExecutorResponse,
  BROWSER_EXECUTOR_PAYLOAD_SHAPE,
  BROWSER_EXECUTOR_RESPONSE_SHAPE,
} from "../contract-executor.js";

import {
  BROWSER_ARM_ID,
  BROWSER_EXTERNAL_BASE,
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

// ── Mock fetch infrastructure ──
let _fetchCalls = [];
let _fetchMockResponse = null;
let _fetchMockError = null;

const _originalFetch = globalThis.fetch;

function mockFetch(response) {
  _fetchCalls = [];
  _fetchMockError = null;
  _fetchMockResponse = response;
  globalThis.fetch = async (url, opts) => {
    _fetchCalls.push({ url, opts });
    if (_fetchMockError) throw _fetchMockError;
    return _fetchMockResponse;
  };
}

function mockFetchError(err) {
  _fetchCalls = [];
  _fetchMockResponse = null;
  _fetchMockError = err;
  globalThis.fetch = async (url, opts) => {
    _fetchCalls.push({ url, opts });
    throw _fetchMockError;
  };
}

function restoreFetch() {
  globalThis.fetch = _originalFetch;
  _fetchCalls = [];
  _fetchMockResponse = null;
  _fetchMockError = null;
}

// ── Mock env with BROWSER_EXECUTOR_URL ──
const MOCK_ENV = {
  BROWSER_EXECUTOR_URL: "https://run.nv-imoveis.com/browser/run",
};

// ── Helper: successful browser executor response ──
function successResponse(action) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      execution_status: "completed",
      action,
      target_url: `https://run.nv-imoveis.com/${action}`,
      result_summary: `Ação '${action}' executada com sucesso.`,
      evidence: { screenshot: "base64..." },
    }),
    text: async () => "ok",
  };
}

console.log("\n============================================================");
console.log("P25-PR2 Browser Arm Bridge — Integration Tests");
console.log("============================================================\n");

// ── B1: Payload has all required fields ──
console.log("B1. buildBrowserExecutorPayload — has all required fields");
{
  const p = buildBrowserExecutorPayload({ action: "navigate" });
  assert(p.arm_id === BROWSER_ARM_ID, "arm_id present");
  assert(p.action === "navigate", "action present");
  assert(p.external_base === BROWSER_EXTERNAL_BASE.base_url, "external_base present");
  assert(typeof p.request_id === "string" && p.request_id.startsWith("ba_"), "request_id present and prefixed");
  assert(typeof p.timestamp === "string", "timestamp present");
  for (const f of BROWSER_EXECUTOR_PAYLOAD_SHAPE.required_fields) {
    assert(p[f] !== undefined && p[f] !== null, `required field '${f}' present`);
  }
}

// ── B2: Request ID is unique ──
console.log("B2. buildBrowserExecutorPayload — request_id is unique");
{
  const p1 = buildBrowserExecutorPayload({ action: "navigate" });
  const p2 = buildBrowserExecutorPayload({ action: "navigate" });
  assert(p1.request_id !== p2.request_id, "request_ids are unique");
}

// ── B3: Includes optional params ──
console.log("B3. buildBrowserExecutorPayload — includes params when provided");
{
  const p = buildBrowserExecutorPayload({ action: "search", params: { query: "test" } });
  assert(p.params !== undefined, "params present");
  assert(p.params.query === "test", "params.query correct");
}

// ── B4: Omits params when null ──
console.log("B4. buildBrowserExecutorPayload — omits params when null");
{
  const p = buildBrowserExecutorPayload({ action: "navigate" });
  assert(p.params === undefined, "params absent when not provided");
}

// ── B5: Valid response passes ──
console.log("B5. validateBrowserExecutorResponse — valid response passes");
{
  const v = validateBrowserExecutorResponse({
    ok: true,
    execution_status: "completed",
    action: "navigate",
  });
  assert(v.valid === true, "valid response passes");
}

// ── B6: Missing required fields fails ──
console.log("B6. validateBrowserExecutorResponse — missing required fields fails");
{
  const v = validateBrowserExecutorResponse({ ok: true });
  assert(v.valid === false, "incomplete response fails");
  assert(v.reason.includes("execution_status"), "mentions missing field");
}

// ── B7: Null/non-object fails ──
console.log("B7. validateBrowserExecutorResponse — null/non-object fails");
{
  assert(validateBrowserExecutorResponse(null).valid === false, "null fails");
  assert(validateBrowserExecutorResponse("string").valid === false, "string fails");
  assert(validateBrowserExecutorResponse(42).valid === false, "number fails");
}

// ── B8: Allowed action calls external browser ──
console.log("B8. executeBrowserArmAction — allowed action calls external browser");
{
  resetBrowserArmState();
  mockFetch(successResponse("navigate"));
  const r = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  assert(r.ok === true, "result ok");
  assert(r.execution_status === "completed", "execution_status from browser executor");
  assert(r.arm_id === BROWSER_ARM_ID, "arm_id correct");
  assert(r.browser_result !== undefined, "browser_result present");
  assert(r.browser_result.target_url.includes("run.nv-imoveis.com"), "target_url from browser");
  assert(r.request_id !== undefined, "request_id present");
  assert(_fetchCalls.length === 1, "exactly one fetch call made");
  assert(_fetchCalls[0].url === MOCK_ENV.BROWSER_EXECUTOR_URL, "called correct URL");
  // Verify payload shape
  const sentPayload = JSON.parse(_fetchCalls[0].opts.body);
  assert(sentPayload.arm_id === BROWSER_ARM_ID, "payload arm_id correct");
  assert(sentPayload.action === "navigate", "payload action correct");
  assert(sentPayload.external_base === BROWSER_EXTERNAL_BASE.base_url, "payload external_base correct");
  restoreFetch();
}

// ── B9: Blocked action does NOT call external browser ──
console.log("B9. executeBrowserArmAction — blocked action does NOT call external browser");
{
  _fetchCalls = [];
  mockFetch(successResponse("exit_scope"));
  const r = await executeBrowserArmAction({
    action: "exit_scope",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  assert(r.ok === false, "blocked");
  assert(r.error === "BROWSER_ARM_BLOCKED", "enforcement blocked");
  assert(_fetchCalls.length === 0, "NO fetch call made for blocked action");
  restoreFetch();
}

// ── B10: Connectivity error ──
console.log("B10. executeBrowserArmAction — connectivity error returns BRIDGE_CONNECTIVITY_ERROR");
{
  resetBrowserArmState();
  mockFetchError(new Error("DNS resolution failed"));
  const r = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  assert(r.ok === false, "not ok");
  assert(r.error === "BROWSER_BRIDGE_FAILED", "bridge failed");
  assert(r.error_type === "BRIDGE_CONNECTIVITY_ERROR", "connectivity error type");
  assert(r.message.includes("DNS resolution failed"), "error message contains cause");
  restoreFetch();
}

// ── B11: HTTP error ──
console.log("B11. executeBrowserArmAction — HTTP error returns BRIDGE_HTTP_ERROR");
{
  resetBrowserArmState();
  mockFetch({
    ok: false,
    status: 500,
    text: async () => "Internal Server Error",
  });
  const r = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  assert(r.ok === false, "not ok");
  assert(r.error === "BROWSER_BRIDGE_FAILED", "bridge failed");
  assert(r.error_type === "BRIDGE_HTTP_ERROR", "HTTP error type");
  assert(r.message.includes("500"), "mentions HTTP status");
  restoreFetch();
}

// ── B12: Invalid JSON response ──
console.log("B12. executeBrowserArmAction — invalid JSON returns BRIDGE_INVALID_RESPONSE");
{
  resetBrowserArmState();
  mockFetch({
    ok: true,
    status: 200,
    json: async () => { throw new Error("not json"); },
  });
  const r = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  assert(r.ok === false, "not ok");
  assert(r.error === "BROWSER_BRIDGE_FAILED", "bridge failed");
  assert(r.error_type === "BRIDGE_INVALID_RESPONSE", "invalid response type");
  restoreFetch();
}

// ── B13: Executor ok=false ──
console.log("B13. executeBrowserArmAction — executor ok=false returns BRIDGE_EXECUTOR_ERROR");
{
  resetBrowserArmState();
  mockFetch({
    ok: true,
    status: 200,
    json: async () => ({
      ok: false,
      execution_status: "failed",
      action: "navigate",
      error: "PAGE_NOT_FOUND",
      message: "Página não encontrada.",
    }),
  });
  const r = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  assert(r.ok === false, "not ok");
  assert(r.error === "BROWSER_BRIDGE_FAILED", "bridge failed");
  assert(r.error_type === "BRIDGE_EXECUTOR_ERROR", "executor error type");
  assert(r.message.includes("Página não encontrada"), "includes executor message");
  restoreFetch();
}

// ── B14: payload_sent included on bridge failure ──
console.log("B14. executeBrowserArmAction — payload_sent on bridge failure");
{
  resetBrowserArmState();
  mockFetchError(new Error("timeout"));
  const r = await executeBrowserArmAction({
    action: "search",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  assert(r.ok === false, "not ok");
  assert(r.payload_sent !== undefined, "payload_sent present");
  assert(r.payload_sent.arm_id === BROWSER_ARM_ID, "payload_sent.arm_id correct");
  assert(r.payload_sent.action === "search", "payload_sent.action correct");
  restoreFetch();
}

// ── B15: browser_result on success ──
console.log("B15. executeBrowserArmAction — browser_result on success");
{
  resetBrowserArmState();
  mockFetch(successResponse("open_page"));
  const r = await executeBrowserArmAction({
    action: "open_page",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  assert(r.ok === true, "ok");
  assert(r.browser_result.result_summary !== null, "result_summary present");
  assert(r.browser_result.evidence !== null, "evidence present");
  assert(r.browser_result.target_url.includes("run.nv-imoveis.com"), "target_url present");
  restoreFetch();
}

// ── B16: State reflects last success ──
console.log("B16. getBrowserArmState — reflects last successful execution");
{
  resetBrowserArmState();
  mockFetch(successResponse("navigate"));
  await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  const state = getBrowserArmState();
  assert(state.ok === true, "state ok");
  assert(state.status === "active", "status is active after success");
  assert(state.last_action === "navigate", "last_action is navigate");
  assert(state.last_action_ts !== null, "last_action_ts present");
  assert(state.last_execution.ok === true, "last_execution ok");
  assert(state.last_execution.execution_status === "completed", "execution_status completed");
  assert(state.last_execution.request_id !== null, "request_id present");
  restoreFetch();
}

// ── B17: State reflects last failure ──
console.log("B17. getBrowserArmState — reflects last failed execution");
{
  resetBrowserArmState();
  mockFetchError(new Error("connection refused"));
  await executeBrowserArmAction({
    action: "search",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  const state = getBrowserArmState();
  assert(state.ok === true, "state ok");
  assert(state.status === "error", "status is error after failure");
  assert(state.last_action === "search", "last_action is search");
  assert(state.last_execution.ok === false, "last_execution not ok");
  assert(state.last_execution.error_type === "BRIDGE_CONNECTIVITY_ERROR", "error_type correct");
  restoreFetch();
}

// ── B18: Reset returns to idle ──
console.log("B18. getBrowserArmState — reset returns to idle");
{
  resetBrowserArmState();
  const state = getBrowserArmState();
  assert(state.status === "idle", "status is idle after reset");
  assert(state.last_action === null, "no last action");
  assert(state.last_execution === undefined, "no last_execution");
}

// ── B19: Handler — allowed action with executor returns 200 ──
console.log("B19. handleBrowserArmAction — allowed action with executor returns 200");
{
  resetBrowserArmState();
  mockFetch(successResponse("navigate"));
  const mockReq = {
    json: async () => ({
      action: "navigate",
      scope_approved: true,
      gates_context: ALL_GATES_OK,
    }),
  };
  const r = await handleBrowserArmAction(mockReq, MOCK_ENV);
  assert(r.status === 200, "status 200");
  assert(r.body.ok === true, "body ok");
  assert(r.body.browser_result !== undefined, "browser_result present");
  restoreFetch();
}

// ── B20: Handler — bridge failure returns 502 ──
console.log("B20. handleBrowserArmAction — bridge failure returns 502");
{
  resetBrowserArmState();
  mockFetchError(new Error("timeout"));
  const mockReq = {
    json: async () => ({
      action: "navigate",
      scope_approved: true,
      gates_context: ALL_GATES_OK,
    }),
  };
  const r = await handleBrowserArmAction(mockReq, MOCK_ENV);
  assert(r.status === 502, "status 502 for bridge failure");
  assert(r.body.ok === false, "body not ok");
  assert(r.body.error === "BROWSER_BRIDGE_FAILED", "error is BROWSER_BRIDGE_FAILED");
  assert(r.body.error_type === "BRIDGE_CONNECTIVITY_ERROR", "error_type correct");
  restoreFetch();
}

// ── B21: Handler — enforcement block still returns 403 ──
console.log("B21. handleBrowserArmAction — enforcement block returns 403");
{
  _fetchCalls = [];
  mockFetch(successResponse("exit_scope"));
  const mockReq = {
    json: async () => ({
      action: "exit_scope",
      scope_approved: true,
      gates_context: ALL_GATES_OK,
    }),
  };
  const r = await handleBrowserArmAction(mockReq, MOCK_ENV);
  assert(r.status === 403, "status 403");
  assert(r.body.error === "BROWSER_ARM_BLOCKED", "enforcement blocked");
  assert(_fetchCalls.length === 0, "NO fetch call for blocked action");
  restoreFetch();
}

// ── B22: Payload shape ──
console.log("B22. BROWSER_EXECUTOR_PAYLOAD_SHAPE — correct required fields");
{
  assert(BROWSER_EXECUTOR_PAYLOAD_SHAPE.required_fields.includes("arm_id"), "includes arm_id");
  assert(BROWSER_EXECUTOR_PAYLOAD_SHAPE.required_fields.includes("action"), "includes action");
  assert(BROWSER_EXECUTOR_PAYLOAD_SHAPE.required_fields.includes("external_base"), "includes external_base");
  assert(BROWSER_EXECUTOR_PAYLOAD_SHAPE.required_fields.includes("request_id"), "includes request_id");
  assert(BROWSER_EXECUTOR_PAYLOAD_SHAPE.required_fields.includes("timestamp"), "includes timestamp");
  assert(BROWSER_EXECUTOR_PAYLOAD_SHAPE.required_fields.length === 5, "exactly 5 required fields");
}

// ── B23: Response shape ──
console.log("B23. BROWSER_EXECUTOR_RESPONSE_SHAPE — correct required fields");
{
  assert(BROWSER_EXECUTOR_RESPONSE_SHAPE.required_fields.includes("ok"), "includes ok");
  assert(BROWSER_EXECUTOR_RESPONSE_SHAPE.required_fields.includes("execution_status"), "includes execution_status");
  assert(BROWSER_EXECUTOR_RESPONSE_SHAPE.required_fields.includes("action"), "includes action");
  assert(BROWSER_EXECUTOR_RESPONSE_SHAPE.required_fields.length === 3, "exactly 3 required fields");
}

// ── B24: No env → enforcement-only (PR1 compat) ──
console.log("B24. executeBrowserArmAction — no env falls back to enforcement-only");
{
  _fetchCalls = [];
  const r = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    // no env
  });
  assert(r.ok === true, "ok without env");
  assert(r.execution_status === "executed", "execution_status = executed (PR1 compat)");
  assert(r.external_base === BROWSER_EXTERNAL_BASE, "external_base present (full object)");
  assert(_fetchCalls.length === 0, "no fetch call without env");
}

// ── B25: Empty BROWSER_EXECUTOR_URL → enforcement-only ──
console.log("B25. executeBrowserArmAction — empty URL falls back to enforcement-only");
{
  _fetchCalls = [];
  const r = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: { BROWSER_EXECUTOR_URL: "" },
  });
  assert(r.ok === true, "ok with empty URL");
  assert(r.execution_status === "executed", "execution_status = executed (PR1 compat)");
  assert(_fetchCalls.length === 0, "no fetch call with empty URL");
}

// ── B26: Incomplete executor response ──
console.log("B26. executeBrowserArmAction — incomplete executor response returns BRIDGE_INVALID_RESPONSE");
{
  resetBrowserArmState();
  mockFetch({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }), // missing execution_status and action
  });
  const r = await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: MOCK_ENV,
  });
  assert(r.ok === false, "not ok");
  assert(r.error === "BROWSER_BRIDGE_FAILED", "bridge failed");
  assert(r.error_type === "BRIDGE_INVALID_RESPONSE", "invalid response type");
  restoreFetch();
}

// ============================================================
// Summary
// ============================================================
console.log("\n============================================================");
console.log(`P25-PR2 Browser Arm Bridge — Integration Tests`);
console.log(`Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
console.log("============================================================\n");

if (failed > 0) {
  console.error(`❌ ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log(`✅ All ${passed} tests passed — P25-PR2 bridge is OPERATIONAL`);
}
