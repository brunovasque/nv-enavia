// ============================================================================
// ENAVIA Panel — Session
// Generates and persists a session ID for the current browser tab.
// Canonical key exported so consumers never hardcode the string.
// ============================================================================

export const SESSION_STORAGE_KEY = "enavia_session_id";

let _ephemeral = null;

function generate() {
  // Use crypto.randomUUID for a cryptographically random session ID.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return "sess-" + crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (e.g. old test runners).
  const arr = new Uint32Array(2);
  crypto.getRandomValues(arr);
  return "sess-" + arr[0].toString(36) + arr[1].toString(36);
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
