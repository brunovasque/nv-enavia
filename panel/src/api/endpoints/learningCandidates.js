// ============================================================================
// ENAVIA Panel — Learning Candidates endpoint (PR5)
//
// CRUD operations for learning candidates via the panel.
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope).
// ============================================================================

import { apiClient }                   from "../client.js";
import { normalizeError, ERROR_CODES } from "../errors.js";

/**
 * List learning candidates.
 * @param {object} [filters] - Optional filters (status: "pending"|"approved"|"rejected")
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function listLearningCandidates(filters) {
  const t0 = Date.now();
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    const path = qs ? `/memory/learning?${qs}` : "/memory/learning";
    const res = await apiClient.request(path);
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: "Candidatos de aprendizado indisponíveis." },
        "learningCandidates",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "learningCandidates");
  }
}

/**
 * Register a new learning candidate.
 * @param {object} payload
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function createLearningCandidate(payload) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/memory/learning", {
      method: "POST",
      body: payload,
    });
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: res.data?.error || "Erro ao registrar candidato." },
        "learningCandidates",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "learningCandidates");
  }
}

/**
 * Approve a learning candidate (human approval).
 * @param {string} candidate_id
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function approveLearningCandidate(candidate_id) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/memory/learning/approve", {
      method: "POST",
      body: { candidate_id },
    });
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: res.data?.error || "Erro ao aprovar candidato." },
        "learningCandidates",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "learningCandidates");
  }
}

/**
 * Reject a learning candidate (human rejection).
 * @param {string} candidate_id
 * @param {string} [reason]
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function rejectLearningCandidate(candidate_id, reason) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/memory/learning/reject", {
      method: "POST",
      body: { candidate_id, reason },
    });
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: res.data?.error || "Erro ao rejeitar candidato." },
        "learningCandidates",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "learningCandidates");
  }
}
