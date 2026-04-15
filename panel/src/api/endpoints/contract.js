// ============================================================================
// ENAVIA Panel — Contract API Endpoint (PR4, panel-only)
//
// Fetches active contract state + adherence result for the Contract Surface.
//
// Runtime flow (real mode):
//   Calls GET /contracts/active-surface on the worker. No _mockState involved.
//
// Mock flow (dev/test mode):
//   Returns MOCK_CONTRACT[ACTIVE_ALLOW] by default (no _mockState needed).
//   Accepts optional _mockState param for dev tools / tests to cycle states.
// ============================================================================

import { apiClient }   from "../client.js";
import { getApiConfig } from "../config.js";
import { normalizeError } from "../errors.js";
import { MOCK_CONTRACT, CONTRACT_SURFACE_STATUS } from "../../contract/mockContract.js";

/**
 * Fetch contract surface data — active state + adherence gate result.
 *
 * In real mode: calls the worker endpoint directly.
 * In mock mode: returns the default fixture (ACTIVE_ALLOW) unless
 *   opts._mockState is explicitly provided (dev tools / tests only).
 *
 * @param {object} [opts]
 * @param {string} [opts._mockState] — dev/test only: override mock state key
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function fetchContractSurface(opts = {}) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    // Mock mode — default fixture unless _mockState explicitly overrides
    const stateKey = opts._mockState || CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW;
    const data = MOCK_CONTRACT[stateKey] ?? MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.NO_CONTRACT];
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  }

  // Real mode — call the worker endpoint. No _mockState involvement.
  try {
    const res = await apiClient.request("/contracts/active-surface");

    if (!res.ok) {
      return normalizeError(
        { code: "CONTRACT_SURFACE_ERROR", message: "Falha ao carregar dados do contrato ativo." },
        "contract",
      );
    }

    const data = res.data ?? { active_state: null, adherence: null };
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "contract");
  }
}

export { CONTRACT_SURFACE_STATUS };
