// ============================================================================
// ENAVIA Panel — Manual Memory endpoint (PR4)
//
// CRUD operations for manual memories via the panel.
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope).
// ============================================================================

import { apiClient }                   from "../client.js";
import { normalizeError, ERROR_CODES } from "../errors.js";

/**
 * List all manual memories.
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function listManualMemories() {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/memory/manual");
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: "Memória manual indisponível." },
        "manualMemory",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "manualMemory");
  }
}

/**
 * Create a manual memory.
 * @param {object} payload
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function createManualMemory(payload) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/memory/manual", {
      method: "POST",
      body: payload,
    });
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: res.data?.error || "Erro ao criar memória manual." },
        "manualMemory",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "manualMemory");
  }
}

/**
 * Update a manual memory.
 * @param {object} payload - Must include memory_id + fields to patch
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function updateManualMemory(payload) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/memory/manual", {
      method: "PATCH",
      body: payload,
    });
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: res.data?.error || "Erro ao editar memória manual." },
        "manualMemory",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "manualMemory");
  }
}

/**
 * Block a manual memory.
 * @param {string} memory_id
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function blockManualMemory(memory_id) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/memory/manual/block", {
      method: "POST",
      body: { memory_id },
    });
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: res.data?.error || "Erro ao bloquear memória manual." },
        "manualMemory",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "manualMemory");
  }
}

/**
 * Invalidate/expire a manual memory.
 * @param {string} memory_id
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function invalidateManualMemory(memory_id) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/memory/manual/invalidate", {
      method: "POST",
      body: { memory_id },
    });
    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.MEMORY_UNAVAILABLE, message: res.data?.error || "Erro ao invalidar memória manual." },
        "manualMemory",
      );
    }
    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "manualMemory");
  }
}
