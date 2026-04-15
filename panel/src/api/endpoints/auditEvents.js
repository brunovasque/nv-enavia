// ============================================================================
// ENAVIA Panel — Audit Events endpoint (PR6)
//
// Read-only access to memory/learning audit trail.
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope).
// ============================================================================

import { apiClient }                   from "../client.js";
import { normalizeError, ERROR_CODES } from "../errors.js";

/**
 * List audit events for memory and learning candidates.
 * @param {object} [filters] - Optional filters (event_type, target_type, target_id, limit)
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function listAuditEvents(filters) {
  const t0 = Date.now();
  try {
    const params = new URLSearchParams();
    if (filters?.event_type)  params.set("event_type", filters.event_type);
    if (filters?.target_type) params.set("target_type", filters.target_type);
    if (filters?.target_id)   params.set("target_id", filters.target_id);
    if (filters?.limit)       params.set("limit", String(filters.limit));
    const qs = params.toString();
    const path = qs ? `/memory/audit?${qs}` : "/memory/audit";
    const res = await apiClient.request(path);
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: "Eventos de auditoria indisponíveis." },
        "auditEvents",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "auditEvents");
  }
}
