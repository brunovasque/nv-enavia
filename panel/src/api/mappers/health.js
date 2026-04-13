// ============================================================================
// ENAVIA Panel — Health mapper (internal)
//
// PR3 — Maps raw /health response from the worker to the HealthPage shape.
//
// Source: GET /health → { ok, health: { generatedAt, status, summary,
//   recentErrors, blockedExecutions, recentCompleted, _source } }
//
// Honesty markers preserved from worker:
//   _source: "exec_event"       — data derived from real PR1 exec_event
//   _source: "exec_event_absent" — no event found in KV → idle fallback
//   _source: "no_kv"            — KV unavailable → idle fallback
// ============================================================================

import { MOCK_HEALTH_IDLE } from "../../health/mockHealth.js";

/**
 * Map raw health object from GET /health to HealthPage data shape.
 *
 * @param {object|null} raw - raw health object from the worker response
 * @returns {object} - HealthPage-compatible health data
 */
export function mapHealthResponse(raw) {
  if (!raw) return MOCK_HEALTH_IDLE;

  return {
    generatedAt:       raw.generatedAt       ?? null,
    status:            raw.status            ?? "idle",
    summary:           raw.summary           ?? MOCK_HEALTH_IDLE.summary,
    recentErrors:      Array.isArray(raw.recentErrors)      ? raw.recentErrors      : [],
    blockedExecutions: Array.isArray(raw.blockedExecutions) ? raw.blockedExecutions : [],
    recentCompleted:   Array.isArray(raw.recentCompleted)   ? raw.recentCompleted   : [],
    _source:           raw._source           ?? "unknown",
  };
}
