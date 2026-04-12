// ============================================================================
// ENAVIA Panel — Execution mapper (internal)
// Wraps raw execution fixture/API response into ExecutionViewPayload (see
// contracts.js SHAPES.EXECUTION).
// ============================================================================

import { SHAPES } from "../contracts.js";

/**
 * @param {object|null} raw - raw execution object (may be null for IDLE state)
 * @returns {import("../contracts.js").ExecutionViewPayload}
 */
export function mapExecutionResponse(raw) {
  return {
    [SHAPES.EXECUTION.EXECUTION]:  raw ?? null,
    [SHAPES.EXECUTION.FETCHED_AT]: new Date().toISOString(),
  };
}
