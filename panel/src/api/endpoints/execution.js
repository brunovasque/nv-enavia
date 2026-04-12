// ============================================================================
// ENAVIA Panel — execution endpoint (internal implementation, public via index.js)
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js. Re-exports EXECUTION_STATUS so pages never reach into mock files.
// ============================================================================

import { apiClient }                   from "../client.js";
import { normalizeError, ERROR_CODES } from "../errors.js";
import { mapExecutionResponse }        from "../mappers/execution.js";
// Explicit contract reference — keeps this endpoint anchored to the central shapes.
import { ENVELOPES }                   from "../contracts.js"; // eslint-disable-line no-unused-vars

// Re-export status constants — pages import these from ../api, not from the mock.
export { EXECUTION_STATUS } from "../../execution/mockExecution.js";

/**
 * Fetch the current execution state.
 * @param {object} [opts]
 * @param {string} [opts._mockState] - mock state key (e.g. EXECUTION_STATUS.RUNNING)
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function fetchExecution(opts = {}) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/execution", {
      _resource:  "execution",
      _mockState: opts._mockState,
    });

    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.EXECUTION_NOT_FOUND, message: "Execução não encontrada." },
        "execution",
      );
    }

    const data = mapExecutionResponse(res.data);
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "execution");
  }
}
