// ============================================================================
// 🧪 P25-PR4+ — Browser Arm KV persistence smoke tests
//
// Run: node tests/p25-pr4-kv-persistence.smoke.test.js
//
// Proves that getBrowserArmStateWithKV, persistBrowserArmState, and
// rehydrateBrowserArmState work correctly:
//   K1.  persistBrowserArmState silently skips when env has no ENAVIA_BRAIN
//   K2.  persistBrowserArmState writes to KV with correct key
//   K3.  persistBrowserArmState stores last_execution + suggestions + persisted_at
//   K4.  rehydrateBrowserArmState reads from KV and restores in-memory state
//   K5.  rehydrateBrowserArmState silently skips when env has no ENAVIA_BRAIN
//   K6.  rehydrateBrowserArmState silently skips when KV key not found
//   K7.  rehydrateBrowserArmState does not overwrite in-memory state if already set
//   K8.  getBrowserArmStateWithKV triggers rehydration when in-memory is null
//   K9.  getBrowserArmStateWithKV returns correct state after rehydration
//   K10. executeBrowserArmAction persists after allowed (enforcement-only) action
//   K11. executeBrowserArmAction persists after blocked action
//   K12. KV_KEY_BROWSER_ARM_STATE is the canonical key "browser-arm:state"
//   K13. persistBrowserArmState silently handles KV write failure
//   K14. rehydrateBrowserArmState silently handles KV read failure
//   K15. rehydrateBrowserArmState silently handles invalid JSON
//   K16. Full round-trip: persist → reset → rehydrate → state correct
//   K17. Full round-trip: blocked action → persist → reset → rehydrate → block visible
//   K18. Full round-trip: suggestions → persist → reset → rehydrate → suggestions visible
// ============================================================================

import {
  executeBrowserArmAction,
  getBrowserArmState,
  getBrowserArmStateWithKV,
  resetBrowserArmState,
  persistBrowserArmState,
  rehydrateBrowserArmState,
  KV_KEY_BROWSER_ARM_STATE,
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

// ── Mock KV store (in-memory, simulates ENAVIA_BRAIN) ─────────────────────
function makeMockKV(initialData = {}) {
  const store = { ...initialData };
  return {
    async put(key, value) { store[key] = value; },
    async get(key) { return store[key] ?? null; },
    async delete(key) { delete store[key]; },
    _store: store,
  };
}

// ── Standard P23 gates (all pass) ─────────────────────────────────────────
const ALL_GATES_OK = {
  scope_defined: true,
  environment_defined: true,
  risk_assessed: true,
  authorization_present_when_required: true,
  observability_preserved: true,
  evidence_available_when_required: true,
};

console.log("\n🧪 P25-PR4+ — Browser Arm KV Persistence\n");

// ── K12: KV key is canonical ───────────────────────────────────────────────
assert(KV_KEY_BROWSER_ARM_STATE === "browser-arm:state", "K12: KV_KEY_BROWSER_ARM_STATE = 'browser-arm:state'");

// ── K1: persist silently skips without env.ENAVIA_BRAIN ───────────────────
resetBrowserArmState();
await persistBrowserArmState(null);
await persistBrowserArmState({ BROWSER_EXECUTOR_URL: "https://example.com" });
assert(true, "K1: persistBrowserArmState skips silently without env.ENAVIA_BRAIN");

// ── K2: persist writes to KV with correct key ─────────────────────────────
{
  resetBrowserArmState();
  await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  const kv = makeMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await persistBrowserArmState(env);
  assert(kv._store[KV_KEY_BROWSER_ARM_STATE] !== undefined, "K2: persisted to correct KV key");
}

// ── K3: persist stores correct shape ──────────────────────────────────────
{
  resetBrowserArmState();
  await executeBrowserArmAction({
    action: "search",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  const kv = makeMockKV();
  await persistBrowserArmState({ ENAVIA_BRAIN: kv });
  const raw = kv._store[KV_KEY_BROWSER_ARM_STATE];
  assert(typeof raw === "string", "K3: stored value is string");
  const data = JSON.parse(raw);
  assert(data.last_execution != null, "K3: last_execution stored");
  assert(data.last_execution.action === "search", "K3: action is 'search'");
  assert(Array.isArray(data.suggestions), "K3: suggestions is array");
  assert(typeof data.persisted_at === "string", "K3: persisted_at is string");
}

// ── K4: rehydrateBrowserArmState restores in-memory state ─────────────────
{
  resetBrowserArmState();
  // Set state
  await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  const kv = makeMockKV();
  await persistBrowserArmState({ ENAVIA_BRAIN: kv });

  // Now reset and rehydrate
  resetBrowserArmState();
  assert(getBrowserArmState().status === "idle", "K4: state is idle after reset");
  await rehydrateBrowserArmState({ ENAVIA_BRAIN: kv });
  const state = getBrowserArmState();
  assert(state.status === "active", "K4: status restored to 'active' after rehydration");
  assert(state.last_action === "navigate", "K4: last_action restored");
}

// ── K5: rehydrate silently skips without env.ENAVIA_BRAIN ─────────────────
{
  resetBrowserArmState();
  await rehydrateBrowserArmState(null);
  await rehydrateBrowserArmState({});
  assert(getBrowserArmState().status === "idle", "K5: rehydrate skips without ENAVIA_BRAIN");
}

// ── K6: rehydrate silently skips when key not in KV ───────────────────────
{
  resetBrowserArmState();
  const kv = makeMockKV(); // empty
  await rehydrateBrowserArmState({ ENAVIA_BRAIN: kv });
  assert(getBrowserArmState().status === "idle", "K6: rehydrate skips when key missing in KV");
}

// ── K7: rehydrate does NOT overwrite existing in-memory state ─────────────
{
  resetBrowserArmState();
  // Set fresh state in memory
  await executeBrowserArmAction({
    action: "click",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  // Put different state in KV
  const kv = makeMockKV({
    [KV_KEY_BROWSER_ARM_STATE]: JSON.stringify({
      last_execution: {
        action: "navigate",
        ok: true,
        execution_status: "executed",
        timestamp: "2026-01-01T00:00:00Z",
      },
      suggestions: [],
    }),
  });
  await rehydrateBrowserArmState({ ENAVIA_BRAIN: kv });
  const state = getBrowserArmState();
  // Should keep in-memory state (click), not KV state (navigate)
  assert(state.last_action === "click", "K7: rehydrate does not overwrite existing in-memory state");
}

// ── K8 + K9: getBrowserArmStateWithKV triggers rehydration when memory null ──
{
  resetBrowserArmState();
  // Put state in KV
  const kv = makeMockKV({
    [KV_KEY_BROWSER_ARM_STATE]: JSON.stringify({
      last_execution: {
        action: "search",
        ok: true,
        execution_status: "executed",
        blocked: false,
        block_level: null,
        block_reason: null,
        suggestion_required: false,
        timestamp: "2026-04-14T00:00:00Z",
        request_id: null,
        error_type: null,
        error_message: null,
        target_url: null,
        result_summary: "Search result OK",
      },
      suggestions: [],
    }),
  });
  const state = await getBrowserArmStateWithKV({ ENAVIA_BRAIN: kv });
  assert(state.ok === true, "K8: getBrowserArmStateWithKV returns ok=true");
  assert(state.last_action === "search", "K9: rehydrated action is correct");
  assert(state.last_execution.result_summary === "Search result OK", "K9: result_summary rehydrated");
}

// ── K10: executeBrowserArmAction persists after allowed (enforcement-only) ─
{
  resetBrowserArmState();
  const kv = makeMockKV();
  await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: { ENAVIA_BRAIN: kv },
  });
  assert(kv._store[KV_KEY_BROWSER_ARM_STATE] !== undefined, "K10: persisted after allowed action");
  const data = JSON.parse(kv._store[KV_KEY_BROWSER_ARM_STATE]);
  assert(data.last_execution.action === "navigate", "K10: action 'navigate' persisted");
  assert(data.last_execution.ok === true, "K10: ok=true persisted");
}

// ── K11: executeBrowserArmAction persists after blocked action ─────────────
{
  resetBrowserArmState();
  const kv = makeMockKV();
  await executeBrowserArmAction({
    action: "navigate",
    scope_approved: false,
    gates_context: ALL_GATES_OK,
    env: { ENAVIA_BRAIN: kv },
  });
  assert(kv._store[KV_KEY_BROWSER_ARM_STATE] !== undefined, "K11: persisted after blocked action");
  const data = JSON.parse(kv._store[KV_KEY_BROWSER_ARM_STATE]);
  assert(data.last_execution.blocked === true, "K11: blocked=true persisted");
  assert(data.last_execution.execution_status === "blocked", "K11: execution_status='blocked' persisted");
}

// ── K13: persist handles KV write failure silently ─────────────────────────
{
  resetBrowserArmState();
  await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
  });
  const badKV = {
    async put() { throw new Error("KV write failed"); },
    async get() { return null; },
  };
  let threw = false;
  try {
    await persistBrowserArmState({ ENAVIA_BRAIN: badKV });
  } catch {
    threw = true;
  }
  assert(!threw, "K13: persistBrowserArmState handles KV write failure silently");
}

// ── K14: rehydrate handles KV read failure silently ───────────────────────
{
  resetBrowserArmState();
  const badKV = {
    async put() {},
    async get() { throw new Error("KV read failed"); },
  };
  let threw = false;
  try {
    await rehydrateBrowserArmState({ ENAVIA_BRAIN: badKV });
  } catch {
    threw = true;
  }
  assert(!threw, "K14: rehydrateBrowserArmState handles KV read failure silently");
  assert(getBrowserArmState().status === "idle", "K14: falls back to idle on read failure");
}

// ── K15: rehydrate handles invalid JSON silently ───────────────────────────
{
  resetBrowserArmState();
  const badKV = makeMockKV({
    [KV_KEY_BROWSER_ARM_STATE]: "INVALID JSON {{{",
  });
  let threw = false;
  try {
    await rehydrateBrowserArmState({ ENAVIA_BRAIN: badKV });
  } catch {
    threw = true;
  }
  assert(!threw, "K15: rehydrateBrowserArmState handles invalid JSON silently");
  assert(getBrowserArmState().status === "idle", "K15: falls back to idle on parse failure");
}

// ── K16: Full round-trip — allowed action ─────────────────────────────────
{
  resetBrowserArmState();
  const kv = makeMockKV();
  // Simulate action with KV
  await executeBrowserArmAction({
    action: "navigate",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: { ENAVIA_BRAIN: kv },
  });
  // Simulate worker restart (reset memory)
  resetBrowserArmState();
  assert(getBrowserArmState().status === "idle", "K16: state is idle after reset (simulates restart)");
  // Rehydrate from KV
  const stateAfter = await getBrowserArmStateWithKV({ ENAVIA_BRAIN: kv });
  assert(stateAfter.status === "active", "K16: status restored to 'active' after restart");
  assert(stateAfter.last_action === "navigate", "K16: last_action restored after restart");
  assert(stateAfter.ok === true, "K16: ok=true after restart");
}

// ── K17: Full round-trip — blocked action ─────────────────────────────────
{
  resetBrowserArmState();
  const kv = makeMockKV();
  await executeBrowserArmAction({
    action: "navigate",
    scope_approved: false,
    gates_context: ALL_GATES_OK,
    env: { ENAVIA_BRAIN: kv },
  });
  resetBrowserArmState();
  const stateAfter = await getBrowserArmStateWithKV({ ENAVIA_BRAIN: kv });
  assert(stateAfter.status === "disabled", "K17: status='disabled' restored after blocked+restart");
  assert(stateAfter.block != null, "K17: block object present after restart");
  assert(stateAfter.block.blocked === true, "K17: block.blocked=true restored after restart");
  assert(stateAfter.block.suggestion_required === true, "K17: suggestion_required restored after restart");
}

// ── K18: Full round-trip — suggestions ────────────────────────────────────
{
  resetBrowserArmState();
  const kv = makeMockKV();
  // Manually persist with suggestions (the runtime registers them via the buffer)
  // Since _browserArmSuggestions is module-level, we simulate by calling persist
  // after setting the execution state manually via executeBrowserArmAction.
  // For suggestions: persist them directly via persistBrowserArmState.
  // This tests that the suggestions array round-trips through KV correctly.
  await executeBrowserArmAction({
    action: "search",
    scope_approved: true,
    gates_context: ALL_GATES_OK,
    env: { ENAVIA_BRAIN: kv },
  });
  // Override the KV entry to add suggestions (simulating runtime registering them)
  const current = JSON.parse(kv._store[KV_KEY_BROWSER_ARM_STATE]);
  current.suggestions = [
    {
      type: "tool",
      discovery: "Scraper disponível",
      benefit: "Coleta mais rápida",
      missing_requirement: "API key",
      expected_impact: "50% mais rápido",
      permission_needed: true,
    },
  ];
  await kv.put(KV_KEY_BROWSER_ARM_STATE, JSON.stringify(current));

  resetBrowserArmState();
  const stateAfter = await getBrowserArmStateWithKV({ ENAVIA_BRAIN: kv });
  assert(Array.isArray(stateAfter.suggestions), "K18: suggestions is array after restart");
  assert(stateAfter.suggestions.length === 1, "K18: 1 suggestion restored after restart");
  assert(stateAfter.suggestions[0].type === "tool", "K18: suggestion type correct after restart");
  assert(stateAfter.suggestions[0].permission_needed === true, "K18: permission_needed correct");
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n📊 P25-PR4+ KV Persistence: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
