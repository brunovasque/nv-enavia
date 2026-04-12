// ============================================================================
// ENAVIA Panel — Error contracts
// Canonical ERROR_CODES and normalizeError().
// Every endpoint returns an ErrorEnvelope — shape is stable across P7–P10.
//
// ErrorEnvelope shape:
// {
//   ok: false,
//   data: null,
//   error: { code, message, module, retryable },
//   meta: { durationMs },
// }
// ============================================================================

export const ERROR_CODES = {
  // ── Common (any module) ──────────────────────────────────────────────────
  NETWORK_ERROR:    "NETWORK_ERROR",
  TIMEOUT:          "TIMEOUT",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  UNKNOWN_ERROR:    "UNKNOWN_ERROR",

  // ── Module-specific ──────────────────────────────────────────────────────
  CHAT_MODULE_FAILURE:  "CHAT_MODULE_FAILURE",
  PLAN_NOT_FOUND:       "PLAN_NOT_FOUND",
  PLANNER_UNAVAILABLE:  "PLANNER_UNAVAILABLE",
  EXECUTION_NOT_FOUND:  "EXECUTION_NOT_FOUND",
  EXECUTOR_UNAVAILABLE: "EXECUTOR_UNAVAILABLE",
  MEMORY_UNAVAILABLE:   "MEMORY_UNAVAILABLE",
};

/**
 * Converts any thrown value into a stable ErrorEnvelope.
 * @param {unknown} raw   - The caught error (Error, plain object, string, …)
 * @param {string}  module - "chat" | "plan" | "execution" | "memory" | "client"
 * @returns {ErrorEnvelope}
 */
export function normalizeError(raw, module = "client") {
  let code = ERROR_CODES.UNKNOWN_ERROR;
  let message = "Erro desconhecido.";
  let retryable = false;

  if (raw && typeof raw === "object") {
    const err = /** @type {any} */ (raw);

    if (err.code && Object.values(ERROR_CODES).includes(err.code)) {
      code = err.code;
      message = err.message ?? message;
    } else if (err.name === "AbortError" || err.name === "TimeoutError") {
      code = ERROR_CODES.TIMEOUT;
      message = "A requisição excedeu o tempo limite.";
      retryable = true;
    } else if (err instanceof TypeError) {
      code = ERROR_CODES.NETWORK_ERROR;
      message = "Falha de rede. Verifique a conexão.";
      retryable = true;
    } else {
      message = err.message ?? message;
    }
  } else if (typeof raw === "string") {
    message = raw;
  }

  if (code === ERROR_CODES.NETWORK_ERROR || code === ERROR_CODES.TIMEOUT) {
    retryable = true;
  }

  return {
    ok: false,
    data: null,
    error: { code, message, module, retryable },
    meta: { durationMs: 0 },
  };
}
