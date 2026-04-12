// ============================================================================
// ENAVIA Panel — bridge endpoint (P12)
//
// sendBridge() is the only public function for the bridge module.
// Sends the approved bridge payload to the worker's /planner/bridge endpoint.
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js.
//
// Real mode: posts to /planner/bridge with the executor_payload from the
// planner snapshot. The worker validates and forwards to the executor.
//
// Mock mode: simulates a successful bridge send with a short delay.
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
