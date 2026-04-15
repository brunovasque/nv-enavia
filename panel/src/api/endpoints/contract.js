// ============================================================================
// ENAVIA Panel — Contract API Endpoint (PR4, panel-only)
//
// Fetches active contract state + adherence result for the Contract Surface.
// Mock mode: returns MOCK_CONTRACT fixtures.
// Real mode: calls GET /contracts/active-surface on the worker.
// ============================================================================

import { apiClient }   from "../client.js";
import { getApiConfig } from "../config.js";
import { normalizeError } from "../errors.js";
import { MOCK_CONTRACT, CONTRACT_SURFACE_STATUS } from "../../contract/mockContract.js";

/**
 * Fetch contract surface data — active state + adherence gate result.
 *
 * @param {object} [opts]
 * @param {string} [opts._mockState] — mock state key (CONTRACT_SURFACE_STATUS)
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function fetchContractSurface(opts = {}) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    const stateKey = opts._mockState || CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW;
    const data = MOCK_CONTRACT[stateKey] ?? MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.NO_CONTRACT];
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  }

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
