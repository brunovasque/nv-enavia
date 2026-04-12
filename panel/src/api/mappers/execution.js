// ============================================================================
// ENAVIA Panel — Execution mapper (internal)
// Wraps raw execution fixture/API response into the canonical ExecutionEnvelope.
// ============================================================================

/**
 * @param {object|null} raw - raw execution object (may be null for IDLE state)
 * @returns {{ execution: object|null, fetchedAt: string }}
 */
export function mapExecutionResponse(raw) {
  return {
    execution: raw ?? null,
    fetchedAt: new Date().toISOString(),
  };
}
