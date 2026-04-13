// ============================================================================
// ENAVIA Panel — health endpoint (internal implementation, public via index.js)
//
// PR3 — Fetches minimal real health data from GET /health.
//
// Real mode: calls GET /health on the worker. The worker reads the latest
//   exec_event (PR1 source) via readExecEvent and derives:
//   - contadores reais mínimos (total=1, based on status_atual)
//   - erros recentes reais (exec_event with error status)
//   - bloqueadas: [] — honest fallback (not available in PR1 source)
//   - concluídas reais (exec_event with success status)
//
// Mock mode: returns MOCK_HEALTH directly so the panel works offline
//   and existing tests continue to pass.
// ============================================================================

import { apiClient }   from "../client.js";
import { getApiConfig } from "../config.js";
import { normalizeError } from "../errors.js";
import { mapHealthResponse } from "../mappers/health.js";
import { MOCK_HEALTH } from "../../health/mockHealth.js";

/**
 * Fetch health data — real minimal source (exec_event via PR1) in real mode,
 * MOCK_HEALTH fallback in mock mode.
 *
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function fetchHealth() {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    // Mock mode: return mock health data — no network request
    return { ok: true, data: MOCK_HEALTH, meta: { durationMs: Date.now() - t0 } };
  }

  try {
    const res = await apiClient.request("/health");

    if (!res.ok) {
      return normalizeError(
        { code: "HEALTH_ERROR", message: "Falha ao carregar dados de saúde." },
        "health",
      );
    }

    const data = mapHealthResponse(res.data?.health ?? null);
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "health");
  }
}
