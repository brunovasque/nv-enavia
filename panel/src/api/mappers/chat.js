// ============================================================================
// ENAVIA Panel — Chat mapper (internal)
// Normalises raw chat transport response to the ChatResponse shape defined in
// contracts.js (SHAPES.CHAT).
// ============================================================================

import { SHAPES } from "../contracts.js";

/**
 * @param {{ role?: string, content: string, timestamp?: string, sessionId?: string }} raw
 * @param {string} sessionId
 * @returns {import("../contracts.js").ChatResponse | null}
 */
export function mapChatResponse(raw, sessionId) {
  if (!raw || typeof raw.content !== "string") return null;
  return {
    [SHAPES.CHAT.ROLE]:       raw.role      ?? "enavia",
    [SHAPES.CHAT.CONTENT]:    raw.content,
    [SHAPES.CHAT.TIMESTAMP]:  raw.timestamp ?? new Date().toISOString(),
    [SHAPES.CHAT.SESSION_ID]: raw.sessionId ?? sessionId,
  };
}
