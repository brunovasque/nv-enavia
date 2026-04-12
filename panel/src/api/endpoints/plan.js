// ============================================================================
// ENAVIA Panel — plan endpoint (internal implementation, public via index.js)
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js. Re-exports PLAN_STATUS so pages never reach into mock files.
// ============================================================================

import { apiClient }                   from "../client.js";
import { normalizeError, ERROR_CODES } from "../errors.js";
import { mapPlanResponse }             from "../mappers/plan.js";
// Explicit contract reference — keeps this endpoint anchored to the central shapes.
import { ENVELOPES }                   from "../contracts.js"; // eslint-disable-line no-unused-vars

// Re-export status constants — pages import these from ../api, not from the mock.
export { PLAN_STATUS } from "../../plan/mockPlan.js";

/**
 * Fetch the current plan.
 * @param {object} [opts]
 * @param {string} [opts._mockState] - mock state key (e.g. PLAN_STATUS.READY)
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function fetchPlan(opts = {}) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/plan", {
      _resource:   "plan",
      _mockState:  opts._mockState,
    });

    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.PLAN_NOT_FOUND, message: "Plano não encontrado." },
        "plan",
      );
    }

    const data = mapPlanResponse(res.data);
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "plan");
  }
}
