// ============================================================================
// ENAVIA Panel — Plan mapper (internal)
// Wraps raw plan fixture/API response into the canonical PlanEnvelope shape.
// ============================================================================

/**
 * @param {object|null} raw - raw plan object (may be null for EMPTY state)
 * @returns {{ plan: object|null, fetchedAt: string }}
 */
export function mapPlanResponse(raw) {
  return {
    plan:      raw ?? null,
    fetchedAt: new Date().toISOString(),
  };
}
