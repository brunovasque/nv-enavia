// ============================================================================
// ENAVIA Panel — Memory mapper (internal)
// Wraps raw memory fixture/API response into MemoryViewPayload (see
// contracts.js SHAPES.MEMORY).
// ============================================================================

import { SHAPES } from "../contracts.js";

/**
 * @param {object|null} raw - raw memory object
 * @returns {import("../contracts.js").MemoryViewPayload}
 */
export function mapMemoryResponse(raw) {
  return {
    [SHAPES.MEMORY.MEMORY]:     raw ?? null,
    [SHAPES.MEMORY.FETCHED_AT]: new Date().toISOString(),
  };
}
