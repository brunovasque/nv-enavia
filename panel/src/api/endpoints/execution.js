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
  const { mode } = getApiConfig();
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

    // In real mode the worker wraps the execution trail: { ok, execution }.
    // In mock mode res.data is already the execution object (or null for IDLE).
    const rawExecution = mode === "real" ? (res.data?.execution ?? null) : res.data;
    const data = mapExecutionResponse(rawExecution);
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "execution");
  }
}

// ── P24 — approveMerge ────────────────────────────────────────────────────
//
// Calls POST /github-pr/approve-merge — the formal merge approval button in
// the panel. The caller provides summary_for_merge and reason_merge_ok (both
// sourced from the merge_gate state returned by the backend). All boolean
// readiness gates are set to true because the backend already verified them
// when it produced the awaiting_formal_approval state.
//
// Mock mode: simulates an approved_for_merge response.
// Real mode: calls the actual worker route.

/**
 * Send formal merge approval for the current PR/execution.
 *
 * @param {object} params
 * @param {string} params.summary_for_merge - Summary of what was done (from merge_gate)
 * @param {string} params.reason_merge_ok   - Short reason why merge is safe (from merge_gate)
 * @returns {Promise<import("../contracts.js").ResponseEnvelope>}
 */
export async function approveMerge({ summary_for_merge, reason_merge_ok }) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    await new Promise((r) => setTimeout(r, 300));
    return {
      ok: true,
      data: {
        ok: true,
        merge_status: "approved_for_merge",
        can_merge: true,
        message: "Merge aprovado formalmente (mock).",
        summary_for_merge,
        reason_merge_ok,
      },
      meta: { durationMs: Date.now() - t0 },
    };
  }

  try {
    const res = await apiClient.request("/github-pr/approve-merge", {
      method: "POST",
      body: {
        scope_approved: true,
        gates_context: { arm_id: "p24_github_pr_arm" },
        merge_context: {
          contract_rechecked: true,
          phase_validated: true,
          no_regression: true,
          diff_reviewed: true,
          summary_reviewed: true,
          summary_for_merge,
          reason_merge_ok,
          approval_status: "approved",
        },
        drift_detected: false,
        regression_detected: false,
      },
    });

    if (!res.ok) {
      return normalizeError(
        {
          code: ERROR_CODES.BRIDGE_SEND_FAILURE,
          message: res.data?.message ?? "Falha ao aprovar merge.",
        },
        "github-pr",
      );
    }

    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "github-pr");
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
