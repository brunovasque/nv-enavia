// ============================================================================
// ENAVIA Panel — Chat mapper (internal)
// Normalises raw chat transport response to the canonical ChatMessage shape.
// ============================================================================

/**
 * @param {{ role?: string, content: string, timestamp?: string, sessionId?: string }} raw
 * @param {string} sessionId
 * @returns {{ role: string, content: string, timestamp: string, sessionId: string } | null}
 */
export function mapChatResponse(raw, sessionId) {
  if (!raw || typeof raw.content !== "string") return null;
  return {
    role:      raw.role      ?? "enavia",
    content:   raw.content,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    sessionId: raw.sessionId ?? sessionId,
  };
}
