// ============================================================================
// ENAVIA Panel — execution endpoint (internal implementation, public via index.js)
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js. Re-exports EXECUTION_STATUS so pages never reach into mock files.
//
// P14 — postDecision:
//   Records an approved or rejected decision for a canonical execution.
//   bridge_id is ALWAYS required — never called with bridge_id null/absent.
//   Rejection before bridge (no bridge_id) is NOT a valid P14 record.
// ============================================================================

import { apiClient }                   from "../client.js";
import { getApiConfig }                from "../config.js";
import { normalizeError, ERROR_CODES } from "../errors.js";
import { mapExecutionResponse }        from "../mappers/execution.js";
// Explicit contract reference — keeps this endpoint anchored to the central shapes.
import { ENVELOPES }                   from "../contracts.js"; // eslint-disable-line no-unused-vars

// Re-export status constants — pages import these from ../api, not from the mock.
export { EXECUTION_STATUS } from "../../execution/mockExecution.js";

/**
 * Fetch the current execution state.
 * @param {object} [opts]
 * @param {string} [opts._mockState] - mock state key (e.g. EXECUTION_STATUS.RUNNING)
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function fetchExecution(opts = {}) {
  const t0 = Date.now();
  try {
    const res = await apiClient.request("/execution", {
      _resource:  "execution",
      _mockState: opts._mockState,
    });

    if (!res.ok) {
      return normalizeError(
        { code: ERROR_CODES.EXECUTION_NOT_FOUND, message: "Execução não encontrada." },
        "execution",
      );
    }

    const data = mapExecutionResponse(res.data);
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "execution");
  }
}

// ── P14 — postDecision ────────────────────────────────────────────────────
//
// Records a human decision (approved | rejected) linked to a canonical execution.
//
// HARD RULE: bridge_id is MANDATORY. Calling this function without a real
// bridge_id is a contract violation. The caller (PlanPage) MUST guard this.
// Rejection before bridge dispatch has no bridge_id and MUST NOT call this function.
//
// Real mode: POST /execution/decision
// Mock mode: simulates the worker response.

/**
 * Record a human decision for a canonical execution identified by bridge_id.
 *
 * @param {object} params
 * @param {"approved"|"rejected"} params.decision
 * @param {string} params.bridge_id - canonical execution identifier (required, never null)
 * @param {string} [params.decided_by] - human identifier (default: "human")
 * @param {string|null} [params.context] - optional context note
 * @returns {Promise<import("../contracts.js").ResponseEnvelope>}
 */
export async function postDecision({ decision, bridge_id, decided_by = "human", context = null }) {
  const t0 = Date.now();

  // Hard guard — bridge_id is always required in a valid P14 record.
  if (!bridge_id || typeof bridge_id !== "string") {
    return normalizeError(
      {
        code: ERROR_CODES.EXECUTION_NOT_FOUND,
        message: "bridge_id ausente — decisão não pode ser registrada como P14 válida.",
      },
      "execution",
    );
  }

  const { mode } = getApiConfig();

  if (mode !== "real") {
    // Mock mode: simulate worker response
    await new Promise((r) => setTimeout(r, 200));
    return {
      ok: true,
      data: {
        ok: true,
        p14_valid: true,
        decision: {
          decision_id: `decision-mock-${Date.now().toString(36)}`,
          decision,
          bridge_id,
          decided_at: new Date().toISOString(),
          decided_by,
          context,
        },
        timestamp: Date.now(),
      },
      meta: { durationMs: Date.now() - t0 },
    };
  }

  try {
    const res = await apiClient.request("/execution/decision", {
      method: "POST",
      body: { decision, bridge_id, decided_by, context },
    });

    if (!res.ok) {
      return normalizeError(
        {
          code: ERROR_CODES.EXECUTION_NOT_FOUND,
          message: res.data?.error ?? "Falha ao registrar decisão.",
        },
        "execution",
      );
    }

    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "execution");
  }
}
