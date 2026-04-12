// ============================================================================
// ENAVIA Panel — Plan mapper (internal)
// Wraps raw plan fixture/API response into PlanViewPayload (see contracts.js
// SHAPES.PLAN).
// ============================================================================

import { SHAPES } from "../contracts.js";

/**
 * @param {object|null} raw - raw plan object (may be null for EMPTY state)
 * @returns {import("../contracts.js").PlanViewPayload}
 */
export function mapPlanResponse(raw) {
  return {
    [SHAPES.PLAN.PLAN]:       raw ?? null,
    [SHAPES.PLAN.FETCHED_AT]: new Date().toISOString(),
  };
}
