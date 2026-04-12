// ============================================================================
// ENAVIA Panel — Session
// Generates and persists a session ID for the current browser tab.
// Canonical key exported so consumers never hardcode the string.
// ============================================================================

export const SESSION_STORAGE_KEY = "enavia_session_id";

let _ephemeral = null;
let _counter = 0;

function generate() {
  // Tier 1: crypto.randomUUID — best, available in all modern browsers.
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return "sess-" + crypto.randomUUID();
  }

  // Tier 2: crypto.getRandomValues — broad support, avoids Math.random.
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const arr = new Uint32Array(3);
    crypto.getRandomValues(arr);
    return "sess-" + arr[0].toString(36) + arr[1].toString(36) + arr[2].toString(36);
  }

  // Tier 3: pure JS fallback — no crypto available (e.g. old test runners,
  // sandboxed environments). Uses timestamp + monotonic counter + Date drift.
  // Adequate uniqueness for a panel session ID in this phase.
  const ts = Date.now().toString(36);
  const mono = (++_counter).toString(36);
  const drift = Math.trunc(
    (performance?.now?.() ?? (Date.now() % 1e9)) * 1000
  ).toString(36);
  return "sess-" + ts + "-" + mono + "-" + drift;
}

export function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = generate();
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    // sessionStorage unavailable (e.g., sandboxed iframe) — use ephemeral id.
    if (!_ephemeral) _ephemeral = generate();
    return _ephemeral;
  }
}
