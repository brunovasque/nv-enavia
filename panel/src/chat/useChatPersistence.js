// ============================================================================
// ENAVIA Panel — useChatPersistence
//
// Provides read/write/clear helpers for chat history in localStorage.
// Key format: enavia_chat_history:{session_id}
//
// Stored shape:
//   { session_id, updated_at, messages: [...] }
//
// Each message must contain at minimum:
//   { id, role, content, timestamp }
//
// Limits (to prevent localStorage bloat):
//   MAX_MESSAGES : 80  — keep only the most recent messages
//   MAX_BYTES    : 200_000 (~200 KB serialized JSON)
//
// Attachment handling: raw file content is never stored.
// Only messages whose `content` is a string are persisted;
// messages with non-string content (binary blobs) are skipped.
// ============================================================================

export const CHAT_HISTORY_KEY_PREFIX = "enavia_chat_history:";

const MAX_MESSAGES = 80;
const MAX_BYTES    = 200_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _key(sessionId) {
  return CHAT_HISTORY_KEY_PREFIX + sessionId;
}

/** Trim messages array to stay within limits. */
function _trim(msgs) {
  // 1. Keep only the most recent MAX_MESSAGES entries.
  let trimmed = msgs.length > MAX_MESSAGES ? msgs.slice(-MAX_MESSAGES) : msgs;

  // 2. Drop oldest entries until serialized size fits within MAX_BYTES.
  //    We iteratively remove from the front (oldest) until it fits.
  while (trimmed.length > 1) {
    const json = JSON.stringify(trimmed);
    if (json.length <= MAX_BYTES) break;
    trimmed = trimmed.slice(1);
  }

  return trimmed;
}

/** Sanitize a single message for storage. Strips non-string content. */
function _sanitize(msg) {
  return {
    id:        msg.id,
    role:      msg.role,
    content:   typeof msg.content === "string" ? msg.content : "",
    timestamp: msg.timestamp instanceof Date
      ? msg.timestamp.toISOString()
      : (typeof msg.timestamp === "string" ? msg.timestamp : new Date().toISOString()),
    ...(msg.meta != null ? { meta: msg.meta } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load saved chat messages for the given session_id.
 * Returns an array of message objects with `timestamp` as Date instances.
 * Returns [] if nothing is stored or data is invalid.
 */
export function loadChatHistory(sessionId) {
  try {
    const raw = localStorage.getItem(_key(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.messages)) return [];
    return parsed.messages.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

/**
 * Persist the current messages array for the given session_id.
 * Applies trimming before writing. Silently ignores storage errors.
 */
export function saveChatHistory(sessionId, messages) {
  if (!sessionId || !Array.isArray(messages)) return;
  try {
    const sanitized = messages.map(_sanitize);
    const trimmed   = _trim(sanitized);
    const payload   = {
      session_id: sessionId,
      updated_at: new Date().toISOString(),
      messages:   trimmed,
    };
    localStorage.setItem(_key(sessionId), JSON.stringify(payload));
  } catch {
    // Quota exceeded or unavailable — silently ignore.
  }
}

/**
 * Remove the stored chat history for the given session_id.
 * Does NOT touch enavia_session_id, memory, planner, or execution data.
 */
export function clearChatHistory(sessionId) {
  try {
    localStorage.removeItem(_key(sessionId));
  } catch {
    // Silently ignore.
  }
}
