// ============================================================================
// ENAVIA Panel — bridge endpoint (P12 + P14)
//
// sendBridge()        — P12: Sends the approved bridge payload to the worker.
// fetchBridgeStatus() — P14: Queries executor operational status post-dispatch.
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js.
//
// Real mode: posts to /planner/bridge (P12) or /engineer (P14) on the worker.
// Mock mode: simulates responses with a short delay.
// ============================================================================

import { getApiConfig }                from "../config.js";
import { getSessionId }                from "../session.js";
import { normalizeError, ERROR_CODES } from "../errors.js";
import { apiClient }                   from "../client.js";

const MOCK_DELAY = () => 400 + Math.random() * 300;

/**
 * Send the bridge payload to the worker after gate approval.
 *
 * @param {object} executorPayload — executor_payload from plannerSnapshot.bridge
 * @returns {Promise<import("../contracts.js").ResponseEnvelope>}
 */
export async function sendBridge(executorPayload) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    // Mock mode: simulate bridge send
    await new Promise((r) => setTimeout(r, MOCK_DELAY()));
    return {
      ok: true,
      data: {
        bridge_accepted: true,
        bridge_id: `mock-bridge-${Date.now()}`,
        executor_response: { ok: true, mock: true },
        timestamp: Date.now(),
      },
      meta: { durationMs: Date.now() - t0 },
    };
  }

  // Validate payload before sending
  if (
    !executorPayload ||
    typeof executorPayload !== "object" ||
    typeof executorPayload.version !== "string" ||
    typeof executorPayload.source !== "string" ||
    !Array.isArray(executorPayload.steps)
  ) {
    return normalizeError(
      {
        code: ERROR_CODES.BRIDGE_SEND_FAILURE,
        message: "executor_payload inválido — campos obrigatórios: version, source, steps.",
      },
      "bridge",
    );
  }

  try {
    const res = await apiClient.request("/planner/bridge", {
      method: "POST",
      body: {
        executor_payload: executorPayload,
        session_id: getSessionId(),
      },
    });

    if (!res.ok || !res.data?.ok) {
      const rawErr = res.data?.error ?? res.data?.detail;
      const errMsg = typeof rawErr === "string"
        ? rawErr
        : (rawErr && typeof rawErr === "object" && typeof rawErr.message === "string"
          ? rawErr.message
          : "Falha ao enviar bridge payload.");
      return normalizeError(
        { code: ERROR_CODES.BRIDGE_SEND_FAILURE, message: errMsg },
        "bridge",
      );
    }

    return {
      ok: true,
      data: {
        bridge_accepted: res.data.bridge_accepted ?? true,
        bridge_id: res.data.bridge_id ?? null,
        executor_response: res.data.executor_response ?? null,
        timestamp: res.data.timestamp ?? Date.now(),
      },
      meta: { durationMs: Date.now() - t0 },
    };
  } catch (err) {
    return normalizeError(err, "bridge");
  }
}

// ============================================================================
// P14 — fetchBridgeStatus
//
// Queries the executor for current operational status after bridge dispatch.
// Uses the existing /engineer route on the worker, which proxies { action: "status" }
// to the executor via service binding.
//
// This is NOT polling. It is a one-shot query triggered manually by the operator.
// The source of truth is the executor's response — no fabrication.
// ============================================================================

/**
 * Query the executor for operational status after bridge dispatch.
 *
 * @param {string} bridgeId — bridge_id from the sendBridge result
 * @returns {Promise<import("../contracts.js").ResponseEnvelope>}
 */
// ============================================================================
// P14 — postDecision
//
// Persists a human decision (approved / rejected) linked to an execution
// via bridge_id. Calls POST /execution/decision on the worker, which writes
// the record to KV for durable, canonical decision history.
//
// Fire-and-forget from the caller's perspective — the UI should not block
// on this; gate action is applied optimistically via local React state.
// ============================================================================

/**
 * Persist a human gate decision to the worker's KV-backed decision history.
 *
 * @param {object} params
 * @param {"approved"|"rejected"} params.decision — decision type
 * @param {string|null}           params.bridge_id — bridge_id if available
 * @param {string}                [params.decided_by] — actor (default: "human")
 * @param {string|null}           [params.context] — optional human-readable context
 * @returns {Promise<import("../contracts.js").ResponseEnvelope>}
 */
export async function postDecision({ decision, bridge_id, decided_by, context }) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    // Mock mode: simulate decision persistence
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));
    return {
      ok: true,
      data: {
        decision: {
          decision_id: `mock-decision-${Date.now()}`,
          decision,
          bridge_id: bridge_id || null,
          decided_at: new Date().toISOString(),
          decided_by: decided_by || "human",
          context: context || null,
        },
      },
      meta: { durationMs: Date.now() - t0 },
    };
  }

  if (decision !== "approved" && decision !== "rejected") {
    return normalizeError(
      {
        code: ERROR_CODES.BRIDGE_SEND_FAILURE,
        message: "decision inválido — valores aceitos: 'approved', 'rejected'.",
      },
      "bridge",
    );
  }

  try {
    const res = await apiClient.request("/execution/decision", {
      method: "POST",
      body: {
        decision,
        bridge_id: bridge_id || null,
        decided_by: decided_by || "human",
        context: context || null,
      },
    });

    if (!res.ok || !res.data?.ok) {
      const rawErr = res.data?.error ?? res.data?.detail;
      const errMsg = typeof rawErr === "string"
        ? rawErr
        : "Falha ao persistir decisão.";
      return normalizeError(
        { code: ERROR_CODES.BRIDGE_SEND_FAILURE, message: errMsg },
        "bridge",
      );
    }

    return {
      ok: true,
      data: res.data.decision ?? null,
      meta: { durationMs: Date.now() - t0 },
    };
  } catch (err) {
    return normalizeError(err, "bridge");
  }
}

export async function fetchBridgeStatus(bridgeId) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    // Mock mode: simulate executor operational status response
    await new Promise((r) => setTimeout(r, MOCK_DELAY()));
    return {
      ok: true,
      data: {
        executor_reachable: true,
        bridge_id: bridgeId || null,
        executor_status: {
          ok: true,
          status: "operational",
        },
        queried_at: new Date().toISOString(),
      },
      meta: { durationMs: Date.now() - t0 },
    };
  }

  if (!bridgeId || typeof bridgeId !== "string") {
    return normalizeError(
      {
        code: ERROR_CODES.BRIDGE_SEND_FAILURE,
        message: "bridge_id ausente — não é possível consultar status.",
      },
      "bridge",
    );
  }

  try {
    const res = await apiClient.request("/engineer", {
      method: "POST",
      body: {
        action: "status",
        bridge_id: bridgeId,
        session_id: getSessionId(),
      },
    });

    const reachable = res.ok && res.data != null;

    return {
      ok: true,
      data: {
        executor_reachable: reachable,
        bridge_id: bridgeId,
        executor_status: reachable ? res.data : null,
        queried_at: new Date().toISOString(),
      },
      meta: { durationMs: Date.now() - t0 },
    };
  } catch (err) {
    return normalizeError(err, "bridge");
  }
}
