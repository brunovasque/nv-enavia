// ============================================================================
// ENAVIA Panel — memory endpoint (internal implementation, public via index.js)
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js. Re-exports MEMORY_STATES/MEMORY_FILTERS so pages never reach
// into mock files.
// ============================================================================

import { apiClient }                   from "../client.js";
import { normalizeError, ERROR_CODES } from "../errors.js";
import { mapMemoryResponse }           from "../mappers/memory.js";
// Explicit contract reference — keeps this endpoint anchored to the central shapes.
import { ENVELOPES }                   from "../contracts.js"; // eslint-disable-line no-unused-vars

// Re-export status/filter constants — pages import these from ../api, not from the mock.
export { MEMORY_STATES, MEMORY_FILTERS } from "../../memory/mockMemory.js";

/**
 * Fetch the current memory state.
 * @param {object} [opts]
 * @param {string} [opts._mockState] - mock state key (e.g. MEMORY_STATES.POPULATED)
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function fetchMemory(opts = {}) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/memory", {
      _resource:  "memory",
      _mockState: opts._mockState,
    });

    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: "Memória indisponível." },
        "memory",
      );
    }

    const data = mapMemoryResponse(res.data);
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "memory");
  }
}
